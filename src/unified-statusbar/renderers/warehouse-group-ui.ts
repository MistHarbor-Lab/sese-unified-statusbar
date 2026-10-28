// ===== 仓库分组 UI 共用件：分组条 / 每组总览图卡片 / 目标仓库选择弹窗 =====
// 只做纯渲染与主题化选择弹窗，不直接读写仓库数据（避免与 popup-manager 形成循环依赖）。
import { getConfig } from '../core/config-store';
import { type StyleType } from '../core/constants';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { openDialog, closeDialog } from './confirm-dialog';
import { bridgeWindowClass } from './html-builder';

export interface WarehouseLabels {
  inventory: string;
  /** 仓库弹窗左上返回物品弹窗的短标签（窄屏优先用两字「物品」）。 */
  backToInventory: string;
  warehouse: string;
  put: string;
  remove: string;
  discard: string;
  emptyWarehouse: string;
  emptyInventory: string;
  groupsManage: string;
  newGroup: string;
  deleteGroup: string;
  target: string;
}

/** 仓库相关文案按主题统一出口：古风/舰桥沿用原有叫法，其余主题用通用词。 */
export function warehouseLabels(style: StyleType): WarehouseLabels {
  const ancient = style === 'ancient';
  const bridge = style === 'bridge';
  return {
    inventory: ancient ? '随身' : bridge ? '补给清单' : '物品栏',
    backToInventory: ancient ? '随身' : bridge ? '补给清单' : '物品',
    warehouse: ancient ? '库藏' : bridge ? '补给仓' : '仓库',
    put: ancient ? '纳入库藏' : '放入仓库',
    remove: ancient ? '取出' : '移出仓库',
    discard: ancient ? '弃置' : '丢弃',
    emptyWarehouse: ancient ? '库中无物' : bridge ? '补给仓为空' : '仓库为空',
    emptyInventory: ancient ? '身无长物' : bridge ? '补给清单为空' : '暂无物品',
    groupsManage: '分组管理',
    newGroup: ancient ? '新建库藏' : bridge ? '新建补给仓' : '新建仓库',
    deleteGroup: ancient ? '删除库藏' : bridge ? '删除补给仓' : '删除仓库',
    target: ancient ? '目标库藏' : bridge ? '目标补给仓' : '目标仓库',
  };
}

export interface WarehouseGroupChip {
  id: number;
  name: string;
  count: number;
}

/** 横向滚动的仓库分组条；末尾＋号由调用方接新建逻辑。 */
export function buildWarehouseGroupBar(
  groups: readonly WarehouseGroupChip[],
  activeGroupId: number,
  addTitle: string,
): string {
  let html = '<div class="wh-groupbar"><div class="wh-group-chips">';
  for (const group of groups) {
    html += '<button class="panel-popup-warehouse-toggle wh-group-chip'
      + (group.id === activeGroupId ? ' active' : '')
      + '" data-wh-group="' + group.id + '" title="' + escapeHtmlAttr(group.name) + '">'
      + escapeHtml(group.name)
      + '<span class="wh-group-count">' + group.count + '</span>'
      + '</button>';
  }
  html += '</div>';
  html += '<button class="panel-popup-warehouse-toggle wh-group-add" data-wh-action="add-group" title="'
    + escapeHtmlAttr(addTitle) + '">＋</button>';
  html += '</div>';
  return html;
}

export interface WarehouseImageCardOptions {
  /** 已通过 isSafeStoredImagePath 校验的图片路径；无图传 null。 */
  imageSrc: string | null;
  /** 无图占位的短提示（主题化，如「生成一览图」）。 */
  emptyHint: string;
  /** 物品与生成时不一致时，封面右上角显示「已变更」角标。 */
  stale: boolean;
}

