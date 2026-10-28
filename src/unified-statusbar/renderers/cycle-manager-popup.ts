// ===== 经期参数管理窗口（只读摘要 → 显式编辑 → 不可逆排除） =====
import { type StyleType } from '../core/constants';
import {
  type CycleManagerField,
  type CycleManagerInput,
  type CycleManagerSnapshot,
  getCycleManagerSnapshot,
  permanentlyExcludeCycleCharacter,
  saveCycleManagerParams,
  terminatePregnancy,
} from '../core/cycle-engine';
import { syncDarkClass, syncDarkClassMinimal } from './html-builder';
import { closePanelOverlay, guardGhostClick, markPopupShown } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { escapeHtmlAttr as escapeHtml } from '../core/html-escape';

interface ManagerState {
  snapshot: CycleManagerSnapshot;
  editing: boolean;
  dirty: boolean;
  saving: boolean;
  closed: boolean;
}

let _cycleManagerStyle: StyleType = 'minimal';

function sourceLabel(source: CycleManagerSnapshot['source']): string {
  if (source === 'protagonist') return '主角信息表';
  if (source === 'important') return '重要角色表';
  return '恋爱对象表';
}

function phaseLabel(snapshot: CycleManagerSnapshot): string {
  const label = {
    menstrual: '经期',
    follicular: '卵泡期',
    ovulation: '排卵期',
    luteal: '黄体期',
  }[snapshot.phase];
  return `周期第 ${snapshot.daysIntoCycle} 天 · ${label}`;
}

function readonlyRow(label: string, value: string): string {
  return '<div class="cycle-manager-row"><span class="cycle-manager-field-label">' + label
    + '</span><span class="cycle-manager-field-value">' + escapeHtml(value) + '</span></div>';
}

function inputRow(
  label: string,
  field: CycleManagerField,
  value: string | number,
  type: 'date' | 'number' | 'select',
): string {
  let control = '';
  if (type === 'select') {
    control = '<select name="regularity" class="cycle-manager-input">'
      + '<option value="stable"' + (value === 'stable' ? ' selected' : '') + '>规律</option>'
      + '<option value="irregular"' + (value === 'irregular' ? ' selected' : '') + '>不规律</option>'
      + '</select>';
  } else {
    const limits = field === 'periodLength' ? ' min="2" max="10"' : type === 'number' ? ' min="21" max="45"' : '';
    control = '<input class="cycle-manager-input" name="' + field + '" type="' + type + '" value="'
      + escapeHtml(value) + '"' + limits + '>';
  }
  return '<label class="cycle-manager-row"><span class="cycle-manager-field-label">' + label
    + '</span>' + control + '</label>';
}

function cycleManagerClass(confirm = false): string {
  return 'panel-popup cycle-manager-popup ub-popup--l'
    + (confirm ? ' cycle-manager-confirm' : '')
    + (_cycleManagerStyle === 'bridge' ? ' bridge-window bridge-module-cycle-manager' : '');
}

function managerBody(state: ManagerState): string {
  const snapshot = state.snapshot;
  const rows = state.editing
    ? inputRow('末次经期开始日', 'lastPeriodStart', snapshot.lastPeriodStart, 'date')
      + inputRow('基础周期长度', 'baseCycleLength', snapshot.baseCycleLength, 'number')
      + inputRow('当前周期长度', 'cycleLength', snapshot.cycleLength, 'number')
      + inputRow('经期长度', 'periodLength', snapshot.periodLength, 'number')
      + inputRow('周期规律', 'regularity', snapshot.regularity, 'select')
    : readonlyRow('末次经期开始日', snapshot.lastPeriodStart)
      + readonlyRow('基础周期长度', `${snapshot.baseCycleLength} 天`)
      + readonlyRow('当前周期长度', `${snapshot.cycleLength} 天`)
      + readonlyRow('经期长度', `${snapshot.periodLength} 天`)
      + readonlyRow('周期规律', snapshot.regularity === 'stable' ? '规律' : '不规律');
  const knownPregnancy = snapshot.pregnancyWeeks === null ? '' : ` · 已确认孕 ${snapshot.pregnancyWeeks} 周`;
  const canTerminate = snapshot.pregnancyWeeks !== null;
  return '<div class="' + cycleManagerClass() + '">'
    + '<div class="panel-popup-head"><div class="panel-popup-title">经期参数</div>'
    + '<button type="button" class="panel-popup-close" id="cycleManagerClose" aria-label="关闭">&times;</button></div>'
    + '<div class="panel-popup-body cycle-manager-body">'
    + '<div class="cycle-manager-person"><strong>' + escapeHtml(snapshot.name) + '</strong>'
    + '<span>' + snapshot.age + ' 岁 · ' + sourceLabel(snapshot.source) + '</span></div>'
    + '<div class="cycle-manager-summary">' + phaseLabel(snapshot) + knownPregnancy + '</div>'
    + '<div class="cycle-manager-fields">' + rows + '</div>'
    + '<div class="cycle-manager-message" role="status" aria-live="polite"></div>'
    + '<div class="cycle-manager-actions">'
    + (state.editing
      ? '<button type="button" class="cycle-manager-btn secondary" id="cycleManagerCancel">取消</button>'
        + '<button type="button" class="cycle-manager-btn primary" id="cycleManagerSave">保存修改</button>'
      : '<button type="button" class="cycle-manager-btn primary" id="cycleManagerEdit">编辑参数</button>')
    + '</div>'
    + (canTerminate
      ? '<div class="cycle-manager-danger cycle-manager-terminate-block">'
        + '<div><strong>终止妊娠</strong><span>仅结束此次怀孕，随后进入约一周期恢复期。此操作无法撤销。</span></div>'
        + '<button type="button" class="cycle-manager-btn danger" id="cycleManagerTerminate">终止此次妊娠</button>'
      + '</div>'
      : '')
    + '<div class="cycle-manager-danger"><div><strong>永久排除</strong><span>排除后不再显示周期条，也不会参与经期与怀孕计算。</span></div>'
    + '<button type="button" class="cycle-manager-btn danger" id="cycleManagerExclude">排除此人物</button></div>'
    + '</div></div>';
}

