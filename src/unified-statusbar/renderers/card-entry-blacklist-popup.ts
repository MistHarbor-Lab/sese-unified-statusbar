// ===== 角色卡条目黑名单选择弹窗（按角色卡勾选「不参与 1A 请求」的世界书条目）=====
//
// 入口：设置 → API →「条目黑名单」→ 子块「角色卡黑名单（按条目勾选）」→「选择条目…」。
// 壳：自建**叠加子壳**（body 直挂 + z 10025，与原始文本编辑器同层）——设置面板位于
// #settingsOverlay（z 10002）之下，故不能复用 #panelOverlay（会盖在设置面板底下）。
// 叠加子壳契约见 renderers/html-builder.ts（返回键/ESC 守卫按 ub-stacked-shell 标记识别）。
// 数据：条目来自当前角色卡绑定的世界书（主 + 附加），受管族（TavernDB/SeseLedger/UBS/[UBS手机]）不展示；
// 名单读写走 core/card-entry-blacklist（角色卡变量，随卡同步、删卡即消失）。
// 交互：**草稿式**——勾选只改本地草稿，点「保存」一次性写入角色卡并关闭（条目多时不逐次落盘）；
// 「清空」同样只改草稿；「取消」/×/遮罩/ESC/返回键在有未保存改动时先确认放弃（同原始文本编辑器）。
// 搜索只重绘列表并保滚动位、IME 组合期不刷新。
import { type StyleType } from '../core/constants';
import { getToastr, getTavernHelper } from '../core/env';
import { getCurrentCardName } from '../core/current-card';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { isUserEntryName, wbEntryIsConstant, wbEntryKeys, wbEntryName } from '../core/worldbook-entry';
import { hasCharacterCardContext } from '../core/card-variable-store';
import { readCardEntryBlacklist, splitStaleCardEntryBlacklist, writeCardEntryBlacklist } from '../core/card-entry-blacklist';
import { showConfirmDialog } from './confirm-dialog';
import { helpTipButton, releaseBackGuardIfIdle, syncDarkClass, syncDarkClassMinimal } from './html-builder';
import { ensureStyleOnce } from './style-once';

const TOAST_TITLE = '条目黑名单';
/** 行内触发词预览上限（关键词多的条目会把行撑爆）。 */
const KEYS_PREVIEW_MAX = 4;