/** 当前分组的独立总览图封面：有图整图可点，无图细条占位；均进入该组总览面板。 */
export function buildWarehouseImageCard(opts: WarehouseImageCardOptions): string {
  if (!opts.imageSrc) {
    return '<button class="wh-cover-empty" data-wh-action="overview" title="'
      + escapeHtmlAttr(opts.emptyHint) + '">'
      + '<span class="wh-cover-plus">＋</span><span>' + escapeHtml(opts.emptyHint) + '</span></button>';
  }
  return '<button class="wh-cover" data-wh-action="overview" title="点击编辑或重新生成总览图"'
    + ' aria-label="仓库总览图，点击编辑或重新生成">'
    + '<img src="' + escapeHtmlAttr(opts.imageSrc) + '" alt="">'
    + (opts.stale ? '<span class="wh-stale-pill">已变更</span>' : '')
    + '</button>';
}

export interface WarehouseTargetOption {
  id: number;
  name: string;
  count: number;
}

export interface WarehouseTargetPick {
  groupId: number;
  copy: boolean;
}

export interface WarehouseTargetDialogOptions {
  title: string;
  message: string;
  groups: WarehouseTargetOption[];
  selectedId?: number;
  /** 是否显示移动/复制二选一（入库用；组间转移/合并/删除不显示）。 */
  allowCopy?: boolean;
  copyDefault?: boolean;
  okText?: string;
  danger?: boolean;
  /** 固定提示文案（入库/转移）。 */
  note?: string;
  /** 随目标分组变化的提示（合并/删除源组总览图去向）。 */
  noteFor?: (groupId: number) => string;
  /** 复制模式实时查重：返回与目标分组同名的物品名；非空则禁用确认。 */
  copyConflictsFor?: (groupId: number) => string[];
}

/**
 * 目标仓库选择弹窗（入库 / 组间转移 / 合并 / 删除共用）。
 * 返回 null 表示取消；copy 仅在 allowCopy 时为 true。
 */
