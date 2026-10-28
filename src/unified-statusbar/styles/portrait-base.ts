export const PORTRAIT_BASE_CSS = `
.portrait-box{
  position:relative; flex:0 0 96px; width:96px; height:96px;
  border-radius:var(--portrait-radius,8px); overflow:hidden;
  cursor:pointer; transition:transform .15s;
  border:2px dashed var(--portrait-empty-color,#888);
  background:var(--portrait-bg,rgba(255,255,255,.4));
  box-sizing:border-box;
}
.portrait-box.has-real-portrait{ border-style:solid; border-color:var(--portrait-border,#888); }
.portrait-box.portrait-empty::before{
  content:"点击生成"; position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  font-size:10px; color:var(--portrait-empty-color,#888); text-align:center; padding:4px;
}
/* 4 主题 float；minimal 三栏 flex 不 float */
.char-panel .portrait-box,
.love-card .portrait-box{ float:left; margin:0 12px 8px 0; }
/* minimal 三栏 flex：仅取消 float，尺寸继承基础 .portrait-box 的 96×96 固定方形。
   切勿用 height:100%+aspect-ratio:1 —— 会让立绘框宽高都随 sticky-note 行高无限增长（超大）。 */
.char-card-top-row .portrait-box{ float:none; margin:0; }
/* pointer-events:none 让 img 不拦截点击——避免有图时底部操作条/⋮ 菜单按钮被 img 遮挡点不到（点本体放大走 .portrait-box 委托，不依赖 e.target===img）*/
.portrait-box img{ width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }
.portrait-box:hover{ transform:scale(1.03); }
.portrait-actions{
  position:absolute; bottom:0; left:0; right:0;
  display:flex; justify-content:space-around;
  background:rgba(0,0,0,.62); color:#fff; font-size:9px; padding:3px 0;
  opacity:0; transition:opacity .15s; z-index:2;
}
.portrait-box:hover .portrait-actions{ opacity:1; }
.portrait-actions span{ padding:1px 4px; cursor:pointer; }
.portrait-actions span:hover{ background:rgba(255,255,255,.2); }
/* 移动端 ⋮ 快捷菜单触发钮：PC 端隐藏，仅 @media(hover:none) 下显示（见下块） */
.portrait-menu-trigger{ display:none; }

/* —— 移动端触屏适配（无 hover 能力时收起底部操作条，改用右下角 ⋮ 浮层菜单）—— */
@media (hover: none) and (pointer: coarse){
  .portrait-box:hover{ transform:none; }
  /* 收起底部三文字操作条，改用右下角 ⋮ 触发浮层菜单（避免窄框塞三个标签） */
  .portrait-actions{ display:none !important; }
  .portrait-box.portrait-empty::before{ content:"立绘"; }
  .portrait-menu-trigger{
    display:flex; align-items:center; justify-content:center;
    position:absolute; right:4px; bottom:4px; z-index:3;
    width:22px; height:22px; border-radius:50%;
    background:rgba(0,0,0,.5); color:#fff;
    font-size:15px; line-height:1; font-weight:700; letter-spacing:1px;
    -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px);
    -webkit-tap-highlight-color:transparent; touch-action:manipulation;
    cursor:pointer; border:none; user-select:none;
  }
  .portrait-menu-trigger:active{ background:rgba(0,0,0,.78); }
  /* 立绘本体不响应 hover 缩放，但仍保留点击放大 */
}

/* —— 通用弹窗（复用 .panel-overlay 体系）—— */
.portrait-popup{
  position:absolute; inset:0; display:flex; flex-direction:column;
  padding:16px; box-sizing:border-box; overflow:auto;
}
/* bridge 主题 .panel-popup{overflow:hidden} 与单类 .portrait-popup 同特异度，且 bridge CSS 末尾拼 baseCSS 后注入会覆盖
   滚动，导致 portrait 弹窗内容超高超宽被整体裁剪、无滚动条。提升特异度到 (0,2,0) 让 portrait 弹窗自身滚动稳定生效。 */
.panel-popup.portrait-popup{overflow:auto}
/* 图库弹窗：居中显示（覆盖 .portrait-popup 的绝对定位，改为参与 overlay 的 flex 居中）*/
.portrait-gallery-wrap{
  position:relative; inset:auto;
  max-height:80vh; max-height:80dvh;
}
/* 生成弹窗：同样居中显示，覆盖 .portrait-popup 的绝对定位 */
.portrait-gen-wrap{
  position:relative; inset:auto;
  max-height:85vh; max-height:85dvh;
  overflow:auto;
}
.portrait-popup-header{
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:12px; gap:12px; flex-wrap:wrap;
}
.portrait-popup-title{ font-size:15px; font-weight:600; color:var(--text,#333); }
.portrait-popup-close{
  cursor:pointer; font-size:18px; color:var(--text-muted,#888);
  padding:4px 8px; border-radius:6px;
}
.portrait-popup-close:hover{ background:var(--divider-light,rgba(0,0,0,.06)); }

/* —— 生成弹窗 —— */
.portrait-gen-field{ margin-bottom:12px; }
.portrait-gen-label{ font-size:11px; color:var(--text-muted,#888); margin-bottom:4px; }
.portrait-preset-row{ display:flex; gap:6px; flex-wrap:wrap; }
.portrait-preset-btn{
  padding:4px 12px; border:1px solid var(--divider,#ddd); border-radius:8px;
  font-size:12px; cursor:pointer; color:var(--text-muted,#666); background:transparent;
}
.portrait-preset-btn.active{ border-color:var(--accent,#4a90d9); background:var(--accent-bg,color-mix(in srgb,var(--accent,#4a90d9) 10%,transparent)); color:var(--accent,#4a90d9); }
.portrait-gen-textarea{
  width:100%; min-height:48px; border:1px solid var(--divider,#ddd); border-radius:6px;
  padding:6px 8px; background:var(--card-bg,#fff); color:var(--text,#333); font-size:var(--ub-ui-font-12,12px); box-sizing:border-box;
  font-family:inherit;
}
.portrait-gen-prompt-display{ min-height:96px; font-family:monospace; }
.portrait-gen-preview{
  padding:8px 10px; background:var(--divider-light,rgba(0,0,0,.03)); border-radius:6px;
  font-size:var(--ub-ui-font-10,10px); color:var(--text-muted,#666); line-height:1.6;
}
.portrait-gen-meta{ display:flex; align-items:center; gap:8px; font-size:10px; color:var(--text-muted,#888); }
.portrait-gen-btns{ display:flex; gap:8px; margin-top:4px; }
.portrait-gen-btn-primary{ flex:1; padding:8px; background:var(--accent,#4a90d9); color:#fff; border-radius:6px; text-align:center; cursor:pointer; border:none; font-size:13px; }
.portrait-gen-btn-primary:disabled{ opacity:.5; cursor:not-allowed; }
.portrait-gen-btn-regen{ flex:1; padding:8px; background:transparent; color:var(--accent,#4a90d9); border:1px solid var(--accent,#4a90d9); border-radius:6px; text-align:center; cursor:pointer; font-size:13px; }
.portrait-gen-btn-regen:disabled{ opacity:.45; cursor:not-allowed; }
.portrait-gen-btn-save-pref{ flex:1; padding:8px; background:transparent; color:var(--text,#333); border:1px dashed var(--divider,#bbb); border-radius:6px; text-align:center; cursor:pointer; font-size:13px; }
.portrait-gen-btn-save-pref:hover{ border-color:var(--accent,#4a90d9); color:var(--accent,#4a90d9); }
.portrait-gen-btn-save-pref:disabled{ opacity:.45; cursor:not-allowed; }
.portrait-gen-btn-cancel{ padding:8px 14px; border:1px solid var(--divider,#ddd); border-radius:6px; cursor:pointer; background:transparent; color:var(--text,#333); font-size:13px; }

/* —— 图库弹窗 —— */
.portrait-gallery-grid{
  display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px;
}
.portrait-gallery-item{
  position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden;
  border:1px solid var(--divider,#e0e0e0); cursor:pointer; background:var(--divider-light,rgba(0,0,0,.04));
}
/* F24 原位移除动画：单删后本卡缩小淡出，其余卡与滚动位置不动 */
.portrait-gallery-item.is-removed{ transition:transform .25s, opacity .25s; transform:scale(.7); opacity:0; pointer-events:none; }
.portrait-gallery-item img{ width:100%; height:100%; object-fit:cover; display:block; }
.portrait-gallery-item .pg-actions{ position:absolute; top:4px; right:4px; display:flex; gap:2px; opacity:0; transition:opacity .15s; }
.portrait-gallery-item:hover .pg-actions{ opacity:1; }
.portrait-gallery-item .pg-actions span{
  width:20px; height:20px; border-radius:50%; background:rgba(0,0,0,.6); color:#fff;
  font-size:11px; display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.portrait-gallery-item .pg-actions span:hover{ background:rgba(0,0,0,.85); }
.portrait-gallery-item .pg-meta{ position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,.55); color:#fff; font-size:9px; padding:2px 6px; }
.portrait-gallery-item.current{ border-color:var(--accent,#4a90d9); box-shadow:0 0 0 2px var(--accent,#4a90d9); }
.portrait-gallery-empty{ text-align:center; color:var(--text-muted,#888); padding:40px 0; font-size:13px; }

/* —— 随机立绘池：池内项角标 + 骰子按钮高亮 + 模式横幅 —— */
/* 池内项左上角骰子角标（常驻可见，区别于 .current 的右上 actions 与底部 meta） */
.portrait-gallery-item.in-random-pool::before{
  content:""; position:absolute; top:4px; left:4px; z-index:3;
  width:20px; height:20px; border-radius:50%;
  background:currentColor; color:#fff; font-size:11px; line-height:1;
  display:flex; align-items:center; justify-content:center;
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='4' y='4' width='16' height='16' rx='3' fill='none' stroke='black' stroke-width='1.8'/%3E%3Cpath d='M8.6 8.6h.01M12 12h.01M15.4 15.4h.01' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat center / 68%;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='4' y='4' width='16' height='16' rx='3' fill='none' stroke='black' stroke-width='1.8'/%3E%3Cpath d='M8.6 8.6h.01M12 12h.01M15.4 15.4h.01' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat center / 68%;
}
/* 池内项虚线强调环（inset outline 不影响布局；与 .current 实线描边区分） */
.portrait-gallery-item.in-random-pool{ outline:2px dashed var(--accent,#4a90d9); outline-offset:-4px; }
/* 同时是 current 又在池中：保留 current 的实线描边/光晕，仅靠角标标识池成员 */
.portrait-gallery-item.in-random-pool.current{ outline:none; }
/* 骰子按钮在池中时高亮（同 .portrait-preset-btn.active 风格） */
.portrait-gallery-item.in-random-pool .pg-actions [data-act="random"]{
  background:var(--accent,#4a90d9); color:#fff;
}
/* 随机模式横幅：仅 .active 时显示（节点始终在 DOM 中以便就地更新计数） */
.portrait-gallery-random-banner{
  display:none; margin-bottom:8px; padding:6px 10px; border-radius:6px;
  font-size:11px; line-height:1.4;
  background:var(--accent-bg,color-mix(in srgb,var(--accent,#4a90d9) 12%,transparent));
  color:var(--accent,#4a90d9);
  border:1px solid var(--accent,#4a90d9);
}
.portrait-gallery-random-banner.active{ display:block; }

/* 图库标记 + 筛选器 */
.portrait-gallery-filters{
  display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap;
  margin-bottom:8px;
}
.pg-filter-field{
  display:grid; gap:4px;
  color:var(--text-muted); font-size:12px; font-weight:600;
}
.pg-filter-select{
  width:184px; box-sizing:border-box;
  font-size:14px; font-family:inherit; padding:8px 10px;
  border:2px solid var(--divider); background:var(--card-bg,#fff); color:var(--text);
  border-radius:6px; cursor:pointer;
}
@media (max-width:480px){
  .pg-filter-field,.pg-filter-select{ width:100%; }
}
.portrait-gallery-item .pg-meta{
  display:flex; align-items:center; justify-content:flex-end; gap:6px; flex-wrap:wrap;
  position:absolute; bottom:0; left:0; right:0;
  background:rgba(0,0,0,.55); color:#fff; font-size:9px; padding:2px 6px;
}
.pg-tag{ line-height:1; white-space:nowrap; }
.pg-tag-emotion{ font-weight:600; }
.pg-tag-nsfw{ background:rgba(255,80,80,.85); color:#fff; border-radius:3px; padding:1px 4px; }
.pg-tag-daily{ color:#ccc; }
.pg-tag-muted{ color:#aaa; }
.pg-date{ margin-left:auto; }
.portrait-gallery-gen-btn{
  padding:5px 14px; background:var(--accent,#4a90d9); color:#fff; border-radius:6px;
  cursor:pointer; border:none; font-size:12px;
}
.portrait-gallery-import-btn{
  padding:5px 14px; background:transparent; color:var(--accent,#4a90d9);
  border:1px solid var(--accent,#4a90d9); border-radius:6px;
  cursor:pointer; font-size:12px;
}

/* —— 批量选择模式：选中角标 + 底部操作栏（批量删除/批量导出共用） —— */
.portrait-gallery-import-btn.active{ background:var(--accent,#4a90d9); color:#fff; }
/* 批量模式隐藏条目上的单张动作钮，避免模式混乱/误操作 */
.portrait-gallery-grid.batch-select .portrait-gallery-item .pg-actions{ display:none; }
/* 勾选角标：仅批量模式显示；选中态实心（左上角，与随机池骰子角标对位） */
.portrait-gallery-item .pg-check{
  position:absolute; top:5px; left:5px; z-index:4;
  width:22px; height:22px; border-radius:50%;
  background:rgba(0,0,0,.45); border:2px solid #fff;
  display:none; align-items:center; justify-content:center;
  font-size:13px; color:#fff; line-height:1;
}
.portrait-gallery-grid.batch-select .portrait-gallery-item .pg-check{ display:flex; }
.portrait-gallery-item.batch-selected{ border-color:#e0539a; box-shadow:0 0 0 2px #e0539a; }
.portrait-gallery-item.batch-selected .pg-check{ background:#e0539a; }
/* 底部批量操作栏（吸底圆角条，对齐 ub-batch-bar 视觉） */
.portrait-gallery-batch-toolbar{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  margin-top:12px; padding:8px 12px;
  background:var(--card-bg,#fffdf7); border:1px solid var(--divider,#e0e0e0); border-radius:10px;
  font-size:var(--ub-ui-font-12,12px); color:var(--text,#333);
}
.portrait-gallery-batch-toolbar[hidden]{ display:none; }
.pg-batch-count{ font-weight:700; min-width:64px; }
.pg-batch-spacer{ flex:1; }
.pg-batch-btn{
  padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-family:inherit;
  background:transparent; border:1px solid var(--divider,#bbb); color:var(--text,#333);
}
.pg-batch-btn:hover{ background:var(--divider-light,rgba(0,0,0,.04)); }
.pg-batch-btn.danger{ border-color:#e0539a; color:#e0539a; }
.pg-batch-btn.danger:hover{ background:color-mix(in srgb,#e0539a 10%,transparent); }
.pg-batch-btn:disabled{ opacity:.45; cursor:not-allowed; }
@media (hover:none) and (pointer:coarse){
  .portrait-gallery-batch-toolbar .pg-batch-btn{ padding:7px 14px; font-size:13px; }
}

/* —— 移动端图库触屏适配：操作按钮常驻可见 + 增大点击区 —— */
@media (hover: none) and (pointer: coarse){
  .portrait-gallery-item .pg-actions{ opacity:1; }
  .portrait-gallery-item .pg-actions span{
    width:26px; height:26px; font-size:13px;
    -webkit-tap-highlight-color:transparent;
    touch-action:manipulation;
  }
  .portrait-gallery-item .pg-actions span:active{ background:rgba(0,0,0,.9); }
}

/* —— 放大弹窗（相册翻看：三槽滑动轨道 + 边缘点击/拖拽翻页；点图/空白/ESC 返回关闭）—— */
.portrait-lightbox{
  position:absolute; inset:0;
  overflow:hidden; cursor:pointer; padding:0;
}
.portrait-lightbox img{
  display:block; max-width:90vw; max-height:90vh; max-height:90dvh;
  width:auto; height:auto; object-fit:contain;
  border-radius:8px; box-shadow:0 0 30px rgba(0,0,0,.7);
  user-select:none; -webkit-user-drag:none;
}
.plb-track{
  width:100%; height:100%; display:flex;
  transition:transform .26s cubic-bezier(.25,.72,.36,1);
  touch-action:none;
}
.plb-slide{ flex:0 0 100%; display:flex; align-items:center; justify-content:center; }
.plb-frame{ position:relative; }
.plb-nav{
  position:absolute; top:0; bottom:0; width:64px;
  display:flex; align-items:center; justify-content:center;
  opacity:0; transition:opacity .2s ease; cursor:pointer;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation;
}
.plb-nav::before{
  content:''; position:absolute; inset:0;
  opacity:0; transition:opacity .2s ease;
}
.plb-nav-prev{ left:0; border-radius:8px 0 0 8px; }
.plb-nav-prev::before{ background:linear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,0)); }
.plb-nav-next{ right:0; border-radius:0 8px 8px 0; }
.plb-nav-next::before{ background:linear-gradient(270deg,rgba(255,255,255,.18),rgba(255,255,255,0)); }
.plb-nav svg{
  width:26px; height:26px; color:rgba(255,255,255,.9);
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.55));
  transition:transform .2s ease;
}
.plb-nav:hover{ opacity:1; }
.plb-nav:hover::before{ opacity:1; }
.plb-nav-prev:hover svg{ transform:translateX(-2px); }
.plb-nav-next:hover svg{ transform:translateX(2px); }
@media (hover:none) and (pointer:coarse){
  .plb-nav{ opacity:.5; }
  .plb-nav::before{ opacity:.6; }
}
.plb-counter{
  position:absolute; left:50%; bottom:14px; transform:translateX(-50%);
  padding:3px 10px; border-radius:999px;
  background:rgba(0,0,0,.55); color:rgba(255,255,255,.92);
  font-size:12px; line-height:1.6; font-family:inherit;
  opacity:0; transition:opacity .25s ease;
  pointer-events:none; user-select:none;
}
.plb-counter.plb-show{ opacity:1; }

/* —— 移动端立绘快捷菜单浮层（⋮ 触发；深色毛玻璃，固定配色不依赖主题变量，5 主题/深浅模式统一）—— */
.portrait-quick-overlay{ position:fixed; inset:0; z-index:10030; background:transparent; }
.portrait-quick-menu{
  position:absolute; min-width:128px; padding:5px;
  background:rgba(28,28,32,.82);
  -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.14); border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.45);
  display:flex; flex-direction:column; gap:1px;
  font-family:inherit;
}
.portrait-quick-menu button{
  display:flex; align-items:center; gap:10px;
  padding:9px 12px; border:none; background:transparent;
  color:#fff; font-size:13px; text-align:left;
  border-radius:8px; cursor:pointer; min-height:36px;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation;
  font-family:inherit;
}
.portrait-quick-menu button:active{ background:rgba(255,255,255,.16); }
.portrait-quick-menu .pqm-icon{ width:18px; text-align:center; font-size:15px; flex:none; }

/* 衣柜服装替换：与“同人/包含主角”同级的本次生图临时选项 */
.portrait-inline-check{
  display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:var(--ub-ui-font-12,12px);color:var(--text,#444)
}
.portrait-wardrobe-controls{margin-top:8px;padding:10px;border:1px solid var(--divider,#ddd);border-radius:8px;background:var(--card-bg,#fff);background:color-mix(in srgb,var(--card-bg,#fff) 88%,var(--accent,#888) 12%)}
.portrait-wardrobe-mode-row,.portrait-wardrobe-source-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.portrait-wardrobe-choice{
  display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border:1px solid var(--divider,#ddd);
  border-radius:8px;cursor:pointer;font-size:12px;color:var(--text-muted,#666);background:transparent
}
.portrait-wardrobe-choice input{margin:0}
.portrait-wardrobe-choice:has(input:checked){border-color:var(--accent,#4a90d9);background:var(--accent-bg,color-mix(in srgb,var(--accent,#4a90d9) 10%,transparent));color:var(--accent,#4a90d9)}
#portraitWardrobeOutfit{width:100%;padding:6px 8px;border:1px solid var(--divider,#ddd);border-radius:6px;background:var(--card-bg,#fff);color:var(--text,#333);font-family:inherit;font-size:var(--ub-ui-font-12,12px);box-sizing:border-box}
.portrait-wardrobe-custom-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:190px;overflow:auto}
.portrait-wardrobe-custom-list>label{display:flex;gap:7px;align-items:flex-start;padding:7px;border:1px solid var(--divider,#ddd);border-radius:7px;cursor:pointer;background:var(--card-bg,#fff)}
.portrait-wardrobe-custom-list>label>span{min-width:0}
.portrait-wardrobe-item-name{display:block;font-size:var(--ub-ui-font-12,12px);line-height:1.4;color:var(--text,#333)}
.portrait-wardrobe-item-description{display:block;font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,#888);line-height:1.4;overflow-wrap:anywhere}
.portrait-wardrobe-warning{margin-top:6px;color:#b46a24;font-size:var(--ub-ui-font-11,11px);line-height:1.45}
@media(max-width:599px){.portrait-wardrobe-custom-list{grid-template-columns:1fr}}

/* 同人身份 tag（固化）：识别一次后复用，生图时两项直接拼进提示词 */
.portrait-fan-tags{margin-top:8px;padding:10px;border:1px solid var(--divider,#ddd);border-radius:8px;background:var(--card-bg,#fff);background:color-mix(in srgb,var(--card-bg,#fff) 88%,var(--accent,#888) 12%)}
.portrait-fan-tag-row{display:flex;align-items:center;gap:8px;margin-top:6px}
.portrait-fan-tag-name{flex:0 0 52px;font-size:var(--ub-ui-font-12,12px);color:var(--text-muted,#666);text-align:right}
.portrait-fan-tag-row input{flex:1 1 auto;width:auto;min-width:0;min-height:0;padding:4px 6px}
.portrait-fan-tags-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.portrait-fan-tag-hint{font-size:var(--ub-ui-font-11,11px);color:var(--text-muted,#888);line-height:1.45}
@media(max-width:599px){.portrait-fan-tag-name{flex:0 0 auto}}

/* 深空舰桥：人员影像终端 */
.bridge-container .portrait-box{border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-screen,#152b32);box-shadow:inset 0 0 0 3px rgba(142,234,255,.06);}
.bridge-container .portrait-box.portrait-empty::before{content:"NO VISUAL / 无影像";color:var(--bridge-screen-text,#8eeaff);font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:.8px;}
.portrait-popup.bridge-module-imaging{border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);font-family:var(--bridge-font-ui,'Microsoft YaHei','PingFang SC',sans-serif);}
.bridge-module-imaging .portrait-popup-header{background:linear-gradient(90deg,var(--bridge-panel-alt,#dde8eb),var(--bridge-panel,#eef3f5));border-bottom:1px solid var(--bridge-line-strong,#23758a);}
.bridge-module-imaging .portrait-popup-title{font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:1px;}
.bridge-module-imaging .portrait-popup-title::after{content:" / PERSONNEL IMAGING";font-size:9px;color:var(--bridge-text-muted,#62757c);letter-spacing:1.2px;}
.bridge-module-imaging .portrait-popup-close,.bridge-module-imaging button{min-height:34px;border-radius:0;}
.bridge-module-imaging .portrait-preset-btn,.bridge-module-imaging .portrait-gen-textarea,.bridge-module-imaging .portrait-fan-tags,.bridge-module-imaging .portrait-gen-btn-cancel,.bridge-module-imaging .portrait-gen-btn-primary,.bridge-module-imaging .portrait-gen-btn-regen,.bridge-module-imaging .portrait-gallery-gen-btn,.bridge-module-imaging .portrait-gallery-import-btn,.bridge-module-imaging .portrait-wardrobe-choice,.bridge-module-imaging #portraitWardrobeOutfit,.bridge-module-imaging .portrait-wardrobe-custom-list>label{border-radius:0;border-color:var(--bridge-line,#91a5ad);}
.bridge-module-imaging .portrait-preset-btn.active,.bridge-module-imaging .portrait-gen-btn-primary,.bridge-module-imaging .portrait-gallery-gen-btn{background:var(--bridge-signal,#0a7189);border-color:var(--bridge-signal,#0a7189);color:var(--bridge-signal-contrast,#fff);}
.bridge-module-imaging .portrait-gen-preview,.bridge-module-imaging .portrait-gallery-random-banner{border-radius:0;border:1px solid var(--bridge-line,#91a5ad);background:var(--bridge-panel-inset,#d5e1e5);}
.bridge-portrait-gallery{width:min(94%,820px);max-width:820px;}
.bridge-portrait-gallery .portrait-gallery-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;}
.bridge-portrait-gallery .portrait-gallery-item{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-screen,#152b32);}
.bridge-portrait-gallery .portrait-gallery-item.current{border-color:var(--bridge-signal,#0a7189);box-shadow:inset 0 0 0 2px var(--bridge-signal,#0a7189);}
.bridge-portrait-gallery .portrait-gallery-item.in-random-pool{outline:1px dashed var(--bridge-warn,#b47a16);}
.bridge-portrait-gallery .portrait-gallery-item.batch-selected{border-color:var(--bridge-signal,#0a7189);box-shadow:inset 0 0 0 2px var(--bridge-signal,#0a7189);}
.bridge-portrait-gallery .portrait-gallery-item .pg-check{border-radius:0;}
.bridge-module-imaging .portrait-gallery-batch-toolbar{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-panel-inset,#d5e1e5);}
.bridge-module-imaging .pg-batch-btn{border-radius:0;border-color:var(--bridge-line,#91a5ad);}
.bridge-module-imaging .pg-batch-btn.danger{border-color:var(--bridge-warn,#b47a16);color:var(--bridge-warn,#b47a16);}
.bridge-module-imaging .pg-batch-btn.danger:hover{background:var(--bridge-panel-inset,#d5e1e5);}
.bridge-module-imaging .portrait-gallery-import-btn.active{background:var(--bridge-signal,#0a7189);color:var(--bridge-signal-contrast,#fff);}
.portrait-quick-menu.bridge-portrait-quick-menu{border-radius:0;border-color:var(--bridge-screen-text,#8eeaff);background:rgba(10,30,37,.94);font-family:var(--bridge-font-data,'Consolas',monospace);}
.portrait-quick-menu.bridge-portrait-quick-menu button{border-radius:0;}
@media(max-width:599px){.portrait-popup.bridge-module-imaging{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0}.bridge-portrait-gallery .portrait-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* 单图标签编辑弹窗 */
.portrait-edit-wrap{ position:relative; inset:auto; max-width:420px; width:92vw; max-height:85vh; max-height:85dvh; overflow:auto; }
.portrait-edit-body{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.portrait-edit-preview{ width:120px; height:160px; object-fit:cover; border-radius:6px; overflow:hidden; flex-shrink:0; }
.portrait-edit-preview img{ width:100%; height:100%; object-fit:cover; display:block; }
.portrait-edit-fields{ flex:1; min-width:180px; display:flex; flex-direction:column; gap:10px; }
.portrait-edit-label{ font-size:11px; color:var(--text-muted,#888); margin-bottom:4px; }
.portrait-edit-select{ width:100%; font-size:12px; font-family:inherit; padding:4px 6px; border:1px solid var(--divider-light,rgba(0,0,0,.12)); background:var(--card-bg,#fff); color:var(--text,#333); border-radius:4px; cursor:pointer; }
.portrait-edit-readonly .portrait-edit-value{ font-size:11px; color:var(--text-muted,#666); line-height:1.5; word-break:break-all; max-height:60px; overflow:auto; }
.portrait-edit-actions{ display:flex; justify-content:flex-end; gap:8px; }
.portrait-edit-btn{ font-size:12px; padding:5px 14px; border-radius:5px; cursor:pointer; border:1px solid var(--divider-light,rgba(0,0,0,.12)); font-family:inherit; }
.portrait-edit-btn.cancel{ background:transparent; color:var(--text,#333); }
.portrait-edit-btn.save{ background:var(--accent,#4a90d9); color:#fff; border-color:var(--accent,#4a90d9); }
.portrait-edit-btn.regen{ background:var(--card-bg,#fff); color:var(--text,#333); }
.portrait-edit-btn.regen:hover{ border-color:var(--accent,#4a90d9); color:var(--accent,#4a90d9); }
.portrait-edit-btn:disabled{ opacity:.55; cursor:default; }
/* 编辑弹窗：生图档案提示词区（可编辑 textarea + 复制按钮） */
.portrait-edit-label-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.portrait-edit-copy{ font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid var(--divider-light,rgba(0,0,0,.12)); background:var(--card-bg,#fff); color:var(--text-muted,#888); cursor:pointer; font-family:inherit; }
.portrait-edit-copy:hover{ color:var(--accent,#4a90d9); border-color:var(--accent,#4a90d9); }
.portrait-edit-textarea{ width:100%; box-sizing:border-box; font-size:12px; font-family:inherit; line-height:1.5; padding:6px 8px; border:1px solid var(--divider-light,rgba(0,0,0,.12)); background:var(--card-bg,#fff); color:var(--text,#333); border-radius:4px; resize:vertical; }
/* 是否瑟瑟三态分段按钮 */
.pg-filter-nsfw{ display:inline-flex; width:100%; border:1px solid var(--divider-light,rgba(0,0,0,.12)); border-radius:5px; overflow:hidden; }
.pg-filter-btn{ flex:1; min-width:0; font-size:12px; font-family:inherit; padding:5px 0; border:0; border-right:1px solid var(--divider-light,rgba(0,0,0,.12)); background:var(--card-bg,#fff); color:var(--text,#333); cursor:pointer; transition:background .15s,color .15s; }
.pg-filter-btn:last-child{ border-right:0; }
.pg-filter-btn:hover{ filter:brightness(.97); }
.pg-filter-btn.active{ background:var(--accent,#4a90d9); color:#fff; }

/* 随机依据复选芯片 */
.portrait-filter-chip{
  font-size:11px; padding:4px 10px; border:1px solid var(--divider-light,rgba(0,0,0,.18));
  background:transparent; color:var(--text,#333); border-radius:14px; cursor:pointer; font-family:inherit;
  transition:all .15s;
}
.portrait-filter-chip:hover{ border-color:var(--accent,#4a90d9); color:var(--accent,#4a90d9); }
.portrait-filter-chip.on{ background:var(--accent,#4a90d9); color:#fff; border-color:var(--accent,#4a90d9); }
`;
