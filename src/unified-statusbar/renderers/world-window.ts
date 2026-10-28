// renderers/world-window.ts
// 世界演化窗口：台前（B 结构：入镜置顶+传闻+演化纪事）/ 幕后（角色侧写+传闻）/ 入镜队列 三页签。
// 演化纪事仅在台前展示（不注入世界书）。
import { type StyleType } from '../core/constants';
import { ensureStyleOnce } from './style-once';
import { ubIcon } from '../core/icons';
import { type Rumor, type Intrusion, type WorldState } from '../core/world-engine/world-types';
import { loadWorldState, saveWorldState } from '../core/world-engine/world-store';
import { pendingIntrusions, fillIntrusionHook, triggerIntrusion, removeIntrusion } from '../core/world-engine/world-intrusion';
import { manualEvolve, undoLastEvolve, isWorldEvolveUndoAvailable } from '../core/world-engine/world-evolution';
import { projectWorldDigest, projectCharacterDynamics } from '../core/world-engine/world-worldbook';
import { getToastr } from '../core/env';
import { charThreadStage, RUMOR_LEVEL_LABEL, buildFrontDigest, timeBadgeHtml, deriveRumorStatusText } from '../core/world-engine/world-state';
import { getConfig } from '../core/config-store';
import { escapeHtml } from '../core/html-escape';
import { markPopupShown, guardGhostClick, closePanelOverlay, syncDarkClass as sharedSyncDarkClass, syncDarkClassMinimal as sharedSyncDarkClassMinimal } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { getTodayWeather, getTodayDateKey, monthDayOfDateKey } from '../core/calendar-core';
import { worldWindowBaseCSS } from '../styles/world-window-base';   // v1.1

export const WORLD_WINDOW_CLASS = 'world-window ub-popup--l';

function masthead(style: StyleType): string {
  switch (style) {
    case 'ancient': return '世·界·邸·报';
    case 'flirtatious': return '✦ 午夜世界 ✦';
    case 'minimal': return 'WORLD · DAILY';
    case 'sweet': return '🍬 世界糖果报';
    case 'xianxia': return '灵霄世界录';
    case 'bridge': return '航行世界报';
    default: return '世界演化';
  }
}

/** 相对时间徽标：截至 MM-DD · N天前（updatedAt 空或无效返回 ''）。纯展示层，不落世界书/存储。 */
function profileCardHtml(p: any, today = ''): string {
  // WS4：暗中打算线程——目标/进度条+数字+阶段/进展文字三行；goalDone 完成留痕；无线程回退原格式
  const prog = Number(p.goalProgress);
  let threadBlock = '';
  if (p.hiddenGoal) {
    if (typeof p.goalProgress === 'number') {
      threadBlock = prog >= 100
        ? `<div class="ww-vault-row ww-hidden">暗中打算（已完成）：${escapeHtml(p.hiddenGoal)} <em class="ww-notknown">主角不知</em></div>`
        : `<div class="ww-vault-row ww-hidden">暗中打算（${Math.round(prog)}%·${charThreadStage(prog)}）<em class="ww-notknown">主角不知</em>
          <div class="ww-thread-goal">目标：${escapeHtml(p.hiddenGoal)}</div>
          <div class="ww-thread-bar"><span style="width:${Math.max(2, prog)}%"></span></div>
          ${p.goalProgressText ? `<div class="ww-thread-progress">进展：${escapeHtml(p.goalProgressText)}</div>` : ''}</div>`;
    } else {
      threadBlock = `<div class="ww-vault-row ww-hidden">暗中打算：${escapeHtml(p.hiddenGoal)} <em class="ww-notknown">主角不知</em></div>`;
    }
  } else if (p.goalDone) {
    threadBlock = `<div class="ww-vault-row ww-hidden">暗中打算（已完成 ${escapeHtml(p.goalDone)}）<em class="ww-notknown">主角不知</em></div>`;
  }
  return `<div class="ww-vault-card">
    <div class="ww-vault-name"><button type="button" class="ww-vault-name-btn" data-beyond-char-name="${escapeHtml(p.name)}" title="打开角色中枢">${escapeHtml(p.name)}</button>${p.onStage ? '<em class="ww-onstage">在场</em>' : '<em class="ww-offstage">离场</em>'}${timeBadgeHtml(p.updatedAt, today)}<button type="button" class="ww-vault-del" data-name="${escapeHtml(p.name)}" title="删除动向并停用该角色的演化">${ubIcon('close')}</button></div>
    <div class="ww-vault-row">动向：${escapeHtml(p.activity || '如常')}</div>
    <div class="ww-vault-row">打算：${escapeHtml(p.plans || '无')}</div>
    ${threadBlock}
  </div>`;
}

/** F31②：纪事/回廊日期 → 当日剧情回顾跳转钮。dateKey 为空（旧纪事）时保持死文本，不给可点样式。 */
function chronicleDateHtml(dateKey: unknown, cls = ''): string {
  const raw = String(dateKey ?? '');
  const key = raw.trim();
  const classAttr = cls ? ` class="${cls}"` : '';
  if (!key) return `<em${classAttr}>${escapeHtml(raw)}</em>`;
  return `<em class="${`${cls} ww-date-jump`.trim()}" data-date-jump="${escapeHtml(key)}" title="查看当日剧情回顾">${escapeHtml(key)}</em>`;
}

/** 台前渲染集：与 buildFrontDigest 同源同滤（主角可知集合）。
 *  传闻=heard/known；入镜=aiTriggered character_arrival 且 title||hook 非空。 */
export function frontSectionsFromState(state: WorldState): { rumors: Rumor[]; arrivals: Intrusion[] } {
  return {
    rumors: (state.rumors || []).filter(r => r.level === 'heard' || r.level === 'known'),
    arrivals: (state.pendingIntrusions || []).filter(i => i.kind === 'character_arrival' && i.aiTriggered && (i.title || i.hook)),
  };
}

/** 演化纪事纵向时间线（仅展示，不注入世界书）。 */
function buildChronicleHtml(state: any): string {
  const items = (state.chronicle || []).map((c: any) => `<div class="ww-chronicle-item ww-chron-${c.kind === 'big' ? 'big' : 'small'}">
    <div class="ww-chron-dot"></div>
    <div class="ww-chron-body">
      <div class="ww-chron-meta">${chronicleDateHtml(c.dateKey)}<span class="ww-chron-kind">${c.kind === 'big' ? '大演化' : '小演化'}</span></div>
      <div class="ww-chron-summary">${escapeHtml(c.summary)}</div>
      ${c.changed?.rumorsGone?.length ? `<div class="ww-chron-gone">传闻消散：${c.changed.rumorsGone.map((t: string) => escapeHtml(t)).join('、')}</div>` : ''}
    </div>
  </div>`).join('');
  return `<div class="ww-chronicle">${items || '<div class="ww-empty">暂无纪事</div>'}</div>`;
}

