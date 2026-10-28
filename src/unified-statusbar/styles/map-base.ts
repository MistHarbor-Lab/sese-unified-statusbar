// ===== 地图面板共享 CSS（CSS 变量驱动，各主题通过注入变量值主题化） =====
//
// 由 index.ts 的 injectMapCSS() 注入 #statusbar-map-style 元素：
//   内容 = :root { --map-* 变量值 } + MAP_BASE_CSS
// 各主题的变量值在 styles/*.ts 的 MAP_THEME_VARS 导出，injectMapCSS 据当前主题选取。

export const MAP_BASE_CSS = `
/* ========== 地图弹窗尺寸覆盖（适配 800x600 地图比例） ========== */
.panel-popup.map-popup { max-width: 800px; max-height: 90vh; width: 95%; }
.panel-popup.map-popup .panel-popup-body { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; padding: 8px; }
.panel-popup.map-popup .map-section { flex: 1; display: flex; flex-direction: column; margin: 0; min-height: 0; }
/* 面板只做定位壳：信息抽屉/移动/合并/别名/额外要求弹窗都是 inset:0 的 absolute，
   锚在滚动容器上会定位到滚动内容原点——列表下滚后弹窗整体跑到可视区外（合并弹窗"消失"的根因）。
   故面板本身不滚动（overflow:hidden），滚动下放给 .map-main / .map-library 各自内部。 */
.panel-popup.map-popup .map-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
/* 地图容器 4:3 比例，匹配 800x600 地图，铺满窗口 */
.panel-popup.map-popup .map-container {
  aspect-ratio: 4 / 3;
  width: 100%;
  flex: none;
  max-height: calc(90vh - 160px);
  margin: 0 auto;
}

/* 平板端 */
@media (max-width: 1024px) {
  .panel-popup.map-popup { max-width: 95vw; max-height: 88vh; width: 98%; }
}

/* 移动端 */
@media (max-width: 600px) {
  .panel-popup.map-popup { max-width: 98vw; max-height: 92vh; width: 99%; }
  .panel-popup.map-popup .map-container { max-height: calc(92vh - 160px); }
}

/* ========== 地图面板（共享样式） ========== */
.map-section { margin: var(--map-section-margin, 8px 0); border: 1px solid var(--map-panel-border, #c8b890); border-radius: var(--map-panel-radius, 10px); background: var(--map-panel-bg, rgba(250,240,220,0.55)); overflow: hidden; }
.map-section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px dashed var(--map-divider, rgba(0,0,0,0.12)); }
.map-section-left { display: flex; align-items: center; gap: 6px; }
.map-section-right { display: flex; gap: 4px; margin-left: auto; }
.map-btn { min-width: 26px; height: 24px; padding: 0 6px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); cursor: pointer; font-size: 13px; line-height: 1; }
.map-btn:hover { background: var(--map-btn-hover, rgba(0,0,0,0.06)); }

.map-panel { padding: 8px 10px; position: relative; }
.map-panel.collapsed { display: none; }
/* 视图模式切换：map 模式显示地图主体，library 模式显示地图库 */
.map-panel[data-view-mode="library"] .map-main { display: none; }
/* 库自滚动（面板不滚）：弹窗遮罩虽挂在 .map-library 里，但其包含块是不滚动的 .map-panel，
   absolute 后代不受中间滚动盒的裁剪与滚动影响 → 弹窗始终覆盖面板可视区 */
.map-panel[data-view-mode="library"] .map-library { display: block; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.map-panel[data-view-mode="map"] .map-library { display: none; }
.map-panel[data-view-mode="map"] .map-main { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
.map-location { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--map-text-soft, #7a6a5a); margin-bottom: 6px; }
/* 面包屑导航栏 */
.map-breadcrumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 4px 0; margin-bottom: 6px; font-size: 12px; color: var(--map-text, #3d2914); border-bottom: 1px dashed var(--map-divider, rgba(0,0,0,0.08)); padding-bottom: 6px; }
.breadcrumb-item { cursor: pointer; padding: 2px 6px; border-radius: 3px; transition: background 0.15s ease; }
.breadcrumb-item:hover { background: var(--map-btn-hover, rgba(0,0,0,0.06)); }
.breadcrumb-item.current { font-weight: 600; color: var(--map-text, #3d2914); cursor: default; }
.breadcrumb-item.current:hover { background: transparent; }
.breadcrumb-sep { color: var(--map-text-soft, #7a6a5a); margin: 0 2px; }
.breadcrumb-actions { margin-left: auto; display: flex; gap: 4px; }
.breadcrumb-actions .map-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.map-container { position: relative; width: 100%; aspect-ratio: 4 / 3; background: var(--map-bg, #faf0dc); border-radius: 6px; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
.map-viewport { width: 100%; height: 100%; transform-origin: 0 0; }
.map-container[data-display-mode="scene"] .map-viewport { display: none; }
.map-scene-viewport { display: none; position: absolute; inset: 0; background: #111; color: var(--map-text-soft, #c4b8aa); align-items: center; justify-content: center; overflow: hidden; }
.map-container[data-display-mode="scene"] .map-scene-viewport { display: flex; }
.map-scene-viewport img { display: block; width: 100%; height: 100%; object-fit: cover; }
.map-scene-empty { padding: 18px; text-align: center; font-size: 12px; }
.map-scene-status { position: absolute; left: 8px; bottom: 8px; padding: 4px 7px; border-radius: 4px; background: rgba(0,0,0,.62); color: #eee; font-size: 11px; }
.map-scene-status.loading { color: #ffd166; }
.map-scene-status.error { color: #ff8f8f; }
/* 注：曾用 will-change: transform 提升缩放性能，但会强制合成层栅格化导致 SVG 放大后马赛克/文字模糊，已移除。矢量内容随 transform 缩放保持清晰。 */
.map-container svg, .map-svg { display: block; width: 100%; height: 100%; }

/* 缩放控制按钮 */
.map-zoom-controls { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 10; }
.map-zoom-btn { width: 30px; height: 30px; min-width: 30px; padding: 0; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }

/* SVG 内元素配色（由 class 驱动，颜色用 CSS 变量便于主题化） */
.map-bg-rect { fill: var(--map-bg, #faf0dc); }
.map-frame-rect { fill: none; stroke: var(--map-stroke, #5c4033); stroke-width: 3; }
.map-title-text { fill: var(--map-title-color, #3d2914); font-size: 22px; font-weight: bold; font-family: serif; }
.map-empty-text { fill: var(--map-stroke-soft, #8b7355); font-size: 18px; }
.map-room { stroke: var(--map-stroke, #5c4033); stroke-width: 2; }
.map-room-room { fill: var(--map-room-fill, none); }
.map-room-corridor { fill: var(--map-corridor-fill, rgba(0,0,0,0.04)); }
.map-room-landmark { fill: none; stroke-dasharray: 8 4; }
.map-room-label { fill: var(--map-room-label-color, #5c4033); font-size: 12px; pointer-events: none; }
.map-door-line { stroke: var(--map-bg, #faf0dc); stroke-width: 5; }

/* 角色标记（translate 在 SVG transform 属性上，CSS hover 不能用 transform 否则覆盖 translate） */
.character-marker { cursor: pointer; }
.character-marker-circle { transition: r 0.15s ease, stroke-width 0.15s ease; }
.character-marker:hover .character-marker-circle { r: 14; stroke-width: 3.5; }
.character-marker-text { font-size: 11px; font-weight: bold; pointer-events: none; }
.character-marker-name { font-size: 10px; pointer-events: none; paint-order: stroke; fill: var(--map-marker-name-fill, var(--map-text, #3d2914)); stroke: var(--map-marker-name-stroke, rgba(255,255,255,0.8)); stroke-width: 3px; }
.character-protagonist .character-marker-circle { fill: var(--marker-protagonist-fill, rgba(255,215,0,0.25)); stroke: var(--marker-protagonist, #d4a017); }
.character-protagonist .character-marker-text { fill: var(--marker-protagonist-text, #5c4033); }
.character-ally .character-marker-circle { fill: var(--marker-ally-fill, rgba(46,125,50,0.2)); stroke: var(--marker-ally, #2e7d32); }
.character-ally .character-marker-text { fill: var(--marker-ally, #2e7d32); }
.character-npc .character-marker-circle { fill: var(--marker-npc-fill, rgba(30,58,95,0.18)); stroke: var(--marker-npc, #1e3a5f); }
.character-npc .character-marker-text { fill: var(--marker-npc, #1e3a5f); }
.character-enemy .character-marker-circle { fill: var(--marker-enemy-fill, rgba(198,40,40,0.2)); stroke: var(--marker-enemy, #c62828); }
.character-enemy .character-marker-text { fill: var(--marker-enemy, #c62828); }
.character-item .character-marker-circle { fill: var(--marker-item-fill, rgba(120,120,120,0.2)); stroke: var(--marker-item, #888); }

/* 出口热点（前端依据 JSON exits 叠加在地图边缘，可点击导航到目标节点）。配色复用既有 --map-* / --marker-* 主题变量，与大地图 marker 同源，5 主题 + 深色模式自动随主题（map 变量为主题级固定值，不单独深色覆盖） */
.map-exit-marker { cursor: pointer; }
.map-exit-circle { fill: var(--marker-protagonist, #d4a017); fill-opacity: 0.85; stroke: var(--map-bg, #faf0dc); stroke-width: 2.5; transition: fill-opacity 0.15s ease, stroke-width 0.15s ease; }
.map-exit-marker:hover .map-exit-circle { fill-opacity: 1; stroke-width: 3.5; }
.map-exit-icon { font-size: 18px; font-weight: bold; fill: var(--map-bg, #faf0dc); text-anchor: middle; pointer-events: none; }
.map-exit-label { font-size: 11px; font-weight: 600; fill: var(--map-text, #3d2914); text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--map-exit-label-stroke, rgba(255,255,255,0.8)); stroke-width: 2.5px; stroke-linejoin: round; }

/* 图例 */

/* 状态指示 */
.map-status { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11px; color: var(--map-text-soft, #7a6a5a); }
.map-status .status-indicator { width: 8px; height: 8px; border-radius: 50%; background: var(--map-status-ready, #2e7d32); display: inline-block; }
.map-status .status-indicator.loading { background: var(--map-status-loading, #d4a017); animation: map-status-pulse 1s infinite; }
.map-status .status-indicator.error { background: var(--map-status-error, #c62828); }
/* 深色：minimal 深色地图底 (#1a1a1a) 上 #2e7d32/#d4a017/#b07800 约 2.5:1，提亮状态色 */
.panel-overlay.dark,body.dark-mode{--map-status-ready:#66bb6a;--map-status-loading:#ffb74d;--map-status-pending:#ffb74d;--map-status-error:#ef5350;--map-status-ready-bg:rgba(102,187,106,0.2);--map-status-pending-bg:rgba(255,183,77,0.2)}
/* 深色：非 bridge 地图弹窗整体切暗色地图变量——复用 minimal 的暗色地图配色（minimal 自身本就是暗色盘，值为恒等覆盖）。
   挂 .map-popup 层就近覆盖各主题 :root 亮色值与 ios 深色块的部分变量；:not 排除 bridge（其 --map-* 本就是暗青盘，且不受深色切换影响） */
.panel-overlay.dark .map-popup:not(.bridge-module-navigation),body.dark-mode .map-popup{--map-bg:#1a1a1a;--map-stroke:#aaa;--map-stroke-soft:#b8b8b8;--map-title-color:#f0f0f0;--map-text:#f0f0f0;--map-text-soft:#c0c0c0;--map-panel-border:#666;--map-panel-bg:rgba(30,30,30,.6);--map-btn-bg:rgba(255,255,255,.08);--map-btn-hover:rgba(255,255,255,.14);--map-input-bg:rgba(255,255,255,.08);--map-divider:rgba(255,255,255,.22);--map-room-fill:none;--map-room-label-color:#f0f0f0;--map-marker-name-fill:#f0f0f0;--map-marker-name-stroke:#1a1a1a;--map-exit-label-stroke:#1a1a1a;--marker-protagonist:#f0c040;--marker-protagonist-text:#1a1a1a;--marker-ally:#4aa;--marker-npc:#69a;--marker-enemy:#e55}
/* 深色：⋯更多二级菜单挂在 .panel-overlay 直下（不在 .map-popup 内），上面的弹窗级翻转够不到它；
   ios 深色块又把 --map-panel-bg 翻暗而 --map-text 仍是 :root 深字色 → 暗底暗字（菜单漆黑）。
   故对菜单元素自身翻所需的最小变量集（元素自带变量恒胜祖先继承，也压过 ios 深色块） */
.panel-overlay.dark .map-more-menu,body.dark-mode .map-more-menu{--map-panel-bg:rgba(30,30,30,.6);--map-panel-border:#666;--map-text:#f0f0f0;--map-text-soft:#c0c0c0;--map-btn-hover:rgba(255,255,255,.14);--map-divider:rgba(255,255,255,.22);--marker-ally:#4aa}
/* bridge 风格菜单保住暗青盘（值同 MAP_THEME_VARS.bridge，须排在深色翻转之后；选择器带 .panel-overlay 保特异性压平规则） */
.panel-overlay .map-more-menu.bridge-module-menu{--map-panel-bg:rgba(21,43,50,.84);--map-panel-border:#23758a;--map-text:#d5f7ff;--map-text-soft:#8bb8c1;--marker-ally:#47bfcf}
@keyframes map-status-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ========== 地点信息右侧抽屉 ========== */
.map-info-drawer {
  position: absolute; right: 0; top: 0; bottom: 0; z-index: 20;
  width: 45%; min-width: 180px; max-width: 320px;
  background: var(--map-bg, #faf0dc);
  border-left: 1px solid var(--map-panel-border, #c8b890);
  box-shadow: -4px 0 12px rgba(0,0,0,0.15);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex; flex-direction: column;
}
.map-info-drawer.open { transform: translateX(0); }
.map-info-drawer-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--map-divider, rgba(0,0,0,0.12));
  flex-shrink: 0;
}
.map-info-drawer-title { font-size: 13px; font-weight: 600; color: var(--map-text, #3d2914); }
.map-info-drawer-close { width: 22px; height: 22px; min-width: 22px; padding: 0; font-size: 12px; line-height: 1; }
.map-info-drawer-body { flex: 1; overflow-y: auto; padding: 8px 10px; }
.map-info-section { margin-bottom: 10px; }
.map-info-section:last-child { margin-bottom: 0; }
.map-info-section-title { font-size: 11px; font-weight: 600; color: var(--map-text-soft, #7a6a5a); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.map-info-summary, .map-info-items, .map-info-directions { font-size: var(--ub-ui-font-12,12px); line-height: 1.5; color: var(--map-text, #3d2914); word-break: break-word; }
.map-info-log { font-size: var(--ub-ui-font-11,11px); line-height: 1.5; color: var(--map-text-soft, #7a6a5a); }
.map-info-log-item { padding: 3px 0; border-bottom: 1px dotted var(--map-divider, rgba(0,0,0,0.08)); }
.map-info-log-item:last-child { border-bottom: none; }
.map-info-log-time { font-size: 10px; opacity: 0.7; margin-right: 2px; }

/* 地图库编辑面板 */
.map-library { margin-top: 8px; border-top: 1px dashed var(--map-divider, rgba(0,0,0,0.12)); padding-top: 8px; }
.map-library-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.map-library-title { font-size: 13px; font-weight: 600; color: var(--map-text, #3d2914); }
.map-library-list { max-height: 240px; overflow-y: auto; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 6px; background: var(--map-input-bg, rgba(255,255,255,0.3)); }
.map-library-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px calc(var(--depth, 0) * 18px + 8px); border-bottom: 1px solid var(--map-divider, rgba(0,0,0,0.08)); cursor: pointer; font-size: var(--ub-ui-font-12,12px); color: var(--map-text, #3d2914); }
.map-library-item:last-child { border-bottom: none; }
.map-library-item:hover { background: var(--map-btn-hover, rgba(0,0,0,0.06)); }
.map-library-item.active { background: var(--map-btn-hover, rgba(0,0,0,0.1)); font-weight: 600; }
.map-library-item.hidden { display: none; }
.map-lib-toggle { width: 16px; height: 16px; min-width: 16px; padding: 0; border: none; background: transparent; color: var(--map-text-soft, #7a6a5a); cursor: pointer; font-size: 10px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.map-lib-toggle.leaf { visibility: hidden; }
.map-library-item.collapsed > .map-lib-toggle::before { content: '▶'; }
.map-library-item:not(.collapsed) > .map-lib-toggle::before { content: '▼'; }
.map-library-item .map-lib-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map-library-item .map-lib-status { font-size: 10px; padding: 1px 4px; border-radius: 3px; white-space: nowrap; }
.map-library-item .map-lib-status.generated { background: var(--map-status-ready-bg, rgba(46,125,50,0.15)); color: var(--map-status-ready,#2e7d32); }
.map-library-item .map-lib-status.pending { background: var(--map-status-pending-bg, rgba(212,160,23,0.15)); color: var(--map-status-loading,#d4a017); }
.map-library-item .map-lib-status.text-only { background: rgba(64,120,160,0.15); color: var(--map-status-text-only,#2f6f8f); }
.map-library-item .map-lib-del { width: 24px; height: 24px; min-width: 24px; padding: 0; font-size: 12px; line-height: 1; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); cursor: pointer; }
.map-library-item .map-lib-del:hover { background: rgba(198,40,40,0.15); color: #c62828; }
.map-library-item .map-lib-large,.map-library-item .map-lib-scene{ width: 26px; height: 24px; min-width: 26px; padding: 0; font-size: 11px; line-height: 1; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); cursor: pointer; }
.map-library-item .map-lib-large:hover, .map-library-item .map-lib-scene:hover { background: rgba(33,150,243,0.15); }
.map-library-item .map-lib-scene:disabled { opacity: 0.45; cursor: not-allowed; }
.map-library-item .map-lib-fav,.map-library-item .map-lib-edit,.map-library-item .map-lib-alias{ width: 24px; height: 24px; min-width: 24px; padding: 0; font-size: 11px; line-height: 1; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); cursor: pointer; }
.map-library-item .map-lib-fav.active { background: rgba(255,193,7,0.2); border-color: #ffc107; }
.map-library-item .map-lib-fav.active .ub-ic { fill: currentColor; color: #ffc107; }
.map-library-item .map-lib-fav:hover { background: rgba(255,193,7,0.15); }
.map-library-item .map-lib-edit:hover { background: rgba(33,150,243,0.15); }
.map-library-item .map-lib-alias:hover { background: rgba(0,150,136,0.15); }
.map-library-item .map-lib-more { width: 20px; height: 20px; min-width: 20px; padding: 0; font-size: 13px; line-height: 1; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); cursor: pointer; }
.map-library-item .map-lib-more:hover { background: var(--map-btn-hover, rgba(0,0,0,0.12)); }
.map-library-item .map-lib-more.has-active { border-color: var(--marker-protagonist, #d4a017); }
.map-final-marker { font-size: 11px; line-height: 1; opacity: 0.9; margin-left: 2px; }
/* F23 触控热区：地图库行内按钮群（16-24px）触屏放大；行内成簇不做透明桥防抢行点击 */
@media (hover:none) and (pointer:coarse){
  .map-lib-toggle{width:26px;height:26px;min-width:26px;font-size:13px}
  .map-library-item{padding-top:6px;padding-bottom:6px}
  .map-library-item .map-lib-del,
  .map-library-item .map-lib-fav,.map-library-item .map-lib-edit,.map-library-item .map-lib-alias,
  .map-library-item .map-lib-large,.map-library-item .map-lib-scene{width:30px;height:30px;min-width:30px;font-size:13px}
  .map-library-item .map-lib-more{width:28px;height:28px;min-width:28px;font-size:15px}
  .map-alias-remove{width:28px;height:28px;min-width:28px;font-size:13px}
}

/* ===== ⋯ 更多 二级菜单（点击 ⋯ 时按需创建的单个共享浮层，关闭即移除） =====
   box-sizing 必须 border-box：全项目没有全局 *{box-sizing:border-box}，菜单靠 padding 撑高，
   限高（placeAnchoredMenu 的 maxHeight）若按 content-box 算会漏掉 padding 8px + border 2px ⇒ 末项仍被切 10px */
.map-more-menu {
  position: absolute; z-index: 30;
  min-width: 168px; padding: 4px 0; box-sizing: border-box;
  background: var(--map-panel-bg, rgba(250,240,220,0.97));
  border: 1px solid var(--map-panel-border, #c8b890);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.22);
  font-size: 12px; color: var(--map-text, #3d2914);
}
.map-more-menu-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; white-space: nowrap; }
.map-more-menu-item:hover { background: var(--map-btn-hover, rgba(0,0,0,0.08)); }
.map-more-menu-item .mi-icon { width: 16px; text-align: center; font-size: 12px; }
.map-more-menu-item .mi-check { margin-left: auto; color: var(--marker-ally, #2e7d32); font-weight: 700; }
.map-more-menu-sep { height: 1px; margin: 4px 8px; background: var(--map-divider, rgba(0,0,0,0.1)); }
.map-more-menu-item.disabled { color: var(--map-text-soft, #7a6a5a); cursor: not-allowed; opacity: 0.6; }
.map-library-preview { margin-top: 6px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 6px; background: var(--map-bg, #faf0dc); aspect-ratio: 4 / 3; overflow: hidden; position: relative; display: flex; flex-direction: column; touch-action: none; user-select: none; -webkit-user-select: none; }
.map-library-preview-viewport { width: 100%; height: 100%; transform-origin: 0 0; }
.map-library-preview svg { display: block; width: 100%; height: 100%; }
/* 库预览：场景图/SVG 切换（data-lib-mode 驱动，与主视图同构） */
.map-library-lib-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex: none; }
.map-lib-display-toggle { min-width: 26px; height: 24px; padding: 0 8px; font-size: 12px; }
.map-library-preview[data-lib-mode="svg"] .map-library-preview-scene { display: none; }
.map-library-preview[data-lib-mode="scene"] .map-library-preview-viewport { display: none; }
.map-library-preview-scene { display: none; width: 100%; height: 100%; background: #111; align-items: center; justify-content: center; overflow: hidden; position: relative; flex: 1; min-height: 0; }
.map-library-preview[data-lib-mode="scene"] .map-library-preview-scene { display: flex; }
.map-library-preview-scene img { display: block; width: 100%; height: 100%; object-fit: cover; }
.map-lib-zoom-controls { position: absolute; top: 6px; right: 6px; display: flex; flex-direction: column; gap: 3px; z-index: 5; }
.map-library-empty { padding: 12px; text-align: center; font-size: 11px; color: var(--map-text-soft, #7a6a5a); }
/* 编辑描述表单 */
.map-edit-desc-form { padding: 8px; display: flex; flex-direction: column; gap: 8px; height: 100%; overflow-y: auto; box-sizing: border-box; }
.map-edit-desc-head { font-size: 12px; font-weight: 600; color: var(--map-text, #3d2914); padding-bottom: 4px; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,0.08)); }
.map-edit-desc-field { display: flex; flex-direction: column; gap: 2px; }
.map-edit-desc-field label { font-size: 10px; color: var(--map-text-soft, #7a6a5a); }
.map-edit-desc-field textarea { width: 100%; padding: 4px 6px; font-size: var(--ub-ui-font-11,11px); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-input-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); resize: vertical; font-family: inherit; box-sizing: border-box; }
.map-edit-desc-field textarea:focus { outline: none; border-color: var(--map-stroke-soft, #8b7355); }
.map-edit-desc-actions { display: flex; gap: 6px; justify-content: flex-end; padding-top: 4px; }
.map-edit-desc-actions .map-btn { padding: 4px 10px; font-size: 11px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); cursor: pointer; }
.map-edit-desc-actions .map-edit-save { background: rgba(46,125,50,0.15); border-color: var(--map-status-ready,#2e7d32); color: var(--map-status-ready,#2e7d32); }
.map-edit-desc-actions .map-edit-save:hover { background: rgba(46,125,50,0.25); }
.map-edit-desc-actions .map-edit-cancel:hover { background: rgba(198,40,40,0.15); }
.map-edit-log-list { display: flex; flex-direction: column; gap: 4px; }
.map-edit-log-row { display: flex; gap: 4px; align-items: flex-start; }
.map-edit-log-row input.map-edit-log-time { width: 70px; flex: 0 0 70px; padding: 3px 4px; font-size: var(--ub-ui-font-10,10px); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-input-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); box-sizing: border-box; }
.map-edit-log-row textarea.map-edit-log-note { flex: 1; padding: 3px 6px; font-size: var(--ub-ui-font-11,11px); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-input-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); resize: vertical; font-family: inherit; box-sizing: border-box; min-height: 28px; }
.map-edit-log-row textarea.map-edit-log-note:focus, .map-edit-log-row input.map-edit-log-time:focus { outline: none; border-color: var(--map-stroke-soft, #8b7355); }
.map-edit-log-row .map-edit-log-del { flex: 0 0 auto; padding: 3px 6px; font-size: 11px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); cursor: pointer; color: var(--map-text-soft, #7a6a5a); }
.map-edit-log-row .map-edit-log-del:hover { background: rgba(198,40,40,0.15); color: #c62828; }
.map-edit-log-add { align-self: flex-start; padding: 3px 10px; font-size: 11px; border: 1px dashed var(--map-panel-border, #c8b890); border-radius: 4px; background: transparent; cursor: pointer; color: var(--map-text-soft, #7a6a5a); }
.map-edit-log-add:hover { background: var(--map-btn-bg, rgba(255,255,255,0.5)); }
.map-edit-log-add:disabled { opacity: .45; cursor: not-allowed; }

/* ========== 移动节点目标选择 Modal ========== */
.map-move-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: var(--map-panel-radius, 10px);
}
.map-move-modal {
  background: var(--map-panel-bg, rgba(250,240,220,0.95));
  border: 1px solid var(--map-panel-border, #c8b890);
  border-radius: 8px;
  padding: 16px;
  min-width: 280px;
  max-width: 400px;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}
.map-move-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--map-text, #3d2914);
  margin: 0;
}
.map-move-modal-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: var(--ub-ui-font-12,12px);
  color: var(--map-text, #3d2914);
  cursor: pointer;
}
.map-move-modal-option.disabled {
  color: var(--map-text-soft, #9a8a7a);
  cursor: not-allowed;
  font-style: italic;
}
.map-move-modal-option input[type="radio"] {
  margin: 0;
  accent-color: var(--map-accent, #c8a45a);
}
.map-move-modal-tree {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--map-panel-border, #c8b890);
  border-radius: 6px;
  background: var(--map-input-bg, rgba(255,255,255,0.3));
  padding: 4px 0;
}
.map-move-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.map-move-modal-actions .map-btn {
  min-width: 60px;
  height: 28px;
  font-size: 13px;
}
.map-move-modal-actions .map-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ========== Map node merge modal ========== */
.map-merge-modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 18; border-radius: var(--map-panel-radius, 10px); padding: 14px; box-sizing: border-box; }
.map-merge-modal { width: min(520px, 100%); max-height: 100%; overflow-y: auto; background: var(--map-panel-bg, rgba(250,240,220,0.97)); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; color: var(--map-text, #3d2914); box-shadow: 0 4px 20px rgba(0,0,0,0.25); }
.map-merge-title { font-size: 14px; font-weight: 700; }
.map-merge-hint, .map-merge-section-label { font-size: var(--ub-ui-font-11, 11px); color: var(--map-text-soft, #7a6a5a); line-height: 1.5; }
.map-merge-candidates { max-height: 190px; overflow-y: auto; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 6px; background: var(--map-input-bg, rgba(255,255,255,0.3)); padding: 4px; }
.map-merge-candidate { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 2px 6px; padding: 6px 7px; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,0.08)); cursor: pointer; }
.map-merge-candidate:last-child { border-bottom: 0; }
.map-merge-candidate input { grid-row: span 2; margin: 3px 0 0; accent-color: var(--map-accent, #c8a45a); }
.map-merge-candidate-name { font-size: var(--ub-ui-font-12, 12px); font-weight: 600; }
.map-merge-candidate-path, .map-merge-candidate-reason { font-size: 10px; color: var(--map-text-soft, #7a6a5a); overflow-wrap: anywhere; }
.map-merge-candidate-reason { color: var(--map-status-pending, #b07800); }
.map-merge-candidate.disabled { opacity: 0.55; cursor: not-allowed; }
.map-merge-conflict { min-height: 20px; padding: 5px 7px; border-radius: 4px; font-size: var(--ub-ui-font-11, 11px); color: var(--map-status-pending, #b07800); background: var(--map-status-pending-bg, rgba(212,160,23,0.12)); }
.map-merge-choices { display: grid; grid-template-columns: 1fr; gap: 7px; }
.map-merge-choice-group { min-width: 0; margin: 0; padding: 7px 9px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; }
.map-merge-choice-group:disabled { opacity: 0.58; }
.map-merge-choice-group legend { padding: 0 4px; font-size: 10px; color: var(--map-text-soft, #7a6a5a); }
.map-merge-choice-group label { display: flex; align-items: center; gap: 5px; min-height: 24px; font-size: var(--ub-ui-font-11, 11px); }
.map-merge-choice-group input { accent-color: var(--map-accent, #c8a45a); }
.map-merge-resource-status { margin-left: auto; color: var(--map-text-soft, #7a6a5a); font-size: 10px; }
.map-merge-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; border-top: 1px dashed var(--map-divider, rgba(0,0,0,0.1)); }
.map-merge-actions .map-btn { min-width: 72px; height: 28px; font-size: 12px; }
.map-merge-submit { background: var(--map-accent-bg, rgba(200,164,90,0.18)); border-color: var(--map-accent, #c8a45a); color: var(--map-text, #3d2914); }
.map-merge-actions .map-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ========== 长按额外提示词 Modal（强制刷新 / 地图库生成 长按触发） ========== */
.map-extra-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  border-radius: var(--map-panel-radius, 10px);
}
.map-extra-modal {
  background: var(--map-panel-bg, rgba(250,240,220,0.95));
  border: 1px solid var(--map-panel-border, #c8b890);
  border-radius: 8px;
  padding: 14px;
  min-width: 280px;
  max-width: 440px;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}
.map-extra-modal .map-extra-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--map-text, #3d2914);
  margin: 0;
}
.map-extra-modal .map-extra-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.map-extra-modal .map-extra-field label {
  font-size: 10px;
  color: var(--map-text-soft, #7a6a5a);
}
.map-extra-modal .map-extra-field textarea {
  width: 100%;
  padding: 6px 8px;
  font-size: var(--ub-ui-font-12,12px);
  min-height: 110px;
  line-height: 1.6;
  border: 1px solid var(--map-panel-border, #c8b890);
  border-radius: 4px;
  background: var(--map-input-bg, rgba(255,255,255,0.5));
  color: var(--map-text, #3d2914);
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}
.map-extra-modal .map-extra-field textarea:focus {
  outline: none;
  border-color: var(--map-stroke-soft, #8b7355);
}
.map-extra-modal .map-extra-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.map-extra-modal .map-extra-actions .map-btn {
  min-width: 64px;
  height: 30px;
  font-size: 12px;
  padding: 0 12px;
  border: 1px solid var(--map-panel-border, #c8b890);
  border-radius: 4px;
  background: var(--map-btn-bg, rgba(255,255,255,0.5));
  color: var(--map-text, #3d2914);
  cursor: pointer;
}
.map-extra-modal .map-extra-actions .map-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.map-extra-modal .map-extra-actions .map-extra-ok {
  background: rgba(46,125,50,0.15);
  border-color: var(--map-status-ready,#2e7d32);
  color: var(--map-status-ready,#2e7d32);
}

/* ========== 地点别名管理 Modal（仿 map-move-modal，--map-* 驱动 5 主题 + minimal 深色） ========== */
.map-alias-modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 15; border-radius: var(--map-panel-radius, 10px); padding: 16px; box-sizing: border-box; }
.map-alias-modal { background: var(--map-panel-bg, rgba(250,240,220,0.97)); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 8px; padding: 14px 16px; min-width: 300px; max-width: 380px; width: 100%; max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); }
.map-alias-title { font-size: 14px; font-weight: 600; color: var(--map-text, #3d2914); margin: 0; display: flex; align-items: center; gap: 6px; }
.map-alias-canonical { font-size: var(--ub-ui-font-11,11px); color: var(--map-text-soft, #7a6a5a); padding: 6px 8px; background: var(--map-btn-hover, rgba(0,0,0,0.05)); border-radius: 4px; }
.map-alias-canonical b { color: var(--map-text, #3d2914); font-weight: 600; }
.map-alias-section-label { font-size: 10px; color: var(--map-text-soft, #7a6a5a); text-transform: uppercase; letter-spacing: 0.5px; }
.map-alias-list { max-height: 132px; overflow-y: auto; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 6px; background: var(--map-input-bg, rgba(255,255,255,0.3)); }
.map-alias-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,0.08)); font-size: var(--ub-ui-font-12,12px); color: var(--map-text, #3d2914); }
.map-alias-item:last-child { border-bottom: none; }
.map-alias-text { flex: 1; word-break: break-all; }
.map-alias-remove { width: 20px; height: 20px; min-width: 20px; padding: 0; font-size: 11px; line-height: 1; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-btn-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); cursor: pointer; }
.map-alias-remove:hover { background: rgba(198,40,40,0.15); color: #c62828; border-color: #c62828; }
.map-alias-empty { padding: 10px; text-align: center; font-size: 11px; color: var(--map-text-soft, #7a6a5a); }
.map-alias-add { display: flex; gap: 6px; }
.map-alias-input { flex: 1; height: 28px; padding: 0 8px; font-size: var(--ub-ui-font-12,12px); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 4px; background: var(--map-input-bg, rgba(255,255,255,0.5)); color: var(--map-text, #3d2914); box-sizing: border-box; }
.map-alias-input:focus { outline: none; border-color: var(--map-stroke-soft, #8b7355); }
.map-alias-add-btn { min-width: 56px; height: 28px; font-size: 12px; background: rgba(46,125,50,0.15); border-color: var(--map-status-ready,#2e7d32); color: var(--map-status-ready,#2e7d32); }
.map-alias-add-btn:hover { background: rgba(46,125,50,0.25); }
.map-alias-hint { font-size: 10px; color: var(--map-text-soft, #7a6a5a); line-height: 1.6; }
.map-alias-msg { font-size: var(--ub-ui-font-11,11px); padding: 5px 8px; border-radius: 4px; line-height: 1.5; }
.map-alias-msg.error { background: rgba(198,40,40,0.12); color: #c62828; border: 1px solid rgba(198,40,40,0.3); }
.map-alias-msg.warn { background: rgba(212,160,23,0.15); color: var(--map-status-pending,#b07800); border: 1px solid rgba(212,160,23,0.4); }
.map-alias-msg.ok { background: rgba(46,125,50,0.12); color: var(--map-status-ready,#2e7d32); border: 1px solid rgba(46,125,50,0.3); }
.map-alias-conflict { display: flex; gap: 6px; }
.map-alias-conflict .map-btn { flex: 1; height: 26px; font-size: 11px; }
.map-alias-conflict .map-alias-confirm { background: rgba(46,125,50,0.15); border-color: var(--map-status-ready,#2e7d32); color: var(--map-status-ready,#2e7d32); }
.map-alias-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 2px; border-top: 1px dashed var(--map-divider, rgba(0,0,0,0.1)); }
.map-alias-actions .map-btn { min-width: 60px; height: 28px; font-size: 13px; }

/* 深空舰桥：导航阵列 */
.panel-popup.map-popup.bridge-module-navigation{width:min(96%,980px);max-width:980px;max-height:min(88vh,860px);border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);font-family:var(--bridge-font-ui,'Microsoft YaHei','PingFang SC',sans-serif);}
.bridge-module-navigation .panel-popup-head{background:linear-gradient(90deg,var(--bridge-panel-alt,#dde8eb),var(--bridge-panel,#eef3f5));border-bottom:1px solid var(--bridge-line-strong,#23758a);}
.bridge-module-navigation .panel-popup-title{font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:1.5px;}
.bridge-module-navigation .map-section-head,.bridge-module-navigation .map-breadcrumb,.bridge-module-navigation .map-library-head,.bridge-module-navigation .map-info-drawer-head{border-radius:0;background:var(--bridge-panel-inset,#d5e1e5);border-color:var(--bridge-line,#91a5ad);}
.bridge-module-navigation .map-btn{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-panel,#eef3f5);color:var(--bridge-text,#16222c);}
.bridge-module-navigation .map-container{border-radius:0;border-color:var(--bridge-line-strong,#23758a);background-color:var(--bridge-screen,#152b32);background-image:linear-gradient(rgba(142,234,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(142,234,255,.055) 1px,transparent 1px);background-size:24px 24px;}
.bridge-module-navigation .map-svg{filter:saturate(.78) contrast(1.08);}
.bridge-module-navigation .map-status{position:relative;border-radius:0;border-top:1px solid var(--bridge-line,#91a5ad);background:var(--bridge-panel-inset,#d5e1e5);font-family:var(--bridge-font-data,'Consolas',monospace);}
.bridge-module-navigation .map-status:has(.status-indicator.error)::after{content:attr(data-stale-label);margin-left:auto;padding:2px 6px;border:1px solid var(--bridge-warn,#b47a16);color:var(--bridge-warn,#b47a16);font-size:9px;letter-spacing:1px;}
.bridge-module-navigation .map-library{background:var(--bridge-panel,#eef3f5);}
.bridge-module-navigation .map-library-item{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-panel-alt,#dde8eb);}
.bridge-module-navigation .map-library-preview{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-screen,#152b32);}
.bridge-module-navigation .map-info-drawer{border-radius:0;border-left:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);}
.bridge-module-navigation .map-info-section{border-radius:0;border-color:var(--bridge-line,#91a5ad);}
.bridge-module-navigation .map-move-modal,.bridge-module-navigation .map-extra-modal,.bridge-module-navigation .map-merge-modal{border-radius:0;border-color:var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);}
.bridge-module-navigation .map-merge-modal-overlay{border-radius:0;}
.bridge-module-navigation .map-merge-candidates,.bridge-module-navigation .map-merge-choice-group{border-color:var(--bridge-line,#91a5ad);background:var(--bridge-panel-alt,#dde8eb);}
.bridge-module-navigation .map-merge-title,.bridge-module-navigation .map-merge-choice-group label,.bridge-module-navigation .map-merge-candidate-name{color:var(--bridge-text,#16222c);}
.bridge-module-navigation .map-merge-hint,.bridge-module-navigation .map-merge-section-label,.bridge-module-navigation .map-merge-candidate-path,.bridge-module-navigation .map-merge-resource-status{color:var(--bridge-text-muted,#52636b);}
.bridge-module-navigation .map-more-menu,.bridge-module-navigation .map-alias-modal{border-radius:0;border-color:var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);color:var(--bridge-text,#16222c);}
/* bridge 浅色模式：光板上的地图文字须用深色 --bridge-text，不能用给深色画布调的 --map-text。
   仅覆盖面板/导航/图库/抽屉/编辑器的文字与输入背景；SVG 画布(深色 --bridge-screen)内文字保持 --map-text。 */
.bridge-module-navigation .map-location,
.bridge-module-navigation .map-breadcrumb,
.bridge-module-navigation .breadcrumb-item,
.bridge-module-navigation .breadcrumb-item.current,
.bridge-module-navigation .map-library-title,
.bridge-module-navigation .map-library-item,
.bridge-module-navigation .map-info-drawer-title,
.bridge-module-navigation .map-info-summary,
.bridge-module-navigation .map-info-items,
.bridge-module-navigation .map-info-directions,
.bridge-module-navigation .map-edit-desc-head,
.bridge-module-navigation .map-alias-title,
.bridge-module-navigation .map-alias-canonical b,
.bridge-module-navigation .map-alias-item,
.bridge-module-navigation .map-more-menu-item,
.bridge-module-navigation .map-lib-del,
.bridge-module-navigation .map-lib-fav,
.bridge-module-navigation .map-lib-edit,
.bridge-module-navigation .map-lib-alias,
.bridge-module-navigation .map-lib-large,
.bridge-module-navigation .map-lib-scene,
.bridge-module-navigation .map-lib-more{color:var(--bridge-text,#16222c);}
.bridge-module-navigation .breadcrumb-sep,
.bridge-module-navigation .map-info-section-title,
.bridge-module-navigation .map-info-log,
.bridge-module-navigation .map-status,
.bridge-module-navigation .map-lib-toggle,
.bridge-module-navigation .map-edit-desc-field label,
.bridge-module-navigation .map-edit-log-row .map-edit-log-del,
.bridge-module-navigation .map-edit-log-add,
.bridge-module-navigation .map-alias-canonical,
.bridge-module-navigation .map-alias-section-label,
.bridge-module-navigation .map-alias-hint,
.bridge-module-navigation .map-alias-remove,
.bridge-module-navigation .map-alias-conflict .map-alias-remove,
.bridge-module-navigation .map-more-menu-item.disabled{color:var(--bridge-muted,#55747a);}
.bridge-module-navigation{--map-input-bg:var(--bridge-panel-2,#dbe8e9);}
.bridge-module-navigation .map-library-list,
.bridge-module-navigation .map-alias-list{background:var(--bridge-panel-alt,#edf5f5);}
.bridge-module-navigation .map-edit-desc-field textarea,
.bridge-module-navigation .map-edit-log-row input,
.bridge-module-navigation .map-edit-log-row textarea,
.bridge-module-navigation .map-alias-input{background:var(--bridge-panel-2,#dbe8e9);}
@media(max-width:599px){.panel-popup.map-popup.bridge-module-navigation{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0}.bridge-module-navigation .map-info-drawer{width:100%}}
/* 手机端地点信息抽屉全宽（推广 bridge 行为到全部主题）：45% 半屏宽会遮挡地图与缩放钮 */
@media(max-width:599px){.map-info-drawer{width:100%;max-width:none}}
/* 手机端抽屉固定为全视口信息页（lib-full 预览同为 fixed：脱流让面板塌矮，absolute 锚面板只剩一小截；
   关闭态 translateX(100%) 整体在屏外不拦点击）。打开态 z-31 抬到全屏预览 z-30 之上——否则 ℹ 打开被压在
   全屏层下（症状"信息显示在库界面里"）。PC 抽屉半屏锚面板不动，避免盖住后续打开的弹窗 */
@media(max-width:599px){.map-info-drawer{position:fixed;inset:0}.map-info-drawer.open{z-index:31}}
/* 手机端地图库：列表放开高度随弹窗体滚动，点行预览改全屏覆盖层（.lib-full，由 JS 按 ≤599px 加类）打开，× 关闭 */
@media(max-width:599px){.map-library-list{max-height:none}}
/* 手机端行内只留 折叠/收藏/名称/状态/⋯：重命名/生成/场景图/删除由 openNodeMoreMenu 按 ≤599px 收进二级菜单（7 钮挤一行会把节点名挤没） */
@media(max-width:599px){.map-library-item .map-lib-edit,.map-library-item .map-lib-large,.map-library-item .map-lib-scene,.map-library-item .map-lib-del{display:none}}
.map-library-preview.lib-full{position:fixed;inset:0;z-index:30;aspect-ratio:auto;}
/* 全屏预览时 ×(top:8) 与缩放列(top:6) 同角重叠：缩放列下移让出关闭钮 */
.map-library-preview.lib-full .map-lib-zoom-controls{top:48px;}
.map-library-preview .map-lib-full-close{display:flex;align-items:center;justify-content:center;position:absolute;top:8px;right:8px;z-index:6;width:32px;height:32px;min-width:32px;min-height:32px;padding:0;}

/* ========== AI 地图整理（--map-* 驱动 5 主题 + minimal 深色） ========== */
/* 平时地图弹窗按内容自适应；整理面板需要完整高度，打开期间让整个弹窗定高（关闭即恢复）。 */
.panel-popup.map-popup.map-organize-open { height: min(90vh, 860px); max-height: min(90vh, 860px); }
@media(max-width:600px){
  .panel-popup.map-popup.map-organize-open { height: 92vh; height: 92dvh; max-height: 92vh; max-height: 92dvh; }
}
.map-library-head { flex-wrap: wrap; }
.map-lib-ai { margin-left: auto; height: 24px; padding: 0 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; box-sizing: border-box; }
.map-lib-ai .map-lib-ai-ico { display: inline-flex; align-items: center; }
.map-lib-ai .ub-ic { width: 14px; height: 14px; }
.map-lib-ai:disabled { opacity: .45; cursor: not-allowed; }
.map-organize-overlay { position: absolute; inset: 0; z-index: 40; background: rgba(20,16,10,.46); display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; border-radius: var(--map-panel-radius, 10px); }
.map-organize-overlay.dark { background: rgba(0,0,0,.6); }
.map-organize-modal { width: 96%; max-width: 780px; height: 100%; max-height: 100%; background: var(--map-panel-bg, rgba(250,240,220,.98)); border: 1px solid var(--map-panel-border, #c8b890); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.25); display: flex; flex-direction: column; min-height: 0; overflow: hidden; color: var(--map-text, #3d2914); box-sizing: border-box; }
.map-organize-head { flex: 0 0 auto; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,.12)); background: var(--map-input-bg, rgba(255,255,255,.28)); }
.map-organize-spark { width: 28px; height: 28px; border-radius: 8px; flex: none; display: flex; align-items: center; justify-content: center; background: rgba(46,125,50,.12); color: var(--map-status-ready, #2e7d32); }
.map-organize-spark .ub-ic { width: 16px; height: 16px; }
.map-organize-head-text { flex: 1 1 auto; min-width: 0; }
.map-organize-title { font-size: 14px; font-weight: 700; line-height: 1.35; }
.map-organize-sub { font-size: 11px; line-height: 1.45; color: var(--map-text-soft, #7a6a5a); margin-top: 2px; }
.map-organize-close { width: 30px; height: 30px; min-width: 30px; flex: none; padding: 0; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; background: var(--map-btn-bg, rgba(255,255,255,.5)); color: var(--map-text, #3d2914); cursor: pointer; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.map-organize-close .ub-ic { width: 15px; height: 15px; }
.map-organize-close:disabled { opacity: .4; cursor: not-allowed; }
.map-organize-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.map-organize-state { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 24px 20px; text-align: center; overflow-y: auto; }
.map-organize-state h3 { margin: 0; font-size: 14px; color: var(--map-text, #3d2914); }
.map-organize-state p { margin: 0; max-width: 500px; font-size: 12px; line-height: 1.6; color: var(--map-text-soft, #7a6a5a); }
.map-organize-state-sub { font-size: 10.5px; color: var(--map-text-soft, #7a6a5a); line-height: 1.55; }
.map-organize-state-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--map-input-bg, rgba(255,255,255,.35)); color: var(--map-text-soft, #7a6a5a); }
.map-organize-state-icon .ub-ic { width: 22px; height: 22px; }
.map-organize-state-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 4px; }
.map-organize-spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--map-divider, rgba(0,0,0,.12)); border-top-color: var(--map-stroke-soft, #8b7355); animation: mapOrganizeSpin .8s linear infinite; }
@keyframes mapOrganizeSpin { to { transform: rotate(360deg); } }
.map-organize-summary { flex: 0 0 auto; padding: 9px 12px 8px; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,.1)); }
.map-organize-judgement { font-size: 11.5px; line-height: 1.55; color: var(--map-text, #3d2914); }
.map-organize-judgement b { font-weight: 700; }
.map-organize-counts { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.map-organize-count { font-size: 10px; line-height: 1.4; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--map-divider, rgba(0,0,0,.12)); background: var(--map-input-bg, rgba(255,255,255,.28)); color: var(--map-text-soft, #7a6a5a); white-space: nowrap; }
.map-organize-count b { color: var(--map-text, #3d2914); }
.map-organize-count.rename { border-color: rgba(47,111,143,.35); color: #22596f; }
.map-organize-count.move { border-color: rgba(31,107,115,.35); color: #1f6b73; }
.map-organize-count.merge { border-color: rgba(109,79,161,.35); color: #543b86; }
.map-organize-count.delete { border-color: rgba(192,57,43,.35); color: #8e2c22; }
.map-organize-count.bad { border-color: rgba(178,106,0,.4); color: #7a4a00; }
.map-organize-summary-note { margin-top: 5px; font-size: 10.5px; line-height: 1.5; color: var(--map-text-soft, #7a6a5a); }
.map-organize-toolbar { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 12px; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,.1)); }
.map-organize-hint { flex: 1 1 180px; font-size: 10.5px; line-height: 1.45; color: var(--map-text-soft, #7a6a5a); }
.map-organize-tool { min-width: 0; height: 24px; padding: 0 9px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; background: var(--map-btn-bg, rgba(255,255,255,.5)); color: var(--map-text, #3d2914); font: 12px/1 inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
.map-organize-tool:hover { background: var(--map-btn-hover, rgba(0,0,0,.06)); }
.map-organize-tabs { display: none; flex: 0 0 auto; gap: 4px; padding: 6px 10px 0; border-bottom: 1px solid var(--map-divider, rgba(0,0,0,.1)); }
.map-organize-tabs button { flex: 1; height: 30px; border: 1px solid var(--map-panel-border, #c8b890); border-bottom: 0; border-radius: 7px 7px 0 0; background: var(--map-input-bg, rgba(255,255,255,.28)); color: var(--map-text-soft, #7a6a5a); font: 11.5px/1 inherit; cursor: pointer; }
.map-organize-tabs button.on { background: var(--map-panel-bg, rgba(250,240,220,.98)); color: var(--map-text, #3d2914); font-weight: 700; }
.map-organize-cols { flex: 1 1 auto; min-height: 0; display: flex; gap: 10px; padding: 8px 10px 9px; }
.map-organize-list { flex: 1 1 62%; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; padding-right: 2px; }
.map-organize-preview { flex: 0 0 34%; min-width: 0; overflow-y: auto; border-left: 1px dashed var(--map-divider, rgba(0,0,0,.12)); padding-left: 9px; }
.map-organize-card { display: flex; gap: 8px; padding: 8px 9px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 8px; background: var(--map-input-bg, rgba(255,255,255,.28)); box-sizing: border-box; }
.map-organize-card.on { background: var(--map-btn-hover, rgba(0,0,0,.05)); border-color: var(--map-stroke-soft, #8b7355); }
.map-organize-card.disabled { opacity: .68; }
.map-organize-card.invalid { border-color: rgba(192,57,43,.45); }
.map-organize-check { width: 16px; height: 16px; min-width: 16px; margin: 2px 0 0; flex: none; cursor: pointer; accent-color: var(--map-status-ready, #2e7d32); }
.map-organize-check:disabled { cursor: not-allowed; }
.map-organize-main { flex: 1 1 auto; min-width: 0; }
.map-organize-card-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.map-organize-op { font-size: 9.5px; font-weight: 700; line-height: 1.4; padding: 0 6px; border-radius: 999px; border: 1px solid var(--map-divider, rgba(0,0,0,.12)); white-space: nowrap; }
.map-organize-op.rename { background: rgba(47,111,143,.12); color: #22596f; border-color: rgba(47,111,143,.3); }
.map-organize-op.move { background: rgba(31,107,115,.12); color: #1f6b73; border-color: rgba(31,107,115,.3); }
.map-organize-op.merge { background: rgba(109,79,161,.12); color: #543b86; border-color: rgba(109,79,161,.3); }
.map-organize-op.delete { background: rgba(192,57,43,.12); color: #8e2c22; border-color: rgba(192,57,43,.3); }
.map-organize-title-text { flex: 1 1 160px; min-width: 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.map-organize-title-text .old { text-decoration: line-through; color: var(--map-text-soft, #7a6a5a); }
.map-organize-title-text .new { color: var(--map-status-ready, #2e7d32); font-weight: 700; }
.map-organize-title-text .arrow { color: var(--map-text-soft, #7a6a5a); margin: 0 2px; }
.map-organize-input { font: 12px/1.3 inherit; padding: 2px 6px; min-width: 84px; max-width: 190px; width: 42%; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; background: var(--map-input-bg, rgba(255,255,255,.5)); color: var(--map-text, #3d2914); box-sizing: border-box; }
.map-organize-input:focus { outline: 2px solid var(--map-stroke-soft, #8b7355); outline-offset: 1px; }
.map-organize-input.bad { border-color: #c62828; }
.map-organize-path { font-size: 10px; line-height: 1.45; color: var(--map-text-soft, #7a6a5a); margin-top: 3px; overflow-wrap: anywhere; }
.map-organize-path .to { color: var(--map-status-ready, #2e7d32); }
.map-organize-reason { font-size: 10.5px; line-height: 1.5; color: var(--map-text, #3d2914); margin-top: 4px; }
.map-organize-reason b { color: var(--map-text-soft, #7a6a5a); }
.map-organize-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.map-organize-tag { font-size: 9px; line-height: 1.4; padding: 0 5px; border-radius: 999px; border: 1px solid var(--map-divider, rgba(0,0,0,.12)); background: var(--map-input-bg, rgba(255,255,255,.28)); color: var(--map-text-soft, #7a6a5a); white-space: nowrap; }
.map-organize-tag.map { background: rgba(178,106,0,.12); color: #7a4a00; border-color: rgba(178,106,0,.3); }
.map-organize-tag.scene { background: rgba(47,111,143,.12); color: #22596f; border-color: rgba(47,111,143,.3); }
.map-organize-tag.current { background: rgba(192,57,43,.12); color: #8e2c22; border-color: rgba(192,57,43,.3); }
.map-organize-tag.children { background: var(--map-btn-hover, rgba(0,0,0,.06)); color: var(--map-text-soft, #7a6a5a); }
.map-organize-tag.ok { background: rgba(46,125,50,.12); color: #245c28; border-color: rgba(46,125,50,.3); }
.map-organize-tag.bad { background: rgba(192,57,43,.12); color: #8e2c22; border-color: rgba(192,57,43,.3); }
.map-organize-note { margin-top: 5px; padding: 4px 7px; border-radius: 5px; font-size: 10px; line-height: 1.5; background: var(--map-btn-hover, rgba(0,0,0,.05)); color: var(--map-text-soft, #7a6a5a); }
.map-organize-note.bad { background: rgba(192,57,43,.1); color: #8e2c22; }
.map-organize-note.warn { background: rgba(178,106,0,.1); color: #7a4a00; }
.map-organize-merge-line { display: flex; align-items: stretch; gap: 6px; margin-top: 4px; }
.map-organize-merge-node { flex: 1 1 0; min-width: 0; padding: 5px 7px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 6px; background: var(--map-input-bg, rgba(255,255,255,.28)); font-size: 10.5px; line-height: 1.35; }
.map-organize-merge-node.src { border-color: rgba(192,57,43,.3); }
.map-organize-merge-node.dst { border-color: rgba(46,125,50,.3); }
.map-organize-merge-node .nm { display: block; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map-organize-merge-node .st { display: block; margin-top: 2px; font-size: 9.5px; color: var(--map-text-soft, #7a6a5a); }
.map-organize-merge-arrow { flex: none; display: flex; align-items: center; color: var(--map-text-soft, #7a6a5a); font-size: 13px; }
.map-organize-choice { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 5px; font-size: 10px; color: var(--map-text-soft, #7a6a5a); }
.map-organize-choice label { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border: 1px solid var(--map-divider, rgba(0,0,0,.12)); border-radius: 999px; background: var(--map-input-bg, rgba(255,255,255,.28)); color: var(--map-text, #3d2914); cursor: pointer; }
.map-organize-choice input { margin: 0; accent-color: var(--map-status-ready, #2e7d32); }
.map-organize-impact { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.map-organize-pill { font-size: 9.5px; line-height: 1.4; padding: 0 6px; border-radius: 999px; background: rgba(192,57,43,.1); border: 1px solid rgba(192,57,43,.28); color: #8e2c22; }
.map-organize-pill.gray { background: var(--map-btn-hover, rgba(0,0,0,.05)); border-color: var(--map-divider, rgba(0,0,0,.12)); color: var(--map-text-soft, #7a6a5a); }
.map-organize-preview-head { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; position: sticky; top: 0; z-index: 1; background: var(--map-panel-bg, rgba(250,240,220,.98)); padding-bottom: 5px; }
.map-organize-preview-head > span { font-size: 10.5px; font-weight: 700; color: var(--map-text, #3d2914); }
.map-organize-seg { display: inline-flex; gap: 4px; margin-left: auto; padding: 0; border: 0; border-radius: 0; background: transparent; }
.map-organize-seg button { min-width: 42px; height: 22px; padding: 0 8px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; background: var(--map-btn-bg, rgba(255,255,255,.5)); color: var(--map-text-soft, #7a6a5a); font: 11px/1 inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
.map-organize-seg button:hover { background: var(--map-btn-hover, rgba(0,0,0,.06)); }
.map-organize-seg button.on { background: var(--map-accent-bg, rgba(200,164,90,.18)); border-color: var(--map-accent, #c8a45a); color: var(--map-text, #3d2914); font-weight: 700; }
.map-organize-tree { font-size: 10.5px; line-height: 1.5; }
.map-organize-preview-row { display: flex; align-items: center; gap: 4px; min-width: 0; padding: 2px 3px; border-radius: 3px; }
.map-organize-preview-row:hover { background: var(--map-btn-hover, rgba(0,0,0,.05)); }
.map-organize-indent { flex: none; width: calc(var(--depth, 0) * 12px); }
.map-organize-preview-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--map-text, #3d2914); }
.map-organize-preview-name .old { text-decoration: line-through; color: var(--map-text-soft, #7a6a5a); }
.map-organize-preview-name .new { color: var(--map-status-ready, #2e7d32); font-weight: 700; }
.map-organize-preview-note { flex: none; font-size: 8.5px; color: var(--map-text-soft, #7a6a5a); white-space: nowrap; }
.map-organize-preview-row.ghost .map-organize-preview-name { text-decoration: line-through; color: var(--map-text-soft, #7a6a5a); }
.map-organize-preview-row.ghost { background: rgba(192,57,43,.05); }
.map-organize-preview-badge { flex: none; font-size: 8px; font-weight: 700; line-height: 1.5; padding: 0 4px; border-radius: 3px; }
.map-organize-preview-badge.rename { background: rgba(47,111,143,.14); color: #22596f; }
.map-organize-preview-badge.move { background: rgba(31,107,115,.14); color: #1f6b73; }
.map-organize-preview-badge.merge { background: rgba(109,79,161,.14); color: #543b86; }
.map-organize-preview-badge.delete { background: rgba(192,57,43,.14); color: #8e2c22; }
.map-organize-preview-legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; padding-top: 5px; border-top: 1px dashed var(--map-divider, rgba(0,0,0,.12)); font-size: 9px; color: var(--map-text-soft, #7a6a5a); }
.map-organize-foot { flex: 0 0 auto; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 8px 12px; border-top: 1px solid var(--map-divider, rgba(0,0,0,.1)); background: var(--map-input-bg, rgba(255,255,255,.28)); }
.map-organize-selected { flex: 1 1 160px; font-size: 10.5px; line-height: 1.45; color: var(--map-text-soft, #7a6a5a); }
.map-organize-selected b { color: var(--map-text, #3d2914); }
.map-organize-selected .danger { color: #c62828; font-weight: 700; }
.map-organize-btn { min-width: 64px; height: 28px; padding: 0 12px; border: 1px solid var(--map-panel-border, #c8b890); border-radius: 5px; background: var(--map-btn-bg, rgba(255,255,255,.5)); color: var(--map-text, #3d2914); font: 12px/1 inherit; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
.map-organize-btn:hover { background: var(--map-btn-hover, rgba(0,0,0,.06)); }
.map-organize-btn.primary { background: var(--map-accent-bg, rgba(200,164,90,.18)); border-color: var(--map-accent, #c8a45a); color: var(--map-text, #3d2914); font-weight: 700; }
.map-organize-btn.primary:hover { background: rgba(200,164,90,.28); }
.map-organize-btn.danger { background: rgba(192,57,43,.15); border-color: #c0392b; color: #c0392b; font-weight: 700; }
.map-organize-btn.danger:hover { background: rgba(192,57,43,.25); }
.map-organize-btn:disabled { opacity: .42; cursor: not-allowed; }
.map-organize-confirm, .map-organize-progress, .map-organize-done { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 9px; }
.map-organize-confirm h3, .map-organize-progress h3, .map-organize-done h3 { margin: 0; font-size: 14px; color: var(--map-text, #3d2914); }
.map-organize-confirm p, .map-organize-progress p, .map-organize-done p { margin: 0; font-size: 11.5px; line-height: 1.6; color: var(--map-text-soft, #7a6a5a); }
.map-organize-confirm-list, .map-organize-steps, .map-organize-done-list { display: flex; flex-direction: column; gap: 5px; }
.map-organize-confirm-row, .map-organize-step, .map-organize-done-row { display: flex; align-items: flex-start; gap: 6px; padding: 5px 7px; border: 1px solid var(--map-divider, rgba(0,0,0,.12)); border-radius: 5px; background: var(--map-input-bg, rgba(255,255,255,.28)); font-size: 10.5px; line-height: 1.5; color: var(--map-text, #3d2914); }
.map-organize-confirm-row .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--map-status-ready, #2e7d32); margin-top: 5px; flex: none; }
.map-organize-confirm-row.warn .dot { background: #b26a00; }
.map-organize-confirm-row.bad .dot { background: #c0392b; }
.map-organize-confirm-row b, .map-organize-step b { color: var(--map-text, #3d2914); }
.map-organize-confirm-actions { display: flex; justify-content: flex-end; gap: 7px; flex-wrap: wrap; margin-top: 4px; }
.map-organize-bar { height: 7px; border-radius: 999px; background: var(--map-divider, rgba(0,0,0,.12)); overflow: hidden; }
.map-organize-bar i { display: block; height: 100%; width: 0; background: var(--map-status-ready, #2e7d32); transition: width .25s ease; }
.map-organize-step-mk { width: 15px; height: 15px; min-width: 15px; border-radius: 50%; border: 1.5px solid var(--map-divider, rgba(0,0,0,.2)); display: flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; flex: none; margin-top: 1px; color: var(--map-text-soft, #7a6a5a); }
.map-organize-step.done .map-organize-step-mk { background: var(--map-status-ready, #2e7d32); border-color: var(--map-status-ready, #2e7d32); color: #fff; }
.map-organize-step.doing .map-organize-step-mk { border-color: var(--map-stroke-soft, #8b7355); border-top-color: transparent; animation: mapOrganizeSpin .8s linear infinite; }
.map-organize-step.failed { border-color: rgba(192,57,43,.4); }
.map-organize-step.failed .map-organize-step-mk { background: #c0392b; border-color: #c0392b; color: #fff; }
.map-organize-step.skipped { opacity: .7; }
.map-organize-done { align-items: center; text-align: center; }
.map-organize-done-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(46,125,50,.12); color: var(--map-status-ready, #2e7d32); }
.map-organize-done-icon.warn { background: rgba(178,106,0,.12); color: #b26a00; }
.map-organize-done-icon .ub-ic { width: 24px; height: 24px; }
.map-organize-done-list { width: 100%; max-width: 540px; text-align: left; margin-top: 4px; }
.map-organize-done-row .mk { flex: none; font-weight: 700; color: var(--map-status-ready, #2e7d32); }
.map-organize-done-row.failed { border-color: rgba(192,57,43,.35); }
.map-organize-done-row.failed .mk { color: #c0392b; }
.map-organize-done-row.skipped { opacity: .7; }
.map-organize-done-row .reason { color: #8e2c22; }
.map-organize-overlay.dark .map-organize-card,
.map-organize-overlay.dark .map-organize-merge-node,
.map-organize-overlay.dark .map-organize-input,
.map-organize-overlay.dark .map-organize-choice label,
.map-organize-overlay.dark .map-organize-confirm-row,
.map-organize-overlay.dark .map-organize-step,
.map-organize-overlay.dark .map-organize-done-row { background: rgba(255,255,255,.05); }
.map-organize-overlay.dark .map-organize-card.on { background: rgba(255,255,255,.09); }
.map-organize-overlay.dark .map-organize-input { color: var(--map-text, #f0f0f0); }
.map-organize-overlay.dark .map-organize-tag,
.map-organize-overlay.dark .map-organize-count,
.map-organize-overlay.dark .map-organize-tool { background: rgba(255,255,255,.07); }
.map-organize-overlay.dark .map-organize-btn.primary { color: var(--map-text, #f0f0f0); }
.map-organize-overlay.dark .map-organize-btn.danger { color: #f0a6a0; border-color: #c0392b; background: rgba(192,57,43,.2); }
.map-organize-overlay.dark .map-organize-op.rename,
.map-organize-overlay.dark .map-organize-count.rename,
.map-organize-overlay.dark .map-organize-tag.scene,
.map-organize-overlay.dark .map-organize-preview-badge.rename { color: #9cc7dd; }
.map-organize-overlay.dark .map-organize-op.move,
.map-organize-overlay.dark .map-organize-count.move,
.map-organize-overlay.dark .map-organize-preview-badge.move { color: #9ad6d9; }
.map-organize-overlay.dark .map-organize-op.merge,
.map-organize-overlay.dark .map-organize-count.merge,
.map-organize-overlay.dark .map-organize-preview-badge.merge { color: #c4b2e8; }
.map-organize-overlay.dark .map-organize-op.delete,
.map-organize-overlay.dark .map-organize-count.delete,
.map-organize-overlay.dark .map-organize-tag.current,
.map-organize-overlay.dark .map-organize-preview-badge.delete { color: #f0a6a0; }
.map-organize-overlay.dark .map-organize-tag.map { color: #e8c78a; }
.map-organize-overlay.dark .map-organize-tag.bad,
.map-organize-overlay.dark .map-organize-note.bad,
.map-organize-overlay.dark .map-organize-done-row .reason { color: #f0a6a0; }
.map-organize-overlay.dark .map-organize-tag.ok,
.map-organize-overlay.dark .map-organize-title-text .new,
.map-organize-overlay.dark .map-organize-path .to,
.map-organize-overlay.dark .map-organize-preview-name .new { color: #7fd08a; }
@media(max-width:599px){
  .map-lib-ai { height: 30px; padding: 0 9px; }
  .map-organize-overlay { padding: 0; border-radius: 0; }
  .map-organize-modal { width: 100%; height: 100%; max-height: 100%; border-radius: 0; border-left: 0; border-right: 0; }
  .map-organize-tabs { display: flex; }
  .map-organize-cols { padding: 7px 9px 8px; gap: 0; }
  .map-organize-list, .map-organize-preview { flex: 1 1 auto; border-left: 0; padding-left: 0; padding-right: 0; }
  .map-organize-cols[data-tab="list"] .map-organize-preview { display: none; }
  .map-organize-cols[data-tab="preview"] .map-organize-list { display: none; }
  .map-organize-check { width: 20px; height: 20px; min-width: 20px; }
  .map-organize-tool { height: 28px; }
  .map-organize-btn { height: 30px; }
}
.bridge-module-navigation .map-organize-modal { border-radius: 0; border-color: var(--bridge-line-strong, #23758a); background: var(--bridge-panel, #eef3f5); color: var(--bridge-text, #16222c); }
.bridge-module-navigation .map-organize-overlay { border-radius: 0; }
`;

