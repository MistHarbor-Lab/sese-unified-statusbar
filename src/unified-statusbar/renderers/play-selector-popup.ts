// ===== 瑟瑟玩法选择器弹窗（多选翻新 · mockup 像素级还原）=====
// 视图层级：选择器主视图（搜索/筛选/收藏/列表/详情/已选栏）→ ⚙ 管理视图
// （类别管理/条目管理/导入导出）→ 编辑表单（新建/编辑/复制内置）。同一 #panelOverlay
// 槽全量重绘；搜索输入只重绘列表区保焦点；列表滚动懒加载每批 60 条。
// 勾选即时生效：writeSelectedPlays + syncPlayWorldbook + 状态栏 chips 刷新 + 成就打点，
// 与翻新前 select 变更即写即注入的行为一致（无确认按钮语义）。
// 交互/视觉 spec 见 .mockup/瑟瑟玩法翻新-mockup.html（屏 2-8）；本文与其 1:1 对应。
import { getConfig } from '../core/config-store';
import { getToastr } from '../core/env';
import type { StyleType } from '../core/constants';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { ubIcon, type IconName } from '../core/icons';
import { triggerBlobDownload } from '../core/zip-store';
import { showConfirmDialog } from './confirm-dialog';
import {
  syncDarkClass, syncDarkClassMinimal, closePanelOverlay, guardGhostClick, markPopupShown, refreshPlayChipsUI,
} from './html-builder';
import { showPlayImagePopup } from './popup-manager';
import { ensureStyleOnce } from './style-once';
import { getPlayImageList, getPlayImages } from '../core/play-images';
import { syncPlayWorldbook } from '../core/play-worldbook';
import { readSelectedPlays, writeSelectedPlays, clearPlayState, type SelectedPlay } from '../core/play-state-store';
import {
  getPlayLibrary, listVisiblePlays, listCategories, listHiddenBuiltinPlays, findPlayAnywhere,
  filterPlays, pickRandomPlay, playCategoryLabel, playCategoryColor,
  toggleFavorite, hideBuiltinPlay, restoreBuiltinPlay, setBuiltinCategoryHidden,
  saveCustomPlay, deleteCustomPlay, isPlayNameTaken,
  addCustomCategory, renameCustomCategory, deleteCustomCategory,
  parsePlayLibraryImport, previewPlayImport, applyPlayImport, applyPlayLibraryBackupRestore,
  buildPlayLibraryExport, buildPlayLibraryTemplate, getPlayMaxSelected,
  PLAY_LIBRARY_FORMAT, UNCATEGORIZED_KEY,
  type PlayEntry,
} from '../core/play-library';

const LIST_BATCH = 60;

type ManageTab = 'cats' | 'entries' | 'io';

interface UiState {
  view: 'select' | 'manage';
  manageTab: ManageTab;
  /** 编辑表单：null 关闭；original 为空 = 新建（带 draft 时预填，如「复制为自定义」草稿）；
   *  有值 = 编辑该自定义条目。 */
  form: { original: string; draft?: { name: string; category: string; content: string } } | null;
  query: string;
  /** '全部' | '★收藏' | 类别 key。 */
  category: string;
  favoritesOnly: boolean;
  activeName: string | null;
  rendered: number;
  drawerOpen: boolean;
  /** 条目管理里展开查看内容的条目名（一次一个，行内展开）。 */
  expandedEntry: string | null;
}

let _ui: UiState = {
  view: 'select', manageTab: 'cats', form: null,
  query: '', category: '全部', favoritesOnly: false,
  activeName: null, rendered: LIST_BATCH, drawerOpen: false,
  expandedEntry: null,
};

function emitAchievement(event: string): void {
  try { (window as any).__ubEmitAchievement?.(event, {}); } catch (_e) { /* ignore */ }
}

// ===== CSS（psp- 前缀；颜色走主题 token 级联 + 字面量兜底，无硬编码主色） =====

