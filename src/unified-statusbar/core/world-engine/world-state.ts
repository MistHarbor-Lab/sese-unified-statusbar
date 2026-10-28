// core/world-engine/world-state.ts
// 世界状态机：双轨合并判定、聚焦子集选择、认知边界门控、流言生命周期与阈值判定（全部纯函数，可单测）。
import { THREAD_FOCUS_MAX, type Rumor, type EvolveKind, type EvolveConfig, type WorldState, type CharProfile } from './world-types';
import { plainClone } from '../deep-clone';
import { compareDateKey, parseDateKey, makeDate, monthDayOfDateKey } from '../calendar-core';
import { escapeHtml } from '../html-escape';

/** 双轨合并：日期推进 → 大演化（吸收轮数触发）；否则轮数到期 → 小演化。 */
export function decideEvolve(
  lastRound: number,
  lastDateKey: string,
  round: number,
  dateKey: string,
  cfg: EvolveConfig,
): EvolveKind | null {
  const dateAdvanced = Boolean(lastDateKey) && Boolean(dateKey) && compareDateKey(dateKey, lastDateKey) > 0; // v1.1：首演/回拨不算日期推进；v1.2：负年份用数值比较
  if (dateAdvanced) return 'big';
  const roundDue = round - lastRound >= cfg.evolveEveryTurns;
  if (roundDue) return 'small';
  return null;
}

export interface FocusSelection {
  profiles: CharProfile[];
  remainderCount: number;
}

export interface FocusCfg {
  focusMax: number;
  rotationBatch: number;
}

/** 焦点子集 = 线程角色(收尾锁死+非收尾随机) + 离场随机 2 人 + 轮转批次补满，排除在场，封顶 focusMax。
 *  rng=随机源注入（缺省 Math.random），测试传种子序列可复现。v2：删 recentNames——「近期提及」
 *  层已废（提及名单只供 buildKnownSet），离场随机抽样保证人人有入口。 */
export function selectFocusSubset(
  state: WorldState,
  onStageNames: string[],
  cfg: FocusCfg,
  rng: () => number = Math.random,
): FocusSelection {
  const onStage = new Set(onStageNames);
  const off: CharProfile[] = Object.values(state.profiles).filter(p => !p.onStage && !onStage.has(p.name));
  const picked: CharProfile[] = [];
  const seen = new Set<string>();
  const push = (p: CharProfile) => {
    if (!p || seen.has(p.name) || picked.length >= cfg.focusMax) return;
    seen.add(p.name);
    picked.push(p);
  };
  /** 不放回随机抽 n 个（pool 已剔除选中者；n 超过池大小取全部）。 */
  const pickRandom = (cands: CharProfile[], n: number) => {
    const pool = cands.filter(c => !seen.has(c.name));
    for (let k = 0; k < n && pool.length > 0; k++) {
      const idx = Math.floor(rng() * pool.length);
      push(pool[idx]);
      pool.splice(idx, 1);
    }
  };

  // ★层1 线程（≤THREAD_FOCUS_MAX）：收尾（≥70）确定性锁死（收尾内最接近完成优先，多出的收尾下轮必进）；
  // 剩余席位从非收尾线程候选【完全随机】抽——不再按 lastEvolveRound 轮换（AI 只写 <thread> 不写
  // <profiles> 时该字段不更新，确定性排序会让同一批人反复占席）
  const threadCands = off.filter(p => p.hiddenGoal && (Number(p.goalProgress) || 0) < 100);
  const tail = threadCands
    .filter(p => (Number(p.goalProgress) || 0) >= 70)
    .sort((a, b) => (Number(b.goalProgress) || 0) - (Number(a.goalProgress) || 0));
  let threadPushed = 0;
  for (const p of tail) {
    if (threadPushed >= THREAD_FOCUS_MAX || picked.length >= cfg.focusMax) break;
    push(p);
    threadPushed += 1;
  }
  pickRandom(threadCands, THREAD_FOCUS_MAX - threadPushed);

  // 层2 离场随机 2 人：与是否被提及无关（保证每轮至少 2 人轮换）
  pickRandom(off, 2);

  // 层3 轮转批次补满（距上次演化最久优先）
  const rest = off.filter(p => !seen.has(p.name)).sort((a, b) => a.lastEvolveRound - b.lastEvolveRound);
  for (const p of rest.slice(0, cfg.rotationBatch)) push(p);

  return { profiles: picked, remainderCount: off.length - picked.length };
}

// v1.1：roster 种子（P3）
export interface RosterCandidate {
  name: string;
  relation?: string;
}

