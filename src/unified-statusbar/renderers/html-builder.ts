// ===== HTML构建器 - 按风格生成完整DOM =====
import {
  getSheetByName, getCellByHeader, findRowByColumn,
  getPhysiologyFields, isNsfwPlayActive, resolveActiveCharacter,
} from '../core/data-manager';
import {
  clothesNames,
  emotionConfigModern,
  StyleType, WeatherCategory,
} from '../core/constants';
import { PROTAGONIST_CYCLE_SECTION, cycleMoodVariantClass, cyclePhaseBar } from './cycle-ui';
import { clearPopupScrollMem } from './dom-update';
import { applyOverlayDark, getPanelColorMode } from './panel-color-mode';
import { pushBackGuard, popBackGuard, registerBackClosers, setBackGuardOpenProbe, dispatchBackClosers, anyBackGuardShellOpen } from '../core/back-guard';
import { readSelectedPlays } from '../core/play-state-store';
import { aiActivityBarHtml } from './ai-activity-bar';
import { getPlayLibrary, playCategoryColor, playCategoryLabel, getPlayMaxSelected } from '../core/play-library';
// map-panel import removed — map is now shown in a popup via map-panel.ts:showMapPopup
import { getConfig, type StatusBarConfig } from '../core/config-store';
import { ubIcon } from '../core/icons';
import { getPlayImageList } from '../core/play-images';
import { readStoryClockRaw, getCachedTodayWeather, getTodayDateKey } from '../core/calendar-core';
import { formatAgeCellText } from '../core/birthday';
import { getCurrentPortraitPath } from '../core/portrait-system';
import { PORTRAIT_PROTAGONIST_KEY, readProtagonistDisplayName, renderProtagonistPortraitMarkup } from '../core/portrait-protagonist';
import { getWeatherSvg } from './calendar-themed';
import { buildBeyondTabButton, buildBeyondLensHtml, beyondViewActive, beyondBatchNames, beyondAvailable } from './beyond-lens';
import { loadWorldState } from '../core/world-engine/world-store';
import { scheduleOverlayContentClear } from './overlay-content-clear';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 08 待修：html-builder 既是共享零件库、又是顶层装配分派（末尾反向导入三个主题状态栏的 build*HTML）⇒ 把装配分派拆到独立模块、或把共享零件下沉成 parts 模块即可解
import { buildBridgeHTML } from './bridge-statusbar';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 08 待修：同上（装配分派反向导入 ios-statusbar）
import { buildIOSHTML } from './ios-statusbar';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 08 待修：同上（装配分派反向导入 literary-statusbar）
import {
  buildLiteraryMasthead, buildLiteraryToolrail,
  buildLiteraryCharacterTabs, buildLiteraryProfile,
  resolvePresence, literaryIcon,
  ANCIENT_LABELS, XIANXIA_LABELS, type LiteraryTheme,
} from './literary-statusbar';
import { peekWardrobeSnapshot } from '../core/wardrobe-store';
import { buildProtagonistOutfitItems } from '../core/wardrobe-worldbook';
import { escapeHtml, escapeAttr, escapeHtmlAttr } from '../core/html-escape';
import { walletEntryHtml } from './currency-entry';
import { parseProtagonistAttitude, relationCategory, relationCategoryClass } from '../core/character-relation-model';
import { diaryPlainText } from '../core/diary-sanitizer';
import { NOVELAI_SAMPLERS, NOVELAI_SCHEDULERS, ASPECT_RATIO_OPTIONS } from '../core/portrait-config';
import type { ImageGenRecord, ImageGenRegenPatch } from '../core/image-gen';

// ===== 玩法区 chips（多选翻新：替换旧的 5 行 select 下拉 + 骰子 + 示意图按钮）=====
// 结构 spec = .mockup/瑟瑟玩法翻新-mockup.html 屏 1（改后）。已选 chips 即时反映
// readSelectedPlays()（顺序即注入顺序）；点击 chip 主体打开选择器并定位详情（index.ts 委托）。

/** chips 区内部 HTML（不含计数行）：已选 chips + 空态 + 添加/收藏随机按钮。 */
export function buildPlayChipsInner(placeholder: string): string {
  const selected = readSelectedPlays();
  const lib = getPlayLibrary();
  const dark = document.getElementById('ac-content')?.classList.contains('dark')
    || document.body.classList.contains('dark-mode');
  let html = '';
  for (const play of selected) {
    const color = playCategoryColor(play.category, dark, lib);
    const hasImg = getPlayImageList(play.name).length > 0;
    html += '<span class="ub-play-chip" data-play-chip="' + escapeAttr(play.name) + '" title="' + escapeAttr(play.name) + ' · 点击查看详情">'
      + '<span class="ub-play-dot" style="background:' + color + '"></span>'
      + escapeHtml(play.name)
      + '<span class="ub-play-chip-cat">' + escapeHtml(playCategoryLabel(play.category)) + '</span>'
      + (hasImg ? '<span class="ub-play-chip-img">' + ubIcon('image') + '</span>' : '')
      + '<button class="ub-play-chip-x" data-play-remove="' + escapeAttr(play.name) + '" title="移除">×</button>'
      + '</span>';
  }
  if (selected.length === 0) {
    html += '<span class="ub-play-chip empty">' + escapeHtml(placeholder) + '</span>';
  }
  html += '<button class="ub-play-add" id="ac-play-add-btn" type="button">＋ 添加玩法</button>';
  html += '<button class="ub-play-dice" id="ac-play-dice-btn" type="button" title="从收藏中随机追加一条（无收藏则全库随机）">' + ubIcon('dice') + ' 收藏随机</button>';
  return html;
}

/** chips 区完整 HTML（计数行 + chips 容器）。placeholder 为主题空态雅称（未选择/未择/未参）。 */
export function buildPlayChipsBlock(placeholder: string): string {
  const selected = readSelectedPlays();
  const max = getPlayMaxSelected();
  return '<div class="ub-play-count">已选玩法 <b>' + selected.length + '</b> / ' + max + '</div>'
    + '<div class="ub-play-chips" data-ub-play-chips data-ub-play-placeholder="' + escapeAttr(placeholder) + '">' + buildPlayChipsInner(placeholder) + '</div>';
}

/** 玩法选中态变化后刷新状态栏 chips（双容器：#ac-content 动态树与 .minimal-container 静态壳）。
 *  只替换 chips 所在块（计数行 + chips 容器一起换，保持与首屏同构），不触发整页渲染。 */
export function refreshPlayChipsUI(): void {
  // 空态文案按各容器标记的主题雅称回填（古风「未择」/仙侠「未参」/其余「未选择玩法」）
  document.querySelectorAll<HTMLElement>('[data-ub-play-chips]').forEach(el => {
    const placeholder = el.dataset.ubPlayPlaceholder || '未选择玩法';
    const wrap = el.parentElement;
    if (wrap) wrap.innerHTML = buildPlayChipsBlock(placeholder);
  });
}

// ===== 场景一键切换按钮 HTML =====
// 两态按钮：当前激活档位高亮。sceneSwitchEnabled=false 时返回空串，对界面零侵入。
// 按钮文字按当前档位显示「日常 / 瑟瑟」，未激活时显示「日常」作为默认态。
function sceneBtnLabel(config: StatusBarConfig): string {
  if (config.sceneSwitchCurrent === 'nsfw') return '瑟瑟';
  if (config.sceneSwitchCurrent === 'daily') return '日常';
  return '场景';
}

/** 生成场景切换按钮（古风/瑟瑟/甜恋/仙侠 4 个主题通用，按 style 选 class） */
export function buildSceneButton(style: StyleType, config?: StatusBarConfig): string {
  const cfg = config || getConfig();
  if (!cfg.sceneSwitchEnabled) return '';

  let btnClass: string;
  if (style === 'ancient') {
    btnClass = 'scene-btn scene-btn-ancient';
  } else if (style === 'flirtatious') {
    btnClass = 'scene-btn scene-btn-flirtatious';
  } else if (style === 'sweet') {
    btnClass = 'scene-btn scene-btn-sweet';
  } else if (style === 'xianxia') {
    btnClass = 'scene-btn scene-btn-xianxia';
  } else if (style === 'bridge') {
    btnClass = 'scene-btn bridge-btn scene-btn-bridge';
  } else if (style === 'ios') {
    btnClass = 'scene-btn ios-icon-btn';
  } else {
    btnClass = 'scene-btn scene-btn-minimal';
  }

  const activeClass = cfg.sceneSwitchCurrent ? ' scene-active-' + cfg.sceneSwitchCurrent : '';
  const label = sceneBtnLabel(cfg);
  return '<button class="' + btnClass + activeClass + '" id="ac-scene-btn" type="button" title="一键切换日常/瑟瑟场景（提示词预设+API）">' + label + '</button>';
}

/** 主角技能与天赋树入口按钮（minimal 由折叠菜单提供，此处返回空）。 */
export function buildSkillButton(style: StyleType, config: StatusBarConfig): string {
  if (!config.skillEnabled) return '';
  if (style === 'ancient') return '<button class="title-btn secondary" id="ac-skill-btn" type="button" title="主角技能与天赋树">技能</button>';
  if (style === 'flirtatious') return '<button class="item-head-btn" id="ac-skill-btn" type="button" title="主角技能与天赋树">技能</button>';
  if (style === 'sweet') return '<button class="candy-btn mint" id="ac-skill-btn" type="button" title="主角技能与天赋树" style="font-size:11px;padding:3px 8px;">🔮 技能</button>';
  if (style === 'xianxia') return '<button class="xx-header-action-btn" id="ac-skill-btn" type="button" title="主角技能与天赋树">技能</button>';
  if (style === 'bridge') return '<button class="bridge-btn" id="ac-skill-btn" type="button" title="主角技能与天赋树">技能矩阵</button>';
  if (style === 'ios') return '<button class="ios-action" id="ac-skill-btn" type="button" title="主角技能与天赋树">' + ubIcon('gem') + '技能</button>';
  return '';
}

/** 衣柜入口按钮；总开关关闭时不读取衣柜 story-floor。 */
export function buildWardrobeButton(style: StyleType, config: StatusBarConfig): string {
  if (!config.wardrobeEnabled) return '';
  if (style === 'ancient') return '<button class="title-btn secondary" id="ac-wardrobe-btn" type="button" title="衣柜">衣橱</button>';
  if (style === 'flirtatious') return '<button class="item-head-btn" id="ac-wardrobe-btn" type="button" title="衣柜">衣柜</button>';
  if (style === 'sweet') return '<button class="candy-btn lav" id="ac-wardrobe-btn" type="button" title="衣柜" style="font-size:11px;padding:3px 8px;">👗 衣柜</button>';
  if (style === 'xianxia') return '<button class="xx-header-action-btn" id="ac-wardrobe-btn" type="button" title="衣柜">仙衣阁</button>';
  if (style === 'bridge') return '<button class="bridge-btn" id="ac-wardrobe-btn" type="button" title="衣柜">装束库</button>';
  if (style === 'ios') return '<button class="ios-action" id="ac-wardrobe-btn" type="button" title="衣柜">' + ubIcon('dress') + '衣柜</button>';
  return '';
}