// ===== 样式（设置页行 + 弹窗共用一份；设置页渲染时与弹窗打开时各 ensure 一次）=====
const CEBL_CSS = `
.ub-cebl-overlay,.ub-cebl-entry{
  --cebl-line:var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));
  --cebl-ink:var(--text,var(--sweet-text,var(--jade-text,#252525)));
  --cebl-muted:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));
  --cebl-accent:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));
  --cebl-card:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));
  --cebl-alt:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)));
}
/* ---- 设置页子块 ---- */
.ub-cebl-entry{margin-top:10px;padding:9px 10px;border:1px solid var(--cebl-line);border-left:3px solid var(--cebl-accent);border-radius:5px;background:var(--cebl-alt)}
.ub-cebl-entry-title{display:flex;align-items:center;gap:6px;font-size:var(--ub-ui-font-12,12px);font-weight:600;color:var(--cebl-ink)}
.ub-cebl-entry-meta{margin-top:5px;font-size:var(--ub-ui-font-11,11px);line-height:1.6;color:var(--cebl-muted)}
.ub-cebl-entry-meta b{color:var(--cebl-ink)}
.ub-cebl-entry-row{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.ub-cebl-entry-count{font-size:var(--ub-ui-font-11,11px);color:var(--cebl-muted)}
.ub-cebl-entry-hint{margin-top:6px;font-size:var(--ub-ui-font-10,10px);line-height:1.5;color:var(--cebl-muted)}
/* ---- 弹窗（叠加子壳） ---- */
.ub-cebl-overlay{z-index:10025}
.panel-popup.ub-cebl-popup{display:flex;flex-direction:column;height:min(640px,88vh);height:min(640px,88dvh);max-height:min(640px,88dvh);overflow:hidden;color:var(--cebl-ink)}
.ub-cebl-head-tip{flex:0 0 auto}
.ub-cebl-meta{flex:0 0 auto;padding:8px 14px;border-bottom:1px solid var(--cebl-line);background:var(--cebl-alt);font-size:var(--ub-ui-font-11,11px);line-height:1.6;color:var(--cebl-muted)}
.ub-cebl-meta b{color:var(--cebl-ink)}
.ub-cebl-tools{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--cebl-line);flex-wrap:wrap}
.ub-cebl-search{display:flex;align-items:center;gap:6px;flex:1;min-width:170px;padding:6px 9px;border:1px solid var(--cebl-line);border-radius:6px;background:var(--cebl-alt);font-size:var(--ub-ui-font-12,12px);color:var(--cebl-muted)}
.ub-cebl-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--cebl-ink);font:inherit}
.ub-cebl-search input::placeholder{color:var(--cebl-muted)}
.ub-cebl-seg{display:flex;flex:0 0 auto;border:1px solid var(--cebl-line);border-radius:6px;overflow:hidden}
.ub-cebl-seg button{border:0;background:var(--cebl-card);color:var(--cebl-muted);font:inherit;font-size:var(--ub-ui-font-11,11px);padding:6px 10px;cursor:pointer;white-space:nowrap}
.ub-cebl-seg button+button{border-left:1px solid var(--cebl-line)}
.ub-cebl-seg button.on{background:var(--cebl-accent);color:#fff;font-weight:600}
.ub-cebl-status{flex:0 0 auto;padding:0 14px 8px;font-size:var(--ub-ui-font-10,10px);line-height:1.6;color:var(--cebl-muted)}
.ub-cebl-status .lnk{color:var(--cebl-accent);text-decoration:underline;cursor:pointer}
.ub-cebl-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 8px 8px}
.ub-cebl-row{display:flex;align-items:flex-start;gap:9px;padding:8px;border:1px solid transparent;border-radius:6px;cursor:pointer}
.ub-cebl-row:hover{background:var(--cebl-alt)}
.ub-cebl-row.sel{background:var(--cebl-alt);border-color:var(--cebl-accent)}
.ub-cebl-check{flex:0 0 18px;width:18px;height:18px;margin-top:1px;border:1px solid var(--cebl-line);border-radius:4px;background:var(--cebl-card);color:transparent;font-size:12px;font-weight:700;line-height:1;display:grid;place-items:center}
.ub-cebl-row.sel .ub-cebl-check{border-color:var(--cebl-accent);background:var(--cebl-accent);color:#fff}
.ub-cebl-main{flex:1;min-width:0}
.ub-cebl-nm{display:flex;align-items:center;gap:6px;font-size:var(--ub-ui-font-12,12px);color:var(--cebl-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ub-cebl-row.sel .ub-cebl-nm{color:var(--cebl-accent);font-weight:600}
.ub-cebl-badge{flex:0 0 auto;padding:1px 5px;border:1px solid var(--cebl-line);border-radius:8px;font-size:9px;font-weight:400;color:var(--cebl-muted);background:var(--cebl-card)}
.ub-cebl-badge.blue{color:var(--cebl-accent);border-color:var(--cebl-accent);background:transparent}
.ub-cebl-sub{margin-top:3px;font-size:var(--ub-ui-font-10,10px);color:var(--cebl-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ub-cebl-book{flex:0 0 auto;max-width:130px;padding-top:2px;font-size:var(--ub-ui-font-10,10px);color:var(--cebl-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ub-cebl-empty{padding:26px 14px;text-align:center;font-size:var(--ub-ui-font-12,12px);line-height:1.7;color:var(--cebl-muted)}
.ub-cebl-foot{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:9px 14px;border-top:1px solid var(--cebl-line);background:var(--cebl-alt);font-size:var(--ub-ui-font-10,10px);line-height:1.6;color:var(--cebl-muted)}
.ub-cebl-foot .f1{flex:1;min-width:0}
.ub-cebl-foot .f1.dirty{color:var(--cebl-accent);font-weight:600}
.ub-cebl-btn{flex:0 0 auto;font:inherit;font-size:var(--ub-ui-font-11,11px);padding:5px 12px;line-height:1;border:1px solid var(--cebl-line);border-radius:4px;background:var(--cebl-card);color:var(--cebl-ink);cursor:pointer}
.ub-cebl-btn:hover{border-color:var(--cebl-accent);color:var(--cebl-accent)}
.ub-cebl-btn.primary{background:var(--cebl-accent);border-color:var(--cebl-accent);color:#fff;font-weight:600}
.ub-cebl-btn.primary:hover{color:#fff;filter:brightness(1.08)}
.ub-cebl-btn:disabled{opacity:.45;cursor:default}
.ub-cebl-btn:disabled:hover{border-color:var(--cebl-line);color:var(--cebl-ink);filter:none}
.ub-cebl-btn.primary:disabled:hover{color:#fff;border-color:var(--cebl-accent)}
@media(max-width:599px){
  .ub-cebl-overlay{padding:0}
  .panel-popup.ub-cebl-popup{width:100%;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;border:0}
  .ub-cebl-row{padding:11px 8px;min-height:44px}
  .ub-cebl-meta{padding:7px 12px}
  /* 三键（清空/取消/保存）在窄屏整行：提示占一行、按钮等分一行，触控目标随行高放大 */
  .ub-cebl-foot{flex-wrap:wrap}
  .ub-cebl-foot .f1{flex:1 1 100%}
  .ub-cebl-btn{flex:1 1 0;padding:9px 10px;font-size:var(--ub-ui-font-12,12px)}
}
`;

