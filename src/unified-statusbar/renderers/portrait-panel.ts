import { getConfig, setConfig } from '../core/config-store';
import { getToastr } from '../core/env';
import { setButtonBusy } from '../core/busy-state';
import { ubIcon } from '../core/icons';
import { flashInlineHint } from './effects';
import { generatePortrait, getPortraitIndex, setCurrentPortrait, deletePortrait, importLocalPortrait, switchPortraitRandom, togglePortraitInRandomPool, updatePortraitMeta, updatePortraitGenText, regeneratePortraitFromArchive, getPortraitCharTags, isUseCharTags, savePortraitCharTags, setUseCharTags, isPortraitFanwork, setPortraitFanwork, getPortraitFanTags, savePortraitFanTags, type PortraitEntry, type PortraitIndex, type PortraitPreset } from '../core/portrait-system';
import { isRecordReplayable } from '../core/image-gen';
import type { ImageGenRegenPatch } from '../core/image-gen';
import { generateCharTags, generateFanTags } from '../core/portrait-tags';
import { isProtagonistKey, portraitLabel, buildProtagonistGenBasisHtml } from '../core/portrait-protagonist';
import { PORTRAIT_THEME_OPTIONS, type PortraitTheme } from '../core/portrait-prompts';
import { closePanelOverlay, markPopupShown, guardGhostClick, syncDarkClass, syncDarkClassMinimal, copyTextToClipboard, genParamsEditHtml, readGenParamsPatch } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { placeAnchoredMenu } from './anchored-menu';
import { STANDARD_EMOTIONS, emotionConfigAncient, emotionConfigModern, type StyleType } from '../core/constants';
import { portraitMatchesEmotionFilter, portraitMatchesNsfwFilter, resolveSizeByOrientation, inferSizeOrientation, matchSizeOrientation, type PortraitGalleryFilter, type PortraitSizeOrientation } from '../core/portrait-config';
import { escapeHtml, escapeAttr as escAttr } from '../core/html-escape';
import { getWardrobeSnapshot } from '../core/wardrobe-store';
import {
  getFullReplacementWarning,
  resolvePortraitWardrobeSelection,
} from '../core/portrait-wardrobe-selection';
import type { PortraitClothingOverride } from '../core/wardrobe-prompts';
import { exportPortraitBatch } from '../core/portrait-batch';
import { triggerBlobDownload } from '../core/zip-store';

// 立绘重试状态机：#portraitGenStart 失败时置 true；#portraitRegenImg 成功时清 false（供 portrait_retry_success 隐藏成就）
let lastAttemptFailed = false;

function getOverlay(): HTMLElement | null { return document.getElementById('panelOverlay'); }

function portraitBridgeClass(style: StyleType, variant = ''): string {
  return style === 'bridge'
    ? ' bridge-window bridge-module-imaging' + (variant ? ' ' + variant : '')
    : '';
}

export function buildPortraitDialogClass(style: StyleType, kind: 'gallery' | 'generator'): string {
  const wrapClass = kind === 'gallery' ? 'portrait-gallery-wrap' : 'portrait-gen-wrap';
  const bridgeVariant = kind === 'gallery' ? 'bridge-portrait-gallery' : 'bridge-portrait-generator';
  return 'panel-popup portrait-popup ' + wrapClass + ' ub-popup--xl' + portraitBridgeClass(style, bridgeVariant);
}

export function buildPortraitGalleryFilterToolbar(filterState: PortraitGalleryFilter): string {
  const emotionOptions = ['全部', ...STANDARD_EMOTIONS, '其他'].map(e =>
    `<option value="${e}"${filterState.emotion === e ? ' selected' : ''}>${e}</option>`
  ).join('');
  const sceneOptions: Array<[string, string]> = [
    ['全部', '全部'], ['日常', 'daily'], ['瑟瑟', 'nsfw'], ['未标注', 'untagged'],
  ];
  const nsfwOptions = sceneOptions.map(([label, value]) =>
    `<option value="${value}"${filterState.nsfw === value ? ' selected' : ''}>${label}</option>`
  ).join('');
  return `
    <div class="portrait-gallery-filters" id="pgFilters">
      <label class="pg-filter-field">情绪
        <select id="pgFilterEmotion" class="pg-filter-select" aria-label="按情绪筛选">${emotionOptions}</select>
      </label>
      <label class="pg-filter-field">场景
        <select id="pgFilterNsfw" class="pg-filter-select" aria-label="按场景筛选">${nsfwOptions}</select>
      </label>
    </div>`;
}

// —— 人物tag编辑窗（复用 #panelOverlay；每个出口先关窗再经 onClose 重开生成弹窗）——
function openCharTagsEditor(npc: string, style: StyleType, onClose: () => void): void {
  const tags = getPortraitCharTags(npc);
  const overlay = getOverlay();
  if (!overlay || !tags) return;
  const html = `
  <div class="${buildPortraitDialogClass(style, 'generator')}">
    <div class="portrait-popup-header">
      <span class="portrait-popup-title">「${escapeHtml(portraitLabel(npc))}」人物tag</span>
      <span class="portrait-popup-close" id="ubCtClose">${ubIcon('close')}</span>
    </div>
    <div class="portrait-gen-field">
      <div class="portrait-gen-label">外貌（英文 danbooru tag，逗号分隔）</div>
      <textarea class="portrait-gen-textarea" id="ubCtAppearance" rows="6">${escapeHtml(tags.appearance)}</textarea>
    </div>
    <div class="portrait-gen-field">
      <div class="portrait-gen-label">身材（英文 danbooru tag，逗号分隔）</div>
      <textarea class="portrait-gen-textarea" id="ubCtBody" rows="6">${escapeHtml(tags.body)}</textarea>
    </div>
    <div class="portrait-gen-btns">
      <button type="button" class="portrait-gen-btn-primary" id="ubCtSave">保存</button>
      <button type="button" class="portrait-gen-btn-regen" id="ubCtRegen">重新AI生成</button>
      <button type="button" class="portrait-gen-btn-cancel" id="ubCtClear">清空</button>
      <button type="button" class="portrait-gen-btn-cancel" id="ubCtCancel">取消</button>
    </div>
  </div>`;
  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const $ov = $(overlay);
  // AI 生成是长耗时异步：期间编辑窗可能已被关掉/换成别的弹窗（甚至另一角色的编辑窗），
  // 回填只许写自己的窗（同 overlay 复用，id 撞名）
  const tagsRoot = overlay.firstElementChild;
  const isMine = (): boolean => !!tagsRoot && tagsRoot.isConnected && overlay.firstElementChild === tagsRoot;
  const exit = (): void => { closePanelOverlay(overlay); onClose(); };
  $ov.find('#ubCtClose,#ubCtCancel').on('click', exit);
  $ov.find('#ubCtSave').on('click', async function () {
    const appearance = String($ov.find('#ubCtAppearance').val() || '').trim();
    const body = String($ov.find('#ubCtBody').val() || '').trim();
    if (!appearance && !body) {
      getToastr()?.warning('两段均为空，请填写或点「清空」删除', '人物tag');
      return;
    }
    const saved = await savePortraitCharTags(npc, { appearance, body });
    if (!saved) { getToastr()?.error('保存失败（存储未就绪）', '人物tag'); return; }
    getToastr()?.success('人物tag已保存', '人物tag');
    exit();
  });
  $ov.find('#ubCtClear').on('click', async function () {
    if (!(await showConfirmDialog({ message: `确定删除「${npc}」的人物tag？替代开关将一并关闭。` }))) return;
    const saved = await savePortraitCharTags(npc, null);
    if (!saved) { getToastr()?.error('删除失败（存储未就绪）', '人物tag'); return; }
    getToastr()?.success('人物tag已删除', '人物tag');
    exit();
  });
  $ov.find('#ubCtRegen').on('click', async function () {
    $(this).prop('disabled', true).text('生成中…');
    const res = await generateCharTags(npc);
    $(this).prop('disabled', false).text('重新AI生成');
    if (res.switched) return; // 聊天已切换：结果未落盘，静默跳过
    if (!res.ok || !res.tags) {
      getToastr()?.error(res.error || '生成失败', '人物tag');
      return;
    }
    // 回填 textarea（generateCharTags 已落盘；textarea 内继续编辑需再点「保存」）——
    // 仅当本编辑窗仍在挂载（生成期间用户可能已关窗打开别的弹窗）
    if (!isMine()) return;
    $ov.find('#ubCtAppearance').val(res.tags.appearance);
    $ov.find('#ubCtBody').val(res.tags.body);
  });
  overlay.onclick = function (e) {
    if (e.target === overlay) { if (guardGhostClick()) return; exit(); }
  };
}