export function showWarehouseTargetDialog(opts: WarehouseTargetDialogOptions): Promise<WarehouseTargetPick | null> {
  return new Promise(resolve => {
  const style = getConfig().style;
  const labels = warehouseLabels(style);
  const dialogClass = style === 'bridge'
    ? bridgeWindowClass('confirm', 's')
    : 'panel-popup ub-popup--s';
  const groups = Array.isArray(opts.groups) ? opts.groups : [];
  let selectedId = opts.selectedId != null && groups.some(group => group.id === opts.selectedId)
    ? opts.selectedId
    : (groups[0]?.id ?? null);
  let copy = !!opts.copyDefault;

  let groupRows = '';
  for (const group of groups) {
    groupRows += '<button type="button" class="wh-pick-row' + (group.id === selectedId ? ' selected' : '')
      + '" data-wh-pick-group="' + group.id + '">'
      + '<span class="wh-pick-radio">✓</span>'
      + '<span class="wh-pick-name">' + escapeHtml(group.name) + '</span>'
      + '<span class="wh-pick-count">' + group.count + ' 件</span>'
      + '</button>';
  }

  let modeHtml = '';
  if (opts.allowCopy) {
    modeHtml = '<div class="wh-pick-section"><div class="wh-pick-label">入库方式</div><div class="wh-mode">'
      + '<button type="button" class="wh-mode-opt' + (!copy ? ' selected' : '') + '" data-wh-pick-mode="move">'
      + '<span class="wh-mode-dot">✓</span><span class="wh-mode-copy"><b>移动</b><small>从'
      + escapeHtml(labels.inventory) + '移除，仓库保存一份（当前行为）</small></span></button>'
      + '<button type="button" class="wh-mode-opt' + (copy ? ' selected' : '') + '" data-wh-pick-mode="copy">'
      + '<span class="wh-mode-dot">✓</span><span class="wh-mode-copy"><b>复制</b><small>'
      + escapeHtml(labels.inventory) + '保留原件，仓库新增一份；目标仓库已有同名物品时不可复制</small></span></button>'
      + '</div></div>';
  }

  const hasNote = !!(opts.note || opts.noteFor || opts.copyConflictsFor);
  const noteHtml = hasNote ? '<div class="wh-put-note" data-wh-note></div>' : '';
  const okClass = opts.danger ? 'ub-confirm-btn-danger' : 'ub-confirm-btn-ok';
  const body = '<div class="' + dialogClass + ' ub-confirm-dialog wh-put-dialog">'
    + '<div class="ub-confirm-title">' + escapeHtml(opts.title) + '</div>'
    + '<div class="ub-confirm-message">'
    + '<div class="wh-pick-sub">' + escapeHtml(opts.message) + '</div>'
    + '<div class="wh-pick-section"><div class="wh-pick-label">' + escapeHtml(labels.target) + '</div>'
    + '<div class="wh-pick-list">' + (groupRows || '<div class="wh-pick-empty">没有可选仓库</div>') + '</div></div>'
    + modeHtml
    + noteHtml
    + '</div>'
    + '<div class="ub-confirm-btns">'
    + '<button class="ub-confirm-btn" data-wh-cancel>取消</button>'
    + '<button class="ub-confirm-btn ' + okClass + '" data-wh-ok' + (groups.length ? '' : ' disabled') + '>'
    + escapeHtml(opts.okText || '确定') + '</button>'
    + '</div></div>';

  const { overlay } = openDialog(body, { focusSel: '[data-wh-pick-group].selected' });
  const noteEl = overlay.querySelector<HTMLElement>('[data-wh-note]');
  const okBtn = overlay.querySelector<HTMLButtonElement>('[data-wh-ok]');

  const sync = (): void => {
    overlay.querySelectorAll<HTMLElement>('[data-wh-pick-group]').forEach(el => {
      el.classList.toggle('selected', Number(el.getAttribute('data-wh-pick-group')) === selectedId);
    });
    overlay.querySelectorAll<HTMLElement>('[data-wh-pick-mode]').forEach(el => {
      const isCopy = el.getAttribute('data-wh-pick-mode') === 'copy';
      el.classList.toggle('selected', isCopy === copy);
    });

    const conflicts = opts.allowCopy && copy && selectedId != null && opts.copyConflictsFor
      ? opts.copyConflictsFor(selectedId)
      : [];
    let noteText = '';
    let noteDanger = false;
    if (conflicts.length) {
      noteText = '目标仓库（或本批选择）已有同名物品：' + conflicts.join('、') + '。复制被禁止；请换一个仓库，或改用「移动」。';
      noteDanger = true;
    } else if (opts.noteFor && selectedId != null) {
      noteText = opts.noteFor(selectedId) || '';
      noteDanger = !!opts.danger;
    } else if (opts.note) {
      noteText = opts.note;
      noteDanger = !!opts.danger;
    }
    if (noteEl) {
      noteEl.textContent = noteText;
      noteEl.style.display = noteText ? '' : 'none';
      noteEl.className = 'wh-put-note' + (noteDanger ? ' danger' : '');
    }
    if (okBtn) okBtn.disabled = selectedId == null || conflicts.length > 0;
  };

  sync();
  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target === overlay) { closeDialog(overlay); resolve(null); return; }
    if (target.closest('[data-wh-cancel]')) { closeDialog(overlay); resolve(null); return; }
    if (target.closest('[data-wh-ok]')) {
      if (selectedId == null || okBtn?.disabled) return;
      closeDialog(overlay);
      resolve({ groupId: selectedId, copy });
      return;
    }
    const pick = target.closest<HTMLElement>('[data-wh-pick-group]');
    if (pick) {
      selectedId = Number(pick.getAttribute('data-wh-pick-group'));
      sync();
      return;
    }
    const mode = target.closest<HTMLElement>('[data-wh-pick-mode]');
    if (mode) {
      copy = mode.getAttribute('data-wh-pick-mode') === 'copy';
      sync();
    }
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(overlay); resolve(null); }
  });
  });
}
