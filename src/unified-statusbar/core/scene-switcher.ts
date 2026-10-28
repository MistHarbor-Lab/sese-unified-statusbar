import { getTavernHelper } from './env';
import { makeUniqueId } from './id';
// ===== 场景一键切换（日常 / 瑟瑟）=====
//
// 切换酒馆【主连接】的「提示词预设 + API 连接参数」。
// 与 core/api-config.ts 的 customApiPresets（仅服务状态栏自身 generateRaw）
// 互不影响：本模块改的是酒馆主聊天对所有聊天生效的连接。
//
// ⚠️ 重要：本项目是【前端界面 iframe】环境，@types/function/ 里的接口
//   （getPresetNames / loadPreset / triggerSlash 等）不是全局函数，
//   而是挂在 window.TavernHelper（或 window.parent.TavernHelper）上。
//   必须通过 getTavernHelper().xxx() 调用。
//
// 密钥与 API 预设仓库流程（用户不需要去酒馆原生面板操作）：
//   1. 在"API 预设仓库"区填入 API URL + 密钥 + 模型名 + 名称
//   2. 点"加载模型" → 调 getModelList（GET /v1/models 端点，只列模型名，不发聊天消息）
//      这与酒馆原生连接面板的"获取模型"按钮完全一致，是安全的
//      拉到模型列表 = 密钥有效；拉不到 = 密钥错或 URL 错
//   3. 点"保存密钥" → 调 /secret-write 直接存入酒馆秘钥系统，获得 secretId
//   4. 点"保存预设" → 整体入库（sceneApiPresets 数组），含 secretId
//   5. 在日常/瑟瑟档位里下拉选择已入库的 API 预设
//   6. 切换时用 /secret-id key=api_key_custom <secretId> 切换激活
//
// ⚠️ 绝不发送测试消息验证——很多 API 在接受测试消息后会直接封禁。
//
// 实现参考：tavern_resource-main/示例/tavern-helper-api-quick-switcher.import20.json

import { getConfig, setConfig } from './config-store';
import type { SceneProfile, SceneMode, SceneApiPreset } from './constants';

// —— SillyTavern / TavernHelper 访问（iframe 兼容写法）——
function getParentDoc(): Document {
  try { return (window.parent as any).document ?? document; } catch (e) { return document; }
}

// 获取 SillyTavern 上下文（含 chatCompletionSettings、SlashCommandParser、saveSettingsDebounced 等）。
// 参考 tavern-helper-api-quick-switcher 的 getTavernContext()：
//   const sillyTavern = window.SillyTavern || window.TavernHelper?.SillyTavern;
//   const context = typeof sillyTavern?.getContext === 'function' ? sillyTavern.getContext() : sillyTavern;
// chatCompletionSettings 在 context 上，不是直接在 SillyTavern 全局对象上。
function getSt(): any {
  let st: any = null;
  try {
    st = (window as any).SillyTavern
      || (window.parent as any).SillyTavern
      || (window as any).TavernHelper?.SillyTavern
      || (window.parent as any).TavernHelper?.SillyTavern;
  } catch (e) { /* cross-origin */ }
  if (!st) return null;
  // 优先用 getContext() 拿完整上下文（chatCompletionSettings 等在 context 上）
  if (typeof st.getContext === 'function') {
    try { return st.getContext(); } catch (e) { /* fall through */ }
  }
  return st;
}


function getJq(): any {
  try {
    if ((window.parent as any).jQuery) return (window.parent as any).jQuery;
    if ((window.parent as any).$) return (window.parent as any).$;
    if ((window as any).jQuery) return (window as any).jQuery;
    if ((window as any).$) return (window as any).$;
  } catch (e) { /* cross-origin */ }
  return null;
}

function getWindow(): Window {
  try { return (window.parent as any) ?? window; } catch (e) { return window; }
}

// 统一从 TavernHelper 取接口
function thFn(name: string): any {
  const th = getTavernHelper();
  const fn = th?.[name];
  return typeof fn === 'function' ? fn.bind(th) : null;
}

/** 列出可选提示词预设名（供设置面板下拉用） */
export function listPromptPresets(): string[] {
  const fn = thFn('getPresetNames');
  if (!fn) return [];
  try {
    const r = fn();
    return Array.isArray(r) ? r.map(String) : [];
  } catch (e) {
    console.warn('[场景切换] getPresetNames 调用失败:', e);
    return [];
  }
}