// —— 生成弹窗 ——
export function showPortraitGenDialog(
  npc: string,
  style: StyleType,
  onGenerated?: () => void,
  onClosed?: () => void,
): void {
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return;
  // 主角模式：标题/提示用显示名（哨兵 key 不可读）；情绪/包含主角两选项置灰且偏好强制 false；
  // 同人开关在人物tag区（与固定 tag 替代互斥，按角色即时落盘），主角同样置灰
  const isProtagonist = isProtagonistKey(npc);
  const shownName = portraitLabel(npc);
  const overlay = getOverlay(); if (!overlay) return;
  const ig = cfg.portraitImageGen;
  const taskPortrait = cfg.imageGeneration.tasks.portrait;
  // 设置尺寸与某个快速方向完全一致时不再单列「默认」按钮（重合项即默认）；否则行首显示「默认 设置尺寸」
  const matchedOrientation = matchSizeOrientation(ig.apiFormat, taskPortrait.width, taskPortrait.height, taskPortrait.aspectRatio);
  const defaultSizeLabel = ig.apiFormat === 'openai' ? (taskPortrait.aspectRatio || 'auto') : `${taskPortrait.width}×${taskPortrait.height}`;
  // 初始高亮方向：有偏好→偏好（保存偏好后按偏好来）；无偏好→设置尺寸的重合项；都无→null 高亮「默认」按钮（用设置里的尺寸）
  const initialOrientation: PortraitSizeOrientation | null = cfg.portraitGenPreference
    ? cfg.portraitGenPreference.sizeOrientation
    : matchedOrientation;
  const sizeBtnLabel = (o: PortraitSizeOrientation) => {
    const sz = resolveSizeByOrientation(ig.apiFormat, o);
    const name = o === 'portrait' ? '竖' : o === 'landscape' ? '横' : '1:1';
    const dim = ig.apiFormat === 'openai' ? sz.aspectRatio : `${sz.width}×${sz.height}`;
    return `${name} ${dim}`;
  };
  // 偏好恢复初值（须在 html 模板之前声明：模板内按初值渲染 active/checked/预填）
  const pref = cfg.portraitGenPreference;
  let preset: PortraitPreset = pref ? pref.preset : 'default';
  let theme: PortraitTheme = pref ? pref.theme : 'default';   // 有偏好按偏好；否则默认
  // 用户在本次弹窗内的临时选择；主题强制规则只改变有效值与控件状态，不覆盖偏好。
  let includeStatusPreference = pref ? pref.includeStatus : true;
  let includeEmotionPreference = isProtagonist ? false : (pref ? pref.includeEmotion : true);
  let includeProtagonist = isProtagonist ? false : (pref ? pref.includeProtagonist : false);
  let sizeOrientation: PortraitSizeOrientation | null = initialOrientation;
  // 预填充：优先取「最近一次」提示词（跨会话持久），回退到最近一张立绘条目的 promptText（覆盖旧数据）
  const existingIdx = getPortraitIndex(npc);
  const lastPortrait = existingIdx?.portraits?.[existingIdx.portraits.length - 1] || null;
  const initialPrompt = existingIdx?.lastPrompt?.promptText || lastPortrait?.promptText || '';
  const initialNegative = existingIdx?.lastPrompt?.negativePrompt || lastPortrait?.negativePrompt || '';
  // 转义 textarea 内容（U2：统一出口 escapeHtml——textarea 内多转义引号无副作用）
  const escHtml = (s: string) => escapeHtml(s);
  const wardrobeState = cfg.wardrobeEnabled ? getWardrobeSnapshot() : null;
  // 人物固定特征 tag（外貌/身材一致性锚点）：无 tag 时开关置灰，按钮文案随有无切换
  const existingTags = getPortraitCharTags(npc);
  const useTagsNow = isUseCharTags(npc);
  // 同人角色标记（与固定 tag 替代互斥；主角恒 false）；身份 tag 固化在立绘索引，一次识别或手填后复用
  const fanworkNow = isProtagonist ? false : isPortraitFanwork(npc);
  const fanTagsNow = isProtagonist ? null : getPortraitFanTags(npc);
  const wardrobeControls = wardrobeState ? `
      <div class="portrait-gen-field portrait-wardrobe-replace">
        <div class="portrait-gen-label">替换服装</div>
        <label class="portrait-inline-check">
          <input type="checkbox" id="portraitClothingReplace"${wardrobeState.items.length ? '' : ' disabled'}>
          <span>使用衣柜服饰替换人物当前穿着</span>
        </label>
        <div class="portrait-wardrobe-controls" id="portraitWardrobeControls" hidden>
          <div class="portrait-wardrobe-mode-row">
            <label class="portrait-wardrobe-choice"><input type="radio" name="portraitWardrobeMode" value="partial" checked> 部分替换</label>
            <label class="portrait-wardrobe-choice"><input type="radio" name="portraitWardrobeMode" value="full"> 全部替换</label>
          </div>
          <div class="portrait-wardrobe-source-row">
            <label class="portrait-wardrobe-choice"><input type="radio" name="portraitWardrobeSource" id="portraitWardrobeSourceOutfit" value="outfit" checked> 使用套装</label>
            <label class="portrait-wardrobe-choice"><input type="radio" name="portraitWardrobeSource" id="portraitWardrobeSourceCustom" value="custom"> 自选服饰</label>
          </div>
          <div id="portraitWardrobeOutfitPane">
            <select id="portraitWardrobeOutfit" aria-label="选择衣柜套装">
              <option value="">请选择套装</option>
              ${wardrobeState.outfits.map(outfit => `<option value="${escAttr(outfit.id)}">${escHtml(outfit.name)}</option>`).join('')}
            </select>
          </div>
          <div class="portrait-wardrobe-custom-list" id="portraitWardrobeCustomPane" hidden>
            ${wardrobeState.items.map(item => `<label>
              <input type="checkbox" data-portrait-wardrobe-item="${escAttr(item.id)}">
              <span><strong class="portrait-wardrobe-item-name">${escHtml(item.name)}</strong><small class="portrait-wardrobe-item-description">${escHtml(item.category)} · ${escHtml(item.description)}</small></span>
            </label>`).join('')}
          </div>
          <div class="portrait-wardrobe-warning" id="portraitWardrobeWarning"></div>
        </div>
        ${wardrobeState.items.length ? '' : '<div class="portrait-wardrobe-warning">衣柜中还没有服饰，请先在衣柜中添加。</div>'}
      </div>` : '';
  const html = `
  <div class="${buildPortraitDialogClass(style, 'generator')}">
    <div class="portrait-popup-header">
        <span class="portrait-popup-title">为「${escapeHtml(shownName)}」生成立绘${isProtagonist ? '<span style="font-size:10px;color:var(--accent,#4a90d9);border:1px solid var(--accent,#4a90d9);border-radius:8px;padding:0 6px;margin-left:6px;vertical-align:2px">主角</span>' : ''}</span>
        <span class="portrait-popup-close" id="portraitGenClose">${ubIcon('close')}</span>
      </div>
      <div class="portrait-gen-field">
        <div class="portrait-gen-label">构图预设</div>
        <div class="portrait-preset-row" id="portraitPresetRow">
          <button class="portrait-preset-btn${preset === 'default' ? ' active' : ''}" data-preset="default">默认</button>
          <button class="portrait-preset-btn${preset === 'avatar' ? ' active' : ''}" data-preset="avatar">头像</button>
          <button class="portrait-preset-btn${preset === 'halfbody' ? ' active' : ''}" data-preset="halfbody">半身像</button>
          <button class="portrait-preset-btn${preset === 'fullbody' ? ' active' : ''}" data-preset="fullbody">全身像</button>
        </div>
      </div>
      <div class="portrait-gen-field">
        <div class="portrait-gen-label">主题</div>
        <div class="portrait-preset-row" id="portraitThemeRow">
          ${PORTRAIT_THEME_OPTIONS.map(opt =>
            `<button class="portrait-preset-btn${theme === opt.id ? ' active' : ''}" data-theme="${opt.id}">${escapeHtml(opt.label)}</button>`).join('')}
        </div>
      </div>
      <div class="portrait-gen-field">
        <div class="portrait-gen-label">角色动态信息</div>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:var(--ub-ui-font-12,12px);color:var(--text,#444)">
          <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer">
            <input type="checkbox" id="portraitIncludeStatus"${includeStatusPreference ? ' checked' : ''}>
            <span>包含当前状态</span>
          </label>
          <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"${isProtagonist ? ' title="主角信息表无情绪列，无数据源"' : ''}>
            <input type="checkbox" id="portraitIncludeEmotion"${includeEmotionPreference ? ' checked' : ''}${isProtagonist ? ' disabled' : ''}>
            <span>包含情绪</span>
          </label>
          <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer" title="${isProtagonist ? '主角即生图对象' : '勾选后画面额外出现主角作为第二人，以最少方式出镜且尽量不露脸，用于互动/NSFW 场景；不勾选时提示词不变'}">
            <input type="checkbox" id="portraitIncludeProtagonist"${includeProtagonist ? ' checked' : ''}${isProtagonist ? ' disabled' : ''}>
            <span>包含主角</span>
          </label>
          <span id="portraitContextRuleHint" style="font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,#888)"></span>
        </div>
      </div>
      <div class="portrait-gen-field">
        <div class="portrait-gen-label">本次额外提示词（可选）</div>
        <textarea class="portrait-gen-textarea" id="portraitExtraPrompt" placeholder="例如：手持折扇，背景樱花，微笑">${escHtml(pref ? pref.extraPrompt : '')}</textarea>
      </div>
      <div class="portrait-gen-field">
        <div class="portrait-gen-label">人物tag / 同人角色（外貌一致性锚点，二选一）</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <label class="portrait-inline-check" style="cursor:${existingTags ? 'pointer' : 'not-allowed'}">
            <input type="checkbox" id="portraitCharTagsToggle"${useTagsNow ? ' checked' : ''}${existingTags ? '' : ' disabled'}>
            <span>用人物tag替代数据库外貌/身材</span>
          </label>
          <button type="button" class="portrait-preset-btn" id="portraitCharTagsEditBtn">${existingTags ? '编辑tag' : '生成tag'}</button>
          ${existingTags ? '' : `<span style="font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,#888)">尚无人物tag，先生成后再开启替代${isProtagonist ? '；主角外貌特征较短，建议先生成人物tag再开启替代' : ''}</span>`}
        </div>
        <div style="margin-top:6px">
          <label class="portrait-inline-check" style="cursor:${isProtagonist ? 'not-allowed' : 'pointer'}" title="${isProtagonist ? '主角为自创角色，无同人原型' : '该人物是已有作品的同人角色：立绘与正文插图不再注入数据库外貌，提示词改用原作标准角色标签与作品标签（外貌由生图模型自带）。与人物tag替代互斥，开启即按角色保存'}">
            <input type="checkbox" id="portraitFanworkToggle"${fanworkNow ? ' checked' : ''}${isProtagonist ? ' disabled' : ''}>
            <span>同人角色（用原作角色标签）</span>
          </label>
        </div>
        <div class="portrait-fan-tags" id="portraitFanTagsPane"${fanworkNow ? '' : ' hidden'}>
          <div class="portrait-gen-label">同人身份 tag（原作人物 / 作品：识别一次即固化，生图直接拼接）</div>
          <div class="portrait-fan-tag-row">
            <span class="portrait-fan-tag-name">人物tag</span>
            <input type="text" id="portraitFanTagCharacter" class="portrait-gen-textarea" value="${escAttr(fanTagsNow?.character || '')}" placeholder="如 rem_(re:zero)">
          </div>
          <div class="portrait-fan-tag-row">
            <span class="portrait-fan-tag-name">作品tag</span>
            <input type="text" id="portraitFanTagCopyright" class="portrait-gen-textarea" value="${escAttr(fanTagsNow?.copyright || '')}" placeholder="如 re:zero_kara_hajimeru_isekai_seikatsu">
          </div>
          <div class="portrait-fan-tags-foot">
            <button type="button" class="portrait-preset-btn" id="portraitFanTagGenBtn">AI识别身份</button>
            <span class="portrait-fan-tag-hint">生图时两项直接拼进最终提示词，缺任一项会被拦下；也可以不做识别、直接手填</span>
          </div>
        </div>
      </div>
      ${wardrobeControls}
      <div class="portrait-gen-field">
        <div class="portrait-gen-label">生图内容（可编辑，点"重新生图"将直接使用此处内容调用生图 AI）</div>
        <textarea class="portrait-gen-textarea portrait-gen-prompt-display" id="portraitPromptDisplay" rows="4" placeholder='开始生成后会在此显示 AI 生成的标签或自然语言内容；可编辑后点"重新生图"快速重试'>${escHtml(initialPrompt)}</textarea>
      </div>
      <div class="portrait-gen-field">
        <div class="portrait-gen-preview">
          <div style="font-weight:600;margin-bottom:2px;color:var(--text,#444)">将用作生成依据：</div>
          ${isProtagonist ? buildProtagonistGenBasisHtml(cfg.portraitContextCount) : `· 恋爱对象表：姓名/年龄（生日推算）/外貌特征/一句话介绍<br>
          · 在场角色表：上装/下装/...，以及上方勾选的当前状态/情绪<br>
          · 最近 ${cfg.portraitContextCount} 段 AI 回复（上下文）`}
        </div>
      </div>
      <div class="portrait-gen-field portrait-gen-meta">
        <span>尺寸</span>
        <div class="portrait-preset-row" id="portraitSizeRow" style="flex:1;flex-wrap:wrap">
          ${matchedOrientation ? '' : `<button class="portrait-preset-btn${initialOrientation === null ? ' active' : ''}" data-size="default">默认 ${escapeHtml(defaultSizeLabel)}</button>`}
          <button class="portrait-preset-btn${initialOrientation === 'portrait' ? ' active' : ''}" data-size="portrait">${sizeBtnLabel('portrait')}</button>
          <button class="portrait-preset-btn${initialOrientation === 'landscape' ? ' active' : ''}" data-size="landscape">${sizeBtnLabel('landscape')}</button>
          <button class="portrait-preset-btn${initialOrientation === 'square' ? ' active' : ''}" data-size="square">${sizeBtnLabel('square')}</button>
        </div>
        <span style="margin-left:auto;align-self:center">约 ~10-20s</span>
      </div>
      <div class="portrait-gen-btns">
        <button class="portrait-gen-btn-primary" id="portraitGenStart">开始生成</button>
        <button class="portrait-gen-btn-regen" id="portraitRegenImg"${initialPrompt ? '' : ' disabled'}>重新生图</button>
        <button class="portrait-gen-btn-save-pref" id="portraitGenSavePref">保存为偏好</button>
        <button class="portrait-gen-btn-cancel" id="portraitGenCancel">取消</button>
      </div>
  </div>`;
  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  // 保留 negativePrompt（不显示在 UI，仅供"重新生图"使用）
  let lastNegative = initialNegative;
  const genRoot = overlay.firstElementChild;
  // 本弹窗是否仍是 overlay 当前内容：X 掉后生成在后台继续跑，期间 overlay 可能已被
  // 别的弹窗复用（同 id 控件会撞名）。异步回填/恢复只许动自己的弹窗，否则会把
  // 后台那次的提示词写进当前别的弹窗的「生图内容」框——一点重新生图就用别人的
  // 提示词出图并存进本角色图库（D/E 出 B 提示词的根因）。
  const isMine = (): boolean => !!genRoot && genRoot.isConnected && overlay.firstElementChild === genRoot;
  const $o = $(overlay);
  const syncWardrobeControls = () => {
    if (!wardrobeState) return;
    const enabled = $o.find('#portraitClothingReplace').prop('checked') === true;
    const source = String($o.find('input[name="portraitWardrobeSource"]:checked').val() || 'outfit');
    $o.find('#portraitWardrobeControls').prop('hidden', !enabled);
    $o.find('#portraitWardrobeOutfitPane').prop('hidden', source !== 'outfit');
    $o.find('#portraitWardrobeCustomPane').prop('hidden', source !== 'custom');
    const mode = String($o.find('input[name="portraitWardrobeMode"]:checked').val() || 'partial');
    if (!enabled || mode !== 'full') {
      $o.find('#portraitWardrobeWarning').text('');
      return;
    }
    const draft = {
      enabled: true,
      source: source === 'custom' ? 'custom' as const : 'outfit' as const,
      outfitId: String($o.find('#portraitWardrobeOutfit').val() || ''),
      itemIds: $o.find('[data-portrait-wardrobe-item]:checked').map(function () {
        return String($(this).data('portrait-wardrobe-item') || '');
      }).get() as string[],
      mode: 'full' as const,
    };
    const resolved = resolvePortraitWardrobeSelection(wardrobeState, draft);
    $o.find('#portraitWardrobeWarning').text(
      resolved.ok && resolved.value ? getFullReplacementWarning(resolved.value.items as any) : '',
    );
  };
  const resolveClothingOverride = async (): Promise<PortraitClothingOverride | null | undefined> => {
    if (!wardrobeState || $o.find('#portraitClothingReplace').prop('checked') !== true) return undefined;
    const source = String($o.find('input[name="portraitWardrobeSource"]:checked').val() || 'outfit');
    const mode = String($o.find('input[name="portraitWardrobeMode"]:checked').val() || 'partial') === 'full'
      ? 'full' as const
      : 'partial' as const;
    const resolved = resolvePortraitWardrobeSelection(wardrobeState, {
      enabled: true,
      source: source === 'custom' ? 'custom' : 'outfit',
      outfitId: String($o.find('#portraitWardrobeOutfit').val() || ''),
      itemIds: $o.find('[data-portrait-wardrobe-item]:checked').map(function () {
        return String($(this).data('portrait-wardrobe-item') || '');
      }).get() as string[],
      mode,
    });
    if (!resolved.ok || !resolved.value) {
      getToastr()?.warning(resolved.ok ? '请选择服饰' : resolved.error, '替换服装');
      return null;
    }
    const warning = mode === 'full' ? getFullReplacementWarning(resolved.value.items as any) : '';
    if (warning && !await showConfirmDialog({ message: warning })) return null;
    return resolved.value;
  };
  const syncPortraitContextOptions = () => {
    const statusForcedOff = theme === 'cinematic';
    const emotionForcedOn = theme === 'emotion';
    const effectiveIncludeStatus = statusForcedOff ? false : includeStatusPreference;
    const effectiveIncludeEmotion = emotionForcedOn ? true : includeEmotionPreference;
    $o.find('#portraitIncludeStatus').prop('checked', effectiveIncludeStatus).prop('disabled', statusForcedOff);
    $o.find('#portraitIncludeEmotion').prop('checked', effectiveIncludeEmotion).prop('disabled', emotionForcedOn || isProtagonist);
    const hints: string[] = [];
    if (statusForcedOff) hints.push('精彩瞬间不注入当前状态');
    if (emotionForcedOn) hints.push('情绪特写强制注入情绪');
    if (isProtagonist && emotionForcedOn) hints.push('情绪特写将从近况与剧情推断情绪基调');
    $o.find('#portraitContextRuleHint').text(hints.join('；'));
  };
  $o.find('#portraitPresetRow').on('click', '.portrait-preset-btn', function () {
    $o.find('#portraitPresetRow .portrait-preset-btn').removeClass('active');
    $(this).addClass('active');
    preset = $(this).data('preset') as PortraitPreset;
  });
  $o.find('#portraitThemeRow').on('click', '.portrait-preset-btn', function () {
    $o.find('#portraitThemeRow .portrait-preset-btn').removeClass('active');
    $(this).addClass('active');
    theme = $(this).data('theme') as PortraitTheme;
    syncPortraitContextOptions();
  });
  $o.find('#portraitSizeRow').on('click', '.portrait-preset-btn', function () {
    $o.find('#portraitSizeRow .portrait-preset-btn').removeClass('active');
    $(this).addClass('active');
    const v = $(this).data('size') as PortraitSizeOrientation | 'default';
    // 「默认」= 不覆盖（用设置里的任务尺寸）；快速选项只是本次弹窗内的临时覆盖，不落盘
    sizeOrientation = v === 'default' ? null : v;
  });
  $o.find('#portraitIncludeStatus').on('change', function () {
    if (theme !== 'cinematic') includeStatusPreference = $(this).prop('checked') === true;
  });
  $o.find('#portraitIncludeEmotion').on('change', function () {
    if (!isProtagonist && theme !== 'emotion') includeEmotionPreference = $(this).prop('checked') === true;
  });
  $o.find('#portraitIncludeProtagonist').on('change', function () {
    if (!isProtagonist) includeProtagonist = $(this).prop('checked') === true;
  });
  // 同人身份 tag 栏显隐：按「同人角色」勾选态即时同步——落盘是异步的，等它回来再切换会让两栏
  // 出现/消失出现明显延迟（用户可见的顿挫），故一切显隐同步都放在 await 之前，失败再回滚。
  const syncFanTagsPane = (): void => {
    $o.find('#portraitFanTagsPane').prop('hidden', $o.find('#portraitFanworkToggle').prop('checked') !== true);
  };
  $o.find('#portraitCharTagsToggle').on('change', async function () {
    const on = $(this).prop('checked') === true;
    const hadFanwork = $o.find('#portraitFanworkToggle').prop('checked') === true;
    // 互斥联动即时反馈（先反馈后落盘）：开启 tag 替代即取消同人勾选并收起身份栏，存储层同时清同人标记
    if (on) $o.find('#portraitFanworkToggle').prop('checked', false);
    syncFanTagsPane();
    const saved = await setUseCharTags(npc, on);
    if (!saved) {
      getToastr()?.error('保存失败（存储未就绪）', '人物tag');
      $(this).prop('checked', !on);
      // 回滚显隐与勾选态（本次改动被存储拒绝）
      if (on && hadFanwork) {
        $o.find('#portraitFanworkToggle').prop('checked', true);
        syncFanTagsPane();
      }
      return;
    }
  });
  // 同人身份 tag（固化）：两栏任一改动即落盘；两项都清空=删除记录，只填一项也保留（生图时会被拦下）
  const saveFanTagsFromInputs = async (): Promise<void> => {
    const character = String($o.find('#portraitFanTagCharacter').val() || '').trim();
    const copyright = String($o.find('#portraitFanTagCopyright').val() || '').trim();
    const saved = await savePortraitFanTags(npc, (!character && !copyright) ? null : { character, copyright });
    if (!saved) getToastr()?.error('保存失败（存储未就绪）', '同人角色');
  };
  $o.find('#portraitFanworkToggle').on('change', async function () {
    const on = $(this).prop('checked') === true;
    // 显隐即时 + 互斥联动即时（先反馈后落盘）；失败时一并回滚
    if (on) $o.find('#portraitCharTagsToggle').prop('checked', false);
    syncFanTagsPane();
    const saved = await setPortraitFanwork(npc, on);
    if (!saved) {
      getToastr()?.error(isProtagonist ? '主角为自创角色，无同人原型' : '保存失败（存储未就绪）', '同人角色');
      $(this).prop('checked', !on);
      syncFanTagsPane();
      return;
    }
  });
  $o.find('#portraitFanTagCharacter,#portraitFanTagCopyright').on('change', saveFanTagsFromInputs);
  $o.find('#portraitFanTagGenBtn').on('click', async function () {
    const btn = this;
    $(btn).prop('disabled', true).text('识别中…');
    const res = await generateFanTags(npc);
    $(btn).prop('disabled', false).text('AI识别身份');
    if (res.switched) return; // 聊天已切换：结果未落盘，静默跳过
    if (!res.ok || !res.tags) {
      getToastr()?.error(res.error || 'AI 识别失败', '同人角色');
      return;
    }
    // generateFanTags 已落盘；两栏回填后仍可继续编辑（再次 change 时覆盖保存）
    $o.find('#portraitFanTagCharacter').val(res.tags.character);
    $o.find('#portraitFanTagCopyright').val(res.tags.copyright);
    getToastr()?.success('已识别并固化同人身份tag，可直接修改', '同人角色');
  });
  $o.find('#portraitCharTagsEditBtn').on('click', async function () {
    const btn = this;
    let tags: { appearance: string; body: string } | null = getPortraitCharTags(npc);
    if (!tags) {
      $(btn).prop('disabled', true).text('生成中…');
      const res = await generateCharTags(npc);
      $(btn).prop('disabled', false);
      if (res.switched) { $(btn).text('生成tag'); return; } // 聊天已切换：结果未落盘，静默跳过
      if (!res.ok || !res.tags) {
        $(btn).text('生成tag');
        getToastr()?.error(res.error || '生成失败', '人物tag');
        return;
      }
      tags = res.tags;
    }
    // 编辑窗复用同一 overlay；关闭后重开生成弹窗（同图库→生成的链式模式）
    openCharTagsEditor(npc, style, () => { showPortraitGenDialog(npc, style, onGenerated, onClosed); });
  });
  $o.find('#portraitClothingReplace,input[name="portraitWardrobeSource"],input[name="portraitWardrobeMode"],#portraitWardrobeOutfit,[data-portrait-wardrobe-item]')
    .on('change', syncWardrobeControls);
  syncPortraitContextOptions();
  syncWardrobeControls();
  let closedByUser = false;
  const close = (): void => {
    closedByUser = true;
    if (onClosed) onClosed();
    else closePanelOverlay(overlay);
  };
  const finish = (): void => {
    // 生成期间用户可能已关窗或切到同 overlay 的其他弹窗（图库/tag 编辑等）：
    // 仅当本生成弹窗仍是当前内容且未被手动关闭时才收层，避免越权关掉别的弹窗
    if (!closedByUser && isMine()) {
      closePanelOverlay(overlay);
      if (onClosed) onClosed();
    }
    if (onGenerated) onGenerated();
  };
  $o.find('#portraitGenClose,#portraitGenCancel').on('click', close);

  const setBusy = (busy: boolean, startText = '开始生成', regenText = '重新生图') => {
    // 后台流程的失败恢复不得触碰当前挂载的其他弹窗（同步点击时本弹窗恒在挂载，不受影响）
    if (!isMine()) return;
    // F22：忙碌文案统一走自旋指示（setButtonBusy 保存/恢复原内容；restoreText 指定非忙碌文案）
    setButtonBusy($o.find('#portraitGenStart')[0] as HTMLElement | null, busy, '生成中…', startText);
    const regenBtn = $o.find('#portraitRegenImg')[0] as HTMLElement | null;
    setButtonBusy(regenBtn, busy, '生成中…', regenText);
    if (regenBtn && 'disabled' in regenBtn) regenBtn.disabled = busy || !$o.find('#portraitPromptDisplay').val();
    $o.find('#portraitGenSavePref').prop('disabled', busy);
  };

  // 开始生成：完整流程（文本 AI → 生图 → 落盘）
  $o.find('#portraitGenStart').on('click', async function () {
    const extra = ($o.find('#portraitExtraPrompt').val() as string) || '';
    const effectiveIncludeStatus = theme === 'cinematic' ? false : includeStatusPreference;
    const effectiveIncludeEmotion = theme === 'emotion' ? true : includeEmotionPreference;
    const clothingOverride = await resolveClothingOverride();
    if (clothingOverride === null) return;
    setBusy(true);
    const r = await generatePortrait(npc, {
      preset, theme, extraPrompt: extra,
      includeStatus: effectiveIncludeStatus,
      includeEmotion: effectiveIncludeEmotion,
      // 同人标记按角色实时读（人物tag区开关即时落盘），不再来自全局偏好
      includeFanwork: isProtagonist ? false : isPortraitFanwork(npc),
      includeProtagonist,
      clothingOverride,
      sizeOrientation: sizeOrientation || undefined,
      onPromptReady: (promptText, negativePrompt) => {
        // 文本 AI 完成、生图开始前：回填到显示框（仅当本弹窗仍在挂载；
        // X 掉后后台完成的生成不得把提示词写进当前别的弹窗）
        if (!isMine()) return;
        $o.find('#portraitPromptDisplay').val(promptText);
        lastNegative = negativePrompt;
        $o.find('#portraitRegenImg').prop('disabled', false);
      },
    });
    if (r.ok) {
      const toastr = getToastr();
      if (toastr) toastr.success('立绘已生成并保存', '立绘');
      finish();
    } else {
      setBusy(false);
      lastAttemptFailed = true;
      const toastr = getToastr();
      if (toastr) toastr.error(r.error || '生成失败', '立绘');
    }
  });

  // 重新生图：跳过文本 AI，直接使用显示框内的（可编辑）prompt 调用生图
  $o.find('#portraitRegenImg').on('click', async function () {
    const editedPrompt = (($o.find('#portraitPromptDisplay').val() as string) || '').trim();
    if (!editedPrompt) {
      flashInlineHint($o.find('#portraitRegenImg')[0] as HTMLElement, '生图内容为空，请先点"开始生成"或在此输入内容');
      return;
    }
    const effectiveIncludeStatus = theme === 'cinematic' ? false : includeStatusPreference;
    const effectiveIncludeEmotion = theme === 'emotion' ? true : includeEmotionPreference;
    setBusy(true);
    const r = await generatePortrait(npc, {
      preset, theme, extraPrompt: '',
      includeStatus: effectiveIncludeStatus,
      includeEmotion: effectiveIncludeEmotion,
      includeFanwork: isProtagonist ? false : isPortraitFanwork(npc),
      includeProtagonist,
      sizeOrientation: sizeOrientation || undefined,
      prebuiltPrompt: { promptText: editedPrompt, negativePrompt: lastNegative },
      afterFailure: lastAttemptFailed,
    });
    if (r.ok) {
      lastAttemptFailed = false;
      const toastr = getToastr();
      if (toastr) toastr.success('立绘已重新生成并保存', '立绘');
      finish();
    } else {
      setBusy(false);
      const toastr = getToastr();
      if (toastr) toastr.error(r.error || '重新生图失败', '立绘');
    }
  });

  // 保存为偏好：把当前弹窗选项持久化（不生图、不关弹窗）；「默认」态按设置尺寸反推方向落盘（自动生图延续设置的形状），无法判定回退 square
  $o.find('#portraitGenSavePref').on('click', function () {
    const effectiveIncludeStatus = theme === 'cinematic' ? false : includeStatusPreference;
    const effectiveIncludeEmotion = theme === 'emotion' ? true : includeEmotionPreference;
    const orientation: PortraitSizeOrientation = sizeOrientation
      || inferSizeOrientation({ apiFormat: ig.apiFormat, width: taskPortrait.width, height: taskPortrait.height, aspectRatio: taskPortrait.aspectRatio })
      || 'square';
    setConfig('portraitGenPreference', {
      preset, theme,
      includeStatus: effectiveIncludeStatus,
      includeEmotion: isProtagonist ? false : effectiveIncludeEmotion,
      // 同人标记已改为按角色存立绘索引（人物tag区开关即时落盘），全局字段恒 false 仅保持接口兼容
      includeFanwork: false,
      includeProtagonist: isProtagonist ? false : includeProtagonist,
      extraPrompt: ($o.find('#portraitExtraPrompt').val() as string) || '',
      sizeOrientation: orientation,
    });
    const toastr = getToastr();
    if (toastr) toastr.success('已保存为偏好，下次打开及自动更新将使用这些选项', '立绘');
  });
}

