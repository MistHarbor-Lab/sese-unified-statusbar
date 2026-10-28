/**
 * 深空舰桥 / Deep-Space Bridge
 *
 * 晨雾舰桥（浅色）与深空舰桥（深色）共用一套仪表语义。业务组件只消费
 * 变量和 bridge-* 结构类，不在共享 baseCSS 中泄漏主题色。
 */
import { baseCSS } from './base';

const bridgeCoreCSS = /* css */ `
#ac-statusbar-wrapper,
:where(#ac-statusbar-wrapper *){margin:0;padding:0;box-sizing:border-box}

:root{
  /* U38③：全局语义色补齐（与 ancient 同族；深色组内字面量重定义） */
  --ub-success:#3F6A52;--ub-warning:#8A5B14;--ub-danger:#A13B34;
  --bridge-bg:#e7eff0;
  --bridge-panel:#f7fbfb;
  --bridge-panel-2:#dbe8e9;
  --bridge-panel-3:#c8dcde;
  --bridge-panel-alt:#edf5f5;
  --bridge-panel-inset:#cedfe1;
  --bridge-line:#779ca2;
  --bridge-line-strong:#3d6f76;
  --bridge-line-soft:rgba(65,112,120,.22);
  --bridge-signal:#087f85;
  --bridge-signal-contrast:#f7fbfb;
  --bridge-signal-soft:rgba(8,127,133,.12);
  --bridge-alert:#a65c00;
  --bridge-warn:var(--bridge-alert);
  --bridge-alert-soft:rgba(166,92,0,.12);
  --bridge-danger:#a9323f;
  --bridge-danger-soft:rgba(169,50,63,.12);
  --bridge-text:#14353b;
  --bridge-muted:#55747a;
  --bridge-text-muted:var(--bridge-muted);
  --bridge-shadow:rgba(27,64,70,.18);
  --bridge-shadow-soft:rgba(27,64,70,.1);
  --bridge-grid:rgba(61,111,118,.08);
  --bridge-glass:rgba(247,251,251,.92);
  --bridge-screen:#17363c;
  --bridge-screen-text:#bcebea;
  --bridge-screen-muted:#78a7a8;
  --bridge-font-ui:"IBM Plex Sans","DIN Alternate","Noto Sans SC","Microsoft YaHei UI",system-ui,sans-serif;
  --bridge-font-data:"IBM Plex Mono","Consolas","SFMono-Regular",monospace;
  --bg-color:var(--bridge-bg);
  --text-color:var(--bridge-text);
  --text:var(--bridge-text);
  --text-sub:var(--bridge-text);
  --text-muted:var(--bridge-muted);
  --text-soft:var(--bridge-muted);
  --border-color:var(--bridge-line);
  --secondary-text:var(--bridge-muted);
  --divider:var(--bridge-line);
  --divider-light:var(--bridge-line-soft);
  --card:var(--bridge-panel);
  --card-light:var(--bridge-panel-alt);
  --card-deep:var(--bridge-panel-3);
  --card-bg:var(--bridge-panel);
  --card-border:var(--bridge-line);
  --accent:var(--bridge-signal);
  --accent-deep:var(--bridge-signal);
  --accent-soft:var(--bridge-signal-soft);
  --accent-bg:var(--bridge-signal-soft);
  --accent-bg-faint:var(--bridge-signal-soft);
  --accent-bg-hover:var(--bridge-signal-soft);
  --danger:var(--bridge-danger);
  --bg-alt:var(--bridge-panel-2);
  --ub-overlay-bg:rgba(7,17,22,.38);
  --ub-scrollbar-thumb:var(--bridge-line);
  --ub-scrollbar-thumb-hover:var(--bridge-signal);
  --ub-text-muted:var(--bridge-muted);
  --ub-bg-card:var(--bridge-panel);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接（舰桥那条还要求 .calendar-popup 祖先）→ 主题级补一份 */
  --ub-text:var(--bridge-text,#16222c);--ub-divider:var(--bridge-line,#91a5ad);--ub-accent:var(--bridge-signal,#0a7189);--ub-hover-bg:var(--bridge-panel-alt,#dde8eb);
  --ub-popup-radius:0px;
  --ub-popup-shadow:0 18px 48px var(--bridge-shadow);
  --ub-popup-border:1px solid var(--bridge-line);
  --ub-popup-bg:var(--bridge-panel);
  --ub-popup-head-bg:var(--bridge-panel-2);
  --ub-popup-head-border:1px solid var(--bridge-line);
  --ub-btn-radius:0px;
  --ub-toggle-width:44px;
  --ub-toggle-height:24px;
  --ub-toggle-knob:18px;
  --ub-ft-ring-start:var(--bridge-signal);
  --ub-ft-ring-end:var(--bridge-alert);
  --ub-ft-ring-glow:rgba(8,127,133,.26);
  --portrait-bg:var(--bridge-panel-2);
  --portrait-empty-color:var(--bridge-muted);
  --portrait-border:var(--bridge-line);
  --portrait-radius:0px;
}

.statusbar-wrapper.style-bridge,
.bridge-container{
  color-scheme:light;
}

.statusbar-wrapper.style-bridge.dark,
#ac-content.dark .bridge-container,
.bridge-container.dark-mode,
body.dark-mode,
.panel-overlay.dark,
.settings-overlay.dark,
.nsfw-overlay.dark,
.ub-decision-overlay.dark,
#ubDbRepairOverlay.dark{
  /* U38③：语义色深色档（字面量重定义） */
  --ub-success:#77B18C;--ub-warning:#D7AC5C;--ub-danger:#E4776D;
  --bridge-bg:#071116;
  --bridge-panel:#0d2026;
  --bridge-panel-2:#102b31;
  --bridge-panel-3:#16363d;
  --bridge-panel-alt:#0a1a20;
  --bridge-panel-inset:#071419;
  --bridge-line:#27515b;
  --bridge-line-strong:#4d8791;
  --bridge-line-soft:rgba(119,229,224,.13);
  --bridge-signal:#77e5e0;
  --bridge-signal-contrast:#071116;
  --bridge-signal-soft:rgba(119,229,224,.12);
  --bridge-alert:#ffbd5a;
  --bridge-warn:var(--bridge-alert);
  --bridge-alert-soft:rgba(255,189,90,.12);
  --bridge-danger:#ff6f77;
  --bridge-danger-soft:rgba(255,111,119,.13);
  --bridge-text:#d8edef;
  --bridge-muted:#7da0a5;
  --bridge-text-muted:var(--bridge-muted);
  --bridge-shadow:rgba(0,0,0,.48);
  --bridge-shadow-soft:rgba(0,0,0,.24);
  --bridge-grid:rgba(119,229,224,.055);
  --bridge-glass:rgba(13,32,38,.94);
  --bridge-screen:#031015;
  --bridge-screen-text:#9af4ef;
  --bridge-screen-muted:#508f93;
  --bg-color:var(--bridge-bg);
  --text-color:var(--bridge-text);
  --border-color:var(--bridge-line);
  --secondary-text:var(--bridge-muted);
  --divider:var(--bridge-line);
  --divider-light:var(--bridge-line-soft);
  --card:var(--bridge-panel);
  --card-bg:var(--bridge-panel);
  --card-light:var(--bridge-panel-alt);
  --card-deep:var(--bridge-panel-3);
  --card-border:var(--bridge-line);
  --text:var(--bridge-text);
  --text-sub:var(--bridge-text);
  --text-muted:var(--bridge-muted);
  --text-soft:var(--bridge-muted);
  --bg-alt:var(--bridge-panel-2);
  --accent:var(--bridge-signal);
  --accent-deep:var(--bridge-signal);
  --accent-soft:var(--bridge-signal-soft);
  --accent-bg:var(--bridge-signal-soft);
  --accent-bg-faint:var(--bridge-signal-soft);
  --accent-bg-hover:var(--bridge-signal-soft);
  --danger:var(--bridge-danger);
  --ub-overlay-bg:rgba(0,6,9,.72);
  --ub-scrollbar-thumb:var(--bridge-line);
  --ub-scrollbar-thumb-hover:var(--bridge-signal);
  --ub-text-muted:var(--bridge-muted);
  --ub-bg-card:var(--bridge-panel);
  /* 日历兄弟弹窗变量·深色（字面量兜底；:root 处已按浅色完成替换，深色必须重声明，见 ios.ts 同款注释） */
  --ub-text:var(--bridge-text,#d8edef);--ub-divider:var(--bridge-line,#27515b);--ub-accent:var(--bridge-signal,#77e5e0);--ub-hover-bg:var(--bridge-panel-alt,#0a1a20);
  --ub-popup-shadow:0 22px 58px rgba(0,0,0,.52);
  --ub-popup-border:1px solid var(--bridge-line);
  --ub-popup-bg:var(--bridge-panel);
  --ub-popup-head-bg:var(--bridge-panel-2);
  --ub-popup-head-border:1px solid var(--bridge-line);
  --ub-ft-ring-start:var(--bridge-signal);
  --ub-ft-ring-end:var(--bridge-alert);
  --ub-ft-ring-glow:rgba(119,229,224,.28);
  --portrait-bg:var(--bridge-panel-2);
  --portrait-empty-color:var(--bridge-muted);
  --portrait-border:var(--bridge-line);
  color-scheme:dark;
}

/* Detached overlays are moved under body, so the active theme must provide their
   complete geometry instead of relying on another theme's stylesheet. */
.nsfw-overlay,
.panel-overlay,
.settings-overlay{
  position:fixed;
  top:0;
  left:0;
  width:100%;
  height:100vh;height:100dvh;
  box-sizing:border-box;
  display:none;
  align-items:center;
  justify-content:center;
  padding:max(8px,var(--safe-top)) max(8px,var(--safe-right)) max(8px,var(--safe-bottom)) max(8px,var(--safe-left));
  overflow:hidden;
  background:var(--ub-overlay-bg);
  backdrop-filter:blur(3px);
}
.nsfw-overlay,.panel-overlay{z-index:10000}
.settings-overlay{z-index:10002}
.nsfw-overlay.show,
.panel-overlay.show,
.settings-overlay.show{display:flex}

.panel-popup,
.settings-popup{
  position:relative;
  min-width:0;
  color:var(--bridge-text);
  background:
    linear-gradient(135deg,var(--bridge-signal-soft),transparent 28%),
    var(--bridge-panel);
  border:1px solid var(--bridge-line);
  border-radius:0;
  box-shadow:0 16px 48px var(--bridge-shadow),inset 0 0 0 1px var(--bridge-line-soft);
  font-family:"IBM Plex Sans","DIN Alternate","Noto Sans SC","Microsoft YaHei UI",system-ui,sans-serif;
  font-variant-numeric:tabular-nums;
}
.panel-popup,
.settings-popup{display:flex;flex-direction:column;overflow:hidden}

.panel-popup-head,
.settings-popup-head{
  position:relative;
  z-index:2;
  display:flex;
  align-items:center;
  gap:10px;
  flex:0 0 auto;
  min-width:0;
  min-height:42px;
  padding:8px 12px;
  color:var(--bridge-text);
  background:linear-gradient(90deg,var(--bridge-panel-3),var(--bridge-panel-2));
  border-bottom:1px solid var(--bridge-line);
}
.panel-popup-title,
.settings-popup-title{
  min-width:0;
  flex:1 1 auto;
  color:var(--bridge-text);
  font-size:var(--ub-popup-font-title,13px);
  font-weight:850;
  letter-spacing:.1em;
  overflow-wrap:anywhere;
}
.panel-popup-close,
.panel-popup-close,
.panel-popup-back,
.settings-popup-close,
.panel-popup-warehouse-toggle{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:28px;
  min-height:28px;
  flex:0 0 auto;
  padding:3px 8px;
  color:var(--bridge-text);
  background:transparent;
  border:1px solid var(--bridge-line);
  border-radius:0;
  font:inherit;
  cursor:pointer;
}
.panel-popup-close:hover,
.panel-popup-back:hover,
.settings-popup-close:hover,
.panel-popup-warehouse-toggle:hover{color:var(--bridge-signal);border-color:var(--bridge-signal);background:var(--bridge-signal-soft)}

.panel-popup-body,
.settings-popup-body{min-width:0;padding:12px}
.panel-popup-body,
.settings-popup-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.detail-row{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--bridge-line-soft);font-size:11px;line-height:1.55}
.detail-row:last-child{border-bottom:0}
.detail-row .dl{min-width:62px;flex:0 0 auto;color:var(--bridge-muted);font-size:9px;font-weight:800;letter-spacing:.1em}
.detail-row .dv{min-width:0;flex:1;color:var(--bridge-text);overflow-wrap:anywhere}
.detail-content{padding:8px 0}
.detail-content .dl{display:block;margin-bottom:6px;color:var(--bridge-muted);font-size:9px;letter-spacing:.1em}
.detail-content .dc{color:var(--bridge-text);font-size:11px;line-height:1.7;overflow-wrap:anywhere}

.settings-tabs{
  display:flex;
  flex:0 0 auto;
  gap:0;
  min-width:0;
  overflow-x:auto;
  background:var(--bridge-bg);
  border-bottom:1px solid var(--bridge-line);
}
.settings-tab{
  position:relative;
  flex:1 0 auto;
  min-height:36px;
  padding:8px 12px;
  color:var(--bridge-muted);
  background:transparent;
  border:0;
  border-right:1px solid var(--bridge-line);
  border-radius:0;
  font:700 11px/1.2 "IBM Plex Mono","Consolas",monospace;
  letter-spacing:.08em;
  cursor:pointer;
}
.settings-tab:hover{color:var(--bridge-signal);background:var(--bridge-signal-soft)}
.settings-tab.active{color:var(--bridge-panel);background:var(--bridge-signal)}
.settings-tab-content{display:none}
.settings-tab-content.active{display:block}
.settings-section{margin:12px 0;padding:10px;border:1px solid var(--bridge-line-soft);background:var(--bridge-panel-2)}
.settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:9px 0;border-bottom:1px solid var(--bridge-line-soft)}
.settings-row:last-child{border-bottom:0}
.settings-label{min-width:0;color:var(--bridge-text);font-size:12px;line-height:1.45;overflow-wrap:anywhere}
.settings-toggle{
  position:relative;
  width:44px;
  height:24px;
  flex:0 0 44px;
  padding:0;
  overflow:hidden;
  background:var(--bridge-bg);
  border:1px solid var(--bridge-line-strong,var(--bridge-line));
  border-radius:0;
  cursor:pointer;
}
.settings-toggle::after{
  content:"";
  position:absolute;
  top:3px;
  left:3px;
  width:16px;
  height:16px;
  background:var(--bridge-muted);
  transition:transform .14s ease,background-color .14s ease;
}
.settings-toggle.on{background:var(--bridge-signal-soft);border-color:var(--bridge-signal)}
.settings-toggle.on::after{transform:translateX(20px);background:var(--bridge-signal)}

.char-info-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:10px 12px}
.char-info-panel{display:none}
.char-info-panel.active{display:flex;flex-direction:column}
.item-top,
.memo-item-top,
.diary-item-top{display:flex;align-items:center;gap:8px;min-width:0}
.memo-item-top{justify-content:space-between}
.memo-item-sub{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}
.item-name,
.memo-title,
.mission-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item-desc,
.mission-desc,
.diary-item-content{margin-top:5px;color:var(--bridge-muted);font-size:10px;line-height:1.5;overflow-wrap:anywhere}
.item-detail-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--bridge-line)}
.item-detail-actions button{flex:1 1 120px;padding:7px 10px}
.mission-objective{margin-top:7px;padding:8px 10px;color:var(--bridge-text);background:var(--bridge-bg);border-left:3px solid var(--bridge-signal);font-size:11px;line-height:1.55}
.mission-status{display:inline-block;margin-top:7px;padding:3px 7px;border:1px solid var(--bridge-line)}
.mission-status.completed{color:var(--bridge-signal);border-color:var(--bridge-signal);background:var(--bridge-signal-soft)}
.mission-status.pending{color:var(--bridge-muted)}
.mission-delete{margin-left:auto}
.diary-notebook{position:relative;padding:18px;margin:8px 0;background:var(--bridge-bg);border:1px solid var(--bridge-line)}
.diary-notebook::before{content:"PERSONNEL LOG";display:block;margin-bottom:10px;color:var(--bridge-muted);font:8px/1 "IBM Plex Mono","Consolas",monospace;letter-spacing:.16em}
.diary-content .dc{color:var(--bridge-text);font-size:12px;line-height:1.75;overflow-wrap:anywhere}
/* 日记手账标记（全库 7 类 span；桥式窗口用扁平档案语言表达，token 浅深自适应） */
.diary-content .dc .strikethrough{text-decoration:line-through;text-decoration-thickness:1px;text-decoration-color:var(--bridge-muted);opacity:.7}
.diary-content .dc .highlight{background:var(--bridge-signal-soft);color:var(--bridge-signal);padding:0 2px;box-shadow:inset 0 -1px 0 var(--bridge-line-soft)}
.diary-content .dc .underline{text-decoration:underline dotted;text-decoration-color:var(--bridge-signal);text-underline-offset:3px}
.diary-content .dc .emphasis{color:var(--bridge-signal);font-weight:700}
.diary-content .dc .handwritten{font-style:italic;color:var(--bridge-muted);letter-spacing:.04em}
.diary-content .dc .messy{font-style:italic;color:var(--bridge-alert);opacity:.85;letter-spacing:.08em}
.diary-content .dc .censored{position:relative;color:transparent;background:var(--bridge-text);border-radius:1px;padding:0 3px;cursor:pointer;transition:color .25s,background .25s}
.diary-content .dc .censored:hover{color:var(--bridge-text);background:transparent}
.diary-detail-writer{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--bridge-text);font-size:12px;letter-spacing:.08em;margin-bottom:8px}
.diary-nav-btn{flex:0 0 auto;width:26px;height:26px;line-height:24px;text-align:center;border:1px solid var(--bridge-line);border-radius:50%;background:transparent;color:var(--bridge-text);cursor:pointer;font-size:var(--ub-ui-font-10,10px);padding:0;transition:opacity .2s,border-color .2s}
.diary-nav-btn:hover:not(:disabled){opacity:.8;border-color:var(--bridge-text)}
.diary-nav-btn:disabled{opacity:.3;cursor:default}
.diary-nav-indicator{text-align:center;font-size:var(--ub-ui-font-10,10px);color:var(--bridge-muted);margin-top:8px;letter-spacing:.12em}

.bridge-container{
  position:relative;
  max-width:100%;
  box-sizing:border-box;
  overflow:visible;
  isolation:isolate;
  padding:10px;
  color:var(--bridge-text);
  background-color:var(--bridge-bg);
  background-image:
    linear-gradient(var(--bridge-grid) 1px,transparent 1px),
    linear-gradient(90deg,var(--bridge-grid) 1px,transparent 1px),
    linear-gradient(135deg,transparent 0 48%,var(--bridge-grid) 48% 52%,transparent 52%);
  background-size:20px 20px,20px 20px,64px 64px;
  border:1px solid var(--bridge-line);
  font-family:"IBM Plex Sans","DIN Alternate","Noto Sans SC","Microsoft YaHei UI",system-ui,sans-serif;
  font-variant-numeric:tabular-nums;
  letter-spacing:.02em;
  box-shadow:0 10px 28px var(--bridge-shadow),inset 0 0 0 1px var(--bridge-line-soft);
}

.bridge-container::before,
.bridge-window::before{
  content:"";
  position:absolute;
  inset:5px;
  z-index:-1;
  pointer-events:none;
  border:1px solid var(--bridge-line-soft);
  clip-path:polygon(0 0,24px 0,24px 1px,calc(100% - 24px) 1px,calc(100% - 24px) 0,100% 0,100% 100%,calc(100% - 24px) 100%,calc(100% - 24px) calc(100% - 1px),24px calc(100% - 1px),24px 100%,0 100%);
}

.bridge-kicker,
.bridge-en-label{
  color:var(--bridge-muted);
  font-size:9px;
  font-weight:700;
  line-height:1.2;
  letter-spacing:.18em;
  text-transform:uppercase;
}

.bridge-readout{
  min-width:0;
  color:var(--bridge-text);
  font-size:var(--ub-content-font-12,13.2px);
  line-height:1.5;
  overflow-wrap:anywhere;
}

.bridge-signal{color:var(--bridge-signal)}
.bridge-alert{color:var(--bridge-alert)}
.bridge-danger{color:var(--bridge-danger)}
.bridge-muted{color:var(--bridge-muted)}

.bridge-module,
.bridge-window,
.panel-overlay .bridge-window{
  position:relative;
  box-sizing:border-box;
  color:var(--bridge-text);
  background:
    linear-gradient(135deg,var(--bridge-signal-soft),transparent 28%),
    var(--bridge-panel);
  border:1px solid var(--bridge-line);
  border-radius:0;
  box-shadow:0 16px 48px var(--bridge-shadow),inset 0 0 0 1px var(--bridge-line-soft);
}

.bridge-module{
  padding:10px;
  box-shadow:inset 0 0 0 1px var(--bridge-line-soft);
}

.bridge-module-title{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
  color:var(--bridge-text);
  font-size:12px;
  font-weight:800;
  letter-spacing:.1em;
}

.bridge-module-title::before{
  content:"";
  width:7px;
  height:7px;
  flex:0 0 7px;
  background:var(--bridge-signal);
  box-shadow:0 0 0 3px var(--bridge-signal-soft);
}


.bridge-grid{
  display:grid;
  grid-template-columns:repeat(12,minmax(0,1fr));
  gap:8px;
  min-width:0;
}


.bridge-status-chip{
  display:inline-flex;
  align-items:center;
  gap:6px;
  min-width:0;
  padding:3px 7px;
  color:var(--bridge-muted);
  background:var(--bridge-panel-2);
  border:1px solid var(--bridge-line-soft);
  font-size:10px;
  line-height:1.3;
}

.bridge-status-chip::before{
  content:"";
  width:6px;
  height:6px;
  flex:0 0 6px;
  background:var(--bridge-signal);
}

.bridge-status-chip.is-alert::before{background:var(--bridge-alert)}
.bridge-status-chip.is-danger::before{background:var(--bridge-danger)}

.bridge-btn,
.bridge-container button,
.bridge-window button{
  box-sizing:border-box;
  color:var(--bridge-text);
  background:var(--bridge-panel-2);
  border:1px solid var(--bridge-line);
  border-radius:0;
  font-family:inherit;
  cursor:pointer;
  transition:background-color .14s ease,border-color .14s ease,color .14s ease,transform .14s ease;
}

.bridge-btn:hover,
.bridge-container button:hover,
.bridge-window button:hover{
  color:var(--bridge-signal);
  background:var(--bridge-signal-soft);
  border-color:var(--bridge-signal);
}

.bridge-btn:focus-visible,
.bridge-container button:focus-visible,
.bridge-window button:focus-visible{
  outline:2px solid var(--bridge-alert);
  outline-offset:2px;
}

.bridge-btn:disabled,
.bridge-container button:disabled,
.bridge-window button:disabled{
  cursor:not-allowed;
  opacity:.45;
}

.bridge-btn.is-primary{
  color:var(--bridge-panel);
  background:var(--bridge-signal);
  border-color:var(--bridge-signal);
}

.bridge-btn.is-danger{
  color:var(--bridge-danger);
  background:var(--bridge-danger-soft);
  border-color:var(--bridge-danger);
}

.bridge-window input,
.bridge-window select,
.bridge-window textarea{
  box-sizing:border-box;
  max-width:100%;
  color:var(--bridge-text);
  background:var(--bridge-bg);
  border:1px solid var(--bridge-line);
  border-radius:0;
  font:inherit;
  caret-color:var(--bridge-signal);
}

.bridge-window input:focus,
.bridge-window select:focus,
.bridge-window textarea:focus{
  outline:1px solid var(--bridge-signal);
  border-color:var(--bridge-signal);
  box-shadow:0 0 0 3px var(--bridge-signal-soft);
}

.bridge-empty,
.bridge-stale{
  padding:18px 14px;
  color:var(--bridge-muted);
  background:var(--bridge-panel-2);
  border:1px dashed var(--bridge-line);
  text-align:center;
}

.bridge-stale{color:var(--bridge-alert);border-color:var(--bridge-alert)}

.bridge-window-head{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:42px;
  padding:8px 12px;
  color:var(--bridge-text);
  background:var(--bridge-panel-2);
  border-bottom:1px solid var(--bridge-line);
}
.bridge-window .panel-popup-head{
  min-height:42px;
  color:var(--bridge-text);
  background:var(--bridge-panel-2);
  border-bottom:1px solid var(--bridge-line);
}
.bridge-window .panel-popup-title{font-weight:850;letter-spacing:.1em}
.bridge-window .panel-popup-body{color:var(--bridge-text);background:var(--bridge-panel)}
.bridge-window .panel-popup-close,
.bridge-window .panel-popup-back,
.bridge-window .panel-popup-warehouse-toggle{color:var(--bridge-text);background:transparent;border:1px solid var(--bridge-line)}
.bridge-window ::-webkit-scrollbar{width:7px;height:7px}
.bridge-window ::-webkit-scrollbar-thumb{background:var(--bridge-line);border:1px solid var(--bridge-panel)}
.bridge-window ::-webkit-scrollbar-track{background:var(--bridge-bg)}
.bridge-window input[type="range"]{accent-color:var(--bridge-signal)}
.bridge-window input[type="checkbox"]{accent-color:var(--bridge-signal)}
.bridge-window select option{color:var(--bridge-text);background:var(--bridge-panel)}

#ac-fixed-toggle{
  color:var(--bridge-text);
  background:var(--bridge-panel-2);
  border-color:var(--bridge-line);
  border-radius:0!important;
  box-shadow:0 0 0 2px var(--bridge-bg),0 0 0 3px var(--bridge-signal),0 6px 18px var(--bridge-shadow);
}
#ac-statusbar-wrapper.ub-collapsed{display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:hidden!important}
#ac-collapse-menu{
  color:var(--bridge-text)!important;
  background:var(--bridge-panel)!important;
  border:1px solid var(--bridge-line)!important;
  border-radius:0!important;
  box-shadow:0 14px 34px var(--bridge-shadow)!important;
}
#ac-collapse-menu .ac-collapse-menu-item{border-radius:0!important}
#ac-collapse-menu .ac-collapse-menu-item:hover{color:var(--bridge-signal)!important;background:var(--bridge-signal-soft)!important}

.help-tooltip-global{
  position:fixed;
  z-index:100000;
  max-width:260px;
  padding:10px 14px;
  color:var(--bridge-text)!important;
  background:var(--bridge-panel)!important;
  border:1px solid var(--bridge-signal)!important;
  border-radius:0!important;
  box-shadow:0 12px 32px var(--bridge-shadow)!important;
  font-size:11px;
  line-height:1.7;
  white-space:pre-line;
  pointer-events:none;
}
.archive-export-menu{
  color:var(--bridge-text);
  background:var(--bridge-panel);
  border-color:var(--bridge-line);
  border-radius:0;
}
.archive-export-menu button:hover{color:var(--bridge-signal);background:var(--bridge-signal-soft)}
.ub-badge-bridge{
  color:var(--bridge-panel);
  background:var(--bridge-alert);
  border:1px solid var(--bridge-bg);
  border-radius:0;
  box-shadow:0 0 0 1px var(--bridge-alert),0 2px 7px var(--bridge-shadow);
  font-family:"IBM Plex Mono","DIN Alternate",monospace;
}

.bridge-reticle{
  position:fixed;
  z-index:100500;
  width:28px;
  height:28px;
  margin:-14px 0 0 -14px;
  pointer-events:none;
  border:1px solid var(--bridge-signal);
  box-shadow:0 0 0 5px var(--bridge-signal-soft);
  transform:scale(.45) rotate(45deg);
  opacity:0;
  animation:bridge-reticle-once .5s ease-out 1;
}
.bridge-reticle::before,
.bridge-reticle::after{content:"";position:absolute;background:var(--bridge-alert)}
.bridge-reticle::before{left:50%;top:-9px;width:1px;height:46px}
.bridge-reticle::after{top:50%;left:-9px;width:46px;height:1px}
@keyframes bridge-reticle-once{
  0%{opacity:0;transform:scale(.45) rotate(45deg)}
  24%{opacity:1;transform:scale(1) rotate(45deg)}
  100%{opacity:0;transform:scale(1.35) rotate(45deg)}
}

.panel-popup.bridge-module-memo,
.panel-popup.bridge-module-item,
.panel-popup.bridge-module-warehouse,
.panel-popup.bridge-module-diary,
.panel-popup.bridge-module-mission,
.panel-popup.bridge-module-character,
.panel-popup.bridge-module-guidance,
.panel-popup.bridge-module-options{
  width:min(92%,860px);
  max-width:860px;
  max-height:86vh;
  max-height:86dvh;
}
.panel-popup.bridge-module-database{
  width:min(96%,1180px);
  max-width:1180px;
  max-height:90vh;
  max-height:90dvh;
}
.panel-popup.bridge-module-confirm{
  width:min(92%,520px);
  max-width:520px;
}

.bridge-list-layout{
  display:grid;
  grid-template-columns:minmax(130px,20%) minmax(240px,36%) minmax(0,1fr);
  min-width:0;
  min-height:0;
}

.bridge-window .memo-list-item,
.bridge-window .item-list-item,
.bridge-window .mission-list-item,
.bridge-window .diary-list-item{
  position:relative;
  margin:6px 0;
  padding:10px 12px;
  color:var(--bridge-text);
  background:var(--bridge-panel-2);
  border:1px solid var(--bridge-line-soft);
  border-left:3px solid var(--bridge-line);
  border-radius:0;
  transition:border-color .14s ease,background-color .14s ease;
}
.bridge-window .memo-list-item:hover,
.bridge-window .item-list-item:hover,
.bridge-window .mission-list-item:hover,
.bridge-window .diary-list-item:hover{
  background:var(--bridge-signal-soft);
  border-color:var(--bridge-signal);
}
.bridge-window .memo-title,
.bridge-window .item-name,
.bridge-window .mission-name{color:var(--bridge-text);font-weight:800}
.bridge-window .memo-type,
.bridge-window .memo-status,
.bridge-window .memo-char,
.bridge-window .memo-time-badge,
.bridge-window .item-type,
.bridge-window .mission-status{color:var(--bridge-muted)}
.item-wardrobe-badge{display:inline-flex;align-items:center;border-radius:0;background:var(--accent);color:#fff;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:1px;flex-shrink:0;margin-left:4px;font-family:"IBM Plex Sans","DIN Alternate","Noto Sans SC","Microsoft YaHei UI",system-ui,sans-serif}
.bridge-window .panel-empty{padding:28px 16px;color:var(--bridge-muted);background:var(--bridge-panel-2);border:1px dashed var(--bridge-line)}

.bridge-module-character .char-info-card{color:var(--bridge-text);background:var(--bridge-panel-2);border:1px solid var(--bridge-line)}
.bridge-module-character .char-info-card-name{color:var(--bridge-signal);letter-spacing:.08em}
.bridge-module-character .char-hub-map-link{color:var(--bridge-signal)}

.bridge-module-database .db-tabs{
  display:flex;
  gap:4px;
  max-width:100%;
  overflow-x:auto;
  padding:6px;
  background:var(--bridge-bg);
  border-bottom:1px solid var(--bridge-line);
}
.bridge-module-database .db-tab{flex:0 0 auto;border-radius:0}
.bridge-module-database .db-tab[data-active="1"]{color:var(--bridge-signal);background:var(--bridge-signal-soft);border-color:var(--bridge-signal)}
.bridge-module-database .db-toolbar{color:var(--bridge-text);background:var(--bridge-panel-2);border-color:var(--bridge-line)}
.bridge-module-database .db-card{color:var(--bridge-text);background:var(--bridge-panel-2);border-color:var(--bridge-line-soft);border-radius:0}
.bridge-module-database .db-card:hover{border-color:var(--bridge-signal)}
.bridge-module-database .db-search{min-width:140px;color:var(--bridge-text);background:var(--bridge-bg);border-color:var(--bridge-line)}

.bridge-module-confirm .db-confirm-body{color:var(--bridge-text);background:var(--bridge-panel);border-color:var(--bridge-line)}
.bridge-module-confirm .db-confirm-actions{background:var(--bridge-panel-2);border-top:1px solid var(--bridge-line)}
.bridge-module-confirm .db-danger,
.bridge-module-confirm .db-del-confirm-warn{color:var(--bridge-danger);border-color:var(--bridge-danger);background:var(--bridge-danger-soft)}

.bridge-module-options .panel-popup-title::after{content:" / COMMAND SEQUENCE";margin-left:7px;color:var(--bridge-muted);font:8px/1 var(--bridge-font-data);letter-spacing:.13em}
.bridge-module-options .options-bar{padding:0;border:0;background:transparent}
.bridge-module-options .options-bar-items{display:grid;grid-template-columns:1fr;gap:6px}
.bridge-module-options .option-item{border-radius:0;border-left:3px solid var(--bridge-signal);background:var(--bridge-panel-2)}
.bridge-module-options .option-number{border-radius:0;background:var(--bridge-screen);color:var(--bridge-screen-text)}

.bridge-module-guidance .play-img-wrap{color:var(--bridge-text);background:var(--bridge-panel-2);border-color:var(--bridge-line);border-radius:0}
.bridge-module-guidance .portrait-gen-textarea{color:var(--bridge-text);background:var(--bridge-bg);border-color:var(--bridge-line)}
.bridge-module-guidance .play-img{max-width:100%;border:1px solid var(--bridge-line)}

/* 技能树：图例/详情区落在浅色 body 上，须用 bridge 深色文字，不用给深色画布调的 --skill-* */
.bridge-module-skill-tree .sk-legend{color:var(--bridge-muted,#55747a)}
.bridge-module-skill-tree .sk-legend i{outline:1px solid var(--bridge-line,#91a5ad)}
.bridge-module-skill-detail .sk-detail,
.bridge-module-skill-detail .sk-confirm{background:var(--bridge-panel-2,#dbe8e9);border-color:var(--bridge-line,#91a5ad)}
.bridge-module-skill-detail .sk-d-title,
.bridge-module-skill-detail .sk-d-desc{color:var(--bridge-text,#16222c)}
.bridge-module-skill-detail .sk-d-line,
.bridge-module-skill-detail .sk-d-stat,
.bridge-module-skill-detail .sk-d-warn{color:var(--bridge-muted,#55747a)}
.bridge-module-skill-detail .sk-d-desc{background:var(--bridge-panel,#f7fbfb);border-left-color:var(--bridge-signal,#087f85)}

.bridge-command-header{
  display:grid;
  grid-template-columns:minmax(190px,1.1fr) minmax(260px,1.4fr) minmax(190px,auto);
  gap:12px;
  align-items:center;
  margin-bottom:8px;
}

.bridge-command-identity,
.bridge-command-telemetry,
.bridge-system-controls,
.bridge-action-cluster,
.bridge-protagonist-row,
.bridge-personnel-actions,
.bridge-detail-tabs,
.bridge-protocol-controls{
  display:flex;
  align-items:center;
  gap:6px;
  min-width:0;
}

.bridge-command-identity{flex-direction:column;align-items:flex-start}
.bridge-protagonist-row{flex-wrap:wrap}
.bridge-protagonist-name,
.bridge-personnel-name{
  padding:0;
  color:var(--bridge-text)!important;
  background:transparent!important;
  border:0!important;
  font-size:18px!important;
  font-weight:850!important;
  letter-spacing:.08em;
  text-align:left;
}
.bridge-command-status{max-width:48ch;color:var(--bridge-muted);font-size:var(--ub-content-font-13,14.3px);line-height:1.4;overflow-wrap:anywhere}
.wardrobe-protagonist-summary{display:inline-flex;align-items:center;gap:8px;max-width:100%;margin-top:6px;padding:5px 9px;border:1px solid var(--bridge-line-soft);border-radius:2px;background:var(--bridge-signal-soft);color:var(--bridge-muted);font-size:11px;line-height:1.4;cursor:pointer;text-align:left;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--bridge-signal);font-weight:700;font-size:9px;letter-spacing:.18em;text-transform:uppercase;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--bridge-muted);border-left:1px solid var(--bridge-line-soft);padding-left:8px}
.wardrobe-protagonist-summary:hover{border-color:var(--bridge-signal);box-shadow:0 0 10px var(--bridge-signal-soft)}
.bridge-command-telemetry{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.bridge-coordinate,
.bridge-clock,
.bridge-energy{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:2px;
  min-width:0;
  padding:7px 8px!important;
  color:var(--bridge-text)!important;
  background:var(--bridge-panel-2)!important;
  border:1px solid var(--bridge-line-soft)!important;
}
.bridge-coordinate strong,
.bridge-clock strong,
.bridge-energy strong{max-width:100%;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 钱包入口（F35）：遥测带第 4 格，紧贴 CORE LOAD；并入上面那组 telemetry 的观感（同底色/同边框）；
   3 格 → 4 格；深色由 .bridge-container.dark-mode 变量块自动覆盖；欠款数字用既有 --bridge-danger。 */
.bridge-command-telemetry{grid-template-columns:repeat(4,minmax(0,1fr))}
.ub-wallet-entry{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;padding:7px 8px!important;color:var(--bridge-text)!important;background:var(--bridge-panel-2)!important;border:1px solid var(--bridge-line-soft)!important;cursor:pointer;text-align:left}
.ub-wallet-entry:hover{border-color:var(--bridge-signal)!important}
.ub-wallet-entry strong{max-width:100%;font-size:11px;display:flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ub-wallet-entry strong b{font-weight:700;color:var(--bridge-signal)}
.ub-wallet-entry strong b.neg{color:var(--bridge-danger)}
.ub-wallet-entry.ub-wallet-empty{opacity:.6}
.ub-wallet-entry.ub-wallet-empty strong b{color:var(--bridge-muted)}
@media(max-width:599px){.ub-wallet-entry{grid-column:1/-1}}
.bridge-system-controls{justify-content:flex-end;flex-wrap:wrap}
.bridge-system-controls .bridge-btn,
.bridge-system-controls .scene-btn{padding:5px 8px;font-size:10px}

.bridge-quick-actions{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:8px;
}
.bridge-action-cluster{justify-content:flex-end;flex-wrap:wrap}
.bridge-action-cluster .bridge-btn{padding:6px 10px;font-size:11px}

.bridge-character-channels{margin-bottom:8px}
.bridge-channel-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
.bridge-role-selector{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;padding-bottom:2px}
.bridge-role-chip{
  display:inline-flex;
  align-items:center;
  gap:7px;
  flex:0 0 auto;
  min-width:104px;
  padding:6px 9px;
  color:var(--bridge-muted)!important;
  text-align:left;
}
.bridge-role-chip.active{
  color:var(--bridge-signal)!important;
  background:var(--bridge-signal-soft)!important;
  border-color:var(--bridge-signal)!important;
  box-shadow:inset 3px 0 0 var(--bridge-signal);
}
.bridge-role-index{font-size:9px;color:var(--bridge-muted)}

.bridge-status-layout{
  display:grid;
  gap:8px;
  min-width:0;
  margin-bottom:8px;
}
.bridge-personnel-portrait,
.bridge-personnel-telemetry{min-width:0}
.bridge-personnel-portrait{display:flex;flex-direction:column;gap:8px}
.bridge-personnel-portrait .portrait-box{flex:0 0 auto;width:100%;aspect-ratio:1/1;height:auto}
.bridge-personnel-identity{display:flex;flex-direction:column;align-items:flex-start;gap:3px}
.bridge-personnel-actions{flex-wrap:wrap}
.bridge-personnel-actions .bridge-btn,
.bridge-personnel-actions .investigate-btn{padding:5px 7px;font-size:10px}

.bridge-telemetry-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:6px;
  margin-top:9px;
}
.bridge-telemetry-item{
  display:grid;
  grid-template-columns:auto 1fr;
  gap:2px 8px;
  min-width:0;
  padding:7px 8px;
  background:var(--bridge-panel-2);
  border-left:2px solid var(--bridge-line);
}
.bridge-telemetry-item .bridge-en-label{grid-column:1/-1}
.bridge-telemetry-label{color:var(--bridge-muted);font-size:10px;white-space:nowrap}
.bridge-train-row{display:grid;grid-template-columns:auto minmax(80px,1fr) auto;gap:8px;align-items:center;margin:9px 0}
.bridge-train-row strong{font-size:12px;font-weight:750;font-family:var(--bridge-font-data);color:var(--bridge-alert);letter-spacing:.04em}
.bridge-meter{height:7px;overflow:hidden;background:var(--bridge-bg);border:1px solid var(--bridge-line)}
.bridge-meter span{display:block;height:7px;background:linear-gradient(90deg,var(--bridge-signal),var(--bridge-alert))}
.bridge-detail-console{margin-top:8px;border-top:1px solid var(--bridge-line-soft);padding-top:8px}
.bridge-detail-tabs{margin-bottom:6px}
.bridge-detail-tabs .bridge-btn{padding:5px 8px;font-size:10px}
.bridge-detail-tabs .active-switch{color:var(--bridge-signal);border-color:var(--bridge-signal);background:var(--bridge-signal-soft)}
.bridge-detail-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}

.bridge-protocol{margin-bottom:8px}
.bridge-protocol-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.bridge-protocol-controls{justify-content:flex-end;flex-wrap:wrap}
.bridge-protocol-controls .bridge-btn{padding:5px 8px;font-size:10px}
.bridge-protocol-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:6px;
  margin-top:9px;
}
.bridge-protocol.collapsed .bridge-protocol-grid{display:none}

.bridge-container .options-bar{
  padding:9px;
  background:var(--bridge-panel);
  border:1px solid var(--bridge-line);
}
.bridge-container .options-bar-header{margin-bottom:7px}
.bridge-container .options-bar-title{color:var(--bridge-signal);font-size:10px;font-weight:800;letter-spacing:.16em}
.bridge-container .options-bar-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.bridge-container .option-item{display:flex;align-items:flex-start;gap:6px;min-width:0;padding:7px;text-align:left}
.bridge-container .option-number{color:var(--bridge-alert);font-weight:800}
.bridge-container .option-text{min-width:0;font-size:10px;line-height:1.4;overflow-wrap:anywhere}

.bridge-overlay{
  height:100vh;
  height:100dvh;
  width:100%;
  box-sizing:border-box;
  overflow:auto;
  overscroll-behavior:contain;
}



/* 系统控制：设置、决策队列与数据库修复 */
.settings-popup.bridge-module-settings{width:min(94%,760px);max-width:760px;border-radius:0;border:1px solid var(--bridge-line-strong);background:var(--bridge-panel)}
.bridge-module-settings .settings-popup-head{background:linear-gradient(90deg,var(--bridge-panel-alt),var(--bridge-panel));border-bottom:1px solid var(--bridge-line-strong)}
.bridge-module-settings .settings-popup-title::after{content:" / SYSTEM CONTROL";font:9px/1 var(--bridge-font-data);letter-spacing:1.2px;color:var(--bridge-text-muted)}
.bridge-module-settings .settings-tabs{gap:0;background:var(--bridge-panel-inset);border-bottom:1px solid var(--bridge-line)}
.bridge-module-settings .settings-tab{min-height:36px;border-radius:0;border-right:1px solid var(--bridge-line)}
.bridge-module-settings .settings-tab.active{background:var(--bridge-signal);color:var(--bridge-signal-contrast);box-shadow:none}
.bridge-module-settings .group-title{padding:5px 7px;border-left:3px solid var(--bridge-signal);background:var(--bridge-panel-alt);color:var(--bridge-signal);font-family:var(--bridge-font-data);letter-spacing:1px}
.bridge-module-settings .settings-row,.bridge-module-settings .settings-section{border-radius:0;border-color:var(--bridge-line)}
.bridge-module-settings .settings-section-summary{border-radius:0;background:var(--bridge-panel-inset)}
.bridge-module-settings input,.bridge-module-settings textarea,.bridge-module-settings select,.bridge-module-settings button{border-radius:0!important}
.bridge-module-settings .settings-toggle{border:1px solid var(--bridge-line-strong)}
.bridge-module-settings .settings-toggle.on{background:var(--bridge-signal)}
.ub-decision-overlay.bridge-module-decision-queue{background:rgba(5,16,21,.72)}
.ub-decision-dialog.bridge-module-decision-queue{border-radius:0;border:1px solid var(--bridge-line-strong);background:var(--bridge-panel);box-shadow:0 0 0 3px var(--bridge-panel),0 0 0 4px var(--bridge-line),0 18px 42px rgba(0,0,0,.38)}
.ub-decision-dialog.bridge-module-decision-queue .ub-decision-head{background:var(--bridge-screen);color:var(--bridge-screen-text);border-bottom:1px solid var(--bridge-line-strong)}
.ub-decision-dialog.bridge-module-decision-queue .ub-decision-title::before{content:"DECISION QUEUE / ";font:9px var(--bridge-font-data);letter-spacing:1px;color:var(--bridge-screen-muted)}
.ub-decision-dialog.bridge-module-decision-queue .ub-decision-body{background-image:linear-gradient(rgba(35,117,138,.035) 1px,transparent 1px);background-size:100% 22px}
.ub-decision-dialog.bridge-module-decision-queue button{min-height:36px;border-radius:0!important}
.ub-decision-dialog.bridge-module-decision-queue .ub-decision-close{min-height:0;width:28px;height:28px;padding:0;background:none;border:none;color:var(--bridge-screen-muted);font-size:15px}
.ub-decision-dialog.bridge-module-decision-queue .ub-decision-close:hover{color:var(--bridge-screen-text);background:rgba(255,255,255,.08)}
#ubDbRepairOverlay.bridge-module-db-repair{max-width:680px!important;border-radius:0!important;border:1px solid var(--bridge-line-strong)!important;background:var(--bridge-panel)!important}
#ubDbRepairOverlay.bridge-module-db-repair .ub-repair-head{background:var(--bridge-screen)!important;color:var(--bridge-screen-text)!important;border-bottom:1px solid var(--bridge-line-strong)}
#ubDbRepairOverlay.bridge-module-db-repair .ub-repair-title::after{content:" / DATABASE ALIGNMENT";font:9px var(--bridge-font-data);letter-spacing:1px;color:var(--bridge-screen-muted)}
#ubDbRepairOverlay.bridge-module-db-repair .ub-repair-warn{border-radius:0!important;border-color:var(--bridge-danger)!important;color:var(--bridge-danger)!important;background:rgba(164,59,53,.08)!important}
#ubDbRepairOverlay.bridge-module-db-repair .ub-repair-case,#ubDbRepairOverlay.bridge-module-db-repair button{border-radius:0!important}
#ubDbRepairOverlay.bridge-module-db-repair .ub-repair-case{border-color:var(--bridge-line)!important;background:var(--bridge-panel-alt)}
#ubDbRepairOverlay.bridge-module-db-repair .ub-repair-case summary{font-family:var(--bridge-font-data);letter-spacing:.4px}
#ubDbRepairOverlay.bridge-module-db-repair #ubDbRepairConfirm{background:var(--bridge-danger)!important;border-color:var(--bridge-danger)!important}

.panel-popup.bridge-module-chronicle-merge{width:min(94%,820px);max-width:820px;max-height:88vh;max-height:88dvh}
.bridge-module-chronicle-merge .panel-popup-title::after{content:" / CHRONICLE CONSOLIDATION";margin-left:7px;color:var(--bridge-muted);font:8px/1 var(--bridge-font-data);letter-spacing:1px}
.bridge-module-chronicle-merge .db-merge-form input,
.bridge-module-chronicle-merge .db-merge-preview,
.bridge-module-chronicle-merge .db-merge-segment-card,
.bridge-module-chronicle-merge .db-merge-segment-preview,
.bridge-module-chronicle-merge .db-merge-resume-hint{border-radius:0;background:var(--bridge-panel-alt);border-color:var(--bridge-line)}
.bridge-module-chronicle-merge .db-merge-progress-bar-wrap{height:7px;border-radius:0;background:var(--bridge-panel-inset);border:1px solid var(--bridge-line)}
.bridge-module-chronicle-merge .db-merge-progress-bar{background:linear-gradient(90deg,var(--bridge-signal),var(--bridge-alert))}
.bridge-module-chronicle-merge .db-merge-segment-card.is-running{border-color:var(--bridge-signal);background:var(--bridge-signal-soft)}
.bridge-module-chronicle-merge .db-merge-segment-card.is-failed{border-color:var(--bridge-danger);background:var(--bridge-danger-soft)}

/* 航行履历：线性事件记录 */
.bridge-timeline .panel-popup-title::after{content:" / PERSONNEL TIMELINE";font:9px/1 var(--bridge-font-data);letter-spacing:1.2px;color:var(--bridge-text-muted)}
.bridge-timeline .pe-intro{padding:10px 12px;border:1px solid var(--bridge-line);border-left:3px solid var(--bridge-signal);background:var(--bridge-panel-alt)}
.bridge-timeline .pe-intro-label{color:var(--bridge-signal);font-family:var(--bridge-font-data);letter-spacing:1.2px}
.bridge-timeline .pe-intro-text{color:var(--bridge-text)}
.bridge-timeline .pe-rail::before{width:1px;background:var(--bridge-line-strong)}
.bridge-timeline .pe-date{display:inline-block;padding:2px 6px;border:1px solid var(--bridge-line);color:var(--bridge-text-muted);font-family:var(--bridge-font-data);letter-spacing:1px}
.bridge-timeline .pe-dot{left:-21px;top:5px;width:10px;height:10px;border-radius:0;background:var(--bridge-screen);border:2px solid var(--bridge-screen-text);box-shadow:0 0 0 1px var(--bridge-line-strong)}
.bridge-timeline .pe-card{border-radius:0;border:1px solid var(--bridge-line);border-left:3px solid var(--bridge-signal);background:var(--bridge-panel);color:var(--bridge-text);box-shadow:2px 2px 0 var(--bridge-shadow-soft)}


@media(min-width:900px){
  .bridge-status-layout{grid-template-columns:minmax(210px,28%) minmax(0,1fr)}
}

@media(min-width:600px) and (max-width:899px){
  .bridge-command-header{grid-template-columns:minmax(180px,1fr) minmax(260px,1.5fr)}
  .bridge-system-controls{grid-column:1/-1;justify-content:flex-start}
  .bridge-status-layout{grid-template-columns:minmax(190px,34%) minmax(0,1fr)}
  .bridge-protocol-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .bridge-container .options-bar-items{grid-template-columns:repeat(2,minmax(0,1fr))}
}

@media(max-width:900px){
  .bridge-container{padding:8px}
  .bridge-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
}

@media(max-width:599px){
  .bridge-container{padding:6px;background-size:16px 16px,16px 16px,48px 48px}
  .bridge-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
  .bridge-module{padding:8px}
  .bridge-command-header{grid-template-columns:1fr;gap:8px}
  .bridge-command-telemetry{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bridge-energy{grid-column:1/-1}
  .bridge-system-controls{justify-content:flex-start}
  .bridge-quick-actions{align-items:flex-start;flex-direction:column}
  .bridge-action-cluster{justify-content:flex-start}
  .bridge-role-chip{min-width:92px}
  .bridge-status-layout{grid-template-columns:1fr}
  .bridge-personnel-portrait{display:grid;grid-template-columns:minmax(96px,34%) minmax(0,1fr)}
  .bridge-personnel-portrait>.bridge-kicker{grid-column:1/-1}
  .bridge-personnel-portrait .portrait-box{min-height:0;align-self:start}
  .bridge-personnel-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start}
  .bridge-telemetry-grid,
  .bridge-detail-list{grid-template-columns:1fr}
  .bridge-protocol-head{align-items:flex-start;flex-direction:column}
  .bridge-protocol-controls{justify-content:flex-start}
  .bridge-protocol-grid{grid-template-columns:1fr;max-height:240px;overflow-y:auto}
  .bridge-container .options-bar-items{grid-template-columns:1fr}
  .bridge-window{width:100%;max-width:100%;max-height:92vh;max-height:92dvh}
  .bridge-list-layout{grid-template-columns:1fr}
  .bridge-module-database .panel-popup-head{flex-wrap:wrap}
  .bridge-module-database .db-search{order:3;width:100%}
  .bridge-module-confirm{width:calc(100% - 16px)}
  /* height 抵扣 applyMobileFixes 写入的 overlay 上下 padding 总额 var(--ub-ol-pad-total)（index.ts），
     否则全屏弹窗底部（如确认/操作按钮）被推出视口；decision-queue 在自有 border-box overlay
     （padding:18px+height:100dvh）中恰好满屏无裁切，不抵扣 */
  .bridge-module-settings,
  #ubDbRepairOverlay.bridge-module-db-repair{width:100%!important;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none!important;max-height:none!important;border-left:0!important;border-right:0!important}
  .ub-decision-dialog.bridge-module-decision-queue{width:100%!important;height:100vh;height:100dvh;max-width:none!important;max-height:none!important;border-left:0!important;border-right:0!important}
  .panel-popup.bridge-timeline{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none}
  .panel-popup.bridge-module-options{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none}
  .panel-popup.bridge-module-chronicle-merge{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none}
  .bridge-container button,
  .bridge-container [role="button"],
  .bridge-window button,
  .bridge-window [role="button"]{min-height:44px}
}

@media(prefers-reduced-motion:reduce){
  .bridge-container *,
  .bridge-container *::before,
  .bridge-container *::after,
  .bridge-window *,
  .bridge-window *::before,
  .bridge-window *::after{animation:none!important;transition:none!important}
}
` + baseCSS;

