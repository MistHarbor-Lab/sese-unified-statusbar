// ===== 备忘录「AI 规划目标」弹窗（复用 panelOverlay 壳，照 character-worldbook-dialog 模式） =====
// 设置视图（数量/风格/要求）→ 生成 → 审核视图（勾选）→ 注入备忘录表。busy 期间禁止关闭。
// onExit 回调由调用方（popup-manager）提供（返回备忘录列表），本模块不反向依赖弹窗管理。
import { type StyleType } from '../core/constants';
import { ensureStyleOnce } from './style-once';
import { getToastr } from '../core/env';
import {
  MEMO_GOAL_STYLES, MEMO_GOALS_DEFAULT_SETTINGS,
  generateMemoGoals, buildMemoRecord,
  type MemoGoalCandidate, type MemoGoalsSettings,
} from '../core/memo-goals';
import { insertContentRowSqlFirst, isSqliteMode } from '../core/data-manager';
import { getTodayDateKey } from '../core/calendar-core';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { bridgeWindowClass, closePanelOverlay, markPopupShown, syncDarkClass, syncDarkClassMinimal } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';

const MG_CSS_ID = 'ub-memo-goals-css';

const MG_CSS = `
.ub-mg-body{display:flex;flex-direction:column;gap:12px}
.ub-mg-hint{margin:0;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));font-size:var(--ub-ui-font-11,11px);line-height:1.5}
.ub-mg-error{margin:0;padding:6px 9px;border:1px solid #d65151;border-left:3px solid #d65151;background:color-mix(in srgb,#d65151 8%,transparent);color:#d65151;font-size:var(--ub-ui-font-11,11px);line-height:1.5}
.ub-mg-counts{display:flex;flex-direction:column;gap:7px}
.ub-mg-count{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ub-mg-count-label{font-size:var(--ub-ui-font-12,12px);font-weight:600;color:var(--text,var(--sweet-text,var(--jade-text,inherit)))}
.ub-mg-stepper{display:flex;align-items:stretch;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:6px;overflow:hidden;background:var(--card,var(--sweet-card,var(--jade-surface-1,transparent)))}
.ub-mg-step{width:32px;min-height:var(--ub-touch-min,32px);padding:0;border:0;background:transparent;color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font:inherit;font-size:15px;line-height:1;cursor:pointer}
.ub-mg-step:hover{background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,transparent)))}
.ub-mg-count-num{min-width:36px;display:flex;align-items:center;justify-content:center;border-left:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-right:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));font-weight:600;font-size:var(--ub-ui-font-12,12px);color:var(--text,var(--sweet-text,var(--jade-text,inherit)))}
.ub-mg-styles{display:flex;flex-wrap:wrap;gap:6px}
.ub-mg-chip input{display:none}
.ub-mg-chip span{display:inline-block;padding:4px 11px;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:999px;font-size:var(--ub-ui-font-11,11px);color:var(--text,var(--sweet-text,var(--jade-text,inherit)));cursor:pointer;user-select:none;white-space:nowrap}
.ub-mg-chip:hover span{background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,transparent)))}
.ub-mg-chip input:checked + span{border-color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,transparent)));font-weight:600}
.ub-mg-requirement{width:100%;box-sizing:border-box;min-height:72px;resize:vertical;padding:7px 9px;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:4px;background:var(--card,var(--sweet-card,var(--jade-surface-1,transparent)));color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font:inherit;line-height:1.5}
.ub-mg-actions{display:flex;gap:8px;justify-content:flex-end}
.ub-mg-btn{display:inline-flex;align-items:center;justify-content:center;min-height:var(--ub-touch-min,32px);padding:5px 14px;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:5px;background:var(--card,var(--sweet-card,var(--jade-surface-1,transparent)));color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font:inherit;font-size:var(--ub-ui-font-12,12px);cursor:pointer;white-space:nowrap}
.ub-mg-btn:hover{background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,transparent)))}
.ub-mg-btn[disabled]{opacity:.55;cursor:default}
.ub-mg-btn-primary{border-color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));font-weight:600}
.ub-mg-list{display:flex;flex-direction:column;gap:8px}
.ub-mg-goal{display:flex;gap:9px;padding:9px 10px;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:6px;background:var(--card,var(--sweet-card,var(--jade-surface-1,transparent)));cursor:pointer}
.ub-mg-goal input.ub-mg-goal-check{margin:2px 0 0;flex:0 0 auto;width:15px;height:15px;accent-color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))))}
.ub-mg-goal-main{flex:1;min-width:0}
.ub-mg-goal-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ub-mg-kind{flex:none;padding:1px 7px;border-radius:999px;font-size:var(--ub-ui-font-sub,10px);font-weight:600;border:1px solid var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))))}
.ub-mg-kind-short{border-color:#35a76a;color:#35a76a}
.ub-mg-kind-char{border-color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)))}
.ub-mg-goal-title{font-weight:600;color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font-size:var(--ub-ui-font-12,12px)}
.ub-mg-goal-meta{margin-top:2px;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));font-size:var(--ub-ui-font-sub,10px)}
.ub-mg-goal-detail{margin:5px 0 0;color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font-size:var(--ub-ui-font-11,11px);line-height:1.6;white-space:pre-wrap;word-break:break-word}
`;