// —— 图库弹窗 ——
export function showPortraitGalleryPopup(
  npc: string,
  style: StyleType,
  mode: 'pick' | 'browse',
  onPicked?: () => void,
  onClosed?: () => void,
): void {
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return;
  const overlay = getOverlay(); if (!overlay) return;
  const idx: PortraitIndex | null = getPortraitIndex(npc);
  const portraits = idx?.portraits || [];
  try { (window as any).__ubEmitAchievement?.('portrait_gallery_viewed', { charName: npc, count: portraits.length, mode }); } catch (_e) { /* ignore */ }
  const poolSet = new Set(idx?.randomPool || []);
  const validPoolCount = portraits.filter((p) => poolSet.has(p.path)).length;
  const pickHint = mode === 'pick' ? '<div style="font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,#888);margin-bottom:8px">点勾选设为当前；点骰子图标选入随机池（≥2 张后每次刷新随机展示）</div>' : '';
  // 随机模式横幅：有效池 ≥2 张时显示（节点始终在 DOM 中，便于就地更新计数）
  const randomBanner = validPoolCount >= 2
    ? `<div class="portrait-gallery-random-banner active" id="pgRandomBanner">${ubIcon('dice')} 随机立绘已开启：每次刷新从 ${validPoolCount} 张中随机展示</div>`
    : '<div class="portrait-gallery-random-banner" id="pgRandomBanner"></div>';
  // 筛选状态（临时 UI 态，关闭即复位）
  const filterState: PortraitGalleryFilter = { emotion: '全部', nsfw: '全部' };
  const filterToolbar = buildPortraitGalleryFilterToolbar(filterState);
  // 批量模式（临时 UI 态）：'' 关闭；'delete'/'export' 进入。选中集存 path。
  // 进入方式为头部按钮（图库为图片网格，长按进模式与移动端图片交互冲突，且删除/导出需区分模式）。
  let batchMode: '' | 'delete' | 'export' = '';
  const batchSelected = new Set<string>();
  const isFilteredVisible = (p: PortraitEntry): boolean =>
    portraitMatchesEmotionFilter(p.emotion, filterState.emotion)
    && portraitMatchesNsfwFilter(p.nsfw, filterState.nsfw);
  // 单张图渲染为 HTML（初始渲染与 renderGrid 复用；batchSelected 标记批量选中态）
  const renderGalleryItem = (p: PortraitEntry, isCur: boolean, inPool: boolean, batchSel: boolean): string => {
    const date = new Date(p.createdAt);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const emotionIcon = p.emotion ? (emotionConfigAncient[p.emotion] || emotionConfigModern[p.emotion]) : null;
    const emotionHtml = p.emotion
      ? `<span class="pg-tag pg-tag-emotion" style="color:${emotionIcon?.color || 'inherit'}">${emotionIcon ? '<span class="mood-icon">' + ubIcon(emotionIcon.icon) + '</span> ' : ''}${escAttr(p.emotion)}</span>`
      : '<span class="pg-tag pg-tag-muted">未标注</span>';
    const nsfwHtml = p.nsfw === undefined
      ? ''
      : p.nsfw
        ? '<span class="pg-tag pg-tag-nsfw">瑟瑟</span>'
        : '<span class="pg-tag pg-tag-daily">日常</span>';
    return `<div class="portrait-gallery-item${isCur ? ' current' : ''}${inPool ? ' in-random-pool' : ''}${batchSel ? ' batch-selected' : ''}" data-path="${escAttr(p.path)}" title="${(p.promptText || '').replace(/"/g, '&quot;')}">
      <img src="${escAttr(p.path)}" alt="${escAttr(npc)}" loading="lazy" decoding="async" onerror="this.parentNode.style.opacity=.3">
      <span class="pg-check">${batchSel ? '✓' : ''}</span>
      <div class="pg-actions">
        <span data-act="pick" title="设为当前">${ubIcon('check')}</span>
        <span data-act="random" title="${inPool ? '移出随机池' : '加入随机池'}">${ubIcon('dice')}</span>
        <span data-act="edit" title="编辑标签">${ubIcon('pencil')}</span>
        <span data-act="del" title="删除">×</span>
      </div>
      <div class="pg-meta">${emotionHtml}${nsfwHtml}<span class="pg-date">${dateStr}</span></div>
    </div>`;
  };
  const filteredPortraits = portraits.filter(isFilteredVisible);
  // 空筛选结果提示
  const emptyFilter = filteredPortraits.length === 0 ? '<div class="portrait-gallery-empty">没有符合筛选条件的立绘</div>' : '';
  const items = portraits.length === 0
    ? '<div class="portrait-gallery-empty">还没有立绘，点右上「生成新立绘」开始</div>'
    : filteredPortraits.length === 0
      ? emptyFilter
      : filteredPortraits.map((p) => renderGalleryItem(p, idx?.current === p.path, poolSet.has(p.path), false)).join('');
  const html = `
  <div class="${buildPortraitDialogClass(style, 'gallery')}">
    <div class="portrait-popup-header">
      <span class="portrait-popup-title">${escapeHtml(portraitLabel(npc))} 的立绘 (${portraits.length} 张)</span>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="portrait-gallery-import-btn" id="pgBatchDelete"${portraits.length ? '' : ' disabled'}>批量删除</button>
        <button class="portrait-gallery-import-btn" id="pgBatchExport"${portraits.length ? '' : ' disabled'}>批量导出</button>
        <button class="portrait-gallery-gen-btn" id="pgGen">生成新立绘</button>
        <button class="portrait-gallery-import-btn" id="pgImport">导入本地图片</button>
        <input type="file" id="pgFileInput" accept="image/*" style="display:none">
        <span class="portrait-popup-close" id="pgClose">${ubIcon('close')}</span>
      </div>
    </div>
    ${pickHint}
    ${randomBanner}
    ${filterToolbar}
    <div class="portrait-gallery-grid" id="pgGrid">${items}</div>
    <div class="portrait-gallery-batch-toolbar" id="pgBatchToolbar" hidden>
      <span class="pg-batch-count" id="pgBatchCount">已选 0 张</span>
      <button type="button" class="pg-batch-btn" id="pgBatchAll">全选可见</button>
      <button type="button" class="pg-batch-btn" id="pgBatchClear">清空</button>
      <span class="pg-batch-spacer"></span>
      <button type="button" class="pg-batch-btn danger" id="pgBatchConfirm" disabled>执行</button>
      <button type="button" class="pg-batch-btn" id="pgBatchCancel">取消</button>
    </div>
  </div>`;
  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const $o = $(overlay);
  const close = (): void => {
    if (onClosed) onClosed();
    else closePanelOverlay(overlay);
  };
  $o.find('#pgClose').on('click', close);
  $o.find('#pgGen').on('click', () => { closePanelOverlay(overlay); showPortraitGenDialog(npc, style, onPicked, onClosed); });
  // 导入本地图片：触发隐藏 file input
  $o.find('#pgImport').on('click', function () { $o.find('#pgFileInput').trigger('click'); });
  $o.find('#pgFileInput').on('change', async function () {
    const file = (this as HTMLInputElement).files?.[0];
    if (!file) return;
    // 重置 value 允许重复选同一文件
    (this as HTMLInputElement).value = '';
    const $btn = $o.find('#pgImport').prop('disabled', true).text('导入中…');
    const r = await importLocalPortrait(npc, file);
    $btn.prop('disabled', false).text('导入本地图片');
    if (r.ok) {
      const toastr = getToastr();
      if (toastr) toastr.success('图片已导入立绘库', '立绘');
      if (onPicked) onPicked();
      // 刷新图库（重新打开以展示新图）
      showPortraitGalleryPopup(npc, style, mode, onPicked, onClosed);
    } else {
      const toastr = getToastr();
      if (toastr) toastr.error(r.error || '导入失败', '立绘');
    }
  });
  // 就地重渲染网格（保留滚动位置；初始渲染与 del/筛选/批量共用渲染逻辑）
  const renderGrid = (): void => {
    const scrollTop = $o.find('.portrait-gallery-grid').scrollTop();
    const filtered = portraits.filter(isFilteredVisible);
    const items = filtered.map(p => renderGalleryItem(p, idx?.current === p.path, poolSet.has(p.path), batchSelected.has(p.path))).join('');
    const $grid = $o.find('#pgGrid');
    $grid.html(filtered.length === 0
      ? '<div class="portrait-gallery-empty">没有符合筛选条件的立绘</div>'
      : items);
    $grid.scrollTop(scrollTop || 0);
  };
  // 批量模式 UI 同步：工具栏显隐/计数/执行按钮文字与可用性/头部按钮 active 态/网格选择态
  const updateBatchUI = (): void => {
    const active = batchMode !== '';
    const count = batchSelected.size;
    $o.find('#pgBatchToolbar').prop('hidden', !active);
    $o.find('#pgBatchCount').text(`已选 ${count} 张`);
    $o.find('#pgBatchConfirm')
      .text(batchMode === 'delete' ? '删除所选' : '导出所选')
      .prop('disabled', count === 0);
    $o.find('#pgBatchDelete').toggleClass('active', batchMode === 'delete');
    $o.find('#pgBatchExport').toggleClass('active', batchMode === 'export');
    $o.find('#pgGrid').toggleClass('batch-select', active);
  };
  // 切模式/清空选中（同模式再点=退出）
  const setBatchMode = (mode: 'delete' | 'export'): void => {
    batchMode = batchMode === mode ? '' : mode;
    batchSelected.clear();
    renderGrid();
    updateBatchUI();
  };
  // 删除类变更后的就地刷新：重读索引 → 标题计数/随机横幅/网格 → 同步主界面立绘框
  const refreshGalleryAfterMutate = (removedPath?: string): void => {
    const freshIdx = getPortraitIndex(npc);
    const freshPortraits = freshIdx?.portraits || [];
    const freshPoolSet = new Set(freshIdx?.randomPool || []);
    const freshValidPoolCount = freshPortraits.filter((p) => freshPoolSet.has(p.path)).length;
    $o.find('.portrait-popup-title').text(`${portraitLabel(npc)} 的立绘 (${freshPortraits.length} 张)`);
    const $banner = $o.find('#pgRandomBanner');
    if (freshValidPoolCount >= 2) {
      $banner.html(ubIcon('dice') + ' 随机立绘已开启：每次刷新从 ' + freshValidPoolCount + ' 张中随机展示').addClass('active');
    } else {
      $banner.text('').removeClass('active');
    }
    // F24：单张删除走原位移除（不整格 innerHTML——避免全部 <img> 重挂载闪烁）；其余变更整格重渲。
    const gridEl = $o.find('#pgGrid')[0] as HTMLElement | null;
    const removedCard = removedPath && gridEl
      ? (Array.from(gridEl.querySelectorAll('.portrait-gallery-item')) as HTMLElement[]).find(el => el.dataset.path === removedPath)
      : null;
    if (removedCard && !freshPortraits.some(p => p.path === removedPath)) {
      // 条目确已从索引消失 → 原位动画移除；删除失败（仍在索引）时走整格重渲恢复真实状态
      removedCard.classList.add('is-removed');
      window.setTimeout(() => removedCard.remove(), 260);
    } else if (freshPortraits.length === 0) {
      $o.find('#pgGrid').html('<div class="portrait-gallery-empty">还没有立绘，点右上「生成新立绘」开始</div>');
    } else {
      const filteredFresh = freshPortraits.filter(isFilteredVisible);
      $o.find('#pgGrid').html(filteredFresh.length === 0
        ? '<div class="portrait-gallery-empty">没有符合筛选条件的立绘</div>'
        : filteredFresh.map((p) => renderGalleryItem(p, freshIdx?.current === p.path, freshPoolSet.has(p.path), batchSelected.has(p.path))).join(''));
    }
    $o.find('#pgBatchDelete,#pgBatchExport').prop('disabled', freshPortraits.length === 0);
    updateBatchUI();
    if (onPicked) onPicked();
  };
  // 情绪筛选：原生 select 走 change（面板内 select 禁 overlay.onclick 的既有坑）
  $o.find('#pgFilterEmotion').on('change', function () {
    filterState.emotion = (this as HTMLSelectElement).value;
    // 筛选变化清空选中：防"选中了当前不可见项"的误删（全选仅可见项的前提下仍可能残留旧筛选选中）
    batchSelected.clear();
    renderGrid(); // 见下方就地重渲染
    updateBatchUI();
  });
  // 场景筛选：原生 select 走 change，与情绪筛选统一
  $o.find('#pgFilterNsfw').on('change', function () {
    filterState.nsfw = (this as HTMLSelectElement).value;
    batchSelected.clear();
    renderGrid();
    updateBatchUI();
  });
  // —— 批量模式：头部按钮进出模式 ——
  $o.find('#pgBatchDelete').on('click', () => setBatchMode('delete'));
  $o.find('#pgBatchExport').on('click', () => setBatchMode('export'));
  $o.find('#pgBatchAll').on('click', () => {
    // 全选可见项（修复参考实现"全选=含筛选隐藏项"的误删风险）：仅当前筛选命中的条目
    batchSelected.clear();
    for (const p of portraits) if (isFilteredVisible(p)) batchSelected.add(p.path);
    renderGrid();
    updateBatchUI();
  });
  $o.find('#pgBatchClear').on('click', () => { batchSelected.clear(); renderGrid(); updateBatchUI(); });
  $o.find('#pgBatchCancel').on('click', () => { batchMode = ''; batchSelected.clear(); renderGrid(); updateBatchUI(); });
  $o.find('#pgBatchConfirm').on('click', async function () {
    if (batchSelected.size === 0) return;
    const $btn = $(this);
    const toastr = getToastr();
    if (batchMode === 'delete') {
      // 批量删除：danger 确认 → 逐张删除（先删索引后删文件，失败项计数）→ 就地刷新
      const confirmed = await showConfirmDialog({
        message: `删除选中的 ${batchSelected.size} 张立绘？将同时删除本地图片文件，不可恢复。`,
        okText: '删除',
        danger: true,
      });
      if (!confirmed) return;
      const paths = Array.from(batchSelected);
      $btn.prop('disabled', true).text('删除中…');
      $o.find('#pgBatchDelete,#pgBatchExport,#pgBatchAll,#pgBatchClear,#pgBatchCancel').prop('disabled', true);
      let failed = 0;
      for (const path of paths) {
        const ok = await deletePortrait(npc, path);
        if (!ok) { const t = getToastr(); t?.warning?.('存储未就绪，未保存', '立绘'); failed++; }
      }
      if (failed) toastr?.warning?.(`${failed} 张删除失败，请重试`, '立绘');
      else toastr?.success?.('已删除所选立绘', '立绘');
      batchMode = '';
      batchSelected.clear();
      refreshGalleryAfterMutate();
    } else {
      // 批量导出：1 张直下原图；多张打包 zip（失败项跳过，末尾汇总）
      try {
        $btn.prop('disabled', true).text('导出中…');
        $o.find('#pgBatchDelete,#pgBatchExport,#pgBatchAll,#pgBatchClear,#pgBatchCancel').prop('disabled', true);
        const items = portraits
          .filter((p) => batchSelected.has(p.path))
          .map((p) => ({ path: p.path, filename: p.filename }));
        const result = await exportPortraitBatch(items, npc);
        if (result.singleBlob && result.singleName) {
          triggerBlobDownload(result.singleBlob, result.singleName);
          toastr?.success?.('图片已下载', '立绘');
        } else if (result.zipBlob && result.zipName) {
          triggerBlobDownload(result.zipBlob, result.zipName);
          toastr?.success?.('压缩包已下载', '立绘');
        }
        if (result.failed > 0) {
          toastr?.warning?.(`${result.failed} 张图片读取失败，已跳过`, '立绘');
        } else if (result.exported === 0) {
          toastr?.error?.('没有可导出的立绘', '立绘');
        }
      } catch (e: any) {
        toastr?.error?.(e?.message || '导出失败', '立绘');
      } finally {
        $o.find('#pgBatchDelete,#pgBatchExport,#pgBatchAll,#pgBatchClear,#pgBatchCancel').prop('disabled', false);
        batchMode = '';
        batchSelected.clear();
        renderGrid();
        updateBatchUI();
      }
    }
  });
  $o.find('#pgGrid').on('click', '.portrait-gallery-item', async function (e) {
    const $item = $(this);
    const path = $item.data('path') as string;
    // 按钮内含 SVG 图标，点击落到 svg/path 子元素上时 e.target 无 data-act；
    // 用 closest 向上找带 data-act 的按钮 span，否则会误落到 else 分支打开放大弹窗
    const act = $(e.target).closest('[data-act]').data('act');
    // 批量模式：条目点击=切换选中（拦截全部单张动作，防模式混乱/误操作）
    if (batchMode !== '') {
      e.stopPropagation();
      if (batchSelected.has(path)) batchSelected.delete(path);
      else batchSelected.add(path);
      $item.toggleClass('batch-selected', batchSelected.has(path));
      updateBatchUI();
      return;
    }
    if (act === 'pick') {
      e.stopPropagation();
      const ok = await setCurrentPortrait(npc, path);
      if (!ok) { const t = getToastr(); t?.warning?.('存储未就绪，未保存', '立绘'); }
      if (onPicked) onPicked();
      // pick 选完关；browse 也关，重渲染由调用方触发
      close();
    } else if (act === 'edit') {
      e.stopPropagation();
      // 编辑标签：重开编辑弹窗（覆盖旧网格 DOM），return 避免继续执行后续分支
      const reopenGallery = () => showPortraitGalleryPopup(npc, style, mode, onPicked, onClosed);
      showPortraitEditPopup(npc, path, style, reopenGallery, reopenGallery);
      return;
    } else if (act === 'random') {
      e.stopPropagation();
      const ok = await togglePortraitInRandomPool(npc, path);
      if (!ok) { const t = getToastr(); t?.warning?.('存储未就绪，未保存', '立绘'); }
      // 就地更新：切该项池标记 + 按钮提示 + 重算横幅（不关弹窗，便于连续勾选；保留滚动位置）
      const freshIdx = getPortraitIndex(npc);
      const freshPool = new Set(freshIdx?.randomPool || []);
      const freshPortraits = freshIdx?.portraits || [];
      const validCount = freshPortraits.filter((p) => freshPool.has(p.path)).length;
      const inPoolNow = freshPool.has(path);
      $item.toggleClass('in-random-pool', inPoolNow);
      $item.find('.pg-actions [data-act="random"]').attr('title', inPoolNow ? '移出随机池' : '加入随机池');
      const $banner = $o.find('#pgRandomBanner');
      if (validCount >= 2) {
        $banner.html(ubIcon('dice') + ' 随机立绘已开启：每次刷新从 ' + validCount + ' 张中随机展示').addClass('active');
      } else {
        $banner.text('').removeClass('active');
      }
      // 触发状态栏强制重渲染（onPicked = render(true)），立即重摇一张
      if (onPicked) onPicked();
    } else if (act === 'del') {
      e.stopPropagation();
      // 删除将同步删除本地图片文件，不可恢复
      const confirmed = await showConfirmDialog({ message: `删除这张立绘？将同时删除本地图片文件，不可恢复。`, okText: '删除', danger: true });
      if (!confirmed) return;
      const ok = await deletePortrait(npc, path);
      if (!ok) { const t = getToastr(); t?.warning?.('存储未就绪，未保存', '立绘'); }
      // 就地刷新网格（不关闭弹窗，保留滚动位置；标题/横幅/网格/onPicked 统一收口）；
      // F24：单删传 removedPath 走卡片原位移除，避免整格 <img> 重挂载
      refreshGalleryAfterMutate(ok ? path : undefined);
    } else {
      // 点本体=放大；传 onBack 返回图库（保留原 mode/onPicked），翻看顺序=当前筛选可见列表（重读索引，防删图后闭包陈旧）
      showPortraitZoomPopup(path, style, () => showPortraitGalleryPopup(npc, style, mode, onPicked, onClosed), npc,
        (getPortraitIndex(npc)?.portraits || []).filter(isFilteredVisible).map((p) => p.path));
    }
  });
  overlay.onclick = function (e) {
    if (e.target === overlay) { if (guardGhostClick()) return; close(); }
  };
}

