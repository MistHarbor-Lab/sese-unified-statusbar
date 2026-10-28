// ===== 灵动玻璃主状态栏（iOS 风） =====
// 结构契约与 bridge-statusbar 一致（ID/class/data-* 由 index.ts 事件委托消费）：
// ac-location-btn / ac-theme-btn / ac-achievement-btn / ac-database-btn / ac-settings-btn /
// ac-lottery|item|mission|memo-head-btn / ac-chronicle-btn / .tab[data-char] /
// ac-char-name / ac-investigate-btn / ac-interview-btn / ac-diary-btn /
// ac-switch-clothes|body(.active-switch) / ac-clothes-list / ac-body-list /
// ac-play-section / ac-play-collapse-btn / ac-item-use-toggle / ac-nsfw-guidance-btn /
// data-ub-play-chips（多选 chips：点 chip 开选择器、data-play-remove 移除）。
// data-ub-section 分区标记支持 index.ts 的分区热更新（head/quick/tabs/profile/play/options）。
import { getCellByHeader, getSheetByName, findRowByColumn, isNsfwPlayActive } from '../core/data-manager';
import { aiActivityBarHtml } from './ai-activity-bar';
import { getConfig, type StatusBarConfig } from '../core/config-store';
import { ubIcon } from '../core/icons';
import { currencyDataSnapshot, currencyIconSvg, fmtQtyShort } from '../core/currency';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 08 待修：同上（主题状态栏 ←→ html-builder 共享零件/装配分派）
import {
  buildOptionsBar,
  buildPastExpButton,
  buildPlayChipsBlock,
  buildPortraitBoxHtml,
  buildProtagonistPortraitBoxHtml,
  buildSceneButton,
  buildSkillButton,
  buildWardrobeButton,
  buildWardrobeSummary,
  buildWeatherIconHTML,
  charRelationPillHtml,
  getCharProfile,
} from './html-builder';
import { PROTAGONIST_CYCLE_SECTION, cycleMoodVariantClass, cyclePhaseBar } from './cycle-ui';
import { escapeHtml } from '../core/html-escape';
import { buildBeyondTabButton, buildBeyondLensHtml, beyondViewActive, beyondBatchNames, beyondAvailable } from './beyond-lens';
import { loadWorldState } from '../core/world-engine/world-store';
import { getTodayDateKey } from '../core/calendar-core';

function readGlobal(column: string): string {
  return getCellByHeader('全局数据表', 1, column) || '';
}

function readProtagonist(column: string): string {
  return getCellByHeader('主角信息表', 1, column) || '';
}

function resolveActiveCharacter(): string {
  const sheet = getSheetByName('在场角色表');
  if (!sheet || sheet.content.length <= 1) {
    (window as any)._activeChar = null;
    return '';
  }

  let active = String((window as any)._activeChar || '');
  if (!active || findRowByColumn('在场角色表', '姓名', active) === -1) {
    active = getCellByHeader('在场角色表', 1, '姓名') || '';
  }
  (window as any)._activeChar = active || null;
  return active;
}