function ensureSelectorStyle(): void {
  ensureStyleOnce('ub-play-selector', `
.psp-popup{display:flex;flex-direction:column;width:960px;max-width:calc(100% - 48px);height:660px;max-height:calc(100% - 48px);background:var(--ub-bg-card,#fff);border:1px solid var(--ub-divider,#ddd);border-radius:12px;overflow:hidden;color:var(--ub-text,#333);box-shadow:0 18px 60px rgba(0,0,0,.45);font-size:13px}
.psp-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(180deg,var(--head-from,var(--ub-bg-card,#fff)),var(--head-to,var(--ub-bg-card,#fff)));border-bottom:1px solid var(--ub-divider,#ddd)}
.psp-head .psp-title{font-weight:700;font-size:15px}
.psp-head .psp-mgmt{margin-left:auto;border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit}
.psp-head .psp-mgmt:hover{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0))}
.psp-head .psp-mgmt.back{margin-left:0;margin-right:auto}
.psp-head .psp-close{width:26px;height:26px;border:1px solid var(--ub-divider,#ddd);border-radius:6px;background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));cursor:pointer;display:grid;place-items:center;padding:0}
.psp-head .psp-close svg{width:13px;height:13px}
.psp-toolbar{flex:0 0 auto;display:flex;gap:8px;align-items:center;padding:10px 14px 8px}
.psp-search{flex:1;display:flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid var(--ub-divider,#ddd);border-radius:8px;background:var(--bg-alt,var(--ub-bg-card,#fff))}
.psp-search svg{width:13px;height:13px;color:var(--text-muted,#999);flex:0 0 auto}
.psp-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ub-text,#333);font:inherit;font-size:13px}
.psp-toolbtn{border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;font-family:inherit;display:inline-flex;align-items:center;gap:4px}
.psp-toolbtn svg{width:12px;height:12px}
.psp-toolbtn.on{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0));background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)))}
.psp-toolbtn:hover{border-color:var(--lust,var(--ub-accent,#9050c0))}
.psp-cats{flex:0 0 auto;display:flex;gap:6px;padding:0 14px 10px;overflow-x:auto;scrollbar-width:thin}
.psp-cat{flex:0 0 auto;border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:12px;padding:4px 11px;border-radius:13px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
.psp-cat .psp-cat-n{font-size:10px;color:var(--text-muted,#999)}
.psp-cat .psp-dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px}
.psp-cat.on{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0));background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)))}
.psp-cat.zdy{border-style:dashed}
.psp-body{flex:1 1 auto;min-height:0;display:flex;position:relative}
.psp-list{flex:1 1 55%;min-width:0;overflow-y:auto;border-right:1px solid var(--ub-divider,#ddd);padding:6px 8px}
.psp-detail{flex:1 1 45%;min-width:0;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.psp-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent}
.psp-row:hover{background:var(--lust-bg-hover,var(--ub-hover-bg,rgba(144,80,192,.1)))}
.psp-row.active{background:var(--lust-bg-active,var(--ub-hover-bg,rgba(144,80,192,.12)));border-color:var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)))}
.psp-row .psp-nm{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psp-row .psp-nm .psp-imgico{font-size:10px;display:inline-flex;align-items:center;vertical-align:-1px}
.psp-row .psp-nm .psp-imgico .ub-ic{width:10px;height:10px}
.psp-row .psp-badge{flex:0 0 auto;font-size:10px;padding:1px 7px;border-radius:9px;border:1px solid var(--ub-divider,#ddd);color:var(--text-muted,#999);white-space:nowrap}
.psp-row .psp-badge.zdy{color:var(--lust,var(--ub-accent,#9050c0));border-color:var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)))}
.psp-row .psp-fav{flex:0 0 auto;border:0;background:transparent;color:var(--text-muted,#999);cursor:pointer;font-size:14px;padding:2px;line-height:1;width:24px;height:24px}
.psp-row .psp-fav.on{color:#e8a020}
.psp-row .psp-fav svg{width:13px;height:13px;vertical-align:-2px}
.psp-row .psp-check{flex:0 0 auto;width:22px;height:22px;border-radius:6px;border:1.5px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);cursor:pointer;display:grid;place-items:center;padding:0}
.psp-row .psp-check svg{width:12px;height:12px;color:#fff}
.psp-row .psp-check.on{background:var(--lust,var(--ub-accent,#9050c0));border-color:var(--lust,var(--ub-accent,#9050c0))}
.psp-more{text-align:center;color:var(--text-muted,#999);font-size:11px;padding:10px 0 14px}
.psp-empty{text-align:center;color:var(--text-muted,#999);font-size:12px;padding:30px 10px}
.psp-dt-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.psp-dt-title h3{font-size:16px;margin:0}
.psp-dt-title .psp-badge{font-size:10px;padding:2px 8px;border-radius:9px;border:1px solid var(--ub-divider,#ddd);color:var(--text-sub,var(--text-muted,#888))}
.psp-dt-fav{margin-left:auto;border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));border-radius:7px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px}
.psp-dt-fav svg{width:12px;height:12px}
.psp-dt-fav.on{border-color:#e8a020;color:#e8a020}
.psp-dt-src{font-size:11px;color:var(--text-muted,#999)}
.psp-dt-img{border:1px dashed var(--ub-divider,#ddd);border-radius:9px;overflow:hidden;position:relative;flex:0 0 auto;background:var(--bg-alt,var(--ub-bg-card,#fff))}
.psp-dt-img img{display:block;width:100%;max-height:230px;object-fit:contain;background:rgba(128,128,128,.06)}
.psp-dt-img button{position:absolute;right:6px;bottom:6px;border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer;font-family:inherit;box-shadow:0 1px 6px rgba(0,0,0,.25)}
/* 表单视图窄壳：宽 680、高度随内容（上限同宽壳），与内容量匹配 */
.psp-popup.psp-narrow{width:680px;height:auto;max-height:calc(100% - 48px)}
.psp-popup.psp-narrow .psp-mgmt{min-height:0}
.psp-popup.psp-narrow .psp-mpane{border-top:0;padding:14px 18px}
/* 条目管理行内展开预览 */
.psp-entryrow{cursor:pointer}
.psp-entryrow .psp-entry-caret{margin-left:6px;font-size:9px;color:var(--text-muted,#999)}
.psp-entryrow.open{border-color:var(--lust-border,rgba(144,80,192,.15));border-bottom-left-radius:0;border-bottom-right-radius:0;margin-bottom:0}
.psp-entrycontent{border:1px solid var(--lust-border,rgba(144,80,192,.15));border-top:0;border-radius:0 0 8px 8px;margin-bottom:5px;padding:8px 10px;background:var(--lust-bg,rgba(144,80,192,.06))}
.psp-entrycontent .psp-dt-content{max-height:220px;background:var(--ub-bg-card,#fff)}
.psp-dt-content{flex:1 1 auto;min-height:120px;border:1px solid var(--divider-light,var(--ub-divider,#eee));border-radius:9px;background:var(--bg-alt,var(--ub-bg-card,#fff));padding:10px 12px;font-family:Consolas,'Courier New',monospace;font-size:11.5px;line-height:1.7;white-space:pre-wrap;color:var(--text-sub,var(--text-muted,#888));overflow-y:auto;word-break:break-word}
.psp-dt-actions{display:flex;gap:8px;flex-wrap:wrap}
.psp-dt-actions .psp-primary{flex:1;border:1px solid var(--lust,var(--ub-accent,#9050c0));background:var(--lust,var(--ub-accent,#9050c0));color:#fff;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;min-width:120px;font-family:inherit}
.psp-dt-actions .psp-primary:not(.on){color:#fff}
.panel-overlay.dark .psp-dt-actions .psp-primary,body.dark-mode .psp-dt-actions .psp-primary{color:#1c1c1e}
.psp-dt-actions .psp-ghost{border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;font-family:inherit}
.psp-dt-actions .psp-ghost.danger:hover{border-color:var(--danger,var(--ub-danger,#c04363));color:var(--danger,var(--ub-danger,#c04363))}
.psp-foot{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--ub-divider,#ddd);background:var(--bg-alt,var(--ub-bg-card,#fff))}
.psp-foot .psp-cnt{flex:0 0 auto;font-size:12px;color:var(--text-sub,var(--text-muted,#888))}
.psp-foot .psp-cnt b{color:var(--lust,var(--ub-accent,#9050c0))}
.psp-foot .psp-cnt.max b{color:var(--danger,var(--ub-danger,#c04363))}
.psp-foot .psp-fchips{flex:1;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.psp-foot .psp-fchip{flex:0 0 auto;display:inline-flex;gap:5px;align-items:center;padding:3px 8px;border-radius:12px;background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)));border:1px solid var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)));font-size:11px;cursor:pointer;white-space:nowrap}
.psp-foot .psp-fchip .fx{color:var(--text-muted,#999)}
.psp-foot .psp-clear{border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:11px;padding:4px 10px;border-radius:7px;cursor:pointer;font-family:inherit}
.psp-foot .psp-clear:hover{border-color:var(--danger,var(--ub-danger,#c04363));color:var(--danger,var(--ub-danger,#c04363))}
.psp-drawer{display:none;position:absolute;left:0;right:0;bottom:0;max-height:74%;background:var(--ub-bg-card,#fff);border-radius:14px 14px 0 0;border-top:1px solid var(--ub-divider,#ddd);box-shadow:0 -10px 40px rgba(0,0,0,.4);flex-direction:column;padding:0 14px 12px}
.psp-drawer .psp-grab{width:38px;height:4px;border-radius:3px;background:var(--ub-divider,#ddd);margin:8px auto 4px;flex:0 0 auto}
/* 抽屉头：横条只作视觉把手（不可点、不承载拖拽），关闭只有右上 ×（用户定案 2026-10-16） */
.psp-drawer .psp-dhead{position:relative;flex:0 0 auto;min-height:38px;display:flex;align-items:center;justify-content:center}
.psp-drawer .psp-dhead .psp-grab{margin:0}
.psp-drawer .psp-dclose{position:absolute;right:0;top:1px;width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:var(--text-muted,#999);cursor:pointer;display:grid;place-items:center;padding:0}
.psp-drawer .psp-dclose svg{width:14px;height:14px}
.psp-drawer .psp-dclose:hover{background:var(--ub-hover-bg,rgba(0,0,0,.05));color:var(--ub-text,#333)}
.psp-drawer .psp-dt-content{max-height:200px}
.psp-drawer .psp-dt-actions{flex:0 0 auto}
/* 管理视图 */
.psp-mgmt{display:flex;flex-direction:column;height:100%}
.psp-mtabs{display:flex;gap:6px;padding:10px 14px 0;flex:0 0 auto;align-items:center}
.psp-mtabs .psp-tab{border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:12px;padding:4px 12px;border-radius:7px 7px 0 0;cursor:pointer;border-bottom:0;font-family:inherit}
.psp-mtabs .psp-tab.on{color:var(--lust,var(--ub-accent,#9050c0));border-color:var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)));background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)))}
.psp-mpane{flex:1 1 auto;min-height:0;overflow-y:auto;border-top:1px solid var(--ub-divider,#ddd);padding:12px 16px}
.psp-mpane h4{font-size:13px;color:var(--text-sub,var(--text-muted,#888));margin:4px 0 8px}
.psp-catrow{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--divider-light,var(--ub-divider,#eee));border-radius:8px;margin-bottom:6px;background:var(--ub-bg-card,#fff)}
.psp-catrow .nm{flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psp-catrow .nm .psp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px}
.psp-catrow .psp-src{font-size:10px;color:var(--text-muted,#999);border:1px solid var(--ub-divider,#ddd);padding:1px 6px;border-radius:8px;white-space:nowrap}
.psp-catrow .psp-src.zdy{color:var(--lust,var(--ub-accent,#9050c0));border-color:var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)))}
.psp-catrow .psp-cnt2{font-size:11px;color:var(--text-muted,#999);white-space:nowrap}
.psp-catrow .psp-ops{display:flex;gap:5px;flex:0 0 auto}
.psp-obtn{border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer;white-space:nowrap;font-family:inherit}
.psp-obtn:hover{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0))}
.psp-obtn.danger:hover{border-color:var(--danger,var(--ub-danger,#c04363));color:var(--danger,var(--ub-danger,#c04363))}
.psp-obtn.primary{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0))}
.psp-hidden-box{margin-top:14px;border:1px dashed var(--ub-divider,#ddd);border-radius:9px;padding:10px 12px;background:var(--bg-alt,var(--ub-bg-card,#fff))}
.psp-hidden-box h4{margin-top:0}
.psp-hidden-box .h-row{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--text-sub,var(--text-muted,#888))}
.psp-hidden-box .h-row .psp-obtn{margin-left:auto}
.psp-mbar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
.psp-mbar .psp-search{flex:1;min-width:160px}
.psp-mbar select.psp-obtn{padding:6px 10px;appearance:auto}
.psp-entryrow{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--divider-light,var(--ub-divider,#eee));border-radius:8px;margin-bottom:5px;background:var(--ub-bg-card,#fff);font-size:12px}
.psp-entryrow .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psp-entryrow .meta{flex:0 0 auto;font-size:10px;color:var(--text-muted,#999)}
.psp-entryrow .meta.zdy{color:var(--lust,var(--ub-accent,#9050c0))}
.psp-entryrow.zdy{border-color:var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)));background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)))}
.psp-entryrow .psp-ops{display:flex;gap:5px;flex:0 0 auto}
/* 编辑表单 */
.psp-form{max-width:620px}
.psp-frow{margin-bottom:13px}
.psp-frow label{display:block;font-size:12px;color:var(--text-sub,var(--text-muted,#888));margin-bottom:5px}
.psp-frow input[type=text],.psp-frow select,.psp-frow textarea{width:100%;border:1px solid var(--ub-divider,#ddd);border-radius:8px;background:var(--bg-alt,var(--ub-bg-card,#fff));color:var(--ub-text,#333);font:inherit;font-size:13px;padding:8px 11px;box-sizing:border-box}
.psp-frow textarea{min-height:190px;font-family:Consolas,monospace;font-size:11.5px;line-height:1.7;resize:vertical}
.psp-frow .hint{font-size:11px;color:var(--text-muted,#999);margin-top:4px}
.psp-frow .err{font-size:11px;color:var(--danger,var(--ub-danger,#c04363));margin-top:4px;display:none}
.psp-frow .err.show{display:block}
.psp-tplbtn{border:1px dashed var(--ub-divider,#ddd);background:transparent;color:var(--text-muted,#999);font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;margin-left:8px;font-family:inherit}
.psp-tplbtn:hover{color:var(--lust,var(--ub-accent,#9050c0));border-color:var(--lust,var(--ub-accent,#9050c0))}
.psp-factions{display:flex;gap:10px;margin-top:16px}
.psp-factions .psp-primary{border:1px solid var(--lust,var(--ub-accent,#9050c0));background:var(--lust,var(--ub-accent,#9050c0));color:#fff;border-radius:8px;padding:8px 22px;font-size:13px;cursor:pointer;font-family:inherit}
.psp-factions .psp-fcancel{border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer;font-family:inherit}
/* 导入导出 */
.psp-io-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.psp-io-card{border:1px solid var(--ub-divider,#ddd);border-radius:10px;padding:13px 15px;background:var(--ub-bg-card,#fff)}
.psp-io-card h4{margin-bottom:4px}
.psp-io-card p{font-size:11.5px;color:var(--text-muted,#999);margin-bottom:10px}
.psp-io-btn{display:block;width:100%;text-align:left;border:1px solid var(--ub-divider,#ddd);background:var(--bg-alt,var(--ub-bg-card,#fff));color:var(--ub-text,#333);border-radius:8px;padding:9px 12px;font-size:12.5px;cursor:pointer;margin-bottom:7px;font-family:inherit}
.psp-io-btn:hover{border-color:var(--lust,var(--ub-accent,#9050c0))}
.psp-io-btn small{display:block;color:var(--text-muted,#999);font-size:10.5px;margin-top:2px}
.psp-io-btn.primary{border-color:var(--lust,var(--ub-accent,#9050c0));background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)))}
.psp-drop{border:1.5px dashed var(--ub-divider,#ddd);border-radius:10px;padding:22px;text-align:center;color:var(--text-muted,#999);font-size:12.5px;cursor:pointer}
.psp-drop:hover{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0))}
.psp-drop input{display:none}
.psp-import-preview{border:1px solid var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)));background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)));border-radius:10px;padding:12px 14px;font-size:12px;margin-top:10px}
.psp-import-preview ul{margin:7px 0 7px 18px;color:var(--text-sub,var(--text-muted,#888))}
.psp-radio{display:flex;gap:14px;margin:7px 0;font-size:12px;color:var(--text-sub,var(--text-muted,#888))}
.psp-io-confirm{display:flex;gap:8px;margin-top:9px}
.psp-json{font-family:Consolas,monospace;font-size:11px;line-height:1.65;background:var(--bg-alt,var(--ub-bg-card,#fff));border:1px solid var(--divider-light,var(--ub-divider,#eee));border-radius:8px;padding:12px;color:var(--text-sub,var(--text-muted,#888));white-space:pre;overflow-x:auto}
/* 手机 ≤767px：近全屏 + 列表全宽 + 右侧详情改底部抽屉 */
@media (max-width:767px){
  .psp-popup{width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;border:0}
  .psp-list{border-right:0}
  .psp-detail{display:none}
  .psp-drawer.open{display:flex}
  .psp-io-grid{grid-template-columns:1fr}
  .psp-head{flex-wrap:wrap}
  .psp-toolbar{flex-wrap:wrap}
  .psp-search{min-width:100%}
  /* 触控热区（方案 §3.2「行高、按钮均按 44px 设计」）：窄屏行高 44、★/✓ 热区放大；
     桌面形态一律不动（本块只在窄屏生效）。box-sizing 必须显式写：行是 div（内容盒），
     不加则 padding/border 会叠在 min-height 之上（实测 41.6px → 62px，比目标胖一圈）。 */
  .psp-row{min-height:44px;box-sizing:border-box}
  .psp-row .psp-fav{width:34px;height:34px;font-size:15px}
  .psp-row .psp-check{width:32px;height:32px;border-radius:9px}
  .psp-row .psp-check svg{width:15px;height:15px}
  .psp-head .psp-close{width:32px;height:32px}
  .psp-head .psp-close svg{width:15px;height:15px}
  .psp-head .psp-mgmt{padding:7px 12px}
  .psp-cat{padding:6px 13px}
  .psp-toolbtn{padding:8px 12px}
  .psp-foot .psp-clear{padding:7px 12px}
  .psp-foot .psp-fchip{padding:5px 9px}
  .psp-entryrow{padding:10px}
}
@media (min-width:768px){ .psp-drawer{display:none!important} }
`);
}