/** 各主题当前穿搭摘要的标签文案（融入对应风格命名）。 */
const WARDROBE_SUMMARY_LABELS: Record<StyleType, string> = {
  ancient: '着装',
  flirtatious: '穿搭',
  minimal: 'OUTFIT',
  sweet: '穿搭',
  xianxia: '仙衣',
  bridge: 'CURRENT OUTFIT',
  ios: '穿搭',
};

/** 构建穿搭摘要按钮内层 HTML（label + items 两段，供静态与 minimal 动态路径复用）。 */
function buildWardrobeSummaryInner(style: StyleType, items: string): string {
  const label = WARDROBE_SUMMARY_LABELS[style] || '穿搭';
  return '<span class="wr-sum-label">' + escapeHtml(label) + '</span>'
    + '<span class="wr-sum-items">' + escapeHtml(items) + '</span>';
}

/** 主角窗口中的紧凑穿搭摘要；点击进入衣柜。无穿搭时返回空串（默认不显示）。 */
export function buildWardrobeSummary(style: StyleType, config: StatusBarConfig): string {
  if (!config.wardrobeEnabled) return '';
  let items = '';
  try { items = buildProtagonistOutfitItems(peekWardrobeSnapshot()); } catch (_e) { /* story 尚未就绪 */ }
  if (!items) return '';
  return '<button class="wardrobe-protagonist-summary" id="ac-wardrobe-summary" type="button" title="打开衣柜">'
    + buildWardrobeSummaryInner(style, items)
    + '</button>';
}

// ===== 公共辅助 =====

/** 从恋爱对象表（回退重要角色表）读角色「过往经历」列；无数据返回空串。
 *  U63 单源：原与 popup-manager.showPastExperiencePopup 各持一份逐字同构副本。 */
export function readCharPastExp(charName: string): string {
  const loverRowIdx = findRowByColumn('恋爱对象表', '姓名', charName);
  if (loverRowIdx !== -1) {
    return getCellByHeader('恋爱对象表', loverRowIdx, '过往经历') || '';
  }
  // 非恋爱对象时，回退读重要角色表的过往经历列
  const importantRowIdx = findRowByColumn('重要角色表', '姓名', charName);
  if (importantRowIdx !== -1) {
    return getCellByHeader('重要角色表', importantRowIdx, '过往经历') || '';
  }
  return '';
}

/** 从恋爱对象表/重要角色表获取角色的过往经历，有数据时返回按钮HTML，否则返回空字符串 */
export function buildPastExpButton(charName: string, label: string): string {
  const pastExp = readCharPastExp(charName);
  if (!pastExp) return '';
  return '<button class="investigate-btn" id="ac-past-exp-btn" data-name="' + escapeAttr(charName) + '" style="margin-left:4px;">' + escapeHtml(label) + '</button>';
}

/** 立绘框 HTML。功能关闭时返回空串（零渲染开销）。有图返回带 onerror 回落的 img，无图返回空占位。 */
export function buildPortraitBoxHtml(npc: string): string {
  const config = getConfig();
  if (!config.portraitEnabled) return '';
  const safeNpc = escapeAttr(npc);
  const path = getCurrentPortraitPath(npc);
  if (path) {
    return '<div class="portrait-box has-real-portrait" data-ub-section="charportrait" data-portrait-name="' + safeNpc + '">' +
      '<img src="' + escapeAttr(path) + '" alt="' + safeNpc + '" onerror="this.parentNode.classList.remove(\'has-real-portrait\');this.parentNode.classList.add(\'portrait-empty\');this.remove();">' +
      '<div class="portrait-actions"><span data-act="generate">生成</span><span data-act="switch">换</span><span data-act="gallery">浏览</span></div>' +
      '<span class="portrait-menu-trigger" data-act="menu" title="立绘操作">⋮</span>' +
      '</div>';
  }
  return '<div class="portrait-box portrait-empty" data-ub-section="charportrait" data-portrait-name="' + safeNpc + '">' +
    '<div class="portrait-actions"><span data-act="generate">生成</span><span data-act="switch">换</span><span data-act="gallery">浏览</span></div>' +
    '<span class="portrait-menu-trigger" data-act="menu" title="立绘操作">⋮</span>' +
    '</div>';
}

/** 主角立绘框 HTML。任一开关关闭返回空串（零开销纪律：关闭时主界面与现状逐字节一致）。 */
export function buildProtagonistPortraitBoxHtml(): string {
  const config = getConfig();
  if (!config.portraitEnabled || !config.portraitProtagonistEnabled) return '';
  return renderProtagonistPortraitMarkup(getCurrentPortraitPath(PORTRAIT_PROTAGONIST_KEY), readProtagonistDisplayName());
}

/** 角色数据汇总（从多张表聚合读取，供所有风格共用） */
export interface CharProfile {
  activeRowIdx: number;
  loverRowIdx: number;
  nsfwRowIdx: number;
  charName: string;
  charAge: string;
  charIntro: string;
  charCurrentStatus: string;
  charIntention: string;
  /** 与主角的关系（「对主角态度」列的关系段；态度详情在人物关系网边详情展示）。 */
  charRelation: string;
  charInnerThought: string;
  emotionRaw: string;
  trainValue: number;
  maxTrainValue: number;
  trainPercent: number;
  basicInfo: string;
  clothesEntries: [string, string][];
  bodyEntries: [string, string][];
  currentOutfit: string;
}


/** 恋爱对象优先，未建恋爱档案时回退重要角色表；两者都按在场表姓名关联。 */
function getBaseCharacterValue(presenceRow: number, column: string): string {
  const name = getCellByHeader('在场角色表', presenceRow, '姓名') || '';
  if (!name) return '';
  const loverRow = findRowByColumn('恋爱对象表', '姓名', name);
  if (loverRow !== -1) return getCellByHeader('恋爱对象表', loverRow, column) || '';
  const importantRow = findRowByColumn('重要角色表', '姓名', name);
  return importantRow !== -1 ? (getCellByHeader('重要角色表', importantRow, column) || '') : '';
}

/** 年龄显示：优先「生日」列按当前游戏日期推算周岁；旧库「年龄」列（“20岁”/纯数字）原样透传补“岁”。 */
function getBaseCharacterAgeText(presenceRow: number): string {
  const raw = getBaseCharacterValue(presenceRow, '生日') || getBaseCharacterValue(presenceRow, '年龄');
  return formatAgeCellText(String(raw), getTodayDateKey());
}

export function getCharProfile(charName: string): CharProfile | null {
  const activeRowIdx = findRowByColumn('在场角色表', '姓名', charName);
  if (activeRowIdx === -1) return null;

  const loverRowIdx = findRowByColumn('恋爱对象表', '姓名', charName);
  const nsfwRowIdx = findRowByColumn('NSFW信息表', '姓名', charName);

  const loverIntro = getBaseCharacterValue(activeRowIdx, '一句话介绍');
  const loverAge = getBaseCharacterAgeText(activeRowIdx);
  const parts: string[] = [];
  if (loverAge) parts.push(loverAge);
  if (loverIntro) parts.push(loverIntro);
  const basicInfo = parts.join(' · ');

  const clothesEntries: [string, string][] = [];
  clothesNames.forEach(cn => {
    const val = getCellByHeader('在场角色表', activeRowIdx, cn);
    if (val && val !== '无') clothesEntries.push([cn, val]);
  });

  const reactRowIdx = findRowByColumn('即时生理反应表', '姓名', charName);
  const bodyEntries: [string, string][] = [];
  if (reactRowIdx !== -1) {
    getPhysiologyFields().forEach(([label, col]) => {
      const val = getCellByHeader('即时生理反应表', reactRowIdx, col);
      if (val !== null && val !== undefined) bodyEntries.push([label, val || '正常']);
    });
  }

  const trainRaw = nsfwRowIdx !== -1 ? (getCellByHeader('NSFW信息表', nsfwRowIdx, '调教值') || '0') : '0';
  const trainNum = parseInt(trainRaw as string) || 0;
  const maxTrainValue = 1000;

  return {
    activeRowIdx, loverRowIdx, nsfwRowIdx, charName,
    charAge: loverAge,
    charIntro: loverIntro,
    charCurrentStatus: getCellByHeader('在场角色表', activeRowIdx, '当前状态') || '',
    charIntention: getCellByHeader('在场角色表', activeRowIdx, '下一步打算') || '',
    charRelation: parseProtagonistAttitude(getBaseCharacterValue(activeRowIdx, '对主角态度')).relation,
    charInnerThought: getCellByHeader('在场角色表', activeRowIdx, '内心想法') || '',
    emotionRaw: getCellByHeader('在场角色表', activeRowIdx, '情绪') || '',
    trainValue: trainNum, maxTrainValue,
    trainPercent: Math.min((trainNum / maxTrainValue) * 100, 100),
    basicInfo,
    clothesEntries,
    bodyEntries,
    currentOutfit: getCellByHeader('在场角色表', activeRowIdx, '当前穿搭') || '',
  };
}

/** 主界面「与主角关系」类别色胶囊（配色=人物关系网类别色板）；点击由 index 委托打开人物关系网并聚焦该角色。 */
export function charRelationPillHtml(charName: string, relationWord: string): string {
  const word = String(relationWord || '').trim();
  if (!word) return '';
  return `<button class="char-relation-pill cat-${relationCategoryClass(relationCategory(word))}" data-ub-rel-pick="${escapeHtmlAttr(charName)}" type="button" title="与主角的关系：${escapeAttr(word)} · 点击在人物关系网中查看"><i></i>${escapeHtml(word)}</button>`;
}

export function syncDarkClass(overlay: HTMLElement): void {
  if (getPanelColorMode() === 'tavern') { applyOverlayDark(overlay, false); return; }
  // plugin 模式：darkTheme 配置即事实源。主面板锚点未渲染/未挂主题类时
  // （首启渲染前、折叠态、隐藏页）DOM 镜像不可靠，读配置保证弹窗配色自洽。
  overlay.classList.toggle('dark', getConfig().darkTheme);
}

