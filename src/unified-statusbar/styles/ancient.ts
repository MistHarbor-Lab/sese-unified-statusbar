// ===== 鍙ら鐏垫劅鐘舵€佹爮 - 瀹屾暣CSS =====
import { baseCSS } from './base';
import { readingThemeCSS } from './reading-theme-base';
import { literaryBaseCSS } from './literary-base';
const ancientCoreCSS = /* css */ `
#ac-statusbar-wrapper,:where(#ac-statusbar-wrapper *){margin:0;padding:0;box-sizing:border-box}
:root{
  /* === ub-literary-v1 语义 token（古风素绢朱印 · 浅色）=== */
  --ub-canvas:#EEE9DE;--ub-surface-1:#F8F4EA;--ub-surface-2:#F1EBDD;--ub-surface-3:#E8DFCF;
  --ub-text-1:#29231D;--ub-text-2:#5A5045;--ub-text-3:#766B5F;--ub-text-on-accent:#FFFFFF;
  --ub-border-subtle:#D8CDBB;--ub-border:#C1B29D;--ub-border-strong:#8C7864;
  --ub-accent:#9F352D;--ub-accent-hover:#812820;--ub-accent-soft:rgba(159,53,45,.08);
  --ub-focus:#9F352D;--ub-info:#3C6370;--ub-success:#3F6A52;--ub-warning:#8A5B14;--ub-danger:#A13B34;
  --ub-nsfw:var(--lust);--ub-nsfw-soft:var(--lust-bg-faint);
  --ub-shadow-1:0 8px 28px rgba(58,45,31,.12);--ub-shadow-2:0 12px 34px rgba(58,45,31,.16);
  --ub-radius-shell:4px;--ub-radius-panel:3px;--ub-radius-control:3px;
  /* === 旧变量别名（核心语义；装饰变量保留字面量，Task 7 收敛）=== */
  --card:var(--ub-surface-1);--card-deep:var(--ub-surface-2);--card-light:var(--ub-surface-1);
  --accent:var(--ub-accent);--accent-deep:var(--ub-accent-hover);--accent-soft:#e8c8b8;--accent-glow:rgba(181,54,46,0.10);
  --lust:#6b4226;--lust-deep:#4a2c18;--lust-soft:#d4b896;--lust-glow:rgba(107,66,38,0.10);
  --text:var(--ub-text-1);--text-sub:var(--ub-text-2);--text-muted:var(--ub-text-3);
  --divider:var(--ub-border);--divider-light:var(--ub-border-subtle);--bg-alt:var(--ub-surface-3);
  --shimmer-a:rgba(255,248,230,0.35);--shimmer-transparent:transparent;
  --lust-bg-faint:rgba(107,66,38,0.04);--lust-bg:rgba(107,66,38,0.06);
  --lust-bg-hover:rgba(107,66,38,0.1);--lust-bg-active:rgba(107,66,38,0.12);
  --lust-bg-strong:rgba(107,66,38,0.15);--lust-border:rgba(107,66,38,0.18);
  --lust-border-soft:rgba(107,66,38,0.22);
  --accent-bg:rgba(181,54,46,0.08);--accent-bg-faint:rgba(181,54,46,0.06);
  --accent-bg-hover:rgba(181,54,46,0.12);
  --gold:#c9a84c;--gold-glow:rgba(201,168,76,0.12);
  --ink:#2c1810;--ink-light:rgba(44,24,16,0.06);
  --seal-red:#b5362e;--seal-glow:rgba(181,54,46,0.15);
  --roller:#8b6e4e;--roller-dark:#6b5030;--roller-light:#a88860;
  --paper-stain:rgba(139,110,78,0.04);
  --bamboo:#c9b880;--bamboo-dark:#a89860;--bamboo-line:#8b7840;
  --rope:#7a6030;--red-thread:#c04040;
  /* === 缁熶竴鍙橀噺鍒悕锛堜緵 base.ts 鍏变韩CSS浣跨敤锛?=== */
  --ub-overlay-bg:rgba(44,24,16,0.5);
  --ub-scrollbar-thumb:var(--divider);
  --ub-scrollbar-thumb-hover:var(--lust-soft);
  --ub-text-muted:var(--text-muted);
  --ub-bg-card:var(--card);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接 → 主题级补同一组变量（浅/深各一套，值取本主题 token）。
     古风 --ub-accent 已是文学主题色且与日历桥接同值（--accent:var(--ub-accent)），此处不再重复。 */
  --ub-text:var(--text,#2c1810);--ub-divider:var(--divider,#c8b898);--ub-hover-bg:var(--ink-light,rgba(44,24,16,0.06));
  --ub-popup-radius:2px;
  --ub-popup-shadow:0 8px 32px rgba(44,24,16,0.3),4px 4px 0 var(--roller);
  --ub-popup-border:1px solid var(--divider);
  --ub-popup-bg:var(--card);
  --ub-popup-head-bg:linear-gradient(180deg,var(--card-deep),var(--card));
  --ub-popup-head-border:2px solid var(--roller);
  --ub-btn-radius:4px;
  --ub-toggle-width:44px;--ub-toggle-height:24px;--ub-toggle-knob:20px;
  --ub-ft-ring-start:#e2c36c;--ub-ft-ring-end:#c24a3f;--ub-ft-ring-glow:rgba(201,168,76,.34);
  /* === 立绘主题变量 === */
  --portrait-empty-color:#a8896a;
  --portrait-bg:rgba(255,250,235,.5);
  --portrait-border:#8b6e4e;
  --portrait-radius:4px;
  --card-bg:var(--card);
}
#ac-content.dark,
.nsfw-overlay.dark,
.panel-overlay.dark,
.settings-overlay.dark,
#ac-options-bar-floating.dark{
  /* === ub-literary-v1 语义 token（古风 · 深色）=== */
  --ub-canvas:#141311;--ub-surface-1:#1B1916;--ub-surface-2:#23201B;--ub-surface-3:#2B271F;
  --ub-text-1:#E9E1D3;--ub-text-2:#C9BBA8;--ub-text-3:#A4937E;--ub-text-on-accent:#211713;
  --ub-border-subtle:#3F382F;--ub-border:#5C5042;--ub-border-strong:#8B7761;
  --ub-accent:#E16A5D;--ub-accent-hover:#F07B6D;--ub-accent-soft:rgba(225,106,93,.11);
  --ub-focus:#D3B36B;--ub-info:#7EB2C0;--ub-success:#77B18C;--ub-warning:#D7AC5C;--ub-danger:#E4776D;
  --ub-nsfw:var(--lust);--ub-nsfw-soft:var(--lust-bg-faint);
  --ub-shadow-1:0 8px 28px rgba(0,0,0,.4);--ub-shadow-2:0 12px 34px rgba(0,0,0,.5);
  --ub-radius-shell:4px;--ub-radius-panel:3px;--ub-radius-control:3px;
  /* === 旧变量别名（深色）=== */
  --card:var(--ub-surface-1);--card-deep:var(--ub-surface-2);--card-light:var(--ub-surface-3);
  --accent:var(--ub-accent);--accent-deep:var(--ub-accent-hover);--accent-soft:#3a1a14;--accent-glow:rgba(212,86,78,0.12);
  --lust:#c9a06a;--lust-deep:#ddb87a;--lust-soft:#2a1e12;--lust-glow:rgba(201,160,106,0.12);
  --text:var(--ub-text-1);--text-sub:var(--ub-text-2);--text-muted:var(--ub-text-3);
  --divider:var(--ub-border);--divider-light:var(--ub-border-subtle);--bg-alt:var(--ub-surface-3);
  --shimmer-a:rgba(201,168,76,0.06);--shimmer-transparent:rgba(201,168,76,0.06);
  --lust-bg-faint:rgba(201,160,106,0.04);--lust-bg:rgba(201,160,106,0.06);
  --lust-bg-hover:rgba(201,160,106,0.1);--lust-bg-active:rgba(201,160,106,0.12);
  --lust-bg-strong:rgba(201,160,106,0.15);--lust-border:rgba(201,160,106,0.18);
  --lust-border-soft:rgba(201,160,106,0.22);
  --accent-bg:rgba(212,86,78,0.1);--accent-bg-faint:rgba(212,86,78,0.08);
  --accent-bg-hover:rgba(212,86,78,0.15);
  --gold:#d4b060;--gold-glow:rgba(212,176,96,0.12);
  --ink:#e8dcc8;--ink-light:rgba(232,220,200,0.06);
  --seal-red:#d4564e;--seal-glow:rgba(212,86,78,0.18);
  --roller:#5a4a30;--roller-dark:#3a2e18;--roller-light:#7a6a48;
  --paper-stain:rgba(90,74,48,0.06);
  --bamboo:#3a3228;--bamboo-dark:#2a2418;--bamboo-line:#4a4030;
  --rope:#5a4a30;--red-thread:#d4564e;
  --ub-overlay-bg:rgba(0,0,0,0.55);
  --ub-scrollbar-thumb:var(--divider);
  --ub-scrollbar-thumb-hover:var(--lust-soft);
  --ub-text-muted:var(--text-muted);
  --ub-bg-card:var(--card);
  /* 日历兄弟弹窗变量·深色（字面量兜底；:root 处已按浅色完成替换，深色必须重声明，见 ios.ts 同款注释） */
  --ub-text:var(--text,#e8dcc8);--ub-divider:var(--divider,#3a3228);--ub-hover-bg:rgba(255,255,255,0.05);
  --ub-popup-radius:2px;
  --ub-popup-shadow:0 8px 32px rgba(0,0,0,0.4),4px 4px 0 var(--roller);
  --ub-popup-border:1px solid var(--divider);
  --ub-popup-bg:var(--card);
  --ub-popup-head-bg:linear-gradient(180deg,var(--card-deep),var(--card));
  --ub-popup-head-border:2px solid var(--roller);
  /* === 立绘主题变量（深色覆盖） === */
  --portrait-bg:rgba(40,30,20,.4);
  --portrait-empty-color:#7a6a4a;
  --card-bg:var(--card);
}
#ac-statusbar-wrapper{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun','ZCOOL XiaoWei','Kaiti SC','STKaiti','KaiTi','楷体',serif;background:transparent;color:var(--text);padding:0;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}

/* ===== 鍗疯酱瀹瑰櫒 ===== */
.book{
  width:100%;position:relative;overflow:visible;
  background:var(--card);
  background-image:
    repeating-linear-gradient(0deg,transparent,transparent 2px,var(--paper-stain) 2px,var(--paper-stain) 3px),
    repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(139,110,78,0.015) 4px,rgba(139,110,78,0.015) 5px),
    radial-gradient(ellipse at 25% 75%,rgba(139,110,78,0.06) 0%,transparent 50%),
    radial-gradient(ellipse at 80% 20%,rgba(139,110,78,0.04) 0%,transparent 40%),
    radial-gradient(ellipse at 60% 90%,rgba(181,54,46,0.02) 0%,transparent 30%);
  background-color:var(--card);
  /* 静态光晕：原 scroll-breathe 50% 帧（基础阴影 + 红色光晕），不再每帧重绘 */
  box-shadow:
    inset 0 0 50px rgba(139,110,78,0.08),
    inset 0 0 100px rgba(139,110,78,0.04),
    0 2px 12px rgba(44,24,16,0.1),
    0 0 30px var(--lust-glow);
}
.book::before{
  content:'';position:absolute;top:-14px;left:0;right:0;height:14px;z-index:10;
  background:linear-gradient(180deg,var(--roller-light),var(--roller) 40%,var(--roller-dark));
  border-radius:7px 7px 2px 2px;
  box-shadow:0 -2px 8px rgba(44,24,16,0.2),inset 0 2px 4px rgba(255,255,255,0.2);
  border-left:10px solid var(--roller-dark);border-right:10px solid var(--roller-dark);
}
.book::after{
  content:'';position:absolute;bottom:-14px;left:0;right:0;height:14px;z-index:10;
  background:linear-gradient(0deg,var(--roller-light),var(--roller) 40%,var(--roller-dark));
  border-radius:2px 2px 7px 7px;
  box-shadow:0 2px 8px rgba(44,24,16,0.2),inset 0 -2px 4px rgba(255,255,255,0.2);
  border-left:10px solid var(--roller-dark);border-right:10px solid var(--roller-dark);
}
/* NSFW 边框：静态印章红光（原 seal-pulse 50% 帧），不再每帧重绘 */
.book.nsfw-border{
  box-shadow:
    inset 0 0 50px rgba(139,110,78,0.08),
    0 0 0 3px rgba(181,54,46,0.22),
    0 0 40px rgba(181,54,46,0.1),
    0 0 20px var(--seal-glow),
    0 0 30px var(--lust-glow);
}

/* ===== 寮曢棰樼鍖?===== */

.title-time{font-size:10px;color:var(--text-muted);letter-spacing:.5px;cursor:pointer}
.title-time:hover{opacity:0.7}
.title-name{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:22px;font-weight:400;color:var(--ink);letter-spacing:4px;line-height:1.2;position:relative;display:inline-block}
.title-name::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--gold),transparent);opacity:.4;border-radius:2px}
.wardrobe-protagonist-summary{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-top:6px;padding:3px 9px;border:1.5px solid var(--accent);border-radius:2px;background:var(--accent-bg-faint);color:var(--text-muted);font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:11px;letter-spacing:1px;line-height:1.35;cursor:pointer;text-align:left;overflow:hidden;box-shadow:1px 1px 0 var(--accent-soft);transition:box-shadow .2s,filter .2s}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--accent-deep);font-weight:600;letter-spacing:2px;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);border-left:1px solid var(--accent-soft);padding-left:6px}
.wardrobe-protagonist-summary:hover{box-shadow:2px 2px 0 var(--accent-soft);filter:brightness(1.03)}
.title-btn{background:var(--accent);border:none;color:#f5f0e6;font-size:10px;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;cursor:pointer;padding:3px 8px;letter-spacing:2px;transition:all .2s;white-space:nowrap;box-shadow:1px 1px 0 var(--accent-deep);text-align:center}
.title-btn:hover{box-shadow:2px 2px 0 var(--accent-deep);filter:brightness(1.1)}
.title-btn:active{box-shadow:inset 0 2px 4px rgba(0,0,0,0.15);filter:brightness(0.92)}
.title-btn.secondary{background:var(--lust-bg-faint);border:1px solid var(--lust-border-soft);color:var(--lust);box-shadow:none;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;letter-spacing:1px}
.title-btn.secondary:hover{background:var(--lust-bg-hover);box-shadow:0 0 8px var(--lust-glow)}
.theme-btn{background:transparent;border:1px solid var(--divider);color:var(--text-muted);font-size:9px;font-family:inherit;cursor:pointer;padding:2px 6px;letter-spacing:1px;transition:all .2s;white-space:nowrap;text-align:center}
.theme-btn:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-bg-faint)}

/* ===== 姘村ⅷ灞辨按鍒嗛殧 ===== */

.book-body{overflow:hidden}

/* ===== 绛剧瓛鐜╂硶鍖?===== */
.fortune-section{padding:14px 20px 16px;position:relative;background:linear-gradient(180deg,var(--ink-light),transparent 40%)}
.play-collapse-btn{border:1px solid var(--divider);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s;flex-shrink:0;line-height:1;font-family:inherit;width:22px;height:22px;font-size:14px}
.play-collapse-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--seal-glow)}
.play-section.collapsed .play-collapse-btn{transform:rotate(180deg)}
.play-section.collapsed .play-collapse-btn:hover{filter:brightness(1.1)}
.item-use-toggle{font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;border:1px solid var(--lust-border-soft);background:var(--lust-bg-faint);color:var(--lust);letter-spacing:1px;transition:all .2s;white-space:nowrap}
.item-use-toggle:hover{border-color:var(--lust);background:var(--lust-bg-hover);box-shadow:0 0 8px var(--lust-glow)}
.item-use-toggle.active{background:var(--accent);border-color:var(--accent);color:#f5f0e6;font-weight:500;box-shadow:1px 1px 0 var(--accent-deep)}
.nsfw-guidance-btn{font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;border:1px solid var(--accent);background:var(--accent-bg-faint);color:var(--accent-deep);letter-spacing:1px;transition:all .2s;white-space:nowrap}
.nsfw-guidance-btn:hover{background:var(--accent);color:#f5f0e6;box-shadow:0 0 8px var(--seal-glow)}
.nsfw-guidance-btn:disabled{opacity:.55;cursor:wait;box-shadow:none}




/* ===== 瑙掕壊绾胯涔﹀尯 ===== */
.spine-label{padding:12px 6px;font-size:14px;white-space:nowrap;cursor:pointer;border:none;background:transparent;color:var(--text-muted);transition:all .3s;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;letter-spacing:4px;position:relative;font-weight:400;writing-mode:vertical-rl;text-orientation:upright;min-height:70px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--divider-light)}
.spine-label:last-child{border-bottom:none}
.spine-label.active{color:var(--accent-deep);font-weight:400;background:var(--accent-bg-faint)}
.spine-label.active::before{content:'';position:absolute;top:6px;right:3px;width:6px;height:6px;background:var(--accent);border-radius:50%;box-shadow:0 0 4px var(--seal-glow)}
.spine-label.active::after{content:'';position:absolute;right:0;top:0;bottom:0;width:3px;background:var(--accent)}
.spine-label:hover{color:var(--accent);background:var(--seal-glow)}
.book-page{padding:18px 20px 16px;animation:page-flip .4s ease;overflow:visible;position:relative;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,var(--paper-stain) 2px,var(--paper-stain) 3px),linear-gradient(90deg,transparent 0px,transparent 14px,rgba(181,54,46,0.04) 14px,rgba(181,54,46,0.04) 16px,transparent 16px)}
@keyframes page-flip{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
.book-page::before{content:'';position:absolute;top:0;bottom:0;left:6px;width:2px;background:repeating-linear-gradient(180deg,var(--red-thread) 0px,var(--red-thread) 5px,transparent 5px,transparent 10px);opacity:.3;z-index:1}
.book-page::after{content:'';position:absolute;top:0;bottom:0;left:10px;width:2px;background:repeating-linear-gradient(180deg,var(--red-thread) 0px,var(--red-thread) 5px,transparent 5px,transparent 10px);opacity:.2;z-index:1}

.book-page .portrait-box{float:none;margin:0;flex:0 0 120px;width:120px;height:auto;align-self:stretch}
.page-name{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:26px;font-weight:400;color:var(--ink);letter-spacing:6px;cursor:pointer;display:inline-block;transition:all .2s;position:relative;border-bottom:2px solid transparent}
.page-name:hover{animation:name-brush .4s ease;color:var(--accent-deep);border-bottom-color:var(--accent)}
@keyframes name-brush{0%,100%{transform:translateX(0)}20%{transform:translateX(-2px)}40%{transform:translateX(2px)}60%{transform:translateX(-1px)}80%{transform:translateX(1px)}}
.mood-icon{font-size:16px}

.page-thought{margin-top:6px;font-size:12px;color:var(--accent-deep);font-style:italic;letter-spacing:.5px;line-height:1.6;opacity:.85;border-left:3px double var(--accent-soft);padding-left:10px}
.page-status{margin-top:6px;font-size:13px;color:var(--text-sub);line-height:1.6;cursor:default}
.page-status:hover{opacity:0.7;transition:opacity 0.3s}


.icon-btn{background:var(--accent);border:none;color:#f5f0e6;font-size:10px;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;cursor:pointer;padding:3px 10px;letter-spacing:2px;transition:all .2s;white-space:nowrap;box-shadow:1px 1px 0 var(--accent-deep)}
.icon-btn:hover{box-shadow:2px 2px 0 var(--accent-deep);filter:brightness(1.1)}
.icon-btn:active{box-shadow:inset 0 2px 4px rgba(0,0,0,0.15);filter:brightness(0.92)}
.icon-btn.active-switch{background:var(--lust-bg-strong);border-color:var(--lust);color:var(--lust-deep);font-weight:500}


.bound-page{display:flex;padding:7px 24px 7px 20px;font-size:12px;line-height:1.6;border-bottom:1px solid var(--divider-light);transition:background .15s;background:repeating-linear-gradient(90deg,transparent 0px,transparent 3px,rgba(139,110,78,0.02) 3px,rgba(139,110,78,0.02) 4px)}
.bound-page:nth-child(even){background-color:var(--bg-alt);background-image:repeating-linear-gradient(90deg,transparent 0px,transparent 3px,rgba(139,110,78,0.02) 3px,rgba(139,110,78,0.02) 4px)}
.bound-page:last-child{border-bottom:none}
.bound-page:hover{background:linear-gradient(90deg,var(--lust-glow),var(--seal-glow))}
.bound-page.touched{animation:ink-react 1s ease}
@keyframes ink-react{0%{background:transparent}15%{background:rgba(181,54,46,0.15);transform:scaleX(1.02);text-shadow:0 0 4px var(--seal-glow)}30%{transform:translateX(3px);background:rgba(181,54,46,0.1)}50%{transform:translateX(-3px) skewX(-2deg);background:rgba(181,54,46,0.08)}70%{transform:translateX(1px) skewX(1deg)}100%{background:transparent;transform:translateX(0) skewX(0)}}
.bound-page .cl,.bound-page .bl{color:var(--lust);font-weight:500;letter-spacing:1px;min-width:60px;flex-shrink:0;font-size:11px}
.bound-page .cv,.bound-page .bv{color:var(--text-sub);padding-left:8px}
.bound-page.outfit-summary{background:var(--lust-bg-faint)!important;border-bottom:2px solid var(--lust-border-soft)!important}
.bound-page.outfit-summary .cl{color:var(--lust-deep)!important;font-weight:600!important}
.bound-page.outfit-summary .cv{color:var(--lust-deep)!important;font-weight:500}

/* ===== 鍏朵粬浜哄憳 ===== */
.other-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px}
.other-row .ms{color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.other-row+.other-row{border-top:1px solid var(--divider-light)}

/* ===== 寮圭獥 ===== */
.nsfw-overlay,.panel-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(44,24,16,0.5);z-index:10000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.nsfw-overlay.show,.panel-overlay.show{display:flex}
.panel-popup{background:var(--card);border:1px solid var(--divider);width:90%;max-width:360px;max-height:70vh;min-height:200px;box-shadow:0 8px 32px rgba(44,24,16,0.3),4px 4px 0 var(--roller);animation:popup-in .3s ease;position:relative;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,var(--paper-stain) 2px,var(--paper-stain) 3px),repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(139,110,78,0.015) 4px,rgba(139,110,78,0.015) 5px);background-color:var(--card)}
.panel-popup{max-width:380px;display:flex;flex-direction:column}
@keyframes popup-in{from{opacity:0;transform:scale(.9) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
.panel-popup-head{position:sticky;top:0;background:linear-gradient(180deg,var(--card-deep),var(--card));padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:2px solid var(--roller);z-index:1}
.panel-popup-head{flex-shrink:0}
.panel-popup-title{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:var(--ub-popup-font-title,18px);font-weight:400;color:var(--text);letter-spacing:3px;flex:1}
.panel-popup-close,.panel-popup-back{width:28px;height:28px;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.panel-popup-close:hover,.panel-popup-back:hover{border-color:var(--accent);color:var(--accent);background:var(--seal-glow)}
.panel-popup-back{font-size:12px;width:auto;padding:0 8px;font-family:inherit}
.panel-popup-warehouse-toggle{font-size:11px;width:auto;padding:0 8px;height:24px;border:1px solid var(--bamboo);background:var(--card-light);color:var(--bamboo-dark);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;font-family:inherit;margin-right:6px;letter-spacing:1px}
.panel-popup-warehouse-toggle:hover{border-color:var(--gold);color:var(--gold);background:var(--gold-glow)}
.panel-popup-body{padding:12px 18px 16px}
.panel-popup-body{flex:1 1 auto;min-height:0;overflow-y:auto}
.panel-popup-body::-webkit-scrollbar{width:4px}
.panel-popup-body::-webkit-scrollbar-track{background:transparent}
.panel-popup-body::-webkit-scrollbar-thumb{background:var(--divider)}
.panel-popup-body::-webkit-scrollbar-thumb:hover{background:var(--lust-soft)}
.char-info-popup{max-width:420px;width:90%;max-height:80vh;display:flex;flex-direction:column}
.char-info-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px 18px 16px}
.char-info-body::-webkit-scrollbar{width:4px}
.char-info-body::-webkit-scrollbar-track{background:transparent}
.char-info-body::-webkit-scrollbar-thumb{background:var(--divider)}
.char-info-panel{display:none}
.char-info-panel.active{display:flex;flex-direction:column;gap:0}
.char-info-card{border:1px solid var(--bamboo);padding:14px 16px;background:var(--card-light)}
.char-info-card-name{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:18px;color:var(--accent);letter-spacing:3px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--divider)}
.char-info-card-rows{display:flex;flex-direction:column;gap:6px}
.char-info-card-rows .detail-row{font-size:var(--ub-ui-font-13,13px)}
.char-info-card-rows .dl{color:var(--text-muted);min-width:50px}
.panel-empty{text-align:center;padding:24px 0;color:var(--text-muted);font-size:12px;letter-spacing:2px}

.memo-list-item,.item-list-item,.diary-list-item{padding:10px 12px;margin-bottom:8px;border:1px solid var(--divider-light);cursor:pointer;transition:all .2s;position:relative;border-left:3px solid var(--lust-soft)}
.item-list-item{position:relative}
.memo-list-item:hover,.item-list-item:hover,.diary-list-item:hover{background:linear-gradient(90deg,var(--lust-glow),var(--seal-glow));border-color:var(--lust-soft);border-left-color:var(--accent)}
.memo-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.memo-title{font-size:var(--ub-ui-font-12,12px);font-weight:500;color:var(--text);letter-spacing:1px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.memo-type{font-size:9px;color:var(--accent);padding:1px 5px;background:var(--accent-bg);letter-spacing:1px;flex-shrink:0;border:1px solid var(--accent-soft)}
.memo-item-sub{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;font-size:var(--ub-ui-font-10,10px);color:var(--text-muted)}
.memo-status,.memo-char,.memo-time-badge{padding:1px 4px;background:var(--bg-alt);letter-spacing:.5px;font-size:9px}
/* F79：备忘录状态语义三态（进行中=accent / 已完成=success 描边 / 已放弃=弱化删除线）；
   词表外回落上方灰底。成功态读 --ub-success（U38③ 全主题补齐；深色档随主题深色组自动切换） */
.memo-status.st-doing{color:var(--accent);background:var(--accent-bg);border:1px solid var(--accent-soft)}
.memo-status.st-done{color:var(--ub-success,#3F6A52);background:transparent;border:1px solid currentColor}
.memo-status.st-gone{color:var(--text-muted);text-decoration:line-through;opacity:.75}
.memo-time-badge{font-variant-numeric:tabular-nums}
.item-qty{font-size:10px;font-weight:600;color:var(--accent);background:var(--accent-bg);padding:1px 6px;flex-shrink:0;letter-spacing:.5px;border:1px solid var(--accent-soft)}
.item-top{display:flex;align-items:center;gap:6px}
.item-name{font-size:var(--ub-ui-font-12,12px);font-weight:500;color:var(--text);letter-spacing:1px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item-type{font-size:9px;color:#f5f0e6;padding:2px 6px;background:var(--lust);letter-spacing:1px;flex-shrink:0}
.dark .item-type{color:var(--card)}
.item-wardrobe-badge{display:inline-flex;align-items:center;background:var(--accent);color:#fff;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:1px;flex-shrink:0;margin-left:4px;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif}
.item-desc{font-size:var(--ub-ui-font-10,10px);color:var(--text-muted);margin-top:4px;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.mission-list-item{padding:12px 14px;margin-bottom:10px;border:1px solid var(--divider-light);cursor:pointer;transition:all .2s;position:relative;overflow:hidden;border-left:3px solid var(--accent-soft)}
.mission-list-item:hover{background:linear-gradient(90deg,var(--lust-glow),var(--seal-glow));border-color:var(--lust-soft);border-left-color:var(--accent)}
.mission-list-item.completed{border-color:var(--accent);border-left-color:var(--accent);background:var(--accent-bg-faint);cursor:pointer}
.mission-list-item.completed:hover{background:var(--accent-bg-hover)}
.mission-list-item .mission-delete{position:absolute;top:6px;right:8px;width:22px;height:22px;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:2}
.mission-list-item .mission-delete:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-bg-faint)}
.mission-name{font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--accent-deep);letter-spacing:1px;margin-bottom:4px;padding-right:30px}
.mission-desc{font-size:var(--ub-ui-font-11,11px);color:var(--text-sub);margin-bottom:6px;line-height:1.5}
.mission-desc-clickable{cursor:pointer;transition:all 0.2s;padding:2px 4px;display:inline-block}
.mission-desc-clickable:hover{background:var(--lust-bg-hover)}
.mission-objective{font-size:var(--ub-ui-font-11,11px);color:var(--text-muted);padding:8px 10px;background:var(--bg-alt);border-left:3px solid var(--accent);line-height:1.6}
.mission-status{display:inline-block;font-size:10px;padding:2px 8px;margin-top:8px;font-weight:500;cursor:pointer;transition:all .2s}
.mission-status:hover{filter:brightness(1.1)}
.mission-status.pending{color:var(--text-muted);background:var(--ink-light);border:1px solid var(--divider-light)}
.mission-status.completed{color:#f5f0e6;background:var(--accent);border:1px solid var(--accent-deep);box-shadow:1px 1px 0 var(--accent-deep)}
.diary-item-top{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-muted);margin-bottom:4px}
.diary-time{flex-shrink:0}
.diary-item-content{font-size:var(--ub-ui-font-12,12px);color:var(--text-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:.5px}

.detail-row{display:flex;padding:6px 0;border-bottom:1px solid var(--divider-light);font-size:var(--ub-ui-font-11,11px);line-height:1.6}
.detail-row:last-child{border-bottom:none}
.detail-row .dl{color:var(--accent-deep);font-weight:500;min-width:56px;flex-shrink:0;letter-spacing:1px;font-size:10px}
.detail-row .dv{color:var(--text-sub);flex:1}
.detail-content{padding:10px 0}
.detail-content .dl{color:var(--accent-deep);font-weight:500;font-size:10px;letter-spacing:1px;display:block;margin-bottom:6px}
.detail-content .dc{color:var(--text-sub);font-size:var(--ub-ui-font-11,11px);line-height:1.8}
.item-detail-actions{display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--divider-light)}
.item-use-btn,.item-discard-btn{flex:1;padding:6px 12px;border:1px solid var(--lust-border-soft);font-size:11px;font-family:inherit;cursor:pointer;letter-spacing:1px;transition:all .2s;font-weight:500}
.item-use-btn{background:var(--lust-bg);color:var(--lust-deep)}
.item-use-btn:hover{background:var(--lust-bg-hover);border-color:var(--lust);box-shadow:0 0 8px var(--lust-glow)}
.item-discard-btn{background:transparent;color:var(--text-muted);border-color:var(--divider)}
.item-discard-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-bg-faint)}
.item-warehouse-btn{flex:1;padding:6px 12px;border:1px solid var(--bamboo);font-size:11px;font-family:inherit;cursor:pointer;letter-spacing:1px;transition:all .2s;font-weight:500;background:var(--card-light);color:var(--bamboo-dark)}
.item-warehouse-btn:hover{background:var(--gold-glow);border-color:var(--gold);color:var(--gold);box-shadow:0 0 8px var(--gold-glow)}
/* 深色：--bamboo-dark 翻为近黑，仓库切换/物品仓库按钮文字不可见（H9），改用 --gold */
.dark .panel-popup-warehouse-toggle,.dark .item-warehouse-btn{color:var(--gold)}
.diary-detail-writer{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:14px;color:var(--accent);letter-spacing:2px;margin-bottom:10px}
.diary-nav-btn{flex:0 0 auto;width:26px;height:26px;line-height:24px;text-align:center;border:1px solid var(--divider);border-radius:50%;background:transparent;color:var(--accent);cursor:pointer;font-size:var(--ub-ui-font-10,10px);padding:0;transition:opacity .2s,border-color .2s}
.diary-nav-btn:hover:not(:disabled){opacity:.8;border-color:var(--accent)}
.diary-nav-btn:disabled{opacity:.3;cursor:default}
.diary-nav-indicator{text-align:center;font-size:var(--ub-ui-font-11,11px);color:var(--text-muted);margin-top:8px;letter-spacing:2px}
.diary-content{padding:10px 0}
.diary-content .dc{color:var(--text-sub);font-size:12px;line-height:1.9;font-style:italic}

/* ===== 鏃ヨ鏈儗鏅?===== */
.diary-notebook{position:relative;padding:24px 28px;margin:10px 0;background:linear-gradient(180deg,#faf6ed 0%,#f5edd6 100%);border:1px solid var(--divider);border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,0.08),inset 0 0 30px rgba(139,110,78,0.03)}
.diary-notebook::before{content:'';position:absolute;top:0;left:40px;bottom:0;width:1px;background:rgba(200,160,160,0.3);pointer-events:none;z-index:1}
.diary-notebook::after{content:'';position:absolute;top:0;left:44px;bottom:0;width:1px;background:rgba(200,160,160,0.15);pointer-events:none;z-index:1}
.diary-notebook-lines{position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(transparent,transparent 27px,rgba(160,180,220,0.15) 27px,rgba(160,180,220,0.15) 28px);pointer-events:none;z-index:0}
.diary-notebook .diary-content{position:relative;z-index:1;padding:0}
.diary-notebook .diary-content .dc{font-family:'LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC','Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:14px;line-height:28px;color:var(--text);font-style:normal;letter-spacing:0.5px}
/* 褰╅搮鍒掓帀绾?鈥?绮楃嚎锛屾殩璧壊 */
.diary-notebook .diary-content .dc .strikethrough{text-decoration:line-through;text-decoration-thickness:0.12em;text-decoration-color:#b0725a;opacity:0.75}
/* 姘村僵绗旀爣璁?鈥?鍗婇€忔槑鑼惰壊鍧楋紝杈圭紭寰笉瑙勫垯锛屾ā鎷熼鏂欐磭寮€ */
.diary-notebook .diary-content .dc .highlight{background:linear-gradient(180deg,rgba(240,210,160,0.5) 0%,rgba(230,190,140,0.6) 100%);padding:2px 6px;border-radius:3px 7px 4px 5px;box-shadow:0 0 0 1px rgba(200,160,110,0.18),inset 0 -1px 2px rgba(180,140,100,0.12)}
/* 铚＄瑪娉㈡氮涓嬪垝绾?鈥?璧煶鑹?*/
.diary-notebook .diary-content .dc .underline{text-decoration:underline;text-decoration-style:wavy;text-decoration-thickness:from-font;text-underline-offset:4px;text-decoration-color:#b0725a}
/* 鏈辩爞鍦堝湀鏍囨敞 鈥?涓嶈鍒欐き鍦嗚竟妗?*/
.diary-notebook .diary-content .dc .emphasis{display:inline-block;border:2px solid #c44a3a;border-radius:42% 58% 55% 45% / 48% 45% 55% 52%;padding:0 5px;transform:rotate(-0.5deg);color:inherit;font-weight:600}
/* 姣涚瑪鎵嬪啓浣?鈥?娣卞ⅷ鑹诧紝寰帇鐥?*/
.diary-notebook .diary-content .dc .handwritten{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体','LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC',cursive;font-size:15px;color:#2c1810;text-shadow:0.5px 0.5px 0 rgba(0,0,0,0.06);letter-spacing:0.3px}
/* 娼﹁崏瀛楄抗 鈥?姝枩鎶栧姩 */
.diary-notebook .diary-content .dc .messy{display:inline-block;transform:rotate(-1.2deg) translateY(1px);font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体','LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC',cursive;font-size:14px;color:#3a2a1a;text-shadow:0.5px 1px 0 rgba(0,0,0,0.05);letter-spacing:-0.2px}
/* 褰╅搮娑傛敼閬洊 鈥?涓夊眰鏌斿拰浜ゅ弶鏂滅嚎锛屽拰璋愬厠鍒?*/
.diary-notebook .diary-content .dc .censored{position:relative;color:rgba(44,24,16,0.28);padding:0 4px;border-radius:2px;cursor:pointer;transition:all 0.3s;background-color:rgba(180,150,130,0.06);background-image:repeating-linear-gradient(-5deg,transparent,transparent 2.5px,rgba(140,110,90,0.35) 2.5px,rgba(140,110,90,0.35) 3.5px),repeating-linear-gradient(12deg,transparent,transparent 3px,rgba(150,120,100,0.28) 3px,rgba(150,120,100,0.28) 4px),repeating-linear-gradient(-18deg,transparent,transparent 3.5px,rgba(130,100,80,0.3) 3.5px,rgba(130,100,80,0.3) 4.5px);background-repeat:repeat;background-size:24px 24px}
.diary-notebook .diary-content .dc .censored:hover{background-image:none;background-color:transparent;color:inherit;padding:0 4px}
.dark .diary-notebook{background:linear-gradient(180deg,#1e1a14 0%,#1a1612 100%);border-color:var(--divider);box-shadow:0 2px 8px rgba(0,0,0,0.2),inset 0 0 30px rgba(90,74,48,0.06)}
.dark .diary-notebook::before{background:rgba(90,80,60,0.2)}
.dark .diary-notebook::after{background:rgba(90,80,60,0.1)}
.dark .diary-notebook-lines{background:repeating-linear-gradient(transparent,transparent 27px,rgba(160,180,220,0.08) 27px,rgba(160,180,220,0.08) 28px)}
.dark .diary-notebook .diary-content .dc{color:var(--text)}
/* 娣辫壊 鈥?highlight 鏆栭噾璋冧寒 */
.dark .diary-notebook .diary-content .dc .highlight{background:linear-gradient(180deg,rgba(255,220,140,0.35) 0%,rgba(240,200,120,0.42) 100%);box-shadow:0 0 0 1px rgba(220,180,120,0.15),inset 0 -1px 2px rgba(200,160,100,0.1)}
/* 娣辫壊 鈥?underline 浜淡 */
.dark .diary-notebook .diary-content .dc .underline{text-decoration-color:#d4a88a}
/* 娣辫壊 鈥?emphasis 浜湵鐮?*/
.dark .diary-notebook .diary-content .dc .emphasis{border-color:#d4685a;color:#e8dcc8}
/* 娣辫壊 鈥?strikethrough 浜殩妫?*/
.dark .diary-notebook .diary-content .dc .strikethrough{text-decoration-color:#c89878}
.dark .diary-notebook .diary-content .dc .handwritten{color:#e8dcc8}
.dark .diary-notebook .diary-content .dc .messy{color:#d8c8b0}
/* 娣辫壊 鈥?娑傛敼閬洊锛氭祬绫宠壊鏌斿拰鏂滅嚎 */
.dark .diary-notebook .diary-content .dc .censored{color:rgba(232,220,200,0.22);background-color:rgba(200,180,160,0.05);background-image:repeating-linear-gradient(-5deg,transparent,transparent 2.5px,rgba(190,175,155,0.32) 2.5px,rgba(190,175,155,0.32) 3.5px),repeating-linear-gradient(12deg,transparent,transparent 3px,rgba(200,185,165,0.25) 3px,rgba(200,185,165,0.25) 4px),repeating-linear-gradient(-18deg,transparent,transparent 3.5px,rgba(180,165,145,0.28) 3.5px,rgba(180,165,145,0.28) 4.5px)}
.dark .diary-notebook .diary-content .dc .censored:hover{background-image:none;background-color:transparent;color:inherit}
.diary-detail-popup{max-width:520px !important}

/* ===== 璁剧疆涓庡ぇ璋冩煡 ===== */
.settings-btn{background:transparent;border:1px solid var(--divider);color:var(--text-muted);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;width:24px;height:24px;border-radius:50%;font-family:inherit}
.settings-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--seal-glow)}
/* 场景一键切换按钮 */
.scene-btn{background:transparent;border:1px solid var(--divider);color:var(--text-muted);font-size:9px;font-family:inherit;cursor:pointer;padding:2px 6px;letter-spacing:1px;transition:all .2s;white-space:nowrap;text-align:center;flex-shrink:0;border-radius:3px}
.scene-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--seal-glow)}
.scene-btn:disabled{opacity:0.5;cursor:not-allowed}
.scene-btn.scene-active-daily{border-color:var(--accent);color:var(--accent);background:var(--seal-glow)}
.scene-btn.scene-active-nsfw{border-color:var(--lust);color:var(--lust);background:var(--lust-bg-faint)}
.settings-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(44,24,16,0.5);z-index:10002;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.settings-overlay.show{display:flex}
.settings-popup{background:var(--card);border:1px solid var(--divider);width:90%;max-width:320px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(44,24,16,0.3),4px 4px 0 var(--roller);animation:popup-in .3s ease;position:relative;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,var(--paper-stain) 2px,var(--paper-stain) 3px);background-color:var(--card)}
.settings-popup-head{padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:2px solid var(--roller);flex-shrink:0}
.settings-popup-title{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:var(--ub-popup-font-title,18px);font-weight:400;color:var(--text);letter-spacing:3px;flex:1}
.settings-popup-close{width:28px;height:28px;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.settings-popup-close:hover{border-color:var(--accent);color:var(--accent);background:var(--seal-glow)}
.settings-tabs{display:flex;border-bottom:2px solid var(--divider);padding:0 18px;background:var(--card-light)}
.settings-tab{flex:1;padding:12px 8px;border:none;background:transparent;color:var(--text-muted);font-size:14px;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;letter-spacing:1px;cursor:pointer;transition:all .2s;position:relative;font-weight:500}
.settings-tab:hover{color:var(--text);background:var(--lust-bg-faint)}
.settings-tab.active{color:var(--accent-deep);background:var(--accent-bg-faint)}
.settings-tab.active::after{content:'';position:absolute;bottom:-2px;left:10%;right:10%;height:3px;background:linear-gradient(90deg,var(--accent-soft),var(--accent),var(--accent-soft));border-radius:2px}
.settings-popup-body{padding:16px 18px;min-height:120px;overflow-y:auto;flex:1}
.settings-tab-content{display:none}
.settings-tab-content.active{display:block;animation:fade-in .2s ease}
.settings-section{margin:14px 0;padding:12px 14px;border-radius:6px;background:rgba(180,170,150,0.08);border:1px solid var(--divider-light)}
@keyframes fade-in{from{opacity:0}to{opacity:1}}
.settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--divider-light)}
.settings-row:last-child{border-bottom:none}
.settings-label{font-size:var(--ub-ui-font-13,13px);color:var(--text);letter-spacing:1px;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif}
.settings-toggle{width:44px;height:24px;border-radius:12px;background:var(--divider);cursor:pointer;position:relative;transition:background .2s;border:none;padding:0}
.settings-toggle.on{background:var(--accent)}
.settings-toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#f5f0e6;transition:transform .2s;box-shadow:0 1px 3px rgba(44,24,16,0.2)}
.settings-toggle.on::after{transform:translateX(20px)}
.investigate-btn{font-size:11px;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;cursor:pointer;padding:2px 8px;border:1px solid var(--lust-border-soft);background:var(--lust-bg-faint);color:var(--lust);letter-spacing:2px;transition:all .2s;white-space:nowrap;box-shadow:1px 1px 0 var(--lust-soft);margin-left:8px}
.investigate-btn:hover{box-shadow:2px 2px 0 var(--lust-deep);filter:brightness(1.08);border-color:var(--lust);background:var(--lust-bg-hover)}

/* ===== 鐐瑰嚮鐗规晥 ===== */
.click-heart{position:fixed;pointer-events:none;z-index:9999;font-size:14px;color:var(--accent);animation:heart-rise 1.8s ease-out forwards;text-shadow:0 0 6px var(--seal-glow)}
.click-text{position:fixed;pointer-events:none;z-index:9999;font-size:11px;color:var(--accent);white-space:nowrap;animation:text-drift 2s ease-out forwards;opacity:.85;text-shadow:0 0 8px var(--seal-glow);letter-spacing:1px}
@keyframes heart-rise{0%{opacity:1;transform:translateY(0) scale(.5) rotate(0deg)}30%{opacity:1;transform:translateY(-20px) scale(1.2) rotate(-15deg)}100%{opacity:0;transform:translateY(-80px) scale(.3) rotate(20deg)}}
@keyframes text-drift{0%{opacity:0;transform:translateY(0) translateX(0) scale(.8)}15%{opacity:.9;transform:translateY(-10px) translateX(5px) scale(1)}100%{opacity:0;transform:translateY(-60px) translateX(var(--drift-x,30px)) scale(.6)}}
.tab-ripple{position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle,var(--seal-glow) 0%,transparent 70%);animation:tab-glow .6s ease-out forwards;pointer-events:none;border-radius:inherit}
@keyframes tab-glow{0%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.1)}}
.cloud{position:absolute;pointer-events:none;z-index:1}
.cloud i{display:none}
.ink-spark{position:fixed;width:3px;height:3px;border-radius:50%;background:var(--accent);pointer-events:none;z-index:50;animation:spark-fly .5s ease-out forwards}
@keyframes spark-fly{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--sx,20px),var(--sy,-15px))}}
.drip{position:fixed;width:6px;height:8px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:radial-gradient(circle at 35% 35%,rgba(232,200,184,0.9),var(--accent));pointer-events:none;z-index:50;animation:drip-fall .9s ease-in forwards}
@keyframes drip-fall{0%{opacity:.9;transform:scale(1)}15%{transform:scaleX(.8) scaleY(1.4)}50%{opacity:.7;transform:scale(1) translateY(40px)}80%{opacity:.3;transform:scale(.8) translateY(65px)}100%{opacity:0;transform:scale(0) translateY(75px)}}
.mouse-glow{position:fixed;width:80px;height:80px;border-radius:50%;pointer-events:none;z-index:100;background:radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%);transform:translate(-50%,-50%);transition:opacity .3s;opacity:0}
.mouse-glow.active{opacity:1}

@media(max-width:900px){
}
@media(max-width:600px){
  .title-name{font-size:17px;letter-spacing:3px}
  .title-time{font-size:9px}
  .title-btn{font-size:9px;padding:3px 8px;box-shadow:1px 1px 0 var(--accent-deep)}
  .spine-label{writing-mode:horizontal-tb;min-height:auto;padding:6px 12px;letter-spacing:2px}
  .spine-label.active::after{left:0;top:auto;bottom:0;width:100%;height:3px}
  .spine-label.active::before{top:auto;bottom:4px;right:4px}
  .book-page{padding:14px 16px 12px}
  .book-page::before,.book-page::after{display:none}
  .page-name{font-size:20px}
  .bound-page{padding:5px 16px 5px 14px;font-size:11px}
  .bound-page .cl,.bound-page .bl{min-width:48px}
  .fortune-section{padding:10px 14px}
  /* 绉诲姩绔澶цЕ鎽哥洰鏍?*/
  .settings-btn,.play-collapse-btn{min-width:32px;min-height:32px;font-size:16px}
  .title-btn{min-height:32px;padding:6px 10px;font-size:11px}
  .spine-label{padding:8px 14px;font-size:14px}
  .book-page .portrait-box{flex:0 0 auto;width:120px;height:120px;align-self:auto}
}

/* ===== 鍥哄畾妯″紡鎶樺彔鐘舵€?===== */
#ac-statusbar-wrapper.ub-collapsed{display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:hidden!important}

/* 鏂版墜甯姪鎻愮ず鎸夐挳 */
.help-tip-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:10px;font-weight:bold;cursor:help;flex-shrink:0;line-height:1;font-family:inherit;transition:all .2s}
.help-tip-btn:hover{border-color:var(--gold);color:var(--gold);background:var(--gold-glow)}

.help-tooltip-global{position:fixed;z-index:100000;max-width:260px;padding:10px 14px;border-radius:4px;background:var(--card-deep);border:1px solid var(--roller);color:var(--text);font-size:11px;line-height:1.7;letter-spacing:0.5px;white-space:pre-line;pointer-events:none;box-shadow:0 4px 16px rgba(44,24,16,0.4)}
.dark .char-info-card{background:var(--card);border-color:var(--divider)}
.dark .char-info-card-name{color:var(--gold)}
/* === 过往经历时间轴 · 古风 === */
.pe-intro{background:#efe6cf;border-left:3px solid #b5362e;padding:10px 12px}
.pe-intro-label{color:#8b1a12;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;letter-spacing:3px}
.pe-intro-text{color:#4a3a26}
.pe-rail::before{background:linear-gradient(#b5362e,rgba(181,54,46,0.15))}
.pe-dot{background:#b5362e;border:2px solid #f5edd6;box-shadow:0 0 0 1px #b5362e,0 0 6px rgba(181,54,46,0.3);width:11px;height:11px;top:4px}
.pe-date{color:#8b1a12;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;letter-spacing:2px}
.pe-card{background:#faf4e4;border:1px solid #e8c8b8;color:#4a3a26}
/* 暗色 */
.dark .pe-intro{background:#221a12;border-left-color:#d4564e}
.dark .pe-intro-label{color:#e87068}
.dark .pe-intro-text{color:#d0c0a0}
.dark .pe-rail::before{background:linear-gradient(#d4564e,rgba(212,86,78,0.15))}
.dark .pe-dot{background:#d4564e;border-color:#1a1612;box-shadow:0 0 0 1px #d4564e,0 0 6px rgba(212,86,78,0.35)}
.dark .pe-date{color:#e87068}
.dark .pe-card{background:#241c14;border-color:#3a2818;color:#d0c0a0}
` + baseCSS + readingThemeCSS + /* === ub-literary-v1 ancient shell decoration（素绢朱印，§6.2/§10）=== */ `
.ub-reading-shell{position:relative}
.ub-reading-shell::before{
  content:'';position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.035;
  background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(89,67,42,.02) 3px 4px);
}
.ub-reading-shell > *{position:relative;z-index:1}
.ub-masthead::after{
  content:'';position:absolute;left:18px;right:18px;bottom:-1px;height:1px;
  background:linear-gradient(90deg,var(--ub-accent) 0 44px,transparent 44px);
}
.ub-char-tab[aria-selected="true"]{box-shadow:inset 0 -2px 0 var(--ub-accent)}
.ub-profile-thought{border-radius:0}
.ub-reading-shell .ub-context-actions .ub-ctx-btn{letter-spacing:2px;box-shadow:1px 1px 0 var(--lust-soft)}
.ub-reading-shell .ub-context-actions .ub-ctx-btn.investigate-btn{margin-left:0}
.ub-reading-shell .ub-badge{min-width:18px;height:18px;font-size:11px}
` + literaryBaseCSS;