// —— 单图编辑弹窗（标签编辑 + 生图档案展示/提示词补记）——

// 生图档案摘要：供应商·模型 / 参数快照（只读；模型与参数不可改）
const GEN_PROVIDER_LABEL: Record<string, string> = {
  novelai: 'NovelAI', openai: 'OpenAI 兼容', comfyui: 'ComfyUI', unknown: '未知',
};
function genModelLine(entry: PortraitEntry): string {
  const g = entry.gen;
  if (!g) return '未记录（旧条目或本地导入）';
  const line = [GEN_PROVIDER_LABEL[g.provider] || g.provider, g.model].filter(Boolean).join(' · ');
  return line || '—';
}
function genParamsLine(entry: PortraitEntry): string {
  const g = entry.gen;
  if (!g) return '未记录';
  const p = g.params || {};
  const bits: string[] = [];
  if (p.width && p.height) bits.push(`${p.width}×${p.height}`);
  if (p.aspectRatio) bits.push(`比例 ${p.aspectRatio}`);
  if (typeof p.seed === 'number' && Number.isFinite(p.seed)) bits.push(`seed ${p.seed}`);
  if (p.sampler) bits.push(p.scheduler ? `${p.sampler}/${p.scheduler}` : String(p.sampler));
  if (p.steps) bits.push(`${p.steps}步`);
  if (typeof p.cfg === 'number' && p.cfg) bits.push(`CFG ${p.cfg}`);
  if (typeof p.cfgRescale === 'number' && p.cfg) bits.push(`rescale ${p.cfgRescale}`);
  if (g.provider === 'comfyui' && g.workflow) bits.push('最终工作流已存档');
  return bits.join(' · ') || '—';
}