// ─────────────────────────────────────────────────────────────
// 各主题的地图 CSS 变量值
// ─────────────────────────────────────────────────────────────
export interface MapThemeVars {
  [varName: string]: string;
}

export const MAP_THEME_VARS: Record<string, MapThemeVars> = {
  ancient: {
    '--map-bg': '#faf0dc',
    '--map-stroke': '#5c4033',
    '--map-stroke-soft': '#8b7355',
    '--map-title-color': '#3d2914',
    '--map-text': '#3d2914',
    '--map-text-soft': '#7a6a5a',
    '--map-panel-border': '#c8b890',
    '--map-panel-bg': 'rgba(250,240,220,0.55)',
    '--map-panel-radius': '10px',
    '--map-room-fill': 'none',
    '--map-room-label-color': '#5c4033',
    '--marker-protagonist': '#d4a017',
    '--marker-ally': '#2e7d32',
    '--marker-npc': '#1e3a5f',
    '--marker-enemy': '#c62828',
  },
  flirtatious: {
    '--map-bg': '#fff5fb',
    '--map-stroke': '#c875a8',
    '--map-stroke-soft': '#b89aae',
    '--map-title-color': '#7a3a6a',
    '--map-text': '#5a2a4a',
    '--map-text-soft': '#a87a9a',
    '--map-panel-border': '#e8b8d8',
    '--map-panel-bg': 'rgba(255,245,251,0.7)',
    '--map-panel-radius': '14px',
    '--map-room-fill': 'none',
    '--marker-protagonist': '#e87aae',
    '--marker-ally': '#7ab8c8',
    '--marker-npc': '#9a7ac8',
    '--marker-enemy': '#d05070',
  },
  minimal: {
    '--map-bg': '#1a1a1a',
    '--map-stroke': '#aaa',
    '--map-stroke-soft': '#b8b8b8',
    '--map-title-color': '#f0f0f0',
    '--map-text': '#f0f0f0',
    '--map-text-soft': '#c0c0c0',
    '--map-panel-border': '#666',
    '--map-panel-bg': 'rgba(30,30,30,0.6)',
    '--map-panel-radius': '6px',
    '--map-room-fill': 'none',
    '--map-btn-bg': 'rgba(255,255,255,0.08)',
    '--map-btn-hover': 'rgba(255,255,255,0.14)',
    '--map-input-bg': 'rgba(255,255,255,0.08)',
    '--map-divider': 'rgba(255,255,255,0.22)',
    '--map-room-label-color': '#f0f0f0',
    '--map-marker-name-fill': '#f0f0f0',
    '--map-marker-name-stroke': '#1a1a1a',
    '--map-exit-label-stroke': '#1a1a1a',
    '--marker-protagonist': '#f0c040',
    '--marker-protagonist-text': '#1a1a1a',
    '--marker-ally': '#4aa',
    '--marker-npc': '#69a',
    '--marker-enemy': '#e55',
    '--map-status-ready': '#66bb6a',
    '--map-status-loading': '#ffb74d',
    '--map-status-pending': '#ffb74d',
    '--map-status-error': '#ef5350',
    '--map-status-ready-bg': 'rgba(102,187,106,0.2)',
    '--map-status-pending-bg': 'rgba(255,183,77,0.2)',
  },
  sweet: {
    '--map-bg': '#fff0f6',
    '--map-stroke': '#d88aae',
    '--map-stroke-soft': '#c8a0b8',
    '--map-title-color': '#a04068',
    '--map-text': '#7a3858',
    '--map-text-soft': '#b8789a',
    '--map-panel-border': '#f0c0d8',
    '--map-panel-bg': 'rgba(255,240,246,0.7)',
    '--map-panel-radius': '12px',
    '--map-room-fill': 'none',
    '--marker-protagonist': '#e070a8',
    '--marker-ally': '#70c0a0',
    '--marker-npc': '#a080d0',
    '--marker-enemy': '#e07090',
  },
  xianxia: {
    '--map-bg': '#e8f4f8',
    '--map-stroke': '#3a7a9a',
    '--map-stroke-soft': '#6a9ab8',
    '--map-title-color': '#2a5a7a',
    '--map-text': '#2a5a7a',
    '--map-text-soft': '#7a9ab8',
    '--map-panel-border': '#a8d0e8',
    '--map-panel-bg': 'rgba(232,244,248,0.7)',
    '--map-panel-radius': '10px',
    '--map-room-fill': 'none',
    '--marker-protagonist': '#40b0d0',
    '--marker-ally': '#60c0a0',
    '--marker-npc': '#8080d0',
    '--marker-enemy': '#d06070',
  },
  bridge: {
    '--map-bg': '#152b32',
    '--map-stroke': '#8eeaff',
    '--map-stroke-soft': '#4aa9bb',
    '--map-title-color': '#8eeaff',
    '--map-text': '#d5f7ff',
    '--map-text-soft': '#8bb8c1',
    '--map-panel-border': '#23758a',
    '--map-panel-bg': 'rgba(21,43,50,.84)',
    '--map-panel-radius': '0',
    '--map-room-fill': 'rgba(10,113,137,.12)',
    '--map-room-label-color': '#d5f7ff',
    '--marker-protagonist': '#d5f7ff',
    '--marker-ally': '#47bfcf',
    '--marker-npc': '#8eeaff',
    '--marker-enemy': '#d46c61',
  },
  ios: {
    '--map-bg': '#f2f2f7',
    '--map-stroke': '#007aff',
    '--map-stroke-soft': 'rgba(0,122,255,.4)',
    '--map-title-color': '#1c1c1e',
    '--map-text': '#1c1c1e',
    '--map-text-soft': 'rgba(60,60,67,.62)',
    '--map-panel-border': 'rgba(60,60,67,.14)',
    '--map-panel-bg': 'rgba(255,255,255,.88)',
    '--map-panel-radius': '18px',
    '--map-room-fill': 'rgba(0,122,255,.07)',
    '--map-room-label-color': '#1c1c1e',
    '--marker-protagonist': '#007aff',
    '--marker-ally': '#34c759',
    '--marker-npc': '#8e8e93',
    '--marker-enemy': '#ff3b30',
  },
};

/** 生成某主题的变量声明 CSS */
export function buildMapThemeVarsCss(style: string): string {
  const vars = MAP_THEME_VARS[style] || MAP_THEME_VARS.ancient;
  const decls = Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join('\n  ');
  return `:root {\n  ${decls}\n}`;
}
