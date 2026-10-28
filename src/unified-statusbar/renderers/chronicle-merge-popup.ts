// ===== 纪要合并：弹窗 + 进度面板 + 中断后处理 =====
// [LEGACY-MERGE · DB-ONLY] 仅真数据库模式可用。
// 瑟瑟台账接管时：数据库纪要页/剧情回顾入口隐藏，合并由台账工作台「纪要合并」标签执行。
// 计划后续版本移除状态栏合并；删除时同步清理本文件、chronicle-merge-*、db-merge-*/cm-* 样式、
// chronicleMerge API 设置与相关测试（台账侧标记/算法不受影响）。
// 设计文档：docs/superpowers/specs/2026-07-26-chronicle-merge-design.md §4
// 复用 db 弹窗 token + syncDarkClass；按钮一律 db-* 前缀骨架。

import { getConfig } from '../core/config-store';
import { isLedgerTakeover } from '../core/ledger-takeover';
import { ubIcon } from '../core/icons';
import { showPersistentError, showPersistentWarning } from '../core/api-config';
import {
  computeSegments,
  computeTimeSegments,
  parseChronicleTime,
  readChronicleRows,
  commitMerge,
  repairChronicleNumbering,
  saveSessionCheckpoint,
  loadSessionCheckpoint,
  clearSessionCheckpoint,
  startBackgroundMerge,
  isChronicleMergeActive,
  isChronicleMergeRunning,
  getCurrentMergeSession,
  abortCurrentMerge,
  clearCurrentMerge,
  onMergeProgress,
  onMergeComplete,
  type MergeSession,
  type SegmentState,
} from '../core/chronicle-merge-engine';
import { getMergedCount, getCurrentChatKeyOrNull } from '../core/chronicle-merge-markers';
import { escapeHtml as esc } from '../core/html-escape';

// 进度视图状态：视图开则 _currentUnsub 非 null；× 关界面退订但后台不停
let _viewOpen = false;
let _currentUnsub: (() => void) | null = null;

// 后台完成时若视图未开，弹通知（永久监听，模块加载时注册一次）
onMergeComplete(session => {
  // 聊天归属：合并属于发起时那个聊天 → 不在新聊天弹完成通知。
  if (session.chatKey && getCurrentChatKeyOrNull() !== session.chatKey) return;
  // [LEGACY-MERGE · DB-ONLY] 台账模式不再提示状态栏合并（会话会被中断/清理）。
  if (!_viewOpen && !isLedgerTakeover()) {
    showPersistentWarning('纪要合并已完成，点合并纪要按钮查看并提交', '纪要合并');
  }
});

function getOverlay(): HTMLElement {
  return document.getElementById('panelOverlay') as HTMLElement;
}

// 追踪绑定在常驻 #panelOverlay 上的 refresh 监听，关闭时移除以防叠加泄漏
let _cmBoundRefresh: ((e: Event) => void) | null = null;
function unbindCmRefresh(o: HTMLElement): void {
  if (_cmBoundRefresh) {
    o.removeEventListener('input', _cmBoundRefresh);
    o.removeEventListener('change', _cmBoundRefresh);
    _cmBoundRefresh = null;
  }
}

function applyDark(overlay: HTMLElement): void {
  // 内联 syncDarkClass/syncDarkClassMinimal（避免经 html-builder ↔ popup-manager 循环依赖）
  const dark = getConfig().darkTheme;
  overlay.classList.toggle('dark', dark);
  if (getConfig().style === 'minimal') document.body.classList.toggle('dark-mode', dark);
}

function chroniclePopupClass(extra: string): string {
  return 'panel-popup ' + extra
    + (getConfig().style === 'bridge' ? ' bridge-window bridge-module-chronicle-merge' : '');
}

function clearOverlay(): void {
  const o = getOverlay();
  unbindCmRefresh(o);
  o.innerHTML = '';
  o.onclick = null;
  // 必须移除 .show：本弹窗复用 db 弹窗已打开的 #panelOverlay（display:flex;position:fixed;
  // inset:0;z-index:10000），仅清 innerHTML 会让空 overlay 继续盖满全屏吞掉所有点击 → UI 卡死。
  o.classList.remove('show');
}