export function showPortraitEditPopup(
  npc: string,
  path: string,
  style: StyleType,
  onSaved?: () => void,
  onClosed?: () => void,
): void {
  const overlay = getOverlay(); if (!overlay) return;
  const idx = getPortraitIndex(npc);
  const entry = idx?.portraits.find((p) => p.path === path);
  if (!entry) return;
  const emotionOptions = ['未标注', ...STANDARD_EMOTIONS].map(e =>
    `<option value="${e}"${(entry.emotion === e) ? ' selected' : ''}>${e}</option>`
  ).join('');
  const nsfwState = entry.nsfw === undefined ? 'untagged' : entry.nsfw ? 'nsfw' : 'daily';
  // 提示词初值：档案内最终形态优先（重发即可还原），旧条目回退会话内 promptText
  const initialPrompt = entry.gen?.prompt || entry.promptText || '';
  const initialNegative = entry.gen?.negative || entry.negativePrompt || '';
  // 重新生图：仅对档案完备的条目开放（旧条目/unknown 不渲染按钮与参数编辑）
  const replayable = isRecordReplayable(entry.gen);
  const html = `
  <div class="panel-popup portrait-popup portrait-edit-wrap${portraitBridgeClass(style, 'bridge-portrait-edit')}">
    <div class="portrait-popup-header">
      <span class="portrait-popup-title">编辑立绘</span>
      <span class="portrait-popup-close" id="peClose">${ubIcon('close')}</span>
    </div>
    <div class="portrait-edit-body">
      <div class="portrait-edit-preview"><img src="${escAttr(path)}" alt="立绘"></div>
      <div class="portrait-edit-fields">
        <div class="portrait-edit-field">
          <div class="portrait-edit-label">情绪</div>
          <select id="peEmotion" class="portrait-edit-select">${emotionOptions}</select>
        </div>
        <div class="portrait-edit-field">
          <div class="portrait-edit-label">是否瑟瑟</div>
          <div class="pg-filter-nsfw" id="peNsfw">
            <button type="button" class="pg-filter-btn${nsfwState === 'untagged' ? ' active' : ''}" data-nsfw="untagged">未标注</button>
            <button type="button" class="pg-filter-btn${nsfwState === 'daily' ? ' active' : ''}" data-nsfw="daily">日常</button>
            <button type="button" class="pg-filter-btn${nsfwState === 'nsfw' ? ' active' : ''}" data-nsfw="nsfw">瑟瑟</button>
          </div>
        </div>
        <div class="portrait-edit-field portrait-edit-readonly">
          <div class="portrait-edit-label">生成时间</div>
          <div class="portrait-edit-value">${new Date(entry.createdAt).toLocaleString()}</div>
        </div>
        <div class="portrait-edit-field portrait-edit-readonly">
          <div class="portrait-edit-label">模型</div>
          <div class="portrait-edit-value">${escapeHtml(genModelLine(entry))}</div>
        </div>
        ${replayable
          ? `<div class="portrait-edit-field"><div class="portrait-edit-label">生图参数（可改，仅重新生图生效）</div>${genParamsEditHtml(entry.gen, 'pe')}</div>`
          : `<div class="portrait-edit-field portrait-edit-readonly"><div class="portrait-edit-label">参数</div><div class="portrait-edit-value">${escapeHtml(genParamsLine(entry))}</div></div>`}
        <div class="portrait-edit-field">
          <div class="portrait-edit-label portrait-edit-label-row">正向提示词（实际发送形态，可改）<button type="button" class="portrait-edit-copy" data-copy="pePrompt">复制</button></div>
          <textarea class="portrait-edit-textarea" id="pePrompt" rows="5" placeholder="空=未记录">${escapeHtml(initialPrompt)}</textarea>
        </div>
        <div class="portrait-edit-field">
          <div class="portrait-edit-label portrait-edit-label-row">负面提示词（可改）<button type="button" class="portrait-edit-copy" data-copy="peNegative">复制</button></div>
          <textarea class="portrait-edit-textarea" id="peNegative" rows="3" placeholder="空=未记录">${escapeHtml(initialNegative)}</textarea>
        </div>
      </div>
    </div>
    <div class="portrait-edit-actions">
      <button type="button" class="portrait-edit-btn cancel" id="peCancel">取消</button>
      ${replayable ? '<button type="button" class="portrait-edit-btn regen" id="peRegen">重新生图</button>' : ''}
      <button type="button" class="portrait-edit-btn save" id="peSave">保存</button>
    </div>
  </div>`;
  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const $o = $(overlay);
  // 重绘是长耗时异步：期间用户可能已关窗打开别的弹窗，成功后的收层与失败后的控件
  // 恢复都只许动自己的弹窗（同 overlay 复用，id 撞名）
  const editRoot = overlay.firstElementChild;
  const isMine = (): boolean => !!editRoot && editRoot.isConnected && overlay.firstElementChild === editRoot;
  const close = (): void => {
    if (onClosed) onClosed();
    else closePanelOverlay(overlay);
  };
  $o.find('#peClose').on('click', close);
  $o.find('#peCancel').on('click', close);
  // 瑟瑟三态分段按钮（委托）
  $o.find('#peNsfw').on('click', 'button', function () {
    $o.find('#peNsfw .pg-filter-btn').removeClass('active');
    $(this).addClass('active');
  });
  // 复制按钮（委托）
  $o.on('click', '.portrait-edit-copy', async function (this: HTMLElement) {
    const targetId = $(this).attr('data-copy') || '';
    const ta = $o.find('#' + targetId).get(0) as HTMLTextAreaElement | undefined;
    if (!ta) return;
    const ok = await copyTextToClipboard(ta.value);
    const t = getToastr();
    if (ok) t?.success?.('已复制到剪贴板', '立绘');
    else t?.warning?.('复制失败，请手动选择文本复制', '立绘');
  });
  // 重新生图（按档案重放）：改过的提示词/参数仅本次生效；成功后原位替换该条目并刷新图库
  $o.find('#peRegen').on('click', async function () {
    const promptVal = String($o.find('#pePrompt').val() || '');
    const negVal = String($o.find('#peNegative').val() || '');
    const patch: ImageGenRegenPatch = {
      ...(promptVal.trim() ? { prompt: promptVal } : {}),
      ...(negVal.trim() ? { negative: negVal } : {}),
      params: readGenParamsPatch('pe'),
    };
    const t = getToastr();
    const $btn = $o.find('#peRegen');
    $btn.prop('disabled', true).text('生成中…');
    $o.find('#peSave').prop('disabled', true);
    const r = await regeneratePortraitFromArchive(npc, path, patch);
    if (!r.ok) {
      t?.error?.(r.error || '重新生图失败', '立绘');
      // 弹窗已换内容时不碰当前别的弹窗的控件
      if (isMine()) {
        $btn.prop('disabled', false).text('重新生图');
        $o.find('#peSave').prop('disabled', false);
      }
      return;
    }
    t?.success?.('已重新生成本张立绘并替换原图', '立绘');
    if (isMine()) closePanelOverlay(overlay);
    if (onSaved) onSaved();
  });
  $o.find('#peSave').on('click', async function () {
    const emotion = $o.find('#peEmotion').val() as string;
    const nsfwSel = $o.find('#peNsfw .pg-filter-btn.active').data('nsfw') as string;
    const promptVal = String($o.find('#pePrompt').val() || '');
    const negVal = String($o.find('#peNegative').val() || '');
    const t = getToastr();
    // 提示词有改动才落盘（无谓改动不触发整文件重写）；无档案旧条目首次编辑自动补建档案
    if (promptVal !== initialPrompt || negVal !== initialNegative) {
      const savedGen = await updatePortraitGenText(npc, path, { prompt: promptVal, negative: negVal });
      if (!savedGen) { t?.warning?.('存储未就绪，提示词未保存', '立绘'); return; }
    }
    const meta: { emotion?: string; nsfw?: boolean } = {};
    if (emotion && emotion !== '未标注') meta.emotion = emotion;
    else meta.emotion = undefined;
    meta.nsfw = nsfwSel === 'nsfw' ? true : nsfwSel === 'daily' ? false : undefined;
    const ok = await updatePortraitMeta(npc, path, meta);
    if (!ok) { t?.warning?.('存储未就绪，未保存', '立绘'); return; }
    if (t) t.success('已保存', '立绘');
    closePanelOverlay(overlay);
    if (onSaved) onSaved();
  });
  overlay.onclick = function (e) {
    if (e.target === overlay) { if (guardGhostClick()) return; close(); }
  };
}