/** 回廊（变化时间轴）：一轮演化 = 一张轮次卡，**一个角色 = 一个块**，块内按维度分行
 *  （动向 / 打算 / 暗线 / 入镜 四个来源全部收进同一块）；传闻不属角色，单独成组排在角色之后。
 *  默认折叠：卡头一行（日期 + 轮次 + 变化面统计 + 开合折角）+ 摘要名录一行，点卡头开合看全文。
 *  数据源=chronicle 条目：deltas 由 generateChronicle 对 prev/next 本地差分产出（零 AI 输出/零 token）。
 *  不回显 c.summary（世界掠影/摘要）：那段正文与台前「演化纪事」逐字重复，回廊只讲“变了什么”。
 *  旧存档纪事无 deltas ⇒ 用 changed 名单产出名单胶囊（同一语汇，只是没有前后值），不空白。
 *  认知边界：暗中打算（暗线）属「主角不知」，维度标签带 .ww-notknown 标记（视觉由 warm 底色承载，
 *  见 .ww-arc-dim.is-hidden），与幕后页签同口径 —— 排版重构时不许把它摘掉。 */
/** 差分行的语义分类（供回廊过滤器按类显隐；CSS 与 JS 都读 data-arc-kind）。 */
const ARC_KIND_BY_TAG: Record<string, string> = {
  'is-move': 'profile', 'is-rumor': 'rumor', 'is-new': 'rumor',
  'is-thread': 'thread', 'is-in': 'intrusion', 'is-gone': 'gone',
};

/** 卡头构成统计的顺序与文案（kind 值域与 ARC_KIND_BY_TAG 一一对应）。 */
const ARC_TALLY_ORDER: { kind: string; label: string }[] = [
  { kind: 'profile', label: '角色' }, { kind: 'rumor', label: '传闻' },
  { kind: 'thread', label: '线程' }, { kind: 'intrusion', label: '入镜' },
  { kind: 'gone', label: '消散' },
];

/** 一行 = 定宽分类标签列 + 内容列（内容列按语义分派，见 arcRowsFromEntry）。
 *  同时回报 kind，供卡头构成统计直接计数——不回头正则扫 HTML。 */
function arcRow(tagClass: string, tag: string, body: string): { kind: string; html: string } {
  const kind = ARC_KIND_BY_TAG[tagClass] || 'other';
  return {
    kind,
    html: `<div class="ww-arc-line" data-arc-kind="${kind}"><span class="ww-arc-tag ${tagClass}">${tag}</span><div class="ww-arc-body">${body}</div></div>`,
  };
}

/** 增量条：底段=起点（灰）、亮段=增量（特征色）；轨道复用幕后 .ww-thread-bar。 */
function arcMeter(from: number, to: number): string {
  const down = to < from;
  const lo = down ? to : from;
  const w = Math.max(1, Math.abs(to - from));
  return `<div class="ww-thread-bar ww-arc-meter${down ? ' is-down' : ''}">`
    + `<span class="ww-arc-meter-base" style="width:${lo}%"></span>`
    + `<span class="ww-arc-meter-gain" style="left:${lo}%;width:${w}%"></span></div>`;
}

/** 仪表片断（整体一个 flex 项）：条 + 起点→终点 + 增量。整条抱团折行，
 *  否则窄行会把「条形」和「阶段达成」撕到两行去。 */
function arcGauge(from: number, to: number): string {
  const d = to - from;
  const delta = d === 0 ? '' : `<b class="ww-arc-delta${d < 0 ? ' is-flat' : ''}">${d > 0 ? '+' : ''}${d}</b>`;
  return `<span class="ww-arc-gauge">${arcMeter(from, to)}`
    + `<em class="ww-arc-num">${from}%</em><span class="ww-arc-arr">→</span>`
    + `<em class="ww-arc-num is-on">${to}%</em>${delta}</span>`;
}

/** 阶段跃迁：发展度满 100 触发升阶、新阶段从 1 重走（world-state.tickRumor）。
 *  照实写「96% → 1%」会被读成倒退/出错——改述为「满格 · 阶段达成 · 新阶段 N%」。 */
function arcStepGauge(to: number): string {
  return '<span class="ww-arc-gauge">'
    + '<div class="ww-thread-bar ww-arc-meter"><span class="ww-arc-meter-gain" style="left:0;width:100%"></span></div>'
    + '<b class="ww-arc-delta is-step">阶段达成</b>'
    + `<em class="ww-arc-num">新阶段 ${to}%</em></span>`;
}

/** 等级跃迁胶囊：仅在等级变化或新登场时出现——等级没动就不占位（分类已由行标签表明）。 */
function arcLevels(from: string | undefined, to: string | undefined): string {
  const lv = (l: string): string => escapeHtml(RUMOR_LEVEL_LABEL[l] || l || '');
  if (!to) return '';
  if (!from) return `<span class="ww-arc-levels"><em class="ww-arc-lv is-on">${lv(to)}</em></span>`;
  if (from === to) return '';
  return `<span class="ww-arc-levels"><em class="ww-arc-lv">${lv(from)}</em>`
    + `<span class="ww-arc-lvarr">→</span><em class="ww-arc-lv is-on">${lv(to)}</em></span>`;
}

/** 归并块内的一条维度行：两字标签芯片 + 维度正文。
 *  ※标签用「两字芯片的自然宽度」，不是 5.2em 定宽列 —— 定宽列是给最长的「暗中打算」（四字）
 *  预留的，短标签那一格就空出来了，正文因此被推右一整列（用户否掉的「界面失衡」的第二个来源）。 */
function arcDim(label: string, body: string, hidden = false, labClass = ''): string {
  return `<div class="ww-arc-dim${hidden ? ' is-hidden' : ''}">`
    + `<em class="ww-arc-dim-lab${labClass ? ' ' + labClass : ''}">${label}</em>`
    + `<div class="ww-arc-dim-body">${body}</div></div>`;
}

/** 前/后对照维度（动向 / 打算）：两个值各占一行、一律全文，不再截断 ——
 *  高度由「轮次折叠」兜住，不再牺牲内容（旧版「前值收一行 + 展开按钮」的机制整体删除）。
 *  ※「前 / 后」是挂进正文列左槽的单字形标记，不是一列：它占宽 0（见样式里的绝对定位），
 *  正文列因此只有一个起点。 */
function arcSwapDim(label: string, from: unknown, to: unknown): string {
  return arcDim(label,
    `<div class="ww-arc-side is-was"><em class="ww-arc-side-lab">前</em>`
    + `<span class="ww-arc-side-text">${escapeHtml(String(from ?? ''))}</span></div>`
    + `<div class="ww-arc-side is-after"><em class="ww-arc-side-lab">后</em>`
    + `<span class="ww-arc-side-text">${escapeHtml(String(to ?? ''))}</span></div>`);
}

/** 暗中打算维度：目标全文（hiddenGoal）+ 增量条。
 *  ※认知边界：这一行属「主角不知」，与幕后页签同口径 —— 标签带 ww-notknown 标记
 *  （视觉上由 warm 底色承载，见 .ww-arc-dim.is-hidden），别在排版重构里把它悄悄丢掉。 */
function arcThreadDim(t: { from?: number; to?: number; goal?: string }): string {
  const from = Number(t.from) || 0;
  const to = Number(t.to) || 0;
  return arcDim('暗线',
    '<div class="ww-arc-dim-row">'
    + (t.goal ? `<span class="ww-arc-goal">${escapeHtml(String(t.goal))}</span>` : '')
    + (from === to ? '' : arcGauge(from, to))
    + '</div>', true, 'ww-notknown');
}

/** 入镜维度：标题 + 钩子。钩子（hook）状态里本就有，以前没发出来，这行只剩个标题。 */
function arcArrivalDim(i: { title?: string; hook?: string }): string {
  return arcDim('入镜',
    (i.title ? `<span class="ww-arc-arrival-title">${escapeHtml(String(i.title))}</span>` : '')
    + (i.hook ? `<span class="ww-arc-hook">${escapeHtml(String(i.hook))}</span>` : ''));
}