/** 检查酒馆助手接口是否可用 */
export function isTavernHelperAvailable(): boolean {
  return !!getTavernHelper();
}

/** 检查是否正在切换中 */
export function isSceneApplying(): boolean {
  return _isApplying;
}

// 重入闸门
let _isApplying = false;

// ══════════════════════════════════════════════════════════════
// 密钥管理：加载模型（安全验证）+ 存入酒馆秘钥系统
// ══════════════════════════════════════════════════════════════

/**
 * 加载模型列表（GET /v1/models 端点，只列模型名，不发聊天消息）。
 * 这与酒馆原生连接面板的"获取模型"按钮完全一致，是安全的验证方式。
 * 拉到模型列表 = 密钥有效；拉不到 = 密钥错或 URL 错。
 *
 * @returns 模型名数组；失败抛异常
 */
export async function fetchSceneModels(url: string, key: string): Promise<string[]> {
  const fn = thFn('getModelList');
  if (!fn) throw new Error('无法访问 getModelList 函数，请检查酒馆助手版本');
  const params: { apiurl: string; key?: string } = { apiurl: url.trim() };
  if (key) params.key = key;
  try {
    const models = await fn(params);
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error('未获取到模型列表（可能密钥无效或 URL 错误）');
    }
    return models;
  } catch (e) {
    throw new Error('加载模型失败：' + ((e as any)?.message || String(e)));
  }
}

/**
 * 将明文密钥直接存入酒馆秘钥系统，返回 secretId。
 * 调用 /secret-write key=api_key_custom label=<标签> <密钥值>
 * 不做任何验证——验证靠"加载模型"那一步（拉到模型=密钥对）。
 *
 * @param key 密钥值（明文）
 * @param label 密钥标签（如"日常密钥""瑟瑟密钥"）
 * @returns 新创建的 secretId；失败抛异常
 */
export async function saveSecretToTavern(key: string, label: string): Promise<string> {
  const trimmedKey = key.trim();
  if (!trimmedKey) throw new Error('密钥为空，无法保存');

  const trimmedLabel = label.trim() || ('场景切换_' + Date.now());

  // ⚠️ 不走 /secret-write 斜杠命令：斜杠命令解析器会对裸参数做宏替换
  // （substituteParams：{{user}}、{{char}}、| 命令分隔符、反斜杠转义等），
  // 一旦密钥里含这些字符就会被改写，导致「同样的密钥直接填没事、走预设就报错」。
  // 直接调酒馆后端 /api/secrets/write（与 writeSecret() 内部走的是同一个端点），
  // 密钥原样入库，不做任何解析。
  const st = getSt();
  const headers = st?.getRequestHeaders;
  if (typeof headers !== 'function') {
    throw new Error('无法访问 SillyTavern 请求头（getRequestHeaders），不能写入秘钥');
  }
  let resp: Response;
  try {
    resp = await fetch('/api/secrets/write', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ key: 'api_key_custom', value: trimmedKey, label: trimmedLabel }),
    });
  } catch (e) {
    throw new Error('写入酒馆秘钥系统网络错误：' + ((e as any)?.message || String(e)));
  }
  if (!resp.ok) {
    throw new Error('写入酒馆秘钥系统失败：HTTP ' + resp.status);
  }
  const data = await resp.json().catch(() => ({} as any));
  const secretId = String(data?.id ?? '').trim();
  if (!secretId) throw new Error('存入酒馆秘钥系统失败，未返回 secretId');
  return secretId;
}

// ══════════════════════════════════════════════════════════════
// 场景 API 预设仓库管理
// ══════════════════════════════════════════════════════════════

/** 生成场景 API 预设唯一标识 */
export function generateSceneApiPresetId(): string {
  return makeUniqueId('sap', 8, '_');
}

/** 从仓库中按 id 查找预设 */
export function findSceneApiPreset(id: string): SceneApiPreset | null {
  const cfg = getConfig();
  return cfg.sceneApiPresets.find(p => p.id === id) || null;
}

/**
 * 保存（创建或更新）一条场景 API 预设到仓库。
 * 若 id 已存在则更新，否则新建。
 * @returns 保存后的预设（含 id）
 */