function buildIOSHero(config: StatusBarConfig): string {
  const location = readGlobal('当前详细地点');
  const currentTime = readGlobal('当前时间');
  const protagonist = readProtagonist('姓名') || '主角';
  const status = readProtagonist('近况');
  const energy = readProtagonist('瑟瑟能量') || '0';

  let html = '<header class="ios-card ios-hero" data-ub-section="head">';
  html += '<div class="ios-hero-top">';
  html += '<div class="ios-hero-id">';
  html += buildProtagonistPortraitBoxHtml();
  html += '<div class="ios-hero-copy">';
  html += '<div class="ios-hero-name-row">';
  html += '<button class="ios-hero-name" data-clickable="char-name" type="button">' + escapeHtml(protagonist) + '</button>';
  html += '</div>';
  if (status) html += '<div class="ios-hero-status">' + escapeHtml(status) + '</div>';
  html += cyclePhaseBar(protagonist, 'ios', PROTAGONIST_CYCLE_SECTION);
  html += buildWardrobeSummary('ios', config);
  html += '</div></div>';

  html += '<div class="ios-hero-controls">';
  html += buildSceneButton('ios', config);
  html += '<button class="ios-icon-btn" id="ac-theme-btn" type="button" title="深浅色切换">' + (config.darkTheme ? '浅色' : '深色') + '</button>';
  if (config.achievementEnabled) {
    html += '<button class="ios-icon-btn" id="ac-achievement-btn" type="button" title="成就系统">' + ubIcon('medal') + '</button>';
  }
  if (config.dbViewerEnabled) {
    html += '<button class="ios-icon-btn" id="ac-database-btn" type="button" title="数据库">' + ubIcon('database') + '</button>';
  }
  html += '<button class="ios-icon-btn" id="ac-settings-btn" type="button" title="设置">' + ubIcon('gear') + '</button>';
  html += '</div></div>';

  html += '<div class="ios-hero-meta">';
  if (location) {
    html += '<button class="ios-chip"' + (config.mapEnabled ? ' id="ac-location-btn"' : '') + ' type="button" title="当前地点">'
      + '<span class="label">地点</span><b>' + escapeHtml(location) + '</b></button>';
  }
  if (currentTime) {
    html += '<button class="ios-chip book-head-time" type="button" title="打开日历"><span class="label">时间</span><b>' + escapeHtml(currentTime) + '</b>' + buildWeatherIconHTML(15) + '</button>';
  }
  html += '<span class="ios-chip is-accent"><b>' + ubIcon('bolt') + escapeHtml(energy) + '</b></span>';
  buildIOSCurrencyChips(config, (frag) => { html += frag; });  html += buildIOSActions(config);
  html += '</div></header>';
  return html;
}

/** 货币 chip（货币系统开启时；空态虚线引导、负余额红显、多币种折叠；点击开货币弹窗）。 */
function buildIOSCurrencyChips(config: StatusBarConfig, push: (frag: string) => void): void {
  if (!config.currencyEnabled) return;
  const data = currencyDataSnapshot();
  if (!data.currencies.length) {
    push('<button class="ios-chip is-currency-empty" id="ac-currency-chip" type="button" title="货币系统：点击生成币种">' + currencyIconSvg('coin', 14) + '暂无货币</button>');
    return;
  }
  const common = data.currencies.find(c => c.id === data.commonId) || data.currencies[0];
  const qty = data.balances[common.id] ?? 0;
  push('<button class="ios-chip is-currency' + (qty < 0 ? ' neg' : '') + '" id="ac-currency-chip" type="button" title="' + escapeHtml(common.name) + '（点击打开钱包）">'
    + currencyIconSvg(common.icon, 14) + fmtQtyShort(common.precision, qty) + '</button>');
  if (data.currencies.length > 1) {
    push('<button class="ios-chip is-currency-more" id="ac-currency-more" type="button" title="打开钱包查看全部币种">+' + (data.currencies.length - 1) + ' 币种</button>');
  }
}

function buildIOSActions(config: StatusBarConfig): string {  // 快捷 pill 行并入主角卡 chips 同行右侧（原独立卡片删除省一行空间）；单实例渲染，
  // PC 靠右+宽度不够换行、移动端经 MQ 转整行横滚，事件委托/徽章注入均按 ID 不受位置影响。
  let html = '<nav class="ios-hero-actions" aria-label="快捷入口">';
  // 商店按开关条件输出（同 interview 惯例；仅靠内联 display 会在重建后丢失，2026-10-05 修复）
  if (config.shopEnabled) html += '<button class="ios-action is-primary" id="ac-lottery-head-btn" type="button">' + ubIcon('bag') + '商店</button>';
  html += '<button class="ios-action" id="ac-item-head-btn" type="button">' + ubIcon('pack') + '物品</button>';
  html += buildWardrobeButton('ios', config);
  html += '<button class="ios-action" id="ac-mission-head-btn" type="button">' + ubIcon('clipboard') + '任务</button>';
  html += '<button class="ios-action" id="ac-memo-head-btn" type="button">' + ubIcon('memo') + '备忘</button>';
  html += buildSkillButton('ios', config);
  html += '<button class="ios-action" id="ac-chronicle-btn" type="button">' + ubIcon('book') + '回顾</button>';
  html += '</nav>';
  return html;
}