/** 幂等注入本功能样式（设置页渲染 + 弹窗打开时各调一次）。 */
export function ensureCardEntryBlacklistStyles(): void {
  ensureStyleOnce('ub-cebl-style', CEBL_CSS);
}

/** 设置页「角色卡黑名单」行的计数文案（设置页渲染与行内刷新共用一份口径）。 */
export function cardEntryBlacklistSummaryText(): string {
  const count = readCardEntryBlacklist().length;
  return count > 0 ? '已排除 ' + count + ' 条' : '未设置';
}

/** 刷新设置页行内计数（弹窗内每次变更与关闭时调用；设置页未打开时零开销）。 */
export function refreshCardEntryBlacklistRow(): void {
  const el = document.getElementById('cardEntryBlacklistCount');
  if (el) el.textContent = cardEntryBlacklistSummaryText();
}

interface PickerRow {
  name: string;
  book: string;
  /** 同名条目还出现在其它 N 本绑定世界书里（排除按名生效，故只列一行）。 */
  bookExtra: number;
  keys: string[];
  constant: boolean;
  enabled: boolean;
}

interface PickerData {
  primary: string;
  bookNames: string[];
  failedBooks: string[];
  rows: PickerRow[];
  hiddenCount: number;
}

/** 读当前角色卡绑定的世界书并摊平为用户条目（受管族只计数不展示）。 */
async function loadPickerData(): Promise<PickerData> {
  const data: PickerData = { primary: '', bookNames: [], failedBooks: [], rows: [], hiddenCount: 0 };
  const th = getTavernHelper();
  if (!th || typeof th.getCharWorldbookNames !== 'function' || typeof th.getWorldbook !== 'function') return data;
  let src: any = null;
  try { src = th.getCharWorldbookNames('current'); } catch (_e) { return data; }
  if (src?.primary) { data.primary = String(src.primary); data.bookNames.push(data.primary); }
  if (Array.isArray(src?.additional)) {
    for (const name of src.additional) if (name) data.bookNames.push(String(name));
  }
  const byName = new Map<string, PickerRow>();
  for (const book of data.bookNames) {
    let list: any = null;
    try { list = await th.getWorldbook(book); } catch (_e) { data.failedBooks.push(book); continue; }
    if (!Array.isArray(list)) { data.failedBooks.push(book); continue; }
    for (const entry of list) {
      const name = wbEntryName(entry);
      if (!isUserEntryName(name)) { data.hiddenCount += 1; continue; }
      const existed = byName.get(name);
      if (existed) { existed.bookExtra += 1; continue; }
      byName.set(name, {
        name,
        book,
        bookExtra: 0,
        keys: wbEntryKeys(entry),
        constant: wbEntryIsConstant(entry),
        enabled: entry?.enabled !== false,
      });
    }
  }
  data.rows = Array.from(byName.values());
  return data;
}