export function saveSceneApiPreset(preset: Omit<SceneApiPreset, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): SceneApiPreset {
  const cfg = getConfig();
  const existingId = preset.id;
  if (existingId) {
    const idx = cfg.sceneApiPresets.findIndex(p => p.id === existingId);
    if (idx >= 0) {
      // 更新已有预设
      const updated: SceneApiPreset = {
        ...cfg.sceneApiPresets[idx],
        ...preset,
        id: existingId,
        createdAt: preset.createdAt || cfg.sceneApiPresets[idx].createdAt,
      };
      cfg.sceneApiPresets[idx] = updated;
      setConfig('sceneApiPresets', cfg.sceneApiPresets);
      return updated;
    }
  }
  // 新建
  const newPreset: SceneApiPreset = {
    ...preset,
    id: existingId || generateSceneApiPresetId(),
    createdAt: preset.createdAt || Date.now(),
  };
  cfg.sceneApiPresets.push(newPreset);
  setConfig('sceneApiPresets', cfg.sceneApiPresets);
  return newPreset;
}

/** 删除一条场景 API 预设；若档位正在引用则清空引用 */
export function deleteSceneApiPreset(id: string): void {
  const cfg = getConfig();
  cfg.sceneApiPresets = cfg.sceneApiPresets.filter(p => p.id !== id);
  setConfig('sceneApiPresets', cfg.sceneApiPresets);
  // 清理档位引用
  if (cfg.sceneDailyProfile.apiPresetId === id) {
    cfg.sceneDailyProfile.apiPresetId = '';
    setConfig('sceneDailyProfile', cfg.sceneDailyProfile);
  }
  if (cfg.sceneNsfwProfile.apiPresetId === id) {
    cfg.sceneNsfwProfile.apiPresetId = '';
    setConfig('sceneNsfwProfile', cfg.sceneNsfwProfile);
  }
}

// ══════════════════════════════════════════════════════════════
// 校验
// ══════════════════════════════════════════════════════════════

/** 校验档位是否可切换：返回错误提示字符串或 null */
export function validateSceneProfile(mode: SceneMode): string | null {
  const cfg = getConfig();
  const profile = mode === 'daily' ? cfg.sceneDailyProfile : cfg.sceneNsfwProfile;
  if (!profile.apiPresetId) return '该档位未绑定 API 预设，请到设置中选择';
  const api = findSceneApiPreset(profile.apiPresetId);
  if (!api) return '绑定的 API 预设已被删除，请到设置中重新选择';
  if (!api.url || !api.url.trim()) return '绑定的 API 预设缺少 URL，请先在下方编辑补全';
  if (!api.model || !api.model.trim()) return '绑定的 API 预设缺少模型名，请先在下方编辑补全';
  if (profile.switchRegex && !profile.regexPresetId.trim()) return '已启用正则切换但未填写正则预设 id/名称';
  return null;
}

// ══════════════════════════════════════════════════════════════
// 主连接注入
// ══════════════════════════════════════════════════════════════

/** 给原生控件赋值并触发 jQuery 事件 */
function setNativeControl(selector: string, value: string, event: string = 'input'): void {
  const doc = getParentDoc();
  const el = doc.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null;
  if (!el) throw new Error('找不到原生控件：' + selector);
  (el as any).value = value;
  const jq = getJq();
  if (typeof jq === 'function') {
    try { jq(el).trigger(event); } catch (e) { /* ignore */ }
  } else {
    try { el.dispatchEvent(new (getWindow() as any).Event(event, { bubbles: true })); } catch (e) { /* ignore */ }
  }
}

/**
 * 清空 #api_key_custom 输入框并触发 input 事件。
 *
 * ⚠️ 关键修复：酒馆点击「连接」按钮（#api_button_openai → onConnectButtonClick）时，
 * 会读取 #api_key_custom 输入框的值，若非空就调 writeSecret() 把它覆盖成「当前激活密钥」
 * （见 SillyTavern openai.js onConnectButtonClick）。本模块的注入流程只设置 URL/模型、
 * 通过 /secret-id 切换激活密钥，从不写 #api_key_custom；因此该输入框里残留的是用户上次
 * 手动填的（可能是另一把）密钥，或为空。
 *   - 残留别的密钥 → 连接时被 writeSecret 覆盖激活密钥 → 鉴权失败（"有时报错"的根因）
 *   - 为空 → 不覆盖，/secret-id 切换的密钥生效 → 正常
 * 切换前主动清空，让两条路径都走「输入框为空」的成功分支。
 */