function buildIOSPeople(activeCharacter: string): string {
  const sheet = getSheetByName('在场角色表');
  const count = sheet ? sheet.content.length - 1 : 0;
  let html = '<section class="ios-people" data-ub-section="tabs">';
  if (count <= 0) {
    html += '<div class="ios-card"><div class="ios-empty">暂无在场角色</div></div></section>';
    return html;
  }

  html += '<div class="ios-persona-track" role="tablist">';
  for (let row = 1; row <= count; row++) {
    const name = getCellByHeader('在场角色表', row, '姓名');
    if (!name) continue;
    const isActive = name === activeCharacter && !beyondViewActive();
    html += '<button class="tab ios-persona-chip' + (isActive ? ' active' : '') + '" data-char="' + escapeHtml(name) + '" type="button" role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '">' + escapeHtml(name) + '</button>';
  }
  html += buildBeyondTabButton('ios', beyondViewActive(), beyondAvailable());
  html += '</div></section>';
  return html;
}

function iosRow(label: string, value: string): string {
  if (!value) return '';
  return '<div class="ios-row"><span class="k">' + escapeHtml(label) + '</span><span class="v">' + escapeHtml(value) + '</span></div>';
}

function buildIOSProfile(config: StatusBarConfig, activeCharacter: string): string {
  if (beyondViewActive()) {
    return '<section class="ios-card ios-profile" data-ub-section="profile">'
      + buildBeyondLensHtml('ios', loadWorldState(), getTodayDateKey() || '', beyondBatchNames())
      + '</section>';
  }
  if (!activeCharacter) {
    return '<section class="ios-card ios-profile" data-ub-section="profile"><div class="ios-empty">尚未聚焦任何角色</div></section>';
  }

  const profile = getCharProfile(activeCharacter);
  if (!profile) {
    return '<section class="ios-card ios-profile" data-ub-section="profile"><div class="ios-empty">角色档案尚未建立</div></section>';
  }

  const moodClass = cycleMoodVariantClass(activeCharacter);
  let html = '<section class="ios-card ios-profile">';

  html += '<div class="ios-profile-head">';
  html += buildPortraitBoxHtml(activeCharacter);
  html += '<div class="ios-profile-id" data-ub-section="chartext">';
  html += '<button class="ios-profile-name" id="ac-char-name" type="button">' + escapeHtml(activeCharacter) + '</button>';
  if (profile.basicInfo) html += '<span class="ios-profile-sub">' + escapeHtml(profile.basicInfo) + '</span>';
  if (profile.charRelation) html += charRelationPillHtml(activeCharacter, profile.charRelation);
  html += '<span class="ios-mood ' + moodClass + '">' + escapeHtml(profile.emotionRaw || '状态未知') + '</span>';
  html += '</div></div>';

  html += '<div class="ios-profile-actions" data-ub-section="charactions">';
  if (config.investigationEnabled) html += '<button class="ios-act-btn is-primary ub-lp-hint" id="ac-investigate-btn" data-name="' + escapeHtml(activeCharacter) + '" type="button">深度调查</button>';
  if (config.interviewEnabled) {
    html += '<button class="ios-act-btn interview-btn" id="ac-interview-btn" data-name="' + escapeHtml(activeCharacter) + '" type="button">采访档案</button>';
  }
  html += buildPastExpButton(activeCharacter, '过往记录');
  html += '<button class="ios-act-btn" id="ac-diary-btn" type="button">私人日记</button>';
  html += '</div>';

  html += '<div class="ios-group-title">角色动态</div>';
  html += '<div class="ios-list" data-ub-section="chardynamics">';
  html += iosRow('当前状态', profile.charCurrentStatus);
  html += iosRow('下一步打算', profile.charIntention);
  html += iosRow('内心想法', profile.charInnerThought);
  if (!profile.charCurrentStatus && !profile.charRelation && !profile.charIntention && !profile.charInnerThought) {
    html += '<div class="ios-empty">暂无动态数据</div>';
  }
  html += '</div>';

  html += '<div class="ios-meter" data-ub-section="chartrain">';
  html += '<span class="ios-meter-label">调教值</span>';
  html += '<div class="ios-meter-track"><div class="ios-meter-fill" style="width:' + profile.trainPercent + '%"></div></div>';
  html += '<span class="ios-meter-val">' + profile.trainValue + '/' + profile.maxTrainValue + '</span>';
  html += '</div>';
  html += cyclePhaseBar(activeCharacter, 'ios');

  html += '<div class="ios-seg-controls" data-ub-section="charswitch">';
  html += '<button class="ios-seg-btn active-switch" id="ac-switch-clothes" type="button">装束</button>';
  html += '<button class="ios-seg-btn" id="ac-switch-body" type="button">生理状态</button>';
  html += '</div>';

  html += '<div class="ios-list" data-ub-section="charclothes" id="ac-clothes-list">';
  if (profile.currentOutfit) html += iosRow('当前穿搭', profile.currentOutfit);
  for (const [label, value] of profile.clothesEntries) html += iosRow(label, value);
  if (!profile.currentOutfit && profile.clothesEntries.length === 0) html += '<div class="ios-empty">未记录装束</div>';
  html += '</div>';

  html += '<div class="ios-list" data-ub-section="charbody" id="ac-body-list" style="display:none;">';
  for (const [label, value] of profile.bodyEntries) html += iosRow(label, value);
  if (profile.bodyEntries.length === 0) html += '<div class="ios-empty">暂无生理记录</div>';
  html += '</div>';

  html += '</section>';
  return html;
}

