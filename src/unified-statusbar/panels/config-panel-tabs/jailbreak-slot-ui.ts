// panels/config-panel-tabs/jailbreak-slot-ui.ts
// 「破限提示词」板块的槽位编辑器：破限头 / 尾部破限 同构两槽位（一套实现渲染两遍）。
// - 三档模式：默认（项目内置）/ 空（不发送）/ 自定义（多段，逐段带身份）
// - 预设：保存为预设 / 更新当前 / 删除 / 导入 / 导出（导入导出走 core/jailbreak-presets 纯函数）
// - 事件用容器委托（视图重绘天然生效；勿改成一次性 addEventListener——列表是动态渲染的）
// 段落身份用「下标」而非 id：JailbreakSegment 只有 {role,text}（数据模型不为 UI 加字段），
// 列表每次结构性变更整体重绘，下标即当前视图的真实位置。
// 取值与拼装见 core/jailbreak-config；数据校验见 core/jailbreak-presets；本模块只负责 UI 与落盘。
import { getConfig, setConfig, type StatusBarConfig } from '../../core/config-store';
import { getToastr } from '../../core/env';
import { showConfirmDialog, showPromptDialog } from '../../renderers/confirm-dialog';
import { generatePresetId } from '../../core/api-config';
import { triggerBlobDownload } from '../../core/zip-store';
import { escAttr } from '../config-panel-shared';
import {
  JAILBREAK_SYSTEM_PROMPT,
  TAIL_JAILBREAK_PROMPT,
  createJailbreakSlotState,
  type JailbreakPreset,
  type JailbreakSegment,
  type JailbreakSegmentRole,
  type JailbreakSlotMode,
  type JailbreakSlotState,
} from '../../core/constants';
import {
  activeJailbreakSegments,
  buildJailbreakPresetExport,
  hasActiveJailbreakSegments,
  jailbreakPresetExportFilename,
  listPresetNameConflicts,
  mergeJailbreakPresets,
  parseJailbreakPresetImport,
  type ParsedJailbreakPresetImport,
} from '../../core/jailbreak-presets';

type SlotKey = 'head' | 'tail';

const TOAST_TITLE = '破限提示词';
const SLOT_KEYS: SlotKey[] = ['head', 'tail'];

interface SlotMeta {
  title: string;
  pos: string;
  builtinLabel: string;
  builtinText: string;
}

const SLOT_META: Record<SlotKey, SlotMeta> = {
  head: {
    title: '破限头',
    pos: '请求最上端',
    builtinLabel: '项目内置破限（JAILBREAK_SYSTEM_PROMPT）',
    builtinText: JAILBREAK_SYSTEM_PROMPT,
  },
  tail: {
    title: '尾部破限',
    pos: '请求最下端',
    builtinLabel: '项目内置尾部破限（原「反截断」原文）',
    builtinText: TAIL_JAILBREAK_PROMPT,
  },
};

const MODE_OPTIONS: Array<{ value: JailbreakSlotMode; label: string; tip: string }> = [
  { value: 'default', label: '默认（项目内置）', tip: '用项目内置内容；随项目升级更新' },
  { value: 'none', label: '空（不发送）', tip: '该端不发送任何内容（相当于关掉这一端）' },
  { value: 'custom', label: '自定义', tip: '用你自己的段落列表；每段可指定身份（系统/用户/助手）' },
];

const ROLE_LABELS: Record<JailbreakSegmentRole, string> = {
  system: '系统',
  user: '用户',
  assistant: '助手',
};
const ROLE_ORDER: JailbreakSegmentRole[] = ['system', 'user', 'assistant'];

/** 段数软上限（只提示不拦；防误操作刷出几十段白烧 token） */
const SEGMENT_SOFT_LIMIT = 12;

/** 导入待确认态（用户点了导入、还没选覆盖/跳过时暂存；按槽位键） */
const pendingImport: Partial<Record<SlotKey, ParsedJailbreakPresetImport>> = {};

