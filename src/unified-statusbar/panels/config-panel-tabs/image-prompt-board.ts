// ===== 生图 AI 请求提示词板块（统一生图 API 面板内的独立子区）=====
// 「第一步文字 AI 怎么写生图提示词」的可编辑层：全局三件套 + 每个任务的结构要求/任务要求。
// 与出图预设彻底解耦（预设只覆盖前后缀/负面/参数），智慧姬直连下照常生效。
//
// 交互（与手机侧「提示词编辑 · 生图」同款）：
//   · 任务 chips 切换 → 未保存草稿自动落盘（数据保护，与手机切槽位同款）；
//   · 每张卡片「保存」（显式）+「恢复默认」（删键回落内置，破坏性操作二次确认）；
//   · 槽位一律可直接编辑（无锁定）；结构类槽位保存时校验关键 token——缺了拦下并指向「恢复默认」（误操作兜底）；
//   · 与内置一致 → 自动删键（禁物化内置全文，内置升级照常生效）。
import { getConfig, setConfig } from '../../core/config-store';
import { getToastr } from '../../core/env';
import {
  IMAGE_PROMPT_SCENE_KEYS,
  IMAGE_PROMPT_SCENE_LABELS,
  imagePromptSlotsOfScene,
  validateImagePromptTemplate,
  type ImagePromptSceneKey,
  type ImagePromptTemplateSlotDef,
} from '../../core/image-prompt-templates';
import { buildPortraitSystemPromptTags, buildPortraitSystemPromptNatural } from '../../core/portrait-prompts';
import { STORY_IMAGE_FORMAT_CONTRACT, DEFAULT_STORY_IMAGE_REQUIREMENT } from '../../core/story-image-prompts';
import { itemPromptSystem, outfitPromptSystem } from '../../core/wardrobe-prompts';
import { mapSceneSystemPrompt } from '../../core/map-scene-prompts';
import { overviewPromptSystem } from '../../core/item-overview-prompts';
import { chatu8FormatHint, isChatu8Channel } from '../../core/chatu8-bridge';
import { baibaiFormatHint, isBaiBaiChannel } from '../../core/baibai-bridge';
import { resolveActivePreset } from '../../core/portrait-config';
import { showConfirmDialog } from '../../renderers/confirm-dialog';
import { escAttr } from '../config-panel-shared';

/** 当前板块选中的任务（会话级 UI 状态，与「当前生图任务」选择解耦）。 */
let _boardScene: ImagePromptSceneKey = 'portrait';
/** 未保存草稿（单槽位；显式保存/恢复默认/换槽自动落盘后清除）。 */
let _boardDraft: { key: string; text: string } | null = null;

const MUTED = 'font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));';
const CARD = 'border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:8px;padding:10px 12px;margin:8px 0;';
const BADGE_ON = 'display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid #b7dfba;background:#e8f5e9;color:#2e7d32;';
const BADGE_OFF = 'display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:#fafbfc;color:#666;';
const BADGE_DIRTY = 'display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid #f0c36d;background:#fff7e6;color:#b45309;';

function cfg(): ReturnType<typeof getConfig> { return getConfig(); }
function ig(): ReturnType<typeof getConfig>['imageGeneration'] { return cfg().imageGeneration; }
function tpl(): Record<string, string> { return ig().promptTemplates || {}; }

/** 当前提示词模式（NAI 恒标签：与解析链同口径）。 */
function currentMode(): 'tags' | 'natural' {
  const p = ig().provider;
  return p.apiFormat === 'novelai' ? 'tags' : p.promptComposeMode;
}

/** 各槽位的内置默认文本（编辑器展示 + 「与内置一致则删键」比较用）。 */
export function imagePromptSlotDefaultText(key: string): string {
  const mode = currentMode();
  const lang = ig().provider.naturalPromptLanguage;
  switch (key) {
    case 'image:portrait:tags': return buildPortraitSystemPromptTags(false);
    case 'image:portrait:natural': return buildPortraitSystemPromptNatural(false, lang);
    case 'image:storyImage:structure': return STORY_IMAGE_FORMAT_CONTRACT;
    case 'image:storyImage:requirement': return DEFAULT_STORY_IMAGE_REQUIREMENT;
    case 'image:wardrobeItem:system': return itemPromptSystem(mode, lang, undefined);
    case 'image:wardrobeOutfit:system': return outfitPromptSystem(mode, lang, false);
    case 'image:mapScene:system': return mapSceneSystemPrompt(mode, lang);
    case 'image:itemOverview:system': return overviewPromptSystem(mode, lang);
    default: return '';
  }
}

