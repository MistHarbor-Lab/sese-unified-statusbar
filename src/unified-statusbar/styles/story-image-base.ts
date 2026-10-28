// ===== 正文插图（自动文生图）：图库弹窗 + 全屏浏览共享 CSS =====
// 独立功能 CSS（幂等注入 id=ub-story-image-css，常驻——DOM 无匹配节点时零重绘开销）。
// 不依赖 portrait-base（其随 portraitEnabled 注入/移除，非立绘功能禁复用）。
// 颜色一律走主题变量链（--card-bg/--text/--divider/--accent 等，7 主题浅深双态齐备）；
// 深色随 .panel-overlay.dark / body.dark-mode(minimal) 自动翻转，无需本文件干预。
export const SIG_GALLERY_CSS = `
/* —— 图库弹窗 —— */
.story-image-popup{
  display:flex; flex-direction:column; max-height:80vh; max-height:80dvh; overflow:hidden;
}
.sig-header{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding-bottom:8px; border-bottom:1px solid var(--divider,#e0e0e0);
}
.portrait-popup-title{ display:flex; align-items:center; gap:6px; font-size:var(--ub-ui-font-13,13px); font-weight:700; color:var(--text,#333); }
.sig-count{ font-weight:400; color:var(--text-muted,#888); }
.sig-header-actions{ display:flex; align-items:center; gap:6px; }
.sig-header-actions .pg-filter-btn{
  display:flex; align-items:center; justify-content:center;
  min-height:44px; min-width:44px; padding:6px 10px;
  background:var(--card-bg,#fff); color:var(--text,#333);
  border:1px solid var(--divider,#ccc); border-radius:8px; cursor:pointer;
}
.sig-header-actions .pg-filter-btn:hover{ border-color:var(--accent,#4a90d9); color:var(--accent,#4a90d9); }
.sig-subtitle{
  font-size:var(--ub-ui-font-11,11px); color:var(--text-muted,#888);
  padding:8px 0 4px; line-height:1.5;
}
.sig-grid{
  display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px;
  overflow-y:auto; padding:4px 2px 8px; flex:1; min-height:120px;
  align-content:start;
  /* 网格行高必须钉死为内容高：本网格是 flex:1 定高滚动容器，卡片带 overflow:hidden 时
     min-content 贡献为 0，Chrome 会把 auto 行均分成容器高度的等分（卡片被拉伸到行高再被
     overflow:hidden 裁成横条——2026-09-12 图库横条真因，V3.720 aspect-ratio 误诊的平反）。
     min-content 使行高脱离容器均分逻辑，任何上下文下都按内容自适应。 */
  grid-auto-rows:min-content;
}
.sig-empty{
  grid-column:1 / -1; text-align:center; color:var(--text-muted,#888);
  padding:36px 12px; font-size:var(--ub-ui-font-12,12px); line-height:1.7;
}
.sig-card{
  position:relative; border-radius:10px; overflow:hidden; cursor:pointer;
  border:1px solid var(--divider,#e0e0e0); background:var(--divider-light,rgba(0,0,0,.04));
  transition:transform .15s, box-shadow .15s;
}
.sig-card:hover{ transform:translateY(-2px); box-shadow:0 4px 14px rgba(0,0,0,.14); }
/* F24 原位移除动画：删除后单卡缩小淡出（其余卡片与滚动位置不动） */
.sig-card.is-removed{ transition:transform .25s, opacity .25s; transform:scale(.7); opacity:0; pointer-events:none; }
.sig-img-wrap{ position:relative; aspect-ratio:1; }
/* aspect-ratio 兜底（2026-09-06 图库横条事故）：老引擎（旧 iOS Safari/旧安卓 WebView，<Chrome 88）
   不支持 aspect-ratio 时 wrap 高度塌缩为 0，卡片只剩日期行高、绝对定位图片被裁成顶部条带。
   ::before padding-top 百分比相对自身宽度，全引擎成立；与 aspect-ratio 同高不叠加。 */
.sig-img-wrap::before{ content:''; display:block; padding-top:100%; }
/* 显式 top/left + height:100%（wrap 高度已被上面两条保证）：height:auto 会走替换元素
   固有宽高比而非拉伸，任何引擎下都填不满 wrap。 */
.sig-img-wrap img{ position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }
.sig-card img[src=""], .sig-card img:not([src]){ opacity:.2; }
.sig-char-tag{
  position:absolute; left:6px; bottom:6px; z-index:2;
  display:inline-flex; align-items:center; gap:4px;
  max-width:calc(100% - 12px);
  padding:3px 8px; border-radius:999px;
  background:rgba(0,0,0,.62); color:#fff;
  font-size:var(--ub-ui-font-11,11px); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.sig-char-tag .ub-ic{ flex:0 0 auto; }
.sig-del{
  position:absolute; top:6px; right:6px; z-index:2;
  display:flex; align-items:center; justify-content:center;
  width:28px; height:28px; border-radius:50%;
  background:rgba(0,0,0,.6); color:#fff; border:none; cursor:pointer;
  opacity:0; transition:opacity .15s;
}
.sig-card:hover .sig-del, .sig-del:focus-visible{ opacity:1; }
.sig-del:hover{ background:rgba(180,40,40,.9); }
.sig-date{
  padding:5px 8px 6px; font-size:var(--ub-ui-font-11,11px); color:var(--text-muted,#888);
  background:var(--card-bg,#fff);
}
@media (hover:none) and (pointer:coarse){
  .sig-del{ opacity:1; width:32px; height:32px; }
}
@media (max-width:480px){
  .sig-grid{ grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; }
}
/* —— 卡片「查看/编辑生图信息」按钮（删除按钮左侧；悬停显示）—— */
.sig-edit{
  position:absolute; top:6px; right:40px; z-index:2;
  display:flex; align-items:center; justify-content:center;
  width:28px; height:28px; border-radius:50%;
  background:rgba(0,0,0,.6); color:#fff; border:none; cursor:pointer;
  opacity:0; transition:opacity .15s;
}
.sig-edit svg{ width:14px; height:14px; }
.sig-card:hover .sig-edit, .sig-edit:focus-visible{ opacity:1; }
.sig-edit:hover{ background:var(--accent,#4a90d9); }
@media (hover:none) and (pointer:coarse){
  .sig-edit{ opacity:1; width:32px; height:32px; }
}
/* —— 卡片「转入角色图库」按钮（编辑按钮左侧；悬停显示；复制一份到所选角色立绘图库）—— */
.sig-import{
  position:absolute; top:6px; right:74px; z-index:2;
  display:flex; align-items:center; justify-content:center;
  width:28px; height:28px; border-radius:50%;
  background:rgba(0,0,0,.6); color:#fff; border:none; cursor:pointer;
  opacity:0; transition:opacity .15s;
}
.sig-import svg{ width:14px; height:14px; }
.sig-card:hover .sig-import, .sig-import:focus-visible{ opacity:1; }
.sig-import:hover{ background:var(--accent,#4a90d9); }
@media (hover:none) and (pointer:coarse){
  .sig-import{ opacity:1; width:32px; height:32px; }
}

/* —— 插图详情/编辑弹窗（生成时间/描述/提示词可改；模型与参数只读）—— */
.sig-detail-wrap{
  position:relative; inset:auto; max-width:460px; width:92vw;
  max-height:85vh; max-height:85dvh; overflow:auto;
}
.sig-detail-body{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.sig-detail-preview{ position:relative; width:120px; height:160px; border-radius:8px; overflow:hidden; flex-shrink:0; background:var(--divider-light,rgba(0,0,0,.06)); }
.sig-detail-preview img{ position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; display:block; }
.sig-detail-fields{ flex:1; min-width:200px; display:flex; flex-direction:column; gap:10px; }
.sig-detail-label{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:var(--ub-ui-font-11,11px); color:var(--text-muted,#888); margin-bottom:4px; }
.sig-detail-value{ font-size:var(--ub-ui-font-11,11px); color:var(--text-muted,#666); line-height:1.5; word-break:break-all; }
.sig-detail-textarea{
  width:100%; box-sizing:border-box;
  font-size:var(--ub-ui-font-12,12px); font-family:inherit; line-height:1.5;
  padding:6px 8px; border:1px solid var(--divider,#ccc);
  background:var(--card-bg,#fff); color:var(--text,#333);
  border-radius:6px; resize:vertical;
}
.sig-detail-copy{
  flex:0 0 auto; font-size:var(--ub-ui-font-11,11px); line-height:1.4;
  padding:2px 8px; border-radius:999px; border:1px solid var(--divider,#ccc);
  background:var(--card-bg,#fff); color:var(--text-muted,#888); cursor:pointer; font-family:inherit;
}
.sig-detail-copy:hover{ color:var(--accent,#4a90d9); border-color:var(--accent,#4a90d9); }
.sig-detail-actions{ display:flex; justify-content:flex-end; gap:8px; }
.sig-detail-btn{ font-size:var(--ub-ui-font-12,12px); padding:5px 14px; border-radius:6px; cursor:pointer; border:1px solid var(--divider,#ccc); font-family:inherit; }
.sig-detail-btn.cancel{ background:transparent; color:var(--text,#333); }
.sig-detail-btn.save{ background:var(--accent,#4a90d9); color:#fff; border-color:var(--accent,#4a90d9); }
.sig-detail-btn.regen{ background:var(--card-bg,#fff); color:var(--text,#333); }
.sig-detail-btn.regen:hover{ border-color:var(--accent,#4a90d9); color:var(--accent,#4a90d9); }
.sig-detail-btn:disabled{ opacity:.55; cursor:default; }
/* 档案折叠区（全参数 / 多角色 UC / ComfyUI 工作流） */
.sig-detail-details{ font-size:var(--ub-ui-font-11,11px); color:var(--text-muted,#666); }
.sig-detail-details summary{ cursor:pointer; user-select:none; }
.sig-detail-details pre{
  max-height:180px; overflow:auto; margin:6px 0 0; padding:6px 8px;
  font-size:var(--ub-ui-font-11,11px); font-family:inherit; line-height:1.5;
  white-space:pre-wrap; word-break:break-all;
  background:var(--divider-light,rgba(0,0,0,.05)); border-radius:6px;
}
`;

