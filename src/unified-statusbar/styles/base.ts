// ===== 六风格共享基础CSS =====
// 此文件包含六个风格中完全一致的CSS规则。
// 修改共享规则时，只需在此文件中修改一次。
// 注意：切勿将颜色/字体/间距等各风格有差异的CSS放入此文件。
// 颜色相关规则使用 --ub-* 统一变量（各风格在 :root 中定义别名）。

export const baseCSS = /* css */ `
/* === dvh + 安全区域变量（全风格共享） === */
:root{
  --safe-top:env(safe-area-inset-top,0px);
  --safe-bottom:env(safe-area-inset-bottom,0px);
  --safe-left:env(safe-area-inset-left,0px);
  --safe-right:env(safe-area-inset-right,0px);
  --ub-touch-min:32px;
  /* F80 难度风险六档渐变：全风格通用的语义色阶（不随主题分叉，故放共享层；
     深色组内字面量重定义，禁单变量+浅色回退） */
  --ub-risk-0:#3F6A52;--ub-risk-1:#67803B;--ub-risk-2:#8F7516;--ub-risk-3:#A56A1E;--ub-risk-4:#A8501F;--ub-risk-5:#A13B34;
}
#ac-content.dark,.nsfw-overlay.dark,.panel-overlay.dark,.settings-overlay.dark,#ac-options-bar-floating.dark,body.dark-mode{
  --ub-risk-0:#77B18C;--ub-risk-1:#9CBA6B;--ub-risk-2:#D6B45C;--ub-risk-3:#DFA050;--ub-risk-4:#E2885C;--ub-risk-5:#E4776D;
}

/* === Shared popup size baseline across all themes ===
   baseCSS is appended after theme CSS, so these layout-only rules remove stale
   theme differences while dedicated large-popup classes below remain overrides. */
.panel-popup{
  width:90%;max-width:380px;max-height:72vh;max-height:72dvh;
  min-height:200px;box-sizing:border-box;
}
.settings-popup{
  width:90%;max-width:320px;max-height:85vh;max-height:85dvh;
  box-sizing:border-box;
}
.char-info-popup{
  width:90%;max-width:420px;max-height:80vh;max-height:80dvh;
  box-sizing:border-box;
}
/* 角色信息弹窗「查看完整档案」跳转按钮：中性卡片底 + 强调色文字/描边。
   变量链与角色中枢按钮同构，各主题 --accent/--card/--panel-bg 均已定义（含深色覆盖）；
   bridge 由 .bridge-window button 全局样式接管，此处仅需补 signal 色覆盖见 bridge.ts */
.char-hub-map-link{
  display:block;width:100%;margin-top:10px;padding:6px 9px;
  border:1px solid var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));
  background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));
  color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));
  font:inherit;font-size:var(--ub-ui-font-12,12px);text-align:center;cursor:pointer;border-radius:6px;
}
.char-hub-map-link:hover{background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)))}

/* === 统一弹窗规格档（6 主题共用；覆盖各主题既有的 .panel-popup 上限） === */
.ub-popup--s{ width:min(92%,460px) !important; max-width:460px !important; }
.ub-popup--m{ width:min(92%,540px) !important; max-width:540px !important; }
.ub-popup--l{ width:min(94%,720px) !important; max-width:720px !important; }
.ub-popup--xl{ width:min(96%,940px) !important; max-width:940px !important; }
.ub-popup--s,.ub-popup--m{ --ub-popup-font-title:15px; --ub-popup-font-body:var(--ub-ui-font-12,12px); }
.ub-popup--l,.ub-popup--xl{ --ub-popup-font-title:17px; --ub-popup-font-body:var(--ub-ui-font-13,13px); }
.ub-popup--s,.ub-popup--m,.ub-popup--l,.ub-popup--xl{ --ub-popup-font-sub:10px; }
/* 弹窗正文基准字号：规格类定义 --ub-popup-font-body，共享骨架类引用（主题自有的
   小元素如 .item-desc/.memo-item-sub 仍用各自的次文字 10px 不受影响） */
.ub-popup--s .panel-popup-body,
.ub-popup--m .panel-popup-body,
.ub-popup--l .panel-popup-body,
.ub-popup--xl .panel-popup-body{ font-size:var(--ub-popup-font-body,13px); line-height:1.55; }

/* === 角色中枢：结构与响应式（主题只覆盖 token/材质） === */
.char-hub-popup{max-height:80vh;max-height:80dvh;display:flex;flex-direction:column;overflow:hidden}
.char-hub-body{flex:1;min-height:0;overflow:auto;padding:12px 16px;color:var(--text,var(--sweet-text,var(--jade-text,#252525)))}
.char-hub-directory{display:flex;flex-direction:column;gap:10px}
.char-hub-search{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}
.char-hub-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:inherit;font:inherit}
.char-hub-filter,.char-hub-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.char-hub-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.char-hub-filter-row .char-hub-filter{flex:0 1 auto;min-width:0}
.char-hub-filter button,.char-hub-tabs button,.char-hub-back,.char-hub-nsfw,.char-hub-past-btn{border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:inherit;padding:6px 9px;cursor:pointer;font:inherit;white-space:nowrap}
.char-hub-filter button.active,.char-hub-tabs button.active{border-color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))))}
.char-hub-new-character{display:inline-flex;align-items:center;gap:5px;margin-left:auto;padding:6px 10px;border:1px dashed var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));background:transparent;color:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58))));cursor:pointer;font:inherit;white-space:nowrap}
.char-hub-new-character:hover{background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)))}
/* 待相遇占位区：区块标题 + 与人物卡墙同规格的网格 */
.char-hub-pending{display:flex;flex-direction:column;gap:8px}
.char-hub-pending>header{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.char-hub-pending>header small{color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));font-size:var(--ub-ui-font-11,11px)}
.char-hub-pending-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px}
/* 待相遇占位卡：复用普通人物卡骨架（.char-hub-card），仅以虚线边框+灰化头像示意「尚未出场」；
   尺寸/排版与普通卡完全一致（含移动端纵排），× 悬浮右上角仅移除占位 */
.char-hub-card.char-hub-pending-card{position:relative;border:1px dashed var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));cursor:default}
.char-hub-card.char-hub-pending-card .char-hub-portrait{filter:grayscale(.4);opacity:.8}
.char-hub-pending-del{position:absolute;top:2px;right:2px;display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;background:transparent;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));cursor:pointer;font-size:15px;line-height:1}
.char-hub-pending-del:hover{color:#d65151}
.char-hub-card-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px}
.char-hub-card{display:flex;align-items:stretch;gap:9px;min-width:0;padding:8px;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:inherit;text-align:left;cursor:pointer}
.char-hub-portrait{display:grid;place-items:center;flex:0 0 54px;width:54px;height:68px;overflow:hidden;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)))}
.char-hub-portrait img{width:100%;height:100%;object-fit:cover}.char-hub-initial{font-size:20px;font-weight:700}.char-hub-card-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.char-hub-card-copy small{color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)))}.char-hub-card-copy em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:normal;font-size:var(--ub-ui-font-11,11px)}
.char-hub-detail{display:flex;min-height:0;flex-direction:column;gap:10px}.char-hub-gallery{padding:0;cursor:pointer}.char-hub-gallery.char-hub-portrait{flex-basis:42px;width:42px;height:52px}.char-hub-nsfw{font-size:var(--ub-ui-font-11,11px)}
.char-hub-page{display:flex;flex-direction:column;gap:10px}.char-hub-section{margin:0;padding:9px 10px;border-left:2px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)))}.char-hub-section h4{margin:0 0 5px;font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)))}.char-hub-logic p{margin:0;white-space:pre-wrap;line-height:1.6}.char-hub-trait,.char-hub-logic{padding:7px;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}.char-hub-trait{display:flex;flex-direction:column;gap:3px}.char-hub-logic{margin-top:6px}.char-hub-logic small{display:block;margin-top:5px;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)))}.char-hub-raw{white-space:pre-wrap}.char-hub-caution{padding:8px 10px;border-left:3px solid var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58)));color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)))}
.char-hub-intimacy-slip{position:relative;padding:10px 12px;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}.char-hub-intimacy-slip span{display:block;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));font-size:var(--ub-ui-font-11,11px)}.char-hub-intimacy-slip b{display:block;margin-top:4px}.char-hub-intimacy-slip p{margin:5px 0 0;line-height:1.55}.char-hub-intimacy-slip.is-ongoing{border-color:var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58)))}
@media(max-width:599px){.char-hub-body{padding:10px}.char-hub-card-wall{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.char-hub-card{align-items:flex-start;flex-direction:column}.char-hub-portrait{width:100%;height:102px;flex-basis:102px}.char-hub-pending-wall{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}}

/* === 剧情回顾：仅打开时读取的分页阅读器 === */
.chronicle-reader-popup{display:flex;max-height:80vh;max-height:80dvh;flex-direction:column;overflow:hidden}.chronicle-reader-list,.chronicle-reader-detail{min-height:0;overflow:auto;padding:12px 16px;color:var(--text,var(--sweet-text,var(--jade-text,#252525)))}.chronicle-reader-tools{display:flex;gap:7px;flex-wrap:wrap}.chronicle-reader-tools button,.chronicle-reader-detail button,.chronicle-reader-sentinel{border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:inherit;padding:6px 9px;cursor:pointer}.chronicle-load-status{margin:9px 0;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)));font-size:var(--ub-ui-font-11,11px)}.chronicle-reader-items{display:flex;flex-direction:column;gap:8px}.chronicle-reader-card{padding:9px 10px;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));cursor:pointer}.chronicle-reader-card small,.chronicle-reader-detail small{display:block;color:var(--text-muted,var(--sweet-muted,var(--jade-muted,#777)))}.chronicle-reader-card b{display:block;margin:4px 0}.chronicle-auto-tag{margin:4px 4px 0 0;border:0;background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)));color:inherit;padding:3px 6px;font-size:var(--ub-ui-font-10,10px);cursor:pointer}.chronicle-auto-tag.location{border-left:2px solid var(--lust,var(--sweet-primary,var(--jade-primary,#7b4b58)))}.chronicle-reader-sentinel{display:block;width:100%;margin-top:9px}.chronicle-reader-detail h3{margin:7px 0}.chronicle-reader-detail section{margin-top:10px;padding:9px 10px;border-left:2px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)))}.chronicle-reader-detail h4{margin:0 0 5px}.chronicle-reader-detail p{margin:0;white-space:pre-wrap;line-height:1.65}
.chronicle-search{display:flex;align-items:center;gap:7px;margin-top:9px;padding:7px 9px;border:1px solid var(--divider,var(--sweet-border,var(--jade-line,#d8d2ce)));background:var(--panel-bg,var(--sweet-panel,var(--jade-surface-2,#f4f0ed)));font-size:var(--ub-ui-font-11,11px)}.chronicle-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:inherit;font:inherit}
.bridge-window.bridge-module-character,.bridge-window.bridge-module-chronicle-reader{width:min(96%,860px)!important;max-width:860px!important;max-height:86vh;max-height:86dvh}

/* 移动端既有全屏规则用 max-width:none（无 !important），会被上方规格类的
   max-width:…px !important 压制，这里在规格类之后同 !important 恢复全屏。
   5 主题本无全屏规则，此段只命中 bridge 窗口。 */
@media(max-width:599px){
  .bridge-window.bridge-module-memo,.bridge-window.bridge-module-item,
  .bridge-window.bridge-module-warehouse,.bridge-window.bridge-module-diary,
  .bridge-window.bridge-module-mission,.bridge-window.bridge-module-character,
  .bridge-window.bridge-module-database,.bridge-window.bridge-module-settings,
  .bridge-window.bridge-module-timeline,.bridge-window.bridge-module-cycle-manager,
  .bridge-window.bridge-module-newspaper,.bridge-window.bridge-module-achievements,
  .bridge-window.bridge-module-navigation,.bridge-window.bridge-module-skill-tree,
  .bridge-window.bridge-module-skill-detail,.bridge-window.bridge-module-imaging,
  .bridge-window.bridge-module-calendar,.bridge-window.bridge-module-chronicle-reader{ width:100% !important; max-width:none !important; }
}

/* === 大调查弹窗结构（全风格共享） === */
.investigation-popup{max-width:900px;width:100%;max-height:85vh;max-height:85dvh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;overscroll-behavior:contain}
.investigation-body{padding:0;overflow:hidden;flex:1;min-height:0;display:flex;flex-direction:column}
/* 平板/窄屏适配：所有主题的 iv-popup 和 iv-wrap 强制约束宽度 */
.investigation-popup .iv-popup,.investigation-popup .iv-popup-body,.investigation-popup .iv-wrap{max-width:100%;box-sizing:border-box}
.investigation-popup .iv-popup{width:100%}
/* 防止主题内部滚动区域（如仙侠 iv-popup-body 的 overflow-y:auto）产生滚动穿透和底部遮挡 */
.investigation-popup .iv-popup-body{overflow:visible;overscroll-behavior:contain;padding-bottom:60px}
/* 平板横屏/竖屏：缩小固定边距 */
@media(max-width:900px){
  .investigation-popup .iv-scroll-section{margin-left:16px!important;margin-right:16px!important}
  .investigation-popup .iv-jade-section{margin-left:12px!important;margin-right:12px!important}
  .investigation-popup .iv-love-wrapper{padding:16px 12px!important}
  .investigation-popup .iv-dossier-header{padding-left:20px!important;padding-right:20px!important}
  .investigation-popup .iv-neon-hero{padding-left:12px!important;padding-right:12px!important}
  .investigation-popup .iv-data-panel{padding-left:12px!important;padding-right:12px!important}
  .investigation-popup .iv-intel-section{padding-left:12px!important;padding-right:12px!important}
  .investigation-popup .iv-intel-header{padding-left:12px!important;padding-right:12px!important}
}
/* 顶栏 */
.iv-top-bar{display:flex;align-items:center;gap:10px;padding:8px 16px;flex-shrink:0;position:sticky;top:0;z-index:5;min-height:36px;flex-wrap:wrap}
.iv-top-name{font-size:13px;font-weight:700;letter-spacing:2px;flex:0 0 auto}
.iv-top-label{font-size:9px;opacity:0.5;letter-spacing:2px;text-transform:uppercase}
.iv-top-btns{display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap}
.iv-top-btn{font-size:10px;letter-spacing:1px;padding:4px 10px;cursor:pointer;transition:all 0.2s;background:transparent;border:1px solid rgba(128,128,128,0.3);color:inherit;white-space:nowrap;border-radius:2px}
.iv-top-btn:hover{opacity:1;filter:brightness(1.2)}
.iv-top-close{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid rgba(128,128,128,0.3);color:inherit;font-size:14px;cursor:pointer;padding:0;border-radius:2px;flex-shrink:0;line-height:1}
.iv-top-close:hover{background:rgba(196,30,58,0.1);border-color:#c41e3a;color:#c41e3a}
.iv-font-scale{display:inline-flex;align-items:center;gap:4px}
.iv-font-val{display:inline-block;min-width:30px;text-align:center;font-size:10px;opacity:.7;padding:0 2px}
.iv-font-scale .iv-top-btn:disabled{opacity:.4;cursor:default}
.archive-export-control{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}
.archive-export-trigger{display:inline-flex;align-items:center;gap:3px}
.archive-export-icon{display:none}
.archive-export-menu{position:absolute;z-index:30;right:0;top:calc(100% + 5px);display:none;min-width:118px;padding:4px;border:1px solid var(--itvc-line,var(--divider,var(--border-color,#aaa)));border-radius:4px;background:var(--itvc-card,var(--card-light,var(--bg-color,#fff)));color:var(--itvc-text,var(--text,var(--text-color,#222)));box-shadow:0 8px 24px rgba(0,0,0,.2)}
.archive-export-control.open .archive-export-menu{display:flex;flex-direction:column;gap:2px}
.archive-export-menu button{width:100%;padding:6px 9px;border:0;border-radius:3px;background:transparent;color:inherit;font:inherit;font-size:11px;text-align:left;white-space:nowrap;cursor:pointer}
.archive-export-menu button:hover{background:rgba(128,128,128,.14)}
.archive-export-menu button:disabled,.archive-export-trigger:disabled{opacity:.45;cursor:default}
@media(max-width:600px){.archive-export-label{display:none}.archive-export-icon{display:inline}.archive-export-caret{display:none}.archive-export-menu{right:-4px}.archive-export-menu button{font-size:12px}}

/* 顶栏主题化 */
.iv-top-bar-ancient{background:#f5e6d0;border-bottom:2px solid #c04040;color:#3c2816}
.iv-top-bar-ancient .iv-top-btn{border-color:rgba(181,54,46,0.3);color:#8b1a12}
.iv-top-bar-ancient .iv-top-btn:hover{background:rgba(181,54,46,0.08);border-color:#b5362e}
	.iv-top-bar-flirtatious{background:linear-gradient(180deg,#f5f0fa,#ede0f5);border-bottom:2px solid #c06080;color:#4a2040}
	.iv-top-bar-flirtatious .iv-top-btn{border-color:rgba(192,96,128,0.3);color:#a04060}
	.iv-top-bar-flirtatious .iv-top-btn:hover{background:rgba(192,96,128,0.08);border-color:#c06080}
.iv-top-bar-minimal{background:var(--bg-color,#f8f6f0);border-bottom:1px solid var(--border-color,#e0e0e0);color:var(--text-color,#1a1a1a)}
.iv-top-bar-minimal .iv-top-btn{border-color:var(--border-color,#ddd);color:var(--text-color,#1a1a1a)}
.iv-top-bar-minimal .iv-top-btn:hover{background:rgba(0,0,0,0.04)}
.iv-top-bar-sweet{background:linear-gradient(180deg,#ffe8f0,#ffdae4);border-bottom:2px solid #ff8fab;color:#6b3a4a}
.iv-top-bar-sweet .iv-top-btn{border-color:rgba(255,143,171,0.4);color:#c04060;border-radius:4px}
.iv-top-bar-sweet .iv-top-btn:hover{background:rgba(255,143,171,0.08);border-color:#e8557a}
.iv-top-bar-xianxia{background:linear-gradient(180deg,#dcece4,#d0e8e0);border-bottom:2px solid #4a90a4;color:#2a4030}
.iv-top-bar-xianxia .iv-top-btn{border-color:rgba(74,144,164,0.3);color:#2a6070}
.iv-top-bar-xianxia .iv-top-btn:hover{background:rgba(74,144,164,0.08);border-color:#4a90a4}

/* 历史列表 + 主内容布局（修复横向滚动） */
.iv-layout{display:flex;gap:0;flex:1;min-height:0;overflow:hidden}
/* 侧栏包装器 */
.iv-hist-sidebar{flex:0 0 172px;min-width:0;display:flex;overflow:hidden}
.iv-hist-list{flex:1;overflow-y:auto;overflow-x:hidden;min-width:0;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.iv-hist-topbar{display:flex;align-items:center;padding:8px 10px 6px;border-bottom:1px solid rgba(128,128,128,0.12)}
.iv-hist-title{font-size:10px;font-weight:600;color:inherit;letter-spacing:1px}
/* 顶栏中的侧栏切换按钮 */
.iv-sidebar-toggle{width:26px;height:26px;border:1px solid rgba(128,128,128,0.25);background:transparent;color:inherit;cursor:pointer;font-size:11px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:2px;transition:all 0.2s;line-height:1;flex-shrink:0;opacity:0.7}
.iv-sidebar-toggle:hover{opacity:1;border-color:rgba(128,128,128,0.5)}
.iv-hist-item{display:flex;align-items:center;justify-content:space-between;padding:5px 10px;cursor:pointer;font-size:11px;transition:background .15s}
.iv-hist-item:hover{background:rgba(128,128,128,0.08)}
.iv-hist-item.active{background:rgba(128,128,128,0.12);font-weight:600}
.iv-hist-time{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-hist-del{flex:0 0 16px;width:16px;height:16px;border:none;background:transparent;color:inherit;cursor:pointer;font-size:12px;line-height:1;opacity:0;transition:opacity .15s;padding:0;display:flex;align-items:center;justify-content:center}
.iv-hist-item:hover .iv-hist-del{opacity:0.6}
.iv-hist-del:hover{opacity:1!important;color:#c41e3a!important}
/* F20 触屏兜底（仿 story-image-base 的 .sig-del 正解）：手机无 hover——原 opacity:0 会让删除钮
   永远不可见却仍接收点击（找不到入口 + 误触弹确认）。触屏下常显并放大；桌面悬停浮现不变。
   注意 .iv-hist-item 是 flex 容器且本钮 flex-basis:16px 会压过 width，必须一并改。 */
@media (hover:none) and (pointer:coarse){
  .iv-hist-del{opacity:1;flex-basis:32px;width:32px;height:32px;font-size:15px}
}
.iv-main{flex:1;overflow:hidden;min-width:0;display:flex;flex-direction:column}
.iv-main-inner{flex:1;overflow-y:auto;overflow-x:hidden;min-width:0;overscroll-behavior:contain;padding-bottom:60px;-webkit-overflow-scrolling:touch;touch-action:pan-y}
/* 折叠状态：顶栏按钮变成 ▶，侧栏完全隐藏 */
.iv-layout.iv-collapsed .iv-hist-sidebar{flex:0 0 0;min-width:0;overflow:hidden}
.iv-layout.iv-collapsed .iv-hist-list{display:none}

/* ===== 五风格历史列表背景（不透明，防止文字看不清） ===== */
/* 古风 */
.iv-hist-ancient{background:#f5e6d0;border-right:2px solid #d8cfb8}
.iv-hist-ancient .iv-hist-topbar{border-bottom-color:rgba(180,140,100,0.3)}
.iv-hist-ancient .iv-hist-title{color:#8b6d30}
.iv-hist-ancient .iv-hist-item.active{background:rgba(181,54,46,0.1);color:#8b1a12}
.iv-hist-ancient .iv-hist-del:hover{color:#b5362e}
/* 瑟瑟 */
	.iv-hist-flirtatious{background:linear-gradient(180deg,#f5f0fa,#ede0f5);border-right:2px solid rgba(192,96,128,0.3)}
	.iv-hist-flirtatious .iv-hist-topbar{border-bottom-color:rgba(192,96,128,0.2)}
	.iv-hist-flirtatious .iv-hist-title{color:#a04060}
	.iv-hist-flirtatious .iv-hist-item{color:#4a2040}
	.iv-hist-flirtatious .iv-hist-item:hover{background:rgba(192,96,128,0.06)}
	.iv-hist-flirtatious .iv-hist-item.active{background:rgba(192,96,128,0.12);color:#a04060}
	.iv-hist-flirtatious .iv-hist-time{color:#8a6a80}
	.iv-hist-flirtatious .iv-hist-item.active .iv-hist-time{color:#a04060}
	.iv-hist-flirtatious .iv-hist-del:hover{color:#c06080}
/* 萦绕 */
.iv-hist-minimal{background:var(--bg-color,#f8f6f0);border-right:1px solid var(--border-color,#e0e0e0)}
.iv-hist-minimal .iv-hist-topbar{border-bottom-color:var(--border-color,#e0e0e0)}
.iv-hist-minimal .iv-hist-title{color:var(--secondary-text,#888)}
.iv-hist-minimal .iv-hist-item.active{background:rgba(0,0,0,0.06)}
/* 甜恋 */
.iv-hist-sweet{background:linear-gradient(180deg,#fff5f7,#ffe8f0);border-right:2px solid #ffd0dc}
.iv-hist-sweet .iv-hist-topbar{border-bottom-color:rgba(255,143,171,0.2)}
.iv-hist-sweet .iv-hist-title{color:#d08090}
.iv-hist-sweet .iv-hist-item{color:#8b5a6a}
.iv-hist-sweet .iv-hist-item.active{background:rgba(255,143,171,0.1);color:#c04060}
.iv-hist-sweet .iv-hist-time{color:#c08090}
.iv-hist-sweet .iv-hist-item.active .iv-hist-time{color:#c04060}
.iv-hist-sweet .iv-hist-del:hover{color:#e8557a}
/* 云海 */
.iv-hist-xianxia{background:linear-gradient(180deg,#e8f4f0,#dcece4);border-right:2px solid #c0d8cc}
.iv-hist-xianxia .iv-hist-topbar{border-bottom-color:rgba(74,144,164,0.15)}
.iv-hist-xianxia .iv-hist-title{color:#5a8070}
.iv-hist-xianxia .iv-hist-item{color:#3a6048}
.iv-hist-xianxia .iv-hist-item.active{background:rgba(74,144,164,0.1);color:#2a6070}
.iv-hist-xianxia .iv-hist-time{color:#5a8070}
.iv-hist-xianxia .iv-hist-item.active .iv-hist-time{color:#2a6070}
.iv-hist-xianxia .iv-hist-del:hover{color:#4a90a4}

/* 暗色模式下历史列表适配 — 确保文字清晰可见 */
.dark .iv-hist-ancient{background:#1e1810;border-right-color:#3a2e1a}
.dark .iv-hist-ancient .iv-hist-item{color:#c0b090}
.dark .iv-hist-ancient .iv-hist-item.active{background:rgba(196,96,64,0.15);color:#e0c8a0}
.dark .iv-hist-ancient .iv-hist-time{color:#a09078}
.dark .iv-hist-ancient .iv-hist-item.active .iv-hist-time{color:#e0c8a0}
.dark .iv-hist-ancient .iv-hist-title{color:#a08050}
.dark .iv-hist-ancient .iv-hist-topbar{border-bottom-color:rgba(196,96,64,0.15)}
.dark .iv-hist-flirtatious{background:#050510;border-right-color:rgba(255,106,158,0.2)}
.dark .iv-hist-flirtatious .iv-hist-item{color:#c0b0e0}
.dark .iv-hist-flirtatious .iv-hist-item.active{background:rgba(255,106,158,0.15);color:#ffb8d0}
.dark .iv-hist-flirtatious .iv-hist-time{color:#806090}
.dark .iv-hist-flirtatious .iv-hist-item.active .iv-hist-time{color:#ffb8d0}
.dark .iv-hist-flirtatious .iv-hist-title{color:#ff8ab0}
.dark .iv-hist-flirtatious .iv-hist-topbar{border-bottom-color:rgba(255,106,158,0.15)}
.dark .iv-hist-sweet{background:linear-gradient(180deg,#2a1020,#1a0a15);border-right-color:rgba(255,143,171,0.15)}
.dark .iv-hist-sweet .iv-hist-item{color:#c090a0}
.dark .iv-hist-sweet .iv-hist-item.active{background:rgba(255,143,171,0.12);color:#e0b0c0}
.dark .iv-hist-sweet .iv-hist-time{color:#a07080}
.dark .iv-hist-sweet .iv-hist-item.active .iv-hist-time{color:#e0b0c0}
.dark .iv-hist-sweet .iv-hist-title{color:#c08090}
.dark .iv-hist-xianxia{background:linear-gradient(180deg,#0a1a18,#0d1e1c);border-right-color:rgba(126,184,201,0.15)}
.dark .iv-hist-xianxia .iv-hist-item{color:#a0c0b0}
.dark .iv-hist-xianxia .iv-hist-item.active{background:rgba(126,184,201,0.12);color:#c0e8d8}
.dark .iv-hist-xianxia .iv-hist-time{color:#709880}
.dark .iv-hist-xianxia .iv-hist-item.active .iv-hist-time{color:#c0e8d8}
.dark .iv-hist-xianxia .iv-hist-title{color:#8ab8a8}
/* ===== 大调查接续往期调查节（长按弹窗内，token 驱动 6 主题自适配，不引入新 token） ===== */
.iv-cont-section{margin:14px 0 12px;padding-top:12px;border-top:1px dashed var(--divider,#e0e0e0)}
.iv-cont-section-title{font-size:12px;font-weight:700;color:var(--accent,#4a90d9);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.iv-cont-section-title small{color:var(--text-muted,#888);font-weight:400;font-size:10px}
.iv-cont-toggle-row{display:flex;align-items:flex-start;gap:9px}
.iv-cont-toggle{position:relative;flex:0 0 38px;width:38px;height:21px;border:1px solid var(--ub-divider,#ddd);border-radius:999px;background:var(--card-bg,#fff);cursor:pointer;transition:.2s;padding:0}
.iv-cont-toggle::after{content:"";position:absolute;left:2px;top:2px;width:15px;height:15px;border-radius:50%;background:var(--text-muted,#888);transition:.2s}
.iv-cont-toggle.on{background:color-mix(in srgb,var(--accent,#4a90d9) 25%,var(--card-bg,#fff));border-color:var(--accent,#4a90d9)}
.iv-cont-toggle.on::after{left:18px;background:var(--accent,#4a90d9)}
.iv-cont-toggle-copy{font-size:12px;color:var(--text-muted,#888);line-height:1.55;flex:1}
.iv-cont-toggle-copy b{color:var(--ub-text,#333)}
.iv-cont-sel-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.iv-cont-sel-item{display:flex;gap:9px;align-items:center;padding:8px 10px;border:1px solid var(--ub-divider,#ddd);border-radius:6px;background:var(--card-bg,#fff);cursor:pointer;transition:.15s}
.iv-cont-sel-item:hover{border-color:color-mix(in srgb,var(--accent,#4a90d9) 60%,var(--ub-divider,#ddd))}
.iv-cont-sel-item.sel{border-color:var(--accent,#4a90d9);background:color-mix(in srgb,var(--accent,#4a90d9) 10%,var(--card-bg,#fff))}
.iv-cont-radio{flex:0 0 16px;width:16px;height:16px;border:1.5px solid var(--text-muted,#888);border-radius:50%;position:relative;transition:.15s}
.iv-cont-sel-item.sel .iv-cont-radio{border-color:var(--accent,#4a90d9)}
.iv-cont-sel-item.sel .iv-cont-radio::after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--accent,#4a90d9)}
.iv-cont-sel-time{flex:1;font-size:12px;color:var(--ub-text,#333)}
.iv-cont-sel-tag{font-size:10px;color:var(--accent,#4a90d9);border:1px solid var(--accent,#4a90d9);border-radius:4px;padding:1px 6px}
.iv-cont-foot{margin-top:9px;padding-top:8px;border-top:1px dashed var(--divider,#e0e0e0)}
.iv-cont-warn{font-size:10px;color:var(--text-muted,#888);opacity:.85}
.iv-cont-empty{margin-top:10px;padding:14px;text-align:center;color:var(--text-muted,#888);font-size:11px;border:1px dashed var(--ub-divider,#ddd);border-radius:6px}
/* 暗色顶栏 */
.dark .iv-top-bar-ancient{background:#1e1810;border-bottom-color:#5a3020;color:#d0c8b0}
.dark .iv-top-bar-ancient .iv-top-btn{border-color:rgba(196,96,64,0.3);color:#c08060}
.dark .iv-top-bar-flirtatious{background:#050510;border-bottom-color:rgba(255,106,158,0.4)}
.dark .iv-top-bar-sweet{background:linear-gradient(180deg,#2a1020,#1a0a15);border-bottom-color:rgba(255,143,171,0.3);color:#d0a0b0}
.dark .iv-top-bar-sweet .iv-top-btn{border-color:rgba(255,143,171,0.2);color:#d08090}
.dark .iv-top-bar-xianxia{background:linear-gradient(180deg,#0a1a18,#0d1e1c);border-bottom-color:rgba(126,184,201,0.25);color:#c0d8d0}
.dark .iv-top-bar-xianxia .iv-top-btn{border-color:rgba(126,184,201,0.2);color:#a0d0c0}

/* === 固定模式通用 === */
#ac-fixed-toggle{z-index:100001;border:1px solid rgba(128,128,128,.3);background:rgba(30,30,30,.85);color:#ccc;box-shadow:0 2px 12px rgba(0,0,0,.3)}
#ac-fixed-toggle:not(.ub-ft-icon-mode):hover{background:rgba(60,60,60,.9);color:#fff}
#ac-fixed-toggle.ub-ft-icon-mode{
  border:1.5px solid transparent;
  background:
    linear-gradient(155deg,rgba(50,56,65,.98),rgba(17,20,25,.97)) padding-box,
    linear-gradient(145deg,var(--ub-ft-ring-start,#b8f5ff),var(--ub-ft-ring-end,#669cff)) border-box;
  color:#f3fbff;
  box-shadow:0 4px 14px rgba(0,0,0,.31),0 0 10px var(--ub-ft-ring-glow,rgba(126,232,255,.34));
  transition:box-shadow .18s ease,filter .18s ease;
}
#ac-fixed-toggle.ub-ft-icon-mode:hover{filter:brightness(1.08);box-shadow:0 5px 16px rgba(0,0,0,.34),0 0 15px var(--ub-ft-ring-glow,rgba(126,232,255,.34))}
#ac-fixed-toggle.ub-ft-icon-mode svg{display:block;width:19px;height:19px;color:inherit;filter:drop-shadow(0 0 4px var(--ub-ft-ring-glow,rgba(126,232,255,.34)));pointer-events:none}
#ac-fixed-toggle.ub-ft-icon-mode.ub-ft-menu svg circle{fill:currentColor}
@media(prefers-reduced-motion:reduce){#ac-fixed-toggle.ub-ft-icon-mode{transition:none}#ac-fixed-toggle.ub-onboarding{animation:none!important}}
/* === 折叠按钮菜单下拉 === */
#ac-collapse-menu{font-family:inherit}
/* 菜单项样式自 JS 内联上收；hover 高亮纯 CSS（触屏走 :active），移动端触控高度达标 */
.ac-collapse-menu-item{padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s;white-space:nowrap}
.ac-collapse-menu-item:hover{background:rgba(100,100,100,0.3)}
.ac-collapse-menu-item:active{background:rgba(100,100,100,0.5) !important}
@media(max-width:600px){
  #ac-collapse-menu{min-width:130px;font-size:12px}
  .ac-collapse-menu-item{padding:10px 14px;min-height:44px;box-sizing:border-box}
}

/* === 滚动条（全风格共享，色值由各风格 --ub-scrollbar-* 提供） === */
#ac-statusbar-wrapper::-webkit-scrollbar{width:6px}
#ac-statusbar-wrapper::-webkit-scrollbar-track{background:transparent}
#ac-statusbar-wrapper::-webkit-scrollbar-thumb{background:var(--ub-scrollbar-thumb);border-radius:3px}
#ac-statusbar-wrapper::-webkit-scrollbar-thumb:hover{background:var(--ub-scrollbar-thumb-hover)}

/* === 页面不可见时暂停所有动画（节省CPU/GPU，移动端省电关键） === */
#ac-statusbar-wrapper.ub-anim-paused,
#ac-statusbar-wrapper.ub-anim-paused *,
#ac-statusbar-wrapper.ub-anim-paused *::before,
#ac-statusbar-wrapper.ub-anim-paused *::after{
  animation-play-state:paused!important;
}

/* === F45(十一轮)：弹窗层动画同样在页面不可见时冻结 ===
 * 现状病灶：上面的暂停只覆盖状态栏本体；弹窗挂在 body 级 overlay（不在 wrapper 内），
 * 「新行呼吸高亮」（ub-new-highlight，box-shadow+filter = 每帧重绘型）在弹窗开着且
 * 页面切走时照常空烧。此处把同一冻结语义扩到三个 overlay 容器。
 * 注意：只由 document.hidden 触发（syncAnimState 内控制）——弹窗打开时自身可见，
 * 不能套用 wrapper 的 overlayOpen 暂停条件（那会把弹窗内动画在弹窗打开时全停）。
 * paused 会停帧但可恢复：入场动画中断处冻结、回页续播完成，与 wrapper 语义一致。 */
#panelOverlay.ub-anim-paused,#panelOverlay.ub-anim-paused *,
#panelOverlay.ub-anim-paused *::before,#panelOverlay.ub-anim-paused *::after,
#settingsOverlay.ub-anim-paused,#settingsOverlay.ub-anim-paused *,
#settingsOverlay.ub-anim-paused *::before,#settingsOverlay.ub-anim-paused *::after,
#ubDecisionOverlay.ub-anim-paused,#ubDecisionOverlay.ub-anim-paused *,
#ubDecisionOverlay.ub-anim-paused *::before,#ubDecisionOverlay.ub-anim-paused *::after{
  animation-play-state:paused!important;
}

/* === 跟随底部模式：彻底关闭所有动画/过渡（保流畅） ===
 * 与 ub-anim-paused（play-state:paused，停在当前帧）不同，此处用 animation:none
 * 彻底移除动画 —— 因为许多一次性入场动画从 opacity:0 起步（popup-in / char-panel
 * fade-in / book-page page-flip / ub-badge-pop），paused 会把它们冻在 0% 帧导致
 * 元素永久不可见。animation:none 让元素回归基础样式（opacity 默认 1）→ 可见且
 * 不产生任何持续重绘。语义与 prefers-reduced-motion 一致。 */
#ac-statusbar-wrapper.ub-anim-off,
#ac-statusbar-wrapper.ub-anim-off *,
#ac-statusbar-wrapper.ub-anim-off *::before,
#ac-statusbar-wrapper.ub-anim-off *::after{
  animation:none!important;
  transition:none!important;
}

/* === 选项栏跟随底部：独立浮动容器（嵌入 #chat 末尾，随消息流贴底） ===
 * 独立于 #ac-statusbar-wrapper，不受折叠按钮影响。
 * 性能约束：强制零动画/零过渡，仅保留即时背景色切换与点击交互，避免持续重绘造成卡顿。 */
#ac-options-bar-floating{
  position:relative;
  flex-shrink:0;
  width:100%;
  margin-top:8px;
  z-index:auto;
}
#ac-options-bar-floating,
#ac-options-bar-floating *,
#ac-options-bar-floating *::before,
#ac-options-bar-floating *::after{
  animation:none!important;
  transition:none!important;
}
/* 浮动栏内选项点击仅保留即时颜色反馈，禁用 transform/过渡 */
#ac-options-bar-floating .option-item:active{transform:none!important}
@media(prefers-reduced-motion:reduce){
  #ac-options-bar-floating,
  #ac-options-bar-floating *,
  #ac-options-bar-floating *::before,
  #ac-options-bar-floating *::after{animation:none!important;transition:none!important}
}

/* === 减弱动画（全风格共享，完全禁用动画） === */
@media(prefers-reduced-motion:reduce){
  #ac-statusbar-wrapper,
  #ac-statusbar-wrapper *,
  #ac-statusbar-wrapper *::before,
  #ac-statusbar-wrapper *::after{
    animation:none!important;
    transition:none!important;
  }
}

/* === 移动端降级：暂停 .book 上的无限动画（兜底） ===
 * 原 7 个 box-shadow 呼吸动画（ancient scroll-breathe/seal-pulse、flirtatious nsfw-breathe、
 * xianxia jade-breathe/nsfw-pulse、sweet sweet-breathe/nsfw-breathe）已全部改为静态光晕
 * （取各自 50% 帧的 box-shadow 固定值），不再有每帧 CPU 重绘。此规则保留作兜底：
 * 若未来再给 .book 加 infinite 动画，移动端仍会自动暂停以省电。 */
@media (max-width: 1024px){
  #ac-statusbar-wrapper .book{
    animation-play-state:paused!important;
  }
}

/* === 主题切换过渡动画（全风格共享） === */
#ac-content,.minimal-container{
  transition:opacity 0.25s ease;
}
#ac-content.ub-theme-switching,.minimal-container.ub-theme-switching{
  opacity:0;
}

/* === 通知徽章（融入按钮内部，各风格配色自适应） === */
.ub-btn-badged{position:relative!important;overflow:visible!important}
.ub-btn-badged .ub-badge{display:inline-flex!important}
.ub-badge{
  position:absolute;top:-7px;right:-8px;
  display:inline-flex;align-items:center;justify-content:center;
  min-width:15px;height:15px;padding:0 4px;
  font-size:9px;font-weight:700;line-height:1;
  pointer-events:none;user-select:none;z-index:2;
  animation:ub-badge-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes ub-badge-pop{
  0%{transform:scale(0);opacity:0}
  60%{transform:scale(1.2)}
  100%{transform:scale(1);opacity:1}
}
/* 新内容高亮呼吸 — 各风格独立配色 */
@keyframes ub-hl-breathe{
  0%,100%{box-shadow:inset 0 0 0 0 var(--ub-hl-color);filter:brightness(1)}
  50%{box-shadow:inset 0 0 0 4px var(--ub-hl-color),0 0 10px var(--ub-hl-color);filter:brightness(1.03)}
}
.ub-new-highlight{
  animation:ub-hl-breathe 2s ease-in-out infinite;
  border-radius:3px;position:relative;
}
.ub-new-highlight::after{
  content:'';position:absolute;top:0;left:0;right:0;bottom:0;
  pointer-events:none;border-radius:inherit;
}
/* 古风：朱砂红 */
.ub-hl-ancient{--ub-hl-color:rgba(181,54,46,0.2)}
.ub-hl-ancient::after{background:rgba(181,54,46,0.04)}
/* 弹窗控件防泄漏盾：酒馆美化主题常带全局 select/input !important 规则（如「双色盒子」
 * 把所有下拉框涂成主题深灰），会击穿弹窗内联样式。此盾用同特异性+!important 压回，
 * 值全部引用各主题既有 token（4 主题 .dark 作用域重定义、minimal 靠 body.dark-mode 继承），
 * 深浅自动跟随，零运行时开销。color-scheme 让原生部件（下拉箭头/日期选择器）同步翻色。 */
:is(.settings-overlay,.nsfw-overlay,.panel-overlay){color-scheme:light;color:var(--text,var(--text-color,#111));}
:is(.settings-overlay,.nsfw-overlay,.panel-overlay).dark{color-scheme:dark}
:is(.settings-overlay,.nsfw-overlay,.panel-overlay) :is(input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=color]),select,textarea){
  background-color:var(--card,var(--bg-color,#fff))!important;
  color:var(--text,var(--text-color,#333))!important;
  border-width:1px!important;border-style:solid!important;
  border-color:var(--divider,var(--border-color,#ccc))!important;
  font-family:inherit!important;
}
:is(.settings-overlay,.nsfw-overlay,.panel-overlay) option{
  background:var(--card,var(--bg-color,#fff))!important;
  color:var(--text,var(--text-color,#333))!important;
}
/* 占位符（::placeholder）单独一盾：浏览器 UA 默认占位色是**固定 #757575**，既不随 color-scheme 翻，
 * 也不认主题 token——深色弹窗底上只有 3.69:1（用户报「输入框里的提示文字看不清」），浅色底 4.61:1 反倒正常。
 * 故与上面的控件盾同作用域显式声明：取控件**自身字色**降透明度（inherit 而非某个具体 token，
 * map/技能/iov 等自带配色体系的输入框同样成立；深色少降为 .6、浅色 .75，实测七主题 + iOS/舰桥
 * 明暗两态最差 4.70:1 / 5.20:1，既够读又不抢过正文）。 */
:is(.settings-overlay,.nsfw-overlay,.panel-overlay) :is(input,textarea)::placeholder{color:inherit;opacity:.75}
:is(.settings-overlay,.nsfw-overlay,.panel-overlay).dark :is(input,textarea)::placeholder{color:inherit;opacity:.6}
/* 瑟瑟：霓虹粉 */
.ub-hl-flirtatious{--ub-hl-color:rgba(255,106,158,0.25)}
.ub-hl-flirtatious::after{background:rgba(255,106,158,0.04)}
/* 萦绕：黑色 */
.ub-hl-minimal{--ub-hl-color:rgba(0,0,0,0.12)}
.ub-hl-minimal::after{background:rgba(0,0,0,0.03)}
.dark .ub-hl-minimal,.dark-mode .ub-hl-minimal{--ub-hl-color:rgba(255,255,255,0.24)}
.dark .ub-hl-minimal::after,.dark-mode .ub-hl-minimal::after{background:rgba(255,255,255,0.06)}
/* 甜恋：糖果粉 */
.ub-hl-sweet{--ub-hl-color:rgba(255,107,138,0.2)}
.ub-hl-sweet::after{background:rgba(255,107,138,0.04)}
/* 云海：灵石青 */
.ub-hl-xianxia{--ub-hl-color:rgba(74,144,164,0.2)}
.ub-hl-xianxia::after{background:rgba(74,144,164,0.04)}
/* 舰桥：信号青 */
.ub-hl-bridge{--ub-hl-color:rgba(8,127,133,0.22)}
.ub-hl-bridge::after{background:rgba(8,127,133,0.045)}
/* 古风：朱砂印章 — 融合米黄金棕按钮调色 */
.ub-badge-ancient{background:#b5362e;color:#f5e6d0;font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.35);}
/* 瑟瑟：霓虹光点 — 融合暗底粉紫按钮 */
.ub-badge-flirtatious{background:linear-gradient(135deg,#ff4d80,#c03070);color:#fff;border-radius:8px;box-shadow:0 0 6px rgba(255,77,128,0.5);}
/* 萦绕：数字圈 — 跟随文字色 */
.ub-badge-minimal{background:var(--bg-color,#fff);color:var(--text-color,#111);border:1.5px solid var(--text-color,#111);border-radius:50%;min-width:17px;height:17px;padding:0;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;box-shadow:0 0 0 2px var(--bg-color,#fff)}
/* 甜恋：糖果心 — 融合粉白按钮 */
.ub-badge-sweet{background:linear-gradient(135deg,#ff7b9a,#ff5a80);color:#fff;border-radius:50%;min-width:17px;height:17px;padding:0;box-shadow:0 0 5px rgba(255,107,138,0.35);}
/* 云海：灵石 — 融合玉色按钮 */
.ub-badge-xianxia{background:linear-gradient(135deg,#5a9880,#3a7860);color:#e8f4f0;border-radius:2px;box-shadow:0 0 5px rgba(90,152,128,0.4),inset 0 1px 0 rgba(255,255,255,0.2);font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;}

/* === 选项栏基础样式（全风格共享） === */
/* §3.1 item3:option-item 背景 / option-number 背景字色原硬编码 #fff/#666 → 5 主题全链回退。
   §3.3 B 装饰(spec §3.2):option-item 左红竖条 + option-number 右竖分隔 + options-bar-title 菱形点(纯静态 CSS)。 */
.options-bar{margin-top:8px;border-top:1px solid var(--divider,rgba(128,128,128,0.2));padding-top:6px}
.options-bar-header{display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.options-bar-title{position:relative;font-size:11px;font-weight:600;letter-spacing:2px;opacity:0.7;text-transform:uppercase;padding-left:14px}
.options-bar-title::before{content:'';position:absolute;left:0;top:50%;width:6px;height:6px;transform:translateY(-50%) rotate(45deg);background:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#888))));opacity:0.85}
.options-bar-items{display:flex;flex-direction:column;gap:3px}
.option-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 11px;border:1px solid var(--divider,var(--sweet-border,var(--border-color,rgba(128,128,128,0.15))));border-left:3px solid var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#888))));border-radius:6px;background:var(--card,var(--sweet-card,var(--jade-surface-1,var(--bg-color,#fff))));color:var(--text,var(--sweet-text,var(--text-color,#111)));cursor:pointer;font-family:inherit;font-size:12px;text-align:left;transition:all 0.15s ease;line-height:1.4}
.option-item:hover{background:var(--divider-light,var(--divider,rgba(128,128,128,0.06)));border-color:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#888))))}
.option-item:active{transform:scale(0.98)}
.option-number{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:700;background:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#888))));color:var(--card,var(--sweet-card,var(--jade-surface-1,var(--bg-color,#fff))));border-right:1px solid var(--divider,var(--sweet-border,var(--border-color,rgba(128,128,128,0.18))));padding-right:6px;flex-shrink:0}
.option-text{flex:1;min-width:0;word-break:break-word}
.dark .option-item,.dark-mode .option-item{background:rgba(0,0,0,0.15);border-color:rgba(255,255,255,0.08);color:var(--text,#e0e0e0)}
.dark .option-item:hover,.dark-mode .option-item:hover{background:rgba(255,255,255,0.06);border-color:var(--accent,rgba(255,255,255,0.3))}
.minimal-container .options-bar{border-top:1px solid var(--border-color,#e0e0e0)}
.minimal-container .option-item{border-radius:0;border-width:0 0 1px 0;border-left:none;padding:8px 12px}
.minimal-container .option-item:last-child{border-bottom:none}
.minimal-container .option-item:hover{border-left:3px solid var(--text-color,#111);padding-left:9px}
.minimal-container .option-number{border-radius:0;background:var(--text-color,#111);color:var(--bg-color,#fff)}
.minimal-container .options-bar-title::before{background:var(--text-color,#111)}

/* 主角姓名可点击交互 */
.char-name-clickable{cursor:pointer;transition:color 0.15s ease,transform 0.1s ease,opacity 0.15s ease;user-select:none}
.char-name-clickable:hover{opacity:0.75}
.char-name-clickable:active{transform:scale(0.95);opacity:0.6}

/* === 设置面板中继承 .settings-btn 的文本按钮：去掉 icon 按钮的圆形微小约束 === */
.settings-popup .settings-btn {
  width: auto !important; height: auto !important;
  border-radius: 4px !important;
  min-width: auto; min-height: auto;
  display: inline-flex !important;
  line-height: 1.4;
}

/* 分段按钮选中态（经期三档/受孕四档/通知位置/意外事件背景等）：
   各主题 .settings-btn 自带 background:transparent，用 !important 覆盖；
   跨风格 accent 变量链与各分段按钮原有内联高亮一致。 */
.settings-popup .settings-btn.seg-active{
  background: var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9)))) !important;
  color:#fff !important;
  border-color: var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9)))) !important;
}

/* === 破限槽位编辑器（设置 → API → 破限提示词：破限头 / 尾部破限 同构两槽位） ===
   共享骨架放 base（各主题只管 token）；颜色一律三重 fallback 链（铁律 17）。
   段卡片左色标按身份区分：system=accent / user=lust / assistant=success。 */
.settings-popup .jb-slot{margin-top:8px;padding:9px 10px;border:1px solid var(--divider-light,var(--sweet-border,#e0e0e0));border-radius:6px;background:var(--bg-alt,rgba(180,170,150,.08))}
.settings-popup .jb-slot-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.settings-popup .jb-slot-title{font-size:12px;font-weight:600;color:var(--text,var(--sweet-text,#111))}
.settings-popup .jb-slot-pos{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));border:1px dashed var(--divider,var(--sweet-border,#e0e0e0));border-radius:9px;padding:1px 7px}
.settings-popup .jb-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0}
.settings-popup .jb-seg-list{display:flex;flex-direction:column;gap:7px;margin-top:6px}
.settings-popup .jb-seg-card{border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;background:var(--card,var(--sweet-card,#fff));overflow:hidden}
.settings-popup .jb-seg-card[data-role="system"]{border-left:3px solid var(--accent,var(--sweet-pink,var(--jade-deep,#4a90d9)))}
.settings-popup .jb-seg-card[data-role="user"]{border-left:3px solid var(--lust,var(--sweet-pink,var(--jade,#4a90d9)))}
.settings-popup .jb-seg-card[data-role="assistant"]{border-left:3px solid var(--success,var(--sweet-green,var(--jade,#3f6a52)))}
.settings-popup .jb-seg-bar{display:flex;align-items:center;gap:5px;padding:5px 7px;background:var(--card-deep,var(--sweet-card,#fff));border-bottom:1px solid var(--divider-light,var(--sweet-border,#e0e0e0));flex-wrap:wrap}
.settings-popup .jb-seg-idx{width:18px;height:18px;border-radius:50%;background:var(--accent,var(--sweet-pink,var(--jade-deep,#4a90d9)));color:#fff;font-size:10px;display:grid;place-items:center;flex:0 0 18px;font-weight:600}
.settings-popup .jb-seg-bar .spacer{flex:1}
.settings-popup .jb-seg-card textarea{width:100%;display:block;border:0;border-radius:0;padding:7px 9px;font-size:12px;line-height:1.5;font-family:inherit;background:transparent;color:var(--text,var(--sweet-text,#111));resize:vertical;min-height:52px}
.settings-popup .jb-seg-foot{display:flex;align-items:center;gap:6px;padding:4px 8px;border-top:1px dashed var(--divider-light,var(--sweet-border,#e0e0e0));font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));flex-wrap:wrap}
.settings-popup .jb-builtin{margin-top:6px}
.settings-popup .jb-builtin pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:11px;line-height:1.5;background:var(--bg-alt,rgba(180,170,150,.08));border:1px dashed var(--divider,var(--sweet-border,#e0e0e0));border-radius:5px;padding:7px 9px;color:var(--text-sub,var(--sweet-text,#333));max-height:150px;overflow:auto;margin:4px 0 0}
.settings-popup .jb-note{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:2px 0;line-height:1.5}
.settings-popup .jb-io-preview{margin-top:6px;padding:7px 9px;border:1px dashed var(--divider,var(--sweet-border,#e0e0e0));border-radius:5px;font-size:11px;line-height:1.5;color:var(--text-sub,var(--sweet-text,#333))}

/* ---- 按钮 / 下拉口径对齐（用户 2026-10-15 反馈「与设置里其它文字按钮不和谐」）----
   各主题 .settings-btn 自带尺寸与配色（iOS：30px 高·灰底·无边框·600 字重；sweet：16px 字号；古风：24px 圆钮…），
   新板块直接吃主题默认值 ⇒ 比邻座按钮大一圈、配色也不同。此处按设置页既有的两种口径统一：
   · 动作按钮 / 身份 chips / 图标按钮 = 文本按钮口径（11px / 5px 10px / 行高 1 / 卡片底 + 1px 分隔线 / 文字色）
     —— 与「生成预设」「上下文标签剥离」等保存/删除按钮同款；
   · 档位按钮（默认·空·自定义）= 分段按钮口径（12px / 6px 12px）—— 与「经期三档」「意外事件背景」同款。
   一律 !important：需压过主题 .settings-btn 与 base 既有的 width/height:auto!important。
   ★顺序敏感：.seg-active 规则必须写在本组最后（与 base 既有 .seg-active 同特异度，靠源码顺序取胜），
     否则选中态会被上面的底色覆盖（选了跟没选一样）。 */
.settings-popup .jb-slot .settings-btn{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  width:auto!important;height:auto!important;min-width:0;min-height:0!important;
  padding:5px 10px!important;font-size:11px!important;font-weight:400!important;line-height:1!important;
  border-radius:4px!important;
  background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))!important;
  border:1px solid var(--divider,var(--sweet-border,#e0e0e0))!important;
  color:var(--text,var(--sweet-text,#111))!important;
}
.settings-popup .jb-slot .settings-btn:hover{
  border-color:var(--accent,var(--sweet-pink,var(--jade-deep,#4a90d9)))!important;
  color:var(--accent,var(--sweet-pink,var(--jade-deep,#4a90d9)))!important;
}
.settings-popup .jb-slot .settings-btn:disabled{opacity:.45;cursor:not-allowed}
.settings-popup .jb-slot .jb-mode{padding:6px 12px!important;font-size:12px!important}
.settings-popup .jb-slot .jb-rchip{padding:3px 9px!important;font-size:11px!important}
.settings-popup .jb-slot .jb-icon-btn{width:22px!important;height:22px!important;min-width:22px!important;padding:0!important;font-size:10px!important}
.settings-popup .jb-slot .settings-btn.jb-add{
  margin-top:7px;
  background:transparent!important;
  border:1px dashed var(--accent,var(--sweet-pink,var(--jade-deep,#4a90d9)))!important;
  color:var(--accent,var(--sweet-pink,var(--jade-deep,#4a90d9)))!important;
}
.settings-popup .jb-slot .settings-btn.seg-active{
  background:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))))!important;
  color:#fff!important;
  border-color:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))))!important;
}
.settings-popup .jb-slot select{
  flex:1 1 140px;min-width:0;padding:5px 8px;font-size:11px;font-family:inherit;cursor:pointer;appearance:auto;
  border:1px solid var(--divider,var(--sweet-border,#e0e0e0));
  background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));
  color:var(--text,var(--sweet-text,#111));border-radius:4px;
}
@media (max-width:480px){
  .settings-popup .jb-slot select{flex:1 1 100%}
  .settings-popup .jb-row > .settings-btn{flex:1 1 auto}
}

/* 外部存储兼容页：所有操作保持统一尺寸，桌面双列、手机单列。 */
.ub-storage-intro{font-size:var(--ub-ui-font-11,11px);line-height:1.65;
  color:var(--text-muted,var(--sweet-text-muted,#999));margin-bottom:10px;}
.ub-storage-section{display:flex;flex-direction:column;gap:6px;}
.ub-storage-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;}
.settings-popup .ub-storage-action{width:100%;min-width:0;min-height:34px;
  display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;
  padding:7px 10px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));
  border-radius:6px;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));
  color:var(--text,var(--sweet-text,#111));font:inherit;font-size:11px;line-height:1.35;
  text-align:center;cursor:pointer;}
.settings-popup .ub-storage-action:hover:not(:disabled){
  border-color:var(--accent,var(--sweet-pink,var(--jade,#4a90d9)));}
.settings-popup .ub-storage-action.danger{color:var(--danger,#c0392b);
  border-color:var(--danger,#c0392b);}
.settings-popup .ub-storage-action:disabled{opacity:.42;cursor:not-allowed;}
.ub-storage-footnote{font-size:var(--ub-ui-font-10,10px);line-height:1.5;
  color:var(--text-muted,var(--sweet-text-muted,#999));margin-top:8px;}
@media (max-width:480px){
  .ub-storage-actions{grid-template-columns:1fr;}
  .settings-popup .ub-storage-action{min-height:38px;}
}

/* === 模型组合框下拉浮层（5 主题 + bridge 共用，主题变量三重 fallback） ===
   锚在模型字段内层行（position:relative）下方，自定义绝对定位 div，
   非原生 datalist/select，移动端正常弹出。 */
.ub-model-popover{display:none;position:absolute;top:100%;left:0;right:0;
  margin-top:4px;max-height:240px;overflow-y:auto;overflow-x:hidden;
  z-index:50;border-radius:4px;
  border:1px solid var(--divider,var(--sweet-border,#e0e0e0));
  background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));
  color:var(--text,var(--sweet-text,#111));
  font-size:12px;font-family:inherit;line-height:1.4;
  box-shadow:0 4px 14px rgba(0,0,0,.18);
  -webkit-overflow-scrolling:touch;}
.ub-model-popover.is-open{display:block;}
.ub-model-popover-item{padding:6px 10px;cursor:pointer;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;
  border-bottom:1px solid var(--divider,var(--sweet-border,rgba(128,128,128,.12)));}
.ub-model-popover-item:last-child{border-bottom:none;}
.ub-model-popover-item:hover{background:var(--divider,var(--sweet-border,rgba(128,128,128,.15)));}
.ub-model-popover-empty{padding:8px 10px;color:var(--text-muted,var(--sweet-text-muted,#999));
  font-size:11px;text-align:center;}
/* 关闭「新手指导」时隐藏设置面板内所有「?」帮助提示 */
.settings-popup.hide-help .help-tip-btn { display: none !important; }

/* === 设置面板分组小标题（主题变量驱动，深色自动翻转） === */
.group-title{font-size:11px;font-weight:600;letter-spacing:.5px;
  color:var(--text-muted,#999);margin:14px 0 4px;padding:0 2px;
  border-bottom:1px solid var(--divider,rgba(128,128,128,.2));padding-bottom:4px;}
.group-title:first-child{margin-top:0;}

/* === 功能卡片状态徽标（绿/灰 pill，含 .dark 与 minimal .dark-mode 双作用域覆盖） === */
.feature-status{font-size:10px;font-weight:600;padding:1px 8px;border-radius:10px;
  white-space:nowrap;flex-shrink:0;}
.feature-status.on{color:#fff;background:#3ba55d;}
.feature-status.off{color:var(--text-muted,#999);background:rgba(128,128,128,.12);}
.dark .feature-status.on,.dark-mode .feature-status.on{background:#43b581;}
.dark .feature-status.off,.dark-mode .feature-status.off{background:rgba(255,255,255,.08);}

/* === API 指示徽标（标注该功能可能涉及额外 LLM 请求） === */
.api-badge{font-size:11px;line-height:1;flex-shrink:0;cursor:help;}

/* === 统一生图 API：与 API 标签页其它模块共用同一套字号、间距与主题变量 === */
.ub-image-generation-module{padding-top:2px;}
.ub-api-subsection{padding:8px 0 2px;border-top:1px solid var(--divider,var(--sweet-border,rgba(128,128,128,.2)));}
.ub-api-subsection:first-child{padding-top:2px;border-top:none;}
.ub-api-subsection-title{font-size:11px;font-weight:600;color:var(--text,var(--sweet-text,#111));line-height:1.4;}
.ub-api-subsection-desc{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));line-height:1.45;margin:2px 0 4px;}
.ub-image-generation-module .settings-row{padding:4px 0;}
.ub-image-generation-module .settings-label{font-size:11px;}
.image-provider-switch{display:flex;width:100%;overflow:hidden;border:1px solid var(--divider,var(--sweet-border,#ccc));border-radius:5px;}
.image-provider-btn{flex:1;padding:5px 8px;border:0;border-right:1px solid var(--divider,var(--sweet-border,#ccc));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));font:inherit;font-size:11px;line-height:1.3;cursor:pointer;}
.image-provider-btn:last-child{border-right:0;}
.image-provider-btn.active{background:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))));color:#fff;}
.image-provider-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;width:100%;}
.image-provider-grid label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--text,var(--sweet-text,#111));}
.ub-image-generation-module .settings-btn{font-size:11px;padding:5px 10px;line-height:1.2;}
.dark .image-provider-btn,.dark-mode .image-provider-btn{background:var(--card,var(--sweet-card,rgba(255,255,255,.06)));}
.dark .ub-api-subsection-desc,.dark-mode .ub-api-subsection-desc{color:var(--text-muted,rgba(255,255,255,.5));}
@media(max-width:520px){.image-provider-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}

/* === 统一生图模块「预设内容」容器：主题色左边框 + 淡色底（5 主题深浅色全适配，禁渐变） === */
.ub-preset-panel{margin:6px 0 2px;padding:8px 10px;border-left:3px solid var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))));border-radius:0 4px 4px 0;background:rgba(128,128,128,0.06);display:flex;flex-direction:column;gap:4px;}
.ub-preset-panel-title{font-size:11px;font-weight:600;color:var(--text,var(--sweet-text,#111));line-height:1.4;}
.ub-preset-panel-desc{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));line-height:1.45;}
.ub-adv-check{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-family:inherit;color:var(--text,var(--sweet-text,#111));cursor:pointer;line-height:1.4;user-select:none;}
.ub-adv-check input[type="checkbox"]{width:13px;height:13px;margin:0;cursor:pointer;accent-color:var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#4a90d9))));}
.dark .ub-preset-panel,.dark-mode .ub-preset-panel{background:rgba(255,255,255,0.05);border-left-color:var(--accent,var(--sweet-pink,var(--text,#7aa7d9)));}
.dark .ub-preset-panel-title,.dark-mode .ub-preset-panel-title{color:var(--text,var(--sweet-text,#eee));}
.dark .ub-preset-panel-desc,.dark-mode .ub-preset-panel-desc{color:var(--text-muted,rgba(255,255,255,.5));}
.dark .ub-adv-check,.dark-mode .ub-adv-check{color:var(--text,var(--sweet-text,#eee));}

/* === 功能卡片 summary（双行布局：第一行图标/徽标/帮助/toggle，第二行描述） === */
.settings-section-summary{display:block;cursor:pointer;padding:6px 0;font-weight:600;font-size:var(--ub-ui-font-12,12px);color:var(--text,var(--sweet-text,var(--text-color,#111)));}
.settings-section-summary > .summary-row1{display:flex;align-items:center;gap:8px;}
.settings-section-summary > .summary-desc{font-weight:400;font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,#999);margin-top:2px;line-height:1.4;}
/* 深色模式：描述文字 + 三角标记颜色 */
.dark .settings-section-summary > .summary-desc,
.dark-mode .settings-section-summary > .summary-desc{color:var(--text-muted,rgba(255,255,255,0.5));}
.dark .settings-section-summary::-webkit-details-marker,
.dark-mode .settings-section-summary::-webkit-details-marker{color:var(--text-muted,rgba(255,255,255,0.5));}
/* 次级折叠箭头（嵌套 details 的 summary 行尾，如正文插图「数值参数」）：summary 的 display:block
   会吃掉浏览器默认展开三角，自绘 ▾ 并随开合旋转才是全引擎可见的开合暗示 */
.ub-fold-arrow{display:inline-block;font-size:10px;opacity:.7;margin-left:auto;transition:transform .18s ease;}
details[open]>summary .ub-fold-arrow{transform:rotate(180deg);}

/* === 角色世界书模板库：使用所有主题共享的设置控件变量，避免内联色值绕过主题 === */
.character-worldbook-settings .character-worldbook-template-library{display:flex;flex-direction:column;gap:10px;}
.character-worldbook-settings .character-worldbook-template-picker,
.character-worldbook-settings .character-worldbook-template-editor{flex-direction:column;align-items:stretch;gap:6px;}
.character-worldbook-settings .character-worldbook-template-picker{align-items:flex-start;gap:5px;}
.character-worldbook-settings .character-worldbook-template-editor{padding:8px 0;border-top:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.24))));}
.character-worldbook-settings .character-worldbook-template-input{width:100%;box-sizing:border-box;min-width:0;padding:6px 8px;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:4px;background:var(--card,var(--sweet-card,var(--jade-surface-1,transparent)));color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font:inherit;font-size:var(--ub-ui-font-12,12px);line-height:1.45;}
.character-worldbook-settings .character-worldbook-template-input:focus{outline:none;border-color:var(--accent,var(--sweet-pink,var(--jade-deep,currentColor)));box-shadow:0 0 0 1px var(--accent,var(--sweet-pink,var(--jade-deep,currentColor)));}
.character-worldbook-settings .character-worldbook-template-input:read-only{opacity:.78;cursor:default;}
.character-worldbook-settings .character-worldbook-template-body{min-height:110px;resize:vertical;font-size:var(--ub-ui-font-11,11px);}
.character-worldbook-settings .character-worldbook-template-name-row{display:flex;align-items:center;gap:6px;min-width:0;}
.character-worldbook-settings .character-worldbook-template-kind{flex:0 0 auto;color:var(--text-muted,var(--sweet-text-muted,var(--jade-text-muted,#999)));font-size:var(--ub-ui-font-10,10px);}
.character-worldbook-settings .character-worldbook-template-actions{display:flex;gap:6px;flex-wrap:wrap;}
.character-worldbook-settings .settings-action-btn{display:inline-flex;align-items:center;justify-content:center;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,var(--jade-border,rgba(128,128,128,.4))));border-radius:4px;background:var(--card,var(--sweet-card,var(--jade-surface-1,transparent)));color:var(--text,var(--sweet-text,var(--jade-text,inherit)));font:inherit;font-size:var(--ub-ui-font-11,11px);line-height:1;cursor:pointer;white-space:nowrap;transition:all .15s;}
.character-worldbook-settings .settings-action-btn:hover:not(:disabled){border-color:var(--accent,var(--sweet-pink,var(--jade-deep,currentColor)));color:var(--accent,var(--sweet-pink,var(--jade-deep,currentColor)));}
.character-worldbook-settings .settings-action-btn:disabled{opacity:.5;cursor:not-allowed;}

/* === 功能未开启时灰显（卡片仍可展开查看参数，但设置不可操作） === */
.ub-disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.5);}
.dark .ub-disabled,.dark-mode .ub-disabled{opacity:0.35;}

/* === 玩法示意图弹窗（跨主题共享，复用 panelOverlay/.panel-popup 框架） === */
.play-img-popup{max-width:520px;width:92vw}
.play-img-wrap{display:flex;align-items:center;justify-content:center;min-height:160px;margin:0 auto}
.play-img{max-width:100%;max-height:65vh;max-height:65dvh;object-fit:contain;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,0.25)}
.play-img-error{color:var(--text-muted,#999);font-size:var(--ub-ui-font-13,13px);padding:24px 8px;line-height:1.6}
.play-img-nav{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:10px}
.play-img-arrow{width:34px;height:34px;border-radius:50%;border:1px solid var(--divider,#ccc);background:var(--card);color:var(--ub-text,#333);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.play-img-arrow:hover:not(:disabled){filter:brightness(1.08);transform:scale(1.05)}
.play-img-arrow:disabled{opacity:.35;cursor:not-allowed}
.play-img-counter{font-size:12px;color:var(--text-muted,#999);min-width:48px;text-align:center}

/* === 数据库表格查看弹窗（跨主题共享，复用 panelOverlay/.panel-popup 框架） === */
.db-viewer-popup{max-width:720px;width:94vw}
/* flex:0 0 auto 不可省：.db-tabs 自己是滚动容器（overflow-x:auto ⇒ 纵向也 auto），
   规范里滚动容器的自动最小尺寸=0，故在 .panel-popup-body 这个纵向 flex 容器里本可被压缩——
   卡片内容一高（13 字段长卡 ≈620px）标签条就会被挤扁，标签文字上下裁掉、标签条自己长出竖向滚动条
   （V3.745 只给 .db-toolbar 补了同位规则，漏了标签条）。 */
.db-tabs{flex:0 0 auto;display:flex;gap:4px;overflow-x:auto;padding:6px 10px;border-bottom:1px solid var(--divider,#ccc);scrollbar-width:thin}
.db-tab{flex:0 0 auto;padding:5px 10px;border:1px solid var(--divider,#ccc);border-radius:6px;background:var(--card-light,var(--card));color:var(--text-muted,#999);font-size:12px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;transition:all .2s}
.db-tab:hover{filter:brightness(1.03)}
.db-tab[data-active="1"]{background:var(--accent,#3a7db5);color:#fff;border-color:var(--accent,#3a7db5)}
.db-tab-badge{font-size:10px;opacity:.7}
/* 总览弹窗单滚动容器（两段演进）：
   ① V3.745 修双竖滚动条——原先 .panel-popup-body(72vh 内 flex 收缩自滚) 与 .db-tab-panel(55vh 上限)
      嵌套，改为 body 只做纵向布局不滚、滚动集中到 panel；panel flex-basis:auto 保证短表弹窗仍随内容收缩。
   ② V3.762 横向滚动条常驻可视区底部——横向滚动条原属 .db-cards（卡片条自身 overflow-x），
      其盒底随内容走，卡片比可视区高时必须把竖向滚到底才见横条；现把滚动权整体交给卡片条
      （panel 只做纵向布局 overflow:hidden、工具栏 flex:0 0 auto 钉顶、.db-cards 双向滚动），
      卡片条盒底=可视区底边，横条随时可拖；translateZ(0) 把该滚动层提前提升为独立合成层，
      规避老 Chromium 对新晋双轴滚动层"滚出视口内容丢背景只剩文字"的涂装 bug（用户实机复现）。 */
.db-viewer-popup .panel-popup-body{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.db-viewer-popup .db-tab-panel{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.db-viewer-popup .db-toolbar{flex:0 0 auto}
.db-cards{display:flex;gap:10px;overflow:auto;padding:8px 10px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.db-viewer-popup .db-cards{flex:1 1 auto;min-height:0;transform:translateZ(0)}
.db-card{flex:0 0 70%;max-width:260px;scroll-snap-align:start;border:1px solid var(--divider,#e5e5e5);border-radius:10px;background:var(--card-light,var(--card));padding:10px 12px;cursor:pointer;transition:border-color .15s,transform .1s;display:flex;flex-direction:column;gap:6px}
.db-card:hover{border-color:var(--accent,#3a7db5)}
.db-card:active{transform:scale(.98)}
.db-card-title{font-size:14px;font-weight:600;color:var(--ub-text,#333);line-height:1.3;word-break:break-word;border-bottom:1px solid var(--divider,#eee);padding-bottom:6px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.db-card-fields{display:flex;flex-direction:column;gap:5px}
.db-card-field{display:flex;flex-direction:column;gap:1px}
.db-card-label{font-size:10px;color:var(--text-muted,#999);letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.db-card-value{font-size:var(--ub-ui-font-12,12px);color:var(--ub-text,#333);line-height:1.4;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.db-card-value.is-empty{color:var(--text-muted,#bbb);font-style:italic}
.db-card-hint{font-size:10px;color:var(--text-muted,#aaa);margin-top:auto;text-align:right}
.db-card-empty{flex:0 0 100%;text-align:center;color:var(--text-muted,#999);font-size:var(--ub-ui-font-12,12px);border:none;background:none;cursor:default}
/* O30 长表「加载更多」：首屏上限后的追加入口（复用 .db-add-btn 外观） */
.db-load-more-wrap{display:flex;justify-content:center;padding:10px 0 4px}
@media(min-width:640px){.db-card{flex:0 0 220px}}
/* 行详情弹窗（独立 overlay，复用 .panel-popup 框架） */
.db-row-detail-popup{max-width:560px;width:92vw}
.db-row-field{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--divider,#e5e5e5)}
.db-row-field:last-child{border-bottom:none}
.db-row-field-label{font-size:11px;color:var(--text-muted,#999);letter-spacing:.5px;flex-shrink:0}
.db-row-field-value{font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333);line-height:1.5;white-space:pre-wrap;word-break:break-word}
.db-row-field textarea{width:100%;min-height:60px;font-family:inherit;font-size:var(--ub-ui-font-13,13px);line-height:1.5;padding:6px 8px;border:1px solid var(--divider,#ccc);border-radius:4px;background:var(--card-light,var(--card));color:var(--ub-text,#333);resize:vertical;box-sizing:border-box}
.db-row-field textarea:focus{outline:none;border-color:var(--accent,#3a7db5)}
.db-edit-actions{display:flex;gap:8px;align-items:center}
.db-edit-btn{padding:4px 12px;border:1px solid var(--divider,#ccc);border-radius:4px;background:var(--card-light,var(--card));color:var(--ub-text,#333);font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit}
.db-edit-btn:hover{border-color:var(--accent,#3a7db5);color:var(--accent,#3a7db5)}
.db-edit-btn.primary{background:var(--accent,#3a7db5);color:#fff;border-color:var(--accent,#3a7db5)}
.db-edit-btn.primary:hover{filter:brightness(1.08);color:#fff}
/* 三按钮保存确认框（复用 .panel-popup） */
.db-confirm-popup{max-width:340px;width:88vw;display:flex;flex-direction:column;min-height:0}
.db-confirm-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:18px 20px;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333);line-height:1.6;text-align:center}
.db-confirm-actions{flex:0 0 auto;display:flex;gap:8px;justify-content:center;padding:0 20px 18px}
/* === 深色模式适配（4 主题 overlay 带 .dark；minimal 带 .dark-mode） === */
.dark .db-tab,.dark-mode .db-tab{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12);color:var(--text-muted,#aaa)}
.dark .db-tab[data-active="1"],.dark-mode .db-tab[data-active="1"]{background:var(--accent,#3a7db5);color:#fff;border-color:var(--accent,#3a7db5)}
.dark .db-card,.dark-mode .db-card{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12)}
.dark .db-card:hover,.dark-mode .db-card:hover{border-color:var(--accent,#5a9fd4)}
.dark .db-card-title,.dark-mode .db-card-title{color:var(--text,#eee);border-color:rgba(255,255,255,.1)}
.dark .db-card-value,.dark-mode .db-card-value{color:var(--text,#ddd)}
.dark .db-card-label,.dark-mode .db-card-label{color:var(--text-muted,#888)}
.dark .db-row-field-value,.dark-mode .db-row-field-value{color:var(--text,#eee)}
.dark .db-row-field-label,.dark-mode .db-row-field-label{color:var(--text-muted,#888)}
.dark .db-row-field textarea,.dark-mode .db-row-field textarea{background:rgba(255,255,255,.05);color:var(--text,#eee);border-color:rgba(255,255,255,.15)}
.dark .db-row-field textarea:focus,.dark-mode .db-row-field textarea:focus{border-color:var(--accent,#5a9fd4)}
.dark .db-edit-btn,.dark-mode .db-edit-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.15);color:var(--text,#ddd)}
.dark .db-edit-btn:hover,.dark-mode .db-edit-btn:hover{border-color:var(--accent,#5a9fd4);color:var(--accent,#5a9fd4)}
.dark .db-confirm-body,.dark-mode .db-confirm-body{color:var(--text,#eee)}

/* === 数据库查看器：新增/删除/筛选（追加，沿用既有 db-* token 体系） === */
.db-search{flex:1 1 auto;min-width:60px;margin:0 8px;padding:5px 10px;font-size:var(--ub-ui-font-13,13px);font-family:inherit;border-radius:6px;border:1px solid var(--divider,#ccc);background:var(--card-light,var(--card));color:var(--ub-text,#333);transition:border-color .15s}
.db-search:focus{outline:none;border-color:var(--accent,#3a7db5)}
.db-toolbar{display:flex;align-items:center;justify-content:flex-start;gap:8px;padding:6px 10px 8px}
.db-add-btn{display:inline-flex;align-items:center;gap:4px;height:28px;box-sizing:border-box;padding:5px 14px;font-size:13px;font-family:inherit;cursor:pointer;border-radius:6px;border:1px solid var(--accent,#3a7db5);background:var(--card-light,var(--card));color:var(--accent,#3a7db5);transition:all .15s}
.db-add-btn:hover{background:var(--accent,#3a7db5);color:#fff}
.db-add-icon{font-size:15px;line-height:1}
.db-count{font-size:var(--ub-ui-font-12,12px);color:var(--text-muted,#999);white-space:nowrap}
.db-count.is-hidden{display:none}
.db-sort-select{appearance:none;-webkit-appearance:none;height:28px;box-sizing:border-box;margin-left:8px;padding:5px 22px 5px 10px;font-size:var(--ub-ui-font-13,13px);font-family:inherit;border-radius:6px;border:1px solid var(--divider,#ccc);background:var(--card-light,var(--card));color:var(--ub-text,#333);cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--text-muted,#999) 50%),linear-gradient(135deg,var(--text-muted,#999) 50%,transparent 50%);background-position:calc(100% - 14px) 52%,calc(100% - 9px) 52%;background-size:5px 5px;background-repeat:no-repeat;transition:border-color .15s}
.db-sort-select:focus{outline:none;border-color:var(--accent,#3a7db5)}
.db-sort-dir{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;box-sizing:border-box;padding:0;font-size:15px;line-height:1;cursor:pointer;border-radius:6px;border:1px solid var(--accent,#3a7db5);background:var(--card-light,var(--card));color:var(--accent,#3a7db5);transition:all .15s;font-family:inherit}
.db-sort-dir:hover{background:var(--accent,#3a7db5);color:#fff}
.db-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;border-bottom:1px solid var(--divider,#eee);padding-bottom:6px}
.db-card-head .db-card-title{flex:1 1 auto;border-bottom:none;padding-bottom:0}
.db-merge-mark{flex:0 0 auto;display:inline-block;padding:1px 6px;font-size:11px;font-weight:600;line-height:1.5;border-radius:9px;background:rgba(58,125,181,.12);color:var(--accent,#3a7db5);border:1px solid var(--accent,#3a7db5);white-space:nowrap;cursor:default}
.dark .db-merge-mark,.dark-mode .db-merge-mark{background:rgba(90,159,212,.16);border-color:var(--accent,#5a9fd4);color:var(--accent,#5a9fd4)}
.db-card-actions{display:flex;align-items:center;gap:2px;flex:0 0 auto}
.db-card-migrate{width:22px;height:22px;padding:0;font-size:16px;line-height:1;cursor:pointer;border:none;border-radius:4px;background:transparent;color:var(--accent,#3a7db5);opacity:.55;transition:opacity .15s,color .15s,background .15s}
.db-card-migrate:hover,.db-card-migrate:focus-visible{opacity:1;color:var(--accent,#3a7db5);background:rgba(80,130,180,.12);outline:none}
.db-card-migrate:disabled{cursor:wait;opacity:.3}
.db-card-del{flex:0 0 auto;width:22px;height:22px;padding:0;font-size:16px;line-height:1.1;cursor:pointer;border:none;border-radius:4px;background:transparent;color:var(--text-muted,#bbb);opacity:.45;transition:opacity .15s,color .15s}
.db-card-del:hover,.db-card-del:focus-visible{opacity:1;color:#d33;outline:none}
.db-hit{background:rgba(255,204,0,.35);color:inherit;border-radius:2px;padding:0 1px}
.db-danger{color:#d33 !important;border-color:#d33 !important}
.db-danger:hover{background:#d33 !important;color:#fff !important;border-color:#d33 !important}
.db-danger-armed{background:#d33 !important;color:#fff !important;border-color:#d33 !important;animation:ub-db-armed .4s ease-out}
@keyframes ub-db-armed{0%{box-shadow:0 0 0 0 rgba(221,51,51,.5)}100%{box-shadow:0 0 0 6px rgba(221,51,51,0)}}
.db-del-confirm-warn{margin:6px 20px 0;font-size:12px;color:#d33;line-height:1.5}
.db-row-field-readonly{opacity:.65;font-style:italic}
.db-readonly-hint{font-size:10px;font-style:normal;opacity:.75;color:var(--text-muted,#999);margin-left:4px}
.dark .db-search,.dark-mode .db-search{background:rgba(255,255,255,.05);color:var(--text,#eee);border-color:rgba(255,255,255,.15)}
.dark .db-search:focus,.dark-mode .db-search:focus{border-color:var(--accent,#5a9fd4)}
.dark .db-add-btn,.dark-mode .db-add-btn{background:rgba(255,255,255,.06);border-color:var(--accent,#5a9fd4);color:var(--accent,#5a9fd4)}
.dark .db-add-btn:hover,.dark-mode .db-add-btn:hover{background:var(--accent,#5a9fd4);color:#fff}
.dark .db-card-del,.dark-mode .db-card-del{color:var(--text-muted,#888)}
.dark .db-hit,.dark-mode .db-hit{background:rgba(255,204,0,.28)}
.dark .db-sort-select,.dark-mode .db-sort-select{background:rgba(255,255,255,.05);color:var(--text,#eee);border-color:rgba(255,255,255,.15)}
.dark .db-sort-select:focus,.dark-mode .db-sort-select:focus{border-color:var(--accent,#5a9fd4)}
.dark .db-sort-dir,.dark-mode .db-sort-dir{background:rgba(255,255,255,.06);border-color:var(--accent,#5a9fd4);color:var(--accent,#5a9fd4)}
.dark .db-sort-dir:hover,.dark-mode .db-sort-dir:hover{background:var(--accent,#5a9fd4);color:#fff}
.db-card-lock{flex:0 0 auto;width:22px;height:22px;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border:none;border-radius:4px;background:transparent;opacity:.7;transition:opacity .15s,background .15s}
.db-card-lock:hover,.db-card-lock:focus-visible{opacity:1;background:rgba(80,130,180,.12);outline:none}
.db-card-lock:disabled{cursor:not-allowed;opacity:.3}
.db-cell-lock-btn{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;padding:0;margin-right:4px;vertical-align:middle;cursor:pointer;border:none;border-radius:3px;background:transparent;opacity:.6;transition:opacity .15s,background .15s}
/* F23 触控热区（触屏端放大；成簇按钮不做透明桥——外扩会抢相邻按钮命中） */
@media (hover:none) and (pointer:coarse){
  .db-card-migrate,.db-card-del,.db-card-lock{width:30px;height:30px;font-size:18px}
  .db-card-actions{gap:6px}
  .db-cell-lock-btn{width:26px;height:26px;margin-right:6px}
}
.db-cell-lock-btn:hover,.db-cell-lock-btn:focus-visible{opacity:1;background:rgba(80,130,180,.12);outline:none}
.db-cell-lock-btn:disabled{cursor:not-allowed;opacity:.3}
.db-lock-icon{color:var(--text-muted,#999);display:block}
.db-lock-icon.is-locked{color:var(--accent,#3a7db5)}
.db-row-lock-btn{display:inline-flex;align-items:center;gap:4px}
.db-row-lock-btn .db-lock-icon{width:13px;height:13px}
.db-edit-btn:disabled,.db-row-lock-btn:disabled{cursor:not-allowed;opacity:.5}
.db-row-field.is-cell-locked textarea{background:rgba(0,0,0,.03);color:var(--text-muted,#999);cursor:default}
.dark .db-lock-icon,.dark-mode .db-lock-icon{color:var(--text-muted,#888)}
.dark .db-lock-icon.is-locked,.dark-mode .db-lock-icon.is-locked{color:var(--accent,#5a9fd4)}
.dark .db-card-lock:hover,.dark-mode .db-card-lock:hover{background:rgba(255,255,255,.08)}
.dark .db-cell-lock-btn:hover,.dark-mode .db-cell-lock-btn:hover{background:rgba(255,255,255,.08)}
.dark .db-row-field.is-cell-locked textarea,.dark-mode .db-row-field.is-cell-locked textarea{background:rgba(255,255,255,.04);color:var(--text-muted,#888)}
/* === [LEGACY-MERGE · DB-ONLY] 纪要合并弹窗（沿用 db-* token 体系）
   仅状态栏数据库模式使用；台账接管时合并由台账工作台「纪要合并」标签执行。
   后续移除状态栏合并时，本段 db-merge-*/cm-* 样式一并删除。 === */
.db-merge-btn{margin-left:4px}
.db-merge-warning-list{margin:12px 0;padding-left:20px;line-height:1.8;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333)}
.db-merge-warning-list li{margin-bottom:6px}
.db-merge-warning-list b{color:var(--accent,#d33)}
.db-merge-form{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:12px 0}
.db-merge-form label{display:flex;align-items:center;gap:8px;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333)}
.db-merge-form input{width:72px;padding:5px 8px;font-size:var(--ub-ui-font-13,13px);font-family:inherit;border:1px solid var(--divider,#ccc);border-radius:6px;background:var(--card-light,var(--card));color:var(--ub-text,#333);box-sizing:border-box}
.db-merge-form input:focus{outline:none;border-color:var(--accent,#3a7db5)}
.db-merge-preview{margin:8px 0 16px;padding:10px 12px;background:var(--card-light,var(--card));border:1px solid var(--divider,#e5e5e5);border-radius:6px;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333);line-height:1.5}
.db-merge-preview b{color:var(--accent,#3a7db5)}
.db-merge-action-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;align-items:center}
.db-merge-confirm-text{font-size:var(--ub-ui-font-12,12px);color:var(--text-muted,#999);margin-right:auto;line-height:1.5}
.db-merge-progress-bar-wrap{height:6px;background:var(--divider,rgba(0,0,0,.1));border-radius:3px;overflow:hidden;margin:8px 0 12px}
.db-merge-progress-bar{height:100%;background:var(--accent,#3a7db5);transition:width .3s}
.db-merge-segment-card{border:1px solid var(--ub-divider,#ddd);border-radius:6px;padding:8px 10px;margin-bottom:8px}
.db-merge-segment-card.is-running{border-color:var(--accent,#3a7db5);background:rgba(58,125,181,.06)}
.db-merge-segment-card.is-success{border-color:#3a3}
.db-merge-segment-card.is-failed{border-color:#d33;background:rgba(221,51,51,.05)}
.db-merge-segment-card.is-skipped{opacity:.5}
.db-merge-segment-head{display:flex;align-items:center;gap:8px;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333);flex-wrap:wrap}
.db-merge-segment-icon{font-size:15px;line-height:1}
.db-merge-segment-am{font-weight:600;color:var(--ub-text,#333)}
.db-merge-segment-status{color:var(--text-muted,#888);font-size:var(--ub-ui-font-12,12px)}
.db-merge-segment-retry{color:#d33;font-size:var(--ub-ui-font-12,12px)}
.db-merge-segment-error{color:#d33;font-size:var(--ub-ui-font-12,12px);margin-top:4px;line-height:1.4}
.db-merge-segment-preview{margin-top:6px;padding:6px 8px;background:var(--card-light,rgba(0,0,0,.03));border-radius:4px;font-size:var(--ub-ui-font-12,12px);line-height:1.6;color:var(--ub-text,#333)}
.db-merge-segment-preview div{margin-bottom:2px;word-break:break-word}
.db-merge-segment-preview b{color:var(--text-muted,#888);font-weight:500}
.db-merge-segment-check{flex:0 0 auto}
.db-merge-resume-hint{padding:8px 12px;margin-bottom:8px;background:rgba(221,51,51,.08);border:1px solid rgba(221,51,51,.2);border-radius:6px;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.is-running .db-merge-segment-icon{animation:cmSpin 1s linear infinite;display:inline-block}
@keyframes cmSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.dark .db-merge-warning-list,.dark-mode .db-merge-warning-list{color:var(--text,#eee)}
.dark .db-merge-form label,.dark-mode .db-merge-form label{color:var(--text,#eee)}
.dark .db-merge-form input,.dark-mode .db-merge-form input{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.15);color:#eee}
.dark .db-merge-form input:focus,.dark-mode .db-merge-form input:focus{border-color:var(--accent,#5a9fd4)}
.dark .db-merge-preview,.dark-mode .db-merge-preview{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);color:var(--text,#eee)}
.dark .db-merge-progress-bar-wrap,.dark-mode .db-merge-progress-bar-wrap{background:rgba(255,255,255,.12)}
.dark .db-merge-segment-card,.dark-mode .db-merge-segment-card{border-color:rgba(255,255,255,.12)}
.dark .db-merge-segment-head,.dark-mode .db-merge-segment-head{color:var(--text,#eee)}
.dark .db-merge-segment-am,.dark-mode .db-merge-segment-am{color:var(--text,#eee)}
.dark .db-merge-segment-preview,.dark-mode .db-merge-segment-preview{background:rgba(255,255,255,.05);color:var(--text,#ddd)}
.dark .db-merge-resume-hint,.dark-mode .db-merge-resume-hint{color:var(--text,#eee)}
/* === 纪要合并增强：方式行 / AM 预览网格 / 详情卡 / 分段行 === */
.cm-mode-row{grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333)}
.cm-mode-label{font-weight:600}
.cm-radio{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.cm-radio input{width:auto;margin:0}
.cm-cond{display:flex;align-items:center;gap:8px;font-size:var(--ub-ui-font-13,13px);color:var(--ub-text,#333)}
.cm-am-section{margin:4px 0 12px}
.cm-am-section-title{font-size:12px;color:var(--text-muted,#888);margin-bottom:6px}
.cm-am-grid{display:flex;flex-wrap:wrap;gap:5px;max-height:120px;overflow-y:auto;padding:8px;background:var(--card-light,rgba(0,0,0,.02));border:1px solid var(--divider,#e5e5e5);border-radius:6px}
.cm-am-btn{padding:3px 8px;font-size:12px;font-family:inherit;border:1px solid var(--divider,#ccc);border-radius:12px;background:var(--card-light,var(--card));color:var(--text-muted,#888);cursor:pointer;transition:border-color .15s,background .15s}
.cm-am-btn:hover{border-color:var(--accent,#3a7db5);color:var(--ub-text,#333)}
.cm-am-btn.is-in-range{border-color:var(--accent,#3a7db5);background:rgba(58,125,181,.1);color:var(--ub-text,#333);font-weight:600}
.cm-am-btn.is-merged{border-color:var(--accent,#3a7db5);background:rgba(58,125,181,.08);color:var(--ub-text,#333);font-weight:600}
.cm-am-merged-mark{display:inline-block;margin-left:3px;padding:0 5px;font-size:10px;line-height:1.45;border-radius:7px;background:var(--accent,#3a7db5);color:var(--accent-ink,#fff);font-weight:700;vertical-align:baseline}
.cm-am-detail{margin-top:8px;padding:8px 10px;background:var(--card-light,rgba(0,0,0,.03));border:1px solid var(--divider,#e5e5e5);border-radius:6px;font-size:var(--ub-ui-font-12,12px);line-height:1.6;color:var(--ub-text,#333);max-height:180px;overflow-y:auto}
.cm-am-detail-head{font-weight:600;color:var(--accent,#3a7db5);margin-bottom:4px}
.cm-am-detail b{color:var(--text-muted,#888);font-weight:500}
.cm-am-detail div{margin-bottom:3px;word-break:break-word}
.cm-seg-line{font-size:var(--ub-ui-font-12,12px);color:var(--text-muted,#888);padding-left:8px}
.dark .cm-mode-row,.dark-mode .cm-mode-row{color:var(--text,#eee)}
.dark .cm-cond,.dark-mode .cm-cond{color:var(--text,#eee)}
.dark .cm-am-grid,.dark-mode .cm-am-grid{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
.dark .cm-am-btn,.dark-mode .cm-am-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.15);color:var(--text-muted,#aaa)}
.dark .cm-am-btn:hover,.dark-mode .cm-am-btn:hover{border-color:var(--accent,#5a9fd4);color:var(--text,#eee)}
.dark .cm-am-btn.is-in-range,.dark-mode .cm-am-btn.is-in-range{border-color:var(--accent,#5a9fd4);background:rgba(90,159,212,.18);color:var(--text,#eee)}
.dark .cm-am-btn.is-merged,.dark-mode .cm-am-btn.is-merged{border-color:var(--accent,#5a9fd4);background:rgba(90,159,212,.14);color:var(--text,#eee)}
.dark .cm-am-detail,.dark-mode .cm-am-detail{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);color:var(--text,#ddd)}
.dark .cm-am-detail-head,.dark-mode .cm-am-detail-head{color:var(--accent,#5a9fd4)}
.dark .cm-seg-line,.dark-mode .cm-seg-line{color:var(--text-muted,#999)}

/* === 窄屏操作区重排：顶部功能与角色操作始终留在可访问宽度内 ===
   注意：本块按**视口宽**触发，而便签等容器宽 ≠ 视口宽（铁律 #19）——凡容器自身宽决定排布的
   构件（如 .note-top-actions）其换行能力必须写进各自的基类，不在此列依赖本断点。 */
@media(max-width:900px){
  #ac-statusbar-wrapper .book-head,
#ac-statusbar-wrapper .book-head-left,
#ac-statusbar-wrapper .book-head-right,
#ac-statusbar-wrapper .book-head-main-right,
#ac-statusbar-wrapper .top-actions,
#ac-statusbar-wrapper .char-name-actions{flex-wrap:wrap;max-width:100%}
  #ac-statusbar-wrapper .book-head-right,
#ac-statusbar-wrapper .book-head-main-right{flex:1 1 100%;width:100%;justify-content:flex-start}
  #ac-statusbar-wrapper .char-name-actions{margin-left:0;flex:1 1 100%}
}
/* === 过往经历时间轴骨架（全风格共享，仅布局；颜色/字体/字距/圆点尺寸由各主题 pe-* 覆盖） === */
/* 注意：baseCSS 在各主题 CSS 末尾拼接，同特异性后写者胜——故此处只放布局属性，
   凡各主题有差异的属性（letter-spacing、圆点 width/height/top、color、background 等）
   一律不在骨架定义，交由各主题 styles/*.ts 的 pe-* 规则决定。 */
.pe-intro{margin-bottom:16px}
.pe-intro-label{font-size:10px;text-transform:uppercase;margin-bottom:5px;opacity:.75}
.pe-intro-text{margin:0;font-size:var(--ub-ui-font-12,12px);line-height:1.75;white-space:pre-line}
.pe-rail{position:relative;padding-left:20px}
.pe-rail::before{content:'';position:absolute;left:5px;top:6px;bottom:6px;width:2px}
.pe-daygroup + .pe-daygroup{margin-top:18px}
.pe-date{font-size:11px;font-weight:700;margin-bottom:8px}
.pe-node{position:relative;margin-bottom:12px}
.pe-node:last-child{margin-bottom:0}
.pe-dot{position:absolute;left:-20px;border-radius:50%}
.pe-card{padding:9px 11px;font-size:var(--ub-ui-font-11-5,11.5px);line-height:1.7}
.pe-card p{margin:0;white-space:pre-line}

/* === 日期旁天气图标（全风格共享布局；SVG 内已自带配色，不读主题变量） === */
.weather-icon{display:inline-flex;align-items:center;vertical-align:middle;margin-left:4px;cursor:help;line-height:0}
.weather-icon svg{display:block}

/* === 状态栏三主题 A2 字体分层（纯本机字体；标题与弹窗不在作用域内） === */
#ac-statusbar-wrapper{--ub-font-ancient-body:"STZhongsong","华文中宋","Songti SC","Noto Serif SC","Noto Serif CJK SC","STSong","SimSun",serif;--ub-font-ancient-label:"FangSong","STFangsong","华文仿宋","仿宋","Songti SC","STSong","SimSun",serif;--ub-font-minimal-body:"Noto Sans SC","PingFang SC","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif;--ub-font-minimal-label:"DengXian","Noto Sans SC","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif;--ub-font-minimal-note:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;--ub-font-handwritten:"Kaiti SC","STKaiti","KaiTi","华文楷体","楷体","FangSong",serif}
#ac-content .page-thought,
#ac-content .page-status,
#ac-content .bound-page .cv,
#ac-content .bound-page .bv,
#ac-content .other-row .ms{font-family:var(--ub-font-ancient-body);font-weight:500;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}
#ac-content .bound-page .cl,
#ac-content .bound-page .bl{font-family:var(--ub-font-ancient-label);font-weight:600;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}
#ac-content .bound-page.outfit-summary .cl{font-weight:600!important}
#ac-content .sys-status,
.minimal-container .ub-content-row .info-value{font-family:var(--ub-font-minimal-body);font-weight:400;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}
.minimal-container .ub-content-row .info-label{font-family:var(--ub-font-minimal-label);font-weight:600;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}
.minimal-container .note-content{font-family:var(--ub-font-minimal-note);font-weight:500;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}
#ac-content .xx-thought-bubble,
#ac-content .xx-detail-item .xx-dv{font-family:var(--ub-font-handwritten);font-weight:500;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}
#ac-content .xx-info-label,
#ac-content .xx-detail-item .xx-dl{font-family:var(--ub-font-ancient-body);font-weight:500;-webkit-font-smoothing:auto;text-rendering:optimizeLegibility}

/* === 状态栏五主题正文字号与换行（弹窗不在作用域内） === */
#ac-content .sys-status,
#ac-content .page-thought,
#ac-content .char-inner-thought,
#ac-content .char-attitude,
#ac-content .char-intention,
#ac-content .xx-thought-bubble{font-size:var(--ub-content-font-12,13.2px);overflow-wrap:anywhere}
#ac-content .page-status,
#ac-content .char-status{font-size:var(--ub-content-font-13,14.3px);overflow-wrap:anywhere}
#ac-content .main-char-status{font-size:var(--ub-content-font-11,12.1px);overflow-wrap:anywhere}
#ac-content .bound-page,
#ac-content .char-clothes-item,
#ac-content .char-body-item{font-size:var(--ub-content-font-12,13.2px)}
#ac-content .bound-page .cl,
#ac-content .bound-page .bl,
#ac-content .char-clothes-item .cl,
#ac-content .char-body-item .bl,
#ac-content .xx-info-label,
#ac-content .xx-detail-item .xx-dl,
.minimal-container .ub-content-row .info-label{font-size:var(--ub-content-font-label,12.1px);flex-shrink:0}
#ac-content .bound-page .cv,
#ac-content .bound-page .bv,
#ac-content .char-clothes-item .cv,
#ac-content .char-body-item .bv,
#ac-content .xx-detail-item .xx-dv,
.minimal-container .ub-content-row .info-value{min-width:0;flex:1;font-size:var(--ub-content-font-12,13.2px);overflow-wrap:anywhere}
#ac-content .xx-detail-item{font-size:var(--ub-content-font-11,12.1px)}
.minimal-container .note-content{font-size:calc(var(--ub-content-font-12,13.2px) + 2px);overflow-wrap:anywhere}
.minimal-container .ub-content-row{font-size:var(--ub-content-font-12,13.2px)}
#ac-content .other-row .ms{min-width:0;font-size:var(--ub-content-font-12,13.2px);overflow:visible;text-overflow:clip;white-space:normal}
#ac-content .xx-thought-bubble,
#ac-content .xx-detail-item .xx-dv{font-size:calc(var(--ub-content-font-12,13.2px) + 1px)}

/* === 系统强制决策队列：独立于普通 panelOverlay，禁止背景点击绕过 === */
.ub-decision-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;z-index:100050;background:rgba(0,0,0,.58);align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
.ub-decision-overlay.show{display:flex}
.ub-decision-dialog{width:min(520px,94vw);max-height:min(82vh,760px);max-height:min(82dvh,760px);overflow:auto;border-radius:12px;background:var(--card,var(--sweet-card,#fff));color:var(--text,var(--sweet-text,#222));box-shadow:0 18px 60px rgba(0,0,0,.35);border:1px solid var(--divider,var(--sweet-border,#ddd));outline:none}
.ub-decision-overlay.dark .ub-decision-dialog{background:var(--card,var(--sweet-card,var(--jade-surface-1,#202124)));color:var(--text,var(--sweet-text,#eee));border-color:rgba(255,255,255,.16)}
.ub-decision-head{padding:15px 18px 10px;border-bottom:1px solid var(--divider,var(--sweet-border,#ddd));display:flex;align-items:flex-start;gap:8px}
.ub-decision-title{font-size:var(--ub-popup-font-title,16px);font-weight:700;flex:1;min-width:0}
.ub-decision-close{flex:0 0 auto;margin:-4px -6px 0 0;width:28px;height:28px;border:none;background:none;color:inherit;font-size:var(--ub-popup-font-title,15px);line-height:1;cursor:pointer;opacity:.6;border-radius:6px}
.ub-decision-close:hover{opacity:1;background:rgba(0,0,0,.07)}
.ub-decision-overlay.dark .ub-decision-close:hover{background:rgba(255,255,255,.12)}
.ub-decision-body{padding:16px 18px 18px}
.ub-decision-error{display:none;margin:0 18px 16px;padding:8px 10px;border-radius:6px;background:rgba(190,40,40,.12);color:#b22;font-size:var(--ub-ui-font-12,12px)}
.ub-decision-error.show{display:block}
.ub-decision-overlay.is-busy button{cursor:wait;opacity:.65}
/* ===== 世界演化结果弹窗（系统决策 overlay 内：入镜带选项/传闻浮现确认）===== */
.ww-decision-block{font-weight:700;font-size:var(--ub-ui-font-12,12px);letter-spacing:1px;margin:4px 0 6px;opacity:.85}
.ww-decision-block:first-child{margin-top:0}
.ww-decision-row{display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px dashed var(--divider,var(--sweet-border,rgba(0,0,0,.14)))}
.ww-decision-row:last-child{border-bottom:none}
.ww-decision-tag{flex:0 0 auto;font-style:normal;font-size:var(--ub-ui-font-10,10px);line-height:1.5;padding:1px 7px;border-radius:8px;letter-spacing:.5px;background:rgba(0,0,0,.12);opacity:.8}
.ww-decision-text{flex:1 1 auto;min-width:0;font-size:var(--ub-ui-font-13,13px);line-height:1.55}
.ww-decision-text b{font-weight:600}
.ww-decision-desc{display:block;margin-top:4px;font-size:var(--ub-ui-font-11,11px);opacity:.78;line-height:1.5}
.ww-decision-actions{flex:0 0 auto;display:flex;flex-direction:column;gap:5px}
.ww-decision-btn{padding:4px 12px;font-size:var(--ub-ui-font-11,11px);font-family:inherit;border-radius:6px;cursor:pointer;border:1px solid var(--divider,var(--sweet-border,#ddd));background:rgba(0,0,0,.06);color:inherit}
.ww-decision-btn:hover{background:rgba(0,0,0,.14)}
.ub-decision-overlay.dark .ww-decision-btn{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.22)}
.ub-decision-overlay.dark .ww-decision-btn:hover{background:rgba(255,255,255,.16)}
.ub-decision-overlay.dark .ww-decision-tag{background:rgba(255,255,255,.14)}
.map-location-current{font-size:var(--ub-ui-font-13,13px);margin-bottom:8px}
.map-location-help{font-size:var(--ub-ui-font-12,12px);line-height:1.55;opacity:.78;margin-bottom:12px}
.map-location-candidates{display:flex;flex-direction:column;gap:7px;max-height:34vh;overflow:auto}
.map-location-candidate{display:flex;gap:9px;align-items:flex-start;padding:9px 10px;border:1px solid var(--divider,var(--sweet-border,#ddd));border-radius:7px;cursor:pointer}
.map-location-candidate span{display:flex;flex-direction:column;gap:3px;min-width:0}
.map-location-candidate b{font-size:var(--ub-ui-font-12-5,12.5px);overflow-wrap:anywhere}
.map-location-candidate small{font-size:var(--ub-ui-font-10-5,10.5px);opacity:.68}
.map-location-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.map-location-actions button{padding:9px 8px;border-radius:7px;border:1px solid var(--divider,var(--sweet-border,#ccc));background:var(--card,var(--sweet-card,#fff));color:inherit;cursor:pointer}
.map-location-actions button:last-child{grid-column:1 / -1}

/* 外部剧情存档加载提示：不遮挡数据库只读内容，不改变现有按钮尺寸。 */
#ac-statusbar-wrapper .ub-storage-sync-indicator{position:absolute;top:5px;right:8px;z-index:30;display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(20,20,24,.72);color:#fff;font-size:10px;line-height:1.4;letter-spacing:.04em;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.18);backdrop-filter:blur(4px)}
#ac-statusbar-wrapper .ub-storage-sync-indicator::before{content:"";width:7px;height:7px;border:1.5px solid currentColor;border-right-color:transparent;border-radius:50%;animation:ub-storage-spin .75s linear infinite}
@keyframes ub-storage-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#ac-statusbar-wrapper .ub-storage-sync-indicator::before{animation:none}}
/* 存档同步失败（外部存储非瞬态只读/冲突/错误）：停止转圈，改警示色，提示查看设置-存储。 */
#ac-statusbar-wrapper .ub-storage-sync-indicator.ub-storage-failed{background:rgba(148,44,44,.85);color:#ffe1e1}
#ac-statusbar-wrapper .ub-storage-sync-indicator.ub-storage-failed::before{animation:none;border-color:currentColor;border-left-color:transparent;border-right-color:transparent}

/* === 主题化 confirm/prompt 弹窗（confirm-dialog.ts，常驻注入，不依赖 portrait CSS） === */
.ub-confirm-overlay{display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
/* 移动端软键盘会盖住垂直居中的弹窗：小屏改为上部对齐，键盘弹起时输入框/按钮仍可见 */
@media(max-width:599px){.ub-confirm-overlay{align-items:flex-start;padding-top:max(9vh,var(--safe-top,0px))}}
.ub-confirm-dialog{display:flex;flex-direction:column;gap:0;max-width:420px;min-height:0;overflow:hidden;padding:16px}
.ub-confirm-title{font-size:14px;font-weight:600;color:var(--ub-text,#333);padding:2px 4px 10px;border-bottom:1px solid var(--divider,#e5e5e5);flex:0 0 auto}
.ub-confirm-message{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;font-size:13px;color:var(--ub-text,#333);line-height:1.7;white-space:pre-line;word-break:break-word;padding:12px 4px 6px}
.ub-confirm-field{flex:0 0 auto;padding:6px 4px 4px}
.ub-confirm-input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--divider,#ccc);border-radius:6px;background:var(--card-light,var(--card));color:var(--ub-text,#333);font-size:14px;font-family:inherit;outline:none;transition:border-color .15s}
.ub-confirm-input:focus{border-color:var(--accent,#3a7db5)}
.ub-confirm-btns{flex:0 0 auto;display:flex;gap:8px;justify-content:flex-end;padding:12px 4px 2px}
.ub-confirm-btn{padding:7px 16px;border-radius:6px;border:1px solid var(--divider,#ccc);background:var(--card-light,var(--card));color:var(--ub-text,#333);font-size:13px;font-family:inherit;cursor:pointer;transition:all .15s}
.ub-confirm-btn:hover{filter:brightness(1.06)}
.ub-confirm-btn-ok{background:var(--accent,#3a7db5);color:#fff;border-color:var(--accent,#3a7db5)}
.ub-confirm-btn-ok:hover{filter:brightness(1.08);color:#fff}
.ub-confirm-btn-danger{background:var(--danger,#c04040);color:#fff;border-color:var(--danger,#c04040)}
.ub-confirm-btn-danger:hover{filter:brightness(1.08);color:#fff}
.dark .ub-confirm-dialog,.dark-mode .ub-confirm-dialog{background:var(--card,var(--bg-color,#20232a));border-color:rgba(255,255,255,.12)}
.dark .ub-confirm-title,.dark-mode .ub-confirm-title{color:var(--text,#eee);border-color:rgba(255,255,255,.1)}
.dark .ub-confirm-message,.dark-mode .ub-confirm-message{color:var(--text,#eee)}
.dark .ub-confirm-input,.dark-mode .ub-confirm-input{background:rgba(255,255,255,.05);color:var(--text,#eee);border-color:rgba(255,255,255,.15)}
.dark .ub-confirm-btn,.dark-mode .ub-confirm-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.15);color:var(--text,#ddd)}
/* 深色下危险确认保持红底：上方 .dark .ub-confirm-btn 特异性更高，须显式夺回 */
.dark .ub-confirm-btn-danger,.dark-mode .ub-confirm-btn-danger{background:var(--danger,#c04040);border-color:var(--danger,#c04040);color:#fff}

/* 长按按钮面不再印「 · 长按」微提示（原 .ub-lp-hint::after 规则已删）：提示词挤占按钮宽度，
   窄屏会把末位按钮顶出容器。可发现性交给帮助条目 help:long-press（列全部长按入口）；
   .ub-lp-hint 类仍留在标记里作「此按钮支持长按」的语义标记，但不再有任何视觉输出。 */
/* 帮助「?」点各主题定义为 16px，达不到触控标准；baseCSS 后加载，统一放大一次 */
.help-tip-btn{width:22px;height:22px;font-size:12px;position:relative}
/* F23 触控热区：帮助「?」在标题栏内孤立存在，用透明命中桥外扩到 ~44px（V3.788 按钮伪元素同手法，
   桌面视觉零变化；伪元素属按钮本体，悬停/聚焦/点击语义不变） */
.help-tip-btn::after{content:'';position:absolute;left:-11px;right:-11px;top:-11px;bottom:-11px}
/* F22 统一 AI 等待态：触发按钮内联旋转指示（currentColor 自适配各主题/深色；renderers/busy-state.ts 注入） */
.ub-busy-spin{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;margin-right:6px;vertical-align:-2px;animation:ub-busy-rotate .8s linear infinite}
@keyframes ub-busy-rotate{to{transform:rotate(360deg)}}

/* === 瑟瑟指导额外指导要求弹窗（常驻，不依赖立绘开关） === */
.ub-nsfw-extra-dialog{display:flex;flex-direction:column;gap:10px;width:min(520px,92vw);max-height:min(82vh,760px);max-height:min(82dvh,760px);overflow:auto;padding:16px 18px;box-sizing:border-box;background:var(--card,var(--sweet-card,#fff));color:var(--text,var(--sweet-text,#222));border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.35);border:1px solid var(--divider,var(--sweet-border,#ddd))}
.ub-nsfw-extra-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ub-nsfw-extra-title{font-size:15px;font-weight:600;color:var(--text,var(--sweet-text,#222))}
.ub-nsfw-extra-close{flex:0 0 auto;width:24px;height:24px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--text-muted,var(--sweet-text-muted,#888));font-size:15px;line-height:1;cursor:pointer}
.ub-nsfw-extra-close:hover{background:var(--divider,var(--sweet-border,rgba(0,0,0,.06)))}
.ub-nsfw-extra-sub{font-size:12px;color:var(--text-muted,var(--sweet-text-muted,#888));line-height:1.5}
.ub-nsfw-extra-presets{display:flex;flex-wrap:wrap;gap:6px}
.ub-nsfw-extra-preset-btn{padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#ddd));border-radius:14px;background:transparent;color:var(--text,var(--sweet-text,#222));font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit}
.ub-nsfw-extra-preset-btn:hover{border-color:var(--accent,var(--sweet-pink,#e91e63));color:var(--accent,var(--sweet-pink,#e91e63))}
.ub-nsfw-extra-field{display:flex;flex-direction:column;gap:4px}
.ub-nsfw-extra-textarea{width:100%;box-sizing:border-box;min-height:110px;resize:vertical;line-height:1.6;padding:8px 10px;border:1px solid var(--divider,var(--sweet-border,#ccc));border-radius:6px;background:var(--card-light,var(--card,var(--bg-color,#fff)));color:var(--text,var(--sweet-text,#222));font-size:13px;font-family:inherit;outline:none}
.ub-nsfw-extra-textarea:focus{border-color:var(--accent,var(--sweet-pink,#e91e63))}
.ub-nsfw-extra-btns{display:flex;gap:8px;justify-content:flex-end}
.ub-nsfw-extra-btn{padding:7px 16px;border-radius:6px;border:1px solid var(--divider,var(--sweet-border,#ccc));background:var(--card-light,var(--card,var(--bg-color,#fff)));color:var(--text,var(--sweet-text,#222));font-size:13px;cursor:pointer;transition:all .15s;font-family:inherit}
.ub-nsfw-extra-btn:hover{filter:brightness(1.06)}
.ub-nsfw-extra-btn-primary{background:var(--accent,var(--sweet-pink,#e91e63));color:#fff;border-color:var(--accent,var(--sweet-pink,#e91e63))}
.ub-nsfw-extra-btn-primary:hover{filter:brightness(1.08);color:#fff}
.ub-nsfw-extra-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.dark .ub-nsfw-extra-dialog,.dark-mode .ub-nsfw-extra-dialog{background:var(--card,var(--bg-color,#20232a));border-color:rgba(255,255,255,.12)}
.dark .ub-nsfw-extra-title,.dark-mode .ub-nsfw-extra-title{color:var(--text,#eee)}
.dark .ub-nsfw-extra-sub,.dark-mode .ub-nsfw-extra-sub{color:var(--text-muted,rgba(255,255,255,.55))}
.dark .ub-nsfw-extra-close,.dark-mode .ub-nsfw-extra-close{color:var(--text-muted,rgba(255,255,255,.55))}
.dark .ub-nsfw-extra-preset-btn,.dark-mode .ub-nsfw-extra-preset-btn{color:var(--text,#ddd);border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.06)}
.dark .ub-nsfw-extra-textarea,.dark-mode .ub-nsfw-extra-textarea,.dark .ub-nsfw-extra-btn,.dark-mode .ub-nsfw-extra-btn{background:rgba(255,255,255,.05);color:var(--text,#eee);border-color:rgba(255,255,255,.15)}

/* === 长按批量选择（备忘录/物品/仓库） === */
.ub-batch-mode .panel-popup-body{padding-bottom:48px}
.ub-batch-item{position:relative;cursor:pointer}
.ub-batch-mode .ub-batch-item{padding-left:26px}
.ub-batch-check{position:absolute;left:4px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid currentColor;border-radius:50%;font-size:11px;line-height:1}
.ub-batch-item.selected{outline:1px solid currentColor;border-radius:4px}
.ub-batch-bar{position:sticky;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;border-top:1px solid var(--divider,#ccc);background:var(--card-light,var(--card,var(--bg-color,#f8f6f0)));color:var(--ub-text,#333)}
.ub-batch-count{font-size:var(--ub-ui-font-12,12px);margin-right:auto;opacity:.75}
.ub-batch-action{border:1px solid var(--divider,#ccc);border-radius:4px;padding:4px 10px;min-height:var(--ub-touch-min,32px);box-sizing:border-box;font-size:12px;background:transparent;color:inherit;cursor:pointer;font-family:inherit}
.ub-batch-action:hover{filter:brightness(1.1)}
.ub-batch-action[data-batch-action="delete"],.ub-batch-action[data-batch-action="discard"]{color:var(--danger,#c04040);border-color:var(--danger,#c04040)}
.dark .ub-batch-bar,.dark-mode .ub-batch-bar{background:var(--card,var(--bg-color,#20232a));color:var(--text,#eee);border-color:rgba(255,255,255,.12)}
.dark .ub-batch-action,.dark-mode .ub-batch-action{border-color:rgba(255,255,255,.15);color:var(--text,#ddd)}
/* 深色下删除/弃置批操作保持红色描边：须排在上方 .dark 覆盖之后 */
.dark .ub-batch-action[data-batch-action="delete"],.dark-mode .ub-batch-action[data-batch-action="delete"],.dark .ub-batch-action[data-batch-action="discard"],.dark-mode .ub-batch-action[data-batch-action="discard"]{color:var(--danger,#d76a6a);border-color:var(--danger,#c04040)}

/* === 角色中枢 / 剧情回顾：结构层只消费各主题提供的 hub token === */
.char-hub-popup[class*="char-hub-theme-"],.chronicle-reader-popup[class*="chronicle-reader-theme-"]{background:var(--hub-bg);color:var(--hub-ink);border-color:var(--hub-line)}
.char-hub-popup[class*="char-hub-theme-"] .panel-popup-head,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .panel-popup-head{background:var(--hub-panel);border-bottom-color:var(--hub-line);color:var(--hub-accent)}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-body,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-list,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-detail{padding:18px 20px;color:var(--hub-ink);background:var(--hub-bg)}
.char-hub-back-row{display:flex;align-items:center;min-height:34px;padding:0 0 8px;border-bottom:1px solid var(--hub-line)}.char-hub-back-row .char-hub-back{padding:5px 9px;cursor:pointer}
.char-hub-identity{display:grid;grid-template-columns:104px minmax(0,1fr) auto;align-items:center;gap:15px;padding:14px;border:1px solid var(--hub-line);color:var(--hub-ink)}
.char-hub-identity .char-hub-portrait{width:104px;height:104px;flex-basis:104px;aspect-ratio:1;border-color:var(--hub-line);background:var(--hub-panel)}
.char-hub-identity-copy{display:flex;min-width:0;flex-direction:column;gap:3px}.char-hub-identity-copy>b{font-size:18px;letter-spacing:.08em}.char-hub-identity-copy>span{overflow:hidden;color:var(--hub-muted);text-overflow:ellipsis;white-space:nowrap;font-size:12px}.char-hub-facts{display:flex;flex-wrap:wrap;gap:5px}.char-hub-facts i{padding:2px 6px;border:1px solid var(--hub-line);color:var(--hub-muted);font-style:normal;font-size:10px}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-search,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-search{border-color:var(--hub-line);background:var(--hub-panel);border-radius:0}.char-hub-popup[class*="char-hub-theme-"] .char-hub-search button,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-search button{border:1px solid var(--hub-accent);background:var(--hub-accent);color:var(--hub-bg);padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}.chronicle-search span{flex:0 0 auto;color:var(--hub-muted);font-size:11px}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-filter button,.char-hub-popup[class*="char-hub-theme-"] .char-hub-tabs button,.char-hub-popup[class*="char-hub-theme-"] .char-hub-back,.char-hub-popup[class*="char-hub-theme-"] .char-hub-nsfw,.char-hub-popup[class*="char-hub-theme-"] .char-hub-past-btn,.char-hub-popup[class*="char-hub-theme-"] .char-hub-related-link,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-tools button,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-detail button,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-sentinel{border-color:var(--hub-line);background:var(--hub-bg);color:var(--hub-ink);font:inherit}.char-hub-popup[class*="char-hub-theme-"] .char-hub-filter button.active,.char-hub-popup[class*="char-hub-theme-"] .char-hub-tabs button.active{background:var(--hub-soft);border-color:var(--hub-accent);color:var(--hub-accent)}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-new-character{border-color:var(--hub-accent);color:var(--hub-accent);background:transparent}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-new-character:hover{background:var(--hub-soft)}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-pending>header small{color:var(--hub-muted)}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-pending-del{color:var(--hub-muted)}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-card,.char-hub-popup[class*="char-hub-theme-"] .char-hub-section,.char-hub-popup[class*="char-hub-theme-"] .char-hub-trait,.char-hub-popup[class*="char-hub-theme-"] .char-hub-logic,.char-hub-popup[class*="char-hub-theme-"] .char-hub-intimacy-slip{border-color:var(--hub-line);background:var(--hub-panel);color:var(--hub-ink)}
.char-hub-popup[class*="char-hub-theme-"] .char-hub-card{transition:transform .16s ease,background .16s ease}.char-hub-popup[class*="char-hub-theme-"] .char-hub-card:hover{transform:translateY(-2px);background:var(--hub-soft)}.char-hub-popup[class*="char-hub-theme-"] .char-hub-card.char-hub-pending-card:hover{transform:none;background:var(--hub-panel)}.char-hub-popup[class*="char-hub-theme-"] .char-hub-section{border-left-color:var(--hub-accent)}.char-hub-popup[class*="char-hub-theme-"] .char-hub-section h4,.char-hub-popup[class*="char-hub-theme-"] .char-hub-card-copy small,.char-hub-popup[class*="char-hub-theme-"] .char-hub-intimacy-slip span{color:var(--hub-muted)}
.char-hub-popup [hidden]{display:none!important}
.char-hub-popup{font-size:var(--ub-popup-font-body,13px);line-height:1.6}
.char-hub-gsym{font-weight:700;line-height:1;display:inline-flex;align-items:baseline;gap:2px}.char-hub-gsym small{font-size:10px;font-weight:400;opacity:.85}
.char-hub-lead-banner{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border-radius:8px;cursor:pointer;font:inherit;text-align:left;color:var(--hub-ink);background:var(--hub-soft);border:1px solid var(--hub-line)}
/* 编年史+人物关系网横幅同行容器：flex basis 达不到两条时自动折行 */
.char-hub-banner-row{display:flex;flex-wrap:wrap;gap:8px}
.char-hub-banner-row .char-hub-lead-banner{flex:1 1 240px;width:auto;min-width:0}
.char-hub-lead-banner .char-hub-lead-name{font-size:14px;font-weight:650}
.char-hub-lead-banner .char-hub-lead-facts{flex:1;min-width:0;font-size:11px;color:var(--hub-muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.char-hub-lead-banner .char-hub-lead-facts i{font-style:normal}
.char-hub-lead-banner .char-hub-lead-facts i:not(:first-child)::before{content:" · ";opacity:.6}
.char-hub-lead-banner .char-hub-lead-more{font-size:11px;flex-shrink:0;color:var(--hub-accent)}
.char-hub-lead-detail .char-hub-identity--lead{display:flex;gap:10px;align-items:flex-start;padding:14px;margin-bottom:12px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-ink)}
.char-hub-lead-detail .char-hub-identity--lead .char-hub-identity-copy>b{font-size:18px;letter-spacing:.08em}
.char-hub-lead-detail .char-hub-lead-profile{padding:0 2px}
.char-hub-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-self:center}
.char-hub-action{font:inherit;font-size:11px;padding:5px 9px;border-radius:8px;cursor:pointer;white-space:nowrap;border:1px solid var(--hub-line);background:var(--hub-bg);color:var(--hub-ink)}
.char-hub-detail-host{min-height:0}.char-hub-page-stack{min-height:0}.char-hub-page{gap:16px}
.char-hub-profile-facts{display:flex;flex-wrap:wrap;gap:8px}.char-hub-profile-facts>span{display:flex;min-width:92px;flex-direction:column;gap:2px;padding:8px 10px;border-top:1px solid var(--hub-line);border-bottom:1px solid var(--hub-line)}.char-hub-profile-facts small,.char-hub-section-kicker{color:var(--hub-muted);font-size:var(--ub-ui-font-11,11px);letter-spacing:.08em}.char-hub-profile-facts b{font-size:var(--ub-popup-font-body,13px);font-weight:600}
.char-hub-profile-lede{position:relative;margin:0;padding:15px 22px;border-inline-start:3px solid var(--hub-accent);background:var(--hub-soft)}.char-hub-profile-lede>span{position:absolute;inset-block-start:-4px;inset-inline-start:7px;color:var(--hub-accent);font-size:30px;line-height:1}.char-hub-profile-lede p{margin:0;white-space:pre-wrap;line-height:1.75}
.char-hub-profile-prose,.char-hub-relationship-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.char-hub-prose-card{position:relative;min-width:0;padding:14px 15px;border:1px solid var(--hub-line);background:var(--hub-panel)}.char-hub-prose-card.is-wide,.char-hub-relationship-map{grid-column:1/-1}.char-hub-prose-card p{margin:7px 0 0;white-space:pre-wrap;line-height:1.72}
.char-hub-relationship-map{position:relative;padding:14px;border:1px solid var(--hub-line);background:var(--hub-soft)}.char-hub-relationship-map-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid var(--hub-line)}.char-hub-relationship-map-head small{color:var(--hub-muted);font-size:10px}.char-hub-relationship-self{position:relative;display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;margin:13px auto 20px;padding:7px 13px;border:1px solid var(--hub-accent);background:var(--hub-bg);color:var(--hub-ink)}.char-hub-relationship-self::after{content:"";position:absolute;top:100%;left:50%;width:1px;height:21px;background:var(--hub-line)}.char-hub-relationship-self i{width:7px;height:7px;border-radius:50%;background:var(--hub-accent)}.char-hub-relationship-self span{color:var(--hub-muted);font-size:9px;letter-spacing:.08em}.char-hub-relation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.char-hub-relation-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0;padding:10px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-ink)}.char-hub-relation-avatar{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--hub-line);background:var(--hub-soft);color:var(--hub-accent);font-weight:650}.char-hub-relation-card>div{min-width:0}.char-hub-relation-card b{font-size:12px}.char-hub-relation-card p{margin:2px 0 0;color:var(--hub-muted);font-size:var(--ub-ui-font-11,11px);line-height:1.55}.char-hub-related-link{padding:4px 7px;white-space:nowrap;cursor:pointer;font-size:10px!important}.char-hub-related-static{color:var(--hub-muted)}
.char-hub-history-door{display:flex;flex-direction:column;gap:11px;padding:14px;border:1px dashed var(--hub-line);background:var(--hub-soft)}.char-hub-history-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.char-hub-history-preview{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:10px}.char-hub-history-background,.char-hub-history-latest{min-width:0;padding:11px 12px;border:1px solid var(--hub-line);background:var(--hub-panel)}.char-hub-history-background{border-inline-start:3px solid var(--hub-accent)}.char-hub-history-latest header{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.char-hub-history-latest time{color:var(--hub-accent);font-size:10px}.char-hub-history-preview p{margin:6px 0 0;color:var(--hub-ink);white-space:pre-wrap;line-height:1.68}.char-hub-past-btn{padding:5px 8px;cursor:pointer}
.char-hub-mood-note{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;gap:14px;padding:13px 15px;border:1px solid var(--hub-line);background:var(--hub-soft)}.char-hub-mood-note p{margin:0;white-space:pre-wrap}
.char-hub-personality-section{display:flex;flex-direction:column;gap:10px}.char-hub-personality-section>header{display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--hub-line);padding-bottom:7px}.char-hub-personality-section>header>span{color:var(--hub-accent);font-size:11px;letter-spacing:.12em}.char-hub-personality-section h4,.char-hub-personality-section h5{margin:0}.char-hub-personality-section>header small{display:block;color:var(--hub-muted);font-size:10px;letter-spacing:.08em}
.char-hub-logic-list{display:grid;gap:8px}.char-hub-logic{display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;margin:0;padding:11px 12px;border:1px solid var(--hub-line);background:var(--hub-panel)}.char-hub-logic-index{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--hub-line);color:var(--hub-accent);font-size:10px}.char-hub-logic-copy{min-width:0}.char-hub-logic-copy>b{font-weight:650}.char-hub-logic p{margin:3px 0 0;white-space:pre-wrap;line-height:1.65}.char-hub-logic small{display:flex;align-items:flex-start;gap:6px;margin-top:8px;padding-top:7px;border-top:1px dashed var(--hub-line);color:var(--hub-ink);font-size:var(--ub-ui-font-11,11px)}.char-hub-logic small i{display:grid;place-items:center;flex:0 0 16px;width:16px;height:16px;border:1px solid currentColor;border-radius:50%;font-style:normal}.char-hub-logic small span{color:var(--hub-accent);white-space:nowrap}
.char-hub-trait-balance{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.char-hub-trait-column{display:flex;flex-direction:column;gap:7px;padding:11px;border:1px solid var(--hub-line);background:var(--hub-soft)}.char-hub-trait-column h5{display:flex;align-items:center;gap:6px}.char-hub-trait-column h5 i{color:var(--hub-accent);font-style:normal}.char-hub-trait{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--hub-line);background:var(--hub-panel)}.char-hub-trait span{color:var(--hub-muted)}
.char-hub-caution{padding:12px 14px;border:1px solid var(--hub-line);border-inline-start:3px solid var(--hub-accent);background:var(--hub-soft);color:var(--hub-ink)}.char-hub-caution header{display:flex;align-items:center;gap:7px;color:var(--hub-accent)}.char-hub-caution header b{color:var(--hub-ink)}.char-hub-caution-list{display:grid;gap:7px;margin:9px 0 0}.char-hub-caution-item{margin:0;padding:8px 10px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-ink);line-height:1.58}.char-hub-not-equal{display:grid;grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr);align-items:stretch;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-ink)}.char-hub-not-equal-concept{display:grid;place-items:center;min-width:0;padding:10px 12px;text-align:center;line-height:1.5}.char-hub-not-equal-label{display:flex;flex-direction:column;align-items:center;justify-content:center;border-inline:1px solid var(--hub-line);background:var(--hub-soft);color:var(--hub-accent)}.char-hub-not-equal-label b{font-size:22px;line-height:1}.char-hub-not-equal-label small{margin-top:3px;font-size:9px;letter-spacing:.08em}
.char-hub-intimacy-caption{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:7px;border-bottom:1px solid var(--hub-line)}.char-hub-intimacy-caption small{color:var(--hub-muted)}.char-hub-intimacy-slip header{display:flex;align-items:center;justify-content:space-between;gap:10px}.char-hub-intimacy-slip header span{letter-spacing:.1em}.char-hub-intimacy-slip header i{color:var(--hub-accent);font-size:10px;font-style:normal}.char-hub-intimacy-slip time{display:block;margin-top:10px;color:var(--hub-accent);font-size:12px;font-weight:650}.char-hub-intimacy-slip p{white-space:pre-wrap}
.char-hub-vitals{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}.char-hub-vitals-strip{flex:1 1 100%;display:flex;flex-direction:column;border:1px solid var(--hub-line);background:var(--hub-panel);overflow:hidden}.char-hub-vitals-row{display:flex;justify-content:center;padding:12px 10px}.char-hub-vitals-row+.char-hub-vitals-row{border-top:1px solid var(--hub-line)}.char-hub-vitals-cell{display:flex;flex-direction:column;align-items:center;padding:0 10px}.char-hub-vitals-num{font-size:22px;font-weight:800;line-height:1;color:var(--hub-accent);letter-spacing:.02em;font-variant-numeric:tabular-nums}.char-hub-vitals-unit{font-size:10px;font-weight:400;opacity:.6;margin-left:1px}.char-hub-vitals-cup{display:inline-block;margin-left:4px;padding:2px 6px;border:1px solid color-mix(in srgb,var(--hub-accent) 35%,transparent);border-radius:999px;color:var(--hub-accent);font-size:10px;font-style:normal;font-weight:600;line-height:1;letter-spacing:.05em;transform:translateY(-4px)}.char-hub-vitals-cup.is-loose{align-self:center;margin:0 2px;transform:none}.char-hub-vitals-lab{font-size:9px;opacity:.55;margin-top:5px;letter-spacing:.16em;text-transform:uppercase;color:var(--hub-muted)}.char-hub-vitals-sep{flex:0 0 1px;align-self:stretch;margin:2px 0;background:var(--hub-line)}.char-hub-vitals-dash{flex:0 0 16px;width:16px;height:1px;align-self:flex-start;margin-top:10px;background:color-mix(in srgb,var(--hub-accent) 40%,transparent)}.char-hub-vitals-raw{display:block;width:100%;padding:10px 12px;border:1px solid var(--hub-line);background:var(--hub-panel);font-size:12px;line-height:1.6}.char-hub-vitals-desc{width:100%;font-size:11px;line-height:1.6;margin:0;color:var(--hub-muted)}
.char-hub-speech{display:flex;border:1px solid var(--hub-line);border-radius:8px;overflow:hidden;margin:10px 0 0}.char-hub-speech>div{flex:1;padding:11px 13px;min-width:0}.char-hub-speech-day{background:var(--hub-day);border-right:1px solid var(--hub-line)}.char-hub-speech-night{background:var(--hub-night)}.char-hub-speech-kicker{font-size:10px;letter-spacing:.2em;text-transform:uppercase;display:block;margin-bottom:5px}.char-hub-speech-day .char-hub-speech-kicker{color:var(--hub-accent)}.char-hub-speech-night .char-hub-speech-kicker{color:var(--hub-night-ink,var(--hub-accent))}.char-hub-speech p{margin:0;font-size:12px;line-height:1.65;white-space:pre-wrap}.char-hub-speech-day p{color:var(--hub-ink)}.char-hub-speech-night p{color:var(--hub-night-ink,var(--hub-ink))}
.char-hub-address{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:3px 9px;border-radius:10px;font-size:11px;border:1px solid var(--hub-line);background:var(--hub-soft);color:var(--hub-accent)}
.char-hub-dual-stat{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--hub-line);border-radius:8px;overflow:hidden;margin:12px 0}.char-hub-dual-stat>div{padding:14px 16px;display:flex;flex-direction:column;gap:6px;min-width:0}.char-hub-dual-stat>div+div{border-left:1px solid var(--hub-line)}.char-hub-stat-num{font-size:26px;font-weight:800;line-height:1;color:var(--hub-accent);font-variant-numeric:tabular-nums}.char-hub-stat-num small{font-size:11px;opacity:.55;font-weight:400}.char-hub-stat-unit{font-size:11px;opacity:.6}.char-hub-stat-tier{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--hub-muted)}.char-hub-stat-meta{display:flex;flex-direction:column;gap:5px}.char-hub-stat-bar{height:6px;border-radius:3px;overflow:hidden;background:var(--hub-soft)}.char-hub-stat-fill{height:100%;border-radius:3px;background:var(--hub-accent)}.char-hub-stat-pct{font-size:11px;opacity:.6}
.char-hub-nsfw-group{margin:12px 0}.char-hub-nsfw-group-title{font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px;color:var(--hub-muted);display:flex;align-items:center;gap:6px}.char-hub-nsfw-dot{width:6px;height:6px;border-radius:50%;background:var(--hub-accent)}.char-hub-nsfw-group-title.is-pref .char-hub-nsfw-dot{background:var(--hub-pref,var(--hub-accent))}.char-hub-nsfw-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.char-hub-nsfw-card{padding:11px 13px;border:1px solid var(--hub-line);background:var(--hub-panel);min-width:0}.char-hub-nsfw-card.is-wide{grid-column:1/-1}.char-hub-nsfw-card p{margin:6px 0 0;white-space:pre-wrap;line-height:1.65;font-size:12px}.char-hub-nsfw-slips{margin:12px 0}
.char-hub-ms-hero{display:flex;align-items:baseline;gap:10px;margin:2px 0 14px}
.char-hub-ms-hero b{font-size:30px;line-height:1;color:var(--hub-accent)}
.char-hub-ms-hero small{font-size:var(--ub-ui-font-11,11px);color:var(--hub-muted);letter-spacing:.08em}
.char-hub-ms-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.char-hub-ms-item{display:flex;align-items:flex-start;gap:12px;padding:10px 0;position:relative}
.char-hub-ms-node{flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-muted);font:inherit;cursor:pointer;padding:0}
.char-hub-ms-date{display:flex;flex-direction:column;gap:1px;min-width:86px;color:var(--hub-muted);font-size:var(--ub-ui-font-11,11px);letter-spacing:.05em}
.char-hub-ms-date small{font-size:9px;opacity:.8}
.char-hub-ms-desc{margin:0;flex:1;min-width:0;line-height:1.65;white-space:pre-wrap}
.char-hub-ms-desc.is-raw{color:var(--hub-muted);font-style:italic}
.char-hub-ms-hint{margin:10px 0 0;font-size:var(--ub-ui-font-11,11px);color:var(--hub-muted)}
.char-hub-ms-cat{display:inline-flex;align-items:center;gap:4px;padding:0 8px;margin-right:7px;border-radius:999px;font-size:10px;font-weight:500;letter-spacing:.06em;line-height:1.85;vertical-align:1px;white-space:nowrap;color:var(--ms-cat);border:1px solid color-mix(in srgb,var(--ms-cat) 60%,transparent);background:color-mix(in srgb,var(--ms-cat) 10%,transparent)}
.char-hub-ms-cat::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}
.char-hub-ms-cat{--ms-cat:var(--ms-cat-first,var(--hub-accent))}
.char-hub-ms-cat.is-first{--ms-cat:var(--ms-cat-first,var(--hub-accent))}
.char-hub-ms-cat.is-relation{--ms-cat:var(--ms-cat-relation,var(--hub-accent))}
.char-hub-ms-cat.is-status{--ms-cat:var(--ms-cat-status,var(--hub-accent))}
.panel-overlay.dark .char-hub-ms-cat{background:color-mix(in srgb,var(--ms-cat) 22%,transparent)}
body.dark-mode .char-hub-ms-cat{background:color-mix(in srgb,var(--ms-cat) 22%,transparent)}
.char-hub-ms-node span{display:block}
.char-hub-ms-node.is-raw{cursor:default;border-style:dashed;opacity:.6}
.char-hub-ms-item.is-raw{cursor:default}
.char-hub-ms-del{flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;margin-top:-2px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--hub-muted);opacity:.55;cursor:pointer;font:inherit;font-size:16px;line-height:1}
.char-hub-ms-del:hover{opacity:1;color:var(--danger,#c04040);background:color-mix(in srgb,var(--danger,#c04040) 10%,transparent)}
.char-hub-ms-del:focus-visible{opacity:1;outline:2px solid var(--hub-accent);outline-offset:1px}
[data-char-hub-milestone]{cursor:pointer;transition:border-color .16s ease,color .16s ease,background .16s ease,box-shadow .16s ease}
[data-char-hub-milestone]:hover{border-color:var(--hub-accent)}
/* ===== 故事编年史（全员里程碑聚合；复用 ms-node/ms-date/ms-cat 骨架与主题皮，角色色点内联供色） ===== */
.char-hub-cr-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.char-hub-cr-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:999px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-muted);font:inherit;font-size:var(--ub-ui-font-11,11px);cursor:pointer}
.char-hub-cr-chip.active{color:var(--hub-accent);border-color:color-mix(in srgb,var(--hub-accent) 55%,transparent);background:color-mix(in srgb,var(--hub-accent) 10%,transparent)}
.char-hub-cr-dot{flex:none;display:inline-block;width:8px;height:8px;border-radius:50%}
.char-hub-cr-day{display:flex;align-items:flex-start;gap:12px;padding:10px 0;position:relative}
.char-hub-cr-events{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;margin:2px 0}
.char-hub-cr-event{margin:0;line-height:1.65;white-space:pre-wrap}
.char-hub-cr-event .char-hub-cr-dot{margin-right:7px}
.char-hub-cr-name{font-weight:650;margin-right:7px}
.char-hub-cr-undated{margin-top:16px;padding-top:10px;border-top:1px dashed var(--hub-line)}
.char-hub-cr-undated p{margin:6px 0 0;color:var(--hub-muted);font-style:italic;line-height:1.65;white-space:pre-wrap}
@media(max-width:599px){.char-hub-cr-day{flex-wrap:wrap}.char-hub-cr-events{min-width:100%}}
@media(max-width:599px){.char-hub-ms-item{flex-wrap:wrap}.char-hub-ms-node{width:34px;height:34px}.char-hub-ms-date{min-width:100%;flex-direction:row;gap:6px}}
@media(max-width:599px){.char-hub-dual-stat{grid-template-columns:1fr}.char-hub-dual-stat>div+div{border-left:0;border-top:1px solid var(--hub-line)}.char-hub-nsfw-grid{grid-template-columns:1fr}.char-hub-speech{flex-direction:column}.char-hub-speech-day{border-right:0;border-bottom:1px solid var(--hub-line)}}
.chronicle-reader-popup [hidden]{display:none!important}.chronicle-reader-popup{font-size:var(--ub-popup-font-body,13px);line-height:1.6}.chronicle-reader-items{display:flex;flex-direction:column;gap:0;padding-top:4px}.chronicle-timeline-entry{display:grid;grid-template-columns:116px 28px minmax(0,1fr);align-items:stretch;min-width:0}.chronicle-timeline-time{display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding:14px 8px 18px 0;color:var(--hub-muted);font-style:normal;text-align:right}.chronicle-timeline-time b{color:var(--hub-ink);font-size:11px;font-weight:650}.chronicle-timeline-time span{font-size:10px;letter-spacing:.04em}.chronicle-timeline-rail{position:relative;min-height:100%}.chronicle-timeline-rail::before{content:"";position:absolute;inset-block:0 -1px;inset-inline-start:50%;width:1px;background:var(--hub-line);transform:translateX(-50%)}.chronicle-timeline-entry:first-child .chronicle-timeline-rail::before{inset-block-start:18px}.chronicle-timeline-entry:last-child .chronicle-timeline-rail::before{inset-block-end:calc(100% - 18px)}.chronicle-timeline-node{position:absolute;z-index:1;inset-block-start:18px;inset-inline-start:50%;width:9px;height:9px;border:2px solid var(--hub-bg);border-radius:50%;background:var(--hub-accent);box-shadow:0 0 0 1px var(--hub-accent);transform:translate(-50%,-50%)}.chronicle-timeline-content{min-width:0;margin:5px 0 14px;padding:13px 15px;border:1px solid var(--hub-line);background:var(--hub-panel);cursor:pointer}.chronicle-timeline-content h3{margin:4px 0 0;font-size:var(--ub-popup-font-body,13px);font-weight:650;line-height:1.65}.chronicle-timeline-kicker{display:block;color:var(--hub-muted);font-size:9px;letter-spacing:.12em}.chronicle-timeline-dialogue{display:grid;gap:6px;margin:9px 0 0;padding:8px;border-inline-start:2px solid var(--hub-accent);background:var(--hub-soft);color:var(--hub-ink);font-size:var(--ub-ui-font-11,11px)}.chronicle-dialogue-line{display:grid;grid-template-columns:minmax(58px,auto) minmax(0,1fr);align-items:start;gap:9px;padding:7px 8px;border:1px solid var(--hub-line);background:var(--hub-panel)}.chronicle-dialogue-speaker{display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:2px 7px;border:1px solid var(--hub-line);background:var(--hub-soft);color:var(--hub-accent);font:inherit;font-size:10px;font-weight:650;white-space:nowrap}.chronicle-dialogue-speaker[type="button"]{cursor:pointer}.chronicle-dialogue-speaker.is-unknown{color:var(--hub-muted)}.chronicle-dialogue-copy{min-width:0;margin:0;padding-top:2px;color:var(--hub-ink);quotes:"“" "”";line-height:1.58}.chronicle-dialogue-more{padding:3px 8px;color:var(--hub-muted);font-size:10px;text-align:right}.chronicle-timeline-dialogue.is-detail{margin-block:13px;padding:10px}.chronicle-timeline-tags{margin-top:7px}
.chronicle-reader-theme-ancient .chronicle-reader-card,.chronicle-reader-theme-xianxia .chronicle-reader-card{border-left-width:3px}.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-card{border-color:var(--hub-line);color:var(--hub-ink);transition:transform .16s ease,background .16s ease}.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-card:hover{transform:translateX(3px);background:var(--hub-soft)}.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-card small,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-load-status,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-detail small{color:var(--hub-muted)}
.chronicle-detail-text,.chronicle-detail-dialogue{margin-block:14px;padding:14px 16px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-ink)}.chronicle-detail-text{border-inline-start:3px solid var(--hub-accent)}.chronicle-detail-dialogue{background:var(--hub-soft)}.chronicle-detail-text h4,.chronicle-detail-dialogue h4{margin:0 0 9px;color:var(--hub-accent);font-size:var(--ub-ui-font-11,11px);font-weight:650;letter-spacing:.12em}.chronicle-detail-text p{margin:0;white-space:pre-wrap;line-height:1.78}.chronicle-detail-dialogue .chronicle-timeline-dialogue.is-detail{margin:0;padding:0;border:0;background:transparent}
/* F84：详情头部时间芯片 + 状态行结构化 + 对话折叠徽章（hub-* 各主题既有 token） */
.chronicle-reader-popup .cr-timechips{display:flex;gap:6px;margin-bottom:4px}
.chronicle-reader-popup .cr-chip{display:inline-flex;align-items:center;gap:3px;padding:1px 8px;border-radius:99px;font-size:10px;background:var(--hub-soft);color:var(--hub-accent);border:1px solid var(--hub-line);font-variant-numeric:tabular-nums}
.chronicle-reader-popup .cr-chip.dim{color:var(--hub-muted)}
.chronicle-reader-popup .cr-chip b{font-weight:700}
.chronicle-reader-popup [data-chronicle-status]{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;color:var(--hub-muted)}
.chronicle-reader-popup [data-chronicle-status] .cr-status-main{color:var(--hub-ink);font-weight:650}
.chronicle-reader-popup .cr-more-badge{display:inline-block;padding:0 6px;margin-right:4px;border-radius:99px;font-size:10px;font-weight:700;color:var(--hub-accent);border:1px solid var(--hub-line);background:var(--hub-soft);font-variant-numeric:tabular-nums}
.chronicle-date-anchor{position:relative}.chronicle-date-popover{position:absolute;z-index:8;top:calc(100% + 7px);left:0;width:236px;padding:10px;border:1px solid var(--hub-line);background:var(--hub-bg);color:var(--hub-ink);box-shadow:0 12px 28px rgba(0,0,0,.18)}.chronicle-date-popover header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.chronicle-date-popover header button{width:24px;height:24px;padding:0!important;border-color:var(--hub-line)!important;background:var(--hub-panel)!important}.chronicle-calendar-week,.chronicle-calendar-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}.chronicle-calendar-week{margin-bottom:3px;color:var(--hub-muted);font-size:10px}.chronicle-calendar-days span{height:26px}.chronicle-calendar-days button{position:relative;height:26px;padding:0!important;border:1px solid transparent!important;background:transparent!important;color:var(--hub-ink)!important;cursor:pointer}.chronicle-calendar-days button:hover,.chronicle-calendar-days button.is-selected{border-color:var(--hub-accent)!important;background:var(--hub-soft)!important;color:var(--hub-accent)!important}.chronicle-calendar-days button.has-chronicle::after{content:"";position:absolute;inset-block-end:2px;inset-inline-start:50%;width:4px;height:4px;border-radius:50%;background:var(--hub-accent);transform:translateX(-50%)}
.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-auto-tag{display:inline-flex;align-items:center;min-height:24px;padding:2px 9px;border:1px solid var(--hub-line);background:var(--hub-panel);color:var(--hub-ink);font:inherit;font-size:11px;line-height:1.4;white-space:nowrap;cursor:pointer}.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-auto-tag.person{background:var(--hub-soft);color:var(--hub-accent);border-color:color-mix(in srgb,var(--hub-accent) 35%,var(--hub-line))}.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-auto-tag.location{background:var(--hub-panel);color:var(--hub-ink);border:1px solid var(--hub-accent);border-left:3px solid var(--hub-accent)}.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-stale{margin-top:8px;padding:7px 9px;border-left:3px solid var(--hub-accent);background:var(--hub-soft);color:var(--hub-ink);font-size:12px}
@media(max-width:599px){.char-hub-popup[class*="char-hub-theme-"] .char-hub-body,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-list,.chronicle-reader-popup[class*="chronicle-reader-theme-"] .chronicle-reader-detail{padding:12px}.char-hub-identity{grid-template-columns:88px minmax(0,1fr);gap:11px}.char-hub-identity .char-hub-portrait{width:88px;height:88px;flex-basis:88px}.char-hub-identity .char-hub-nsfw{grid-column:1/-1}.char-hub-profile-prose,.char-hub-relationship-grid,.char-hub-trait-balance,.char-hub-relation-grid,.char-hub-history-preview{grid-template-columns:1fr}.char-hub-prose-card.is-wide,.char-hub-relationship-map{grid-column:auto}.char-hub-mood-note{grid-template-columns:1fr;gap:5px}.char-hub-history-head{align-items:stretch;flex-direction:column}.char-hub-not-equal{grid-template-columns:1fr}.char-hub-not-equal-label{min-height:48px;border-inline:0;border-block:1px solid var(--hub-line)}.char-hub-relation-card{grid-template-columns:40px minmax(0,1fr)}.char-hub-relation-card .char-hub-related-link,.char-hub-relation-card .char-hub-related-static{grid-column:2}.chronicle-timeline-entry{grid-template-columns:70px 22px minmax(0,1fr)}.chronicle-timeline-time{padding-right:5px}.chronicle-timeline-time b{font-size:9px}.chronicle-timeline-content{padding:11px 12px}.chronicle-dialogue-line{grid-template-columns:1fr;gap:5px}.chronicle-dialogue-speaker{justify-self:start}.chronicle-search span{display:none}.chronicle-date-popover{position:fixed;top:auto;left:50%;bottom:16px;transform:translateX(-50%);width:min(260px,calc(100vw - 32px))}.char-hub-actions{flex-direction:row;flex-wrap:wrap;grid-column:1/-1;align-self:flex-start;gap:6px}}
/* Character-worldbook entry workflow: uses hub tokens so all six themes inherit safely. */
.char-hub-worldbook{display:flex;flex-direction:column;gap:8px;margin-top:4px;padding:13px;border:1px solid var(--hub-line);background:var(--hub-soft);color:var(--hub-ink)}.char-hub-worldbook>header{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.char-hub-worldbook>header small{color:var(--hub-muted);font-size:10px}.char-hub-worldbook p{margin:0;line-height:1.55}.char-hub-worldbook-status{display:flex;align-items:center;gap:6px}.char-hub-worldbook-status i{width:9px;height:9px;border-radius:50%;background:#d65151;box-shadow:0 0 0 2px color-mix(in srgb,#d65151 20%,transparent)}.char-hub-worldbook-status.is-green i{background:#35a76a;box-shadow:0 0 0 2px color-mix(in srgb,#35a76a 20%,transparent)}.char-hub-worldbook-hits{display:flex;flex-wrap:wrap;gap:5px}.char-hub-worldbook-hits span{padding:3px 7px;border:1px solid var(--hub-line);background:var(--hub-panel);font-size:10px}.char-hub-worldbook-actions{display:flex;gap:7px;flex-wrap:wrap}.char-hub-worldbook-actions button,.char-worldbook-dialog button{padding:6px 9px;border:1px solid var(--hub-line);border-radius:3px;background:var(--hub-panel);color:var(--hub-ink);cursor:pointer;font:inherit;font-size:11px}.char-hub-worldbook-actions button:disabled{opacity:.52;cursor:not-allowed}.char-hub-worldbook-error,.char-worldbook-error{color:#c04d4d!important}.char-worldbook-dialog{max-width:760px;color:var(--hub-ink)}.char-worldbook-body{display:flex;flex-direction:column;gap:12px;padding:16px;background:var(--hub-bg);font-size:var(--ub-popup-font-body,13px)}.char-worldbook-source,.char-worldbook-create-review,.char-worldbook-update-review{display:flex;flex-direction:column;gap:10px}.char-worldbook-source label,.char-worldbook-change label{display:flex;flex-direction:column;gap:4px;font-size:11px}.char-worldbook-dialog select,.char-worldbook-dialog input,.char-worldbook-dialog textarea{box-sizing:border-box;width:100%;border:1px solid var(--hub-line);border-radius:3px;background:var(--hub-panel);color:var(--hub-ink);font:inherit;padding:7px}.char-worldbook-source textarea{min-height:80px}.char-worldbook-create-review>textarea{min-height:360px;resize:vertical;line-height:1.65}.char-worldbook-change{display:flex;flex-direction:column;gap:7px;padding:11px;border:1px solid var(--hub-line);background:var(--hub-soft)}.char-worldbook-change header{color:var(--hub-accent);font-weight:650}.char-worldbook-change textarea{min-height:62px;resize:vertical;line-height:1.55}.char-worldbook-change label:last-of-type{flex-direction:row;align-items:center}.char-worldbook-change input{width:auto}
.char-worldbook-dialog{max-height:90vh;max-height:90dvh;display:flex;flex-direction:column;overflow:hidden}.char-worldbook-dialog .panel-popup-head{flex:0 0 auto}.char-worldbook-body{min-height:0;overflow-y:auto;gap:10px;padding:14px;font-size:14px;line-height:1.55}.char-worldbook-source label,.char-worldbook-change label{gap:3px;font-size:12px;font-weight:600}.char-worldbook-dialog textarea{font-size:13px;line-height:1.55}.char-worldbook-create-review>textarea{max-height:min(60dvh,640px);overflow:auto;font-size:14px}.char-worldbook-change{gap:6px;padding:9px 10px}.char-worldbook-change textarea{min-height:86px;max-height:min(30dvh,240px);overflow:auto}.char-worldbook-change textarea[readonly]{background:var(--hub-bg);opacity:.9;cursor:default}.char-worldbook-change label:last-of-type{font-weight:500}.char-worldbook-change header{display:flex;align-items:center;gap:10px}.char-worldbook-change header>span:first-child{color:var(--hub-accent);font-weight:650}.char-worldbook-stats{color:var(--hub-muted);font-size:10px;letter-spacing:.04em;white-space:nowrap}.char-worldbook-change header label:last-of-type{flex-direction:row;align-items:center;gap:5px;font-weight:500;cursor:pointer;padding:12px 0 12px 14px;margin:-12px 0 -12px auto}.char-worldbook-warn{margin:0;padding:6px 9px;border:1px solid #d65151;border-left:3px solid #d65151;background:color-mix(in srgb,#d65151 8%,transparent);color:#d65151;font-size:11px}.char-worldbook-diff{margin:0;padding:10px 12px;border:1px solid var(--hub-line);border-radius:4px;background:var(--hub-panel);font-size:13px;line-height:1.8;white-space:pre-wrap;word-break:break-word;max-height:min(34dvh,300px);overflow:auto}.char-worldbook-diff del{color:#d65151;background:color-mix(in srgb,#d65151 14%,transparent);text-decoration:line-through;text-decoration-thickness:2px;padding:0 3px;border-radius:3px;margin:0 1px}.char-worldbook-diff ins{color:#35a76a;background:color-mix(in srgb,#35a76a 14%,transparent);text-decoration:none;font-weight:700;padding:0 3px;border-radius:3px;margin:0 1px}.char-worldbook-diff-ctx{opacity:.55}.char-worldbook-reason{margin:0;color:var(--hub-muted);font-size:11px;line-height:1.5;white-space:pre-wrap}.char-worldbook-change.is-approved{border-color:color-mix(in srgb,#35a76a 45%,var(--hub-line))}.char-worldbook-change.is-editing textarea{min-height:86px;max-height:min(30dvh,240px);overflow:auto;font-size:13px;line-height:1.55;resize:vertical}.char-worldbook-review-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}.char-worldbook-merge-note{margin:0;color:var(--hub-muted);font-size:11px;line-height:1.5}.char-worldbook-merge-note.is-error{color:#d65151}.char-worldbook-dialog button:disabled{opacity:.52;cursor:not-allowed}
/* 「通过」勾选热区：视觉仍是 13px 复选框 + 通过 文案，靠 padding/负 margin 把可点区域
   撑到 61×43px（右侧靠 margin-left:auto 吸收左 padding，视觉位置不变；行高由负 margin 抵消）。
   旧版 47×19px 的热区在手机上几乎点不中，手指偏一点就落进 header 空白区。 */
/* ===== 创建弹窗：性格池 / NSFW 特质池（随机抽取 → 胶囊标签，可单删/清空） ===== */
.char-worldbook-pool{display:flex;flex-direction:column;gap:7px;padding:10px 11px;border:1px solid var(--hub-line);border-radius:4px;background:var(--hub-soft)}
.char-worldbook-pool-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.char-worldbook-pool-head b{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--hub-ink)}
.char-worldbook-pool-count{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--hub-accent);color:var(--hub-bg);font-size:10px;font-weight:600;font-style:normal}
.char-worldbook-pool-actions{display:flex;gap:6px}
.char-worldbook-pool-actions .settings-action-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;font-size:11px}
.char-worldbook-pool-tags{display:flex;flex-wrap:wrap;gap:6px}
.char-worldbook-pool-tag{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border:1px solid var(--hub-line);border-radius:999px;background:var(--hub-panel);color:var(--hub-ink);font-size:12px;line-height:1.4}
.char-worldbook-pool-tag button{display:inline-grid;place-items:center;width:16px;height:16px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--hub-muted);cursor:pointer;font-size:12px;line-height:1}
/* F23 触控热区：池标签删除钮触屏放大 */
@media (hover:none) and (pointer:coarse){
  .char-worldbook-pool-tag{gap:7px;padding:5px 11px}
  .char-worldbook-pool-tag button{width:24px;height:24px;font-size:14px}
}
.char-worldbook-pool-tag button:hover{color:#d65151}
.char-worldbook-pool-empty{color:var(--hub-muted);font-size:11px}
.char-worldbook-pool-hint{margin:0;color:var(--hub-muted);font-size:11px;line-height:1.5}
@media(max-width:599px){.char-hub-worldbook-actions button{flex:1}.char-worldbook-body{padding:12px}.char-worldbook-create-review>textarea{min-height:280px}.char-worldbook-pool-head{flex-wrap:wrap}.char-worldbook-pool-actions{width:100%;justify-content:flex-end}}
@media(prefers-reduced-motion:reduce){.char-hub-card,.chronicle-reader-card{transition:none!important}}
/* ===== 人物关系网（char-relation-popup；复用 char-hub-theme-* 的 --hub-* token 体系，六主题明暗自动适配） ===== */
.cat-intimate{--cr-cat:#e0637e}.cat-rival{--cr-cat:#d84c4c}.cat-mentor{--cr-cat:#d99b3c}.cat-family{--cr-cat:#3ca9a4}.cat-ally{--cr-cat:#6f8fd6}.cat-other{--cr-cat:#9aa0ab}
/* 主界面「与主角关系」类别色胶囊（与人物关系网连线/图例同 --cr-cat 色板；点击在关系网中查看该角色） */
.char-relation-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border:1px solid color-mix(in srgb,var(--cr-cat,#9aa0ab) 55%,transparent);border-radius:999px;background:color-mix(in srgb,var(--cr-cat,#9aa0ab) 12%,transparent);color:var(--cr-cat,#9aa0ab);font:inherit;font-size:var(--ub-ui-font-11,11px);cursor:pointer;white-space:nowrap}
.char-relation-pill i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--cr-cat,#9aa0ab)}
.char-relation-pill:hover{border-color:var(--cr-cat,#9aa0ab);background:color-mix(in srgb,var(--cr-cat,#9aa0ab) 20%,transparent)}
/* 胶囊并入各主题元信息行（姓名旁年龄·一句话简介 / 人员身份块 / 便签操作行）：整体缩一档与 11-12px 元文字和谐 */
.char-basic-info .char-relation-pill,.ub-profile-bio .char-relation-pill,.char-name-row>.char-relation-pill,.bridge-personnel-identity .char-relation-pill,.ios-profile-id .char-relation-pill,.note-top-actions .char-relation-pill{gap:4px;padding:1px 8px;font-size:10.5px}
.char-basic-info .char-relation-pill{margin-inline-start:6px}
.ub-profile-bio .char-relation-pill{margin-inline-start:6px;vertical-align:-3px}
.bridge-personnel-identity .char-relation-pill,.ios-profile-id .char-relation-pill{align-self:flex-start}
.char-name-row>.char-relation-pill{align-self:center}
.char-relation-popup{max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;color:var(--hub-ink)}
.cr-shell{display:flex;flex:1;flex-direction:column;min-height:0}
.cr-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:9px 13px;border-bottom:1px solid var(--hub-line);background:var(--hub-panel)}
.cr-stats{display:flex;align-items:baseline;gap:5px;color:var(--hub-muted);font-size:var(--ub-ui-font-11,11px);white-space:nowrap}
.cr-stats b{color:var(--hub-ink);font-size:16px;font-weight:700}
.cr-chips{display:flex;flex:1;gap:5px;flex-wrap:wrap}
.cr-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border:1px solid var(--hub-line);border-radius:999px;background:transparent;color:var(--hub-muted);font:inherit;font-size:var(--ub-ui-font-11,11px);cursor:pointer}
.cr-chip i{width:7px;height:7px;border-radius:50%;background:var(--cr-cat,#9aa0ab)}
.cr-chip em{font-style:normal;opacity:.85;font-size:10px}
.cr-chip.active{color:var(--cr-cat,var(--hub-ink));border-color:color-mix(in srgb,var(--cr-cat,#9aa0ab) 55%,transparent);background:color-mix(in srgb,var(--cr-cat,#9aa0ab) 12%,transparent)}
.cr-reset{flex:none;padding:4px 10px;border:1px solid var(--hub-line);border-radius:999px;background:transparent;color:var(--hub-muted);font:inherit;font-size:var(--ub-ui-font-11,11px);cursor:pointer}
.cr-reset:hover{color:var(--hub-accent);border-color:var(--hub-accent)}
.cr-main{display:grid;grid-template-columns:minmax(0,1fr) 268px;flex:1;min-height:0}
.cr-canvas-wrap{position:relative;min-height:300px;overflow:hidden;cursor:grab;background-color:var(--hub-bg);background-image:radial-gradient(color-mix(in srgb,var(--hub-ink) 8%,transparent) 1px,transparent 1px);background-size:26px 26px}
.cr-canvas-wrap.is-panning{cursor:grabbing}
.cr-svg{position:absolute;inset:0;width:100%;height:100%;transform-origin:0 0;touch-action:none;user-select:none;-webkit-user-select:none}
.cr-zoom-controls{position:absolute;top:10px;inset-inline-end:10px;z-index:2;display:flex;flex-direction:column;gap:6px}
.cr-zoom-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--hub-line);border-radius:8px;background:var(--hub-panel);color:var(--hub-muted);font:inherit;font-size:15px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.10)}
.cr-zoom-btn:hover{color:var(--hub-accent);border-color:var(--hub-accent)}
.cr-panel{min-height:0;padding:13px;border-left:1px solid var(--hub-line);background:var(--hub-panel);overflow-y:auto}
.cr-empty{padding:46px 18px;line-height:1.9;text-align:center}
.cr-empty-slim{padding:18px 8px;line-height:1.7}
.cr-node{cursor:pointer}
.cr-node .cr-node-halo{fill:transparent;transition:fill .16s ease}
@media(hover:hover){.cr-node:hover .cr-node-halo{fill:color-mix(in srgb,var(--hub-accent) 14%,transparent)}}
.cr-node-disc{stroke:var(--hub-bg);stroke-width:2.5}
.cr-node-portrait,.cr-node-initials{pointer-events:none}
.cr-node-initials{fill:#fff;font-size:24px;font-weight:700}
.cr-node-ring{stroke-width:2;pointer-events:none;transition:stroke-width .16s ease,filter .16s ease}
.cr-node-crown{stroke:var(--hub-accent);stroke-width:1.5;stroke-dasharray:3 5;pointer-events:none}
.cr-node-label{fill:var(--hub-ink);font-size:22px;font-weight:650;paint-order:stroke;stroke:var(--hub-bg);stroke-width:5px;pointer-events:none}
.cr-node.is-selected .cr-node-ring{stroke-width:5}
.cr-node.is-selected .cr-node-halo{fill:color-mix(in srgb,var(--hub-accent) 22%,transparent)}.cr-node.is-selected{filter:drop-shadow(0 0 7px color-mix(in srgb,var(--hub-accent) 55%,transparent))}.cr-node.is-selected .cr-node-label{font-size:24px}.cr-edge-label rect{fill:color-mix(in srgb,var(--hub-bg) 90%,transparent);stroke:var(--hub-line);stroke-width:1}
.cr-node.is-adjacent{opacity:.94}
.cr-node.is-dim{opacity:.38}
.cr-edge-hit{fill:none;stroke:transparent;stroke-width:18;cursor:pointer}
.cr-edge-line{fill:none;stroke:var(--cr-cat,#9aa0ab);stroke-width:2.3;opacity:.85;transition:opacity .18s ease,stroke-width .18s ease;pointer-events:none}
.cr-edge.is-adjacent .cr-edge-line{stroke-width:3.1;opacity:1}
.cr-edge.is-selected .cr-edge-line{stroke-width:4.2;opacity:1}
.cr-edge.is-dim{opacity:.18}
.cr-edge.is-filtered{display:none}
.cr-edge-label{opacity:0;pointer-events:none;transition:opacity .18s ease}
.cr-edge-label.is-shown{opacity:1}
.cr-edge-label text{fill:var(--hub-ink);font-size:20px;font-weight:650;paint-order:stroke;stroke:var(--hub-bg);stroke-width:4.5px}
.cr-legend{display:flex;flex-wrap:wrap;gap:7px 12px;margin-top:9px}
.cr-legend-item{display:inline-flex;align-items:center;gap:5px;color:var(--hub-muted);font-size:var(--ub-ui-font-11,11px)}
.cr-legend-item i{width:9px;height:9px;border-radius:3px;background:var(--cr-cat,#9aa0ab)}
.cr-hint{margin:13px 0 0;color:var(--hub-muted);font-size:10.5px;line-height:1.85}
.cr-dup-warn{margin:11px 0 0;padding:7px 9px;border-inline-start:3px solid #d6a03c;background:color-mix(in srgb,#d6a03c 9%,transparent);font-size:var(--ub-ui-font-11,11px);line-height:1.6}
.cr-avatar{--hue:210;flex:none;display:inline-grid;place-items:center;width:34px;height:34px;overflow:hidden;border:2px solid hsl(var(--hue),62%,60%);border-radius:50%;background:hsl(var(--hue),42%,42%);color:#fff;font-size:12px;font-weight:700}
.cr-avatar img{width:100%;height:100%;object-fit:cover}
.cr-node-head{display:flex;align-items:center;gap:9px;padding-bottom:11px;border-bottom:1px solid var(--hub-line)}
.cr-node-head .cr-avatar{width:44px;height:44px;font-size:14px}
.cr-node-head-copy{flex:1;min-width:0}
.cr-node-head-copy b{display:block;overflow:hidden;font-size:14.5px;text-overflow:ellipsis;white-space:nowrap}
.cr-node-head-copy small{color:var(--hub-muted);font-size:10px;letter-spacing:.04em}
.cr-hub-link,.cr-back,.cr-edge-names button{padding:5px 9px;border:1px solid var(--hub-line);border-radius:3px;background:var(--hub-bg);color:var(--hub-accent);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}
.cr-back{width:100%;margin-bottom:10px;color:var(--hub-muted);text-align:left}
.cr-back:hover,.cr-hub-link:hover{border-color:var(--hub-accent)}
.cr-node-brief{margin:12px 0 0;padding:8px 11px;border:1px solid var(--hub-line);border-radius:4px;background:var(--hub-bg);color:var(--hub-muted);font-size:var(--ub-ui-font-11,11px);line-height:1.7}
.cr-rel-card{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;width:100%;margin-top:7px;padding:8px 9px;border:1px solid var(--hub-line);border-left:3px solid var(--cr-cat,#9aa0ab);background:var(--hub-bg);color:var(--hub-ink);font:inherit;text-align:left;cursor:pointer}
.cr-rel-card:hover{border-color:var(--cr-cat,#9aa0ab)}
.cr-rel-copy{min-width:0}
.cr-rel-copy b{display:block;overflow:hidden;font-size:12.5px;text-overflow:ellipsis;white-space:nowrap}
.cr-rel-copy small{display:block;overflow:hidden;margin-top:2px;color:var(--hub-muted);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
.cr-rel-arrow{color:var(--hub-muted);font-size:15px}
.cr-rel-type{display:inline-block;margin-top:3px;padding:1px 8px;border:1px solid color-mix(in srgb,var(--cr-cat,#9aa0ab) 55%,transparent);border-radius:999px;color:var(--cr-cat,#9aa0ab);font-size:10px;font-style:normal;letter-spacing:.03em}
.cr-edge-head{display:flex;align-items:center;justify-content:center;gap:12px;margin:13px 0 9px}
.cr-edge-head .cr-avatar{width:44px;height:44px;font-size:14px}
.cr-edge-x{color:var(--hub-muted);font-size:16px}
.cr-edge-names{display:flex;align-items:center;justify-content:center;gap:8px}
.cr-edge-names i{color:var(--hub-muted)}
.cr-edge-type{margin-top:6px;text-align:center}
.cr-detail-row{margin-top:9px;padding:8px 11px;border:1px solid var(--hub-line);background:var(--hub-bg)}
.cr-detail-row span{color:var(--hub-muted);font-size:10px;letter-spacing:.1em}
.cr-detail-row p{margin:4px 0 0;line-height:1.68;white-space:pre-wrap}
.char-hub-graph-entry{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:11px;padding:8px 10px;border:1px dashed var(--hub-line);border-radius:4px;background:transparent;color:var(--hub-accent);font:inherit;font-size:12px;cursor:pointer;transition:border-color .16s ease,background .16s ease}
.char-hub-graph-entry:hover{border-color:var(--hub-accent);background:color-mix(in srgb,var(--hub-accent) 7%,transparent)}
.char-hub-relation-grid .cr-rel-card{width:100%;margin-top:0}
.char-hub-relation-card .cr-rel-type{margin-top:4px}
@media(max-width:699px){.cr-main{grid-template-columns:1fr;grid-template-rows:minmax(0,1.4fr) minmax(150px,42dvh)}.cr-panel{max-height:42dvh;border-top:1px solid var(--hub-line);border-left:0}.cr-toolbar{padding:7px 10px}.cr-canvas-wrap{min-height:240px}.cr-node-label{font-size:17px}}
/* 日记详情翻篇淡入（一次性动画，非无限循环） */
.diary-detail-fade{animation:diaryDetailFade .15s ease-out}
@keyframes diaryDetailFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
/* === 线性图标（共用于全主题；外观集中定义，颜色恒 currentColor） === */
.ub-ic{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;flex:none}
.ub-persist-gear{width:22px;height:22px}
/* 情绪图标（core/icons.ts 的 mood-* ）：尺寸改由所在位置的字号决定（1em），不吃 .ub-ic 的 15px 固定值；
   五处渲染点字号不同（瑟瑟 16px / 萦绕便签 18px / 甜恋芯片 18px / 古风·仙侠 16px / 立绘标签 11px）。
   line-height:0 + vertical-align 让内联 SVG 不撑高行盒、与相邻情绪文字同基线。 */
.mood-icon{display:inline-flex;align-items:center;vertical-align:-0.17em;line-height:0}
.mood-icon .ub-ic{width:1em;height:1em;vertical-align:0}
.ub-18-badge{display:inline-flex;align-items:center;justify-content:center;padding:0 5px;border:1px solid currentColor;border-radius:4px;font-size:9px;height:14px;vertical-align:middle}
/* === 生图参数微调块（重新生图：立绘编辑弹窗/插图详情弹窗共用；常驻注入——两弹窗分属不同开关的 CSS 域） === */
.gen-params-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-top:4px}
.gen-params-grid label{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted,#666);min-width:0}
.gen-params-grid input,.gen-params-grid select{flex:1 1 auto;min-width:0;box-sizing:border-box;font-size:12px;font-family:inherit;padding:4px 6px;border:1px solid var(--divider-light,rgba(0,0,0,.12));border-radius:4px;background:var(--card-bg,#fff);color:var(--ub-text,#333)}
.gen-params-note{font-size:11px;color:var(--text-muted,#666);line-height:1.5;margin-top:5px}
/* === 玩法区 chips（多选翻新：全主题共享；颜色走主题变量级联 + 字面量兜底） ===
   spec = .mockup/瑟瑟玩法翻新-mockup.html 屏 1 改后。计数行 + chips 容器直接落进
   各主题的 grid 容器（play-grid / ios-play-grid / bridge-protocol-grid / ub-play-grid），
   故必须跨满整行。 */
.play-grid>.ub-play-count,.play-grid>.ub-play-chips,
.ios-play-grid>.ub-play-count,.ios-play-grid>.ub-play-chips,
.bridge-protocol-grid>.ub-play-count,.bridge-protocol-grid>.ub-play-chips,
.ub-play-grid>.ub-play-count,.ub-play-grid>.ub-play-chips{grid-column:1/-1}
.ub-play-count{font-size:11px;color:var(--text-muted,#999);margin-bottom:7px}
.ub-play-count b{color:var(--lust,var(--ub-accent,#9050c0));font-weight:700}
.ub-play-chips{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.ub-play-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 9px;border-radius:14px;background:var(--lust-bg,var(--ub-hover-bg,rgba(144,80,192,.06)));border:1px solid var(--lust-border,var(--ub-divider,rgba(144,80,192,.15)));font-size:12px;color:var(--ub-text,#333);cursor:pointer;white-space:nowrap;max-width:100%;overflow:hidden}
.ub-play-chip .ub-play-dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px}
.ub-play-chip .ub-play-chip-cat{font-size:10px;color:var(--text-muted,#999)}
.ub-play-chip .ub-play-chip-img{font-size:10px;display:inline-flex;align-items:center}
.ub-play-chip .ub-play-chip-img .ub-ic{width:11px;height:11px}
.ub-play-chip .ub-play-chip-x{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-size:10px;color:var(--text-muted,#999);border:0;background:transparent;cursor:pointer;padding:0;line-height:1;flex:0 0 16px;font-family:inherit}
.ub-play-chip .ub-play-chip-x:hover{background:var(--danger,var(--ub-danger,#c04363));color:#fff}
.ub-play-chip.empty{border-style:dashed;border-color:var(--ub-divider,#ddd);color:var(--text-muted,#999);background:transparent;cursor:default}
.ub-play-add{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:14px;border:1px dashed var(--lust,var(--ub-accent,#9050c0));background:transparent;color:var(--lust,var(--ub-accent,#9050c0));font-size:12px;cursor:pointer;font-family:inherit}
.ub-play-add:hover{background:var(--lust-bg-hover,var(--ub-hover-bg,rgba(144,80,192,.1)))}
.ub-play-dice{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:14px;border:1px solid var(--ub-divider,#ddd);background:var(--ub-bg-card,#fff);color:var(--text-sub,var(--text-muted,#888));font-size:12px;cursor:pointer;font-family:inherit}
.ub-play-dice:hover{border-color:var(--lust,var(--ub-accent,#9050c0));color:var(--lust,var(--ub-accent,#9050c0))}
.ub-play-dice .ub-ic{width:12px;height:12px}
/* === 常驻 overlay 修正（跨功能共享；2026-10-07 由已下线功能的子菜单 CSS 收编入共享层） === */
/* 设置/NSFW/面板弹窗深色模式下原生 select 与 option 配色（5 主题全链回退，深色 token 在各 .*.dark 下已重定义，自动跟随） */
.settings-overlay.dark select,.nsfw-overlay.dark select,.panel-overlay.dark select{
background:var(--card,var(--sweet-card,var(--jade-surface-1,#222)));color:var(--text,var(--sweet-text,var(--text-color,#ddd)));
border-color:var(--divider,var(--sweet-border,var(--border-color,#444)));
}
.settings-overlay.dark select option,.nsfw-overlay.dark select option,.panel-overlay.dark select option{
background:var(--card,var(--sweet-card,var(--jade-surface-1,#222)));color:var(--text,var(--sweet-text,var(--text-color,#ddd)));
}
/* ===== 文字 AI 请求统一提示条（7 主题共用；颜色走真实主题 token 级联） ===== */
.ub-ai-bar{
  --ai-bg:var(--ub-bg-card,var(--card,var(--sweet-card,var(--jade-surface-1,#1d1f26))));
  --ai-text:var(--ub-text,var(--text,var(--sweet-text,var(--text-color,#dcd7cc))));
  --ai-muted:var(--ub-text-muted,var(--text-muted,var(--secondary-text,#8b8676)));
  --ai-accent:var(--ub-accent,var(--accent,var(--lust,#7fb3d5)));
  --ai-border:var(--ub-divider,var(--divider,var(--border-color,rgba(128,128,128,.25))));
  --ai-danger:var(--ub-danger,var(--danger,#e07a7a));
  display:flex;align-items:center;gap:9px;padding:7px 14px;background:var(--ai-bg);color:var(--ai-text);
  border-bottom:1px solid var(--ai-border);font-size:12px;line-height:1.5;position:relative;z-index:2;box-sizing:border-box;
  flex:0 0 auto;
}
.ub-ai-bar[hidden],.ub-ai-list[hidden]{display:none!important}
.ub-ai-bar .ub-ai-dot{width:8px;height:8px;border-radius:50%;background:var(--ai-accent);flex:0 0 auto;
  box-shadow:0 0 7px var(--ai-accent);animation:ub-ai-dot-breathe 1.4s ease-in-out infinite}
@keyframes ub-ai-dot-breathe{0%,100%{opacity:1}50%{opacity:.35}}
.ub-ai-bar .ub-ai-title{font-weight:700;color:var(--ub-text,var(--text,var(--text-color,#dcd7cc)));white-space:nowrap;flex:0 0 auto}
.ub-ai-bar .ub-ai-req{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ai-text)}
.ub-ai-bar .ub-ai-req b{color:var(--ai-accent);font-weight:700}
.ub-ai-bar .ub-ai-sub{color:var(--ai-muted);font-size:11px;margin-left:5px}
.ub-ai-bar .ub-ai-count{border:1px solid var(--ai-border);border-radius:9px;padding:0 7px;font-size:10.5px;color:var(--ai-muted);flex:0 0 auto}
.ub-ai-bar .ub-ai-actions{margin-left:auto;display:flex;gap:6px;flex:0 0 auto}
.ub-ai-bar button{border-radius:4px;padding:2px 9px;font-size:11.5px;cursor:pointer;font-family:inherit;
  background:transparent;border:1px solid var(--ai-border);color:var(--ai-muted)}
.ub-ai-bar button.ub-ai-stop{border-color:var(--ai-danger);color:var(--ai-danger);font-weight:600}
.ub-ai-bar button.ub-ai-stop:hover{background:var(--ai-bg)}
.ub-ai-bar button:disabled{opacity:.55;cursor:not-allowed}
.ub-ai-list{
  --ai-bg:var(--ub-bg-card,var(--card,var(--sweet-card,var(--jade-surface-1,#1d1f26))));
  --ai-text:var(--ub-text,var(--text,var(--sweet-text,var(--text-color,#dcd7cc))));
  --ai-muted:var(--ub-text-muted,var(--text-muted,var(--secondary-text,#8b8676)));
  --ai-accent:var(--ub-accent,var(--accent,var(--lust,#7fb3d5)));
  --ai-border:var(--ub-divider,var(--divider,var(--border-color,rgba(128,128,128,.25))));
  --ai-danger:var(--ub-danger,var(--danger,#e07a7a));
  background:var(--ai-bg);border-bottom:1px solid var(--ai-border);padding:3px 14px 5px;position:relative;z-index:2;
  box-sizing:border-box;flex:0 0 auto;
}
.ub-ai-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--ai-border);
  font-size:11.5px;color:var(--ai-text)}
.ub-ai-row:last-child{border-bottom:0}
.ub-ai-row .r-dot{width:6px;height:6px;border-radius:50%;background:var(--ai-accent);flex:0 0 auto;animation:ub-ai-dot-breathe 1.4s ease-in-out infinite}
.ub-ai-row b{color:var(--ub-text,var(--text,var(--text-color,#dcd7cc)));font-weight:700}
.ub-ai-row .r-sub{color:var(--ai-muted);font-size:10.5px}
.ub-ai-row button{margin-left:auto;border:1px solid var(--ai-border);border-radius:4px;background:transparent;color:var(--ai-muted);
  font-size:10.5px;padding:1px 7px;cursor:pointer;font-family:inherit;flex:0 0 auto}
.ub-ai-row button.stop{border-color:var(--ai-danger);color:var(--ai-danger)}
.ub-ai-row.done{opacity:.55}
.ub-ai-row.done .r-dot{animation:none;background:var(--ai-muted)}
/* 萦绕：最小容器有 24/20 内边距，提示条做满宽贴边（移动端 16/12 由下方媒体查询覆盖） */
.minimal-container > .ub-ai-bar{margin:-24px -20px 12px}
@media(max-width:600px){.minimal-container > .ub-ai-bar{margin:-16px -12px 10px}}
.dark-mode .ub-ai-bar,.dark .ub-ai-bar,.dark-mode .ub-ai-list,.dark .ub-ai-list{
  --ai-bg:var(--ub-surface-2,var(--card,#1d1f26));
  --ai-text:var(--ub-text,var(--text,#dcd7cc));
}

/* ===== 悬浮展开按钮：AI 活动呼吸（圆形）/ 扫光（时间窗药丸） ===== */
#ac-fixed-toggle.ub-ft-ai-breath{animation:ub-ft-ai-breath-glow 1.8s ease-in-out infinite}
#ac-fixed-toggle.ub-ft-ai-breath::after{
  content:'';position:absolute;inset:-7px;border-radius:50%;
  border:2px solid var(--ub-ft-ring-start,#b8f5ff);pointer-events:none;
  animation:ub-ft-ai-breath-ring 1.8s ease-in-out infinite;
}
#ac-fixed-toggle.ub-ft-ai-sweep{position:fixed;overflow:hidden}
#ac-fixed-toggle.ub-ft-ai-sweep::after{
  content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.34),transparent);
  background-size:200% 100%;animation:ub-ft-ai-sweep 1.8s linear infinite;opacity:.55;
}
@keyframes ub-ft-ai-breath-glow{
  0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.31),0 0 10px var(--ub-ft-ring-glow,rgba(126,232,255,.34))}
  50%{box-shadow:0 4px 14px rgba(0,0,0,.31),0 0 22px 5px var(--ub-ft-ring-glow,rgba(126,232,255,.34))}
}
@keyframes ub-ft-ai-breath-ring{0%,100%{transform:scale(.94);opacity:.12}50%{transform:scale(1.1);opacity:.55}}
@keyframes ub-ft-ai-sweep{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){
  #ac-fixed-toggle.ub-ft-ai-breath,#ac-fixed-toggle.ub-ft-ai-breath::after,
  #ac-fixed-toggle.ub-ft-ai-sweep::after,.ub-ai-bar .ub-ai-dot,.ub-ai-row .r-dot{animation:none!important}
}

/* 帮助提示气泡置顶（必须高于一切弹窗与悬浮件） */
.help-tooltip-global{z-index:999999!important;}
`;
