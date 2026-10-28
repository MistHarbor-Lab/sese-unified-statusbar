// ub-literary-v1: shared reading-first renderer for ancient + xianxia statusbars.
// Produces the masthead, toolrail, character tabs and character profile markup
// that both themes share. All color/geometry comes from --ub-* tokens defined
// in styles/ancient.ts and styles/xianxia.ts; this module emits no color itself.
import { getConfig, type StatusBarConfig } from '../core/config-store';
import { getCellByHeader, findRowByColumn, getSheetByName } from '../core/data-manager';
import {
  emotionConfigAncient, emotionConfigModern,
  clothesNames, clothesLabelsAncient,
} from '../core/constants';
import { ubIcon } from '../core/icons';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 08 待修：同上（主题状态栏 ←→ html-builder 共享零件/装配分派）
import {
  type CharProfile, buildPortraitBoxHtml, buildPastExpButton,
  buildWardrobeSummary, buildSceneButton, buildProtagonistPortraitBoxHtml,
  charRelationPillHtml,
} from './html-builder';
import { PROTAGONIST_CYCLE_SECTION, cycleMoodVariantClass, cyclePhaseBar } from './cycle-ui';
import { escapeAttr, escapeHtml } from '../core/html-escape';
import { currencyDataSnapshot, currencyIconSvg, fmtQtyShort } from '../core/currency';
import { buildBeyondTabButton, beyondViewActive, beyondAvailable } from './beyond-lens';

export type LiteraryTheme = 'ancient' | 'xianxia';

export type LiteraryIcon =
  | 'scene' | 'theme' | 'settings' | 'map-pin' | 'clock' | 'weather'
  | 'market' | 'bag' | 'wardrobe' | 'mission' | 'memo' | 'skill'
  | 'achievement' | 'database' | 'more' | 'chevron'
  | 'diary' | 'investigate' | 'interview' | 'past' | 'dark' | 'sun' | 'scheme'
  | 'coin-copper';

export interface LiteraryLabels {
  market: string;
  item: string;
  wardrobe: string;
  mission: string;
  memo: string;
  skill: string;
  more: string;
  play: string;
  detailClothes: string;
  detailBody: string;
  status: string;
  relation: string;
  intention: string;
  meter: string;
}

export const ANCIENT_LABELS: LiteraryLabels = {
  market: '市集', item: '随身', wardrobe: '衣橱', mission: '差事',
  memo: '手札', skill: '技艺', more: '更多',
  play: '当前雅兴', detailClothes: '衣容', detailBody: '体况',
  status: '此刻', relation: '关系', intention: '打算', meter: '调教值',
};

export const XIANXIA_LABELS: LiteraryLabels = {
  market: '洞天集市', item: '法宝', wardrobe: '仙衣阁', mission: '历练',
  memo: '仙笺', skill: '术法', more: '更多',
  play: '双修秘法', detailClothes: '仙衣', detailBody: '仙体',
  status: '心境', relation: '因缘', intention: '意图', meter: '道心',
};

const SCHEME_GLYPH: Record<LiteraryTheme, string> = { ancient: '朱', xianxia: '玉' };
const SCHEME_TITLE: Record<LiteraryTheme, string> = {
  ancient: '古风配色（点击切换仙侠）',
  xianxia: '仙侠配色（点击切换古风）',
};
const SCHEME_ARIA: Record<LiteraryTheme, string> = {
  ancient: '切换配色，当前古风',
  xianxia: '切换配色，当前仙侠',
};
const RESOURCE_LABEL: Record<LiteraryTheme, string> = { ancient: '瑟瑟能量', xianxia: '灵力' };
const DARK_LABEL_ON: Record<LiteraryTheme, string> = { ancient: '宣纸', xianxia: '月白' };
const DARK_LABEL_OFF: Record<LiteraryTheme, string> = { ancient: '墨夜', xianxia: '玄夜' };
// 上下文操作按钮文案（保留既有用户认知，不进 LiteraryLabels 通用契约）
const CTX_LABELS: Record<LiteraryTheme, { investigate: string; interview: string; past: string; diary: string }> = {
  ancient: { investigate: '大调查', interview: '采风', past: '往事', diary: '手记' },
  xianxia: { investigate: '天机推演', interview: '◇ 问心', past: '◆ 前世今生', diary: '◈ 修行录' },
};