/* —— 全屏三槽滑动浏览（与立绘 lightbox 视觉完全同步：透明底透出面板遮罩、
      边缘渐变翻页热区、底部居中页码胶囊；另加右上删除按钮）—— */
const SIG_LIGHTBOX_CSS = `.sig-lightbox{
  position:absolute; inset:0; overflow:hidden; cursor:pointer; padding:0;
}
.sig-track{
  position:absolute; inset:0;
  display:flex; width:100%;
  transition:transform .26s cubic-bezier(.25,.72,.36,1);
  touch-action:none; will-change:transform;
}
.sig-slide{
  flex:0 0 100%;
  display:flex; align-items:center; justify-content:center;
}
.sig-frame{ position:relative; }
.sig-frame img{
  display:block;
  max-width:90vw; max-height:90vh; max-height:90dvh;
  width:auto; height:auto; object-fit:contain;
  border-radius:8px; box-shadow:0 0 30px rgba(0,0,0,.7);
  user-select:none; -webkit-user-drag:none;
}
.sig-nav{
  position:absolute; top:0; bottom:0; width:64px;
  display:flex; align-items:center; justify-content:center;
  opacity:0; transition:opacity .2s ease; cursor:pointer;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation;
  pointer-events:none;
}
.sig-nav::before{
  content:''; position:absolute; inset:0;
  opacity:0; transition:opacity .2s ease;
}
.sig-nav-prev{ left:0; border-radius:8px 0 0 8px; }
.sig-nav-prev::before{ background:linear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,0)); }
.sig-nav-next{ right:0; border-radius:0 8px 8px 0; }
.sig-nav-next::before{ background:linear-gradient(270deg,rgba(255,255,255,.18),rgba(255,255,255,0)); }
.sig-nav svg{
  width:26px; height:26px; color:rgba(255,255,255,.9);
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.55));
  transition:transform .2s ease;
}
/* 仅悬停图片本体（.sig-frame）时显示翻页箭头——悬停在四周暗区不显示（避免箭头常驻） */
.sig-frame:hover .sig-nav{ opacity:1; pointer-events:auto; }
.sig-frame:hover .sig-nav::before{ opacity:1; }
.sig-nav-prev:hover svg{ transform:translateX(-2px); }
.sig-nav-next:hover svg{ transform:translateX(2px); }
@media (hover:none) and (pointer:coarse){
  .sig-nav{ opacity:.5; pointer-events:auto; }
  .sig-nav::before{ opacity:.6; }
}
.sig-counter{
  position:absolute; left:50%; bottom:14px; transform:translateX(-50%);
  padding:3px 10px; border-radius:999px;
  background:rgba(0,0,0,.55); color:rgba(255,255,255,.92);
  font-size:var(--ub-ui-font-12,12px); line-height:1.6; font-family:inherit;
  opacity:0; transition:opacity .25s ease;
  pointer-events:none; user-select:none;
}
.sig-counter.sig-show{ opacity:1; }
/* 底部信息栏（仅正文图片放大：当前图描述 + 进入图库入口；图库放大不渲染本节点） */
.sig-info{
  position:absolute; left:50%; bottom:44px; transform:translateX(-50%);
  display:flex; align-items:center; gap:14px; max-width:min(88vw,760px);
  padding:7px 10px; border-radius:14px;
  background:rgba(0,0,0,.55); backdrop-filter:blur(4px); z-index:5;
}
.sig-desc{
  flex:1 1 auto; min-width:0; color:rgba(255,255,255,.92);
  font-size:var(--ub-ui-font-13,13px); line-height:1.5; font-family:inherit;
  text-align:center; overflow:hidden;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
}
.sig-gallery-btn{
  flex:0 0 auto; display:inline-flex; align-items:center; gap:6px;
  padding:7px 14px; border-radius:999px; border:none; cursor:pointer;
  background:rgba(255,255,255,.16); color:rgba(255,255,255,.95);
  font-size:var(--ub-ui-font-12,12px); line-height:1.4; font-family:inherit;
  transition:background .18s ease; -webkit-tap-highlight-color:transparent;
}
.sig-gallery-btn svg{ width:15px; height:15px; }
.sig-gallery-btn:hover{ background:rgba(255,255,255,.28); }
@media (hover:none) and (pointer:coarse){
  .sig-gallery-btn{ padding:9px 16px; }
}
/* 「重新生图」便捷按钮（信息栏内，进入图库右侧；按生图档案重放当前图） */
.sig-regen-btn{
  flex:0 0 auto; display:inline-flex; align-items:center; gap:6px;
  padding:7px 14px; border-radius:999px; border:none; cursor:pointer;
  background:rgba(255,255,255,.16); color:rgba(255,255,255,.95);
  font-size:var(--ub-ui-font-12,12px); line-height:1.4; font-family:inherit;
  transition:background .18s ease, opacity .18s ease; -webkit-tap-highlight-color:transparent;
}
.sig-regen-btn svg{ width:15px; height:15px; }
.sig-regen-btn:hover{ background:rgba(255,255,255,.28); }
.sig-regen-btn.sig-busy{ opacity:.55; pointer-events:none; }
@media (hover:none) and (pointer:coarse){
  .sig-regen-btn{ padding:9px 16px; }
}
/* 放大视图右上操作组：转入角色图库 + 删除同侧并排（图库/正文共用；容器定位，按钮宽度自适应）
   top 扣 iPhone 顶部安全区（宿主全屏/刘海档不被状态栏区压住；桌面 env=0 ⇒ 逐像素无变化） */
.sig-zoom-actions{
  position:absolute; top:calc(14px + var(--safe-top,0px)); right:14px; z-index:6;
  display:inline-flex; align-items:center; gap:8px;
}
.sig-del-zoom{
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 12px; border-radius:999px; border:none;
  background:rgba(0,0,0,.55); color:rgba(255,255,255,.92);
  font-size:var(--ub-ui-font-12,12px); line-height:1.4; font-family:inherit;
  cursor:pointer; transition:background .18s ease;
  -webkit-tap-highlight-color:transparent;
}
.sig-del-zoom svg{ width:15px; height:15px; }
.sig-del-zoom:hover{ background:rgba(180,40,40,.9); }
@media (hover:none) and (pointer:coarse){
  .sig-del-zoom{ padding:9px 16px; }
}
/* 「转入角色图库」按钮（与删除同在右上操作组；复制当前图到所选角色立绘图库，不关放大） */
.sig-import-zoom{
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 12px; border-radius:999px; border:none;
  background:rgba(0,0,0,.55); color:rgba(255,255,255,.92);
  font-size:var(--ub-ui-font-12,12px); line-height:1.4; font-family:inherit;
  cursor:pointer; transition:background .18s ease;
  -webkit-tap-highlight-color:transparent;
}
.sig-import-zoom svg{ width:15px; height:15px; }
.sig-import-zoom:hover{ background:rgba(255,255,255,.28); }
@media (hover:none) and (pointer:coarse){
  .sig-import-zoom{ padding:9px 16px; }
}
@media (prefers-reduced-motion:reduce){
  .sig-track{ transition:none; }
  .sig-card, .sig-card:hover{ transition:none; transform:none; }
}
`;