function ensureMemoGoalsCss(): void {
  ensureStyleOnce(MG_CSS_ID, MG_CSS); // U35：收编幂等注入（无 DOM 环境降级由规范口承担）
}

// 会话内记住上次设置（不持久化）；busy 阻止关闭防丢结果。
let _draft: MemoGoalsSettings = { ...MEMO_GOALS_DEFAULT_SETTINGS, styles: [] };
let _busy = false;

export interface MemoGoalsDialogArgs {
  style: StyleType;
  /** 返回备忘录列表（由调用方提供，通常为 showMemoPopup(style)）。 */
  onExit: () => void;
}

function clampCount(value: unknown): number {
  const n = Math.floor(Number(value) || 0);
  return Math.min(5, Math.max(0, n));
}

export function showMemoGoalsDialog(args: MemoGoalsDialogArgs): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  ensureMemoGoalsCss();

  const root = document.createElement('div');
  root.className = (args.style === 'bridge' ? bridgeWindowClass('memo-goals', 'm') : 'panel-popup ub-popup--m') + ' ub-mg-popup';
  if (args.style === 'minimal') syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.replaceChildren(root);
  overlay.classList.add('show');
  markPopupShown();

  let _error = '';
  let _goals: MemoGoalCandidate[] = [];

  const headHtml = (): string => {
    const back = _busy ? '' : '<button type="button" class="panel-popup-back" data-mg-back>← 返回</button>';
    const close = _busy ? '' : '<button type="button" class="panel-popup-close" data-mg-close>&times;</button>';
    return '<div class="panel-popup-head">' + back + '<div class="panel-popup-title">AI 规划目标</div>' + close + '</div>';
  };

  const settingsHtml = (): string => {
    const styleChips = MEMO_GOAL_STYLES.map(styleItem =>
      `<label class="ub-mg-chip"><input type="checkbox" data-mg-style="${escapeHtmlAttr(styleItem.id)}"${_draft.styles.includes(styleItem.id) ? ' checked' : ''}><span title="${escapeHtmlAttr(styleItem.label + '：' + styleItem.hint)}">${escapeHtml(styleItem.label)}</span></label>`
    ).join('');
    const countRow = (label: string, key: 'longCount' | 'shortCount' | 'charCount'): string =>
      `<div class="ub-mg-count"><span class="ub-mg-count-label">${escapeHtml(label)}</span><div class="ub-mg-stepper"><button type="button" class="ub-mg-step" data-mg-step="${key}:-1" aria-label="减少">&minus;</button><span class="ub-mg-count-num" data-mg-num="${key}">${clampCount(_draft[key])}</span><button type="button" class="ub-mg-step" data-mg-step="${key}:1" aria-label="增加">&plus;</button></div></div>`;
    return `<div class="panel-popup-body ub-mg-body">
      <p class="ub-mg-hint">让 AI 结合世界书、纪要与最近剧情，设计一批「脱离当前剧情线」的游玩目标写入备忘录——不知道接下来做什么时，用它找方向。</p>
      ${_error ? `<p class="ub-mg-error">${escapeHtml(_error)}</p>` : ''}
      <div class="ub-mg-counts">
        ${countRow('长期目标', 'longCount')}
        ${countRow('短期目标', 'shortCount')}
        ${countRow('人物目标', 'charCount')}
      </div>
      <div>
        <p class="ub-mg-hint" style="margin-bottom:5px;">风格方向（可多选；全不选 = AI 自由发挥）</p>
        <div class="ub-mg-styles">${styleChips}</div>
      </div>
      <div>
        <p class="ub-mg-hint" style="margin-bottom:5px;">要求（可留空）</p>
        <textarea class="ub-mg-requirement" data-mg-requirement maxlength="500" placeholder="例如：&#10;· 侧重和某位角色相关的目标&#10;· 想要一些离谱但有意思的挑战">${escapeHtml(_draft.requirement)}</textarea>
      </div>
      <div class="ub-mg-actions"><button type="button" class="ub-mg-btn ub-mg-btn-primary" data-mg-generate>开始生成</button></div>
    </div>`;
  };

  const kindClass = (kind: string): string => kind === '短期目标' ? ' ub-mg-kind-short' : kind === '人物目标' ? ' ub-mg-kind-char' : '';

  const reviewHtml = (goals: readonly MemoGoalCandidate[], checkedIndexes?: ReadonlySet<number>): string => {
    const cards = goals.map((goal, index) => {
      const meta: string[] = [];
      if (goal.targetDate) meta.push('约定：' + goal.targetDate);
      if (goal.relatedChar) meta.push('相关：' + goal.relatedChar);
      const checked = !checkedIndexes || checkedIndexes.has(index);
      return `<label class="ub-mg-goal">
        <input type="checkbox" class="ub-mg-goal-check" data-mg-goal="${index}"${checked ? ' checked' : ''}>
        <div class="ub-mg-goal-main">
          <div class="ub-mg-goal-top"><span class="ub-mg-kind${kindClass(goal.kind)}">${escapeHtml(goal.kind)}</span><span class="ub-mg-goal-title">${escapeHtml(goal.title)}</span></div>
          ${meta.length ? `<div class="ub-mg-goal-meta">${escapeHtml(meta.join(' · '))}</div>` : ''}
          <p class="ub-mg-goal-detail">${escapeHtml(goal.detail)}</p>
        </div>
      </label>`;
    }).join('');
    return `<div class="panel-popup-body ub-mg-body">
      <p class="ub-mg-hint">已生成 ${goals.length} 条目标。勾选想要的注入备忘录，未选中的丢弃；不满意可重新生成。</p>
      <div class="ub-mg-list" data-mg-list>${cards}</div>
      <div class="ub-mg-actions">
        <button type="button" class="ub-mg-btn" data-mg-regenerate>重新生成</button>
        <button type="button" class="ub-mg-btn ub-mg-btn-primary" data-mg-inject>注入所选（<span data-mg-inject-count>0</span>）</button>
      </div>
    </div>`;
  };

  const render = (body: string): void => {
    root.innerHTML = headHtml() + body;
  };

  const collectDraft = (): void => {
    _draft.styles = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-mg-style]'))
      .filter(input => input.checked)
      .map(input => input.dataset.mgStyle || '');
    const requirement = root.querySelector<HTMLTextAreaElement>('textarea[data-mg-requirement]');
    _draft.requirement = requirement ? requirement.value.trim().slice(0, 500) : '';
  };

  const updateInjectCount = (): void => {
    const count = root.querySelectorAll<HTMLInputElement>('input.ub-mg-goal-check:checked').length;
    const label = root.querySelector<HTMLElement>('[data-mg-inject-count]');
    if (label) label.textContent = String(count);
  };

  const showSettings = (): void => render(settingsHtml());
  const showReview = (goals: readonly MemoGoalCandidate[], checkedIndexes?: ReadonlySet<number>): void => {
    render(reviewHtml(goals, checkedIndexes));
    updateInjectCount();
  };

  const runGenerate = async (): Promise<void> => {
    collectDraft();
    const total = clampCount(_draft.longCount) + clampCount(_draft.shortCount) + clampCount(_draft.charCount);
    if (total <= 0) { _error = '三类目标数量都为 0，至少要 1 条。'; showSettings(); return; }
    _busy = true;
    _error = '';
    render(`<div class="panel-popup-body ub-mg-body"><p class="ub-mg-hint">正在生成目标（AI 请求中，请稍候）…</p></div>`);
    try {
      const goals = await generateMemoGoals(_draft);
      _busy = false;
      _goals = goals;
      showReview(goals);
    } catch (error) {
      _busy = false;
      _error = error instanceof Error ? error.message : String(error || '生成失败');
      showSettings();
    }
  };

  const runInject = async (): Promise<void> => {
    const checked = Array.from(root.querySelectorAll<HTMLInputElement>('input.ub-mg-goal-check:checked'));
    const indexes = checked
      .map(input => Number(input.dataset.mgGoal || '-1'))
      .filter(index => index >= 0 && index < _goals.length);
    const goals = indexes.map(index => _goals[index]);
    if (!goals.length) return;
    if (!isSqliteMode()) {
      void showConfirmDialog({ message: '备忘录表写入需要 SQLite 数据库模式（设置 → 数据库），当前无法注入。', okText: '知道了' });
      return;
    }
    _busy = true;
    render(`<div class="panel-popup-body ub-mg-body"><p class="ub-mg-hint">正在写入备忘录…</p></div>`);
    const recordTime = getTodayDateKey() || '';
    let ok = 0;
    for (const goal of goals) {
      try {
        if (await insertContentRowSqlFirst('备忘录', buildMemoRecord(goal, recordTime))) ok++;
      } catch (_e) { /* 计入失败 */ }
    }
    _busy = false;
    const failed = goals.length - ok;
    if (ok > 0) {
      if (failed > 0) getToastr()?.warning(`${ok} 条已注入，${failed} 条写入失败`, 'AI 规划');
      else getToastr()?.success(`已注入 ${ok} 条目标到备忘录`, 'AI 规划');
      args.onExit();
    } else {
      getToastr()?.error('写入失败，请确认数据库为 SQLite 模式后重试', 'AI 规划');
      _error = '上一次注入全部失败，勾选已恢复，可重试。';
      showReview(_goals, new Set(indexes));
    }
  };

  overlay.onclick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (_busy) return;
    const stepBtn = target.closest<HTMLElement>('[data-mg-step]');
    if (stepBtn) {
      const [key, delta] = String(stepBtn.dataset.mgStep || '').split(':');
      if (key === 'longCount' || key === 'shortCount' || key === 'charCount') {
        _draft[key] = clampCount(_draft[key] + Number(delta || '0'));
        const num = root.querySelector<HTMLElement>(`[data-mg-num="${key}"]`);
        if (num) num.textContent = String(_draft[key]);
      }
      return;
    }
    if (target === overlay || target.closest('[data-mg-close]')) { closePanelOverlay(overlay); return; }
    if (target.closest('[data-mg-back]')) { args.onExit(); return; }
    if (target.closest('[data-mg-generate]')) { void runGenerate(); return; }
    if (target.closest('[data-mg-inject]')) { void runInject(); return; }
    if (target.closest('[data-mg-regenerate]')) { showSettings(); return; }
  };
  root.addEventListener('change', () => updateInjectCount());

  showSettings();
}