/** 从追踪表候选建立/刷新角色侧写；出场判定以 onStageNames（在场角色表）为准，纯函数。 */
export function syncWorldRoster(
  state: WorldState,
  candidates: RosterCandidate[],
  onStageNames: string[],
  _round: number,
): WorldState {
  const next: WorldState = plainClone(state);
  const onStage = new Set(onStageNames);
  const candidateNames = new Set<string>();
  const excluded = new Set(next.evolveExcluded || []); // 演化停用名单：不建侧写；不进候选集→残留侧写走下方清理删除
  for (const c of candidates) {
    const name = String(c.name || '').trim();
    if (!name) continue;
    if (excluded.has(name)) continue;
    candidateNames.add(name);
    const existing = next.profiles[name];
    const base: CharProfile = existing || {
      name,
      onStage: false,
      activity: '',
      plans: '',
      updatedAt: '',
      lastEvolveRound: 0,
    };
    next.profiles[name] = {
      ...base,
      onStage: onStage.has(name),
      relation: c.relation ? String(c.relation).trim() : (base.relation || ''),
    };
  }
  // 移除已不在追踪表（重要角色表/恋爱对象表）的侧写：角色从表里删除后清掉其演化内容，
  // 否则动向/打算/暗中打算会残留并继续投影成「角色动态-<名>」世界书条目。
  for (const name of Object.keys(next.profiles)) {
    if (!candidateNames.has(name)) delete next.profiles[name];
  }
  return next;
}

/** 传闻等级中文标签（幕后密档/结果弹窗展示用；vague 未传开、heard 已传开、known 人尽皆知）。 */
export const RUMOR_LEVEL_LABEL: Record<string, string> = { vague: '流言', heard: '传闻', known: '实锤' };

/** 认知边界总闸：frontDigest 只含主角可知集合（known/heard 传闻 + AI 通道入镜事件）。
 *  在场角色的动向不进台前：主角在场直接可见，主线剧情承载，不以「入镜」标签混入台前
 *  （「入镜」是入镜事件（Intrusion）的专有语义：三字段+队列+弹窗，见 world-intrusion）。 */