/**
 * 宿主页（正文图片放大/悬浮删除/确认弹窗）注入用 CSS：<style id="ub-story-host-css">。
 * 复用同一套 .sig-* 浏览样式；根元素叠加 .ub-story-host-zoom（fixed + 自带半透明模糊遮罩，
 * 观感对齐 iframe 侧 #panelOverlay 遮罩）。固定深色玻璃配色，不依赖主题变量（宿主页无本插件 token）。
 */
export const STORY_IMAGE_HOST_CSS = `
.ub-story-host-zoom{
  position:fixed; top:0; left:0; width:100%;
  height:100vh; height:100dvh;
  background:rgba(0,0,0,.45); backdrop-filter:blur(2px);
  z-index:100000;
}
/* —— 宿主页轻量确认弹窗（删除正文插图；深色玻璃固定配色）—— */
.ub-host-confirm{
  position:fixed; top:0; left:0; width:100%;
  height:100vh; height:100dvh;
  display:flex; align-items:center; justify-content:center;
  background:rgba(10,12,16,.55); backdrop-filter:blur(2px);
  z-index:100002;
}
.ub-host-confirm-card{
  width:min(360px, calc(100% - 48px));
  padding:18px 20px; border-radius:14px;
  background:#1c1f26; color:#eceef2;
  box-shadow:0 12px 40px rgba(0,0,0,.5);
  font-size:13px; line-height:1.7; font-family:inherit;
}
.ub-host-confirm-title{ font-size:14px; font-weight:700; margin-bottom:8px; color:#fff; }
.ub-host-confirm-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:16px; }
.ub-host-confirm-actions button{
  padding:7px 16px; border-radius:999px; border:none; cursor:pointer;
  font-size:13px; font-family:inherit; line-height:1.4;
  background:rgba(255,255,255,.12); color:#eceef2;
  transition:background .15s ease;
}
.ub-host-confirm-actions button:hover{ background:rgba(255,255,255,.2); }
.ub-host-confirm-actions .ub-host-confirm-ok{ background:rgba(196,58,58,.85); color:#fff; }
.ub-host-confirm-actions .ub-host-confirm-ok:hover{ background:rgba(214,72,72,.95); }
/* 转入角色图库选择卡：下拉样式 + 转入按钮为肯定色（.ub-host-confirm-ok 默认红=删除语义） */
.ub-host-select{
  width:100%; box-sizing:border-box; margin-top:2px;
  padding:8px 10px; border-radius:8px;
  border:1px solid rgba(255,255,255,.18); background:#262a33; color:#eceef2;
  font-size:13px; font-family:inherit; outline:none;
}
.ub-host-select:focus{ border-color:rgba(255,255,255,.4); }
.ub-host-confirm-actions .ub-host-confirm-import{ background:rgba(72,140,220,.9); color:#fff; }
.ub-host-confirm-actions .ub-host-confirm-import:hover{ background:rgba(92,160,235,.95); }
/* —— 正文图片悬浮删除小×（fixed 跟随 hover 图片右上角）—— */
.ub-story-hover-del{
  position:fixed; width:28px; height:28px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.62); color:#fff; border:none; cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,.4);
  z-index:100001; opacity:0; pointer-events:none;
  transition:opacity .12s ease, background .12s ease;
}
.ub-story-hover-del.show{ opacity:1; pointer-events:auto; }
.ub-story-hover-del svg{ width:14px; height:14px; }
.ub-story-hover-del:hover{ background:rgba(180,40,40,.9); }
${SIG_LIGHTBOX_CSS}`;

/**
 * 生图失败占位重试按钮样式（独立小样式块 <style id="ub-story-pending-css">，装载时注入——
 * 占位要在首次失败后立即可见可点，不等首次交互）。markdown 链接渲染成胶囊按钮；
 * 半透明琥珀配色 + currentColor 文字，宿主明暗主题下均可读。
 */
export const STORY_IMAGE_PENDING_CSS = `
.mes_text a[href^="#ub-sig-pending-"]{
  display:inline-block; padding:3px 12px; margin:2px 0;
  border:1px dashed rgba(214,158,58,.65); border-radius:999px;
  background:rgba(214,158,58,.12); color:inherit;
  font-size:.92em; text-decoration:none; cursor:pointer;
}
.mes_text a[href^="#ub-sig-pending-"]:hover{ background:rgba(214,158,58,.26); }
`;

/** iframe 侧常驻 CSS（幂等注入 id=ub-story-image-css）：图库弹窗 + 全屏浏览共用一份。 */
export const STORY_IMAGE_BASE_CSS = SIG_GALLERY_CSS + SIG_LIGHTBOX_CSS;
