
// ===== 配置面板 =====
import { ubIcon } from '../core/icons';
import { UB_EVENT, emitUbEvent } from '../core/events';
import { sv, escAttr as _escAttr } from './config-panel-shared';
import { bindApiTab } from './config-panel-tabs/api-tab';
import { bindImagePromptBoard, renderImagePromptBoard } from './config-panel-tabs/image-prompt-board';
import { readChatu8Import } from '../core/chatu8-import';
import { renderTablesTab } from './config-panel-tables';
import { getConfig, normalizeImageGenerationIntervalSeconds, normalizeWardrobeModelTags, setConfig, type StatusBarConfig } from '../core/config-store';
import { normalizeImageGenerationConfig, resolveImageTaskConfig, resolvePromptPresetSlice, type ImageTaskType } from '../core/image-generation-config';
import { ensureSkillTable, setSkillTableEnabled } from '../core/skill-table-ensure';
import { ensureSkillRegexInjection, removeSkillRegexScripts } from '../core/skill-regex';
import { type StyleType, type AiRetryScope, STYLE_LABELS, type PositionMode, type WidthMode, type CollapseBtnStyle, COLLAPSE_BTN_STYLE_LABELS, POSITION_LABELS, WIDTH_LABELS, CUSTOM_HEIGHT_DEFAULT, CUSTOM_SIZE_PERCENT_MIN, INVESTIGATION_DEFAULT_CONTEXT_COUNT, type SceneApiPreset, type SceneProfile, PROMPT_POST_PROCESSING_OPTIONS, PROMPT_POST_PROCESSING_DEFAULT, GACHA_COST, GACHA10_COST, PORTRAIT_DEFAULT_CONTEXT_COUNT } from '../core/constants';
import { NOVELAI_MODELS, NOVELAI_SAMPLERS, NOVELAI_SCHEDULERS, ASPECT_RATIO_OPTIONS, UC_PRESET_OPTIONS, RESOLUTION_PRESETS, normalizePortraitImageGen, DEFAULT_PROMPT_PRESET_ID, getDefaultPromptPresets, normalizePromptPresets, resolveActivePreset, applyPresetToConfig, applyPresetOpenAiToConfig, applyPresetComfyToConfig, nextPresetId, resolvePresetNovelAiParams, resolvePresetOpenAiParams, resolvePresetComfyUiParams, buildPresetNovelAiParamsFrom, buildPresetOpenAiParamsFrom, buildPresetComfyUiParamsFrom, normalizePresetNovelAiParams, normalizePresetOpenAiParams, normalizePresetComfyUiParams, type PortraitApiFormat, type PortraitPromptPreset } from '../core/portrait-config';
import { generateImage } from '../core/image-gen';
import { chatu8ModeLabel, chatu8HasGenerator, chatu8StatusNote, chatu8FormatNote, ensureChatu8Model, getChatu8BackendModel, getChatu8Models, getChatu8Mode, setChatu8Model } from '../core/chatu8-bridge';
import { baibaiStatusNote, baibaiFormatNote, baibaiPluginReady } from '../core/baibai-bridge';
import { getToastr } from '../core/env';
import { openLedgerWorkbench, missingTableRepairHint, isLedgerTakeover } from '../core/ledger-takeover';
import { escapeHtml, escapeAttr } from '../core/html-escape'; // U2：转义统一出口
import { resolveActiveComfyWorkflow, normalizeComfyWorkflowPresets, getDefaultComfyUiConfig, nextComfyWorkflowId, computeComfyFingerprint, DEFAULT_COMFY_WORKFLOW_JSON, DEFAULT_COMFY_WORKFLOW_ID } from '../core/portrait-config';
import { fetchComfyObjectInfo } from '../core/comfyui-client';
import { isTavernHelperAvailable } from '../core/scene-switcher';
import { disablePlayWorldbook, disableItemUseEntries, syncPlayWorldbook, syncItemUseEntries, resetPlayWorldbookCache } from '../core/play-worldbook';
import { resetTimeAnchors, deleteTimeAnchors } from '../core/time-anchor';
import { helpTipButton, syncDarkClass, syncDarkClassMinimal, releaseBackGuardIfIdle, bridgeWindowClass, refreshPlayChipsUI } from '../renderers/html-builder';
import { flashInlineHint } from '../renderers/effects';
import { setPanelColorMode, resyncOpenOverlays } from '../renderers/panel-color-mode';
import { showConfirmDialog, showPromptDialog, openDialog, closeDialog } from '../renderers/confirm-dialog';
import { showStoryImageGalleryPopup } from '../renderers/story-image-gallery';
import { cardEntryBlacklistSummaryText, ensureCardEntryBlacklistStyles } from '../renderers/card-entry-blacklist-popup';
import { hasCharacterCardContext } from '../core/card-variable-store';
import { getCurrentCardName } from '../core/current-card';
import { refreshStoryImageFloorButtons } from '../renderers/story-image-floor-button';
import { applyStoryImageHostWidth } from '../renderers/story-image-text-viewer';
import { pruneStoryImagesOutsideRenderWindow } from '../core/story-image-engine';
import { deleteCalendarWBEntries } from '../core/calendar-core';
import { resetCycleWorldbookCache, resetPregnancyWorldbookCache } from '../core/cycle-worldbook';
import { setWorldbookProjectionEnabled } from '../core/worldbook-projection-runtime';
import { ensureCurrencyRegexInjection, removeCurrencyRegexScripts } from '../core/currency-regex';
import { requestWorldbookProjection } from '../core/worldbook-projection-events';
import { resetWorldEvolution } from '../core/world-engine/world-worldbook';
import {
  hasWorldEvolveStyle, isWorldEvolveCustomKey, nextWorldEvolveStyleId,
  normalizeWorldEvolveStyleLibrary, planWorldEvolveStyleMigration, readCardWorldEvolveStyle,
  worldEvolveCustomEntryId, worldEvolveCustomKey, writeCardWorldEvolveStyle,
  WORLD_EVOLVE_LIBRARY_MAX, WORLD_EVOLVE_STYLE_NAME_MAX, WORLD_EVOLVE_STYLE_TEXT_MAX,
  type WorldEvolveStyleEntry,
} from '../core/world-engine/world-style-library';
import { handleCycleTick } from '../core/cycle-engine';
import { resetAchievements as resetAchievementStore } from '../core/achievement-store';
import { resetSession as resetAchievementSession } from '../core/achievement-engine';
import { resetShop } from '../core/shop-regular';
import { readTableStatuses, setTableClosed, fixInconsistent, getCloseImpact, setAllTableGroups } from '../core/table-manager';
import { ensureMiscTable } from '../core/misc-table-ensure';
import { syncMapOverviewToMiscTable } from '../core/map-overview-sync';
import { syncMapNodeWorldbookEntries } from '../core/map-worldbook-inject';
import {
  STATUSBAR_CONTENT_FONT_SCALE_DEFAULT,
  applyStatusbarContentFontScale,
  normalizeStatusbarContentFontScale,
} from '../core/statusbar-font-scale';
import {
  UI_FONT_SCALE_DEFAULT,
  applyUiFontScale,
  normalizeUiFontScale,
} from '../core/ui-font-scale';
import {
  getStatusbarStorageStatus,
  flushStatusbarStorage,
  manualBackupStory,
  resetCurrentChatStoryStorage,
  resetCurrentChatThoroughly,
  restoreStoryBackup,
  deleteStoryBackup,
  listStoryBackups,
} from '../core/storage-bootstrap';
import { getStoryFloorDiagnostics, hasRealCharacterContext } from '../core/story-floor-store';
import { invalidateCycleStoreCache } from '../core/cycle-store';
import { renderStorageMigrationPanel, type StorageHardResetUiState } from './storage-migration-panel';
import { runStorageHardReset } from '../core/storage-hard-reset';
import {
  nextCharacterWorldbookTemplateId,
  removeCharacterWorldbookTemplate,
  type CharacterWorldbookTemplate,
} from '../core/character-worldbook-config';

let _onConfigChanged: (() => void) | null = null;
let _backupListState: { backups: import('../core/story-backup-store').BackupMeta[]; ready: boolean } | null = null;
let _storageHardResetUi: StorageHardResetUiState = {};
let _storageThoroughResetUi: StorageHardResetUiState = {};

export function setConfigChangeCallback(cb: () => void): void {
  _onConfigChanged = cb;
}

/** 供非面板入口（如状态栏内配色切换按钮）在 setConfig 后触发与面板等同的全量重渲染链。 */
export function notifyConfigChanged(): void {
  if (_onConfigChanged) _onConfigChanged();
}

/** 重置悬浮按钮位置到屏幕正中间（防拖到看不见的地方找不到）。设置项「重置到屏幕中间」与 index.ts __ub_resetFloatBtn 桥共用此单一实现——UBS_phone 经桥找回拖出屏外的主项目按钮。
 *  重置对象=两颗悬浮按钮（齿轮 #ac-persistent-settings + 固定模式折叠按钮 #ac-fixed-toggle）：
 *  本设置项挂在「悬浮配置按钮显示」（齿轮开关）正下方，帮助文案也是「找回被拖到看不见的按钮」，
 *  旧实现只重置折叠按钮、齿轮零恢复出口（拖拽/恢复无钳制年代=用户反馈「拖出屏外找不回」的直接成因）。 */
export function resetFloatingBtnToCenter(): void {
  try {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let resetCount = 0;
    // 齿轮：固定 44×44
    const gearBtn = document.getElementById('ac-persistent-settings');
    if (gearBtn) {
      const gx = Math.round(vw / 2 - 22);
      const gy = Math.round(vh / 2 - 22);
      try { localStorage.setItem('statusbar-gear-pos', JSON.stringify({ x: gx, y: gy })); } catch (_e) { /* ignore */ }
      gearBtn.style.left = gx + 'px';
      gearBtn.style.top = gy + 'px';
      gearBtn.style.right = 'auto';
      gearBtn.style.bottom = 'auto';
      resetCount++;
    }
    // 折叠按钮：尺寸随模式变化（36/40px/时间窗药丸），取实际尺寸；取不到按 40 估算
    const ftBtn = document.getElementById('ac-fixed-toggle');
    if (ftBtn) {
      const rect = ftBtn.getBoundingClientRect();
      const bw = rect ? rect.width : 40;
      const bh = rect ? rect.height : 40;
      const cx = Math.round(vw / 2 - bw / 2);
      const cy = Math.round(vh / 2 - bh / 2);
      try { localStorage.setItem('statusbar-fixed-btn-pos', JSON.stringify({ x: cx, y: cy })); } catch (_e) { /* ignore */ }
      ftBtn.style.left = cx + 'px';
      ftBtn.style.top = cy + 'px';
      ftBtn.style.right = 'auto';
      ftBtn.style.bottom = 'auto';
      resetCount++;
    }
    if (resetCount > 0) getToastr()?.success('悬浮按钮已重置到屏幕正中间', '悬浮按钮');
    else getToastr()?.error('未找到可重置的悬浮按钮', '悬浮按钮');
  } catch (_e) {
    getToastr()?.error('重置失败', '悬浮按钮');
  }
}


/** ComfyUI 工作流可用占位符清单：默认折叠的 details，展开才占空间，无 JS 无开销 */
function comfyPlaceholderListHtml(): string {
  const rows: Array<[string, string]> = [
    ['%prompt% / %positive_prompt%', '正向提示词'],
    ['%negative_prompt%', '负面提示词'],
    ['%seed%', '随机种子（数字）'],
    ['%width% / %height%', '宽 / 高'],
    ['%steps% / %cfg%', '步数 / CFG'],
    ['%sampler_name% / %scheduler%', '采样器 / 调度器'],
    ['%MODEL_NAME% 或 %UNET_NAME%、%CKPT_NAME%', '模型名（Checkpoint/UNet 通用）'],
    ['%VAE% 或 %VAE_NAME%', 'VAE 名（VAELoader 的 vae_name 填此占位符）'],
    ['%CLIP_NAME%', 'CLIP 名'],
    ['%lora%', 'LoRA 名'],
  ];
  let html = '<details style="margin-top:4px;font-size:10px;">';
  html += '<summary style="cursor:pointer;opacity:.65;user-select:none;">可用占位符清单</summary>';
  html += '<div style="margin-top:4px;padding:6px;border-radius:4px;opacity:.85;line-height:1.7;font-family:monospace;">';
  for (const [token, desc] of rows) {
    html += '<div><b>' + _escAttr(token) + '</b> — ' + _escAttr(desc) + '</div>';
  }
  html += '<div style="opacity:.7;margin-top:2px;">大小写不敏感；精确占位符会保留数字类型，行内混写会转为字符串。</div>';
  html += '</div></details>';
  return html;
}

type UnifiedImageTaskType = ImageTaskType;

let _imageGenerationUiTask: UnifiedImageTaskType = 'portrait';

const IMAGE_TASK_UI_OPTIONS: Array<{ id: UnifiedImageTaskType; label: string; hint: string }> = [
  { id: 'portrait', label: '角色立绘', hint: '角色外观与情绪立绘' },
  { id: 'wardrobeItem', label: '衣柜单品', hint: '单件服饰透明/展示图' },
  { id: 'wardrobeOutfit', label: '衣柜套装', hint: '套装展示图（使用固定匿名模特）' },
  { id: 'mapScene', label: '地图场景', hint: '无人物环境场景图，默认 1216×832' },
  { id: 'itemOverview', label: '物品总览', hint: '仓库物品群静物陈列图，默认 1216×832' },
  { id: 'storyImage', label: '正文插图', hint: '正文精彩片段自动文生图，默认 1024×1024' },
];
/** 分段按钮选中态原地刷新：组内匹配 activeValue 的按钮加 .seg-active，其余移除。
 *  统一走类控制高亮（CSS 见 base.ts .seg-active），避免逐个内联 style 替换的补丁代码。 */
function renderUnifiedImageGenerationModule(
  config: ReturnType<typeof getConfig>,
  V: { bg: string; text: string; border: string },
): string {
  const ig = config.imageGeneration;
  const taskId = _imageGenerationUiTask;
  const task = ig.tasks[taskId];
  const provider = ig.provider;
  const activePreset = resolveActivePreset(ig.promptPresets, task.promptPresetId);
  // 高级参数渲染源 = 任务激活预设的切片；防御性回退到 provider 全局（归一化迁移后切片恒存在）
  const naiParams = resolvePresetNovelAiParams(activePreset, provider.novelai);
  const oaiParams = resolvePresetOpenAiParams(activePreset, provider.openai);
  const comfyParams = resolvePresetComfyUiParams(activePreset, provider.comfyui);
  const col = 'flex-direction:column;align-items:flex-start;gap:4px;';
  const lbl = 'font-size:11px;';
  const muted = 'font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));';
  const inp = 'width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;box-sizing:border-box;';
  const sel = 'width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;';
  const ta = 'width:100%;min-height:48px;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;box-sizing:border-box;resize:vertical;line-height:1.4;';
  const num = 'padding:4px 7px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;min-width:0;';
  const range = 'flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));min-width:0;';
  const esc = (value: unknown): string => _escAttr(String(value ?? ''));
  let html = '';

  html += '<details class="settings-section" id="unifiedImageGenerationSection">';
  const _imgApiTip = '统一生图 API 说明：\\n立绘、衣柜单品、衣柜套装、地图场景和物品总览共用同一套图片 API 连接与生成参数。\\n\\n【API 连接与通用参数】供应商、地址、密钥等五类任务共享。\\n【共享调度】五类任务共用同一个生图间隔，并统一计算排队。\\n【任务专属配置】每个任务可独立选择尺寸、宽高比与提示词预设，不影响上方连接。\\n【预设内容】提示词、高级参数与生图模型都属于预设：改动需点「保存到预设」才生效，切换预设整体加载（含模型）。';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">统一生图 API' + helpTipButton(_imgApiTip) + '</summary>';
  html += '<div class="feature-body ub-image-generation-module" id="unifiedImageGenerationBody" style="padding-top:8px;">';

  // —— API 连接与通用参数 ——
  html += '<div class="ub-api-subsection" id="imageApiConnectionGroup">';
  html += '<div class="ub-api-subsection-title">API 连接与通用参数</div><div class="ub-api-subsection-desc">以下连接和供应商参数对立绘、衣柜单品、衣柜套装与地图场景共用；超时等连接设置不属于任何预设。生图模型属于预设，在下方「预设内容」中按预设配置与切换。</div>';
  // 生图接口（统一生图最前端的顶层选项）：内置直连 ↔ 智慧姬（st-chatu8）↔ 柏宝绘（ST-BaiBai-Image），不从属于任何供应商
  const chatu8On = provider.openai.chatu8 === true;
  const baibaiOn = !chatu8On && provider.openai.baibai === true;
  const externalOn = chatu8On || baibaiOn;
  const chanTip = chatu8On
    ? esc(chatu8StatusNote())
    : baibaiOn
      ? esc(baibaiStatusNote())
      : '内置直连＝用下方「生图供应商」里配的 API 出图；智慧姬＝把生图转交酒馆里的智慧姬（st-chatu8）插件执行，地址/密钥/模型全用智慧姬里配的那套；柏宝绘＝把生图转交酒馆里的柏宝绘（ST-BaiBai-Image）插件执行，后端/模型/画师串/质量词/负面/尺寸全用柏宝绘「渠道」页配的那套。外部通道下本页连接配置暂不使用（保留不丢）；画风预设的前后缀/负面词/模型与出图参数也不生效（由插件接管），生图 AI 请求提示词与全局三项不受影响';
  html += '<div class="settings-row" style="' + col + '" id="imageChannelRow"><span class="settings-label">生图接口</span><div class="image-provider-switch">';
  html += '<button type="button" class="image-provider-btn' + (!externalOn ? ' active' : '') + '" data-image-channel="builtin">内置直连</button>';
  html += '<button type="button" class="image-provider-btn' + (chatu8On ? ' active' : '') + '" data-image-channel="chatu8">智慧姬（st-chatu8）</button>';
  html += '<button type="button" class="image-provider-btn' + (baibaiOn ? ' active' : '') + '" data-image-channel="baibai">柏宝绘（ST-BaiBai-Image）</button>';
  html += '</div><span style="' + muted + '">' + chanTip + '</span>';
  // 从智慧姬导入预设：把其当前模式的预设（前后缀/负面）与全局出图参数搬进本项目（供切回内置直连使用）
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;"><button type="button" id="imageImportFromChatu8Btn" class="settings-btn" style="font-size:11px;padding:4px 10px;line-height:1;">从智慧姬导入预设</button><span style="' + muted + '">读取智慧姬当前模式的预设与出图参数，生成一份本项目完整预设（用于切回内置直连；直连智慧姬时预设本就不生效）</span></div></div>';

  // 生图供应商（仅内置直连接口下渲染；外部通道（智慧姬/柏宝绘）下三类供应商失去意义，整行不显示）
  if (!externalOn) {
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">生图供应商</span><div class="image-provider-switch">';
    for (const option of [{ id: 'novelai', label: 'NovelAI' }, { id: 'openai', label: 'OpenAI 兼容' }, { id: 'comfyui', label: 'ComfyUI' }] as const) {
      const active = provider.apiFormat === option.id;
      html += '<button type="button" class="image-provider-btn' + (active ? ' active' : '') + '" data-provider="' + option.id + '">' + option.label + '</button>';
    }
    html += '</div></div>';
  }

  if (provider.apiFormat !== 'comfyui') {
    const commonUrl = provider.apiFormat === 'openai' ? provider.openai.url : provider.novelai.url;
    const commonKey = provider.apiFormat === 'openai' ? provider.openai.key : provider.novelai.key;
    const naiUrlTip = provider.apiFormat === 'novelai' && config.showHelpTips
      ? helpTipButton('NovelAI 官方或中转站地址均可：填 base 会自动拼接 /ai/generate-image 端点，直接粘贴完整端点地址则原样使用；首选地址失败时会自动改用去端点后缀的裸地址重试一次（兼容路径已路由好的中转站）。http 与 https 地址均可，但 https 酒馆页面无法请求 http 地址（浏览器混合内容限制）。')
      : '';
    // 外部通道开启时隐藏地址/密钥行（DOM 保留：表单采集器照常读值，内置配置不丢）
    html += '<div id="portraitCommonRow"' + (externalOn ? ' style="display:none"' : '') + '>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">API 地址' + naiUrlTip + '</span><input type="text" id="portraitUrl" value="' + esc(commonUrl) + '" style="' + inp + '"></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">API Key</span><input type="password" id="portraitKey" value="' + esc(commonKey) + '" style="' + inp + '"></div>';
    html += '</div>';
  }

  if (provider.apiFormat === 'comfyui') {
    const comfy = provider.comfyui;
    const workflows = comfy.workflows && comfy.workflows.length ? normalizeComfyWorkflowPresets(comfy.workflows, getDefaultComfyUiConfig().workflows) : getDefaultComfyUiConfig().workflows;
    const activeWorkflow = resolveActiveComfyWorkflow(workflows, comfy.activeWorkflowId);
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">ComfyUI 地址</span><input type="text" id="portraitUrl" value="' + esc(comfy.url) + '" placeholder="http://127.0.0.1:8188" style="' + inp + '"></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">工作流预设</span><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;width:100%;"><select id="portraitComfyWorkflowSelect" style="flex:1;min-width:120px;' + sel + '">' + workflows.map(wf => '<option value="' + esc(wf.id) + '"' + (wf.id === activeWorkflow.id ? ' selected' : '') + '>' + esc(wf.name) + '</option>').join('') + '</select><button type="button" id="portraitComfyWfNew" class="settings-btn" style="font-size:11px;padding:4px 8px;">新建</button><button type="button" id="portraitComfyWfRename" class="settings-btn" style="font-size:11px;padding:4px 8px;">改名</button><button type="button" id="portraitComfyWfDelete" class="settings-btn" style="font-size:11px;padding:4px 8px;">删除</button></div></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">工作流 JSON（含 %token%）</span><textarea id="portraitComfyWorkflow" rows="8" style="' + ta + 'font-family:monospace;font-size:10px;">' + esc(activeWorkflow.workflow) + '</textarea>' + comfyPlaceholderListHtml() + '</div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">请求超时（秒）</span><input type="number" id="portraitComfyTimeout" min="30" max="1800" value="' + comfy.timeoutSeconds + '" style="width:82px;' + num + '"></div>';
  }
  html += '</div>'; // end imageApiConnectionGroup

  // —— 共享调度 ——
  html += '<div class="ub-api-subsection" id="imageGenerationScheduleGroup">';
  html += '<div class="ub-api-subsection-title">共享调度</div><div class="ub-api-subsection-desc">六类图片任务共用同一个生图间隔，并统一计算排队。</div>';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">生图间隔（秒）' + (config.showHelpTips ? helpTipButton('立绘、衣柜单品、衣柜套装、地图场景、物品总览和正文插图共享同一个生图间隔，并统一计算排队。范围 0–120 秒，默认 45 秒。') : '') + '</span><input type="number" id="imageGenerationIntervalInput" min="0" max="120" step="1" value="' + ig.intervalSeconds + '" style="width:68px;' + num + '" /></div>';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">文生图图库' + (config.showHelpTips ? helpTipButton('浏览所有聊天自动生成的正文插图（全局共享，卡片带来源角色卡标签）；可放大左右滑动浏览、单张删除。') : '') + '</span><button type="button" class="settings-btn" id="storyImageGalleryBtnApi" style="font-size:11px;padding:5px 12px;line-height:1;white-space:nowrap;">打开图库</button></div>';
  html += '</div>';

  // —— 任务专属配置 ——
  html += '<div class="ub-api-subsection" id="imageTaskConfigGroup">';
  html += '<div class="ub-api-subsection-title">任务专属配置</div><div class="ub-api-subsection-desc">当前选择只影响下面的尺寸、宽高比与预设；任务尺寸不属于预设。</div>';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">当前生图任务</span><select id="imageGenerationTaskSelect" style="' + sel + '">';
  for (const option of IMAGE_TASK_UI_OPTIONS) html += '<option value="' + option.id + '"' + (option.id === taskId ? ' selected' : '') + '>' + option.label + ' — ' + option.hint + '</option>';
  html += '</select></div>';

  if (provider.apiFormat === 'novelai') {
    html += '<div class="settings-row" id="portraitSizeRow" style="' + col + '"><span class="settings-label">' + esc(taskId === 'mapScene' ? '地图场景尺寸' : taskId === 'itemOverview' ? '物品总览尺寸' : taskId === 'storyImage' ? '正文插图尺寸' : '当前任务尺寸') + '</span><select id="portraitSize" style="' + sel + '">';
    for (const group of RESOLUTION_PRESETS) {
      html += '<optgroup label="' + esc(group.label) + '">';
      for (const item of group.items) html += '<option value="' + item.w + 'x' + item.h + '"' + (task.width === item.w && task.height === item.h ? ' selected' : '') + '>' + esc(item.label) + '</option>';
      html += '</optgroup>';
    }
    html += '<option value="custom"' + (!RESOLUTION_PRESETS.some(g => g.items.some(item => item.w === task.width && item.h === task.height)) ? ' selected' : '') + '>自定义</option></select>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><input type="number" id="portraitWidth" min="64" step="64" value="' + task.width + '" style="width:72px;' + num + '"><span style="' + muted + '">×</span><input type="number" id="portraitHeight" min="64" step="64" value="' + task.height + '" style="width:72px;' + num + '"><span style="' + muted + '">需为 64 的倍数</span></div></div>';
  }
  if (provider.apiFormat === 'openai') {
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">当前任务宽高比</span><select id="portraitAspect" style="' + sel + '">' + ASPECT_RATIO_OPTIONS.map(a => '<option value="' + esc(a) + '"' + (task.aspectRatio === a ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select></div>';
  }
  if (provider.apiFormat === 'comfyui') {
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">当前任务尺寸</span><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><label>宽<input type="number" id="portraitComfyWidth" min="64" step="8" value="' + task.width + '" style="width:82px;' + num + '"></label><span style="' + muted + '">×</span><label>高<input type="number" id="portraitComfyHeight" min="64" step="8" value="' + task.height + '" style="width:82px;' + num + '"></label></div></div>';
  }

  // —— 生图 AI 请求提示词（独立板块：与预设解耦；智慧姬直连下仍生效）——
  html += renderImagePromptBoard();

  // —— 预设内容容器（提示词 + 高级参数全部随预设保存/加载）——
  html += '<div class="ub-preset-panel" id="ubPresetPanel"' + (externalOn ? ' style="opacity:.55;"' : '') + '">';
  html += '<div class="ub-preset-panel-title">预设内容' + (externalOn ? ' <span style="font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid #f0c36d;background:#fff7e6;color:#b45309;">' + (chatu8On ? '智慧姬' : '柏宝绘') + '直连下不生效</span>' : '') + '</div>';
  html += '<div class="ub-preset-panel-desc">以下设置全部属于当前任务选中的提示词预设：切换预设整体加载，改动需点「保存到预设」才生效。' + (externalOn ? (chatu8On ? '智慧姬' : '柏宝绘') + '直连下：前后缀/负面词/模型/出图参数全部不生效（由插件接管）；预设选择仅作保留，切回内置直连即恢复。' : '') + '</div>';

  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">' + esc(IMAGE_TASK_UI_OPTIONS.find(option => option.id === taskId)?.label || '当前任务') + '提示词预设</span><select id="portraitPresetSelect" style="' + sel + '">' + ig.promptPresets.map(preset => '<option value="' + esc(preset.id) + '"' + (preset.id === activePreset.id ? ' selected' : '') + '>' + esc(preset.name) + '</option>').join('') + '</select><span style="' + muted + '">前缀、后缀、负面词、默认负面开关与高级参数属于该任务选中的预设；提示词模式/输出语言/同人tag写法为全局设置（见下方「生图 AI 请求提示词」板块）。</span><div style="display:flex;flex-wrap:wrap;gap:6px;width:100%;"><button type="button" id="portraitPresetNewBtn" class="settings-btn">＋ 新建预设</button><button type="button" id="portraitPresetSaveBtn" class="settings-btn">保存到预设</button><button type="button" id="portraitPresetRenameBtn" class="settings-btn">重命名</button><button type="button" id="portraitPresetDeleteBtn" class="settings-btn">删除预设</button></div><span id="portraitPresetDirtyHint" style="' + muted + '">预设内改动（提示词与高级参数）需点「保存到预设」才生效；切换预设会丢弃未保存改动</span></div>';

  html += '<div id="portraitPromptRow">';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">全局正向词前缀</span><textarea id="portraitPrefix" style="' + ta + '">' + esc(activePreset.promptPrefix) + '</textarea></div>';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">全局正向词后缀</span><textarea id="portraitSuffix" style="' + ta + '">' + esc(activePreset.promptSuffix) + '</textarea></div>';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">全局负面词</span><textarea id="portraitNegative" style="' + ta + 'min-height:56px;">' + esc(activePreset.negativePrompt) + '</textarea></div>';
  // 默认负面提示词开关：属于预设（在用户自己写的负面词下方），需点「保存到预设」才生效
  const presetUseDefaultNegative = activePreset.useDefaultNegative !== false;
  const negDefaultTip = config.showHelpTips
    ? helpTipButton('默认负面提示词说明：\\n开启时（默认），NovelAI 生图会在「全局负面词」之前自动前置一组系统固化的质量负面词（lowres、worst quality、bad quality、jpeg artifacts、chromatic aberration、negative space、blank page 等），可压掉糊图与瑕疵。\\n若觉得画面发灰、细节被压平、构图变空，可关闭本项——此后只发送「全局负面词」中你自己写的内容。\\n只影响 NovelAI 的立绘/衣柜/地图/物品总览/正文插图出图；OpenAI 兼容与 ComfyUI 不发送这组词。')
    : '';
  html += '<div class="settings-row" style="' + col + '"><span class="settings-label">默认负面提示词' + negDefaultTip + '</span><label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text,var(--sweet-text,#111));cursor:pointer;user-select:none;"><input type="checkbox" id="portraitUseDefaultNegative"' + (presetUseDefaultNegative ? ' checked' : '') + ' style="cursor:pointer;" />生图时前置系统默认负面质量词（推荐开启）</label></div>';
  html += '</div>';

  if (provider.apiFormat === 'novelai') {
    html += '<details id="portraitAdvancedRow" style="margin-top:4px;"><summary style="cursor:pointer;font-size:11px;font-weight:600;user-select:none;padding:4px 0;color:' + V.text + ';list-style:none;">' + ubIcon('gear') + ' 高级参数（模型/采样器/步数/CFG/开关等）</summary><div style="padding-top:8px;display:flex;flex-direction:column;gap:8px;">';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">模型</span><select id="portraitModel" style="' + sel + '">' + NOVELAI_MODELS.map(m => '<option value="' + esc(m.id) + '"' + (naiParams.model === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">采样器</span><select id="portraitSampler" style="' + sel + '">' + NOVELAI_SAMPLERS.map(s => '<option value="' + esc(s.id) + '"' + (naiParams.sampler === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">Scheduler</span><select id="portraitScheduler" style="' + sel + '">' + NOVELAI_SCHEDULERS.map(s => '<option value="' + esc(s.id) + '"' + (naiParams.scheduler === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">步数 <span id="portraitStepsVal">' + naiParams.steps + '</span></span><input type="range" id="portraitSteps" min="1" max="60" value="' + naiParams.steps + '" style="' + range + '"></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">CFG <span id="portraitCfgVal">' + naiParams.cfg + '</span></span><input type="range" id="portraitCfg" min="0" max="30" step="0.5" value="' + naiParams.cfg + '" style="' + range + '"></div>';
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">UC Preset</span><select id="portraitUcPreset" style="' + sel + '">' + UC_PRESET_OPTIONS.map(option => '<option value="' + option + '"' + (naiParams.ucPreset === option ? ' selected' : '') + '>' + option + '</option>').join('') + '</select></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;"><label class="ub-adv-check"><input type="checkbox" id="portraitqualityToggle"' + (naiParams.qualityToggle ? ' checked' : '') + '>Quality Toggle</label><label class="ub-adv-check"><input type="checkbox" id="portraitautoSmea"' + (naiParams.autoSmea ? ' checked' : '') + '>SMEA</label><label class="ub-adv-check"><input type="checkbox" id="portraitdecrisper"' + (naiParams.decrisper ? ' checked' : '') + '>Decrisper</label><label class="ub-adv-check"><input type="checkbox" id="portraitsm"' + (naiParams.sm ? ' checked' : '') + '>SM</label><label class="ub-adv-check"><input type="checkbox" id="portraitsmDyn"' + (naiParams.smDyn ? ' checked' : '') + '>SM Dyn</label></div>';
    html += '<div style="display:flex;align-items:center;gap:8px;width:100%;"><span class="settings-label" style="' + lbl + 'flex-shrink:0;">cfgRescale <span id="portraitCfgRescaleVal">' + naiParams.cfgRescale + '</span></span><input type="range" id="portraitCfgRescale" min="0" max="1" step="0.01" value="' + naiParams.cfgRescale + '" style="' + range + '"></div><div style="display:flex;align-items:center;gap:8px;"><span class="settings-label" style="' + lbl + 'flex-shrink:0;">Seed（-1 随机）</span><input type="number" id="portraitSeed" value="' + naiParams.seed + '" style="width:100px;' + num + '"></div></div></details>';
  }
  if (provider.apiFormat === 'openai') {
    const oaiModelTip = config.showHelpTips
      ? helpTipButton('普通 OpenAI 兼容服务填模型名（如 gpt-image-1）。WaveSpeed 也走本通道，无需切换供应商：地址填 https://api.wavespeed.ai（API Key 填其密钥），模型填官方模型路径（如 wavespeed-ai/qwen-image/text-to-image 或 bytedance/seedream-v4-text-to-image；也可把完整提交地址粘进 API 地址栏，模型框只填路径、不要粘 https 地址）。识别到 WaveSpeed 后自动提交任务并轮询结果，按「当前任务宽高比」换算出图尺寸（256～1536），负面词不发送。报 404 时多为地址/模型拼错，错误提示里会附实际提交地址可对照。')
      : '';
    if (chatu8On || baibaiOn) {
      if (chatu8On) {
      // 智慧姬模型行：候选来自智慧姬设置（novelai 读其面板下拉、banana 固定表），选完即写回智慧姬并持久化
      let chatu8Models: string[] = [];
      let chatu8Model = '';
      try {
        chatu8Models = getChatu8Models();
        chatu8Model = getChatu8BackendModel();
      } catch (_e) { /* 智慧姬不可达时仅提示 */ }
      const chatu8Mode = getChatu8Mode();
      const modelHint = chatu8Mode === 'novelai'
        ? '模型取自智慧姬的 NovelAI 面板（「模型版本」下拉）；地址/密钥用智慧姬里配的那套'
        : chatu8Mode === 'banana'
          ? '模型取自智慧姬的 Banana 面板（作者那套 server 的预留模型）'
          : '智慧姬当前的「' + chatu8ModeLabel(chatu8Mode) + '」模式不用在这里选模型';
      const list = chatu8Models.indexOf(chatu8Model) < 0 && chatu8Model ? chatu8Models.concat([chatu8Model]) : chatu8Models;
      const options = list.length
        ? list.map(m => '<option value="' + esc(m) + '"' + (m === chatu8Model ? ' selected' : '') + '>' + esc(m) + '</option>').join('')
        : '<option value="">（这个模式不用选）</option>';
      html += '<div class="settings-row" style="' + col + '"><span class="settings-label">智慧姬模型</span><select id="portraitChatu8Model" title="' + esc(modelHint) + '" style="' + sel + '">' + options + '</select><span style="' + muted + '">改这里＝改智慧姬里的模型，选完即存；模式与地址/密钥到智慧姬设置里配</span></div>';
      // 提示词格式行：说明提示词模式已按智慧姬当前模式对齐（并提醒智慧姬会拼它自己的固定词/质量预设）
      let formatNote = '';
      try { formatNote = chatu8FormatNote(); } catch (_e) { formatNote = ''; }
      if (formatNote) html += '<div class="settings-row" style="' + col + '"><span class="settings-label">提示词格式</span><span style="' + muted + ';flex:1">' + esc(formatNote) + '</span></div>';
      } else {
      // 柏宝绘后端状态行（只读展示：后端/模型/就绪状态全在柏宝绘自己的「渠道」页配置，这里不代改）
      html += '<div class="settings-row" style="' + col + '"><span class="settings-label">柏宝绘后端</span><span style="' + muted + ';flex:1">' + esc(baibaiStatusNote()) + '</span></div>';
      // 提示词格式行：提醒柏宝绘会在标签前后拼它的画师串/质量词
      let baibaiNote = '';
      try { baibaiNote = baibaiFormatNote(); } catch (_e) { baibaiNote = ''; }
      if (baibaiNote) html += '<div class="settings-row" style="' + col + '"><span class="settings-label">提示词格式</span><span style="' + muted + ';flex:1">' + esc(baibaiNote) + '</span></div>';
      }
      // 原 openai 模型行藏起来但保留 DOM：预设采集器照常读值，内置配置不丢
      html += '<div style="display:none">';
    }
    html += '<div class="settings-row" style="' + col + '"><span class="settings-label">模型' + oaiModelTip + '</span><div style="display:flex;gap:6px;width:100%;position:relative;">';
    html += '<input type="text" id="portraitModelOai" value="' + esc(oaiParams.model) + '" placeholder="输入或从列表选择，如 gpt-image-1；WaveSpeed 填模型路径" style="flex:1;' + inp + '">';
    html += '<button class="settings-btn" id="portraitModelOaiDropdownBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));" aria-label="选择已加载模型">▼</button>';
    html += '<button class="settings-btn" id="portraitModelOaiLoadBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">加载模型</button>';
    html += '<div id="portraitModelOaiPopover" class="ub-model-popover"></div>';
    html += '</div><span style="' + muted + '">模型属于预设，切换预设即切换模型。</span></div>';
    if (chatu8On || baibaiOn) html += '</div>';
  }
  if (provider.apiFormat === 'comfyui') {
    // 枚举下拉：常驻「（留空）」首选项 = 不覆盖该参数（用工作流内的值）。
    // 空值需能被选中并持久化（collectPresetComfyUiForm 按实际值采集），故不能用占位文字 option。
    const comfyEnumSel = (id: string, val: string): string =>
      '<select id="' + id + '" style="' + sel + '"><option value=""' + (val ? '' : ' selected') + '>（留空）</option>'
      + (val ? '<option value="' + esc(val) + '" selected>' + esc(val) + '</option>' : '')
      + '</select>';
    html += '<details id="portraitComfyAdvancedRow" style="margin-top:4px;"><summary style="cursor:pointer;font-size:11px;font-weight:600;user-select:none;padding:4px 0;color:' + V.text + ';list-style:none;">' + ubIcon('gear') + ' 高级参数（模型/采样器/调度器/VAE/CLIP/LoRA/步数/CFG/Seed）</summary><div style="padding-top:8px;display:flex;flex-direction:column;gap:8px;">';
    html += '<div class="settings-row" style="' + col + '"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span class="settings-label" style="' + lbl + 'margin:0;">枚举参数</span><button type="button" id="portraitComfyFetchObjInfo" class="settings-btn" style="padding:3px 8px;font-size:10px;">拉取列表</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      + comfyEnumSel('portraitComfyModel', comfyParams.model)
      + comfyEnumSel('portraitComfySampler', comfyParams.sampler)
      + comfyEnumSel('portraitComfyScheduler', comfyParams.scheduler)
      + comfyEnumSel('portraitComfyVae', comfyParams.vae)
      + comfyEnumSel('portraitComfyClip', comfyParams.clip)
      + comfyEnumSel('portraitComfyLora', comfyParams.lora)
      + '</div><span style="' + muted + '">留空＝不覆盖该参数，用工作流内的值；拉取列表后可随时选回「（留空）」。若工作流含对应 %token% 占位符，留空时占位符原样保留。</span></div>';
    html += '<div class="settings-row" style="' + col + '"><div class="image-provider-grid"><label>步数<input type="number" id="portraitComfySteps" min="1" max="150" value="' + comfyParams.steps + '" style="width:100%;' + num + '"></label><label>CFG<input type="number" id="portraitComfyCfg" min="0" max="50" step="0.5" value="' + comfyParams.cfg + '" style="width:100%;' + num + '"></label><label>Seed<input type="number" id="portraitComfySeed" value="' + comfyParams.seed + '" style="width:100%;' + num + '"></label></div></div>';
    html += '</div></details>';
  }
  html += '</div>'; // end #ubPresetPanel

  html += '<div class="settings-row" id="portraitTestRow" style="' + col + '"><button type="button" id="portraitTestBtn" class="settings-btn" style="align-self:flex-start;">' + ubIcon('wrench') + ' 测试当前任务生图</button><span style="' + muted + '">只验证统一图片 API，不会改变立绘、衣柜或地图缓存。</span></div>';
  html += '</div></div></details>';
  return html;
}

/** 测试生图结果预览：项目内主题化弹窗显示（替代旧 window.open 新标签页），
 *  复用 openDialog 框架（主题/深色/幽灵点击防护白拿），关闭按钮/遮罩/ESC 均可关闭。 */
function showTestImagePreview(dataUrl: string): void {
  const style = getConfig().style;
  const dialogClass = style === 'bridge' ? bridgeWindowClass('confirm', 's') : 'panel-popup ub-popup--s';
  const body =
    '<div class="' + dialogClass + ' ub-confirm-dialog">' +
      '<div class="ub-confirm-title">测试生图结果</div>' +
      '<div class="ub-confirm-message"><img src="' + dataUrl + '" style="max-width:100%;max-height:60vh;border-radius:8px;" alt="测试生图"></div>' +
      '<div class="ub-confirm-btns"><button type="button" class="ub-confirm-btn ub-confirm-btn-ok">关闭</button></div>' +
    '</div>';
  const { overlay } = openDialog(body, {});
  overlay.onclick = (e) => {
    if ((e.target as HTMLElement) === overlay) { closeDialog(overlay); return; }
    if ((e.target as HTMLElement).closest('.ub-confirm-btn-ok')) closeDialog(overlay);
  };
  overlay.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(overlay); }
  };
}

function setSegActive(ids: string[], activeValue: string, valueOf: (id: string) => string): void {
  for (const id of ids) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.classList.toggle('seg-active', valueOf(id) === activeValue);
  }
}

/** 功能总开关子区禁用态原地刷新：从开关按钮所在 section 内找到 .feature-body，
 *  toggle ub-disabled（灰显子设置）。与渲染时 feature-body 上的 ub-disabled 条件一致。 */
function setFeatureBodyEnabled(btnId: string, enabled: boolean): void {
  const btn = document.getElementById(btnId);
  const section = btn?.closest('details.settings-section');
  const body = section?.querySelector<HTMLElement>('.feature-body');
  if (body) body.classList.toggle('ub-disabled', !enabled);
}

/** 预设内容容器标脏：更新滑条数值显示 + 脏提示文案（仅标脏，不落盘）。 */
function markPresetPanelDirty(): void {
  const num = (id: string): number => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return el && el.value.trim() !== '' && Number.isFinite(Number(el.value)) ? Number(el.value) : NaN;
  };
  const setVal = (id: string, v: number): void => {
    const el = document.getElementById(id);
    if (el && Number.isFinite(v)) el.textContent = String(v);
  };
  setVal('portraitStepsVal', num('portraitSteps'));
  setVal('portraitCfgVal', num('portraitCfg'));
  setVal('portraitCfgRescaleVal', num('portraitCfgRescale'));
  const hint = document.getElementById('portraitPresetDirtyHint');
  if (hint) hint.textContent = '警告：有未保存改动（提示词或高级参数），点「保存到预设」生效';
}

function readNumberOr(input: HTMLInputElement | null, fallback: number): number {
  if (!input || input.value.trim() === '') return fallback;
  const n = Number(input.value);
  return Number.isFinite(n) ? n : fallback;
}

function collectPresetNovelAiForm(provider: ReturnType<typeof getConfig>['imageGeneration']['provider']['novelai'], existing?: PortraitPromptPreset['novelai']): PortraitPromptPreset['novelai'] {
  const fb = existing ?? buildPresetNovelAiParamsFrom(provider);
  return normalizePresetNovelAiParams({
    model: String($('#portraitModel').val() || fb.model),
    sampler: String($('#portraitSampler').val() || fb.sampler),
    scheduler: String($('#portraitScheduler').val() || fb.scheduler),
    steps: readNumberOr(document.getElementById('portraitSteps') as HTMLInputElement, fb.steps),
    cfg: readNumberOr(document.getElementById('portraitCfg') as HTMLInputElement, fb.cfg),
    ucPreset: readNumberOr(document.getElementById('portraitUcPreset') as HTMLInputElement, fb.ucPreset),
    qualityToggle: !!$('#portraitqualityToggle').prop('checked'),
    autoSmea: !!$('#portraitautoSmea').prop('checked'),
    decrisper: !!$('#portraitdecrisper').prop('checked'),
    sm: !!$('#portraitsm').prop('checked'),
    smDyn: !!$('#portraitsmDyn').prop('checked'),
    cfgRescale: readNumberOr(document.getElementById('portraitCfgRescale') as HTMLInputElement, fb.cfgRescale),
    seed: readNumberOr(document.getElementById('portraitSeed') as HTMLInputElement, fb.seed),
  }, fb);
}

function collectPresetOpenAiForm(provider: ReturnType<typeof getConfig>['imageGeneration']['provider']['openai'], existing?: PortraitPromptPreset['openai']): PortraitPromptPreset['openai'] {
  const fb = existing ?? buildPresetOpenAiParamsFrom(provider);
  return normalizePresetOpenAiParams({
    model: String($('#portraitModelOai').val() || fb.model),
  }, fb);
}

function collectPresetComfyUiForm(provider: ReturnType<typeof getConfig>['imageGeneration']['provider']['comfyui'], existing?: PortraitPromptPreset['comfyui']): PortraitPromptPreset['comfyui'] {
  const fb = existing ?? buildPresetComfyUiParamsFrom(provider);
  // 枚举参数允许留空（（留空）选项值 ''）：元素存在时按实际值采集（空串合法并持久化），
  // 只有元素缺失（该分支未渲染）才回退 fallback。此前 `val || fb.x` 会把空选静默还原成旧值。
  const selVal = (id: string, fbVal: string): string => {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    return el ? String(el.value ?? '') : fbVal;
  };
  return normalizePresetComfyUiParams({
    model: selVal('portraitComfyModel', fb.model),
    sampler: selVal('portraitComfySampler', fb.sampler),
    scheduler: selVal('portraitComfyScheduler', fb.scheduler),
    vae: selVal('portraitComfyVae', fb.vae),
    clip: selVal('portraitComfyClip', fb.clip),
    lora: selVal('portraitComfyLora', fb.lora),
    steps: readNumberOr(document.getElementById('portraitComfySteps') as HTMLInputElement, fb.steps),
    cfg: readNumberOr(document.getElementById('portraitComfyCfg') as HTMLInputElement, fb.cfg),
    seed: readNumberOr(document.getElementById('portraitComfySeed') as HTMLInputElement, fb.seed),
  }, fb);
}

/** 默认负面提示词开关采集（属于预设，位置在「全局负面词」下方）：读复选框；元素缺失（行未渲染）回退原值。 */
function collectPresetUseDefaultNegative(existing?: boolean): boolean {
  const el = document.getElementById('portraitUseDefaultNegative') as HTMLInputElement | null;
  return el ? el.checked : existing !== false;
}

/** 切换预设后原地刷新容器内全部控件（三编辑框 + 当前供应商高级参数），避免整面板重建跳顶/折叠丢失。 */
function refreshPresetPanelControls(preset: PortraitPromptPreset): void {
  const ig = getConfig().imageGeneration.provider;
  const prefix = document.getElementById('portraitPrefix') as HTMLTextAreaElement | null;
  const suffix = document.getElementById('portraitSuffix') as HTMLTextAreaElement | null;
  const negative = document.getElementById('portraitNegative') as HTMLTextAreaElement | null;
  if (prefix) prefix.value = preset.promptPrefix;
  if (suffix) suffix.value = preset.promptSuffix;
  if (negative) negative.value = preset.negativePrompt;
  const negDefault = document.getElementById('portraitUseDefaultNegative') as HTMLInputElement | null;
  if (negDefault) negDefault.checked = preset.useDefaultNegative !== false;
  const setVal = (id: string, v: unknown): void => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = String(v ?? '');
  };
  // 下拉原地刷新：目标值不在既有 option（如枚举列表未拉取/新预设引入新值）时先补一个选项，避免空白
  const setSelect = (id: string, v: string): void => {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    if (v && !Array.from(el.options).some(o => o.value === v)) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v || '（未设置）';
      el.appendChild(opt);
    }
    el.value = v;
  };
  if (ig.apiFormat === 'novelai') {
    const p = resolvePresetNovelAiParams(preset, ig.novelai);
    setSelect('portraitModel', p.model);
    setSelect('portraitSampler', p.sampler);
    setSelect('portraitScheduler', p.scheduler);
    setVal('portraitSteps', p.steps);
    setVal('portraitCfg', p.cfg);
    setSelect('portraitUcPreset', String(p.ucPreset));
    setVal('portraitCfgRescale', p.cfgRescale);
    setVal('portraitSeed', p.seed);
    const chk = (id: string, v: boolean): void => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.checked = v;
    };
    chk('portraitqualityToggle', p.qualityToggle);
    chk('portraitautoSmea', p.autoSmea);
    chk('portraitdecrisper', p.decrisper);
    chk('portraitsm', p.sm);
    chk('portraitsmDyn', p.smDyn);
    const val = (id: string, v: unknown): void => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };
    val('portraitStepsVal', p.steps);
    val('portraitCfgVal', p.cfg);
    val('portraitCfgRescaleVal', p.cfgRescale);
  } else if (ig.apiFormat === 'openai') {
    const p = resolvePresetOpenAiParams(preset, ig.openai);
    setVal('portraitModelOai', p.model);
  } else if (ig.apiFormat === 'comfyui') {
    const p = resolvePresetComfyUiParams(preset, ig.comfyui);
    setSelect('portraitComfyModel', p.model);
    setSelect('portraitComfySampler', p.sampler);
    setSelect('portraitComfyScheduler', p.scheduler);
    setSelect('portraitComfyVae', p.vae);
    setSelect('portraitComfyClip', p.clip);
    setSelect('portraitComfyLora', p.lora);
    setVal('portraitComfySteps', p.steps);
    setVal('portraitComfyCfg', p.cfg);
    setVal('portraitComfySeed', p.seed);
  }
  const hint = document.getElementById('portraitPresetDirtyHint');
  if (hint) hint.textContent = '预设内改动（提示词与高级参数）需点「保存到预设」才生效；切换预设会丢弃未保存改动';
}

// —— 设置面板重建状态保持 ——
// 开关/预设等点击后 showConfigPanel 会整体 innerHTML 重建，若不做状态保持，
// 滚动位置会跳回顶部、已展开的 <details> 区块全部折叠。这里捕获重建前的
// 滚动位置与已展开区块，重建后按标题键恢复。
let _settingsRestoreToken = 0;

/** 取一个 <details> 区块的稳定标识键：优先 summary-row1 首个 span 标题，否则 summary 首个文本节点。 */
function _detailsKey(d: HTMLDetailsElement): string {
  const s = d.querySelector('summary');
  if (!s) return '';
  const row1 = s.querySelector('.summary-row1');
  if (row1) {
    const first = row1.querySelector('span');
    if (first && (first.textContent || '').trim()) return (first.textContent || '').trim();
  }
  for (const node of Array.from(s.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) return t;
    }
  }
  return (s.textContent || '').trim();
}

function _captureSettingsState(): { scrollTop: number; openKeys: string[] } {
  const body = document.querySelector<HTMLElement>('.settings-popup-body');
  const openKeys: string[] = [];
  document.querySelectorAll<HTMLDetailsElement>('.settings-popup details').forEach((d) => {
    if (d.open) {
      const key = _detailsKey(d);
      if (key) openKeys.push(key);
    }
  });
  return { scrollTop: body ? body.scrollTop : 0, openKeys };
}

function _restoreSettingsState(state: { scrollTop: number; openKeys: string[] }, token: number): void {
  if (!state.scrollTop && state.openKeys.length === 0) return;
  requestAnimationFrame(() => {
    if (token !== _settingsRestoreToken) return; // 期间面板又被重建，丢弃过期恢复
    // 先展开 details（恢复 scrollHeight），再设 scrollTop：
    // 若先设滚动再展开，恢复时内容仍折叠、scrollHeight 偏小，scrollTop 会被钳制为 0。
    if (state.openKeys.length) {
      document.querySelectorAll<HTMLDetailsElement>('.settings-popup details').forEach((d) => {
        if (state.openKeys.includes(_detailsKey(d))) d.open = true;
      });
    }
    const body = document.querySelector<HTMLElement>('.settings-popup-body');
    if (body && state.scrollTop > 0) {
      body.scrollTop = Math.min(state.scrollTop, body.scrollHeight - body.clientHeight);
    }
  });
}

/**
 * 生成一个数值类 API 参数的设置行。
 * 包含一个输入框和一个「unset（使用默认）」复选框。
 *
 * @param key 参数标识（用于生成 id）
 * @param label 显示标签
 * @param value 当前值（number 或 'unset'）
 * @param min 最小值
 * @param max 最大值
 * @param step 步长（可选）
 */
function _apiNumRow(key: string, label: string, value: number | 'unset', min: number, max: number, step?: number): string {
  const isUnset = value === 'unset';
  const numVal = isUnset ? '' : String(value);
  const stepAttr = step !== undefined ? ' step="' + step + '"' : '';
  let row = '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  row += '<div style="display:flex;align-items:center;gap:8px;width:100%;">';
  row += '<span class="settings-label" style="font-size:11px;flex:1;">' + label + '</span>';
  row += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text,var(--sweet-text,#111));cursor:pointer;user-select:none;flex-shrink:0;">';
  row += '<input type="checkbox" id="api' + key + 'Unset"' + (isUnset ? ' checked' : '') + ' style="cursor:pointer;" />unset</label>';
  row += '</div>';
  row += '<div style="display:flex;width:100%;">';
  row += '<input type="number" id="api' + key + 'Input" min="' + min + '" max="' + max + '"' + stepAttr + ' value="' + _escAttr(numVal) + '" placeholder="' + (isUnset ? '使用默认' : '') + '" style="flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;min-width:0;' + (isUnset ? 'opacity:0.5;' : '') + '" />';
  row += '</div>';
  row += '</div>';
  return row;
}

/**
 * 生成一个文本域类附加参数的设置行。
 *
 * @param key 参数标识（用于生成 id）
 * @param label 显示标签
 * @param value 当前值
 * @param placeholder 占位提示
 */
function _apiExtraRow(key: string, label: string, value: string, placeholder: string): string {
  let row = '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:3px;">';
  row += '<span class="settings-label" style="font-size:11px;">' + label + '</span>';
  row += '<textarea id="api' + key + 'Input" rows="3" placeholder="' + _escAttr(placeholder) + '" style="width:100%;padding:6px 8px;font-size:10px;font-family:monospace;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;resize:vertical;min-width:0;line-height:1.4;">' + _escAttr(value) + '</textarea>';
  row += '</div>';
  return row;
}

/**
 * 生成场景档位配置块（日常 / 瑟瑟各一个）。
 * 每个档位独立存储完整 API 配置（URL/模型/密钥/参数），不引用 customApiPresets。
 * 密钥经"验证并保存"按钮存入酒馆秘钥系统，获得 secretId 后自动填入。
 */
function buildSceneProfileBlock(mode: 'daily' | 'nsfw', label: string, profile: SceneProfile, presets: SceneApiPreset[]): string {
  const fieldBorder = 'var(--divider,var(--sweet-border,var(--divider,#ccc)))';
  const fieldBg = 'var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))';
  const fieldText = 'var(--text,var(--sweet-text,#111))';
  const inputStyle = 'flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + fieldBorder + ';background:' + fieldBg + ';color:' + fieldText + ';border-radius:4px;min-width:0;';

  let html = '<div style="border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;padding:10px;margin-top:8px;">';
  html += '<div class="settings-row" style="border-bottom:none;padding-bottom:6px;">';
  html += '<span class="settings-label" style="font-size:12px;font-weight:600;">— ' + label + ' 档位 —</span>';
  html += '</div>';

  // 提示词预设下拉
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">提示词预设</span>';
  html += '<div style="display:flex;width:100%;">';
  html += '<input type="text" id="scene' + mode + 'PromptPreset" list="scenePromptPresetList" placeholder="留空=不切提示词预设" value="' + _escAttr(profile.promptPresetName) + '" style="' + inputStyle + '" />';
  html += '</div>';
  html += '</div>';

  // API 预设选择
  html += '<div style="border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0));margin:8px 0 6px;font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding-top:4px;">对话 API 预设</div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">选择对话 API 预设</span>';
  html += '<select id="scene' + mode + 'ApiPreset" style="' + inputStyle + 'cursor:pointer;appearance:auto;">';
  html += '<option value="">- 不使用对话预设 -</option>';
  // 预设选项由 refreshSceneApiPresetDropdowns() 动态填充
  html += '</select>';
  html += '</div>';

  // 选中预设摘要
  const resolvedPreset = profile.apiPresetId
    ? presets.find(p => p.id === profile.apiPresetId) || null
    : null;
  const summaryDisplay = resolvedPreset ? '' : 'display:none;';
  html += '<div id="scene' + mode + 'PresetSummary" style="' + summaryDisplay + 'font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding-top:2px;">';
  if (resolvedPreset) {
    html += ubIcon('link') + ' ' + _escAttr(resolvedPreset.url || '(无URL)') + '  ' + ubIcon('sparkle') + ' ' + _escAttr(resolvedPreset.model || '(无模型)') + '  ' + ubIcon('key') + ' ' + (resolvedPreset.secretId ? '已存入' : '未存入');
  }
  html += '</div>';

  // 正则切换开关
  html += '<div class="settings-row" style="margin-top:6px;">';
  html += '<span class="settings-label" style="font-size:11px;">切换时同时切换正则预设 <span style="color:var(--danger,#c04040);font-size:10px;">（有聊天记录遗失风险）</span></span>';
  html += '<button class="settings-toggle' + (profile.switchRegex ? ' on' : '') + '" id="scene' + mode + 'RegexToggle"></button>';
  html += '</div>';

  const regexDisplay = profile.switchRegex ? '' : 'display:none;';
  html += '<div id="scene' + mode + 'RegexDetail" style="' + regexDisplay + 'padding-top:4px;">';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">正则预设 id 或名称</span>';
  html += '<input type="text" id="scene' + mode + 'RegexPreset" placeholder="例如 my-regex-preset" value="' + _escAttr(profile.regexPresetId) + '" style="' + inputStyle + '" />';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  return html;
}

/** 同步某功能卡片的状态徽标；开启时展开卡片露出参数。 */
function syncFeatureStatus(cardEl: Element | null, enabled: boolean): void {
  if (!cardEl) return;
  const badge = cardEl.querySelector('.feature-status');
  if (badge) {
    badge.classList.toggle('on', enabled);
    badge.classList.toggle('off', !enabled);
    badge.textContent = enabled ? '已开启' : '已关闭';
  }
  if (enabled) (cardEl as HTMLDetailsElement).open = true;
}

/** 月信三态特例：cycleMode → 徽标文案 + on/off class */
function syncCycleStatus(cardEl: Element | null, mode: 'off' | 'period' | 'full'): void {
  if (!cardEl) return;
  const badge = cardEl.querySelector('.feature-status');
  if (!badge) return;
  const on = mode !== 'off';
  badge.classList.toggle('on', on);
  badge.classList.toggle('off', !on);
  badge.textContent = mode === 'off' ? '已关闭' : mode === 'period' ? '经期' : '完整';
  if (on) (cardEl as HTMLDetailsElement).open = true;
}

export function showConfigPanel(style: StyleType, activeTab?: string): void {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;

  const config = getConfig();
  const isMinimal = style === 'minimal';
  const V = sv();

  let html = '<div class="settings-popup ub-popup--l'
    + (style === 'bridge' ? ' bridge-window bridge-module-settings' : '')
    + (config.showHelpTips ? '' : ' hide-help') + '">';
  html += '<div class="settings-popup-head"><div class="settings-popup-title" style="display:flex;align-items:center;gap:6px;">设置' + helpTipButton('设置项存储说明：\\n所有设置全局保存（跨设备），切换角色卡不会改变偏好。\\n例外（按角色卡保存，存在角色卡自身、随卡同步）：世界演化的「演化风格方向」、条目黑名单里的「角色卡黑名单」（风格库与全局默认仍在全局设置里）。') + '</div><button class="settings-popup-close" id="settingsClose">&times;</button></div>';

  // 标签页导航
  html += '<div class="settings-tabs">';
  const isFeaturesTab = activeTab === 'features';
  const isApiTab = activeTab === 'api';
  const isTablesTab = activeTab === 'tables';
  const isStorageTab = activeTab === 'storage';
  html += '<button class="settings-tab' + (!isFeaturesTab && !isApiTab && !isTablesTab && !isStorageTab ? ' active' : '') + '" data-tab="general">通用</button>';
  html += '<button class="settings-tab' + (isFeaturesTab ? ' active' : '') + '" data-tab="features">功能</button>';
  html += '<button class="settings-tab' + (isApiTab ? ' active' : '') + '" data-tab="api">API</button>';
  html += '<button class="settings-tab' + (isTablesTab ? ' active' : '') + '" data-tab="tables">表格</button>';
  html += '<button class="settings-tab' + (isStorageTab ? ' active' : '') + '" data-tab="storage">存储</button>';
  // 打开设置面板时异步预载备份列表（不阻塞面板渲染）
  void listStoryBackups().then(s => {
    _backupListState = { backups: s.list, ready: s.ready };
    const container = document.getElementById('tab-storage');
    if (container) container.innerHTML = renderStorageMigrationPanel(getStatusbarStorageStatus(), _backupListState, hasRealCharacterContext(), getStoryFloorDiagnostics(), _storageHardResetUi, _storageThoroughResetUi);
  });
  html += '</div>';

  html += '<div class="settings-popup-body">';

  // 通用标签页内容
  html += '<div class="settings-tab-content' + (!isFeaturesTab && !isApiTab && !isTablesTab && !isStorageTab ? ' active' : '') + '" id="tab-general">';

  // ===== 主题与风格 =====
  html += '<div class="group-title">主题与风格</div>';
  // 弹窗配色来源（跟随插件/跟随酒馆）：解决插件明暗与酒馆主题冲突
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">弹窗配色来源' + (config.showHelpTips ? helpTipButton('跟随插件：与状态栏的白昼/黑夜按钮一致；跟随酒馆：采用酒馆当前明暗。') : '') + '</span>';
  html += '<select id="panelColorModeSelector" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  html += '<option value="plugin"' + (config.panelColorMode === 'plugin' ? ' selected' : '') + '>跟随插件白昼/黑夜</option>';
  html += '<option value="tavern"' + (config.panelColorMode === 'tavern' ? ' selected' : '') + '>跟随酒馆</option>';
  html += '</select>';
  html += '</div>';
  // 折叠按钮样式
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">折叠按钮样式' + (config.showHelpTips ? helpTipButton('状态栏折叠/展开按钮的样式，决定折叠后状态栏呈现什么入口：极简 / 时间窗 / 时间窗+菜单 / 菜单。切换后立即生效。') : '') + '</span>';
  html += '<select id="collapseBtnStyleSelector" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  for (const [key, label] of Object.entries(COLLAPSE_BTN_STYLE_LABELS)) {
    html += '<option value="' + key + '"' + (config.collapseBtnStyle === key ? ' selected' : '') + '>' + label + '</option>';
  }
  html += '</select>';
  html += '</div>';

  // 风格（古风/仙侠 合并为一个条目，配色在状态栏内切换）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">前端风格' + (config.showHelpTips ? helpTipButton('状态栏的视觉主题，共 6 种。\\n「古风/仙侠」内含古风(朱砂素绢)与仙侠(青玉月白)两套配色，选中后可在状态栏内一键切换，不影响功能与数据。') : '') + '</span>';
  html += '<select id="styleSelector" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  const _isLiterary = config.style === 'ancient' || config.style === 'xianxia';
  html += '<option value="literary"' + (_isLiterary ? ' selected' : '') + '>古风/仙侠</option>';
  for (const [key, label] of Object.entries(STYLE_LABELS)) {
    if (key === 'ancient' || key === 'xianxia') continue;
    html += '<option value="' + key + '"' + (config.style === key ? ' selected' : '') + '>' + label + '</option>';
  }
  html += '</select>';
  html += '</div>';

  // ===== 布局与尺寸 =====
  html += '<div class="group-title">布局与尺寸</div>';
  // 位置
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">显示位置' + (config.showHelpTips ? helpTipButton('状态栏在页面中的位置。\\n固定顶部：常驻页面顶部。\\n固定底部：常驻页面底部（移动端不可用）。\\n跟随底部：随消息流滚动，始终在最新消息下方，移动端推荐。') : '') + '</span>';
  html += '<select id="positionSelector" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  for (const [key, label] of Object.entries(POSITION_LABELS)) {
    html += '<option value="' + key + '"' + (config.positionMode === key ? ' selected' : '') + '>' + label + '</option>';
  }
  html += '</select>';
  html += '</div>';

  // 宽度模式
  const customWidthPct = Math.max(CUSTOM_SIZE_PERCENT_MIN, config.customWidthPercent);
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">宽度模式' + (config.showHelpTips ? helpTipButton('状态栏宽度。\\n全宽：占满容器。\\n消息窗口宽：与聊天消息同宽。\\n自定义宽度：用下方滑块设定百分比。') : '') + '</span>';
  html += '<select id="widthSelector" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  for (const [key, label] of Object.entries(WIDTH_LABELS)) {
    html += '<option value="' + key + '"' + (config.widthMode === key ? ' selected' : '') + '>' + label + '</option>';
  }
  html += '</select>';
  // 自定义宽度滑块（仅custom模式显示）
  html += '<div id="customWidthRow" style="display:' + (config.widthMode === 'custom' ? 'flex' : 'none') + ';flex-direction:column;gap:4px;width:100%;margin-top:2px;">';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="customWidthSlider" min="30" max="100" value="' + customWidthPct + '" style="flex:1;height:6px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="customWidthInput" min="30" max="100" value="' + customWidthPct + '" style="width:52px;padding:4px 6px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;text-align:center;" />';
  html += '<span style="font-size:12px;color:var(--text,var(--sweet-text,#111));">%</span>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // 状态栏正文字号：只改变人物实时信息正文，不触发状态栏全量重渲染
  const fontPercent = Math.round(config.statusbarContentFontScale * 100);
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">状态栏正文字号 (<span id="statusbarContentFontLabelValue">' + fontPercent + '%</span>)' + (config.showHelpTips ? helpTipButton('只调整人物状态、意图、内心想法和衣着/身体详情正文。\n不影响标题、按钮、图标、大调查、大采访和其他弹窗。') : '') + '</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;width:100%;flex-wrap:wrap;">';
  html += '<input type="range" id="statusbarContentFontSlider" min="100" max="150" step="5" value="' + fontPercent + '" style="flex:1;min-width:120px;height:6px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="statusbarContentFontInput" min="100" max="150" step="5" value="' + fontPercent + '" style="width:56px;padding:4px 6px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;text-align:center;" />';
  html += '<span style="font-size:12px;color:var(--text,var(--sweet-text,#111));">%</span>';
  html += '<button type="button" id="statusbarContentFontReset" class="settings-action-btn" style="padding:4px 8px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:transparent;color:var(--text,var(--sweet-text,#111));border-radius:4px;cursor:pointer;">恢复默认</button>';
  html += '</div></div>';

  // 弹窗/设置面板字号：只缩放弹窗正文与设置面板文字，不触发全量重渲染
  const popupFontPercent = Math.round(config.popupSettingsFontScale * 100);
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">弹窗/设置面板字号 (<span id="popupSettingsFontLabelValue">' + popupFontPercent + '%</span>)' + (config.showHelpTips ? helpTipButton('调整各功能弹窗正文与设置面板文字（含输入框/下拉/文本域）。\n不影响标题、按钮、图标、日历格/表头、图例、大调查、大采访、通知和确认框。') : '') + '</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;width:100%;flex-wrap:wrap;">';
  html += '<input type="range" id="popupSettingsFontSlider" min="100" max="150" step="5" value="' + popupFontPercent + '" style="flex:1;min-width:120px;height:6px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="popupSettingsFontInput" min="100" max="150" step="5" value="' + popupFontPercent + '" style="width:56px;padding:4px 6px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;text-align:center;" />';
  html += '<span style="font-size:12px;color:var(--text,var(--sweet-text,#111));">%</span>';
  html += '<button type="button" id="popupSettingsFontReset" class="settings-action-btn" style="padding:4px 8px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:transparent;color:var(--text,var(--sweet-text,#111));border-radius:4px;cursor:pointer;">恢复默认</button>';
  html += '</div></div>';

  // 高度（vh百分比）—— 跟随底部模式下不适用（内容高度自然决定）
  const customHeightPct = Math.max(CUSTOM_SIZE_PERCENT_MIN, config.customHeightPercent);
  html += '<div id="customHeightRow" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;" class="settings-row">';
  html += '<span class="settings-label">高度 (' + customHeightPct + 'vh)' + (config.showHelpTips ? helpTipButton('状态栏高度（视口百分比 vh）。\\n内容过多时自动出现滚动条。「跟随底部」模式下高度由内容决定，此项不生效。') : '') + '</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;width:100%;">';
  html += '<input type="range" id="customHeightSlider" min="30" max="100" value="' + customHeightPct + '" style="flex:1;height:6px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="customHeightInput" min="30" max="100" value="' + customHeightPct + '" style="width:52px;padding:4px 6px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;text-align:center;" />';
  html += '<span style="font-size:12px;color:var(--text,var(--sweet-text,#111));">vh</span>';
  html += '</div>';
  html += '</div>';

  // ===== 界面元素 =====
  html += '<div class="group-title">界面元素</div>';
  // 帮助提示总开关
  html += '<div class="settings-row">';
  html += '<span class="settings-label">显示帮助提示' + (config.showHelpTips ? helpTipButton('各处「?」帮助提示的总开关。\\n开启：状态栏、弹窗、本设置页均显示「?」解释。\\n关闭：全部隐藏，界面更简洁。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.showHelpTips ? ' on' : '') + '" id="helpTipsToggle"></button>';
  html += '</div>';

  // 悬浮配置按钮显示（父选项）
  html += '<div class="settings-row">';
  html += '<span class="settings-label">悬浮配置按钮显示' + (config.showHelpTips ? helpTipButton('在页面边缘显示一个可拖拽的悬浮按钮，点击即可打开本设置面板。\\n关闭后只能通过状态栏菜单进入设置。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.showFloatingBtn ? ' on' : '') + '" id="floatingBtnToggle"></button>';
  html += '</div>';

  // 重置悬浮按钮位置到屏幕正中间（防止用户拖到看不见的地方找不到按钮）
  html += '<div class="settings-row" style="padding-left:18px;flex-wrap:wrap;gap:8px;">';
  html += '<span class="settings-label" style="font-size:11px;opacity:.7;">重置悬浮按钮位置' + (config.showHelpTips ? helpTipButton('若悬浮按钮被拖到屏幕边缘或看不见的地方，点此将其重置到屏幕正中间。') : '') + '</span>';
  html += '<button type="button" id="ubResetFloatingBtnPos" class="settings-action-btn" style="padding:4px 10px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:transparent;color:var(--text,var(--sweet-text,#111));border-radius:4px;cursor:pointer;">重置到屏幕中间</button>';
  html += '</div>';

  // 数据库可视化按钮显示开关
  html += '<div class="settings-row">';
  html += '<span class="settings-label">数据库可视化按钮显示' + (config.showHelpTips ? helpTipButton('在状态栏显示「数据库可视化」按钮，点击可查看数据库各表内容、核对状态栏读取的数据是否正确。\\n不需要时可关闭以精简状态栏。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.dbViewerEnabled ? ' on' : '') + '" id="dbViewerToggle"></button>';
  html += '</div>';

  // DS 缓存优化开关
  html += '<div class="settings-row">';
  html += '<span class="settings-label">DS 缓存优化' + (config.showHelpTips ? helpTipButton('开启后，本插件注入角色世界书的所有条目统一插入到「系统·深度0」（紧贴最后一条消息之前），把正文留作缓存前缀，提升 DeepSeek 等前缀缓存模型的正文命中率。\\n关闭则恢复各条目原位置。\\n翻转开关会立即刷新一次世界书注入。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.dsCacheOptimize ? ' on' : '') + '" id="dsCacheOptimizeToggle"></button>';
  html += '</div>';

  // ===== 运行模式 =====
  // 台账接管时主项目不再承担填表，重填模式不适用（运行时也视为关闭，见 core/refill-mode.ts）；
  // 该组当前只有这一个选项，整块隐藏，避免把用户指向无效开关。
  if (!isLedgerTakeover()) {
    html += '<div class="group-title">运行模式</div>';
    html += '<div class="settings-row">';
    html += '<span class="settings-label">重填模式' + (config.showHelpTips ? helpTipButton('重填表格时打开：暂停本插件的全部自动 AI 请求（地图／立绘／正文插图／日历／世界演化等）与自动数据写入（时间锚定／杂表／世界书投影／经期孕期等），避免状态栏的自动反应与重填互相干扰。\\n只拦后台自动行为，你自己点的按钮照常工作。\\n重填完成后关闭本开关即可，自动功能会在下一次表格更新时照常运行。') : '') + '</span>';
    html += '<button class="settings-toggle' + (config.refillModeEnabled ? ' on' : '') + '" id="refillModeToggle"></button>';
    html += '</div>';
    html += '<div class="settings-row" style="padding-left:0;">';
    html += '<span class="settings-label" style="font-size:11px;opacity:.7;line-height:1.5;">开启期间本插件的自动更新与自动写入全部暂停；重填完成后关闭即可恢复（下一次表格更新时自动运行）。</span>';
    html += '</div>';
  }

  // ===== 通知 =====
  html += '<div class="group-title">通知</div>';
  const _notifyEffectOn = config.notifyEffect !== 'original';
  const _alignDisabled = !_notifyEffectOn;
  // 下拉样式（与通用 tab 既有 select 同款：CSS 变量链式回退跨风格取色）
  const _ntfSelStyle = 'width:100%;max-width:240px;padding:5px 8px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;cursor:pointer;appearance:auto;';
  const _ntfSelDis = _alignDisabled ? ';opacity:.5;cursor:not-allowed;pointer-events:none' : '';

  // 通知效果 + 通知显示位置（同一设置模块内，位置为效果的子项；均为下拉框）
  html += '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px;">';
  // 通知效果（素瓷/云墨/自适应/原版）
  html += '<div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">通知效果' + (config.showHelpTips ? helpTipButton('普通操作通知与数据库插件 toast 的外观。\\n素瓷：暖白瓷面玻璃卡片，清亮精致。\\n云墨：深青岩玻璃卡片，暗色氛围。\\n自适应：浅色用素瓷、深色模式自动换云墨（默认，切换明暗即时生效）。\\n原版：回到酒馆原生 toastr 外观，位置设置不生效。\\n例行通知标题并入正文单行显示；错误与持久通知保留完整详情；填表进度只保留批次/重试关键信息。\\n成就解锁卡片始终保留美化，原版下回默认居中。') : '') + '</span>';
  html += '<select id="notifyEffectSelect" style="' + _ntfSelStyle + '">';
  html += '<option value="porcelain"' + (config.notifyEffect === 'porcelain' ? ' selected' : '') + '>素瓷</option>';
  html += '<option value="inkglass"' + (config.notifyEffect === 'inkglass' ? ' selected' : '') + '>云墨</option>';
  html += '<option value="auto"' + (config.notifyEffect === 'auto' ? ' selected' : '') + '>自适应（推荐）</option>';
  html += '<option value="original"' + (config.notifyEffect === 'original' ? ' selected' : '') + '>原版</option>';
  html += '</select>';
  html += '</div>';
  // 通知显示位置（子项，原版下灰显禁用）
  html += '<div id="notifyAlignRow" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;' + (_alignDisabled ? ';opacity:.5;pointer-events:none' : '') + '">';
  html += '<span class="settings-label">通知显示位置' + (config.showHelpTips ? helpTipButton('通知的水平位置（垂直固定顶部、堆叠向下，最新在顶）。\\n仅「通知效果≠原版」时生效；原版下 toastr 回原生位置，成就卡片回默认居中。') : '') + '</span>';
  html += '<select id="notifyAlignSelect"' + (_alignDisabled ? ' disabled' : '') + ' style="' + _ntfSelStyle + _ntfSelDis + '">';
  html += '<option value="left"' + (config.notifyAlign === 'left' ? ' selected' : '') + '>靠左</option>';
  html += '<option value="center"' + (config.notifyAlign === 'center' ? ' selected' : '') + '>居中</option>';
  html += '<option value="right"' + (config.notifyAlign === 'right' ? ' selected' : '') + '>靠右</option>';
  html += '</select>';
  html += '</div>';
  html += '</div>';
  // AI 进行中通知常驻（默认关：酒馆通知 3 秒自动隐去；主界面提示条常驻；失败告警仍常驻）
  html += '<div class="settings-row">';
  html += '<span class="settings-label">AI 进行中通知常驻' + (config.showHelpTips ? helpTipButton('默认关。关闭时酒馆里的「AI 请求进行中」通知 3 秒自动隐去；主界面内嵌提示条始终常驻（可在那里逐条终止），失败/错误告警也不受影响。\\n打开后酒馆通知常驻，需手动关闭。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.aiNoticePersist ? ' on' : '') + '" id="aiNoticePersistToggle"></button>';
  html += '</div>';

  html += '</div>'; // end tab-general

  // 功能标签页内容
  html += '<div class="settings-tab-content' + (isFeaturesTab ? ' active' : '') + '" id="tab-features">';
  html += '<div class="group-title">剧情与叙事</div>';

  // ===== 大调查 / 大采访功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('search') + ' 大调查 / 大采访</span>';
  html += '<span class="api-badge" title="该功能可能涉及额外 LLM 请求生成">' + ubIcon('sparkle') + '</span>';
  html += '<span class="feature-status ' + ((config.investigationEnabled || config.interviewEnabled) ? 'on' : 'off') + '">' + ((config.investigationEnabled || config.interviewEnabled) ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('大调查 / 大采访功能说明：\\n大调查生成角色性档案；大采访生成多人物实拍问答记录。\\n两者共用上下文条数、最大纪要数和大调查 API 预设。\\n大采访可选择是否把各被采访者的最新大调查档案作为 AI 状态参考；该档案不是剧中采访者所知。') + '';
  html += '<button class="settings-toggle' + (config.investigationEnabled ? ' on' : '') + '" id="investigationToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">角色性档案与多人物采访实录；右侧开关控制大调查</div>';
  html += '</summary>';

  html += '<div class="feature-body">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">显示大采访按钮</span>';
  html += '<button class="settings-toggle' + (config.interviewEnabled ? ' on' : '') + '" id="interviewToggle"></button>';
  html += '</div>';

  // ===== 大调查 / 大采访共用上下文条目数设置 =====
  html += '<div class="settings-row" id="investContextRow" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">大调查/大采访 共用 · 上下文条目数（不包括用户输入）</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="investContextSlider" min="1" max="50" value="' + config.investigationContextCount + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="investContextInput" min="1" max="50" value="' + config.investigationContextCount + '" style="width:48px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />';
  html += '<span style="font-size:11px;color:var(--text,var(--sweet-text,#111));">条</span>';
  html += '</div>';
  html += '</div>';

  // ===== 大调查 / 大采访共用最大注入纪要数设置 =====
  html += '<div class="settings-row" id="investSummaryRow" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">大调查/大采访 共用 · 最大注入纪要数</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="investSummarySlider" min="0" max="50" value="' + config.investigationMaxSummaryCount + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="investSummaryInput" min="0" max="50" value="' + config.investigationMaxSummaryCount + '" style="width:48px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />';
  html += '<span style="font-size:11px;color:var(--text,var(--sweet-text,#111));">个</span>';
  html += '</div>';
  html += '</div>';
  html += '</div>'; // feature-body
  html += '</details>'; // end 大调查 / 大采访 section

  // ===== 日历功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('calendar') + ' 日历</span>';
  html += '<span class="api-badge" title="该功能可能涉及额外 LLM 请求生成">' + ubIcon('sparkle') + '</span>';
  html += '<span class="feature-status ' + (config.calendarEnabled ? 'on' : 'off') + '">' + (config.calendarEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('日历功能说明：\\n开启后，可在状态栏中查看和生成日历。\\n每日自动更新：开启后每天自动生成当日日历条目。\\n日历生成会参考上下文中的事件和纪要信息。') + '';
  html += '<button class="settings-toggle' + (config.calendarEnabled ? ' on' : '') + '" id="calendarToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">管理游戏内日历事件和天气</div>';
  html += '</summary>';
  html += '<div id="calendarDetail" class="' + (config.calendarEnabled ? '' : 'ub-disabled') + '" style="padding-top:6px;">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">每日自动更新</span>';
  html += '<button class="settings-toggle' + (config.calendarAutoDaily ? ' on' : '') + '" id="calendarAutoDailyToggle"></button>';
  html += '</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">生日' + helpTipButton('生日说明：\\n开启时，日历弹窗在角色生日当天显示蛋糕标注与生日条目，且世界书「今日日历」注入「今日生日」提醒行。\\n关闭后两者都不再出现；角色档案与各处的年龄推算不受影响。') + '</span>';
  html += '<button class="settings-toggle' + (config.calendarBirthdayEnabled ? ' on' : '') + '" id="calendarBirthdayToggle"></button>';
  html += '</div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">日历生成上下文数量</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="calendarContextSlider" min="1" max="30" value="' + config.calendarContextCount + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="calendarContextInput" min="1" max="30" value="' + config.calendarContextCount + '" style="width:48px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />';
  html += '<span style="font-size:11px;color:var(--text,var(--sweet-text,#111));">条</span>';
  html += '</div>';
  html += '</div>';
  html += '<div class="settings-row" style="margin-top:4px;padding-top:6px;border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0));">';
  html += '<span class="settings-label" style="color:var(--danger,#c0392b);">' + ubIcon('trash') + ' 删除历史日历内容</span>';
  html += '<button class="settings-action-btn" id="deleteCalendarEntriesBtn" style="padding:4px 10px;font-size:11px;font-family:inherit;border:1px solid var(--danger,#c0392b);background:transparent;color:var(--danger,#c0392b);border-radius:4px;cursor:pointer;">删除</button>';
  html += '</div>';
  html += '</div>'; // end calendarDetail
  html += '</details>'; // end 日历功能 section

  // ===== 世界演化窗口 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('globe') + ' 世界演化</span>';
  html += '<span class="api-badge" title="该功能可能涉及额外 LLM 请求生成">' + ubIcon('sparkle') + '</span>';
  html += '<span class="feature-status ' + (config.worldEnabled ? 'on' : 'off') + '">' + (config.worldEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('世界演化说明：\\n开启后，世界引擎按轮数+日期双轨在幕后演化角色侧写/传闻。\\n演化只带焦点子集角色，台前摘要（主角可知）注入世界书。\\n可在日历弹窗的世界演化按钮打开世界演化窗口查看台前/幕后/入镜队列。') + '';
  html += '<button class="settings-toggle' + (config.worldEnabled ? ' on' : '') + '" id="worldToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">幕后世界双轨演化，台前摘要注入世界书</div>';
  html += '</summary>';
  html += '<div id="worldDetail" class="' + (config.worldEnabled ? '' : 'ub-disabled') + '" style="padding-top:6px;">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">自动更新' + helpTipButton('世界演化自动更新说明：\\n开启后（默认），AI 回复完成且轮数/日期到期时自动演化世界。\\n关闭后不再自动演化、不发起演化请求；已演化的台前摘要仍正常注入世界书，世界窗口照常可看。\\n仍可在世界演化窗口点「手动演化」按钮按需更新。') + '</span>';
  html += '<button class="settings-toggle' + (config.worldAutoUpdate ? ' on' : '') + '" id="worldAutoUpdateToggle"></button>';
  html += '</div>';
  // 小手机联动：演化时焦点角色可主动给主角发微信/来电（事件实时推入瑟瑟小手机插件）
  html += '<div class="settings-row">';
  html += '<span class="settings-label">小手机联动' + helpTipButton('世界演化小手机联动说明：\\n开启后，每轮世界演化至少产出 1 份（至多 3 份）小手机内容：相熟角色主动联系主角（微信消息/来电），或焦点角色与路人在朋友圈/贴吧/微博/小红书发帖（帖子自带评论等完整内容）。\\n消息实时进入瑟瑟小手机的微信（红点提示）；来电会弹出接听/拒接界面；帖子进入对应 App 的信息流。\\n需同时运行瑟瑟小手机插件；未检测到小手机时不注入相关提示词，零额外开销。默认关闭。') + '</span>';
  html += '<button class="settings-toggle' + (config.worldPhoneLink ? ' on' : '') + '" id="worldPhoneLinkToggle"></button>';
  html += '</div>';
  // 演化风格方向：选择值按角色卡保存（角色卡变量，随卡同步）；自定义风格库全局共享（可新建/改名/删除）
  const weCardKey = hasCharacterCardContext();
  const weOpts: Array<[string, string, string]> = [
    ['general', '通用', '通用（不加额外风格要求）'],
    ['sweet', '甜蜜恋爱', '甜蜜恋爱'],
    ['intrigue', '权谋宫斗', '权谋宫斗'],
    ['surprise', '出其不意', '出其不意'],
  ];
  // 旧「自由要求」文本 → 风格库种子条目（一次性；返回 null = 无需迁移）
  const weMigration = planWorldEvolveStyleMigration(
    normalizeWorldEvolveStyleLibrary(config.worldEvolveStyleLibrary),
    config.worldEvolveStyle,
    config.worldEvolveStyleCustom,
  );
  if (weMigration) {
    config.worldEvolveStyleLibrary = weMigration.library;
    config.worldEvolveStyle = weMigration.selection as StatusBarConfig['worldEvolveStyle'];
    setConfig('worldEvolveStyleLibrary', weMigration.library);
    setConfig('worldEvolveStyle', weMigration.selection as StatusBarConfig['worldEvolveStyle']);
  }
  let weLibrary = normalizeWorldEvolveStyleLibrary(config.worldEvolveStyleLibrary);
  const weOwnSelection = readCardWorldEvolveStyle();
  const weOwnValid = weOwnSelection !== '' && hasWorldEvolveStyle(weOwnSelection, weLibrary);
  const weLabelOf = (v: string): string => {
    const preset = weOpts.find(o => o[0] === v);
    if (preset) return preset[1];
    const entry = weLibrary.find(e => worldEvolveCustomKey(e.id) === v);
    return entry ? entry.name : '通用';
  };
  // 生效选择：按卡 → 全局默认 → 通用（与注入侧 resolveWorldEvolveStyleForCurrentCard 同口径）
  let weSelection = weOwnValid
    ? weOwnSelection
    : (hasWorldEvolveStyle(config.worldEvolveStyle, weLibrary) ? config.worldEvolveStyle : 'general');
  const weSelectOptionsHtml = (selected: string): string => weOpts.map(o =>
    '<option value="' + o[0] + '"' + (selected === o[0] ? ' selected' : '') + '>' + o[2] + '</option>'
  ).join('')
    + '<optgroup label="我的自定义风格（全局共享）">'
    + weLibrary.map(e => '<option value="' + worldEvolveCustomKey(e.id) + '"' + (selected === worldEvolveCustomKey(e.id) ? ' selected' : '') + '>' + _escAttr(e.name) + '</option>').join('')
    + '<option value="__new">＋ 新建自定义风格…</option>'
    + '</optgroup>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">演化风格方向 <span style="font-size:10px;border:1px solid ' + V.border + ';border-radius:999px;padding:0 6px;">' + (weCardKey ? '跟随角色卡' : '全局默认') + '</span>'
    + helpTipButton('演化风格方向说明：\\n选择后，该要求会作为对世界演化方向的额外要求注入演化提示词（不额外增加 AI 请求）。\\n通用=不加额外要求；甜蜜恋爱/权谋宫斗/出其不意为预设；「我的自定义风格」可新建/改名/删除，库全局共享。\\n风格选择跟随角色卡保存：换卡各记各的，未单独设置的卡沿用全局默认。') + '</span>';
  html += '<select id="worldEvolveStyleSelect" style="width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">' + weSelectOptionsHtml(weSelection) + '</select>';
  html += '<span style="font-size:10px;opacity:.65;">' + (weCardKey
    ? (weOwnValid
      ? '当前角色卡已单独设置（保存在角色卡上，随卡同步）；切卡各记各的。'
      : '当前角色卡未单独设置，正沿用全局默认（' + _escAttr(weLabelOf(config.worldEvolveStyle)) + '）。')
    : '未载入角色卡：此处修改的是全局默认，新角色卡与未单独设置的卡都沿用它。') + '</span>';
  html += '<div id="worldEvolveStyleEditor" style="display:none;width:100%;box-sizing:border-box;border:1px solid ' + V.border + ';border-radius:6px;padding:8px 9px;">';
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
  html += '<span id="worldEvolveStyleName" style="font-size:11px;font-weight:600;"></span>';
  html += '<span style="margin-left:auto;display:flex;gap:6px;">';
  html += '<button type="button" id="worldEvolveStyleRename" style="font-size:11px;font-family:inherit;padding:4px 10px;line-height:1;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;">改名</button>';
  html += '<button type="button" id="worldEvolveStyleDelete" style="font-size:11px;font-family:inherit;padding:4px 10px;line-height:1;border:1px solid var(--danger,#c0392b);background:transparent;color:var(--danger,#c0392b);border-radius:4px;cursor:pointer;">删除</button>';
  html += '</span></div>';
  html += '<textarea id="worldEvolveStyleCustomInput" rows="3" placeholder="任意演化方向要求，注入演化提示词…" style="width:100%;box-sizing:border-box;resize:vertical;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;line-height:1.5;"></textarea>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">';
  html += '<button type="button" id="worldEvolveStyleSave" style="font-size:11px;font-family:inherit;padding:4px 10px;line-height:1;border:1px solid var(--accent,var(--sweet-pink,#ff8fab));background:transparent;color:var(--accent,var(--sweet-pink,#ff8fab));border-radius:4px;cursor:pointer;">保存修改</button>';
  html += '<button type="button" id="worldEvolveStyleSaveAs" style="font-size:11px;font-family:inherit;padding:4px 10px;line-height:1;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;">另存为新风格</button>';
  html += '<span id="worldEvolveStyleDirty" style="display:none;font-size:10px;color:var(--accent,var(--sweet-pink,#ff8fab));">● 有未保存的修改</span>';
  html += '</div>';
  html += '<span style="font-size:10px;opacity:.65;">风格库全局共享：在此保存会影响所有用到它的角色卡（下一轮演化生效）。</span>';
  html += '</div>';
  html += '</div>';
  // 参数调节二级折叠：全部数值参数收纳
  html += '<details class="world-params-fold" style="margin-top:6px;border-top:1px dashed var(--divider,var(--sweet-border,#e0e0e0));">';
  html += '<summary style="cursor:pointer;user-select:none;padding:8px 2px 4px;font-size:11px;font-weight:600;color:var(--text,var(--sweet-text,#111));">参数调节 ▾<span style="opacity:.55;font-weight:400;margin-left:6px;">演化轮数 / 焦点 / 纪要 / 上下文等</span></summary>';
  html += '<div style="padding-top:2px;">';
  const worldNumRow = (id: string, label: string, value: number, min: number, max: number): string =>
    '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">' +
    '<span class="settings-label" style="font-size:11px;">' + label + '</span>' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
    '<input type="range" id="' + id + 'Slider" min="' + min + '" max="' + max + '" value="' + value + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />' +
    '<input type="number" id="' + id + 'Input" min="' + min + '" max="' + max + '" value="' + value + '" style="width:52px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />' +
    '</div>' +
    '</div>';
  html += worldNumRow('worldEvolveEveryTurns', '演化轮数间隔（小演化每 N 轮）', config.worldEvolveEveryTurns, 1, 20);
  html += worldNumRow('worldFocusMax', '焦点子集上限（请求只带这些角色）', config.worldFocusMax, 3, 30);
  html += worldNumRow('worldRotationBatch', '每轮轮转批次角色数', config.worldRotationBatch, 1, 20);
  html += worldNumRow('worldWbBlueMax', '蓝灯（常亮）世界书条目上限', config.worldWbBlueMax, 1, 100);
  html += worldNumRow('worldWbGreenMax', '绿灯（关键词触发）条目上限', config.worldWbGreenMax, 1, 60);
  html += worldNumRow('worldContextCount', '最近剧情上下文条数（演化请求取最近 N 条）', config.worldContextCount, 1, 30);
  html += worldNumRow('worldEvolveMinReply', '最小回复字数（最新 AI 回复不足则跳过自动演化）', config.worldEvolveMinReply, 1, 2000);
  html += worldNumRow('worldChronicleTotal', '纪要总量（每焦点角色保底取 5 条含名纪要，超量全保留、不足并集补足）', config.worldChronicleTotal, 10, 100);
  html += '</div>';
  html += '</details>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:5px;padding-top:6px;">' +
    '<span class="settings-label" style="font-size:11px;">重置世界演化：删除当前聊天的全部世界状态（角色侧写/传闻/纪事/入镜），并移除世界书中已注入的「世界动态」「角色动态」条目。不可撤销。</span>' +
    '<button class="settings-btn" id="worldResetBtn" style="font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">重置世界演化</button>' +
    '</div>';
  html += '</div>'; // end worldDetail
  html += '</details>'; // end 世界演化功能 section

  // ===== 选项栏功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('clipboard') + ' 选项栏</span>';
  html += '<span class="feature-status ' + (config.optionsBarEnabled ? 'on' : 'off') + '">' + (config.optionsBarEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('选项栏说明：\\n开启后，状态栏会显示选项栏，根据当前剧情自动生成可选择的方向。\\n可选择点击后直接发送或仅填入输入框。') + '';
  html += '<button class="settings-toggle' + (config.optionsBarEnabled ? ' on' : '') + '" id="optionsBarToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">根据剧情生成可选方向</div>';
  html += '</summary>';
  html += '<div id="optionsBarDetail" class="' + (config.optionsBarEnabled ? '' : 'ub-disabled') + '" style="padding-top:6px;">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">选项栏跟随底部</span>' + helpTipButton('选项栏跟随底部说明：\\n开启后，在固定顶部/固定底部模式下，选项栏会从状态栏中抽离，作为独立元素固定在消息流最底部常驻显示，随消息滚动，且不受折叠按钮影响。\\n若状态栏本身已处于「跟随底部」布局，则整体状态栏本就跟随底部，此项不生效。') + '';
  html += '<button class="settings-toggle' + (config.optionsBarFollowBottom ? ' on' : '') + '" id="optionsBarFollowToggle"></button>';
  html += '</div>';
  html += '<div id="optionsBarFollowWarning" style="' + (config.positionMode === 'follow-bottom' ? '' : 'display:none;') + 'margin:-2px 0 6px;font-size:11px;color:#c0392b;">' + ubIcon('warning') + ' 当前状态栏已为跟随底部，此项暂不生效</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">选择效果：点击后直接发送</span>';
  html += '<button class="settings-toggle' + (config.optionsBarSendMode === 'send' ? ' on' : '') + '" id="optionsBarSendToggle"></button>';
  html += '</div>';
  html += '</div>'; // end optionsBarDetail
  html += '</details>'; // end 选项栏 section

  // ===== 成就功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('medal') + ' 成就</span>';
  html += '<span class="feature-status ' + (config.achievementEnabled ? 'on' : 'off') + '">' + (config.achievementEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('成就系统总开关。\\n开启：扫描/计数/计数器推进、显示成就入口并解锁成就。\\n关闭：彻底零负担——不扫描、不计数、派发器退化为空函数、成就簿不读入内存、入口按钮不显示。\\n重新开启时不补算关闭期间的进度，从当前状态起继续。') + '';
  html += '<button class="settings-toggle' + (config.achievementEnabled ? ' on' : '') + '" id="achievementEnabledToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">追踪里程碑并解锁成就</div>';
  html += '</summary>';
  // 通知开关（受总开关控制）
  html += '<div class="feature-body' + (config.achievementEnabled ? '' : ' ub-disabled') + '">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">成就解锁通知' + (config.showHelpTips ? helpTipButton('解锁成就时弹出 toastr 提示（正文即趣评）并播放庆祝特效。\\n关闭后仍会记录成就，仅不弹通知——零侵入关闭路径。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.achievementNotifyEnabled ? ' on' : '') + '" id="achievementNotifyToggle"' + (config.achievementEnabled ? '' : ' disabled style="opacity:0.4;cursor:not-allowed;"') + '></button>';
  html += '</div>';
  // 重置当前成就按钮（受总开关控制）
  html += '<div class="settings-row">';
  html += '<span class="settings-label">重置当前成就' + (config.showHelpTips ? helpTipButton('清空所有已解锁记录、计数器与进度基线，不可撤销。\\n重置后从当前游戏状态重新开始：累积派成就（计数器/快照差分）以当前数据重新计数，天然回溯派按当前数据判定。') : '') + '</span>';
  const achResetStyle = config.achievementEnabled
    ? 'font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--danger,#c0392b);border-radius:4px;cursor:pointer;color:var(--danger,#c0392b);'
    : 'font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--danger,#c0392b);border-radius:4px;opacity:0.4;cursor:not-allowed;color:var(--danger,#c0392b);';
  html += '<button class="settings-btn" id="achievementResetBtn"' + (config.achievementEnabled ? '' : ' disabled') + ' style="' + achResetStyle + '">重置</button>';
  html += '</div>';
  html += '</div>'; // feature-body
  html += '</details>'; // end 成就功能 section

  // ===== 宅仙只读 AI 小助手 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('compass') + ' 宅仙只读小助手</span>';
  html += '<span class="feature-status ' + (config.assistantEnabled ? 'on' : 'off') + '">' + (config.assistantEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('只读 AI 问答小助手：悬浮球入口，不修改任何数据，仅基于当前游戏状态回答问题。\\n总开关关闭时零渲染零请求、悬浮球不显示。\\n小助手拥有独立 API 作用域，不继承全局 apiMode——留空则跟随酒馆主 API，绑定预设则独立使用该预设。\\n生成中关闭面板不中断：回答在后台继续生成并落库，悬浮球呼吸光提示进行中，重开面板可续看。') + '';
  html += '<button class="settings-toggle' + (config.assistantEnabled ? ' on' : '') + '" id="assistantEnabledToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">只读 AI 问答小助手（悬浮球入口）</div>';
  html += '</summary>';
  html += '<div class="feature-body' + (config.assistantEnabled ? '' : ' ub-disabled') + '">';
  // 显示悬浮球 + 位置重置
  html += '<div class="settings-row">';
  html += '<span class="settings-label">显示悬浮球' + (config.showHelpTips ? helpTipButton('悬浮球为小助手的入口，可拖拽定位。点「重置位置」恢复默认位置（距右 20px、距下 88px）。生成中悬浮球带呼吸光效，提示后台仍在回答。') : '') + '</span>';
  html += '<button class="settings-btn" id="assistantFloatResetBtn"' + (config.assistantEnabled ? '' : ' disabled') + ' style="font-size:11px;padding:5px 10px;line-height:1;' + (config.assistantEnabled ? '' : 'opacity:0.4;cursor:not-allowed;') + '">重置位置</button>';
  html += '</div>';
  // API 预设选择器（独立作用域，不受 apiMode 影响）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:4px 0;border-bottom:none;">';
  html += '<span class="settings-label" style="font-size:11px;">AI 预设' + (config.showHelpTips ? helpTipButton('小助手独立使用的 API 预设；不继承全局 API 模式（即使全局为酒馆/自定义/按功能分配）。留空=跟随酒馆主 API。') : '') + '</span>';
  html += '<select id="assistantApiPresetSelect" style="width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;">';
  html += '<option value=""' + (config.assistantApiPresetId === '' ? ' selected' : '') + '>跟随酒馆主 API</option>';
  for (const p of config.customApiPresets) {
    html += '<option value="' + p.id + '"' + (config.assistantApiPresetId === p.id ? ' selected' : '') + '>' + _escAttr(p.name) + '</option>';
  }
  html += '</select>';
  html += '<div style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:2px 0 0;line-height:1.4;">所选模型若 JSON 能力或指令遵循较弱，规划与信封解析会退化（规划走本地降级、回答降级纯文本且摘要不更新），建议选指令遵循较强的模型。</div>';
  html += '</div>';
  // 上下文条数（「最近剧情」资料读取深度）
  html += '<div class="settings-row" id="assistantContextRow" style="flex-direction:column;align-items:flex-start;gap:4px;padding:4px 0;border-bottom:none;">';
  html += '<span class="settings-label" style="font-size:11px;">上下文条数（读取最近剧情）' + (config.showHelpTips ? helpTipButton('宅仙回答时「最近剧情」资料读取的聊天楼层数（1-50，默认 10）。越大答得越有来龙去脉，但占用上下文也越多。\\n只影响剧情资料深度；世界书绿灯触发遵循酒馆世界书扫描深度设置，与此无关。') : '') + '</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="assistantContextSlider" min="1" max="50" value="' + config.assistantContextDepth + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="assistantContextInput" min="1" max="50" value="' + config.assistantContextDepth + '" style="width:48px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />';
  html += '<span style="font-size:11px;color:var(--text,var(--sweet-text,#111));">条</span>';
  html += '</div>';
  html += '</div>';
  // 口吻与人设：默认宅仙 / 自定义
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:none;">';
  html += '<span class="settings-label" style="font-size:11px;">口吻与人设' + (config.showHelpTips ? helpTipButton('默认=内置宅仙人设（温柔、微腹黑的记录仙灵口吻）。\\n自定义=按你写的人设回答：身份、称呼、语气都由文本决定，留空回退默认。\\n无论选哪种，只读边界与“没读到就说没读到”的纪律不变，自定义只换身份与口吻。') : '') + '</span>';
  html += '<select id="assistantPersonaModeSelect" style="width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;">';
  html += '<option value="default"' + (config.assistantPersonaMode === 'custom' ? '' : ' selected') + '>默认（内置宅仙）</option>';
  html += '<option value="custom"' + (config.assistantPersonaMode === 'custom' ? ' selected' : '') + '>自定义</option>';
  html += '</select>';
  html += '<div id="assistantPersonaCustomBlock" style="width:100%;' + (config.assistantPersonaMode === 'custom' ? '' : 'display:none;') + '">';
  html += '<textarea id="assistantPersonaTextInput" rows="5" placeholder="例：你是沉默寡言的哑巴剑客，只用短句回答，称我为“掌柜的”，绝不解释理由。" style="width:100%;padding:6px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;resize:vertical;min-width:0;line-height:1.4;">' + _escAttr(config.assistantPersonaText) + '</textarea>';
  html += '<div style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:2px 0 0;line-height:1.4;">写清身份、称呼与语气即可；留空回退默认宅仙。只读与诚实纪律不随人设改变。</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>'; // feature-body
  html += '</details>'; // end 宅仙只读小助手 section

  html += '<div class="group-title">场景与生成</div>';

  // ===== 地图生成功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('map') + ' 地图生成</span>';
  html += '<span class="api-badge" title="该功能可能涉及额外 LLM 请求生成">' + ubIcon('sparkle') + '</span>';
  html += '<span class="feature-status ' + (config.mapEnabled ? 'on' : 'off') + '">' + (config.mapEnabled ? '已开启' : '已关闭') + '</span>';
  html += (config.showHelpTips ? helpTipButton('开启后，根据「当前详细地点」用 AI 生成场景地图，点击主界面地点名或菜单「地图」即可查看。\\n地图缓存到当前聊天楼层、随聊天分支回滚：同地点不变时不耗 AI，地点变化或点「强制刷新」才重新生成。\\n下方选项：上下文条目数＝生成时读取的聊天历史量；最大注入条目数＝搜世界书匹配地点名的上限；地图自动更新＝什么时候调 AI：不自动更新 / 到达新地点时 / 地点变换时 / 每轮都更新；自动更新时重绘地图画面＝开则重新生成地图并刷新文字，关则只刷新文字、地图画面保持原样（新地点只建文字记录），手动刷新始终生图。探索情况总结与最近三条探索记录始终注入世界书。') : '');
  html += '<button class="settings-toggle' + (config.mapEnabled ? ' on' : '') + '" id="mapToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">按当前地点 AI 生成场景地图</div>';
  html += '</summary>';
  // ===== 上下文条目数 =====
  html += '<div class="feature-body' + (config.mapEnabled ? '' : ' ub-disabled') + '">';
  html += '<div class="settings-row" id="mapContextRow" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">上下文条目数（让AI了解当前情况）</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="mapContextSlider" min="1" max="50" value="' + config.mapContextCount + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="mapContextInput" min="1" max="50" value="' + config.mapContextCount + '" style="width:48px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />';
  html += '<span style="font-size:11px;color:var(--text,var(--sweet-text,#111));">条</span>';
  html += '</div>';
  html += '</div>';
  // ===== 最大注入条目数 =====
  html += '<div class="settings-row" id="mapEntriesRow" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">最大注入条目数（搜世界书匹配地点名上限）</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<input type="range" id="mapEntriesSlider" min="1" max="20" value="' + config.mapMaxEntries + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="mapEntriesInput" min="1" max="20" value="' + config.mapMaxEntries + '" style="width:48px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;" />';
  html += '<span style="font-size:11px;color:var(--text,var(--sweet-text,#111));">个</span>';
  html += '</div>';
  html += '</div>';
  // ===== 地图自动更新模式 =====
  const _mapModeOpts: { val: string; label: string }[] = [
    { val: 'off', label: '不自动更新' },
    { val: 'new-location', label: '到达新地点时' },
    { val: 'location-change', label: '地点变换时' },
    { val: 'every-turn', label: '每轮都更新' },
  ];
  html += '<div class="settings-row" id="mapAutoUpdateModeRow" style="justify-content:space-between;">';
  html += '<span class="settings-label" style="font-size:11px;">地图自动更新</span>';
  html += '<select id="mapAutoUpdateModeSelect" style="font-size:11px;font-family:inherit;padding:2px 4px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;cursor:pointer;">';
  for (const opt of _mapModeOpts) {
    html += `<option value="${opt.val}"${config.mapAutoUpdateMode === opt.val ? ' selected' : ''}>${opt.label}</option>`;
  }
  html += '</select>';
  html += '</div>';
  // ===== 自动更新时重绘地图画面 =====
  html += '<div class="settings-row" id="mapAutoRedrawRow" style="justify-content:space-between;">';
  html += '<span class="settings-label" style="font-size:11px;">自动更新时重绘地图画面' + (config.showHelpTips ? helpTipButton('开：自动更新会重新生成地图画面（SVG/房间/门/出口/角色位置）并同步更新文字记录。\\n关：自动更新只调用 AI 更新文字记录（简介/物品/方位/探索情况总结与最近记录），已有地图画面保持原样；新地点还没有地图时只建立文字记录，地图区显示占位。\\n手动刷新/长按强制刷新始终生图，不受此开关影响。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.mapAutoRedraw ? ' on' : '') + '" id="mapAutoRedrawToggle"></button>';
  html += '</div>';
  // ===== 生成地图时自动生成场景图 =====
  html += '<div class="settings-row" id="mapAutoGenSceneImageRow" style="justify-content:space-between;' + (config.mapEnabled ? '' : 'opacity:.5;pointer-events:none;') + '">';
  html += '<span class="settings-label" style="font-size:11px;">生成地图时自动生成场景图' + (config.showHelpTips ? helpTipButton('开启后，每次成功生成 SVG 地图会自动为该节点生成一张场景图（仅首次，已有场景图不重复烧）。关闭后仍可手动点场景图按钮单独生成场景图。') : '') + '</span>';
  html += '<button class="settings-toggle' + (config.mapAutoGenSceneImage ? ' on' : '') + '" id="mapAutoGenSceneImageToggle"></button>';
  html += '</div>';
  const _mapConflictOpts: { val: string; label: string }[] = [
    { val: 'always-ask', label: '每次询问' },
    { val: 'prefer-existing', label: '默认保留旧路径' },
    { val: 'prefer-current', label: '默认采用当前路径' },
  ];
  html += '<div class="settings-row" id="mapLocationConflictRow" style="justify-content:space-between;">';
  html += '<span class="settings-label" style="font-size:11px;">地点疑似重复时</span>';
  html += '<select id="mapLocationConflictSelect" style="font-size:11px;font-family:inherit;padding:2px 4px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;cursor:pointer;">';
  for (const opt of _mapConflictOpts) {
    html += `<option value="${opt.val}"${config.mapLocationConflictStrategy === opt.val ? ' selected' : ''}>${opt.label}</option>`;
  }
  html += '</select>';
  html += '</div>';
  // ===== 触发关键词排除项 =====
  html += '<div class="settings-row" id="mapExcludePatternRow" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">触发关键词排除项（半角/全角逗号或顿号分隔，命中则关键词回退上一节点）</span>';
  html += '<textarea id="mapExcludePatternInput" rows="2" placeholder="例如 客厅、餐厅、厨房" style="width:100%;padding:6px 8px;font-size:11px;font-family:monospace;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;resize:vertical;min-width:0;line-height:1.4;">' + _escAttr(config.mapExcludePattern) + '</textarea>';
  html += '</div>';
  html += '</div>'; // feature-body
  html += '</details>'; // end 地图生成 section

  // ===== 衣柜功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('dress') + ' 衣柜</span>';
  html += '<span class="api-badge" title="批量生成服饰图片时可能产生额外请求">' + ubIcon('sparkle') + '</span>';
  html += '<span class="feature-status ' + (config.wardrobeEnabled ? 'on' : 'off') + '">' + (config.wardrobeEnabled ? '已开启' : '已关闭') + '</span>';
  html += '<button class="settings-toggle' + (config.wardrobeEnabled ? ' on' : '') + '" id="wardrobeToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">管理服饰、套装、穿搭与后台生图队列</div>';
  html += '</summary>';
  html += '<div class="feature-body' + (config.wardrobeEnabled ? '' : ' ub-disabled') + '" id="wardrobeFeatureBody">';
  html += '<div class="settings-row">';
  html += '<span style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));">批量生图间隔由 API 标签页「统一生图 API」的共享「生图间隔」设置控制。</span>';
  html += '</div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label">套装生图模特标签' + (config.showHelpTips ? helpTipButton('套装展示图用固定外貌匿名模特，男女各一套；生图时按所选性别取用。可自定义标签以保证模特跨图一致性；清空回退默认。衣柜「模特」下拉选「故事中角色」时改用该角色自己的外貌身材资料，不使用这套标签。') : '') + '</span>';
  html += '<div style="display:flex;gap:8px;width:100%;flex-wrap:wrap;">';
  html += '<label style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));">女模标签<textarea id="wardrobeModelTagsFemale" rows="2" style="width:100%;padding:6px;font:inherit;font-size:11px;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;resize:vertical;">' + escapeHtml(config.wardrobeModelTags.female) + '</textarea></label>';
  html += '<label style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));">男模标签<textarea id="wardrobeModelTagsMale" rows="2" style="width:100%;padding:6px;font:inherit;font-size:11px;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;resize:vertical;">' + escapeHtml(config.wardrobeModelTags.male) + '</textarea></label>';
  html += '</div>';
  html += '</div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:3px;">';
  html += '<span style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));">衣柜图片使用 API 标签页「统一生图 API」配置；角色立绘关闭时仍可独立为衣柜生图。</span>';
  html += '</div>';
  html += '</div>';
  html += '</details>';

  // ===== 立绘功能行为（API 配置位于 API 标签页） =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1"><span>' + ubIcon('swap') + ' 立绘功能</span><span class="api-badge" title="立绘功能开关与自动化行为；共享图片 API 请前往 API 标签页">' + ubIcon('sparkle') + '</span><span class="feature-status ' + (config.portraitEnabled ? 'on' : 'off') + '">' + (config.portraitEnabled ? '已开启' : '已关闭') + '</span><button class="settings-toggle' + (config.portraitEnabled ? ' on' : '') + '" id="portraitToggle"></button></div>';
  html += '<div class="summary-desc">控制立绘是否参与生成、自动更新与随机池；供应商和生图参数由 API 标签页统一管理</div>';
  html += '</summary><div class="feature-body' + (config.portraitEnabled ? '' : ' ub-disabled') + '" id="portraitFeatureBody">';
  html += '<div class="settings-row" id="portraitAutoUpdateModeRow"' + (config.portraitEnabled ? '' : ' style="display:none;"') + '><span class="settings-label">自动更新模式' + (config.showHelpTips ? helpTipButton('不自动更新：不触发自动生图；仅无立绘角色自动更新：只补齐缺少立绘的在场角色；每轮在场角色自动更新：每轮重新生成在场角色立绘。') : '') + '</span><select id="portraitAutoUpdateModeSelect" style="font-size:11px;font-family:inherit;padding:2px 4px;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:3px;cursor:pointer;"><option value="off"' + (config.portraitAutoUpdateMode === 'off' ? ' selected' : '') + '>不自动更新</option><option value="missing-only"' + (config.portraitAutoUpdateMode === 'missing-only' ? ' selected' : '') + '>仅无立绘角色自动更新</option><option value="every-turn"' + (config.portraitAutoUpdateMode === 'every-turn' ? ' selected' : '') + '>每轮在场角色自动更新</option></select></div>';
  html += '<div class="settings-row" id="portraitAutoAddRandomRow"' + (config.portraitEnabled ? '' : ' style="display:none;"') + '><span class="settings-label">立绘生成后自动加入随机池</span><button class="settings-toggle' + (config.portraitAutoAddToRandomPool ? ' on' : '') + '" id="portraitAutoAddRandomToggle"></button></div>';
  html += '<div class="settings-row" id="portraitProtagonistRow"' + (config.portraitEnabled ? '' : ' style="display:none;"') + '><span class="settings-label">显示主角立绘' + (config.showHelpTips ? helpTipButton('开启后各主题主角身份区显示主角立绘框。\n主角生图素材来自主角信息表（姓名/性别/年龄/外貌特征/身份背景/近况）与衣柜主角当前穿搭。\n主角仅手动生成，不参与自动更新；立绘索引独立保存，主角改名不丢图。') : '') + '</span><button class="settings-toggle' + (config.portraitProtagonistEnabled ? ' on' : '') + '" id="portraitProtagonistToggle"></button></div>';
  html += '<div class="settings-row" id="portraitRandomFilterRow"' + (config.portraitEnabled ? '' : ' style="display:none;"') + '><span class="settings-label">随机依据</span><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button type="button" class="portrait-filter-chip' + (config.portraitRandomFilter.byEmotion ? ' on' : '') + '" id="portraitFilterByEmotion">角色情绪</button><button type="button" class="portrait-filter-chip' + (config.portraitRandomFilter.byNsfw ? ' on' : '') + '" id="portraitFilterByNsfw">NSFW 状态</button></div></div>';
  html += '<div class="settings-row" id="portraitContextRow" style="flex-direction:column;align-items:flex-start;gap:4px;' + (config.portraitEnabled ? '' : 'display:none;') + '"><span class="settings-label">立绘提示词上下文条数</span><div style="display:flex;align-items:center;gap:8px;width:100%;"><input type="range" id="portraitContextSlider" min="1" max="10" value="' + config.portraitContextCount + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));"><input type="number" id="portraitContextInput" min="1" max="10" value="' + config.portraitContextCount + '" style="width:50px;padding:5px 8px;font-size:12px;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;"></div></div>';
  html += '</div></details>';

  // ===== 正文插图（自动文生图）行为（生图尺寸/提示词预设位于 API 标签页任务配置） =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1"><span>' + ubIcon('image') + ' 正文插图（自动文生图）</span><span class="api-badge" title="AI 正文生成结束后会发起一次提示词 AI 请求 + 生图请求">' + ubIcon('sparkle') + '</span><span class="feature-status ' + (config.storyImageEnabled ? 'on' : 'off') + '">' + (config.storyImageEnabled ? '已开启' : '已关闭') + '</span><button class="settings-toggle' + (config.storyImageEnabled ? ' on' : '') + '" id="storyImageToggle"></button></div>';
  html += '<div class="summary-desc">AI 正文生成结束后自动挑选精彩片段生成插图并插入正文；生图参数由 API 标签页统一管理</div>';
  html += '</summary><div class="feature-body' + (config.storyImageEnabled ? '' : ' ub-disabled') + '" id="storyImageFeatureBody">';
  html += '<div class="settings-row"><span class="settings-label">自动生图' + (config.showHelpTips ? helpTipButton('开启后每次 AI 正文生成结束自动插图（默认关闭）；关闭后不自动生成，可用消息楼层上的「重新生成插图」按钮自主选择时机手动生图。') : '') + '</span><button class="settings-toggle' + (config.storyImage.autoGenerate ? ' on' : '') + '" id="storyImageAutoToggle"></button></div>';
  // 次级折叠（世界演化「参数调节 ▾」同族公式）：虚线分隔 + 滑杆图标 + 灰色内容清单 + 右侧旋转箭头
  // （默认三角被 summary 的 display:block 吃掉，自绘 ▾ 才在所有引擎可见；不挂 settings-section 类防盒中盒）
  html += '<details id="storyImageNumParams" style="margin-top:6px;border-top:1px dashed var(--divider,var(--sweet-border,#e0e0e0));">';
  html += '<summary style="cursor:pointer;user-select:none;padding:8px 2px 4px;font-size:11px;font-weight:600;color:var(--text,var(--sweet-text,#111));display:flex;align-items:center;gap:6px;">' + ubIcon('sliders') + '<span>数值参数</span><span style="opacity:.55;font-weight:400;flex:1;min-width:0;">每轮上限 / 字数闸 / 图库上限 / 显示宽度 / 渲染楼层</span><span class="ub-fold-arrow">▾</span></summary>';
  html += '<div style="padding:2px 2px 4px;">';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="settings-label">每轮最多插图' + (config.showHelpTips ? helpTipButton('一次 AI 正文生成后最多生成的插图张数（要求提示词默认「至少两张」，实际取两者较小值）。范围 1-10，默认 2。') : '') + '</span><div style="display:flex;align-items:center;gap:8px;width:100%;"><input type="range" id="storyImageMaxPerRoundSlider" min="1" max="10" value="' + config.storyImage.maxPerRound + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));"><input type="number" id="storyImageMaxPerRoundInput" min="1" max="10" value="' + config.storyImage.maxPerRound + '" style="width:52px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:3px;text-align:center;"></div></div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="settings-label">最小正文字数' + (config.showHelpTips ? helpTipButton('最新 AI 回复（剥 HTML 去空白后）字符数低于该值时跳过自动文生图，避免在寒暄/单行回复上浪费请求。范围 50-2000，默认 200。') : '') + '</span><div style="display:flex;align-items:center;gap:8px;width:100%;"><input type="range" id="storyImageMinReplySlider" min="50" max="2000" value="' + config.storyImage.minReplyChars + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));"><input type="number" id="storyImageMinReplyInput" min="50" max="2000" value="' + config.storyImage.minReplyChars + '" style="width:60px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:3px;text-align:center;"></div></div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="settings-label">图库上限' + (config.showHelpTips ? helpTipButton('全局文生图图库最多保留张数，超出自动删除最旧插图（连带服务器文件）。范围 20-500，默认 200。') : '') + '</span><div style="display:flex;align-items:center;gap:8px;width:100%;"><input type="range" id="storyImageGalleryLimitSlider" min="20" max="500" step="10" value="' + config.storyImage.galleryLimit + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));"><input type="number" id="storyImageGalleryLimitInput" min="20" max="500" value="' + config.storyImage.galleryLimit + '" style="width:60px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:3px;text-align:center;"></div></div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="settings-label">图片显示宽度' + (config.showHelpTips ? helpTipButton('插图插入正文后的显示宽度（相对消息正文区域的百分比）。范围 20-100，默认 80≈当前观感。只影响显示大小，不改变生成分辨率（生成分辨率在 API 标签页「正文插图尺寸」）。拖动立即生效，含已插入的图。') : '') + '</span><div style="display:flex;align-items:center;gap:8px;width:100%;"><input type="range" id="storyImageWidthSlider" min="20" max="100" step="5" value="' + config.storyImage.insertWidthPercent + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));"><input type="number" id="storyImageWidthInput" min="20" max="100" value="' + config.storyImage.insertWidthPercent + '" style="width:60px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:3px;text-align:center;"></div></div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="settings-label">插图渲染楼层' + (config.showHelpTips ? helpTipButton('只保留最近 N 个 AI 楼层的插图渲染（0=关闭不摘除，默认 3）。窗口外楼层的插图从正文数据中摘除，浏览器不再加载/解码/渲染，显著降低长聊天内存与渲染压力（真减负）。摘除的图不删除：图库条目与服务器文件保留，图库中仍可查看。触发时机：每轮插图完成后、修改此项后、切换聊天时。对窗口外楼层手动「重新生成插图」不会被摘除。') : '') + '</span><div style="display:flex;align-items:center;gap:8px;width:100%;"><input type="range" id="storyImageRenderFloorsSlider" min="0" max="20" step="1" value="' + config.storyImage.renderFloors + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));"><input type="number" id="storyImageRenderFloorsInput" min="0" max="20" value="' + config.storyImage.renderFloors + '" style="width:60px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:3px;text-align:center;"></div></div>';
  html += '</div></details>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="settings-label">图片对齐' + (config.showHelpTips ? helpTipButton('插图在消息正文中的水平对齐方式。默认靠左＝既有观感；切换立即生效，对已插入的插图同样生效（与显示宽度同一机制，只改显示不改图）。') : '') + '</span><select id="storyImageAlignSelect" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;"><option value="left"' + (config.storyImage.insertAlign !== 'center' && config.storyImage.insertAlign !== 'right' ? ' selected' : '') + '>靠左</option><option value="center"' + (config.storyImage.insertAlign === 'center' ? ' selected' : '') + '>居中</option><option value="right"' + (config.storyImage.insertAlign === 'right' ? ' selected' : '') + '>靠右</option></select></div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label">AI 要求提示词' + (config.showHelpTips ? helpTipButton('规定「生图提示词怎么写」（主角出镜限制 / 导演构思流程 S1-S9 / 角色DNA句 / 服装签名 / 动作与空间关系 / 表情转译 / 构图三问 / 跨图连续性等）。\n输出结构契约（<UBS_image> 块 + position: 正文原样摘录 + desc: 画面描述 + image###提示词###）由项目写死强制拼接，不受自定义影响，保证插图能正确定位与生图。\n内置默认全文已直接预填，可在其上细微修改；「恢复默认」一键填回。与内置默认完全一致时存空串，自动跟随后续内置默认升级。') : '') + '</span>';
  html += '<div style="font-size:11px;opacity:.75;line-height:1.5;">「要求提示词」与「输出结构要求」已迁至 <b>API 标签页 → 统一生图 API → 生图 AI 请求提示词</b>（任务选「正文插图」）：在那里可查看内置默认、编辑与一键恢复。此处不再提供编辑入口。</div>';
  html += '</div>';
  html += '<div class="settings-row"><span class="settings-label">文生图图库' + (config.showHelpTips ? helpTipButton('浏览/删除全部聊天自动生成的正文插图（全局共享，带来源角色卡标签），点卡片可全屏左右滑动浏览。') : '') + '</span><button type="button" class="settings-btn" id="storyImageGalleryBtn" style="font-size:11px;padding:5px 12px;line-height:1;white-space:nowrap;">打开图库</button></div>';
  html += '</div></details>';

  html += '<div class="group-title">玩法与互动</div>';

  // ===== 瑟瑟玩法 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span><span class="ub-18-badge">18+</span> 瑟瑟玩法</span>';
  html += '<span class="feature-status ' + (config.nsfwPlayEnabled ? 'on' : 'off') + '">' + (config.nsfwPlayEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('瑟瑟玩法说明：\\n开启后，状态栏会显示瑟瑟玩法面板，包含体位、多人体位、侍奉、场景、附加玩法等分类。\\n选中玩法后会自动拼装成单个世界书条目注入当前角色卡绑定世界书（顺序固定 801），无需手动导入世界书。') + '';
  html += '<button class="settings-toggle' + (config.nsfwPlayEnabled ? ' on' : '') + '" id="nsfwPlayToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">玩法面板（按选注入角色卡世界书）</div>';
  html += '</summary>';
  html += '<div id="nsfw-play-detail" class="' + (config.nsfwPlayEnabled ? '' : 'ub-disabled') + '">';
  // 玩法条目注入位置（用户可调；默认系统深度 0）
  const _wbPos = config.nsfwPlayWorldbookPosition;
  const _wbPosOpts = [
    ['at_depth', '系统深度（指定深度）'],
    ['before_character_definition', '角色定义前'],
    ['after_character_definition', '角色定义后'],
    ['before_author_note', '作者备注前'],
    ['after_author_note', '作者备注后'],
  ];
  html += '<div class="settings-row" style="padding:2px 0 6px 0;">';
  html += '<span class="settings-label">注入位置' + helpTipButton('选中玩法拼装成的世界书条目插入到上下文的位置。默认「系统深度 0」（最新一条消息之后）。更改后会自动重新注入。') + '</span>';
  html += '<select id="nsfwPlayWbPositionSelect" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  for (const [val, label] of _wbPosOpts) html += '<option value="' + val + '"' + (_wbPos === val ? ' selected' : '') + '>' + label + '</option>';
  html += '</select>';
  html += '</div>';
  html += '<div class="settings-row" id="nsfwPlayWbDepthRow"' + (_wbPos === 'at_depth' ? '' : ' style="display:none;"') + '>';
  html += '<span class="settings-label">注入深度' + helpTipButton('仅「系统深度」位置生效。0 = 最新一条消息之后；数值越大越靠前。范围 0-99，默认 0。') + '</span>';
  html += '<input type="number" id="nsfwPlayWbDepthInput" min="0" max="99" value="' + config.nsfwPlayWorldbookDepth + '" style="width:64px;padding:4px 6px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;" />';
  html += '</div>';
  // 多选上限（多选翻新）：默认 5 = 与旧版「每类 1 条 × 5 类」等量；每条玩法约 400 token，调高前留意注入量
  html += '<div class="settings-row">';
  html += '<span class="settings-label">同时生效上限' + helpTipButton('玩法选择器里最多可同时勾选的玩法条数。默认 5（与旧版每类 1 条 × 5 类等量）。每条玩法约 400 token，调高会线性增加注入量。范围 1-10。调低不会裁剪已选中的条目，只拦截新增。') + '</span>';
  html += '<input type="number" id="nsfwPlayMaxSelectedInput" min="1" max="10" value="' + (typeof config.nsfwPlayMaxSelected === 'number' ? config.nsfwPlayMaxSelected : 5) + '" style="width:64px;padding:4px 6px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;" />';
  html += '</div>';
  // 自动清空开关
  html += '<div class="settings-row" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0));">';
  html += '<span class="settings-label">自动清空' + helpTipButton('自动清空说明：\\n开启后，每条消息生成结束后会自动执行一次「一键清空」，关闭全部体位与玩法条目，保证玩法在本次消息后重置。\\n仅对正常生成的人物回复生效，后台静默生成不会触发，避免干扰其它扩展功能。') + '</span>';
  html += '<button class="settings-toggle' + (config.nsfwPlayAutoClear ? ' on' : '') + '" id="nsfwPlayAutoClearToggle"></button>';
  html += '</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">指导上下文条数' + helpTipButton('读取最近的 AI 输出作为故事发展参考，只读取 AI 消息，不读取用户消息。范围 1-20，默认 2。') + '</span>';
  html += '<input type="number" id="nsfwGuidanceContextInput" min="1" max="20" value="' + config.nsfwGuidanceContextCount + '" style="width:64px;padding:4px 6px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;" />';
  html += '</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">世界书注入上限' + helpTipButton('地点与相关角色匹配到的世界书条目合计上限。范围 1-50，默认 20；玩法大全条目不计入该上限。') + '</span>';
  html += '<input type="number" id="nsfwGuidanceWorldbookInput" min="1" max="50" value="' + config.nsfwGuidanceMaxWorldbookEntries + '" style="width:64px;padding:4px 6px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;" />';
  html += '</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">指导最大字数' + helpTipButton('默认 200。该数值只写入提示词要求模型遵守，前端不会截断或发起第二次压缩请求；不设置固定范围。') + '</span>';
  html += '<input type="number" id="nsfwGuidanceMaxCharsInput" value="' + config.nsfwGuidanceMaxChars + '" style="width:72px;padding:4px 6px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;text-align:center;" />';
  html += '</div>';
  html += '</div>';
  html += '</details>'; // end 瑟瑟玩法 section

  // ===== 货币系统（一行极简开关；管理全部在货币弹窗）=====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('coin') + ' 货币系统</span>';
  html += '<span class="feature-status ' + (config.currencyEnabled ? 'on' : 'off') + '">' + (config.currencyEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('货币系统说明：\\n货币由前端自管、按聊天独立保存，与物品表无关。\\n管理入口在状态栏的货币标签（钱包弹窗）：AI 生成币种 / 手动新建 / 点余额调账 / 点图标换样式 / 收支流水。\\n开启且有币种时自动注入货币体系世界书，AI 叙事按 [交易] 标签记账；检测到小手机时转账/红包自动纳入收付。') + '';
  html += '<button class="settings-toggle' + (config.currencyEnabled ? ' on' : '') + '" id="currencyToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">前端自管货币 · 管理入口在状态栏货币标签</div>';
  html += '</summary></details>';

  // ===== 商店设置 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('bag') + ' 商店</span>';
  html += '<span class="api-badge" title="该功能可能涉及额外 LLM 请求生成">' + ubIcon('sparkle') + '</span>';
  html += '<span class="feature-status ' + (config.shopEnabled ? 'on' : 'off') + '">' + (config.shopEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('商店设置说明：\\n总开关控制常规售卖与剧情特卖两块。\\n【常规售卖】可多选卡池作为橱窗货源，已售记录全局保存，重置后清空记录并在下次打开时重新选品。\\n【剧情特卖】由 AI 根据上下文生成特卖道具，单抽有概率抽到。\\n卡池与常规售卖共用同一组卡池选择。') + '';
  html += '<button class="settings-toggle' + (config.shopEnabled ? ' on' : '') + '" id="shopToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">常规售卖与剧情特卖抽奖</div>';
  html += '</summary>';
  html += '<div id="shop-detail" class="' + (config.shopEnabled ? '' : 'ub-disabled') + '">';

  // 子区域 1：常规售卖（卡池多选 + 已售统计 + 重置）
  html += '<div style="margin-top:8px;"><span class="settings-label" style="font-size:11px;font-weight:600;">常规售卖 · 卡池选择</span></div>';
  html += '<div id="gacha-pool-select" style="margin:4px 0 8px;"><div id="gacha-pool-checks"></div></div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">';
  html += '<span class="settings-label" id="gacha-stat" style="font-size:11px;">已售: --/--</span>';
  html += '<button class="settings-btn" id="gacha-reset-btn" style="font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,var(--text-color,#111)));">重置已售记录</button>';
  html += '</div>';

  // 子区域 2：剧情特卖（上下文数量；API 预设在 API 标签页 per-feature 下拉中绑定）
  html += '<div style="margin-top:12px;border-top:1px solid var(--divider);padding-top:10px;">';
  html += '<span class="settings-label" style="font-size:11px;font-weight:600;">剧情特卖 · AI 生成</span>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">';
  html += '<span class="settings-label" style="font-size:11px;">上下文条数</span>';
  html += '<input type="range" id="shopStoryContextSlider" min="1" max="30" value="' + (config.shopStoryContextCount || 10) + '" style="flex:1;">';
  html += '<input type="number" id="shopStoryContextInput" min="1" max="30" value="' + (config.shopStoryContextCount || 10) + '" style="width:48px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));">';
  html += '</div>';
  html += '</div>';

  // 子区域 3：抽奖说明
  html += '<div style="margin-top:12px;border-top:1px solid var(--divider);padding-top:10px;">';
  html += '<span class="settings-label" style="font-size:11px;font-weight:600;">抽奖</span>';
  html += '<div style="font-size:11px;opacity:.7;line-height:1.6;margin-top:4px;color:var(--text,var(--sweet-text,var(--text-color,#111)));">单抽 ' + GACHA_COST + ' 能量 / 十连 ' + GACHA10_COST + ' 能量 / 15% 概率抽到剧情特卖道具。卡池与常规售卖共用上方选择。</div>';
  html += '</div>';

  html += '</div>'; // end shop-detail
  html += '</details>'; // end settings-section

  // ===== 主角技能与天赋树设置 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('gem') + ' 主角技能与天赋树</span>';
  html += '<span class="feature-status ' + (config.skillEnabled ? 'on' : 'off') + '">' + (config.skillEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('AI 生成天赋树，激活消耗技能经验值/瑟瑟能量，强化后描述回写技能表并经派生常亮条目喂给 AI。') + '';
  html += '<button class="settings-toggle' + (config.skillEnabled ? ' on' : '') + '" id="skillToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">技能表 + AI 天赋树 + 经验值激活</div>';
  html += '</summary>';
  html += '<div class="feature-body' + (config.skillEnabled ? '' : ' ub-disabled') + '">';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:2px;">';
  html += '<span class="settings-label" style="font-size:11px;">AI 生成剧情上下文条数 (' + config.skillContextCount + ')</span>';
  html += '<div style="display:flex;align-items:center;gap:6px;width:100%;">';
  html += '<input type="range" id="skillContextSlider" min="1" max="20" value="' + config.skillContextCount + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="skillContextInput" min="1" max="20" value="' + config.skillContextCount + '" style="width:48px;padding:3px 4px;font-size:11px;text-align:center;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));" />';
  html += '</div></div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:2px;">';
  html += '<span class="settings-label" style="font-size:11px;">蓝灯/技能名匹配条目上限 (' + config.skillMaxWorldbookEntries + ')</span>';
  html += '<div style="display:flex;align-items:center;gap:6px;width:100%;">';
  html += '<input type="range" id="skillWbSlider" min="1" max="50" value="' + config.skillMaxWorldbookEntries + '" style="flex:1;height:5px;cursor:pointer;accent-color:var(--text,var(--sweet-text,#111));" />';
  html += '<input type="number" id="skillWbInput" min="1" max="50" value="' + config.skillMaxWorldbookEntries + '" style="width:48px;padding:3px 4px;font-size:11px;text-align:center;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));" />';
  html += '</div></div>';
  html += '<div class="settings-row"><button class="settings-btn" id="skillClearTrees" style="font-size:11px;">清空当前对话所有天赋树</button></div>';
  html += '</div>'; // end feature-body
  html += '</details>'; // end settings-section

  html += '<div class="group-title">角色状态</div>';

  // ===== 月信周期功能 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('flower') + ' 月信与孕育</span>';
  html += '<span class="feature-status ' + (config.cycleMode !== 'off' ? 'on' : 'off') + '">' + (config.cycleMode === 'off' ? '已关闭' : config.cycleMode === 'period' ? '经期' : '完整') + '</span>';
  html += (config.showHelpTips ? helpTipButton('为女性角色增加经期/受孕/孕期模拟：基于游戏内日期推算周期与孕周，关键状态通过世界书注入让剧情 AI 自适应描写。仅追踪主角/恋爱对象表/重要角色表中的女性角色，周期条显示在主角信息区与角色卡。默认关闭，需手动开启。off=关闭(真零开销) / 经期=仅经期 / 完整=经期+受孕+孕期。') : '');
  html += '</div>';
  html += '<div class="summary-desc">经期/受孕/孕期模拟与世界书注入</div>';
  html += '</summary>';
  // 三档分段选择器（off / period / full）
  const _cycleMode = config.cycleMode;
  html += '<div class="settings-row" style="margin-top:4px;gap:8px;">';
  html += '<button id="cycleModeOff" class="settings-btn' + (_cycleMode === 'off' ? ' seg-active' : '') + '" style="flex:1;padding:6px 10px;font-size:12px;">关闭</button>';
  html += '<button id="cycleModePeriod" class="settings-btn' + (_cycleMode === 'period' ? ' seg-active' : '') + '" style="flex:1;padding:6px 10px;font-size:12px;">经期</button>';
  html += '<button id="cycleModeFull" class="settings-btn' + (_cycleMode === 'full' ? ' seg-active' : '') + '" style="flex:1;padding:6px 10px;font-size:12px;">完整</button>';
  html += '</div>';
  html += '<div id="cycleDetail" class="' + (config.cycleMode !== 'off' ? '' : 'ub-disabled') + '" style="padding-top:6px;">';
  html += '<div class="feature-body" style="padding-top:8px;display:flex;flex-direction:column;gap:8px;">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">显示周期进度条</span>';
  html += (config.showHelpTips ? helpTipButton('在角色卡上显示经期/孕期进度条。关闭后进度条隐藏（确认受孕后的孕期条也一并隐藏），主角姓名旁的状态小标不受影响。') : '');
  html += '<button class="settings-toggle' + (config.cycleShowBar ? ' on' : '') + '" id="cycleShowBarToggle"></button>';
  html += '</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">经期世界书注入</span>';
  html += '<button class="settings-toggle' + (config.cycleWorldbookPeriod ? ' on' : '') + '" id="cycleWorldbookToggle"></button>';
  html += '</div>';
  // 以下子项仅 full 档显示
  html += '<div id="cycleFullDetail" style="' + (config.cycleMode === 'full' ? '' : 'display:none;') + '">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">孕期世界书注入</span>';
  html += '<button class="settings-toggle' + (config.cycleWorldbookPregnancy ? ' on' : '') + '" id="cycleWorldbookPregToggle"></button>';
  html += '</div>';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">受孕形式确认</span>';
  html += (config.showHelpTips ? helpTipButton('检测到亲密互动后，按哪种防护形式参与前端受孕概率判定。"每次询问"=事后弹窗让玩家如实记录；"默认内射/外射/安全套"=不弹窗，按所选默认形式算（内射高风险、外射中风险、安全套低风险）。结果早已算法落定，弹窗只采系数、不改结果。') : '');
  html += '</div>';
  html += '<div class="settings-row" style="gap:6px;">';
  const _sexPrompt = config.cycleSexFormPrompt;
  html += '<button id="cycleSexPromptAsk" class="settings-btn' + (_sexPrompt === 'always_ask' ? ' seg-active' : '') + '" style="flex:1;padding:5px 4px;font-size:11px;">每次询问</button>';
  html += '<button id="cycleSexPromptUnprotected" class="settings-btn' + (_sexPrompt === 'assume_unprotected' ? ' seg-active' : '') + '" style="flex:1;padding:5px 4px;font-size:11px;">默认内射</button>';
  html += '<button id="cycleSexPromptWithdrawal" class="settings-btn' + (_sexPrompt === 'assume_withdrawal' ? ' seg-active' : '') + '" style="flex:1;padding:5px 4px;font-size:11px;">默认外射</button>';
  html += '<button id="cycleSexPromptProtected" class="settings-btn' + (_sexPrompt === 'assume_protected' ? ' seg-active' : '') + '" style="flex:1;padding:5px 4px;font-size:11px;">默认安全套</button>';
  html += '</div>';
  html += '</div>'; // end cycleFullDetail
  html += '</div>'; // feature-body
  html += '</div>'; // end cycleDetail
  html += '</details>'; // end 月信 section

  // ===== 时间锚定 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('clock') + ' 时间锚定</span>';
  html += '<span class="feature-status ' + (config.timeAnchorEnabled ? 'on' : 'off') + '">' + (config.timeAnchorEnabled ? '已开启' : '已关闭') + '</span>';
  html += '' + helpTipButton('把剧情时间锚定到一个起点，状态栏的时间与日历据此推进。\\n重置时间锚定：把时间回到锚点（不删除锚点本身）。\\n删除时间锚定：彻底清除锚点，时间不再据此推进。') + '';
  html += '<button class="settings-toggle' + (config.timeAnchorEnabled ? ' on' : '') + '" id="timeAnchorToggle"></button>';
  html += '</div>';
  html += '<div class="summary-desc">锚定剧情时间起点供状态栏与日历推进</div>';
  html += '</summary>';
  html += '<div id="timeAnchorDetail" class="' + (config.timeAnchorEnabled ? '' : 'ub-disabled') + '" style="padding-top:6px;display:flex;gap:8px;flex-wrap:wrap;">';
  html += '<div class="feature-body" style="padding-top:8px;display:flex;flex-direction:column;gap:8px;">';
  html += '<button class="settings-btn" id="timeAnchorReset" style="font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">重置时间锚定</button>';
  html += '<button class="settings-btn" id="timeAnchorDelete" style="font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">删除时间锚定</button>';
  html += '</div>';
  html += '</details>'; // end 时间锚定 section

  // ===== 角色世界书模板库（默认折叠；下拉选模板，原地替换编辑器） =====
  const _wbActiveCreateId = config.characterWorldbookCreateTemplateId;
  const _wbActiveCreateName = (config.characterWorldbookTemplates.find(t => t.id === _wbActiveCreateId) || config.characterWorldbookTemplates[0])?.name || '';
  html += '<details class="settings-section character-worldbook-settings" id="characterWorldbookTemplateLibrary">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('book') + ' 角色世界书模板</span>';
  html += '<span class="feature-status on">当前默认：' + _escAttr(_wbActiveCreateName) + '</span>';
  html += (config.showHelpTips ? helpTipButton('创建角色档案时使用的全局模板。下拉切换查看与编辑某个模板；「设为默认」把当前查看的模板设为创建时默认预选（创建对话框里仍可临时改）。内置模板可复制为自定义版本后编辑。') : '');
  html += '</div>';
  html += '<div class="summary-desc">创建角色档案时使用的全局模板；选择模板查看与编辑</div>';
  html += '</summary>';
  html += '<div class="feature-body character-worldbook-template-library" id="characterWorldbookTemplateBody">';
  html += '</div>';
  html += '</details>'; // end 角色世界书模板 section

  // ===== 人物关系（人物网） =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary">';
  html += '<div class="summary-row1">';
  html += '<span>' + ubIcon('book') + ' 人物关系网</span>';
  html += '<span class="feature-status ' + (config.charRelationWorldbook !== false ? 'on' : 'off') + '">' + (config.charRelationWorldbook !== false ? '世界书注入已开启' : '世界书注入已关闭') + '</span>';
  html += (config.showHelpTips ? helpTipButton('人物关系功能说明：\\n人物关系表（数据库模板 V3.1.0+）记录人物之间的成对关系，一行一对人物，主角也可以是关系主体。\\n\\n【世界书注入】开启后（默认），把每对关系以「姓名A+姓名B」同时在场才触发的关键词条目注入角色主世界书（AI 只在两人同场时看到这段关系，节省上下文）。\\n关闭后移除全部注入条目；数据表与人物网可视化不受影响。\\n\\n【人物网】角色中枢目录页的「人物关系网」横幅，或角色详情页「关系与经历」的「在关系网中查看」，打开力导向关系图：节点融入立绘、连线按关系类别配色、可点选/拖拽/筛选。') : '');
  html += '</div>';
  html += '<div class="summary-desc">成对关系数据表、世界书与触发注入与人物网可视化</div>';
  html += '</summary>';
  html += '<div class="feature-body">';
  html += '<div class="settings-row">';
  html += '<span class="settings-label">世界书注入' + helpTipButton('把人物关系表的每对关系注入世界书；条目采用双关键词与触发——只有当两个人物姓名都出现在近期上下文时才注入，AI 恰好在两人同场时获得这段关系背景。') + '</span>';
  html += '<button class="settings-toggle' + (config.charRelationWorldbook !== false ? ' on' : '') + '" id="charRelationWorldbookToggle"></button>';
  html += '</div>';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;color:var(--text-muted,var(--secondary-text,#888));">数据来源：人物关系表（每对人物一行，禁止删除；关系质变时 AI 填表自动更新）。旧「人际关系」文本列已随 V3.1.0 模板从恋爱对象表/重要角色表剥离——' + missingTableRepairHint() + '即可完成升级。</span>';
  html += '</div>';
  html += '</div>';
  html += '</details>'; // end 人物关系网 section
  html += '</div>'; // end tab-features

  // API 标签页内容
  html += '<div class="settings-tab-content' + (isApiTab ? ' active' : '') + '" id="tab-api">';

  // ===== API预设管理（模块一：连接仓库；常驻可见，不随 apiMode 折叠）=====
  html += '<details class="settings-section" id="apiPresetManagerSection" open>';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('clipboard') + ' API预设管理' + helpTipButton('API预设管理说明：\\n这里是状态栏所有自定义 API 连接的仓库——URL、密钥、模型与高级参数都保存在预设里。\\n\\n【保存为生成预设】把当前输入框内容存成新预设；【更新当前生成预设】覆盖选中的预设。\\n【加载模型】用于验证地址/密钥并拉取模型列表；高级参数留空（unset）表示使用服务端默认值。\\n\\n预设本身不会自动生效：建好或改完后，到下方「API分配」里选择由哪个功能使用。删除预设会自动清空所有引用。') + '</summary>';
  html += '<div style="padding-top:8px;">';
  html += '<div class="ub-api-subsection-desc" style="font-size:11px;">这里只管理「连接仓库」，不决定谁在用；当前共 <b>' + config.customApiPresets.length + '</b> 个预设。' + (config.customApiPresets.length === 0 ? '填好下方 URL / 密钥 / 模型后点「保存为生成预设」即可新建。' : '') + (config.apiMode === 'tavern' ? 'API 来源当前为「使用酒馆API」，预设可先建好，到「API分配」选择后生效。' : '') + '</div>';

  // 选择生成预设（编辑用）下拉 + 删除按钮（瞬态，不绑 config）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:4px 0;border-bottom:none;">';
  html += '<span class="settings-label" style="font-size:11px;">选择生成预设（编辑用）</span>';
  html += '<div style="display:flex;gap:6px;width:100%;">';
  html += '<select id="apiPresetSelect" style="flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;">';
  html += '<option value="">- 选择生成预设 -</option>';
  for (const p of config.customApiPresets) {
    html += '<option value="' + p.id + '">' + _escAttr(p.name) + '</option>';
  }
  html += '</select>';
  html += '<button class="settings-btn" id="apiPresetDeleteBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">删除</button>';
  html += '</div>';
  html += '</div>';

  // 保存 / 更新按钮
  html += '<div class="settings-row" style="padding:4px 0;border-bottom:none;gap:6px;">';
  html += '<button class="settings-btn" id="apiPresetSaveBtn" style="flex:1;font-size:11px;padding:6px 10px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">保存为生成预设</button>';
  html += '<button class="settings-btn" id="apiPresetUpdateBtn" style="flex:1;font-size:11px;padding:6px 10px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">更新当前生成预设</button>';
  html += '</div>';

  // API URL（编辑态，初始空；选预设后填入）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">API URL（必填）</span>';
  html += '<div style="display:flex;width:100%;">';
  html += '<input type="text" id="customApiUrlInput" placeholder="例如 https://api.openai.com/v1" style="flex:1;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;" />';
  html += '</div>';
  html += '</div>';

  // API Key
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">API Key</span>';
  html += '<div style="display:flex;width:100%;">';
  html += '<input type="password" id="customApiKeyInput" placeholder="sk-..." autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;" />';
  html += '</div>';
  html += '</div>';

  // 模型 + ▼下拉 + 加载按钮（组合框：可手输，也可点▼从已加载列表选）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">模型（必填）</span>';
  html += '<div style="display:flex;gap:6px;width:100%;position:relative;">';
  html += '<input type="text" id="customApiModelInput" placeholder="输入或从列表选择模型名" style="flex:1;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;" />';
  html += '<button class="settings-btn" id="customApiModelDropdownBtn" style="font-size:11px;padding:6px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));" aria-label="选择已加载模型">▼</button>';
  html += '<button class="settings-btn" id="customApiLoadModelsBtn" style="font-size:11px;padding:6px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">加载模型</button>';
  html += '<div id="customApiModelPopover" class="ub-model-popover"></div>';
  html += '</div>';
  html += '</div>';

  // 高级参数（折叠，默认折叠）
  html += '<details style="margin-top:4px;"><summary style="font-size:11px;cursor:pointer;color:var(--text-muted,var(--sweet-text-muted,#999));">高级参数（最大 tokens / 温度 / top_p / top_k / 频率惩罚 / 存在惩罚）</summary>';
  html += '<div style="padding-top:6px;">';
  html += '<div class="settings-row" style="border-bottom:none;padding-bottom:2px;"><span class="settings-label" style="font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));">留空（unset）表示使用服务端默认值</span></div>';
  html += _apiNumRow('maxTokens', '最大回复 tokens', 'unset', 1, 200000);
  html += _apiNumRow('temperature', '温度 (temperature)', 'unset', 0, 2, 0.05);
  html += _apiNumRow('topP', 'top_p', 'unset', 0, 1, 0.05);
  html += _apiNumRow('topK', 'top_k', 'unset', 0, 1000);
  html += _apiNumRow('frequencyPenalty', '频率惩罚 (frequency_penalty)', 'unset', -2, 2, 0.1);
  html += _apiNumRow('presencePenalty', '存在惩罚 (presence_penalty)', 'unset', -2, 2, 0.1);
  html += '</div>';
  html += '</details>';

  html += '</div>'; // end 模块一
  html += '</details>'; // end 模块一

  // ===== API分配（模块二：谁用哪套连接）=====
  html += '<details class="settings-section" id="apiAssignmentSection" open>';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('plug') + ' API分配' + helpTipButton('API分配说明：\\n决定状态栏各功能发请求时用哪套 API。\\n\\n【使用酒馆API】全部走酒馆当前主连接（默认）。\\n【使用自定义API】所有功能共用下方选中的一个预设。\\n【按功能独立分配】每个功能分别绑定预设，留空的功能走酒馆主 API。\\n\\n预设来自上方「API预设管理」；这里只做引用，删除预设会自动回退到酒馆主 API。\\n自动重试也在这里：按功能分配时总开关隐藏，改为逐个功能勾选「重试」。') + '</summary>';
  html += '<div style="padding-top:8px;">';
  html += '<div class="ub-api-subsection-desc" style="font-size:11px;">预设仓库在上方「API预设管理」；这里决定每个功能实际用哪套连接。</div>';

  // API 来源选择（三选一）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">';
  html += '<span class="settings-label">API 来源</span>';
  html += '<select id="apiModeSelector" style="width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
  html += '<option value="tavern"' + (config.apiMode === 'tavern' ? ' selected' : '') + '>使用酒馆API</option>';
  html += '<option value="custom"' + (config.apiMode === 'custom' ? ' selected' : '') + '>使用自定义API</option>';
  html += '<option value="per-feature"' + (config.apiMode === 'per-feature' ? ' selected' : '') + '>按功能独立分配</option>';
  html += '</select>';
  html += '</div>';

  // 自动重试（tavern/custom 模式的总开关；per-feature 模式改用每个功能行右侧的勾选）
  {
    const retryTip = '请求失败时自动重试：只对网络类错误（限流 429 / 5xx / 超时 / 连接中断）与空响应重试；鉴权 401/403、参数 400、主动终止不重试。\\n重试间隔 2 秒；重试进度显示在「AI 请求进行中」通知与主界面提示条上，不再单独弹通知。\\n\\n「按功能独立分配」模式下本开关隐藏，改为在下方各功能的选择器右侧逐个勾选。\\n注：纪要合并不在此列——它在合并弹窗内已有独立的「每段重试次数」设置。';
    const showRetryToggle = config.apiMode !== 'per-feature';
    html += '<div class="settings-row" id="aiRetryToggleRow"' + (showRetryToggle ? '' : ' style="display:none;"') + '>';
    html += '<span class="settings-label">自动重试' + (config.showHelpTips ? '' + helpTipButton(retryTip) + '' : '') + '</span>';
    html += '<button class="settings-toggle' + (config.aiRetryEnabled ? ' on' : '') + '" id="aiRetryToggle"></button>';
    html += '</div>';
    html += '<div class="settings-row">';
    html += '<span class="settings-label">最大重试次数' + helpTipButton('失败后最多再试几次（总请求次数 = 该值 + 1）。默认 3 次。') + '</span>';
    html += '<select id="aiRetryMaxSelect" style="font-size:11px;padding:4px 6px;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;">';
    for (let i = 1; i <= 5; i++) {
      html += '<option value="' + i + '"' + (config.aiRetryMax === i ? ' selected' : '') + '>' + i + ' 次</option>';
    }
    html += '</select>';
    html += '</div>';
  }

  // 「使用预设」下拉（仅 custom 模式显示，绑 activeApiPresetId）
  const showCustomPreset = config.apiMode === 'custom';
  html += '<div id="customPresetBinding" style="' + (showCustomPreset ? 'padding-top:6px;' : 'display:none;') + '">';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:4px 0;border-bottom:none;">';
  html += '<span class="settings-label" style="font-size:11px;">使用预设</span>';
  html += '<select id="activeApiPresetSelect" style="width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;">';
  html += '<option value="">- 选择生成预设 -</option>';
  for (const p of config.customApiPresets) {
    html += '<option value="' + p.id + '"' + (config.activeApiPresetId === p.id ? ' selected' : '') + '>' + _escAttr(p.name) + '</option>';
  }
  html += '</select>';
  html += '</div>';
  html += '</div>';

  // 「按功能分配预设」子区块（仅 per-feature 模式显示）
  const showPerFeature = config.apiMode === 'per-feature';
  html += '<div id="perFeatureBinding" style="' + (showPerFeature ? 'padding-top:6px;' : 'display:none;') + '">';
  html += '<div style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:2px 0 6px;">为各功能单独指定预设；留空则该功能走酒馆主 API。右侧「重试」勾选决定该功能失败时是否自动重试（纪要合并在合并弹窗内已有独立重试次数，不在此列）。</div>';
  const featureBindings: { id: string; label: string; cfgKey: string; tip: string; retryScope?: AiRetryScope }[] = [
    { id: 'investigationApiPresetSelect', label: '大调查', cfgKey: 'investigationApiPresetId', tip: '', retryScope: 'investigation' },
    { id: 'calendarApiPresetSelect', label: '日历', cfgKey: 'calendarApiPresetId', tip: '', retryScope: 'calendar' },
    { id: 'shopStoryApiPresetSelectApi', label: '剧情特卖', cfgKey: 'shopStoryApiPresetId', tip: '剧情特卖 AI 生成所用 API 预设；留空走酒馆主 API。', retryScope: 'shopStory' },
    { id: 'mapApiPresetSelect', label: '地图', cfgKey: 'mapApiPresetId', tip: '更换 API 后，已有地图缓存仍会命中、不会自动重新生成；需用新 API 重生请清缓存或强制刷新。', retryScope: 'map' },
    { id: 'portraitApiPresetSelect', label: '生图提示词文本', cfgKey: 'imagePromptApiPresetId', tip: '统一生图 API 的文本提示词生成所用 AI 预设；立绘、衣柜和地图场景共享此文本 API。留空走酒馆主 API。', retryScope: 'imageGeneration' },
    { id: 'wardrobeExtractApiPresetSelect', label: '衣柜提炼', cfgKey: 'wardrobeExtractApiPresetId', tip: '衣柜 AI 提炼服饰所用独立 API 预设；不影响统一生图 API。', retryScope: 'wardrobeExtract' },
    { id: 'nsfwGuidanceApiPresetSelect', label: '瑟瑟指导', cfgKey: 'nsfwGuidanceApiPresetId', tip: '瑟瑟指导扩充输入与备忘录「AI 规划目标」共用的独立 API 预设；留空走酒馆主 API。', retryScope: 'nsfwGuidance' },
    { id: 'skillApiPresetSelect', label: '技能天赋树', cfgKey: 'skillApiPresetId', tip: '天赋树生成所用 API 预设；留空走酒馆主 API。', retryScope: 'skillTree' },
    // [LEGACY-MERGE · DB-ONLY] 仅数据库模式显示；台账接管时由上方循环跳过。
    { id: 'chronicleMergeApiPresetSelect', label: '纪要合并', cfgKey: 'chronicleMergeApiPresetId', tip: '纪要合并 AI 压缩所用 API 预设（仅数据库模式）；留空走酒馆主 API。台账接管时合并使用台账的填表 API。' },
    { id: 'characterWorldbookApiPresetSelect', label: '角色世界书', cfgKey: 'characterWorldbookApiPresetId', tip: '创建角色世界书条目和更新已有条目共用此 API 预设；留空走酒馆主 API。', retryScope: 'characterWorldbook' },
    { id: 'worldApiPresetSelect', label: '世界演化', cfgKey: 'worldApiPresetId', tip: '世界演化 AI 生成所用 API 预设；留空走酒馆主 API。', retryScope: 'world' },
    { id: 'assistantApiPresetSelectPF', label: '宅仙小助手', cfgKey: 'assistantApiPresetId', tip: '小助手独立 API 预设；不继承全局 API 模式，留空走酒馆主 API。', retryScope: 'assistant' },
  ];
  const retryCheckStyle = 'display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));cursor:pointer;white-space:nowrap;';
  for (const fb of featureBindings) {
    // [LEGACY-MERGE · DB-ONLY] 台账接管时隐藏「纪要合并」API 行：
    // 台账合并跟随「填表 API」，不再使用状态栏 chronicleMerge 预设。后续移除状态栏合并时连本行配置一起删。
    if (fb.cfgKey === 'chronicleMergeApiPresetId' && isLedgerTakeover()) continue;
    const boundId = fb.cfgKey === 'imagePromptApiPresetId' ? config.imageGeneration.imagePromptApiPresetId : (config as any)[fb.cfgKey] || '';
    const selStyle = (fb.retryScope ? 'flex:1;' : 'width:100%;') + 'padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;';
    html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:4px 0;border-bottom:none;">';
    html += '<span class="settings-label" style="font-size:11px;">' + fb.label + (fb.tip ? ' ' + helpTipButton(fb.tip) + '' : '') + '</span>';
    html += '<div style="display:flex;align-items:center;gap:8px;width:100%;">';
    html += '<select id="' + fb.id + '" style="' + selStyle + '">';
    html += '<option value=""' + (boundId === '' ? ' selected' : '') + '>使用酒馆主API</option>';
    for (const p of config.customApiPresets) {
      html += '<option value="' + p.id + '"' + (boundId === p.id ? ' selected' : '') + '>' + _escAttr(p.name) + '</option>';
    }
    html += '</select>';
    if (fb.retryScope) {
      html += '<label style="' + retryCheckStyle + '"><input type="checkbox" data-ai-retry-scope="' + fb.retryScope + '"' + (config.aiRetryScopes && config.aiRetryScopes[fb.retryScope] ? ' checked' : '') + ' style="width:13px;height:13px;margin:0;cursor:pointer;">重试</label>';
    }
    html += '</div>';
    html += '</div>';
  }
  html += '</div>';

  html += '</div>'; // end inner wrapper
  html += '</details>'; // end API分配

  // ===== 破限提示词自定义 =====
  {
    const selStyle = 'width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;cursor:pointer;appearance:auto;min-width:0;';
    const taStyle = 'width:100%;padding:6px 8px;font-size:12px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;resize:vertical;min-width:0;line-height:1.4;';
    const muted = 'font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:2px 0 6px;';
    const tip = '破限分头尾两端，作用于同一批 AI 请求（叙事、生图提示词、宅仙问答、小手机全线）：\\n【破限头】拼在请求最上端（第一条消息）。\\n【尾部破限】拼在请求最下端（最后一条消息，原「反截断」）。\\n每端三档：默认（项目内置）／空（不发送，相当于关掉这一端）／自定义（多段，逐段自选身份 system／user／assistant）。\\n自定义可存成多个预设随时切换，预设支持导出 / 导入 JSON。\\n【反八股写作要求】独立设置项（不属于破限），仅叙事文本类请求拼在破限头之后。';
    html += '<details class="settings-section">';
    html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('shield') + ' 破限提示词' + helpTipButton(tip) + '</summary>';
    html += '<div style="padding-top:8px;">';
    html += '<div style="' + muted + '">破限头拼在请求<b>最上端</b>、尾部破限拼在<b>最下端</b>，作用于同一批 AI 请求（含生图提示词与宅仙问答）。</div>';

    // 破限头 / 尾部破限：同构两槽位（内容由 jailbreak-slot-ui 渲染与接线）
    html += '<div id="jbSlots">';
    html += '<div class="jb-slot" data-jb-slot="head" id="jbSlotHead"></div>';
    html += '<div class="jb-slot" data-jb-slot="tail" id="jbSlotTail"></div>';
    html += '</div>';

    // 反八股写作要求（独立于破限：仅叙事文本类请求拼在破限头之后）
    html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;margin-top:10px;">';
    html += '<span class="settings-label">反八股写作要求（独立于破限）</span>';
    html += '<select id="antiClicheModeSelect" style="' + selStyle + '">';
    html += '<option value="default"' + (config.antiClicheMode === 'custom' ? '' : ' selected') + '>默认（项目内置）</option>';
    html += '<option value="custom"' + (config.antiClicheMode === 'custom' ? ' selected' : '') + '>自定义</option>';
    html += '</select>';
    html += '<div id="antiClicheCustomBlock" style="width:100%;' + (config.antiClicheMode === 'custom' ? '' : 'display:none;') + '">';
    html += '<textarea id="antiClicheTextInput" rows="6" placeholder="在此输入你的自定义反八股写作要求" style="' + taStyle + '">' + _escAttr(config.antiClicheText) + '</textarea>';
    html += '<div style="' + muted + '">留空将使用默认。仅影响叙事文本类 AI 请求（拼在破限头之后）。</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '</details>'; // end 破限提示词
  }

  // ===== 统一生图 API（立绘 / 衣柜 / 地图场景） =====
  html += renderUnifiedImageGenerationModule(config, V);

  // ===== 上下文标签剥离（仅 MANUAL 模式：地图 / 立绘 / 瑟瑟指导）=====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('scissors') + ' 上下文标签剥离' + helpTipButton('上下文标签剥离说明：\\n各功能生成时先取最近若干段 AI 回复（或正文）作上下文，再注入提示词。\\n若上下文里混入 <image>…</image> 等富媒体标签，会污染提示词、浪费 token。\\n\\n本配置在「取上下文后、注入提示词前」剥离指定的标签对（含内容、最短匹配、大小写不敏感、全部出现处、含自闭合）。\\n\\n【仅作用于】各功能读取「剧情上下文」的位置：地图、立绘、瑟瑟指导、正文插图，以及大调查、大采访、日历、剧情特卖、技能树、世界演化的资料块与触发正文。\\n【不作用于】宅仙问答等其余功能。\\n\\n每行一个标签名，不含尖括号，例如 image。留空（清空全部）= 关闭剥离。') + '</summary>';
  html += '<div style="padding-top:8px;">';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">待剥离标签（每行一个）</span>';
  const stripTagsText = (config.contextStripTags && config.contextStripTags.length > 0)
    ? config.contextStripTags.join('\n')
    : '';
  html += '<textarea id="contextStripTagsInput" rows="3" placeholder="例如 image（每行一个，留空=关闭剥离）" style="width:100%;padding:6px 8px;font-size:11px;font-family:monospace;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;resize:vertical;min-width:0;line-height:1.4;">' + _escAttr(stripTagsText) + '</textarea>';
  html += '<div style="font-size:10px;color:var(--text-soft,var(--sweet-text-soft,#999));line-height:1.5;padding:2px 0;">';
  html += '说明：每行一个标签名（不含尖括号），例如 <code>image</code>。';
  html += '将剥离成对的 <code>&lt;tag&gt;…&lt;/tag&gt;</code>（含内容、最短匹配、大小写不敏感、含自闭合 <code>&lt;tag/&gt;</code>）。';
  html += '<br>仅作用于各功能读取「剧情上下文」的位置：地图、立绘、瑟瑟指导、正文插图，以及大调查/大采访/日历/剧情特卖/技能树/世界演化的资料块与触发正文。';
  html += '<br>留空（清空全部）= 关闭剥离。';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;padding-top:4px;">';
  html += '<button class="settings-btn" id="contextStripTagsSaveBtn" style="font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">保存</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '</details>'; // end 上下文标签剥离

  // ===== 条目黑名单（1A 类 AI 请求的世界书条目过滤，正则模式） =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('scissors') + ' 条目黑名单' + helpTipButton('条目黑名单说明：\\n条目名称（备注名）命中关键词的世界书条目，会在 1A 类 AI 请求的世界书装载中被剔除——不进提示词、不参与绿灯扫描，蓝灯常亮条目一并剔除；世界书底账不改，仅在请求期间一次性生效，不影响填表等并发请求。\\n\\n【正则模式】每行一个正则表达式（默认忽略英文大小写）：普通字符即普通子串（如「杂鱼」命中名称含「杂鱼」的条目），也可用 ^、| 等正则能力（如 ^UBS-地图- 一次性剔除全部地图条目）。写错的正则会跳过并控制台警告。\\n\\n【仅作用于】大调查、大采访、日历、剧情特卖、世界演化、技能树、角色世界书，以及小手机的微信/电话（共享本设置）。\\n【不作用于】宅仙问答、地图、立绘、瑟瑟指导等其余功能。\\n\\n留空 = 关闭。') + '</summary>';
  html += '<div style="padding-top:8px;">';
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">黑名单关键词（每行一个正则，仅 1A 类请求生效）</span>';
  const blacklistText = (config.entryBlacklist && config.entryBlacklist.length > 0)
    ? config.entryBlacklist.join('\n')
    : '';
  html += '<textarea id="entryBlacklistInput" rows="3" placeholder="例如：^UBS-地图-（每行一个正则，留空=关闭）" style="width:100%;padding:6px 8px;font-size:11px;font-family:monospace;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:4px;resize:vertical;min-width:0;line-height:1.4;">' + _escAttr(blacklistText) + '</textarea>';
  html += '<div style="font-size:10px;color:var(--text-soft,var(--sweet-text-soft,#999));line-height:1.5;padding:2px 0;">';
  html += '说明：当前为<strong>正则模式</strong>——每行一个正则表达式（默认忽略英文大小写），普通字符即普通子串匹配，也可用 <code>^</code>、<code>|</code>、字符类等正则能力，例如 <code>^UBS-地图-</code> 一次性剔除全部地图条目。';
  html += '<br>条目<strong>名称</strong>（备注名）命中即剔除：不进提示词、不参与绿灯扫描，蓝灯常亮一并剔除；世界书底账不改。';
  html += '<br>仅作用于 1A 类请求（大调查/大采访/日历/剧情特卖/世界演化/技能树/角色世界书 + 小手机微信/电话），其余功能不受影响。';
  html += '<br>写错的正则会跳过（控制台警告）；留空 = 关闭。';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;padding-top:4px;">';
  html += '<button class="settings-btn" id="entryBlacklistSaveBtn" style="font-size:11px;padding:5px 12px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">保存</button>';
  html += '</div>';
  html += '</div>';

  // 角色卡黑名单（按条目勾选；值存角色卡变量，随角色卡同步/删除）——与上面的全局正则名单并行叠加
  ensureCardEntryBlacklistStyles();
  const ceHasCard = hasCharacterCardContext();
  html += '<div class="ub-cebl-entry">';
  html += '<div class="ub-cebl-entry-title">角色卡黑名单（按条目勾选）' + helpTipButton('角色卡黑名单说明：\\n从当前角色卡绑定的世界书里勾选**不参与 1A 类 AI 请求**的条目，点弹窗里的「保存」一次性写入角色卡并生效：被勾条目在请求装载世界书时被剔除——不进提示词、不参与绿灯扫描（蓝灯常亮一并剔除），世界书底账不改，也不影响填表等并发请求。\\n\\n命中口径＝条目名精确相等（勾哪个名字就排除哪个名字）；与上面的全局正则名单并行叠加，两者任一命中即剔除。\\n\\n名单保存在角色卡自身（角色卡变量）：随角色卡同步、删除角色卡即随卡消失，不占本项目存储。\\n\\n数据库（TavernDB）/瑟瑟台账（SeseLedger）/本项目（UBS）/小手机（[UBS手机]）条目不会出现在勾选列表里。\\n适用于大调查/大采访/日历/剧情特卖/世界演化/技能树/角色世界书 + 小手机微信/电话；群聊与未打开角色卡时不生效。') + '</div>';
  html += '<div class="ub-cebl-entry-meta">' + (ceHasCard
    ? '当前角色卡：<b>' + _escAttr(getCurrentCardName() || '（未命名角色卡）') + '</b>'
    : '未打开角色卡 —— 本名单按角色卡保存，请先进入某个角色卡的聊天') + '</div>';
  html += '<div class="ub-cebl-entry-row">';
  html += '<button class="settings-btn" id="cardEntryBlacklistPickBtn"' + (ceHasCard ? '' : ' disabled style="opacity:.5;cursor:not-allowed"') + '>选择条目…</button>';
  html += '<span class="ub-cebl-entry-count" id="cardEntryBlacklistCount">' + _escAttr(cardEntryBlacklistSummaryText()) + '</span>';
  html += '</div>';
  html += '<div class="ub-cebl-entry-hint">从当前角色卡绑定的世界书里勾选不参与 1A 类 AI 请求的条目，点「保存」一次性写入并生效（弹窗里勾选只是暂存，关闭不点保存不生效）；名单保存在角色卡自身，随卡同步、删卡即消失。数据库/瑟瑟台账/本项目/小手机条目不出现在勾选列表里。</div>';
  html += '</div>';
  html += '</div>';
  html += '</details>'; // end 条目黑名单

  // ===== 场景对话 API 预设仓库 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('clipboard') + ' 场景对话 API 预设仓库' + helpTipButton('场景对话 API 预设仓库说明：\\n在此处管理 API 预设（URL + 密钥 + 模型 + 参数），供下方日常/瑟瑟档位引用。\\n\\n【加载模型】GET /v1/models 验证密钥是否有效，拉取可用模型列表。\\n【保存密钥】将密钥存入酒馆秘钥系统（/secret-write），获得 secretId 供档位切换时激活。\\n【保存为对话预设】将当前所有参数保存为命名预设，可在下方档位中下拉选择。\\n【更新当前对话预设】将当前参数覆盖到选中的预设。\\n【删除】删除预设；若档位正在引用则自动清空引用。') + '</summary>';
  html += '<div style="padding-top:8px;">';

  // 预设选择下拉 + 删除
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:4px 0;border-bottom:none;">';
  html += '<span class="settings-label" style="font-size:11px;">选择对话预设</span>';
  html += '<div style="display:flex;gap:6px;width:100%;">';
  html += '<select id="sceneApiPresetSelect" style="flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;">';
  html += '<option value="">- 选择对话预设 -</option>';
  for (const p of config.sceneApiPresets) {
    html += '<option value="' + p.id + '">' + _escAttr(p.name) + '</option>';
  }
  html += '</select>';
  html += '<button class="settings-btn" id="sceneApiPresetDeleteBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">删除</button>';
  html += '</div>';
  html += '</div>';

  // API URL
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">API URL</span>';
  html += '<div style="display:flex;width:100%;">';
  html += '<input type="text" id="sceneApiPresetUrl" placeholder="https://api.openai.com/v1" style="flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;" />';
  html += '</div>';
  html += '</div>';

  // 模型 + ▼下拉 + 加载按钮（组合框：可手输，也可点▼从已加载列表选）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">模型名</span>';
  html += '<div style="display:flex;gap:6px;width:100%;position:relative;">';
  html += '<input type="text" id="sceneApiPresetModel" placeholder="输入或从列表选择模型名" style="flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;" />';
  html += '<button class="settings-btn" id="sceneApiPresetModelDropdownBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));" aria-label="选择已加载模型">▼</button>';
  html += '<button class="settings-btn" id="sceneApiPresetLoadModelsBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">加载模型</button>';
  html += '<div id="sceneApiPresetModelPopover" class="ub-model-popover"></div>';
  html += '</div>';
  html += '</div>';

  // 密钥 + 保存按钮
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">API 密钥 <span style="color:var(--text-muted,var(--sweet-text-muted,#999));font-size:10px;">（先点「加载模型」验证密钥，再点「保存密钥」存入酒馆）</span></span>';
  html += '<div style="display:flex;gap:6px;width:100%;">';
  html += '<input type="password" id="sceneApiPresetKey" placeholder="sk-..." autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;min-width:0;" />';
  html += '<button class="settings-btn" id="sceneApiPresetSaveKeyBtn" style="font-size:11px;padding:5px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">保存密钥</button>';
  html += '</div>';
  html += '<span id="sceneApiPresetSecretStatus" style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));">尚未存入</span>';
  html += '</div>';

  // 提示词后处理方式（下拉，默认未选择=不处理）
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">提示词后处理方式 ' + helpTipButton('提示词后处理方式说明：\\n在发送给 API 前对提示词（消息角色序列）做额外整理。对应酒馆「Custom 源」的 custom_prompt_post_processing 设置（/prompt-post-processing 命令）。\\n\\n• 未选择：不处理。\\n• 含工具：保留工具调用相关结构后整理角色顺序。\\n• 无工具：丢弃工具结构后整理角色顺序。\\n• 单一用户消息（无工具）：把所有内容合并为一条 user 消息（对部分不支持多角色的接口/模型更稳）。\\n\\n默认为「未选择」（不处理）。') + '</span>';
  html += '<select id="sceneApiPresetPromptPostProcessing" style="width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid ' + V.border + ';background:' + V.bg + ';color:' + V.text + ';border-radius:4px;cursor:pointer;appearance:auto;min-width:0;">';
  // 分组渲染：未选择（顶层）+ 含工具 + 无工具；默认选中 single
  html += '<option value="">未选择</option>';
  const pppGroups: { label: string; key: string }[] = [{ label: '含工具', key: '含工具' }, { label: '无工具', key: '无工具' }];
  for (const g of pppGroups) {
    html += '<optgroup label="' + g.label + '">';
    for (const opt of PROMPT_POST_PROCESSING_OPTIONS) {
      if (opt.group === g.key) {
        const sel = opt.value === PROMPT_POST_PROCESSING_DEFAULT ? ' selected' : '';
        html += '<option value="' + opt.value + '"' + sel + '>' + opt.label + '</option>';
      }
    }
    html += '</optgroup>';
  }
  html += '</select>';
  html += '</div>';

  // 附加参数（折叠区）
  html += '<details style="margin-top:4px;"><summary style="font-size:11px;cursor:pointer;color:var(--text-muted,var(--sweet-text-muted,#999));">高级参数（附加请求体 / 排除字段 / 自定义请求头）</summary>';
  html += '<div style="padding-top:6px;">';
  html += _apiExtraRow('sapBodyParams', '附加请求体参数', '', '每行一个 key=value，支持 JSON。\n例如:\ntemperature=0.7\nmax_tokens=4096');
  html += _apiExtraRow('sapExcludeBodyParams', '排除的请求体字段', '', '逗号或换行分隔的字段名。\n例如:\nstop, logit_bias');
  html += _apiExtraRow('sapCustomHeaders', '自定义 HTTP 请求头', '', '每行一个 "Header-Name: value"。\n例如:\nX-API-Key: my-key');
  html += '</div>';
  html += '</details>';

  // 保存 / 更新 / 应用按钮
  html += '<div class="settings-row" style="padding:4px 0;border-bottom:none;gap:6px;">';
  html += '<button class="settings-btn" id="sceneApiPresetSaveBtn" style="flex:1;font-size:11px;padding:6px 10px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">保存为对话预设</button>';
  html += '<button class="settings-btn" id="sceneApiPresetUpdateBtn" style="flex:1;font-size:11px;padding:6px 10px;line-height:1;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">更新当前对话预设</button>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">';
  html += '<button class="settings-btn" id="sceneApiPresetApplyBtn" style="flex-shrink:0;font-size:11px;padding:6px 14px;line-height:1;background:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))));color:#fff;border:1px solid var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))));border-radius:4px;cursor:pointer;">' + ubIcon('bolt') + ' 应用当前预设到酒馆</button>';
  html += '<span style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));line-height:1.3;">将当前参数直接注入酒馆主连接并重连，无需保存</span>';
  html += '</div>';
  html += '</div>'; // end inner wrapper
  html += '</details>'; // end 场景对话 API 预设仓库

  // ===== 场景一键切换 =====
  html += '<details class="settings-section">';
  html += '<summary class="settings-section-summary" style="font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;">' + ubIcon('swap') + ' 场景一键切换（日常 / 瑟瑟）' + helpTipButton('场景切换说明：\\n一键切换酒馆【主连接】的「提示词预设 + API 连接」。\\n\\n• 顶栏会出现一个两态按钮，在「日常」与「瑟瑟」之间切换。\\n• 切换会修改酒馆主连接，对所有聊天生效。\\n• 与上方「API分配」互不影响——那是状态栏自己发请求用的。\\n\\n每个档位独立配置：\\n【提示词预设】酒馆预设下拉里的项目（提示词模板/温度/流式等）。\\n【API 预设】从上方的「场景对话 API 预设仓库」中选择已保存的预设；\\n  先到仓库区填 API URL+密钥→加载模型验证→保存密钥→保存为预设，\\n  再回到这里下拉选择即可。') + '</summary>';
  html += '<div style="padding-top:8px;">';

  // 启用开关
  html += '<div class="settings-row">';
  html += '<span class="settings-label">启用场景切换</span>';
  html += '<button class="settings-toggle' + (config.sceneSwitchEnabled ? ' on' : '') + '" id="sceneSwitchToggle"></button>';
  html += '</div>';

  // 环境告警：酒馆助手接口不可用时提示
  if (!isTavernHelperAvailable()) {
    html += '<div class="settings-row" style="color:var(--danger,#c04040);font-size:11px;border:1px solid var(--danger,#c04040);border-radius:4px;padding:6px 8px;background:rgba(192,64,64,0.15);">' + ubIcon('warning') + ' 无法访问酒馆助手接口（window.TavernHelper）。场景切换功能需要酒馆助手环境才能读取预设列表、切换预设与密钥。请确认状态栏脚本已在酒馆助手下启用。</div>';
  }

  // 提示词预设候选列表容器（放在 sceneSwitchDetail 之外）
  html += '<datalist id="scenePromptPresetList"></datalist>';

  const sceneDetailDisplay = config.sceneSwitchEnabled ? '' : 'display:none;';
  html += '<div id="sceneSwitchDetail" style="' + sceneDetailDisplay + '">';

  // 日常档位
  html += buildSceneProfileBlock('daily', '日常', config.sceneDailyProfile, config.sceneApiPresets);
  // 瑟瑟档位
  html += buildSceneProfileBlock('nsfw', '瑟瑟', config.sceneNsfwProfile, config.sceneApiPresets);

  // 当前激活档位 + 应用按钮
  html += '<div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0));padding-top:10px;margin-top:4px;">';
  html += '<span class="settings-label" style="font-size:11px;">当前激活档位：<b id="sceneCurrentLabel">' + (config.sceneSwitchCurrent === 'nsfw' ? '瑟瑟' : config.sceneSwitchCurrent === 'daily' ? '日常' : '未激活') + '</b></span>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;">';
  html += '<button class="settings-btn" id="sceneApplyDailyBtn" style="flex:1;font-size:11px;padding:6px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">应用「日常」</button>';
  html += '<button class="settings-btn" id="sceneApplyNsfwBtn" style="flex:1;font-size:11px;padding:6px 10px;line-height:1;white-space:nowrap;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;color:var(--text,var(--sweet-text,#111));">应用「瑟瑟」</button>';
  html += '</div>';
  html += '<span class="settings-label" style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));">应用后酒馆主连接会立即切换并重连。请先在上方「场景对话 API 预设仓库」中加载模型验证密钥→保存密钥→保存为预设，再回到此处选择预设后应用。</span>';
  html += '</div>';
  html += '</div>'; // end sceneSwitchDetail
  html += '</div>'; // end inner wrapper
  html += '</details>'; // end 场景一键切换

  html += '</div>'; // end tab-api

  // 表格标签页内容（懒加载：首次切到该 tab 时才渲染）
  html += '<div class="settings-tab-content' + (isTablesTab ? ' active' : '') + '" id="tab-tables"></div>';
  html += '<div class="settings-tab-content' + (isStorageTab ? ' active' : '') + '" id="tab-storage">';
  html += renderStorageMigrationPanel(getStatusbarStorageStatus(), _backupListState || undefined, hasRealCharacterContext(), getStoryFloorDiagnostics(), _storageHardResetUi, _storageThoroughResetUi);
  html += '</div>';

  // 重建前捕获滚动位置与已展开区块，重建后恢复（避免点击开关/预设后跳回顶部、折叠全部细节）
  const wasShowing = overlay.classList.contains('show');
  const priorState = _captureSettingsState();
  const restoreToken = ++_settingsRestoreToken;

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  overlay.classList.add('show');
  if (wasShowing) _restoreSettingsState(priorState, restoreToken);
  // 初始化抽奖UI
  refreshGachaUI();

  const persistCharacterWorldbookTemplates = (
    templates: CharacterWorldbookTemplate[],
    activeCreateTemplateId = config.characterWorldbookCreateTemplateId,
  ): void => {
    config.characterWorldbookTemplates = templates;
    config.characterWorldbookCreateTemplateId = activeCreateTemplateId;
    setConfig('characterWorldbookTemplates', templates);
    setConfig('characterWorldbookCreateTemplateId', activeCreateTemplateId);
  };
  const currentCharacterWorldbookLibrary = () => ({
    templates: config.characterWorldbookTemplates,
    activeCreateTemplateId: config.characterWorldbookCreateTemplateId,
  });
  const renderCharacterWorldbookEditor = (viewId: string): void => {
    const container = document.getElementById('characterWorldbookTemplateBody');
    if (!container) return;
    const templates = config.characterWorldbookTemplates;
    const effectiveId = templates.some(t => t.id === viewId) ? viewId : (templates[0]?.id || 'cw-create-default');
    const activeCreateId = config.characterWorldbookCreateTemplateId;
    const options = templates.map(t => '<option value="' + _escAttr(t.id) + '"' + (t.id === effectiveId ? ' selected' : '') + '>'
      + _escAttr(t.name) + (t.builtIn ? '（内置）' : '') + '</option>').join('');
    const current = templates.find(t => t.id === effectiveId) || templates[0];
    if (!current) { container.innerHTML = ''; return; }
    const readOnly = current.builtIn ? ' readonly' : '';
    const disabled = current.builtIn ? ' disabled' : '';
    const isDefault = current.id === activeCreateId;
    const editorHtml = ''
      + '<div class="settings-row" style="gap:8px;align-items:center;">'
      + '<select class="character-worldbook-template-input" id="characterWorldbookTemplateViewSelect">' + options + '</select>'
      + '<button type="button" class="settings-action-btn" data-character-worldbook-template-add>＋新增模板</button>'
      + '</div>'
      + '<div class="settings-row character-worldbook-template-editor" data-character-worldbook-template-id="' + _escAttr(current.id) + '" style="flex-direction:column;align-items:stretch;gap:6px;margin-top:6px;">'
      + '<div class="character-worldbook-template-name-row" style="display:flex;align-items:center;gap:8px;">'
      + '<input class="character-worldbook-template-input" type="text" data-character-worldbook-template-name="' + _escAttr(current.id) + '" value="' + _escAttr(current.name) + '"' + readOnly + ' style="flex:1;">'
      + '<span class="character-worldbook-template-kind">' + (current.builtIn ? '内置' : '自定义') + (isDefault ? ' · 当前默认' : '') + '</span>'
      + '</div>'
      + '<textarea class="character-worldbook-template-input character-worldbook-template-body" data-character-worldbook-template-body="' + _escAttr(current.id) + '"' + readOnly + ' style="min-height:180px;width:100%;box-sizing:border-box;font-family:inherit;">' + _escAttr(current.body) + '</textarea>'
      + '<div class="character-worldbook-template-actions" style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<button type="button" class="settings-action-btn" data-character-worldbook-template-set-default="' + _escAttr(current.id) + '"' + (isDefault ? ' disabled' : '') + '>设为默认</button>'
      + '<button type="button" class="settings-action-btn" data-character-worldbook-template-duplicate="' + _escAttr(current.id) + '">复制并编辑</button>'
      + '<button type="button" class="settings-action-btn" data-character-worldbook-template-delete="' + _escAttr(current.id) + '"' + disabled + '>删除</button>'
      + '</div>'
      + '</div>';
    container.innerHTML = editorHtml;
    bindCharacterWorldbookEditorControls();
  };
  const bindCharacterWorldbookEditorControls = (): void => {
    const overlayEl = document.getElementById('panelOverlay');
    const container = document.getElementById('characterWorldbookTemplateBody');
    if (!overlayEl || !container) return;
    const viewSelect = document.getElementById('characterWorldbookTemplateViewSelect') as HTMLSelectElement | null;
    if (viewSelect) viewSelect.addEventListener('change', function () {
      renderCharacterWorldbookEditor(this.value);
    });
    container.querySelectorAll<HTMLButtonElement>('[data-character-worldbook-template-set-default]').forEach(button => {
      button.addEventListener('click', () => {
        const id = String(button.dataset.characterWorldbookTemplateSetDefault || '');
        persistCharacterWorldbookTemplates(config.characterWorldbookTemplates, id);
        renderCharacterWorldbookEditor(id);
        const summaryStatus = overlayEl.querySelector<HTMLElement>('#characterWorldbookTemplateLibrary .summary-row1 .feature-status');
        if (summaryStatus) {
          const name = config.characterWorldbookTemplates.find(t => t.id === id)?.name || '';
          summaryStatus.textContent = '当前默认：' + name;
        }
      });
    });
    container.querySelectorAll<HTMLInputElement>('[data-character-worldbook-template-name]').forEach(input => {
      input.addEventListener('change', function () {
        saveTemplateField(String(this.dataset.characterWorldbookTemplateName || ''), 'name', this.value, this);
      });
    });
    container.querySelectorAll<HTMLTextAreaElement>('[data-character-worldbook-template-body]').forEach(input => {
      input.addEventListener('change', function () {
        saveTemplateField(String(this.dataset.characterWorldbookTemplateBody || ''), 'body', this.value, this);
      });
    });
    container.querySelectorAll<HTMLButtonElement>('[data-character-worldbook-template-add]').forEach(button => {
      button.addEventListener('click', () => {
        const library = currentCharacterWorldbookLibrary();
        const id = nextCharacterWorldbookTemplateId(library);
        const template: CharacterWorldbookTemplate = {
          id,
          name: '新建角色档案模板',
          body: '<NPC_Generation_Output>\n[在此编写模板]\n</NPC_Generation_Output>',
          builtIn: false,
        };
        persistCharacterWorldbookTemplates([...library.templates, template], id);
        renderCharacterWorldbookEditor(id);
      });
    });
    container.querySelectorAll<HTMLButtonElement>('[data-character-worldbook-template-duplicate]').forEach(button => {
      button.addEventListener('click', () => {
        const source = config.characterWorldbookTemplates.find(template => template.id === button.dataset.characterWorldbookTemplateDuplicate);
        if (!source) return;
        const library = currentCharacterWorldbookLibrary();
        const id = nextCharacterWorldbookTemplateId(library);
        const copy: CharacterWorldbookTemplate = { ...source, id, name: source.name + '（副本）', builtIn: false };
        persistCharacterWorldbookTemplates([...library.templates, copy]);
        renderCharacterWorldbookEditor(id);
      });
    });
    container.querySelectorAll<HTMLButtonElement>('[data-character-worldbook-template-delete]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = String(button.dataset.characterWorldbookTemplateDelete || '');
        const result = removeCharacterWorldbookTemplate(currentCharacterWorldbookLibrary(), id);
        if (!result.ok) {
          getToastr()?.warning(result.error || '无法删除模板', '角色世界书模板');
          return;
        }
        if (!await showConfirmDialog({ message: '确认删除此自定义角色世界书模板？', danger: true })) return;
        persistCharacterWorldbookTemplates(result.library.templates, result.library.activeCreateTemplateId);
        renderCharacterWorldbookEditor('cw-create-default');
      });
    });
  };
  const saveTemplateField = (id: string, field: 'name' | 'body', rawValue: string, input: HTMLInputElement | HTMLTextAreaElement): void => {
    const value = field === 'name' ? rawValue.trim() : rawValue;
    if (!value.trim()) {
      const existing = config.characterWorldbookTemplates.find(template => template.id === id);
      if (existing) input.value = existing[field];
      getToastr()?.warning('模板名称和内容都不能为空', '角色世界书模板');
      return;
    }
    persistCharacterWorldbookTemplates(config.characterWorldbookTemplates.map(template => template.id === id
      ? { ...template, [field]: value }
      : template));
    renderCharacterWorldbookEditor(id);
  };
  renderCharacterWorldbookEditor(config.characterWorldbookCreateTemplateId);

  // 提示词串预设下拉：走 change 监听（overlay.onclick 在 select 打开点击时触发并同步重建面板，会摧毁原生下拉框且收不到 change）
  const presetSelectEl = document.getElementById('portraitPresetSelect') as HTMLSelectElement | null;
  if (presetSelectEl) {
    presetSelectEl.addEventListener('change', function () {
      const imageGeneration = getConfig().imageGeneration;
      const ig = imageGeneration.provider;
      const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
        ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
        : getDefaultPromptPresets(ig.novelai.negativePrompt);
      const preset = presets.find(p => p.id === this.value);
      if (!preset) return;
      imageGeneration.promptPresets = presets;
      imageGeneration.tasks[_imageGenerationUiTask].promptPresetId = preset.id;
      // 先镜像到 ig（旧引用），再归一化：normalizePortraitImageGen 会读取这些值并带入新 provider 对象
      applyPresetToConfig(ig.novelai, preset);
      applyPresetOpenAiToConfig(ig.openai, preset);
      applyPresetComfyToConfig(ig.comfyui, preset);
      imageGeneration.provider = normalizePortraitImageGen(ig);
      config.imageGeneration = normalizeImageGenerationConfig(imageGeneration, config);
      setConfig('imageGeneration', config.imageGeneration);
      // 原地刷新容器内全部控件（三编辑框 + 高级参数），避免 showConfigPanel 整体重建导致跳回顶部/折叠区块
      refreshPresetPanelControls(preset);
      if (_onConfigChanged) _onConfigChanged();
    });
  }

  // 默认负面提示词开关（属于预设）：原生 change 直绑——label 包裹的 checkbox 点文字会原生切换，
  // overlay.onclick 委托只命中点 checkbox 本体、覆盖不了点 label 文字；改动仅提示未保存（需点「保存到预设」落盘）
  const useDefaultNegativeInput = document.getElementById('portraitUseDefaultNegative') as HTMLInputElement | null;
  if (useDefaultNegativeInput) {
    useDefaultNegativeInput.addEventListener('change', function () {
      const hint = document.getElementById('portraitPresetDirtyHint');
      if (hint) hint.textContent = '警告：有未保存改动，点「保存到预设」生效';
    });
  }

  const taskSelectEl = document.getElementById('imageGenerationTaskSelect') as HTMLSelectElement | null;
  if (taskSelectEl) {
    taskSelectEl.addEventListener('change', function () {
      const next = String(this.value) as UnifiedImageTaskType;
      if (!IMAGE_TASK_UI_OPTIONS.some(option => option.id === next)) return;
      _imageGenerationUiTask = next;
      showConfigPanel(config.style, 'api');
    });
  }

  // 智慧姬模型下拉：原生 change 直绑（select 选项目不走 click 委托）；选完即写回智慧姬设置并触发酒馆持久化
  const chatu8ModelSel = document.getElementById('portraitChatu8Model') as HTMLSelectElement | null;
  if (chatu8ModelSel) {
    chatu8ModelSel.addEventListener('change', function () {
      try {
        const applied = setChatu8Model(String(this.value || ''));
        getToastr()?.success?.('智慧姬的模型已设为 ' + (applied || '（空）') + '（' + chatu8ModeLabel(getChatu8Mode()) + '）', '统一生图 API');
      } catch (err: any) {
        getToastr()?.error?.('写智慧姬模型失败：' + (err?.message || err), '统一生图 API');
      }
    });
  }

  // ComfyUI 工作流预设下拉：走 change 监听（overlay.onclick 在 select 打开点击时触发并同步重建面板，会摧毁原生下拉框且收不到 change）
  const wfSelectEl = document.getElementById('portraitComfyWorkflowSelect') as HTMLSelectElement | null;
  if (wfSelectEl) {
    wfSelectEl.addEventListener('change', function () {
      const imageGeneration = getConfig().imageGeneration;
      const ig = imageGeneration.provider;
      if (ig.apiFormat !== 'comfyui') return;
      ig.comfyui.activeWorkflowId = String(this.value || ig.comfyui.activeWorkflowId);
      const presets = ig.comfyui.workflows && ig.comfyui.workflows.length
        ? normalizeComfyWorkflowPresets(ig.comfyui.workflows, getDefaultComfyUiConfig().workflows)
        : getDefaultComfyUiConfig().workflows;
      const active = resolveActiveComfyWorkflow(presets, ig.comfyui.activeWorkflowId);
      imageGeneration.provider = normalizePortraitImageGen(ig);
      config.imageGeneration = normalizeImageGenerationConfig(imageGeneration, config);
      setConfig('imageGeneration', config.imageGeneration);
      // 原地刷新工作流 JSON 编辑框为新预设内容，避免 showConfigPanel 整体重建导致跳回顶部/折叠区块
      const wfTextarea = document.getElementById('portraitComfyWorkflow') as HTMLTextAreaElement | null;
      if (wfTextarea) wfTextarea.value = active.workflow;
      if (_onConfigChanged) _onConfigChanged();
    });
  }

  // 生图间隔 / 上下文条数：数字输入与滑块走原生 input 事件即时保存。
  // overlay.onclick 委托只在「点击输入框」时触发，覆盖不了打字/滚轮/步进箭头/回车等编辑路径。
  const intervalInput = document.getElementById('imageGenerationIntervalInput') as HTMLInputElement | null;
  if (intervalInput) {
    intervalInput.addEventListener('input', function () {
      const normalized = normalizeImageGenerationIntervalSeconds(Number(this.value));
      config.imageGeneration.intervalSeconds = normalized;
      config.imageGenerationIntervalSeconds = normalized;
      setConfig('imageGeneration', config.imageGeneration);
      this.value = String(normalized);
      if (_onConfigChanged) _onConfigChanged();
    });
  }
  const ctxSlider = document.getElementById('portraitContextSlider') as HTMLInputElement | null;
  const ctxInput = document.getElementById('portraitContextInput') as HTMLInputElement | null;
  const commitContextCount = (raw: number): void => {
    const v = Math.max(1, Math.min(10, Math.floor(raw || PORTRAIT_DEFAULT_CONTEXT_COUNT)));
    config.portraitContextCount = v;
    setConfig('portraitContextCount', v);
    if (ctxSlider) ctxSlider.value = String(v);
    if (ctxInput) ctxInput.value = String(v);
  };
  if (ctxSlider) ctxSlider.addEventListener('input', function () { commitContextCount(Number(this.value)); });
  if (ctxInput) ctxInput.addEventListener('input', function () { commitContextCount(Number(this.value)); });

  // 世界演化数字项：原生 range/number 绑 input 直接保存（禁 overlay onclick 陷阱）
  const bindWorldNum = (key: keyof StatusBarConfig, min: number, max: number): void => {
    const slider = document.getElementById(String(key) + 'Slider') as HTMLInputElement | null;
    const input = document.getElementById(String(key) + 'Input') as HTMLInputElement | null;
    const commit = (raw: number): void => {
      let v = Math.floor(raw);
      if (Number.isNaN(v) || v < min) v = min;
      if (v > max) v = max;
      (config as any)[key] = v;
      setConfig(key, v as any);
      if (slider) slider.value = String(v);
      if (input) input.value = String(v);
    };
    if (slider) slider.addEventListener('input', function () { commit(Number(this.value)); });
    if (input) input.addEventListener('input', function () { commit(Number(this.value)); });
  };
  bindWorldNum('worldEvolveEveryTurns', 1, 20);
  bindWorldNum('worldFocusMax', 3, 30);
  bindWorldNum('worldRotationBatch', 1, 20);
  bindWorldNum('worldWbBlueMax', 1, 100);
  bindWorldNum('worldWbGreenMax', 1, 60);
  bindWorldNum('worldContextCount', 1, 30);
  bindWorldNum('worldEvolveMinReply', 1, 2000);
  bindWorldNum('worldChronicleTotal', 10, 100);

  // 正文插图（自动文生图）数字项：嵌套 config.storyImage.*，滑条/数字双向同步 + 钳制落盘
  const bindStoryImageNum = (field: 'maxPerRound' | 'minReplyChars' | 'galleryLimit' | 'insertWidthPercent' | 'renderFloors', min: number, max: number): void => {
    const suffix = field === 'maxPerRound' ? 'MaxPerRound' : field === 'minReplyChars' ? 'MinReply' : field === 'galleryLimit' ? 'GalleryLimit' : field === 'insertWidthPercent' ? 'Width' : 'RenderFloors';
    const slider = document.getElementById('storyImage' + suffix + 'Slider') as HTMLInputElement | null;
    const input = document.getElementById('storyImage' + suffix + 'Input') as HTMLInputElement | null;
    const commit = (raw: number): void => {
      let v = Math.floor(raw);
      if (Number.isNaN(v) || v < min) v = min;
      if (v > max) v = max;
      config.storyImage[field] = v;
      setConfig('storyImage', { ...config.storyImage });
      if (slider) slider.value = String(v);
      if (input) input.value = String(v);
    };
    if (slider) slider.addEventListener('input', function () { commit(Number(this.value)); });
    if (input) input.addEventListener('input', function () { commit(Number(this.value)); });
  };
  bindStoryImageNum('maxPerRound', 1, 10);
  bindStoryImageNum('minReplyChars', 50, 2000);
  bindStoryImageNum('galleryLimit', 20, 500);
  bindStoryImageNum('insertWidthPercent', 20, 100);
  bindStoryImageNum('renderFloors', 0, 20);
  // 宽度滑块：宿主页插图显示宽度实时生效（幂等更新同一条 <style id="ub-story-img-width"> 规则）
  const syncStoryImgWidth = (): void => { applyStoryImageHostWidth(config.storyImage.insertWidthPercent); };
  const storyWidthSlider = document.getElementById('storyImageWidthSlider');
  const storyWidthInput = document.getElementById('storyImageWidthInput');
  storyWidthSlider?.addEventListener('input', syncStoryImgWidth);
  storyWidthInput?.addEventListener('input', syncStoryImgWidth);
  // 渲染楼层：change（拖动结束）才触发摘除——input 每格都跑一次全聊天写回太重
  const pruneOnRenderFloorsChange = (): void => { void pruneStoryImagesOutsideRenderWindow(); };
  const renderFloorsSlider = document.getElementById('storyImageRenderFloorsSlider');
  const renderFloorsInput = document.getElementById('storyImageRenderFloorsInput');
  renderFloorsSlider?.addEventListener('change', pruneOnRenderFloorsChange);
  renderFloorsInput?.addEventListener('change', pruneOnRenderFloorsChange);
  // 图片对齐下拉：原生 change 直绑（select 选项目不走 click 委托）；切换立即重写宿主页注入样式，含已插入的图
  const storyAlignSelect = document.getElementById('storyImageAlignSelect') as HTMLSelectElement | null;
  if (storyAlignSelect) {
    storyAlignSelect.addEventListener('change', function () {
      config.storyImage.insertAlign = this.value === 'center' || this.value === 'right' ? this.value : 'left';
      setConfig('storyImage', { ...config.storyImage });
      applyStoryImageHostWidth(config.storyImage.insertWidthPercent);
    });
  }

  // 正文插图：AI 要求提示词 textarea（change 落盘——每字符 input 会写穿外部存储 patch 队列）。
  // 与内置默认完全一致时存空串：配置跟随后续内置默认升级；一旦修改存用户版本。
  // 一键搬家「搬家后直接进入新聊天」复选框：原生 change 直绑（label 包裹的 checkbox 点文字会原生切换，
  // overlay.onclick 委托只命中点 checkbox 本体，覆盖不了点 label 文字）。
  const moveAutoOpenInput = document.getElementById('ubMoveAutoOpenInput') as HTMLInputElement | null;
  if (moveAutoOpenInput) {
    moveAutoOpenInput.addEventListener('change', function () {
      setConfig('moveChatAutoOpen', this.checked === true);
    });
  }

  // 一键搬家层数：原生 change 直绑（同上：点别处收不到 click，blur 时 change 兜底落盘）。
  // 非法输入不静默：红框闪烁 + 回填当前生效值（钳制区间与 config-store 的 1-999 一致）。
  const moveLayersInput = document.getElementById('ubMoveLayersInput') as HTMLInputElement | null;
  if (moveLayersInput) {
    moveLayersInput.addEventListener('change', function () {
      const val = parseInt(this.value, 10);
      if (Number.isFinite(val) && val >= 1 && val <= 999) {
        setConfig('moveLayers', val);
      } else {
        flashInlineHint(this);
        this.value = String(config.moveLayers);
      }
    });
  }

  // 模式下拉三处：原生 change 直绑——Chrome 原生下拉选择后不派发 click，overlay.onclick 委托
  // 收不到（与上方 portraitPresetSelect 注释同因）。
  const bindModeSelect = (id: string, apply: (sel: HTMLSelectElement) => void): void => {
    document.querySelectorAll<HTMLSelectElement>('#' + id).forEach((sel) => {
      sel.addEventListener('change', () => apply(sel));
    });
  };
  bindModeSelect('mapAutoUpdateModeSelect', (sel) => {
    if (!config.mapEnabled) return;
    config.mapAutoUpdateMode = sel.value as 'off' | 'new-location' | 'location-change' | 'every-turn';
    setConfig('mapAutoUpdateMode', config.mapAutoUpdateMode);
  });
  bindModeSelect('mapLocationConflictSelect', (sel) => {
    if (!config.mapEnabled) return;
    config.mapLocationConflictStrategy = sel.value as 'always-ask' | 'prefer-existing' | 'prefer-current';
    setConfig('mapLocationConflictStrategy', config.mapLocationConflictStrategy);
  });
  bindModeSelect('portraitAutoUpdateModeSelect', (sel) => {
    config.portraitAutoUpdateMode = sel.value as 'off' | 'missing-only' | 'every-turn';
    setConfig('portraitAutoUpdateMode', config.portraitAutoUpdateMode);
    if (_onConfigChanged) _onConfigChanged();
  });

  // 滑条+数字对：原生 input 直绑落盘（overlay.onclick 委托只在点控件本体时保存，
  // 打字/步进后点击别处改值丢失——与 bindWorldNum 同因同解，钳制规则沿用原委托分支）。
  const bindNumPair = (sliderId: string, inputId: string, min: number, max: number, fallback: number, apply: (v: number) => void): void => {
    const slider = document.getElementById(sliderId) as HTMLInputElement | null;
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const commit = (raw: number): void => {
      let v = Math.floor(raw);
      if (Number.isNaN(v)) v = fallback;
      if (v < min) v = min;
      if (v > max) v = max;
      apply(v);
      if (slider) slider.value = String(v);
      if (input) input.value = String(v);
    };
    if (slider) slider.addEventListener('input', function () { commit(Number(this.value)); });
    if (input) input.addEventListener('input', function () { commit(Number(this.value)); });
  };
  bindNumPair('calendarContextSlider', 'calendarContextInput', 1, 30, 10, (v) => {
    config.calendarContextCount = v;
    setConfig('calendarContextCount', v);
  });
  bindNumPair('mapContextSlider', 'mapContextInput', 1, 50, 20, (v) => {
    config.mapContextCount = v;
    setConfig('mapContextCount', v);
  });
  bindNumPair('mapEntriesSlider', 'mapEntriesInput', 1, 20, 8, (v) => {
    config.mapMaxEntries = v;
    setConfig('mapMaxEntries', v);
  });

  // 演化风格方向：选择值按角色卡写角色卡变量（随卡同步）；自定义走全局风格库（草稿 + 显式「保存修改」）
  // 草稿状态随本次面板渲染存活；切换风格/新建/删除前若有未保存改动先确认
  let weDraftId = '';
  let weDraftText = '';
  let weDraftDirty = false;
  const weStyleSel = document.getElementById('worldEvolveStyleSelect') as HTMLSelectElement | null;
  const weEditorEl = document.getElementById('worldEvolveStyleEditor');
  const weNameEl = document.getElementById('worldEvolveStyleName');
  const weTextEl = document.getElementById('worldEvolveStyleCustomInput') as HTMLTextAreaElement | null;
  const weDirtyEl = document.getElementById('worldEvolveStyleDirty');
  const weSaveBtn = document.getElementById('worldEvolveStyleSave') as HTMLButtonElement | null;
  /** 把风格库写回全局配置（唯一出口）。 */
  const weCommitLibrary = (lib: WorldEvolveStyleEntry[]): void => {
    config.worldEvolveStyleLibrary = lib;
    setConfig('worldEvolveStyleLibrary', lib);
  };
  /** 写选择值：有角色卡写该卡的角色卡变量（失败回报、不假装成功），欢迎页写全局默认。 */
  const weWriteSelection = (v: string): boolean => {
    if (weCardKey) {
      if (!writeCardWorldEvolveStyle(v)) {
        getToastr()?.error('无法保存到当前角色卡，请先打开角色卡', '世界演化');
        return false;
      }
      return true;
    }
    config.worldEvolveStyle = v as StatusBarConfig['worldEvolveStyle'];
    setConfig('worldEvolveStyle', v as StatusBarConfig['worldEvolveStyle']);
    return true;
  };
  /** 同步编辑卡：仅当前生效的是「库里的自定义风格」时展开，并把草稿切到该条目。 */
  const weSyncEditor = (active: string): void => {
    const entry = isWorldEvolveCustomKey(active) ? (weLibrary.find(e => e.id === worldEvolveCustomEntryId(active)) || null) : null;
    if (weEditorEl) weEditorEl.style.display = entry ? '' : 'none';
    if (!entry) { weDraftId = ''; weDraftText = ''; weDraftDirty = false; return; }
    if (weDraftId !== entry.id) { weDraftId = entry.id; weDraftText = entry.text; weDraftDirty = false; }
    if (weNameEl) weNameEl.textContent = '风格：' + entry.name;
    if (weTextEl) weTextEl.value = weDraftText;
    if (weDirtyEl) weDirtyEl.style.display = weDraftDirty ? '' : 'none';
    // 禁用态半透明：内联样式拿不到 :disabled，与面板其它禁用态（applyNotifyAlignDisabled）同手法
    if (weSaveBtn) { weSaveBtn.disabled = !weDraftDirty; weSaveBtn.style.opacity = weDraftDirty ? '' : '0.5'; }
  };
  /** 有未保存草稿时先确认；返回 false = 用户取消（保留草稿）。 */
  const weGuardDirty = async (action: string): Promise<boolean> => {
    if (!weDraftDirty) return true;
    const entry = weLibrary.find(e => e.id === weDraftId);
    const ok = await showConfirmDialog({
      message: '风格「' + (entry ? entry.name : '') + '」有未保存的修改。' + action + '后这些改动会丢失。',
      danger: true,
    });
    if (ok) weDraftDirty = false;
    return ok;
  };
  const weRefreshSelect = (selected: string): void => {
    if (!weStyleSel) return;
    weStyleSel.innerHTML = weSelectOptionsHtml(selected);
    weStyleSel.value = selected;
  };
  /** 新建风格条目（命名 → 去重 → 入库）；返回 null = 取消/校验失败。 */
  const weCreateEntry = async (seedText: string): Promise<WorldEvolveStyleEntry | null> => {
    const input = await showPromptDialog({ title: '新建自定义风格', message: '请输入风格名称（例如「朝堂暗流」）：' });
    if (input === null) return null;
    const name = input.trim().slice(0, WORLD_EVOLVE_STYLE_NAME_MAX);
    if (!name) { getToastr()?.warning('风格名称不能为空', '世界演化'); return null; }
    if (weLibrary.some(e => e.name === name)) { getToastr()?.warning('已存在同名风格，请换一个名称', '世界演化'); return null; }
    if (weLibrary.length >= WORLD_EVOLVE_LIBRARY_MAX) { getToastr()?.warning('自定义风格最多 ' + WORLD_EVOLVE_LIBRARY_MAX + ' 条', '世界演化'); return null; }
    const entry: WorldEvolveStyleEntry = { id: nextWorldEvolveStyleId(), name, text: seedText.slice(0, WORLD_EVOLVE_STYLE_TEXT_MAX) };
    weLibrary = weLibrary.concat([entry]);
    weCommitLibrary(weLibrary);
    return entry;
  };
  /** 选中一个风格值（写选择 + 刷新下拉与编辑卡 + 提示）；写失败则不改界面选择。 */
  const weApplySelection = (v: string): void => {
    if (!weWriteSelection(v)) {
      weRefreshSelect(weSelection);
      return;
    }
    weSelection = v;
    weRefreshSelect(v);
    weSyncEditor(v);
    getToastr()?.success((weCardKey ? '已为当前角色卡保存：' : '已更新全局默认：') + weLabelOf(v), '世界演化');
  };
  if (weStyleSel) {
    weStyleSel.addEventListener('change', () => {
      const v = weStyleSel.value;
      void (async (): Promise<void> => {
        if (v === '__new') {
          weStyleSel.value = weSelection;
          if (!await weGuardDirty('新建风格')) return;
          const entry = await weCreateEntry('');
          if (!entry) return;
          weApplySelection(worldEvolveCustomKey(entry.id));
          getToastr()?.info('写完要求后点「保存修改」生效', '世界演化');
          return;
        }
        if (!hasWorldEvolveStyle(v, weLibrary)) { weStyleSel.value = weSelection; return; }
        if (!await weGuardDirty('切换风格')) { weStyleSel.value = weSelection; return; }
        weApplySelection(v);
      })();
    });
  }
  if (weTextEl) {
    weTextEl.addEventListener('input', () => {
      weDraftText = weTextEl.value;
      const entry = weLibrary.find(e => e.id === weDraftId);
      weDraftDirty = !!entry && entry.text !== weDraftText;
      if (weDirtyEl) weDirtyEl.style.display = weDraftDirty ? '' : 'none';
      if (weSaveBtn) { weSaveBtn.disabled = !weDraftDirty; weSaveBtn.style.opacity = weDraftDirty ? '' : '0.5'; }
    });
  }
  const weSaveNow = document.getElementById('worldEvolveStyleSave');
  if (weSaveNow) {
    weSaveNow.addEventListener('click', () => {
      const entry = weLibrary.find(e => e.id === weDraftId);
      if (!entry) return;
      weLibrary = weLibrary.map(e => (e.id === entry.id ? { id: e.id, name: e.name, text: weDraftText } : e));
      weCommitLibrary(weLibrary);
      weDraftDirty = false;
      weSyncEditor(weSelection);
      getToastr()?.success('已保存风格「' + entry.name + '」；用到它的角色卡下一轮演化生效', '世界演化');
    });
  }
  const weSaveAsBtn = document.getElementById('worldEvolveStyleSaveAs');
  if (weSaveAsBtn) {
    weSaveAsBtn.addEventListener('click', () => {
      void (async (): Promise<void> => {
        const entry = await weCreateEntry(weDraftText);
        if (!entry) return;
        weApplySelection(worldEvolveCustomKey(entry.id));
      })();
    });
  }
  const weRenameBtn = document.getElementById('worldEvolveStyleRename');
  if (weRenameBtn) {
    weRenameBtn.addEventListener('click', () => {
      void (async (): Promise<void> => {
        const entry = weLibrary.find(e => e.id === weDraftId);
        if (!entry) return;
        const input = await showPromptDialog({ title: '重命名风格', message: '请输入新的风格名称：', defaultValue: entry.name });
        if (input === null) return;
        const name = input.trim().slice(0, WORLD_EVOLVE_STYLE_NAME_MAX);
        if (!name) { getToastr()?.warning('风格名称不能为空', '世界演化'); return; }
        if (name === entry.name) return;
        if (weLibrary.some(e => e.id !== entry.id && e.name === name)) { getToastr()?.warning('已存在同名风格，请换一个名称', '世界演化'); return; }
        weLibrary = weLibrary.map(e => (e.id === entry.id ? { id: e.id, name, text: e.text } : e));
        weCommitLibrary(weLibrary);
        weSyncEditor(weSelection);
        weRefreshSelect(weSelection);
        getToastr()?.success('已更名为「' + name + '」', '世界演化');
      })();
    });
  }
  const weDeleteBtn = document.getElementById('worldEvolveStyleDelete');
  if (weDeleteBtn) {
    weDeleteBtn.addEventListener('click', () => {
      void (async (): Promise<void> => {
        const entry = weLibrary.find(e => e.id === weDraftId);
        if (!entry) return;
        const styleKey = worldEvolveCustomKey(entry.id);
        // 按卡选择存在各角色卡自己身上（角色卡变量），无法在别处枚举引用者：
        // 删除后仍引用它的卡在下次解析时判定悬空 → 自动回退全局默认（resolveWorldEvolveStyle 语义）。
        const message = '确认删除风格「' + entry.name + '」？此操作不可撤销。\n\n已选用它的角色卡会自动回退到全局默认。';
        if (!await showConfirmDialog({ message, danger: true })) return;
        weLibrary = weLibrary.filter(e => e.id !== entry.id);
        weCommitLibrary(weLibrary);
        if (config.worldEvolveStyle === styleKey) {
          config.worldEvolveStyle = 'general';
          setConfig('worldEvolveStyle', 'general');
        }
        weDraftId = '';
        weDraftText = '';
        weDraftDirty = false;
        // 删除后重算生效选择：按卡 → 全局默认 → 通用（本卡悬空则回落全局默认）
        const own = readCardWorldEvolveStyle();
        const ownOk = own !== '' && hasWorldEvolveStyle(own, weLibrary);
        weSelection = ownOk
          ? own
          : (hasWorldEvolveStyle(config.worldEvolveStyle, weLibrary) ? config.worldEvolveStyle : 'general');
        weRefreshSelect(weSelection);
        weSyncEditor(weSelection);
        getToastr()?.success('已删除风格「' + entry.name + '」；已选用它的角色卡下次演化自动回退到全局默认', '世界演化');
      })();
    });
  }
  weSyncEditor(weSelection);

  // 通知效果 / 通知显示位置：下拉直绑 change（select 不走 overlay 点击委托）。
  // 效果切换原地联动位置下拉的禁用态，避免 showConfigPanel 整体重建导致面板重置/跳顶。
  const notifyEffectSel = document.getElementById('notifyEffectSelect') as HTMLSelectElement | null;
  const notifyAlignSel = document.getElementById('notifyAlignSelect') as HTMLSelectElement | null;
  const applyNotifyAlignDisabled = (): void => {
    const disabled = config.notifyEffect === 'original';
    if (notifyAlignSel) {
      notifyAlignSel.disabled = disabled;
      notifyAlignSel.style.opacity = disabled ? '0.5' : '';
      notifyAlignSel.style.cursor = disabled ? 'not-allowed' : '';
      notifyAlignSel.style.pointerEvents = disabled ? 'none' : '';
    }
    const row = document.getElementById('notifyAlignRow');
    if (row) {
      row.style.opacity = disabled ? '0.5' : '';
      row.style.pointerEvents = disabled ? 'none' : '';
    }
  };
  if (notifyEffectSel) {
    notifyEffectSel.addEventListener('change', function () {
      const v = this.value;
      if (v !== 'porcelain' && v !== 'inkglass' && v !== 'auto' && v !== 'original') { this.value = config.notifyEffect; return; }
      config.notifyEffect = v;
      setConfig('notifyEffect', v);
      applyNotifyAlignDisabled();
      if (_onConfigChanged) _onConfigChanged(); // 触发 index.ts setNotifyBeautifyEnabled
    });
  }
  if (notifyAlignSel) {
    notifyAlignSel.addEventListener('change', function () {
      const v = this.value;
      if (v !== 'left' && v !== 'center' && v !== 'right') { this.value = config.notifyAlign; return; }
      config.notifyAlign = v;
      setConfig('notifyAlign', v);
      if (_onConfigChanged) _onConfigChanged(); // 触发 index.ts setNotifyBeautifyEnabled 同步父文档容器
    });
  }
  applyNotifyAlignDisabled();

  // AI 进行中通知常驻（默认关）：只影响酒馆 toast 的生存期，主界面提示条不受影响。
  const aiNoticePersistToggle = document.getElementById('aiNoticePersistToggle') as HTMLButtonElement | null;
  if (aiNoticePersistToggle) {
    aiNoticePersistToggle.addEventListener('click', function () {
      const next = !(getConfig().aiNoticePersist === true);
      config.aiNoticePersist = next;
      setConfig('aiNoticePersist', next);
      this.classList.toggle('on', next);
      if (_onConfigChanged) _onConfigChanged();
    });
  }

  // 统一生图配置收集器：读取 API 标签页控件，写入 imageGeneration；旧 portraitImageGen 仅作为兼容别名。
  const collectPortraitImageGen = (): void => {
    const imageGeneration = config.imageGeneration;
    const ig = imageGeneration.provider;
    const task = imageGeneration.tasks[_imageGenerationUiTask];
    if (ig.apiFormat === 'novelai') {
      ig.novelai.url = String($('#portraitUrl').val() || '');
      ig.novelai.key = String($('#portraitKey').val() || '');
      const sizeVal = String($('#portraitSize').val() || '');
      if (sizeVal && sizeVal !== 'custom') { const parts = sizeVal.split('x').map(Number); task.width = parts[0]; task.height = parts[1]; }
      else { task.width = Number($('#portraitWidth').val()) || task.width; task.height = Number($('#portraitHeight').val()) || task.height; }
    } else if (ig.apiFormat === 'openai') {
      ig.openai.url = String($('#portraitUrl').val() || '');
      ig.openai.key = String($('#portraitKey').val() || '');
      task.aspectRatio = String($('#portraitAspect').val() || task.aspectRatio);
    } else if (ig.apiFormat === 'comfyui') {
      ig.comfyui.url = String($('#portraitUrl').val() || '');
      ig.comfyui.timeoutSeconds = Number($('#portraitComfyTimeout').val()) || ig.comfyui.timeoutSeconds;
      task.width = Number($('#portraitComfyWidth').val()) || task.width;
      task.height = Number($('#portraitComfyHeight').val()) || task.height;
      // 工作流预设：把当前 textarea 内容写回激活预设。
      // 写回目标用已存储的 activeWorkflowId（与 textarea 始终同步），而非下拉框的瞬时值——
      // 切换预设时浏览器可能先派发 click/input 再派发 change，此时下拉框已指向新预设、
      // textarea 仍展示旧预设内容，若按下拉框值写回会把旧工作流覆盖进新预设，使切换不生效。
      const wfText = String($('#portraitComfyWorkflow').val() || '');
      const activeId = ig.comfyui.activeWorkflowId;
      const presets = ig.comfyui.workflows && ig.comfyui.workflows.length ? ig.comfyui.workflows : getDefaultComfyUiConfig().workflows;
      ig.comfyui.workflows = presets.map((wf) => {
        if (wf.id === activeId) {
          const resolved = wfText.trim() ? wfText : DEFAULT_COMFY_WORKFLOW_JSON;
          return { ...wf, workflow: resolved, fingerprint: computeComfyFingerprint(resolved) };
        }
        return wf;
      });
    }
    // 提示词模式/自然语言输出属于预设（预设容器内改动经「保存到预设」落盘），此处不再回写全局值
    imageGeneration.provider = normalizePortraitImageGen(ig);
    config.imageGeneration = normalizeImageGenerationConfig(imageGeneration, config);
    setConfig('imageGeneration', config.imageGeneration);
  };

  // 表格 tab 初始即激活时首次渲染
  if (isTablesTab) {
    const tblContainer = document.getElementById('tab-tables');
    if (tblContainer) tblContainer.innerHTML = renderTablesTab();
  }

  // 事件绑定
  overlay.onclick = async function (e) {
    if (e.target === overlay || (e.target as HTMLElement).id === 'settingsClose') {
      overlay.classList.remove('show');
      releaseBackGuardIfIdle();
      return;
    }

    const el = e.target as HTMLElement;
    // 阻止点 summary 内 toggle/帮助触发 details 原生折叠
    if (el.closest('summary') && (el.closest('.settings-toggle') || el.closest('.help-tip-btn'))) {
      e.preventDefault();
    }
    const id = el.id || '';

    // 标签页切换 - 支持点击标签页内任何位置
    const tabElement = el.closest('.settings-tab');
    if (tabElement) {
      const tabName = (tabElement as HTMLElement).dataset.tab;

      // 更新标签页按钮状态
      const allTabs = overlay.querySelectorAll('.settings-tab');
      allTabs.forEach(tab => {
        tab.classList.remove('active');
        if ((tab as HTMLElement).dataset.tab === tabName) {
          tab.classList.add('active');
        }
      });

      // 更新标签页内容显示
      const allContents = overlay.querySelectorAll('.settings-tab-content');
      allContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === 'tab-' + tabName) {
          content.classList.add('active');
        }
      });

      // 表格 tab 懒加载：首次切到时渲染
      if (tabName === 'tables') {
        const tblContainer = document.getElementById('tab-tables');
        if (tblContainer && !tblContainer.innerHTML.trim()) {
          tblContainer.innerHTML = renderTablesTab();
        }
      }

      return;
    }

    const refreshStoragePanel = (): void => {
      const container = document.getElementById('tab-storage');
      if (container) container.innerHTML = renderStorageMigrationPanel(getStatusbarStorageStatus(), _backupListState || undefined, hasRealCharacterContext(), getStoryFloorDiagnostics(), _storageHardResetUi, _storageThoroughResetUi);
    };
    const refreshBackupList = async (): Promise<void> => {
      const s = await listStoryBackups();
      _backupListState = { backups: s.list, ready: s.ready };
      const container = document.getElementById('tab-storage');
      if (container) container.innerHTML = renderStorageMigrationPanel(getStatusbarStorageStatus(), _backupListState, hasRealCharacterContext(), getStoryFloorDiagnostics(), _storageHardResetUi, _storageThoroughResetUi);
    };
    if (id === 'ubStorageResetStoryThorough') {
      const resetIdentity = getStatusbarStorageStatus().identity;
      const resetable = resetIdentity.kind === 'ready'
        || (resetIdentity.kind === 'read-only' && !!resetIdentity.storageId);
      if (!resetable) {
        getToastr()?.error('当前聊天存储身份未就绪，无法重置', '外部存储');
        return;
      }
      if (!await showConfirmDialog({
        message: '确定重置当前聊天的全部状态栏数据？\n\n将删除本聊天的剧情、地图、立绘存储文件，并清除本聊天的全部备份快照，然后从空档重新开始。经期、日历、商店、衣柜穿搭、世界演化等本聊天数据将全部清空，不可撤销。\n\n全局偏好、成就簿、仓库、衣柜目录、正文图库，以及其他聊天的数据都不受影响。',
        danger: true,
      })) return;
      // 先清 cycle 权威缓存：重置后的就绪自动化会补跑 handleCycleTick，
      // 若缓存仍在，旧内存记录会被重新落盘（复活被清空的数据）。
      invalidateCycleStoreCache();
      _storageThoroughResetUi = { phase: 'running', message: '重置中…' };
      refreshStoragePanel();
      try {
        const resetResult = await resetCurrentChatThoroughly();
        _storageThoroughResetUi = resetResult.ok
          ? { phase: 'done' }
          : { phase: 'error', error: resetResult.error || '重置失败' };
        getToastr()?.[resetResult.ok ? 'success' : 'error'](
          resetResult.ok ? '当前聊天状态栏数据已清空并重新初始化' : (resetResult.error || '重置失败'),
          '外部存储',
        );
        if (resetResult.ok) {
          emitUbEvent(UB_EVENT.storyStateInvalidated);
          try { (window as any).__ubTriggerRender?.(); } catch (_e) { /* ignore */ }
        }
      } catch (error) {
        _storageThoroughResetUi = { phase: 'error', error: String(error instanceof Error ? error.message : error) };
      }
      refreshStoragePanel();
      return;
    }
    if (id === 'ubStorageHardReset') {
      if (hasRealCharacterContext()) return; // 防御性二次守卫（按钮已置灰）
      if (!await showConfirmDialog({
        message: '确定彻底重置外部存储？\n\n将清除所有聊天中的状态栏标记，并删除全部外部存储文件（剧情、地图、立绘、备份、偏好、成就簿、仓库、衣柜目录）。所有状态栏数据将从零开始，此操作不可恢复。不影响酒馆聊天记录本身与 API 密钥。\n\n执行完成后请立即刷新酒馆（F5）。',
        danger: true,
      })) return;
      _storageHardResetUi = { phase: 'running', message: '准备中…' };
      refreshStoragePanel();
      await flushStatusbarStorage(); // 排空 write-behind，避免执行期间旧数据重新落盘
      try {
        const report = await runStorageHardReset({ onProgress: (message, current, total) => {
          _storageHardResetUi = { phase: 'running', message: total > 0 ? `${message} ${current}/${total}` : message };
          refreshStoragePanel();
        } });
        const summary = `已清除 ${report.chatsStripped} 个聊天标记（失败 ${report.chatsFailed}），删除 ${report.filesDeleted} 个存储文件（失败 ${report.filesFailed}）`;
        _storageHardResetUi = (report.chatsFailed || report.filesFailed)
          ? { phase: 'error', error: `${summary}。${report.errors.slice(0, 3).join('；')}` }
          : { phase: 'done', reportSummary: summary };
        getToastr()?.[(report.chatsFailed || report.filesFailed) ? 'warning' : 'success'](
          `${summary}。请立即刷新酒馆（F5）。`, '存储重置',
        );
      } catch (error) {
        _storageHardResetUi = { phase: 'error', error: String(error instanceof Error ? error.message : error) };
      }
      refreshStoragePanel();
      return;
    }
    if (id === 'ubStorageGlobalManage') {
      try {
        const { showStorageGlobalManagerPopup } = await import('../renderers/storage-global-manager-popup');
        await showStorageGlobalManagerPopup();
      } catch (error) {
        getToastr()?.error(`打开外部存储管理失败：${error instanceof Error ? error.message : String(error)}`, '外部存储');
      }
      return;
    }
    if (id === 'ubStorageResetStory') {
      const resetIdentity = getStatusbarStorageStatus().identity;
      const resetable = resetIdentity.kind === 'ready'
        || (resetIdentity.kind === 'read-only' && !!resetIdentity.storageId);
      if (!resetable) {
        getToastr()?.error('当前聊天存储身份未就绪，无法重置', '外部存储');
        return;
      }
      if (!await showConfirmDialog({
        message: '确定重置当前聊天的存储？\n\n将删除本聊天的剧情、地图与立绘存储文件，并清除「域已创建」标记。经期、日历、商店、衣柜穿搭、世界演化等本聊天数据将全部清空，不可撤销。备份快照不受影响，仍可恢复。',
        danger: true,
      })) return;
      // 先清 cycle 权威缓存：重置后的就绪自动化会补跑 handleCycleTick，
      // 若缓存仍在，旧内存记录会被重新落盘（复活被清空的数据）。
      invalidateCycleStoreCache();
      const resetResult = await resetCurrentChatStoryStorage();
      getToastr()?.[resetResult.ok ? 'success' : 'error'](
        resetResult.ok ? '聊天存储已重置，正在重新初始化…' : (resetResult.error || '重置失败'),
        '外部存储',
      );
      if (resetResult.ok) {
        emitUbEvent(UB_EVENT.storyStateInvalidated);
        try { (window as any).__ubTriggerRender?.(); } catch (_e) { /* ignore */ }
      }
      refreshStoragePanel();
      return;
    }

    // 备份管理事件
    if (id === 'ubTplPresetImportBtn') {
      const { showTemplateImportPresetPopup } = await import('../renderers/db-template-repair-popup');
      const { importTemplateAsGlobalPreset } = await import('../core/db-template-repair');
      showTemplateImportPresetPopup(async (variant, subtitle) => {
        getToastr()?.info('导入中…', '模板导入');
        const r = await importTemplateAsGlobalPreset(variant);
        if (r.ok) {
          getToastr()?.success(`已把「${r.presetName}」存为全局预设并设为默认（${subtitle}）`, '模板导入');
        } else {
          getToastr()?.error(r.error || '导入失败', '模板导入');
        }
      });
      return;
    }
    if (id === 'ubBackupNowBtn' || (el.closest && el.closest('#ubBackupNowBtn'))) {
      const ok = await manualBackupStory();
      getToastr()?.[ok ? 'success' : 'error'](
        ok ? '备份已创建' : '备份失败（存储系统未就绪）',
        '外部存储',
      );
      void refreshBackupList();
      return;
    }
    if (id.startsWith('ubBackupRestore-') || (el.closest && el.closest('[id^="ubBackupRestore-"]'))) {
      const file = id.replace('ubBackupRestore-', '') || (el.closest?.('[id^="ubBackupRestore-"]')?.id || '').replace('ubBackupRestore-', '');
      if (!file) return;
      if (!await showConfirmDialog({ message: `确定恢复备份 ${file}？当前聊天状态将被覆盖，回滚历史将清空，从备份点重新开始。` })) return;
      const ok = await restoreStoryBackup(file);
      getToastr()?.[ok ? 'success' : 'error'](
        ok ? '备份已恢复，回滚历史已清空' : '恢复失败',
        '外部存储',
      );
      void refreshBackupList();
      // 通知外部状态栏重渲染
      try { (window as any).__ubTriggerRender?.(); } catch (_e) { /* ignore */ }
      return;
    }
    if (id.startsWith('ubBackupDelete-') || (el.closest && el.closest('[id^="ubBackupDelete-"]'))) {
      const file = id.replace('ubBackupDelete-', '') || (el.closest?.('[id^="ubBackupDelete-"]')?.id || '').replace('ubBackupDelete-', '');
      if (!file) return;
      if (!await showConfirmDialog({ message: `确定删除备份 ${file}？此操作不可撤销。`, danger: true })) return;
      const ok = await deleteStoryBackup(file);
      getToastr()?.[ok ? 'success' : 'error'](
        ok ? '备份已删除' : '删除失败',
        '外部存储',
      );
      void refreshBackupList();
      return;
    }
    if (id === 'ubBackupIntervalInput' || (el.closest && el.closest('#ubBackupIntervalInput'))) {
      const val = parseInt((el as HTMLInputElement).value, 10);
      if (val > 0) setConfig('storyBackupInterval', val);
      return;
    }

    // 一键搬家
    if (id === 'ubMoveChatBtn' || (el.closest && el.closest('#ubMoveChatBtn'))) {
      if (!hasRealCharacterContext()) {
        getToastr()?.error('请在角色卡聊天中使用一键搬家', '一键搬家');
        return;
      }
      const relocation = await import('../core/chat-relocation');
      if (!relocation.isRelocationSupported()) {
        getToastr()?.error('当前数据库版本不支持一键搬家，仅最新定制版数据库支持', '一键搬家');
        return;
      }
      const layers = getConfig().moveLayers || 10;
      const autoOpen = getConfig().moveChatAutoOpen === true;
      if (!await showConfirmDialog({
        message: `确定把当前聊天最后 ${layers} 层 AI 楼层搬到新聊天？\n\n新聊天将带全新外部存储（数据库固化为一个完整快照、外部存储底账折叠到切割层），原聊天与原外部存储完全不动。${autoOpen ? '搬家完成后将自动切换进入新聊天。' : '完成后请到该角色的聊天列表里打开新聊天。'}`,
      })) return;
      getToastr()?.info('正在搬家…', '一键搬家');
      try {
        const r = await relocation.relocateChat(layers, autoOpen);
        if (r.ok) {
          if (r.historyFlattened) {
            // 模板修复收敛过历史帧 → 切割层之前无基线可回放，兜底改用末层整库快照
            getToastr()?.info('该聊天的数据库历史已被「数据库模板修复」收敛到最新楼层，切割层之前没有快照可回放，已改用当前最新整库快照作为新聊天的起始状态（数据库状态与末尾楼层一致，不再逐层回放）。', '一键搬家');
          }
          if (r.error) {
            // 搬家成功但自动切换失败：提示手动打开
            getToastr()?.warning(r.error, '一键搬家');
          } else if (autoOpen) {
            getToastr()?.success(`已创建新聊天「${r.newChatId}」并已切换进入。`, '一键搬家');
          } else {
            getToastr()?.success(`已创建新聊天「${r.newChatId}」，请到该角色聊天列表打开它。`, '一键搬家');
          }
        } else {
          getToastr()?.error(r.error || '搬家失败', '一键搬家');
        }
      } catch (error) {
        getToastr()?.error(`搬家异常：${error instanceof Error ? error.message : String(error)}`, '一键搬家');
      }
      return;
    }
    // ubMoveLayersInput / ubMoveAutoOpenInput 走原生 change 直绑（见 bindWorldNum 旁），不在此委托处理

    // 表格 tab：退役页（台账模式）的「打开瑟瑟台账工作台」按钮
    if (id === 'ubLedgerWorkbenchBtn' || el.closest('#ubLedgerWorkbenchBtn')) {
      if (!openLedgerWorkbench()) getToastr()?.warning('瑟瑟台账未就绪（脚本未装载或已卸载）', '表格');
      return;
    }

    // 表格 tab：数据库模板修复
    if (id === 'ubDbRepairBtn' || el.closest('#ubDbRepairBtn')) {
      const { ensureStandardTemplate } = await import('../core/db-standard-template');
      const { buildRepairPlanFromCurrent } = await import('../core/db-template-repair');
      // 惰性装载（O39）：先等标准模板就绪再比对，否则空标准会把所有表判成「多余表」
      await ensureStandardTemplate();
      const r = buildRepairPlanFromCurrent();
      if (!r.plan) { getToastr()?.error(r.error || '读取失败', '数据库模板修复'); return; }
      const { showDbRepairPopup } = await import('../renderers/db-template-repair-popup');
      showDbRepairPopup(r.plan);
      return;
    }

    // 表格 tab：数据库模板修复（无角色过滤版，兼容不支持角色过滤的老版本数据库插件）
    if (id === 'ubDbRepairNoFilterBtn' || el.closest('#ubDbRepairNoFilterBtn')) {
      const { ensureStandardTemplate } = await import('../core/db-standard-template');
      const { buildRepairPlanFromCurrent, NO_FILTER_REPAIR } = await import('../core/db-template-repair');
      // 先就绪再取 NO_FILTER_REPAIR.template（getter 实时派生），避免取到未装载时的空模板
      await ensureStandardTemplate();
      const r = buildRepairPlanFromCurrent(NO_FILTER_REPAIR.template);
      if (!r.plan) { getToastr()?.error(r.error || '读取失败', '数据库模板修复'); return; }
      const { showDbRepairPopup } = await import('../renderers/db-template-repair-popup');
      showDbRepairPopup(r.plan, NO_FILTER_REPAIR);
      return;
    }

    // 表格 tab：数据库模板修复（导入任意模板——本地文件 / 已有预设）
    if (id === 'ubDbRepairImportBtn' || el.closest('#ubDbRepairImportBtn')) {
      const { showDbImportChooserPopup } = await import('../renderers/db-template-repair-popup');
      showDbImportChooserPopup(async (template, subtitle) => {
        const { buildRepairPlanFromCurrent } = await import('../core/db-template-repair');
        const r = buildRepairPlanFromCurrent(template);
        if (!r.plan) { getToastr()?.error(r.error || '读取失败', '数据库模板修复'); return; }
        const { showDbRepairPopup } = await import('../renderers/db-template-repair-popup');
        showDbRepairPopup(r.plan, { template, subtitle, saveAsGlobalPreset: false });
      });
      return;
    }

    // 表格 tab：年龄->生日转换（临时工具，未来删除：把旧库存量「XX岁」残留按当前日期+年龄随机生成生日替换。
    // 新库全面覆盖后，连同上方按钮区块与 core/age-to-birthday-migration.ts 一起整体删除。）
    if (id === 'ubAgeToBirthdayBtn' || el.closest('#ubAgeToBirthdayBtn')) {
      const { convertResidualAgeToBirthday } = await import('../core/age-to-birthday-migration');
      if (!await showConfirmDialog({
        message: '把 主角信息表/恋爱对象表/重要角色表 三张表生日列里残留的“XX岁”，按剧情当前日期+该年龄随机生成一个生日（YYYY-MM-DD）替换？\n\n已是日期的生日值不会动；写入不可自动撤销。',
      })) return;
      getToastr()?.info('正在扫描三张角色表…', '年龄->生日转换');
      const r = await convertResidualAgeToBirthday();
      // F3：无游戏日期时的整单取消（changed/failed 均 0）——按取消语义提示，不误报「无残留」
      if (!r.ok && r.changed === 0 && r.failed === 0 && r.details.length) {
        getToastr()?.warning(r.details[0], '年龄->生日转换');
        return;
      }
      if (r.changed > 0) {
        getToastr()?.success(`已替换 ${r.changed} 处残留年龄为随机生日`, '年龄->生日转换');
      } else if (r.failed === 0) {
        getToastr()?.info('未发现年龄残留（三表生日列没有“XX岁”形态的值）', '年龄->生日转换');
      }
      if (r.failed > 0) {
        getToastr()?.warning(`${r.failed} 处生成或写入失败，明细见浏览器控制台`, '年龄->生日转换');
      }
      return;
    }

    // 表格 tab：分组模式切换（分组版 / 非分组版）
    const tblModeBtn = el.closest('.tbl-mode-btn');
    if (tblModeBtn) {
      const mode = (tblModeBtn.getAttribute('data-mode') === 'flat' ? 'flat' : 'grouped') as 'grouped' | 'flat';
      const segBtns = overlay.querySelectorAll<HTMLButtonElement>('.tbl-mode-btn');
      segBtns.forEach(b => { b.disabled = true; });
      const r = await setAllTableGroups(mode);
      segBtns.forEach(b => { b.disabled = false; });
      if (r.ok) {
        setConfig('tableGroupMode', mode);
        getToastr()?.success(
          mode === 'flat' ? '已切换为非分组版（所有表归分组1）' : '已切换为分组版（恢复预设分组）',
          '表格',
        );
        // 数据库插件切换分组已重建聊天表单指南（chat_override 钉当前聊天）；若再重填模板/指南层，
        // 指南会按标准模板重建并覆写运行时 updateConfig，此次分组切换即被还原。
        getToastr()?.warning('本层请勿重填，否则配置修改会被还原', '提醒');
      } else {
        getToastr()?.error(r.error || '操作失败', '表格');
      }
      const tblContainer = document.getElementById('tab-tables');
      if (tblContainer) tblContainer.innerHTML = renderTablesTab();
      return;
    }

    // 表格 tab：开关按钮
    const tblToggle = el.closest('.tbl-toggle');
    if (tblToggle) {
      const sheetKey = tblToggle.getAttribute('data-sheet-key') || '';
      const action = tblToggle.getAttribute('data-action') || '';
      const tblContainer = document.getElementById('tab-tables');
      if (action === 'open') {
        tblToggle.textContent = '...';
        (tblToggle as HTMLButtonElement).disabled = true;
        const r = await setTableClosed(sheetKey, false);
        if (r.ok) { getToastr()?.success('已开启该表', '表格'); getToastr()?.warning('本层请勿重填，否则配置修改会被还原', '提醒'); }
        else { getToastr()?.error(r.error || '操作失败', '表格'); }
        if (tblContainer) tblContainer.innerHTML = renderTablesTab();
      } else if (action === 'close') {
        // 找到表名用于告警文案
        const rows = readTableStatuses();
        const row = rows.find(r => r.sheetKey === sheetKey);
        const impacts = row ? getCloseImpact(row.name) : ['该表关闭后相关数据将不再更新'];
        const msg = '关闭「' + (row?.name || sheetKey) + '」？\n\n关闭后影响：\n' + impacts.map(s => '• ' + s).join('\n') + '\n\n确认关闭？';
        if (!await showConfirmDialog({ message: msg })) return;
        tblToggle.textContent = '...';
        (tblToggle as HTMLButtonElement).disabled = true;
        const r = await setTableClosed(sheetKey, true);
        if (r.ok) { getToastr()?.success('已关闭该表', '表格'); getToastr()?.warning('本层请勿重填，否则配置修改会被还原', '提醒'); }
        else { getToastr()?.error(r.error || '操作失败', '表格'); }
        if (tblContainer) tblContainer.innerHTML = renderTablesTab();
      }
      return;
    }

    // 表格 tab：警告 emoji（状态不一致，点击修正）
    const warnEmoji = el.closest('.tbl-warn-emoji');
    if (warnEmoji) {
      const sheetKey = warnEmoji.getAttribute('data-sheet-key') || '';
      const rows = readTableStatuses();
      const row = rows.find(r => r.sheetKey === sheetKey);
      if (!row) return;
      const msg = '该表状态异常（分组=' + row.groupId + '，频率=' + row.updateFrequency + '）。\n应为关闭态：分组 3，频率 0。\n\n是否修正为关闭状态？';
      if (!await showConfirmDialog({ message: msg })) return;
      const r = await fixInconsistent(sheetKey);
      if (r.ok) { getToastr()?.success('已修正为关闭状态', '表格'); getToastr()?.warning('本层请勿重填，否则配置修改会被还原', '提醒'); }
      else { getToastr()?.error(r.error || '修正失败', '表格'); }
      const tblContainer = document.getElementById('tab-tables');
      if (tblContainer) tblContainer.innerHTML = renderTablesTab();
      return;
    }

    // 玩法表初始化检查已取消，玩法通过世界书条目管理

    // 帮助提示总开关
    if (id === 'helpTipsToggle' || el.closest('#helpTipsToggle')) {
      config.showHelpTips = !config.showHelpTips;
      setConfig('showHelpTips', config.showHelpTips);
      const btn = document.getElementById('helpTipsToggle');
      if (btn) btn.classList.toggle('on', config.showHelpTips);
      const sp = document.querySelector('.settings-popup');
      if (sp) sp.classList.toggle('hide-help', !config.showHelpTips);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 悬浮配置按钮显示开关
    if (id === 'floatingBtnToggle' || el.closest('#floatingBtnToggle')) {
      config.showFloatingBtn = !config.showFloatingBtn;
      setConfig('showFloatingBtn', config.showFloatingBtn);
      const btn = document.getElementById('floatingBtnToggle');
      if (btn) btn.classList.toggle('on', config.showFloatingBtn);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 重置悬浮按钮位置到屏幕正中间（共享实现见 resetFloatingBtnToCenter）
    if (id === 'ubResetFloatingBtnPos' || el.closest('#ubResetFloatingBtnPos')) {
      resetFloatingBtnToCenter();
      return;
    }

    // 数据库可视化按钮显示开关
    if (id === 'dbViewerToggle' || el.closest('#dbViewerToggle')) {
      config.dbViewerEnabled = !config.dbViewerEnabled;
      setConfig('dbViewerEnabled', config.dbViewerEnabled);
      const btn = document.getElementById('dbViewerToggle');
      if (btn) btn.classList.toggle('on', config.dbViewerEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // DS 缓存优化开关
    if (id === 'dsCacheOptimizeToggle' || el.closest('#dsCacheOptimizeToggle')) {
      config.dsCacheOptimize = !config.dsCacheOptimize;
      setConfig('dsCacheOptimize', config.dsCacheOptimize);
      const btn = document.getElementById('dsCacheOptimizeToggle');
      if (btn) btn.classList.toggle('on', config.dsCacheOptimize);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 重填模式开关（设置 → 通用 → 运行模式）：暂停本插件全部自动 AI 请求与自动数据写入。
    // 各拦截点见 core/refill-mode.ts；关闭后无需任何补跑——各自动链在下一次表格更新/消息事件时
    // 按当时的最新数据照常运行，故本分支只翻转开关 + 提示一句。
    if (id === 'refillModeToggle' || el.closest('#refillModeToggle')) {
      config.refillModeEnabled = !config.refillModeEnabled;
      setConfig('refillModeEnabled', config.refillModeEnabled);
      const btn = document.getElementById('refillModeToggle');
      if (btn) btn.classList.toggle('on', config.refillModeEnabled);
      if (config.refillModeEnabled) {
        getToastr()?.warning('已暂停自动 AI 请求与自动数据写入（地图／立绘／正文插图／日历／世界演化／时间锚定／杂表／世界书投影等）。重填完成后请关闭本开关。', '重填模式');
      } else {
        getToastr()?.success('已恢复自动功能，将在下一次表格更新时照常运行。', '重填模式');
      }
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 成就功能总开关：开→接通扫描/计数/派发器；关→彻底零负担。
    // 入口按钮显隐直接由总开关控制。重渲染由 _onConfigChanged 触发。
    if (id === 'achievementEnabledToggle' || el.closest('#achievementEnabledToggle')) {
      config.achievementEnabled = !config.achievementEnabled;
      setConfig('achievementEnabled', config.achievementEnabled);
      const btn = document.getElementById('achievementEnabledToggle');
      if (btn) btn.classList.toggle('on', config.achievementEnabled);
      // 入口/通知/重置按钮联动禁用/恢复
      const subIds = ['achievementNotifyToggle', 'achievementResetBtn'];
      for (const sid of subIds) {
        const el = document.getElementById(sid);
        if (!el) continue;
        if (!config.achievementEnabled) { el.setAttribute('disabled', ''); el.style.opacity = '0.4'; el.style.cursor = 'not-allowed'; }
        else { el.removeAttribute('disabled'); el.style.opacity = ''; el.style.cursor = ''; }
      }
      if (_onConfigChanged) _onConfigChanged();
      const _card = document.getElementById('achievementEnabledToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.achievementEnabled);
      return;
    }

    // 宅仙只读小助手总开关：开→显示悬浮球入口+启用问答；关→零渲染零请求。
    if (id === 'assistantEnabledToggle' || el.closest('#assistantEnabledToggle')) {
      config.assistantEnabled = !config.assistantEnabled;
      setConfig('assistantEnabled', config.assistantEnabled);
      const btn = document.getElementById('assistantEnabledToggle');
      if (btn) btn.classList.toggle('on', config.assistantEnabled);
      // 子区禁用态原地刷新（重置位置按钮联动）
      setFeatureBodyEnabled('assistantEnabledToggle', config.assistantEnabled);
      const resetBtn = document.getElementById('assistantFloatResetBtn');
      if (resetBtn) {
        if (config.assistantEnabled) { resetBtn.removeAttribute('disabled'); resetBtn.style.opacity = ''; resetBtn.style.cursor = ''; }
        else { resetBtn.setAttribute('disabled', ''); resetBtn.style.opacity = '0.4'; resetBtn.style.cursor = 'not-allowed'; }
      }
      const _acard = document.getElementById('assistantEnabledToggle')?.closest('details.settings-section');
      if (_acard) syncFeatureStatus(_acard, config.assistantEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 小助手悬浮球位置重置：恢复默认 { right: 20, bottom: 88 }
    if (id === 'assistantFloatResetBtn' || el.closest('#assistantFloatResetBtn')) {
      config.assistantFloatPosition = { right: 20, bottom: 88 };
      setConfig('assistantFloatPosition', config.assistantFloatPosition);
      if (_onConfigChanged) _onConfigChanged();
      getToastr()?.success('悬浮球位置已重置', '宅仙小助手');
      return;
    }

    // 成就解锁通知开关
    if (id === 'achievementNotifyToggle' || el.closest('#achievementNotifyToggle')) {
      config.achievementNotifyEnabled = !config.achievementNotifyEnabled;
      setConfig('achievementNotifyEnabled', config.achievementNotifyEnabled);
      const btn = document.getElementById('achievementNotifyToggle');
      if (btn) btn.classList.toggle('on', config.achievementNotifyEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }
    // 通知效果/通知显示位置已改下拉框（notifyEffectSelect/notifyAlignSelect），change 直绑见上方绑定区，不走点击委托。
    // 重置当前成就：清空所有已解锁记录、计数器与进度基线，不可撤销。
    if (id === 'achievementResetBtn' || el.closest('#achievementResetBtn')) {
      if (!await showConfirmDialog({ message: '确认重置当前成就？\n\n所有已解锁记录、计数器与进度基线将全部清空，不可撤销。', danger: true })) return;
      await resetAchievementStore();  // store：原地清空成就簿 + 确认落盘
      resetAchievementSession();     // engine：清会话内种子标记 + pending 事件队列（下次扫描重埋基线）
      getToastr()?.success('成就已重置', '成就功能');
      return;
    }

    // 瑟瑟玩法开关
    if (id === 'nsfwPlayToggle' || el.closest('#nsfwPlayToggle')) {
      config.nsfwPlayEnabled = !config.nsfwPlayEnabled;
      setConfig('nsfwPlayEnabled', config.nsfwPlayEnabled);
      // 关 → 硬删已注入的玩法/物品使用条目；开 → 按当前选中态重注入
      if (!config.nsfwPlayEnabled) {
        disablePlayWorldbook();
        disableItemUseEntries();
        void setWorldbookProjectionEnabled('play', false);
        void setWorldbookProjectionEnabled('item-use', false);
      } else {
        resetPlayWorldbookCache();
        syncPlayWorldbook();
        syncItemUseEntries(getConfig().itemUseEnabled);
        void setWorldbookProjectionEnabled('play', true);
        void setWorldbookProjectionEnabled('item-use', getConfig().itemUseEnabled === true);
      }
      const btn = document.getElementById('nsfwPlayToggle');
      if (btn) btn.classList.toggle('on', config.nsfwPlayEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      const _detail = document.getElementById('nsfw-play-detail');
      if (_detail) _detail.classList.toggle('ub-disabled', !config.nsfwPlayEnabled);
      const _card = document.getElementById('nsfwPlayToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.nsfwPlayEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 瑟瑟玩法-自动清空开关
    if (id === 'nsfwPlayAutoClearToggle' || el.closest('#nsfwPlayAutoClearToggle')) {
      config.nsfwPlayAutoClear = !config.nsfwPlayAutoClear;
      setConfig('nsfwPlayAutoClear', config.nsfwPlayAutoClear);
      const btn = document.getElementById('nsfwPlayAutoClearToggle');
      if (btn) btn.classList.toggle('on', config.nsfwPlayAutoClear);
      if (config.nsfwPlayAutoClear) {
        getToastr()?.info('已开启自动清空，每条消息生成后将自动清空玩法', '瑟瑟玩法');
      }
      return;
    }

    // 抽奖池子复选框
    if (el.classList.contains('gacha-pool-check')) {
      const poolId = (el as HTMLInputElement).value;
      const checked = (el as HTMLInputElement).checked;
      const win = (window as any);
      const selected = (win.__ub_getGachaSelectedPools ? win.__ub_getGachaSelectedPools() : []);
      if (checked) {
        if (!selected.includes(poolId)) selected.push(poolId);
      } else {
        const idx = selected.indexOf(poolId);
        if (idx !== -1) selected.splice(idx, 1);
      }
      if (win.__ub_setGachaSelectedPools) win.__ub_setGachaSelectedPools(selected);
      refreshGachaUI();
      return;
    }

    // 商店重置按钮（清空已售记录，下次打开常规售卖橱窗重新选品）
    if (id === 'gacha-reset-btn' || el.closest('#gacha-reset-btn')) {
      if (await showConfirmDialog({ message: '确认重置商店？所有已售记录将被清除，常规售卖橱窗将在下次打开时重新选品。' })) {
        await resetShop();
        getToastr()?.success('商店已重置', '商店设置');
        refreshGachaUI();
      }
      return;
    }

    // 货币系统总开关（一行极简卡，无展开体；开启后 chip/世界书/手机联动自动跟随）
    if (id === 'currencyToggle' || el.closest('#currencyToggle')) {
      config.currencyEnabled = !config.currencyEnabled;
      setConfig('currencyEnabled', config.currencyEnabled);
      const btn = document.getElementById('currencyToggle');
      if (btn) btn.classList.toggle('on', config.currencyEnabled);
      const _card = document.getElementById('currencyToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.currencyEnabled);
      // 世界书条目随开关重建/清理：须走 setFeatureEnabled 的 allowDisabled 通道——禁用后数据派发
      // 会被注册表 isEnabled 闸门丢弃，条目不会消失（开启时无币种仍以空内容短路，生成首个币种后自动补上）
      void setWorldbookProjectionEnabled('currency', config.currencyEnabled);
      // 酒馆全局显示正则（交易/转账/红包卡片）随开关注入/撤除（失败容错，不阻断开关）
      void (config.currencyEnabled ? ensureCurrencyRegexInjection() : removeCurrencyRegexScripts())
        .catch((e: unknown) => console.warn('[货币] 正则卡片注入/撤除失败:', e));
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 商店功能总开关（常规售卖 + 剧情特卖）
    if (id === 'shopToggle' || el.closest('#shopToggle')) {
      config.shopEnabled = !config.shopEnabled;
      setConfig('shopEnabled', config.shopEnabled);
      const btn = document.getElementById('shopToggle');
      if (btn) btn.classList.toggle('on', config.shopEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      const _detail = document.getElementById('shop-detail');
      if (_detail) _detail.classList.toggle('ub-disabled', !config.shopEnabled);
      const _card = document.getElementById('shopToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.shopEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 选项栏开关
    if (id === 'optionsBarToggle' || el.closest('#optionsBarToggle')) {
      config.optionsBarEnabled = !config.optionsBarEnabled;
      setConfig('optionsBarEnabled', config.optionsBarEnabled);
      const btn = document.getElementById('optionsBarToggle');
      if (btn) btn.classList.toggle('on', config.optionsBarEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      const _detail = document.getElementById('optionsBarDetail');
      if (_detail) _detail.classList.toggle('ub-disabled', !config.optionsBarEnabled);
      const _card = document.getElementById('optionsBarToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.optionsBarEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 选项栏发送模式开关
    if (id === 'optionsBarSendToggle' || el.closest('#optionsBarSendToggle')) {
      config.optionsBarSendMode = config.optionsBarSendMode === 'send' ? 'fill' : 'send';
      setConfig('optionsBarSendMode', config.optionsBarSendMode);
      const btn = document.getElementById('optionsBarSendToggle');
      if (btn) btn.classList.toggle('on', config.optionsBarSendMode === 'send');
      return;
    }

    // 选项栏跟随底部开关
    if (id === 'optionsBarFollowToggle' || el.closest('#optionsBarFollowToggle')) {
      config.optionsBarFollowBottom = !config.optionsBarFollowBottom;
      setConfig('optionsBarFollowBottom', config.optionsBarFollowBottom);
      const btn = document.getElementById('optionsBarFollowToggle');
      if (btn) btn.classList.toggle('on', config.optionsBarFollowBottom);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 日历功能开关
    if (id === 'calendarToggle' || el.closest('#calendarToggle')) {
      config.calendarEnabled = !config.calendarEnabled;
      setConfig('calendarEnabled', config.calendarEnabled);
      void setWorldbookProjectionEnabled('calendar', config.calendarEnabled);
      const btn = document.getElementById('calendarToggle');
      if (btn) btn.classList.toggle('on', config.calendarEnabled);
      // 刷新子设置显示（避免递归 showConfigPanel 导致 onclick 被替换）
      const detail = document.getElementById('calendarDetail');
      if (detail) detail.style.display = config.calendarEnabled ? '' : 'none';
      if (_onConfigChanged) _onConfigChanged();
      const _card = document.getElementById('calendarToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.calendarEnabled);
      return;
    }

    // 月信周期三档分段选择器（off / period / full）
    if (id === 'cycleModeOff' || el.closest('#cycleModeOff') ||
        id === 'cycleModePeriod' || el.closest('#cycleModePeriod') ||
        id === 'cycleModeFull' || el.closest('#cycleModeFull')) {
      const prev = config.cycleMode;
      if (id === 'cycleModeOff' || el.closest('#cycleModeOff')) config.cycleMode = 'off';
      else if (id === 'cycleModePeriod' || el.closest('#cycleModePeriod')) config.cycleMode = 'period';
      else config.cycleMode = 'full';
      if (prev === config.cycleMode) return;
      setConfig('cycleMode', config.cycleMode);
      // 切到 off/period：显式关闭经期世界书（off）/ 孕期世界书（off/period）
      if (config.cycleMode === 'off') {
        void setWorldbookProjectionEnabled('cycle-period', false);
        void setWorldbookProjectionEnabled('cycle-pregnancy', false);
      } else if (config.cycleMode === 'period') {
        try { resetCycleWorldbookCache(); } catch (_e) { /* ignore */ }
        void setWorldbookProjectionEnabled('cycle-period', config.cycleWorldbookPeriod === true);
        void setWorldbookProjectionEnabled('cycle-pregnancy', false);
      } else {
        // full：清两条缓存促下 tick 重同步
        try { resetCycleWorldbookCache(); } catch (_e) { /* ignore */ }
        try { resetPregnancyWorldbookCache(); } catch (_e) { /* ignore */ }
        void setWorldbookProjectionEnabled('cycle-period', config.cycleWorldbookPeriod === true);
        void setWorldbookProjectionEnabled('cycle-pregnancy', config.cycleWorldbookPregnancy === true);
      }
      // 立即按新档刷新一次世界书（off 早退、disable 已显式处理；period/full 同步最新态）
      try { handleCycleTick(); } catch (_e) { /* ignore */ }
      if (_onConfigChanged) _onConfigChanged();
      // 原地联动，避免 showConfigPanel 整体重建导致面板重置/跳顶：
      // ① 三档按钮高亮；② cycleDetail 子区禁用态；③ cycleFullDetail 仅 full 显示；④ 徽标文案
      setSegActive(
        ['cycleModeOff', 'cycleModePeriod', 'cycleModeFull'],
        config.cycleMode,
        (bid) => bid === 'cycleModeOff' ? 'off' : bid === 'cycleModePeriod' ? 'period' : 'full',
      );
      const _detail = document.getElementById('cycleDetail');
      if (_detail) _detail.classList.toggle('ub-disabled', config.cycleMode === 'off');
      const _fullDetail = document.getElementById('cycleFullDetail');
      if (_fullDetail) _fullDetail.style.display = config.cycleMode === 'full' ? '' : 'none';
      const _card = document.getElementById('cycleModeOff')?.closest('details.settings-section');
      if (_card) syncCycleStatus(_card, config.cycleMode);
      return;
    }

    // 周期进度条显隐开关（经期条/孕期条）
    if (id === 'cycleShowBarToggle' || el.closest('#cycleShowBarToggle')) {
      config.cycleShowBar = !config.cycleShowBar;
      setConfig('cycleShowBar', config.cycleShowBar);
      const btn = document.getElementById('cycleShowBarToggle');
      if (btn) btn.classList.toggle('on', config.cycleShowBar);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 经期世界书注入开关
    if (id === 'cycleWorldbookToggle' || el.closest('#cycleWorldbookToggle')) {
      config.cycleWorldbookPeriod = !config.cycleWorldbookPeriod;
      setConfig('cycleWorldbookPeriod', config.cycleWorldbookPeriod);
      const btn = document.getElementById('cycleWorldbookToggle');
      if (btn) btn.classList.toggle('on', config.cycleWorldbookPeriod);
      if (!config.cycleWorldbookPeriod) {
        void setWorldbookProjectionEnabled('cycle-period', false);
      } else {
        try { resetCycleWorldbookCache(); } catch (_e) { /* ignore */ }
        void setWorldbookProjectionEnabled('cycle-period', config.cycleMode !== 'off');
      }
      // 立即按新开关状态刷新一次世界书（off 早退；period/full 据新开关同步或禁用）
      try { handleCycleTick(); } catch (_e) { /* ignore */ }
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 孕期世界书注入开关（仅 full）
    if (id === 'cycleWorldbookPregToggle' || el.closest('#cycleWorldbookPregToggle')) {
      config.cycleWorldbookPregnancy = !config.cycleWorldbookPregnancy;
      setConfig('cycleWorldbookPregnancy', config.cycleWorldbookPregnancy);
      const btn = document.getElementById('cycleWorldbookPregToggle');
      if (btn) btn.classList.toggle('on', config.cycleWorldbookPregnancy);
      if (!config.cycleWorldbookPregnancy) {
        void setWorldbookProjectionEnabled('cycle-pregnancy', false);
      } else {
        try { resetPregnancyWorldbookCache(); } catch (_e) { /* ignore */ }
        void setWorldbookProjectionEnabled('cycle-pregnancy', config.cycleMode === 'full');
      }
      // 立即按新开关状态刷新一次世界书（非 full 早退；full 据新开关同步或禁用）
      try { handleCycleTick(); } catch (_e) { /* ignore */ }
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 受孕形式确认策略四档
    if (id === 'cycleSexPromptAsk' || el.closest('#cycleSexPromptAsk') ||
        id === 'cycleSexPromptUnprotected' || el.closest('#cycleSexPromptUnprotected') ||
        id === 'cycleSexPromptWithdrawal' || el.closest('#cycleSexPromptWithdrawal') ||
        id === 'cycleSexPromptProtected' || el.closest('#cycleSexPromptProtected')) {
      if (id === 'cycleSexPromptAsk' || el.closest('#cycleSexPromptAsk')) config.cycleSexFormPrompt = 'always_ask';
      else if (id === 'cycleSexPromptUnprotected' || el.closest('#cycleSexPromptUnprotected')) config.cycleSexFormPrompt = 'assume_unprotected';
      else if (id === 'cycleSexPromptWithdrawal' || el.closest('#cycleSexPromptWithdrawal')) config.cycleSexFormPrompt = 'assume_withdrawal';
      else config.cycleSexFormPrompt = 'assume_protected';
      setConfig('cycleSexFormPrompt', config.cycleSexFormPrompt);
      if (_onConfigChanged) _onConfigChanged();
      // 原地刷新高亮，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setSegActive(
        ['cycleSexPromptAsk', 'cycleSexPromptUnprotected', 'cycleSexPromptWithdrawal', 'cycleSexPromptProtected'],
        config.cycleSexFormPrompt,
        (bid) => bid === 'cycleSexPromptAsk' ? 'always_ask'
          : bid === 'cycleSexPromptUnprotected' ? 'assume_unprotected'
          : bid === 'cycleSexPromptWithdrawal' ? 'assume_withdrawal' : 'assume_protected',
      );
      return;
    }

    // 日历每日自动更新开关
    if (id === 'calendarAutoDailyToggle' || el.closest('#calendarAutoDailyToggle')) {
      // 开启时弹出警告提示
      if (!config.calendarAutoDaily) {
        if (!await showConfirmDialog({ message:
          '注意：自动更新的逻辑是检测数据库中当前日期的变化。\n\n' +
          '在数据库重填表过程中，日期会频繁变化导致一直在更新日历，此时请将自动更新关闭。\n\n' +
          '你确认已知晓该事项并开启自动更新吗？' })) return;
      }
      config.calendarAutoDaily = !config.calendarAutoDaily;
      setConfig('calendarAutoDaily', config.calendarAutoDaily);
      const btn = document.getElementById('calendarAutoDailyToggle');
      if (btn) btn.classList.toggle('on', config.calendarAutoDaily);
      return;
    }

    // 日历生日开关：关时日历不显示生日标注、世界书今日投影去掉生日行（年龄推算不受影响）
    if (id === 'calendarBirthdayToggle' || el.closest('#calendarBirthdayToggle')) {
      config.calendarBirthdayEnabled = !config.calendarBirthdayEnabled;
      setConfig('calendarBirthdayEnabled', config.calendarBirthdayEnabled);
      const birthdayBtn = document.getElementById('calendarBirthdayToggle');
      if (birthdayBtn) birthdayBtn.classList.toggle('on', config.calendarBirthdayEnabled);
      // 立即重写世界书「今日日历」条目（去掉/恢复生日行），不等下一次自动更新
      requestWorldbookProjection('calendar', 'config-change');
      return;
    }

    // 日历上下文数量滑条/输入框：原生 input 直绑（bindNumPair），不在此委托处理

    // 删除历史日历内容
    if (id === 'deleteCalendarEntriesBtn' || el.closest('#deleteCalendarEntriesBtn')) {
      if (!await showConfirmDialog({ message: '确定要删除该角色卡绑定世界书中的「已发生」和「未发生」两个日历条目吗？\n\n此操作将清除所有历史日历数据，不可撤销。', danger: true })) return;
      deleteCalendarWBEntries().then(result => {
        if (result.deleted > 0) {
          getToastr()?.success(`已删除 ${result.deleted} 个日历条目`, '日历清理');
        } else {
          getToastr()?.error(result.error || '未找到日历条目', '日历清理');
        }
      }).catch(() => {
        getToastr()?.error('删除操作失败', '日历清理');
      });
      return;
    }

    // 世界演化总开关（native toggle；翻转同步 world 世界书投影开关）
    if (id === 'worldToggle' || el.closest('#worldToggle')) {
      config.worldEnabled = !config.worldEnabled;
      setConfig('worldEnabled', config.worldEnabled);
      void setWorldbookProjectionEnabled('world', config.worldEnabled);
      if (!config.worldEnabled) (window as any)._activeBeyond = false; // 关闭时退出镜头之外视图（下次渲染按钮随之隐藏）
      const btn = document.getElementById('worldToggle');
      if (btn) btn.classList.toggle('on', config.worldEnabled);
      const detail = document.getElementById('worldDetail');
      if (detail) detail.classList.toggle('ub-disabled', !config.worldEnabled);
      const card = el.closest('.settings-section');
      if (card) {
        const status = card.querySelector('.feature-status');
        if (status) {
          status.textContent = config.worldEnabled ? '已开启' : '已关闭';
          status.classList.toggle('on', config.worldEnabled);
          status.classList.toggle('off', !config.worldEnabled);
        }
      }
      return;
    }

    // 世界演化自动更新开关（native toggle；只拦自动触发，世界窗口「手动演化」不受影响）
    if (id === 'worldAutoUpdateToggle' || el.closest('#worldAutoUpdateToggle')) {
      config.worldAutoUpdate = !config.worldAutoUpdate;
      setConfig('worldAutoUpdate', config.worldAutoUpdate);
      const btn = document.getElementById('worldAutoUpdateToggle');
      if (btn) btn.classList.toggle('on', config.worldAutoUpdate);
      return;
    }

    // 世界演化小手机联动开关（native toggle；下次演化起生效——提示词按此开关注入 <phone> 格式）
    if (id === 'worldPhoneLinkToggle' || el.closest('#worldPhoneLinkToggle')) {
      config.worldPhoneLink = !config.worldPhoneLink;
      setConfig('worldPhoneLink', config.worldPhoneLink);
      const btn = document.getElementById('worldPhoneLinkToggle');
      if (btn) btn.classList.toggle('on', config.worldPhoneLink);
      return;
    }

    // 重置世界演化（删除当前聊天世界状态 + 清理世界书注入条目）
    if (id === 'worldResetBtn' || el.closest('#worldResetBtn')) {
      if (!await showConfirmDialog({ message: '确认重置当前聊天的世界演化？将删除全部世界状态（角色侧写/传闻/纪事/入镜队列），并移除世界书中注入的「世界动态」与「角色动态」条目。此操作不可撤销。', danger: true })) return;
      const btn = document.getElementById('worldResetBtn');
      if (btn) { btn.textContent = '重置中...'; (btn as HTMLButtonElement).disabled = true; }
      try {
        const result = await resetWorldEvolution();
        if (!result.ok) { getToastr()?.error('世界状态删除失败，未清空', '世界演化'); }
        else { getToastr()?.success('世界演化已重置，世界书条目已清理', '世界演化'); }
      } catch (_e) {
        getToastr()?.error('重置世界演化失败', '世界演化');
      }
      if (btn) { btn.textContent = '重置世界演化'; (btn as HTMLButtonElement).disabled = false; }
      return;
    }

    // 大调查功能开关
    if (id === 'investigationToggle' || el.closest('#investigationToggle')) {
      config.investigationEnabled = !config.investigationEnabled;
      setConfig('investigationEnabled', config.investigationEnabled);
      const btn = document.getElementById('investigationToggle');
      if (btn) btn.classList.toggle('on', config.investigationEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setFeatureBodyEnabled('investigationToggle', config.investigationEnabled);
      const _card = document.getElementById('investigationToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.investigationEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 大采访按钮显示开关
    if (id === 'interviewToggle' || el.closest('#interviewToggle')) {
      config.interviewEnabled = !config.interviewEnabled;
      setConfig('interviewEnabled', config.interviewEnabled);
      const btn = document.getElementById('interviewToggle');
      if (btn) btn.classList.toggle('on', config.interviewEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setFeatureBodyEnabled('interviewToggle', config.interviewEnabled);
      const _card = document.getElementById('interviewToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.interviewEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 地图生成开关
    if (id === 'mapToggle' || el.closest('#mapToggle')) {
      config.mapEnabled = !config.mapEnabled;
      setConfig('mapEnabled', config.mapEnabled);
      void setWorldbookProjectionEnabled('map-nodes', config.mapEnabled);
      const btn = document.getElementById('mapToggle');
      if (btn) btn.classList.toggle('on', config.mapEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setFeatureBodyEnabled('mapToggle', config.mapEnabled);
      const _card = document.getElementById('mapToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.mapEnabled);
      // 开启地图时：兜底建杂表 + 同步地图概览行 + 注入节点世界书条目
      if (config.mapEnabled) {
        void ensureMiscTable({ promptOnMissing: true }).then((ok) => {
          if (ok) {
            void syncMapOverviewToMiscTable();
            void syncMapNodeWorldbookEntries();
          }
        });
      }
      if (_onConfigChanged) _onConfigChanged();
      return;
    }
    // 地图上下文条目数/最大注入条目数滑条与输入框、地图自动更新模式/地点冲突策略 select：
    // 均走原生 input/change 直绑（bindNumPair / bindModeSelect），不在此委托处理
    // 生成地图时自动生成场景图开关
    if (id === 'mapAutoGenSceneImageToggle' || el.closest('#mapAutoGenSceneImageToggle')) {
      if (!config.mapEnabled) return;
      config.mapAutoGenSceneImage = !config.mapAutoGenSceneImage;
      setConfig('mapAutoGenSceneImage', config.mapAutoGenSceneImage);
      const btn = document.getElementById('mapAutoGenSceneImageToggle');
      if (btn) btn.classList.toggle('on', config.mapAutoGenSceneImage);
      return;
    }
    // 自动更新时重绘地图画面开关
    if (id === 'mapAutoRedrawToggle' || el.closest('#mapAutoRedrawToggle')) {
      if (!config.mapEnabled) return;
      config.mapAutoRedraw = !config.mapAutoRedraw;
      setConfig('mapAutoRedraw', config.mapAutoRedraw);
      const btn = document.getElementById('mapAutoRedrawToggle');
      if (btn) btn.classList.toggle('on', config.mapAutoRedraw);
      return;
    }

    // ===== 衣柜 =====
    if (id === 'wardrobeToggle' || el.closest('#wardrobeToggle')) {
      config.wardrobeEnabled = !config.wardrobeEnabled;
      setConfig('wardrobeEnabled', config.wardrobeEnabled);
      void setWorldbookProjectionEnabled('wardrobe', config.wardrobeEnabled);
      const btn = document.getElementById('wardrobeToggle');
      if (btn) btn.classList.toggle('on', config.wardrobeEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setFeatureBodyEnabled('wardrobeToggle', config.wardrobeEnabled);
      const _card = document.getElementById('wardrobeToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.wardrobeEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // ===== 立绘与衣柜生图 =====
    // 立绘总开关
    if (id === 'portraitToggle' || el.closest('#portraitToggle')) {
      config.portraitEnabled = !config.portraitEnabled;
      setConfig('portraitEnabled', config.portraitEnabled);
      const btn = document.getElementById('portraitToggle');
      if (btn) btn.classList.toggle('on', config.portraitEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setFeatureBodyEnabled('portraitToggle', config.portraitEnabled);
      const _card = document.getElementById('portraitToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.portraitEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }
    // 正文插图（自动文生图）总开关：原地联动子区禁用态 + 徽标 + 楼层按钮显隐（无主界面 DOM 变化，不触发重渲染）
    if (id === 'storyImageToggle' || el.closest('#storyImageToggle')) {
      config.storyImageEnabled = !config.storyImageEnabled;
      setConfig('storyImageEnabled', config.storyImageEnabled);
      const btn = document.getElementById('storyImageToggle');
      if (btn) btn.classList.toggle('on', config.storyImageEnabled);
      setFeatureBodyEnabled('storyImageToggle', config.storyImageEnabled);
      const _card = document.getElementById('storyImageToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.storyImageEnabled);
      refreshStoryImageFloorButtons();
      return;
    }
    // 正文插图「自动生图」开关：关=不自动生图，仅楼层按钮手动触发（原地翻转，不重渲染）
    if (id === 'storyImageAutoToggle' || el.closest('#storyImageAutoToggle')) {
      config.storyImage.autoGenerate = !(config.storyImage.autoGenerate === true);
      setConfig('storyImage', { ...config.storyImage });
      const btn = document.getElementById('storyImageAutoToggle');
      if (btn) btn.classList.toggle('on', config.storyImage.autoGenerate === true);
      return;
    }
    // 正文插图：恢复默认要求提示词（文本框填回内置默认全文；存空串=跟随内置默认）
    // 文生图图库入口（功能页 + API 页共用）
    if (id === 'storyImageGalleryBtn' || el.closest('#storyImageGalleryBtn')
      || id === 'storyImageGalleryBtnApi' || el.closest('#storyImageGalleryBtnApi')) {
      showStoryImageGalleryPopup(getConfig().style);
      return;
    }
    // 显示主角立绘（主角立绘框开关；切换改变主界面 DOM，需触发重渲染）
    if (id === 'portraitProtagonistToggle' || el.closest('#portraitProtagonistToggle')) {
      config.portraitProtagonistEnabled = !config.portraitProtagonistEnabled;
      setConfig('portraitProtagonistEnabled', config.portraitProtagonistEnabled);
      const btn = document.getElementById('portraitProtagonistToggle');
      if (btn) btn.classList.toggle('on', config.portraitProtagonistEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }
    // 立绘自动更新模式 select：走原生 change 直绑（bindModeSelect），不在此委托处理
    // AI 生成成功后自动加入随机池；本地导入路径不读取此开关
    if (id === 'portraitAutoAddRandomToggle' || el.closest('#portraitAutoAddRandomToggle')) {
      config.portraitAutoAddToRandomPool = !config.portraitAutoAddToRandomPool;
      setConfig('portraitAutoAddToRandomPool', config.portraitAutoAddToRandomPool);
      document.getElementById('portraitAutoAddRandomToggle')?.classList.toggle('on', config.portraitAutoAddToRandomPool);
      return;
    }
    // 随机依据：角色情绪（复选）
    if (id === 'portraitFilterByEmotion' || el.closest('#portraitFilterByEmotion')) {
      config.portraitRandomFilter.byEmotion = !config.portraitRandomFilter.byEmotion;
      setConfig('portraitRandomFilter', { ...config.portraitRandomFilter });
      document.getElementById('portraitFilterByEmotion')?.classList.toggle('on', config.portraitRandomFilter.byEmotion);
      return;
    }
    // 随机依据：NSFW状态（复选）
    if (id === 'portraitFilterByNsfw' || el.closest('#portraitFilterByNsfw')) {
      config.portraitRandomFilter.byNsfw = !config.portraitRandomFilter.byNsfw;
      setConfig('portraitRandomFilter', { ...config.portraitRandomFilter });
      document.getElementById('portraitFilterByNsfw')?.classList.toggle('on', config.portraitRandomFilter.byNsfw);
      return;
    }
    // 清除生成偏好：弹窗与自动更新回退默认选项（原地更新状态徽标，不重建面板）
    if (id === 'portraitGenPrefClear' || el.closest('#portraitGenPrefClear')) {
      if (!config.portraitGenPreference) return;
      config.portraitGenPreference = undefined;
      setConfig('portraitGenPreference', undefined);
      const state = document.getElementById('portraitGenPrefState');
      if (state) { state.classList.remove('on'); state.textContent = '未保存'; }
      const clearBtn = document.getElementById('portraitGenPrefClear') as HTMLButtonElement | null;
      if (clearBtn) clearBtn.disabled = true;
      const toastr = getToastr();
      if (toastr) toastr.success('已清除立绘生成偏好', '立绘');
      return;
    }
    // 从智慧姬导入预设：读设置 → 组装 → 结果弹窗（分「已导入 / 未导入」两栏）→ 确认后落盘为新预设
    if (id === 'imageImportFromChatu8Btn' || el.closest('#imageImportFromChatu8Btn')) {
      const outcome = readChatu8Import();
      const tr = getToastr();
      if (!outcome.ok || !outcome.preset) {
        tr?.error?.(outcome.error || '导入失败', '智慧姬导入');
        return;
      }
      const escHtml = (t: string): string => escapeHtml(t);
      const listHtml = (title: string, items: string[], emptyText: string): string => {
        const list = items.length ? '<ul style="margin:4px 0 0 18px;padding:0;font-size:12px;line-height:1.7;">' + items.map(i => '<li>' + escHtml(i) + '</li>').join('') + '</ul>' : '<div style="font-size:12px;opacity:.7;">' + escHtml(emptyText) + '</div>';
        return '<div style="margin:8px 0 0;"><b style="font-size:12px;">' + escHtml(title) + '</b>' + list + '</div>';
      };
      // 复用确认弹窗框架（.ub-confirm-dialog 才有背景框/边框/滚动；自造类名会退化成悬浮文字）
      const dialogClass = config.style === 'bridge' ? bridgeWindowClass('confirm', 's') : 'panel-popup ub-popup--s';
      const body = '<div class="' + dialogClass + ' ub-confirm-dialog">'
        + '<div class="ub-confirm-title">从智慧姬导入预设</div>'
        + '<div class="ub-confirm-message" style="text-align:left;">'
        + '<div style="font-size:12px;opacity:.85;">智慧姬当前模式：<b>' + escHtml(outcome.modeLabel) + '</b> · 预设名：<b>' + escHtml(outcome.preset.name) + '</b></div>'
        + listHtml('已导入', outcome.imported, '（无可导入项）')
        + listHtml('未导入（跳过或不可搬运，原因见括号）', outcome.skipped, '无')
        + '<div style="font-size:11px;opacity:.7;margin-top:8px;">导入结果为一份新预设，供「内置直连」使用；智慧姬直连下预设本就不生效。提示词模式/输出语言/同人tag写法为全局设置，不随预设导入。</div>'
        + '</div>'
        + '<div class="ub-confirm-btns"><button type="button" class="ub-confirm-btn ub-confirm-btn-cancel">取消</button><button type="button" class="ub-confirm-btn ub-confirm-btn-ok">导入为新预设</button></div>'
        + '</div>';
      const { overlay } = openDialog(body, {});
      overlay.onclick = (e) => {
        const t = e.target as HTMLElement;
        if (t === overlay || t.closest('.ub-confirm-btn-cancel')) { closeDialog(overlay); return; }
        if (!t.closest('.ub-confirm-btn-ok')) return;
        const imageGeneration = config.imageGeneration;
        const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
          ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
          : getDefaultPromptPresets(imageGeneration.provider.novelai.negativePrompt);
        const imported = { ...outcome.preset!, id: nextPresetId(presets) };
        presets.push(imported);
        imageGeneration.promptPresets = presets;
        setConfig('imageGeneration', imageGeneration);
        closeDialog(overlay);
        getToastr()?.success?.('已导入预设「' + imported.name + '」（可在任务预设下拉里选用）', '智慧姬导入');
        showConfigPanel(config.style, 'api');
      };
      overlay.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeDialog(overlay); } };
      return;
    }
    if (id === 'portraitTestBtn' || el.closest('#portraitTestBtn')) {
      const imageGeneration = config.imageGeneration;
      const ig = resolveImageTaskConfig(_imageGenerationUiTask, imageGeneration).provider;
      const toastr = getToastr();
      if (toastr) toastr.info('测试生图进行中…', '统一生图 API');
      // 前后缀/负面走统一切片（含智慧姬抑制：直连时不拼预设前后缀、不发预设负面——与真实生图同规）
      const testSlice = resolvePromptPresetSlice(ig);
      const testPrompt = (testSlice.prefix ? testSlice.prefix + ', ' : '') + (_imageGenerationUiTask === 'mapScene' ? 'empty cinematic environment, architectural scene, no people' : _imageGenerationUiTask === 'wardrobeItem' ? 'fashion item product shot, clothing only' : 'portrait, 1girl, test') + (testSlice.suffix ? ', ' + testSlice.suffix : '');
      try {
        const dataUrl = await generateImage(ig, testPrompt, testSlice.negative);
        showTestImagePreview(dataUrl);
        if (toastr) toastr.success('测试生图成功', '统一生图 API');
      } catch (e: any) {
        if (toastr) toastr.error('测试生图失败：' + (e?.message || e), '统一生图 API');
      }
      return;
    }
    // 生图接口通道切换（顶层选项：内置直连 ↔ 智慧姬 ↔ 柏宝绘；外部通道在存储上恒为 apiFormat='openai' + 对应通道位）
    const switchImageChannel = (want: 'builtin' | 'chatu8' | 'baibai'): void => {
      const ig = config.imageGeneration.provider;
      const wasExternal = ig.openai.chatu8 === true || ig.openai.baibai === true;
      // 进入外部通道时记住当前内置供应商、切回内置直连时原样恢复（各供应商配置本体不因通道切换而动；
      // 外部通道之间直切不动回溯位——记的仍是当初进外部前的那个内置供应商）
      if (want !== 'builtin' && !wasExternal) {
        ig.chatu8PrevApiFormat = ig.apiFormat;
      }
      ig.openai.chatu8 = want === 'chatu8';
      ig.openai.baibai = want === 'baibai';
      if (want !== 'builtin') {
        ig.apiFormat = 'openai';
      } else if (ig.chatu8PrevApiFormat === 'novelai' || ig.chatu8PrevApiFormat === 'comfyui') {
        ig.apiFormat = ig.chatu8PrevApiFormat;
      }
      // 切外部通道时探测对端状态，Toast 注记给出当前模式/后端与在岗状态
      let note = '';
      try {
        note = want === 'chatu8' ? chatu8StatusNote() : want === 'baibai' ? baibaiStatusNote() : '';
      } catch (err: any) { note = '（' + (err?.message || err) + '）'; }
      let genOk = true;
      let baibaiOk = true;
      if (want === 'chatu8') {
        try { ensureChatu8Model(); } catch (_e) { /* 补默认尽力而为 */ }
        try { genOk = chatu8HasGenerator(); } catch (_e) { genOk = false; }
      } else if (want === 'baibai') {
        baibaiOk = baibaiPluginReady();
      }
      config.imageGeneration.provider = normalizePortraitImageGen(ig);
      config.imageGeneration = normalizeImageGenerationConfig(config.imageGeneration, config);
      setConfig('imageGeneration', config.imageGeneration);
      if (_onConfigChanged) _onConfigChanged();
      // 重建必要（通道切换替换连接区与模型区）；滚动/展开恢复由 showConfigPanel 内 _restoreSettingsState 统一处理
      showConfigPanel(config.style, 'api');
      const tr = getToastr();
      if (tr) {
        if (want === 'chatu8') {
          (tr[genOk ? 'success' : 'warning'] || tr.info).call(
            tr,
            genOk
              ? '已切到智慧姬接口：生图交给智慧姬执行，用智慧姬里配的地址/密钥/模型' + note
              : '已切到智慧姬接口，但智慧姬那边还没挂上生图监听：请打开智慧姬设置面板、在「模式」里选一个能生图的模式' + note,
            '统一生图 API',
          );
        } else if (want === 'baibai') {
          (tr[baibaiOk ? 'success' : 'warning'] || tr.info).call(
            tr,
            baibaiOk
              ? '已切到柏宝绘接口：生图交给柏宝绘执行，用柏宝绘「渠道」页配的后端/模型/画师串/质量词' + note
              : '已切到柏宝绘接口，但柏宝绘还没就绪：请确认插件已安装、并在其「渠道」页配好出图后端' + note,
            '统一生图 API',
          );
        } else {
          tr.info?.('已切回内置直连（供应商与地址/密钥/模型用本页配置）' + note, '统一生图 API');
        }
      }
    };
    if (el.closest('[data-image-channel]')) {
      const want = String((el.closest('[data-image-channel]') as HTMLElement).dataset.imageChannel || 'builtin') as 'builtin' | 'chatu8' | 'baibai';
      const igNow = config.imageGeneration.provider;
      const current: 'builtin' | 'chatu8' | 'baibai' = igNow.openai.chatu8 === true ? 'chatu8' : igNow.openai.baibai === true ? 'baibai' : 'builtin';
      if (want !== current && (want === 'builtin' || want === 'chatu8' || want === 'baibai')) {
        switchImageChannel(want);
      }
      return;
    }
    // 供应商切换（仅内置直连接口下渲染该行）：NovelAI ↔ OpenAI 兼容 ↔ ComfyUI
    if (el.closest('.image-provider-btn')) {
      const provider = String((el.closest('.image-provider-btn') as HTMLElement).dataset.provider || '') as PortraitApiFormat;
      if (provider && provider !== config.imageGeneration.provider.apiFormat) {
        config.imageGeneration.provider.apiFormat = provider;
        config.imageGeneration.provider = normalizePortraitImageGen(config.imageGeneration.provider);
        config.imageGeneration = normalizeImageGenerationConfig(config.imageGeneration, config);
        setConfig('imageGeneration', config.imageGeneration);
        if (_onConfigChanged) _onConfigChanged();
        // 重建必要（供应商切换整块配置区替换）；滚动/展开恢复由 showConfigPanel 内 _restoreSettingsState 统一处理
        showConfigPanel(config.style, 'api');
      }
      return;
    }
    // ComfyUI 工作流预设操作提交器：归一化+落盘+通知+重建（滚动/展开恢复由 showConfigPanel 内 _restoreSettingsState 统一处理）
    const commitComfy = (): void => {
      config.imageGeneration.provider = normalizePortraitImageGen(config.imageGeneration.provider);
      config.imageGeneration = normalizeImageGenerationConfig(config.imageGeneration, config);
      setConfig('imageGeneration', config.imageGeneration);
      if (_onConfigChanged) _onConfigChanged();
      showConfigPanel(config.style, 'api');
    };
    // ComfyUI 工作流预设操作
    if (id === 'portraitComfyWfNew' || el.closest('#portraitComfyWfNew')) {
      const ig = config.imageGeneration.provider;
      const newId = nextComfyWorkflowId(ig.comfyui.workflows);
      ig.comfyui.workflows = [...(ig.comfyui.workflows || []), { id: newId, name: '工作流 ' + newId, workflow: DEFAULT_COMFY_WORKFLOW_JSON, fingerprint: computeComfyFingerprint(DEFAULT_COMFY_WORKFLOW_JSON) }];
      ig.comfyui.activeWorkflowId = newId;
      commitComfy();
      return;
    }
    if (id === 'portraitComfyWfRename' || el.closest('#portraitComfyWfRename')) {
      const ig = config.imageGeneration.provider;
      const active = resolveActiveComfyWorkflow(ig.comfyui.workflows, ig.comfyui.activeWorkflowId);
      const name = window.prompt('工作流名称', active.name);
      if (name && name.trim()) {
        ig.comfyui.workflows = ig.comfyui.workflows.map((wf) => wf.id === active.id ? { ...wf, name: name.trim() } : wf);
        commitComfy();
      }
      return;
    }
    if (id === 'portraitComfyWfDelete' || el.closest('#portraitComfyWfDelete')) {
      const ig = config.imageGeneration.provider;
      const active = resolveActiveComfyWorkflow(ig.comfyui.workflows, ig.comfyui.activeWorkflowId);
      if (active.isDefault || ig.comfyui.workflows.length <= 1) {
        const toastr = getToastr();
        if (toastr) toastr.warning('默认工作流不可删除', '立绘');
        return;
      }
      ig.comfyui.workflows = ig.comfyui.workflows.filter((wf) => wf.id !== active.id);
      ig.comfyui.activeWorkflowId = DEFAULT_COMFY_WORKFLOW_ID;
      commitComfy();
      return;
    }
    // 拉取 object_info 填充 datalist
    if (id === 'portraitComfyFetchObjInfo' || el.closest('#portraitComfyFetchObjInfo')) {
      const url = String($('#portraitUrl').val() || '');
      const tr = getToastr();
      if (tr) tr.info('正在拉取 ComfyUI 节点信息…', '立绘');
      const info = await fetchComfyObjectInfo(url);
      if (!info) { if (tr) tr.error('拉取失败：请检查 ComfyUI 地址与服务端是否运行', '立绘'); return; }
      // 拉取 object_info 填充下拉选项（顶部常驻「（留空）」选项 = 不覆盖该参数；
      // 保留当前值；若当前值不在列表中则补入，避免下拉打开就丢已填值；当前值为空时保持（留空）选中，不再强制填第一项）
      const comfyEmptyOpt = '<option value="">（留空）</option>';
      const fillSel = (selId: string, arr: string[], current: string): void => {
        const sel = document.getElementById(selId) as HTMLSelectElement | null;
        if (!sel) return;
        const cur = String(current || '').trim();
        const opts = cur && !arr.includes(cur) ? [cur, ...arr] : arr;
        sel.innerHTML = comfyEmptyOpt + opts.map((v) => '<option value="' + escapeAttr(v) + '">' + escapeHtml(v) + '</option>').join(''); // U2：统一出口
        if (cur) sel.value = cur;
        else if (sel.options.length) sel.options[0].selected = true;
      };
      const comfyCfg = config.imageGeneration.provider.comfyui;
      // 模型下拉分组：Checkpoint / UNet（含 GGUF）分开展示（spec §1.6）
      const modelSel = document.getElementById('portraitComfyModel') as HTMLSelectElement | null;
      if (modelSel) {
        const cur = String(comfyCfg.model || '').trim();
        const escOpt = (v: string): string => escapeHtml(v); // U2：统一出口（实体集一致）
        const groups: Array<[string, string[]]> = [['Checkpoint', info.checkpoints], ['UNet（含 GGUF）', info.unets]];
        let grouped = '';
        for (const [label, arr] of groups) {
          if (!arr || arr.length === 0) continue;
          grouped += '<optgroup label="' + label + '">';
          for (const v of arr) grouped += '<option value="' + escOpt(v) + '">' + escOpt(v) + '</option>';
          grouped += '</optgroup>';
        }
        if (cur && !info.models.includes(cur)) {
          grouped = '<option value="' + escOpt(cur) + '">' + escOpt(cur) + '</option>' + grouped;
        }
        modelSel.innerHTML = comfyEmptyOpt + (grouped || '<option value="">（服务端未返回模型列表）</option>');
        if (cur) modelSel.value = cur;
        else if (modelSel.options.length) modelSel.options[0].selected = true;
      }
      fillSel('portraitComfySampler', info.samplers, comfyCfg.sampler);
      fillSel('portraitComfyScheduler', info.schedulers, comfyCfg.scheduler);
      fillSel('portraitComfyVae', info.vaes, comfyCfg.vae);
      fillSel('portraitComfyClip', info.clips, comfyCfg.clip);
      fillSel('portraitComfyLora', info.loras, comfyCfg.lora);
      if (tr) tr.success('已拉取：模型 ' + info.models.length + ' / 采样器 ' + info.samplers.length + ' / VAE ' + info.vaes.length + ' / LoRA ' + info.loras.length, '立绘');
      return;
    }
    // 提示词串预设：编辑框即当前预设编辑器，改动需显式保存（仅 NAI 分支）
    if (id === 'portraitPrefix' || id === 'portraitSuffix' || id === 'portraitNegative' || id === 'portraitUseDefaultNegative') {
      // 不自动保存；仅提示未保存状态
      const hint = document.getElementById('portraitPresetDirtyHint');
      if (hint) hint.textContent = '警告：有未保存改动，点「保存到预设」生效';
      return;
    }
    const presetEl = document.getElementById('portraitPresetSelect') as HTMLSelectElement | null;
    const currentPreset = (): PortraitPromptPreset | null => {
      if (!presetEl || !presetEl.value) return null;
      const imageGeneration = config.imageGeneration;
      const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
        ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
        : getDefaultPromptPresets(imageGeneration.provider.novelai.negativePrompt);
      return presets.find(p => p.id === presetEl.value) || resolveActivePreset(presets, imageGeneration.tasks[_imageGenerationUiTask].promptPresetId) || null;
    };
    const commitPresets = (): void => {
      config.imageGeneration.provider = normalizePortraitImageGen(config.imageGeneration.provider);
      config.imageGeneration = normalizeImageGenerationConfig(config.imageGeneration, config);
      setConfig('imageGeneration', config.imageGeneration);
      if (_onConfigChanged) _onConfigChanged();
      showConfigPanel(config.style, 'api');
    };
    if (id === 'portraitPresetSaveBtn' || el.closest('#portraitPresetSaveBtn')) {
      const imageGeneration = config.imageGeneration;
      const ig = imageGeneration.provider;
      const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
        ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
        : getDefaultPromptPresets(ig.novelai.negativePrompt);
      const target = presets.find(p => p.id === String(presetEl ? presetEl.value : '')) || null;
      if (!target) return;
      target.promptPrefix = String($('#portraitPrefix').val() || '');
      target.promptSuffix = String($('#portraitSuffix').val() || '');
      target.negativePrompt = String($('#portraitNegative').val() || '');
      target.useDefaultNegative = collectPresetUseDefaultNegative(target.useDefaultNegative);
      if (ig.apiFormat === 'novelai') {
        target.novelai = collectPresetNovelAiForm(ig.novelai, target.novelai);
      }
      if (ig.apiFormat === 'openai') {
        target.openai = collectPresetOpenAiForm(ig.openai, target.openai);
      }
      if (ig.apiFormat === 'comfyui') {
        target.comfyui = collectPresetComfyUiForm(ig.comfyui, target.comfyui);
      }
      imageGeneration.promptPresets = presets;
      imageGeneration.tasks[_imageGenerationUiTask].promptPresetId = target.id;
      applyPresetToConfig(ig.novelai, target);
      applyPresetOpenAiToConfig(ig.openai, target);
      applyPresetComfyToConfig(ig.comfyui, target);
      commitPresets();
      return;
    }
    if (id === 'portraitPresetNewBtn' || el.closest('#portraitPresetNewBtn')) {
      const imageGeneration = config.imageGeneration;
      const ig = imageGeneration.provider;
      const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
        ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
        : getDefaultPromptPresets(ig.novelai.negativePrompt);
      const newId = nextPresetId(presets);
      const name = await showPromptDialog({ message: '请输入预设名称：', defaultValue: '新预设' + (newId.replace('preset-', '') || '1') });
      if (name === null) return;
      const newPreset: PortraitPromptPreset = {
        id: newId,
        name: name.trim() || '新预设' + (newId.replace('preset-', '') || '1'),
        promptPrefix: String($('#portraitPrefix').val() || ''),
        promptSuffix: String($('#portraitSuffix').val() || ''),
        negativePrompt: String($('#portraitNegative').val() || ''),
        useDefaultNegative: collectPresetUseDefaultNegative(),
      };
      if (ig.apiFormat === 'novelai') newPreset.novelai = collectPresetNovelAiForm(ig.novelai);
      if (ig.apiFormat === 'openai') newPreset.openai = collectPresetOpenAiForm(ig.openai);
      if (ig.apiFormat === 'comfyui') newPreset.comfyui = collectPresetComfyUiForm(ig.comfyui);
      presets.push(newPreset);
      imageGeneration.promptPresets = presets;
      imageGeneration.tasks[_imageGenerationUiTask].promptPresetId = newPreset.id;
      applyPresetToConfig(ig.novelai, newPreset);
      applyPresetOpenAiToConfig(ig.openai, newPreset);
      commitPresets();
      return;
    }
    if (id === 'portraitPresetRenameBtn' || el.closest('#portraitPresetRenameBtn')) {
      const imageGeneration = config.imageGeneration;
      const ig = imageGeneration.provider;
      const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
        ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
        : getDefaultPromptPresets(ig.novelai.negativePrompt);
      const target = presets.find(p => p.id === String(presetEl ? presetEl.value : '')) || null;
      if (!target) return;
      const name = await showPromptDialog({ message: '请输入预设名称：', defaultValue: target.name });
      if (name === null) return;
      target.name = name.trim() || target.name;
      imageGeneration.promptPresets = presets;
      commitPresets();
      return;
    }
    if (id === 'portraitPresetDeleteBtn' || el.closest('#portraitPresetDeleteBtn')) {
      const imageGeneration = config.imageGeneration;
      const ig = imageGeneration.provider;
      const target = currentPreset();
      if (!target) return;
      if (target.isDefault || target.id === DEFAULT_PROMPT_PRESET_ID) {
        getToastr()?.info?.('内置默认预设不可删除', '立绘');
        return;
      }
      if (!await showConfirmDialog({ message: '删除预设「' + target.name + '」？', danger: true })) return;
      const presets = imageGeneration.promptPresets && imageGeneration.promptPresets.length
        ? normalizePromptPresets(imageGeneration.promptPresets, getDefaultPromptPresets())
        : getDefaultPromptPresets(ig.novelai.negativePrompt);
      imageGeneration.promptPresets = presets.filter(p => p.id !== target.id);
      const nextActive = resolveActivePreset(imageGeneration.promptPresets, DEFAULT_PROMPT_PRESET_ID);
      imageGeneration.tasks[_imageGenerationUiTask].promptPresetId = nextActive.id;
      applyPresetToConfig(ig.novelai, nextActive);
      applyPresetOpenAiToConfig(ig.openai, nextActive);
      applyPresetComfyToConfig(ig.comfyui, nextActive);
      commitPresets();
      return;
    }
    // 预设内容容器：内部控件改动经「保存到预设」落盘，点击不触发全局采集
    if (el.closest('#ubPresetPanel')) return;
    // portrait 各输入控件 change → 收集归一化保存
    if (el.closest('#portraitCommonRow,#portraitSizeRow,#portraitModeRow,[id^="portrait"]')) {
      collectPortraitImageGen();
      return;
    }
    // ===== end 立绘生图 =====

    // 人物关系网：世界书注入开关（开→建/更条目族；关→移除条目族）
    if (id === 'charRelationWorldbookToggle' || el.closest('#charRelationWorldbookToggle')) {
      const next = config.charRelationWorldbook === false;
      config.charRelationWorldbook = next;
      setConfig('charRelationWorldbook', next);
      void setWorldbookProjectionEnabled('char-relations', next);
      const btn2 = document.getElementById('charRelationWorldbookToggle');
      if (btn2) btn2.classList.toggle('on', next);
      const _rcard = btn2?.closest('details.settings-section');
      const _rbadge = _rcard?.querySelector('.feature-status');
      if (_rbadge) {
        _rbadge.classList.toggle('on', next);
        _rbadge.classList.toggle('off', !next);
        _rbadge.textContent = next ? '世界书注入已开启' : '世界书注入已关闭';
      }
      if (_onConfigChanged) _onConfigChanged();
      return;
    }

    // 主角技能与天赋树：总开关
    // 开→先校验技能表存在（无表则提示「请进行表格修复」并禁止此次开启，不翻转开关/不落盘/不开表）；表存在则补登指南+开表。
    // 关→关表。
    if (id === 'skillToggle' || el.closest('#skillToggle')) {
      if (!config.skillEnabled) {
        // 开启：先校验技能表，无表则提示并禁止开启（开关保持关、不落盘、不开表）
        const ok = await ensureSkillTable({ promptOnMissing: true });
        if (!ok) return; // 校验失败：提示已由 ensureSkillTable 弹出，开关保持关、不重建面板
        config.skillEnabled = true;
        setConfig('skillEnabled', true);
        void setSkillTableEnabled(true);
        void setWorldbookProjectionEnabled('skills', true);
        // 技能正则卡片（发动/新增）随开关注入（幂等 + 同名漂移治愈）
        void ensureSkillRegexInjection().catch((e: unknown) => console.warn('[技能] 正则卡片注入失败:', e));
      } else {
        // 关闭
        config.skillEnabled = false;
        setConfig('skillEnabled', false);
        void setSkillTableEnabled(false);
        void setWorldbookProjectionEnabled('skills', false);
        // 正则卡片随开关撤除（与货币同口径：旧楼层标签回到裸文本，数据保留）
        void removeSkillRegexScripts();
      }
      const btn = document.getElementById('skillToggle');
      if (btn) btn.classList.toggle('on', config.skillEnabled);
      // 原地联动子区禁用态 + 徽标，避免 showConfigPanel 整体重建导致面板重置/跳顶
      setFeatureBodyEnabled('skillToggle', config.skillEnabled);
      const _scard = document.getElementById('skillToggle')?.closest('details.settings-section');
      if (_scard) syncFeatureStatus(_scard, config.skillEnabled);
      if (_onConfigChanged) _onConfigChanged();
      return;
    }
    // 清空当前对话所有天赋树
    if (id === 'skillClearTrees' || el.closest('#skillClearTrees')) {
      const { clearAllSkillTrees } = await import('../core/skill-store');
      await clearAllSkillTrees();
      getToastr()?.success('已清空当前对话所有天赋树', '技能');
      return;
    }

    // 时间锚定开关
    if (id === 'timeAnchorToggle' || el.closest('#timeAnchorToggle')) {
      config.timeAnchorEnabled = !config.timeAnchorEnabled;
      setConfig('timeAnchorEnabled', config.timeAnchorEnabled);
      const btn = document.getElementById('timeAnchorToggle');
      if (btn) btn.classList.toggle('on', config.timeAnchorEnabled);
      // 刷新子设置显示
      const detail = document.getElementById('timeAnchorDetail');
      if (detail) detail.style.display = config.timeAnchorEnabled ? 'flex' : 'none';
      if (_onConfigChanged) _onConfigChanged();
      const _card = document.getElementById('timeAnchorToggle')?.closest('details.settings-section');
      if (_card) syncFeatureStatus(_card, config.timeAnchorEnabled);
      return;
    }

    // 重置时间锚定按钮
    if (id === 'timeAnchorReset' || el.closest('#timeAnchorReset')) {
      const btn = document.getElementById('timeAnchorReset');
      if (btn) { btn.textContent = '更新中...'; (btn as HTMLButtonElement).disabled = true; }
      try {
        await resetTimeAnchors();
        getToastr()?.success('时间锚定已重置，所有纪要行已更新', '时间锚定');
      } catch (e) {
        getToastr()?.error('重置时间锚定失败', '时间锚定');
      }
      if (btn) { btn.textContent = '重置时间锚定'; (btn as HTMLButtonElement).disabled = false; }
      return;
    }

    // 删除时间锚定按钮
    if (id === 'timeAnchorDelete' || el.closest('#timeAnchorDelete')) {
      if (!await showConfirmDialog({ message: '确认删除sheet_summary中所有行的时间锚定前缀？此操作不可撤销。', danger: true })) return;
      const btn = document.getElementById('timeAnchorDelete');
      if (btn) { btn.textContent = '删除中...'; (btn as HTMLButtonElement).disabled = true; }
      try {
        const result = await deleteTimeAnchors();
        if (result.success) {
          getToastr()?.success(`已删除 ${result.count} 行的时间锚定前缀`, '时间锚定');
        } else {
          getToastr()?.warning('未找到sheet_summary或纪要列', '时间锚定');
        }
      } catch (e) {
        getToastr()?.error('删除时间锚定失败', '时间锚定');
      }
      if (btn) { btn.textContent = '删除时间锚定'; (btn as HTMLButtonElement).disabled = false; }
      return;
    }
  };

  // 立绘通用配置：input 事件即时收集保存（打字/滚轮/步进箭头不触发 click，仅点击会漏保存）。
  // 预设内容容器内改动只标脏不落盘（提示词与高级参数均经「保存到预设」写入）；上下文条数已有专属监听跳过。
  overlay.oninput = function (e) {
    const el = e.target as HTMLElement;
    if (!el) return;
    // 备份快照间隔：原生 input 即时保存（overlay.onclick 委托只在「点击输入框」时触发，
    // 覆盖不了打字/滚轮/步进箭头/回车等编辑路径）。
    if (el.id === 'ubBackupIntervalInput' || (el.closest && el.closest('#ubBackupIntervalInput'))) {
      let v = Math.floor(Number((el as HTMLInputElement).value));
      if (!Number.isFinite(v)) v = 1;
      v = Math.max(1, Math.min(999, v));
      setConfig('storyBackupInterval', v);
      (el as HTMLInputElement).value = String(v);
      return;
    }
    if (el.closest('#ubPresetPanel')) {
      markPresetPanelDirty();
      return;
    }
    if (el.closest('#portraitCommonRow,#portraitSizeRow,#portraitModeRow,[id^="portrait"]')) {
      if (el.id === 'portraitContextSlider' || el.id === 'portraitContextInput') return;
      collectPortraitImageGen();
    }
  };

  // 刷新商店UI（卡池复选框 + 已售统计）
  function refreshGachaUI() {
    const win = (window as any);
    const gachaData = win.__ub_getGachaData ? win.__ub_getGachaData() : null;
    const checkContainer = document.getElementById('gacha-pool-checks');
    const statEl = document.getElementById('gacha-stat');

    if (!gachaData || !gachaData.pools || !gachaData.items) {
      if (checkContainer) checkContainer.innerHTML = '<span style="color:var(--text-muted,var(--ub-text-muted,#999));font-size:10px;">卡池数据未加载</span>';
      if (statEl) statEl.textContent = '已售: --/--';
      return;
    }

    const allPools = gachaData.pools as any[];
    const allItems = gachaData.items as any[];
    const selectedPools: string[] = win.__ub_getGachaSelectedPools ? win.__ub_getGachaSelectedPools() : allPools.map((p: any) => p.id);
    const drawnSet: Set<string> = win.__ub_getGachaDrawnSet ? win.__ub_getGachaDrawnSet() : new Set();

    // 渲染池子复选框
    if (checkContainer) {
      let checksHTML = '';
      for (const pool of allPools) {
        const checked = selectedPools.includes(pool.id);
        // 统计该池子的物品总数和剩余数
        const poolItems = allItems.filter((item: any) =>
          (item.poolTags || []).includes(pool.id) && item.enabled
        );
        const remaining = poolItems.filter((item: any) => !drawnSet.has(item.id)).length;
        const empty = remaining === 0;
        checksHTML += '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:11px;color:var(--text,var(--sweet-text,var(--text-color,#111)));' + (empty ? 'opacity:0.4;' : '') + '">';
        checksHTML += '<input type="checkbox" class="gacha-pool-check" value="' + pool.id + '"' + (checked ? ' checked' : '') + ' style="margin:0;cursor:pointer;" />';
        checksHTML += '<span>' + pool.name + '(' + remaining + '/' + poolItems.length + ')</span>';
        checksHTML += '</label>';
      }
      checkContainer.innerHTML = checksHTML;
    }

    // 渲染统计
    if (statEl) {
      const totalPoolItems = new Set<string>();
      const effectivePools = new Set(selectedPools);
      for (const item of allItems) {
        if (!item.enabled) continue;
        if ((item.poolTags || []).some((t: string) => effectivePools.has(t))) {
          totalPoolItems.add(item.id);
        }
      }
      const drawnCount = Array.from(totalPoolItems).filter(id => drawnSet.has(id)).length;
      statEl.textContent = '已售: ' + drawnCount + '/' + totalPoolItems.size;
    }
  }

  // 各选择器事件
  function bindSelector(id: string, onChange: (value: string) => void) {
    const sel = document.getElementById(id);
    if (sel) sel.addEventListener('change', function () { onChange((this as HTMLSelectElement).value); });
  }

  let configChangeRaf: number | null = null;
  function scheduleConfigChanged(): void {
    if (!_onConfigChanged || configChangeRaf !== null) return;
    configChangeRaf = requestAnimationFrame(() => {
      configChangeRaf = null;
      _onConfigChanged?.();
    });
  }

  bindSelector('collapseBtnStyleSelector', (v) => {
    config.collapseBtnStyle = v as CollapseBtnStyle;
    setConfig('collapseBtnStyle', v as CollapseBtnStyle);
    if (_onConfigChanged) _onConfigChanged();
  });
  bindSelector('panelColorModeSelector', (v) => {
    const mode: 'plugin' | 'tavern' = v === 'tavern' ? 'tavern' : 'plugin';
    if (mode === config.panelColorMode) return;
    config.panelColorMode = mode;
    setConfig('panelColorMode', mode);
    setPanelColorMode(mode);
    resyncOpenOverlays();
  });
  bindSelector('styleSelector', (v) => {
    // 'literary' 是古风/仙侠合并条目的哨兵值；实际 style 取已保存的子配色 literaryScheme
    const next: StyleType = v === 'literary' ? (config.literaryScheme === 'xianxia' ? 'xianxia' : 'ancient') : v as StyleType;
    if (next !== config.style) {
      config.style = next;
      setConfig('style', next);
      if (next === 'ancient' || next === 'xianxia') { config.literaryScheme = next; setConfig('literaryScheme', next); }
      if (_onConfigChanged) _onConfigChanged();
    }
  });
  bindSelector('positionSelector', (v) => {
    config.positionMode = v as PositionMode; setConfig('positionMode', v as PositionMode);
    // 固定底部模式在移动端不可用，强制打开悬浮设置按钮以防无法访问设置
    if (v === 'fixed-bottom') {
      if (!config.showFloatingBtn) {
        config.showFloatingBtn = true;
        setConfig('showFloatingBtn', true);
        const toggle = document.getElementById('floatingBtnToggle');
        if (toggle) toggle.classList.add('on');
      }
    }
    // 「选项栏跟随底部」在 follow-bottom 布局下不生效，同步警告可见性
    const warn = document.getElementById('optionsBarFollowWarning');
    if (warn) warn.style.display = (v === 'follow-bottom') ? '' : 'none';
    if (_onConfigChanged) _onConfigChanged();
  });
  bindSelector('widthSelector', (v) => {
    config.widthMode = v as WidthMode; setConfig('widthMode', v as WidthMode);
    // 切换自定义宽度行显示
    const customRow = document.getElementById('customWidthRow');
    if (customRow) customRow.style.display = v === 'custom' ? 'flex' : 'none';
    if (_onConfigChanged) _onConfigChanged();
  });

  // 自定义宽度滑块 → 数字输入 双向同步
  const widthSlider = document.getElementById('customWidthSlider') as HTMLInputElement | null;
  const widthInput = document.getElementById('customWidthInput') as HTMLInputElement | null;
  if (widthSlider && widthInput) {
    widthSlider.addEventListener('input', function () {
      widthInput.value = this.value;
      const pct = parseInt(this.value) || 85;
      config.customWidthPercent = pct;
      setConfig('customWidthPercent', pct);
      scheduleConfigChanged();
    });
    widthInput.addEventListener('input', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < CUSTOM_SIZE_PERCENT_MIN) v = CUSTOM_SIZE_PERCENT_MIN;
      if (v > 100) v = 100;
      this.value = String(v);
      widthSlider.value = String(v);
      config.customWidthPercent = v;
      setConfig('customWidthPercent', v);
      scheduleConfigChanged();
    });
    widthInput.addEventListener('blur', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < CUSTOM_SIZE_PERCENT_MIN) v = CUSTOM_SIZE_PERCENT_MIN;
      if (v > 100) v = 100;
      this.value = String(v);
      widthSlider.value = String(v);
    });
  }

  const wardrobeModelTagsFemaleInput = document.getElementById('wardrobeModelTagsFemale') as HTMLTextAreaElement | null;
  const wardrobeModelTagsMaleInput = document.getElementById('wardrobeModelTagsMale') as HTMLTextAreaElement | null;
  const commitWardrobeModelTags = (): void => {
    const normalized = normalizeWardrobeModelTags({
      female: wardrobeModelTagsFemaleInput?.value ?? '',
      male: wardrobeModelTagsMaleInput?.value ?? '',
    });
    config.wardrobeModelTags = normalized;
    setConfig('wardrobeModelTags', normalized);
  };
  wardrobeModelTagsFemaleInput?.addEventListener('change', commitWardrobeModelTags);
  wardrobeModelTagsFemaleInput?.addEventListener('blur', commitWardrobeModelTags);
  wardrobeModelTagsMaleInput?.addEventListener('change', commitWardrobeModelTags);
  wardrobeModelTagsMaleInput?.addEventListener('blur', commitWardrobeModelTags);

  // 状态栏正文字号：即时写根级 CSS token + 持久化，不走 _onConfigChanged 全量渲染链
  const fontSlider = document.getElementById('statusbarContentFontSlider') as HTMLInputElement | null;
  const fontInput = document.getElementById('statusbarContentFontInput') as HTMLInputElement | null;
  const fontReset = document.getElementById('statusbarContentFontReset') as HTMLButtonElement | null;
  const fontLabelValue = document.getElementById('statusbarContentFontLabelValue');
  if (fontSlider && fontInput) {
    const commitStatusbarContentFontPercent = (percent: number): void => {
      const scale = normalizeStatusbarContentFontScale(percent / 100);
      const normalizedPercent = Math.round(scale * 100);
      fontSlider.value = String(normalizedPercent);
      fontInput.value = String(normalizedPercent);
      if (fontLabelValue) fontLabelValue.textContent = normalizedPercent + '%';
      config.statusbarContentFontScale = scale;
      setConfig('statusbarContentFontScale', scale);
      applyStatusbarContentFontScale(scale);
    };
    fontSlider.addEventListener('input', function () {
      commitStatusbarContentFontPercent(Number(this.value));
    });
    fontInput.addEventListener('input', function () {
      if (this.value === '') return;
      const percent = Number(this.value);
      if (Number.isFinite(percent) && percent >= 100 && percent <= 150) {
        commitStatusbarContentFontPercent(percent);
      }
    });
    fontInput.addEventListener('blur', function () {
      const fallbackPercent = Math.round(config.statusbarContentFontScale * 100);
      commitStatusbarContentFontPercent(this.value === '' ? fallbackPercent : Number(this.value));
    });
    fontReset?.addEventListener('click', () => {
      commitStatusbarContentFontPercent(STATUSBAR_CONTENT_FONT_SCALE_DEFAULT * 100);
    });
  }

  // 弹窗/设置面板字号：即时写根级 CSS token + 持久化，不走 _onConfigChanged 全量渲染链
  const popupFontSlider = document.getElementById('popupSettingsFontSlider') as HTMLInputElement | null;
  const popupFontInput = document.getElementById('popupSettingsFontInput') as HTMLInputElement | null;
  const popupFontReset = document.getElementById('popupSettingsFontReset') as HTMLButtonElement | null;
  const popupFontLabelValue = document.getElementById('popupSettingsFontLabelValue');
  if (popupFontSlider && popupFontInput) {
    const commitPopupFontPercent = (percent: number): void => {
      const scale = normalizeUiFontScale(percent / 100);
      const normalizedPercent = Math.round(scale * 100);
      popupFontSlider.value = String(normalizedPercent);
      popupFontInput.value = String(normalizedPercent);
      if (popupFontLabelValue) popupFontLabelValue.textContent = normalizedPercent + '%';
      config.popupSettingsFontScale = scale;
      setConfig('popupSettingsFontScale', scale);
      applyUiFontScale(scale);
    };
    popupFontSlider.addEventListener('input', function () {
      commitPopupFontPercent(Number(this.value));
    });
    popupFontInput.addEventListener('input', function () {
      if (this.value === '') return;
      const percent = Number(this.value);
      if (Number.isFinite(percent) && percent >= 100 && percent <= 150) {
        commitPopupFontPercent(percent);
      }
    });
    popupFontInput.addEventListener('blur', function () {
      const fallbackPercent = Math.round(config.popupSettingsFontScale * 100);
      commitPopupFontPercent(this.value === '' ? fallbackPercent : Number(this.value));
    });
    popupFontReset?.addEventListener('click', () => {
      commitPopupFontPercent(UI_FONT_SCALE_DEFAULT * 100);
    });
  }

  // 自定义高度滑块 → 数字输入 双向同步
  const heightSlider = document.getElementById('customHeightSlider') as HTMLInputElement | null;
  const heightInput = document.getElementById('customHeightInput') as HTMLInputElement | null;
  if (heightSlider && heightInput) {
    heightSlider.addEventListener('input', function () {
      heightInput.value = this.value;
      const pct = parseInt(this.value) || CUSTOM_HEIGHT_DEFAULT;
      config.customHeightPercent = pct;
      setConfig('customHeightPercent', pct);
      // 更新 label 显示
      // label 不好精准定位，通过 id 前缀找
      if (_onConfigChanged) _onConfigChanged();
    });
    heightInput.addEventListener('input', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < CUSTOM_SIZE_PERCENT_MIN) v = CUSTOM_SIZE_PERCENT_MIN;
      if (v > 100) v = 100;
      this.value = String(v);
      heightSlider.value = String(v);
      config.customHeightPercent = v;
      setConfig('customHeightPercent', v);
      scheduleConfigChanged();
    });
    heightInput.addEventListener('blur', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < CUSTOM_SIZE_PERCENT_MIN) v = CUSTOM_SIZE_PERCENT_MIN;
      if (v > 100) v = 100;
      this.value = String(v);
      heightSlider.value = String(v);
    });
  }

  // ===== 大调查上下文条目数设置 =====
  const investContextSlider = document.getElementById('investContextSlider') as HTMLInputElement | null;
  const investContextInput = document.getElementById('investContextInput') as HTMLInputElement | null;
  if (investContextSlider && investContextInput) {
    function setInvestContext(val: number): void {
      val = Math.max(1, Math.min(50, val));
      config.investigationContextCount = val;
      setConfig('investigationContextCount', val);
      investContextInput!.value = String(val);
      investContextSlider!.value = String(val);
    }
    investContextSlider.addEventListener('input', function () {
      setInvestContext(parseInt(this.value) || INVESTIGATION_DEFAULT_CONTEXT_COUNT);
    });
    investContextInput.addEventListener('input', function () {
      setInvestContext(parseInt(this.value) || INVESTIGATION_DEFAULT_CONTEXT_COUNT);
    });
    investContextInput.addEventListener('blur', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < 1) v = INVESTIGATION_DEFAULT_CONTEXT_COUNT;
      if (v > 50) v = 50;
      setInvestContext(v);
    });
  }

  // ===== 主角技能与天赋树设置 =====
  const skCS = document.getElementById('skillContextSlider') as HTMLInputElement | null;
  const skCI = document.getElementById('skillContextInput') as HTMLInputElement | null;
  if (skCS && skCI) {
    const setSkillCtx = (val: number): void => {
      val = Math.min(20, Math.max(1, Math.floor(val) || 4));
      config.skillContextCount = val; setConfig('skillContextCount', val);
      skCI.value = String(val); skCS.value = String(val);
      const lbl = skCS.parentElement?.parentElement?.querySelector('.settings-label');
      if (lbl) lbl.textContent = 'AI 生成剧情上下文条数 (' + val + ')';
    };
    skCS.addEventListener('input', () => setSkillCtx(parseInt(skCS.value) || 4));
    skCI.addEventListener('input', () => setSkillCtx(parseInt(skCI.value) || 4));
    skCI.addEventListener('blur', () => { let v = parseInt(skCI.value); if (isNaN(v) || v < 1) v = 4; if (v > 20) v = 20; setSkillCtx(v); });
  }
  const skWS = document.getElementById('skillWbSlider') as HTMLInputElement | null;
  const skWI = document.getElementById('skillWbInput') as HTMLInputElement | null;
  if (skWS && skWI) {
    const setSkillWb = (val: number): void => {
      val = Math.min(50, Math.max(1, Math.floor(val) || 20));
      config.skillMaxWorldbookEntries = val; setConfig('skillMaxWorldbookEntries', val);
      skWI.value = String(val); skWS.value = String(val);
      const lbl = skWS.parentElement?.parentElement?.querySelector('.settings-label');
      if (lbl) lbl.textContent = '蓝灯/技能名匹配条目上限 (' + val + ')';
    };
    skWS.addEventListener('input', () => setSkillWb(parseInt(skWS.value) || 20));
    skWI.addEventListener('input', () => setSkillWb(parseInt(skWI.value) || 20));
    skWI.addEventListener('blur', () => { let v = parseInt(skWI.value); if (isNaN(v) || v < 1) v = 20; if (v > 50) v = 50; setSkillWb(v); });
  }

  // ===== 剧情特卖上下文条数设置 =====
  const shopStorySlider = document.getElementById('shopStoryContextSlider') as HTMLInputElement | null;
  const shopStoryInput = document.getElementById('shopStoryContextInput') as HTMLInputElement | null;
  if (shopStorySlider && shopStoryInput) {
    function setShopStoryContext(val: number): void {
      val = Math.max(1, Math.min(30, val));
      config.shopStoryContextCount = val;
      setConfig('shopStoryContextCount', val);
      shopStoryInput!.value = String(val);
      shopStorySlider!.value = String(val);
    }
    shopStorySlider.addEventListener('input', function () {
      setShopStoryContext(parseInt(this.value) || 10);
    });
    shopStoryInput.addEventListener('input', function () {
      setShopStoryContext(parseInt(this.value) || 10);
    });
    shopStoryInput.addEventListener('blur', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < 1) v = 10;
      if (v > 30) v = 30;
      setShopStoryContext(v);
    });
  }

  // ===== 大调查最大注入纪要数设置 =====
  const investSummarySlider = document.getElementById('investSummarySlider') as HTMLInputElement | null;
  const investSummaryInput = document.getElementById('investSummaryInput') as HTMLInputElement | null;
  if (investSummarySlider && investSummaryInput) {
    function setInvestSummary(val: number): void {
      val = Math.max(0, Math.min(50, val));
      config.investigationMaxSummaryCount = val;
      setConfig('investigationMaxSummaryCount', val);
      investSummaryInput!.value = String(val);
      investSummarySlider!.value = String(val);
    }
    investSummarySlider.addEventListener('input', function () {
      setInvestSummary(parseInt(this.value) || 0);
    });
    investSummaryInput.addEventListener('input', function () {
      setInvestSummary(parseInt(this.value) || 0);
    });
    investSummaryInput.addEventListener('blur', function () {
      let v = parseInt(this.value);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 50) v = 50;
      setInvestSummary(v);
    });
  }

  // ===== 瑟瑟指导设置 =====
  const nsfwGuidanceContextInput = document.getElementById('nsfwGuidanceContextInput') as HTMLInputElement | null;
  if (nsfwGuidanceContextInput) {
    nsfwGuidanceContextInput.addEventListener('blur', function () {
      let value = parseInt(this.value, 10);
      if (!Number.isFinite(value) || value < 1) value = 2;
      value = Math.min(20, value);
      config.nsfwGuidanceContextCount = value;
      setConfig('nsfwGuidanceContextCount', value);
      this.value = String(value);
    });
  }

  const nsfwGuidanceWorldbookInput = document.getElementById('nsfwGuidanceWorldbookInput') as HTMLInputElement | null;
  if (nsfwGuidanceWorldbookInput) {
    nsfwGuidanceWorldbookInput.addEventListener('blur', function () {
      let value = parseInt(this.value, 10);
      if (!Number.isFinite(value) || value < 1) value = 20;
      value = Math.min(50, value);
      config.nsfwGuidanceMaxWorldbookEntries = value;
      setConfig('nsfwGuidanceMaxWorldbookEntries', value);
      this.value = String(value);
    });
  }

  const nsfwGuidanceMaxCharsInput = document.getElementById('nsfwGuidanceMaxCharsInput') as HTMLInputElement | null;
  if (nsfwGuidanceMaxCharsInput) {
    nsfwGuidanceMaxCharsInput.addEventListener('blur', function () {
      let value = parseInt(this.value, 10);
      if (!Number.isFinite(value) || value < 1) value = 200;
      config.nsfwGuidanceMaxChars = value;
      setConfig('nsfwGuidanceMaxChars', value);
      this.value = String(value);
    });
  }

  // 玩法条目注入位置 / 深度：变更后强制重新注入（仅功能开启时）
  const nsfwPlayWbPositionSel = document.getElementById('nsfwPlayWbPositionSelect') as HTMLSelectElement | null;
  if (nsfwPlayWbPositionSel) {
    nsfwPlayWbPositionSel.addEventListener('change', function () {
      const pos = this.value as any;
      setConfig('nsfwPlayWorldbookPosition', pos);
      const depthRow = document.getElementById('nsfwPlayWbDepthRow');
      if (depthRow) depthRow.style.display = pos === 'at_depth' ? '' : 'none';
      if (config.nsfwPlayEnabled) { resetPlayWorldbookCache(); syncPlayWorldbook(); }
    });
  }
  const nsfwPlayWbDepthInput = document.getElementById('nsfwPlayWbDepthInput') as HTMLInputElement | null;
  if (nsfwPlayWbDepthInput) {
    nsfwPlayWbDepthInput.addEventListener('change', function () {
      const d = Math.max(0, Math.min(99, Math.floor(Number(this.value) || 0)));
      this.value = String(d);
      setConfig('nsfwPlayWorldbookDepth', d);
      if (config.nsfwPlayEnabled) { resetPlayWorldbookCache(); syncPlayWorldbook(); }
    });
  }

  // 同时生效上限（多选翻新）：clamp 1-10 落库；调低不裁剪已选（只拦新增），chips 的 N/max 读数随下次刷新更新
  const nsfwPlayMaxSelectedInput = document.getElementById('nsfwPlayMaxSelectedInput') as HTMLInputElement | null;
  if (nsfwPlayMaxSelectedInput) {
    nsfwPlayMaxSelectedInput.addEventListener('change', function () {
      const n = Math.max(1, Math.min(10, Math.floor(Number(this.value) || 5)));
      this.value = String(n);
      setConfig('nsfwPlayMaxSelected', n);
      refreshPlayChipsUI();
    });
  }


  // ===== API 标签页事件绑定（已迁至 panels/config-panel-tabs/api-tab.ts）=====
  bindApiTab(config, notifyConfigChanged);
  // 生图 AI 请求提示词板块（独立子区：与预设解耦；智慧姬直连下仍生效）
  bindImagePromptBoard();
}
