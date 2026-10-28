// ===== 浠欎緺路浜戞捣浠欒釜 鐘舵€佹爮 - 瀹屾暣CSS =====
import { baseCSS } from './base';
import { readingThemeCSS } from './reading-theme-base';
import { literaryBaseCSS } from './literary-base';
const xianxiaCoreCSS = /* css */ `

/* ===== CSS鍙橀噺锛氱櫧鏄悸峰噷闇勪簯娴?===== */
:root {
  /* === ub-literary-v1 语义 token（仙侠月白青玉 · 浅色）=== */
  --ub-canvas:#E9EFEC;--ub-surface-1:#F7FAF8;--ub-surface-2:#EFF5F1;--ub-surface-3:#E2ECE6;
  --ub-text-1:#17231E;--ub-text-2:#40564B;--ub-text-3:#5F7168;--ub-text-on-accent:#FFFFFF;
  --ub-border-subtle:#CEDDD5;--ub-border:#A9C1B5;--ub-border-strong:#829F90;
  --ub-accent:#28735C;--ub-accent-hover:#1F5E4A;--ub-accent-soft:rgba(40,115,92,.08);
  --ub-focus:#376E8A;--ub-info:#376E8A;--ub-success:#35705A;--ub-warning:#8E6B2C;--ub-danger:#A43E38;
  --ub-nsfw:var(--gold);--ub-nsfw-soft:var(--gold-pale);
  --ub-shadow-1:0 12px 34px rgba(29,67,51,.11);--ub-shadow-2:0 16px 40px rgba(29,67,51,.15);
  --ub-radius-shell:14px;--ub-radius-panel:10px;--ub-radius-control:8px;
  --bg-1: #d9e4dc; --bg-2: #edf4ef; --bg-3: #e3ece6;
  --jade:var(--ub-accent); --jade-light:var(--ub-border); --jade-deep:var(--ub-accent); --jade-warm: #a0c8b0;
  --jade-surface-1:var(--ub-surface-1); --jade-surface-2:var(--ub-surface-2); --jade-surface-3:var(--ub-surface-3);
  --jade-shadow-inner: rgba(255,255,255,0.32); --jade-shadow-edge: rgba(45,72,54,0.13);
  --jade-glow: rgba(100, 200, 255, 0.09);
  --card:var(--ub-surface-1); --card-light:var(--ub-surface-1);
  --gold:var(--ub-warning); --gold-light: #d4c080; --gold-bright: #e8d898; --gold-deep: #8a6828;
  --gold-pale: rgba(200,170,100,0.18); --gold-wash: rgba(210,180,110,0.08);
  --cinnabar: #c05048; --cinnabar-deep: #983028; --cinnabar-light: rgba(200,100,80,0.12);
  --spirit:var(--ub-info); --spirit-deep: #3070a0; --spirit-light: rgba(80,150,190,0.12);
  --text:var(--ub-text-1); --text-soft:var(--ub-text-2); --text-muted:var(--ub-text-3);
  --divider:var(--ub-border); --divider-light:var(--ub-border-subtle);
  /* === 缁熶竴鍙橀噺鍒悕 === */
  --ub-overlay-bg:rgba(0,0,0,0.3);
  --ub-scrollbar-thumb:var(--divider);
  --ub-scrollbar-thumb-hover:var(--jade);
  --ub-text-muted:var(--text-muted);
  --ub-bg-card:var(--jade-surface-1);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接 → 主题级补同一组变量（浅/深各一套，值取本主题 token）。
     云海 --ub-accent 已是文学主题色且与日历桥接同值（--jade:var(--ub-accent)），此处不再重复。 */
  --ub-text:var(--text,#2c4a3e);--ub-divider:var(--divider,rgba(70,90,75,0.35));--ub-hover-bg:rgba(90,144,120,0.06);
  --ub-popup-radius:12px;
  --ub-popup-shadow:0 0 0 3px rgba(160,200,180,0.15),0 0 0 5px rgba(184,152,72,0.08),0 8px 32px rgba(0,0,0,0.18),0 0 50px rgba(90,144,120,0.1);
  --ub-popup-border:1px solid var(--jade-light);
  --ub-popup-bg:linear-gradient(175deg,var(--jade-surface-1) 0%,var(--jade-surface-2) 30%,var(--jade-surface-3) 70%,var(--jade-surface-2) 100%);
  --ub-popup-head-bg:linear-gradient(180deg,var(--jade-surface-1),var(--jade-surface-2));
  --ub-popup-head-border:1px solid var(--divider-light);
  --ub-btn-radius:10px;
  --ub-toggle-width:36px;--ub-toggle-height:20px;--ub-toggle-knob:16px;
  --ub-ft-ring-start:#b6e2ce;--ub-ft-ring-end:#c8a850;--ub-ft-ring-glow:rgba(104,176,144,.36);
  /* === 立绘主题变量 === */
  --portrait-empty-color:#5a9078;
  --portrait-bg:rgba(255,255,255,.62);
  --portrait-border:#8ab8a0;
  --portrait-radius:8px;
  --accent:var(--ub-accent);
  --card-bg:rgba(255,255,255,.76);
}

/* ===== CSS鍙橀噺锛氱巹澶溌锋湀涓嬪宄?===== */
#ac-content.dark,
.nsfw-overlay.dark,
.panel-overlay.dark,
.settings-overlay.dark,
#ac-options-bar-floating.dark {
  /* === ub-literary-v1 语义 token（仙侠 · 深色）=== */
  --ub-canvas:#0F1514;--ub-surface-1:#151E1B;--ub-surface-2:#1B2723;--ub-surface-3:#22322B;
  --ub-text-1:#E3ECE7;--ub-text-2:#B6C8BF;--ub-text-3:#8EA69B;--ub-text-on-accent:#0F1C17;
  --ub-border-subtle:#2C4038;--ub-border:#415B50;--ub-border-strong:#668577;
  --ub-accent:#62B594;--ub-accent-hover:#79C6A7;--ub-accent-soft:rgba(98,181,148,.11);
  --ub-focus:#76B7D2;--ub-info:#76B7D2;--ub-success:#75C09F;--ub-warning:#D0B16A;--ub-danger:#E47B70;
  --ub-nsfw:var(--gold);--ub-nsfw-soft:var(--gold-pale);
  --ub-shadow-1:0 12px 34px rgba(0,0,0,.45);--ub-shadow-2:0 16px 40px rgba(0,0,0,.55);
  --ub-radius-shell:14px;--ub-radius-panel:10px;--ub-radius-control:8px;
  --bg-1: #0d1117; --bg-2: #111820; --bg-3: #0f141c;
  --jade:var(--ub-accent); --jade-light:var(--ub-border); --jade-deep:var(--ub-accent); --jade-warm: #589878;
  --jade-surface-1:var(--ub-surface-1); --jade-surface-2:var(--ub-surface-2); --jade-surface-3:var(--ub-surface-3);
  --jade-shadow-inner: rgba(255,255,255,0.06); --jade-shadow-edge: rgba(0,0,0,0.4);
  --jade-glow: rgba(100, 200, 255, 0.1);
  --card:var(--ub-surface-1); --card-light:var(--ub-surface-1);
  --gold:var(--ub-warning); --gold-light: #9a7830; --gold-bright: #e0d070; --gold-deep: #f0e898;
  --gold-pale: rgba(220,180,100,0.16); --gold-wash: rgba(220,180,100,0.07);
  --cinnabar: #d07060; --cinnabar-deep: #f09888; --cinnabar-light: rgba(220,110,90,0.14);
  --spirit:var(--ub-info); --spirit-deep: #88c8e8; --spirit-light: rgba(90,170,210,0.14);
  --text:var(--ub-text-1); --text-soft:var(--ub-text-2); --text-muted:var(--ub-text-3);
  --divider:var(--ub-border); --divider-light:var(--ub-border-subtle);
  --ub-overlay-bg:rgba(0,0,0,0.45);
  --ub-scrollbar-thumb:var(--divider);
  --ub-scrollbar-thumb-hover:var(--jade);
  --ub-text-muted:var(--text-muted);
  --ub-bg-card:var(--jade-surface-1);
  /* 日历兄弟弹窗变量·深色（字面量兜底；:root 处已按浅色完成替换，深色必须重声明，见 ios.ts 同款注释） */
  --ub-text:var(--text,#e4ece0);--ub-divider:var(--divider,rgba(70,90,75,0.35));--ub-hover-bg:rgba(255,255,255,0.05);
  --ub-popup-radius:12px;
  --ub-popup-shadow:0 0 0 3px rgba(160,200,180,0.15),0 0 0 5px rgba(184,152,72,0.08),0 8px 32px rgba(0,0,0,0.25);
  --ub-popup-border:1px solid var(--jade-light);
  --ub-popup-bg:linear-gradient(175deg,var(--jade-surface-1) 0%,var(--jade-surface-2) 30%,var(--jade-surface-3) 70%,var(--jade-surface-2) 100%);
  --ub-popup-head-bg:linear-gradient(180deg,var(--jade-surface-1),var(--jade-surface-2));
  --ub-popup-head-border:1px solid var(--divider-light);
  /* === 立绘主题变量（深色覆盖） === */
  --portrait-bg:rgba(30,50,40,.4);
  --portrait-empty-color:#8ab8a0;
  --accent:var(--ub-accent);
  --card-bg:rgba(30,50,40,.5);
}

#ac-statusbar-wrapper {
  font-family: 'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun', serif;
  background: var(--bg-2);
  color: var(--text);
  padding: 10px 6px !important;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
#ac-content {
  overflow: visible !important;
  background: var(--bg-2);
}

/* ===== 澶╀功鐜夌畝涓诲鍣?===== */
.book {
  width: 100%;
  position: relative;
  overflow: visible !important;
  background: linear-gradient(175deg,
    var(--jade-surface-1) 0%,
    var(--jade-surface-2) 15%,
    rgba(210,230,220,0.5) 30%,
    var(--jade-surface-3) 55%,
    rgba(200,222,212,0.6) 75%,
    var(--jade-surface-2) 100%
  );
  border-radius: 12px;
  /* 静态金玉光晕：原 jade-breathe 50% 帧，不再每帧重绘 */
  box-shadow:
    0 0 0 2px var(--jade-light),
    0 0 0 6px rgba(160,200,180,0.2),
    0 4px 20px var(--jade-shadow-edge),
    inset 0 2px 0 var(--jade-shadow-inner),
    inset 0 0 40px rgba(90,144,120,0.04),
    0 0 40px var(--gold-pale),
    0 0 70px rgba(90,144,120,0.12);
  padding: 0;
  margin: 6px;
}

/* ===== 鐜夎川杈规 路 鐏靛厜瑙掗グ ===== */
.book {
  /* 澶栧眰锛氭瀬娣＄帀鑹插厜鏅曪紝鏇夸唬鍘熷厛绐佸厐鐨勯帍閲戠嚎 */
  outline: 1px solid rgba(160,200,180,0.25);
  outline-offset: 3px;
  border-radius: 12px;
}
/* 浅色模式减少半透明叠层与远距离光晕，保留玉色但去除蒙雾感。 */
#ac-content:not(.dark) .book {
  background: linear-gradient(175deg,var(--jade-surface-1) 0%,var(--jade-surface-2) 48%,var(--jade-surface-3) 100%);
  box-shadow:
    0 0 0 2px var(--jade-light),
    0 0 0 5px rgba(160,200,180,.12),
    0 5px 18px var(--jade-shadow-edge),
    inset 0 1px 0 var(--jade-shadow-inner),
    inset 0 0 24px rgba(90,144,120,.025),
    0 0 24px rgba(184,152,72,.07);
}
/* 玄夜：外框硬编码浅玉色（outline/光晕圈/细玉线）不随变量重映射，此处换深色玉线 */
#ac-content.dark .book {
  outline-color: var(--ub-border);
  box-shadow:
    0 0 0 2px var(--jade-light),
    0 0 0 6px color-mix(in srgb, var(--ub-border-strong) 14%, transparent),
    0 4px 20px var(--jade-shadow-edge),
    inset 0 2px 0 var(--jade-shadow-inner),
    inset 0 0 40px color-mix(in srgb, var(--ub-canvas) 55%, transparent),
    0 0 40px color-mix(in srgb, var(--gold) 6%, transparent);
}
#ac-content.dark .book::before { border-color: var(--ub-border); }
#ac-content.dark .book:hover::before { border-color: var(--ub-border-strong); }
.book::before {
  content: ''; position: absolute; inset: -2px; pointer-events: none; z-index: 5;
  border-radius: 13px;
  /* 缁嗙帀绾胯竟妗嗭紝寰厜鍛煎惛 */
  border: 1px solid rgba(160,200,180,0.35);
  transition: border-color 0.8s ease;
}
.book::after {
  content: ''; position: absolute; inset: -5px; pointer-events: none; z-index: 6;
  border-radius: 16px;
  /* 鍥涜锛氱氦缁嗙帀鑹茶绾?+ 鐏靛厜鐐癸紝浠跨帀绠€闀惰 */
  background-image:
    /* TL */ radial-gradient(circle at 1px 1px, var(--jade-light) 0.8px, transparent 1.2px),
              linear-gradient(135deg, var(--jade) 0.8px, transparent 1px),
    /* TR */ radial-gradient(circle at calc(100% - 1px) 1px, var(--jade-light) 0.8px, transparent 1.2px),
              linear-gradient(225deg, var(--jade) 0.8px, transparent 1px),
    /* BR */ radial-gradient(circle at calc(100% - 1px) calc(100% - 1px), var(--jade-light) 0.8px, transparent 1.2px),
              linear-gradient(315deg, var(--jade) 0.8px, transparent 1px),
    /* BL */ radial-gradient(circle at 1px calc(100% - 1px), var(--jade-light) 0.8px, transparent 1.2px),
              linear-gradient(45deg, var(--jade) 0.8px, transparent 1px);
  background-size:
    14px 14px, 14px 14px,
    14px 14px, 14px 14px,
    14px 14px, 14px 14px,
    14px 14px, 14px 14px;
  background-position:
    left 0 top 0, left 0 top 0,
    right 0 top 0, right 0 top 0,
    right 0 bottom 0, right 0 bottom 0,
    left 0 bottom 0, left 0 bottom 0;
  background-repeat: no-repeat;
  opacity: 0.5;
  transition: opacity 0.8s ease;
}
/* hover 鏃惰楗板井寰寒璧?*/
.book:hover::after { opacity: 0.8; }
.book:hover::before { border-color: rgba(160,200,180,0.55); }

/* NSFW杈规鑴夊啿 鈥?瑙掗グ鍚屾鍛煎惛 */
.book.nsfw-border {
  box-shadow: 0 0 0 1px var(--jade-light), 0 0 0 3px rgba(160,200,180,0.2), 0 2px 12px var(--jade-shadow-edge), inset 0 1px 0 var(--jade-shadow-inner), 0 0 0 3px rgba(192,80,72,0.22), 0 0 30px var(--cinnabar-light), 0 0 40px var(--gold-pale), 0 0 70px rgba(90,144,120,0.12);
}
.book.nsfw-border::before { border-color: rgba(140,180,160,0.5); }
#ac-content.dark .book.nsfw-border {
  box-shadow: 0 0 0 1px var(--jade-light), 0 0 0 3px color-mix(in srgb, var(--ub-border-strong) 16%, transparent), 0 2px 12px var(--jade-shadow-edge), inset 0 1px 0 var(--jade-shadow-inner), 0 0 0 3px rgba(192,80,72,0.22), 0 0 30px var(--cinnabar-light), 0 0 40px var(--gold-pale), 0 0 70px color-mix(in srgb, var(--ub-canvas) 60%, transparent);
}
#ac-content.dark .book.nsfw-border::before { border-color: var(--ub-border); }
.book.nsfw-border::after { opacity: 0.6; }
.book.nsfw-border:hover::after { opacity: 0.9; }

/* ===== 椤堕儴闈㈡澘 ===== */
.xx-header {
  padding: 14px 18px 10px;
  position: relative; z-index: 1;
  background: linear-gradient(175deg, var(--jade-surface-1) 0%, var(--jade-surface-2) 70%, var(--jade-surface-3) 100%);
  border-radius: 10px 10px 0 0;
  box-shadow: inset 0 1px 0 var(--jade-shadow-inner);
}
.xx-char-name {
  font-family: 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', 'ZCOOL XiaoWei','Kaiti SC','STKaiti','KaiTi','楷体', serif;
  font-size: 26px; font-weight: 400; letter-spacing: 5px;
  color: var(--text); line-height: 1;
  text-shadow: 0 0 14px rgba(90,144,120,0.15);
  cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.xx-char-name:hover { color: var(--jade-deep); text-shadow: 0 0 20px rgba(90,144,120,0.25); }


/* 场景一键切换按钮 */
.scene-btn { background: transparent; border: 1px solid var(--jade-light); color: var(--text-muted); font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.25s; flex-shrink: 0; padding: 0 8px; height: 30px; border-radius: 15px; font-family: inherit; white-space: nowrap; }
.scene-btn:hover { border-color: var(--gold); color: var(--gold-deep); background: var(--gold-pale); }
.scene-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.scene-btn.scene-active-daily { border-color: var(--jade); color: var(--jade-deep); background: rgba(90,144,120,0.08); }
.scene-btn.scene-active-nsfw { border-color: var(--gold); color: var(--gold-deep); background: var(--gold-pale); box-shadow: 0 0 10px var(--gold-pale); }

.xx-header-action-btn {
  padding: 4px 10px; border-radius: 8px;
  border: 1.5px solid var(--jade-light);
  background: linear-gradient(160deg, rgba(255,255,255,0.4) 0%, rgba(225,240,230,0.25) 30%, rgba(210,228,218,0.18) 70%, rgba(190,215,205,0.12) 100%);
  box-shadow: 0 2px 5px rgba(60,90,70,0.06), inset 0 1px 0 rgba(255,255,255,0.4);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  font-family: inherit; font-size: 12px; letter-spacing: 1px;
  color: var(--text-soft); transition: all 0.3s; white-space: nowrap;
}
#ac-content.dark .xx-header-action-btn {
  background: linear-gradient(160deg, rgba(40,60,50,0.5) 0%, rgba(25,40,32,0.4) 30%, rgba(18,32,26,0.35) 70%, rgba(12,24,18,0.3) 100%);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04);
}
.xx-header-action-btn:hover {
  box-shadow: var(--spirit-light);
  border-color: var(--gold);
  box-shadow: 0 3px 10px rgba(60,90,70,0.08), 0 0 12px var(--gold-pale);
  color: var(--gold-deep);
}

.wardrobe-protagonist-summary{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-top:6px;padding:4px 10px;border:1px solid var(--divider-light);border-radius:4px;background:linear-gradient(135deg,var(--gold-wash),rgba(90,144,120,.04));color:var(--text-soft);font-size:11px;letter-spacing:.5px;line-height:1.35;cursor:pointer;text-align:left;overflow:hidden;box-shadow:0 0 12px var(--gold-pale);transition:box-shadow .3s,border-color .3s}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--jade-deep);font-weight:600;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-soft);border-left:1px solid var(--divider-light);padding-left:6px}
.wardrobe-protagonist-summary:hover{border-color:var(--jade);box-shadow:0 0 18px var(--gold-pale)}

/* ===== 鍙屼慨绉樻硶鍖?===== */
.xx-cul-section {
  padding: 0; position: relative;
  background: linear-gradient(175deg, var(--jade-surface-1) 0%, var(--jade-surface-2) 50%, var(--jade-surface-3) 100%);
  border-radius: 8px;
  box-shadow: inset 0 1px 0 var(--jade-shadow-inner);
  margin: 4px 10px;
}





/* 深色：--jade-deep 翻为浅玉，白字不可读，改深玉底 */

/* ===== 瑙掕壊閫夋嫨涓?===== */
.xx-char-pill {
  padding: 6px 18px; border-radius: 18px;
  border: 1.5px solid var(--jade-light);
  background: linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(220,235,225,0.18) 40%, rgba(200,220,210,0.12) 100%);
  box-shadow: 0 1px 4px rgba(60,90,70,0.05), inset 0 1px 0 rgba(255,255,255,0.4);
  cursor: pointer; font-family: 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', serif;
  font-size: 13px; color: var(--text-muted); letter-spacing: 3px;
  transition: all 0.3s; position: relative;
}
#ac-content.dark .xx-char-pill {
  background: linear-gradient(160deg, rgba(40,60,50,0.4) 0%, rgba(25,40,32,0.3) 40%, rgba(18,30,24,0.25) 100%);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04);
}
.xx-char-pill:hover {
  border-color: var(--jade-warm); color: var(--jade-deep);
  box-shadow: 0 2px 8px var(--spirit-light);
  box-shadow: 0 3px 10px rgba(60,90,70,0.08), 0 0 12px rgba(90,144,120,0.1);
}
.xx-char-pill.active {
  border-color: var(--jade-deep); color: var(--jade-deep);
  background: linear-gradient(160deg, rgba(255,255,255,0.45) 0%, rgba(200,225,215,0.25) 40%, rgba(180,210,200,0.18) 100%);
  box-shadow: 0 1px 3px rgba(60,90,70,0.06), inset 0 1px 0 rgba(255,255,255,0.5), 0 0 14px rgba(90,144,120,0.15);
}
#ac-content.dark .xx-char-pill.active {
  background: linear-gradient(160deg, rgba(50,75,60,0.55) 0%, rgba(30,50,38,0.45) 40%, rgba(20,38,28,0.35) 100%);
}
.xx-char-pill.active::after {
  content: '✦'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%) translateY(-3px);
  font-size: 8px; color: var(--gold);
  text-shadow: 0 0 5px var(--gold-pale);
}

/* ===== 瑙掕壊璇︽儏闈㈡澘 ===== */


.xx-thought-bubble {
  margin: 6px 0 0; padding: 10px 14px; border-radius: 12px;
  background: rgba(90,144,120,0.05); border-left: 3px solid var(--jade-light);
  font-size: 13px; color: var(--jade-deep); font-style: italic;
  line-height: 1.7; letter-spacing: 0.5px;
}

/* 蹇冨/鎰忓浘琛?鈥?姣忚鍙充晶鏀惧姛鑳芥寜閽?*/
.xx-info-label { font-size: 12px; color: var(--jade-deep); font-weight: 500; flex-shrink: 0; letter-spacing: 0.5px; }
/* 鍓嶄笘浠婄敓鎸夐挳鍦ㄤ粰渚犱腑涓?xx-info-side-btn 椋庢牸缁熶竴 */

/* 閬撳績钂欏皹杩涘害鏉?*/

/* 璇︽儏tab */

/* 鍗曞垪鍒楄〃 */
.xx-detail-item {
  display: flex; gap: 8px; padding: 6px 10px; border-radius: 8px; font-size: 11px;
  background: rgba(0,0,0,0.012); transition: all 0.2s;
}
#ac-content.dark .xx-detail-item { background: rgba(255,255,255,0.012); }
.xx-detail-item:hover { background: rgba(90,144,120,0.06); }
.xx-detail-item .xx-dl { color: var(--jade-deep); font-weight: 500; min-width: 60px; flex-shrink: 0; font-size: 10px; letter-spacing: 0.5px; }
.xx-detail-item .xx-dv { color: var(--text-soft); flex: 1; }
.xx-detail-item.touched { animation: xx-touch 1s ease; }
@keyframes xx-touch {
  0% { background: transparent; }
  15% { background: rgba(90,144,120,0.15); transform: scaleX(1.02); text-shadow: 0 0 4px rgba(90,144,120,0.12); }
  30% { transform: translateX(3px); background: rgba(90,144,120,0.1); }
  50% { transform: translateX(-3px) skewX(-2deg); background: rgba(90,144,120,0.08); }
  70% { transform: translateX(1px) skewX(1deg); }
  100% { background: transparent; transform: translateX(0) skewX(0); }
}

/* ===== 寮圭獥 ===== */
.nsfw-overlay, .panel-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh;
  background: rgba(0,0,0,0.3); z-index: 10000;
  display: none; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.nsfw-overlay.show, .panel-overlay.show { display: flex; }
.panel-popup {
  background: linear-gradient(175deg,
    var(--jade-surface-1) 0%,
    var(--jade-surface-2) 30%,
    var(--jade-surface-3) 70%,
    var(--jade-surface-2) 100%
  );
  border: 1px solid var(--jade-light); border-radius: 12px;
  width: 90%; max-width: 370px; max-height: 72vh;
  box-shadow:
    0 0 0 3px rgba(160,200,180,0.15),
    0 0 0 5px rgba(184,152,72,0.08),
    0 8px 32px rgba(0,0,0,0.18),
    0 0 50px rgba(90,144,120,0.1);
  animation: popup-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
  position: relative;
}
.panel-popup { display: flex; flex-direction: column; }
@keyframes popup-in { from { opacity: 0; transform: scale(0.9) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.panel-popup-head {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid var(--divider-light);
  position: sticky; top: 0;
  background: linear-gradient(180deg, var(--jade-surface-1), var(--jade-surface-2));
  z-index: 1; border-radius: 12px 12px 0 0;
}
.panel-popup-head { flex-shrink: 0; }
.panel-popup-title {
  font-family: 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', serif; font-size: var(--ub-popup-font-title,13px);
  color: var(--text); letter-spacing: 2px; flex: 1;
}
.panel-popup-close, .panel-popup-back {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid var(--divider); background: transparent;
  color: var(--text-muted); cursor: pointer;
  font-size: 10px; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.panel-popup-close:hover, .panel-popup-back:hover {
  border-color: var(--cinnabar); color: var(--cinnabar); background: var(--cinnabar-light);
}
.panel-popup-back { width: auto; padding: 0 8px; font-size: 11px; border-radius: 12px; }
.panel-popup-warehouse-toggle {
  font-size: 9px; width: auto; padding: 0 8px; height: 22px;
  border-radius: 12px; border: 1px solid var(--divider);
  background: transparent; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
  font-family: inherit; margin-right: 6px; letter-spacing: 1px;
}
.panel-popup-warehouse-toggle:hover { border-color: var(--gold); color: var(--gold-deep); background: var(--gold-pale); }

.panel-popup-body { padding: 12px 16px 16px; }
.panel-popup-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.panel-popup-body::-webkit-scrollbar { width: 4px; }
.panel-popup-body::-webkit-scrollbar-track { background: transparent; }
.panel-popup-body::-webkit-scrollbar-thumb { background: var(--divider); border-radius: 2px; }
.panel-popup-body::-webkit-scrollbar-thumb:hover { background: var(--jade); }
.char-info-popup{max-width:440px;width:90%;max-height:80vh;display:flex;flex-direction:column}
.char-info-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px 16px 16px}
.char-info-body::-webkit-scrollbar{width:4px}
.char-info-body::-webkit-scrollbar-track{background:transparent}
.char-info-body::-webkit-scrollbar-thumb{background:var(--divider);border-radius:2px}
.char-info-body::-webkit-scrollbar-thumb:hover{background:var(--jade)}
.char-info-panel{display:none}
.char-info-panel.active{display:flex;flex-direction:column;gap:0}
.char-info-card{border:1px solid var(--divider);padding:16px;background:linear-gradient(135deg,var(--jade-surface-1),rgba(100,200,255,0.03));box-shadow:0 4px 16px rgba(0,0,0,0.05)}
.char-info-card-name{font-size:16px;font-weight:700;color:var(--jade-deep);letter-spacing:3px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--divider);text-shadow:0 0 6px var(--jade-glow)}
.char-info-card-rows{display:flex;flex-direction:column;gap:6px}
.char-info-card-rows .detail-row{font-size:var(--ub-ui-font-13,13px)}
.char-info-card-rows .dl{color:var(--text-muted);min-width:50px}
.panel-empty { text-align: center; padding: 24px 0; color: var(--text-muted); font-size: 11px; letter-spacing: 2px; }

/* 鍒楄〃椤?*/
.memo-list-item, .item-list-item, .diary-list-item {
  padding: 8px 12px; margin-bottom: 6px;
  border: 1px solid var(--divider-light); border-radius: 8px;
  cursor: pointer; transition: all 0.2s;
}
.item-list-item { position: relative; }
.memo-list-item:hover, .item-list-item:hover, .diary-list-item:hover {
  border-color: var(--jade); background: rgba(90,144,120,0.06);
}
.memo-item-top, .item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.memo-title, .item-name {
  font-size: var(--ub-ui-font-11,11px); font-weight: 500; color: var(--text);
  letter-spacing: 0.5px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.memo-type, .item-type {
  font-size: 8px; color: var(--jade-deep); padding: 1px 6px; border-radius: 8px;
  background: rgba(90,144,120,0.08); letter-spacing: 1px; flex-shrink: 0;
}
.item-wardrobe-badge{display:inline-flex;align-items:center;border-radius:8px;background:var(--accent);color:#fff;padding:1px 6px;font-size:8px;font-weight:700;letter-spacing:1px;flex-shrink:0;margin-left:4px}
.item-qty {
  font-size: 9px; font-weight: 600; color: var(--jade-deep);
  background: rgba(90,144,120,0.08); padding: 1px 6px; border-radius: 8px;
  flex-shrink: 0; letter-spacing: 0.5px;
}
.memo-item-sub, .item-desc, .diary-item-content {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;
  font-size: var(--ub-ui-font-9,9px); color: var(--text-muted);
}
.item-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.memo-status, .memo-char, .memo-time-badge { padding: 1px 4px; letter-spacing: 0.5px; font-size: 8px; }

/* 浠诲姟鍒楄〃 */
.mission-list-item {
  padding: 10px 12px; margin-bottom: 8px;
  border: 1px solid var(--divider-light); border-radius: 8px;
  cursor: pointer; transition: all 0.2s;
  position: relative; overflow: hidden;
}
.mission-list-item:hover { border-color: var(--jade); background: rgba(90,144,120,0.06); }
.mission-list-item.completed { border-color: var(--jade); background: rgba(90,144,120,0.04); cursor: pointer; }
.mission-list-item.completed:hover { background: rgba(90,144,120,0.08); }
.mission-list-item .mission-delete {
  position: absolute; top: 6px; right: 8px; width: 20px; height: 20px;
  border-radius: 50%; border: 1px solid var(--divider); background: transparent;
  color: var(--text-muted); font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; z-index: 2; font-family: inherit;
}
.mission-list-item .mission-delete:hover { border-color: var(--cinnabar); color: var(--cinnabar); background: var(--cinnabar-light); }
.mission-name { font-size: var(--ub-ui-font-11,11px); font-weight: 600; color: var(--jade-deep); letter-spacing: 0.5px; margin-bottom: 4px; padding-right: 28px; }
.mission-desc { font-size: var(--ub-ui-font-10,10px); color: var(--text-soft); margin-bottom: 6px; line-height: 1.5; }
.mission-desc-clickable { cursor: pointer; transition: all 0.2s; padding: 2px 4px; border-radius: 4px; display: inline-block; }
.mission-desc-clickable:hover { background: rgba(90,144,120,0.06); }
.mission-objective { font-size: var(--ub-ui-font-10,10px); color: var(--text-muted); padding: 6px 8px; background: rgba(0,0,0,0.012); border-left: 2px solid var(--jade); line-height: 1.6; border-radius: 0 6px 6px 0; }
.mission-status { display: inline-block; font-size: 9px; padding: 2px 8px; border-radius: 10px; margin-top: 6px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.mission-status:hover { filter: brightness(1.1); }
.mission-status.pending { color: var(--text-muted); background: rgba(0,0,0,0.03); border: 1px solid var(--divider-light); }
.mission-status.completed { color: #fff; background: var(--jade-deep); border: 1px solid var(--jade-deep); }
/* 深色：--jade-deep 翻为浅玉，白字不可读，改深玉底 */
.dark .mission-status.completed { color: #fff; background: #2a6048; border: 1px solid #2a6048; }

/* 鏃ヨ鍒楄〃 */
.diary-item-top { display: flex; align-items: center; gap: 8px; font-size: 9px; color: var(--text-muted); margin-bottom: 4px; }
.diary-time { flex-shrink: 0; }
.diary-item-content { font-size: var(--ub-ui-font-11,11px); color: var(--text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }

/* NSFW琛?& 璇︽儏琛?*/
.detail-row{ display: flex; padding: 5px 0; border-bottom: 1px solid var(--divider-light); font-size: var(--ub-ui-font-10,10px); line-height: 1.6; }
.detail-row:last-child{ border-bottom: none; }
.detail-row .dl{ color: var(--jade-deep); font-weight: 500; min-width: 68px; flex-shrink: 0; letter-spacing: 0.5px; font-size: 8px; }
.detail-row .dv{ color: var(--text-soft); flex: 1; }
.detail-content { padding: 8px 0; }
.detail-content .dl { color: var(--jade-deep); font-weight: 500; font-size: 9px; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
.detail-content .dc { color: var(--text-soft); font-size: var(--ub-ui-font-10,10px); line-height: 1.8; }

.item-detail-actions { display: flex; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--divider-light); }
.item-use-btn, .item-discard-btn {
  flex: 1; padding: 5px 10px; border-radius: 10px;
  border: 1px solid var(--divider); font-size: 10px; font-family: inherit; cursor: pointer;
  letter-spacing: 0.5px; transition: all 0.2s; font-weight: 500;
}
.item-use-btn { background: rgba(90,144,120,0.06); color: var(--jade-deep); border-color: var(--jade-light); }
.item-use-btn:hover { background: rgba(90,144,120,0.12); border-color: var(--jade-deep); box-shadow: 0 0 8px rgba(90,144,120,0.1); }
.item-discard-btn { background: transparent; color: var(--text-muted); border-color: var(--divider); }
.item-discard-btn:hover { border-color: var(--cinnabar); color: var(--cinnabar-deep); background: var(--cinnabar-light); }
.item-warehouse-btn {
  flex: 1; padding: 5px 10px; border-radius: 10px;
  border: 1px solid var(--divider); font-size: 10px; font-family: inherit;
  cursor: pointer; letter-spacing: 0.5px; transition: all 0.2s; font-weight: 500;
  background: transparent; color: var(--text-soft);
}
.item-warehouse-btn:hover { border-color: var(--gold); color: var(--gold-deep); background: var(--gold-pale); }

.diary-detail-writer {
  display:flex;align-items:center;justify-content:center;gap:10px; text-align: center; font-family: 'Liu Jian Mao Cao','Kaiti SC','STKaiti','KaiTi','楷体', cursive;
  font-size: 13px; color: var(--jade-deep); letter-spacing: 2px; margin-bottom: 8px;
}
.diary-nav-btn {
  flex: 0 0 auto; width: 26px; height: 26px; line-height: 24px; text-align: center;
  border: 1px solid var(--divider); border-radius: 50%; background: transparent;
  color: var(--jade-deep); cursor: pointer; font-size: var(--ub-ui-font-10,10px); padding: 0;
  transition: opacity .2s, border-color .2s;
}
.diary-nav-btn:hover:not(:disabled) { opacity: .8; border-color: var(--jade-deep); }
.diary-nav-btn:disabled { opacity: .3; cursor: default; }
.diary-nav-indicator { text-align: center; font-size: var(--ub-ui-font-11,11px); color: var(--text-muted); margin-top: 8px; letter-spacing: 1px; }
.diary-content { padding: 8px 0; }
.diary-content .dc { color: var(--text-soft); font-size: 11px; line-height: 1.9; font-style: italic; }

/* ===== 鏃ヨ鏈?===== */
.diary-notebook {
  position: relative; padding: 22px 26px; margin: 8px 0;
  background: linear-gradient(180deg, #f4faf6 0%, #e8f2ec 100%);
  border: 1px solid var(--divider); border-radius: 8px;
  box-shadow: 0 2px 8px rgba(60,90,70,0.06), inset 0 0 30px rgba(90,144,120,0.03);
}
.diary-notebook::before { content: ''; position: absolute; top: 0; left: 38px; bottom: 0; width: 1px; background: rgba(160,200,180,0.25); pointer-events: none; z-index: 1; }
.diary-notebook::after { content: ''; position: absolute; top: 0; left: 42px; bottom: 0; width: 1px; background: rgba(160,200,180,0.12); pointer-events: none; z-index: 1; }
.diary-notebook-lines {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(transparent, transparent 27px, rgba(160,200,180,0.1) 27px, rgba(160,200,180,0.1) 28px);
  pointer-events: none; z-index: 0;
}
.diary-notebook .diary-content { position: relative; z-index: 1; padding: 0; }
.diary-notebook .diary-content .dc {
  font-family: 'LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC', 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', serif; font-size: 14px;
  line-height: 28px; color: var(--text); font-style: normal; letter-spacing: 0.5px;
}
.diary-notebook .diary-content .dc .strikethrough { text-decoration: line-through; text-decoration-thickness: 0.12em; text-decoration-color: #b0725a; opacity: 0.75; }
.diary-notebook .diary-content .dc .highlight { background: linear-gradient(180deg, rgba(200,220,190,0.45) 0%, rgba(180,210,180,0.55) 100%); padding: 2px 6px; border-radius: 3px 7px 4px 5px; box-shadow: 0 0 0 1px rgba(140,180,150,0.15), inset 0 -1px 2px rgba(130,170,140,0.1); }
.diary-notebook .diary-content .dc .underline { text-decoration: underline; text-decoration-style: wavy; text-decoration-thickness: from-font; text-underline-offset: 4px; text-decoration-color: #8899aa; }
.diary-notebook .diary-content .dc .emphasis { display: inline-block; border: 2px solid #c44a3a; border-radius: 42% 58% 55% 45% / 48% 45% 55% 52%; padding: 0 5px; transform: rotate(-0.5deg); color: inherit; font-weight: 600; }
.diary-notebook .diary-content .dc .handwritten { font-family: 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', 'LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC', cursive; font-size: 15px; color: #2c1810; text-shadow: 0.5px 0.5px 0 rgba(0,0,0,0.06); letter-spacing: 0.3px; }
.diary-notebook .diary-content .dc .messy { display: inline-block; transform: rotate(-1.2deg) translateY(1px); font-family: 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', 'LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC', cursive; font-size: 14px; color: #3a2a1a; text-shadow: 0.5px 1px 0 rgba(0,0,0,0.05); letter-spacing: -0.2px; }
.diary-notebook .diary-content .dc .censored { position: relative; color: rgba(44,24,16,0.28); padding: 0 4px; border-radius: 2px; cursor: pointer; transition: all 0.3s; background-color: rgba(150,170,150,0.06); background-image: repeating-linear-gradient(-5deg, transparent, transparent 2.5px, rgba(130,150,130,0.32) 2.5px, rgba(130,150,130,0.32) 3.5px), repeating-linear-gradient(12deg, transparent, transparent 3px, rgba(140,160,140,0.25) 3px, rgba(140,160,140,0.25) 4px), repeating-linear-gradient(-18deg, transparent, transparent 3.5px, rgba(120,140,120,0.28) 3.5px, rgba(120,140,120,0.28) 4.5px); background-repeat: repeat; background-size: 24px 24px; }
.diary-notebook .diary-content .dc .censored:hover { background-image: none; background-color: transparent; color: inherit; padding: 0 4px; }

.dark .diary-notebook { background: linear-gradient(180deg, #1a1e18 0%, #161a14 100%); border-color: var(--divider); box-shadow: 0 2px 8px rgba(0,0,0,0.2), inset 0 0 30px rgba(90,144,120,0.05); }
.dark .diary-notebook::before { background: rgba(80,100,85,0.2); }
.dark .diary-notebook::after { background: rgba(80,100,85,0.1); }
.dark .diary-notebook-lines { background: repeating-linear-gradient(transparent, transparent 27px, rgba(160,200,180,0.06) 27px, rgba(160,200,180,0.06) 28px); }
.dark .diary-notebook .diary-content .dc { color: var(--text); }
.dark .diary-notebook .diary-content .dc .highlight { background: linear-gradient(180deg, rgba(200,220,180,0.32) 0%, rgba(180,210,170,0.38) 100%); box-shadow: 0 0 0 1px rgba(160,200,160,0.12), inset 0 -1px 2px rgba(140,180,140,0.08); }
.dark .diary-notebook .diary-content .dc .underline { text-decoration-color: #aab8c8; }
.dark .diary-notebook .diary-content .dc .emphasis { border-color: #d4685a; color: #e8dcc8; }
.dark .diary-notebook .diary-content .dc .strikethrough { text-decoration-color: #c89860; }
.dark .diary-notebook .diary-content .dc .handwritten { color: #e8dcc8; }
.dark .diary-notebook .diary-content .dc .messy { color: #d8c8b0; }
.dark .diary-notebook .diary-content .dc .censored { color: rgba(232,220,200,0.22); background-color: rgba(160,180,160,0.05); background-image: repeating-linear-gradient(-5deg, transparent, transparent 2.5px, rgba(170,190,170,0.3) 2.5px, rgba(170,190,170,0.3) 3.5px), repeating-linear-gradient(12deg, transparent, transparent 3px, rgba(180,200,180,0.22) 3px, rgba(180,200,180,0.22) 4px), repeating-linear-gradient(-18deg, transparent, transparent 3.5px, rgba(160,180,160,0.26) 3.5px, rgba(160,180,160,0.26) 4.5px); }
.dark .diary-notebook .diary-content .dc .censored:hover { background-image: none; background-color: transparent; color: inherit; }
.diary-detail-popup { max-width: 520px !important; }

/* ===== 璁剧疆闈㈡澘 ===== */
.settings-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh;
  background: rgba(0,0,0,0.3); z-index: 10002;
  display: none; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.settings-overlay.show { display: flex; }
.settings-popup {
  background: linear-gradient(175deg,
    var(--jade-surface-1) 0%,
    var(--jade-surface-2) 30%,
    var(--jade-surface-3) 70%,
    var(--jade-surface-2) 100%
  );
  border: 1px solid var(--jade-light); border-radius: 12px;
  width: 90%; max-width: 280px; max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 0 0 3px rgba(160,200,180,0.15), 0 8px 32px rgba(0,0,0,0.18);
  animation: popup-in 0.3s ease;
}
.settings-popup-head {
  padding: 12px 16px; display: flex; align-items: center; gap: 8px;
  border-bottom: 1px solid var(--divider-light); flex-shrink: 0;
}
.settings-popup-title { font-family: 'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体', serif; font-size: var(--ub-popup-font-title,13px); color: var(--text); letter-spacing: 2px; flex: 1; }
.settings-popup-close {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid var(--divider); background: transparent;
  color: var(--text-muted); cursor: pointer;
  font-size: 10px; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.settings-popup-close:hover { border-color: var(--jade-deep); color: var(--jade-deep); background: rgba(90,144,120,0.08); }
.settings-tabs { display: flex; border-bottom: 1px solid var(--divider-light); padding: 0 16px; background: rgba(0,0,0,0.01); }
.settings-tab {
  flex: 1; padding: 10px 6px; border: none; background: transparent;
  color: var(--text-muted); font-size: 12px;
  font-family: 'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun', serif; letter-spacing: 1px;
  cursor: pointer; transition: all 0.2s; position: relative; font-weight: 500;
}
.settings-tab:hover { color: var(--text); background: rgba(90,144,120,0.04); }
.settings-tab.active { color: var(--jade-deep); background: rgba(90,144,120,0.06); }
.settings-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 15%; right: 15%; height: 2px; background: linear-gradient(90deg, var(--jade-light), var(--jade), var(--jade-light)); border-radius: 1px; }
.settings-popup-body { padding: 12px 16px; overflow-y: auto; flex: 1; min-height: 80px; }
.settings-tab-content { display: none; }
.settings-tab-content.active { display: block; animation: fade-in 0.2s ease; }
.settings-section { margin: 10px 0; padding: 10px 12px; border-radius: 6px; background: rgba(90,144,120,0.04); border: 1px solid var(--divider-light); }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.settings-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--divider-light); }
.settings-row:last-child { border-bottom: none; }
.settings-label{font-size:var(--ub-ui-font-11,11px);color:var(--text);letter-spacing:1px;}
.settings-toggle { width: 36px; height: 20px; border-radius: 10px; background: var(--divider); cursor: pointer; position: relative; transition: background 0.3s; border: none; padding: 0; }
.settings-toggle.on { background: var(--jade-deep); }
.settings-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.settings-toggle.on::after { transform: translateX(16px); }

/* ===== 鐐瑰嚮鐗规晥 ===== */
.click-heart {
  position: fixed; pointer-events: none; z-index: 9999;
  font-size: 14px; color: var(--jade-deep);
  animation: heart-rise 1.8s ease-out forwards;
  text-shadow: 0 0 6px rgba(90,144,120,0.2);
}
.click-text {
  position: fixed; pointer-events: none; z-index: 9999;
  font-size: 10px; color: var(--jade-deep);
  white-space: nowrap;
  animation: text-drift 2s ease-out forwards;
  opacity: 0.8; text-shadow: 0 0 6px rgba(90,144,120,0.15);
  letter-spacing: 1px;
}
@keyframes heart-rise {
  0% { opacity: 1; transform: translateY(0) scale(.5) rotate(0deg); }
  30% { opacity: 1; transform: translateY(-20px) scale(1.2) rotate(-15deg); }
  100% { opacity: 0; transform: translateY(-80px) scale(.3) rotate(20deg); }
}
@keyframes text-drift {
  0% { opacity: 0; transform: translateY(0) translateX(0) scale(.8); }
  15% { opacity: .9; transform: translateY(-10px) translateX(5px) scale(1); }
  100% { opacity: 0; transform: translateY(-60px) translateX(var(--drift-x,30px)) scale(.6); }
}
.tab-ripple {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle, rgba(90,144,120,0.12) 0%, transparent 70%);
  animation: tab-glow .6s ease-out forwards;
  pointer-events: none; border-radius: inherit;
}
@keyframes tab-glow {
  0% { opacity: 1; transform: scale(.8); }
  100% { opacity: 0; transform: scale(1.1); }
}

/* 榧犳爣鍏夋檿 */
.mouse-glow {
  position: fixed; width: 80px; height: 80px; border-radius: 50%;
  pointer-events: none; z-index: 100;
  background: radial-gradient(circle, rgba(90,144,120,0.1) 0%, transparent 70%);
  transform: translate(-50%, -50%); transition: opacity .3s; opacity: 0;
}
.mouse-glow.active { opacity: 1; }

/* ===== 鍥哄畾妯″紡鎶樺彔鐘舵€?===== */
#ac-statusbar-wrapper.ub-collapsed { display: none !important; visibility: hidden !important; pointer-events: none !important; overflow: hidden !important; }

/* ===== 甯姪鎻愮ず ===== */
.help-tip-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  border: 1px solid var(--divider); background: transparent;
  color: var(--text-muted); font-size: 9px; font-weight: bold;
  cursor: help; flex-shrink: 0; line-height: 1; font-family: inherit;
  transition: all 0.2s;
}
.help-tip-btn:hover { border-color: var(--gold); color: var(--gold-deep); background: var(--gold-pale); }

.help-tooltip-global {
  position: fixed; z-index: 100000; max-width: 260px;
  padding: 10px 14px; border-radius: 10px;
  background: var(--jade-surface-1); border: 1px solid var(--jade-light);
  color: var(--text); font-size: 11px; line-height: 1.7;
  letter-spacing: 0.5px; white-space: pre-line; pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

/* ===== 鍝嶅簲寮?===== */
@media (max-width: 600px) {
  .xx-header { padding: 8px 10px 10px; }
  .xx-char-name { font-size: 17px; letter-spacing: 3px; }
  .xx-header-action-btn { padding: 3px 8px; font-size: 11px; }
  .xx-char-pill { font-size: 10px; padding: 4px 12px; }
  .xx-detail-item .xx-dl { min-width: 40px; }
}
.dark .char-info-card{background:linear-gradient(135deg,var(--jade-surface-1),rgba(100,200,255,0.05))}
.dark .char-info-card-name{color:var(--jade)}
/* === 过往经历时间轴 · 云海仙踪 === */
.pe-intro{background:linear-gradient(135deg,#f4faf6,#e8f2ec);border:1px solid #c0dcd0;padding:10px 12px;box-shadow:0 0 12px rgba(100,200,255,0.1)}
.pe-intro-label{color:#5a9078;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;letter-spacing:3px}
.pe-intro-text{color:#3a4a3a}
.pe-rail::before{background:linear-gradient(#5a9078,rgba(184,152,72,0.2))}
.pe-dot{background:#8ab8a0;border:2px solid #f4faf6;box-shadow:0 0 0 1px #b89848,0 0 10px rgba(100,200,255,0.35);width:12px;height:12px;top:4px}
.pe-date{color:#5a9078;font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;letter-spacing:2px}
.pe-card{background:#f4faf6;border:1px solid #c0dcd0;color:#3a4a3a;box-shadow:0 0 8px rgba(100,200,255,0.06)}
/* 暗色 */
.dark .pe-intro{background:linear-gradient(135deg,#19241e,#151e1a);border-color:#3d6a55;box-shadow:0 0 12px rgba(100,200,255,0.08)}
.dark .pe-intro-label{color:#88d0b8}
.dark .pe-intro-text{color:#a0c0b0}
.dark .pe-rail::before{background:linear-gradient(#68b090,rgba(200,170,100,0.2))}
.dark .pe-dot{background:#68b090;border-color:#19241e;box-shadow:0 0 0 1px #c8a850,0 0 12px rgba(100,200,255,0.3)}
.dark .pe-date{color:#88d0b8}
.dark .pe-card{background:#151e1a;border-color:#3d6a55;color:#a0c0b0;box-shadow:0 0 8px rgba(100,200,255,0.06)}
/* === db 弹窗 token 桥接：xianxia :root 未定义 --card-light，用玉色面 --jade-surface-1(#fbfdfb，不透明)；text/divider 已定义 === */
.db-viewer-popup,.db-row-detail-popup,.db-confirm-popup,.db-merge-progress-popup,.db-merge-config-popup{--card-light:var(--jade-surface-1)}
` + baseCSS + readingThemeCSS + /* === ub-literary-v1 xianxia shell decoration（月白青玉，§6.3/§10）=== */ `
.ub-reading-shell{position:relative}
.ub-reading-shell::before{
  content:'';position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.04;
  background:
    radial-gradient(ellipse at 8% -4%,rgba(55,110,138,.08),transparent 36%),
    radial-gradient(ellipse at 100% 100%,rgba(40,115,92,.07),transparent 42%);
}
.ub-reading-shell > *{position:relative;z-index:1}
.ub-masthead::after{
  content:'';position:absolute;left:18px;right:18px;bottom:-1px;height:1px;
  background:linear-gradient(90deg,transparent,var(--ub-accent),transparent);opacity:.55;
}
.ub-profile-thought{border-radius:8px}
.ub-reading-shell .ub-badge{min-width:18px;height:18px;font-size:11px}
` + literaryBaseCSS;

