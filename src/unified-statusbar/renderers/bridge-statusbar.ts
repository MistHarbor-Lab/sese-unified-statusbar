// ===== 深空舰桥主状态栏 =====
import { getCellByHeader, getSheetByName, findRowByColumn, isNsfwPlayActive } from '../core/data-manager';
import { getConfig, type StatusBarConfig } from '../core/config-store';
import { walletEntryHtml } from './currency-entry';
import { aiActivityBarHtml } from './ai-activity-bar';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 08 待修：同上（主题状态栏从 html-builder 取共享零件，html-builder 又反向装配本文件）
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

function isNsfwScene(): boolean {
  return isNsfwPlayActive();
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

function buildBridgeCommandHeader(config: StatusBarConfig): string {
  const location = readGlobal('当前详细地点') || '坐标未标定';
  const currentTime = readGlobal('当前时间') || '时间链路未同步';
  const protagonist = readProtagonist('姓名') || '主角';
  const status = readProtagonist('近况') || '生命体征稳定';
  const energy = readProtagonist('瑟瑟能量') || '0';

  let html = '<header class="bridge-command-header bridge-module" data-ub-section="cmdheader">';
  html += '<div class="bridge-command-identity">';
  html += '<span class="bridge-kicker">UNIFIED COMMAND / 统一指挥</span>';
  html += '<div class="bridge-protagonist-row">';
  html += buildProtagonistPortraitBoxHtml();
  html += '<button class="bridge-protagonist-name" data-clickable="char-name" type="button">' + escapeHtml(protagonist) + '</button>';
  html += '<span class="bridge-status-chip">同步在线</span>';
  html += '</div>';
  html += '<div class="bridge-command-status">' + escapeHtml(status) + '</div>';
  html += cyclePhaseBar(protagonist, 'bridge', PROTAGONIST_CYCLE_SECTION);
  html += buildWardrobeSummary('bridge', config);
  html += '</div>';

  html += '<div class="bridge-command-telemetry">';
  html += '<button class="bridge-coordinate"' + (config.mapEnabled ? ' id="ac-location-btn"' : '') + ' type="button">';
  html += '<span class="bridge-en-label">NAV COORD</span><strong>' + escapeHtml(location) + '</strong>';
  html += '</button>';
  html += '<button class="book-head-time bridge-clock" type="button">';
  html += '<span class="bridge-en-label">CHRONO</span><strong>' + escapeHtml(currentTime) + '</strong>' + buildWeatherIconHTML(18);
  html += '</button>';
  html += '<div class="bridge-energy"><span class="bridge-en-label">CORE LOAD</span><strong>' + escapeHtml(energy) + '</strong></div>';
  html += walletEntryHtml('bridge');
  html += '</div>';

  html += '<div class="bridge-system-controls">';
  html += buildSceneButton('bridge', config);
  html += '<button class="bridge-btn" id="ac-theme-btn" type="button">' + (config.darkTheme ? '晨雾模式' : '深空模式') + '</button>';
  if (config.achievementEnabled) {
    html += '<button class="bridge-btn" id="ac-achievement-btn" type="button" title="成就系统">勋章</button>';
  }
  if (config.dbViewerEnabled) {
    html += '<button class="bridge-btn" id="ac-database-btn" type="button" title="数据库">数据库</button>';
  }
  html += '<button class="bridge-btn" id="ac-settings-btn" type="button" title="设置">系统</button>';
  html += '</div>';
  html += '</header>';
  return html;
}

function buildBridgeQuickActions(config: StatusBarConfig): string {
  let html = '<nav class="bridge-quick-actions bridge-module" data-ub-section="quick" aria-label="舰桥快捷指令">';
  html += '<span class="bridge-kicker">QUICK COMMANDS</span>';
  html += '<div class="bridge-action-cluster">';
  // 商店按开关条件输出（同 interview 惯例；仅靠内联 display 会在重建后丢失，2026-10-05 修复）
  if (config.shopEnabled) html += '<button class="bridge-btn is-primary" id="ac-lottery-head-btn" type="button">补给商店</button>';
  html += '<button class="bridge-btn" id="ac-item-head-btn" type="button">随身物品</button>';
  html += buildWardrobeButton('bridge', config);
  html += '<button class="bridge-btn" id="ac-mission-head-btn" type="button">任务队列</button>';
  html += '<button class="bridge-btn" id="ac-memo-head-btn" type="button">备忘记录</button>';
  html += buildSkillButton('bridge', config);
  html += '<button class="bridge-btn" id="ac-chronicle-btn" type="button">剧情回顾</button>';
  html += '</div>';
  html += '</nav>';
  return html;
}

function buildBridgeCharacterChannels(activeCharacter: string): string {
  const sheet = getSheetByName('在场角色表');
  const count = sheet ? sheet.content.length - 1 : 0;
  if (count <= 0) {
    return '<section class="bridge-character-channels bridge-module" data-ub-section="channels"><span class="bridge-kicker">PERSONNEL CHANNELS</span><div class="bridge-empty">未侦测到在场角色</div></section>';
  }

  let html = '<section class="bridge-character-channels bridge-module" data-ub-section="channels">';
  html += '<div class="bridge-channel-heading"><span class="bridge-kicker">PERSONNEL CHANNELS</span><span class="bridge-muted">' + count + ' 路信号</span></div>';
  html += '<div class="bridge-role-selector" role="tablist">';
  for (let row = 1; row <= count; row++) {
    const name = getCellByHeader('在场角色表', row, '姓名');
    if (!name) continue;
    const isActive = name === activeCharacter && !beyondViewActive();
    html += '<button class="tab bridge-role-chip' + (isActive ? ' active' : '') + '" data-char="' + escapeHtml(name) + '" type="button" role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '">';
    html += '<span class="bridge-role-index">' + String(row).padStart(2, '0') + '</span><span>' + escapeHtml(name) + '</span>';
    html += '</button>';
  }
  html += buildBeyondTabButton('bridge', beyondViewActive(), beyondAvailable());
  html += '</div>';
  html += '</section>';
  return html;
}

function buildBridgeTelemetryItem(label: string, english: string, value: string): string {
  return '<div class="bridge-telemetry-item">'
    + '<span class="bridge-en-label">' + english + '</span>'
    + '<span class="bridge-telemetry-label">' + label + '</span>'
    + '<div class="bridge-readout">' + (value ? escapeHtml(value) : '<span class="bridge-muted">暂无数据</span>') + '</div>'
    + '</div>';
}

function buildBridgeDetailLists(activeCharacter: string): string {
  const profile = getCharProfile(activeCharacter);
  if (!profile) return '<div class="bridge-empty">人员档案未建立</div>';

  let html = '<div class="bridge-detail-console" data-ub-section="bridge-details">';
  html += '<div class="bridge-detail-tabs">';
  html += '<button class="bridge-btn active-switch" id="ac-switch-clothes" type="button">装束扫描</button>';
  html += '<button class="bridge-btn" id="ac-switch-body" type="button">生理遥测</button>';
  html += '</div>';

  html += '<div class="bridge-detail-list" id="ac-clothes-list">';
  if (profile.currentOutfit) {
    html += buildBridgeTelemetryItem('当前穿搭', 'CURRENT OUTFIT', profile.currentOutfit);
  }
  for (const [label, value] of profile.clothesEntries) {
    html += buildBridgeTelemetryItem(label, 'APPAREL', value);
  }
  if (!profile.currentOutfit && profile.clothesEntries.length === 0) {
    html += '<div class="bridge-empty">未获取装束数据</div>';
  }
  html += '</div>';

  html += '<div class="bridge-detail-list" id="ac-body-list" style="display:none;">';
  for (const [label, value] of profile.bodyEntries) {
    html += buildBridgeTelemetryItem(label, 'BIOMETRIC', value);
  }
  if (profile.bodyEntries.length === 0) {
    html += '<div class="bridge-empty">未获取生理遥测</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function buildBridgePersonnelGrid(config: StatusBarConfig, activeCharacter: string): string {
  if (beyondViewActive()) {
    return buildBeyondLensHtml('bridge', loadWorldState(), getTodayDateKey() || '', beyondBatchNames());
  }
  if (!activeCharacter) {
    return '<section class="bridge-personnel-grid bridge-module" data-ub-section="personnel"><div class="bridge-empty">人员频道离线 / NO ACTIVE PERSONNEL</div></section>';
  }

  const profile = getCharProfile(activeCharacter);
  if (!profile) {
    return '<section class="bridge-personnel-grid bridge-module" data-ub-section="personnel"><div class="bridge-stale">人员索引存在，但档案数据尚未同步</div></section>';
  }

  const moodClass = cycleMoodVariantClass(activeCharacter);
  // F53(第十二轮)：personnel 大分区退役——它内部嵌着 charportrait（buildPortraitBoxHtml 自带）与
  // charcycle（cyclePhaseBar 自带），而嵌套分区无效（外层替换连带销毁内层）⇒ 每次角色状态更新立绘重解码闪烁。
  // 改法=section 与两列 div 只作静态外壳，把**每一块会变的内容**提成平级子分区；
  // 漏一块=该块永不更新，故逐块补齐（identity / actions / telemetry / train / details）。
  let html = '<section class="bridge-personnel-grid bridge-status-layout">';
  html += '<div class="bridge-personnel-portrait bridge-module">';
  html += '<span class="bridge-kicker">VISUAL FEED</span>';
  html += buildPortraitBoxHtml(activeCharacter);
  html += '<div class="bridge-personnel-identity" data-ub-section="bridge-identity">';
  html += '<button class="bridge-personnel-name" id="ac-char-name" type="button">' + escapeHtml(activeCharacter) + '</button>';
  if (profile.basicInfo) html += '<span class="bridge-muted">' + escapeHtml(profile.basicInfo) + '</span>';
  if (profile.charRelation) html += charRelationPillHtml(activeCharacter, profile.charRelation);
  html += '<span class="bridge-status-chip ' + moodClass + '">' + escapeHtml(profile.emotionRaw || '状态未知') + '</span>';
  html += '</div>';
  html += '<div class="bridge-personnel-actions" data-ub-section="bridge-actions">';
  if (config.investigationEnabled) html += '<button class="bridge-btn ub-lp-hint" id="ac-investigate-btn" data-name="' + escapeHtml(activeCharacter) + '" type="button">深度调查</button>';
  if (config.interviewEnabled) {
    html += '<button class="bridge-btn interview-btn" id="ac-interview-btn" data-name="' + escapeHtml(activeCharacter) + '" type="button">采访档案</button>';
  }
  html += buildPastExpButton(activeCharacter, '过往记录');
  html += '<button class="bridge-btn" id="ac-diary-btn" type="button">私人日记</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="bridge-personnel-telemetry bridge-module">';
  html += '<div class="bridge-module-title">人员遥测 <span class="bridge-en-label">PERSONNEL TELEMETRY</span></div>';
  html += '<div class="bridge-telemetry-grid" data-ub-section="bridge-telemetry">';
  html += buildBridgeTelemetryItem('当前状态', 'CURRENT STATE', profile.charCurrentStatus);
  html += buildBridgeTelemetryItem('下一步打算', 'INTENT', profile.charIntention);
  html += buildBridgeTelemetryItem('内心想法', 'INNER SIGNAL', profile.charInnerThought);
  html += '</div>';
  html += '<div class="bridge-train-row" data-ub-section="bridge-train">';
  html += '<span class="bridge-en-label">SYNC / 调教值</span>';
  html += '<div class="bridge-meter"><span style="width:' + profile.trainPercent + '%"></span></div>';
  html += '<strong>' + profile.trainValue + '/' + profile.maxTrainValue + '</strong>';
  html += '</div>';
  html += cyclePhaseBar(activeCharacter, 'bridge');
  html += buildBridgeDetailLists(activeCharacter);
  html += '</div>';
  html += '</section>';
  return html;
}

function buildBridgeProtocol(config: StatusBarConfig): string {
  let html = '<section class="bridge-protocol bridge-module' + (config.playCollapsed ? ' collapsed' : '') + '" id="ac-play-section" data-ub-section="protocol">';
  html += '<div class="bridge-protocol-head">';
  html += '<div><span class="bridge-kicker">INTIMACY PROTOCOL</span><div class="bridge-module-title">互动协议矩阵</div></div>';
  html += '<div class="bridge-protocol-controls">';
  html += '<button class="bridge-btn ub-lp-hint" id="ac-nsfw-guidance-btn" type="button">策略指导</button>';
  html += '<button class="bridge-btn" id="ac-item-use-toggle" type="button">物品使用 OFF</button>';
  html += '<button class="bridge-btn" id="ac-play-collapse-btn" type="button" title="折叠">' + (config.playCollapsed ? '+' : '−') + '</button>';
  html += '<button class="bridge-btn is-danger" id="ac-play-clear-btn" type="button">清空协议</button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="bridge-protocol-grid">';
  html += buildPlayChipsBlock('未选择协议');
  html += '</div>';
  html += '</section>';
  return html;
}

export function buildBridgeHTML(): string {
  const config = getConfig();
  const activeCharacter = resolveActiveCharacter();
  const stateClasses = (config.darkTheme ? ' dark-mode' : '') + (isNsfwScene() ? ' nsfw-border' : '');

  return [
    '<div class="bridge-container book' + stateClasses + '" id="ac-book">',
    aiActivityBarHtml(),
    buildBridgeCommandHeader(config),
    buildBridgeQuickActions(config),
    buildBridgeCharacterChannels(activeCharacter),
    buildBridgePersonnelGrid(config, activeCharacter),
    config.nsfwPlayEnabled ? buildBridgeProtocol(config) : '',
    buildOptionsBar('bridge'),
    '</div>',
  ].join('');
}