/** 槽位状态：一律实时读 getConfig()——面板持有的 config 是快照，setConfig 只改缓存，快照会过期。
 *  （读取侧已归一（core/jailbreak-presets.normalizeJailbreakSlotState），此处只兜底字段缺失。） */
function slotState(slot: SlotKey, snapshot?: StatusBarConfig): JailbreakSlotState {
  const cfg = snapshot || getConfig();
  const raw = slot === 'head' ? cfg.jailbreakHead : cfg.jailbreakTail;
  return raw || createJailbreakSlotState();
}

function persistSlot(slot: SlotKey, next: JailbreakSlotState): void {
  setConfig(slot === 'head' ? 'jailbreakHead' : 'jailbreakTail', next);
}

/** 段落复制（切预设/落盘一律新对象，绝不共享引用） */
function cloneSegments(segments: readonly JailbreakSegment[]): JailbreakSegment[] {
  return segments.map(seg => ({ role: seg.role, text: seg.text }));
}

function slotHost(slot: SlotKey): HTMLElement | null {
  return document.getElementById(slot === 'head' ? 'jbSlotHead' : 'jbSlotTail');
}

/* ============================ 渲染 ============================ */

function renderSegments(state: JailbreakSlotState): string {
  if (state.segments.length === 0) {
    return '<div class="jb-note">当前没有任何段落。点下方「＋ 添加段落」开始写，或切回「默认」用内置内容。</div>';
  }
  return state.segments.map((seg, i) => (
    '<div class="jb-seg-card" data-role="' + seg.role + '" data-jb-idx="' + i + '">'
    + '<div class="jb-seg-bar">'
    + '<span class="jb-seg-idx">' + (i + 1) + '</span>'
    + ROLE_ORDER.map(role => '<button class="settings-btn jb-rchip' + (seg.role === role ? ' seg-active' : '')
      + '" data-jb-act="role" data-jb-idx="' + i + '" data-jb-val="' + role + '"'
      + ' title="' + escAttr(ROLE_LABELS[role] + '（' + role + '）') + '">' + ROLE_LABELS[role] + '</button>').join('')
    + '<span class="spacer"></span>'
    + '<button class="settings-btn jb-icon-btn" data-jb-act="up" data-jb-idx="' + i + '"' + (i === 0 ? ' disabled' : '') + ' title="上移">▲</button>'
    + '<button class="settings-btn jb-icon-btn" data-jb-act="down" data-jb-idx="' + i + '"' + (i === state.segments.length - 1 ? ' disabled' : '') + ' title="下移">▼</button>'
    + '<button class="settings-btn jb-icon-btn" data-jb-act="del" data-jb-idx="' + i + '" title="删除本段">✕</button>'
    + '</div>'
    + '<textarea rows="' + Math.min(6, Math.max(2, Math.ceil(seg.text.length / 90))) + '" data-jb-act="text" data-jb-idx="' + i + '" placeholder="本段内容…">' + escAttr(seg.text) + '</textarea>'
    + '<div class="jb-seg-foot"><span>' + ROLE_LABELS[seg.role] + '（' + seg.role + '）· ' + seg.text.length + ' 字符</span></div>'
    + '</div>'
  )).join('');
}

function renderPresetRow(state: JailbreakSlotState): string {
  const options = ['<option value=""' + (state.presetId === '' ? ' selected' : '') + '>（未保存的临时编辑）</option>']
    .concat(state.presets.map(p => '<option value="' + escAttr(p.id) + '"' + (state.presetId === p.id ? ' selected' : '') + '>' + escAttr(p.name) + '</option>'));
  const hasPreset = state.presetId !== '';
  return '<div class="jb-row">'
    + '<select data-jb-act="preset-select">' + options.join('') + '</select>'
    + '<button class="settings-btn" data-jb-act="preset-save">保存为预设</button>'
    + '<button class="settings-btn" data-jb-act="preset-update"' + (hasPreset ? '' : ' disabled') + '>更新当前</button>'
    + '<button class="settings-btn" data-jb-act="preset-delete"' + (hasPreset ? '' : ' disabled') + '>删除</button>'
    + '</div>'
    + '<div class="jb-row">'
    + '<button class="settings-btn" data-jb-act="preset-export">导出预设（JSON）</button>'
    + '<button class="settings-btn" data-jb-act="preset-import">导入预设</button>'
    + '<input type="file" class="jb-file-input" accept=".json,application/json" style="display:none">'
    + '<span class="jb-note">预设只含段落列表，可备份 / 分享；导入时同名可选跳过或覆盖</span>'
    + '</div>';
}