/** 旧版自定义位置是否有内容（迁移条判定）：预设内格式规范 / 正文插图功能设置内的要求提示词。 */
export function imagePromptLegacyCount(): number {
  const c = cfg();
  const presets = c.imageGeneration.promptPresets || [];
  const withFormat = presets.filter(p => typeof p.portraitFormatPrompt === 'string' && p.portraitFormatPrompt.trim()).length;
  const storyLegacy = (c.storyImage && String(c.storyImage.requirementPrompt || '').trim()) ? 1 : 0;
  return withFormat + storyLegacy;
}

function currentSlotText(slot: ImagePromptTemplateSlotDef): { text: string; customized: boolean; dirty: boolean } {
  const saved = (tpl()[slot.key] || '').trim();
  const def = imagePromptSlotDefaultText(slot.key);
  const dirty = !!_boardDraft && _boardDraft.key === slot.key;
  const text = dirty ? _boardDraft!.text : (saved || def);
  return { text, customized: !!saved && saved !== def.trim(), dirty };
}

function cardStyle(customized: boolean): string {
  return customized ? `${CARD}border-color:#c5c9ea;box-shadow:0 0 0 3px #eef0fa;` : CARD;
}

function slotCardHtml(slot: ImagePromptTemplateSlotDef): string {
  const { text, customized, dirty } = currentSlotText(slot);
  const badge = customized
    ? `<span style="${BADGE_ON}">已自定义</span>`
    : `<span style="${BADGE_OFF}">默认</span>`;
  const dirtyBadge = dirty ? ` <span style="${BADGE_DIRTY}">未保存</span>` : '';
  const taStyle = 'width:100%;min-height:140px;padding:6px 8px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,#fff));color:var(--text,var(--sweet-text,#111));border-radius:4px;line-height:1.4;resize:vertical;';
  return `<div style="${cardStyle(customized)}" data-prompt-card="${escAttr(slot.key)}">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><b style="font-size:12px;">${escAttr(slot.label)}</b>${badge}${dirtyBadge}</div>
    <div style="${MUTED}margin:4px 0 6px;">${escAttr(slot.desc)}</div>
    <textarea data-prompt-text="${escAttr(slot.key)}" rows="8" spellcheck="false" style="${taStyle}">${escAttr(text)}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;">
      <button type="button" class="settings-btn" data-prompt-save="${escAttr(slot.key)}">保存</button>
      <button type="button" class="settings-btn" data-prompt-reset="${escAttr(slot.key)}">恢复默认</button>
      <span style="${MUTED}">与内置一致时自动回落「默认」（不占存储）；后台会按同人开关/输出语言等自动选择内置文本，自定义后本场景固定用你的文本。改坏了就点「恢复默认」。</span>
    </div>
  </div>`;
}

function cardsHtml(): string {
  const slots = imagePromptSlotsOfScene(_boardScene);
  return slots.map(slotCardHtml).join('');
}

function chipsHtml(): string {
  return IMAGE_PROMPT_SCENE_KEYS.map(scene =>
    `<button type="button" class="settings-btn" data-prompt-scene="${escAttr(scene)}" style="font-size:11px;padding:4px 12px;${scene === _boardScene ? 'background:#eef0fa;border-color:#c5c9ea;color:#4a4a8a;font-weight:600;' : ''}">${escAttr(IMAGE_PROMPT_SCENE_LABELS[scene])}</button>`,
  ).join(' ');
}

function chatu8HintHtml(): string {
  const p = ig().provider;
  if (!isChatu8Channel(p)) return '';
  let hint = '';
  try {
    hint = chatu8FormatHint({ promptComposeMode: currentMode(), naturalPromptLanguage: p.naturalPromptLanguage, fanTagTransferMode: p.fanTagTransferMode });
  } catch (_e) { hint = ''; }
  if (!hint) return '';
  return `<div style="margin:6px 0;padding:8px 10px;border:1px solid #bcd7f5;background:#eef6ff;border-radius:8px;font-size:11.5px;color:#14498a;">
    <b>智慧姬直连建议</b>（仅提示，不自动修改）：${escAttr(hint)}
  </div>`;
}