// ═══════════════════════════════════════════════════════════════
// 阶段1：警告确认弹窗
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 入口：合并纪要按钮点击时调。有活跃后台任务 → 恢复视图；否则 → 警告→配置
// ═══════════════════════════════════════════════════════════════

export function openChronicleMerge(): void {
  // [LEGACY-MERGE · DB-ONLY] 台账接管：状态栏合并停用（入口已隐藏，这里兜底拒绝）。
  if (isLedgerTakeover()) {
    showPersistentWarning('台账模式下状态栏合并已停用，请在瑟瑟台账工作台 → 纪要合并操作', '纪要合并');
    return;
  }
  if (isChronicleMergeActive()) {
    showChronicleMergeProgress(getCurrentMergeSession() as MergeSession);
  } else {
    showChronicleMergeWarning(() => showChronicleMergeConfig());
  }
}

// ═══════════════════════════════════════════════════════════════
// 阶段1：警告确认弹窗
// ═══════════════════════════════════════════════════════════════

export function showChronicleMergeWarning(onConfirm: () => void): void {
  const overlay = getOverlay();
  overlay.innerHTML =
    '<div class="' + chroniclePopupClass('db-confirm-popup db-merge-warning') + '">' +
    '<div class="panel-popup-head"><div class="panel-popup-title">' + ubIcon('warning') + ' 纪要合并须知</div>' +
    '<button class="panel-popup-close" id="cmWarnClose">×</button></div>' +
    '<div class="panel-popup-body">' +
    '<ul class="db-merge-warning-list">' +
    '<li>本操作耗时（每段一次 AI 请求，串行）。<b>完成前请勿推进对话、请勿修改数据库</b>，否则合并结果错乱。</li>' +
    '<li>操作完成后<b>请勿重填纪要表</b>（重填会让 AI 重生成覆盖合并结果），<b>必须继续推进对话</b>让 AI 基于新纪要扮演，否则合并结果形同丢失。</li>' +
    '<li>合并全程在内存中进行，最终确认时才一次性写入；<b>写入失败则原数据不变</b>，可安全重试。</li>' +
    '</ul>' +
    '<div class="db-merge-action-row">' +
    '<button class="db-edit-btn" id="cmWarnCancel">取消</button>' +
    '<button class="db-edit-btn primary" id="cmWarnOk" disabled>我已了解，继续（2s）</button>' +
    '</div>' +
    '</div></div>';
  applyDark(overlay);
  overlay.classList.add('show');
  let countdown = 2;
  const okBtn = overlay.querySelector('#cmWarnOk') as HTMLButtonElement;
  const timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      okBtn.disabled = false;
      okBtn.textContent = '我已了解，继续';
    } else {
      okBtn.textContent = '我已了解，继续（' + countdown + 's）';
    }
  }, 1000);
  overlay.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#cmWarnClose') || t.closest('#cmWarnCancel')) {
      clearInterval(timer);
      clearOverlay();
    } else if (t.closest('#cmWarnOk') && !okBtn.disabled) {
      clearInterval(timer);
      clearOverlay();
      onConfirm();
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// 阶段2：范围分段配置弹窗
// ═══════════════════════════════════════════════════════════════

export function showChronicleMergeConfig(): void {
  const allRows = readChronicleRows();
  if (allRows === null) {
    showPersistentWarning('纪要表读取失败，请确认数据库已就绪后重试', '纪要合并');
    return;
  }
  const count = allRows.length;
  const overlay = getOverlay();
  if (count < 2) {
    showPersistentWarning('纪要表至少需要 2 条纪要才能合并（当前 ' + count + ' 条）', '纪要合并');
    return;
  }
  const rowIdToAm = new Map<number, string>();
  for (const r of allRows) rowIdToAm.set(r.row_id, r.code_index);
  overlay.innerHTML =
    '<div class="' + chroniclePopupClass('db-merge-config-popup') + '">' +
    '<div class="panel-popup-head"><div class="panel-popup-title">合并纪要（共 ' + count + ' 条）</div>' +
    '<button class="panel-popup-close" id="cmCfgClose">×</button></div>' +
    '<div class="panel-popup-body">' +
    '<div class="db-merge-form">' +
    '<label>起始行号 <input type="number" id="cmStart" min="1" max="' + count + '" value="1"></label>' +
    '<label>结束行号 <input type="number" id="cmEnd" min="1" max="' + count + '" value="' + count + '"></label>' +
    '<div class="cm-mode-row"><span class="cm-mode-label">合并方式</span>' +
    '<label class="cm-radio"><input type="radio" name="cmMode" value="fixedSize" checked> 按段大小</label>' +
    '<label class="cm-radio"><input type="radio" name="cmMode" value="timeSpan"> 时间智能合并</label>' +
    '</div>' +
    '<label class="cm-cond cm-cond-fixedSize">每段几条 <input type="number" id="cmSize" min="2" max="20" value="5"></label>' +
    '<label class="cm-cond cm-cond-timeSpan" style="display:none">时间跨度(小时) <input type="number" id="cmHours" min="1" max="168" value="24"></label>' +
    '<label>最大重试 <input type="number" id="cmRetry" min="0" max="10" value="3"></label>' +
    '<label>纪要最大字数 <input type="number" id="cmWords" min="100" max="750" value="600"></label>' +
    '</div>' +
    '<div class="db-merge-preview" id="cmPreview">—</div>' +
    '<div class="cm-am-section">' +
    '<div class="cm-am-section-title">▼ 纪要预览（点击 AM 查看内容；起止行号请在上方输入）</div>' +
    '<div class="cm-am-grid" id="cmAmGrid"></div>' +
    '<div class="cm-am-detail" id="cmAmDetail">点击上方 AM 查看内容</div>' +
    '</div>' +
    '<div class="db-merge-action-row">' +
    '<button class="db-edit-btn" id="cmCfgCancel">取消</button>' +
    '<button class="db-edit-btn primary" id="cmCfgOk">开始合并</button>' +
    '</div>' +
    '</div></div>';
  applyDark(overlay);
  overlay.classList.add('show');
  const $start = overlay.querySelector('#cmStart') as HTMLInputElement;
  const $end = overlay.querySelector('#cmEnd') as HTMLInputElement;
  const $size = overlay.querySelector('#cmSize') as HTMLInputElement;
  const $hours = overlay.querySelector('#cmHours') as HTMLInputElement;
  const $retry = overlay.querySelector('#cmRetry') as HTMLInputElement;
  const $words = overlay.querySelector('#cmWords') as HTMLInputElement;
  const $preview = overlay.querySelector('#cmPreview') as HTMLElement;
  const $ok = overlay.querySelector('#cmCfgOk') as HTMLButtonElement;
  const $grid = overlay.querySelector('#cmAmGrid') as HTMLElement;
  const $detail = overlay.querySelector('#cmAmDetail') as HTMLElement;
  const $sizeLabel = overlay.querySelector('.cm-cond-fixedSize') as HTMLElement;
  const $hoursLabel = overlay.querySelector('.cm-cond-timeSpan') as HTMLElement;

  const getMode = (): 'fixedSize' | 'timeSpan' => {
    const checked = overlay.querySelector('input[name="cmMode"]:checked') as HTMLInputElement | null;
    return checked && checked.value === 'timeSpan' ? 'timeSpan' : 'fixedSize';
  };

  const renderGrid = () => {
    const s = Number($start.value);
    const e = Number($end.value);
    const chatKey = getCurrentChatKeyOrNull();
    $grid.innerHTML = allRows.map(r => {
      const inRange = isFinite(s) && isFinite(e) && r.row_id >= s && r.row_id <= e;
      let cls = 'cm-am-btn' + (inRange ? ' is-in-range' : '');
      let inner = esc(r.code_index);
      let title = '';
      if (chatKey) {
        const cnt = getMergedCount(chatKey, { time_span: r.time_span });
        if (cnt != null) {
          cls += ' is-merged';
          title = cnt >= 2 ? ('AI 合并产物（' + cnt + '合一）') : 'AI 合并产物';
          if (cnt >= 2) inner += '<span class="cm-am-merged-mark">' + esc(cnt) + '</span>';
        }
      }
      return '<button class="' + cls + '" data-row="' + r.row_id + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + inner + '</button>';
    }).join('');
  };

  const refresh = () => {
    const s = Number($start.value);
    const e = Number($end.value);
    const mode = getMode();
    const words = Number($words.value);
    $sizeLabel.style.display = mode === 'fixedSize' ? '' : 'none';
    $hoursLabel.style.display = mode === 'timeSpan' ? '' : 'none';
    if (!isFinite(s) || !isFinite(e) || s < 1 || e < s || e > count) {
      $preview.innerHTML = '范围无效';
      $ok.disabled = true;
      renderGrid();
      return;
    }
    if (!isFinite(words) || words < 100 || words > 750) {
      $preview.innerHTML = '纪要最大字数无效（100~750）';
      $ok.disabled = true;
      renderGrid();
      return;
    }
    const retry = Number($retry.value);
    if (!isFinite(retry) || retry < 0 || retry > 10) {
      $preview.innerHTML = '最大重试无效（0~10）';
      $ok.disabled = true;
      renderGrid();
      return;
    }
    const total = e - s + 1;
    const amS = rowIdToAm.get(s) || ('行' + s);
    const amE = rowIdToAm.get(e) || ('行' + e);
    if (mode === 'fixedSize') {
      const sz = Number($size.value);
      if (!isFinite(sz) || sz < 2 || sz > 20) { $preview.innerHTML = '每段几条无效（2~20）'; $ok.disabled = true; renderGrid(); return; }
      const segs = computeSegments(allRows, s, e, sz, Number($retry.value));
      $ok.disabled = false;
      $preview.innerHTML = '范围 <b>' + esc(amS) + ' ~ ' + esc(amE) + '</b>（' + total + ' 条）→ 按段大小(' + sz + '条/段) → 分 <b>' + segs.length + '</b> 段' +
        segs.map(seg => '<div class="cm-seg-line">段' + (seg.index + 1) + ' ' + esc(seg.amRange) + ' (' + seg.origEntries.length + '条' + (seg.origEntries.length < sz ? '·末段' : '') + ')</div>').join('');
    } else {
      const hrs = Number($hours.value);
      if (!isFinite(hrs) || hrs < 1 || hrs > 168) { $preview.innerHTML = '时间跨度无效（1~168 小时）'; $ok.disabled = true; renderGrid(); return; }
      const segs = computeTimeSegments(allRows, s, e, hrs, Number($retry.value));
      $ok.disabled = false;
      $preview.innerHTML = '范围 <b>' + esc(amS) + ' ~ ' + esc(amE) + '</b>（' + total + ' 条）→ 时间智能(' + hrs + 'h/段) → 分 <b>' + segs.length + '</b> 段' +
        segs.map((seg, idx) => {
          const spanTxt = seg.origEntries.length === 1 ? '·无需合并' : ('·' + segSpanHours(seg) + 'h');
          const tail = idx === segs.length - 1 ? '·末段' : '';
          return '<div class="cm-seg-line">段' + (seg.index + 1) + ' ' + esc(seg.amRange) + ' (' + seg.origEntries.length + '条' + spanTxt + tail + ')</div>';
        }).join('');
    }
    renderGrid();
  };
  unbindCmRefresh(overlay);
  _cmBoundRefresh = refresh;
  overlay.addEventListener('input', refresh);
  overlay.addEventListener('change', refresh);
  refresh();
  overlay.onclick = (e) => {
    const t = e.target as HTMLElement;
    const amBtn = t.closest('.cm-am-btn') as HTMLElement | null;
    if (amBtn) {
      const rowId = Number(amBtn.getAttribute('data-row'));
      const r = allRows.find(x => x.row_id === rowId);
      if (r) {
        $detail.innerHTML =
          '<div class="cm-am-detail-head">' + esc(r.code_index) + '</div>' +
          '<div><b>时间跨度：</b>' + esc(r.time_span) + '</div>' +
          '<div><b>概览：</b>' + esc(r.summary) + '</div>' +
          '<div><b>纪要：</b>' + esc(r.chronicle_text) + '</div>' +
          '<div><b>重要对话：</b>' + (esc(r.key_dialogue) || '（空）') + '</div>';
      }
      return;
    }
    if (t.closest('#cmCfgClose') || t.closest('#cmCfgCancel')) {
      clearOverlay();
    } else if (t.closest('#cmCfgOk') && !$ok.disabled) {
      const mode = getMode();
      const session: MergeSession = {
        startRow: Number($start.value),
        endRow: Number($end.value),
        segmentSize: Number($size.value),
        maxRetries: Number($retry.value),
        maxWords: Number($words.value),
        mergeMode: mode,
        thresholdHours: mode === 'timeSpan' ? Number($hours.value) : undefined,
        // 聊天归属：session 跨多次 AI 请求，提交/续跑前要用它核对仍在发起时那个聊天。
        chatKey: getCurrentChatKeyOrNull() || '',
        segments: [],
        aborted: false,
        startedAt: Date.now(),
      };
      const allRowsNow = readChronicleRows();
      if (allRowsNow === null) {
        showPersistentError('纪要表读取失败，请确认数据库已就绪后重试', '纪要合并');
        return;
      }
      session.segments = mode === 'timeSpan'
        ? computeTimeSegments(allRowsNow, session.startRow, session.endRow, Number($hours.value), session.maxRetries)
        : computeSegments(allRowsNow, session.startRow, session.endRow, session.segmentSize, session.maxRetries);
      saveSessionCheckpoint(session);
      clearOverlay();
      void startBackgroundMerge(session);
      showChronicleMergeProgress(session);
    }
  };
}

/** 段时间跨度（小时），用于时间智能分段预览展示。解析失败返回 0。 */
function segSpanHours(seg: SegmentState): number {
  if (seg.origEntries.length === 0) return 0;
  const start = parseChronicleTime(seg.origEntries[0].time_span, 'start');
  const end = parseChronicleTime(seg.origEntries[seg.origEntries.length - 1].time_span, 'end');
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 3600000));
}