function renderSlot(slot: SlotKey, state: JailbreakSlotState): string {
  const meta = SLOT_META[slot];
  let html = '<div class="jb-slot-head"><span class="jb-slot-title">' + meta.title + '</span><span class="jb-slot-pos">' + meta.pos + '</span></div>';
  html += '<div class="jb-row">' + MODE_OPTIONS.map(m => '<button class="settings-btn jb-mode' + (state.mode === m.value ? ' seg-active' : '')
    + '" data-jb-act="mode" data-jb-val="' + m.value + '" title="' + escAttr(m.tip) + '">' + m.label + '</button>').join('') + '</div>';

  if (state.mode === 'default') {
    html += '<div class="jb-note">默认 = ' + meta.builtinLabel + '，随项目升级更新。</div>';
    html += '<details class="jb-builtin"><summary class="jb-note" style="cursor:pointer">查看内置内容（只读）</summary><pre>' + escAttr(meta.builtinText) + '</pre></details>';
    return html;
  }
  if (state.mode === 'none') {
    html += '<div class="jb-note">' + meta.title + '已关闭：该端不发送任何内容。</div>';
    return html;
  }

  const active = activeJailbreakSegments(state.segments);
  html += '<div class="jb-note">每段按身份逐条发出（' + ROLE_ORDER.map(r => ROLE_LABELS[r] + '=' + r).join(' / ') + '）；纯空白段不发送。'
    + '建议以 system 起手、assistant 段放末尾最稳（个别后端会合并连续同身份消息）。</div>';
  html += renderPresetRow(state);
  html += '<div class="jb-seg-list">' + renderSegments(state) + '</div>';
  html += '<div class="jb-row"><button class="settings-btn jb-add" data-jb-act="add">＋ 添加段落</button>'
    + '<span class="jb-note">共 ' + state.segments.length + ' 段 · ' + active.length + ' 段有效'
    + (active.length > SEGMENT_SOFT_LIMIT ? '（段数偏多，注意 token）' : '') + '</span></div>';
  if (active.length === 0) {
    html += '<div class="jb-note" style="color:var(--danger,#c0392b)">自定义不允许为空：请至少写一段，或切到「空（不发送）」。</div>';
  }
  html += '<div class="jb-io-preview" data-jb-io-preview style="display:none"></div>';
  return html;
}

function renderSlotInto(slot: SlotKey, snapshot?: StatusBarConfig): void {
  const host = slotHost(slot);
  if (!host) return;
  host.innerHTML = renderSlot(slot, slotState(slot, snapshot));
}

function renderAllSlots(snapshot: StatusBarConfig): void {
  for (const slot of SLOT_KEYS) renderSlotInto(slot, snapshot);
}

/* ============================ 操作 ============================ */

function toast(kind: 'success' | 'error' | 'warning', message: string): void {
  const t = getToastr();
  if (!t) return;
  if (kind === 'success') t.success(message, TOAST_TITLE);
  else if (kind === 'error') t.error(message, TOAST_TITLE);
  else t.warning(message, TOAST_TITLE);
}

function setMode(slot: SlotKey, mode: JailbreakSlotMode): void {
  const state = slotState(slot);
  const next: JailbreakSlotState = { ...state, mode };
  if (mode === 'custom' && state.segments.length === 0) {
    // 切到自定义时把内置内容预填成第一段（不从空白开始），用户可直接改
    next.segments = [{ role: 'system', text: SLOT_META[slot].builtinText }];
    toast('success', '已切到自定义，并把内置内容预填成第 1 段');
  }
  persistSlot(slot, next);
  renderSlotInto(slot);
}