// —— 放大弹窗（相册翻看：三槽滑动轨道，点图/空白/ESC 仍为返回/关闭）——
// onBack 提供（从图库放大）时，点图片/空白/ESC 返回图库（上一窗口）；不提供（从主界面立绘框放大）时关闭回主界面。
// order 可选：翻看顺序（path 列表）。图库入口传当前筛选可见列表（只在筛选结果内翻）；主界面入口不传 → 该角色全部立绘顺序。
export function showPortraitZoomPopup(path: string, style: StyleType, onBack?: () => void, charName?: string, order?: string[]): void {
  const overlay = getOverlay(); if (!overlay) return;
  try { (window as any).__ubEmitAchievement?.('portrait_zoomed', { charName: charName || '', path }); } catch (_e) { /* ignore */ }

  // 翻看序列与起始位：order 优先（图库筛选序）；缺省取角色全量立绘序；path 不在序列内时退化为单张（无翻页）
  const ordered = (order && order.length > 0)
    ? order
    : (charName ? ((getPortraitIndex(charName)?.portraits || []).map((p) => p.path)) : []);
  const paths = ordered.indexOf(path) >= 0 ? ordered.slice() : [path];
  const html = `
  <div class="portrait-lightbox" id="portraitLightbox">
    <div class="plb-track" id="plbTrack">
      <div class="plb-slide"><div class="plb-frame"><img alt="立绘" draggable="false"><span class="plb-nav plb-nav-prev" data-plb-nav="prev" title="前一张">${ubIcon('arrow-left')}</span><span class="plb-nav plb-nav-next" data-plb-nav="next" title="后一张">${ubIcon('arrow-right')}</span></div></div>
      <div class="plb-slide"><div class="plb-frame"><img alt="立绘" draggable="false"><span class="plb-nav plb-nav-prev" data-plb-nav="prev" title="前一张">${ubIcon('arrow-left')}</span><span class="plb-nav plb-nav-next" data-plb-nav="next" title="后一张">${ubIcon('arrow-right')}</span></div></div>
      <div class="plb-slide"><div class="plb-frame"><img alt="立绘" draggable="false"><span class="plb-nav plb-nav-prev" data-plb-nav="prev" title="前一张">${ubIcon('arrow-left')}</span><span class="plb-nav plb-nav-next" data-plb-nav="next" title="后一张">${ubIcon('arrow-right')}</span></div></div>
    </div>
    <div class="plb-counter" id="plbCounter"></div>
  </div>`;
  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const $o = $(overlay);
  const trackEl = $o.find('#plbTrack')[0] as HTMLElement;
  const counterEl = $o.find('#plbCounter')[0] as HTMLElement;
  // 三槽物理位置恒定 [cur-1, cur, cur+1]；goTo 先填目标槽内容再平移，过渡结束后 settle 全量重填并复位
  const slots = Array.from(trackEl.children) as HTMLElement[];
  let cur = paths.indexOf(path); if (cur < 0) cur = 0;
  let lastTX = 0;              // 内联 transform 的最后目标值（拖拽/base 参照）
  let suppressClick = false;   // 拖拽后吞掉浏览器合成 click，防误触发"点图退出"
  let dragging = false, dragMoved = false, startX = 0, baseTX = 0;
  let counterShown = false;    // 页码角标只在真正发生过翻页后显示

  const w = (): number => trackEl.clientWidth || 1;
  const pathAt = (i: number): string | null => (i >= 0 && i < paths.length) ? paths[i] : null;
  const setTX = (px: number, animate: boolean): void => {
    trackEl.style.transition = animate ? '' : 'none';
    trackEl.style.transform = 'translateX(' + px + 'px)';
    lastTX = px;
  };
  const fillSlot = (slot: HTMLElement, p: string | null): void => {
    const img = slot.querySelector('img') as HTMLImageElement;
    if (p) {
      if (img.getAttribute('src') !== p) { img.removeAttribute('src'); img.src = p; }
      img.style.display = '';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
    }
  };
  const preload = (p: string | null): void => { if (p) { const im = new Image(); im.src = p; } };
  // 导航条只在当前亮相槽（物理中间槽）显示；到头那侧隐藏（不可点击）
  const syncNav = (): void => {
    slots.forEach((s, i) => {
      (s.querySelector('.plb-nav-prev') as HTMLElement).style.display = (i === 1 && cur > 0) ? '' : 'none';
      (s.querySelector('.plb-nav-next') as HTMLElement).style.display = (i === 1 && cur < paths.length - 1) ? '' : 'none';
    });
  };
  const updateCounter = (): void => { if (counterShown) counterEl.textContent = (cur + 1) + '/' + paths.length; };
  const settle = (): void => {
    fillSlot(slots[0], pathAt(cur - 1));
    fillSlot(slots[1], pathAt(cur));
    fillSlot(slots[2], pathAt(cur + 1));
    setTX(-w(), false);   // 无过渡复位：中间槽即当前图
    syncNav();
    preload(pathAt(cur - 1));
    preload(pathAt(cur + 1));
    if (!counterShown) { counterShown = true; counterEl.classList.add('plb-show'); }
    updateCounter();
  };
  const goTo = (d: 1 | -1): void => {
    const t = cur + d;
    if (t < 0 || t >= paths.length) return;   // 到头：不翻，只由拖拽呈现回弹
    cur = t;
    fillSlot(d === 1 ? slots[2] : slots[0], pathAt(t));
    preload(pathAt(t + d));
    const target = -w() * (1 + d);            // +1 → -2w（第三槽居中）；-1 → 0（第一槽居中）
    if (Math.abs(lastTX - target) < 1) { settle(); return; }  // 已在目标位（如同向连点）：直接落位，不等 transitionend
    setTX(target, true);
  };

  // 初始三槽 + 预热相邻两张（保证拖拽露出的下一张立即可见）
  fillSlot(slots[0], pathAt(cur - 1));
  fillSlot(slots[1], pathAt(cur));
  fillSlot(slots[2], pathAt(cur + 1));
  syncNav();
  setTX(-w(), false);
  preload(pathAt(cur - 1));
  preload(pathAt(cur + 1));

  // 统一收口：解绑 ESC 监听（顺带修复原"点空白关闭时 keydown 未清"的小泄漏），再走 onBack 或关闭
  // 用 const 箭头而非 function 声明：箭头才保留外层 `if (!overlay) return` 对 overlay 的窄化
  const done = (): void => {
    $(document).off('keydown.pz', onKey as any);
    if (onBack) onBack();
    else closePanelOverlay(overlay);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') done();
  };
  $(document).on('keydown.pz', onKey as any);

  // 指针拖拽（鼠标+触摸统一）：跟手 1:1，到头 0.35 阻尼，松手超 1/4 屏宽翻页否则回弹
  const onPointerDown = (e: PointerEvent): void => {
    if (dragging || (e.target as HTMLElement).closest('.plb-nav')) return;   // 导航条是按钮语义，不启拖
    const m = getComputedStyle(trackEl).transform;
    // m41 = matrix(a,b,c,d,e,f) 的第 5 个数 = x 平移量（不能用第一个数 a=缩放系数！）
    baseTX = (m && m !== 'none') ? (new DOMMatrixReadOnly(m).m41 || 0) : lastTX;
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    try { trackEl.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!dragMoved) {
      if (Math.abs(dx) < 8) return;
      dragMoved = true;
      trackEl.style.transition = 'none';   // 拖拽接管：进行中的过渡不 settle（释放时以 goTo/回弹收尾）
    }
    let tx = baseTX + dx;
    if ((cur === 0 && dx > 0) || (cur === paths.length - 1 && dx < 0)) tx = baseTX + dx * 0.35;
    trackEl.style.transform = 'translateX(' + tx + 'px)';
    lastTX = tx;
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (!dragMoved) return;   // 纯点击：轨道不动，后续 click 正常走"点图退出/导航"
    suppressClick = true;     // 拖过（≥8px）即吞合成 click，防误关
    if (Math.abs(dx) > w() / 4) {
      const d: 1 | -1 = dx < 0 ? 1 : -1;
      if (cur + d < 0 || cur + d >= paths.length) setTX(-w(), true);
      else goTo(d);
    } else {
      setTX(-w(), true);      // 回弹
    }
  };
  const onPointerCancel = (): void => {
    if (!dragging) return;
    dragging = false;
    suppressClick = true;
    setTX(-w(), true);        // 中断（来电/手势冲突）一律回弹复位
  };
  trackEl.addEventListener('pointerdown', onPointerDown);
  trackEl.addEventListener('pointermove', onPointerMove);
  trackEl.addEventListener('pointerup', onPointerUp);
  trackEl.addEventListener('pointercancel', onPointerCancel);
  trackEl.addEventListener('transitionend', (e: TransitionEvent) => {
    if (e.target !== trackEl) return;   // 只认轨道自身 transform 过渡（导航条高亮等子元素过渡不算）
    settle();
  });
  // 捕获期拦截拖拽后的合成 click（吞掉，不落到下方"点图退出"判定）
  trackEl.addEventListener('click', (e: MouseEvent) => {
    if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); }
  }, true);

  // 点击：导航条=翻页；点图体/空白=done（空白沿用防幽灵点击，等价原 overlay 背景点击）
  $o.find('#portraitLightbox').on('click', function (e) {
    const t = e.target as HTMLElement;
    const nav = t.closest('.plb-nav');
    if (nav) { goTo((nav as HTMLElement).dataset.plbNav === 'prev' ? -1 : 1); return; }
    if (!t.closest('.plb-frame') && guardGhostClick()) return;
    done();
  });
  overlay.onclick = function (e) {
    if (e.target === overlay) { if (guardGhostClick()) return; done(); }
  };
}