// ===== 数据快照 =====

function currentFiltered(): PlayEntry[] {
  const lib = getPlayLibrary();
  return filterPlays(listVisiblePlays(lib), { query: _ui.query, category: _ui.category, favoritesOnly: _ui.favoritesOnly }, new Set(lib.favorites));
}

function selectedNames(): string[] {
  return readSelectedPlays().map(p => p.name);
}

// ===== 渲染 =====

function iconHtml(name: IconName): string { return ubIcon(name); }

/** 列表渲染上下文：库/收藏/已选/示意图在整批渲染前取一次。
 *  禁忌：renderRow 内逐行调 getPlayLibrary()（每次全量 normalize）或逐行 readSelectedPlays()——
 *  数百行时是 O(行数 × 库規模) 的重复计算，是随机/搜索卡顿的另一来源。 */
interface ListRenderCtx {
  selected: Set<string>;
  favorites: Set<string>;
  imageNames: Set<string>;
}

function buildListCtx(): ListRenderCtx {
  const lib = getPlayLibrary();
  const images = getPlayImages();
  return {
    selected: new Set(readSelectedPlays().map(p => p.name)),
    favorites: new Set(lib.favorites),
    // 示意图映射键无前后空格差异（内置名已 trim），一次性转 Set
    imageNames: new Set(Object.keys(images)),
  };
}

function renderRowWithCtx(p: PlayEntry, ctx: ListRenderCtx): string {
  const selected = ctx.selected.has(p.name);
  const fav = ctx.favorites.has(p.name);
  const hasImg = ctx.imageNames.has(p.name.trim());
  return '<div class="psp-row' + (_ui.activeName === p.name ? ' active' : '') + '" data-nm="' + escapeHtmlAttr(p.name) + '">'
    + '<span class="psp-nm">' + escapeHtml(p.name) + (hasImg ? ' <span class="psp-imgico">' + iconHtml('image') + '</span>' : '') + '</span>'
    + '<span class="psp-badge' + (p.custom ? ' zdy' : '') + '">' + escapeHtml(playCategoryLabel(p.category)) + '</span>'
    + '<button class="psp-fav' + (fav ? ' on' : '') + '" data-fav="' + escapeHtmlAttr(p.name) + '" title="收藏">' + (fav ? '★' : '☆') + '</button>'
    + '<button class="psp-check' + (selected ? ' on' : '') + '" data-sel="' + escapeHtmlAttr(p.name) + '" title="选入/移除">' + (selected ? iconHtml('check') : '') + '</button>'
    + '</div>';
}

function renderListHtml(): string {
  const all = currentFiltered();
  const shown = all.slice(0, _ui.rendered);
  const ctx = buildListCtx();
  let html = shown.map(p => renderRowWithCtx(p, ctx)).join('');
  if (all.length === 0) {
    html = '<div class="psp-empty">（无匹配条目）</div>';
  } else if (all.length > shown.length) {
    html += '<div class="psp-more">↓ 滚动加载更多（' + shown.length + ' / ' + all.length + '）…</div>';
  }
  return html;
}

/** 懒加载增量追加：只把新批次的行走 append 进去，不重建已渲染的数百行（旧实现整段 innerHTML 重建是滚动卡顿主因）。 */
function appendNextBatch(list: HTMLElement): void {
  const all = currentFiltered();
  if (_ui.rendered >= all.length) return;
  const next = all.slice(_ui.rendered, _ui.rendered + LIST_BATCH);
  _ui.rendered += next.length;
  const ctx = buildListCtx();
  const more = list.querySelector('.psp-more') as HTMLElement | null;
  const addition = next.map(p => renderRowWithCtx(p, ctx)).join('');
  if (more) {
    more.insertAdjacentHTML('beforebegin', addition);
    if (_ui.rendered >= all.length) more.remove();
    else more.textContent = '↓ 滚动加载更多（' + _ui.rendered + ' / ' + all.length + '）…';
  } else {
    list.insertAdjacentHTML('beforeend', addition);
  }
}

function renderDetailInner(name: string, dark: boolean): string {
  const entry = findPlayAnywhere(name);
  if (!entry) return '<div class="psp-empty">点条目查看详情</div>';
  const lib = getPlayLibrary();
  const fav = lib.favorites.includes(entry.name);
  const selected = selectedNames().includes(entry.name);
  const images = getPlayImageList(entry.name);
  const catColor = playCategoryColor(entry.category, dark, lib);
  let imgHtml = '';
  if (images.length > 0) {
    imgHtml = '<div class="psp-dt-img"><img src="' + escapeHtmlAttr(images[0].imageUrl) + '" alt="示意图">'
      + (images.length > 1 ? '<button data-img-all="' + escapeHtmlAttr(entry.name) + '">查看全部 ' + images.length + ' 张</button>' : '')
      + '</div>';
  }
  return '<div class="psp-dt-title"><h3>' + escapeHtml(entry.name) + '</h3>'
    + '<span class="psp-badge"><span class="psp-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + catColor + ';margin-right:4px"></span>' + escapeHtml(playCategoryLabel(entry.category)) + '</span>'
    + '<button class="psp-dt-fav' + (fav ? ' on' : '') + '" data-fav="' + escapeHtmlAttr(entry.name) + '">' + (fav ? '★ 已收藏' : '☆ 收藏') + '</button></div>'
    + '<div class="psp-dt-src">来源：' + (entry.custom ? '自定义' : '内置库') + ' · 注入顺序 = 选择顺序</div>'
    + imgHtml
    + '<div class="psp-dt-content">' + escapeHtml(entry.content) + '</div>'
    + '<div class="psp-dt-actions">'
    + '<button class="psp-primary" data-sel="' + escapeHtmlAttr(entry.name) + '">' + (selected ? '× 移除出本局' : '✓ 选入本局') + '</button>'
    + (entry.custom
      ? '<button class="psp-ghost" data-edit="' + escapeHtmlAttr(entry.name) + '">编辑</button><button class="psp-ghost danger" data-del="' + escapeHtmlAttr(entry.name) + '">删除</button>'
      : '<button class="psp-ghost" data-dup="' + escapeHtmlAttr(entry.name) + '">复制为自定义</button>')
    + '</div>';
}