/** 结构性变更：段落数组整体替换 + 重绘。
 *  保留 presetId——「更新当前」要以所选预设为目标写回；显式解除关联走下拉选「（未保存的临时编辑）」。 */
function commitSegments(slot: SlotKey, segments: JailbreakSegment[]): void {
  const state = slotState(slot);
  persistSlot(slot, { ...state, segments });
  renderSlotInto(slot);
}

function addSegment(slot: SlotKey): void {
  const state = slotState(slot);
  commitSegments(slot, [...cloneSegments(state.segments), { role: 'system', text: '' }]);
  const host = slotHost(slot);
  const areas = host ? host.querySelectorAll('textarea') : [];
  const last = areas[areas.length - 1] as HTMLTextAreaElement | undefined;
  if (last) last.focus();
}

function deleteSegment(slot: SlotKey, idx: number): void {
  const state = slotState(slot);
  if (idx < 0 || idx >= state.segments.length) return;
  commitSegments(slot, state.segments.filter((_seg, i) => i !== idx));
}

function moveSegment(slot: SlotKey, idx: number, delta: -1 | 1): void {
  const state = slotState(slot);
  const segments = cloneSegments(state.segments);
  const to = idx + delta;
  if (idx < 0 || to < 0 || to >= segments.length) return;
  const [moved] = segments.splice(idx, 1);
  segments.splice(to, 0, moved);
  commitSegments(slot, segments);
}

function setSegmentRole(slot: SlotKey, idx: number, role: JailbreakSegmentRole): void {
  const state = slotState(slot);
  if (idx < 0 || idx >= state.segments.length) return;
  commitSegments(slot, cloneSegments(state.segments).map((seg, i) => (i === idx ? { ...seg, role } : seg)));
}

/** 文本编辑：落盘 + 就地更新计数（不重绘列表，避免丢焦点）。
 *  保留 presetId：下拉仍显示该预设时，「更新当前」必须能写回它（清空会让按钮永远报未选择）。 */
function setSegmentText(slot: SlotKey, idx: number, text: string): void {
  const state = slotState(slot);
  if (idx < 0 || idx >= state.segments.length) return;
  const role = state.segments[idx].role;
  const segments = cloneSegments(state.segments).map((seg, i) => (i === idx ? { ...seg, text } : seg));
  persistSlot(slot, { ...state, segments });
  const host = slotHost(slot);
  const card = host ? host.querySelector('.jb-seg-card[data-jb-idx="' + idx + '"]') : null;
  const foot = card ? card.querySelector('.jb-seg-foot') : null;
  if (foot) foot.textContent = ROLE_LABELS[role] + '（' + role + '）· ' + text.length + ' 字符';
}

async function savePreset(slot: SlotKey): Promise<void> {
  const state = slotState(slot);
  if (!hasActiveJailbreakSegments(state.segments)) {
    toast('error', '自定义不允许为空：请至少写一段再保存预设');
    return;
  }
  const name = await showPromptDialog({ message: '预设名称：', title: '保存破限预设' });
  const trimmed = String(name || '').trim();
  if (!trimmed) return;
  if (state.presets.some(p => p.name === trimmed)) {
    toast('error', '已存在同名预设，请换一个名称');
    return;
  }
  const preset: JailbreakPreset = {
    id: generatePresetId(),
    name: trimmed,
    segments: cloneSegments(state.segments),
    createdAt: Date.now(),
  };
  persistSlot(slot, { ...state, presets: [...state.presets, preset], presetId: preset.id });
  renderSlotInto(slot);
  toast('success', '已保存预设：' + trimmed);
}

function updatePreset(slot: SlotKey): void {
  const state = slotState(slot);
  const preset = state.presets.find(p => p.id === state.presetId);
  if (!preset) {
    toast('warning', '请先在下拉中选择一个预设再更新');
    return;
  }
  if (!hasActiveJailbreakSegments(state.segments)) {
    toast('error', '自定义不允许为空：请至少写一段再更新预设');
    return;
  }
  const presets = state.presets.map(p => (p.id === preset.id ? { ...p, segments: cloneSegments(state.segments) } : p));
  persistSlot(slot, { ...state, presets });
  toast('success', '已更新预设：' + preset.name);
}