function baibaiHintHtml(): string {
  const p = ig().provider;
  if (!isBaiBaiChannel(p)) return '';
  let hint = '';
  try {
    hint = baibaiFormatHint({ promptComposeMode: currentMode() });
  } catch (_e) { hint = ''; }
  if (!hint) return '';
  return `<div style="margin:6px 0;padding:8px 10px;border:1px solid #bcd7f5;background:#eef6ff;border-radius:8px;font-size:11.5px;color:#14498a;">
    <b>柏宝绘直连建议</b>（仅提示，不自动修改）：${escAttr(hint)}
  </div>`;
}

function migrationHtml(): string {
  const count = imagePromptLegacyCount();
  if (!count) return '';
  return `<div style="margin:6px 0;padding:8px 10px;border:1px solid #bcd7f5;background:#eef6ff;border-radius:8px;font-size:11.5px;color:#14498a;" id="imagePromptMigrateBar">
    <b>检测到旧版自定义</b>：旧位置共 ${count} 处（预设内「生图提示词格式规范」/ 正文插图功能设置内的「要求提示词」）。
    <span style="margin-left:6px;"><button type="button" class="settings-btn" data-prompt-migrate="1">合并到本板块</button></span>
    <span style="${MUTED}margin-left:6px;">合并后旧位置清空；未合并前，旧的立绘格式规范不再生效（请尽快合并），正文插图要求提示词仍按旧位置生效。</span>
  </div>`;
}

/** 板块整体 HTML（供 config-panel 渲染时拼入）。 */
export function renderImagePromptBoard(): string {
  const p = ig().provider;
  const sel = 'width:100%;padding:5px 8px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,#fff));color:var(--text,var(--sweet-text,#111));border-radius:4px;cursor:pointer;appearance:auto;';
  const modeVal = currentMode();
  const naiDisabled = p.apiFormat === 'novelai';
  let html = '';
  html += '<div class="ub-api-subsection" id="imagePromptBoardGroup">';
  html += '<div class="ub-api-subsection-title">生图 AI 请求提示词</div>';
  html += '<div class="ub-api-subsection-desc">这里改的是「第一步文字 AI 怎么写生图提示词」：全局三项 + 各任务的结构要求与任务要求（含示例）。与预设解耦——<b>智慧姬直连下照常生效</b>；破限、资料块结构、同人规则段、人物固定标签规则由项目固定，不在此处。输出结构要求关系到出图标签的解析，改动请谨慎。</div>';

  // —— 全局三件套 ——
  html += '<div style="margin:8px 0;padding:8px 10px;border:1px solid #d3bdf5;background:#faf7ff;border-radius:8px;">';
  html += '<div style="font-size:12px;font-weight:700;color:#5b21b6;margin-bottom:6px;">全局设置（三项）<span style="' + MUTED + 'font-weight:400;margin-left:6px;">属于生图 AI 请求层：智慧姬直连下仍生效；小手机四种模式一律跟随这里</span></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
  html += `<label style="font-size:11px;">提示词模式<select id="imagePromptComposeMode" style="${sel}"><option value="tags"${modeVal === 'tags' ? ' selected' : ''}>标签</option><option value="natural"${modeVal === 'natural' ? ' selected' : ''}${naiDisabled ? ' disabled title="NAI 仅支持标签模式"' : ''}>自然语言</option></select></label>`;
  html += `<label style="font-size:11px;">同人tag传输模式<select id="imagePromptFanTagMode" style="${sel}"><option value="novelai"${p.fanTagTransferMode !== 'anima' ? ' selected' : ''}>NovelAI (1.2::tag::)</option><option value="anima"${p.fanTagTransferMode === 'anima' ? ' selected' : ''}>Anima ((tag:2))</option></select></label>`;
  html += `<label style="font-size:11px;">输出语言（自然语言模式）<select id="imagePromptLanguage" style="${sel}"><option value="en"${p.naturalPromptLanguage !== 'zh' ? ' selected' : ''}>英文</option><option value="zh"${p.naturalPromptLanguage === 'zh' ? ' selected' : ''}>中文</option></select></label>`;
  html += '</div>';
  html += `<div style="${MUTED}margin-top:6px;">这三项决定发给文字 AI 的请求形态；NAI 恒标签（供应商能力限制，自动回落）。</div>`;
  html += '</div>';
  html += chatu8HintHtml();
  html += baibaiHintHtml();
  html += migrationHtml();

  html += `<div style="font-size:12px;font-weight:600;margin:10px 0 4px;">任务提示词</div>`;
  html += `<div style="display:flex;gap:6px;flex-wrap:wrap;" id="imagePromptBoardChips">${chipsHtml()}</div>`;
  html += `<div id="imagePromptBoardCards">${cardsHtml()}</div>`;
  html += `<div style="${MUTED}margin-top:4px;">保存：每张卡片「保存」按钮；切换任务时未保存草稿自动落盘（与手机侧同款）。手机端「提示词编辑 · 生图」同款「场景 → 槽位 → 编辑 → 恢复默认」交互。</div>`;
  html += '</div>';
  return html;
}

