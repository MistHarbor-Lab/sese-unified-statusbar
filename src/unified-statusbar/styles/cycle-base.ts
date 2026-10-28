// ===== 月信与孕育系统 · 通用 CSS（全主题共享，CSS 变量驱动） =====
// 详见 docs/经期孕期功能设计.md §8.4（主题适配约束）
//
// 全程 var(--token,#fallback)：--card-bg / --accent 5 主题都有；
// --accent-deep/-soft 仅 ancient/flirtatious 有，故加 fallback 链 var(--accent-deep, var(--accent, #...))；
// 深色模式：各主题在暗色块里重定义 --accent 等，本 CSS 自动跟随，无需单独适配。
// 自包含 cycle-* class 结构，不依赖各主题进度条 class（避开 xianxia 10 节点结构等差异）。
export const CYCLE_BASE_CSS = `
/* ===== 经期阶段进度条（角色卡内） ===== */
.cycle-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0 2px;
  font-size: 11px;
  line-height: 1.2;
}
.cycle-bar .cycle-label {
  flex-shrink: 0;
  color: var(--text, var(--text-color, #333));
  font-weight: 600;
  white-space: nowrap;
}
.cycle-bar .cycle-track {
  flex: 1;
  position: relative;
  height: 6px;
  border-radius: 4px;
  background: var(--divider, var(--divider-light, rgba(0,0,0,.08)));
  overflow: hidden;
}
.cycle-bar .cycle-fill {
  height: 100%;
  border-radius: 4px;
  transition: width .35s ease, background .3s ease;
}
.cycle-bar .cycle-value {
  flex-shrink: 0;
  color: var(--text-muted, var(--secondary-text, #888));
  white-space: nowrap;
}

/* 4 阶段配色（覆盖 fill 背景；!important 确保压过任何主题 fill 规则） */
.cycle-bar.cycle-phase-menstrual .cycle-fill {
  background: var(--accent-deep, var(--accent, #c0392b)) !important;
  opacity: .92;
  animation: ub-cycle-pulse 2.4s ease-in-out infinite;
}
.cycle-bar.cycle-phase-follicular .cycle-fill {
  background: var(--accent, #4a90d9) !important;
  opacity: .55;
}
.cycle-bar.cycle-phase-ovulation .cycle-fill {
  background: #d94545 !important; /* 高危固定暖红，5 主题一致 */
  opacity: .9;
}
.cycle-bar.cycle-phase-luteal .cycle-fill {
  background: var(--accent-soft, var(--accent, #4a90d9)) !important;
  opacity: .6;
}
@keyframes ub-cycle-pulse {
  0%, 100% { opacity: .92; }
  50%      { opacity: .55; }
}

/* 高危标记（排卵期，label 前缀） */
.cycle-high-risk {
  color: #d94545;
  font-weight: 700;
  margin-right: 2px;
}

/* ===== 孕周进度条（角色卡内，仅孕期显示） ===== */
.cycle-bar.cycle-preg .cycle-label {
  color: var(--accent-deep, var(--accent, #c0392b));
}
.cycle-bar.cycle-preg .cycle-fill {
  background: var(--accent-deep, var(--accent, #c0392b)) !important;
  opacity: .85;
}
/* 三阶段微差：早期偏淡、中期饱和、晚期偏深 */
.cycle-bar.cycle-trimester-1 .cycle-fill { opacity: .6; }
.cycle-bar.cycle-trimester-2 .cycle-fill { opacity: .82; }
.cycle-bar.cycle-trimester-3 .cycle-fill { opacity: .95; }
/* 主角信息区周期条与角色卡同款（cyclePhaseBar 共用），无需单独塑形。 */

/* ===== 受孕形式 / 验孕弹窗（复用 panel-popup 结构） ===== */
.cycle-sex-form-popup .panel-popup-body,
.cycle-preg-test-popup .panel-popup-body {
  padding: 14px 16px 18px;
}
.cycle-popup-text {
  font-size: var(--ub-ui-font-14,14px);
  line-height: 1.6;
  color: var(--text, var(--text-color, #333));
}
.cycle-popup-text b {
  color: var(--accent-deep, var(--accent, #c0392b));
}
.cycle-popup-sub {
  margin-top: 6px;
  font-size: var(--ub-ui-font-12,12px);
  color: var(--text-muted, var(--secondary-text, #888));
}
.cycle-form-btns {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.cycle-form-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: var(--ub-ui-font-14,14px);
  border: 1px solid var(--divider, rgba(0,0,0,.1));
  background: var(--card-bg, rgba(255,255,255,.6));
  color: var(--text, var(--text-color, #333));
  transition: background .15s, border-color .15s, transform .1s;
}
.cycle-form-btn:hover {
  background: var(--accent-bg, color-mix(in srgb, var(--accent, #b5362e) 12%, transparent));
  border-color: var(--accent, #4a90d9);
}
.cycle-form-btn:active {
  transform: scale(.97);
}
.cycle-form-btn .cf-label {
  font-weight: 600;
}
.cycle-form-btn .cf-note {
  font-size: var(--ub-ui-font-11,11px);
  color: var(--text-muted, var(--secondary-text, #888));
}
.cycle-form-btn.cycle-form-single {
  flex: 1;
  padding: 12px;
  font-size: var(--ub-ui-font-15,15px);
  background: var(--accent, #4a90d9);
  color: #fff;
  border-color: var(--accent, #4a90d9);
}
.cycle-form-btn.cycle-form-single:hover {
  background: var(--accent-deep, var(--accent, #c0392b));
  border-color: var(--accent-deep, var(--accent, #c0392b));
}
.cycle-form-btn.cycle-form-single .cf-note {
  display: none;
}

/* ===== 经期情绪图标变体（§5.7） ===== */
/* html-builder 5 处 mood-icon 在角色经期内追加 is-cycle-period modifier。
   不改 emoji 本体（避开主题色调冲突），仅叠暖红描边+光晕做视觉区分。
   5 主题一致：红 #c0392b 是经期固定暖红（与 cycle-phase-menstrual fill 同色系）。 */
.mood-icon.is-cycle-period {
  display: inline-block;
  outline: 1px solid rgba(192, 57, 43, 0.55);
  outline-offset: 1px;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(192, 57, 43, 0.35);
  transition: outline-color .2s, box-shadow .2s;
}

/* ===== 日历经期/孕期标注（仅在打开日历弹窗时计算） ===== */
/* 孕期族固定右上，经期族固定右下；同日不同角色两类事件可以同时出现。 */
.cal-day {
  position: relative;
}
.cal-cycle-mark {
  position: absolute;
  top: 2px;
  right: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 2;
}
.cal-cycle-mark.cal-cycle-pregnancy-family {
  top: 2px;
  right: 3px;
}
.cal-cycle-mark.cal-cycle-period-family {
  top: auto;
  right: 3px;
  bottom: 2px;
}
.cal-cycle-mark.cal-cycle-stage {
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--accent, #68b090) 55%, transparent));
}
/* 经期族圆点（字形 ●/○ 由 calendar-themed.ts 注入）：颜色取各主题 accent，过往淡、预测实+微光 */
.cal-cycle-mark.cal-cycle-past {
  color: var(--accent-deep, var(--accent, #b5362e));
  opacity: .5;
  font-size: 11px;
}
.cal-cycle-mark.cal-cycle-predicted {
  color: var(--accent-deep, var(--accent, #b5362e));
  opacity: 1;
  text-shadow: 0 0 4px color-mix(in srgb, var(--accent, #b5362e) 50%, transparent);
}
.cal-cycle-mark.cal-cycle-due {
  font-size: 12px;
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--accent, #68b090) 65%, transparent));
  animation: ub-cycle-due-pulse 2s ease-in-out infinite;
}
@keyframes ub-cycle-due-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.12); }
}

/* ===== 跳跃摘要弹窗（§2.2 P3） ===== */
.cycle-jump-summary-popup .panel-popup-body {
  padding: 12px 16px 16px;
}
.cycle-jump-intro {
  font-size: var(--ub-ui-font-13,13px);
  color: var(--text-muted, var(--secondary-text, #888));
  margin-bottom: 8px;
}
.cycle-jump-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cycle-jump-row {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--card-bg, rgba(255,255,255,.5));
  border: 1px solid var(--divider, rgba(0,0,0,.08));
  font-size: var(--ub-ui-font-13,13px);
  line-height: 1.55;
}
.cycle-jump-row .cj-name {
  font-weight: 600;
  color: var(--accent-deep, var(--accent, #c0392b));
  margin-right: 4px;
}
.cycle-jump-row .cj-detail {
  color: var(--text, var(--text-color, #333));
}
.cycle-jump-row .cj-date {
  color: var(--text-muted, var(--secondary-text, #999));
  font-size: var(--ub-ui-font-11,11px);
  margin-left: 4px;
}

/* “周期”文字保持原视觉；仅在悬停/键盘聚焦时提供可点击反馈。 */
.cycle-bar .cycle-manage-trigger {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  font-family: inherit;
  font-size: inherit;
  font-style: inherit;
  letter-spacing: inherit;
  text-align: inherit;
}
/* F57(第十二轮)：手机端「周期 / 有喜」是经期参数管理弹窗的唯一入口，原热区≈13px（继承 11px 行高、
   padding:0）拇指难命中。触屏设备补 44px 命中区，视觉不变（桌面/悬停观感零变化）。 */
@media (pointer:coarse) {
  .cycle-bar .cycle-manage-trigger { min-height: 44px; padding: 0 10px; display: inline-flex; align-items: center; }
}
.cycle-manage-trigger:hover {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  filter: brightness(1.08);
}
.cycle-manage-trigger:focus-visible {
  outline: 2px solid var(--accent, #c56b78);
  outline-offset: 2px;
}

/* 经期参数管理窗口 */
.cycle-manager-popup {
  width: min(520px, calc(100vw - 28px));
  max-height: min(760px, calc(100vh - 32px));
  max-height: min(760px, calc(100dvh - 32px));
}
.cycle-manager-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.cycle-manager-person {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.cycle-manager-person strong {
  color: var(--text, var(--text-color, #333));
  font-size: 17px;
}
.cycle-manager-person span,
.cycle-manager-summary {
  color: var(--text-muted, var(--secondary-text, #777));
  font-size: var(--ub-ui-font-12,12px);
}
.cycle-manager-summary {
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--accent-soft, rgba(197,107,120,.10));
}
.cycle-manager-fields {
  overflow: hidden;
  border: 1px solid var(--divider, rgba(0,0,0,.10));
  border-radius: 10px;
}
.cycle-manager-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(130px, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 42px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--divider, rgba(0,0,0,.08));
}
.cycle-manager-row:last-child { border-bottom: 0; }
.cycle-manager-field-label {
  color: var(--text-muted, var(--secondary-text, #777));
  font-size: 12px;
}
.cycle-manager-field-value {
  color: var(--text, var(--text-color, #333));
  font-size: var(--ub-ui-font-13,13px);
  text-align: right;
}
.cycle-manager-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--divider, rgba(0,0,0,.18));
  border-radius: 7px;
  background: var(--card-bg, #fff);
  color: var(--text, var(--text-color, #333));
  font: inherit;
}
.cycle-manager-input:focus {
  border-color: var(--accent, #c56b78);
  outline: 2px solid color-mix(in srgb, var(--accent, #c56b78) 20%, transparent);
}
.cycle-manager-message {
  min-height: 18px;
  color: var(--accent-deep, var(--accent, #a75463));
  font-size: var(--ub-ui-font-12,12px);
  text-align: center;
}
.cycle-manager-message.error { color: #b42318; }
.cycle-manager-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cycle-manager-btn {
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid var(--divider, rgba(0,0,0,.15));
  border-radius: 8px;
  background: var(--card-bg, #fff);
  color: var(--text, var(--text-color, #333));
  cursor: pointer;
  /* 防止主题容器的展示字号被按钮继承，保持弹窗操作区的紧凑尺度。 */
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
}
.cycle-manager-btn.primary {
  border-color: var(--accent, #c56b78);
  background: var(--accent, #c56b78);
  color: #fff;
}
.cycle-manager-btn.danger {
  border-color: #b42318;
  color: #b42318;
  background: transparent;
}
.cycle-manager-btn.danger:hover { background: rgba(180,35,24,.08); }
.cycle-manager-danger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 2px;
  padding-top: 14px;
  border-top: 1px solid rgba(180,35,24,.22);
}
.cycle-manager-danger div { display: flex; flex-direction: column; gap: 3px; }
.cycle-manager-danger strong { color: #b42318; font-size: var(--ub-ui-font-13,13px); }
.cycle-manager-danger span { color: var(--text-muted, #777); font-size: var(--ub-ui-font-11,11px); line-height: 1.45; }
.cycle-manager-confirm { text-align: center; }
.cycle-manager-warning-icon {
  align-self: center;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(180,35,24,.10);
  color: #b42318;
  font-size: 24px;
  font-weight: 700;
}
.cycle-manager-confirm h3 { margin: 0; color: var(--text, #333); }
.cycle-manager-confirm p { margin: 0; color: var(--text-muted, #666); line-height: 1.6; }
.cycle-manager-confirm .cycle-manager-irreversible { color: #b42318; font-weight: 700; }

/* 深空舰桥：周期遥测与参数终端 */
.cycle-bar.bridge-cycle-indicator{
  display:grid;grid-template-columns:auto minmax(64px,1fr) auto;gap:7px;
  padding:5px 7px;border:1px solid var(--bridge-line,#91a5ad);border-left:3px solid var(--bridge-signal,#0a7189);
  background:var(--bridge-panel-inset,#d5e1e5);font-family:var(--bridge-font-data,'Consolas',monospace);
}
.cycle-bar.bridge-cycle-indicator .cycle-label{color:var(--bridge-text,#16222c);letter-spacing:.5px;}
.cycle-bar.bridge-cycle-indicator .cycle-track{height:7px;border-radius:0;background:var(--bridge-screen,#152b32);border:1px solid var(--bridge-line-strong,#23758a);}
.cycle-bar.bridge-cycle-indicator .cycle-fill{border-radius:0;animation:none!important;background:var(--bridge-signal,#0a7189)!important;}
.cycle-bar.bridge-cycle-indicator.cycle-phase-menstrual{border-left-color:var(--bridge-danger,#a43b35);}
.cycle-bar.bridge-cycle-indicator.cycle-phase-menstrual .cycle-fill{background:var(--bridge-danger,#a43b35)!important;}
.cycle-bar.bridge-cycle-indicator.cycle-phase-ovulation{border-left-color:var(--bridge-warn,#b47a16);}
.cycle-bar.bridge-cycle-indicator.cycle-phase-ovulation .cycle-fill{background:var(--bridge-warn,#b47a16)!important;}
.cycle-bar.bridge-cycle-indicator .cycle-value{color:var(--bridge-text-muted,#62757c);}
.cycle-manager-popup.bridge-module-cycle-manager{width:min(94%,620px);max-width:620px;border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);}
.cycle-manager-popup.bridge-module-cycle-manager .panel-popup-head{background:linear-gradient(90deg,var(--bridge-panel-alt,#dde8eb),var(--bridge-panel,#eef3f5));border-bottom:1px solid var(--bridge-line-strong,#23758a);}
.cycle-manager-popup.bridge-module-cycle-manager .panel-popup-title::after{content:' / BIOLOGICAL CYCLE';font:9px/1 var(--bridge-font-data,'Consolas',monospace);letter-spacing:1.2px;color:var(--bridge-text-muted,#62757c);}
.cycle-manager-popup.bridge-module-cycle-manager .cycle-manager-summary{border-radius:0;background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);font-family:var(--bridge-font-data,'Consolas',monospace);}
.cycle-manager-popup.bridge-module-cycle-manager .cycle-manager-fields{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-panel-inset,#d5e1e5);}
.cycle-manager-popup.bridge-module-cycle-manager .cycle-manager-input,.cycle-manager-popup.bridge-module-cycle-manager .cycle-manager-btn{border-radius:0;border-color:var(--bridge-line,#91a5ad);background:var(--bridge-panel,#eef3f5);}
.cycle-manager-popup.bridge-module-cycle-manager .cycle-manager-btn.primary{border-color:var(--bridge-signal,#0a7189);background:var(--bridge-signal,#0a7189);color:var(--bridge-signal-contrast,#fff);}
.cycle-manager-popup.bridge-module-cycle-manager .cycle-manager-warning-icon{border-radius:0;background:rgba(164,59,53,.1);border:1px solid var(--bridge-danger,#a43b35);}
@media(max-width:599px){.cycle-manager-popup.bridge-module-cycle-manager{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0}}

@media (max-width: 520px) {
  .cycle-manager-person,
  .cycle-manager-danger { align-items: stretch; flex-direction: column; }
  .cycle-manager-row { grid-template-columns: 1fr; gap: 5px; }
  .cycle-manager-field-value { text-align: left; }
  .cycle-manager-btn { width: 100%; }
}
`;