async function deletePreset(slot: SlotKey): Promise<void> {
  const state = slotState(slot);
  const preset = state.presets.find(p => p.id === state.presetId);
  if (!preset) {
    toast('warning', '请先在下拉中选择要删除的预设');
    return;
  }
  const ok = await showConfirmDialog({ message: '确认删除预设「' + preset.name + '」？当前段落不受影响，只是不再与预设关联。', danger: true });
  if (!ok) return;
  persistSlot(slot, { ...state, presets: state.presets.filter(p => p.id !== preset.id), presetId: '' });
  renderSlotInto(slot);
  toast('warning', '已删除预设：' + preset.name);
}

function applyPreset(slot: SlotKey, presetId: string): void {
  const state = slotState(slot);
  if (!presetId) {
    persistSlot(slot, { ...state, presetId: '' });
    return;
  }
  const preset = state.presets.find(p => p.id === presetId);
  if (!preset) return;
  persistSlot(slot, { ...state, presetId, segments: cloneSegments(preset.segments) });
  renderSlotInto(slot);
  toast('success', '已套用预设：' + preset.name);
}

function exportPresets(slot: SlotKey): void {
  const state = slotState(slot);
  if (state.presets.length === 0) {
    toast('warning', '当前槽位还没有预设可导出');
    return;
  }
  try {
    triggerBlobDownload(new Blob([buildJailbreakPresetExport(slot, state.presets)], { type: 'application/json' }), jailbreakPresetExportFilename(slot));
    toast('success', '已导出 ' + state.presets.length + ' 个预设');
  } catch (e) {
    toast('error', '导出失败：' + (e instanceof Error ? e.message : String(e)));
  }
}

/** 导入落盘：同名按策略跳过/覆盖（覆盖保留原 id，引用它的 presetId 不悬空） */
function applyImport(slot: SlotKey, parsed: ParsedJailbreakPresetImport, strategy: 'skip' | 'overwrite'): void {
  const state = slotState(slot);
  const merged = mergeJailbreakPresets(state.presets, parsed.presets, strategy);
  persistSlot(slot, { ...state, presets: merged.presets });
  pendingImport[slot] = undefined;
  renderSlotInto(slot);
  const parts = ['新增 ' + merged.added + ' 个'];
  if (merged.overwritten) parts.push('覆盖 ' + merged.overwritten + ' 个');
  if (merged.skipped) parts.push('跳过同名 ' + merged.skipped + ' 个');
  toast('success', '导入完成：' + parts.join(' / '));
}

function showImportPreview(slot: SlotKey, parsed: ParsedJailbreakPresetImport): void {
  if (parsed.presets.length === 0) {
    toast('error', '该 JSON 里没有可导入的预设（需要 presets 数组，每项含 name 与 segments）');
    return;
  }
  const state = slotState(slot);
  const conflicts = listPresetNameConflicts(state.presets, parsed.presets);
  if (conflicts.length === 0) {
    applyImport(slot, parsed, 'skip');
    return;
  }
  const host = slotHost(slot);
  const box = host ? host.querySelector('[data-jb-io-preview]') as HTMLElement | null : null;
  if (!box) return;
  pendingImport[slot] = parsed;
  const slotMismatch = parsed.slot !== '' && parsed.slot !== slot;
  box.style.display = 'block';
  box.innerHTML = '<div>识别到 ' + parsed.presets.length + ' 个预设，其中 <b>' + conflicts.length + '</b> 个与本地同名：'
    + escAttr(conflicts.slice(0, 6).join('、')) + (conflicts.length > 6 ? ' 等' : '') + '</div>'
    + (slotMismatch ? '<div class="jb-note">注意：该文件导出自「' + (parsed.slot === 'head' ? '破限头' : '尾部破限') + '」，将导入到当前槽位。</div>' : '')
    + '<div class="jb-row" style="margin-bottom:0">'
    + '<button class="settings-btn" data-jb-act="import-skip">跳过同名导入</button>'
    + '<button class="settings-btn" data-jb-act="import-overwrite">覆盖同名导入</button>'
    + '<button class="settings-btn" data-jb-act="import-cancel">取消</button>'
    + '</div>';
}