/** 刷新卡片区（不重建整个面板，保滚动位）。 */
function rerenderCards(): void {
  const box = document.getElementById('imagePromptBoardCards');
  if (box) box.innerHTML = cardsHtml();
}

function rerenderChips(): void {
  const box = document.getElementById('imagePromptBoardChips');
  if (box) box.innerHTML = chipsHtml();
}

/** 保存单槽（显式；返回错误文案 = 拦下）。与内置一致 → 删键。 */
function saveSlot(key: string, rawText: string): string | null {
  const text = String(rawText || '').trim();
  const invalid = validateImagePromptTemplate(key, text);
  if (invalid) return invalid;
  const c = ig();
  const next = { ...(c.promptTemplates || {}) };
  const def = imagePromptSlotDefaultText(key).trim();
  if (!text || text === def) delete next[key];
  else next[key] = text;
  c.promptTemplates = next;
  setConfig('imageGeneration', c);
  return null;
}

function toast(message: string, type: 'info' | 'success' = 'success'): void {
  const tr = getToastr();
  if (type === 'success') tr?.success?.(message, '生图 AI 请求提示词');
  else tr?.info?.(message, '生图 AI 请求提示词');
}

/** 切换任务前的草稿落盘（数据保护；校验失败拦下并留在原任务）。 */
function flushDraft(): boolean {
  if (!_boardDraft) return true;
  const err = saveSlot(_boardDraft.key, _boardDraft.text);
  if (err) {
    toast(err, 'info');
    return false;
  }
  _boardDraft = null;
  toast('已自动保存上一套');
  return true;
}

/** 旧位置一键合并到本板块（立绘格式规范 → image:portrait:tags；正文插图要求 → image:storyImage:requirement）。 */
function migrateLegacy(): void {
  const c = getConfig();
  const next = { ...(c.imageGeneration.promptTemplates || {}) };
  let moved = 0;
  const presets = c.imageGeneration.promptPresets || [];
  const activeForPortrait = resolveActivePreset(presets, c.imageGeneration.tasks.portrait.promptPresetId);
  const legacyFormat = typeof activeForPortrait.portraitFormatPrompt === 'string' ? activeForPortrait.portraitFormatPrompt.trim() : '';
  if (legacyFormat && !next['image:portrait:tags']) {
    next['image:portrait:tags'] = legacyFormat;
    moved++;
  }
  const legacyReq = String(c.storyImage?.requirementPrompt || '').trim();
  if (legacyReq && !next['image:storyImage:requirement']) {
    next['image:storyImage:requirement'] = legacyReq;
    moved++;
  }
  c.imageGeneration.promptTemplates = next;
  // 清空旧位置（预设内格式规范：全预设一并清，避免下次又提示）
  for (const preset of presets) {
    if (typeof preset.portraitFormatPrompt === 'string' && preset.portraitFormatPrompt) delete preset.portraitFormatPrompt;
  }
  if (legacyReq) c.storyImage.requirementPrompt = '';
  setConfig('imageGeneration', c.imageGeneration);
  setConfig('storyImage', c.storyImage);
  toast(moved ? `已合并 ${moved} 处旧自定义到本板块` : '没有可合并的旧自定义');
}