// ═══════════════════════════════════════════════════════════════
// 阶段3：进度面板
// ═══════════════════════════════════════════════════════════════

function segmentCardHtml(s: SegmentState): string {
  const statusIcon: Record<string, string> = { pending: ubIcon('clock'), running: ubIcon('refresh'), success: ubIcon('check'), failed: ubIcon('close'), skipped: ubIcon('arrow-right'), omitted: '—' };
  const statusText: Record<string, string> = { pending: '待处理', running: '进行中', success: '成功', failed: '失败', skipped: '未执行', omitted: '单条·无需合并' };
  const preview =
    s.status === 'success' && s.merged
      ? '<div class="db-merge-segment-preview">' +
        '<div><b>概览：</b>' +
        esc(s.merged.summary) +
        '</div>' +
        '<div><b>时间：</b>' +
        esc(s.merged.time_span) +
        '</div>' +
        '<div><b>纪要：</b>' +
        esc(s.merged.chronicle_text) +
        '</div>' +
        '<div><b>重要对话：</b>' +
        (esc(s.merged.key_dialogue) || '（空）') +
        '</div>' +
        '</div>'
      : '';
  const err = s.error ? '<div class="db-merge-segment-error">' + esc(s.error) + '</div>' : '';
  const retry = s.retries > 0 ? '<span class="db-merge-segment-retry">重试 ' + s.retries + '/' + s.maxRetries + '</span>' : '';
  const checked = s.status === 'failed' ? 'checked' : '';
  const checkHtml = s.status === 'omitted'
    ? '<span class="db-merge-segment-status" style="flex:0 0 auto"></span>'
    : '<input type="checkbox" class="db-merge-segment-check" data-seg-check="' + s.index + '" ' + checked + '>';
  return (
    '<div class="db-merge-segment-card is-' +
    s.status +
    '" data-seg="' +
    s.index +
    '">' +
    '<div class="db-merge-segment-head">' +
    checkHtml +
    '<span class="db-merge-segment-icon">' +
    statusIcon[s.status] +
    '</span>' +
    '<span class="db-merge-segment-am">' +
    esc(s.amRange) +
    '</span>' +
    '<span class="db-merge-segment-status">' +
    statusText[s.status] +
    '</span>' +
    retry +
    '</div>' +
    err +
    preview +
    '</div>'
  );
}