function handleImportFile(slot: SlotKey, file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseJailbreakPresetImport(String(reader.result || ''), generatePresetId);
    if (!parsed) {
      toast('error', '无法识别该 JSON（需要 presets 数组，每项含 name 与 segments）');
      return;
    }
    showImportPreview(slot, parsed);
  };
  reader.onerror = () => toast('error', '读取文件失败');
  reader.readAsText(file, 'utf-8');
}

/* ============================ 事件绑定 ============================ */

function slotKeyFromEl(el: HTMLElement): SlotKey | null {
  const host = el.closest('[data-jb-slot]') as HTMLElement | null;
  const key = host?.dataset.jbSlot;
  return key === 'head' || key === 'tail' ? key : null;
}

function segmentIndexFromEl(el: HTMLElement): number {
  return Number(el.dataset.jbIdx || '-1');
}

/** 挂载两槽位（由 bindApiTab 调用；容器缺失即静默返回，不影响其它板块）。
 *  幂等：同一容器重复挂载直接返回，避免事件被处理两次（面板 HTML 由每次打开重建，正常只挂一次）。 */
export function mountJailbreakSlots(config: StatusBarConfig): void {
  const root = document.getElementById('jbSlots');
  if (!root || root.dataset.jbMounted === '1') return;
  root.dataset.jbMounted = '1';
  renderAllSlots(config);

  root.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement | null)?.closest('[data-jb-act]') as HTMLElement | null;
    if (!target || target.hasAttribute('disabled')) return;
    const slot = slotKeyFromEl(target);
    if (!slot) return;
    const act = target.dataset.jbAct || '';
    const idx = segmentIndexFromEl(target);

    switch (act) {
      case 'mode': setMode(slot, (target.dataset.jbVal as JailbreakSlotMode) || 'default'); break;
      case 'add': addSegment(slot); break;
      case 'del': deleteSegment(slot, idx); break;
      case 'up': moveSegment(slot, idx, -1); break;
      case 'down': moveSegment(slot, idx, 1); break;
      case 'role': setSegmentRole(slot, idx, (target.dataset.jbVal as JailbreakSegmentRole) || 'system'); break;
      case 'preset-save': void savePreset(slot); break;
      case 'preset-update': updatePreset(slot); break;
      case 'preset-delete': void deletePreset(slot); break;
      case 'preset-export': exportPresets(slot); break;
      case 'preset-import': {
        const input = target.parentElement?.querySelector('.jb-file-input') as HTMLInputElement | null;
        if (input) { input.value = ''; input.click(); }
        break;
      }
      case 'import-skip': if (pendingImport[slot]) applyImport(slot, pendingImport[slot]!, 'skip'); break;
      case 'import-overwrite': if (pendingImport[slot]) applyImport(slot, pendingImport[slot]!, 'overwrite'); break;
      case 'import-cancel': {
        pendingImport[slot] = undefined;
        const host = slotHost(slot);
        const box = host ? host.querySelector('[data-jb-io-preview]') as HTMLElement | null : null;
        if (box) { box.style.display = 'none'; box.innerHTML = ''; }
        break;
      }
      default: break;
    }
  });

  root.addEventListener('change', (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    const slot = slotKeyFromEl(target);
    if (!slot) return;
    if (target.classList.contains('jb-file-input')) {
      const input = target as HTMLInputElement;
      const file = input.files && input.files[0];
      if (file) handleImportFile(slot, file);
      return;
    }
    if (target.dataset.jbAct === 'preset-select') {
      applyPreset(slot, (target as HTMLSelectElement).value);
    }
  });

  root.addEventListener('input', (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target || target.dataset.jbAct !== 'text') return;
    const slot = slotKeyFromEl(target);
    if (!slot) return;
    setSegmentText(slot, segmentIndexFromEl(target), (target as HTMLTextAreaElement).value);
  });
}