export function buildFrontDigest(state: WorldState, dateKey: string): string {
  const lines: string[] = [];
  for (const r of state.rumors) {
    if (r.level === 'vague') continue;
    lines.push(`【传闻·${r.topic}】${r.content}`);
  }
// v1.1（P4）+WS10：AI 通道入镜 = aiTriggered character_arrival 以「【X 入镜】标题　钩子」进台前（窗口展示用）。
// 状态不影响台前（pending/acted 都在台前）；暂缓（defer）与触发（acted）不撤销台前——删除/到期才随台前重建消失。
for (const it of state.pendingIntrusions) {
  if (it.kind === 'character_arrival' && it.aiTriggered && (it.title || it.hook)) {
    const titlePart = it.title ? `${it.title}　` : '';
    lines.push(`【${it.refId} 入镜】${titlePart}${it.hook || ''}`);
  }
}
  if (lines.length === 0) return '';
  return `【世界动态 ${dateKey}】\n` + lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// 流言「传播线」化：发展度 progress（每阶段 1→100 满 100 晋级）+ 消散度 dissipation（台前衰减、进台前重置 100、归 0 删除）
// 取代旧 ageRounds 节拍 / expiresAt 到期。主题固定，内容由 AI 渐进重写。纯函数可单测。
// ═══════════════════════════════════════════════════════════════

/** 流言等级阶梯：阶段1(幕后 vague) → 阶段2(台前 heard) → 阶段3(台前 known)。 */
export const RUMOR_LEVELS: Rumor['level'][] = ['vague', 'heard', 'known'];

/** 下一阶段等级；已到顶(known) 返回 null。 */
export function nextRumorLevel(level: Rumor['level']): Rumor['level'] | null {
  const i = RUMOR_LEVELS.indexOf(level);
  if (i < 0 || i >= RUMOR_LEVELS.length - 1) return null;
  return RUMOR_LEVELS[i + 1];
}

/** 台前流言引擎兜底消散（AI 漏给/未处理时每轮减）；AI 显式 dissipationDelta 则覆盖。防「永远不散」。 */
export const RUMOR_DEFAULT_DECAY = 3;

/** 同源判定最低共享非虚词 bigram 数（过高漏判、过低误并；测试锁定：市井流言 vs 神都花魁大赏 共享≥6、仅共享朱雀大街等背景词 <6）。 */
export const RUMOR_SAME_SOURCE_MIN_OVERLAP = 6;

export interface RumorTickResult {
  /** 非删除时的新流言对象（spread 原对象，不 mutate）；deleted=true 时为 null。 */
  rumor: Rumor | null;
  deleted: boolean;
  leveledUp: boolean;
}

/** 流言单轮生命周期 tick（纯函数）：
 * - progress += progressDelta（clamp 1-100；满 100 → 晋级下一阶段并重置为 1；vague→heard 那一刻 dissipation 重置 100）
 * - known 已到顶：progress 封顶 100，仅发展内容不再晋级
 * - dissipation：台前(heard/known) 恒减（dissipationDelta ?? 默认消散）；幕后(vague) 仅当 AI 显式给 dissipationDelta 才减
 * - dissipation 归 0 → deleted */
export function tickRumor(r: Rumor, opts: { progressDelta?: number; dissipationDelta?: number } = {}): RumorTickResult {
  const progress = Math.max(1, Math.min(100, (r.progress ?? 1) + (opts.progressDelta ?? 0)));
  let level = r.level;
  let progressOut = progress;
  let diss = r.dissipation;
  let leveledUp = false;
  if (progress >= 100) {
    const nl = nextRumorLevel(level);
    if (nl) {
      leveledUp = true;
      level = nl;
      progressOut = 1; // 新阶段重新从 1 走到 100
      if (level === 'heard') diss = 100; // 进台前那一刻重置（幕后的消散值不带到台前）
    } else {
      progressOut = 100; // known 已到顶：只发展内容，进度封顶
    }
  }
  const inFront = level === 'heard' || level === 'known';
  if (inFront) {
    diss = Math.max(0, (diss ?? 100) - (opts.dissipationDelta ?? RUMOR_DEFAULT_DECAY));
  } else if (opts.dissipationDelta != null) {
    diss = Math.max(0, (diss ?? 100) - opts.dissipationDelta);
  }
  if (diss === 0) return { rumor: null, deleted: true, leveledUp };
  return { rumor: { ...r, level, progress: progressOut, dissipation: diss }, deleted: false, leveledUp };
}

/** 同源检测：候选流言与全库已有流言比对，共享非虚词 bigram ≥ 阈值 → 返回同源流言（取重叠最高者）。纯函数。 */
export function findSameSourceRumor(rumor: { topic: string; content: string }, existing: Rumor[]): Rumor | null {
  const toks = new Set(tokensOf(`${rumor.topic} ${rumor.content}`));
  let best: Rumor | null = null;
  let bestOverlap = 0;
  for (const r of existing) {
    let overlap = 0;
    for (const t of tokensOf(`${r.topic} ${r.content}`)) if (toks.has(t)) overlap++;
    if (overlap > bestOverlap) { bestOverlap = overlap; best = r; }
  }
  return bestOverlap >= RUMOR_SAME_SOURCE_MIN_OVERLAP ? best : null;
}

// ═══════════════════════════════════════════════════════════════
// WS4 暗中打算线程：前端管进度（只升不降）+ 波折标记，AI 按进度写文案
// ═══════════════════════════════════════════════════════════════

/** 波折标签白名单（rollTwistTag 掷出；权重 = jitter 落点区间，测试传固定值）。 */
export const TWIST_TAGS = ['顺利', '平稳', '小波折', '遇阻', '转机'] as const;
export type TwistTag = typeof TWIST_TAGS[number];

/** 线程阶段由进度派生（非存储字段）。 */
export function charThreadStage(progress: number): string {
  if (progress >= 100) return '完成';
  if (progress >= 70) return '收尾';
  if (progress >= 30) return '推进';
  return '筹备';
}

/** 波折 → 单步增量（big 放大，体现日期跃迁推进感）。 */
const TWIST_INCREMENTS: Record<TwistTag, { small: number; big: number }> = {
  '顺利': { small: 10, big: 14 },
  '平稳': { small: 6, big: 9 },
  '小波折': { small: 3, big: 5 },
  '遇阻': { small: 1, big: 2 },
  '转机': { small: 8, big: 11 },
};

/** 掷波折标记：jitter 0-1 映射五档（0.2 步进）。 */
export function rollTwistTag(jitter: number): TwistTag {
  const r = Math.max(0, Math.min(1, jitter));
  if (r < 0.2) return '顺利';
  if (r < 0.4) return '平稳';
  if (r < 0.6) return '小波折';
  if (r < 0.8) return '遇阻';
  return '转机';
}

/** 两次日期键之间的游戏内天数（无/解析失败/回拨返回 0）。线程时间差分档（>1 天翻倍）与时间差文案共用。
 *  v2 从 world-sources 上移：makeDate 绕过 Date 构造器 0-99 年 1900 偏移。 */
export function gapDaysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  try {
    const da = parseDateKey(a);
    const db = parseDateKey(b);
    if (!da || !db) return 0;
    return Math.max(0, Math.round(
      (makeDate(db.year, db.month - 1, db.day).getTime() - makeDate(da.year, da.month - 1, da.day).getTime()) / 86400000,
    ));
  } catch (_e) { return 0; }
}