export const xianxiaCSS = xianxiaCoreCSS + /* css */ `
/* 角色中枢 / 剧情回顾：玉简云纹 */
.char-hub-theme-xianxia,.chronicle-reader-theme-xianxia{--hub-bg:var(--jade-surface-1);--hub-panel:var(--jade-surface-2);--hub-line:var(--ub-border);--hub-ink:var(--ub-text-1);--hub-muted:var(--ub-text-3);--hub-accent:var(--ub-accent);--hub-soft:var(--jade-surface-2);--hub-female:#d63384;--hub-male:#4a90e2;--hub-inv:#4a90e2;--hub-itv:#3a8a5a;--hub-day:var(--jade-surface-2);--hub-night:rgba(138,108,184,.08);--hub-night-ink:var(--ub-accent);--hub-pref:#8a6abc}
.char-hub-theme-xianxia .char-hub-gsym.is-female{color:var(--hub-female)}.char-hub-theme-xianxia .char-hub-gsym.is-male{color:var(--hub-male)}
.char-hub-theme-xianxia .char-hub-lead-banner{background:linear-gradient(90deg,var(--hub-panel),var(--hub-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hub-accent) 18%,transparent)}
.char-hub-theme-xianxia .char-hub-action--investigate{color:var(--hub-inv);border-color:color-mix(in srgb,var(--hub-inv) 40%,var(--hub-line));background:color-mix(in srgb,var(--hub-inv) 10%,var(--hub-bg))}
.char-hub-theme-xianxia .char-hub-action--interview{color:var(--hub-itv);border-color:color-mix(in srgb,var(--hub-itv) 40%,var(--hub-line));background:color-mix(in srgb,var(--hub-itv) 10%,var(--hub-bg))}
.char-hub-theme-xianxia .char-hub-identity,.chronicle-reader-theme-xianxia .chronicle-reader-card{border-color:var(--hub-line);background:linear-gradient(135deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hub-accent) 18%,transparent)}
.char-hub-theme-xianxia .char-hub-card{border-radius:10px 2px 10px 2px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-panel));box-shadow:0 7px 20px rgba(36,90,76,.08)}
.char-hub-theme-xianxia .char-hub-profile-lede{border-radius:0 12px 12px 0;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--hub-accent) 9%,transparent),transparent 55%),var(--hub-soft)}
.char-hub-theme-xianxia .char-hub-prose-card,.char-hub-theme-xianxia .char-hub-logic{border-radius:10px 2px 10px 2px;background:linear-gradient(145deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hub-accent) 10%,transparent)}
.char-hub-theme-xianxia .char-hub-logic-index{border-radius:50% 50% 50% 2px;background:var(--hub-soft)}
.char-hub-theme-xianxia .char-hub-trait-balance{gap:12px}.char-hub-theme-xianxia .char-hub-trait-column{border-style:double;border-radius:9px 2px 9px 2px}
.char-hub-theme-xianxia .char-hub-relation-card{border-radius:9px 2px 9px 2px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hub-accent) 9%,transparent)}.char-hub-theme-xianxia .char-hub-relation-avatar{border-radius:50% 50% 50% 3px;background:var(--hub-soft)}
.char-hub-theme-xianxia .char-hub-history-preview{gap:12px}.char-hub-theme-xianxia .char-hub-history-background,.char-hub-theme-xianxia .char-hub-history-latest{border-radius:9px 2px 9px 2px;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--hub-accent) 8%,transparent),transparent 58%),var(--hub-bg)}
.char-hub-theme-xianxia .char-hub-not-equal{overflow:hidden;border-radius:10px 2px 10px 2px;background:var(--hub-bg)}.char-hub-theme-xianxia .char-hub-not-equal-label{background:radial-gradient(circle,var(--hub-soft),var(--hub-panel))}
.char-hub-theme-xianxia .char-hub-intimacy-slip{border-radius:10px 2px 10px 2px;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--hub-accent) 10%,transparent),transparent 60%),var(--hub-bg)}
.char-hub-theme-xianxia .char-hub-vitals-strip,.char-hub-theme-xianxia .char-hub-vitals-raw,.char-hub-theme-xianxia .char-hub-nsfw-card,.char-hub-theme-xianxia .char-hub-dual-stat,.char-hub-theme-xianxia .char-hub-speech{border-radius:10px 2px 10px 2px}
.char-hub-theme-xianxia .char-hub-vitals-strip{background:linear-gradient(145deg,var(--hub-bg),var(--hub-panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hub-accent) 10%,transparent)}
.panel-overlay.dark .char-hub-theme-xianxia{--hub-day:rgba(94,200,216,.04);--hub-night:rgba(140,108,184,.08);--hub-night-ink:#a890d8;--hub-pref:#a890d8}
.char-hub-theme-xianxia .char-hub-ms-list{position:relative;padding-left:16px}
.char-hub-theme-xianxia .char-hub-ms-list::before{content:'';position:absolute;left:35px;top:14px;bottom:14px;width:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--hub-accent) 12%,transparent),color-mix(in srgb,var(--hub-accent) 50%,transparent) 20%,color-mix(in srgb,var(--hub-accent) 50%,transparent) 80%,color-mix(in srgb,var(--hub-accent) 10%,transparent))}
.char-hub-theme-xianxia .char-hub-ms-node{width:36px;height:36px;border:2px solid var(--hub-accent);transform:rotate(45deg);background:var(--hub-bg);box-shadow:0 0 0 3px color-mix(in srgb,var(--hub-accent) 10%,transparent),0 0 9px color-mix(in srgb,var(--hub-accent) 35%,transparent)}
.char-hub-theme-xianxia .char-hub-ms-node span{transform:rotate(-45deg);font-size:13px}
.char-hub-theme-xianxia .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--hub-accent);color:var(--hub-bg);box-shadow:0 0 0 3px color-mix(in srgb,var(--hub-accent) 15%,transparent),0 0 14px color-mix(in srgb,var(--hub-accent) 50%,transparent)}
.char-hub-theme-xianxia .char-hub-ms-date{color:var(--hub-accent)}
.char-hub-theme-xianxia .char-hub-ms-item.is-latest .char-hub-ms-date::after{content:'最新';align-self:flex-start;margin-top:3px;padding:0 4px;border:1px solid var(--hub-accent);border-radius:3px;color:var(--hub-accent);font-size:9px;line-height:1.6}
.panel-overlay.dark .char-hub-theme-xianxia .char-hub-ms-list::before{background:linear-gradient(180deg,color-mix(in srgb,var(--hub-accent) 8%,transparent),color-mix(in srgb,var(--hub-accent) 32%,transparent) 20%,color-mix(in srgb,var(--hub-accent) 32%,transparent) 80%,color-mix(in srgb,var(--hub-accent) 6%,transparent))}
.panel-overlay.dark .char-hub-theme-xianxia .char-hub-ms-node{background:transparent;box-shadow:0 0 0 3px color-mix(in srgb,var(--hub-accent) 8%,transparent),0 0 9px color-mix(in srgb,var(--hub-accent) 22%,transparent)}
.panel-overlay.dark .char-hub-theme-xianxia .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--hub-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--hub-accent) 12%,transparent),0 0 14px color-mix(in srgb,var(--hub-accent) 32%,transparent)}
.char-hub-theme-xianxia{--ms-cat-first:#1f8f9b;--ms-cat-relation:#c0492e;--ms-cat-status:#3d6e9e}
.panel-overlay.dark .char-hub-theme-xianxia{--ms-cat-first:#35b8c4;--ms-cat-relation:#e2684a;--ms-cat-status:#6a97c9}
.chronicle-reader-theme-xianxia .chronicle-timeline-node{width:11px;height:11px;background:radial-gradient(circle at 35% 30%,var(--hub-bg),var(--hub-accent));box-shadow:0 0 0 2px color-mix(in srgb,var(--hub-accent) 22%,transparent),0 0 12px color-mix(in srgb,var(--hub-accent) 22%,transparent)}
.chronicle-reader-theme-xianxia .chronicle-timeline-content{border-radius:10px 2px 10px 2px;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--hub-accent) 8%,transparent),transparent 58%),var(--hub-panel);box-shadow:0 7px 18px rgba(36,90,76,.07)}
.chronicle-reader-theme-xianxia .chronicle-detail-text{border-radius:10px 2px 10px 2px;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--hub-accent) 8%,transparent),transparent 58%),var(--hub-panel);box-shadow:0 7px 18px rgba(36,90,76,.07)}.chronicle-reader-theme-xianxia .chronicle-detail-dialogue{border-radius:10px 2px 10px 2px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-soft))}
.chronicle-reader-theme-xianxia .chronicle-dialogue-line{border-radius:8px 2px 8px 2px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-panel))}.chronicle-reader-theme-xianxia .chronicle-dialogue-speaker{border-radius:50% 50% 50% 2px}
`;