// —— 移动端立绘快捷菜单（⋮ 触发；独立透明 overlay，点外部/选项即关）——
// 固定深色毛玻璃配色，不依赖主题变量，5 主题/深浅模式统一外观。
function showPortraitQuickMenu(npc: string, anchor: HTMLElement, style: StyleType, rerender: () => void): void {
  document.getElementById('portraitQuickOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'portraitQuickOverlay';
  overlay.className = 'portrait-quick-overlay' + (style === 'bridge' ? ' bridge-module-imaging' : '');
  const menu = document.createElement('div');
  menu.className = 'portrait-quick-menu' + (style === 'bridge' ? ' bridge-portrait-quick-menu' : '');
  menu.innerHTML =
    '<button type="button" data-act="generate"><span class="pqm-icon">' + ubIcon('sparkle') + '</span>生成</button>' +
    '<button type="button" data-act="switch"><span class="pqm-icon">⇄</span>换张</button>' +
    '<button type="button" data-act="gallery"><span class="pqm-icon">☰</span>图库</button>';
  overlay.appendChild(menu);
  document.body.appendChild(overlay);
  markPopupShown();

  // 定位（共用 placeAnchoredMenu，与地图库 ⋯ 菜单同一口径）：右对齐 anchor、默认向下展开；
  // 下方放不下翻到上方，两侧都放不下则限高内滚，水平夹在视口边缘内。
  // 尺寸取菜单实测值——原先写死 132×124，改菜单项/字号后就会错位。
  const place = placeAnchoredMenu(
    anchor.getBoundingClientRect(),
    overlay.getBoundingClientRect(),
    { width: menu.offsetWidth, height: menu.offsetHeight },
    { gap: 6 },
  );
  menu.style.left = place.left + 'px';
  menu.style.top = place.top + 'px';
  if (place.maxHeight !== null) {
    menu.style.maxHeight = place.maxHeight + 'px';
    menu.style.overflowY = 'auto';
  }

  const close = (): void => overlay.remove();
  // 点菜单项 → 关菜单后调对应弹窗（close 在前，避免新 overlay 被本浮层遮挡）
  menu.addEventListener('click', function (e) {
    const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.act;
    close();
    if (act === 'generate') showPortraitGenDialog(npc, style, rerender);
    else if (act === 'switch') doSwitchPortraitRandom(npc, anchor, rerender);
    else if (act === 'gallery') showPortraitGalleryPopup(npc, style, 'browse', rerender);
  });
  // 点 overlay 空白 = 关闭（带幽灵点击防护，与其它 overlay 一致）
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) { if (guardGhostClick()) return; close(); }
  });
}

