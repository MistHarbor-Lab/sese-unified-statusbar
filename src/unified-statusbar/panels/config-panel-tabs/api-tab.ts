// panels/config-panel-tabs/api-tab.ts
// 「API」标签页的事件绑定（自 config-panel.ts 的 showConfigPanel 整段迁出，S3-4）。
// 迁出前用 TypeScript AST 做作用域分析：本区对壳的唯一依赖是 config 对象与配置变更通知回调，
// 故收敛为两个入参；其余依赖全部走 import（原区内 6 处 _onConfigChanged 直呼改为 notifyChanged()）。

import { getConfig, setConfig, type StatusBarConfig } from '../../core/config-store';
import { getToastr } from '../../core/env';
import { showCardEntryBlacklistPopup } from '../../renderers/card-entry-blacklist-popup';
import { PROMPT_POST_PROCESSING_DEFAULT, normalizeAiRetryMax, type ApiMode, type AiRetryScope, type CustomApiPreset, type PromptPostProcessingValue, type SceneApiPreset, type SceneProfile } from '../../core/constants';
import { fetchModelList, showPersistentError, generatePresetId } from '../../core/api-config';
import { fetchSceneModels, saveSecretToTavern, applyScene, validateSceneProfile, saveSceneApiPreset, deleteSceneApiPreset, injectSceneApiDirectly, listPromptPresets } from '../../core/scene-switcher';
import { ubIcon } from '../../core/icons';
import { syncMapNodeWorldbookEntries } from '../../core/map-worldbook-inject';
import { showConfirmDialog, showPromptDialog } from '../../renderers/confirm-dialog';
import { escAttr as _escAttr, bindModelCombobox } from '../config-panel-shared';
import { mountJailbreakSlots } from './jailbreak-slot-ui';