/** 线程进度推进：只升不降（波折改变单步幅值与文案走向，不影响走到头），封顶 100。
 *  mult=时间差倍数（>1 天未演化的焦点线程补偿 ×2，缺省 1）。纯函数。 */
export function advanceCharThread(
  p: CharProfile,
  spec: { tw: TwistTag; kind?: EvolveKind; jitter?: number; mult?: number },
): CharProfile {
  const inc = Math.round(TWIST_INCREMENTS[spec.tw][spec.kind === 'big' ? 'big' : 'small'] * (spec.mult ?? 1));
  const g = Math.max(0, Number(p.goalProgress) || 0);
  return { ...p, goalProgress: Math.min(100, g + inc) };
}

/** 创建去重闸：中文虚词表（tokensOf 剔除用）。 */
const STOP_WORDS = new Set([
  '的', '了', '在', '听说', '据说', '有人', '最近', '好像', '似乎', '那个', '这个', '啊', '呀', '吧', '吗', '呢',
  '和', '与', '跟', '从', '向', '把', '被', '让', '给', '就', '都', '还', '也', '又', '很', '太', '最', '更',
  '并', '而', '或', '但', '却', '如', '以', '对', '为', '其', '之', '等', '些', '个', '一', '两', '三',
  '前', '后', '上', '下', '里', '中', '外',
]);

/** 切出非虚词 token：字母数字段按整词保留；CJK 连续段按相邻二元组（bigram）切分，
 *  避免整句单 token 导致重叠检测失效（标点/空白当分隔符）。 */
function tokensOf(s: string): string[] {
  const out: string[] = [];
  const segs = (s || '').match(/[0-9A-Za-z]+|[一-鿿]+/g) || [];
  for (const seg of segs) {
    if (/^[0-9A-Za-z]+$/.test(seg)) {
      if (!STOP_WORDS.has(seg)) out.push(seg);
    } else if (seg.length === 1) {
      if (!STOP_WORDS.has(seg)) out.push(seg);
    } else {
      for (let i = 0; i + 1 < seg.length; i++) out.push(seg.slice(i, i + 2));
    }
  }
  return out;
}

/** 主角已知集合：已知实体名 + 每实体对应已知事实短语（去重闸比对用）。 */
export interface KnownSet {
  entities: Set<string>;
  facts: Record<string, string>;
}

/** 构建已知集：只收主角亲眼/亲耳确证的事实（在场角色动向/台前摘要的已传开传闻），限最近 8 条防陈旧。
 *  世界级背景实体不入（避免背景名被当「已知事实」误拦）。纯函数。 */
export function buildKnownSet(
  state: WorldState,
  ctx: { dateKey?: string; recentNames?: string[] } = {},
): KnownSet {
  const maxFacts = 8;
  const entities = new Set<string>();
  const facts: Record<string, string> = {};
  const put = (name: string, fact: string) => {
    const n = String(name || '').trim();
    if (!n) return;
    entities.add(n);
    if (fact && !facts[n]) facts[n] = String(fact).trim().slice(0, 60);
  };
  // 在场角色动向
  for (const p of Object.values(state.profiles)) if (p.onStage) put(p.name, `【${p.name}】${p.activity || ''}`);
  // 台前摘要（主角可感知）：已传开传闻（公共信息）。
  // 注意：演化纪事是引擎对全部变化的差分日志（含幕后），不是主角确证事实，不得入已知集。
  for (const line of (state.frontDigest || '').split('\n')) {
    const l = line.trim();
    if (!l) continue;
    const rumor = l.match(/^【传闻·([^】]+)】/);
    if (rumor) put(rumor[1].trim(), l);
  }
  // 近期剧情相关名（recent chat / roster 命中）
  for (const n of ctx.recentNames || []) put(n, '');
  // 封顶：只取前 maxFacts 个（按插入序）
  const entityList = [...entities].slice(0, maxFacts);
  const outE = new Set(entityList);
  const outF: Record<string, string> = {};
  for (const e of entityList) if (facts[e]) outF[e] = facts[e];
  return { entities: outE, facts: outF };
}

