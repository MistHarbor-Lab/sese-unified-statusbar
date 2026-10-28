// ===== 灵动玻璃主题（iOS 风） =====
// 设计语言：磨砂玻璃 backdrop-filter + 大圆角 + 系统字体栈 + 低对比度柔和界面。
// 深浅色同构：全部色彩经 --ios-* token，桥接变量（--card/--text/--divider/--accent/--hub-*…）
// 一律引用 --ios-*，深色只在下方选择器组重定义一次，所有共享组件自动跟随。
// 动效：弹窗弹簧弹出（轻过冲曲线）、按钮按压缩放、cell 按压高亮，纯 CSS 零运行时开销；
// prefers-reduced-motion 与 ub-anim-off 全部收敛。禁渐变（用户既有拍板）——层次靠玻璃与阴影。
import { baseCSS } from './base';

export const iosCoreCSS = /* css */ `
/* ═══ ① 设计 token · 浅色 ═══ */
:root{
  /* U38③：全局语义色补齐（与 ancient 同族；深色组内字面量重定义） */
  --ub-success:#3F6A52;--ub-warning:#8A5B14;--ub-danger:#A13B34;
  --ios-canvas:#f2f2f7;
  --ios-surface:rgba(255,255,255,.72);
  --ios-surface-solid:#ffffff;
  --ios-fill:rgba(120,120,128,.10);
  --ios-fill-2:rgba(120,120,128,.16);
  --ios-label:#1c1c1e;
  --ios-label-2:rgba(60,60,67,.62);
  --ios-label-3:rgba(60,60,67,.32);
  --ios-sep:rgba(60,60,67,.12);
  --ios-sep-strong:rgba(60,60,67,.22);
  --ios-accent:#007aff;
  --ios-on-accent:#ffffff;
  --ios-tint:rgba(0,122,255,.10);
  --ios-danger:#ff3b30;
  --ios-green:#34c759;
  --ios-orange:#ff9500;
  --ios-shadow:0 10px 36px rgba(0,0,0,.14);
  --ios-shadow-soft:0 4px 18px rgba(0,0,0,.08);
  --ios-radius-card:18px;
  --ios-radius-cell:14px;
  --ios-radius-btn:12px;
  --ios-blur:blur(30px) saturate(1.9);
  --ios-ease-spring:cubic-bezier(.32,1.18,.35,1);
  --ios-ease-out:cubic-bezier(.25,.1,.25,1);
  --ios-font:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei UI","Segoe UI",system-ui,sans-serif;

  /* === 桥接变量（对齐 base.ts 与各共享组件的变量链） === */
  --bg-color:var(--ios-canvas);
  --text-color:var(--ios-label);
  --secondary-text:var(--ios-label-2);
  --border-color:var(--ios-sep);
  --tag-border:var(--ios-sep);
  --btn-hover-bg:var(--ios-fill);
  --btn-hover-text:var(--ios-label);
  --card-border:var(--ios-sep);
  --divider:var(--ios-sep);
  --divider-light:rgba(60,60,67,.06);
  --card:var(--ios-surface-solid);
  --card-light:var(--ios-surface-solid);
  --card-bg:var(--ios-surface-solid);
  --text:var(--ios-label);
  --text-muted:var(--ios-label-2);
  --panel-bg:var(--ios-fill);
  --accent:var(--ios-accent);
  --danger:var(--ios-danger);
  --ub-overlay-bg:rgba(0,0,0,.32);
  --ub-scrollbar-thumb:rgba(60,60,67,.28);
  --ub-scrollbar-thumb-hover:rgba(60,60,67,.48);
  --ub-text-muted:var(--ios-label-2);
  --ub-bg-card:var(--ios-surface-solid);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接 → 主题级补同一组变量（浅/深各一套，值取本主题 token） */
  --ub-text:var(--ios-label,#1c1c1e);--ub-divider:var(--ios-sep,rgba(60,60,67,.12));--ub-accent:var(--ios-accent,#007aff);--ub-hover-bg:var(--ios-fill,rgba(120,120,128,.1));
  --ub-popup-radius:20px;
  --ub-popup-shadow:var(--ios-shadow);
  --ub-popup-border:none;
  --ub-popup-bg:var(--ios-surface-solid);
  --ub-popup-head-bg:transparent;
  --ub-popup-head-border:none;
  --ub-btn-radius:var(--ios-radius-btn);
  --ub-ft-ring-start:#5ac8fa;
  --ub-ft-ring-end:#007aff;
  --ub-ft-ring-glow:rgba(0,122,255,.30);
  /* === 立绘主题变量 === */
  --portrait-bg:#f2f2f7;
  --portrait-empty-color:var(--ios-label-2);
  --portrait-border:var(--ios-sep);
  --portrait-radius:14px;
  /* === 角色中枢 / 剧情回顾 hub token === */
  --hub-bg:var(--ios-surface-solid);
  --hub-panel:#f2f2f7;
  --hub-line:var(--ios-sep);
  --hub-ink:var(--ios-label);
  --hub-muted:var(--ios-label-2);
  --hub-accent:var(--ios-accent);
  --hub-soft:var(--ios-fill);
  --hub-day:transparent;
  --hub-night:rgba(120,120,128,.14);
  --hub-night-ink:var(--ios-label);
  --hub-pref:var(--ios-accent);
  --ms-cat-first:#007aff;
  --ms-cat-relation:#ff375f;
  --ms-cat-status:#5e5ce6;
}

/* ═══ ② 设计 token · 深色（主栏锚点 + 各 overlay 家族） ═══
   ★桥接变量必须在本组用字面量直接重定义：:root 上的 --card:var(--ios-*) 形式
   会在 :root 处完成替换并以其计算值向下继承，深色组翻 --ios-* 带不动它们
   （CSS 自定义属性继承的是计算值而非表达式）。 */
#ac-content.dark,
.book.dark-mode,
.nsfw-overlay.dark,
.panel-overlay.dark,
.settings-overlay.dark,
#ac-options-bar-floating.dark,
.ub-decision-overlay.dark{
  /* U38③：语义色深色档（字面量重定义） */
  --ub-success:#77B18C;--ub-warning:#D7AC5C;--ub-danger:#E4776D;
  --ios-canvas:#000000;
  --ios-surface:rgba(28,28,32,.70);
  --ios-surface-solid:#1c1c1e;
  --ios-fill:rgba(120,120,128,.24);
  --ios-fill-2:rgba(120,120,128,.34);
  --ios-label:#ffffff;
  --ios-label-2:rgba(235,235,245,.62);
  --ios-label-3:rgba(235,235,245,.32);
  --ios-sep:rgba(235,235,245,.12);
  --ios-sep-strong:rgba(235,235,245,.24);
  --ios-accent:#0a84ff;
  --ios-on-accent:#ffffff;
  --ios-tint:rgba(10,132,255,.20);
  --ios-danger:#ff453a;
  --ios-green:#30d158;
  --ios-orange:#ff9f0a;
  --ios-shadow:0 14px 44px rgba(0,0,0,.55);
  --ios-shadow-soft:0 4px 18px rgba(0,0,0,.4);
  /* === 桥接变量 · 深色字面量（与 :root 桥接一一对应；cell 用 #2c2c2e 在 #1c1c1e 弹窗底上抬升） === */
  --bg-color:#1c1c1e;
  --text-color:#ffffff;
  --secondary-text:rgba(235,235,245,.62);
  --border-color:rgba(235,235,245,.12);
  --tag-border:rgba(235,235,245,.12);
  --btn-hover-bg:rgba(120,120,128,.24);
  --btn-hover-text:#ffffff;
  --card-border:rgba(235,235,245,.12);
  --divider:rgba(235,235,245,.12);
  --divider-light:rgba(235,235,245,.06);
  --card:#2c2c2e;
  --card-light:#2c2c2e;
  --card-bg:#2c2c2e;
  --text:#ffffff;
  --text-muted:rgba(235,235,245,.62);
  --panel-bg:rgba(120,120,128,.24);
  --accent:#0a84ff;
  --danger:#ff453a;
  --ub-overlay-bg:rgba(0,0,0,.5);
  --ub-scrollbar-thumb:rgba(235,235,245,.28);
  --ub-scrollbar-thumb-hover:rgba(235,235,245,.48);
  --ub-text-muted:rgba(235,235,245,.62);
  --ub-bg-card:#2c2c2e;
  /* 日历兄弟弹窗变量·深色（字面量兜底；:root 处已按浅色完成替换，深色必须重声明，理由同本块顶部注释） */
  --ub-text:var(--ios-label,#fff);--ub-divider:var(--ios-sep,rgba(235,235,245,.12));--ub-accent:var(--ios-accent,#0a84ff);--ub-hover-bg:var(--ios-fill,rgba(120,120,128,.24));
  --ub-popup-bg:#1c1c1e;
  --ub-popup-shadow:0 14px 44px rgba(0,0,0,.55);
  --ub-popup-border:none;
  --ub-popup-head-bg:transparent;
  --ub-popup-head-border:none;
  --ub-ft-ring-start:#64d2ff;
  --ub-ft-ring-end:#0a84ff;
  --ub-ft-ring-glow:rgba(10,132,255,.32);
  /* === 立绘 / 角色中枢 / 里程碑类别 === */
  --portrait-bg:#2c2c2e;
  --portrait-empty-color:rgba(235,235,245,.5);
  --portrait-border:rgba(235,235,245,.15);
  --hub-bg:#1c1c1e;
  --hub-panel:#2c2c2e;
  --hub-line:rgba(235,235,245,.12);
  --hub-ink:#ffffff;
  --hub-muted:rgba(235,235,245,.62);
  --hub-accent:#0a84ff;
  --hub-soft:rgba(120,120,128,.24);
  --hub-day:transparent;
  --hub-night:rgba(120,120,128,.28);
  --hub-night-ink:#ffffff;
  --hub-pref:#0a84ff;
  --ms-cat-first:#0a84ff;
  --ms-cat-relation:#ff375f;
  --ms-cat-status:#7d7aff;
  /* === 地图（原独立 .panel-overlay.dark 块并入） === */
  --map-panel-border:rgba(235,235,245,.14);
  --map-panel-bg:rgba(28,28,30,.92);
  --map-room-fill:rgba(10,132,255,.14);
  --map-room-label-color:#f2f2f7;
  --marker-protagonist:#0a84ff;
  --marker-ally:#30d158;
  --marker-npc:#8e8e93;
  --marker-enemy:#ff453a;
}

/* ═══ ③ 主栏结构 ═══ */
.ios-shell{
  font-family:var(--ios-font);
  color:var(--ios-label);
  background:transparent;
  padding:2px 0 8px;
  -webkit-font-smoothing:antialiased;
}
.ios-card{
  background:var(--ios-surface);
  border:1px solid var(--ios-sep);
  border-radius:var(--ios-radius-card);
  box-shadow:var(--ios-shadow-soft);
  padding:16px;
  margin:10px 0;
}
/* 磨砂玻璃挂在 wrapper（我们可控祖先链的最外层）：backdrop 采样直达聊天页，
   不受中间层属性/运行时环境对卡片级采样的干扰；卡片只做半透明着色，整栏单次模糊开销。
   质感配方对齐 iOS 材质：低不透明度 + 大模糊半径 + 高饱和（层次靠 blur 而非遮盖）；
   blur 真不可渲染的环境由 @supports 兜底转实底，可读性不受材质变透影响。 */
#ac-statusbar-wrapper{
  -webkit-backdrop-filter:var(--ios-blur);
  backdrop-filter:var(--ios-blur);
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  #ac-statusbar-wrapper{-webkit-backdrop-filter:none;backdrop-filter:none}
  .ios-card{background:var(--ios-surface-solid)}
}
/* 跟随底部保流畅：wrapper 带 ub-anim-off 时整栏玻璃降级为纯色，免去滚动重采样 */
#ac-statusbar-wrapper.ub-anim-off{-webkit-backdrop-filter:none;backdrop-filter:none}
#ac-statusbar-wrapper.ub-anim-off .ios-card{background:var(--ios-surface-solid)}
/* 酒馆「禁用模糊特效」开关（body 挂 no-blur 类）会用 toggle-dependent.css 的
   body.no-blur * { backdrop-filter:unset !important } 压掉全页毛玻璃（实机案例：
   PC 端退化为半透明的唯一根因）。此处以更高特异性仅为主栏恢复玻璃——
   (1,1,1)+!important 压 (0,1,1)+!important；其余界面仍尊重该开关。 */
body.no-blur #ac-statusbar-wrapper{
  -webkit-backdrop-filter:var(--ios-blur) !important;
  backdrop-filter:var(--ios-blur) !important;
}
.ios-shell.nsfw-border{border-color:transparent}
.ios-shell.nsfw-border .ios-card{border-color:rgba(255,59,48,.45)}

/* —— 顶部主角卡（iOS large-title 风） —— */
.ios-hero{padding:18px 18px 14px}
.ios-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ios-hero-id{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.ios-hero-copy{min-width:0;display:flex;flex-direction:column;gap:3px}
.ios-hero-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.ios-hero-name{
  font-size:22px;font-weight:700;letter-spacing:-.3px;line-height:1.15;
  color:var(--ios-label);background:none;border:none;padding:0;cursor:pointer;
  font-family:var(--ios-font);text-align:left;max-width:100%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  transition:opacity .15s var(--ios-ease-out),transform .15s var(--ios-ease-spring);
}
.ios-hero-name:hover{opacity:.7}
.ios-hero-name:active{transform:scale(.97);opacity:.5}
/* 主角近况全文展示（与 bridge-command-status 同款思路）：line-clamp 截断对长文本是拦腰硬裁，
   移动端 2 行只容十几个字，观感差；overflow-wrap:anywhere 兜底无空格长串 */
.ios-hero-status{font-size:var(--ub-content-font-12,13.2px);color:var(--ios-label-2);line-height:1.45;overflow-wrap:anywhere}
.ios-hero-controls{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.ios-icon-btn{
  min-width:32px;height:32px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;
  border:none;border-radius:var(--ios-radius-btn);background:var(--ios-fill);color:var(--ios-label);
  font:600 12px/1 var(--ios-font);cursor:pointer;white-space:nowrap;
  transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out);
}
.ios-icon-btn:hover{background:var(--ios-fill-2)}
.ios-icon-btn:active{transform:scale(.92)}
.ios-icon-btn.accent{background:var(--ios-tint);color:var(--ios-accent)}
.ios-icon-btn.accent:hover{background:rgba(0,122,255,.18)}
/* —— 货币 chip（货币系统）—— */
.ios-chip.is-currency{background:rgba(47,164,126,.12);color:#1f8a66}
.ios-chip.is-currency.neg{background:rgba(255,59,48,.10);color:var(--ios-danger)}
.ios-chip.is-currency-empty,.ios-chip.is-currency-more{
  background:transparent;border:1.5px dashed rgba(47,164,126,.45);color:#4da58a;font-weight:500;
}
/* —— 状态 chips 行 —— */
.ios-hero-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.ios-chip{
  display:inline-flex;align-items:center;gap:5px;max-width:100%;
  padding:6px 12px;border:none;border-radius:999px;
  background:var(--ios-fill);color:var(--ios-label);
  font:500 12px/1.2 var(--ios-font);letter-spacing:.1px;
  cursor:default;min-height:28px;box-sizing:border-box;
}
button.ios-chip{cursor:pointer;transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out)}
button.ios-chip:hover{background:var(--ios-fill-2)}
button.ios-chip:active{transform:scale(.95)}
.ios-chip .label{color:var(--ios-label-3);font-size:10px;letter-spacing:.5px}
.ios-chip b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ios-chip.is-accent{background:var(--ios-tint);color:var(--ios-accent)}

/* —— 快捷入口 pill 行（并入主角卡，与地点/时间 chips 同行靠右；宽度不够换行） —— */
.ios-hero-actions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto;min-width:0;align-items:center}
/* 徽章 top:-7px/right:-8px 溢出胶囊按钮；移动端整行横滚时 overflow-x:auto 会把对轴也按 auto
   计算（CSS 规则），徽章上/右溢出的部分会被裁掉（实机「8」徽章被切）——移动端 MQ 用 padding 留空间 */
.ios-action{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;
  padding:8px 14px;min-height:36px;border:none;border-radius:999px;
  background:var(--ios-fill);color:var(--ios-label);
  font:600 12.5px/1 var(--ios-font);cursor:pointer;white-space:nowrap;
  transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out);
}
.ios-action em{font-style:normal;font-size:14px;line-height:1}
.ios-action:hover{background:var(--ios-fill-2)}
.ios-action:active{transform:scale(.93)}
.ios-action.is-primary{background:var(--ios-accent);color:var(--ios-on-accent)}
.ios-action.is-primary:hover{filter:brightness(1.08)}

/* —— 在场角色 chips —— */
.ios-people{margin:12px 2px 2px}
/* 人物页签行自带玻璃卡底：前面板游走在卡片外，透明底+半透明胶囊会与聊天背景糊在一起（实机反馈区分度低） */
.ios-persona-track{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:8px 10px;background:var(--ios-surface);border:1px solid var(--ios-sep);border-radius:var(--ios-radius-card);box-shadow:var(--ios-shadow-soft)}
.ios-persona-track::-webkit-scrollbar{display:none}
.ios-persona-chip{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;
  padding:7px 14px;min-height:34px;border:none;border-radius:999px;
  background:var(--ios-fill-2);color:var(--ios-label);
  font:500 12.5px/1 var(--ios-font);cursor:pointer;white-space:nowrap;
  transition:transform .15s var(--ios-ease-spring),background .18s var(--ios-ease-out),color .18s var(--ios-ease-out);
}
.ios-persona-chip:hover{background:rgba(120,120,128,.24)}
#ac-content.dark .ios-persona-chip:hover,.dark-mode .ios-persona-chip:hover{background:rgba(120,120,128,.44)}
.ios-persona-chip:active{transform:scale(.93)}
.ios-persona-chip.active{background:var(--ios-label);color:var(--ios-canvas);font-weight:600}

/* —— 角色详情卡（iOS 分组列表） —— */
.ios-profile-head{display:flex;align-items:center;gap:14px}
.ios-profile-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.ios-profile-name{
  font-size:18px;font-weight:700;letter-spacing:-.2px;color:var(--ios-label);
  background:none;border:none;padding:0;cursor:pointer;text-align:left;
  font-family:var(--ios-font);transition:opacity .15s var(--ios-ease-out),transform .15s var(--ios-ease-spring);
}
.ios-profile-name:hover{opacity:.7}
.ios-profile-name:active{transform:scale(.97);opacity:.5}
.ios-profile-sub{font-size:12px;color:var(--ios-label-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ios-mood{
  display:inline-flex;align-items:center;padding:4px 11px;margin-top:4px;width:fit-content;
  border-radius:999px;background:var(--ios-tint);color:var(--ios-accent);
  font:600 11.5px/1.3 var(--ios-font);
}
.ios-profile-actions{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 2px}
.ios-act-btn{
  padding:7px 13px;min-height:32px;border:none;border-radius:999px;
  background:var(--ios-fill);color:var(--ios-label);
  font:600 12px/1 var(--ios-font);cursor:pointer;white-space:nowrap;
  transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out);
}
.ios-act-btn:hover{background:var(--ios-fill-2)}
.ios-act-btn:active{transform:scale(.93)}
.ios-act-btn.is-primary{background:var(--ios-accent);color:var(--ios-on-accent)}
.ios-act-btn.is-primary:hover{filter:brightness(1.08)}

/* 分组 inset 列表（iOS Settings 风 cell） */
.ios-group-title{
  font:600 12px/1.4 var(--ios-font);color:var(--ios-label-2);text-transform:none;
  letter-spacing:.2px;margin:16px 14px 6px;display:flex;align-items:baseline;justify-content:space-between;gap:8px;
}
.ios-group-title small{font-weight:400;color:var(--ios-label-3);font-size:10.5px;letter-spacing:.6px}
.ios-list{
  background:var(--ios-surface-solid);
  border-radius:var(--ios-radius-cell);
  overflow:hidden;
  border:1px solid var(--ios-sep);
}
.ios-row{
  display:flex;align-items:baseline;gap:12px;
  padding:11px 14px;min-height:44px;box-sizing:border-box;
  border-bottom:1px solid var(--ios-sep);
  font-size:var(--ub-content-font-12,13.2px);line-height:1.5;
}
.ios-row:last-child{border-bottom:none}
.ios-row .k{flex:0 0 auto;color:var(--ios-label-2);font-size:var(--ub-content-font-11,12.1px);min-width:64px}
.ios-row .v{flex:1;min-width:0;color:var(--ios-label);font-weight:500;overflow-wrap:anywhere}
.ios-row .v.muted{color:var(--ios-label-3);font-weight:400;font-style:italic}
.ios-empty{padding:22px 14px;text-align:center;color:var(--ios-label-3);font-size:12.5px}

/* 调教值进度条（iOS 电池式） */
.ios-meter{display:flex;align-items:center;gap:10px;margin:12px 14px 2px}
.ios-meter-label{font:600 11px/1 var(--ios-font);color:var(--ios-label-2);letter-spacing:.3px;flex-shrink:0}
.ios-meter-track{flex:1;height:6px;border-radius:3px;background:var(--ios-fill-2);overflow:hidden}
.ios-meter-fill{height:100%;border-radius:3px;background:var(--ios-accent);transition:width .5s var(--ios-ease-out)}
.ios-meter-val{font:700 12px/1 var(--ios-font);color:var(--ios-accent);flex-shrink:0;font-variant-numeric:tabular-nums}

/* 装束/身体分段控制（iOS segmented control） */
.ios-seg-controls{display:flex;gap:6px;margin:14px 0 8px}
.ios-seg-btn{
  flex:1;padding:7px 10px;min-height:32px;border:none;border-radius:9px;
  background:var(--ios-fill);color:var(--ios-label);
  font:600 12px/1 var(--ios-font);cursor:pointer;
  transition:transform .15s var(--ios-ease-spring),background .18s var(--ios-ease-out),color .18s var(--ios-ease-out);
}
.ios-seg-btn:hover{background:var(--ios-fill-2)}
.ios-seg-btn:active{transform:scale(.96)}
.ios-seg-btn.active-switch{background:var(--ios-label);color:var(--ios-canvas)}

/* —— 玩法区（iOS 折叠分组卡） —— */
.ios-play{margin:10px 0}
/* 折叠：click.ac-play-collapse 只翻 .collapsed 类，隐藏须有规则承接（缺则点 +/− 仅换文字、内容不动） */
.ios-play.collapsed .ios-play-grid{display:none}
.ios-play-head{display:flex;align-items:center;gap:8px;padding:0 4px 12px}
.ios-play-title{font-size:15px;font-weight:700;letter-spacing:-.2px;flex:1;display:flex;align-items:baseline;gap:8px}
.ios-play-title small{font-weight:400;color:var(--ios-label-2);font-size:11.5px}
.ios-play-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}

/* ═══ ④ overlay 与弹窗壳（磨砂玻璃 + 弹簧入场） ═══ */
.nsfw-overlay,.panel-overlay,.settings-overlay{
  position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;
  z-index:10000;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.30);
  -webkit-backdrop-filter:blur(10px) saturate(1.4);
  backdrop-filter:blur(10px) saturate(1.4);
  font-family:var(--ios-font);
}
.nsfw-overlay.dark,.panel-overlay.dark,.settings-overlay.dark{background:rgba(0,0,0,.48)}
.nsfw-overlay.show,.panel-overlay.show,.settings-overlay.show{display:flex;animation:ios-overlay-in .2s var(--ios-ease-out)}
@keyframes ios-overlay-in{from{opacity:0}to{opacity:1}}
@keyframes ios-pop{
  from{opacity:0;transform:scale(.92) translateY(18px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
@keyframes ios-sheet-in{
  from{opacity:0;transform:translateY(6%)}
  to{opacity:1;transform:translateY(0)}
}
.panel-popup,.settings-popup{
  background:var(--ios-surface-solid);
  border:none;border-radius:var(--ub-popup-radius,20px);
  box-shadow:var(--ios-shadow);
  color:var(--ios-label);
  /* 缺 flex 列时 body 的 flex:1+overflow-y:auto 不生效 → 超出内容被裁且无滚动条（设置窗口实机反馈） */
  display:flex;flex-direction:column;
  overflow:hidden;
  animation:ios-pop .38s var(--ios-ease-spring) both;
}
.ub-popup--xl,.ub-popup--l{animation:ios-sheet-in .34s var(--ios-ease-spring) both}
.panel-popup-head,.settings-popup-head{
  display:flex;align-items:center;gap:10px;
  padding:14px 16px;border-bottom:1px solid var(--ios-sep);flex-shrink:0;
  background:var(--ios-surface);
  -webkit-backdrop-filter:var(--ios-blur);
  backdrop-filter:var(--ios-blur);
}
.panel-popup-title,.settings-popup-title{
  font-size:var(--ub-popup-font-title,16px);font-weight:700;letter-spacing:-.2px;
  color:var(--ios-label);flex:1;font-family:var(--ios-font);
}
.panel-popup-close,.panel-popup-back,.settings-popup-close{
  width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;
  border:none;border-radius:999px;background:var(--ios-fill);
  color:var(--ios-label-2);font-size:14px;cursor:pointer;flex-shrink:0;line-height:1;
  transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out);
}
.panel-popup-back{width:auto;padding:0 12px;font-size:12px;font-weight:600}
.panel-popup-close:hover,.panel-popup-back:hover,.settings-popup-close:hover{background:var(--ios-fill-2);color:var(--ios-label)}
.panel-popup-close:active,.panel-popup-back:active,.settings-popup-close:active{transform:scale(.9)}
.panel-popup-warehouse-toggle{
  font:600 11px/1 var(--ios-font);border:none;border-radius:999px;
  background:var(--ios-fill);color:var(--ios-label-2);
  padding:0 12px;height:28px;cursor:pointer;flex-shrink:0;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.panel-popup-warehouse-toggle:hover{background:var(--ios-fill-2)}
.panel-popup-warehouse-toggle:active{transform:scale(.93)}
.panel-popup-body,.char-info-body{
  padding:14px 16px;flex:1 1 auto;min-height:0;overflow-y:auto;
  font-size:var(--ub-popup-font-body,13px);line-height:1.55;
  scrollbar-width:thin;
}
.panel-popup-body::-webkit-scrollbar,.char-info-body::-webkit-scrollbar,.settings-popup-body::-webkit-scrollbar{width:6px}
.panel-popup-body::-webkit-scrollbar-track,.settings-popup-body::-webkit-scrollbar-track{background:transparent}
.panel-popup-body::-webkit-scrollbar-thumb,.settings-popup-body::-webkit-scrollbar-thumb{background:var(--ub-scrollbar-thumb);border-radius:3px}
.panel-popup-body::-webkit-scrollbar-thumb:hover,.settings-popup-body::-webkit-scrollbar-thumb:hover{background:var(--ub-scrollbar-thumb-hover)}
.panel-empty{text-align:center;padding:40px 0;color:var(--ios-label-3);font-size:var(--ub-ui-font-13,13px)}

/* —— 设置面板（iOS 设置外观） —— */
.settings-tabs{
  display:flex;flex:0 0 auto;gap:0;border-bottom:1px solid var(--ios-sep);padding:0 8px;
  background:transparent;overflow-x:auto;scrollbar-width:none;
  /* 弹性坑：overflow-x:auto 会把本项的自动最小尺寸归零（min-height:auto→0），
     弹窗为 max-height:85vh 的 flex 列时标签行被内容顶到压缩裁切；flex:0 0 auto 禁止纵向收缩 */
}
.settings-tabs::-webkit-scrollbar{display:none}
.settings-tab{
  flex:1;padding:11px 10px;border:none;background:transparent;
  color:var(--ios-label-2);font-weight:600;font-size:var(--ub-ui-font-13,13px);line-height:1.2;font-family:var(--ios-font);
  letter-spacing:0;cursor:pointer;position:relative;white-space:nowrap;
  transition:color .18s var(--ios-ease-out),transform .15s var(--ios-ease-spring);
}
.settings-tab:hover{color:var(--ios-label)}
.settings-tab:active{transform:scale(.95)}
.settings-tab.active{color:var(--ios-accent)}
.settings-tab.active::after{
  content:'';position:absolute;bottom:-1px;left:18%;right:18%;height:2.5px;
  border-radius:2px 2px 0 0;background:var(--ios-accent);
}
.settings-popup-body{padding:12px 16px;min-height:0;flex:1 1 auto;overflow-y:auto;font-size:var(--ub-ui-font-13,13px);scrollbar-width:thin}
.settings-tab-content{display:none}
.settings-tab-content.active{display:block;animation:ios-overlay-in .2s var(--ios-ease-out)}
.settings-section{
  margin:10px 0;padding:2px 14px;border-radius:var(--ios-radius-cell);
  background:var(--card);border:1px solid var(--ios-sep);
}
.settings-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--ios-sep)}
.settings-row:last-child{border-bottom:none}
.settings-label{font-size:var(--ub-ui-font-13,13px);font-weight:500;color:var(--ios-label);letter-spacing:0}
.settings-toggle{
  width:46px;height:28px;border-radius:999px;border:none;padding:0;
  background:var(--ios-fill-2);cursor:pointer;position:relative;
  transition:background .22s var(--ios-ease-out);
}
.settings-toggle::after{
  content:'';position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;
  background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.22);
  transition:transform .22s var(--ios-ease-spring);
}
.settings-toggle.on{background:var(--ios-green)}
.settings-toggle.on::after{transform:translateX(18px)}
.settings-btn{
  background:var(--ios-fill);border:none;color:var(--ios-label);
  border-radius:9px;padding:6px 12px;min-height:30px;
  font-weight:600;font-size:var(--ub-ui-font-12,12px);line-height:1.2;font-family:var(--ios-font);
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.settings-btn:hover{background:var(--ios-fill-2)}
.settings-btn:active{transform:scale(.94)}

/* 行组（.detail-row）自带 inset 卡片 → 外层卡摊平防双重圆角嵌套；卡名=角色名，iOS large-title 风 */
.char-info-card{border:none;border-radius:0;background:transparent;padding:0}
.char-info-card-name{font-size:20px;font-weight:700;letter-spacing:-.2px;color:var(--ios-label);padding:2px 2px 10px;border-bottom:none}
.char-info-card-rows{display:flex;flex-direction:column}

/* ═══ ⑤ 列表 cell（iOS inset grouped，按压缩放） ═══ */
.memo-list-item,.item-list-item,.mission-list-item,.diary-list-item{
  padding:11px 12px;margin:0 0 6px;border:none;border-radius:var(--ios-radius-cell);
  background:var(--card);cursor:pointer;
  transition:transform .16s var(--ios-ease-spring),background .15s;
  box-shadow:0 0 0 1px var(--ios-sep);
}
.memo-list-item:hover,.item-list-item:hover,.mission-list-item:hover,.diary-list-item:hover{background:var(--ios-fill)}
.memo-list-item:active,.item-list-item:active,.mission-list-item:active,.diary-list-item:active{transform:scale(.975);background:var(--ios-fill-2)}
.memo-item-top,.item-top,.mission-list-item .memo-item-top{display:flex;align-items:center;gap:8px}
.memo-title,.item-name,.mission-name{font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--ios-label);letter-spacing:-.1px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.memo-type,.item-type{
  font-weight:600;font-size:var(--ub-ui-font-10,10px);line-height:1;font-family:var(--ios-font);
  color:var(--ios-label-2);padding:3px 8px;
  border-radius:999px;background:var(--ios-fill);letter-spacing:.2px;flex-shrink:0;
}
.item-qty{font-weight:700;font-size:var(--ub-ui-font-11,11px);line-height:1;font-family:var(--ios-font);color:var(--ios-label);padding:3px 9px;border-radius:999px;background:var(--ios-tint);color:var(--ios-accent);flex-shrink:0}
.item-wardrobe-badge{
  display:inline-flex;align-items:center;border:none;color:var(--ios-accent);
  background:var(--ios-tint);border-radius:999px;padding:3px 8px;
  font-weight:700;font-size:var(--ub-ui-font-10,10px);line-height:1;font-family:var(--ios-font);flex-shrink:0;margin-left:2px;
}
.memo-item-sub,.diary-item-top{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;font-weight:400;font-size:var(--ub-ui-font-11,11px);line-height:1.4;font-family:var(--ios-font);color:var(--ios-label-2)}
.item-desc,.diary-item-content{font-size:var(--ub-ui-font-11-5,11.5px);color:var(--ios-label-2);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mission-list-item.completed{opacity:.55}
.mission-list-item .mission-delete{
  position:absolute;top:8px;right:8px;background:none;border:none;color:var(--ios-label-3);
  font-size:14px;cursor:pointer;padding:4px;border-radius:8px;
}
.mission-list-item{position:relative}
.mission-list-item .mission-delete:hover{color:var(--ios-danger)}
.mission-desc{font-size:var(--ub-ui-font-11-5,11.5px);color:var(--ios-label-2);margin-bottom:6px;line-height:1.5;padding-right:20px}
.mission-desc-clickable{cursor:pointer;transition:opacity .15s}
.mission-desc-clickable:hover{opacity:.7}
.mission-objective{
  font-size:var(--ub-ui-font-11-5,11.5px);color:var(--ios-label);padding:8px 12px;
  background:var(--ios-fill);border:none;border-radius:10px;line-height:1.6;
}
.mission-status{
  display:inline-block;font-weight:600;font-size:var(--ub-ui-font-10-5,10.5px);line-height:1;font-family:var(--ios-font);padding:4px 11px;
  border:none;border-radius:999px;margin-top:8px;cursor:pointer;
  background:var(--ios-fill);color:var(--ios-label-2);
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.mission-status:active{transform:scale(.93)}
.mission-status.pending{background:var(--ios-fill);color:var(--ios-label-2)}
.mission-status.completed{background:var(--ios-green);color:#fff}
/* 列表子行徽章（备忘状态/角色/时间、日记时间）：iOS 小胶囊，与 .memo-type/.item-type 同语言；
   约定时间用 accent tint 突出（未来的承诺比记录时间更重要） */
.memo-status,.memo-char,.memo-time-badge,.diary-time{
  padding:2px 8px;border-radius:999px;flex-shrink:0;
  background:var(--ios-fill);color:var(--ios-label-2);
  font-size:var(--ub-ui-font-10,10px);line-height:1.5;letter-spacing:.2px;
}
.memo-time-badge{color:var(--ios-label-3)}
.memo-time-badge.memo-appointed{background:var(--ios-tint);color:var(--ios-accent);font-weight:600}
.diary-time{width:fit-content}

/* —— 详情视图 —— */
.info-list{display:flex;flex-direction:column;gap:0}
.info-row{
  display:flex;font-size:var(--ub-ui-font-13,13px);align-items:baseline;line-height:1.6;
  padding:9px 0;border-bottom:1px solid var(--ios-sep);
}
.info-row:last-child{border-bottom:none}
.info-label{color:var(--ios-label-2);width:70px;flex-shrink:0;font-size:var(--ub-ui-font-12,12px)}
.info-value{color:var(--ios-label);font-weight:500;flex-grow:1;line-height:1.6}
.status-toggle{cursor:pointer;align-items:center}
.status-toggle:hover .info-value{opacity:.8}
.status-value-box{display:flex;align-items:center;justify-content:space-between;width:100%}
.status-arrow{transition:transform .25s var(--ios-ease-spring);color:var(--ios-label-3)}
.status-toggle.active .status-arrow{transform:rotate(180deg);color:var(--ios-label)}
.status-content{display:none;margin-top:6px;padding-left:12px;border-left:2px solid var(--ios-sep)}
.panel-popup-body .detail-content{display:block;margin-top:12px;padding:11px 13px;border-radius:12px;background:var(--ios-fill)}
.panel-popup-body .detail-content .dl,.panel-popup-body .detail-content .dc-label{color:var(--ios-label-2);font-weight:600;font-size:var(--ub-ui-font-10-5,10.5px);line-height:1;font-family:var(--ios-font);letter-spacing:.4px;margin-bottom:5px;display:block}
.panel-popup-body .detail-content .dc,.panel-popup-body .detail-content .dc-text{color:var(--ios-label);font-size:var(--ub-ui-font-12-5,12.5px);line-height:1.75}
/* 详情行组（物品/备忘/仓库/日记详情与角色信息卡）：iOS inset grouped 卡片。
   其余六主题都在自家文件定义 .detail-row 布局，iOS 此前完全缺失 → 详情页曾是一堆裸文字。
   连续 .detail-row 组成一张卡：行间 hairline，组头圆上角、组尾圆下角；
   圆角依赖 :not/:has 复杂选择器（仅修饰性），不支持的引擎退化为方角卡仍完整可读。 */
.panel-popup .detail-row{
  display:flex;align-items:baseline;gap:12px;
  padding:10px 14px;background:var(--card);
  font-size:var(--ub-ui-font-13,13px);line-height:1.55;
  border-radius:var(--ios-radius-cell) var(--ios-radius-cell) 0 0;
}
.panel-popup .detail-row + .detail-row{border-top:1px solid var(--ios-sep);border-radius:0}
.panel-popup .detail-row:last-child{border-radius:0 0 var(--ios-radius-cell) var(--ios-radius-cell)}
.panel-popup .detail-row + .detail-row:last-child,
.panel-popup .detail-row:has(+ :not(.detail-row)){border-top:1px solid var(--ios-sep);border-radius:0 0 var(--ios-radius-cell) var(--ios-radius-cell)}
.panel-popup .detail-row .dl{flex:0 0 auto;min-width:64px;color:var(--ios-label-2);font-size:var(--ub-ui-font-12,12px);font-weight:500}
.panel-popup .detail-row .dv{flex:1;min-width:0;color:var(--ios-label);font-weight:500;overflow-wrap:anywhere}
.item-detail-actions{display:flex;gap:8px;margin-top:16px}
.item-detail-actions .btn-line{flex:1;text-align:center}
/* 详情操作按钮族（物品/仓库/备忘详情）：iOS 胶囊按钮——
   使用=accent 实底主操作、仓库/衣柜=tint 次操作、丢弃=灰底红字破坏性操作。
   各主题在自家文件里定义这三类的形状，iOS 必须自带全套（只改色会出现系统默认灰按钮）。 */
.item-use-btn,.item-warehouse-btn,.item-discard-btn{
  flex:1;padding:8px 12px;min-height:34px;border:none;border-radius:999px;
  font:600 12px/1.2 var(--ios-font);cursor:pointer;white-space:nowrap;text-align:center;
  transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out),filter .15s;
}
.item-use-btn{background:var(--ios-accent);color:var(--ios-on-accent)}
.item-warehouse-btn{background:var(--ios-tint);color:var(--ios-accent)}
.item-discard-btn{background:var(--ios-fill);color:var(--ios-danger)}
.item-use-btn:hover,.item-warehouse-btn:hover,.item-discard-btn:hover{filter:brightness(1.07)}
.item-use-btn:active,.item-warehouse-btn:active,.item-discard-btn:active{transform:scale(.94)}
.diary-detail-writer{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--ios-label);margin-bottom:10px}
.diary-nav-btn{
  flex:0 0 auto;width:30px;height:30px;border:none;border-radius:999px;
  background:var(--ios-fill);color:var(--ios-label);cursor:pointer;
  font-weight:600;font-size:var(--ub-ui-font-11,11px);line-height:1;font-family:var(--ios-font);display:inline-flex;align-items:center;justify-content:center;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.diary-nav-btn:hover:not(:disabled){background:var(--ios-fill-2)}
.diary-nav-btn:active:not(:disabled){transform:scale(.9)}
.diary-nav-btn:disabled{opacity:.3;cursor:default}
.diary-nav-indicator{text-align:center;font-size:var(--ub-ui-font-10-5,10.5px);color:var(--ios-label-2);margin-top:8px}
.diary-content{padding:6px 0}
.diary-content .dc{color:var(--ios-label-2);font-size:var(--ub-ui-font-12-5,12.5px);line-height:1.9}

/* 日记本（玻璃卡片替代纸质纹理） */
.diary-notebook{
  position:relative;padding:18px 20px;margin:10px 0;
  background:var(--card);border:1px solid var(--ios-sep);
  border-radius:var(--ios-radius-cell);box-shadow:none;
}
.diary-notebook::before,.diary-notebook::after,.diary-notebook-lines{display:none}
.diary-notebook .diary-content .dc{color:var(--ios-label);line-height:1.9}
.diary-notebook .diary-content .dc .strikethrough{text-decoration:line-through;text-decoration-thickness:.1em;text-decoration-color:var(--ios-label-3);opacity:.6}
.diary-notebook .diary-content .dc .highlight{background:rgba(255,204,0,.32);padding:1px 5px;border-radius:5px}
.diary-notebook .diary-content .dc .underline{text-decoration:underline;text-decoration-style:wavy;text-underline-offset:4px;text-decoration-color:var(--ios-accent)}
.diary-notebook .diary-content .dc .emphasis{display:inline-block;border:1.5px solid var(--ios-accent);border-radius:9px;padding:0 5px;color:var(--ios-accent);font-weight:600;transform:rotate(-.4deg)}
.diary-notebook .diary-content .dc .handwritten,.diary-notebook .diary-content .dc .messy{color:var(--ios-label);letter-spacing:.2px}
.diary-notebook .diary-content .dc .censored{position:relative;color:var(--ios-label-3);padding:0 4px;border-radius:5px;cursor:pointer;transition:all .3s;background-color:var(--ios-fill)}
.diary-notebook .diary-content .dc .censored:hover{background-color:transparent;color:inherit}
.diary-detail-popup{max-width:520px !important}

/* —— 调教值 / 点击特效 —— */
.train-bar-wrap{display:flex;align-items:center;gap:8px;width:100%}
.train-bar{flex:1;height:6px;background:var(--ios-fill-2);border-radius:3px;overflow:hidden}
.train-fill{height:100%;background:var(--ios-accent);border-radius:3px;transition:width .5s var(--ios-ease-out)}
.train-value{font:600 10.5px/1 var(--ios-font);color:var(--ios-label-2);min-width:48px;text-align:right;flex-shrink:0}
.click-heart{position:fixed;pointer-events:none;z-index:9999;font-size:14px;color:var(--ios-accent);opacity:.7;animation:heart-rise 1.4s ease-out forwards}
.click-text{position:fixed;pointer-events:none;z-index:9999;font-size:11px;color:var(--ios-label-2);white-space:nowrap;animation:text-drift 1.8s ease-out forwards;opacity:.75;font-family:var(--ios-font)}
@keyframes heart-rise{0%{opacity:.7;transform:translateY(0) scale(.5)}30%{opacity:.7;transform:translateY(-20px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.3)}}
@keyframes text-drift{0%{opacity:0;transform:translateY(0) scale(.8)}15%{opacity:.75;transform:translateY(-10px) scale(1)}100%{opacity:0;transform:translateY(-50px) translateX(var(--drift-x,20px)) scale(.6)}}

/* ═══ ⑥ 通用控件 ═══ */
.btn-line{
  background:var(--ios-fill);color:var(--ios-label);border:none;
  padding:8px 14px;min-height:32px;font:600 12px/1.2 var(--ios-font);
  border-radius:var(--ios-radius-btn);cursor:pointer;letter-spacing:0;
  transition:transform .15s var(--ios-ease-spring),background .15s var(--ios-ease-out),filter .15s;
}
.btn-line:hover:not(:disabled){background:var(--ios-fill-2)}
.btn-line:active:not(:disabled){transform:scale(.94)}
.btn-line:disabled{color:var(--ios-label-3);cursor:not-allowed;opacity:.6}
.empty-state{padding:36px 0;text-align:center;font-size:var(--ub-ui-font-12,12px);color:var(--ios-label-3);border:1.5px dashed var(--ios-sep-strong);border-radius:var(--ios-radius-cell)}
.scene-btn{
  background:var(--ios-fill);color:var(--ios-label);border:none;
  padding:6px 12px;min-height:30px;font:600 11.5px/1 var(--ios-font);
  border-radius:999px;cursor:pointer;flex-shrink:0;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.scene-btn:hover{background:var(--ios-fill-2)}
.scene-btn:active{transform:scale(.93)}
.scene-btn:disabled{opacity:.5;cursor:not-allowed}
.scene-btn.scene-active-daily{background:var(--ios-tint);color:var(--ios-accent)}
.scene-btn.scene-active-nsfw{background:var(--ios-accent);color:var(--ios-on-accent)}
.investigate-btn{
  font:600 11px/1 var(--ios-font);cursor:pointer;padding:6px 12px;min-height:28px;
  border:none;background:var(--ios-fill);color:var(--ios-accent);
  border-radius:999px;transition:transform .15s var(--ios-ease-spring),background .15s;white-space:nowrap;flex-shrink:0;
}
.investigate-btn:hover{background:var(--ios-tint)}
.investigate-btn:active{transform:scale(.93)}
.energy-badge{font:600 10.5px/1 var(--ios-font);color:var(--ios-label-2);padding:4px 10px;background:var(--ios-fill);border-radius:999px}
.item-use-toggle{
  background:var(--ios-fill);color:var(--ios-label);border:none;
  padding:6px 12px;min-height:30px;font:600 11.5px/1 var(--ios-font);
  border-radius:999px;cursor:pointer;transition:transform .15s var(--ios-ease-spring),background .15s;
}
.item-use-toggle:hover{background:var(--ios-fill-2)}
.item-use-toggle:active{transform:scale(.93)}
.item-use-toggle.active{background:var(--ios-green);color:#fff}
.nsfw-guidance-btn{
  background:var(--ios-accent);color:var(--ios-on-accent);border:none;
  padding:6px 12px;min-height:30px;font:600 11.5px/1 var(--ios-font);
  border-radius:999px;cursor:pointer;white-space:nowrap;
  transition:transform .15s var(--ios-ease-spring),filter .15s;
}
.nsfw-guidance-btn:hover{filter:brightness(1.08)}
.nsfw-guidance-btn:active{transform:scale(.93)}
.nsfw-guidance-btn:disabled{opacity:.5;cursor:wait}
.play-select{
  flex:1;width:100%;max-width:200px;min-height:30px;box-sizing:border-box;
  background:var(--ios-fill);color:var(--ios-label) !important;border:none !important;
  padding:5px 26px 5px 10px;font:500 11.5px/1.3 var(--ios-font);outline:none;cursor:pointer;
  border-radius:9px !important;appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 8px center;
  transition:background-color .15s;
}
.play-select:hover{background-color:var(--ios-fill-2)}
.play-select option{background:var(--ios-surface-solid) !important;color:var(--ios-label) !important}
.play-collapse-btn{
  background:var(--ios-fill);border:none;color:var(--ios-label-2);
  width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;
  cursor:pointer;font:600 13px/1 var(--ios-font);border-radius:9px;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.play-collapse-btn:hover{background:var(--ios-fill-2);color:var(--ios-label)}
.play-collapse-btn:active{transform:scale(.88)}
.wardrobe-protagonist-summary{
  display:inline-flex;align-items:center;gap:8px;max-width:100%;margin-top:6px;
  padding:5px 12px;border:none;border-radius:999px;
  background:var(--ios-fill);color:var(--ios-label);
  font:500 11px/1.35 var(--ios-font);cursor:pointer;text-align:left;overflow:hidden;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--ios-label-2);font-size:10px;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ios-label)}
.wardrobe-protagonist-summary:hover{background:var(--ios-fill-2)}
.wardrobe-protagonist-summary:active{transform:scale(.97)}

/* —— 提示（iOS 菜单气泡风） —— */
.char-tooltip{
  position:fixed;z-index:10000;max-width:250px;padding:10px 13px;
  border-radius:12px;border:1px solid var(--ios-sep);
  background:var(--ios-surface-solid);color:var(--ios-label);
  -webkit-backdrop-filter:var(--ios-blur);backdrop-filter:var(--ios-blur);
  box-shadow:var(--ios-shadow);font:400 12px/1.6 var(--ios-font);
  pointer-events:none;opacity:0;transition:opacity .18s var(--ios-ease-out);
}
.char-tooltip.visible{opacity:1}
.char-tooltip-age{color:var(--ios-label-2);font-size:11px;margin-bottom:2px}
.char-tooltip-intro{color:var(--ios-label);font-size:12px}
.help-tip-btn{
  position:relative;display:inline-flex;align-items:center;justify-content:center;
  width:17px;height:17px;border-radius:50%;border:none;
  background:var(--ios-fill);color:var(--ios-label-2);
  font:700 10px/1 var(--ios-font);cursor:help;flex-shrink:0;
  transition:background .15s,transform .15s var(--ios-ease-spring);
}
.help-tip-btn:hover{background:var(--ios-tint);color:var(--ios-accent)}
.help-tip-btn:active{transform:scale(.88)}
.help-tooltip-global{
  position:fixed;z-index:100000;max-width:280px;padding:11px 14px;
  border-radius:12px;border:1px solid var(--ios-sep);
  background:var(--ios-surface-solid);color:var(--ios-label);
  -webkit-backdrop-filter:var(--ios-blur);backdrop-filter:var(--ios-blur);
  box-shadow:var(--ios-shadow);font:400 11.5px/1.7 var(--ios-font);
  white-space:pre-line;pointer-events:none;
}

/* ═══ ⑦ 过往经历时间轴 pe-* ═══ */
.pe-intro{border:none;border-radius:var(--ios-radius-cell);padding:12px 14px;background:var(--ios-fill)}
.pe-intro-label{color:var(--ios-label-2);font-weight:600;font-size:var(--ub-ui-font-10,10px);line-height:1;font-family:var(--ios-font);letter-spacing:.8px;text-transform:uppercase}
.pe-intro-text{color:var(--ios-label);margin-top:6px}
.pe-rail::before{background:var(--ios-sep-strong)}
.pe-dot{background:var(--ios-surface-solid);border:2px solid var(--ios-accent);width:10px;height:10px;top:5px;box-shadow:0 0 0 3px var(--ios-tint)}
.pe-date{color:var(--ios-label-2);font-weight:600;font-size:var(--ub-ui-font-11,11px);line-height:1;font-family:var(--ios-font);letter-spacing:.3px}
.pe-card{
  color:var(--ios-label);background:var(--card);
  border:1px solid var(--ios-sep);border-radius:var(--ios-radius-cell);
  padding:11px 13px;box-shadow:none;
}

/* ═══ ⑧ 角色中枢 / 剧情回顾（hub token + iOS 结构修饰） ═══ */
/* 字体经 .panel-overlay 基座继承（契约：主题类不覆盖弹窗排版） */
.char-hub-theme-ios .char-hub-card,.chronicle-reader-theme-ios .chronicle-reader-card{border-radius:var(--ios-radius-cell)}
.char-hub-theme-ios .char-hub-card:hover{transform:scale(1.01)}
.char-hub-theme-ios .char-hub-search,.chronicle-reader-theme-ios .chronicle-search,
.char-hub-theme-ios .char-hub-filter button,.char-hub-theme-ios .char-hub-tabs button,
.char-hub-theme-ios .char-hub-back,.char-hub-theme-ios .char-hub-nsfw,.char-hub-theme-ios .char-hub-past-btn,
.chronicle-reader-theme-ios .chronicle-reader-tools button,.chronicle-reader-theme-ios .chronicle-reader-detail button,.chronicle-reader-theme-ios .chronicle-reader-sentinel,
.char-hub-theme-ios .char-hub-related-link{border-radius:10px;border-color:var(--ios-sep);transition:transform .15s var(--ios-ease-spring),background .15s}
.char-hub-theme-ios .char-hub-filter button:active,.char-hub-theme-ios .char-hub-tabs button:active,.char-hub-theme-ios .char-hub-back:active{transform:scale(.95)}
.char-hub-theme-ios .char-hub-filter button.active,.char-hub-theme-ios .char-hub-tabs button.active{background:var(--ios-tint)}
.char-hub-theme-ios .char-hub-identity,
.char-hub-theme-ios .char-hub-section,
.char-hub-theme-ios .char-hub-trait,
.char-hub-theme-ios .char-hub-logic,
.char-hub-theme-ios .char-hub-intimacy-slip,
.char-hub-theme-ios .char-hub-prose-card,
.char-hub-theme-ios .char-hub-trait-column,
.char-hub-theme-ios .char-hub-relation-card,
.char-hub-theme-ios .char-hub-history-background,
.char-hub-theme-ios .char-hub-history-latest,
.char-hub-theme-ios .char-hub-mood-note,
.char-hub-theme-ios .char-hub-not-equal,
.char-hub-theme-ios .char-hub-vitals-strip,
.char-hub-theme-ios .char-hub-vitals-raw,
.char-hub-theme-ios .char-hub-nsfw-card,
.char-hub-theme-ios .char-hub-dual-stat,
.char-hub-theme-ios .char-hub-lead-detail .char-hub-identity--lead,
.char-hub-theme-ios .char-hub-relationship-map,
.char-hub-theme-ios .char-hub-caution,
.chronicle-reader-theme-ios .chronicle-reader-card,
.chronicle-reader-theme-ios .chronicle-timeline-content,
.chronicle-reader-theme-ios .chronicle-detail-text,
.chronicle-reader-theme-ios .chronicle-detail-dialogue{
  border-radius:var(--ios-radius-cell);
}
.char-hub-theme-ios .char-hub-profile-lede{border-radius:0 12px 12px 0}
.char-hub-theme-ios .char-hub-trait-balance{overflow:hidden}
.char-hub-theme-ios .char-hub-intimacy-slip.is-ongoing{border-color:var(--ios-accent)}
.char-hub-theme-ios .char-hub-action{border-radius:999px}
.char-hub-theme-ios .char-hub-action--investigate{color:var(--ios-accent)}
.char-hub-theme-ios .char-hub-action--interview{color:var(--ios-green)}
.char-hub-theme-ios .char-hub-gsym.is-female{color:#ff2d55}
.char-hub-theme-ios .char-hub-gsym.is-male{color:#0a84ff}
.char-hub-theme-ios .char-hub-lead-banner,.chronicle-reader-theme-ios .char-hub-lead-banner{border-radius:12px}
.char-hub-theme-ios .char-hub-worldbook,.char-hub-theme-ios .char-hub-history-door{border-radius:12px}
.char-hub-theme-ios .char-hub-ms-item,.char-hub-theme-ios .char-hub-ms-hero,.char-hub-theme-ios .char-hub-ms-node,
.char-hub-theme-ios .char-hub-ms-item.is-latest,.char-hub-theme-ios .char-hub-ms-date,.char-hub-theme-ios .char-hub-ms-desc,
.chronicle-reader-theme-ios .chronicle-timeline-node,.chronicle-reader-theme-ios .chronicle-timeline-content,
.chronicle-reader-theme-ios .chronicle-dialogue-line,.chronicle-reader-theme-ios .chronicle-dialogue-speaker,
.chronicle-reader-theme-ios .chronicle-timeline-dialogue{border-radius:10px}
.char-hub-theme-ios .char-hub-ms-item.is-latest .char-hub-ms-node{color:var(--ios-accent);font-weight:700}
/* 深色：里程碑节点回落 muted、最新项仍走 accent（随 overlay token 翻转） */
.panel-overlay.dark .char-hub-theme-ios .char-hub-ms-node{color:var(--hub-muted)}
.panel-overlay.dark .char-hub-theme-ios .char-hub-ms-item.is-latest .char-hub-ms-node{color:var(--hub-accent)}
.char-hub-theme-ios .char-hub-speech,.char-hub-theme-ios .char-hub-dual-stat{border-radius:12px;overflow:hidden}
.char-hub-theme-ios .char-hub-stat-fill,.char-hub-theme-ios .char-hub-stat-bar{border-radius:3px}
.char-hub-theme-ios .char-hub-not-equal,.char-hub-theme-ios .char-hub-not-equal-label{overflow:hidden}
.char-hub-theme-ios .char-hub-vitals-num{color:var(--ios-accent);font-variant-numeric:tabular-nums}

/* —— 编年史页 / 里程碑列表 / 中枢横幅：iOS inset 卡片结构（此前纯 base 平铺=裸文字堆叠） ——
   注：iosCoreCSS 先于 baseCSS 拼接，本组全部用双类选择器（0,2,0）压 base 单类（0,1,0）。 */
.char-hub-theme-ios .char-hub-card{box-shadow:var(--ios-shadow-soft)}
.char-hub-theme-ios .char-hub-back-row .char-hub-back{
  border:none;background:var(--ios-fill);color:var(--ios-label);
  border-radius:999px;padding:6px 14px;font-weight:600;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.char-hub-theme-ios .char-hub-back-row .char-hub-back:hover{background:var(--ios-fill-2)}
.char-hub-theme-ios .char-hub-back-row .char-hub-back:active{transform:scale(.95)}
.char-hub-theme-ios .char-hub-lead-banner{
  background:var(--card);border-color:var(--ios-sep);border-radius:12px;padding:11px 14px;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.char-hub-theme-ios .char-hub-lead-banner:hover{background:var(--ios-fill)}
.char-hub-theme-ios .char-hub-lead-banner:active{transform:scale(.98)}
.char-hub-theme-ios .char-hub-cr-banner .char-hub-lead-name{color:var(--ios-accent)}
/* 统计 hero：玻璃统计卡（大数字 + hairline 分隔 + 明细行） */
.char-hub-theme-ios .char-hub-ms-hero{
  align-items:center;gap:0;margin:0 0 4px;padding:13px 16px;
  background:var(--card);border:1px solid var(--ios-sep);
  border-radius:var(--ios-radius-card);box-shadow:var(--ios-shadow-soft);
}
.char-hub-theme-ios .char-hub-ms-hero b{font-size:28px;font-variant-numeric:tabular-nums;padding-right:14px;margin-right:14px;border-right:1px solid var(--ios-sep)}
/* 角色筛选 chips：iOS 反色激活胶囊（同 .ios-persona-chip 语言；hover 浅深双态显式写） */
.char-hub-theme-ios .char-hub-cr-chip{
  border:none;border-radius:999px;padding:5px 13px;
  background:var(--ios-fill-2);color:var(--ios-label);
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.char-hub-theme-ios .char-hub-cr-chip:hover{background:rgba(120,120,128,.24)}
#ac-content.dark .char-hub-theme-ios .char-hub-cr-chip:hover,.dark-mode .char-hub-theme-ios .char-hub-cr-chip:hover,.panel-overlay.dark .char-hub-theme-ios .char-hub-cr-chip:hover{background:rgba(120,120,128,.44)}
.char-hub-theme-ios .char-hub-cr-chip:active{transform:scale(.93)}
.char-hub-theme-ios .char-hub-cr-chip.active{background:var(--ios-label);color:var(--ios-canvas);border-color:transparent}
/* 编年史按日成卡：日期节点=accent 圆徽，事件列表在卡内 */
.char-hub-theme-ios .char-hub-ms-list.char-hub-cr-list{gap:8px}
.char-hub-theme-ios .char-hub-cr-day{
  background:var(--card);border:1px solid var(--ios-sep);
  border-radius:var(--ios-radius-cell);padding:12px 13px;
}
.char-hub-theme-ios .char-hub-ms-node{
  border:none;border-radius:999px;background:var(--ios-tint);color:var(--ios-accent);font-weight:700;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.char-hub-theme-ios .char-hub-ms-node:hover{background:rgba(0,122,255,.18)}
#ac-content.dark .char-hub-theme-ios .char-hub-ms-node:hover,.dark-mode .char-hub-theme-ios .char-hub-ms-node:hover,.panel-overlay.dark .char-hub-theme-ios .char-hub-ms-node:hover{background:rgba(10,132,255,.30)}
.char-hub-theme-ios .char-hub-ms-node:active{transform:scale(.92)}
.char-hub-theme-ios .char-hub-ms-date{padding-top:3px}
.char-hub-theme-ios .char-hub-ms-hint{text-align:center;color:var(--ios-label-3);margin-top:12px}
.char-hub-theme-ios .char-hub-cr-undated{
  margin-top:12px;border-top:none;
  background:var(--ios-fill);border-radius:var(--ios-radius-cell);padding:11px 13px;
}
.char-hub-theme-ios .char-hub-cr-undated p{color:var(--ios-label-2)}
/* 角色详情页里程碑列表：同族 inset 卡片，最新一条 accent 描边 + 实底节点 */
.char-hub-theme-ios .char-hub-ms-list:not(.char-hub-cr-list){gap:8px}
.char-hub-theme-ios .char-hub-ms-item{background:var(--card);border:1px solid var(--ios-sep);border-radius:12px;padding:10px 12px}
.char-hub-theme-ios .char-hub-ms-item.is-latest{border-color:color-mix(in srgb,var(--ios-accent) 50%,transparent)}
.char-hub-theme-ios .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--ios-accent);color:var(--ios-on-accent)}
/* 深色伴随：上方旧深色规则（0,5,0）会把节点字色顶回 accent，与实底节点混色，须同特异性后置覆盖 */
.panel-overlay.dark .char-hub-theme-ios .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--ios-accent);color:var(--ios-on-accent)}
/* 剧情回顾弹窗：卡片抬升阴影 + 时间轴节点光晕 + 说话人胶囊 */
.chronicle-reader-theme-ios .chronicle-reader-card{background:var(--card);box-shadow:var(--ios-shadow-soft)}
.chronicle-reader-theme-ios .chronicle-timeline-node{box-shadow:0 0 0 1px var(--ios-accent),0 0 0 5px var(--ios-tint)}
.chronicle-reader-theme-ios .chronicle-timeline-time b{color:var(--ios-accent)}
.chronicle-reader-theme-ios .chronicle-dialogue-speaker{border-radius:999px;border-color:transparent;background:var(--ios-fill);color:var(--ios-accent)}
.chronicle-reader-theme-ios .chronicle-dialogue-speaker.is-unknown{color:var(--ios-label-2)}
.chronicle-reader-theme-ios .chronicle-timeline-dialogue{border-radius:10px}
.chronicle-reader-theme-ios .chronicle-detail-text,.chronicle-reader-theme-ios .chronicle-detail-dialogue{box-shadow:var(--ios-shadow-soft)}
/* 深色：中枢随 overlay token 翻转（--hub-* 引用 --ios-*，无额外工作） */

/* ═══ ⑨ 大调查壳：顶栏与历史侧栏 ═══ */
.iv-top-bar-ios{
  background:var(--ios-surface-solid);
  border-bottom:1px solid var(--ios-sep);color:var(--ios-label);
}
.iv-top-bar-ios .iv-top-btn{
  border:none;border-radius:999px;background:var(--ios-fill);color:var(--ios-label);
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.iv-top-bar-ios .iv-top-btn:hover{background:var(--ios-fill-2)}
.iv-top-bar-ios .iv-top-btn:active{transform:scale(.93)}
.iv-top-bar-ios .iv-top-btn:disabled{opacity:.4}
.iv-top-bar-ios .iv-top-close{border:none;border-radius:999px;background:var(--ios-fill)}
.iv-top-bar-ios .iv-top-close:hover{background:rgba(255,59,48,.14);color:var(--ios-danger)}
.iv-hist-ios{background:var(--ios-canvas);border-right:1px solid var(--ios-sep)}
.iv-hist-ios .iv-hist-topbar{border-bottom-color:var(--ios-sep)}
.iv-hist-ios .iv-hist-title{color:var(--ios-label-2);letter-spacing:.3px}
.iv-hist-ios .iv-hist-item{color:var(--ios-label);border-radius:0}
.iv-hist-ios .iv-hist-item:hover{background:var(--ios-fill)}
.iv-hist-ios .iv-hist-item.active{background:var(--ios-tint);color:var(--ios-accent);font-weight:600}
.iv-hist-ios .iv-hist-item.active .iv-hist-time{color:var(--ios-accent)}
.iv-hist-ios .iv-hist-time{color:var(--ios-label-2)}
.iv-hist-ios .iv-hist-del:hover{color:var(--ios-danger) !important}
.panel-overlay.dark .iv-top-bar-ios,.panel-overlay.dark .iv-hist-ios{background:var(--ios-surface-solid)}

/* ═══ ⑩ 系统决策弹窗（ub-decision token 桥接 + 玻璃质感） ═══ */
.ub-decision-theme-ios{
  background:var(--ios-surface-solid);color:var(--ios-label);
  border:1px solid var(--ios-sep);border-radius:20px;
  font-family:var(--ios-font);box-shadow:var(--ios-shadow);
}
.ub-decision-theme-ios .ub-decision-title{letter-spacing:-.2px}
.ub-decision-theme-ios .ub-decision-head{border-bottom-color:var(--ios-sep)}
.ub-decision-theme-ios .ub-decision-close:hover{background:var(--ios-fill)}
.ub-decision-theme-ios .ww-decision-row{border-bottom-color:var(--ios-sep)}
.ub-decision-theme-ios .ww-decision-tag{background:var(--ios-fill);color:var(--ios-label-2);border-radius:999px}
.ub-decision-theme-ios .ww-decision-btn{
  border:none;border-radius:999px;background:var(--ios-fill);color:var(--ios-accent);
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.ub-decision-theme-ios .ww-decision-btn:hover{background:var(--ios-tint)}
.ub-decision-theme-ios .ww-decision-btn:active{transform:scale(.93)}
.ub-decision-theme-ios .ww-decision-fill,.ub-decision-theme-ios .ww-decision-ack{
  background:var(--ios-accent);color:var(--ios-on-accent);border-color:var(--ios-accent);
}
.ub-decision-theme-ios .ww-decision-fill:hover,.ub-decision-theme-ios .ww-decision-ack:hover{filter:brightness(1.1)}
.ub-decision-theme-ios .map-location-candidate{border-color:var(--ios-sep);border-radius:12px;background:var(--ios-surface-solid)}
.ub-decision-theme-ios .map-location-candidate:hover{border-color:var(--ios-accent);background:var(--ios-tint)}
.ub-decision-theme-ios .map-location-actions button{border:none;border-radius:10px;background:var(--ios-fill);color:var(--ios-label)}
.ub-decision-theme-ios .map-location-actions button:hover{background:var(--ios-fill-2)}
.ub-decision-theme-ios .cycle-form-btn{
  border:none;border-radius:999px;background:var(--ios-fill);color:var(--ios-label);
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.ub-decision-theme-ios .cycle-form-btn:hover{background:var(--ios-fill-2)}
.ub-decision-theme-ios .cycle-form-btn:active{transform:scale(.94)}
.ub-decision-theme-ios .cycle-form-btn.cycle-form-single{background:var(--ios-accent);color:var(--ios-on-accent)}
.ub-decision-theme-ios .cycle-form-btn.cycle-form-single:hover{filter:brightness(1.1)}
.ub-decision-theme-ios .ub-decision-error{background:rgba(255,59,48,.1);color:var(--ios-danger)}

/* ═══ ⑪ 徽章与高亮 ═══ */
.ub-badge-ios{
  background:var(--ios-danger);color:#fff;border:none;border-radius:999px;
  font:700 9px/1 var(--ios-font);box-shadow:0 2px 6px rgba(255,59,48,.4);
}
.ub-hl-ios{--ub-hl-color:rgba(0,122,255,.22);border-radius:12px}
.ub-hl-ios::after{background:rgba(0,122,255,.05)}
.dark .ub-hl-ios,.dark-mode .ub-hl-ios{--ub-hl-color:rgba(10,132,255,.35)}
.dark .ub-hl-ios::after,.dark-mode .ub-hl-ios::after{background:rgba(10,132,255,.1)}

/* ═══ ⑫ 折叠态（共享规则，与各主题一致） ═══ */
#ac-statusbar-wrapper.ub-collapsed{display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:hidden!important}

/* ═══ ⑬ 移动端 ═══ */
@media(max-width:576px){
  .ios-card{padding:13px;border-radius:16px}
  .ios-hero{padding:14px 14px 12px}
  .ios-hero-name{font-size:19px}
  /* 移动端 hero 上下堆叠：控件放下方整行，主角近况占满卡片宽度（右侧 44% 挤压会让
     状态只余半卡宽、每行容不下几个字，长文本观感差） */
  .ios-hero-top{flex-direction:column;align-items:stretch}
  .ios-hero-controls{width:100%;max-width:none;justify-content:flex-start}
  /* 快捷 pill 整行横滚（保持原独立卡片行为；padding 护徽章 top:-7/right:-8 不被裁） */
  .ios-hero-actions{width:100%;margin-left:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:9px 12px 3px}
  .ios-hero-actions::-webkit-scrollbar{display:none}
  .ios-play-grid{grid-template-columns:1fr}
  .ios-row .k{min-width:56px}
  .ios-profile-head{flex-wrap:wrap}
}
`;

