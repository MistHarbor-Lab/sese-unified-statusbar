// styles/beyond-lens-base.ts
// 主界面「镜头之外」六主题样式（2026-08-21 拍板；三轮：按钮形制完全复用人物切换按钮类）：
// 纯色底+描边+适度光晕，禁渐变；主题作用域 beyond-theme-${style}（面板根上带）。
// 按钮 .ub-beyond-tab 只做间距微调——形制/active/深浅色适配全部由主题 CSS 的人物按钮类
// （.tab/.spine-label/.char-select-btn/.xx-char-pill/.bridge-role-chip）继承，与人物按钮完全一致。
// 面板字号全部走 var(--ub-content-font-*)（状态栏内容缩放），与 #ac-content 正文统一。
export const beyondLensBaseCSS = /* css */ `
/* ===== 镜头之外 · 共享布局（无配色） ===== */
.ub-beyond-tab{flex:0 0 auto;margin-left:4px;white-space:nowrap;cursor:pointer;}
.ub-beyond-panel{padding:10px 14px 14px;animation:ub-beyond-in .2s ease;}
@keyframes ub-beyond-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.ub-beyond-sec{margin-bottom:10px;}
.ub-beyond-sec-title{display:flex;align-items:baseline;gap:7px;font-size:var(--ub-content-font-11,12.1px);font-weight:700;letter-spacing:2.5px;padding-bottom:4px;margin-bottom:6px;border-bottom:2px solid;}
.ub-beyond-sec-title em{font-style:normal;font-size:var(--ub-content-font-10,11px);letter-spacing:1px;font-weight:400;}
.ub-beyond-reshuffle{margin-left:auto;border:1px solid;border-radius:8px;background:transparent;font-family:inherit;font-size:var(--ub-content-font-10,11px);padding:1px 8px 2px;cursor:pointer;letter-spacing:1px;}
/* F57(第十二轮)：触屏命中区补足（原≈16px，一次误触换掉整批角色）；桌面观感不变 */
@media (pointer:coarse) { .ub-beyond-reshuffle { min-height: 44px; padding: 0 12px; display: inline-flex; align-items: center; } }
.ub-beyond-rumor{padding:6px 9px;margin-bottom:6px;border:1px solid;border-radius:7px;cursor:pointer;}
.ub-beyond-rumor:last-child{margin-bottom:0;}
.ub-beyond-rumor-top{display:flex;align-items:center;gap:6px;font-size:var(--ub-content-font-12,13.2px);font-weight:600;}
.ub-beyond-level{font-style:normal;font-size:var(--ub-content-font-10,11px);padding:0 6px;border-radius:7px;letter-spacing:1px;flex:0 0 auto;}
.ub-beyond-rumor-time{font-style:normal;font-size:var(--ub-content-font-10,11px);margin-left:auto;opacity:.7;}
.ub-beyond-rumor-body{font-size:var(--ub-content-font-11,12.1px);line-height:1.55;margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.ub-beyond-rumor-status{font-size:var(--ub-content-font-10,11px);margin-top:2px;opacity:.8;letter-spacing:.5px;}
.ub-beyond-char{padding:7px 9px;margin-bottom:6px;border-radius:7px;border:1px solid;cursor:pointer;}
.ub-beyond-char:last-child{margin-bottom:0;}
.ub-beyond-char-head{display:flex;align-items:center;gap:6px;}
.ub-beyond-char-name{font-weight:700;font-size:var(--ub-content-font-12,13.2px);letter-spacing:.5px;border:none;background:transparent;padding:0;cursor:pointer;font-family:inherit;text-decoration:none;}
.ub-beyond-char-name:hover{text-decoration:underline;}
.ub-beyond-char-head .ww-time-badge{font-style:normal;font-size:var(--ub-content-font-10,11px);opacity:.65;margin-left:auto;}
.ub-beyond-char-act{font-size:var(--ub-content-font-11,12.1px);line-height:1.5;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;opacity:.92;}
.ub-beyond-idle{font-style:italic;opacity:.75;}
.ub-beyond-thread{display:flex;align-items:center;gap:6px;font-size:var(--ub-content-font-10,11px);margin-top:4px;}
.ub-beyond-thread-progress{font-size:var(--ub-content-font-10,11px);margin-top:1px;opacity:.85;letter-spacing:.5px;}
.ub-beyond-thread b{font-weight:600;flex:0 0 auto;}
.ub-beyond-thread-text{flex:0 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ub-beyond-bar{flex:1 1 40px;min-width:28px;max-width:70px;height:4px;border-radius:2px;overflow:hidden;}
.ub-beyond-bar span{display:block;height:100%;}
.ub-beyond-pct{font-style:normal;font-size:var(--ub-content-font-10,11px);flex:0 0 auto;opacity:.85;}
.ub-beyond-empty{padding:18px 0;text-align:center;font-size:var(--ub-content-font-12,13.2px);opacity:.6;letter-spacing:2px;}

/* ═══ ancient 古风：米白 · 朱砂（信笺质感） ═══ */
.beyond-theme-ancient .ub-beyond-panel{background:#F8F4EA;color:#4a3828;}
.beyond-theme-ancient .ub-beyond-sec-title{border-color:#d8c8a8;color:#9F352D;}
.beyond-theme-ancient .ub-beyond-sec-title em{color:#9a8a68;}
.beyond-theme-ancient .ub-beyond-reshuffle{color:#9F352D;border-color:#c9a06a;}
.beyond-theme-ancient .ub-beyond-rumor{background:rgba(255,253,244,.75);border-color:#d8c8a8;}
.beyond-theme-ancient .ub-beyond-rumor-top{color:#5a4a32;}
.beyond-theme-ancient .ub-beyond-rumor-body{color:#4a3828;}
.beyond-theme-ancient .ub-beyond-rumor-status{color:#8a6e4e;}
.beyond-theme-ancient .ub-beyond-level-heard{background:#d8c8a8;color:#4a3828;}
.beyond-theme-ancient .ub-beyond-level-known{background:#9F352D;color:#f5edd6;}
.beyond-theme-ancient .ub-beyond-char{background:rgba(255,253,244,.75);border-color:#d8c8a8;}
.beyond-theme-ancient .ub-beyond-char-name{color:#9F352D;}
.beyond-theme-ancient .ub-beyond-char-act{color:#4a3828;}
.beyond-theme-ancient .ub-beyond-thread{color:#8a6e4e;}
.beyond-theme-ancient .ub-beyond-bar{background:#e4d8bc;}
.beyond-theme-ancient .ub-beyond-bar span{background:#9F352D;}
.beyond-theme-ancient .ub-beyond-empty{color:#8a6e4e;}

/* ═══ flirtatious 瑟瑟：白粉 · 霓虹粉 ═══ */
.beyond-theme-flirtatious .ub-beyond-panel{background:#fff9fb;color:#5a3a52;}
.beyond-theme-flirtatious .ub-beyond-sec-title{border-color:#f0d4e4;color:#c4489c;}
.beyond-theme-flirtatious .ub-beyond-sec-title em{color:#b48ba8;}
.beyond-theme-flirtatious .ub-beyond-reshuffle{color:#c4489c;border-color:#e0a8cc;}
.beyond-theme-flirtatious .ub-beyond-rumor{background:#fff;border-color:#f2d8ea;box-shadow:0 1px 4px rgba(196,72,156,.08);}
.beyond-theme-flirtatious .ub-beyond-rumor-top{color:#8a4068;}
.beyond-theme-flirtatious .ub-beyond-rumor-body{color:#5a4052;}
.beyond-theme-flirtatious .ub-beyond-rumor-status{color:#a06a92;}
.beyond-theme-flirtatious .ub-beyond-level-heard{background:#fde3f2;color:#c4489c;}
.beyond-theme-flirtatious .ub-beyond-level-known{background:#c4489c;color:#fff;}
.beyond-theme-flirtatious .ub-beyond-char{background:#fff;border-color:#f2d8ea;box-shadow:0 1px 4px rgba(196,72,156,.08);}
.beyond-theme-flirtatious .ub-beyond-char-name{color:#c4489c;}
.beyond-theme-flirtatious .ub-beyond-char-act{color:#5a3a52;}
.beyond-theme-flirtatious .ub-beyond-thread{color:#a06a92;}
.beyond-theme-flirtatious .ub-beyond-bar{background:#f7e2f0;}
.beyond-theme-flirtatious .ub-beyond-bar span{background:#c4489c;}
.beyond-theme-flirtatious .ub-beyond-empty{color:#b48ba8;}

/* ═══ minimal 萦绕：主题变量驱动（面板与 .char-card 同框制；正文/标签走 --ub-font-minimal-* 字体分层，与人物界面一致） ═══ */
.ub-beyond-panel.beyond-theme-minimal{background:transparent;border:1px solid var(--card-border);padding:20px 24px 24px;border-radius:0 2px 2px 2px;color:var(--text-color);font-family:var(--ub-font-minimal-body);}
.beyond-theme-minimal .ub-beyond-sec-title{border-bottom-width:1px;border-color:var(--tag-border);color:var(--text-color);letter-spacing:2px;font-family:var(--ub-font-minimal-body);}
.beyond-theme-minimal .ub-beyond-sec-title em{color:var(--secondary-text);letter-spacing:2px;font-family:var(--ub-font-minimal-label);}
.beyond-theme-minimal .ub-beyond-reshuffle{color:var(--secondary-text);border-color:var(--border-color);border-radius:2px;font-family:var(--ub-font-minimal-label);}
.beyond-theme-minimal .ub-beyond-rumor{background:var(--bg-color);border-color:var(--card-border);border-radius:1px;}
.beyond-theme-minimal .ub-beyond-rumor:hover{border-color:var(--border-color);}
.beyond-theme-minimal .ub-beyond-rumor-top{color:var(--text-color);}
.beyond-theme-minimal .ub-beyond-rumor-body{color:var(--text-color);}
.beyond-theme-minimal .ub-beyond-rumor-status{color:var(--secondary-text);}
.beyond-theme-minimal .ub-beyond-level{font-family:var(--ub-font-minimal-label);letter-spacing:1px;}
.beyond-theme-minimal .ub-beyond-level-heard{background:transparent;border:1px solid var(--tag-border);color:var(--secondary-text);}
.beyond-theme-minimal .ub-beyond-level-known{background:var(--text-color);color:var(--bg-color);}
.beyond-theme-minimal .ub-beyond-char{background:var(--bg-color);border-color:var(--card-border);border-radius:1px;}
.beyond-theme-minimal .ub-beyond-char:hover{border-color:var(--border-color);}
.beyond-theme-minimal .ub-beyond-char-name{color:var(--text-color);}
.beyond-theme-minimal .ub-beyond-char-act{color:var(--text-color);}
.beyond-theme-minimal .ub-beyond-thread{color:var(--secondary-text);}
.beyond-theme-minimal .ub-beyond-bar{background:var(--tag-border);}
.beyond-theme-minimal .ub-beyond-bar span{background:var(--text-color);}
.beyond-theme-minimal .ub-beyond-empty{color:var(--secondary-text);font-family:var(--ub-font-minimal-label);letter-spacing:3px;}

/* ═══ sweet 甜恋：粉糖 · 大圆角 ═══ */
.beyond-theme-sweet .ub-beyond-panel{background:#fff6fa;color:#7a3b54;}
.beyond-theme-sweet .ub-beyond-sec-title{border-color:#f6c2d8;color:#e7548f;}
.beyond-theme-sweet .ub-beyond-sec-title em{color:#d8a0b8;}
.beyond-theme-sweet .ub-beyond-reshuffle{color:#e7548f;border-color:#f2a8c4;}
.beyond-theme-sweet .ub-beyond-rumor{background:#fff;border:1px solid #f6c2d8;border-radius:10px;box-shadow:0 2px 6px rgba(231,84,143,.08);}
.beyond-theme-sweet .ub-beyond-rumor-top{color:#d84a8a;}
.beyond-theme-sweet .ub-beyond-rumor-body{color:#8a5a70;}
.beyond-theme-sweet .ub-beyond-rumor-status{color:#b08aa0;}
.beyond-theme-sweet .ub-beyond-level-heard{background:#fde3ec;color:#e7548f;}
.beyond-theme-sweet .ub-beyond-level-known{background:#e7548f;color:#fff;}
.beyond-theme-sweet .ub-beyond-char{background:#fff;border:1px solid #f6c2d8;border-radius:10px;box-shadow:0 2px 6px rgba(231,84,143,.08);}
.beyond-theme-sweet .ub-beyond-char-name{color:#e7548f;}
.beyond-theme-sweet .ub-beyond-char-act{color:#8a5a70;}
.beyond-theme-sweet .ub-beyond-thread{color:#b08aa0;}
.beyond-theme-sweet .ub-beyond-bar{background:#fde8f0;}
.beyond-theme-sweet .ub-beyond-bar span{background:#e7548f;}
.beyond-theme-sweet .ub-beyond-empty{color:#d8a0b8;}

/* ═══ xianxia 云海仙踪：青白 · 玉色灵光 ═══ */
.beyond-theme-xianxia .ub-beyond-panel{background:#f2fafd;color:#2c6078;}
.beyond-theme-xianxia .ub-beyond-sec-title{border-color:#c4e2f0;color:#1e5a75;}
.beyond-theme-xianxia .ub-beyond-sec-title em{color:#6a9cb0;}
.beyond-theme-xianxia .ub-beyond-reshuffle{color:#1e5a75;border-color:#9ccfe4;}
.beyond-theme-xianxia .ub-beyond-rumor{background:rgba(255,255,255,.85);border-color:#9ccfe4;box-shadow:0 0 8px rgba(94,200,216,.18);}
.beyond-theme-xianxia .ub-beyond-rumor-top{color:#1e5a75;}
.beyond-theme-xianxia .ub-beyond-rumor-body{color:#2c6078;}
.beyond-theme-xianxia .ub-beyond-rumor-status{color:#4a7a92;}
.beyond-theme-xianxia .ub-beyond-level-heard{background:#d8ecf5;color:#1e5a75;}
.beyond-theme-xianxia .ub-beyond-level-known{background:#1e5a75;color:#eef7fb;}
.beyond-theme-xianxia .ub-beyond-char{background:rgba(255,255,255,.85);border-color:#9ccfe4;box-shadow:0 0 8px rgba(94,200,216,.14);}
.beyond-theme-xianxia .ub-beyond-char-name{color:#1e5a75;}
.beyond-theme-xianxia .ub-beyond-char-act{color:#2c6078;}
.beyond-theme-xianxia .ub-beyond-thread{color:#4a7a92;}
.beyond-theme-xianxia .ub-beyond-bar{background:#d8ecf5;}
.beyond-theme-xianxia .ub-beyond-bar span{background:#2e8ab0;}
.beyond-theme-xianxia .ub-beyond-empty{color:#6a9cb0;}

/* ═══ bridge 舰桥：深青全息 ═══ */
.beyond-theme-bridge .ub-beyond-panel{background:#0e232b;color:#9fe8f5;font-family:Consolas,'Courier New',monospace;}
.beyond-theme-bridge .ub-beyond-sec-title{border-color:#1e5a6b;color:#8eeaff;letter-spacing:2px;}
.beyond-theme-bridge .ub-beyond-sec-title em{color:#4fb8d4;}
.beyond-theme-bridge .ub-beyond-reshuffle{color:#8eeaff;border-color:#23758a;border-radius:2px;}
.beyond-theme-bridge .ub-beyond-rumor{background:rgba(35,117,138,.1);border-color:#1e5a6b;border-radius:2px;}
.beyond-theme-bridge .ub-beyond-rumor-top{color:#8eeaff;}
.beyond-theme-bridge .ub-beyond-rumor-body{color:#9fe8f5;}
.beyond-theme-bridge .ub-beyond-rumor-status{color:#5d8fa0;}
.beyond-theme-bridge .ub-beyond-level-heard{background:#0d242e;color:#8eeaff;border:1px solid #1e5a6b;border-radius:2px;}
.beyond-theme-bridge .ub-beyond-level-known{background:#23758a;color:#04141a;border-radius:2px;}
.beyond-theme-bridge .ub-beyond-char{background:rgba(10,20,24,.6);border-color:#1e5a6b;border-radius:2px;}
.beyond-theme-bridge .ub-beyond-char-name{color:#8eeaff;}
.beyond-theme-bridge .ub-beyond-char-act{color:#9fe8f5;}
.beyond-theme-bridge .ub-beyond-thread{color:#5d8fa0;}
.beyond-theme-bridge .ub-beyond-bar{background:#0d242e;}
.beyond-theme-bridge .ub-beyond-bar span{background:#5ef0c0;box-shadow:0 0 6px rgba(94,240,192,.6);}
.beyond-theme-bridge .ub-beyond-empty{color:#4fb8d4;}

/* ═══ 深色（4 主题 .dark 祖先；minimal 走 body.dark-mode 变量；bridge 本就暗；按钮随人物按钮类自动适配） ═══ */
.dark .beyond-theme-ancient .ub-beyond-panel{background:#1B1916;color:#d8ccb8;}
.dark .beyond-theme-ancient .ub-beyond-rumor,.dark .beyond-theme-ancient .ub-beyond-char{background:rgba(0,0,0,.35);border-color:#3a2e1c;}
.dark .beyond-theme-ancient .ub-beyond-rumor-top,.dark .beyond-theme-ancient .ub-beyond-char-name{color:#c9a06a;}
.dark .beyond-theme-ancient .ub-beyond-rumor-body,.dark .beyond-theme-ancient .ub-beyond-char-act{color:#d8ccb8;}
.dark .beyond-theme-ancient .ub-beyond-sec-title{color:#c9a06a;}
.dark .beyond-theme-xianxia .ub-beyond-panel{background:#0f2026;color:#a8c8d0;}
.dark .beyond-theme-xianxia .ub-beyond-rumor,.dark .beyond-theme-xianxia .ub-beyond-char{background:rgba(0,0,0,.35);border-color:#1e4a58;}
.dark .beyond-theme-xianxia .ub-beyond-rumor-top,.dark .beyond-theme-xianxia .ub-beyond-char-name{color:#7ee0e8;}
.dark .beyond-theme-xianxia .ub-beyond-rumor-body,.dark .beyond-theme-xianxia .ub-beyond-char-act{color:#a8c8d0;}
.dark .beyond-theme-flirtatious .ub-beyond-panel{background:#120620;color:#c8b8c8;}
.dark .beyond-theme-flirtatious .ub-beyond-rumor,.dark .beyond-theme-flirtatious .ub-beyond-char{background:rgba(0,0,0,.35);border-color:#3a1a42;}
.dark .beyond-theme-flirtatious .ub-beyond-rumor-top,.dark .beyond-theme-flirtatious .ub-beyond-char-name{color:#ffb4e0;}
.dark .beyond-theme-flirtatious .ub-beyond-rumor-body,.dark .beyond-theme-flirtatious .ub-beyond-char-act{color:#c8b8c8;}
.dark .beyond-theme-sweet .ub-beyond-panel{background:#1a0c14;color:#d8b0c0;}
.dark .beyond-theme-sweet .ub-beyond-rumor,.dark .beyond-theme-sweet .ub-beyond-char{background:rgba(0,0,0,.35);border-color:#3a1a28;}
.dark .beyond-theme-sweet .ub-beyond-rumor-top,.dark .beyond-theme-sweet .ub-beyond-char-name{color:#ffb0c8;}
.dark .beyond-theme-sweet .ub-beyond-rumor-body,.dark .beyond-theme-sweet .ub-beyond-char-act{color:#d8b0c0;}
/* ═══ ios 灵动玻璃：系统灰面 · 系统蓝（纯色，token 驱动） ═══ */
.beyond-theme-ios .ub-beyond-panel{background:var(--ios-surface-solid,#fff);color:var(--ios-label,#1c1c1e);font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif);border:1px solid var(--ios-sep,rgba(60,60,67,.12));border-radius:18px;box-shadow:var(--ios-shadow-soft,0 4px 18px rgba(0,0,0,.08));}
.beyond-theme-ios .ub-beyond-sec-title{border-color:var(--ios-sep,rgba(60,60,67,.12));color:var(--ios-label,#1c1c1e);letter-spacing:0;font-weight:700;}
.beyond-theme-ios .ub-beyond-sec-title em{color:var(--ios-label-2,rgba(60,60,67,.62));font-style:normal;letter-spacing:.5px;}
.beyond-theme-ios .ub-beyond-reshuffle{color:var(--ios-accent,#007aff);border-color:var(--ios-sep,rgba(60,60,67,.12));border-radius:999px;background:var(--ios-tint,rgba(0,122,255,.1));}
.beyond-theme-ios .ub-beyond-rumor{background:var(--ios-fill,rgba(120,120,128,.1));border-color:transparent;border-radius:14px;}
.beyond-theme-ios .ub-beyond-rumor-top{color:var(--ios-label,#1c1c1e);font-weight:600;}
.beyond-theme-ios .ub-beyond-rumor-body{color:var(--ios-label,#1c1c1e);}
.beyond-theme-ios .ub-beyond-rumor-status{color:var(--ios-label-2,rgba(60,60,67,.62));}
.beyond-theme-ios .ub-beyond-level-heard{background:var(--ios-tint,rgba(0,122,255,.1));color:var(--ios-accent,#007aff);border-radius:999px;}
.beyond-theme-ios .ub-beyond-level-known{background:var(--ios-accent,#007aff);color:#fff;border-radius:999px;}
.beyond-theme-ios .ub-beyond-char{background:var(--ios-surface-solid,#fff);border-color:var(--ios-sep,rgba(60,60,67,.12));border-radius:14px;box-shadow:var(--ios-shadow-soft,0 4px 18px rgba(0,0,0,.08));}
.beyond-theme-ios .ub-beyond-char-name{color:var(--ios-accent,#007aff);font-weight:600;}
.beyond-theme-ios .ub-beyond-char-act{color:var(--ios-label,#1c1c1e);}
.beyond-theme-ios .ub-beyond-thread{color:var(--ios-label-2,rgba(60,60,67,.62));}
.beyond-theme-ios .ub-beyond-bar{background:var(--ios-fill-2,rgba(120,120,128,.16));border-radius:3px;}
.beyond-theme-ios .ub-beyond-bar span{background:var(--ios-accent,#007aff);border-radius:3px;}
.beyond-theme-ios .ub-beyond-empty{color:var(--ios-label-2,rgba(60,60,67,.62));}
.dark .beyond-theme-ios .ub-beyond-panel{background:var(--ios-surface-solid,#1c1c1e);color:var(--ios-label,#fff);}
.dark .beyond-theme-ios .ub-beyond-rumor{background:var(--ios-fill,rgba(120,120,128,.24));}
.dark .beyond-theme-ios .ub-beyond-char{background:var(--ios-surface-solid,#1c1c1e);}
.dark .beyond-theme-ios .ub-beyond-rumor-top,.dark .beyond-theme-ios .ub-beyond-char-name{color:var(--ios-label,#fff);}
.dark .beyond-theme-ios .ub-beyond-rumor-body,.dark .beyond-theme-ios .ub-beyond-char-act{color:var(--ios-label,#fff);}
.dark .beyond-theme-ios .ub-beyond-level-heard{background:rgba(10,132,255,.2);color:#64d2ff;}
.dark .beyond-theme-ios .ub-beyond-level-known{background:#0a84ff;color:#fff;}
`;