function clearCustomApiKeyInput(): void {
  try { setNativeControl('#api_key_custom', '', 'input'); } catch (e) { /* 控件不存在则忽略 */ }
}

/** 把一组 custom 源连接参数写入酒馆 chatCompletionSettings（不含重连与断言）。 */
function applyCustomApiSettings(
  settings: any,
  api: { url: string; model: string; bodyParams?: string; excludeBodyParams?: string; customHeaders?: string; promptPostProcessing?: string },
): void {
  settings.chat_completion_source = 'custom';
  settings.custom_url = api.url.trim();
  settings.custom_model = api.model.trim();
  try { setNativeControl('#chat_completion_source', 'custom', 'change'); } catch (e) { /* 非致命 */ }
  try { setNativeControl('#custom_api_url_text', api.url.trim(), 'input'); } catch (e) { /* 非致命 */ }
  try { setNativeControl('#custom_model_id', api.model.trim(), 'input'); } catch (e) { /* 非致命 */ }

  // 附加参数：主体参数 / 排除参数 / 自定义请求头
  if (api.bodyParams && api.bodyParams.trim()) {
    settings.custom_include_body = api.bodyParams.trim();
  } else {
    delete settings.custom_include_body;
  }
  if (api.excludeBodyParams && api.excludeBodyParams.trim()) {
    settings.custom_exclude_body = api.excludeBodyParams.trim();
  } else {
    delete settings.custom_exclude_body;
  }
  if (api.customHeaders && api.customHeaders.trim()) {
    settings.custom_include_headers = api.customHeaders.trim();
  } else {
    delete settings.custom_include_headers;
  }
  // 提示词后处理方式（对应酒馆 custom_prompt_post_processing / /prompt-post-processing）
  if (api.promptPostProcessing) {
    settings.custom_prompt_post_processing = api.promptPostProcessing;
  } else {
    delete settings.custom_prompt_post_processing;
  }
  try { getSt()?.saveSettingsDebounced?.(); } catch (e) { /* 非致命 */ }
}

/** 切密钥引用 + 清 #api_key_custom + 触发重连 + 断言 custom 已生效。 */
async function triggerCustomApiReconnect(
  settings: any,
  secretId: string,
  expectedUrl: string,
  expectedModel: string,
): Promise<void> {
  const doc = getParentDoc();
  const triggerSlash = thFn('triggerSlash');

  // 切密钥引用（用存入酒馆时获得的 secretId）
  if (secretId && secretId.trim() && triggerSlash) {
    try {
      await triggerSlash('/secret-id key=api_key_custom ' + secretId.trim());
    } catch (e) {
      console.warn('[场景切换] 密钥引用切换失败，可能 secretId 无效：', e);
    }
  }

  // 清空 #api_key_custom 输入框：见 clearCustomApiKeyInput 注释。
  // 必须在点击重连按钮之前做，否则 onConnectButtonClick 会用残留值覆盖刚切好的激活密钥。
  clearCustomApiKeyInput();

  // 触发重连
  const win = getWindow();
  const btn = doc.querySelector('#api_button_openai') as HTMLElement | null;
  if (btn) {
    try { btn.dispatchEvent(new (win as any).MouseEvent('click', { bubbles: true, cancelable: true, view: win })); } catch (e) { /* 非致命 */ }
  }

  // 断言
  const actualSource = String(settings.chat_completion_source || '').trim();
  const actualUrl = String(settings.custom_url || '').trim();
  const actualModel = String(settings.custom_model || '').trim();
  if (actualSource !== 'custom') {
    throw new Error('切换失败：当前 source 仍是 ' + (actualSource || '空') + '（预期 custom）');
  }
  if (actualUrl !== expectedUrl.trim()) {
    throw new Error('切换失败：当前 API 地址仍是 ' + (actualUrl || '空'));
  }
  if (actualModel !== expectedModel.trim()) {
    throw new Error('切换失败：当前模型仍是 ' + (actualModel || '空'));
  }
}