export function syncDarkClassMinimal(overlay: HTMLElement): void {
  if (getPanelColorMode() === 'tavern') { applyOverlayDark(overlay, true); return; }
  const dark = getConfig().darkTheme;
  overlay.classList.toggle('dark', dark);
  // minimal 深色 token 挂在 .dark-mode：弹窗打开时同步 body，
  // 否则首启未渲染主面板时 body 缺该类、弹窗拿不到深色变量。
  document.body.classList.toggle('dark-mode', dark);
  // 同步源标记（data-ub-dark）：切走 minimal 主题时凭它回收 body 深色类（index.ts 动态渲染入口）
  if (dark) document.body.setAttribute('data-ub-dark', '1');
  else document.body.removeAttribute('data-ub-dark');
}
// 公共弹窗辅助（原在 popup-manager 定义，此处下沉以便 confirm-dialog 等模块从 html-builder
// 统一引入，同时消除 html-builder ↔ popup-manager 的循环引用）。

const BRIDGE_WINDOW_MODULES: Record<string, string> = {
  memo: 'bridge-module-memo',
  item: 'bridge-module-item',
  warehouse: 'bridge-module-warehouse',
  diary: 'bridge-module-diary',
  mission: 'bridge-module-mission',
  character: 'bridge-module-character',
  database: 'bridge-module-database',
  guidance: 'bridge-module-guidance',
  confirm: 'bridge-module-confirm',
};

export function bridgeWindowClass(module: string, tier?: '' | 's' | 'm' | 'l' | 'xl'): string {
  const cls = 'panel-popup bridge-window ' + (BRIDGE_WINDOW_MODULES[module] || ('bridge-module-' + module));
  return tier ? cls + ' ub-popup--' + tier : cls;
}

/** 关闭面板 overlay 并刷新徽章（已清零的徽章在 DOM 中移除） */
export function closePanelOverlay(overlay: HTMLElement): void {
  overlay.classList.remove('show');
  releaseBackGuardIfIdle();
  clearPopupScrollMem();
  // F38(十一轮)：延迟清空残留内容——最后弹窗的整棵 DOM（地图弹窗内联 SVG 可达 MB 级）
  // 不再常驻。600ms 内重开则自动跳过（见 overlay-content-clear.ts 头注）。
  scheduleOverlayContentClear(overlay);
  try { (window as any).__ub_refreshBadges?.(); } catch(e) {}
}

/**
 * 跨弹窗返回栈（单层）：剧情回顾跳转角色中枢/地图时，把自己挂起为"返回目标"，
 * 子窗关闭时回到剧情回顾而非整层关闭。同一时刻只允许一个返回目标。
 */
let _popupReturnTo: (() => void) | null = null;
export function setPopupReturnTo(fn: (() => void) | null): void { _popupReturnTo = fn; }
/** 关闭 overlay；若存在挂起的返回目标则改回调返回，overlay 不隐藏。返回是否触发了返回。 */
export function closePanelOverlayOrReturn(overlay: HTMLElement): boolean {
  if (_popupReturnTo) { const fn = _popupReturnTo; _popupReturnTo = null; fn(); return true; }
  closePanelOverlay(overlay);
  return false;
}

// 移动端幽灵点击防护：弹窗显示后 300ms 内忽略 overlay 背景点击关闭
// （position:fixed 浮层在 touch→click 期间出现时，浏览器会重新计算命中测试并
//  在相同屏幕坐标再次触发 click，落点变为 overlay 背景 → 弹窗被立即关闭）
// 框选越界误关防护：click 在 mousedown 与 mouseup 的最近公共祖先上触发，从弹窗面板内
// 按住拖选文字越出面板边缘（落在遮罩上）松键时，click.target 变成 overlay 本身，被各
// 弹窗"点背景关闭"（e.target===overlay）误判为点背景 → 窗口错误关闭。修法：记录每次
// mousedown 的落点；若按下起点在弹窗内而 click.target 却是 overlay，说明是拖选越界而非
// 真点背景，在捕获期拦截该 click。
let _mousedownOnOverlay = false;

function _isUbOverlay(node: Node | null): boolean {
  const el = node as HTMLElement | null;
  if (!el) return false;
  if (el.id === 'panelOverlay' || el.id === 'settingsOverlay') return true;
  // 数据库可视化用自定义 overlay 类名（panel-overlay db-*-overlay），同样走 e.target===overlay 点背景关闭
  if (el.classList.contains('db-row-detail-overlay') || el.classList.contains('db-confirm-overlay')) return true;
  return false;
}