function runningActionsHtml(hasAbort: boolean): string {
  return (
    '<div class="db-merge-action-row" id="cmProgActions">' +
    (hasAbort ? '<button class="db-edit-btn db-danger" id="cmProgAbort">中断合并</button>' : '') +
    '</div>'
  );
}

function postInterruptActionsHtml(session: MergeSession): string {
  const hasSuccess = session.segments.some(s => s.status === 'success');
  const hasPending = session.segments.some(s => s.status === 'pending' || s.status === 'skipped');
  return (
    '<div class="db-merge-action-row" id="cmProgActions">' +
    (hasPending ? '<button class="db-edit-btn" id="cmPostContinue">继续未完成</button>' : '') +
    '<button class="db-edit-btn" id="cmPostRegen">重新生成选中</button>' +
    '<button class="db-edit-btn db-danger" id="cmPostDiscard">结束并放弃全部</button>' +
    '<button class="db-edit-btn primary" id="cmPostCommit"' +
    (hasSuccess ? '' : ' disabled') +
    '>结束并替换已完成</button>' +
    '</div>'
  );
}

function confirmReplaceActionsHtml(): string {
  return (
    '<div class="db-merge-action-row" id="cmProgActions">' +
    '<span class="db-merge-confirm-text">确认用已完成段替换纪要表？未完成段保留原条目，后缀行号重排。</span>' +
    '<button class="db-edit-btn" id="cmConfirmCancel">取消</button>' +
    '<button class="db-edit-btn primary" id="cmConfirmOk">确认替换</button>' +
    '</div>'
  );
}