function exclusionConfirmBody(snapshot: CycleManagerSnapshot): string {
  return '<div class="' + cycleManagerClass(true) + '">'
    + '<div class="panel-popup-head"><div class="panel-popup-title">确认永久排除</div>'
    + '<button type="button" class="panel-popup-close" id="cycleManagerClose" aria-label="关闭">&times;</button></div>'
    + '<div class="panel-popup-body cycle-manager-body">'
    + '<div class="cycle-manager-warning-icon">!</div>'
    + '<h3>排除 ' + escapeHtml(snapshot.name) + '？</h3>'
    + '<p>确认后，此人物将不再纳入经期和怀孕功能，周期展示条也会消失。</p>'
    + '<p class="cycle-manager-irreversible">此操作无法撤销。</p>'
    + '<div class="cycle-manager-message" role="status" aria-live="polite"></div>'
    + '<div class="cycle-manager-actions">'
    + '<button type="button" class="cycle-manager-btn secondary" id="cycleManagerExcludeCancel">取消</button>'
    + '<button type="button" class="cycle-manager-btn danger" id="cycleManagerExcludeConfirm">确认永久排除</button>'
    + '</div></div></div>';
}

function abortionMethodLabel(snapshot: CycleManagerSnapshot): string {
  const w = snapshot.pregnancyWeeks ?? 1;
  if (w <= 12) return '药流';
  if (w <= 27) return '人流';
  return '引产';
}

function terminationConfirmBody(snapshot: CycleManagerSnapshot): string {
  const weeks = snapshot.pregnancyWeeks ?? 1;
  const method = abortionMethodLabel(snapshot);
  return '<div class="' + cycleManagerClass(true) + '">'
    + '<div class="panel-popup-head"><div class="panel-popup-title">确认终止妊娠</div>'
    + '<button type="button" class="panel-popup-close" id="cycleManagerClose" aria-label="关闭">&times;</button></div>'
    + '<div class="panel-popup-body cycle-manager-body">'
    + '<div class="cycle-manager-warning-icon">!</div>'
    + '<h3>终止 ' + escapeHtml(snapshot.name) + ' 的妊娠？</h3>'
    + '<p>孕 ' + weeks + ' 周 · 将以 <b>' + method + '</b> 方式终止。<br>'
    + '此后进入约一周期（' + snapshot.cycleLength + ' 天）恢复期，期间不来月信、不会再孕；<br>'
    + '恢复后周期自动重建。</p>'
    + '<p class="cycle-manager-irreversible">此操作无法撤销。</p>'
    + '<div class="cycle-manager-message" role="status" aria-live="polite"></div>'
    + '<div class="cycle-manager-actions">'
    + '<button type="button" class="cycle-manager-btn secondary" id="cycleManagerTerminateCancel">取消</button>'
    + '<button type="button" class="cycle-manager-btn danger" id="cycleManagerTerminateConfirm">确认终止妊娠</button>'
    + '</div></div></div>';
}

