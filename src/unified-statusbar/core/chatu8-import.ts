// ===== 从智慧姬（st-chatu8）导入预设 =====
// 用途：把智慧姬当前模式的「预设库 + 全局出图参数」搬进本项目，生成一份**在本项目内完整**的
// 画风预设（前后缀/负面/模型/采样参数），供**切回内置直连**时复现智慧姬的配置。
// 数据来源：extensionSettings['st-chatu8']（core/chatu8-bridge 只读访问）。
//
// 读取口径（与方案 §6 一致）：
//   · 可靠项（字段名已核对插件源码，明文）：模式 mode、模型 novelaimode / banana.model、
//     预设库 yushe[ yusheid_<模式> ] 的 fixedPrompt / fixedPrompt_end / negativePrompt。
//   · NovelAI 参数（键名已双向核实）：插件面板字段 id＝存储键名（html/settings/novelai.html），
//     并经混淆产物字符串表解码复核其在请求体里的落点——
//       novelai_steps→steps / nai3Scale→scale(CFG) / novelai_sampler→sampler / Schedule→noise_schedule /
//       cfg_rescale→cfg_rescale / sm→sm / dyn→sm_dyn / nai3Deceisp→dynamic_thresholding /
//       novelai_seed→seed / novelai_width|novelai_height→width|height（本项目尺寸属任务设置，不导入）。
//     三项智慧姬在代码里**写死**、设置里读不到：ucPreset 恒 3、autoSmea 恒 false、qualityToggle 按模型/
//     分角色路径写死（此处按用户可见的「正面质量预设 AQT」开关折算）；均在结果里注明。
//   · 尽力项（无版本契约，键名核对过但插件升级可能改）：ComfyUI 面板字段（MODEL_NAME、comfyui_steps 等）。
//     匹配不到/歧义/超域一律跳过并在结果里明示——不猜、不硬失败。
//   · 智慧姬运行期的提示词加工（删全角注释、逗号去重、AQT/UCP 组装等）是代码不是设置，读不到。
import type { PortraitPromptPreset } from './portrait-config';
import {
  NOVELAI_SAMPLERS, NOVELAI_SCHEDULERS,
  buildPresetNovelAiParamsFrom, buildPresetComfyUiParamsFrom,
  getDefaultNovelAiConfig, getDefaultComfyUiConfig, getDefaultPromptPresets,
} from './portrait-config';
import { getChatu8BackendModel, getChatu8Mode, getChatu8Settings, chatu8ModeLabel } from './chatu8-bridge';

export interface Chatu8ImportOutcome {
  ok: boolean;
  error?: string;
  /** 生成的预设（不落盘；调用方决定写入与绑定）。 */
  preset?: PortraitPromptPreset;
  /** 已导入项（人类可读，如「步数 28」）。 */
  imported: string[];
  /** 未导入项（跳过／不可搬运，均写明原因）。 */
  skipped: string[];
  modeLabel: string;
}

type NaiParams = NonNullable<PortraitPromptPreset['novelai']>;
type ComfyParams = NonNullable<PortraitPromptPreset['comfyui']>;

interface FieldRead {
  /** 本项目预设切片字段。 */
  field: string;
  /** 展示名（与智慧姬面板措辞对齐，便于对照）。 */
  label: string;
  /** 解析成功时的展示文本。 */
  display: string;
  value: unknown;
}