export const ancientCSS = ancientCoreCSS + /* css */ `
/* 角色中枢 / 剧情回顾：古卷素笺 */
.char-hub-theme-ancient,.chronicle-reader-theme-ancient{--hub-bg:var(--card);--hub-panel:var(--card-deep);--hub-line:var(--roller);--hub-ink:var(--ink);--hub-muted:var(--text-muted);--hub-accent:var(--seal-red);--hub-soft:var(--accent-bg-faint);--hub-female:#b85a8a;--hub-male:#3a6fb5;--hub-inv:#3a6fb5;--hub-itv:#3a7a52;--hub-day:var(--accent-bg-faint);--hub-night:#3d2e3a;--hub-night-ink:#e8d4e0;--hub-pref:#5a4a8a}
.char-hub-theme-ancient .char-hub-gsym.is-female{color:var(--hub-female)}.char-hub-theme-ancient .char-hub-gsym.is-male{color:var(--hub-male)}
.char-hub-theme-ancient .char-hub-lead-banner{background:linear-gradient(90deg,var(--hub-panel),var(--hub-bg));border-inline-start:3px solid var(--hub-accent)}
.char-hub-theme-ancient .char-hub-action--investigate{color:var(--hub-inv);border-color:color-mix(in srgb,var(--hub-inv) 40%,var(--hub-line));background:color-mix(in srgb,var(--hub-inv) 10%,var(--hub-bg))}
.char-hub-theme-ancient .char-hub-action--interview{color:var(--hub-itv);border-color:color-mix(in srgb,var(--hub-itv) 40%,var(--hub-line));background:color-mix(in srgb,var(--hub-itv) 10%,var(--hub-bg))}
.char-hub-theme-ancient .char-hub-identity,.chronicle-reader-theme-ancient .chronicle-reader-card{border-color:var(--hub-line);background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));box-shadow:inset 3px 0 var(--hub-accent)}
.char-hub-theme-ancient .char-hub-card{background:linear-gradient(105deg,var(--hub-bg),var(--hub-panel));box-shadow:2px 2px 0 color-mix(in srgb,var(--hub-line) 28%,transparent)}
.char-hub-theme-ancient .char-hub-profile-lede{background:repeating-linear-gradient(0deg,var(--hub-soft) 0 3px,transparent 3px 5px);border-inline-start-color:var(--seal-red)}
.char-hub-theme-ancient .char-hub-prose-card,.char-hub-theme-ancient .char-hub-logic{background:linear-gradient(115deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 18px var(--paper-stain)}
.char-hub-theme-ancient .char-hub-logic-index{border:2px solid var(--seal-red);color:var(--seal-red);transform:rotate(-2deg)}
.char-hub-theme-ancient .char-hub-trait-balance{gap:14px}.char-hub-theme-ancient .char-hub-trait-column{border-style:double;background:var(--hub-panel)}
.char-hub-theme-ancient .char-hub-relation-card{border-style:double;background:linear-gradient(105deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 2px 0 var(--hub-accent)}.char-hub-theme-ancient .char-hub-relation-avatar{border:2px solid var(--hub-accent);transform:rotate(-1deg)}
.char-hub-theme-ancient .char-hub-history-preview{gap:12px}.char-hub-theme-ancient .char-hub-history-background,.char-hub-theme-ancient .char-hub-history-latest{background:linear-gradient(110deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 16px var(--paper-stain)}
.char-hub-theme-ancient .char-hub-not-equal{border-style:double;background:var(--hub-bg)}.char-hub-theme-ancient .char-hub-not-equal-label{background:repeating-linear-gradient(0deg,var(--hub-soft) 0 3px,transparent 3px 5px)}
.char-hub-theme-ancient .char-hub-intimacy-slip{border-inline-start:3px solid var(--seal-red);background:linear-gradient(90deg,var(--hub-soft),var(--hub-bg))}
.panel-overlay.dark .char-hub-theme-ancient{--hub-day:#3a2e1f;--hub-night:#4a2a3a;--hub-night-ink:#e8c8d0;--hub-pref:#a890d8}
.char-hub-theme-ancient .char-hub-vitals-strip{border-style:double;background:linear-gradient(115deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 12px var(--paper-stain)}
.char-hub-theme-ancient .char-hub-vitals-raw{border-style:double;background:linear-gradient(115deg,var(--hub-bg),var(--hub-panel))}
.char-hub-theme-ancient .char-hub-nsfw-card{background:linear-gradient(115deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 16px var(--paper-stain)}
.char-hub-theme-ancient .char-hub-dual-stat{border-style:double;background:linear-gradient(115deg,var(--hub-bg),var(--hub-panel))}
.char-hub-theme-ancient .char-hub-speech{border-style:double}
.char-hub-theme-ancient .char-hub-ms-node{border:2px solid var(--seal-red);border-radius:6px;color:var(--seal-red);background:color-mix(in srgb,var(--seal-red) 5%,transparent);box-shadow:inset 0 0 8px color-mix(in srgb,var(--seal-red) 16%,transparent);transform:rotate(-3.5deg);font-size:18px;font-weight:700}
.char-hub-theme-ancient .char-hub-ms-item:nth-child(even) .char-hub-ms-node{transform:rotate(2.5deg)}
.char-hub-theme-ancient .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--seal-red);color:var(--ub-text-on-accent);box-shadow:inset 0 0 8px rgba(43,10,8,.3)}
.char-hub-theme-ancient .char-hub-ms-desc{background:linear-gradient(90deg,var(--hub-soft),transparent 70%);padding:5px 8px;border-left:2px solid color-mix(in srgb,var(--seal-red) 40%,transparent)}
.char-hub-theme-ancient .char-hub-ms-item.is-latest .char-hub-ms-desc{font-weight:700}
.char-hub-theme-ancient .char-hub-ms-date{letter-spacing:.08em}
.panel-overlay.dark .char-hub-theme-ancient .char-hub-ms-node{border-color:var(--seal-red);color:var(--seal-red);box-shadow:inset 0 0 8px color-mix(in srgb,var(--seal-red) 10%,transparent)}
.panel-overlay.dark .char-hub-theme-ancient .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--seal-red)}
.panel-overlay.dark .char-hub-theme-ancient .char-hub-ms-desc{background:linear-gradient(90deg,color-mix(in srgb,var(--seal-red) 5%,transparent),transparent 70%)}
.char-hub-theme-ancient{--ms-cat-first:#a6342b;--ms-cat-relation:#a06b2c;--ms-cat-status:#3f6f8f}
.panel-overlay.dark .char-hub-theme-ancient{--ms-cat-first:#d96a5c;--ms-cat-relation:#cf9457;--ms-cat-status:#6f9ec4}
.chronicle-reader-theme-ancient .chronicle-timeline-node{border-radius:1px;background:var(--seal-red);transform:translate(-50%,-50%) rotate(45deg)}
.chronicle-reader-theme-ancient .chronicle-timeline-content{background:linear-gradient(110deg,var(--hub-bg),var(--hub-panel));box-shadow:2px 2px 0 color-mix(in srgb,var(--hub-line) 25%,transparent)}
.chronicle-reader-theme-ancient .chronicle-detail-text{background:linear-gradient(110deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 18px var(--paper-stain)}.chronicle-reader-theme-ancient .chronicle-detail-dialogue{border-style:double;background:linear-gradient(100deg,var(--hub-soft),var(--hub-panel))}
.chronicle-reader-theme-ancient .chronicle-dialogue-line{border-style:double;background:linear-gradient(100deg,var(--hub-bg),var(--hub-panel))}.chronicle-reader-theme-ancient .chronicle-dialogue-speaker{border-color:var(--hub-accent)}
.chronicle-reader-theme-ancient .chronicle-timeline-content::after{content:'卷';float:right;margin-top:8px;color:var(--seal-red);font-size:9px;border:1px solid currentColor;padding:1px 3px}
`;