/** 创建去重判定（高门槛防过度拦截）：候选被拦当且仅当
 *  ① topic/content 前 30 字命中已知实体名；② 与实体已知事实短语重叠 ≥2 个非虚词 token。纯函数。 */
export function isRumorRestatingKnown(
  rumor: { topic: string; content: string },
  known: KnownSet,
): boolean {
  const body = `${rumor.topic || ''} ${rumor.content || ''}`;
  const bodyTok = new Set(tokensOf(body));
  // 主体名命中：topic 或 content 前 30 字里含已知实体名
  const head = `${rumor.topic || ''} ${(rumor.content || '').slice(0, 30)}`;
  const hit = [...known.entities].find(e => e && head.includes(e));
  if (!hit) return false;
  const factToks = new Set(tokensOf(known.facts[hit] || ''));
  let overlap = 0;
  bodyTok.forEach(t => { if (factToks.has(t)) overlap++; });
  return overlap >= 2; // ≥2 个非虚词与已知事实短语重叠才判复述
}

// ═══════════════════════════════════════════════════════════════
// 镜头之外/台前展示派生（2026-08-21 设计确认，纯函数可单测）
// ═══════════════════════════════════════════════════════════════

/** 传闻状态文案（台前/镜头之外展示用，不落存储与世界书）：
 *  known 且进展≥100 → 人尽皆知；progress<40 → 刚起风声；<80 → 越传越盛；否则传遍全城；
 *  dissipation<50 追加「 · 渐息」。 */
export function deriveRumorStatusText(level: string, progress: number, dissipation?: number): string {
  const p = Number(progress) || 1;
  let s = '';
  if (level === 'known' && p >= 100) s = '人尽皆知';
  else if (p < 40) s = '刚起风声';
  else if (p < 80) s = '越传越盛';
  else s = '传遍全城';
  if (typeof dissipation === 'number' && dissipation < 50) s += ' · 渐息';
  return s;
}

/** 镜头之外初始批次：仅离场角色，按 updatedAt 倒序（空值排最后，并列按名字序），截断 n。 */
export function initialBeyondBatch(profiles: CharProfile[], n: number): CharProfile[] {
  return profiles
    .filter(p => !p.onStage)
    .sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return a.name < b.name ? -1 : 1;
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      if (a.updatedAt !== b.updatedAt) return compareDateKey(b.updatedAt, a.updatedAt) || (a.name < b.name ? -1 : 1);
      return a.name < b.name ? -1 : 1;
    })
    .slice(0, n);
}

/** 换一批：从离场池中排除 exclude（当前批次名）随机不放回取 n；不足取尽；候选为空回退全池。 */
export function pickBeyondBatch(
  profiles: CharProfile[],
  exclude: string[],
  n: number,
  rng: () => number = Math.random,
): CharProfile[] {
  const pool = profiles.filter(p => !p.onStage);
  const excluded = new Set(exclude);
  let cands = pool.filter(p => !excluded.has(p.name));
  if (cands.length === 0) cands = pool;
  const picked: CharProfile[] = [];
  while (picked.length < n && cands.length > 0) {
    const idx = Math.floor(rng() * cands.length);
    picked.push(cands[idx]);
    cands.splice(idx, 1);
  }
  return picked;
}

/** 日期差天数（parseDateKey+makeDate 差值；无效/空返回 -1）。与 world-sources gapDaysBetween 同源。 */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return -1;
  try {
    const da = parseDateKey(a);
    const db = parseDateKey(b);
    if (!da || !db) return -1;
    return Math.round(
      (makeDate(db.year, db.month - 1, db.day).getTime() - makeDate(da.year, da.month - 1, da.day).getTime()) / 86400000,
    );
  } catch (_e) { return -1; }
}

/** 相对时间徽标：截至 MM-DD · N天前（updatedAt 空或无效返回 ''）。纯展示层，不落世界书/存储。 */
export function timeBadgeHtml(updatedAt: string, today: string): string {
  if (!updatedAt) return '';
  const days = daysBetween(updatedAt, today);
  if (days < 0) return '';
  // 取月日走 monthDayOfDateKey（年份幅值 4-6 位、负年份都安全）；slice(5) 在五位纪年下会切进月日
  const md = monthDayOfDateKey(updatedAt);
  if (!md) return '';
  const rel = days === 0 ? '今天' : days === 1 ? '1天前' : `${days}天前`;
  return `<em class="ww-time-badge">截至 ${escapeHtml(md)} · ${rel}</em>`;
}