/**
 * 把一组 API 连接参数注入酒馆主连接（仅支持 Custom OpenAI 兼容源）。
 */
async function injectMainApi(profile: SceneProfile): Promise<void> {
  const st = getSt();
  if (!st?.chatCompletionSettings) {
    throw new Error('无法访问 SillyTavern 连接设置（window.SillyTavern.chatCompletionSettings）');
  }
  // 解析档位引用的 API 预设
  const api = findSceneApiPreset(profile.apiPresetId);
  if (!api) throw new Error('绑定的 API 预设已被删除');

  const settings = st.chatCompletionSettings;
  const doc = getParentDoc();
  const triggerSlash = thFn('triggerSlash');
  const loadPresetFn = thFn('loadPreset');

  // 1. 确保主 API = Chat Completion（'openai'）
  const mainApiEl = doc.querySelector('#main_api') as HTMLSelectElement | null;
  if (mainApiEl && mainApiEl.value !== 'openai') {
    setNativeControl('#main_api', 'openai', 'change');
  }

  // 2. 切提示词预设
  if (profile.promptPresetName && profile.promptPresetName.trim()) {
    const presetName = profile.promptPresetName.trim();
    let ok = false;
    if (loadPresetFn) {
      try { ok = !!loadPresetFn(presetName); } catch (e) { /* fall through to slash */ }
    }
    if (!ok && triggerSlash) {
      try { await triggerSlash('/preset ' + presetName); } catch (e) { /* ignore */ }
    }
  }

  // 3. 切到 Custom 源并写入 URL / 模型 + 附加参数
  applyCustomApiSettings(settings, api);

  // 4-6. 切密钥 + 清输入 + 重连 + 断言
  await triggerCustomApiReconnect(settings, api.secretId, api.url, api.model);

  // 7. 可选：切正则预设
  if (profile.switchRegex && profile.regexPresetId && profile.regexPresetId.trim() && triggerSlash) {
    try { await triggerSlash('/regex-preset ' + profile.regexPresetId.trim()); } catch (e) { console.warn('[场景切换] 正则切换失败：', e); }
  }
}

/** 应用某个场景档位 */
export async function applyScene(mode: SceneMode): Promise<void> {
  if (_isApplying) throw new Error('正在切换中，请稍候');
  if (!getTavernHelper()) {
    throw new Error('无法访问酒馆助手接口（window.TavernHelper）');
  }
  const err = validateSceneProfile(mode);
  if (err) throw new Error(err);
  const cfg = getConfig();
  const profile = mode === 'daily' ? cfg.sceneDailyProfile : cfg.sceneNsfwProfile;

  _isApplying = true;
  try {
    await injectMainApi(profile);
    setConfig('sceneSwitchCurrent', mode);
    // 成就打点：场景切换成功
    try { (window as any).__ubEmitAchievement?.('scene_switch', {}); } catch (_e) { /* ignore */ }
  } finally {
    _isApplying = false;
  }
}

/**
 * 直接将 API 参数注入酒馆主连接（无需先保存为预设）。
 * 用于「应用当前预设」按钮：在预设仓库编辑区填写参数后直接注入测试。
 */
export async function injectSceneApiDirectly(params: {
  url: string;
  model: string;
  secretId: string;
  bodyParams: string;
  excludeBodyParams: string;
  customHeaders: string;
  promptPostProcessing: string;
}): Promise<void> {
  const st = getSt();
  if (!st?.chatCompletionSettings) {
    throw new Error('无法访问 SillyTavern 连接设置（window.SillyTavern.chatCompletionSettings）');
  }

  const settings = st.chatCompletionSettings;
  const doc = getParentDoc();

  // 1. 确保主 API = Chat Completion（'openai'）
  const mainApiEl = doc.querySelector('#main_api') as HTMLSelectElement | null;
  if (mainApiEl && mainApiEl.value !== 'openai') {
    setNativeControl('#main_api', 'openai', 'change');
  }

  // 2. 切到 Custom 源并写入 URL / 模型 + 附加参数
  applyCustomApiSettings(settings, params);

  // 3-6. 切密钥 + 清输入 + 重连 + 断言
  await triggerCustomApiReconnect(settings, params.secretId, params.url, params.model);
}