function renderFootHtml(): string {
  const sel = readSelectedPlays();
  const max = getPlayMaxSelected();
  const lib = getPlayLibrary();
  const dark = document.getElementById('panelOverlay')?.classList.contains('dark') || false;
  const chips = sel.map(p => {
    const color = playCategoryColor(p.category, dark, lib);
    return '<span class="psp-fchip" data-nm="' + escapeHtmlAttr(p.name) + '"><span style="width:6px;height:6px;border-radius:50%;display:inline-block;background:' + color + '"></span>' + escapeHtml(p.name) + ' <span class="fx" data-sel="' + escapeHtmlAttr(p.name) + '">×</span></span>';
  }).join('');
  return '<span class="psp-cnt' + (sel.length >= max ? ' max' : '') + '">已选 <b>' + sel.length + '</b> / ' + max + '</span>'
    + '<div class="psp-fchips">' + chips + '</div>'
    + '<button class="psp-clear" id="pspClearAll">一键清空</button>';
}

function renderCatsHtml(): string {
  const lib = getPlayLibrary();
  const dark = document.getElementById('panelOverlay')?.classList.contains('dark') || false;
  const cats = listCategories(lib);
  const total = listVisiblePlays(lib).length;
  let html = '<button class="psp-cat' + (_ui.category === '全部' && !_ui.favoritesOnly ? ' on' : '') + '" data-cat="全部">全部 <span class="psp-cat-n">' + total + '</span></button>';
  html += '<button class="psp-cat' + (_ui.category === '★收藏' || _ui.favoritesOnly ? ' on' : '') + '" data-cat="★收藏">★收藏 <span class="psp-cat-n">' + lib.favorites.length + '</span></button>';
  for (const c of cats) {
    const cls = 'psp-cat' + (_ui.category === c.key ? ' on' : '') + (c.builtin ? '' : ' zdy');
    const dot = '<span class="psp-dot" style="background:' + playCategoryColor(c.key, dark, lib) + '"></span>';
    html += '<button class="' + cls + '" data-cat="' + escapeHtmlAttr(c.key) + '">' + dot + escapeHtml(c.label) + ' <span class="psp-cat-n">' + c.count + '</span></button>';
  }
  return html;
}

// ===== 手机端底部详情抽屉：开合唯一写口 + 抽屉头 =====
// 铁律：`open` 类**只由 syncDrawerOpen 写**。任何会改 activeName / drawerOpen 的路径都必须经过它，
// 否则会出现「点条目 → 设 drawerOpen=true → 只做局部 innerHTML 刷新 → open 类永不落盘」——
// 手机端 .psp-drawer{display:none} 于是详情点不开（2026-10-16 修：旧实现只在整壳重绘里拼 open 类，
// 结果只有切类别/切★仅看收藏/进出管理页才意外冒出抽屉，看起来时好时坏）。

/** 抽屉开合唯一写口：局部刷新与整壳重绘后都要重放一次（与 _ui 状态永远一致）。 */
function syncDrawerOpen(overlay: HTMLElement): void {
  const drawer = overlay.querySelector('#pspDrawer');
  if (!drawer) return;
  drawer.classList.toggle('open', !!(_ui.drawerOpen && _ui.activeName));
}

/** 抽屉头 HTML：横条只作视觉把手（用户定案：不点不拖），关闭只有右上 ×。 */
function drawerHeadHtml(): string {
  return '<div class="psp-dhead"><span class="psp-grab"></span>'
    + '<button class="psp-dclose" id="pspDrawerClose" type="button" data-psp-drawer-close="1" title="收起详情">' + iconHtml('close') + '</button></div>';
}

function renderSelectView(dark: boolean): string {
  const detailName = _ui.activeName;
  return '<div class="psp-head">'
    + '<span class="psp-title">玩法选择</span>'
    + '<button class="psp-mgmt" id="pspMgmt">⚙ 玩法库管理</button>'
    + '<button class="psp-close" id="pspClose">' + iconHtml('close') + '</button>'
    + '</div>'
    + '<div class="psp-toolbar">'
    + '<div class="psp-search">' + iconHtml('search') + '<input id="pspQuery" placeholder="搜索玩法名称…" value="' + escapeHtmlAttr(_ui.query) + '"></div>'
    + '<button class="psp-toolbtn' + (_ui.favoritesOnly ? ' on' : '') + '" id="pspFavOnly">★ 仅看收藏</button>'
    + '<button class="psp-toolbtn" id="pspRandom" title="在当前筛选结果中随机">' + iconHtml('dice') + ' 筛选内随机</button>'
    + '</div>'
    + '<div class="psp-cats" id="pspCats">' + renderCatsHtml() + '</div>'
    + '<div class="psp-body">'
    + '<div class="psp-list" id="pspList">' + renderListHtml() + '</div>'
    + '<div class="psp-detail" id="pspDetail">' + (detailName ? renderDetailInner(detailName, dark) : '<div class="psp-empty">点左侧条目查看详情</div>') + '</div>'
    + '<div class="psp-drawer" id="pspDrawer">' + drawerHeadHtml() + (detailName ? renderDetailInner(detailName, dark) : '') + '</div>'
    + '</div>'
    + '<div class="psp-foot" id="pspFoot">' + renderFootHtml() + '</div>';
}

/** 内置类别全集（key/label 对），管理页「已隐藏类别」区依赖它枚举被隐藏项。 */
const BUILTIN_CATEGORY_LIST: Array<[string, string]> = [
  ['体位', '体位'], ['multi', '多人体位'], ['serve', '侍奉'], ['scene', '场景'], ['extra', '附加玩法'],
];

function renderManageCats(): string {
  const lib = getPlayLibrary();
  const dark = document.getElementById('panelOverlay')?.classList.contains('dark') || false;
  const rows = listCategories(lib).map(c => {
    const isUncat = c.key === UNCATEGORIZED_KEY;
    const ops = c.builtin
      ? '<button class="psp-obtn" data-hide-cat="' + escapeHtmlAttr(c.key) + '">隐藏</button>'
      : isUncat ? '<span style="font-size:10px;color:var(--text-muted,#999)">系统 · 承接被删类别的条目</span>'
        : '<button class="psp-obtn" data-rename-cat="' + escapeHtmlAttr(c.key) + '">重命名</button><button class="psp-obtn danger" data-del-cat="' + escapeHtmlAttr(c.key) + '">删除</button>';
    return '<div class="psp-catrow"><span class="nm"><span class="psp-dot" style="background:' + playCategoryColor(c.key, dark, lib) + '"></span>' + escapeHtml(c.label) + '</span>'
      + '<span class="psp-src' + (c.builtin ? '' : ' zdy') + '">' + (isUncat ? '系统' : c.builtin ? '内置' : '自定义') + '</span>'
      + '<span class="psp-cnt2">' + c.count + ' 条</span>'
      + '<span class="psp-ops">' + ops + '</span></div>';
  }).join('');
  const visibleCatKeys = new Set(listCategories(lib).map(c => c.key));
  const hiddenCats = BUILTIN_CATEGORY_LIST.filter(([key]) => !visibleCatKeys.has(key));
  const hiddenCatHtml = hiddenCats.length
    ? '<div class="psp-hidden-box"><h4>已隐藏类别（' + hiddenCats.length + '）</h4>'
      + hiddenCats.map(([key, label]) => '<div class="h-row">' + escapeHtml(label) + '（内置 · 不出现在选择器）<button class="psp-obtn" data-restore-cat="' + escapeHtmlAttr(key) + '">恢复</button></div>').join('')
      + '</div>'
    : '';
  return '<h4>类别（内置 5 + 自定义 ' + lib.customCategories.length + '）</h4>' + rows
    + '<div style="margin-top:10px"><button class="psp-obtn primary" id="pspAddCat">＋ 新建类别…</button></div>'
    + hiddenCatHtml;
}