export const iosCSS = iosCoreCSS + baseCSS + /* css */ `
/* ═══ 后置覆盖段（需赢过 baseCSS 的 iOS 定制） ═══ */

/* 选项栏：iOS 分组 cell */
.options-bar{border-top:none;margin-top:12px;padding-top:0}
.options-bar-title{letter-spacing:.3px;text-transform:none;font-size:12px;opacity:.9}
.options-bar-title::before{display:none}
.option-item{
  border:none;border-left:none;border-radius:12px;
  background:var(--ios-surface-solid);box-shadow:0 0 0 1px var(--ios-sep);
  margin-bottom:6px;padding:9px 12px;
  transition:transform .15s var(--ios-ease-spring),background .15s;
}
.option-item:hover{background:var(--ios-fill);border-color:transparent}
.option-item:active{transform:scale(.975)}
.option-number{border-right:none;background:var(--ios-tint);color:var(--ios-accent);border-radius:999px}
.dark .option-item,.dark-mode .option-item{background:var(--ios-surface-solid);border-color:transparent;box-shadow:0 0 0 1px var(--ios-sep);color:var(--ios-label)}
.dark .option-item:hover,.dark-mode .option-item:hover{background:var(--ios-fill);border-color:transparent}

/* 数据库查看器 / 确认框 / 迁移提示：圆角与字体统一 */
.db-viewer-popup,.db-row-detail-popup,.db-confirm-popup,.db-card,.db-tab,.db-search,.db-sort-select,.db-sort-dir,.db-add-btn,.db-edit-btn,.cm-am-btn{border-radius:10px;font-family:var(--ios-font)}
.db-card{border-radius:14px}
.db-tab{border-radius:999px}
.ub-confirm-dialog{border-radius:18px;font-family:var(--ios-font);box-shadow:var(--ios-shadow)}
.ub-confirm-btn{border-radius:999px}
.ub-confirm-btn-ok{border-radius:999px}
.ub-storage-action{border-radius:10px}
.ub-batch-bar .ub-batch-action{border-radius:999px}

/* 功能弹窗：统一玻璃圆角与字体（map/calendar/skill/ach/wardrobe/world-window/shop 家族） */
.map-popup,.calendar-popup,.skill-tree-popup,.ach-popup,.wardrobe-window,.world-window,.iv-wb-overlay,.interview-popup,.newspaper-popup{font-family:var(--ios-font)}
.ub-decision-dialog{border-radius:20px;font-family:var(--ios-font)}
.ub-nsfw-extra-dialog{border-radius:20px;font-family:var(--ios-font);box-shadow:var(--ios-shadow)}
.ub-nsfw-extra-preset-btn,.ub-nsfw-extra-btn{border-radius:999px}
.ub-nsfw-extra-btn-primary{border-radius:999px}

/* 大调查弹窗壳补底（base 骨架无背景，防圆角缝隙透出遮罩） */
.investigation-popup{background:var(--ios-canvas)}

/* 弹窗防泄漏盾补充：iOS 下拉/输入统一填充底 */
:is(.settings-overlay,.nsfw-overlay,.panel-overlay) :is(input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=color]),select,textarea){
  border-radius:9px;
}

/* 模型下拉浮层圆角 */
.ub-model-popover{border-radius:12px;box-shadow:var(--ios-shadow)}

/* 玩法示意图弹窗 */
.play-img-arrow{border-radius:999px;border:none;background:var(--ios-fill);color:var(--ios-label)}

/* 动效收敛：overlay 家族的 reduce-motion 与跟随底部 */
@media(prefers-reduced-motion:reduce){
  .panel-overlay *,.settings-overlay *,.nsfw-overlay *,.ub-decision-overlay *{
    animation:none!important;transition:none!important;
  }
  .panel-overlay,.settings-overlay,.nsfw-overlay{animation:none!important}
}
#ac-statusbar-wrapper.ub-anim-off *,
#ac-statusbar-wrapper.ub-anim-off *::before,
#ac-statusbar-wrapper.ub-anim-off *::after{animation:none!important}
`;