function readInput(overlay: HTMLElement): CycleManagerInput {
  const value = (name: CycleManagerField): string =>
    (overlay.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value || '';
  return {
    lastPeriodStart: value('lastPeriodStart'),
    baseCycleLength: Number(value('baseCycleLength')),
    cycleLength: Number(value('cycleLength')),
    periodLength: Number(value('periodLength')),
    regularity: value('regularity') === 'irregular' ? 'irregular' : 'stable',
  };
}

function setMessage(overlay: HTMLElement, message: string, error = false): void {
  const element = overlay.querySelector('.cycle-manager-message') as HTMLElement | null;
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', error);
}

export function showCycleManagerPopup(
  nameOrKey: string,
  style: StyleType,
  onChanged: () => void = () => undefined,
): void {
  const snapshot = getCycleManagerSnapshot(nameOrKey);
  if (!snapshot) return;
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const state: ManagerState = { snapshot, editing: false, dirty: false, saving: false, closed: false };
  _cycleManagerStyle = style;

  const syncTheme = (): void => {
    if (style === 'minimal') syncDarkClassMinimal(overlay);
    else syncDarkClass(overlay);
  };
  const teardown = (): void => {
    overlay.onclick = null;
    overlay.oninput = null;
    overlay.onkeydown = null;
  };
  const setSaving = (saving: boolean): void => {
    state.saving = saving;
    overlay.setAttribute('aria-busy', saving ? 'true' : 'false');
    overlay.querySelectorAll('button, input, select').forEach(element => {
      (element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement).disabled = saving;
    });
  };
  const close = async (): Promise<void> => {
    if (state.saving) return;
    if (state.dirty && !await showConfirmDialog({ message: '尚有未保存的经期参数，确认关闭吗？' })) return;
    state.closed = true;
    teardown();
    closePanelOverlay(overlay);
  };

  const render = (confirming: boolean | 'terminate' = false): void => {
    syncTheme();
    overlay.innerHTML = confirming === true
      ? exclusionConfirmBody(state.snapshot)
      : confirming === 'terminate'
        ? terminationConfirmBody(state.snapshot)
        : managerBody(state);
    overlay.classList.add('show');
    (overlay.querySelector('#cycleManagerClose') as HTMLElement | null)?.focus();
    overlay.oninput = () => { if (state.editing) state.dirty = true; };
    overlay.onkeydown = async event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        await close();
      }
    };
    overlay.onclick = async event => {
      const target = event.target as HTMLElement;
      if (state.saving) return;
      if (target === overlay) {
        if (!guardGhostClick()) await close();
        return;
      }
      if (target.closest('#cycleManagerClose')) { await close(); return; }
      if (target.closest('#cycleManagerEdit')) {
        state.editing = true;
        state.dirty = false;
        render();
        return;
      }
      if (target.closest('#cycleManagerCancel')) {
        state.editing = false;
        state.dirty = false;
        render();
        return;
      }
      if (target.closest('#cycleManagerSave') && !state.saving) {
        setSaving(true);
        setMessage(overlay, '正在保存…');
        void saveCycleManagerParams(state.snapshot.key, readInput(overlay)).then(result => {
          if (state.closed) return;
          setSaving(false);
          if (!result.ok) {
            setMessage(overlay, result.message, true);
            if (result.field) (overlay.querySelector(`[name="${result.field}"]`) as HTMLElement | null)?.focus();
            return;
          }
          const refreshed = getCycleManagerSnapshot(state.snapshot.key);
          if (refreshed) state.snapshot = refreshed;
          state.editing = false;
          state.dirty = false;
          onChanged();
          render();
          setMessage(overlay, '参数已保存。');
        });
        return;
      }
      if (target.closest('#cycleManagerTerminate')) { render('terminate'); return; }
      if (target.closest('#cycleManagerTerminateCancel')) { render(); return; }
      if (target.closest('#cycleManagerTerminateConfirm') && !state.saving) {
        setSaving(true);
        setMessage(overlay, '正在终止…');
        void terminatePregnancy(state.snapshot.key).then(result => {
          if (state.closed) return;
          setSaving(false);
          if (!result.ok) { setMessage(overlay, result.message, true); return; }
          state.dirty = false;
          state.closed = true;
          teardown();
          closePanelOverlay(overlay);
          onChanged();
        });
        return;
      }
      if (target.closest('#cycleManagerExclude')) { render(true); return; }
      if (target.closest('#cycleManagerExcludeCancel')) { render(); return; }
      if (target.closest('#cycleManagerExcludeConfirm') && !state.saving) {
        setSaving(true);
        setMessage(overlay, '正在保存排除标记…');
        void permanentlyExcludeCycleCharacter(state.snapshot.key).then(result => {
          if (state.closed) return;
          setSaving(false);
          if (!result.ok) { setMessage(overlay, result.message, true); return; }
          state.dirty = false;
          state.closed = true;
          teardown();
          closePanelOverlay(overlay);
          onChanged();
        });
      }
    };
  };

  markPopupShown();
  render();
}