interface FieldSkip { label: string; reason: string }

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function boolOf(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function textOf(v: unknown): string {
  return typeof v === 'string' ? v.trim() : (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
}

/** 智慧姬里数值设置多为字符串，取值域校验防误读其他功能的同名键。 */
function readNum(
  settings: Record<string, any>, key: string, min: number, max: number, integer = false,
): number | null {
  const n = num(settings[key]);
  if (n === null || n < min || n > max) return null;
  return integer ? Math.round(n) : n;
}

function readBool(settings: Record<string, any>, key: string): boolean | null {
  return key in settings ? boolOf(settings[key]) : null;
}

/** 采样器/噪点表：必须落在本项目枚举里（写进去才选得出来）。 */
function readEnum(settings: Record<string, any>, key: string, ids: string[]): string | null {
  const v = textOf(settings[key]);
  return v && ids.indexOf(v) >= 0 ? v : null;
}

/** NovelAI 数值/开关字段（键名已核实；顺序即结果列表顺序）。 */
function readNaiFields(settings: Record<string, any>): { reads: FieldRead[]; skips: FieldSkip[] } {
  const reads: FieldRead[] = [];
  const skips: FieldSkip[] = [];
  /** 上限：本项目预设步数上限 60（超出按 60 导入并注明）。 */
  const stepsRaw = readNum(settings, 'novelai_steps', 1, 150, true);
  if (stepsRaw === null) skips.push({ label: '步数', reason: '未识别键名 novelai_steps / 取值超域' });
  else if (stepsRaw > 60) reads.push({ field: 'steps', label: '步数', value: 60, display: `${stepsRaw} → 60（本项目上限 60）` });
  else reads.push({ field: 'steps', label: '步数', value: stepsRaw, display: String(stepsRaw) });

  const cfg = readNum(settings, 'nai3Scale', 0, 30);
  if (cfg === null) skips.push({ label: 'CFG', reason: '未识别键名 nai3Scale / 取值超域' });
  else reads.push({ field: 'cfg', label: 'CFG（Prompt Guidance）', value: cfg, display: String(cfg) });

  const sampler = readEnum(settings, 'novelai_sampler', NOVELAI_SAMPLERS.map(s => s.id));
  if (sampler === null) skips.push({ label: '采样器', reason: '未识别键名 novelai_sampler / 值不在本项目采样器表内' });
  else reads.push({ field: 'sampler', label: '采样器', value: sampler, display: sampler });

  const scheduler = readEnum(settings, 'Schedule', NOVELAI_SCHEDULERS.map(s => s.id));
  if (scheduler === null) skips.push({ label: 'Scheduler', reason: '未识别键名 Schedule / 值不在本项目噪点表内' });
  else reads.push({ field: 'scheduler', label: 'Scheduler（噪点表）', value: scheduler, display: scheduler });

  const cfgRescale = readNum(settings, 'cfg_rescale', 0, 1);
  if (cfgRescale === null) skips.push({ label: 'cfgRescale', reason: '未识别键名 cfg_rescale / 取值超域' });
  else reads.push({ field: 'cfgRescale', label: 'cfgRescale（Prompt Guidance Rescale）', value: cfgRescale, display: String(cfgRescale) });

  // 种子：智慧姬把 '0' / '' / '-1' 都当随机（运行时现取随机数）——按本项目的 -1 表达同一语义
  const seedRaw = textOf(settings['novelai_seed']);
  const seedNum = num(settings['novelai_seed']);
  if (seedNum === null) skips.push({ label: 'Seed', reason: '未识别键名 novelai_seed / 取值超域' });
  else if (seedRaw === '' || seedRaw === '0' || seedRaw === '-1') reads.push({ field: 'seed', label: 'Seed', value: -1, display: '随机（智慧姬 0/-1 即随机）' });
  else reads.push({ field: 'seed', label: 'Seed', value: Math.min(Math.max(Math.round(seedNum), 0), 4294967295), display: String(Math.round(seedNum)) });

  const sm = readBool(settings, 'sm');
  if (sm === null) skips.push({ label: 'SMEA', reason: '未识别键名 sm / 取值超域' });
  else reads.push({ field: 'sm', label: 'SMEA', value: sm, display: sm ? '开' : '关' });

  const dyn = readBool(settings, 'dyn');
  if (dyn === null) skips.push({ label: 'SMEA DYN', reason: '未识别键名 dyn / 取值超域' });
  else reads.push({ field: 'smDyn', label: 'SMEA DYN', value: sm === false ? false : dyn, display: sm === false ? '关（智慧姬口径：SMEA 关时强制关）' : (dyn ? '开' : '关') });

  const decrisper = readBool(settings, 'nai3Deceisp');
  if (decrisper === null) skips.push({ label: '减少伪影(Decrisp)', reason: '未识别键名 nai3Deceisp / 取值超域' });
  else reads.push({ field: 'decrisper', label: '减少伪影（Decrisp）', value: decrisper, display: decrisper ? '开' : '关' });

  return { reads, skips };
}

/** 读取智慧姬当前的预设库条目（fixedPrompt / fixedPrompt_end / negativePrompt）。 */
function readChatu8Yushe(settings: Record<string, any>, mode: string): { fixedPrompt: string; fixedPromptEnd: string; negativePrompt: string; presetId: string } {
  const raw = settings?.yushe && typeof settings.yushe === 'object' ? settings.yushe as Record<string, any> : {};
  const idKey = `yusheid_${mode}`;
  const candidateIds: string[] = [];
  const chosen = typeof settings[idKey] === 'string' ? String(settings[idKey]) : '';
  if (chosen) candidateIds.push(chosen);
  // 兜底：模式 id 未命中时用第一个条目（避免整功能不可用；结果里以「预设 id」明示改用了哪个）
  for (const key of Object.keys(raw)) if (!candidateIds.includes(key)) candidateIds.push(key);
  for (const id of candidateIds) {
    const entry = raw[id];
    if (entry && typeof entry === 'object') {
      return {
        fixedPrompt: typeof entry.fixedPrompt === 'string' ? entry.fixedPrompt : '',
        fixedPromptEnd: typeof entry.fixedPrompt_end === 'string' ? entry.fixedPrompt_end : '',
        negativePrompt: typeof entry.negativePrompt === 'string' ? entry.negativePrompt : '',
        presetId: id,
      };
    }
  }
  return { fixedPrompt: '', fixedPromptEnd: '', negativePrompt: '', presetId: '' };
}

/** 组装导入结果（纯函数：不做配置写入，便于测试）。 */
export function buildPresetFromChatu8(settingsRaw: unknown, presetName: string): Chatu8ImportOutcome {
  const settings = settingsRaw && typeof settingsRaw === 'object' ? settingsRaw as Record<string, any> : null;
  if (!settings) return { ok: false, error: '没找到智慧姬插件（st-chatu8）的设置', imported: [], skipped: [], modeLabel: '' };
  const mode = typeof settings.mode === 'string' ? settings.mode : '';
  if (!mode) return { ok: false, error: '智慧姬还没选生图模式，无法导入', imported: [], skipped: [], modeLabel: '' };
  const modeLabel = chatu8ModeLabel(mode);

  const imported: string[] = [];
  const skipped: string[] = [];
  const preset: PortraitPromptPreset = {
    ...getDefaultPromptPresets()[0],
    id: '',
    name: presetName,
    promptPrefix: '',
    promptSuffix: '',
    negativePrompt: '',
    useDefaultNegative: true,
  };

  const yushe = readChatu8Yushe(settings, mode);
  const hasYushe = !!(yushe.fixedPrompt.trim() || yushe.fixedPromptEnd.trim() || yushe.negativePrompt.trim());
  if (hasYushe) {
    preset.promptPrefix = yushe.fixedPrompt.trim();
    preset.promptSuffix = yushe.fixedPromptEnd.trim();
    preset.negativePrompt = yushe.negativePrompt.trim();
    imported.push(`预设「${yushe.presetId || '(未命名)'}」：正向前缀 / 正向后缀 / 负面预设`);
  } else {
    skipped.push('预设库（yushe 内没有该模式的条目）');
  }

  if (mode === 'novelai') {
    const model = textOf(settings.novelaimode);
    const base = buildPresetNovelAiParamsFrom(getDefaultNovelAiConfig());
    const nai: NaiParams = { ...base, model: model || base.model };
    if (model) imported.push(`模型 ${model}`); else skipped.push('模型（novelaimode 为空）');

    const { reads, skips } = readNaiFields(settings);
    for (const r of reads) { (nai as unknown as Record<string, unknown>)[r.field] = r.value; }
    for (const s of skips) skipped.push(`${s.label}（${s.reason}）`);
    for (const r of reads) imported.push(`${r.label} ${r.display}`);

    // 智慧姬在代码里写死、设置里没有对应项的三项：按它实际发出的值导入并注明
    nai.ucPreset = 3;
    imported.push('UC Preset 3（智慧姬写死该项：始终 3=关闭）');
    nai.autoSmea = false;
    imported.push('自动 SMEA 关（智慧姬写死该项：始终 false）');
    // Quality Toggle：智慧姬请求体里按模型/分角色路径写死，用户可见的开关是「正面质量预设（AQT_novelai）」
    const aqt = textOf(settings.AQT_novelai);
    nai.qualityToggle = aqt !== '';
    imported.push(aqt !== ''
      ? 'Quality Toggle 开（跟随智慧姬「正面质量预设」已启用；质量词本身用本项目内置文本）'
      : 'Quality Toggle 关（智慧姬「正面质量预设」为空=禁用）');

    // 尺寸/多样性/UCP 三项读得到但没有对应落点，明示原因
    const w = readNum(settings, 'novelai_width', 64, 4096, true);
    const h = readNum(settings, 'novelai_height', 64, 4096, true);
    if (w !== null && h !== null) skipped.push(`尺寸 ${w}×${h}（本项目宽高属「任务设置」，不随预设导入）`);
    else skipped.push('尺寸（未识别键名 novelai_width/novelai_height / 取值超域）');
    if (readBool(settings, 'nai3Variety') !== null) skipped.push('多样性 Variety（本项目按尺寸与模型在运行期算 variety 阈值，无对应开关）');
    const ucp = textOf(settings.UCP_novelai);
    if (ucp) skipped.push(`负面质量预设 UCP=${ucp}（智慧姬按模型在运行期拼负面词；本项目走预设「默认负面提示词」开关+内置词）`);

    preset.novelai = nai;
  } else if (mode === 'banana') {
    const model = settings.banana && typeof settings.banana.model === 'string' ? settings.banana.model.trim() : '';
    preset.openai = { model: model || '' };
    if (model) imported.push(`模型 ${model}`); else skipped.push('模型（banana.model 为空）');
    // Banana 走 OpenAI 兼容通道：无采样参数可导入
    skipped.push('参数导入（Banana 走 OpenAI 兼容通道，无采样参数可导入）');
  } else if (mode === 'comfyui') {
    // 尽力项：键名已核对插件 comfyui 面板（插件升级可能改；读不到就跳过并写明）
    const base = buildPresetComfyUiParamsFrom(getDefaultComfyUiConfig());
    const comfy: ComfyParams = { ...base };
    const readEnumField = (field: 'model' | 'sampler' | 'scheduler' | 'vae' | 'clip', key: string, label: string): void => {
      const v = textOf(settings[key]);
      if (v) { comfy[field] = v; imported.push(`${label} ${v}`); } else skipped.push(`${label}（${key} 为空/未识别）`);
    };
    readEnumField('model', 'MODEL_NAME', '模型（Checkpoint）');
    readEnumField('sampler', 'comfyuisamplerName', '采样器');
    readEnumField('scheduler', 'comfyui_scheduler', '调度器');
    readEnumField('vae', 'comfyui_vae', 'VAE');
    readEnumField('clip', 'comfyuiCLIPName', 'CLIP');
    const steps = readNum(settings, 'comfyui_steps', 1, 150, true);
    if (steps !== null) { comfy.steps = steps; imported.push(`步数 ${steps}`); } else skipped.push('步数（未识别键名 comfyui_steps / 取值超域）');
    const cfg = readNum(settings, 'cfg_comfyui', 0, 50);
    if (cfg !== null) { comfy.cfg = cfg; imported.push(`CFG ${cfg}`); } else skipped.push('CFG（未识别键名 cfg_comfyui / 取值超域）');
    const seed = num(settings['comfyui_seed']);
    if (seed !== null) { comfy.seed = Math.round(seed); imported.push(`Seed ${Math.round(seed)}`); } else skipped.push('Seed（未识别键名 comfyui_seed / 取值超域）');
    skipped.push('LoRA（智慧姬把 LoRA 写在 ComfyUI 工作流 JSON 里，无独立设置项）');
    preset.comfyui = comfy;
  } else {
    skipped.push(`参数导入（本项目没有 ${modeLabel} 供应商通道，参数无处安放；本期仅导入预设与模型）`);
  }

  return { ok: true, preset, imported, skipped, modeLabel };
}

/** 读取本机智慧姬设置并组装导入结果（不写配置）。 */
export function readChatu8Import(): Chatu8ImportOutcome {
  let settings: Record<string, any> | null = null;
  try { settings = getChatu8Settings(); } catch (_e) { settings = null; }
  if (!settings) return { ok: false, error: '没找到智慧姬插件（st-chatu8），请先在酒馆里装好并配置', imported: [], skipped: [], modeLabel: '' };
  const mode = getChatu8Mode();
  const stamp = new Date();
  const date = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}`;
  const name = `智慧姬导入 · ${chatu8ModeLabel(mode)} · ${date}`;
  return buildPresetFromChatu8(settings, name);
}

/** 当前模型（结果弹窗里展示用；读不到给空串）。 */
export function chatu8CurrentModelLabel(): string {
  try { return getChatu8BackendModel() || ''; } catch (_e) { return ''; }
}