function buildIOSPlay(config: StatusBarConfig): string {
  let html = '<section class="ios-card ios-play' + (config.playCollapsed ? ' collapsed' : '') + '" id="ac-play-section" data-ub-section="play">';
  html += '<div class="ios-play-head">';
  html += '<div class="ios-play-title">互动玩法<small>' + (config.playCollapsed ? '已收起' : '进行中') + '</small></div>';
  html += '<button class="play-collapse-btn" id="ac-play-collapse-btn" type="button" title="折叠">' + (config.playCollapsed ? '+' : '−') + '</button>';
  html += '<button class="nsfw-guidance-btn ub-lp-hint" id="ac-nsfw-guidance-btn" type="button">指导</button>';
  html += '<button class="item-use-toggle" id="ac-item-use-toggle" type="button">物品使用 OFF</button>';
  html += '<button class="ios-act-btn" id="ac-play-clear-btn" type="button">清空</button>';
  html += '</div>';

  html += '<div class="ios-play-grid">';
  html += buildPlayChipsBlock('未选择玩法');
  html += '</div></section>';
  return html;
}

export function buildIOSHTML(): string {
  const config = getConfig();
  const activeCharacter = resolveActiveCharacter();
  const stateClasses = (config.darkTheme ? ' dark-mode' : '') + (isNsfwPlayActive() ? ' nsfw-border' : '');

  return [
    '<div class="ios-shell book' + stateClasses + '" id="ac-book">',
    aiActivityBarHtml(),
    buildIOSHero(config),
    buildIOSPeople(activeCharacter),
    buildIOSProfile(config, activeCharacter),
    config.nsfwPlayEnabled ? buildIOSPlay(config) : '',
    buildOptionsBar('ios'),
    '</div>',
  ].join('');
}