/** 条目管理列表行（含行内展开内容预览）。抽成独立函数：搜索输入时只重绘 #pspEntryList 保焦点。 */
function renderEntryRows(): string {
  const lib = getPlayLibrary();
  const filtered = filterPlays(listVisiblePlays(lib), { query: _ui.query, category: _ui.category === '★收藏' ? '全部' : _ui.category, favoritesOnly: _ui.favoritesOnly }, new Set(lib.favorites));
  let html = '';
  for (const p of filtered.slice(0, 200)) {
    const expanded = _ui.expandedEntry === p.name;
    html += '<div class="psp-entryrow' + (p.custom ? ' zdy' : '') + (expanded ? ' open' : '') + '" data-entry="' + escapeHtmlAttr(p.name) + '" title="点击查看内容">'
      + '<span class="nm">' + escapeHtml(p.name) + '<span class="psp-entry-caret">' + (expanded ? '▾' : '▸') + '</span></span>'
      + '<span class="meta' + (p.custom ? ' zdy' : '') + '">' + escapeHtml(playCategoryLabel(p.category)) + ' · ' + (p.custom ? '自定义' : '内置') + '</span>'
      + '<span class="psp-ops">'
      + (p.custom
        ? '<button class="psp-obtn" data-edit="' + escapeHtmlAttr(p.name) + '">编辑</button><button class="psp-obtn danger" data-del="' + escapeHtmlAttr(p.name) + '">删除</button>'
        : '<button class="psp-obtn" data-hide="' + escapeHtmlAttr(p.name) + '">隐藏</button><button class="psp-obtn" data-dup="' + escapeHtmlAttr(p.name) + '">复制为自定义</button>')
      + '</span></div>';
    if (expanded) {
      html += '<div class="psp-entrycontent"><div class="psp-dt-content">' + escapeHtml(p.content || '（无内容）') + '</div></div>';
    }
  }
  if (filtered.length === 0) html = '<div class="psp-empty">（无匹配条目）</div>';
  if (filtered.length > 200) html += '<div class="psp-more">… 共 ' + filtered.length + ' 条（搜索缩小范围）</div>';
  return html;
}