export const bridgeCSS = bridgeCoreCSS + /* css */ `
/* 角色中枢 / 剧情回顾：信号控制台 */
.char-hub-theme-bridge,.chronicle-reader-theme-bridge{--hub-bg:var(--bridge-panel);--hub-panel:var(--bridge-panel-2);--hub-line:var(--bridge-line);--hub-ink:var(--bridge-text);--hub-muted:var(--bridge-muted);--hub-accent:var(--bridge-signal);--hub-soft:rgba(74,212,180,.08);--hub-day:rgba(91,141,239,.06);--hub-night:rgba(155,109,180,.08);--hub-night-ink:var(--hub-accent);--hub-pref:#9b6db4}
.char-hub-theme-bridge .char-hub-gsym.is-female{color:#e84a9a}.char-hub-theme-bridge .char-hub-gsym.is-male{color:#5b8def}
.char-hub-theme-bridge .char-hub-lead-banner{background:linear-gradient(90deg,var(--hub-soft),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-action--investigate{color:#5b8def;border-color:color-mix(in srgb,#5b8def 40%,var(--hub-line));background:color-mix(in srgb,#5b8def 12%,var(--hub-bg))}
.char-hub-theme-bridge .char-hub-action--interview{color:var(--hub-accent);border-color:color-mix(in srgb,var(--hub-accent) 40%,var(--hub-line));background:var(--hub-soft)}
.char-hub-theme-bridge .char-hub-identity,.chronicle-reader-theme-bridge .chronicle-reader-card{border-color:var(--hub-line);background:linear-gradient(135deg,var(--hub-soft),var(--hub-bg));box-shadow:inset 3px 0 var(--hub-accent)}
.char-hub-theme-bridge .char-hub-card{background:linear-gradient(120deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-profile-lede{border-inline-start-width:4px;background:repeating-linear-gradient(90deg,var(--hub-soft) 0 1px,transparent 1px 8px)}
.char-hub-theme-bridge .char-hub-prose-card,.char-hub-theme-bridge .char-hub-logic{background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-logic-index{border-radius:0;background:var(--hub-soft);box-shadow:inset 0 0 8px color-mix(in srgb,var(--hub-accent) 22%,transparent)}
.char-hub-theme-bridge .char-hub-trait-balance{gap:8px}.char-hub-theme-bridge .char-hub-trait-column{background:linear-gradient(180deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-relation-card{border-inline-start:3px solid var(--hub-accent);background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,0 100%)}.char-hub-theme-bridge .char-hub-relation-avatar{border-radius:0;background:var(--hub-soft)}
.char-hub-theme-bridge .char-hub-history-preview{gap:8px}.char-hub-theme-bridge .char-hub-history-background,.char-hub-theme-bridge .char-hub-history-latest{background:repeating-linear-gradient(90deg,var(--hub-soft) 0 1px,transparent 1px 12px),var(--hub-panel);clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-not-equal{background:var(--hub-panel);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}.char-hub-theme-bridge .char-hub-not-equal-label{background:repeating-linear-gradient(90deg,var(--hub-soft) 0 1px,transparent 1px 7px)}
.char-hub-theme-bridge .char-hub-intimacy-slip{border-inline-start:3px solid var(--hub-accent);background:repeating-linear-gradient(90deg,var(--hub-soft) 0 1px,transparent 1px 12px),var(--hub-panel)}
.char-hub-theme-bridge .char-hub-vitals-strip{background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-vitals-num{text-shadow:0 0 8px color-mix(in srgb,var(--hub-accent) 40%,transparent)}
.char-hub-theme-bridge .char-hub-vitals-raw{background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-nsfw-card{background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-dual-stat{background:linear-gradient(110deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-speech{clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}
.char-hub-theme-bridge .char-hub-ms-list{position:relative;padding-left:16px}
.char-hub-theme-bridge .char-hub-ms-list::before{content:'';position:absolute;left:35px;top:14px;bottom:14px;width:0;border-left:2px dashed color-mix(in srgb,var(--hub-accent) 40%,transparent)}
.char-hub-theme-bridge .char-hub-ms-node{width:36px;height:36px;border:2px solid var(--hub-accent);transform:rotate(45deg);background:var(--hub-bg);font-variant-numeric:tabular-nums}
.char-hub-theme-bridge .char-hub-ms-node span{transform:rotate(-45deg);display:block}
.char-hub-theme-bridge .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--hub-accent);color:var(--bridge-signal-contrast);box-shadow:0 0 8px color-mix(in srgb,var(--hub-accent) 60%,transparent)}
.char-hub-theme-bridge .char-hub-ms-date{color:var(--hub-accent);font-variant-numeric:tabular-nums}
.char-hub-theme-bridge .char-hub-ms-hero{border-left:3px solid var(--hub-accent);padding-left:10px;background:var(--hub-panel);margin-top:0}
.panel-overlay.dark .char-hub-theme-bridge .char-hub-ms-list::before{border-left-color:color-mix(in srgb,var(--hub-accent) 24%,transparent)}
.panel-overlay.dark .char-hub-theme-bridge .char-hub-ms-node{background:transparent}
.panel-overlay.dark .char-hub-theme-bridge .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--hub-accent);box-shadow:0 0 8px color-mix(in srgb,var(--hub-accent) 32%,transparent)}
.char-hub-theme-bridge{--ms-cat-first:#35b3c9;--ms-cat-relation:#e0a13c;--ms-cat-status:#5c7dc0}
.panel-overlay.dark .char-hub-theme-bridge{--ms-cat-first:#6ad1e0;--ms-cat-relation:#f0bc66;--ms-cat-status:#8fa9dd}
.chronicle-reader-theme-bridge .chronicle-timeline-node{border-radius:0;background:var(--hub-accent);box-shadow:0 0 0 3px var(--hub-soft),0 0 10px color-mix(in srgb,var(--hub-accent) 45%,transparent)}
.chronicle-reader-theme-bridge .chronicle-timeline-content{background:linear-gradient(120deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%);box-shadow:inset 3px 0 var(--hub-accent)}
.chronicle-reader-theme-bridge .chronicle-detail-text{border-inline-start:0;background:linear-gradient(120deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%);box-shadow:inset 3px 0 var(--hub-accent)}.chronicle-reader-theme-bridge .chronicle-detail-dialogue{background:linear-gradient(120deg,var(--hub-soft),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%);box-shadow:inset 3px 0 var(--hub-accent)}
.chronicle-reader-theme-bridge .chronicle-dialogue-line{border-inline-start:3px solid var(--hub-accent);background:linear-gradient(105deg,var(--hub-panel),var(--hub-bg));clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)}.chronicle-reader-theme-bridge .chronicle-dialogue-speaker{border-radius:0;background:var(--hub-soft)}
/* ===== ★ 主角立绘摆位：指挥官证件影像（等比方框；方角/荧光屏样式由 portrait-base bridge 段提供） ===== */
.bridge-protagonist-row .portrait-box{flex:0 0 64px;width:64px;height:64px}
`;