// —— 点「换」直接随机切换一张（不再打开图库 pick；随机池未开启时提示）——
function doSwitchPortraitRandom(npc: string, anchor: HTMLElement | null, rerender: () => void): void {
  // 当前正在显示的 path 作为排除项，避免换完还是同一张（anchor 可能只是 ⋮ 触发钮，向上找立绘框）
  let excludePath: string | null = null;
  const box = anchor ? (anchor.closest('.portrait-box') || anchor) : null;
  const img = box ? (box.querySelector('img') as HTMLImageElement | null) : null;
  if (img && img.getAttribute('src')) excludePath = img.getAttribute('src');
  const chosen = switchPortraitRandom(npc, excludePath);
  if (!chosen) {
    const t = getToastr();
    t?.warning?.('随机池未开启，请先在立绘图库点骰子图标加入随机池（≥2 张后开启）', '立绘');
    return;
  }
  // 强制重渲染：表格数据未变，签名脏检查会跳过，必须 render(true) 立即消费一次性覆盖
  rerender();
}

// —— 委托事件绑定（index.ts 调一次）——
export function bindPortraitEvents($ac: JQuery<HTMLElement>, style: () => StyleType, rerender: () => void): void {
  // 点击立绘本体=放大；点 actions 按钮=对应弹窗
  $ac.off('click.portrait').on('click.portrait', '.portrait-box', function (e) {
    // 直读属性而非 jQuery .data()：分区渲染会就地同步复用容器的 data-portrait-name，
    // jQuery 的每元素数据缓存会一直返回首次读到的旧角色名（切角色后弹错人的窗）
    const npc = String(this.getAttribute('data-portrait-name') || '');
    if (!npc) return;
    const act = $(e.target).data('act');
    if (act === 'generate') { e.stopPropagation(); showPortraitGenDialog(npc, style(), rerender); }
    else if (act === 'switch') { e.stopPropagation(); doSwitchPortraitRandom(npc, e.currentTarget as HTMLElement, rerender); }
    else if (act === 'gallery') { e.stopPropagation(); showPortraitGalleryPopup(npc, style(), 'browse', rerender); }
    else if (act === 'menu') { e.stopPropagation(); showPortraitQuickMenu(npc, e.currentTarget as HTMLElement, style(), rerender); }
    else {
      // 点本体（非按钮）=放大
      const path = $(this).find('img').attr('src');
      if (path) showPortraitZoomPopup(path, style(), undefined, npc);
    }
  });
}