const ICON_PATHS: Record<LiteraryIcon, string> = {
  scene: '<path d="M12 3v9l-5 5h10l-5-5"/><path d="M7 21h10"/>',
  theme: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/>',
  'map-pin': '<path d="M12 21s-7-6.5-7-11a7 7 0 1 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  weather: '<path d="M7 16a4 4 0 1 1 .8-7.9 5 5 0 0 1 9.4 1.4A3.5 3.5 0 0 1 17 19H7z"/>',
  market: '<path d="M3 7h18l-1.5 11a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8L3 7z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  wardrobe: '<path d="M6 3h12v18H6z"/><path d="M12 3v18M9 12h6"/>',
  mission: '<path d="M9 6h6l4 4-4 4H9l-4-4 4-4z"/><path d="M9 6v8"/>',
  memo: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  skill: '<path d="M12 2l3 6 6 .5-4.5 4 1.5 6.5L12 16l-6 3 1.5-6.5L3 8.5 9 8z"/>',
  achievement: '<circle cx="12" cy="10" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  diary: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  investigate: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>',
  interview: '<path d="M4 5h16v11H9l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  past: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v4h4"/>',
  dark: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  scheme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z"/>',
  'coin-copper': '<circle cx="12" cy="12" r="8.3"/><rect x="9.4" y="9.4" width="5.2" height="5.2" rx="0.6"/>',
};

