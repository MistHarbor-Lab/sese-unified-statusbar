// styles/decision-base.ts
// 决策弹窗家族（世界动态/地图归属/经期表单/跳跃摘要）五主题质感 + 深浅色（2026-08-21）：
// 主题作用域 ub-decision-theme-${style}（bridge 走既有 bridge-module-decision-queue，不在此定义）。
// 纯色禁渐变（用户拍板）；字号走 base.ts 既有 var(--ub-ui-font-*) 弹窗缩放。
export const decisionBaseCSS = /* css */ `
/* ===== 决策弹窗 · ancient 古风（朱砂印章） ===== */
.ub-decision-theme-ancient{background:#fff8e8;color:#2c1810;border:2px solid #c8b898;border-radius:4px;font-family:var(--ub-font-reading,'Noto Serif SC',serif);}
.ub-decision-theme-ancient .ub-decision-head{border-bottom:1px solid #cdb88c;}
.ub-decision-theme-ancient .ub-decision-title{color:#8a2f28;letter-spacing:2px;}
.ub-decision-theme-ancient .ub-decision-close{color:#8b6e4e;}
.ub-decision-theme-ancient .ub-decision-close:hover{background:rgba(0,0,0,.06);}
.ub-decision-theme-ancient .ww-decision-block{color:#8a2f28;}
.ub-decision-theme-ancient .ww-decision-row{border-bottom:1px dashed #cdb88c;}
.ub-decision-theme-ancient .ww-decision-tag{background:#cdb88c;color:#3a2a18;border-radius:4px;}
.ub-decision-theme-ancient .ww-decision-tag.ww-tag-heard{background:#c9a06a;color:#3a2a18;}
.ub-decision-theme-ancient .ww-decision-tag.ww-tag-known{background:#8a2f28;color:#f5edd6;}
.ub-decision-theme-ancient .ww-decision-desc{color:#6b5230;}
.ub-decision-theme-ancient .ww-decision-btn{border-radius:4px;background:transparent;border:1px solid #a08a5e;color:#4a3828;}
.ub-decision-theme-ancient .ww-decision-btn:hover{background:rgba(201,168,76,.16);}
.ub-decision-theme-ancient .ww-decision-fill,.ub-decision-theme-ancient .ww-decision-ack{background:#8a2f28;color:#f5edd6;border-color:#8a2f28;}
.ub-decision-theme-ancient .ww-decision-fill:hover,.ub-decision-theme-ancient .ww-decision-ack:hover{background:#6a241e;}
.ub-decision-theme-ancient .map-location-candidate{border-color:#cdb88c;background:#fffdf4;}
.ub-decision-theme-ancient .map-location-candidate:hover{border-color:#c9a06a;background:#f8f0dc;}
.ub-decision-theme-ancient .map-location-actions button{background:#fff8e8;border-color:#cdb88c;color:#4a3828;}
.ub-decision-theme-ancient .cycle-form-btn{background:#fffdf4;border-color:#cdb88c;color:#2c1810;}
.ub-decision-theme-ancient .cycle-form-btn:hover{background:rgba(201,168,76,.15);border-color:#c9a06a;}
.ub-decision-theme-ancient .cycle-form-btn.cycle-form-single{background:#8a2f28;border-color:#8a2f28;color:#f5edd6;}
.ub-decision-theme-ancient .cycle-form-btn.cycle-form-single:hover{background:#6a241e;}
.ub-decision-theme-ancient .ub-decision-error{background:rgba(138,47,40,.1);color:#8a2f28;}
.ub-decision-overlay.dark .ub-decision-theme-ancient{background:#241b12;color:#d8ccb8;border-color:#4a3a28;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ub-decision-head{border-bottom-color:#3a2e1c;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ub-decision-title{color:#e8c8a0;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ub-decision-close{color:#a09070;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ub-decision-close:hover{background:rgba(255,255,255,.08);}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-block{color:#c9a06a;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-row{border-bottom-color:#3a2e1c;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-tag{background:#3a2e1c;color:#c9a06a;border-color:#5a4634;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-tag.ww-tag-heard{background:#5a4416;color:#e8cc90;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-tag.ww-tag-known{background:#8a2f28;color:#f5edd6;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-desc{color:#a4937e;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-btn{background:transparent;border-color:#8a6e4a;color:#c9a06a;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-btn:hover{background:rgba(201,160,76,.12);}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-fill,.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-ack{background:#8a2f28;color:#f5edd6;border-color:#8a2f28;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-fill:hover,.ub-decision-overlay.dark .ub-decision-theme-ancient .ww-decision-ack:hover{background:#b5362e;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .map-location-candidate{background:rgba(0,0,0,.35);border-color:#3a2e1c;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .map-location-candidate:hover{border-color:#8a6e4a;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .map-location-actions button{background:transparent;border-color:#4a3a28;color:#d8ccb8;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .cycle-form-btn{background:rgba(0,0,0,.3);border-color:#4a3a28;color:#d8ccb8;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .cycle-form-btn:hover{background:rgba(201,160,76,.1);border-color:#8a6e4a;}
.ub-decision-overlay.dark .ub-decision-theme-ancient .cycle-form-btn.cycle-form-single{background:#8a2f28;border-color:#8a2f28;color:#f5edd6;}

/* ===== 决策弹窗 · flirtatious 瑟瑟（霓虹胶囊） ===== */
.ub-decision-theme-flirtatious{background:#1a0a24;color:#f5d8ff;border:1px solid #b055d0;border-radius:11px;}
.ub-decision-theme-flirtatious .ub-decision-head{border-bottom-color:#4a2a52;}
.ub-decision-theme-flirtatious .ub-decision-title{color:#ff9ee0;text-shadow:0 0 10px rgba(255,123,208,.45);letter-spacing:2px;}
.ub-decision-theme-flirtatious .ub-decision-close{color:#c090b0;}
.ub-decision-theme-flirtatious .ub-decision-close:hover{background:rgba(255,123,208,.1);}
.ub-decision-theme-flirtatious .ww-decision-block{color:#ff9ee0;}
.ub-decision-theme-flirtatious .ww-decision-row{border-bottom:1px dashed rgba(255,123,208,.35);}
.ub-decision-theme-flirtatious .ww-decision-tag{background:#3a1a42;color:#ff9ee0;border:1px solid rgba(255,123,208,.4);border-radius:8px;}
.ub-decision-theme-flirtatious .ww-decision-tag.ww-tag-heard{background:#3a1a42;color:#ff9ee0;}
.ub-decision-theme-flirtatious .ww-decision-tag.ww-tag-known{background:#b055d0;color:#1a0022;border-color:#b055d0;}
.ub-decision-theme-flirtatious .ww-decision-desc{color:#b48bc9;}
.ub-decision-theme-flirtatious .ww-decision-btn{border-radius:9px;background:transparent;border:1px solid #5a3a52;color:#e6c8f2;}
.ub-decision-theme-flirtatious .ww-decision-btn:hover{background:rgba(255,123,208,.12);}
.ub-decision-theme-flirtatious .ww-decision-fill,.ub-decision-theme-flirtatious .ww-decision-ack{background:#ff7bd0;border-color:#ff7bd0;color:#1a0022;box-shadow:0 0 10px rgba(255,123,208,.4);}
.ub-decision-theme-flirtatious .ww-decision-fill:hover,.ub-decision-theme-flirtatious .ww-decision-ack:hover{background:#ff95d8;}
.ub-decision-theme-flirtatious .map-location-candidate{border-color:rgba(255,123,208,.35);background:rgba(255,123,208,.06);}
.ub-decision-theme-flirtatious .map-location-candidate:hover{background:rgba(255,123,208,.14);}
.ub-decision-theme-flirtatious .map-location-actions button{background:transparent;border-color:#5a3a52;color:#f5d8ff;}
.ub-decision-theme-flirtatious .cycle-form-btn{background:rgba(255,123,208,.06);border-color:rgba(255,123,208,.35);color:#f5d8ff;}
.ub-decision-theme-flirtatious .cycle-form-btn:hover{background:rgba(255,123,208,.14);border-color:#ff7bd0;}
.ub-decision-theme-flirtatious .cycle-form-btn.cycle-form-single{background:#ff7bd0;border-color:#ff7bd0;color:#1a0022;box-shadow:0 0 10px rgba(255,123,208,.4);}
.ub-decision-theme-flirtatious .cycle-form-btn.cycle-form-single:hover{background:#ff95d8;}
.ub-decision-theme-flirtatious .ub-decision-error{background:rgba(255,123,208,.1);color:#ff9ee0;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious{background:#100518;border-color:#7a4a92;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ub-decision-head{border-bottom-color:#3a1a42;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ub-decision-title{color:#ffb0e8;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-tag{background:#2a1028;border-color:rgba(255,123,208,.3);}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-tag.ww-tag-known{background:#b055d0;color:#1a0022;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-btn{border-color:#4a2a52;color:#e6c8f2;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-btn:hover{background:rgba(255,123,208,.1);}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-fill,.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-ack{background:#ff7bd0;border-color:#ff7bd0;color:#1a0022;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-fill:hover,.ub-decision-overlay.dark .ub-decision-theme-flirtatious .ww-decision-ack:hover{background:#ff95d8;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .cycle-form-btn{background:rgba(0,0,0,.35);border-color:#4a2a52;}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .cycle-form-btn:hover{background:rgba(255,123,208,.1);}
.ub-decision-overlay.dark .ub-decision-theme-flirtatious .cycle-form-btn.cycle-form-single{background:#ff7bd0;border-color:#ff7bd0;color:#1a0022;}

/* ===== 决策弹窗 · minimal 萦绕（极简） ===== */
.ub-decision-theme-minimal{background:#f4f4f4;color:#222;border:1px solid #d6d6d6;border-radius:2px;}
.ub-decision-theme-minimal .ub-decision-head{border-bottom-color:#d0d0d0;}
.ub-decision-theme-minimal .ub-decision-title{color:#333;letter-spacing:3px;font-weight:600;}
.ub-decision-theme-minimal .ub-decision-close{color:#888;}
.ub-decision-theme-minimal .ub-decision-close:hover{background:rgba(0,0,0,.05);}
.ub-decision-theme-minimal .ww-decision-block{color:#333;letter-spacing:3px;}
.ub-decision-theme-minimal .ww-decision-row{border-bottom:1px dashed #ccc;}
.ub-decision-theme-minimal .ww-decision-tag{background:#e8e8e8;color:#444;border-radius:3px;}
.ub-decision-theme-minimal .ww-decision-tag.ww-tag-heard{background:#e8e8e8;color:#444;}
.ub-decision-theme-minimal .ww-decision-tag.ww-tag-known{background:#222;color:#fff;}
.ub-decision-theme-minimal .ww-decision-desc{color:#888;}
.ub-decision-theme-minimal .ww-decision-btn{border-radius:2px;background:transparent;border-color:#c8c8c8;color:#555;}
.ub-decision-theme-minimal .ww-decision-btn:hover{background:#eee;}
.ub-decision-theme-minimal .ww-decision-fill,.ub-decision-theme-minimal .ww-decision-ack{background:#222;border-color:#222;color:#fff;}
.ub-decision-theme-minimal .ww-decision-fill:hover,.ub-decision-theme-minimal .ww-decision-ack:hover{background:#111;}
.ub-decision-theme-minimal .map-location-candidate{background:#fff;border-color:#d8d8d8;border-radius:4px;}
.ub-decision-theme-minimal .map-location-candidate:hover{border-color:#999;}
.ub-decision-theme-minimal .map-location-actions button{background:#fff;border-color:#ccc;color:#333;}
.ub-decision-theme-minimal .cycle-form-btn{background:#fff;border-color:#d8d8d8;color:#333;}
.ub-decision-theme-minimal .cycle-form-btn:hover{background:#f1f1f1;border-color:#999;}
.ub-decision-theme-minimal .cycle-form-btn.cycle-form-single{background:#222;border-color:#222;color:#fff;}
.ub-decision-theme-minimal .cycle-form-btn.cycle-form-single:hover{background:#111;}
.ub-decision-theme-minimal .ub-decision-error{background:rgba(34,34,34,.08);color:#a33;}
.ub-decision-overlay.dark .ub-decision-theme-minimal{background:#161616;color:#ccc;border-color:#3a3a3a;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ub-decision-head{border-bottom-color:#2a2a2a;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ub-decision-title{color:#eee;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ub-decision-close{color:#999;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ub-decision-close:hover{background:rgba(255,255,255,.07);}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-block{color:#ddd;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-row{border-bottom-color:#2a2a2a;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-tag{background:#2a2a2a;color:#aaa;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-tag.ww-tag-heard{background:#3a3a3a;color:#ccc;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-tag.ww-tag-known{background:#eee;color:#111;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-desc{color:#999;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-btn{background:transparent;border-color:#666;color:#aaa;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-btn:hover{background:#222;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-fill,.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-ack{background:#eee;border-color:#eee;color:#111;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-fill:hover,.ub-decision-overlay.dark .ub-decision-theme-minimal .ww-decision-ack:hover{background:#fff;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .map-location-candidate{background:#1a1a1a;border-color:#2a2a2a;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .map-location-candidate:hover{border-color:#666;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .map-location-actions button{background:transparent;border-color:#3a3a3a;color:#ccc;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .cycle-form-btn{background:#1a1a1a;border-color:#3a3a3a;color:#ccc;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .cycle-form-btn:hover{background:#222;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .cycle-form-btn.cycle-form-single{background:#eee;border-color:#eee;color:#111;}
.ub-decision-overlay.dark .ub-decision-theme-minimal .cycle-form-btn.cycle-form-single:hover{background:#fff;}

/* ===== 决策弹窗 · sweet 甜恋糖果 ===== */
.ub-decision-theme-sweet{background:#fff0f6;color:#7a3b54;border:1px solid #f2a8c4;border-radius:14px;box-shadow:0 4px 14px rgba(231,84,143,.22);}
.ub-decision-theme-sweet .ub-decision-head{border-bottom-color:#f7c4d8;}
.ub-decision-theme-sweet .ub-decision-title{color:#e7548f;letter-spacing:1px;}
.ub-decision-theme-sweet .ub-decision-close{color:#c989a4;}
.ub-decision-theme-sweet .ub-decision-close:hover{background:rgba(231,84,143,.1);}
.ub-decision-theme-sweet .ww-decision-block{color:#e7548f;}
.ub-decision-theme-sweet .ww-decision-row{border-bottom:1px dashed #f2a8c4;}
.ub-decision-theme-sweet .ww-decision-tag{background:#fde3ec;color:#d7548f;border-radius:9px;}
.ub-decision-theme-sweet .ww-decision-tag.ww-tag-heard{background:#fde3ec;color:#d7548f;}
.ub-decision-theme-sweet .ww-decision-tag.ww-tag-known{background:#e7548f;color:#fff;}
.ub-decision-theme-sweet .ww-decision-desc{color:#a06a83;}
.ub-decision-theme-sweet .ww-decision-btn{border-radius:9px;background:#fff;border-color:#f2a8c4;color:#a06a83;}
.ub-decision-theme-sweet .ww-decision-btn:hover{background:#fde3ec;}
.ub-decision-theme-sweet .ww-decision-fill,.ub-decision-theme-sweet .ww-decision-ack{background:#e7548f;border-color:#e7548f;color:#fff;box-shadow:0 2px 8px rgba(231,84,143,.35);}
.ub-decision-theme-sweet .ww-decision-fill:hover,.ub-decision-theme-sweet .ww-decision-ack:hover{background:#d64080;}
.ub-decision-theme-sweet .map-location-candidate{background:#fff;border-color:#f2a8c4;border-radius:10px;}
.ub-decision-theme-sweet .map-location-candidate:hover{border-color:#e7548f;}
.ub-decision-theme-sweet .map-location-actions button{background:#fff;border-color:#f2a8c4;color:#7a3b54;}
.ub-decision-theme-sweet .cycle-form-btn{background:#fff;border-color:#f2a8c4;color:#7a3b54;border-radius:10px;}
.ub-decision-theme-sweet .cycle-form-btn:hover{background:#fde3ec;border-color:#e7548f;}
.ub-decision-theme-sweet .cycle-form-btn.cycle-form-single{background:#e7548f;border-color:#e7548f;color:#fff;}
.ub-decision-theme-sweet .cycle-form-btn.cycle-form-single:hover{background:#c06d80;}
.ub-decision-theme-sweet .ub-decision-error{background:rgba(231,84,143,.1);color:#d43a74;}
.ub-decision-overlay.dark .ub-decision-theme-sweet{background:#24101c;border-color:#4a2a6a;color:#f0c8d8;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ub-decision-head{border-bottom-color:#3a1a4a;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ub-decision-title{color:#ff9db8;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ub-decision-close{color:#c880a0;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ub-decision-close:hover{background:rgba(255,157,184,.1);}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-block{color:#ff9db8;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-row{border-bottom-color:#3a1a4a;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-tag{background:#3a1a28;color:#ff9db8;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-tag.ww-tag-heard{background:#4a2a38;color:#ffc0d0;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-tag.ww-tag-known{background:#e7548f;color:#fff;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-desc{color:#c090b0;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-btn{background:transparent;border-color:#4a2a3a;color:#e8c0cc;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-btn:hover{background:rgba(255,120,170,.12);}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-fill,.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-ack{background:#e7548f;border-color:#e7548f;color:#fff;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-fill:hover,.ub-decision-overlay.dark .ub-decision-theme-sweet .ww-decision-ack:hover{background:#ff6ea0;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .map-location-candidate{background:rgba(0,0,0,.3);border-color:#4a2a3a;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .map-location-candidate:hover{border-color:#e7548f;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .map-location-actions button{background:transparent;border-color:#4a2a3a;color:#e8c0cc;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .cycle-form-btn{background:rgba(0,0,0,.28);border-color:#4a2a3a;color:#f0c8d8;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .cycle-form-btn:hover{background:rgba(255,120,170,.1);border-color:#e7548f;}
.ub-decision-overlay.dark .ub-decision-theme-sweet .cycle-form-btn.cycle-form-single{background:#e7548f;border-color:#e7548f;color:#fff;}

/* ===== 决策弹窗 · xianxia 云海仙踪（玉简） ===== */
.ub-decision-theme-xianxia{background:#f6fbfe;color:#12303f;border:1px solid #8fc3dd;border-radius:4px;box-shadow:0 4px 14px rgba(46,138,176,.18);}
.ub-decision-theme-xianxia .ub-decision-head{border-bottom-color:#a9cfdf;}
.ub-decision-theme-xianxia .ub-decision-title{color:#1e5a75;text-shadow:0 0 8px rgba(94,200,216,.4);letter-spacing:2px;}
.ub-decision-theme-xianxia .ub-decision-close{color:#4a7a92;}
.ub-decision-theme-xianxia .ub-decision-close:hover{background:rgba(46,138,176,.1);}
.ub-decision-theme-xianxia .ww-decision-block{color:#1e5a75;}
.ub-decision-theme-xianxia .ww-decision-row{border-bottom:1px dashed #a9cfdf;}
.ub-decision-theme-xianxia .ww-decision-tag{background:#a9cfdf;color:#0d3848;border-radius:4px;}
.ub-decision-theme-xianxia .ww-decision-tag.ww-tag-heard{background:#a9cfdf;color:#0d3848;}
.ub-decision-theme-xianxia .ww-decision-tag.ww-tag-known{background:#1e5a75;color:#eef7fb;}
.ub-decision-theme-xianxia .ww-decision-desc{color:#4a7a92;}
.ub-decision-theme-xianxia .ww-decision-btn{border-radius:4px;background:transparent;border:1px solid #2e7ea0;color:#2c6078;}
.ub-decision-theme-xianxia .ww-decision-btn:hover{background:rgba(46,138,176,.1);}
.ub-decision-theme-xianxia .ww-decision-fill,.ub-decision-theme-xianxia .ww-decision-ack{background:#2e8ab0;border-color:#2e8ab0;color:#eef7fb;}
.ub-decision-theme-xianxia .ww-decision-fill:hover,.ub-decision-theme-xianxia .ww-decision-ack:hover{background:#1e6a8a;}
.ub-decision-theme-xianxia .map-location-candidate{background:rgba(255,255,255,.72);border-color:#a9cfdf;border-radius:4px;}
.ub-decision-theme-xianxia .map-location-candidate:hover{border-color:#2e8ab0;}
.ub-decision-theme-xianxia .map-location-actions button{background:#fff;border-color:#a9cfdf;color:#12303f;}
.ub-decision-theme-xianxia .cycle-form-btn{background:rgba(255,255,255,.72);border-color:#a9cfdf;color:#12303f;border-radius:4px;}
.ub-decision-theme-xianxia .cycle-form-btn:hover{background:rgba(94,169,216,.12);border-color:#2e8ab0;}
.ub-decision-theme-xianxia .cycle-form-btn.cycle-form-single{background:#2e8ab0;border-color:#2e8ab0;color:#eef7fb;}
.ub-decision-theme-xianxia .cycle-form-btn.cycle-form-single:hover{background:#1e6a8a;}
.ub-decision-theme-xianxia .ub-decision-error{background:rgba(46,138,176,.1);color:#1e5a75;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia{background:#101c22;color:#b8e8f0;border-color:#1e4a58;box-shadow:none;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ub-decision-head{border-bottom-color:#163844;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ub-decision-title{color:#7ee0e8;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ub-decision-close{color:#5d8fa0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ub-decision-close:hover{background:rgba(126,224,232,.1);}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-block{color:#7ee0e8;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-row{border-bottom-color:#163844;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-tag{background:#0d242e;color:#7ee0e8;border:1px solid #163844;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-tag.ww-tag-heard{background:#12303f;color:#9fe8f5;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-tag.ww-tag-known{background:#2e8ab0;color:#04141a;border-color:#2e8ab0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-desc{color:#5d8fa0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-btn{background:transparent;border-color:#2e7ea0;color:#7ee0e8;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-btn:hover{background:rgba(46,138,176,.15);}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-fill,.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-ack{background:#2e8ab0;border-color:#2e8ab0;color:#04141a;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-fill:hover,.ub-decision-overlay.dark .ub-decision-theme-xianxia .ww-decision-ack:hover{background:#5ab0d0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .map-location-candidate{background:rgba(0,0,0,.35);border-color:#163844;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .map-location-candidate:hover{border-color:#2e8ab0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .map-location-actions button{background:transparent;border-color:#1e4a58;color:#b8e8f0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .cycle-form-btn{background:rgba(0,0,0,.35);border-color:#163844;color:#b8e8f0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .cycle-form-btn:hover{background:rgba(46,138,176,.12);border-color:#2e8ab0;}
.ub-decision-overlay.dark .ub-decision-theme-xianxia .cycle-form-btn.cycle-form-single{background:#2e8ab0;border-color:#2e8ab0;color:#04141a;}
`.trim();
