// ===== 馃嵃 鐢滄亱绯栨灉鐘舵€佹爮 - 瀹屾暣CSS =====
import { baseCSS } from './base';
export const sweetCSS = /* css */ `

/* ===== 馃尭 CSS鍙橀噺锛氭祬鑹叉ā寮忥紙鑽夎帗濂舵様锛?===== */
:root {
  --sweet-bg: #fff5f5;
  --sweet-card: #ffffff;
  /* U38③：全局语义色补齐（与 ancient 同族；深色组内字面量重定义） */
  --ub-success: #3F6A52; --ub-warning: #8A5B14; --ub-danger: #A13B34;
  --sweet-bubble: #fff0f5;
  --sweet-tag: #fff5fa;
  --sweet-text: #5c3d4a;
  --sweet-text-soft: #8a6a78;
  --sweet-text-muted: #b898a0;
  --sweet-pink: #ff8fab;
  --sweet-pink-deep: #e87090;
  --sweet-pink-light: #ffe0ea;
  --sweet-pink-glow: rgba(255, 143, 171, 0.25);
  --sweet-lavender: #c8b8f0;
  --sweet-lavender-light: #f0e8ff;
  --sweet-mint: #b8e8d0;
  --sweet-mint-light: #e0fff0;
  --sweet-peach: #ffd4b8;
  --sweet-peach-light: #fff0e4;
  --sweet-butter: #fff0b3;
  --sweet-butter-light: #fffde0;
  --sweet-sky: #b8d8f0;
  --sweet-sky-light: #e8f4ff;
  --sweet-border: #f0d8e0;
  --sweet-border-soft: #f5e0e8;
  --sweet-shadow: 0 2px 16px rgba(200, 160, 180, 0.12);
  --sweet-shadow-pop: 0 4px 24px rgba(200, 160, 180, 0.2);
  --sweet-radius-sm: 12px; --sweet-radius-md: 18px; --sweet-radius-lg: 24px; --sweet-radius-xl: 32px;
  --sweet-font-title: 'ZCOOL KuaiLe','Microsoft YaHei','PingFang SC','Heiti SC', 'Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei', sans-serif;
  --sweet-font-body: 'Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei', 'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun', sans-serif;
  /* === 缁熶竴鍙橀噺鍒悕 === */
  --ub-overlay-bg:rgba(0,0,0,0.35);
  --ub-scrollbar-thumb:var(--sweet-border);
  --ub-scrollbar-thumb-hover:var(--sweet-pink);
  --ub-text-muted:var(--sweet-text-muted);
  --ub-bg-card:var(--sweet-card);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接 → 主题级补同一组变量（浅/深各一套，值取本主题 token） */
  --ub-text:var(--sweet-text,#5c3d4a);--ub-divider:var(--sweet-border,#f0d8e0);--ub-accent:var(--sweet-pink,#ff8fab);--ub-hover-bg:var(--sweet-pink-light,rgba(255,143,171,0.08));
  --ub-popup-radius:var(--sweet-radius-md);
  --ub-popup-shadow:var(--sweet-shadow-pop);
  --ub-popup-border:2px solid var(--sweet-border);
  --ub-popup-bg:var(--sweet-card);
  --ub-popup-head-bg:linear-gradient(135deg,var(--sweet-pink-light),var(--sweet-lavender-light));
  --ub-popup-head-border:2px dashed var(--sweet-pink);
  --ub-btn-radius:var(--sweet-radius-xl);
  --ub-toggle-width:44px;--ub-toggle-height:26px;--ub-toggle-knob:20px;
  --ub-ft-ring-start:#ffb5c9;--ub-ft-ring-end:#a98de6;--ub-ft-ring-glow:rgba(255,143,171,.4);
  /* === 立绘主题变量 === */
  --portrait-empty-color:#ff8fab;
  --portrait-bg:#fff5f8;
  --portrait-border:#ff8fab;
  --portrait-radius:14px;
  --accent:#ff8fab;
  --card-bg:#fff;
  /* === 统一裸变量别名：供 -base/渲染层 var(--text)/var(--divider)/var(--card) 等直接使用（根因 A） === */
  --text:var(--sweet-text);
  --text-muted:var(--sweet-text-muted);
  --divider:var(--sweet-border);
  --card:var(--sweet-card);
}

/* ===== 馃寵 娣辫壊妯″紡锛堣摑鑾撳锛?===== */
#ac-content.dark,
.nsfw-overlay.dark,
.panel-overlay.dark,
.settings-overlay.dark,
#ac-options-bar-floating.dark {
  /* U38③：语义色深色档（字面量重定义） */
  --ub-success: #77B18C; --ub-warning: #D7AC5C; --ub-danger: #E4776D;
  --sweet-bg: #1a141c;
  --sweet-card: #241c28;
  --sweet-bubble: #2a1c2a;
  --sweet-tag: #2a1c28;
  --sweet-text: #e8d8e0;
  --sweet-text-soft: #b8a0b0;
  --sweet-text-muted: #7a6070;
  --sweet-pink: #ff8fab;
  --sweet-pink-deep: #ffb3c6;
  --sweet-pink-light: #3a1c2a;
  --sweet-pink-glow: rgba(255, 143, 171, 0.15);
  --sweet-lavender: #a088d0;
  --sweet-lavender-light: #2a2040;
  --sweet-mint: #78b898;
  --sweet-mint-light: #1a2828;
  --sweet-peach: #c89878;
  --sweet-peach-light: #2a1c18;
  --sweet-butter: #c8b870;
  --sweet-butter-light: #282818;
  --sweet-sky: #88a8c8;
  --sweet-sky-light: #182028;
  --sweet-border: #3a2a38;
  --sweet-border-soft: #302230;
  --sweet-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
  --sweet-shadow-pop: 0 4px 24px rgba(0, 0, 0, 0.4);
  --ub-overlay-bg:rgba(0,0,0,0.55);
  --ub-scrollbar-thumb:var(--sweet-border);
  --ub-scrollbar-thumb-hover:var(--sweet-pink);
  --ub-text-muted:var(--sweet-text-muted);
  --ub-bg-card:var(--sweet-card);
  /* 日历兄弟弹窗变量·深色（字面量兜底；:root 处已按浅色完成替换，深色必须重声明，见 ios.ts 同款注释） */
  --ub-text:var(--sweet-text,#e8d8e0);--ub-divider:var(--sweet-border,rgba(255,143,171,0.2));--ub-accent:var(--sweet-pink,#ff8fab);--ub-hover-bg:rgba(255,255,255,0.05);
  --ub-popup-radius:var(--sweet-radius-md);
  --ub-popup-shadow:var(--sweet-shadow-pop);
  --ub-popup-border:2px solid var(--sweet-border);
  --ub-popup-bg:var(--sweet-card);
  --ub-popup-head-bg:linear-gradient(135deg,var(--sweet-pink-light),var(--sweet-lavender-light));
  --ub-popup-head-border:2px dashed var(--sweet-pink);
  /* === 立绘主题变量（深色覆盖） === */
  --portrait-bg:#3a2a30;
  --portrait-empty-color:#d07090;
  --accent:#ff8fab;
  --card-bg:#3a2a30;
  /* === 统一裸变量别名（深色随 --sweet-* 自动跟随，根因 A） === */
  --text:var(--sweet-text);
  --text-muted:var(--sweet-text-muted);
  --divider:var(--sweet-border);
  --card:var(--sweet-card);
}

/* U5：body.dark-mode 也是既有的深色上下文——ure/interview/iv-wb 等弹窗的深色规则本就以
   body.dark-mode 前缀匹配（这些弹窗挂在 body 下，深色靠 body 类而非 .panel-overlay.dark）。
   若不在此补深色覆盖，那些 alias 到 --sweet-* 的组件颜色会在 body.dark-mode 下回落到 :root 浅色值
   = 「深色下读到浅色」。补齐后 --sweet-* 在所有既有深色上下文里一致翻深。 */
body.dark-mode {
  --sweet-bg:#1a141c;
  --sweet-card:#241c28;
  --sweet-bubble:#2a1c2a;
  --sweet-tag:#2a1c28;
  --sweet-text:#e8d8e0;
  --sweet-text-soft:#b8a0b0;
  --sweet-text-muted:#7a6070;
  --sweet-border:#3a2a38;
  --sweet-border-soft:#302230;
}

#ac-statusbar-wrapper,:where(#ac-statusbar-wrapper *){margin:0;padding:0;box-sizing:border-box}

#ac-statusbar-wrapper{
  font-family: var(--sweet-font-body);
  background: transparent;
  color: var(--sweet-text);
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ===== 馃嵃 涓诲鍣?===== */
.book {
  width: 100%;
  background: var(--sweet-card);
  border: 2px solid var(--sweet-border);
  border-radius: var(--sweet-radius-lg);
  /* 静态粉色光晕：原 sweet-breathe 50% 帧，不再每帧重绘 */
  box-shadow: var(--sweet-shadow), 0 0 50px var(--sweet-pink-glow);
  overflow: visible;
  position: relative;
  transition: background 0.5s, border-color 0.5s, box-shadow 0.5s;
}
/* NSFW 边框：静态粉光描边（原 nsfw-breathe 50% 帧），不再每帧重绘 */
.book.nsfw-border {
  box-shadow: var(--sweet-shadow), 0 0 50px var(--sweet-pink-glow), 0 0 0 3px rgba(255,143,171,0.32), 0 0 32px rgba(255,143,171,0.18);
}

/* ===== 馃巰 椤堕儴鏍?===== */
.book-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--sweet-pink-light), var(--sweet-lavender-light), var(--sweet-mint-light));
  border-radius: var(--sweet-radius-lg) var(--sweet-radius-lg) 0 0;
  border-bottom: 2px dashed var(--sweet-pink);
  flex-wrap: wrap;
  position: relative; overflow: hidden;
  transition: all 0.5s;
}
.book-head::before {
  content: ''; position: absolute; top: 0; left: 0; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  pointer-events: none;
}

.book-head-left, .book-head-right {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  position: relative; z-index: 1;
}

/* 馃挰 瀵硅瘽姘旀场鏍囩 */
.bubble-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 14px; border-radius: var(--sweet-radius-xl);
  font-size: 12px; font-weight: 600;
  letter-spacing: 0.5px;
  transition: all 0.5s;
}
.bubble-tag.pink  { background: var(--sweet-pink-light); color: var(--sweet-pink-deep); border: 1.5px solid var(--sweet-pink); }
.bubble-tag.mint  { background: var(--sweet-mint-light); color: #2e6a4a; border: 1.5px solid var(--sweet-mint); cursor: pointer; }
.bubble-tag.mint:hover{opacity:0.7}
.bubble-tag.lav   { background: var(--sweet-lavender-light); color: #4a3a8a; border: 1.5px solid var(--sweet-lavender); }
.bubble-tag.peach { background: var(--sweet-peach-light); color: #8a4810; border: 1.5px solid var(--sweet-peach); }

.main-char-name {
  font-family: var(--sweet-font-title); font-size: 16px; font-weight: 700;
  color: var(--sweet-pink-deep); letter-spacing: 2px;
}
.wardrobe-protagonist-summary{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-top:6px;padding:5px 12px;border:1.5px solid var(--sweet-pink);border-radius:var(--sweet-radius-xl);background:var(--sweet-pink-light);color:var(--sweet-pink-deep);font-family:var(--sweet-font-body);font-size:11px;font-weight:600;letter-spacing:.5px;line-height:1.35;cursor:pointer;text-align:left;overflow:hidden;transition:box-shadow .3s,transform .3s}
.wardrobe-protagonist-summary::before{content:"✨";font-size:10px;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--sweet-pink-deep);font-weight:700;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sweet-pink-deep)}
.wardrobe-protagonist-summary:hover{transform:translateY(-1px);box-shadow:0 4px 12px var(--sweet-pink-glow,rgba(255,143,171,.25))}

/* 鈿?鑳介噺badge */
.energy-value {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 4px 10px; border-radius: var(--sweet-radius-xl);
  background: var(--sweet-pink-light); border: 1.5px solid var(--sweet-pink);
  font-size: 12px; font-weight: 700; color: var(--sweet-pink-deep);
  white-space: nowrap; flex-shrink: 0;
}

/* 钱包入口（F35）：紧贴心动值、与 .energy-value 同几何同字号，只换色系（薰衣草）；
   颜色全部走本风格既有变量 ⇒ 深色由 #ac-content.dark 的变量块自动覆盖（无硬编码色）。
   欠款数字用 --ub-danger（浅/深各一档，就地声明，不动全站变量表）。 */
.ub-wallet-entry {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 4px 10px; border-radius: var(--sweet-radius-xl);
  background: var(--sweet-lavender-light); border: 1.5px solid var(--sweet-lavender);
  font-family: var(--sweet-font-body); font-weight: 700; color: var(--sweet-lavender-deep);
  white-space: nowrap; flex-shrink: 0; cursor: pointer; line-height: 1.25;
  --sweet-lavender-deep: #8a6fd0; --ub-danger: #c0392b;
}
.ub-wallet-entry:hover { filter: brightness(1.03); }
.ub-wallet-entry b { font-weight: 800; }
.ub-wallet-entry b.neg { color: var(--ub-danger); }
.ub-wallet-entry.ub-wallet-empty { opacity: .55; border-style: dashed; }
#ac-content.dark .ub-wallet-entry { --sweet-lavender-deep: #cbb6ff; --ub-danger: #ff8f8f; }

/* ===== 馃崿 绯栨灉鎸夐挳 ===== */
.candy-btn {
  font-family: var(--sweet-font-body); font-size: 11px; font-weight: 600;
  padding: 6px 16px; border-radius: var(--sweet-radius-xl);
  border: 2px solid var(--sweet-border);
  background: var(--sweet-card);
  color: var(--sweet-text-soft);
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.2s;
  white-space: nowrap;
  outline: none;
  display: inline-flex; align-items: center; gap: 4px;
}
.candy-btn:hover {
  box-shadow: var(--sweet-shadow-pop);
}
.candy-btn.pink  { border-color: var(--sweet-pink); color: #a8306a; background: var(--sweet-pink-light); }
.candy-btn.pink:hover  { background: var(--sweet-pink); color: #5c1430; box-shadow: 0 4px 20px var(--sweet-pink-glow); }
.candy-btn.lav   { border-color: var(--sweet-lavender); color: #4a3a8a; background: var(--sweet-lavender-light); }
.candy-btn.lav:hover   { background: var(--sweet-lavender); color: #3a1860; }
.candy-btn.mint  { border-color: var(--sweet-mint); color: #2e6a4a; background: var(--sweet-mint-light); }
.candy-btn.mint:hover  { background: var(--sweet-mint); color: #1a4030; }
.candy-btn.peach { border-color: var(--sweet-peach); color: #8a4810; background: var(--sweet-peach-light); }
.candy-btn.peach:hover { background: var(--sweet-peach); color: #5a2810; }

/* 馃寵鈽€锔?涓婚鎸夐挳 */
.theme-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid var(--sweet-butter);
  background: var(--sweet-butter-light);
  font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s; flex-shrink: 0; color: inherit;
  font-family: inherit;
}
.theme-btn:hover { border-color: var(--sweet-peach); filter: brightness(1.15); }

/* ===== 銆帮笍 娉㈡氮鍒嗛殧绾?===== */
.pink-line {
  display: flex; align-items: center; justify-content: center;
  gap: 6px; padding: 4px 0;
  font-size: 14px; letter-spacing: 3px;
  color: var(--sweet-pink); opacity: 0.6;
  user-select: none;
  border: none; background: none;
  height: auto;
}

/* ===== 🧸 瑙掕壊鏍囩锛堢硸鏋滆嵂涓革級 ===== */
.tabs-wrap { overflow: visible; }
.tabs {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
  padding: 10px 16px; border-bottom: none; background: transparent;
}
.tab {
  font-family: var(--sweet-font-body); font-size: 13px; font-weight: 600;
  padding: 8px 20px; border-radius: var(--sweet-radius-xl);
  border: 2px solid var(--sweet-border-soft);
  background: var(--sweet-card);
  color: var(--sweet-text-soft);
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.25s;
  position: relative;
  flex: 0 0 auto;
  white-space: nowrap;
}
.tab:hover {
  border-color: var(--sweet-pink);
  color: var(--sweet-pink-deep);
  background: var(--sweet-pink-light);
}
.tab.active {
  background: linear-gradient(135deg, var(--sweet-pink-light), var(--sweet-lavender-light));
  border-color: var(--sweet-pink);
  color: var(--sweet-pink-deep);
  box-shadow: 0 2px 12px var(--sweet-pink-glow);
}
.tab.active::after {
  content: '💕'; position: absolute; top: -14px; right: -6px;
  font-size: 12px;
  animation: sweet-bounce-sm 1s ease-in-out infinite;
}
@keyframes sweet-bounce-sm {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* ===== 馃拰 瑙掕壊闈㈡澘 ===== */
.char-panel {
  padding: 12px 16px 16px;
  animation: sweet-fade-in .35s ease;
  overflow: visible;
}
@keyframes sweet-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* 馃挐 鐖卞績璐寸焊鍗＄墖 */
.love-card {
  background: var(--sweet-card);
  border: 2px solid var(--sweet-border);
  border-radius: var(--sweet-radius-md);
  padding: 20px 18px;
  box-shadow: var(--sweet-shadow);
  transition: all 0.5s;
  position: relative;
  overflow: hidden;
}
.love-card::before {
  content: '💗'; position: absolute; top: 8px; right: 12px;
  font-size: 18px; opacity: 0.4; animation: sweet-bounce-sm 3s ease-in-out infinite; z-index: 0;
}
.love-card::after {
  content: '🧸'; position: absolute; bottom: 8px; left: 12px;
  font-size: 16px; opacity: 0.3; animation: sweet-bounce-sm 3.5s ease-in-out infinite; z-index: 0;
}

/* 瑙掕壊澶撮儴 */
.char-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; position: relative; z-index: 1;
}
.char-head-info { flex: 1; min-width: 0; }
.love-card .portrait-box { float: none; margin: 0; flex: 0 0 96px; }
.char-portrait-text-row { display: flex; gap: 12px; align-items: flex-start; }
.char-text-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.char-name-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.char-name {
  font-family: var(--sweet-font-title); font-size: 20px; font-weight: 700;
  color: var(--sweet-text); letter-spacing: 2px;
  cursor: pointer; transition: color 0.2s;
  display: inline-block;
}
.char-name:hover { color: var(--sweet-pink-deep); }
.char-basic-info {
  font-size: 11px; color: var(--sweet-text-muted);
  background: var(--sweet-tag);
  padding: 2px 10px; border-radius: var(--sweet-radius-xl);
}
.char-name-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0; }

.char-right-col {
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  flex-shrink: 0; position: relative; z-index: 1;
}

/* 馃槉 鎯呯华badge */
.char-mood-right {
  font-size: 13px; font-weight: 700;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 14px; border-radius: var(--sweet-radius-xl);
  letter-spacing: 0.5px; justify-content: flex-end;
}
.mood-icon { font-size: 18px; }

/* 馃挰 鍐呭績鎯虫硶姘旀场 */
.char-inner-thought {
  position: relative; z-index: 1;
  margin: 8px 0 0;
  padding: 10px 14px;
  background: var(--sweet-bubble);
  border: 2px solid var(--sweet-border);
  border-radius: var(--sweet-radius-md);
  font-size: 13px;
  line-height: 1.8;
  color: var(--sweet-text);
  transition: all 0.5s;
}
.char-inner-thought::after {
  content: '';
  position: absolute; bottom: -10px; left: 24px;
  width: 0; height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 12px solid var(--sweet-border);
}
.inner-thought-text { flex: 1; min-width: 0; }

/* 馃搵 淇℃伅琛?*/
.char-status, .char-attitude, .char-intention {
  font-size: 12px; line-height: 1.7;
  padding: 5px 10px; border-radius: var(--sweet-radius-sm);
  transition: background 0.2s; margin-top: 2px;
}
.char-status { color: var(--sweet-text); }
.char-status:hover, .char-attitude:hover, .char-intention:hover { background: var(--sweet-tag); }
.char-attitude { color: var(--sweet-text-soft); font-weight: 500; }
.char-intention { color: var(--sweet-text-soft); }

/* 💗 鎭嬬埍搴︼紙鐖卞績杩涘害鏉★級 */
.char-train-wrap {
  display: flex; align-items: center; gap: 10px;
  margin-top: 12px; padding: 8px 14px;
  background: var(--sweet-tag);
  border-radius: var(--sweet-radius-xl);
}
.char-train-label {
  font-size: 11px; font-weight: 700; color: var(--sweet-pink-deep);
  letter-spacing: 1px; flex-shrink: 0;
  display: flex; align-items: center; gap: 4px;
}
.char-train-bar {
  flex: 1; height: 12px;
  background: var(--sweet-border-soft);
  border-radius: 8px; overflow: hidden;
  position: relative;
}
.char-train-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff8fab, #ffb3c6, #ff8fab);
  border-radius: 8px;
  transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
  position: relative;
}
.char-train-fill::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.35), transparent);
  border-radius: 8px;
}
.char-train-glow {
  position: absolute; top: -4px; left: 0; height: 20px;
  background: linear-gradient(90deg, var(--sweet-pink-glow), transparent);
  transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
  filter: blur(8px);
}
.char-train-value {
  font-size: 12px; font-weight: 700; color: var(--sweet-pink-deep);
  min-width: 60px; text-align: right;
  display: flex; align-items: center; gap: 3px;
}

/* 馃彿锔?璇︽儏闈㈡澘 */
.char-section { margin-top: 14px; position: relative; z-index: 1; }
.char-section-label-row { display: flex; gap: 6px; margin-bottom: 10px; align-items: center; }
.char-section-label {
  font-size: 10px; font-weight: 700; color: var(--sweet-text-muted);
  letter-spacing: 2.5px; text-transform: uppercase;
}
.char-switch-btns { display: flex; gap: 4px; }
.char-switch-btn {
  font-family: var(--sweet-font-body); font-size: 11px; font-weight: 600;
  padding: 6px 16px; border-radius: var(--sweet-radius-xl);
  border: 2px solid var(--sweet-border-soft);
  background: transparent;
  color: var(--sweet-text-muted);
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.2s;
  display: inline-flex; align-items: center; gap: 4px;
}
.char-switch-btn:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); }
.char-switch-btn.active-switch {
  background: var(--sweet-pink-light);
  border-color: var(--sweet-pink);
  color: var(--sweet-pink-deep);
}

/* 琛ｇ墿/韬綋 sticker 鍒楄〃 */
.char-clothes-list, .char-body-list {
  display: flex; flex-direction: column; gap: 6px;
}
.char-clothes-item, .char-body-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: var(--sweet-radius-sm);
  border: 1.5px solid var(--sweet-border-soft);
  font-size: 12px; line-height: 1.6;
  transition: all 0.2s;
  background: var(--sweet-card);
}
.char-clothes-item:hover, .char-body-item:hover {
  border-color: var(--sweet-pink);
  background: var(--sweet-pink-light);
  transform: translateX(3px);
}
.char-clothes-item.touched, .char-body-item.touched {
  animation: sweet-touch 1s ease;
}
@keyframes sweet-touch {
  0% { background: transparent; }
  15% { background: rgba(255,143,171,0.2); transform: scaleX(1.02); }
  30% { transform: translateX(3px); background: rgba(255,143,171,0.15); }
  50% { transform: translateX(-3px) skewX(-2deg); background: rgba(255,143,171,0.1); }
  70% { transform: translateX(1px) skewX(1deg); }
  100% { background: transparent; transform: translateX(0) skewX(0); }
}
.char-outfit-summary {
  border-color: var(--sweet-pink) !important;
  border-width: 2px !important;
  background: linear-gradient(135deg, var(--sweet-pink-light), var(--sweet-lavender-light)) !important;
}
.char-clothes-item .cl, .char-body-item .bl {
  font-weight: 700; color: var(--sweet-pink-deep);
  min-width: 64px; flex-shrink: 0; font-size: 11px; letter-spacing: 0.5px;
}
.char-clothes-item .cv, .char-body-item .bv {
  color: var(--sweet-text); flex: 1; letter-spacing: 0.3px;
}
.char-outfit-summary .cl { color: var(--sweet-pink-deep) !important; font-weight: 700 !important; }
.char-outfit-summary .cv { color: var(--sweet-pink-deep) !important; font-weight: 500; }

/* 馃敇 icon鎸夐挳 */
.icon-btn {
  font-family: var(--sweet-font-body); font-size: 11px; font-weight: 600;
  padding: 6px 16px; border-radius: var(--sweet-radius-xl);
  border: 2px solid var(--sweet-peach);
  background: var(--sweet-peach-light);
  color: #c08060;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.2s;
  white-space: nowrap;
}
.icon-btn:hover { background: var(--sweet-peach); color: #5a2810; filter: brightness(1.08); }
.icon-btn.active-switch { background: var(--sweet-pink-light); border-color: var(--sweet-pink); color: var(--sweet-pink-deep); font-weight: 700; }

/* ===== 馃幃 鐜╂硶鍖?路 鐢滅偣鑿滃崟 ===== */
.play-section {
  margin-top: 16px;
  background: var(--sweet-card);
  border: 2px solid var(--sweet-border);
  border-radius: var(--sweet-radius-md);
  overflow: hidden;
  box-shadow: var(--sweet-shadow);
  transition: all 0.5s;
}
.play-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; gap: 8px;
  background: linear-gradient(135deg, var(--sweet-peach-light), var(--sweet-pink-light));
  border-bottom: 2px dashed var(--sweet-peach);
  flex-wrap: wrap;
  transition: all 0.5s;
}
.play-section-label {
  font-family: var(--sweet-font-title); font-size: 13px; font-weight: 700;
  color: var(--sweet-pink-deep); letter-spacing: 2px;
  display: flex; align-items: center; gap: 6px;
}
.play-section-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.play-section-right { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }

.play-collapse-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid var(--sweet-border);
  background: var(--sweet-card);
  cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s; color: var(--sweet-text-soft);
  line-height: 1; font-family: inherit;
}
.play-collapse-btn:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); }
.play-section.collapsed .play-grid{display:none}
.play-section.collapsed .play-section-head{margin-bottom:0}
.play-section.collapsed .play-collapse-btn { transform: rotate(180deg); }
.play-section.collapsed .play-collapse-btn:hover { filter: brightness(1.1); }

.play-clear-btn, .item-use-toggle, .nsfw-guidance-btn {
  font-family: var(--sweet-font-body); font-size: 10px; font-weight: 600;
  padding: 6px 14px; border-radius: var(--sweet-radius-xl);
  cursor: pointer; letter-spacing: 0.5px; transition: all 0.2s;
}
.play-clear-btn {
  border: 2px solid var(--sweet-peach); background: var(--sweet-peach-light); color: #c08060;
}
.play-clear-btn:hover { background: var(--sweet-peach); color: #5a2810; }
.item-use-toggle {
  border: 2px solid var(--sweet-pink); background: var(--sweet-pink-light); color: var(--sweet-pink-deep);
  white-space: nowrap;
}
.item-use-toggle:hover { background: var(--sweet-pink); color: #fff; }
.item-use-toggle.active { background: var(--sweet-pink); border-color: var(--sweet-pink); color: #5c1430; font-weight: 700; }
.nsfw-guidance-btn {
  border: 2px solid var(--sweet-pink-deep); background: var(--sweet-card); color: var(--sweet-pink-deep); white-space: nowrap;
}
.nsfw-guidance-btn:hover { background: var(--sweet-pink-deep); color: #4a0a20; }
.nsfw-guidance-btn:disabled { opacity: .55; cursor: wait; }

/* 鐢滅偣鍗＄墖缃戞牸 */
.play-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px; padding: 14px 16px;
}
.play-select {
  flex: 1; min-width: 0;
  background: var(--sweet-tag);
  background-color: var(--sweet-tag) !important;
  color: var(--sweet-text) !important;
  border: 1.5px solid var(--sweet-border) !important;
  border-radius: var(--sweet-radius-sm);
  padding: 6px 8px; font-size: 11px;
  font-family: var(--sweet-font-body);
  outline: none; cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23b898a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 6px center;
}
.play-select:focus { border-color: var(--sweet-pink); box-shadow: 0 0 0 3px var(--sweet-pink-glow); }
.play-select option { background: var(--sweet-card) !important; color: var(--sweet-text) !important; }

/* ===== 馃摝 寮圭獥 ===== */
.nsfw-overlay, .panel-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh;
  background: rgba(0,0,0,0.35);
  z-index: 10000;
  display: none; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.nsfw-overlay.show, .panel-overlay.show { display: flex; }
.panel-popup {
  background: var(--sweet-card);
  border: 2px solid var(--sweet-border);
  border-radius: var(--sweet-radius-md);
  width: 90%; max-width: 380px; max-height: 72vh;
  box-shadow: var(--sweet-shadow-pop);
  animation: sweet-pop-in .3s cubic-bezier(0.34,1.56,0.64,1);
  position: relative;
}
.panel-popup { display: flex; flex-direction: column; }
@keyframes sweet-pop-in { from { opacity: 0; transform: scale(0.9) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.panel-popup-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px;
  background: linear-gradient(135deg, var(--sweet-pink-light), var(--sweet-lavender-light));
  border-radius: var(--sweet-radius-md) var(--sweet-radius-md) 0 0;
  border-bottom: 2px dashed var(--sweet-pink);
  flex-shrink: 0;
}
.panel-popup-title {
  font-family: var(--sweet-font-title); font-size: var(--ub-popup-font-title,15px); font-weight: 700;
  color: var(--sweet-pink-deep); letter-spacing: 2px; flex: 1;
}
.panel-popup-head { flex-shrink: 0; }
.panel-popup-close, .panel-popup-back {
  width: 30px; height: 30px; border-radius: 50%;
  border: 2px solid var(--sweet-border); background: transparent;
  cursor: pointer; font-size: 14px; color: var(--sweet-text-muted);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; font-family: inherit; flex-shrink: 0;
}
.panel-popup-close:hover, .panel-popup-back:hover {
  border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light);
}
.panel-popup-warehouse-toggle {
  font-size: 11px; width: auto; padding: 0 10px; height: 24px;
  border-radius: var(--sweet-radius-xl); border: 2px solid var(--sweet-border);
  background: transparent; color: var(--sweet-text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0; font-family: inherit;
  margin-right: 8px; letter-spacing: 0.5px; font-weight: 600;
}
.panel-popup-warehouse-toggle:hover {
  border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light);
}
.panel-popup-back { width: auto; padding: 0 8px; font-size: 12px; }

.panel-popup-body { padding: 14px 18px 18px; }
.panel-popup-body { flex: 1; overflow-y: auto; }
.panel-popup-body::-webkit-scrollbar { width: 5px; }
.panel-popup-body::-webkit-scrollbar-track { background: transparent; }
.panel-popup-body::-webkit-scrollbar-thumb { background: var(--sweet-border); border-radius: 4px; }
.panel-popup-body::-webkit-scrollbar-thumb:hover { background: var(--sweet-pink); }
.char-info-popup{max-width:440px;width:90%;max-height:80vh;display:flex;flex-direction:column;border-radius:16px}
.char-info-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px 18px 18px}
.char-info-body::-webkit-scrollbar{width:5px}
.char-info-body::-webkit-scrollbar-track{background:transparent}
.char-info-body::-webkit-scrollbar-thumb{background:var(--sweet-border);border-radius:4px}
.char-info-panel{display:none}
.char-info-panel.active{display:flex;flex-direction:column;gap:0}
.char-info-card{border:1px solid var(--sweet-border);padding:16px 18px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(255,105,180,0.1)}
.char-info-card-name{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:16px;font-weight:700;color:var(--sweet-pink);letter-spacing:2px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed var(--sweet-border)}
.char-info-card-rows{display:flex;flex-direction:column;gap:8px}
.char-info-card-rows .detail-row{font-size:var(--ub-ui-font-13,13px)}
.char-info-card-rows .dl{color:var(--sweet-text-muted);min-width:50px}
.panel-empty { text-align: center; padding: 24px 0; color: var(--sweet-text-muted); font-size: 12px; letter-spacing: 1px; }

/* 寮圭獥鍒楄〃椤?*/
.memo-list-item, .item-list-item, .diary-list-item {
  padding: 10px 14px; margin-bottom: 6px;
  border: 1.5px solid var(--sweet-border-soft);
  border-radius: var(--sweet-radius-sm);
  cursor: pointer; transition: all 0.2s;
}
.memo-list-item:hover, .item-list-item:hover, .diary-list-item:hover {
  border-color: var(--sweet-pink); background: var(--sweet-pink-light);
}
.memo-list-item:last-child, .item-list-item:last-child, .diary-list-item:last-child { margin-bottom: 0; }
.memo-item-top, .item-top {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.memo-title, .item-name {
  font-size: var(--ub-ui-font-12,12px); font-weight: 600; color: var(--sweet-text);
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.memo-type, .item-type {
  font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: var(--sweet-radius-xl);
  background: var(--sweet-pink-light); color: var(--sweet-pink-deep);
  letter-spacing: 0.5px; flex-shrink: 0;
}
.item-wardrobe-badge{display:inline-flex;align-items:center;border-radius:32px;background:var(--sweet-pink-deep);color:#fff;padding:3px 10px;font-size:9px;font-weight:700;letter-spacing:.5px;flex-shrink:0;margin-left:4px}
.item-qty {
  font-size: 10px; font-weight: 600; color: var(--sweet-pink-deep);
  background: var(--sweet-pink-light); padding: 1px 8px; border-radius: 10px;
  flex-shrink: 0; letter-spacing: 0.5px;
}
.memo-item-sub, .item-desc, .diary-item-content {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;
  font-size: var(--ub-ui-font-10,10px); color: var(--sweet-text-muted);
}
.item-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.memo-status, .memo-char, .memo-time-badge {
  padding: 1px 4px; letter-spacing: 0.5px; font-size: 9px;
}

/* 浠诲姟鍒楄〃 */
.mission-list-item {
  padding: 12px 14px; margin-bottom: 10px;
  border: 1.5px solid var(--sweet-border-soft);
  border-radius: var(--sweet-radius-sm);
  cursor: pointer; transition: all 0.2s;
  position: relative; overflow: hidden;
}
.mission-list-item:hover {
  border-color: var(--sweet-pink); background: var(--sweet-pink-light);
}
.mission-list-item.completed { border-color: var(--sweet-mint); background: var(--sweet-mint-light); cursor: pointer; }
.mission-list-item.completed:hover { background: var(--sweet-mint-light); }
.mission-list-item .mission-delete {
  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
  border-radius: 50%; border: 2px solid var(--sweet-border); background: transparent;
  color: var(--sweet-text-muted); font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; z-index: 2; font-family: inherit;
}
.mission-list-item .mission-delete:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light); }
.mission-name { font-size: var(--ub-ui-font-13,13px); font-weight: 600; color: var(--sweet-pink-deep); letter-spacing: 0.5px; margin-bottom: 4px; padding-right: 28px; }
.mission-desc { font-size: var(--ub-ui-font-11,11px); color: var(--sweet-text-soft); margin-bottom: 6px; line-height: 1.5; }
.mission-desc-clickable { cursor: pointer; transition: all 0.2s; padding: 2px 4px; border-radius: 4px; display: inline-block; }
.mission-desc-clickable:hover { background: var(--sweet-pink-light); }
.mission-objective { font-size: var(--ub-ui-font-11,11px); color: var(--sweet-text-muted); padding: 8px 10px; background: var(--sweet-tag); border-left: 3px solid var(--sweet-pink); line-height: 1.6; border-radius: 0 var(--sweet-radius-sm) var(--sweet-radius-sm) 0; }
.mission-status { display: inline-block; font-size: 10px; padding: 2px 10px; border-radius: var(--sweet-radius-xl); margin-top: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.mission-status:hover { filter: brightness(1.1); }
.mission-status.pending { color: var(--sweet-text-muted); background: var(--sweet-tag); border: 1px solid var(--sweet-border-soft); }
.mission-status.completed { color: #2e6a4a; background: var(--sweet-mint); border: 1px solid var(--sweet-mint); }
.dark .mission-status.completed { color: #fff; background: #3a7a5a; border: 1px solid #3a7a5a; }

/* 鏃ヨ */
.diary-item-top { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--sweet-text-muted); margin-bottom: 4px; }
.diary-time { flex-shrink: 0; }
.diary-item-content { font-size: var(--ub-ui-font-12,12px); color: var(--sweet-text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }

/* NSFW琛?& 璇︽儏琛?*/
.detail-row{
  display: flex; padding: 7px 0;
  border-bottom: 1px solid var(--sweet-border-soft);
  font-size: var(--ub-ui-font-12,12px); line-height: 1.7;
}
.detail-row:last-child{ border-bottom: none; }
.detail-row .dl{
  color: var(--sweet-pink-deep); font-weight: 700;
  min-width: 80px; flex-shrink: 0; font-size: 11px; letter-spacing: 0.5px;
}
.detail-row .dv{ color: var(--sweet-text); flex: 1; }

.detail-content { padding: 10px 0; }
.detail-content .dl { color: var(--sweet-pink-deep); font-weight: 700; font-size: 10px; letter-spacing: 0.5px; display: block; margin-bottom: 6px; }
.detail-content .dc { color: var(--sweet-text-soft); font-size: var(--ub-ui-font-11,11px); line-height: 1.8; }
.item-detail-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--sweet-border-soft); }
.item-use-btn, .item-discard-btn {
  flex: 1; padding: 6px 12px; border-radius: var(--sweet-radius-xl);
  border: 2px solid var(--sweet-pink); font-size: 11px; font-family: inherit; cursor: pointer;
  letter-spacing: 0.5px; transition: all 0.2s; font-weight: 600;
}
.item-use-btn { background: var(--sweet-pink-light); color: var(--sweet-pink-deep); }
.item-use-btn:hover { background: var(--sweet-pink); color: #5c1430; box-shadow: 0 0 12px var(--sweet-pink-glow); }
.item-discard-btn { background: transparent; color: var(--sweet-text-muted); border-color: var(--sweet-border); }
.item-discard-btn:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light); }
.item-warehouse-btn {
  flex: 1; padding: 6px 12px; border-radius: var(--sweet-radius-xl);
  border: 2px solid var(--sweet-border); font-size: 11px; font-family: inherit;
  cursor: pointer; letter-spacing: 0.5px; transition: all 0.2s; font-weight: 600;
  background: transparent; color: var(--sweet-text-soft);
}
.item-warehouse-btn:hover {
  border-color: var(--sweet-pink); color: var(--sweet-pink-deep);
  background: var(--sweet-pink-light); box-shadow: 0 0 12px var(--sweet-pink-glow);
}
.diary-detail-writer {
  display:flex;align-items:center;justify-content:center;gap:10px; text-align: center; font-family: var(--sweet-font-title); font-size: 14px;
  color: var(--sweet-pink-deep); letter-spacing: 2px; margin-bottom: 10px;
}
.diary-nav-btn {
  flex: 0 0 auto; width: 26px; height: 26px; line-height: 24px; text-align: center;
  border: 1px solid var(--sweet-border-soft); border-radius: 50%; background: transparent;
  color: var(--sweet-pink-deep); cursor: pointer; font-size: var(--ub-ui-font-10,10px); padding: 0;
  transition: opacity .2s, border-color .2s;
}
.diary-nav-btn:hover:not(:disabled) { opacity: .8; border-color: var(--sweet-pink-deep); }
.diary-nav-btn:disabled { opacity: .3; cursor: default; }
.diary-nav-indicator { text-align: center; font-size: var(--ub-ui-font-11,11px); color: var(--sweet-text-soft); margin-top: 8px; letter-spacing: 1px; }
.diary-content { padding: 10px 0; }
.diary-content .dc { color: var(--sweet-text-soft); font-size: 12px; line-height: 1.9; font-style: italic; }

/* ===== 鏃ヨ鏈儗鏅?===== */
.diary-notebook {
  position: relative; padding: 24px 28px; margin: 10px 0;
  background: linear-gradient(180deg, #fffafc 0%, #fff0f5 100%);
  border: 2px solid var(--sweet-border-soft); border-radius: 16px;
  box-shadow: 0 4px 16px rgba(255,150,180,0.12), inset 0 0 40px rgba(255,180,200,0.04);
}
.diary-notebook::before {
  content: ''; position: absolute; top: 0; left: 40px; bottom: 0; width: 1px;
  background: rgba(240,180,200,0.3); pointer-events: none; z-index: 1;
}
.diary-notebook::after {
  content: ''; position: absolute; top: 0; left: 44px; bottom: 0; width: 1px;
  background: rgba(240,180,200,0.15); pointer-events: none; z-index: 1;
}
.diary-notebook-lines {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(transparent, transparent 27px, rgba(240,180,200,0.12) 27px, rgba(240,180,200,0.12) 28px);
  pointer-events: none; z-index: 0;
}
.diary-notebook .diary-content { position: relative; z-index: 1; padding: 0; }
.diary-notebook .diary-content .dc {
  font-family: "LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC", var(--sweet-font-text); font-size: 14px;
  line-height: 28px; color: var(--sweet-text); font-style: normal; letter-spacing: 0.5px;
}
/* 褰╅搮鍒掓帀绾?鈥?绮楃嚎锛岃崏鑾撹壊 */
.diary-notebook .diary-content .dc .strikethrough {
  text-decoration: line-through; text-decoration-thickness: 0.12em;
  text-decoration-color: #d47888; opacity: 0.75;
}
/* 姘村僵绗旀爣璁?鈥?鍗婇€忔槑绯栨灉绮?*/
.diary-notebook .diary-content .dc .highlight {
  background: linear-gradient(180deg, rgba(255,200,215,0.5) 0%, rgba(250,180,200,0.6) 100%);
  padding: 2px 6px; border-radius: 3px 7px 4px 5px;
  box-shadow: 0 0 0 1px rgba(230,160,180,0.18), inset 0 -1px 2px rgba(210,140,165,0.12);
}
/* 铚＄瑪娉㈡氮涓嬪垝绾?鈥?鑽夎帗绮?*/
.diary-notebook .diary-content .dc .underline {
  text-decoration: underline; text-decoration-style: wavy;
  text-decoration-thickness: from-font; text-underline-offset: 4px;
  text-decoration-color: #e87890;
}
/* 铚滄鍦堝湀鏍囨敞 */
.diary-notebook .diary-content .dc .emphasis {
  display: inline-block;
  border: 2px solid #d46078;
  border-radius: 42% 58% 55% 45% / 48% 45% 55% 52%;
  padding: 0 5px; transform: rotate(-0.5deg);
  color: inherit; font-weight: 600;
}
/* 閾呯瑪鎵嬪啓浣?鈥?宸у厠鍔涜壊 */
.diary-notebook .diary-content .dc .handwritten {
  font-family: "LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC", "Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi","楷体", cursive; font-size: 15px; color: #5a2a3a;
  text-shadow: 0.5px 0.5px 0 rgba(0,0,0,0.06); letter-spacing: 0.3px;
}
/* 娼﹁崏瀛楄抗 鈥?姝枩 */
.diary-notebook .diary-content .dc .messy {
  display: inline-block; transform: rotate(-1.2deg) translateY(1px);
  font-family: "LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC", "Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi","楷体", cursive; font-size: 14px; color: #6a3a4a;
  text-shadow: 0.5px 1px 0 rgba(0,0,0,0.05); letter-spacing: -0.2px;
}
/* 褰╅搮娑傛敼閬洊 鈥?鍙彲鑹叉煍鍜屾枩绾?*/
.diary-notebook .diary-content .dc .censored {
  position: relative; color: rgba(90,30,50,0.26); padding: 0 4px; border-radius: 3px;
  cursor: pointer; transition: all 0.3s;
  background-color: rgba(180,140,150,0.06);
  background-image:
    repeating-linear-gradient(-5deg, transparent, transparent 2.5px, rgba(160,120,130,0.35) 2.5px, rgba(160,120,130,0.35) 3.5px),
    repeating-linear-gradient(12deg, transparent, transparent 3px, rgba(170,130,140,0.28) 3px, rgba(170,130,140,0.28) 4px),
    repeating-linear-gradient(-18deg, transparent, transparent 3.5px, rgba(150,110,120,0.3) 3.5px, rgba(150,110,120,0.3) 4.5px);
  background-repeat: repeat; background-size: 24px 24px;
}
.diary-notebook .diary-content .dc .censored:hover {
  background-image: none; background-color: transparent; color: inherit; padding: 0 4px;
}
.dark .diary-notebook {
  background: linear-gradient(180deg, #1f1518 0%, #1a1114 100%);
  border-color: var(--sweet-border); box-shadow: 0 2px 8px rgba(0,0,0,0.2), inset 0 0 30px rgba(200,100,130,0.03);
}
.dark .diary-notebook::before { background: rgba(140,100,110,0.2); }
.dark .diary-notebook::after { background: rgba(140,100,110,0.1); }
.dark .diary-notebook-lines {
  background: repeating-linear-gradient(transparent, transparent 27px, rgba(240,180,200,0.06) 27px, rgba(240,180,200,0.06) 28px);
}
.dark .diary-notebook .diary-content .dc { color: var(--sweet-text); }
/* 娣辫壊 鈥?highlight 鏆栫矇 */
.dark .diary-notebook .diary-content .dc .highlight {
  background: linear-gradient(180deg, rgba(255,200,215,0.38) 0%, rgba(250,180,200,0.45) 100%);
  box-shadow: 0 0 0 1px rgba(240,180,200,0.15), inset 0 -1px 2px rgba(220,160,180,0.1);
}
/* 娣辫壊 鈥?underline 浜矇 */
.dark .diary-notebook .diary-content .dc .underline { text-decoration-color: #f090a8; }
/* 娣辫壊 鈥?emphasis 浜湝妗?*/
.dark .diary-notebook .diary-content .dc .emphasis { border-color: #e87088; color: #e8d8d0; }
/* 娣辫壊 鈥?strikethrough 浜矇 */
.dark .diary-notebook .diary-content .dc .strikethrough { text-decoration-color: #e898a0; }
.dark .diary-notebook .diary-content .dc .handwritten { color: #e8d8d0; }
.dark .diary-notebook .diary-content .dc .messy { color: #d8c8c0; }
/* 娣辫壊 鈥?娑傛敼閬洊锛氬ザ鍜栬壊鏌斿拰鏂滅嚎 */
.dark .diary-notebook .diary-content .dc .censored {
  color: rgba(232,216,210,0.22); background-color: rgba(200,180,175,0.05);
  background-image:
    repeating-linear-gradient(-5deg, transparent, transparent 2.5px, rgba(200,180,175,0.32) 2.5px, rgba(200,180,175,0.32) 3.5px),
    repeating-linear-gradient(12deg, transparent, transparent 3px, rgba(210,190,185,0.25) 3px, rgba(210,190,185,0.25) 4px),
    repeating-linear-gradient(-18deg, transparent, transparent 3.5px, rgba(190,170,165,0.28) 3.5px, rgba(190,170,165,0.28) 4.5px);
}
.dark .diary-notebook .diary-content .dc .censored:hover {
  background-image: none; background-color: transparent; color: inherit;
}
.diary-detail-popup { max-width: 520px !important; }

/* ===== 璁剧疆鎸夐挳 & 澶ц皟鏌ユ寜閽?===== */
.settings-btn {
  background: transparent; border: 2px solid var(--sweet-butter);
  color: var(--sweet-text-muted); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s; flex-shrink: 0;
  width: 36px; height: 36px; border-radius: 50%;
  font-family: inherit;
}
.settings-btn:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light); }
/* 场景一键切换按钮 */
.scene-btn { background: transparent; border: 2px solid var(--sweet-butter); color: var(--sweet-text-muted); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; flex-shrink: 0; padding: 4px 10px; border-radius: 20px; font-family: inherit; white-space: nowrap; }
.scene-btn:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light); }
.scene-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.scene-btn.scene-active-daily { border-color: var(--sweet-mint); color: #60a080; background: var(--sweet-mint-light); }
.scene-btn.scene-active-nsfw { border-color: var(--sweet-pink); color: #5c1430; background: var(--sweet-pink); box-shadow: 0 0 8px var(--sweet-pink-light); }

.investigate-btn {
  font-family: var(--sweet-font-body); font-size: 11px; font-weight: 600;
  cursor: pointer; padding: 5px 14px;
  border: 2px solid var(--sweet-lavender);
  background: var(--sweet-lavender-light);
  color: #7868b8;
  border-radius: var(--sweet-radius-xl);
  letter-spacing: 0.5px;
  transition: all 0.2s;
  white-space: nowrap;
}
.investigate-btn:hover { background: var(--sweet-lavender); color: #3a1860; filter: brightness(1.08); }

/* 璁剧疆寮圭獥 */
.settings-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100vh; height: 100dvh;
  background: rgba(0,0,0,0.35); z-index: 10002;
  display: none; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.settings-overlay.show { display: flex; }
.settings-popup {
  background: var(--sweet-card);
  border: 2px solid var(--sweet-border);
  border-radius: var(--sweet-radius-md);
  width: 90%; max-width: 320px; max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: var(--sweet-shadow-pop);
  animation: sweet-pop-in .3s cubic-bezier(0.34,1.56,0.64,1);
}
.settings-popup-head {
  padding: 14px 18px; display: flex; align-items: center; gap: 10px;
  background: linear-gradient(135deg, var(--sweet-pink-light), var(--sweet-lavender-light));
  border-radius: var(--sweet-radius-md) var(--sweet-radius-md) 0 0;
  border-bottom: 2px dashed var(--sweet-pink);
  flex-shrink: 0;
}
.settings-popup-title {
  font-family: var(--sweet-font-title); font-size: var(--ub-popup-font-title,15px); font-weight: 700;
  color: var(--sweet-pink-deep); letter-spacing: 2px; flex: 1;
}
.settings-popup-close {
  width: 30px; height: 30px; border-radius: 50%;
  border: 2px solid var(--sweet-border); background: transparent;
  cursor: pointer; font-size: 14px; color: var(--sweet-text-muted);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; font-family: inherit; flex-shrink: 0;
}
.settings-popup-close:hover { border-color: var(--sweet-pink); color: var(--sweet-pink-deep); background: var(--sweet-pink-light); }
.settings-tabs {
  display: flex; border-bottom: 2px solid var(--sweet-border);
  padding: 0 18px; background: var(--sweet-tag);
}
.settings-tab {
  flex: 1; padding: 12px 8px; border: none; background: transparent;
  color: var(--sweet-text-muted); font-size: 14px;
  font-family: var(--sweet-font-body); letter-spacing: 1px;
  cursor: pointer; transition: all 0.2s; position: relative; font-weight: 500;
}
.settings-tab:hover { color: var(--sweet-text); background: var(--sweet-pink-light); }
.settings-tab.active { color: var(--sweet-pink-deep); font-weight: 600; background: var(--sweet-pink-light); }
.settings-tab.active::after {
  content: ''; position: absolute; bottom: -2px; left: 10%; right: 10%;
  height: 3px; background: linear-gradient(90deg, var(--sweet-pink-light), var(--sweet-pink), var(--sweet-pink-light));
  border-radius: 2px;
}
.settings-popup-body { padding: 16px 18px; min-height: 120px; overflow-y: auto; flex: 1; }
.settings-tab-content { display: none; }
.settings-tab-content.active { display: block; animation: sweet-fade-in .2s ease; }
.settings-section {
  margin: 14px 0; padding: 12px 14px; border-radius: 8px;
  background: rgba(255,182,193,0.06);
  border: 1px solid var(--sweet-border-soft);
}
.settings-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--sweet-border-soft);
}
.settings-row:last-child { border-bottom: none; }
.settings-label{font-size:var(--ub-ui-font-13,13px);font-weight: 600;color: var(--sweet-text);letter-spacing: 0.5px;}
.settings-toggle {
  width: 44px; height: 26px; border-radius: 14px;
  background: var(--sweet-border); cursor: pointer;
  position: relative; transition: background 0.3s;
  border: none; padding: 0;
}
.settings-toggle.on { background: var(--sweet-pink); }
.settings-toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #fff; transition: transform 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.settings-toggle.on::after { transform: translateX(18px); }

/* ===== 鐐瑰嚮鐗规晥 ===== */
.click-heart {
  position: fixed; pointer-events: none; z-index: 9999;
  font-size: 20px; color: var(--sweet-pink);
  animation: sweet-heart-rise 1.8s ease-out forwards;
  text-shadow: 0 0 8px var(--sweet-pink-glow);
}
@keyframes sweet-heart-rise {
  0% { opacity: 1; transform: translateY(0) scale(0.5) rotate(0deg); }
  30% { opacity: 1; transform: translateY(-20px) scale(1.2) rotate(-20deg); }
  100% { opacity: 0; transform: translateY(-80px) scale(0.3) rotate(30deg); }
}
.click-text {
  position: fixed; pointer-events: none; z-index: 9999;
  font-size: 12px; color: var(--sweet-pink-deep);
  white-space: nowrap;
  animation: sweet-text-drift 2s ease-out forwards;
  opacity: 0.85; text-shadow: 0 0 8px var(--sweet-pink-glow);
  letter-spacing: 1px;
}
@keyframes sweet-text-drift {
  0% { opacity: 0; transform: translateY(0) translateX(0) scale(0.8); }
  15% { opacity: 0.9; transform: translateY(-10px) translateX(5px) scale(1); }
  100% { opacity: 0; transform: translateY(-60px) translateX(var(--drift-x,30px)) scale(0.6); }
}
.tab-ripple {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle, var(--sweet-pink-glow) 0%, transparent 70%);
  animation: sweet-tab-glow .6s ease-out forwards;
  pointer-events: none; border-radius: inherit;
}
@keyframes sweet-tab-glow {
  0% { opacity: 1; transform: scale(.8); }
  100% { opacity: 0; transform: scale(1.1); }
}

/* ===== 榧犳爣鍏夋檿 ===== */
.mouse-glow {
  position: fixed; width: 80px; height: 80px; border-radius: 50%;
  pointer-events: none; z-index: 100;
  background: radial-gradient(circle, rgba(255,143,171,0.2) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  transition: opacity .3s; opacity: 0;
}
.mouse-glow.active { opacity: 1; }

/* ===== 鍥哄畾妯″紡鎶樺彔鐘舵€?===== */
#ac-statusbar-wrapper.ub-collapsed { display: none !important; }

/* ===== 馃摫 鍝嶅簲寮?===== */
@media (max-width: 600px) {
  .book-head { padding: 10px 12px; gap: 6px; }
  .main-char-name { font-size: 14px; }
  .char-panel { padding: 10px 12px 14px; }
  .love-card { padding: 14px 12px; }
  .char-name { font-size: 18px; }
  .tabs { padding: 8px 12px; gap: 4px; }
  .tab { font-size: 12px; padding: 6px 14px; min-height: 30px; box-sizing: border-box; }
  .candy-btn { font-size: 11px; padding: 5px 12px; min-height: 30px; box-sizing: border-box; }
  .play-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px 12px; }
  .char-clothes-item, .char-body-item { padding: 6px 10px; font-size: 11px; }
  .char-clothes-item .cl, .char-body-item .bl { min-width: 48px; }
  .book-head-right { gap: 4px; }
  .settings-btn { min-width: 32px; min-height: 32px; font-size: 18px; }
  .tab { padding: 6px 12px; font-size: 12px; }
  .char-inner-thought { padding: 10px 14px; font-size: 12px; }
  .char-portrait-text-row{flex-direction:column}
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}

/* 鏂版墜甯姪鎻愮ず鎸夐挳 */
.help-tip-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:2px solid var(--sweet-border);background:transparent;color:var(--sweet-text-muted);font-size:10px;font-weight:bold;cursor:help;flex-shrink:0;line-height:1;font-family:inherit;transition:all .2s}
.help-tip-btn:hover{border-color:var(--sweet-pink);color:var(--sweet-pink-deep);background:var(--sweet-pink-light)}

.help-tooltip-global{position:fixed;z-index:100000;max-width:260px;padding:10px 14px;border-radius:var(--sweet-radius-xl);background:var(--sweet-bg);border:2px solid var(--sweet-border);color:var(--sweet-text);font-size:11px;line-height:1.7;letter-spacing:0.5px;white-space:pre-line;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15)}
.dark .char-info-card{background:var(--sweet-card);border-color:var(--sweet-border);box-shadow:0 2px 8px rgba(255,105,180,0.08)}
/* === 深色下 pastel-tint 文字恢复浅色（浅色模式已加深以保证对比度，深色 tint 翻深需还原浅字） === */
.dark .bubble-tag.mint,.dark .candy-btn.mint{color:#60a080}
.dark .bubble-tag.lav,.dark .candy-btn.lav{color:#a090d0}
.dark .bubble-tag.peach,.dark .candy-btn.peach{color:#c08060}
.dark .candy-btn.pink{color:#ffb3c6}
/* === 过往经历时间轴 · 甜恋糖果 === */
.pe-intro{background:#fff0f5;border:2px solid #f5e0e8;padding:10px 12px;box-shadow:0 2px 10px rgba(255,143,171,0.12)}
.pe-intro-label{color:#e87090;font-family:'ZCOOL KuaiLe','Microsoft YaHei','PingFang SC','Heiti SC','Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei',sans-serif;letter-spacing:2px}
.pe-intro-text{color:#5c3d4a}
.pe-rail::before{background:linear-gradient(#ff8fab,rgba(255,143,171,0.15))}
.pe-dot{background:#ff8fab;border:2px solid #fff;box-shadow:0 0 0 1px #ff8fab,0 0 8px rgba(255,143,171,0.4);width:12px;height:12px;top:4px}
.pe-date{color:#e87090;font-family:'ZCOOL KuaiLe','Microsoft YaHei','PingFang SC','Heiti SC','Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei',sans-serif;letter-spacing:1px}
.pe-card{background:#fff;border:1.5px solid #f5e0e8;color:#5c3d4a;border-radius:14px;box-shadow:0 2px 8px rgba(255,143,171,0.08)}
/* 暗色 */
.dark .pe-intro{background:#2a1c2a;border-color:#3a2838;box-shadow:0 2px 10px rgba(255,143,171,0.1)}
.dark .pe-intro-label{color:#ffb3c6}
.dark .pe-intro-text{color:#e8d8e0}
.dark .pe-rail::before{background:linear-gradient(#ff8fab,rgba(255,143,171,0.15))}
.dark .pe-dot{background:#ff8fab;border-color:#241c28;box-shadow:0 0 0 1px #ff8fab,0 0 10px rgba(255,143,171,0.45)}
.dark .pe-date{color:#ffb3c6}
.dark .pe-card{background:#2a1c2a;border-color:#3a2838;color:#e8d8e0;box-shadow:0 2px 8px rgba(255,143,171,0.08)}
/* === db 弹窗 token 桥接：sweet :root 未定义 --card-light/--text/--text-muted/--divider，全回退灰值。桥到 sweet 真实 palette。 === */
.db-viewer-popup,.db-row-detail-popup,.db-confirm-popup,.db-merge-progress-popup,.db-merge-config-popup{
  --card-light:var(--sweet-card);
}
/* dark 下撤回 text/divider 桥（深梅色在深色卡上不可读），让 base.ts 既有 .dark .db-* 回退（#eee/#ddd/#888）生效；card-light 保留但 dark 下 bg 被 base.ts rgba 白覆盖 */
.dark .db-viewer-popup,.dark .db-row-detail-popup,.dark .db-confirm-popup,.dark .db-merge-progress-popup,.dark .db-merge-config-popup{
  --card-light:var(--sweet-card);
  --text:initial;
  --text-muted:initial;
  --divider:rgba(255,255,255,0.12);
}
` + baseCSS + /* css */ `
/* 角色中枢 / 剧情回顾：奶油糖纸 */
.char-hub-theme-sweet,.chronicle-reader-theme-sweet{--hub-bg:var(--sweet-card);--hub-panel:var(--sweet-bubble);--hub-line:var(--sweet-border);--hub-ink:var(--sweet-text);--hub-muted:var(--sweet-text-soft);--hub-accent:var(--sweet-pink-deep);--hub-soft:var(--sweet-pink-light);--hub-day:var(--sweet-bubble);--hub-night:var(--sweet-pink-light);--hub-night-ink:var(--sweet-pink-deep);--hub-pref:var(--sweet-pink-deep)}
.char-hub-theme-sweet .char-hub-gsym.is-female{color:var(--sweet-pink-deep)}.char-hub-theme-sweet .char-hub-gsym.is-male{color:#3a7bd5}
.char-hub-theme-sweet .char-hub-lead-banner{background:linear-gradient(90deg,var(--hub-soft),var(--hub-bg));border-radius:14px}
.char-hub-theme-sweet .char-hub-action{border-radius:10px}
.char-hub-theme-sweet .char-hub-action--investigate{color:#3a6fb5;border-color:color-mix(in srgb,#3a6fb5 40%,var(--hub-line));background:color-mix(in srgb,#3a6fb5 10%,var(--hub-bg))}
.char-hub-theme-sweet .char-hub-action--interview{color:#3a8a5a;border-color:color-mix(in srgb,#3a8a5a 40%,var(--hub-line));background:color-mix(in srgb,#3a8a5a 10%,var(--hub-bg))}
.char-hub-theme-sweet .char-hub-identity,.chronicle-reader-theme-sweet .chronicle-reader-card{border-color:var(--hub-line);background:linear-gradient(135deg,var(--hub-soft),var(--hub-bg));border-radius:14px;box-shadow:0 6px 18px rgba(223,133,159,.12)}
.char-hub-theme-sweet .char-hub-card{border-radius:14px;background:linear-gradient(145deg,var(--hub-bg),var(--hub-soft));box-shadow:0 5px 14px rgba(223,133,159,.1)}
.char-hub-theme-sweet .char-hub-profile-lede{border-radius:4px 16px 16px 4px;background:linear-gradient(100deg,var(--hub-soft),var(--hub-bg))}
.char-hub-theme-sweet .char-hub-prose-card,.char-hub-theme-sweet .char-hub-logic{border-radius:14px;background:var(--hub-bg);box-shadow:0 4px 12px rgba(223,133,159,.08)}
.char-hub-theme-sweet .char-hub-logic-index{border-radius:50%;background:var(--hub-soft);box-shadow:0 0 0 3px color-mix(in srgb,var(--hub-accent) 10%,transparent)}
.char-hub-theme-sweet .char-hub-trait-balance{gap:10px}.char-hub-theme-sweet .char-hub-trait-column{border-radius:15px;background:linear-gradient(145deg,var(--hub-soft),var(--hub-panel))}.char-hub-theme-sweet .char-hub-trait{border-radius:10px}
.char-hub-theme-sweet .char-hub-relation-card{border-radius:12px;background:linear-gradient(145deg,var(--hub-bg),var(--hub-soft));box-shadow:0 4px 12px rgba(223,133,159,.08)}.char-hub-theme-sweet .char-hub-relation-avatar{border-radius:12px;background:var(--hub-soft)}
.char-hub-theme-sweet .char-hub-history-preview{gap:10px}.char-hub-theme-sweet .char-hub-history-background,.char-hub-theme-sweet .char-hub-history-latest{border-radius:12px;background:var(--hub-bg);box-shadow:0 4px 12px rgba(223,133,159,.07)}
.char-hub-theme-sweet .char-hub-not-equal{overflow:hidden;border-radius:13px;background:var(--hub-bg);box-shadow:0 4px 12px rgba(223,133,159,.07)}.char-hub-theme-sweet .char-hub-not-equal-label{background:var(--hub-soft)}
.char-hub-theme-sweet .char-hub-intimacy-slip{border-radius:14px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-soft));box-shadow:0 5px 15px rgba(223,133,159,.1)}
.char-hub-theme-sweet .char-hub-vitals-strip,.char-hub-theme-sweet .char-hub-vitals-raw,.char-hub-theme-sweet .char-hub-nsfw-card,.char-hub-theme-sweet .char-hub-dual-stat,.char-hub-theme-sweet .char-hub-speech{border-radius:12px}
.panel-overlay.dark .char-hub-theme-sweet{--hub-day:#2c2230;--hub-night:rgba(255,138,170,.06);--hub-night-ink:#ff8aaa;--hub-pref:#ff8aaa}
.char-hub-theme-sweet .char-hub-ms-node{width:42px;height:42px;border:2px dashed var(--hub-accent);border-radius:50%;color:var(--hub-accent);background:color-mix(in srgb,var(--hub-accent) 6%,transparent);transform:rotate(-6deg);font-size:15px}
.char-hub-theme-sweet .char-hub-ms-item:nth-child(even) .char-hub-ms-node{transform:rotate(5deg)}
.char-hub-theme-sweet .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--hub-accent);color:#fff;border-style:solid;box-shadow:0 3px 10px color-mix(in srgb,var(--hub-accent) 40%,transparent)}
.char-hub-theme-sweet .char-hub-ms-desc{background:var(--sweet-bubble);border-radius:12px 12px 12px 3px;padding:5px 10px}
.char-hub-theme-sweet .char-hub-ms-item.is-latest .char-hub-ms-desc{background:var(--sweet-pink-light);font-weight:700}
.panel-overlay.dark .char-hub-theme-sweet .char-hub-ms-node{border-color:var(--hub-accent);color:var(--hub-accent)}
.panel-overlay.dark .char-hub-theme-sweet .char-hub-ms-item.is-latest .char-hub-ms-node{color:#241c28;box-shadow:0 3px 10px color-mix(in srgb,var(--hub-accent) 22%,transparent)}
.char-hub-theme-sweet{--ms-cat-first:#e26fa0;--ms-cat-relation:#d9537e;--ms-cat-status:#7fa8d9}
.panel-overlay.dark .char-hub-theme-sweet{--ms-cat-first:#f48ab4;--ms-cat-relation:#ef6f94;--ms-cat-status:#9ec3ea}
.chronicle-reader-theme-sweet .chronicle-timeline-node{width:11px;height:11px;border-color:var(--hub-bg);box-shadow:0 0 0 3px color-mix(in srgb,var(--hub-accent) 18%,transparent)}
.chronicle-reader-theme-sweet .chronicle-timeline-content{border-radius:15px;background:linear-gradient(140deg,var(--hub-bg),var(--hub-soft));box-shadow:0 5px 16px rgba(223,133,159,.1)}
.chronicle-reader-theme-sweet .chronicle-detail-text{border-radius:15px;background:var(--hub-bg);box-shadow:0 5px 16px rgba(223,133,159,.1)}.chronicle-reader-theme-sweet .chronicle-detail-dialogue{border-radius:15px;background:linear-gradient(140deg,var(--hub-bg),var(--hub-soft));box-shadow:0 4px 12px rgba(223,133,159,.07)}
.chronicle-reader-theme-sweet .chronicle-dialogue-line{border-radius:10px;background:var(--hub-bg);box-shadow:0 3px 9px rgba(223,133,159,.07)}.chronicle-reader-theme-sweet .chronicle-dialogue-speaker{border-radius:999px;background:var(--hub-soft)}
/* ===== ★ 主角立绘摆位 ===== */
.book-head .protagonist-portrait-row{display:flex;align-items:center;gap:12px;min-width:0}
.book-head .portrait-box{flex:0 0 72px;width:72px;height:72px}
@media (max-width:600px){
  .book-head .portrait-box{flex:0 0 56px;width:56px;height:56px}
  .book-head .protagonist-portrait-row{gap:8px}
}
`;