export function showChronicleMergeProgress(session: MergeSession): void {
  const overlay = getOverlay();
  // 退订旧视图监听（防重复进入泄漏）
  if (_currentUnsub) {
    _currentUnsub();
  }
  _viewOpen = true;

  const renderAll = () => {
    const body = overlay.querySelector('#cmProgBody');
    if (body) body.innerHTML = session.segments.map(segmentCardHtml).join('');
    const done = session.segments.filter(s => s.status === 'success' || s.status === 'failed' || s.status === 'skipped').length;
    const cur = session.segments.find(s => s.status === 'running');
    const title = overlay.querySelector('#cmProgTitle') as HTMLElement | null;
    if (title) title.textContent = '段 ' + done + '/' + session.segments.length + (cur ? ' · 正在合并 ' + cur.amRange : '');
    const bar = overlay.querySelector('#cmProgBar') as HTMLElement | null;
    if (bar) bar.style.width = Math.round((done / Math.max(1, session.segments.length)) * 100) + '%';
  };

  const setActions = (html: string) => {
    const act = overlay.querySelector('#cmProgActions');
    if (act) {
      const parent = act.parentElement;
      if (parent) {
        act.outerHTML = html;
        applyDark(overlay);
      }
    }
  };

  // 初始 action row：运行中显示中断按钮；已完成显示四动作
  const initialActions = isChronicleMergeRunning() ? runningActionsHtml(true) : postInterruptActionsHtml(session);

  overlay.innerHTML =
    '<div class="' + chroniclePopupClass('db-merge-progress-popup') + '">' +
    '<div class="panel-popup-head"><div class="panel-popup-title" id="cmProgTitle">段 0/' +
    session.segments.length +
    '</div>' +
    '<button class="panel-popup-close" id="cmProgClose">×</button></div>' +
    '<div class="panel-popup-body">' +
    '<div class="db-merge-progress-bar-wrap"><div class="db-merge-progress-bar" id="cmProgBar" style="width:0"></div></div>' +
    '<div id="cmProgBody"></div>' +
    initialActions +
    '</div></div>';
  applyDark(overlay);
  overlay.classList.add('show');
  renderAll();

  // 订阅后台进度/完成（×关闭界面时退订，但后台进程不停）
  const unsubProgress = onMergeProgress(() => renderAll());
  const unsubComplete = onMergeComplete((sess) => {
    renderAll();
    setActions(postInterruptActionsHtml(sess));
  });
  _currentUnsub = () => {
    unsubProgress();
    unsubComplete();
    _viewOpen = false;
    _currentUnsub = null;
  };
  // F2（弹窗接管泄漏）：进度视图开着时 overlay 被其它弹窗直接重写（如点物品/任务/备忘
  // 按钮），订阅没有退订时机——长合并期间每次进度事件都在驱动已脱离的 DOM，且重开视图
  // 会再叠加一对订阅。root 被移出 overlay 即就地退订（与 × 关闭同语义：界面退订、后台进程不停）。
  const progressRoot = overlay.firstElementChild;
  if (progressRoot) {
    const progressTakeover = new MutationObserver(() => {
      if (overlay.contains(progressRoot)) return;
      progressTakeover.disconnect();
      if (_currentUnsub) _currentUnsub();
    });
    progressTakeover.observe(overlay, { childList: true });
  }

  // 主点击委托（×仅关界面不停后台；中断按钮才真正终止后台）
  overlay.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#cmProgClose')) {
      if (_currentUnsub) {
        _currentUnsub();
      }
      clearOverlay();
      return;
    }
    if (t.closest('#cmProgAbort')) {
      abortCurrentMerge();
      return;
    }
    if (t.closest('#cmPostContinue')) {
      session.segments.forEach(s => {
        if (s.status === 'pending' || s.status === 'skipped') {
          s.status = 'pending';
          s.retries = 0;
        }
      });
      setActions(runningActionsHtml(true));
      void startBackgroundMerge(session);
      return;
    }
    if (t.closest('#cmPostRegen')) {
      overlay.querySelectorAll('.db-merge-segment-check').forEach((cb) => {
        const c = cb as HTMLInputElement;
        if (c.checked) {
          const idx = Number(c.getAttribute('data-seg-check'));
          const s = session.segments[idx];
          if (s) {
            s.status = 'pending';
            s.retries = 0;
            s.merged = undefined;
            s.error = undefined;
          }
        }
      });
      setActions(runningActionsHtml(true));
      void startBackgroundMerge(session);
      return;
    }
    if (t.closest('#cmPostDiscard')) {
      if (_currentUnsub) {
        _currentUnsub();
      }
      clearSessionCheckpoint();
      clearCurrentMerge();
      clearOverlay();
      return;
    }
    if (t.closest('#cmPostCommit')) {
      setActions(confirmReplaceActionsHtml());
      return;
    }
    if (t.closest('#cmConfirmCancel')) {
      setActions(postInterruptActionsHtml(session));
      return;
    }
    if (t.closest('#cmConfirmOk')) {
      void commitAndClose(session, setActions);
      return;
    }
  };
}