/** 旧纪事只存了传闻 **id**（changed.rumors，既有形态），按当前册反查标题才能显示人话。 */
function rumorTopicsFromIds(ids: unknown, topicById: Map<string, string>): { topics: string[]; missing: number } {
  const list = Array.isArray(ids) ? ids : [];
  const topics: string[] = [];
  for (const id of list) {
    const t = topicById.get(String(id));
    if (t) topics.push(t);
  }
  return { topics, missing: list.length - topics.length };
}

/** 名单胶囊：旧纪事没有前后值可对，就不假装有——只列名字。 */
function arcChips(names: string[]): string {
  return `<div class="ww-arc-chips">${names.map(n => `<span class="ww-arc-chip">${escapeHtml(n)}</span>`).join('')}</div>`;
}

/** 归并：**一个角色一块**，块内按维度分行（动向 / 打算 / 暗线 / 入镜 四个维度全部收进同一块）。
 *  这是回廊唯一的内容单位 —— 以前四个来源各占一行，同一个角色被拆到两三处，
 *  读者得自己在几行之间拼「这个人这轮到底怎么了」。 */
interface ArcBlock { kind: string; html: string; }
interface ArcBlockSet { blocks: ArcBlock[]; tally: Record<string, number>; }

function arcBlocksFromEntry(c: any, topicById: Map<string, string>): ArcBlockSet {
  const blocks: ArcBlock[] = [];
  const tally: Record<string, number> = {};
  const bump = (k: string): void => { tally[k] = (tally[k] || 0) + 1; };
  const d = c?.deltas;
  if (d) {
    // 先把四个来源按角色名收进同一块（保持首次出现顺序），再渲染
    interface Bundle { name: string; move?: any; plans?: any; thread?: any; arrival?: any; }
    const order: string[] = [];
    const byName = new Map<string, Bundle>();
    const take = (n: string): Bundle => {
      let b = byName.get(n);
      if (!b) { b = { name: n }; byName.set(n, b); order.push(n); }
      return b;
    };
    for (const p of d.profiles || []) take(p.name).move = p;
    for (const p of d.plans || []) take(p.name).plans = p;
    for (const t of d.threads || []) take(t.name).thread = t;
    for (const i of d.intrusions || []) take(i.refId).arrival = i;
    for (const n of order) {
      const b = byName.get(n) as Bundle;
      const dims: string[] = [];
      if (b.move) dims.push(arcSwapDim('动向', b.move.from, b.move.to));
      if (b.plans) dims.push(arcSwapDim('打算', b.plans.from, b.plans.to));
      if (b.thread) dims.push(arcThreadDim(b.thread));
      if (b.arrival) dims.push(arcArrivalDim(b.arrival));
      // 只有入镜、没有角色维度（说书人/巡夜人这类）⇒ 单成入镜块，不计入「角色」数
      const isChar = !!(b.move || b.plans || b.thread);
      blocks.push({
        kind: isChar ? 'profile' : 'intrusion',
        html: `<div class="ww-arc-line" data-arc-kind="${isChar ? 'profile' : 'intrusion'}">`
          + `<div class="ww-arc-body"><div class="ww-arc-who">${escapeHtml(n)}</div>`
          + `${dims.join('')}</div></div>`,
      });
      // 统计口径仍是那五类「变化面」：归并后线程与入镜不再各占一行，但仍是这一轮的变化面。
      // 角色数按**块**计 —— 旧版只数动向行，只推进暗线的角色根本不计（实机偏差）。
      if (isChar) bump('profile');
      if (b.thread) bump('thread');
      if (b.arrival) bump('intrusion');
    }
    // 传闻不属于任何角色 ⇒ 单独成组，排在角色块之后（虚线分界把「传闻不属角色」画出来）
    for (const r of d.rumors || []) {
      const isNew = !r.fromLevel;
      const from = typeof r.fromProgress === 'number' ? r.fromProgress : null;
      const to = typeof r.toProgress === 'number' ? r.toProgress : null;
      const leveled = !!(r.fromLevel && r.toLevel && r.fromLevel !== r.toLevel);
      let gauge = '';
      // 本轮新增的传闻没有「之前」可对照：不画 0→N 的条（画了会被读成「从 0 长起来」）
      if (isNew) gauge = '';
      // 升阶且发展度回落 ⇒ 是新阶段重走，不是倒退（详见 arcStepGauge）
      else if (from !== null && to !== null && leveled && to < from) gauge = arcStepGauge(to);
      else if (from !== null && to !== null && from !== to) gauge = arcGauge(from, to);
      else if (from === null && to) gauge = arcGauge(0, to);
      const row = arcRow(isNew ? 'is-new' : 'is-rumor', isNew ? '新增' : '传闻',
        `<div class="ww-arc-top"><span class="ww-arc-key">${escapeHtml(r.topic)}</span>`
        + `${arcLevels(r.fromLevel, r.toLevel)}${gauge}</div>`);
      blocks.push(row);
      bump('rumor');
    }
  }
  // 传闻消散不依赖 deltas（changed.rumorsGone 存的就是 topic）——旧纪事也能显示
  const gone = c?.changed?.rumorsGone;
  if (Array.isArray(gone) && gone.length) {
    blocks.push(arcRow('is-gone', '消散', arcChips(gone.map((t: string) => String(t)))));
    bump('gone');
  }
  // 无 deltas 的旧轮次：用 changed 名单补同语汇的行。
  // 判据是「有无 deltas」而非「blocks 是否为空」——否则只有消散行的旧轮次会把同轮的名单吃掉
  if (!d) {
    const ch = c?.changed || {};
    if (Array.isArray(ch.profiles) && ch.profiles.length) {
      blocks.push(arcRow('is-move', '角色', arcChips(ch.profiles.map((n: string) => String(n)))));
      bump('profile');
    }
    const { topics, missing } = rumorTopicsFromIds(ch.rumors, topicById);
    if (topics.length) {
      blocks.push(arcRow('is-rumor', '传闻', arcChips(topics)));
      bump('rumor');
    } else if (missing > 0) {
      blocks.push(arcRow('is-rumor', '传闻', arcChips([`${missing} 条（均已不在册）`])));
      bump('rumor');
    }
  }
  return { blocks, tally };
}

/** 卡头构成统计：比「N 项变化」多给「哪几类在动」，圆点取对应行标签色。 */
function arcTallyHtml(tally: Record<string, number>): string {
  return ARC_TALLY_ORDER.filter(x => tally[x.kind])
    .map(x => `<span><i class="ww-arc-dotk is-${x.kind}"></i>${tally[x.kind]} ${x.label}</span>`)
    .join('');
}