function renderManageEntries(): string {
  const lib = getPlayLibrary();
  const cats = listCategories(lib);
  const hiddenPlays = listHiddenBuiltinPlays(lib);
  const hiddenHtml = hiddenPlays.length
    ? '<div class="psp-hidden-box"><h4>已隐藏条目（' + hiddenPlays.length + '）· 按类别分组</h4>'
      + hiddenPlays.slice(0, 50).map(p => '<div class="h-row">【' + escapeHtml(playCategoryLabel(p.category)) + '】' + escapeHtml(p.name) + '<button class="psp-obtn" data-restore="' + escapeHtmlAttr(p.name) + '">恢复</button></div>').join('')
      + (hiddenPlays.length > 50 ? '<div class="h-row">… 共 ' + hiddenPlays.length + ' 条（上方展示前 50）</div>' : '')
      + '</div>'
    : '';
  const catOptions = '<option value="全部">全部类别</option>' + cats.map(c => '<option value="' + escapeHtmlAttr(c.key) + '"' + (_ui.category === c.key ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>').join('');
  return '<div class="psp-mbar">'
    + '<div class="psp-search">' + iconHtml('search') + '<input id="pspQuery" placeholder="搜索条目…" value="' + escapeHtmlAttr(_ui.query) + '"></div>'
    + '<select class="psp-obtn" id="pspEntryCat">' + catOptions + '</select>'
    + (hiddenPlays.length ? '<button class="psp-obtn">已隐藏 ' + hiddenPlays.length + '（见下方）</button>' : '')
    + '<button class="psp-obtn primary" id="pspNewPlay" style="margin-left:auto">＋ 新建玩法</button>'
    + '</div>'
    + '<div id="pspEntryList">' + renderEntryRows() + '</div>'
    + hiddenHtml;
}

function renderManageIo(): string {
  return '<div class="psp-io-grid">'
    + '<div class="psp-io-card"><h4>📤 导出</h4><p>导出为 JSON 文件，可直接分享或备份</p>'
    + '<button class="psp-io-btn" data-export="all">导出全部玩法库<small>内置隐藏状态 + 自定义 + 类别定义 · 完整备份，可再导入还原</small></button>'
    + '<button class="psp-io-btn primary" data-export="custom">导出仅我的自定义<small>自定义类别 + 自定义条目 · 适合分享给同好</small></button>'
    + '<button class="psp-io-btn" data-export="template">下载空白模板<small>含填写说明 + 示例条目 · 照着填即可</small></button>'
    + '</div>'
    + '<div class="psp-io-card"><h4>📥 导入</h4><p>自动识别：本插件导出格式 / 原始「玩法大全」格式</p>'
    + '<label class="psp-drop" id="pspDrop">点击选择 JSON 文件…<input type="file" id="pspFile" accept=".json,application/json"></label>'
    + '<div id="pspImportPreview"></div>'
    + '</div></div>'
    + '<h4 style="margin-top:16px">📄 空白模板长这样（下载后用任意编辑器填写）</h4>'
    + '<div class="psp-json">' + escapeHtml(buildPlayLibraryTemplate().split('"_说明"')[0].trim() + '\n  "_说明": "（四条填写说明，见下载的模板文件）",\n  …') + '</div>';
}

/** 表单视图（完整结构：头部 + 单层滚动体；窄壳由 psp-narrow 控制）。
 *  预填来源：编辑 original 条目，或新建时带 draft（「复制为自定义」草稿——保存前不落库）。 */
function renderForm(): string {
  const original = _ui.form?.original || '';
  const draft = _ui.form?.draft;
  const entry = original ? findPlayAnywhere(original) : null;
  const name = entry?.name ?? draft?.name ?? '';
  const category = entry?.category ?? draft?.category ?? '';
  const content = entry?.content ?? draft?.content ?? '';
  const cats = listCategories(getPlayLibrary());
  const catOptions = cats.map(c => '<option value="' + escapeHtmlAttr(c.key) + '"' + (c.key === category ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>').join('');
  return '<div class="psp-mgmt">'
    + '<div class="psp-head">'
    + '<span class="psp-title">' + (original ? '编辑玩法' : draft ? '复制为自定义' : '新建玩法') + '</span>'
    + '<button class="psp-close" id="pspFormClose" style="margin-left:auto">' + iconHtml('close') + '</button>'
    + '</div>'
    + '<div class="psp-mpane psp-form">'
    + '<div class="psp-frow"><label>名称（全库唯一）</label><input type="text" id="pspFormName" value="' + escapeHtmlAttr(name) + '" placeholder="例如：病房特护Play"><div class="err" id="pspFormNameErr"></div></div>'
    + '<div class="psp-frow"><label>类别</label><select id="pspFormCat">' + catOptions + '</select></div>'
    + '<div class="psp-frow"><label>写作指南（YAML 结构 · 原样注入提示词）<button class="psp-tplbtn" id="pspFormTpl">插入结构模板</button></label>'
    + '<textarea id="pspFormContent" placeholder="&lt;玩法名&gt;&#10;玩法名:&#10;  description: 一句话描述&#10;  basics:&#10;    girl: …&#10;    boy: …&#10;  steps:&#10;    - …&#10;  eroticism_focus: …">' + escapeHtml(content) + '</textarea>'
    + '<div class="hint">保存即生效：进入库、出现在选择器。内置条目不可直接编辑，请用「复制为自定义」。</div></div>'
    + '<div class="psp-factions"><button class="psp-primary" id="pspFormSave">保存</button><button class="psp-fcancel" id="pspFormCancel">取消</button></div>'
    + '</div>'
    + '</div>';
}

function renderManageView(): string {
  let pane = '';
  if (_ui.manageTab === 'cats') pane = renderManageCats();
  else if (_ui.manageTab === 'entries') pane = renderManageEntries();
  else pane = renderManageIo();
  const head = '<div class="psp-mtabs">'
    + '<button class="psp-obtn" id="pspBackSelect">← 返回选择</button><span style="width:8px"></span>'
    + '<button class="psp-tab' + (_ui.manageTab === 'cats' ? ' on' : '') + '" data-mtab="cats">类别管理</button>'
    + '<button class="psp-tab' + (_ui.manageTab === 'entries' ? ' on' : '') + '" data-mtab="entries">条目管理</button>'
    + '<button class="psp-tab' + (_ui.manageTab === 'io' ? ' on' : '') + '" data-mtab="io">导入导出</button>'
    + '</div>';
  return '<div class="psp-mgmt">' + head + '<div class="psp-mpane">' + pane + '</div></div>';
}

function renderPopup(overlay: HTMLElement): void {
  const dark = overlay.classList.contains('dark');
  ensureSelectorStyle();
  const shell = document.createElement('div');
  // 表单视图用窄壳（680px 自适应高），与宽壳 960×660 的列表平铺区分——内容量与弹窗尺寸匹配
  shell.className = 'psp-popup' + (_ui.form ? ' psp-narrow' : '');
  shell.innerHTML = _ui.form
    ? renderForm()
    : (_ui.view === 'select' ? renderSelectView(dark) : renderManageView());
  overlay.innerHTML = '';
  overlay.appendChild(shell);
  syncDrawerOpen(overlay); // 整壳重绘后同步抽屉开合（旧的「内联拼 open 类」已退役）
  if (_ui.form) updateFormSaveState(overlay);
}

// ===== 局部刷新（保搜索焦点/列表滚动） =====

function refreshListOnly(overlay: HTMLElement): void {
  const list = overlay.querySelector('#pspList') as HTMLElement | null;
  if (!list) { renderPopup(overlay); return; }
  const prevTop = list.scrollTop;
  list.innerHTML = renderListHtml();
  list.scrollTop = prevTop;
  const foot = overlay.querySelector('#pspFoot');
  if (foot) foot.innerHTML = renderFootHtml();
}

/** 搜索输入的局部刷新目标：选择器列表（#pspList）或条目管理列表（#pspEntryList）。
 *  两者都必须「只换列表、不换输入框」——全量重绘会销毁输入框节点，中文/连续输入直接断。 */
function refreshSearchTarget(overlay: HTMLElement): void {
  const entryList = overlay.querySelector('#pspEntryList') as HTMLElement | null;
  if (entryList) { entryList.innerHTML = renderEntryRows(); return; }
  refreshListOnly(overlay);
}

function refreshDetailAndFoot(overlay: HTMLElement): void {
  const dark = overlay.classList.contains('dark');
  const detail = overlay.querySelector('#pspDetail');
  const drawer = overlay.querySelector('#pspDrawer');
  const inner = _ui.activeName ? renderDetailInner(_ui.activeName, dark) : '<div class="psp-empty">点条目查看详情</div>';
  if (detail) detail.innerHTML = inner;
  if (drawer) drawer.innerHTML = drawerHeadHtml() + inner;
  syncDrawerOpen(overlay); // 局部刷新后重放开合（缺这一步 = 手机端点条目不显示详情）
  const foot = overlay.querySelector('#pspFoot');
  if (foot) foot.innerHTML = renderFootHtml();
}

function refreshActiveRow(overlay: HTMLElement): void {
  overlay.querySelectorAll<HTMLElement>('.psp-row').forEach(row => {
    row.classList.toggle('active', row.dataset.nm === _ui.activeName);
  });
}

// ===== 行为 =====

function toggleSelected(name: string, overlay: HTMLElement): void {
  const selected: SelectedPlay[] = readSelectedPlays();
  const idx = selected.findIndex(p => p.name === name);
  if (idx >= 0) {
    selected.splice(idx, 1);
  } else {
    const max = getPlayMaxSelected();
    if (selected.length >= max) {
      getToastr()?.warning('已达上限 ' + max + ' 条，可在设置中调整（1-10）', '玩法');
      return;
    }
    const entry = findPlayAnywhere(name);
    if (!entry) return;
    selected.push({ name: entry.name, category: entry.category });
    emitAchievement('play_activated');
  }
  if (!writeSelectedPlays(selected)) {
    getToastr()?.error('无法保存到当前角色卡，请确认已打开角色卡', '玩法');
    return;
  }
  syncPlayWorldbook();
  refreshPlayChipsUI();
  refreshListOnly(overlay);
  refreshDetailAndFoot(overlay);
}

function randomFromFilter(overlay: HTMLElement): void {
  const filtered = currentFiltered();
  const selected = readSelectedPlays();
  const selectedSet = new Set(selected.map(p => p.name));
  const max = getPlayMaxSelected();
  // 优先未选中池；池空时允许已选中条目（此时只定位不收编）
  const pick = pickRandomPlay(filtered, selectedSet) || pickRandomPlay(filtered, new Set());
  if (!pick) {
    getToastr()?.warning('当前筛选无可用玩法', '提示');
    return;
  }
  const already = selectedSet.has(pick.name);
  if (!already && selected.length < max) {
    // 一键随机：直接选入（与状态栏收藏随机同语义，省一次手动勾选）
    const entry = findPlayAnywhere(pick.name);
    if (entry && writeSelectedPlays([...selected, { name: entry.name, category: entry.category }])) {
      syncPlayWorldbook();
      refreshPlayChipsUI();
      emitAchievement('play_random');
      emitAchievement('play_activated');
      getToastr()?.success('随机选择并已选入：' + pick.name, '玩法');
    } else {
      getToastr()?.error('无法保存到当前角色卡，请确认已打开角色卡', '玩法');
    }
  } else if (already) {
    getToastr()?.success('随机命中已在已选中：' + pick.name + '（已定位，如需替换请手动移除）', '玩法');
  } else {
    getToastr()?.warning('已达上限 ' + max + ' 条，仅定位不选入：' + pick.name, '玩法');
  }
  _ui.activeName = pick.name;
  _ui.drawerOpen = true;
  // ★ 不膨胀懒加载游标：命中条目排名靠后时，旧实现把 rendered 一次推到命中位+60，
  //   瞬间渲染数百行 + 平滑滚动 = 长时间卡顿。规则改为「在已渲染范围内则定位，
  //   否则只更新详情面板/已选栏（结果在详情与 chips 里可见，列表保持原状）」。
  const hitIndex = filtered.findIndex(p => p.name === pick.name);
  const inRenderedRange = hitIndex >= 0 && hitIndex < _ui.rendered;
  if (inRenderedRange) {
    refreshListOnly(overlay);
    refreshDetailAndFoot(overlay);
    refreshActiveRow(overlay);
    const row = overlay.querySelector('.psp-row[data-nm="' + cssEscape(pick.name) + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' }); // 瞬时定位（nearest 最小滚动）
  } else {
    refreshDetailAndFoot(overlay);
  }
}

function cssEscape(v: string): string {
  return (window as any).CSS?.escape ? (window as any).CSS.escape(v) : v.replace(/["\\]/g, '\\$&');
}

function promptText(title: string, initial: string): Promise<string | null> {
  return new Promise(resolve => {
    const v = window.prompt(title, initial);
    resolve(v === null ? null : String(v).trim());
  });
}

async function handleManageAction(action: string, value: string, overlay: HTMLElement): Promise<void> {
  const toast = getToastr();
  switch (action) {
    case 'hide': hideBuiltinPlay(value); toast?.success('已隐藏「' + value + '」（可在下方恢复）', '玩法库'); break;
    case 'restore': restoreBuiltinPlay(value); toast?.success('已恢复「' + value + '」', '玩法库'); break;
    case 'hide-cat': setBuiltinCategoryHidden(value, true); toast?.success('类别已隐藏（可恢复）', '玩法库'); break;
    case 'restore-cat': setBuiltinCategoryHidden(value, false); toast?.success('类别已恢复', '玩法库'); break;
    case 'rename-cat': {
      const next = await promptText('重命名类别：' + value, value);
      if (next === null) return;
      if (!renameCustomCategory(value, next)) { toast?.error('重命名失败：名称为空或与现有类别重复', '玩法库'); return; }
      toast?.success('类别已重命名', '玩法库');
      break;
    }
    case 'del-cat': {
      const lib = getPlayLibrary();
      const count = lib.customPlays.filter(p => p.category === value).length;
      const ok = await showConfirmDialog({ message: count > 0 ? '类别「' + value + '」下有 ' + count + ' 条条目，删除后它们将移入「未分类」。确认删除？' : '确认删除类别「' + value + '」？' });
      if (!ok) return;
      deleteCustomCategory(value);
      toast?.success('类别已删除', '玩法库');
      break;
    }
    case 'add-cat': {
      const name = await promptText('新类别名称', '');
      if (name === null) return;
      if (!addCustomCategory(name)) { toast?.error('新建失败：名称为空、与内置类别重名或已存在', '玩法库'); return; }
      toast?.success('类别已创建', '玩法库');
      break;
    }
    case 'del': {
      const ok = await showConfirmDialog({ message: '确认删除自定义玩法「' + value + '」？此操作不可撤销。' });
      if (!ok) return;
      deleteCustomPlay(value);
      // 已选中该玩法时同步移除（选中态收敛，注入自动更新）
      const selected = readSelectedPlays().filter(p => p.name !== value);
      if (selected.length !== readSelectedPlays().length) {
        if (!writeSelectedPlays(selected)) { toast?.error('无法保存到当前角色卡', '玩法'); return; }
        syncPlayWorldbook();
        refreshPlayChipsUI();
      }
      toast?.success('已删除「' + value + '」', '玩法库');
      break;
    }
    case 'dup': {
      // 「复制为自定义」= 打开预填编辑表单（草稿不落库）：用户改完保存才真正建条目，
      // 避免"直接建副本让用户去找再改"的弯路。
      const entry = findPlayAnywhere(value);
      if (!entry || entry.custom) { toast?.error('复制失败：条目不存在', '玩法库'); return; }
      let candidate = entry.name + '（自定义）';
      let n = 2;
      while (isPlayNameTaken(candidate)) candidate = entry.name + '（自定义' + (n++) + '）';
      _ui.form = { original: '', draft: { name: candidate, category: entry.category, content: entry.content } };
      break;
    }
    case 'edit':
      _ui.form = { original: value };
      break;
    default: return;
  }
  renderPopup(overlay);
}

function handleExport(kind: string): void {
  const toast = getToastr();
  try {
    let text = '';
    let filename = '';
    if (kind === 'all') { text = buildPlayLibraryExport('all'); filename = 'ub玩法库-完整备份.json'; }
    else if (kind === 'custom') { text = buildPlayLibraryExport('custom'); filename = 'ub玩法库-我的自定义.json'; }
    else { text = buildPlayLibraryTemplate(); filename = 'ub玩法库-空白模板.json'; }
    triggerBlobDownload(new Blob([text], { type: 'application/json' }), filename);
    toast?.success('已导出：' + filename, '玩法库');
  } catch (e) {
    toast?.error('导出失败：' + (e instanceof Error ? e.message : String(e)), '玩法库');
  }
}

function showImportPreview(text: string, overlay: HTMLElement): void {
  const box = overlay.querySelector('#pspImportPreview') as HTMLElement | null;
  const toast = getToastr();
  if (!box) return;
  let raw: any = null;
  try { raw = JSON.parse(text); } catch (_e) { /* ignore */ }
  const isBackup = raw && raw.format === PLAY_LIBRARY_FORMAT && (Array.isArray(raw.hiddenBuiltinPlays) || Array.isArray(raw.favorites));
  if (isBackup) {
    box.innerHTML = '<div class="psp-import-preview"><b>识别为完整备份</b>'
      + '<ul><li>将执行：自定义类别/条目导入（同名覆盖）+ 还原隐藏清单与收藏</li></ul>'
      + '<div class="psp-io-confirm"><button class="psp-obtn primary" id="pspImportOk">确认还原备份</button></div></div>';
    const ok = box.querySelector('#pspImportOk');
    ok?.addEventListener('click', () => {
      const result = applyPlayLibraryBackupRestore(text);
      if (!result) { toast?.error('备份还原失败：文件无法识别', '玩法库'); return; }
      toast?.success('备份已还原：新增 ' + result.added + ' 条 / 跳过 ' + result.skipped + ' 条', '玩法库');
      renderPopup(overlay);
    });
    return;
  }
  const payload = parsePlayLibraryImport(text);
  if (!payload) {
    box.innerHTML = '<div class="psp-import-preview">× 无法识别该 JSON（需要 plays 数组，条目含 name/category/content）</div>';
    return;
  }
  const preview = previewPlayImport(payload);
  box.innerHTML = '<div class="psp-import-preview"><b>导入预览</b>'
    + '<ul>'
    + (preview.categoriesToAdd.length ? '<li>类别：将新建 ' + preview.categoriesToAdd.length + ' 个（' + escapeHtml(preview.categoriesToAdd.join('、')) + '）</li>' : '')
    + '<li>条目：共 ' + preview.playsTotal + ' 条 → 新增 ' + preview.playsToAdd + ' 条' + (preview.nameConflicts.length ? '，同名 ' + preview.nameConflicts.length + ' 条' : '') + '</li>'
    + '</ul>'
    + (preview.nameConflicts.length ? '<div class="psp-radio"><label><input type="radio" name="pspMm" value="skip" checked> 跳过同名（保留本地版本）</label><label><input type="radio" name="pspMm" value="overwrite"> 覆盖同名（以导入为准）</label></div>' : '')
    + '<div class="psp-io-confirm"><button class="psp-obtn primary" id="pspImportOk">确认导入</button><button class="psp-obtn" id="pspImportCancel">取消</button></div>'
    + '</div>';
  const cancel = box.querySelector('#pspImportCancel');
  cancel?.addEventListener('click', () => { box.innerHTML = ''; });
  const ok = box.querySelector('#pspImportOk');
  ok?.addEventListener('click', () => {
    const strategy = (box.querySelector('input[name="pspMm"]:checked') as HTMLInputElement | null)?.value === 'overwrite' ? 'overwrite' : 'skip';
    const result = applyPlayImport(payload, strategy);
    toast?.success('导入完成：新增 ' + result.added + ' 条 / 跳过 ' + result.skipped + ' 条 / 新建类别 ' + result.categoriesAdded + ' 个', '玩法库');
    renderPopup(overlay);
  });
}

// ===== 编辑表单（委托式，随视图重绘天然生效；勿改回打开时一次性 addEventListener——
// 表单是动态渲染的，入口处绑定会全部落空，按钮即「点了没反应」）=====

/** 名称/内容合法性：返回错误文案或 null。 */
function formValidationError(name: string, content: string): string | null {
  const original = _ui.form?.original || '';
  const trimmed = name.trim();
  if (!trimmed) return '名称不能为空';
  if (!content.trim()) return '写作指南不能为空';
  if (trimmed !== original && isPlayNameTaken(trimmed)) {
    const entry = findPlayAnywhere(trimmed);
    return '与' + (entry?.custom ? '自定义' : '内置') + '条目重名：已有「' + trimmed + '」，请改名';
  }
  return null;
}

/** 随输入更新保存按钮可用态与错误提示（行内展示，不打断输入）。 */
function updateFormSaveState(overlay: HTMLElement): void {
  const nameInput = overlay.querySelector('#pspFormName') as HTMLInputElement | null;
  const contentInput = overlay.querySelector('#pspFormContent') as HTMLTextAreaElement | null;
  const saveBtn = overlay.querySelector('#pspFormSave') as HTMLButtonElement | null;
  const errBox = overlay.querySelector('#pspFormNameErr') as HTMLElement | null;
  if (!nameInput || !contentInput || !saveBtn) return;
  const error = formValidationError(nameInput.value, contentInput.value);
  saveBtn.disabled = !!error;
  if (!errBox) return;
  // 空内容不打红（尚未填写），其余错误即时提示
  if (error && error !== '名称不能为空' && error !== '写作指南不能为空') {
    errBox.textContent = '× ' + error;
    errBox.classList.add('show');
  } else {
    errBox.classList.remove('show');
  }
}

function insertFormTemplate(overlay: HTMLElement): void {
  const nameInput = overlay.querySelector('#pspFormName') as HTMLInputElement | null;
  const contentInput = overlay.querySelector('#pspFormContent') as HTMLTextAreaElement | null;
  if (!contentInput) return;
  const nm = (nameInput?.value || '').trim() || '玩法名';
  contentInput.value = '<' + nm + '>\n' + nm + ':\n  description: 一句话描述\n  basics:\n    girl: …\n    boy: …\n  steps:\n    - …\n  eroticism_focus: …';
  updateFormSaveState(overlay);
}

function saveFormEntry(overlay: HTMLElement): void {
  const nameInput = overlay.querySelector('#pspFormName') as HTMLInputElement | null;
  const catSelect = overlay.querySelector('#pspFormCat') as HTMLSelectElement | null;
  const contentInput = overlay.querySelector('#pspFormContent') as HTMLTextAreaElement | null;
  const errBox = overlay.querySelector('#pspFormNameErr') as HTMLElement | null;
  if (!nameInput || !catSelect || !contentInput) return;
  const original = _ui.form?.original || '';
  const error = formValidationError(nameInput.value, contentInput.value);
  if (error) {
    if (errBox) { errBox.textContent = '× ' + error; errBox.classList.add('show'); }
    getToastr()?.error('保存失败：' + error, '玩法库');
    return;
  }
  const ok = saveCustomPlay({ name: nameInput.value, category: catSelect.value, content: contentInput.value }, original || undefined);
  if (!ok) {
    if (errBox) { errBox.textContent = '× 保存失败（名称重复或字段为空）'; errBox.classList.add('show'); }
    getToastr()?.error('保存失败：名称重复或字段为空', '玩法库');
    return;
  }
  getToastr()?.success('已保存玩法「' + nameInput.value.trim() + '」', '玩法库');
  _ui.form = null;
  _ui.manageTab = 'entries';
  renderPopup(overlay);
}

function closeForm(overlay: HTMLElement): void {
  _ui.form = null;
  renderPopup(overlay);
}

// ===== 事件接线 =====

function bindEvents(overlay: HTMLElement): void {
  overlay.onclick = function (e) {
    const target = e.target as HTMLElement;
    if (target === overlay) { if (guardGhostClick()) return; closePlaySelector(overlay); return; }
    if (guardGhostClick()) return;
    if (target.closest('#pspClose')) { closePlaySelector(overlay); return; }
    if (target.closest('#pspMgmt')) { _ui.view = 'manage'; _ui.form = null; renderPopup(overlay); return; }
    if (target.closest('#pspBackSelect')) { _ui.view = 'select'; _ui.form = null; renderPopup(overlay); return; }
    // 手机端抽屉收起：唯一关闭按钮（右上 ×）。横条 .psp-grab 只作视觉把手，刻意不接手势/点击。
    if (target.closest('[data-psp-drawer-close]')) { _ui.drawerOpen = false; syncDrawerOpen(overlay); return; }
    const mtab = target.closest('[data-mtab]');
    if (mtab) { _ui.manageTab = (mtab as HTMLElement).dataset.mtab as ManageTab; _ui.form = null; renderPopup(overlay); return; }
    if (target.closest('#pspFavOnly')) { _ui.favoritesOnly = !_ui.favoritesOnly; if (_ui.favoritesOnly) _ui.category = '★收藏'; else if (_ui.category === '★收藏') _ui.category = '全部'; _ui.rendered = LIST_BATCH; renderPopup(overlay); return; }
    if (target.closest('#pspRandom')) { randomFromFilter(overlay); return; }
    if (target.closest('#pspClearAll')) { handleClearAll(overlay); return; }
    if (target.closest('#pspAddCat')) { void handleManageAction('add-cat', '', overlay); return; }
    if (target.closest('#pspNewPlay')) { _ui.form = { original: '' }; _ui.view = 'manage'; _ui.manageTab = 'entries'; renderPopup(overlay); return; }
    // 编辑表单按钮（委托式——表单为动态渲染，入口处绑定会全部落空）
    if (target.closest('#pspFormSave')) { saveFormEntry(overlay); return; }
    if (target.closest('#pspFormCancel') || target.closest('#pspFormClose')) { closeForm(overlay); return; }
    if (target.closest('#pspFormTpl')) { insertFormTemplate(overlay); return; }

    const cat = target.closest('[data-cat]');
    if (cat) {
      _ui.category = (cat as HTMLElement).dataset.cat || '全部';
      if (_ui.category === '★收藏') _ui.favoritesOnly = true;
      else _ui.favoritesOnly = false;
      _ui.rendered = LIST_BATCH;
      renderPopup(overlay);
      return;
    }
    const selBtn = target.closest('[data-sel]');
    if (selBtn) {
      // 已选栏 chip 的 × 移除 / 列表勾选 / 详情「选入本局」共用同一切换
      toggleSelected((selBtn as HTMLElement).dataset.sel || '', overlay);
      return;
    }
    const favBtn = target.closest('[data-fav]');
    if (favBtn) {
      toggleFavorite((favBtn as HTMLElement).dataset.fav || '');
      refreshListOnly(overlay);
      refreshDetailAndFoot(overlay);
      const cats = overlay.querySelector('#pspCats');
      if (cats) cats.innerHTML = renderCatsHtml();
      return;
    }
    const imgAll = target.closest('[data-img-all]');
    if (imgAll) {
      showPlayImagePopup((imgAll as HTMLElement).dataset.imgAll || '', getConfig().style);
      return;
    }
    const editBtn = target.closest('[data-edit]');
    if (editBtn) { _ui.form = { original: (editBtn as HTMLElement).dataset.edit || '' }; _ui.view = 'manage'; renderPopup(overlay); return; }
    const dupBtn = target.closest('[data-dup]');
    if (dupBtn) { void handleManageAction('dup', (dupBtn as HTMLElement).dataset.dup || '', overlay); return; }
    const delBtn = target.closest('[data-del]');
    if (delBtn) { void handleManageAction('del', (delBtn as HTMLElement).dataset.del || '', overlay); return; }
    const hideBtn = target.closest('[data-hide]');
    if (hideBtn) { void handleManageAction('hide', (hideBtn as HTMLElement).dataset.hide || '', overlay); return; }
    const restoreBtn = target.closest('[data-restore]');
    if (restoreBtn) { void handleManageAction('restore', (restoreBtn as HTMLElement).dataset.restore || '', overlay); return; }
    const hideCat = target.closest('[data-hide-cat]');
    if (hideCat) { void handleManageAction('hide-cat', (hideCat as HTMLElement).dataset.hideCat || '', overlay); return; }
    const restoreCat = target.closest('[data-restore-cat]');
    if (restoreCat) { void handleManageAction('restore-cat', (restoreCat as HTMLElement).dataset.restoreCat || '', overlay); return; }
    const renameCat = target.closest('[data-rename-cat]');
    if (renameCat) { void handleManageAction('rename-cat', (renameCat as HTMLElement).dataset.renameCat || '', overlay); return; }
    const delCat = target.closest('[data-del-cat]');
    if (delCat) { void handleManageAction('del-cat', (delCat as HTMLElement).dataset.delCat || '', overlay); return; }
    const exportBtn = target.closest('[data-export]');
    if (exportBtn) { handleExport((exportBtn as HTMLElement).dataset.export || 'template'); return; }

    // 条目管理行主体点击 → 行内展开/收起内容预览（便于决定隐藏/删除/编辑；操作按钮在 .psp-ops 内不触发）
    const entryRow = target.closest('[data-entry]');
    if (entryRow && !target.closest('.psp-ops')) {
      const nm = (entryRow as HTMLElement).dataset.entry || '';
      _ui.expandedEntry = _ui.expandedEntry === nm ? null : nm;
      const entryList = overlay.querySelector('#pspEntryList');
      if (entryList) entryList.innerHTML = renderEntryRows();
      return;
    }

    // 列表行点击（主体）→ 详情；底部 chip 主体点击 → 详情定位
    const row = target.closest('.psp-row');
    if (row) {
      const nm = (row as HTMLElement).dataset.nm || '';
      _ui.activeName = nm;
      _ui.drawerOpen = true;
      refreshActiveRow(overlay);
      refreshDetailAndFoot(overlay);
      return;
    }
    const chip = target.closest('.psp-fchip');
    if (chip && !target.classList.contains('fx')) {
      const nm = (chip as HTMLElement).dataset.nm || '';
      _ui.activeName = nm;
      _ui.drawerOpen = true;
      refreshActiveRow(overlay);
      refreshDetailAndFoot(overlay);
      const rowHit = overlay.querySelector('.psp-row[data-nm="' + cssEscape(nm) + '"]');
      if (rowHit) rowHit.scrollIntoView({ block: 'nearest' }); // 瞬时定位（与随机同口径，禁平滑动画）
      return;
    }
    // 抽屉空白/背景（手机）：点抽屉外（列表区）收起抽屉（走同一写口，保持状态一致）
    if (_ui.drawerOpen && !target.closest('.psp-drawer') && !target.closest('.psp-detail')) {
      _ui.drawerOpen = false;
      syncDrawerOpen(overlay);
    }
  };

  overlay.oninput = function (e) {
    const target = e.target as HTMLElement;
    // IME 组合期间不刷新：部分输入法在组合中触发 input，重绘会打断中文输入（首个字母即丢焦点）
    if ((e as InputEvent).isComposing) return;
    if (target.id === 'pspQuery') {
      _ui.query = (target as HTMLInputElement).value;
      _ui.rendered = LIST_BATCH;
      _ui.expandedEntry = null;
      refreshSearchTarget(overlay);
      return;
    }
    if (target.id === 'pspFormName' || target.id === 'pspFormContent') {
      updateFormSaveState(overlay);
    }
  };

  overlay.onchange = function (e) {
    const target = e.target as HTMLElement;
    if (target.id === 'pspEntryCat') {
      _ui.category = (target as HTMLSelectElement).value || '全部';
      renderPopup(overlay);
      return;
    }
    // 导入文件走委托：IO 页签动态渲染，bindEvents 执行时 #pspFile 尚不存在
    if (target.id === 'pspFile') {
      const input = target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = ''; // 清值才能连续选同一文件（change 仅在值变化时触发）
      if (!file) return;
      void file.text().then(
        text => showImportPreview(text, overlay),
        () => getToastr()?.error('文件读取失败', '玩法库'),
      );
    }
  };

  // 懒加载：scroll 不冒泡，绑捕获监听到 overlay（每次重绘不重绑——onscroll 属性在捕获阶段不生效，改用 addEventListener 一次性绑定标记）。
  // 增量追加（appendNextBatch）而非整段重建：滚到列表深处时每次加批只绘制 60 行新行。
  if (!(overlay as any).__ubPspScrollBound) {
    (overlay as any).__ubPspScrollBound = true;
    overlay.addEventListener('scroll', function (e) {
      const list = e.target as HTMLElement;
      if (!list || list.id !== 'pspList') return;
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 160) {
        appendNextBatch(list);
      }
    }, true);
  }

  // IME 上屏兜底刷新：Chrome 中文输入上屏时最后一次 input 的 isComposing 仍为 true（会被守卫挡掉），
  // 之后不再触发 input ⇒ 搜索结果停在组合前。compositionend 时 value 已含整词，此处补一次刷新。
  // （用户实测：「输入中文不刷新，删除/输入字母才刷新」= 缺的正是这个时机。表单输入框同理刷新保存键态。）
  if (!(overlay as any).__ubPspComposeBound) {
    (overlay as any).__ubPspComposeBound = true;
    overlay.addEventListener('compositionend', function (e) {
      const t = e.target as HTMLElement;
      if (!t) return;
      // 个别浏览器 compositionend 时 value 尚未最终化，延迟一个任务读取
      setTimeout(function () {
        if (!t.isConnected) return;
        if (t.id === 'pspQuery') {
          _ui.query = (t as HTMLInputElement).value;
          _ui.rendered = LIST_BATCH;
          _ui.expandedEntry = null;
          refreshSearchTarget(overlay);
        } else if (t.id === 'pspFormName' || t.id === 'pspFormContent') {
          updateFormSaveState(overlay);
        }
      }, 0);
    });
  }
}

function handleClearAll(overlay: HTMLElement): void {
  if (readSelectedPlays().length === 0) return;
  if (!clearPlayState()) {
    getToastr()?.error('无法清空当前角色卡玩法，请确认已打开角色卡', '玩法');
    return;
  }
  syncPlayWorldbook();
  refreshPlayChipsUI();
  emitAchievement('play_clear');
  getToastr()?.success('玩法已清空', '玩法');
  refreshListOnly(overlay);
  refreshDetailAndFoot(overlay);
}

function closePlaySelector(overlay: HTMLElement): void {
  overlay.onclick = null;
  overlay.oninput = null;
  overlay.onchange = null;
  closePanelOverlay(overlay);
}

// ===== 入口 =====

export function showPlaySelectorPopup(style: StyleType, focusPlay?: string): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  _ui = {
    view: 'select', manageTab: 'cats', form: null,
    query: '', category: '全部', favoritesOnly: false,
    activeName: focusPlay || null, rendered: LIST_BATCH,
    // 带 focusPlay 进来 = 点了状态栏 chip（title 写着「点击查看详情」）⇒ 手机端直接把详情抽屉展开；
    // PC 无影响：≥768px 抽屉恒 display:none，右侧详情面板本来就展示它。
    drawerOpen: !!focusPlay, expandedEntry: null,
  };
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  renderPopup(overlay);
  markPopupShown();
  overlay.classList.add('show');
  bindEvents(overlay);
  // 搜索框自动聚焦只给桌面：手机端一聚焦就把软键盘顶起来，盖住下半屏（已选栏/抽屉全在键盘后面）。
  if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width:768px)').matches) {
    setTimeout(() => {
      try { (overlay.querySelector('#pspQuery') as HTMLInputElement | null)?.focus(); } catch (_e) { /* ignore */ }
    }, 50);
  }
}