/** 绑定板块事件（渲染后调用；每次面板重建都重新绑定）。 */
export function bindImagePromptBoard(): void {
  const group = document.getElementById('imagePromptBoardGroup');
  if (!group) return;

  // 输入 → 记草稿（不重绘，保光标）
  group.addEventListener('input', (event) => {
    const ta = (event.target as HTMLElement).closest('[data-prompt-text]') as HTMLTextAreaElement | null;
    if (!ta) return;
    const key = ta.dataset.promptText || '';
    _boardDraft = { key, text: ta.value };
    const card = ta.closest('[data-prompt-card]') as HTMLElement | null;
    if (card && !card.querySelector('[data-prompt-dirty]')) {
      const head = card.querySelector('div');
      if (head) {
        const span = document.createElement('span');
        span.setAttribute('data-prompt-dirty', '1');
        span.setAttribute('style', BADGE_DIRTY + 'margin-left:6px;');
        span.textContent = '未保存';
        head.appendChild(span);
      }
    }
  });

  // 下拉（全局三件套）change → 直接落盘（全局设置，独立于预设与保存按钮）
  group.addEventListener('change', (event) => {
    const sel = (event.target as HTMLElement).closest('select') as HTMLSelectElement | null;
    if (!sel) return;
    const c = ig();
    if (sel.id === 'imagePromptComposeMode') {
      c.provider.promptComposeMode = sel.value === 'natural' ? 'natural' : 'tags';
      setConfig('imageGeneration', c);
      toast('提示词模式已更新（全局）');
    } else if (sel.id === 'imagePromptFanTagMode') {
      c.provider.fanTagTransferMode = sel.value === 'anima' ? 'anima' : 'novelai';
      setConfig('imageGeneration', c);
      toast('同人tag传输模式已更新（全局）');
    } else if (sel.id === 'imagePromptLanguage') {
      c.provider.naturalPromptLanguage = sel.value === 'zh' ? 'zh' : 'en';
      setConfig('imageGeneration', c);
      toast('输出语言已更新（全局）');
    }
  });

  group.addEventListener('click', (event) => {
    const el = event.target as HTMLElement;

    const sceneBtn = el.closest('[data-prompt-scene]') as HTMLElement | null;
    if (sceneBtn) {
      const scene = sceneBtn.dataset.promptScene as ImagePromptSceneKey;
      if (!IMAGE_PROMPT_SCENE_KEYS.includes(scene) || scene === _boardScene) return;
      if (!flushDraft()) { rerenderChips(); return; }
      _boardScene = scene;
      rerenderChips();
      rerenderCards();
      return;
    }

    const saveBtn = el.closest('[data-prompt-save]') as HTMLElement | null;
    if (saveBtn) {
      const key = saveBtn.dataset.promptSave || '';
      const ta = group.querySelector(`[data-prompt-text="${key}"]`) as HTMLTextAreaElement | null;
      if (!ta) return;
      const err = saveSlot(key, ta.value);
      if (err) { toast(err, 'info'); return; }
      _boardDraft = null;
      rerenderCards();
      toast('提示词已保存');
      return;
    }

    const resetBtn = el.closest('[data-prompt-reset]') as HTMLElement | null;
    if (resetBtn) {
      const key = resetBtn.dataset.promptReset || '';
      void showConfirmDialog({ message: '恢复本槽位的内置默认？将丢弃编辑框里未保存的改动，并删除你对此槽位的自定义文本。', danger: true }).then((ok) => {
        if (!ok) return;
        const c = ig();
        const next = { ...(c.promptTemplates || {}) };
        delete next[key];
        c.promptTemplates = next;
        setConfig('imageGeneration', c);
        if (_boardDraft && _boardDraft.key === key) _boardDraft = null;
        rerenderCards();
        toast('已恢复默认');
      });
      return;
    }

    const migrateBtn = el.closest('[data-prompt-migrate]') as HTMLElement | null;
    if (migrateBtn) {
      migrateLegacy();
      // 迁移条与卡片都刷新
      const bar = document.getElementById('imagePromptMigrateBar');
      if (bar) bar.outerHTML = migrationHtml() || '<div id="imagePromptMigrateBar"></div>';
      rerenderCards();
      return;
    }
  });
}