function _bindDragGuard(): void {
  // F4：window 令牌替代模块级布尔——模块重求值（双实例注入/装载异常后 loader 重注入）时
  // IS_FIRST_BOOT 只挡 init 不挡本顶层副作用，模块布尔会让第二份再绑一对宿主 document 捕获监听。
  // 本函数在模块顶层执行：node 测试环境无 window（legacy harness 只桩 document），须安全降级为直绑。
  const w = typeof window === 'undefined' ? undefined : (window as any);
  if (w) {
    if (w.__ub_drag_guard_bound) return;
    w.__ub_drag_guard_bound = true;
  }
  document.addEventListener('mousedown', function (e) {
    _mousedownOnOverlay = _isUbOverlay(e.target as Node);
  }, true);
  document.addEventListener('click', function (e) {
    if (!_mousedownOnOverlay && _isUbOverlay(e.target as Node)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}
_bindDragGuard();

let _popupShownTs = 0;
export function guardGhostClick(): boolean {
  if (Date.now() - _popupShownTs < 300) return true;
  return false;
}
export function markPopupShown(): void {
  _popupShownTs = Date.now();
  initBackGuard();
  pushBackGuard();
}

// ===== 安卓返回键接线：全屏壳打开（markPopupShown）即压守卫；关闭走各壳自己的关闭语义 =====
// closers 按 z 从低到高注册（back-guard 从栈顶往下找第一个响应者）。
/** 叠加子壳（模态套模态：原始文本编辑器 / 轻量 confirm / 角色卡条目黑名单…）的标记类。
 *  子壳 body 直挂、靠自己的 z 盖在设置壳之上，故守卫单独识别；新增子壳沿用这两个标记即可。 */
const STACKED_SHELL_SELECTOR = '.ure-overlay.show, .ub-confirm-overlay.show, .ub-stacked-shell.show';
const STACKED_SHELL_CANCEL_SELECTOR = '[data-ure-action="cancel"], .ub-confirm-btn-cancel, [data-ub-stacked-cancel]';
function anyFullscreenShellOpen(): boolean {
  const ids = ['ubDecisionOverlay', 'settingsOverlay', 'panelOverlay'];
  if (ids.some(id => document.getElementById(id)?.classList.contains('show'))) return true;
  return !!document.querySelector(STACKED_SHELL_SELECTOR);
}
let _backGuardInited = false;
function initBackGuard(): void {
  if (_backGuardInited) return;
  _backGuardInited = true;
  registerBackClosers([
    (): boolean => { // 主面板壳：程序化点 #panelClose，完整复用各弹窗自己的关闭语义（返回栈/脏检查）
      const ov = document.getElementById('panelOverlay');
      if (!ov || !ov.classList.contains('show')) return false;
      const btn = ov.querySelector<HTMLElement>('#panelClose');
      if (btn) { btn.click(); return true; }
      closePanelOverlayOrReturn(ov);
      return true;
    },
    (): boolean => { // 设置壳
      const ov = document.getElementById('settingsOverlay');
      if (!ov || !ov.classList.contains('show')) return false;
      const btn = ov.querySelector<HTMLElement>('#settingsClose');
      if (btn) { btn.click(); return true; }
      ov.classList.remove('show');
      releaseBackGuardIfIdle();
      return true;
    },
    (): boolean => { // 叠加子壳（raw 编辑器/轻量 confirm/条目黑名单弹窗）：点它们的取消键，复用脏检查等语义
      const kids = document.querySelectorAll<HTMLElement>(STACKED_SHELL_SELECTOR);
      const top = kids[kids.length - 1];
      if (!top) return false;
      const btn = top.querySelector<HTMLElement>(STACKED_SHELL_CANCEL_SELECTOR);
      if (btn) { btn.click(); return true; }
      top.remove();
      return true;
    },
    (): boolean => { // 决策层（z 最高）：只吞掉本次返回键，不可跳过（用户拍板的强制决策设计）
      const dec = document.getElementById('ubDecisionOverlay');
      return !!(dec && dec.classList.contains('show'));
    },
  ]);
  setBackGuardOpenProbe(anyFullscreenShellOpen);
  // F27 桌面 ESC 键：复用返回键的「关闭最顶层全屏壳」链（同优先级、同关闭语义——主面板壳程序化
  // 点 #panelClose 完整复用各弹窗自己的关闭路径）。绑定在 initBackGuard 内 = 全生命周期一次
  // （_backGuardInited 同时防模块重求值重复绑定）。
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // 正在输入（输入框/文本域/下拉/可编辑区）时不抢 ESC
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    // 叠加子壳（raw 编辑器/轻量 confirm/条目黑名单弹窗）自带 ESC：子壳开着时本次 ESC 只归它，不穿通关到主弹窗
    if (document.querySelector(STACKED_SHELL_SELECTOR)) return;
    if (!anyFullscreenShellOpen()) return;
    dispatchBackClosers();
  });
}
/** 任一全屏壳经 UI 关闭后调用；已无可见壳则归还返回键守卫。 */
export function releaseBackGuardIfIdle(): void {
  // F64(第十二轮)：问「全部所有者」而非只问状态栏自己的壳——手机开着时归还守卫会让返回键失守。
  if (_backGuardInited && !anyBackGuardShellOpen()) popBackGuard();
}
/** 复制文本到剪贴板（用户手势内调用）：优先 Clipboard API，失败回退隐藏 textarea + execCommand。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_e) {
    return false;
  }
}
/** 生成新手帮助按钮 HTML（受 showHelpTips 配置控制） */
export function helpTipButton(text: string): string {
  return '<span class="help-tip-btn" data-tooltip="' + escapeAttr(text) + '" tabindex="0" onmouseover="window.__ubShowHelpTip(this)" onmouseout="window.__ubHideHelpTip()" onfocus="window.__ubShowHelpTip(this)" onblur="window.__ubHideHelpTip()">?</span>';
}

/** 将 AI 可能输出的天气大类变体（小雨/阵雨/雷雨…）归一到 9 种之一；无法识别返回 null */
function resolveWeatherCategory(raw: string): WeatherCategory | null {
  const c = (raw || '').trim();
  const exact: WeatherCategory[] = ['晴', '多云', '阴', '雨', '雪', '雾', '沙尘', '冰雹', '台风'];
  if (exact.includes(c as WeatherCategory)) return c as WeatherCategory;
  if (c.includes('冰雹') || c.includes('雹')) return '冰雹';
  if (c.includes('台风') || c.includes('飓风')) return '台风';
  if (c.includes('沙') || c.includes('尘')) return '沙尘';
  if (c.includes('雪')) return '雪';
  if (c.includes('雾') || c.includes('霾')) return '雾';
  if (c.includes('多云') || c.includes('云')) return '多云';
  if (c.includes('晴') || c.includes('阳')) return '晴';
  if (c.includes('雨') || c.includes('雷')) return '雨';
  if (c.includes('阴')) return '阴';
  return null;
}

/**
 * 生成日期旁的天气图标 HTML（受 calendarEnabled + 天气缓存双重 gate）。
 * 读同步缓存 getCachedTodayWeather() → 归一大类 → 调 getWeatherSvg() 取动画 SVG；
 * 悬浮显示「今日天气：{大类}\n{描述}」(走现有 __ubShowHelpTip 全局提示机制)。
 * 缓存为空 / 日历关闭 → 返回 ''，零渲染开销。
 * 大类无法归一时兜底通用图标，仍显示悬浮提示。
 */
export function buildWeatherIconHTML(size: number = 16): string {
  const config = getConfig();
  if (!config.calendarEnabled) return '';
  const weather = getCachedTodayWeather();
  if (!weather) return '';
  const resolved = resolveWeatherCategory(weather.category);
  const iconContent = resolved ? getWeatherSvg(resolved, size) : '';
  // 无法识别天气大类时兜底通用图标，确保仍有可视指示 + 悬浮提示
  const iconHtml = iconContent || ubIcon('sun-cloud');
  // data-tooltip 走 helpTipButton 同一套转义；换行用字面 \n，showHelpTooltip 会转真换行
  const tipRaw = '今日天气：' + weather.category + '\\n' + (weather.description || '');
  const tip = escapeAttr(tipRaw);
  return '<span class="weather-icon" data-tooltip="' + tip + '" onmouseover="window.__ubShowHelpTip(this)" onmouseout="window.__ubHideHelpTip()">' + iconHtml + '</span>';
}

// ===== 选项栏构建 =====
const NUMBER_LABELS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export function buildOptionsBar(style: StyleType, opts?: { floating?: boolean }): string {
  const config = getConfig();
  if (!config.optionsBarEnabled) return '';

  // 「选项栏跟随底部」生效时：内联位置不渲染，改由独立浮动容器（#chat 末尾）承载。
  // floating=true 表示本次调用即来自浮动容器，强制渲染内容。
  const followActive = config.optionsBarFollowBottom && config.positionMode !== 'follow-bottom';
  if (followActive && !opts?.floating) return '';

  const items = (window as any).__ub_getOptionBarItems ? (window as any).__ub_getOptionBarItems() : [];
  if (!items || items.length === 0) return '';

  let headerLabel: string;
  switch (style) {
    case 'ancient': headerLabel = '妙计锦囊'; break;
    case 'flirtatious': headerLabel = '心动选项'; break;
    case 'minimal': headerLabel = 'OPTIONS'; break;
    case 'sweet': headerLabel = '甜蜜选择'; break;
    case 'xianxia': headerLabel = '天机抉择'; break;
    case 'bridge': headerLabel = '指令序列'; break;
    case 'ios': headerLabel = '接下来的选择'; break;
    default: headerLabel = '选项栏';
  }

  let html = '<div class="options-bar" data-ub-section="options"><div class="options-bar-header"><span class="options-bar-title">' + headerLabel + '</span></div><div class="options-bar-items">';

  items.forEach((item: any, idx: number) => {
    const numLabel = NUMBER_LABELS[idx] || String(idx + 1);
    html += '<button class="option-item" data-option-index="' + idx + '" data-option-text="' + escapeAttr(item.displayText) + '"><span class="option-number">' + numLabel + '</span><span class="option-text">' + escapeHtml(item.displayText) + '</span></button>';
  });

  html += '</div></div>';
  return html;
}


// ===== 主构建函数 =====
export function buildHTML(style: StyleType): string {
  let html: string;
  switch (style) {
    case 'ancient': html = buildAncientHTML(); break;
    case 'flirtatious': html = buildFlirtatiousHTML(); break;
    // 第十二轮：minimal 由 index.ts 的 renderMinimal 直写静态壳（无 HTML 产物）。
    // 万一被误调用：显式告警 + 回落古风壳，避免静默产出已退役的第二套实现。
    case 'minimal':
      console.warn('[ub] buildHTML(minimal) 已退役：萦绕由 renderMinimal 直写静态壳');
      html = buildAncientHTML();
      break;
    case 'sweet': html = buildSweetHTML(); break;
    case 'xianxia': html = buildXianxiaHTML(); break;
    case 'bridge': html = buildBridgeHTML(); break;
    case 'ios': html = buildIOSHTML(); break;
    default: html = buildAncientHTML(); break;
  }
  return html;
}

// ===== 古风灵感HTML =====
function buildAncientHTML(): string {
  const config = getConfig();
  const isNsfw = isNsfwPlayActive();

  let html = '';
  html += '<div class="book ub-reading-shell' + (isNsfw ? ' nsfw-border' : '') + '" id="ac-book">';
  html += aiActivityBarHtml();
  html += buildLiteraryMasthead('ancient', config);
  html += buildLiteraryToolrail('ancient', config);
  if (config.nsfwPlayEnabled) html += buildAncientPlaySection(config);
  const { names, active } = resolvePresence();
  if (names.length > 0 && active) {
    html += buildLiteraryCharacterTabs('ancient', names, active);
    if (beyondViewActive()) {
      html += buildBeyondLensHtml('ancient', loadWorldState(), getTodayDateKey() || '', beyondBatchNames());
    } else {
      const profile = getCharProfile(active);
      if (profile) html += buildLiteraryProfile('ancient', profile, config);
    }
  }
  html += buildOptionsBar('ancient');
  html += '</div>';
  return html;
}

function buildAncientPlaySection(config: StatusBarConfig): string {
  return buildLiteraryPlaySection('ancient', config);
}

// 古风/仙侠玩法折叠区共享结构（.ub-play-disclosure）。颜色取 --ub-* 语义 token，
// 不含主题字面量。折叠/帮助/指导/物件/清空 均为同级按钮，不嵌套。
const LITERARY_PLAY_LABELS: Record<LiteraryTheme, {
  placeholder: string; random: string; clear: string;
  itemUse: string; guidance: string; helpTip: string;
}> = {
  ancient: {
    placeholder: '未择', random: '天意随机', clear: '尽数拂去',
    itemUse: '物件停用', guidance: '瑟瑟指导',
    helpTip: '玩法选择完毕后，正常推进故事即可，正常效果下正文会自然体现你提到的玩法。如果效果不好，请在设置中调整玩法大全插入位置，或尝试正文中适当引导。（Gemini推荐插入角色定义前）效果受模型和预设影响，请勿强求。\n请在结束后使用一键清除功能清除玩法',
  },
  xianxia: {
    placeholder: '未参', random: '随心一指', clear: '散功清心',
    itemUse: '法宝归寂', guidance: '瑟瑟指导',
    helpTip: '选择想要参修的双修秘法，正常推进剧情即可。使用完毕后请散功清心。',
  },
};

function buildLiteraryPlaySection(theme: LiteraryTheme, config: StatusBarConfig): string {
  const L = theme === 'ancient' ? ANCIENT_LABELS : XIANXIA_LABELS;
  const P = LITERARY_PLAY_LABELS[theme];
  const collapsed = config.playCollapsed;
  const expanded = !collapsed;

  // 折叠摘要：已选 N 项 / 未选择（多选翻新：按已选数组计数）
  const selectedCount = readSelectedPlays().length;
  const summary = selectedCount === 0 ? '未选择' : `已选 ${selectedCount} 项`;

  let html = '';
  html += '<section class="ub-play-disclosure" id="ac-play-section" data-ub-section="play">';
  html += '<div class="ub-play-head">';
  html += `<button class="ub-play-collapse-btn" id="ac-play-collapse-btn" type="button" aria-expanded="${expanded}" aria-controls="ac-play-body">`;
  html += `<span class="ub-play-chevron">${literaryIcon('chevron')}</span>`;
  html += `<span class="ub-play-title">${L.play}</span>`;
  html += `<span class="ub-play-summary">${summary}</span>`;
  html += `</button>`;
  html += '<div class="ub-play-head-actions">';
  if (config.showHelpTips) html += helpTipButton(P.helpTip);
  html += `<button class="ub-play-action-btn ub-lp-hint" id="ac-nsfw-guidance-btn" type="button">${P.guidance}</button>`;
  html += `<button class="ub-play-action-btn" id="ac-item-use-toggle" type="button">${P.itemUse}</button>`;
  html += `<button class="ub-play-action-btn" id="ac-play-clear-btn" type="button">${P.clear}</button>`;
  html += `</div>`;
  html += `</div>`;
  html += `<div id="ac-play-body" class="ub-play-body"${collapsed ? ' hidden' : ''}>`;
  html += '<div class="ub-play-grid">';
  html += buildPlayChipsBlock(P.placeholder === '未择' ? '未择' : '未参');
  html += '</div>';
  html += '</div>';
  html += '</section>';
  return html;
}


// ===== 瑟瑟灵感HTML =====
function buildFlirtatiousHTML(): string {
  let html = '';
  const config = getConfig();

  const currentLocation = getCellByHeader('全局数据表', 1, '当前详细地点') || '';
  const currentTime = readStoryClockRaw();
  const isNsfw = isNsfwPlayActive();
  const mainCharSheet = getSheetByName('主角信息表');
  const mainCharName = mainCharSheet && mainCharSheet.content.length > 1 ? (getCellByHeader('主角信息表', 1, '姓名') || '') : '';
  const mainCharStatus = mainCharSheet && mainCharSheet.content.length > 1 ? (getCellByHeader('主角信息表', 1, '近况') || '') : '';

  html += '<div class="book' + (isNsfw ? ' nsfw-border' : '') + '" id="ac-book">';
  html += aiActivityBarHtml();
  html += '<div class="book-head" data-ub-section="head">';
  html += '<div class="book-head-left">';
  if (currentLocation) html += '<div class="book-head-location"' + (config.mapEnabled ? ' id="ac-location-btn" style="cursor:pointer;"' : '') + '>' + escapeHtml(currentLocation) + '</div>';
  if (currentTime) html += '<div class="book-head-time">' + escapeHtml(currentTime) + buildWeatherIconHTML(16) + '</div>';
  html += '</div>';
  html += '<div class="book-head-right">';
  html += buildSceneButton('flirtatious', config);
  html += '<button class="theme-btn" id="ac-theme-btn" type="button">' + (config.darkTheme ? '亮粉' : '暗夜') + '</button>';
  if (config.achievementEnabled) html += '<button class="settings-btn" id="ac-achievement-btn" type="button" title="成就簿">' + ubIcon('medal') + '</button>';
  if (config.dbViewerEnabled) html += '<button class="settings-btn" id="ac-database-btn" type="button" title="数据库">' + ubIcon('database') + '</button>';
  html += '<button class="settings-btn" id="ac-settings-btn" type="button" title="设置">' + ubIcon('gear') + '</button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="pink-line"></div>';
  html += '<div class="book-head-main" data-ub-section="head-main">';
  html += '<div class="book-head-main-left">';
  const flirtProtagonistBox = buildProtagonistPortraitBoxHtml();
  if (flirtProtagonistBox) html += '<div class="protagonist-portrait-row">' + flirtProtagonistBox + '<div class="protagonist-info-col">';
  if (mainCharName) html += '<div class="main-char-name char-name-clickable" data-clickable="char-name">' + escapeHtml(mainCharName) + '</div>';
  if (mainCharStatus) html += '<div class="main-char-status">' + escapeHtml(mainCharStatus) + '</div>';
  html += cyclePhaseBar(mainCharName, 'flirtatious', PROTAGONIST_CYCLE_SECTION);
  html += buildWardrobeSummary('flirtatious', config);
  if (flirtProtagonistBox) html += '</div></div>';
  html += '</div>';
  const seseEnergy = mainCharSheet && mainCharSheet.content.length > 1 ? (getCellByHeader('主角信息表', 1, '瑟瑟能量') || '0') : '0';
  html += '<div class="book-head-main-right">';
  html += '<span class="energy-value" id="ac-energy-value">' + ubIcon('bolt') + escapeHtml(seseEnergy) + '</span>';
  html += walletEntryHtml('flirtatious');
  // 商店按钮按开关条件输出（同 interview 惯例）；仅靠内联 display 控制会随重建丢失，
  // 导致关闭态在切卡/切聊后复活（2026-10-05 修复）
  if (config.shopEnabled) html += '<button class="lottery-head-btn" id="ac-lottery-head-btn" type="button">' + ubIcon('bag') + ' 商店</button>';
  html += '<button class="item-head-btn" id="ac-item-head-btn" type="button">物品</button>';
  html += buildWardrobeButton('flirtatious', config);
  html += '<button class="item-head-btn" id="ac-mission-head-btn" type="button">任务</button>';
  html += '<button class="memo-head-btn" id="ac-memo-head-btn" type="button">备忘录</button>';
  html += buildSkillButton('flirtatious', config);
  html += '<button class="memo-head-btn" id="ac-chronicle-btn" type="button">回顾</button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="book-body">';

  if (config.nsfwPlayEnabled) html += buildFlirtatiousPlaySection(config);

  const presenceSheet = getSheetByName('在场角色表');
  const presenceCount = presenceSheet ? (presenceSheet.content.length - 1) : 0;
  if (presenceCount > 0) {
    const activeChar = resolveActiveCharacter();

    html += '<div class="tabs-wrap" data-ub-section="tabs"><div class="tabs">';
    for (let i = 1; i <= presenceCount; i++) {
      const name = getCellByHeader('在场角色表', i, '姓名');
      if (!name) continue;
      const cls = name === activeChar && !beyondViewActive() ? ' active' : '';
      html += '<button class="tab' + cls + '" data-char="' + escapeAttr(name) + '" title="' + escapeAttr(name) + '">' + escapeHtml(name) + '</button>';
    }
    html += buildBeyondTabButton('flirtatious', beyondViewActive(), beyondAvailable());
    html += '</div></div>';

    if (beyondViewActive()) {
      html += buildBeyondLensHtml('flirtatious', loadWorldState(), getTodayDateKey() || '', beyondBatchNames());
    } else {
      html += buildFlirtatiousCharPanel(activeChar || '', config);
    }
  }


  html += buildOptionsBar('flirtatious');

  html += '</div>';
  html += '</div>';

  return html;
}

function buildFlirtatiousPlaySection(config: StatusBarConfig): string {
  let html = '';
  html += '<div class="play-section" id="ac-play-section" data-ub-section="play">';
  html += '<div class="play-section-head">';
  html += '<div class="play-section-left">';
  html += '<button class="play-collapse-btn" id="ac-play-collapse-btn" type="button" title="折叠">−</button>';
  html += '<div style="display:flex;align-items:center;gap:4px;"><span class="play-section-label">当前玩法</span>' + (config.showHelpTips ? helpTipButton('玩法选择完毕后，正常推进故事即可，正常效果下正文会自然体现你提到的玩法。如果效果不好，请在设置中调整玩法大全插入位置，或尝试正文中适当引导。（Gemini推荐插入角色定义前）效果受模型和预设影响，请勿强求。\n请在结束后使用一键清除功能清除玩法') : '') + '</div>' + '';
  html += '</div>';
  html += '<div class="play-section-right">';
  html += '<button class="nsfw-guidance-btn ub-lp-hint" id="ac-nsfw-guidance-btn" type="button">瑟瑟指导</button>';
  html += '<button class="item-use-toggle" id="ac-item-use-toggle" type="button">物品使用 OFF</button>';
  html += '<button class="play-clear-btn" id="ac-play-clear-btn" type="button">一键清空</button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="play-grid">';
  html += buildPlayChipsBlock('未选择玩法');
  html += '</div>';
  html += '</div>';
  return html;
}

function buildFlirtatiousCharPanel(activeChar: string, config: StatusBarConfig): string {
  const activeRowIdx = findRowByColumn('在场角色表', '姓名', activeChar);
  const nsfwRowIdx = findRowByColumn('NSFW信息表', '姓名', activeChar);
  const loverIntro = getBaseCharacterValue(activeRowIdx, '一句话介绍');
  const loverAge = getBaseCharacterAgeText(activeRowIdx);
  const charCurrentStatus = getCellByHeader('在场角色表', activeRowIdx, '当前状态') || '';
  const charIntention = getCellByHeader('在场角色表', activeRowIdx, '下一步打算') || '';
  const charRelation = parseProtagonistAttitude(getBaseCharacterValue(activeRowIdx, '对主角态度')).relation;
  const charInnerThought = getCellByHeader('在场角色表', activeRowIdx, '内心想法') || '';
  const emotionRaw = getCellByHeader('在场角色表', activeRowIdx, '情绪') || '';
  const emotion = emotionConfigModern[emotionRaw] ? emotionRaw : '';
  let trainValue: string | number = nsfwRowIdx !== -1 ? (getCellByHeader('NSFW信息表', nsfwRowIdx, '调教值') || '0') : '0';
  trainValue = parseInt(trainValue as string) || 0;
  const maxTrainValue = 1000;
  const trainPercent = Math.min((trainValue as number / maxTrainValue) * 100, 100);
  let basicInfo = '';
  if (loverAge || loverIntro) {
    const parts: string[] = [];
    if (loverAge) parts.push(loverAge);
    if (loverIntro) parts.push(loverIntro);
    basicInfo = parts.join(' · ');
  }
  let html = '<div class="char-panel">';
  html += '<div class="char-head">';
  html += '<div class="char-head-info">';
  html += '<div class="char-portrait-text-row">';
  html += buildPortraitBoxHtml(activeChar);
  html += '<div class="char-text-col" data-ub-section="chartext">';
  html += '<div class="char-name-row">';
  html += '<div class="char-name" id="ac-char-name">' + escapeHtml(activeChar) + '</div>';
  if (basicInfo || charRelation) html += '<div class="char-basic-info">' + (basicInfo ? escapeHtml(basicInfo) : '') + (charRelation ? charRelationPillHtml(activeChar, charRelation) : '') + '</div>';
  html += '<div class="char-name-actions">';
  if (config.investigationEnabled) html += '<button class="investigate-btn ub-lp-hint" id="ac-investigate-btn" data-name="' + escapeAttr(activeChar) + '">大调查</button>';
  if (config.interviewEnabled) html += '<button class="investigate-btn interview-btn" id="ac-interview-btn" data-name="' + escapeAttr(activeChar) + '">采访</button>';
  html += buildPastExpButton(activeChar, '过往经历');
  html += '<button class="icon-btn" id="ac-diary-btn">日记</button>';
  html += '</div>';  html += '</div>';
  if (charInnerThought) {
    html += '<div class="char-inner-thought"><span class="inner-thought-text">' + escapeHtml(charInnerThought) + '</span>';
    if (emotion) html += '<span class="char-mood-inline" style="color:' + emotionConfigModern[emotion].color + '"><span class="mood-icon' + cycleMoodVariantClass(activeChar) + '">' + ubIcon(emotionConfigModern[emotion].icon) + '</span>' + escapeHtml(emotion) + '</span>';
    html += '</div>';
  }
  html += '<div class="char-status">当前状态：' + escapeHtml(charCurrentStatus) + '</div>';
  if (charIntention) html += '<div class="char-intention">意图：' + escapeHtml(charIntention) + '</div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="char-train-wrap" data-ub-section="chartrain">';
  html += '<div class="char-train-label">调教值</div>';
  html += '<div class="char-train-bar">';
  html += '<div class="char-train-fill" style="width:' + trainPercent + '%"></div>';
  html += '<div class="char-train-glow" style="width:' + trainPercent + '%"></div>';
  html += '</div>';
  html += '<div class="char-train-value">' + trainValue + '/' + maxTrainValue + '</div>';
  html += '</div>';
  html += cyclePhaseBar(activeChar, 'flirtatious');
  html += '</div>';
  html += '<div class="char-right-col"></div>';
  html += '</div>';

  const clothesEntries: [string, string][] = [];
  clothesNames.forEach(cn => {
    const val = getCellByHeader('在场角色表', activeRowIdx, cn);
    if (val && val !== '无') clothesEntries.push([cn, val]);
  });

  const reactRowIdx = findRowByColumn('即时生理反应表', '姓名', activeChar);
  const bodyEntries: [string, string][] = [];
  if (reactRowIdx !== -1) {
    getPhysiologyFields().forEach(([label, col]) => {
      const val = getCellByHeader('即时生理反应表', reactRowIdx, col);
      if (val !== null && val !== undefined) bodyEntries.push([label, val || '正常']);
    });
  }

  html += '<div class="char-section" data-ub-section="charbody">';
  html += '<div class="char-section-label-row">';
  html += '<span class="char-section-label">详情面板</span>';
  html += '<div class="char-switch-btns">';
  html += '<button class="char-switch-btn active-switch" id="ac-switch-clothes">衣着详情</button>';
  html += '<button class="char-switch-btn" id="ac-switch-body">身体状态</button>';
  html += '</div>';
  html += '</div>';

  const currentOutfit = getCellByHeader('在场角色表', activeRowIdx, '当前穿搭') || '';
  html += '<div class="char-clothes-list" id="ac-clothes-list">';
  if (currentOutfit) html += '<div class="char-clothes-item char-outfit-summary"><span class="cl">当前穿搭</span><span class="cv">' + escapeHtml(currentOutfit) + '</span></div>';
  if (clothesEntries.length > 0) {
    clothesEntries.forEach(([k, v]) => {
      html += '<div class="char-clothes-item"><span class="cl">' + escapeHtml(k) + '</span><span class="cv">' + escapeHtml(v) + '</span></div>';
    });
  } else if (!currentOutfit) {
    html += '<div class="char-clothes-item"><span class="cl">—</span><span class="cv">暂无衣着数据</span></div>';
  }
  html += '</div>';

  html += '<div class="char-body-list" id="ac-body-list" style="display:none;">';
  bodyEntries.forEach(([k, v]) => {
    html += '<div class="char-body-item"><span class="bl">' + escapeHtml(k) + '</span><span class="bv">' + escapeHtml(v) + '</span></div>';
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  return html;
}


// ===== 萦绕（minimal）=====
// 第十二轮：buildMinimalHTML / updateMinimalStaticElements 已删除——它们是萦绕的第二套 HTML 渲染实现，
// 早已无人调用（index.ts 对 minimal 走 renderMinimal 直写 index.html 静态壳，buildHTML 永不会收到 'minimal'），
// 留着只会让后人误以为萦绕还有一条 HTML 产物路径。萦绕专用构件（buildMinimalPresentChars / buildMinimalPlayGrid 等）保留。

// F41(第十一轮)：选择按钮行的字符串守卫（同文件级范式；渲染器无状态，守卫放模块级）
let _minimalSelectorHtml = '\u0000';

export function buildMinimalPresentChars(config: StatusBarConfig): string {
  const presenceSheet = getSheetByName('在场角色表');
  const presenceCount = presenceSheet ? (presenceSheet.content.length - 1) : 0;
  if (presenceCount <= 0) {
    // #char-selector-buttons 是静态元素，须在此清空，否则人物从有→0 重渲染时旧按钮残留
    if (_minimalSelectorHtml !== '') { $('#char-selector-buttons').html(''); _minimalSelectorHtml = ''; }
    return '<div class="empty-state">NO ONE AROUND</div>';
  }

  const activeChar = resolveActiveCharacter();

  // 生成选择按钮
  let selectorHtml = '';
  const presentChars: { name: string; rowIndex: number }[] = [];
  for (let i = 1; i <= presenceCount; i++) {
    const name = getCellByHeader('在场角色表', i, '姓名');
    if (!name) continue;
    presentChars.push({ name, rowIndex: i });
  }

  presentChars.forEach(char => {
    const isActive = char.name === activeChar && !beyondViewActive() ? 'active' : '';
    const charAge = getBaseCharacterAgeText(char.rowIndex);
    const charIntro = getBaseCharacterValue(char.rowIndex, '一句话介绍');
    selectorHtml += '<button class="char-select-btn ' + isActive + ' name-hoverable" data-char="' + escapeHtmlAttr(char.name) + '" data-age="' + escapeHtmlAttr(charAge) + '" data-intro="' + escapeHtmlAttr(charIntro) + '">' + escapeHtml(char.name) + '</button>';
  });
  selectorHtml += buildBeyondTabButton('minimal', beyondViewActive(), beyondAvailable());
  if (_minimalSelectorHtml !== selectorHtml) { $('#char-selector-buttons').html(selectorHtml); _minimalSelectorHtml = selectorHtml; }

  // 生成卡片
  if (beyondViewActive()) {
    return buildBeyondLensHtml('minimal', loadWorldState(), getTodayDateKey() || '', beyondBatchNames());
  }
  return buildMinimalCharCard(activeChar || '', config);
}

function buildMinimalCharCard(name: string, config: StatusBarConfig): string {
  const rowIndex = findRowByColumn('在场角色表', '姓名', name);
  if (rowIndex === -1) return '';

  const innerThought = getCellByHeader('在场角色表', rowIndex, '内心想法') || '—';
  const currentOutfit = getCellByHeader('在场角色表', rowIndex, '当前穿搭') || '—';
  const currentStatus = getCellByHeader('在场角色表', rowIndex, '当前状态') || '—';
  const intention = getCellByHeader('在场角色表', rowIndex, '下一步打算') || '—';
  const emotionRaw = getCellByHeader('在场角色表', rowIndex, '情绪') || '';
  const emotion = emotionConfigModern[emotionRaw] ? emotionRaw : '';
  const relation = parseProtagonistAttitude(getBaseCharacterValue(rowIndex, '对主角态度')).relation;

  const top = getCellByHeader('在场角色表', rowIndex, '上装') || '无';
  const bottom = getCellByHeader('在场角色表', rowIndex, '下装') || '无';
  const underwear = getCellByHeader('在场角色表', rowIndex, '内衣/内裤') || '无';
  const socks = getCellByHeader('在场角色表', rowIndex, '袜子') || '无';
  const shoes = getCellByHeader('在场角色表', rowIndex, '鞋子') || '无';
  const acc = getCellByHeader('在场角色表', rowIndex, '饰品') || '无';

  const reactRowIdx = findRowByColumn('即时生理反应表', '姓名', name);

  const nsfwRowIdx = findRowByColumn('NSFW信息表', '姓名', name);
  let trainValue: string | number = nsfwRowIdx !== -1 ? (getCellByHeader('NSFW信息表', nsfwRowIdx, '调教值') || '0') : '0';
  trainValue = parseInt(trainValue as string) || 0;
  const maxTrainValue = 1000;
  const trainPercent = Math.min((trainValue as number / maxTrainValue) * 100, 100);

  // 日记预览
  const diarySheet = getSheetByName('恋爱日记表');
  let latestDiary: { row: number; time: string; content: string } | null = null;
  let diaryCount = 0;
  if (diarySheet && diarySheet.content.length > 1) {
    for (let di = 1; di < diarySheet.content.length; di++) {
      const writer = getCellByHeader('恋爱日记表', di, '写作角色');
      if (writer === name) {
        diaryCount++;
        latestDiary = {
          row: di,
          time: getCellByHeader('恋爱日记表', di, '发生时间') || '',
          content: getCellByHeader('恋爱日记表', di, '日记内容') || '',
        };
      }
    }
  }

  let html = '<div class="char-card">';
  html += '<div class="char-card-top-row">';
  html += buildPortraitBoxHtml(name);
  // 便签纸
  html += '<div class="sticky-note">';
  html += '<div class="sticky-note-lines"></div>';
  html += '<div class="note-top-row">';
  if (emotion) html += '<div class="note-emotion" style="color: ' + emotionConfigModern[emotion].color + ';"><span class="mood-icon' + cycleMoodVariantClass(name) + '" style="font-size: 18px;">' + ubIcon(emotionConfigModern[emotion].icon) + '</span>' + escapeHtml(emotion) + '</div>';
  html += '<div class="note-top-actions">';
  if (relation) html += charRelationPillHtml(name, relation);
  if (config.investigationEnabled) html += '<button class="investigate-btn ub-lp-hint" id="ac-investigate-btn" data-name="' + escapeAttr(name) + '">大调查</button>';
  if (config.interviewEnabled) html += '<button class="investigate-btn interview-btn" id="ac-interview-btn" data-name="' + escapeAttr(name) + '">采访</button>';
  html += buildPastExpButton(name, 'PAST');
  html += '</div>';
  html += '</div>';
  html += '<div class="note-content">' + escapeHtml(innerThought) + '</div>';
  html += '</div>';
  // 日记预览
  html += '<div class="diary-preview diary-preview-clickable" data-name="' + escapeAttr(name) + '">';
  html += '<div class="diary-preview-title">Diary</div>';
  if (latestDiary) {
    html += '<div class="diary-preview-content">' + escapeHtml(diaryPlainText(latestDiary.content)) + '</div>';
    if (latestDiary.time) html += '<div class="diary-preview-time">' + escapeHtml(latestDiary.time) + '</div>';
    if (diaryCount > 1) html += '<div class="diary-preview-ellipsis">...共' + diaryCount + '篇</div>';
  } else {
    html += '<div class="diary-preview-empty">暂无日记</div>';
  }
  html += '</div>';
  html += '</div>';

  // 信息列表
  html += '<div class="info-list">';
  html += '<div class="info-row ub-content-row status-toggle">';
  html += '<span class="info-label">当前穿搭</span>';
  html += '<span class="info-value"><div class="status-value-box"><span>' + escapeHtml(currentOutfit) + '</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="status-arrow"><polyline points="6 9 12 15 18 9"></polyline></svg></div></span>';
  html += '</div>';
  html += '<div class="status-content info-list" style="display: none; padding-left: 12px; margin-top: 4px; border-left: 2px solid var(--border-color);">';
  html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">上装</span><span class="info-value">' + escapeHtml(top) + '</span></div>';
  html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">下装</span><span class="info-value">' + escapeHtml(bottom) + '</span></div>';
  html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">内衣/内裤</span><span class="info-value">' + escapeHtml(underwear) + '</span></div>';
  html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">袜子</span><span class="info-value">' + escapeHtml(socks) + '</span></div>';
  html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">鞋子</span><span class="info-value">' + escapeHtml(shoes) + '</span></div>';
  html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">饰品</span><span class="info-value">' + escapeHtml(acc) + '</span></div>';
  html += '</div>';

  html += '<div class="info-row ub-content-row status-toggle">';
  html += '<span class="info-label">当前状态</span>';
  html += '<span class="info-value"><div class="status-value-box"><span>' + escapeHtml(currentStatus) + '</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="status-arrow"><polyline points="6 9 12 15 18 9"></polyline></svg></div></span>';
  html += '</div>';
  html += '<div class="status-content info-list" style="display: none; padding-left: 12px; margin-top: 4px; border-left: 2px solid var(--border-color);">';
  getPhysiologyFields().forEach(([label, col]) => {
    const value = reactRowIdx !== -1
      ? (getCellByHeader('即时生理反应表', reactRowIdx, col) || '正常')
      : '正常';
    html += '<div class="info-row ub-content-row"><span class="info-label" style="width: 65px;">'
      + escapeHtml(label) + '</span><span class="info-value">' + escapeHtml(value) + '</span></div>';
  });
  html += '</div>';

  html += '<div class="info-row ub-content-row"><span class="info-label">意图</span><span class="info-value">' + escapeHtml(intention) + '</span></div>';
  html += '<div class="info-row">';
  html += '<span class="info-label"><span class="train-value-clickable" data-name="' + escapeAttr(name) + '">调教值</span></span>';
  html += '<span class="info-value"><div class="train-bar-wrap"><div class="train-bar"><div class="train-fill" style="width:' + trainPercent + '%"></div></div><span class="train-value">' + trainValue + '/' + maxTrainValue + '</span></div></span>';
  html += '</div>';
  html += cyclePhaseBar(name, 'minimal');
  html += '</div>';
  html += '</div>';

  return html;
}

export function buildMinimalPlayGrid(): string {
  return buildPlayChipsBlock('未选择玩法');
}

// ===== 🍰 甜恋糖果HTML =====
function buildSweetHTML(): string {
  let html = '';
  const config = getConfig();

  const currentLocation = getCellByHeader('全局数据表', 1, '当前详细地点') || '';
  const currentTime = readStoryClockRaw();
  const isNsfw = isNsfwPlayActive();
  const mainCharSheet = getSheetByName('主角信息表');
  const mainCharName = mainCharSheet && mainCharSheet.content.length > 1 ? (getCellByHeader('主角信息表', 1, '姓名') || '') : '';
  const mainCharStatus = mainCharSheet && mainCharSheet.content.length > 1 ? (getCellByHeader('主角信息表', 1, '近况') || '') : '';

  html += '<div class="book' + (isNsfw ? ' nsfw-border' : '') + '" id="ac-book">';
  html += aiActivityBarHtml();

  const seseEnergy = mainCharSheet && mainCharSheet.content.length > 1 ? (getCellByHeader('主角信息表', 1, '瑟瑟能量') || '0') : '0';
  html += '<div class="book-head" style="display:flex;flex-direction:column;align-items:stretch;gap:4px;" data-ub-section="head">';
  const sweetProtagonistBox = buildProtagonistPortraitBoxHtml();
  if (sweetProtagonistBox) html += '<div class="protagonist-portrait-row">' + sweetProtagonistBox + '<div style="display:flex;flex-direction:column;gap:4px;min-width:0;">';
  // Row 1: name | location | time 紧贴排列
  html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
  if (mainCharName) html += '<span class="main-char-name char-name-clickable" data-clickable="char-name" style="margin:0;">✨ ' + escapeHtml(mainCharName) + ' ✨</span>';
  if (currentLocation) html += '<span class="bubble-tag pink" style="font-size:11px;' + (config.mapEnabled ? 'cursor:pointer;' : '') + '"' + (config.mapEnabled ? ' id="ac-location-btn"' : '') + '>📍 ' + escapeHtml(currentLocation) + '</span>';
  if (currentTime) html += '<span class="bubble-tag mint" style="font-size:11px;">🕐 ' + escapeHtml(currentTime) + buildWeatherIconHTML(16) + '</span>';
  html += '</div>';
  // Row 2: status
  if (mainCharStatus) html += '<div><span class="bubble-tag peach" style="font-size:11px;">💫 ' + escapeHtml(mainCharStatus) + '</span></div>';
  html += cyclePhaseBar(mainCharName, 'sweet', PROTAGONIST_CYCLE_SECTION);
  html += buildWardrobeSummary('sweet', config);
  if (sweetProtagonistBox) html += '</div></div>';
  // Row 3: buttons right-aligned
  html += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;flex-wrap:wrap;">';
  html += '<span class="energy-value" id="ac-energy-value" style="font-size:11px;">⚡心动值 ' + escapeHtml(seseEnergy) + '</span>';
  html += walletEntryHtml('sweet');
  if (config.shopEnabled) html += '<button class="candy-btn pink" id="ac-lottery-head-btn" type="button" style="font-size:11px;padding:3px 8px;">🛒 甜蜜商店</button>';
  html += '<button class="candy-btn lav" id="ac-item-head-btn" type="button" style="font-size:11px;padding:3px 8px;">🎒 背包</button>';
  html += buildWardrobeButton('sweet', config);
  html += '<button class="candy-btn mint" id="ac-mission-head-btn" type="button" style="font-size:11px;padding:3px 8px;">📋 任务</button>';
  html += '<button class="candy-btn peach" id="ac-memo-head-btn" type="button" style="font-size:11px;padding:3px 8px;">📝 备忘录</button>';
  html += buildSkillButton('sweet', config);
  html += '<button class="candy-btn mint" id="ac-chronicle-btn" type="button" style="font-size:11px;padding:3px 8px;">📖 回顾</button>';
  html += buildSceneButton('sweet', config);
  html += '<button class="theme-btn" id="ac-theme-btn" type="button" style="font-size:11px;padding:3px 8px;">' + (config.darkTheme ? '☀️' : '🌙') + '</button>';
  if (config.achievementEnabled) html += '<button class="settings-btn" id="ac-achievement-btn" type="button" title="成就簿" style="font-size:11px;padding:3px 8px;">🏅</button>';
  if (config.dbViewerEnabled) html += '<button class="settings-btn" id="ac-database-btn" type="button" title="数据库" style="font-size:11px;padding:3px 8px;">🗄</button>';
  html += '<button class="settings-btn" id="ac-settings-btn" type="button" title="设置" style="font-size:11px;padding:3px 8px;">⚙</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="pink-line">💕 💖 💗 💝 💕</div>';

  html += '<div class="book-body">';

  const presenceSheet = getSheetByName('在场角色表');
  const presenceCount = presenceSheet ? (presenceSheet.content.length - 1) : 0;
  if (presenceCount > 0) {
    const activeChar = resolveActiveCharacter();

    html += '<div class="tabs-wrap" data-ub-section="tabs"><div class="tabs">';
    for (let i = 1; i <= presenceCount; i++) {
      const name = getCellByHeader('在场角色表', i, '姓名');
      if (!name) continue;
      const cls = name === activeChar && !beyondViewActive() ? ' active' : '';
      html += '<button class="tab' + cls + '" data-char="' + escapeAttr(name) + '" title="' + escapeAttr(name) + '">' + escapeHtml(name) + '</button>';
    }
    html += buildBeyondTabButton('sweet', beyondViewActive(), beyondAvailable());
    html += '</div></div>';

    if (beyondViewActive()) {
      html += buildBeyondLensHtml('sweet', loadWorldState(), getTodayDateKey() || '', beyondBatchNames());
    } else {
      html += buildSweetCharPanel(activeChar || '', config);
    }
  }

  if (config.nsfwPlayEnabled) html += buildSweetPlaySection(config);


  html += buildOptionsBar('sweet');

  html += '</div>';
  html += '</div>';

  return html;
}

function buildSweetCharPanel(activeChar: string, config: StatusBarConfig): string {
  const activeRowIdx = findRowByColumn('在场角色表', '姓名', activeChar);
  const nsfwRowIdx = findRowByColumn('NSFW信息表', '姓名', activeChar);
  const loverIntro = getBaseCharacterValue(activeRowIdx, '一句话介绍');
  const loverAge = getBaseCharacterAgeText(activeRowIdx);
  const charCurrentStatus = getCellByHeader('在场角色表', activeRowIdx, '当前状态') || '';
  const charIntention = getCellByHeader('在场角色表', activeRowIdx, '下一步打算') || '';
  const charRelation = parseProtagonistAttitude(getBaseCharacterValue(activeRowIdx, '对主角态度')).relation;
  const charInnerThought = getCellByHeader('在场角色表', activeRowIdx, '内心想法') || '';
  const emotionRaw = getCellByHeader('在场角色表', activeRowIdx, '情绪') || '';
  const emotion = emotionConfigModern[emotionRaw] ? emotionRaw : '';
  let trainValue: string | number = nsfwRowIdx !== -1 ? (getCellByHeader('NSFW信息表', nsfwRowIdx, '调教值') || '0') : '0';
  trainValue = parseInt(trainValue as string) || 0;
  const maxTrainValue = 1000;
  const trainPercent = Math.min((trainValue as number / maxTrainValue) * 100, 100);
  let basicInfo = '';
  if (loverAge || loverIntro) {
    const parts: string[] = [];
    if (loverAge) parts.push(loverAge);
    if (loverIntro) parts.push(loverIntro);
    basicInfo = parts.join(' · ');
  }

  let html = '<div class="char-panel"><div class="love-card">';

  html += '<div class="char-head">';
  html += '<div class="char-head-info">';
  html += '<div class="char-portrait-text-row">';
  html += buildPortraitBoxHtml(activeChar);
  html += '<div class="char-text-col" data-ub-section="chartext">';
  html += '<div class="char-name-row">';
  html += '<div class="char-name" id="ac-char-name">' + escapeHtml(activeChar) + '</div>';
  if (basicInfo) html += '<span class="char-basic-info">📎 ' + escapeHtml(basicInfo) + '</span>';
  if (charRelation) html += charRelationPillHtml(activeChar, charRelation);
  html += '<div class="char-name-actions">';
  if (config.investigationEnabled) html += '<button class="investigate-btn ub-lp-hint" id="ac-investigate-btn" data-name="' + escapeAttr(activeChar) + '">🔍 大调查</button>';
  if (config.interviewEnabled) html += '<button class="investigate-btn interview-btn" id="ac-interview-btn" data-name="' + escapeAttr(activeChar) + '">💌 采访</button>';
  html += buildPastExpButton(activeChar, '💌 过往经历');
  html += '<button class="icon-btn" id="ac-diary-btn">📔 恋爱日记</button>';
  html += '</div></div>';
  if (charInnerThought) {
    html += '<div class="char-inner-thought"><span class="inner-thought-text">' + escapeHtml(charInnerThought) + '</span></div>';
  }
  html += '</div></div></div>';
  html += '<div class="char-right-col" data-ub-section="charmood">';
  if (emotion) {
    const emoColor = emotionConfigModern[emotion]?.color || 'var(--sweet-pink-deep)';
    html += '<span class="char-mood-right" style="color:' + emoColor + '; background:var(--sweet-pink-light);font-size:11px;padding:2px 8px;"><span class="mood-icon' + cycleMoodVariantClass(activeChar) + '">' + ubIcon(emotionConfigModern[emotion].icon) + '</span>' + escapeHtml(emotion) + '中</span>';
  }
  html += '</div></div>';

  html += '<div class="char-status" data-ub-section="charstatus">💫 当前状态：' + escapeHtml(charCurrentStatus) + '</div>';
  // F53(第十二轮)：分区键恒定存在（无内容时 hidden）——条件输出会因键集合变化触发整根重建
  html += '<div class="char-intention" data-ub-section="charintent"' + (charIntention ? '' : ' hidden') + '>🎯 打算：' + escapeHtml(charIntention) + '</div>';

  html += '<div class="char-train-wrap" data-ub-section="chartrain">';
  html += '<span class="char-train-label">💗 恋爱度</span>';
  html += '<div class="char-train-bar">';
  html += '<div class="char-train-fill" style="width:' + trainPercent + '%"></div>';
  html += '<div class="char-train-glow" style="width:' + trainPercent + '%"></div>';
  html += '</div>';
  html += '<span class="char-train-value">💕 ' + trainValue + ' / ' + maxTrainValue + '</span>';
  html += '</div>';
  html += cyclePhaseBar(activeChar, 'sweet');

  const clothesEntries: [string, string][] = [];
  clothesNames.forEach(cn => {
    const val = getCellByHeader('在场角色表', activeRowIdx, cn);
    if (val && val !== '无') clothesEntries.push([cn, val]);
  });
  const reactRowIdx = findRowByColumn('即时生理反应表', '姓名', activeChar);
  const bodyEntries: [string, string][] = [];
  if (reactRowIdx !== -1) {
    getPhysiologyFields().forEach(([label, col]) => {
      const val = getCellByHeader('即时生理反应表', reactRowIdx, col);
      if (val !== null && val !== undefined) bodyEntries.push([label, val || '正常']);
    });
  }

  html += '<div class="char-section" data-ub-section="charbody">';
  html += '<div class="char-section-label-row">';
  html += '<span class="char-section-label">详情面板</span>';
  html += '<div class="char-switch-btns">';
  html += '<button class="char-switch-btn active-switch" id="ac-switch-clothes">👗 今日穿搭</button>';
  html += '<button class="char-switch-btn" id="ac-switch-body">💓 身体状态</button>';
  html += '</div></div>';

  const currentOutfit = getCellByHeader('在场角色表', activeRowIdx, '当前穿搭') || '';
  html += '<div class="char-clothes-list" id="ac-clothes-list">';
  if (currentOutfit) html += '<div class="char-clothes-item char-outfit-summary"><span class="cl">✨ 穿搭</span><span class="cv">' + escapeHtml(currentOutfit) + '</span></div>';
  if (clothesEntries.length > 0) {
    const clothesEmoji: Record<string, string> = { '上装': '👔', '下装': '👗', '内衣/内裤': '👙', '袜子': '🧦', '鞋子': '👞', '饰品': '💍' };
    clothesEntries.forEach(([k, v]) => {
      html += '<div class="char-clothes-item"><span class="cl">' + (clothesEmoji[k] || '👗') + ' ' + escapeHtml(k) + '</span><span class="cv">' + escapeHtml(v) + '</span></div>';
    });
  } else if (!currentOutfit) {
    html += '<div class="char-clothes-item"><span class="cl">—</span><span class="cv">暂无衣着数据</span></div>';
  }
  html += '</div>';

  html += '<div class="char-body-list" id="ac-body-list" style="display:none;">';
  const bodyEmoji: Record<string, string> = { '乳房': '🍒', '小穴': '🌺', '子宫': '🏠', '口穴': '💋', '菊穴': '🍑', '其他部位': '💫' };
  bodyEntries.forEach(([k, v]) => {
    html += '<div class="char-body-item"><span class="bl">' + (bodyEmoji[k] || '💓') + ' ' + escapeHtml(k) + '</span><span class="bv">' + escapeHtml(v) + '</span></div>';
  });
  html += '</div></div>';

  html += '</div></div>';
  return html;
}

function buildSweetPlaySection(config: StatusBarConfig): string {
  let html = '';
  html += '<div class="play-section" id="ac-play-section" data-ub-section="play">';
  html += '<div class="play-section-head">';
  html += '<div class="play-section-left">';
  html += '<button class="play-collapse-btn" id="ac-play-collapse-btn" type="button" title="折叠">−</button>';
  html += '<div style="display:flex;align-items:center;gap:4px;"><span class="play-section-label">🍰 今日甜点菜单</span>' + (config.showHelpTips ? helpTipButton('玩法选择完毕后，正常推进故事即可，正常效果下正文会自然体现你提到的玩法。如果效果不好，请在设置中调整玩法大全插入位置，或尝试正文中适当引导。（Gemini推荐插入角色定义前）效果受模型和预设影响，请勿强求。\n请在结束后使用一键清除功能清除玩法') : '') + '</div>' + '';
  html += '</div>';
  html += '<div class="play-section-right">';
  html += '<button class="nsfw-guidance-btn ub-lp-hint" id="ac-nsfw-guidance-btn" type="button">瑟瑟指导</button>';
  html += '<button class="item-use-toggle" id="ac-item-use-toggle" type="button">🎒 物品使用 OFF</button>';
  html += '<button class="play-clear-btn" id="ac-play-clear-btn" type="button">🔄 清空菜单</button>';
  html += '</div></div>';
  html += '<div class="play-grid">';
  html += buildPlayChipsBlock('未选择 ✨');
  html += '</div></div>';
  return html;
}


// ===== 仙侠·云海仙踪 HTML =====
function buildXianxiaHTML(): string {
  const config = getConfig();
  const isNsfw = isNsfwPlayActive();

  let html = '';
  html += '<div class="book ub-reading-shell' + (isNsfw ? ' nsfw-border' : '') + '" id="ac-book">';
  html += aiActivityBarHtml();
  html += buildLiteraryMasthead('xianxia', config);
  html += buildLiteraryToolrail('xianxia', config);
  if (config.nsfwPlayEnabled) html += buildXianxiaPlaySection(config);
  const { names, active } = resolvePresence();
  if (names.length > 0 && active) {
    html += buildLiteraryCharacterTabs('xianxia', names, active);
    if (beyondViewActive()) {
      html += buildBeyondLensHtml('xianxia', loadWorldState(), getTodayDateKey() || '', beyondBatchNames());
    } else {
      const profile = getCharProfile(active);
      if (profile) html += buildLiteraryProfile('xianxia', profile, config);
    }
  }
  html += buildOptionsBar('xianxia');
  html += '</div>';
  return html;
}

function buildXianxiaPlaySection(config: StatusBarConfig): string {
  return buildLiteraryPlaySection('xianxia', config);
}

// ===== 生图参数微调块（重新生图：立绘编辑弹窗/插图详情弹窗共用）=====
// 字段随档案供应商条件渲染，prefill=档案现值；seed 留空=新随机（同 seed 在 NAI/ComfyUI 几乎必然复刻原图）。
// 改过的提示词/参数仅本次重绘生效（随新档案落盘为实际发送形态），不回写全局设置。
function genParamsOptions(list: Array<{ id: string; name: string }>, current: string | undefined): string {
  const cur = String(current || '');
  const items = list.some((o) => o.id === cur) || !cur
    ? list
    : [{ id: cur, name: cur }, ...list];
  return items.map((o) => `<option value="${escapeAttr(o.id)}"${o.id === cur ? ' selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
}

/** 参数微调 HTML（p=字段 id 前缀，如 'pe'/'sd'）。无档案/unknown（不可重绘）返回只读占位说明。 */
export function genParamsEditHtml(gen: ImageGenRecord | undefined, p: string): string {
  if (!gen || gen.provider === 'unknown') {
    return '<div class="gen-params-note">未记录完整生图档案，不支持重新生图</div>';
  }
  const v = gen.params || {};
  const num = (id: string, val: number | undefined, extra = ''): string =>
    `<input type="number" id="${p}${id}" value="${val ?? ''}" ${extra}>`;
  if (gen.provider === 'openai') {
    const cur = v.aspectRatio || 'auto';
    const opts = ASPECT_RATIO_OPTIONS.map((r) => `<option value="${escapeAttr(r)}"${r === cur ? ' selected' : ''}>${escapeHtml(r)}</option>`).join('');
    return `<div class="gen-params-grid"><label>比例<select id="${p}Aspect">${opts}</select></label></div>`
      + '<div class="gen-params-note">OpenAI 兼容端无 seed，重新生图必为新图</div>';
  }
  if (gen.provider === 'comfyui') {
    return '<div class="gen-params-grid">'
      + `<label>宽${num('Width', v.width, 'min="64"')}</label>`
      + `<label>高${num('Height', v.height, 'min="64"')}</label>`
      + `<label>seed${num('Seed', undefined, 'placeholder="留空=新随机"')}</label>`
      + `<label>步数${num('Steps', v.steps, 'min="1"')}</label>`
      + `<label>CFG${num('Cfg', v.cfg, 'step="0.5" min="1"')}</label>`
      + `<label>采样器<input type="text" id="${p}Sampler" value="${escapeAttr(v.sampler || '')}" placeholder="留空=工作流原值"></label>`
      + `<label>调度器<input type="text" id="${p}Scheduler" value="${escapeAttr(v.scheduler || '')}" placeholder="留空=工作流原值"></label>`
      + '</div><div class="gen-params-note">按存档工作流重绘，改过的参数写入工作流对应节点</div>';
  }
  // novelai
  return '<div class="gen-params-grid">'
    + `<label>宽${num('Width', v.width, 'min="64"')}</label>`
    + `<label>高${num('Height', v.height, 'min="64"')}</label>`
    + `<label>seed${num('Seed', undefined, 'placeholder="留空=新随机"')}</label>`
    + `<label>步数${num('Steps', v.steps, 'min="1"')}</label>`
    + `<label>CFG${num('Cfg', v.cfg, 'step="0.5" min="1"')}</label>`
    + `<label>rescale${num('Rescale', v.cfgRescale, 'step="0.1" min="0" max="1"')}</label>`
    + `<label>采样器<select id="${p}Sampler">${genParamsOptions(NOVELAI_SAMPLERS, v.sampler)}</select></label>`
    + `<label>调度器<select id="${p}Scheduler">${genParamsOptions(NOVELAI_SCHEDULERS, v.scheduler)}</select></label>`
    + '</div><div class="gen-params-note">仅本次重新生图生效，不影响全局设置；seed 留空=新随机</div>';
}

/** 读取参数微调块当前值（空/非法=不覆盖，重绘沿用档案原值；seed 空=新随机）。 */
export function readGenParamsPatch(p: string): NonNullable<ImageGenRegenPatch['params']> {
  const num = (id: string): number | undefined => {
    const el = document.getElementById(p + id) as HTMLInputElement | null;
    if (!el) return undefined;
    const t = String(el.value || '').trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (id: string): string | undefined => {
    const el = document.getElementById(p + id) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) return undefined;
    return String(el.value || '').trim() || undefined;
  };
  const out: NonNullable<ImageGenRegenPatch['params']> = {};
  const width = num('Width'); if (width !== undefined) out.width = width;
  const height = num('Height'); if (height !== undefined) out.height = height;
  const seed = num('Seed'); if (seed !== undefined) out.seed = seed;
  const steps = num('Steps'); if (steps !== undefined) out.steps = steps;
  const cfg = num('Cfg'); if (cfg !== undefined) out.cfg = cfg;
  const cfgRescale = num('Rescale'); if (cfgRescale !== undefined) out.cfgRescale = cfgRescale;
  const sampler = str('Sampler'); if (sampler) out.sampler = sampler;
  const scheduler = str('Scheduler'); if (scheduler) out.scheduler = scheduler;
  const aspect = str('Aspect'); if (aspect) out.aspectRatio = aspect;
  return out;
}