/** 打开选择弹窗（叠加在设置面板之上）。style 用于深色类同步（与各弹窗同口径）。 */
export function showCardEntryBlacklistPopup(style: StyleType): void {
  ensureCardEntryBlacklistStyles();
  const toastr = getToastr();
  if (!hasCharacterCardContext()) {
    toastr?.warning('未打开角色卡：本名单按角色卡保存，请先进入某个角色卡的聊天', TOAST_TITLE);
    return;
  }
  if (document.querySelector('.ub-cebl-overlay')) return; // 防重复开窗（设置页连点）

  const dlg = document.createElement('div');
  dlg.className = 'panel-overlay ub-stacked-shell ub-cebl-overlay';
  if (style === 'minimal') syncDarkClassMinimal(dlg); else syncDarkClass(dlg);
  document.body.appendChild(dlg);

  const cardName = getCurrentCardName() || '（未命名角色卡）';
  const state = {
    data: null as PickerData | null,
    loading: true,
    query: '',
    filter: 'all' as 'all' | 'sel',
    ime: false,
    dragOut: false,
    stored: readCardEntryBlacklist(),
    draft: [] as string[], // 工作副本：勾选/清空/清除失效项只改它，点「保存」才一次性写角色卡
  };
  state.draft = state.stored.slice();

  dlg.innerHTML =
    '<div class="panel-popup ub-popup--l ub-cebl-popup">'
    + '<div class="panel-popup-head"><div class="panel-popup-title">角色卡条目黑名单</div>'
    + '<span class="ub-cebl-head-tip">' + helpTipButton('角色卡条目黑名单说明：\\n从当前角色卡绑定的世界书里勾选**不参与 1A 类 AI 请求**的条目，点「保存」一次性写入角色卡并生效：被勾条目在请求装载世界书时被剔除——不进提示词、不参与绿灯扫描（蓝灯条目一并剔除），世界书底账不改，也不影响填表等并发请求。\\n\\n命中口径＝条目名精确相等（勾哪个名字就排除哪个名字）；与「条目黑名单」（全局正则）并行叠加，两者任一命中即剔除。\\n\\n名单保存在角色卡自身（角色卡变量），随角色卡同步、删除角色卡即随之消失，不占本项目的存储。\\n\\n数据库（TavernDB）/瑟瑟台账（SeseLedger）/本项目（UBS）/小手机（[UBS手机]）条目不会出现在勾选列表里。\\n适用于大调查/大采访/日历/剧情特卖/世界演化/技能树/角色世界书 + 小手机微信/电话；群聊与未打开角色卡时不生效。') + '</span>'
    + '<button type="button" class="panel-popup-close" data-ub-stacked-cancel>&times;</button></div>'
    + '<div class="ub-cebl-meta"></div>'
    + '<div class="ub-cebl-tools">'
    + '<div class="ub-cebl-search">🔍<input type="text" placeholder="搜索条目名 / 触发关键词 / 世界书…"></div>'
    + '<div class="ub-cebl-seg"><button type="button" data-cebl-filter="all" class="on">全部</button><button type="button" data-cebl-filter="sel" data-cebl-seg-sel>已勾选 0</button></div>'
    + '</div>'
    + '<div class="ub-cebl-status"></div>'
    + '<div class="ub-cebl-list"></div>'
    + '<div class="ub-cebl-foot"><div class="f1"></div>'
    + '<button type="button" class="ub-cebl-btn" data-cebl-clear>清空</button>'
    + '<button type="button" class="ub-cebl-btn" data-ub-stacked-cancel>取消</button>'
    + '<button type="button" class="ub-cebl-btn primary" data-cebl-save>保存</button></div>'
    + '</div>';
  dlg.classList.add('show');

  const metaEl = dlg.querySelector<HTMLElement>('.ub-cebl-meta')!;
  const statusEl = dlg.querySelector<HTMLElement>('.ub-cebl-status')!;
  const listEl = dlg.querySelector<HTMLElement>('.ub-cebl-list')!;
  const footHintEl = dlg.querySelector<HTMLElement>('.ub-cebl-foot .f1')!;
  const saveBtn = dlg.querySelector<HTMLButtonElement>('[data-cebl-save]')!;
  const searchInput = dlg.querySelector<HTMLInputElement>('.ub-cebl-search input')!;
  const segSelBtn = dlg.querySelector<HTMLButtonElement>('[data-cebl-seg-sel]')!;

  const availableNames = (): Set<string> => new Set((state.data?.rows || []).map(row => row.name));
  /** 草稿的失效拆分；世界书未读完时不做「失效」判定（此刻可见集为空，判了会把整份名单误标失效）。 */
  const draftSplit = (): { effective: string[]; stale: string[] } => state.data
    ? splitStaleCardEntryBlacklist(state.draft, availableNames())
    : { effective: state.draft, stale: [] };
  /** 草稿与已存名单是否有差异（两边都已去重；顺序无关）。 */
  const isDirty = (): boolean => {
    if (state.draft.length !== state.stored.length) return true;
    const saved = new Set(state.stored);
    return state.draft.some(name => !saved.has(name));
  };

  const metaHtml = (): string => {
    const data = state.data;
    if (!data) return '当前角色卡：<b>' + escapeHtml(cardName) + '</b>';
    const books = data.bookNames.length
      ? data.bookNames.map(name => escapeHtml(name) + (name === data.primary ? '（主）' : '（附加）')).join(' · ')
      : '（未绑定世界书）';
    const failed = data.failedBooks.length
      ? '<br>读取失败：' + escapeHtml(data.failedBooks.join('、')) + '（其条目暂不可选；名单里原有项不会被自动清除）'
      : '';
    return '当前角色卡：<b>' + escapeHtml(cardName) + '</b><br>绑定世界书：' + books + failed;
  };

  const matchesQuery = (row: PickerRow, query: string): boolean => {
    if (!query) return true;
    return (row.name + ' ' + row.keys.join(' ') + ' ' + row.book).toLowerCase().includes(query);
  };

  const rowHtml = (row: PickerRow): string => {
    const selected = state.draft.includes(row.name);
    let badges = '';
    if (row.constant) badges += '<span class="ub-cebl-badge blue">蓝灯</span>';
    if (!row.enabled) badges += '<span class="ub-cebl-badge">已禁用</span>';
    const keys = row.keys.length
      ? '触发词：' + escapeHtml(row.keys.slice(0, KEYS_PREVIEW_MAX).join('、')) + (row.keys.length > KEYS_PREVIEW_MAX ? ' …' : '')
      : '（无触发词）';
    const bookLabel = escapeHtml(row.book) + (row.bookExtra > 0 ? ' +' + row.bookExtra : '');
    return '<div class="ub-cebl-row' + (selected ? ' sel' : '') + '" data-cebl-name="' + escapeHtmlAttr(row.name) + '">'
      + '<div class="ub-cebl-check">✓</div>'
      + '<div class="ub-cebl-main"><div class="ub-cebl-nm">' + escapeHtml(row.name) + badges + '</div>'
      + '<div class="ub-cebl-sub">' + keys + '</div></div>'
      + '<div class="ub-cebl-book">' + bookLabel + '</div>'
      + '</div>';
  };

  const paintStatus = (): void => {
    const { effective, stale } = draftSplit();
    let html = '已勾选 <b>' + effective.length + '</b> 条';
    if (state.data) html += ' · 另有 ' + state.data.hiddenCount + ' 条数据库/瑟瑟台账/本项目/小手机条目已自动隐藏';
    if (stale.length) {
      html += '<br>另有 ' + stale.length + ' 条已失效（条目已改名/删除）：' + escapeHtml(stale.join('、'))
        + ' <span class="lnk" data-cebl-purge>清除失效项</span>';
    }
    statusEl.innerHTML = html;
    segSelBtn.textContent = '已勾选 ' + effective.length;
  };

  /** 底部行：未保存改动提示 + 「保存」可用态（清单与角色卡一致时禁用）。 */
  const paintFoot = (): void => {
    const dirty = isDirty();
    footHintEl.textContent = dirty
      ? '有未保存的改动：点「保存」一次性写入角色卡并生效，「取消」放弃本次改动。'
      : '被排除的条目在本卡所有 1A 类请求中不进提示词、不参与绿灯扫描（蓝灯条目一并剔除）；世界书底账不改。';
    footHintEl.classList.toggle('dirty', dirty);
    saveBtn.disabled = !dirty;
  };

  const paintList = (): void => {
    if (state.loading) {
      listEl.innerHTML = '<div class="ub-cebl-empty">正在读取绑定的世界书…</div>';
      return;
    }
    const data = state.data;
    if (!data) return;
    if (data.bookNames.length === 0) {
      listEl.innerHTML = '<div class="ub-cebl-empty">当前角色卡未绑定任何世界书。<br>请先在酒馆的角色卡设置里绑定世界书，再回来勾选。</div>';
      return;
    }
    if (data.rows.length === 0) {
      listEl.innerHTML = '<div class="ub-cebl-empty">绑定世界书里的条目全部属于数据库/瑟瑟台账/本项目/小手机（已自动隐藏）。<br>已隐藏 ' + data.hiddenCount + ' 条 · 无需设置</div>';
      return;
    }
    const query = state.query.trim().toLowerCase();
    const rows = data.rows.filter(row => (state.filter === 'sel' ? state.draft.includes(row.name) : true) && matchesQuery(row, query));
    const prevTop = listEl.scrollTop;
    listEl.innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : '<div class="ub-cebl-empty">（无匹配条目）<br>试试清空搜索，或换用条目名 / 触发关键词</div>';
    listEl.scrollTop = prevTop;
  };

  /** 只动列表/状态/底部（角色卡与世界书名不变时不重绘 meta 行）。 */
  const repaint = (): void => { paintStatus(); paintList(); paintFoot(); };
  const paint = (): void => { metaEl.innerHTML = metaHtml(); repaint(); };

  // ---- 关闭：× / 取消 / 点遮罩 / ESC / 返回键（返回键走 html-builder 叠加子壳链，落到取消键的 click）----
  let closed = false;
  let closing = false; // 放弃确认框挂起中：其余关闭路径不再叠加第二个确认框
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    dlg.remove();
    releaseBackGuardIfIdle();
    refreshCardEntryBlacklistRow();
  };
  /** 所有关闭路径共用：草稿有改动先确认放弃（与原始文本编辑器同一套脏检查）。 */
  const closeGuarded = (): void => {
    if (closed || closing) return;
    if (!isDirty()) { close(); return; }
    closing = true;
    void showConfirmDialog({
      title: '放弃修改？',
      message: '已勾选的条目尚未保存，关闭后将丢失本次改动。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      danger: true,
    }).then((giveUp) => {
      closing = false;
      if (giveUp) close();
    });
  };
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (closing) return; // 确认框在上层：本次 ESC 归它自己处理
    e.stopPropagation();
    const ae = document.activeElement as HTMLElement | null;
    const typing = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable);
    if (typing && searchInput.value) { // 正在输入：第一次 ESC 只清空搜索，不关窗
      searchInput.value = '';
      state.query = '';
      paintList();
      return;
    }
    closeGuarded();
  }
  document.addEventListener('keydown', onKeyDown, true);
  dlg.addEventListener('mousedown', (e) => { state.dragOut = (e.target !== dlg); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && !state.dragOut) closeGuarded(); });

  // ---- 事件绑定 ----
  for (const btn of Array.from(dlg.querySelectorAll<HTMLButtonElement>('[data-ub-stacked-cancel]'))) {
    btn.addEventListener('click', closeGuarded); // × 与「取消」同语义：放弃未保存改动
  }

  searchInput.addEventListener('input', () => {
    if (state.ime) return;
    state.query = searchInput.value;
    paintList();
  });
  searchInput.addEventListener('compositionstart', () => { state.ime = true; });
  searchInput.addEventListener('compositionend', () => {
    state.ime = false;
    state.query = searchInput.value;
    paintList();
  });

  const filterButtons = Array.from(dlg.querySelectorAll<HTMLButtonElement>('[data-cebl-filter]'));
  for (const btn of filterButtons) {
    btn.addEventListener('click', () => {
      state.filter = btn.getAttribute('data-cebl-filter') === 'sel' ? 'sel' : 'all';
      for (const other of filterButtons) other.classList.toggle('on', other === btn);
      paintList();
    });
  }

  listEl.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.ub-cebl-row');
    if (!row) return;
    const name = row.getAttribute('data-cebl-name') || '';
    if (!name) return;
    state.draft = state.draft.includes(name)
      ? state.draft.filter(item => item !== name)
      : state.draft.concat([name]);
    repaint();
  });

  statusEl.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest<HTMLElement>('[data-cebl-purge]')) return;
    if (!state.data) return; // 世界书未读完：此刻没有可比对的可见集，不允许清（防误清整份名单）
    const available = availableNames();
    state.draft = state.draft.filter(name => available.has(name));
    repaint();
  });

  dlg.querySelector<HTMLButtonElement>('[data-cebl-clear]')!.addEventListener('click', () => {
    if (!state.draft.length) { toastr?.info('名单已是空的', TOAST_TITLE); return; }
    state.draft = [];
    repaint();
  });

  // ---- 保存：唯一写入点（一次点击 = 一次角色卡变量写入）----
  saveBtn.addEventListener('click', () => {
    if (!isDirty()) return;
    const { effective, stale } = draftSplit();
    if (!writeCardEntryBlacklist(state.draft)) {
      toastr?.error('无法保存到当前角色卡，请先打开角色卡', TOAST_TITLE);
      return;
    }
    state.stored = state.draft.slice();
    refreshCardEntryBlacklistRow();
    close();
    toastr?.success('已保存到角色卡：已排除 ' + effective.length + ' 条'
      + (stale.length ? '（含 ' + stale.length + ' 条已失效项，一并保留）' : ''), TOAST_TITLE);
  });

  paint();
  void loadPickerData().then((data) => {
    if (closed) return;
    state.data = data;
    state.loading = false;
    paint();
  });
}