async function commitAndClose(
  session: MergeSession,
  setActions: (html: string) => void,
): Promise<void> {
  // [LEGACY-MERGE · DB-ONLY] 台账模式禁止状态栏写库（旧会话在提交前兜底拦下）。
  if (isLedgerTakeover()) {
    showPersistentError('台账模式下状态栏合并已停用，请在台账工作台 → 纪要合并提交', '纪要合并');
    return;
  }
  setActions(
    '<div class="db-merge-action-row" id="cmProgActions"><span class="db-merge-confirm-text">正在写入纪要表…</span></div>',
  );
  const r = await commitMerge(session);
  if (r.ok) {
    if (_currentUnsub) {
      _currentUnsub();
    }
    clearOverlay();
    showPersistentWarning('记得继续推进对话，勿重填纪要表（否则合并结果会被覆盖）', '纪要合并完成');
  } else {
    showPersistentError(r.error || '未知错误', '纪要合并提交失败（原表未变）');
    setActions(postInterruptActionsHtml(session));
  }
}

// ═══════════════════════════════════════════════════════════════
// 启动 session 恢复提示（数据库弹窗打开时调）
// ═══════════════════════════════════════════════════════════════

export function showChronicleMergeResumePrompt(): void {
  // [LEGACY-MERGE · DB-ONLY] 台账接管：不恢复状态栏合并会话。
  if (isLedgerTakeover()) return;
  const sess = loadSessionCheckpoint();
  if (!sess) return;
  // 聊天归属守卫：检查点属于另一个聊天 → 不在本聊天提示（也不清掉，切回原聊天仍可恢复）。
  const currentKey = getCurrentChatKeyOrNull();
  if (sess.chatKey && currentKey && sess.chatKey !== currentKey) return;
  const overlay = getOverlay();
  const body = overlay.querySelector('.panel-popup-body');
  if (!body) return;
  const hint = document.createElement('div');
  hint.className = 'db-merge-resume-hint';
  hint.innerHTML =
    '<span>检测到上次未完成的纪要合并（' +
    sess.segments.length +
    ' 段）。</span>' +
    '<button class="db-edit-btn primary" id="cmResumeOk">恢复</button>' +
    '<button class="db-edit-btn" id="cmResumeDrop">丢弃</button>';
  body.prepend(hint);
  hint.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#cmResumeDrop')) {
      clearSessionCheckpoint();
      hint.remove();
    } else if (t.closest('#cmResumeOk')) {
      hint.remove();
      // 恢复：重启后台合并跑 pending 段 + 显示视图
      void startBackgroundMerge(sess);
      showChronicleMergeProgress(sess);
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// 一键修复编号（二次确认 + 原子写 + 完成通知）
// ═══════════════════════════════════════════════════════════════

export function openChronicleRepair(): void {
  // [LEGACY-MERGE · DB-ONLY] 台账接管：一键修复停用（入口已隐藏，这里兜底拒绝）。
  if (isLedgerTakeover()) {
    showPersistentWarning('台账模式下状态栏一键修复已停用，请在瑟瑟台账工作台 → 纪要合并操作', '纪要修复');
    return;
  }
  const overlay = getOverlay();
  overlay.innerHTML =
    '<div class="' + chroniclePopupClass('db-confirm-popup db-merge-warning') + '">' +
    '<div class="panel-popup-head"><div class="panel-popup-title">' + ubIcon('wrench') + ' 一键修复纪要编号</div>' +
    '<button class="panel-popup-close" id="crpClose">×</button></div>' +
    '<div class="panel-popup-body">' +
    '<ul class="db-merge-warning-list">' +
    '<li>将按当前 <code>row_id</code> 升序，把全部纪要的 <b>row_id</b> 重排为 1,2,3… 连续、<b>code_index</b> 重排为 AM0001,AM0002… 连续，二者顺序对齐。</li>' +
    '<li>其余内容（概览 / 纪要正文 / 时间跨度 / 关键对话）<b>一律不变</b>。</li>' +
    '<li>操作<b>不可撤销</b>，但写入失败则原表不变，可安全重试。</li>' +
    '</ul>' +
    '<div class="db-merge-action-row">' +
    '<button class="db-edit-btn" id="crpCancel">取消</button>' +
    '<button class="db-edit-btn primary" id="crpOk">确认修复</button>' +
    '</div>' +
    '</div></div>';
  applyDark(overlay);
  overlay.classList.add('show');
  overlay.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#crpClose') || t.closest('#crpCancel')) {
      clearOverlay();
    } else if (t.closest('#crpOk')) {
      clearOverlay();
      void runRepair();
    }
  };
}

async function runRepair(): Promise<void> {
  // [LEGACY-MERGE · DB-ONLY] 台账模式禁止状态栏写库（防旧会话/旧入口）。
  if (isLedgerTakeover()) {
    showPersistentError('台账模式下状态栏一键修复已停用', '纪要修复');
    return;
  }
  const r = await repairChronicleNumbering();
  if (r.ok) {
    showPersistentWarning('纪要编号已修复（row_id 与 AM 已连续对齐）。记得继续推进对话，勿重填纪要表（否则修复结果会被覆盖）', '纪要修复完成');
  } else {
    showPersistentError(r.error || '未知错误', '纪要修复失败（原表未变）');
  }
}