function buildArcTabHtml(state: any): string {
  const entries: any[] = Array.isArray(state.chronicle) ? state.chronicle : [];
  // 旧纪事的 changed.rumors 存 id，按当前册反查标题（消散掉的查不到，另行标注）
  const topicById = new Map<string, string>();
  for (const r of (state.rumors || [])) if (r?.id) topicById.set(String(r.id), String(r.topic || ''));
  const items = entries.map((c: any, i: number) => {
    const latest = i === 0; // chronicle 用 unshift 写入，新轮在前
    const { blocks, tally } = arcBlocksFromEntry(c, topicById);
    const has = Object.keys(tally).length > 0;
    return `<div class="ww-arc-item${latest ? ' is-latest' : ''}"${i >= ARC_INIT_BATCH ? ' data-arc-far="1"' : ''}>
      <div class="ww-arc-dot"></div>
      <div class="ww-arc-card">
        <div class="ww-arc-card-head${has ? '' : ' is-noopen'}">
          ${chronicleDateHtml(c.dateKey, 'ww-arc-date')}
          <span class="ww-arc-kind${c.kind === 'big' ? ' is-big' : ''}">${c.kind === 'big' ? '大演化' : '小演化'}</span>
          ${has ? `<span class="ww-arc-tally">${arcTallyHtml(tally)}</span>` : '<span class="ww-arc-sum">无变化记录</span>'}
          ${latest ? '<em class="ww-arc-now">当前</em>' : ''}
          ${has ? '<em class="ww-arc-head-chev"></em>' : ''}
        </div>
        ${has ? `<div class="ww-arc-lines">${blocks.map(b => b.html).join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<section class="ww-tab-arc">
    <div class="ww-arc-head">
      <div class="ww-arc-title">演化回廊<em class="ww-arc-sub">仅展示 · 不注入</em><em class="ww-count">${entries.length}</em></div>
      <div class="ww-arc-tools">
        <button type="button" class="ww-arc-tool is-on" data-arc-filter="all">全部</button>
        <button type="button" class="ww-arc-tool" data-arc-filter="profile">只看角色</button>
        <button type="button" class="ww-arc-tool" data-arc-filter="rumor">只看传闻</button>
      </div>
    </div>
    <div class="ww-arc-list" data-arc-filter="all" data-arc-shown="${ARC_INIT_BATCH}">${items || '<div class="ww-empty">暂无演化记录</div>'}</div>
  </section>`;
}

/** ===== 回廊外壳：轮次折叠的开合 / 分批续载 / 摘要名录 =====
 *  全部只切属性与类名，不重排块内 DOM、不重算差分（差分是渲染期一次算好的）。
 *  正文的显隐由 CSS 承担（.ww-arc-item:not(.is-open) .ww-arc-lines{display:none}）。 */
/** 初始批：至少 3 轮，再由 arcShellMount 补到能滚动为止（只给 3 轮会死锁：内容比视口矮就永远滚不到底，
 *  第 4 轮往后永久取不出来）。 */
const ARC_INIT_BATCH = 3;
const ARC_BATCH_STEP = 3;

const ARC_FILTER_KINDS: Record<string, string[] | null> = {
  all: null,
  // 「除传闻外都算角色相关」：只留 rumor/gone 才是隐藏对象，入镜块（说书人这类无名册对象）要留下
  profile: ['profile', 'thread', 'intrusion'],
  rumor: ['rumor', 'gone'],
};

/** 名录按「累计字数」收口而不是按条数：条数上限碰上长传闻名会撑到三行，字数上限才能让折叠态恒为两行。 */
const ARC_ROSTER_BUDGET = 40;

function arcListOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector('.ww-arc-list') as HTMLElement | null;
}

function arcItemsOf(list: HTMLElement): HTMLElement[] {
  return Array.from(list.querySelectorAll('.ww-arc-item')) as HTMLElement[];
}

function arcShownCount(list: HTMLElement): number {
  const n = Number(list.dataset.arcShown);
  return Number.isFinite(n) && n > 0 ? n : ARC_INIT_BATCH;
}

/** 一行的「变化对象」：块头（角色名）／单行身份（.ww-arc-key）／旧纪事名单胶囊，按同一优先级取。
 *  从已渲染的 DOM 反读，不回头重算差分。 */
function arcSubjectOf(line: HTMLElement): { name: string; kind: string }[] {
  const key = line.querySelector('.ww-arc-key');
  const who = line.querySelector('.ww-arc-who');
  const text = key ? [key.textContent] : who ? [who.textContent]
    : Array.from(line.querySelectorAll('.ww-arc-chip')).map(c => c.textContent);
  const kind = line.dataset.arcKind || 'other';
  return text.map(n => ({ name: (n || '').trim(), kind })).filter(x => !!x.name);
}

function arcSubjectsOf(item: HTMLElement): { name: string; kind: string }[] {
  const out: { name: string; kind: string }[] = [];
  const seen = new Set<string>();
  for (const line of Array.from(item.querySelectorAll('.ww-arc-line')) as HTMLElement[]) {
    for (const s of arcSubjectOf(line)) {
      if (!seen.has(s.name)) { seen.add(s.name); out.push(s); }
    }
  }
  return out;
}

function arcSepEl(): HTMLElement {
  const sep = document.createElement('i');
  sep.className = 'ww-arc-sep';
  return sep;
}

/** 摘要名录重建：折叠态列「这一轮谁在动」，按当前滤镜口径现算。
 *  ※筛选时必须**重建**名录而不是把名录藏掉 —— 折叠态在滤镜下一个信息都不剩。 */
function arcBuildRoster(item: HTMLElement, filter: string): void {
  const head = item.querySelector('.ww-arc-card-head');
  if (!head) return;
  const old = head.querySelector('.ww-arc-roster');
  if (old) old.remove();
  const kinds = ARC_FILTER_KINDS[filter] || null;
  const subs = arcSubjectsOf(item).filter(s => !kinds || kinds.indexOf(s.kind) >= 0);
  if (!subs.length) return;
  const roster = document.createElement('div');
  roster.className = 'ww-arc-roster';
  const shown: string[] = [];
  let used = 0;
  for (const s of subs) {
    if (shown.length && used + s.name.length > ARC_ROSTER_BUDGET) break;
    shown.push(s.name);
    used += s.name.length;
  }
  shown.forEach((n, i) => {
    if (i) roster.appendChild(arcSepEl());
    const span = document.createElement('span');
    span.className = 'ww-arc-subj';
    span.textContent = n;
    roster.appendChild(span);
  });
  if (subs.length > shown.length) {
    roster.appendChild(arcSepEl());
    const more = document.createElement('span');
    more.className = 'ww-arc-subj is-more';
    more.textContent = `共 ${subs.length} 项`;
    roster.appendChild(more);
  }
  head.appendChild(roster);
}

function arcRenderFoot(list: HTMLElement, left: number, total: number): void {
  let foot = list.querySelector('.ww-arc-foot') as HTMLElement | null;
  if (!foot) {
    foot = document.createElement('div');
    foot.className = 'ww-arc-foot';
    list.appendChild(foot);
  }
  foot.textContent = '';
  if (left > 0) {
    const chev = document.createElement('em');
    chev.className = 'ww-arc-foot-chev';
    foot.appendChild(chev);
    foot.appendChild(document.createTextNode('下滑继续查看'));
    foot.appendChild(arcSepEl());
    foot.appendChild(document.createTextNode(`还有 ${left} 轮`));
  } else {
    foot.appendChild(document.createTextNode(`已显示全部 ${total} 轮演化`));
  }
  foot.classList.toggle('is-end', left <= 0);
  foot.classList.toggle('is-more', left > 0);
}

/** 分批：第 n 轮之后的卡标 data-arc-far（CSS 隐藏），页脚计数同步。 */
function arcApplyShown(root: HTMLElement, n: number): void {
  const list = arcListOf(root);
  if (!list) return;
  const items = arcItemsOf(list);
  const shown = Math.max(0, Math.min(n, items.length));
  list.dataset.arcShown = String(shown);
  items.forEach((it, i) => {
    if (i < shown) it.removeAttribute('data-arc-far');
    else it.setAttribute('data-arc-far', '1');
  });
  arcRenderFoot(list, items.length - shown, items.length);
}

function arcGrow(root: HTMLElement): boolean {
  const list = arcListOf(root);
  if (!list) return false;
  const shown = arcShownCount(list);
  if (shown >= arcItemsOf(list).length) return false;
  arcApplyShown(root, shown + ARC_BATCH_STEP);
  return true;
}

/** ※「初始批 N 轮」实现上必须是「至少 N 轮，再补到能滚动为止」：内容比视口矮就永远滚不到底，
 *  第 4 轮往后永久取不出来（死锁）。只在回廊页签可见时量 —— 其余页签的 scrollHeight 是别的页签的。 */
function arcFill(root: HTMLElement): void {
  const list = arcListOf(root);
  const pane = root.querySelector('.ww-pane') as HTMLElement | null;
  if (!list || !pane) return;
  if (!root.querySelector('.ww-tab-arc.is-active')) return;
  let guard = 0;
  while (arcShownCount(list) < arcItemsOf(list).length
    && pane.scrollHeight <= pane.clientHeight + 8 && guard++ < 20) {
    if (!arcGrow(root)) break;
  }
}

/** 回廊外壳挂载：分批初值 + 补到能滚动 + 摘要名录 + 页脚；并给空轮次卡头挂 is-noopen。
 *  重建页签后须再调一次（rebuildPanes 只换 pane 的 innerHTML，卡与名录都会重新生成）。
 *  导出供落地核对 harness 复用 —— 与 buildWorldWindowHtml 同一条理由：harness 不许手抄模板。 */
export function arcShellMount(root: HTMLElement): void {
  const list = arcListOf(root);
  if (!list) return;
  const filter = list.dataset.arcFilter || 'all';
  arcApplyShown(root, arcShownCount(list));
  arcItemsOf(list).forEach(it => {
    const head = it.querySelector('.ww-arc-card-head');
    if (!head) return;
    if (!it.querySelector('.ww-arc-lines')) head.classList.add('is-noopen');
    arcBuildRoster(it, filter);
  });
  arcFill(root);
}

/** 台前页签（B 结构，2026-08-21 拍板）：报头 + 入镜区（置顶）+ 传闻区 + 演化纪事；空模块整体隐藏。 */
function buildFrontTabHtml(state: any, style: StyleType): string {
  const { rumors, arrivals } = frontSectionsFromState(state);
  const arrivalsBlock = arrivals.length
    ? `<div class="ww-front-sec ww-front-arrivals"><div class="ww-front-sec-title">入镜<em>正在发生</em></div>
      ${arrivals.map(i => `<div class="ww-arrival-card"><div class="ww-arrival-who"><span class="ww-arrival-badge">入镜</span>${escapeHtml(i.refId)}${i.title ? ` · ${escapeHtml(i.title)}` : ''}</div>${i.hook ? `<div class="ww-arrival-hook">${escapeHtml(i.hook)}</div>` : ''}</div>`).join('')}
    </div>`
    : '';
  const rumorsBlock = rumors.length
    ? `<div class="ww-front-sec ww-front-rumors"><div class="ww-front-sec-title">传闻<em>市井之谈</em></div>
      ${rumors.map(r => `<div class="ww-front-rumor"><div class="ww-front-rumor-top"><span class="ww-front-rumor-level ww-front-rumor-${escapeHtml(r.level)}">${escapeHtml(RUMOR_LEVEL_LABEL[r.level] || r.level)}</span><b>${escapeHtml(r.topic)}</b>${r.createdAt ? `<em class="ww-front-rumor-time">自 ${escapeHtml(monthDayOfDateKey(r.createdAt) || '')}</em>` : ''}</div><div class="ww-front-rumor-body">${escapeHtml(r.content)}</div><div class="ww-front-rumor-status">${escapeHtml(deriveRumorStatusText(r.level, Number(r.progress) || 1, typeof r.dissipation === 'number' ? r.dissipation : undefined))}</div></div>`).join('')}
    </div>`
    : '';
  return `<section class="ww-tab-front is-active">
    <div class="ww-front-head">
      <div class="ww-front-title">${escapeHtml(masthead(style))}</div>
      <div class="ww-front-date">${escapeHtml(state.lastEvolveDateKey)}</div>
    </div>
    <div class="ww-front-body">
      ${arrivalsBlock}
      ${rumorsBlock}
      <div class="ww-front-sec"><div class="ww-front-sec-title">演化纪事<em>仅展示</em></div>${buildChronicleHtml(state)}</div>
    </div>
  </section>`;
}

function buildBackTabHtml(state: any, today = ''): string {
  // WS6：角色密档 >4 默认折叠（chevron + 计数 + 展开全部总开关）
  const profileList = Object.values(state.profiles || {});
  const profileCount = profileList.length;
  const defaultCollapsed = profileCount > 4;
  const profilesBlock = profileList.map(p => profileCardHtml(p, today)).join('');
  // 传闻密档：全部传闻（含 vague 幕后流言）——主角不知的信息也在此可见；展示发展度/消散度，发展过程一目了然；可手动删除过时传闻
  const rumors = (state.rumors || []).map((r: any) => {
    const prog = Math.max(1, Math.min(100, Number(r.progress) || 1));
    const diss = typeof r.dissipation === 'number' ? Math.max(0, Math.min(100, r.dissipation)) : null;
    return `<div class="ww-rumor-card">
    <div class="ww-rumor-name"><span class="ww-rumor-level ww-rumor-${escapeHtml(r.level)}">${escapeHtml(RUMOR_LEVEL_LABEL[r.level] || r.level)}</span><b>${escapeHtml(r.topic)}</b>${r.createdAt ? `<em class="ww-time-badge">自 ${escapeHtml(monthDayOfDateKey(r.createdAt) || '')}</em>` : ''}<button type="button" class="ww-rumor-del" data-id="${escapeHtml(r.id)}" title="删除此传闻">${ubIcon('close')}</button></div>
    <div class="ww-rumor-desc">${escapeHtml(r.content)}</div>
    <div class="ww-rumor-meter"><span class="ww-rumor-meter-label">发展</span><div class="ww-thread-bar"><span style="width:${prog}%"></span></div><em class="ww-rumor-meter-num">${prog}%</em></div>
    ${diss !== null ? `<div class="ww-rumor-meter"><span class="ww-rumor-meter-label">消散</span><div class="ww-thread-bar"><span style="width:${diss}%"></span></div><em class="ww-rumor-meter-num">${diss}%</em></div>` : ''}
  </div>`;
  }).join('');
  // F31①：已停用演化——「删除动向」写入的停用名单（evolveExcluded）在此可逐条恢复。
  // 名单为空时整块不渲染（没东西可恢复就不占版面）；恢复入口在删除确认弹窗里已写明。
  const excluded: string[] = Array.isArray(state.evolveExcluded)
    ? state.evolveExcluded.filter((n: any) => typeof n === 'string' && n)
    : [];
  const excludedBlock = excluded.length
    ? `<div class="ww-back-block-title">已停用演化 <em class="ww-count">${excluded.length}</em></div>
    <div class="ww-excluded">${excluded.map((name: string) => `<div class="ww-excluded-row"><b class="ww-excluded-name">${escapeHtml(name)}</b><em class="ww-excluded-note">不再生成动向/打算/入镜</em><button type="button" class="ww-excluded-restore" data-name="${escapeHtml(name)}">恢复演化</button></div>`).join('')}<div class="ww-excluded-hint">恢复后下一轮演化会重新生成该角色的动向；历史纪事与回廊不回溯。</div></div>`
    : '';
  return `<section class="ww-tab-back">
    <div class="ww-back-head">幕后 · 暗室 <em class="ww-notknown">主角不知</em>
      <span class="ww-fold-all" data-fold="profiles">${defaultCollapsed ? '展开全部' : '折叠全部'}</span>
    </div>
    <div class="ww-back-block-title ww-profiles-toggle" data-toggle="profiles">角色密档
      <span class="ww-toggle-caret">${defaultCollapsed ? '▸' : '▾'}</span> <em class="ww-count">${profileCount}</em>
    </div>
    <div class="ww-profiles${defaultCollapsed ? ' collapsed' : ''}">${profilesBlock || '<div class="ww-empty">暂无追踪角色</div>'}</div>
    <div class="ww-back-block-title">传闻密档 <em class="ww-count">${(state.rumors || []).length}</em></div><div class="ww-rumors">${rumors || '<div class="ww-empty">暂无传闻</div>'}</div>
    ${excludedBlock}
  </section>`;
}

function buildIntrusionQueueHtml(state: any): string {
  // 两态队列：pending（触发/删除）+ acted（已触发·剩N轮/删除）都展示；计数只算 pending
  const all = state.pendingIntrusions || [];
  const items = all.map((i: any) => {
    const acted = i.status === 'acted';
    const badge = acted
      ? `<em class="ww-triggered">已触发·剩 ${Number(i.ttl) || 0} 轮</em>`
      : '<em class="ww-onstage">待处理</em>';
    return `<div class="ww-intrusion" data-intrusion-id="${escapeHtml(i.id)}" data-hook="${escapeHtml(i.hook || '')}">
    <div class="ww-intrusion-title">${escapeHtml(i.title)}${badge}</div>
    ${i.hook ? `<div class="ww-intrusion-hook">${escapeHtml(i.hook)}</div>` : ''}
    ${i.desc ? `<div class="ww-intrusion-desc">${escapeHtml(i.desc)}</div>` : ''}
    ${i.hook && !acted ? `<button type="button" class="ww-intrusion-fill" data-id="${escapeHtml(i.id)}">触发</button>` : ''}
    <button type="button" class="ww-intrusion-delete" data-id="${escapeHtml(i.id)}">删除</button>
  </div>`;
  }).join('');
  return `<section class="ww-tab-intrusion">
    <div class="ww-back-head">入镜队列 <em class="ww-count">${pendingIntrusions(state).length}</em></div>
    ${items || '<div class="ww-empty">暂无待处理入镜</div>'}
  </section>`;
}

/** 纯函数：生成窗口 HTML（可测）。today=当前日期（YYYY-MM-DD），用于相对时间徽标；缺省不显示。
 *  undoable=false 时撤回按钮置灰（无可撤回的快照）。 */
export function buildWorldWindowHtml(style: StyleType, state: any, today = '', undoable = true): string {
  // 台前展廊 ↔ 幕后暗室：ww-theme 分主题，bridge 走舰桥模块壳
  const bridgeClass = style === 'bridge' ? ' bridge-window bridge-module-world' : '';
  return `<div class="${WORLD_WINDOW_CLASS} ww-theme-${style}${bridgeClass}">
    <div class="ww-header"><button type="button" class="ww-manual-evolve">手动演化</button><button type="button" class="ww-undo-evolve"${undoable ? '' : ' disabled'}>${undoable ? '撤回演化' : '无可撤回'}</button><span class="ww-close-btn" id="panelClose">&times;</span></div>
    <div class="ww-tabs">
      <button type="button" class="ww-tab-btn is-active" data-tab="front">台前</button>
      <button type="button" class="ww-tab-btn" data-tab="arc">回廊<em class="ww-count">${(state.chronicle || []).length}</em></button>
      <button type="button" class="ww-tab-btn" data-tab="back">幕后</button>
      <button type="button" class="ww-tab-btn" data-tab="intrusion">入镜<em class="ww-count">${pendingIntrusions(state).length}</em></button>
    </div>
    <div class="ww-pane">
      ${buildFrontTabHtml(state, style)}
      ${buildArcTabHtml(state)}
      ${buildBackTabHtml(state, today)}
      ${buildIntrusionQueueHtml(state)}
    </div>
  </div>`;
}

/** v1.1：窗口样式幂等注入（报纸样式 + ww-* 样式）。 */
function ensureWorldWindowCss(): void {
  try {
    document.getElementById('statusbar-newspaper-style')?.remove();
    ensureStyleOnce('statusbar-world-window-style', worldWindowBaseCSS); // U35：收编幂等注入（旧日报样式退役保留在上）
  } catch (_e) { /* ignore */ }
}

function syncDarkClass(overlay: HTMLElement): void {
  try {
    if (getConfig().style === 'minimal') sharedSyncDarkClassMinimal(overlay);
    else sharedSyncDarkClass(overlay);
  } catch (_e) { /* ignore */ }
}

/** 页签激活态切换（tab 切换与手动演化后刷新共用）。 */
function activateTab(overlay: HTMLElement, tab: string | undefined): void {
  overlay.querySelectorAll('.ww-tab-btn').forEach(b => b.classList.toggle('is-active', (b as HTMLElement).dataset.tab === tab));
  overlay.querySelectorAll('.ww-tab-front, .ww-tab-back, .ww-tab-intrusion, .ww-tab-arc')
    .forEach(s => s.classList.toggle('is-active', (s as HTMLElement).classList.contains(`ww-tab-${tab}`)));
  // 回廊分批要看视口高矮（补到能滚动），换到回廊页签时才量得准
  arcFill(overlay);
}

/** F31②③：跨弹窗跳转走 index.ts 的全局桥（与剧情回顾→角色中枢/地图、镜头之外→角色中枢同款口径）：
 *  本模块不直接 import 重弹窗模块（少一层加载依赖），桥不在（宿主未注入）=静默不响应，不抛错。 */
function openChronicleReaderAt(dateKey: string, onClosed?: () => void): void {
  try { (window as any).__ub_showChronicleReader?.(dateKey, onClosed); } catch (_e) { /* ignore */ }
}

function openCharacterHub(name: string): void {
  try { (window as any).__ub_showCharacterHub?.(name); } catch (_e) { /* ignore */ }
}

export function showWorldWindow(style: StyleType, onClose?: () => void, initialTab: 'front' | 'back' | 'intrusion' | 'arc' = 'front'): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  ensureWorldWindowCss(); // v1.1
  const todayNow = getTodayDateKey() || ''; // 归一化 string（buildWorldWindowHtml today 参数类型）
  const state = loadWorldState(); // 流言生命周期/消散在演化时维护，打开窗口不额外剔除
  let liveState = state; // v1.1：触发/删除后维护最新状态（触发=acted+TTL 等演化消散；删除=直接移除并重建台前）
  overlay.innerHTML = buildWorldWindowHtml(style, state, todayNow, isWorldEvolveUndoAvailable());
  activateTab(overlay, initialTab); // v1.2：镜头之外点卡联动可指定打开页签
  syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');
  // 回廊滚动续载：绑在 .ww-pane 上，且**只绑一次** —— rebuildPanes 只换 pane 的 innerHTML，
  // pane 元素本身不变，所以重绑会叠加监听。处理器每次现取当前列表，中途重建也安全。
  const paneEl = overlay.querySelector('.ww-pane') as HTMLElement | null;
  paneEl?.addEventListener('scroll', () => {
    const list = arcListOf(overlay);
    // 筛选态不分批：不匹配的整卡已 hidden，本身就不长
    if (!list || (list.dataset.arcFilter || 'all') !== 'all') return;
    // 滚到距底 64px 内才续一批（否则第一下轻微滚动就会把 10 轮全放出来）
    if (paneEl.scrollTop + paneEl.clientHeight >= paneEl.scrollHeight - 64) {
      if (arcGrow(overlay)) arcFill(overlay);
    }
  }, { passive: true });
  arcShellMount(overlay);

  getTodayWeather().then((weather: any) => {
    const metaEl = overlay.querySelector('.ww-front-date');
    if (metaEl && weather?.description) {
      const span = document.createElement('span');
      span.textContent = weather.description;
      metaEl.appendChild(span);
    }
  }).catch(() => { /* ignore */ });

  // 异步回调（手动演化/撤回/触放入镜/删入镜/删传闻）完成后重建四页签。
  // 守卫：弹窗可能已在异步期间关闭（innerHTML 清空、.show 移除），此时 .ww-pane 为 null，
  // 非空断言会抛 TypeError；改为判空 + 检查 .show 后再重建。
  const rebuildPanes = (st: ReturnType<typeof loadWorldState>): void => {
    if (!overlay.classList.contains('show')) return;
    const pane = overlay.querySelector('.ww-pane');
    if (!pane) return;
    const active = overlay.querySelector('.ww-tab-btn.is-active');
    const tab = active ? (active as HTMLElement).dataset.tab : 'front';
    pane.innerHTML = buildFrontTabHtml(st, style) + buildArcTabHtml(st) + buildBackTabHtml(st, todayNow) + buildIntrusionQueueHtml(st);
    // 回廊计数随演化轮次变化，页签徽标须同步
    const arcCount = overlay.querySelector('.ww-tab-btn[data-tab="arc"] .ww-count');
    if (arcCount) arcCount.textContent = String((st.chronicle || []).length);
    const inCount = overlay.querySelector('.ww-tab-btn[data-tab="intrusion"] .ww-count');
    if (inCount) inCount.textContent = String(pendingIntrusions(st).length);
    activateTab(overlay, tab);
    arcShellMount(overlay); // 回廊外壳随重建一起复位（分批计数回落初始批，名录/页脚重新生成）
  };

  // 撤回按钮态刷新：演化成功建立快照后变可点，撤回（或快照跨聊天失效）后变灰「无可撤回」
  const syncUndoBtn = (): void => {
    const b = overlay.querySelector('.ww-undo-evolve') as HTMLButtonElement | null;
    if (!b || b.dataset.busy) return;
    const undoable = isWorldEvolveUndoAvailable();
    b.disabled = !undoable;
    b.textContent = undoable ? '撤回演化' : '无可撤回';
  };

  overlay.onclick = function (e) {
    const target = e.target as HTMLElement;
    if (e.target === overlay) {
      // F70：裸关闭改统一关闭口——归还返回键守卫 + 滚动记忆 + 延迟清空（F38）。
      // onClose 分支（日历借壳）不走此口：overlay 不关、日历回填，守卫归日历继续持有。
      if (!guardGhostClick()) { if (onClose) { onClose(); return; } closePanelOverlay(overlay); }
      return;
    }
    if (target.id === 'panelClose' || target.closest('#panelClose')) {
      if (onClose) { onClose(); return; }
      closePanelOverlay(overlay); // F70：同上
      return;
    }
    // F31②：纪事/回廊日期 → 当日剧情回顾。必须排在 .ww-arc-card-head 之前——回廊日期就在卡头里，
    // 否则点日期会被卡头开合吞掉。关窗后按当前页签原样回来（角色中枢同款「子窗往返」口径）。
    if (target.closest('[data-date-jump]')) {
      const dateKey = (target.closest('[data-date-jump]') as HTMLElement).dataset.dateJump || '';
      if (!dateKey) return;
      const activeTab = (overlay.querySelector('.ww-tab-btn.is-active') as HTMLElement | null)?.dataset.tab;
      const restoreTab = (activeTab === 'front' || activeTab === 'back' || activeTab === 'intrusion' || activeTab === 'arc') ? activeTab : 'front';
      openChronicleReaderAt(dateKey, () => showWorldWindow(style, onClose, restoreTab));
      return;
    }
    // F31③：幕后姓名 → 角色中枢（镜头之外同款手法：按钮 + data 属性 + 委托）。姓名钮与「删除动向」
    // 是兄弟节点，但仍先判姓名钮：卡内其它可点元素将来若包住姓名，判定顺序不会反。
    if (target.closest('[data-beyond-char-name]')) {
      const name = (target.closest('[data-beyond-char-name]') as HTMLElement).dataset.beyondCharName || '';
      if (name) openCharacterHub(name);
      return;
    }
    if (target.closest('.ww-arc-card-head')) {
      // 轮次卡头开合：点卡头任意处开合，正文由 CSS 显隐 —— 只切类名，不重排 DOM、不重算差分。
      const head = target.closest('.ww-arc-card-head') as HTMLElement;
      if (head.classList.contains('is-noopen')) return; // 本轮无变化记录：没什么可开
      const item = head.closest('.ww-arc-item');
      if (item) item.classList.toggle('is-open');
      return;
    }
    if (target.closest('.ww-arc-foot')) {
      // 页脚续载：不足一屏时够不着底（滚不到底就取不出后面的轮次），这里是点击兜底
      const foot = target.closest('.ww-arc-foot') as HTMLElement;
      if (foot.classList.contains('is-more') && arcGrow(overlay)) arcFill(overlay);
      return;
    }
    if (target.closest('.ww-arc-tool')) {
      // 回廊过滤器：行显隐由 CSS 按 data-arc-filter 决定；整卡显隐在此显式判断
      // （不用 :has()——Chrome 105+ 才有，用户引擎≈Chromium 79-87 不支持）
      const tool = target.closest('.ww-arc-tool') as HTMLElement;
      const arcTab = overlay.querySelector('.ww-tab-arc');
      const list = arcTab?.querySelector('.ww-arc-list') as HTMLElement | null;
      if (!arcTab || !list) return;
      const filter = tool.dataset.arcFilter || 'all';
      arcTab.querySelectorAll('.ww-arc-tool').forEach(t =>
        t.classList.toggle('is-on', (t as HTMLElement).dataset.arcFilter === filter));
      list.setAttribute('data-arc-filter', filter);
      const kinds = ARC_FILTER_KINDS[filter] || null;
      arcTab.querySelectorAll('.ww-arc-item').forEach(item => {
        const el = item as HTMLElement;
        if (!kinds) { el.removeAttribute('hidden'); } else {
          const hit = Array.from(el.querySelectorAll('.ww-arc-line'))
            .some(l => kinds.includes((l as HTMLElement).dataset.arcKind || ''));
          if (hit) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
        }
        // 名录必须跟着滤镜**重建**：只把名录藏掉的话，折叠态在这一档下就一个信息都不剩
        arcBuildRoster(el, filter);
      });
      // 分批口径：筛选态放开全部分批（不匹配的整卡已 hidden，本身就不长），回「全部」再补到能滚动
      arcApplyShown(overlay, kinds ? arcItemsOf(list).length : arcShownCount(list));
      if (!kinds) arcFill(overlay);
      return;
    }
    if (target.closest('.ww-manual-evolve')) {
      // WS5：手动演化——busy 防重入（_generating 也防与自动演化并行），完成后重载三页签保持当前 tab
      const btn = target.closest('.ww-manual-evolve') as HTMLElement;
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      btn.classList.add('is-busy');
      btn.textContent = '演化中…';
      void manualEvolve().finally(() => {
        delete btn.dataset.busy;
        btn.classList.remove('is-busy');
        btn.textContent = '手动演化';
        syncUndoBtn();
        const fresh = loadWorldState();
        liveState = fresh;
        rebuildPanes(fresh);
      });
      return;
    }
    if (target.closest('.ww-undo-evolve')) {
      // 撤回上一轮演化——覆盖性操作先确认；busy 防重入同手动演化；守卫/清弹窗/重投影在 undoLastEvolve 内，完成后重载三页签保持当前 tab
      const btn = target.closest('.ww-undo-evolve') as HTMLButtonElement;
      if (btn.disabled || btn.dataset.busy) return;
      void showConfirmDialog({
        message: '撤回将把世界状态、纪事、入镜与传闻整体回滚到上一轮演化前，且不可恢复。确认撤回？',
        okText: '撤回',
        danger: true,
      }).then((confirmed) => {
        if (!confirmed) return;
        btn.dataset.busy = '1';
        btn.classList.add('is-busy');
        btn.textContent = '撤回中…';
        void undoLastEvolve().finally(() => {
          delete btn.dataset.busy;
          btn.classList.remove('is-busy');
          syncUndoBtn();
          const fresh = loadWorldState();
          liveState = fresh;
          rebuildPanes(fresh);
        });
      });
      return;
    }
    if (target.closest('.ww-profiles-toggle') || target.closest('.ww-fold-all')) {
      // WS6：角色密档折叠——块头/总开关共用同一切换逻辑，caret 与总开关文案互相同步
      const scope = overlay.querySelector('.ww-profiles') as HTMLElement;
      if (!scope) return;
      const willCollapse = !scope.classList.contains('collapsed');
      scope.classList.toggle('collapsed', willCollapse);
      const caret = overlay.querySelector('.ww-profiles-toggle .ww-toggle-caret');
      if (caret) caret.textContent = willCollapse ? '▸' : '▾';
      const foldAll = overlay.querySelector('.ww-fold-all');
      if (foldAll) foldAll.textContent = willCollapse ? '展开全部' : '折叠全部';
      return;
    }
    if (target.closest('.ww-tab-btn')) {
      const tab = (target.closest('.ww-tab-btn') as HTMLElement).dataset.tab;
      activateTab(overlay, tab);
      return;
    }
    if (target.closest('.ww-intrusion-fill')) {
      // 触发：放入输入框 + 标 acted+TTL + 落盘 → 通知两轮消散 → 重渲染保持当前 tab
      const row = target.closest('.ww-intrusion') as HTMLElement;
      const id = row.dataset.intrusionId || '';
      const it = liveState.pendingIntrusions.find((i: any) => i.id === id);
      if (it && it.status === 'pending' && fillIntrusionHook(it)) {
        const next = triggerIntrusion(liveState, id);
        liveState = next;
        void saveWorldState(next).then(() => {
          getToastr()?.success(`已触发：${it.title}，两轮演化后消散`, '世界动态');
          rebuildPanes(next);
        });
      }
      return;
    }
    if (target.closest('.ww-intrusion-delete')) {
      // 删除：直接移除 + 重建台前摘要（入镜行随删消失）→ 落盘 → 重投影两通道 → 重渲染
      const id = (target.closest('.ww-intrusion-delete') as HTMLElement).dataset.id || '';
      const fresh = loadWorldState();
      if (fresh.pendingIntrusions.some((i: any) => i.id === id)) {
        const next = removeIntrusion(fresh, id);
        next.frontDigest = buildFrontDigest(next, todayNow);
        liveState = next;
        void saveWorldState(next).then(async () => {
          await projectWorldDigest(next.frontDigest);
          await projectCharacterDynamics();
          rebuildPanes(next);
        });
      }
      return;
    }
    if (target.closest('.ww-rumor-del')) {
      // 手动删除过时传闻：过滤 + 重建台前摘要（heard/known 在台前）→ 落盘 → 重渲染当前 tab
      const id = (target.closest('.ww-rumor-del') as HTMLElement).dataset.id || '';
      void showConfirmDialog({ message: '确认删除这条传闻？删除后不可恢复。', okText: '删除', danger: true }).then((confirmed) => {
        if (!confirmed) return;
        const fresh = loadWorldState();
        const kept = fresh.rumors.filter((r: any) => r.id !== id);
        if (kept.length !== fresh.rumors.length) {
          const next = { ...fresh, rumors: kept };
          next.frontDigest = buildFrontDigest(next, todayNow);
          liveState = next;
          void saveWorldState(next).then(() => {
            rebuildPanes(next);
          });
        }
      });
      return;
    }
    if (target.closest('.ww-vault-del')) {
      // 删除角色动向并停用演化：确认（写明可恢复的入口）→ 删侧写 + 记入停用名单 → 落盘 → 角色动态条目重投影 → 重渲染
      const name = (target.closest('.ww-vault-del') as HTMLElement).dataset.name || '';
      void showConfirmDialog({
        message: `是否删除「${name}」的角色动向并停用该角色的演化？停用后该角色不再生成动向与入镜；随时可在幕后「已停用演化」中恢复。`,
        okText: '删除并停用',
        danger: true,
      }).then((confirmed) => {
        if (!confirmed) return;
        const fresh = loadWorldState();
        if (!fresh.profiles[name]) return;
        const next: WorldState = { ...fresh, profiles: { ...fresh.profiles } };
        delete next.profiles[name];
        next.evolveExcluded = [...new Set([...(fresh.evolveExcluded || []), name])];
        liveState = next;
        void saveWorldState(next).then(async () => {
          await projectCharacterDynamics(); // 清该角色「角色动态」绿灯条目
          rebuildPanes(next);
        });
      });
      return;
    }
    if (target.closest('.ww-excluded-restore')) {
      // F31①：恢复演化——从停用名单移除 + 落盘 + 角色动态重投影（幂等）→ 重建四页签。
      // 侧写不在本步重建：下一轮演化时 syncWorldRoster 自然重新收录（与「删除」互为逆操作）。
      const name = (target.closest('.ww-excluded-restore') as HTMLElement).dataset.name || '';
      if (!name) return;
      const fresh = loadWorldState();
      const list = Array.isArray(fresh.evolveExcluded) ? fresh.evolveExcluded : [];
      const kept = list.filter((n: string) => n !== name);
      if (kept.length === list.length) return; // 已不在名单（重复点击/已恢复）：无事可做
      const next: WorldState = { ...fresh, evolveExcluded: kept };
      liveState = next;
      void saveWorldState(next).then(async () => {
        await projectCharacterDynamics();
        getToastr()?.success(`已恢复「${name}」的演化：下一轮演化将重新生成动向`, '世界动态');
        rebuildPanes(next);
      });
      return;
    }
    if (target.closest('.world-window')) return;
  };
}