export function bindApiTab(config: StatusBarConfig, notifyChanged: () => void): void {
  // ===== API 标签页事件绑定 =====

  // API 来源切换（三选一：酒馆 / 自定义 / 按功能独立分配）
  const apiModeSelector = document.getElementById('apiModeSelector') as HTMLSelectElement | null;
  if (apiModeSelector) {
    apiModeSelector.addEventListener('change', function () {
      const raw = this.value;
      const mode = (raw === 'custom' ? 'custom' : raw === 'per-feature' ? 'per-feature' : 'tavern') as ApiMode;
      config.apiMode = mode;
      setConfig('apiMode', mode);
      const customPreset = document.getElementById('customPresetBinding');
      const perFeature = document.getElementById('perFeatureBinding');
      const retryToggleRow = document.getElementById('aiRetryToggleRow');
      if (customPreset) customPreset.style.display = mode === 'custom' ? 'block' : 'none';
      if (perFeature) perFeature.style.display = mode === 'per-feature' ? 'block' : 'none';
      // 预设管理是独立模块（常驻可见），不随模式切换显隐
      // 自动重试总开关仅在 tavern/custom 模式有意义；per-feature 模式改为每个功能行右侧勾选
      if (retryToggleRow) retryToggleRow.style.display = mode === 'per-feature' ? 'none' : 'flex';
      notifyChanged()
    });
  }

  // 自动重试总开关（tavern/custom 模式）
  const aiRetryToggle = document.getElementById('aiRetryToggle');
  if (aiRetryToggle) {
    aiRetryToggle.addEventListener('click', function () {
      const on = !(config.aiRetryEnabled === true);
      config.aiRetryEnabled = on;
      setConfig('aiRetryEnabled', on);
      this.classList.toggle('on', on);
    });
  }

  // 最大重试次数（1-5）
  const aiRetryMaxSelect = document.getElementById('aiRetryMaxSelect') as HTMLSelectElement | null;
  if (aiRetryMaxSelect) {
    aiRetryMaxSelect.addEventListener('change', function () {
      const max = normalizeAiRetryMax(this.value);
      config.aiRetryMax = max;
      setConfig('aiRetryMax', max);
      if (Number(this.value) !== max) this.value = String(max);
    });
  }

  // 逐功能重试勾选（仅 per-feature 模式渲染）
  const retryScopeBoxes = document.querySelectorAll<HTMLInputElement>('input[data-ai-retry-scope]');
  retryScopeBoxes.forEach(box => {
    box.addEventListener('change', function () {
      const scope = this.dataset.aiRetryScope as AiRetryScope | undefined;
      if (!scope) return;
      const next = { ...(config.aiRetryScopes || {}) };
      if (this.checked) next[scope] = true; else delete next[scope];
      config.aiRetryScopes = next;
      setConfig('aiRetryScopes', next);
    });
  });

  // 破限提示词：破限头 / 尾部破限 两槽位（多段 + 预设 + 导入导出）由 jailbreak-slot-ui 挂载与接线
  mountJailbreakSlots(config);

  // 反八股写作要求（独立设置项）：select 切换显隐 + textarea change 落盘
  const antiClicheModeSelect = document.getElementById('antiClicheModeSelect') as HTMLSelectElement | null;
  if (antiClicheModeSelect) {
    antiClicheModeSelect.addEventListener('change', function () {
      const mode = this.value === 'custom' ? 'custom' : 'default';
      config.antiClicheMode = mode;
      setConfig('antiClicheMode', mode);
      const block = document.getElementById('antiClicheCustomBlock');
      if (block) block.style.display = mode === 'custom' ? 'block' : 'none';
    });
  }
  const antiClicheTextInput = document.getElementById('antiClicheTextInput') as HTMLTextAreaElement | null;
  if (antiClicheTextInput) {
    antiClicheTextInput.addEventListener('change', function () {
      config.antiClicheText = this.value;
      setConfig('antiClicheText', this.value);
    });
  }

  // 上下文标签剥离保存按钮（仅 MANUAL 模式：地图 / 立绘 / 瑟瑟指导）
  const stripTagsSaveBtn = document.getElementById('contextStripTagsSaveBtn');
  if (stripTagsSaveBtn) {
    stripTagsSaveBtn.addEventListener('click', function () {
      const ta = document.getElementById('contextStripTagsInput') as HTMLTextAreaElement | null;
      if (!ta) return;
      // 兼容换行 / 中英文逗号 / 分号；去空、trim、小写、去重
      const parts = ta.value.split(/[\n,，;；]+/);
      const seen = new Set<string>();
      const arr: string[] = [];
      for (const raw of parts) {
        const tag = String(raw == null ? '' : raw).trim().toLowerCase();
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        arr.push(tag);
      }
      config.contextStripTags = arr;
      setConfig('contextStripTags', arr);
      // 同步回 textarea：归一化后的内容（空数组显示为空）
      ta.value = arr.length > 0 ? arr.join('\n') : '';
      if (typeof toastr !== 'undefined' && toastr) {
        toastr.success(arr.length > 0 ? `已保存 ${arr.length} 个待剥离标签` : '已清空，剥离已关闭', '上下文标签剥离');
      }
    });
  }

  // 条目黑名单保存按钮（1A 类请求的世界书条目过滤；正则模式，每行一个正则）
  const entryBlacklistSaveBtn = document.getElementById('entryBlacklistSaveBtn');
  if (entryBlacklistSaveBtn) {
    entryBlacklistSaveBtn.addEventListener('click', function () {
      const ta = document.getElementById('entryBlacklistInput') as HTMLTextAreaElement | null;
      if (!ta) return;
      // 只按换行拆分（正则里逗号/分号是合法字符，不按标点拆）；trim、去空、去重，保留原始大小写
      const seen = new Set<string>();
      const arr: string[] = [];
      for (const rawLine of ta.value.split(/\r?\n/)) {
        const pattern = String(rawLine == null ? '' : rawLine).trim();
        if (!pattern || seen.has(pattern)) continue;
        seen.add(pattern);
        arr.push(pattern);
      }
      config.entryBlacklist = arr;
      setConfig('entryBlacklist', arr);
      // 同步回 textarea：归一化后的内容（空数组显示为空）
      ta.value = arr.length > 0 ? arr.join('\n') : '';
      if (typeof toastr !== 'undefined' && toastr) {
        toastr.success(arr.length > 0 ? `已保存 ${arr.length} 条黑名单规则` : '已清空，条目黑名单已关闭', '条目黑名单');
      }
    });
  }

  // 角色卡黑名单：打开选择弹窗（按角色卡绑定的世界书勾选；值存角色卡变量，弹窗内点「保存」一次性写入）
  const cardEntryBlacklistPickBtn = document.getElementById('cardEntryBlacklistPickBtn');
  if (cardEntryBlacklistPickBtn && !cardEntryBlacklistPickBtn.hasAttribute('disabled')) {
    cardEntryBlacklistPickBtn.addEventListener('click', function () {
      showCardEntryBlacklistPopup(getConfig().style);
    });
  }

  // 地图触发关键词排除项 textarea（change 时保存 + 重新注入节点世界书条目）
  const mapExcludePatternInput = document.getElementById('mapExcludePatternInput') as HTMLTextAreaElement | null;
  if (mapExcludePatternInput) {
    mapExcludePatternInput.addEventListener('change', function () {
      config.mapExcludePattern = this.value;
      setConfig('mapExcludePattern', this.value);
      void syncMapNodeWorldbookEntries();
    });
  }

  // 文本输入框（URL/Key/Model/Source）为纯编辑态，不直写 config；
  // 「保存为预设」/「更新当前预设」时由 readApiConfigFromInputs() 从 DOM 读取。

  // 模型组合框：文本框手输 + ▼ 浮层选择已加载模型（不加载也能直接填、直接保存）
  const customLoaded = { current: [] as string[] };
  const customCombo = bindModelCombobox({
    inputId: 'customApiModelInput',
    toggleBtnId: 'customApiModelDropdownBtn',
    popoverId: 'customApiModelPopover',
    loaded: customLoaded,
  });

  // 加载可用模型列表
  const loadModelsBtn = document.getElementById('customApiLoadModelsBtn');
  if (loadModelsBtn) {
    loadModelsBtn.addEventListener('click', async function () {
      const urlInput = document.getElementById('customApiUrlInput') as HTMLInputElement | null;
      const keyInput = document.getElementById('customApiKeyInput') as HTMLInputElement | null;
      const url = (urlInput?.value || '').trim();
      const key = (keyInput?.value || '').trim();
      if (!url) {
        getToastr()?.error('请先填写 API URL', '加载模型');
        return;
      }
      const btn = this as HTMLButtonElement;
      const origText = btn.textContent;
      btn.textContent = '加载中...';
      btn.disabled = true;
      try {
        const models = await fetchModelList(url, key || undefined);
        customCombo.setLoaded(models);
        getToastr()?.success('已加载 ' + models.length + ' 个可用模型', '加载模型');
      } catch (e) {
        showPersistentError('加载模型列表失败: ' + (e as Error).message + '\n\n请检查 API URL 与 Key 是否正确。', '加载模型');
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  // 统一生图 API OpenAI 分支：模型组合框（与 customApi 同款三件套；元素缺失时 bindModelCombobox 自动 no-op）
  const oaiLoaded = { current: [] as string[] };
  const oaiCombo = bindModelCombobox({
    inputId: 'portraitModelOai',
    toggleBtnId: 'portraitModelOaiDropdownBtn',
    popoverId: 'portraitModelOaiPopover',
    loaded: oaiLoaded,
  });
  const oaiLoadBtn = document.getElementById('portraitModelOaiLoadBtn');
  if (oaiLoadBtn) {
    oaiLoadBtn.addEventListener('click', async function () {
      const url = String(($('#portraitUrl').val() as string || '')).trim();
      const key = String(($('#portraitKey').val() as string || '')).trim();
      if (!url) {
        getToastr()?.error('请先填写 API 地址', '加载模型');
        return;
      }
      const btn = this as HTMLButtonElement;
      const origText = btn.textContent;
      btn.textContent = '加载中...';
      btn.disabled = true;
      try {
        const models = await fetchModelList(url, key || undefined);
        oaiCombo.setLoaded(models);
        getToastr()?.success('已加载 ' + models.length + ' 个可用模型', '加载模型');
      } catch (e) {
        showPersistentError('加载模型列表失败: ' + (e as Error).message + '\n\n请检查 API 地址与 Key 是否正确。', '加载模型');
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  // 数值类参数通用绑定（纯 UI 联动；编辑态不写 config，保存/更新预设时从 DOM 读）
  function bindApiNumParam(key: string, _configKey: string, min: number, max: number): void {
    const unsetBox = document.getElementById('api' + key + 'Unset') as HTMLInputElement | null;
    const numInput = document.getElementById('api' + key + 'Input') as HTMLInputElement | null;
    if (!unsetBox || !numInput) return;

    const applyUnsetUI = (): void => {
      const isUnset = unsetBox.checked;
      numInput.disabled = isUnset;
      numInput.style.opacity = isUnset ? '0.5' : '';
      numInput.placeholder = isUnset ? '使用默认' : '';
      if (isUnset) numInput.value = '';
    };

    unsetBox.addEventListener('change', function () {
      applyUnsetUI();
      if (!unsetBox.checked) {
        // 取消 unset 时，若输入框为空则填入 min（纯 UI，不写 config）
        let v = parseFloat(numInput.value);
        if (isNaN(v)) v = min;
        v = Math.max(min, Math.min(max, v));
        numInput.value = String(v);
      }
    });

    numInput.addEventListener('blur', function () {
      if (unsetBox.checked) return;
      let v = parseFloat(this.value);
      if (isNaN(v)) v = min;
      v = Math.max(min, Math.min(max, v));
      this.value = String(v);
    });

    applyUnsetUI();
  }
  bindApiNumParam('maxTokens', 'customApiMaxTokens', 1, 200000);
  bindApiNumParam('temperature', 'customApiTemperature', 0, 2);
  bindApiNumParam('topP', 'customApiTopP', 0, 1);
  bindApiNumParam('topK', 'customApiTopK', 0, 1000);
  bindApiNumParam('frequencyPenalty', 'customApiFrequencyPenalty', -2, 2);
  bindApiNumParam('presencePenalty', 'customApiPresencePenalty', -2, 2);

  // ===== API预设管理事件绑定 =====

  // 从输入框读取当前所有 API 配置，返回预设数据对象（不含 id/name/createdAt）
  function readApiConfigFromInputs(): Omit<CustomApiPreset, 'id' | 'name' | 'createdAt'> {
    const numOrUnset = (key: string): number | 'unset' => {
      const unsetBox = document.getElementById('api' + key + 'Unset') as HTMLInputElement | null;
      if (unsetBox && unsetBox.checked) return 'unset';
      const numInput = document.getElementById('api' + key + 'Input') as HTMLInputElement | null;
      const v = parseFloat(numInput?.value || '');
      return isNaN(v) ? 'unset' : v;
    };
    return {
      url: (document.getElementById('customApiUrlInput') as HTMLInputElement | null)?.value || '',
      key: (document.getElementById('customApiKeyInput') as HTMLInputElement | null)?.value || '',
      model: (document.getElementById('customApiModelInput') as HTMLInputElement | null)?.value || '',
      maxTokens: numOrUnset('maxTokens'),
      temperature: numOrUnset('temperature'),
      topP: numOrUnset('topP'),
      topK: numOrUnset('topK'),
      frequencyPenalty: numOrUnset('frequencyPenalty'),
      presencePenalty: numOrUnset('presencePenalty'),
    };
  }

  // 将预设配置应用到输入框（纯 DOM 编辑态，不同步顶层 config——预设即唯一真相，顶层字段已降级）
  function applyPresetToInputs(preset: CustomApiPreset): void {
    const setText = (id: string, val: string): void => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = val;
    };
    setText('customApiUrlInput', preset.url);
    setText('customApiKeyInput', preset.key);
    setText('customApiModelInput', preset.model);

    const setNum = (key: string, val: number | 'unset'): void => {
      const unsetBox = document.getElementById('api' + key + 'Unset') as HTMLInputElement | null;
      const numInput = document.getElementById('api' + key + 'Input') as HTMLInputElement | null;
      if (!unsetBox || !numInput) return;
      const isUnset = val === 'unset';
      unsetBox.checked = isUnset;
      numInput.value = isUnset ? '' : String(val);
      numInput.disabled = isUnset;
      numInput.style.opacity = isUnset ? '0.5' : '';
      numInput.placeholder = isUnset ? '使用默认' : '';
    };
    setNum('maxTokens', preset.maxTokens);
    setNum('temperature', preset.temperature);
    setNum('topP', preset.topP);
    setNum('topK', preset.topK);
    setNum('frequencyPenalty', preset.frequencyPenalty);
    setNum('presencePenalty', preset.presencePenalty);
  }

  // 刷新所有预设下拉：编辑用下拉（瞬态保当前 DOM 选中）、使用预设下拉（绑 activeApiPresetId）、三个功能下拉
  function refreshApiPresetSelect(): void {
    // 编辑用下拉：瞬态，保留当前 DOM 选中值
    const editSelect = document.getElementById('apiPresetSelect') as HTMLSelectElement | null;
    if (editSelect) {
      const curEdit = editSelect.value;
      editSelect.innerHTML = '<option value="">- 选择生成预设 -</option>';
      for (const p of config.customApiPresets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === curEdit) opt.selected = true;
        editSelect.appendChild(opt);
      }
    }
    // 使用预设下拉（custom 模式）：绑 activeApiPresetId
    const activeSelect = document.getElementById('activeApiPresetSelect') as HTMLSelectElement | null;
    if (activeSelect) {
      activeSelect.innerHTML = '<option value="">- 选择生成预设 -</option>';
      for (const p of config.customApiPresets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === config.activeApiPresetId) opt.selected = true;
        activeSelect.appendChild(opt);
      }
    }
    // 四个功能下拉（per-feature 模式）：绑对应 *ApiPresetId
    const featureMap: { selId: string; cfgKey: string }[] = [
      { selId: 'investigationApiPresetSelect', cfgKey: 'investigationApiPresetId' },
      { selId: 'calendarApiPresetSelect', cfgKey: 'calendarApiPresetId' },
      { selId: 'shopStoryApiPresetSelectApi', cfgKey: 'shopStoryApiPresetId' },
      { selId: 'mapApiPresetSelect', cfgKey: 'mapApiPresetId' },
      { selId: 'portraitApiPresetSelect', cfgKey: 'imagePromptApiPresetId' },
      { selId: 'wardrobeExtractApiPresetSelect', cfgKey: 'wardrobeExtractApiPresetId' },
      { selId: 'nsfwGuidanceApiPresetSelect', cfgKey: 'nsfwGuidanceApiPresetId' },
      { selId: 'skillApiPresetSelect', cfgKey: 'skillApiPresetId' },
      { selId: 'chronicleMergeApiPresetSelect', cfgKey: 'chronicleMergeApiPresetId' },
      { selId: 'characterWorldbookApiPresetSelect', cfgKey: 'characterWorldbookApiPresetId' },
      { selId: 'worldApiPresetSelect', cfgKey: 'worldApiPresetId' },
      { selId: 'assistantApiPresetSelectPF', cfgKey: 'assistantApiPresetId' },
    ];
    for (const fm of featureMap) {
      const sel = document.getElementById(fm.selId) as HTMLSelectElement | null;
      if (!sel) continue;
      const boundId = fm.cfgKey === 'imagePromptApiPresetId' ? config.imageGeneration.imagePromptApiPresetId : (config as any)[fm.cfgKey] || '';
      sel.innerHTML = '<option value="">使用酒馆主API</option>';
      for (const p of config.customApiPresets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === boundId) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    // 小助手功能区 API 下拉（独立作用域，始终可见，空选项文案与 per-feature 列表不同）
    const assistantSel = document.getElementById('assistantApiPresetSelect') as HTMLSelectElement | null;
    if (assistantSel) {
      assistantSel.innerHTML = '<option value="">跟随酒馆主 API</option>';
      for (const p of config.customApiPresets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === config.assistantApiPresetId) opt.selected = true;
        assistantSel.appendChild(opt);
      }
    }
  }

  // 编辑用下拉切换：加载选中预设到输入框（纯编辑态，不改 activeApiPresetId）
  const presetSelect = document.getElementById('apiPresetSelect') as HTMLSelectElement | null;
  if (presetSelect) {
    presetSelect.addEventListener('change', function () {
      const presetId = this.value;
      if (!presetId) return; // 选「- 选择生成预设 -」，仅清空编辑焦点
      const preset = config.customApiPresets.find(p => p.id === presetId);
      if (!preset) return;
      customCombo.reset(); // 切换预设：清空旧端点的已加载模型列表 + 关浮层
      applyPresetToInputs(preset);
    });
  }

  // 使用预设下拉切换（custom 模式）：绑 activeApiPresetId
  const activePresetSelect = document.getElementById('activeApiPresetSelect') as HTMLSelectElement | null;
  if (activePresetSelect) {
    activePresetSelect.addEventListener('change', function () {
      const presetId = this.value;
      config.activeApiPresetId = presetId;
      setConfig('activeApiPresetId', presetId);
      notifyChanged()
    });
  }

  // 四个功能下拉切换（per-feature 模式）：绑对应 *ApiPresetId
  const featureSelBindings: { selId: string; cfgKey: string }[] = [
    { selId: 'investigationApiPresetSelect', cfgKey: 'investigationApiPresetId' },
    { selId: 'calendarApiPresetSelect', cfgKey: 'calendarApiPresetId' },
    { selId: 'shopStoryApiPresetSelectApi', cfgKey: 'shopStoryApiPresetId' },
    { selId: 'mapApiPresetSelect', cfgKey: 'mapApiPresetId' },
    { selId: 'portraitApiPresetSelect', cfgKey: 'imagePromptApiPresetId' },
    { selId: 'wardrobeExtractApiPresetSelect', cfgKey: 'wardrobeExtractApiPresetId' },
    { selId: 'nsfwGuidanceApiPresetSelect', cfgKey: 'nsfwGuidanceApiPresetId' },
    { selId: 'skillApiPresetSelect', cfgKey: 'skillApiPresetId' },
    { selId: 'chronicleMergeApiPresetSelect', cfgKey: 'chronicleMergeApiPresetId' },
    { selId: 'characterWorldbookApiPresetSelect', cfgKey: 'characterWorldbookApiPresetId' },
    { selId: 'worldApiPresetSelect', cfgKey: 'worldApiPresetId' },
    { selId: 'assistantApiPresetSelectPF', cfgKey: 'assistantApiPresetId' },
  ];
  for (const fb of featureSelBindings) {
    const sel = document.getElementById(fb.selId) as HTMLSelectElement | null;
    if (!sel) continue;
    sel.addEventListener('change', function () {
      const presetId = this.value;
      if (fb.cfgKey === 'imagePromptApiPresetId') {
        config.imageGeneration.imagePromptApiPresetId = presetId;
        setConfig('imageGeneration', config.imageGeneration);
      } else {
        (config as any)[fb.cfgKey] = presetId;
        setConfig(fb.cfgKey as any, presetId as any);
      }
      notifyChanged()
    });
  }

  // 小助手功能区内 API 预设下拉（独立作用域，始终可见，不受 apiMode 影响）
  const assistantPresetSel = document.getElementById('assistantApiPresetSelect') as HTMLSelectElement | null;
  if (assistantPresetSel) {
    assistantPresetSel.addEventListener('change', function () {
      const presetId = this.value;
      config.assistantApiPresetId = presetId;
      setConfig('assistantApiPresetId', presetId);
      notifyChanged()
    });
  }

  // 宅仙上下文条数：滑条与数字框双向同步，落盘前钳制 1-50
  const assistantContextSlider = document.getElementById('assistantContextSlider') as HTMLInputElement | null;
  const assistantContextInput = document.getElementById('assistantContextInput') as HTMLInputElement | null;
  const applyAssistantContext = function (raw: number) {
    const depth = Math.max(1, Math.min(50, Math.floor(Number(raw) || 10)));
    config.assistantContextDepth = depth;
    setConfig('assistantContextDepth', depth);
    if (assistantContextSlider && Number(assistantContextSlider.value) !== depth) assistantContextSlider.value = String(depth);
    if (assistantContextInput && Number(assistantContextInput.value) !== depth) assistantContextInput.value = String(depth);
  };
  if (assistantContextSlider) {
    assistantContextSlider.addEventListener('change', function () { applyAssistantContext(Number(this.value)); });
  }
  if (assistantContextInput) {
    assistantContextInput.addEventListener('change', function () { applyAssistantContext(Number(this.value)); });
  }

  // 宅仙口吻与人设：select 切换显隐 + textarea change 落盘
  const assistantPersonaModeSelect = document.getElementById('assistantPersonaModeSelect') as HTMLSelectElement | null;
  if (assistantPersonaModeSelect) {
    assistantPersonaModeSelect.addEventListener('change', function () {
      const mode = this.value === 'custom' ? 'custom' : 'default';
      config.assistantPersonaMode = mode;
      setConfig('assistantPersonaMode', mode);
      const block = document.getElementById('assistantPersonaCustomBlock');
      if (block) block.style.display = mode === 'custom' ? 'block' : 'none';
    });
  }
  const assistantPersonaTextInput = document.getElementById('assistantPersonaTextInput') as HTMLTextAreaElement | null;
  if (assistantPersonaTextInput) {
    assistantPersonaTextInput.addEventListener('change', function () {
      config.assistantPersonaText = this.value;
      setConfig('assistantPersonaText', this.value);
    });
  }

  // 保存为预设：prompt 输入名称，将当前输入框值存为新预设（不自动绑定为使用预设，由用户在引用下拉中选择）
  const presetSaveBtn = document.getElementById('apiPresetSaveBtn');
  if (presetSaveBtn) {
    presetSaveBtn.addEventListener('click', async function () {
      const name = await showPromptDialog({ message: '请输入预设名称：' });
      if (!name || !name.trim()) return;
      const trimmedName = name.trim();
      if (config.customApiPresets.some(p => p.name === trimmedName)) {
        getToastr()?.error('已存在同名预设，请换一个名称', 'API 预设');
        return;
      }
      const newPreset: CustomApiPreset = {
        id: generatePresetId(),
        name: trimmedName,
        ...readApiConfigFromInputs(),
        createdAt: Date.now(),
      };
      config.customApiPresets.push(newPreset);
      setConfig('customApiPresets', config.customApiPresets);
      refreshApiPresetSelect();
      // 选中新预设为编辑焦点
      const editSelect = document.getElementById('apiPresetSelect') as HTMLSelectElement | null;
      if (editSelect) editSelect.value = newPreset.id;
      getToastr()?.success('已保存预设：' + trimmedName + '。请到「API分配」里选择它以生效。', 'API 预设');
    });
  }

  // 更新当前预设：将当前输入框值覆盖到「编辑用」下拉选中的预设
  const presetUpdateBtn = document.getElementById('apiPresetUpdateBtn');
  if (presetUpdateBtn) {
    presetUpdateBtn.addEventListener('click', function () {
      const editSelect = document.getElementById('apiPresetSelect') as HTMLSelectElement | null;
      const presetId = editSelect?.value || '';
      if (!presetId) {
        getToastr()?.warning('请先在「选择生成预设（编辑用）」下拉中选择一个预设再更新', 'API 预设');
        return;
      }
      const idx = config.customApiPresets.findIndex(p => p.id === presetId);
      if (idx === -1) {
        getToastr()?.error('未找到该预设（可能已被删除）', 'API 预设');
        return;
      }
      const preset = config.customApiPresets[idx];
      Object.assign(preset, readApiConfigFromInputs());
      setConfig('customApiPresets', config.customApiPresets);
      getToastr()?.success('已更新预设：' + preset.name, 'API 预设');
    });
  }

  // 删除预设：confirm 后从数组移除，并清理所有引用（仿场景预设删除清档位引用）
  const presetDeleteBtn = document.getElementById('apiPresetDeleteBtn');
  if (presetDeleteBtn) {
    presetDeleteBtn.addEventListener('click', async function () {
      const editSelect = document.getElementById('apiPresetSelect') as HTMLSelectElement | null;
      const presetId = editSelect?.value || '';
      if (!presetId) {
        getToastr()?.warning('请先在「选择生成预设（编辑用）」下拉中选择要删除的预设', 'API 预设');
        return;
      }
      const preset = config.customApiPresets.find(p => p.id === presetId);
      if (!preset) return;
      if (!await showConfirmDialog({ message: '确认删除预设「' + preset.name + '」？此操作不可撤销。', danger: true })) return;
      config.customApiPresets = config.customApiPresets.filter(p => p.id !== presetId);
      setConfig('customApiPresets', config.customApiPresets);
      // 清理所有引用（activeApiPresetId + 全部功能绑定）
      if (config.activeApiPresetId === presetId) { config.activeApiPresetId = ''; setConfig('activeApiPresetId', ''); }
      if (config.investigationApiPresetId === presetId) { config.investigationApiPresetId = ''; setConfig('investigationApiPresetId', ''); }
      if (config.calendarApiPresetId === presetId) { config.calendarApiPresetId = ''; setConfig('calendarApiPresetId', ''); }
      if (config.shopStoryApiPresetId === presetId) { config.shopStoryApiPresetId = ''; setConfig('shopStoryApiPresetId', ''); }
      if (config.mapApiPresetId === presetId) { config.mapApiPresetId = ''; setConfig('mapApiPresetId', ''); }
      if (config.imageGeneration.imagePromptApiPresetId === presetId) { config.imageGeneration.imagePromptApiPresetId = ''; config.portraitApiPresetId = ''; setConfig('imageGeneration', config.imageGeneration); }
      if (config.wardrobeExtractApiPresetId === presetId) { config.wardrobeExtractApiPresetId = ''; setConfig('wardrobeExtractApiPresetId', ''); }
      if (config.nsfwGuidanceApiPresetId === presetId) { config.nsfwGuidanceApiPresetId = ''; setConfig('nsfwGuidanceApiPresetId', ''); }
      if (config.skillApiPresetId === presetId) { config.skillApiPresetId = ''; setConfig('skillApiPresetId', ''); }
      if (config.chronicleMergeApiPresetId === presetId) { config.chronicleMergeApiPresetId = ''; setConfig('chronicleMergeApiPresetId', ''); }
      if (config.characterWorldbookApiPresetId === presetId) { config.characterWorldbookApiPresetId = ''; setConfig('characterWorldbookApiPresetId', ''); }
      if (config.worldApiPresetId === presetId) { config.worldApiPresetId = ''; setConfig('worldApiPresetId', ''); }
      if (config.assistantApiPresetId === presetId) { config.assistantApiPresetId = ''; setConfig('assistantApiPresetId', ''); }
      refreshApiPresetSelect();
      // 清空编辑输入框 + 已加载模型列表
      customCombo.reset();
      applyPresetToInputs({ id: '', name: '', url: '', key: '', model: '', maxTokens: 'unset', temperature: 'unset', topP: 'unset', topK: 'unset', frequencyPenalty: 'unset', presencePenalty: 'unset', createdAt: 0 });
      getToastr()?.success('已删除预设：' + preset.name, 'API 预设');
    });
  }

  // ===== 场景对话 API 预设仓库：事件绑定 =====

  // 模型组合框：文本框手输 + ▼ 浮层选择已加载模型（不加载也能直接填、直接保存）
  const sceneLoaded = { current: [] as string[] };
  const sceneCombo = bindModelCombobox({
    inputId: 'sceneApiPresetModel',
    toggleBtnId: 'sceneApiPresetModelDropdownBtn',
    popoverId: 'sceneApiPresetModelPopover',
    loaded: sceneLoaded,
  });

  // 刷新仓库预设下拉
  function refreshSceneApiPresetSelect(): void {
    const select = document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null;
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">- 选择对话预设 -</option>';
    for (const p of config.sceneApiPresets) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === currentVal) opt.selected = true;
      select.appendChild(opt);
    }
  }

  // 刷新仓库密钥状态显示
  function refreshSceneApiPresetSecretStatus(): void {
    const status = document.getElementById('sceneApiPresetSecretStatus');
    if (!status) return;
    const currentId = (document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null)?.value || '';
    const preset = currentId ? config.sceneApiPresets.find(p => p.id === currentId) : null;
    if (preset?.secretId) {
      status.textContent = '密钥已存入酒馆（secretId: ' + preset.secretId.slice(0, 12) + '...）';
      status.style.color = '#51a351';
    } else {
      status.textContent = '尚未存入';
      status.style.color = 'var(--text-muted,var(--sweet-text-muted,#999))';
    }
  }

  // 将仓库预设填充到输入框
  function fillSceneApiPresetFields(preset: SceneApiPreset): void {
    const setText = (id: string, val: string): void => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = val;
    };
    setText('sceneApiPresetUrl', preset.url);
    setText('sceneApiPresetModel', preset.model);
    setText('sceneApiPresetKey', preset.key);

    // 附加参数 textarea
    const setArea = (id: string, val: string): void => {
      const el = document.getElementById(id) as HTMLTextAreaElement | null;
      if (el) el.value = val;
    };
    setArea('apisapBodyParamsInput', preset.bodyParams || '');
    setArea('apisapExcludeBodyParamsInput', preset.excludeBodyParams || '');
    setArea('apisapCustomHeadersInput', preset.customHeaders || '');

    // 提示词后处理方式下拉
    const pppSelect = document.getElementById('sceneApiPresetPromptPostProcessing') as HTMLSelectElement | null;
    if (pppSelect) pppSelect.value = preset.promptPostProcessing;

    refreshSceneApiPresetSecretStatus();
    // 同步刷新档位预设下拉
    refreshSceneApiPresetDropdowns();
  }

  // 从仓库输入框读取 API 配置
  function readSceneApiPresetFromFields(): Omit<SceneApiPreset, 'id' | 'createdAt'> {
    return {
      name: '',
      url: (document.getElementById('sceneApiPresetUrl') as HTMLInputElement | null)?.value || '',
      model: (document.getElementById('sceneApiPresetModel') as HTMLInputElement | null)?.value || '',
      key: (document.getElementById('sceneApiPresetKey') as HTMLInputElement | null)?.value || '',
      secretId: '',
      secretLabel: '',
      maxTokens: 'unset',
      temperature: 'unset',
      topP: 'unset',
      topK: 'unset',
      frequencyPenalty: 'unset',
      presencePenalty: 'unset',
      bodyParams: (document.getElementById('apisapBodyParamsInput') as HTMLTextAreaElement | null)?.value || '',
      excludeBodyParams: (document.getElementById('apisapExcludeBodyParamsInput') as HTMLTextAreaElement | null)?.value || '',
      customHeaders: (document.getElementById('apisapCustomHeadersInput') as HTMLTextAreaElement | null)?.value || '',
      promptPostProcessing: (((document.getElementById('sceneApiPresetPromptPostProcessing') as HTMLSelectElement | null)?.value || '') as PromptPostProcessingValue),
    };
  }

  // 预设下拉切换
  const sapSelect = document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null;
  if (sapSelect) {
    sapSelect.addEventListener('change', function () {
      const presetId = this.value;
      sceneCombo.reset(); // 切换预设/清空：清空旧端点的已加载模型列表 + 关浮层
      if (!presetId) {
        // 清空所有字段
        (document.getElementById('sceneApiPresetUrl') as HTMLInputElement | null)?.value && ((document.getElementById('sceneApiPresetUrl') as HTMLInputElement).value = '');
        (document.getElementById('sceneApiPresetModel') as HTMLInputElement | null)?.value && ((document.getElementById('sceneApiPresetModel') as HTMLInputElement).value = '');
        (document.getElementById('sceneApiPresetKey') as HTMLInputElement | null)?.value && ((document.getElementById('sceneApiPresetKey') as HTMLInputElement).value = '');
        const pppEl = document.getElementById('sceneApiPresetPromptPostProcessing') as HTMLSelectElement | null;
        if (pppEl) pppEl.value = PROMPT_POST_PROCESSING_DEFAULT;
        refreshSceneApiPresetSecretStatus();
        return;
      }
      const preset = config.sceneApiPresets.find(p => p.id === presetId);
      if (preset) fillSceneApiPresetFields(preset);
    });
  }

  // 加载模型按钮
  const sapLoadModelsBtn = document.getElementById('sceneApiPresetLoadModelsBtn');
  if (sapLoadModelsBtn) {
    sapLoadModelsBtn.addEventListener('click', async function () {
      const url = (document.getElementById('sceneApiPresetUrl') as HTMLInputElement | null)?.value?.trim() || '';
      const key = (document.getElementById('sceneApiPresetKey') as HTMLInputElement | null)?.value || '';
      if (!url) { getToastr()?.warning('请先填写 API URL', '加载模型'); return; }
      const btn = this as HTMLButtonElement;
      const orig = btn.textContent;
      btn.textContent = '加载中...';
      btn.disabled = true;
      try {
        const models = await fetchSceneModels(url, key);
        sceneCombo.setLoaded(models);
        getToastr()?.success('已加载 ' + models.length + ' 个可用模型，密钥有效', '加载模型');
      } catch (e) {
        showPersistentError('加载模型列表失败: ' + ((e as any)?.message || String(e)), '加载模型');
      } finally {
        btn.textContent = orig;
        btn.disabled = false;
      }
    });
  }

  // 保存密钥按钮
  const sapSaveKeyBtn = document.getElementById('sceneApiPresetSaveKeyBtn');
  if (sapSaveKeyBtn) {
    sapSaveKeyBtn.addEventListener('click', async function () {
      const key = (document.getElementById('sceneApiPresetKey') as HTMLInputElement | null)?.value || '';
      if (!key) { getToastr()?.warning('请先填写 API 密钥', '保存密钥'); return; }
      const btn = this as HTMLButtonElement;
      const orig = btn.textContent;
      btn.textContent = '保存中...';
      btn.disabled = true;
      try {
        const currentId = (document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null)?.value || '';
        const preset = currentId ? config.sceneApiPresets.find(p => p.id === currentId) : null;
        const label = (preset?.name || '场景切换') + '_' + Date.now().toString(36);
        const secretId = await saveSecretToTavern(key, label);
        // 如果当前选中了一个预设，更新其 secretId；否则待保存预设时一起写入
        if (preset) {
          preset.secretId = secretId;
          preset.secretLabel = label;
          setConfig('sceneApiPresets', config.sceneApiPresets);
        }
        refreshSceneApiPresetSecretStatus();
        // 同步档位摘要
        refreshSceneApiPresetDropdowns();
        getToastr()?.success('密钥已存入酒馆秘钥系统（label: ' + label + '）', '保存成功');
      } catch (e) {
        getToastr()?.error((e as any)?.message || String(e), '保存失败');
      } finally {
        btn.textContent = orig;
        btn.disabled = false;
      }
    });
  }

  // 保存为预设
  const sapSaveBtn = document.getElementById('sceneApiPresetSaveBtn');
  if (sapSaveBtn) {
    sapSaveBtn.addEventListener('click', async function () {
      const name = await showPromptDialog({ message: '请输入预设名称：' });
      if (!name || !name.trim()) return;
      const trimmedName = name.trim();
      if (config.sceneApiPresets.some(p => p.name === trimmedName)) {
        getToastr()?.error('已存在同名预设，请换一个名称', 'API 预设');
        return;
      }
      // 保留当前选中预设的 secretId（如果已保存过密钥）
      const currentId = (document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null)?.value || '';
      const existingPreset = currentId ? config.sceneApiPresets.find(p => p.id === currentId) : null;
      const preset = saveSceneApiPreset({
        ...readSceneApiPresetFromFields(),
        name: trimmedName,
        secretId: existingPreset?.secretId || '',
        secretLabel: existingPreset?.secretLabel || '',
      });
      refreshSceneApiPresetSelect();
      // 选中新保存的预设
      const select = document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null;
      if (select) { select.value = preset.id; select.dispatchEvent(new Event('change')); }
      // 同步档位下拉
      refreshSceneApiPresetDropdowns();
      getToastr()?.success('已保存预设：' + trimmedName, '场景对话 API 预设');
    });
  }

  // 更新当前预设
  const sapUpdateBtn = document.getElementById('sceneApiPresetUpdateBtn');
  if (sapUpdateBtn) {
    sapUpdateBtn.addEventListener('click', function () {
      const currentId = (document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null)?.value || '';
      if (!currentId) {
        getToastr()?.warning('请先在下拉框中选择一个预设再更新', 'API 预设');
        return;
      }
      const idx = config.sceneApiPresets.findIndex(p => p.id === currentId);
      if (idx === -1) {
        getToastr()?.error('未找到当前预设（可能已被删除）', 'API 预设');
        return;
      }
      const existing = config.sceneApiPresets[idx];
      saveSceneApiPreset({
        ...readSceneApiPresetFromFields(),
        name: existing.name,
        id: currentId,
        secretId: existing.secretId,
        secretLabel: existing.secretLabel,
      });
      refreshSceneApiPresetSelect();
      refreshSceneApiPresetDropdowns();
      getToastr()?.success('已更新预设：' + existing.name, '场景对话 API 预设');
    });
  }

  // 删除预设
  const sapDeleteBtn = document.getElementById('sceneApiPresetDeleteBtn');
  if (sapDeleteBtn) {
    sapDeleteBtn.addEventListener('click', async function () {
      const select = document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null;
      const presetId = select?.value || '';
      if (!presetId) {
        getToastr()?.warning('请先在下拉框中选择要删除的预设', 'API 预设');
        return;
      }
      const preset = config.sceneApiPresets.find(p => p.id === presetId);
      if (!preset) return;
      if (!await showConfirmDialog({ message: '确认删除预设「' + preset.name + '」？\n\n若日常/瑟瑟档位正在引用此预设，将自动清空引用。\n此操作不可撤销。', danger: true })) return;
      deleteSceneApiPreset(presetId);
      // 同步更新本地 config，确保后续 refresh 读取到最新数据
      config.sceneApiPresets = config.sceneApiPresets.filter(p => p.id !== presetId);
      if (config.sceneDailyProfile.apiPresetId === presetId) {
        config.sceneDailyProfile.apiPresetId = '';
      }
      if (config.sceneNsfwProfile.apiPresetId === presetId) {
        config.sceneNsfwProfile.apiPresetId = '';
      }
      sceneCombo.reset(); // 删除预设：清空已加载模型列表 + 关浮层
      refreshSceneApiPresetSelect();
      refreshSceneApiPresetDropdowns();
      getToastr()?.success('已删除预设：' + preset.name, '场景对话 API 预设');
    });
  }

  // 应用当前预设：将当前填入的参数直接注入酒馆主连接
  const sapApplyBtn = document.getElementById('sceneApiPresetApplyBtn');
  if (sapApplyBtn) {
    sapApplyBtn.addEventListener('click', async function () {
      const fields = readSceneApiPresetFromFields();
      if (!fields.url || !fields.url.trim()) {
        getToastr()?.warning('请先填写 API URL', '应用预设');
        return;
      }
      if (!fields.model || !fields.model.trim()) {
        getToastr()?.warning('请先填写模型名', '应用预设');
        return;
      }
      const btn = this as HTMLButtonElement;
      const orig = btn.textContent;
      btn.textContent = '注入中...';
      btn.disabled = true;
      try {
        // 读取当前选中预设的 secretId（如果有）
        const currentSelectId = (document.getElementById('sceneApiPresetSelect') as HTMLSelectElement | null)?.value || '';
        const existingPreset = currentSelectId ? config.sceneApiPresets.find(p => p.id === currentSelectId) : null;
        await injectSceneApiDirectly({
          url: fields.url,
          model: fields.model,
          secretId: existingPreset?.secretId || '',
          bodyParams: fields.bodyParams || '',
          excludeBodyParams: fields.excludeBodyParams || '',
          customHeaders: fields.customHeaders || '',
          promptPostProcessing: fields.promptPostProcessing,
        });
        getToastr()?.success('已将当前参数注入酒馆主连接并重连', '应用成功');
      } catch (e) {
        getToastr()?.error((e as any)?.message || String(e), '应用失败');
      } finally {
        btn.textContent = orig;
        btn.disabled = false;
      }
    });
  }

  // 初始化：刷新档位预设下拉和摘要
  refreshSceneApiPresetDropdowns();

  // ===== 场景一键切换：事件绑定 =====

  // 填充提示词预设 datalist
  try {
    const presetNames = listPromptPresets();
    const datalist = document.getElementById('scenePromptPresetList');
    if (datalist) {
      datalist.innerHTML = '';
      for (const name of presetNames) {
        const opt = document.createElement('option');
        opt.value = name;
        datalist.appendChild(opt);
      }
    }
  } catch (e) { /* 静默 */ }

  // 总开关
  const sceneSwitchToggle = document.getElementById('sceneSwitchToggle');
  if (sceneSwitchToggle) {
    sceneSwitchToggle.addEventListener('click', function () {
      config.sceneSwitchEnabled = !config.sceneSwitchEnabled;
      setConfig('sceneSwitchEnabled', config.sceneSwitchEnabled);
      const btn = document.getElementById('sceneSwitchToggle');
      if (btn) btn.classList.toggle('on', config.sceneSwitchEnabled);
      const detail = document.getElementById('sceneSwitchDetail');
      if (detail) detail.style.display = config.sceneSwitchEnabled ? '' : 'none';
      notifyChanged()
    });
  }

  // 读取档位输入框，只包含 promptPreset / apiPresetId / regex 信息
  function readSceneProfileFromInputs(mode: 'daily' | 'nsfw'): SceneProfile {
    const getVal = (id: string): string => (document.getElementById(id) as HTMLInputElement | null)?.value || '';
    const switchRegex = (document.getElementById('scene' + mode + 'RegexToggle') as HTMLElement | null)?.classList.contains('on') ?? false;
    const apiPresetSelect = document.getElementById('scene' + mode + 'ApiPreset') as HTMLSelectElement | null;
    return {
      promptPresetName: getVal('scene' + mode + 'PromptPreset').trim(),
      apiPresetId: apiPresetSelect?.value || '',
      switchRegex,
      regexPresetId: getVal('scene' + mode + 'RegexPreset').trim(),
    };
  }

  function persistSceneProfile(mode: 'daily' | 'nsfw'): void {
    const profile = readSceneProfileFromInputs(mode);
    if (mode === 'daily') {
      config.sceneDailyProfile = profile;
      setConfig('sceneDailyProfile', profile);
    } else {
      config.sceneNsfwProfile = profile;
      setConfig('sceneNsfwProfile', profile);
    }
  }

  // 档位的 apiPresetId 变更后，刷新摘要显示
  function refreshScenePresetSummary(mode: 'daily' | 'nsfw'): void {
    const summary = document.getElementById('scene' + mode + 'PresetSummary');
    if (!summary) return;
    const profile = mode === 'daily' ? config.sceneDailyProfile : config.sceneNsfwProfile;
    const preset = profile.apiPresetId
      ? config.sceneApiPresets.find(p => p.id === profile.apiPresetId) || null
      : null;
    if (preset) {
      summary.style.display = '';
      summary.innerHTML = ubIcon('link') + ' ' + _escAttr(preset.url || '(无URL)') + '  ' + ubIcon('sparkle') + ' ' + _escAttr(preset.model || '(无模型)') + '  ' + ubIcon('key') + ' ' + (preset.secretId ? '已存入' : '未存入');
    } else {
      summary.style.display = 'none';
    }
  }

  // 刷新两个档位的预设下拉选项和摘要
  function refreshSceneApiPresetDropdowns(): void {
    (['daily', 'nsfw'] as const).forEach(function (mode) {
      const select = document.getElementById('scene' + mode + 'ApiPreset') as HTMLSelectElement | null;
      if (!select) return;
      const profile = mode === 'daily' ? config.sceneDailyProfile : config.sceneNsfwProfile;
      const currentId = profile.apiPresetId;
      select.innerHTML = '<option value="">- 不使用对话预设 -</option>';
      for (const p of config.sceneApiPresets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === currentId) opt.selected = true;
        select.appendChild(opt);
      }
      refreshScenePresetSummary(mode);
    });
  }

  // 为 daily / nsfw 两个档位绑定事件（仅 promptPreset + apiPreset 下拉 + regex）
  (['daily', 'nsfw'] as const).forEach(function (mode) {
    // 提示词预设
    const promptPreset = document.getElementById('scene' + mode + 'PromptPreset');
    if (promptPreset) promptPreset.addEventListener('change', function () { persistSceneProfile(mode); });

    // API 预设下拉
    const apiPreset = document.getElementById('scene' + mode + 'ApiPreset');
    if (apiPreset) {
      apiPreset.addEventListener('change', function () {
        persistSceneProfile(mode);
        refreshScenePresetSummary(mode);
      });
    }

    // 正则预设输入
    const regexPreset = document.getElementById('scene' + mode + 'RegexPreset');
    if (regexPreset) regexPreset.addEventListener('change', function () { persistSceneProfile(mode); });

    // 正则切换开关
    const regexToggle = document.getElementById('scene' + mode + 'RegexToggle');
    if (regexToggle) {
      regexToggle.addEventListener('click', function () {
        const on = !regexToggle.classList.contains('on');
        regexToggle.classList.toggle('on', on);
        const detail = document.getElementById('scene' + mode + 'RegexDetail');
        if (detail) detail.style.display = on ? '' : 'none';
        persistSceneProfile(mode);
      });
    }
  });

  // 当前激活档位标签刷新
  function refreshSceneCurrentLabel(): void {
    const label = document.getElementById('sceneCurrentLabel');
    if (label) label.textContent = config.sceneSwitchCurrent === 'nsfw' ? '瑟瑟' : config.sceneSwitchCurrent === 'daily' ? '日常' : '未激活';
  }

  // 应用档位
  async function runApplyScene(mode: 'daily' | 'nsfw', btnId: string): Promise<void> {
    persistSceneProfile(mode);
    const preErr = validateSceneProfile(mode);
    if (preErr) { getToastr()?.error(preErr, '场景切换'); return; }
    const btn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = '切换中...';
      try {
        await applyScene(mode);
        getToastr()?.success('已切换到「' + (mode === 'daily' ? '日常' : '瑟瑟') + '」，酒馆主连接已更新', '场景切换');
        refreshSceneCurrentLabel();
        notifyChanged()
      } catch (e) {
        getToastr()?.error((e as any)?.message || String(e), '场景切换失败');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    }
  }

  const sceneApplyDailyBtn = document.getElementById('sceneApplyDailyBtn');
  if (sceneApplyDailyBtn) sceneApplyDailyBtn.addEventListener('click', function () { void runApplyScene('daily', 'sceneApplyDailyBtn'); });
  const sceneApplyNsfwBtn = document.getElementById('sceneApplyNsfwBtn');
  if (sceneApplyNsfwBtn) sceneApplyNsfwBtn.addEventListener('click', function () { void runApplyScene('nsfw', 'sceneApplyNsfwBtn'); });
}