/** 渲染一个内联 SVG 图标。button 携带中文 aria-label，SVG 自身对辅助技术隐藏。 */
export function literaryIcon(name: LiteraryIcon, label?: string): string {
  const inner = ICON_PATHS[name] || '';
  const aria = label ? ` aria-label="${escapeAttr(label)}"` : '';
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${aria}>${inner}</svg>`;
}

function sysButton(id: string, icon: LiteraryIcon, label: string, opts: { pressed?: boolean; title?: string } = {}): string {
  const pressed = opts.pressed !== undefined ? ` aria-pressed="${opts.pressed}"` : '';
  const title = opts.title ? ` title="${escapeAttr(opts.title)}"` : '';
  return `<button class="ub-sys-btn" id="${id}" type="button"${title}${pressed} aria-label="${escapeAttr(label)}">${literaryIcon(icon, label)}</button>`;
}

/** 解析当前在场角色名单与活跃角色（与旧 builder 行为一致）。 */
export function resolvePresence(): { names: string[]; active: string | null } {
  const sheet = getSheetByName('在场角色表');
  const count = sheet ? sheet.content.length - 1 : 0;
  const names: string[] = [];
  for (let i = 1; i <= count; i++) {
    const n = getCellByHeader('在场角色表', i, '姓名');
    if (n) names.push(n);
  }
  let active = (window as any)._activeChar || null;
  if (!active || findRowByColumn('在场角色表', '姓名', active) === -1) {
    active = names[0] || null;
  }
  (window as any)._activeChar = active;
  return { names, active };
}

// ═══════════════════════════════════════════════════════════════
// A. 身份栏 .ub-masthead
// ═══════════════════════════════════════════════════════════════
export function buildLiteraryMasthead(theme: LiteraryTheme, config: StatusBarConfig): string {
  const mainCharSheet = getSheetByName('主角信息表');
  const hasMain = !!(mainCharSheet && mainCharSheet.content.length > 1);
  const mainCharName = hasMain ? (getCellByHeader('主角信息表', 1, '姓名') || '') : '';
  const mainCharStatus = hasMain ? (getCellByHeader('主角信息表', 1, '近况') || '') : '';
  const seseEnergy = hasMain ? (getCellByHeader('主角信息表', 1, '瑟瑟能量') || '0') : '0';
  const currentLocation = getCellByHeader('全局数据表', 1, '当前详细地点') || '';
  const currentTime = readStoryClockRaw();

  const protagonistBox = buildProtagonistPortraitBoxHtml();
  let html = '<div class="ub-masthead' + (protagonistBox ? ' pp-enabled' : '') + '" data-ub-section="masthead">';
  html += protagonistBox;

  // 身份行：名 + 资源
  html += '<div class="ub-masthead-row" data-row="identity">';
  html += '<div class="ub-masthead-name-col">';
  if (mainCharName) {
    html += '<div class="ub-masthead-name char-name-clickable" data-clickable="char-name">' + escapeHtml(mainCharName) + '</div>';
  }
  html += '</div>';
  // 系统操作（最右）
  html += '<div class="ub-masthead-actions">';
  html += '<span class="ub-masthead-resource">' + literaryIcon('theme') + RESOURCE_LABEL[theme] + ' <b>' + escapeHtml(seseEnergy) + '</b></span>';
  html += buildLiteraryCurrencyRes(config);
  html += `<button class="ub-scheme-toggle" id="ac-scheme-toggle" type="button" title="${escapeAttr(SCHEME_TITLE[theme])}" aria-label="${escapeAttr(SCHEME_ARIA[theme])}">${SCHEME_GLYPH[theme]}</button>`;
  html += buildSceneButton(theme, config);
  html += `<button class="ub-sys-btn" id="ac-theme-btn" type="button" title="${config.darkTheme ? '切换浅色' : '切换深色'}" aria-label="${config.darkTheme ? DARK_LABEL_ON[theme] : DARK_LABEL_OFF[theme]}">${literaryIcon(config.darkTheme ? 'dark' : 'sun', config.darkTheme ? '浅色' : '深色')}</button>`;
  if (config.achievementEnabled) html += sysButton('ac-achievement-btn', 'achievement', '成就簿');
  if (config.dbViewerEnabled) html += sysButton('ac-database-btn', 'database', '数据库');
  html += sysButton('ac-settings-btn', 'settings', '设置');
  html += '</div>';
  html += '</div>';

  // 近况（独立一行，不截断——展开/收起为后续任务）
  if (mainCharStatus) html += '<div class="ub-masthead-status">' + escapeHtml(mainCharStatus) + '</div>';
  html += cyclePhaseBar(mainCharName, theme, PROTAGONIST_CYCLE_SECTION);
  html += buildWardrobeSummary(theme, config);

  // 元信息：地点 / 时间 / 天气
  if (currentLocation || currentTime) {
    html += '<div class="ub-masthead-meta">';
    if (currentLocation) {
      const locAttrs = config.mapEnabled ? ' id="ac-location-btn" style="cursor:pointer;"' : '';
      html += `<span class="ub-masthead-meta-item"${locAttrs}>${literaryIcon('map-pin')}${escapeHtml(currentLocation)}</span>`;
    }
    if (currentTime) html += `<span class="ub-masthead-meta-item" data-clickable="calendar-time" style="cursor:pointer;">${literaryIcon('clock')}${escapeHtml(currentTime)}</span>`;
    html += buildWeatherIconHTMLInline();
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/** 货币资源行（货币系统开启时；与灵力并排，点击开货币弹窗；空态占位、负余额红显）。 */
function buildLiteraryCurrencyRes(config: StatusBarConfig): string {
  if (!config.currencyEnabled) return '';
  const data = currencyDataSnapshot();
  if (!data.currencies.length) {
    return `<span class="ub-masthead-resource ub-currency-res ub-currency-empty" id="ac-currency-btn" role="button" title="货币系统：点击生成币种">${literaryIcon('coin-copper')}货币 <b>——</b></span>`;
  }
  const common = data.currencies.find(c => c.id === data.commonId) || data.currencies[0];
  const qty = data.balances[common.id] ?? 0;
  return `<span class="ub-masthead-resource ub-currency-res" id="ac-currency-btn" role="button" title="${escapeAttr(common.name + '（点击打开钱包）')}">${currencyIconSvg(common.icon, 15)} ${escapeHtml(common.name)} <b${qty < 0 ? ' class="neg"' : ''}>${fmtQtyShort(common.precision, qty)}</b></span>`;
}

function buildWeatherIconHTMLInline(): string {
  // 复用 html-builder 的天气图标逻辑，但放进 meta-item 外壳，走同步缓存。
  const config = getConfig();
  if (!config.calendarEnabled) return '';
  const weather = getCachedTodayWeather();
  if (!weather) return '';
  const tip = '今日天气：' + weather.category + '\\n' + (weather.description || '');
  return `<span class="ub-masthead-meta-item weather-icon" data-tooltip="${tip.replace(/"/g, '&quot;')}" onmouseover="window.__ubShowHelpTip(this)" onmouseout="window.__ubHideHelpTip()">${literaryIcon('weather')}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// B. 高频工具栏 .ub-toolrail（不含更多菜单——任务5未实施前全部直显）
// ═══════════════════════════════════════════════════════════════
export function buildLiteraryToolrail(theme: LiteraryTheme, config: StatusBarConfig): string {
  const L = theme === 'ancient' ? ANCIENT_LABELS : XIANXIA_LABELS;
  let html = '<div class="ub-toolrail" data-ub-section="toolrail">';
  // 商店按开关条件输出（同 interview 惯例；仅靠内联 display 会在重建后丢失，2026-10-05 修复）
  if (config.shopEnabled) html += `<button class="ub-tool-btn" data-primary="true" id="ac-lottery-head-btn" type="button" aria-label="${escapeAttr(L.market)}">${literaryIcon('market', L.market)}<span class="ub-tool-label">${L.market}</span></button>`;
  html += `<button class="ub-tool-btn" id="ac-item-head-btn" type="button" aria-label="${escapeAttr(L.item)}">${literaryIcon('bag', L.item)}<span class="ub-tool-label">${L.item}</span></button>`;
  if (config.wardrobeEnabled) {
    html += `<button class="ub-tool-btn" id="ac-wardrobe-btn" type="button" aria-label="${escapeAttr(L.wardrobe)}" title="衣柜">${literaryIcon('wardrobe', L.wardrobe)}<span class="ub-tool-label">${L.wardrobe}</span></button>`;
  }
  html += `<button class="ub-tool-btn" id="ac-mission-head-btn" type="button" aria-label="${escapeAttr(L.mission)}">${literaryIcon('mission', L.mission)}<span class="ub-tool-label">${L.mission}</span></button>`;
  html += `<button class="ub-tool-btn" id="ac-memo-head-btn" type="button" aria-label="${escapeAttr(L.memo)}">${literaryIcon('memo', L.memo)}<span class="ub-tool-label">${L.memo}</span></button>`;
  if (config.skillEnabled) {
    html += `<button class="ub-tool-btn" id="ac-skill-btn" type="button" aria-label="${escapeAttr(L.skill)}" title="主角技能与天赋树">${literaryIcon('skill', L.skill)}<span class="ub-tool-label">${L.skill}</span></button>`;
  }
  html += `<button class="ub-tool-btn" id="ac-chronicle-btn" type="button" aria-label="剧情回顾">${literaryIcon('memo', '回顾')}<span class="ub-tool-label">回顾</span></button>`;
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════
// D. 角色页签 .ub-character-tabs（保留 .spine-label / .xx-char-pill 委托钩子）
// ═══════════════════════════════════════════════════════════════
export function buildLiteraryCharacterTabs(theme: LiteraryTheme, names: string[], active: string | null): string {
  if (names.length === 0) return '';
  // 保留旧委托类：古风 .spine-label / 仙侠 .xx-char-pill
  const hookClass = theme === 'ancient' ? 'spine-label' : 'xx-char-pill';
  let html = '<div class="ub-character-tabs" role="tablist" aria-label="在场角色" data-ub-section="tabs">';
  for (const name of names) {
    const selected = name === active && !beyondViewActive();
    html += `<button class="ub-char-tab ${hookClass}${selected ? ' active' : ''}" data-char="${escapeAttr(name)}" role="tab" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" title="${escapeAttr(name)}">${escapeHtml(name)}</button>`;
  }
  html += buildBeyondTabButton(theme, beyondViewActive(), beyondAvailable());
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════
// E. 角色档案 .ub-character-profile
// ═══════════════════════════════════════════════════════════════
export function buildLiteraryProfile(theme: LiteraryTheme, profile: CharProfile, config: StatusBarConfig): string {
  const L = theme === 'ancient' ? ANCIENT_LABELS : XIANXIA_LABELS;
  const emoCfg = theme === 'ancient' ? emotionConfigAncient : emotionConfigModern;
  const emotion = emoCfg[profile.emotionRaw] ? profile.emotionRaw : '';
  const emoIcon = emotion ? ubIcon(emoCfg[emotion].icon) : '';
  const emoColor = emotion ? emoCfg[emotion].color : '';
  const ctx = CTX_LABELS[theme];

  // 衣物条目（古风用 clothesLabelsAncient 映射中文，仙侠用原列名）
  const clothesEntries: [string, string][] = [];
  clothesNames.forEach(cn => {
    const val = getCellByHeader('在场角色表', profile.activeRowIdx, cn);
    if (val && val !== '无') {
      clothesEntries.push([theme === 'ancient' ? (clothesLabelsAncient[cn] || cn) : cn, val]);
    }
  });

  let html = '<div class="ub-character-profile">';
  // 头组：肖像 + 姓名/情绪/简介
  html += '<div class="ub-profile-top">';
  html += buildPortraitBoxHtml(profile.charName);
  html += '<div class="ub-profile-head" data-ub-section="chartext">';
  html += '<div class="ub-profile-name-row">';
  html += `<div class="ub-profile-name" id="ac-char-name">${escapeHtml(profile.charName)}</div>`;
  // 上下文操作（与姓名同行，最右）
  html += '<div class="ub-context-actions">';
  if (config.investigationEnabled) html += `<button class="ub-ctx-btn ub-lp-hint" id="ac-investigate-btn" data-name="${escapeAttr(profile.charName)}" aria-label="${ctx.investigate}">${literaryIcon('investigate', ctx.investigate)}${ctx.investigate}</button>`;
  if (config.interviewEnabled) {
    html += `<button class="ub-ctx-btn interview-btn" id="ac-interview-btn" data-name="${escapeAttr(profile.charName)}" aria-label="${ctx.interview}">${literaryIcon('interview', ctx.interview)}${ctx.interview}</button>`;
  }
  const pastBtn = buildPastExpButton(profile.charName, ctx.past);
  if (pastBtn) {
    // 复用既有 #ac-past-exp-btn / .investigate-btn 钩子，外加 ub-ctx-btn 视觉
    html += pastBtn.replace('class="investigate-btn"', 'class="ub-ctx-btn investigate-btn"').replace('style="margin-left:4px;"', '');
  }
  html += `<button class="ub-ctx-btn" id="ac-diary-btn" aria-label="${ctx.diary}">${literaryIcon('diary', ctx.diary)}${ctx.diary}</button>`;
  html += '</div>';
  html += '</div>';
  if (emotion) {
    html += `<span class="ub-profile-emotion"><span class="mood-icon${cycleMoodVariantClass(profile.charName)}" style="color:${emoColor}">${emoIcon}</span> ${escapeHtml(emotion)}</span>`;
  }
  if (profile.basicInfo || profile.charRelation) html += `<div class="ub-profile-bio">${escapeHtml(profile.basicInfo)}${profile.charRelation ? charRelationPillHtml(profile.charName, profile.charRelation) : ''}</div>`;
  html += '</div>';
  html += '</div>';

  // 内心想法（主题化引用块：朱砂/青玉左线由 --ub-accent 提供）
  // F53(第十二轮)：分区键**恒定存在**（无内容时 hidden）——原条件输出会让分区键集合随数据变化，
  // 被判结构变化而整根重建（立绘重解码、展开的下拉被销毁）。hidden 零结构变化（该选择器无 display 声明）。
  html += `<blockquote class="ub-profile-thought" data-ub-section="charthought"${profile.charInnerThought ? '' : ' hidden'}>${escapeHtml(profile.charInnerThought)}</blockquote>`;

  // 当前状态 / 打算（两列 dl）——关系不在此处：类别色胶囊在上方基本信息行（点击跳人物关系网），态度详情在连线详情
  html += '<dl class="ub-profile-facts" data-ub-section="charfacts">';
  html += `<dt class="ub-fact-label">${L.status}</dt><dd class="ub-fact-value">${escapeHtml(profile.charCurrentStatus || '—')}</dd>`;
  if (profile.charIntention) html += `<dt class="ub-fact-label">${L.intention}</dt><dd class="ub-fact-value">${escapeHtml(profile.charIntention)}</dd>`;
  html += '</dl>';

  // 调教值/道心条（统一 6px、无发光节点、数值+进度同显）
  html += '<div class="ub-meter-row" data-ub-section="chartrain">';
  html += `<span class="ub-meter-label">${L.meter}</span>`;
  html += `<div class="ub-meter-track"><div class="ub-meter-fill" style="width:${profile.trainPercent}%"></div></div>`;
  html += `<span class="ub-meter-value">${profile.trainValue}/${profile.maxTrainValue}</span>`;
  html += '</div>';

  // 经期/孕期条（沿用旧组件，零开销门控）
  html += cyclePhaseBar(profile.charName, theme);

  // 衣着 / 身体 详情切换
  html += '<div class="ub-detail-tabs" data-ub-section="charswitch" role="tablist" aria-label="角色详情">';
  html += `<button class="ub-detail-tab active-switch" id="ac-switch-clothes" role="tab" aria-selected="true">${L.detailClothes}</button>`;
  html += `<button class="ub-detail-tab" id="ac-switch-body" role="tab" aria-selected="false">${L.detailBody}</button>`;
  html += '</div>';

  // 衣着列表
  html += `<div class="ub-detail-list" data-ub-section="charclothes" id="ac-clothes-list">`;
  if (profile.currentOutfit) {
    html += `<div class="ub-detail-row ub-detail-summary"><span class="ub-detail-label">当前穿搭</span><span class="ub-detail-value">${escapeHtml(profile.currentOutfit)}</span></div>`;
  }
  if (clothesEntries.length > 0) {
    for (const [k, v] of clothesEntries) {
      html += `<div class="ub-detail-row"><span class="ub-detail-label">${escapeHtml(k)}</span><span class="ub-detail-value">${escapeHtml(v)}</span></div>`;
    }
  } else if (!profile.currentOutfit) {
    html += `<div class="ub-detail-row"><span class="ub-detail-label">—</span><span class="ub-detail-value">暂无衣饰数据</span></div>`;
  }
  html += '</div>';

  // 身体列表（默认隐藏）
  html += `<div class="ub-detail-list" data-ub-section="charbody" id="ac-body-list" style="display:none;">`;
  if (profile.bodyEntries.length > 0) {
    for (const [k, v] of profile.bodyEntries) {
      html += `<div class="ub-detail-row"><span class="ub-detail-label">${escapeHtml(k)}</span><span class="ub-detail-value">${escapeHtml(v)}</span></div>`;
    }
  } else {
    html += `<div class="ub-detail-row"><span class="ub-detail-label">—</span><span class="ub-detail-value">暂无体况数据</span></div>`;
  }
  html += '</div>';

  html += '</div>';
  return html;
}

// 内部用：避免与 html-builder.buildWeatherIconHTML 形成循环引用时签名漂移，
// 直接复用 calendar-core 同步缓存。保留与 buildWeatherIconHTML 一致的门控。
import { readStoryClockRaw, getCachedTodayWeather } from '../core/calendar-core';
