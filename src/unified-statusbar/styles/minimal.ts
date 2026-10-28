// ===== 萦绕灵感状态栏 - 完整CSS =====
import { baseCSS } from './base';
export const minimalCSS = /* css */ `
.minimal-container{position:relative;font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun","Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB",serif;background-color:var(--bg-color,#ffffff);color:var(--text-color,#111111);padding:24px 20px;border:1px solid var(--border-color,#e0e0e0);font-size:13px;line-height:1.6;max-width:100%;box-sizing:border-box;letter-spacing:0.5px;transition:background-color 0.3s ease,color 0.3s ease,border-color 0.3s ease}

.dark-mode{--ub-success:#77B18C;--ub-warning:#D7AC5C;--ub-danger:#E4776D;--bg-color:#1a1a1a;--text-color:#f0f0f0;--border-color:#666666;--secondary-text:#b8b8b8;--tag-border:#777777;--btn-hover-bg:#f0f0f0;--btn-hover-text:#1a1a1a;--card-border:#666666;--tab-border-alpha:0.3;--lust:#ff6a9e;--lust-glow:rgba(255,106,158,0.12);--lust-border-soft:rgba(255,106,158,0.3);--lust-bg-faint:rgba(255,106,158,0.06);--lust-bg-hover:rgba(255,106,158,0.12);--divider:#666666;--text-muted:#b8b8b8;--divider-light:#777777;--card:#1a1a1a;--text:#f0f0f0;
  --ub-overlay-bg:rgba(0,0,0,0.55);
  --ub-scrollbar-thumb:var(--border-color,#666666);
  --ub-scrollbar-thumb-hover:var(--secondary-text,#b8b8b8);
  --ub-text-muted:var(--secondary-text,#b8b8b8);
  --ub-bg-card:var(--bg-color,#1a1a1a);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接 → 主题级补同一组变量（浅/深各一套，值取本主题 token） */
  --ub-text:var(--text-color,#f0f0f0);--ub-divider:var(--border-color,#666666);--ub-accent:var(--text-color,#f0f0f0);--ub-hover-bg:rgba(255,255,255,0.06);
  --ub-popup-radius:2px;
  --ub-popup-shadow:0 8px 32px rgba(0,0,0,0.35);
  --ub-popup-border:1px solid var(--card-border,#444444);
  --ub-popup-bg:var(--bg-color,#1a1a1a);
  --ub-popup-head-bg:var(--bg-color,#1a1a1a);
  --ub-popup-head-border:1px solid var(--border-color);
  /* === 立绘主题变量（深色覆盖） === */
  --portrait-bg:#1a1a1a;
  --portrait-empty-color:#ddd;
  --portrait-border:#ddd;
  --accent:#ddd;
  /* minimal 深色下 --accent 为浅色，accent 底需配深色字而非固定 #fff（否则按钮不可读） */
  --accent-ink:#111;
  --card-bg:#1a1a1a;
}
.dark-mode .sticky-note{background:#1e1e1e;border-left-color:#2a2a2a;box-shadow:0 3px 12px rgba(0,0,0,0.4),0 1px 2px rgba(0,0,0,0.2),inset 0 0 60px rgba(0,0,0,0.1)}
.dark-mode .sticky-note::before{background:linear-gradient(135deg,transparent 48%,rgba(255,255,255,0.02) 49%,rgba(255,255,255,0.02) 51%,transparent 52%),linear-gradient(225deg,transparent 48%,rgba(255,255,255,0.015) 49%,rgba(255,255,255,0.015) 51%,transparent 52%)}
.dark-mode .sticky-note::after{background:rgba(40,40,40,0.85);border-color:rgba(255,255,255,0.05);box-shadow:0 1px 3px rgba(0,0,0,0.3),inset 0 0 12px rgba(0,0,0,0.1)}
.dark-mode .sticky-note-lines{background:repeating-linear-gradient(transparent,transparent 27px,rgba(100,200,255,0.15) 27px,rgba(100,200,255,0.15) 28px)}
.dark-mode .note-content{color:#7ee8ff;text-shadow:0 0 5px rgba(126,232,255,0.6),0 0 10px rgba(126,232,255,0.4),0 0 15px rgba(126,232,255,0.2)}

:root{--ub-success:#3F6A52;--ub-warning:#8A5B14;--ub-danger:#A13B34;--bg-color:#ffffff;--text-color:#111111;--border-color:#c0c0c0;--secondary-text:#555555;--tag-border:#b8b8b8;--btn-hover-bg:#111111;--btn-hover-text:#ffffff;--card-border:#111111;--tab-border-alpha:1;--lust:#ff6a9e;--lust-glow:rgba(255,106,158,0.12);--lust-border-soft:rgba(255,106,158,0.3);--lust-bg-faint:rgba(255,106,158,0.06);--lust-bg-hover:rgba(255,106,158,0.12);--divider:#c0c0c0;--text-muted:#555555;--divider-light:#d0d0d0;--card:#ffffff;--text:#111111;
  /* === 统一变量别名 === */
  --ub-overlay-bg:rgba(0,0,0,0.4);
  --ub-scrollbar-thumb:var(--border-color,#c0c0c0);
  --ub-scrollbar-thumb-hover:var(--secondary-text,#555555);
  --ub-text-muted:var(--secondary-text,#555555);
  --ub-bg-card:var(--bg-color,#ffffff);
  /* 日历兄弟弹窗变量·浅色（深色侧在 .dark-mode 块重声明；:root 处已完成替换，表达式带不动深色） */
  --ub-text:var(--text-color,#111111);--ub-divider:var(--border-color,#c0c0c0);--ub-accent:var(--text-color,#111111);--ub-hover-bg:rgba(0,0,0,0.04);
  --ub-popup-radius:2px;
  --ub-popup-shadow:0 8px 32px rgba(0,0,0,0.2);
  --ub-popup-border:1px solid var(--card-border,#111111);
  --ub-popup-bg:var(--bg-color,#ffffff);
  --ub-popup-head-bg:var(--bg-color,#ffffff);
  --ub-popup-head-border:1px solid var(--border-color);
  --ub-btn-radius:2px;
  --ub-toggle-width:44px;--ub-toggle-height:24px;--ub-toggle-knob:20px;
  --ub-ft-ring-start:#b8f5ff;--ub-ft-ring-end:#669cff;--ub-ft-ring-glow:rgba(126,232,255,.34);
  /* === 立绘主题变量 === */
  --portrait-empty-color:#111;
  --portrait-bg:#fafafa;
  --portrait-border:#111;
  --portrait-radius:1px;
  --accent:#111;
  --card-bg:#fff;
}

.en-font{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}

.top-actions{position:relative;display:flex;justify-content:flex-end;gap:6px;align-items:center;z-index:10;margin-bottom:2px}
.theme-toggle{background:transparent;border:1px solid var(--border-color);color:var(--text-color);padding:4px 8px;font-size:10px;cursor:pointer;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;letter-spacing:1px;transition:background-color 0.3s ease,color 0.3s ease,border-color 0.3s ease}
.theme-toggle:hover{background:var(--btn-hover-bg);color:var(--btn-hover-text)}

.sys-header{border-bottom:1px solid var(--card-border);padding-bottom:16px;margin-bottom:8px;text-align:center}
.sys-char-name{font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;font-size:20px;font-weight:700;letter-spacing:2px;color:var(--text-color);margin-bottom:8px;display:block;cursor:pointer;transition:color 0.15s ease,transform 0.1s ease,opacity 0.15s ease;user-select:none}
.sys-char-name:hover{opacity:0.75}
.sys-char-name:active{transform:scale(0.95);opacity:0.6}
.sys-location{font-size:17px;font-weight:700;letter-spacing:1px;margin-bottom:6px;color:var(--text-color)}
.sys-status{font-size:12px;font-style:italic;color:var(--secondary-text);letter-spacing:0.5px;margin-bottom:10px;line-height:1.5}
.sys-meta{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:11px;color:var(--secondary-text);display:flex;justify-content:center;gap:12px}
#sys-time{cursor:pointer}
#sys-time:hover{opacity:0.7}

.section-title{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:14px;font-weight:600;letter-spacing:2px;margin:36px 0 20px 0;display:flex;align-items:center;color:var(--text-color);text-transform:uppercase}
.present-header .section-title{margin:0}
.present-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:0;padding:0}

.info-list{display:flex;flex-direction:column;gap:14px}
.info-row{display:flex;font-size:12px;align-items:flex-start;line-height:1.7}
.panel-popup-body .info-row{font-size:var(--ub-ui-font-12,12px)}
.info-label{color:var(--secondary-text);width:65px;flex-shrink:0;letter-spacing:1px}
.info-value{color:var(--text-color);flex-grow:1;line-height:1.7}
.status-content .info-row{padding:4px 0}


.status-toggle{cursor:pointer;align-items:center}
.status-toggle:hover .info-value{opacity:0.8}
.status-value-box{display:flex;align-items:center;justify-content:space-between;width:100%}
.status-arrow{transition:transform 0.3s ease;color:var(--secondary-text)}
.status-toggle.active .status-arrow{transform:rotate(180deg);color:var(--text-color)}
.status-content{display:none;margin-top:4px;padding-left:12px;border-left:2px solid var(--border-color)}

.detail-content{display:none;margin-top:20px;padding-top:20px;border-top:1px dashed var(--tag-border)}

.btn-line{background:transparent;color:var(--text-color);border:1px solid var(--border-color);padding:5px 12px;font-size:11px;letter-spacing:1px;cursor:pointer;transition:background-color 0.3s ease,color 0.3s ease,border-color 0.3s ease;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif}
.btn-line:hover:not(:disabled){border-color:var(--btn-hover-bg);background:var(--btn-hover-bg);color:var(--btn-hover-text)}
.btn-line:disabled{color:var(--secondary-text);cursor:not-allowed;border-color:var(--tag-border);opacity:0.5}
.wardrobe-protagonist-summary{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-top:5px;padding:4px 10px;border:1px solid var(--border-color);border-radius:0;background:transparent;color:var(--text-muted);font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10px;letter-spacing:1px;line-height:1.35;cursor:pointer;text-align:left;overflow:hidden;transition:background-color .3s ease,color .3s ease,border-color .3s ease}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--secondary-text);font-size:9px;letter-spacing:2px;text-transform:uppercase;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-color);border-left:1px solid var(--border-color);padding-left:6px}
.wardrobe-protagonist-summary:hover{border-color:var(--btn-hover-bg);background:var(--btn-hover-bg);color:var(--btn-hover-text)}
.empty-state{padding:40px 0;text-align:center;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:11px;color:var(--secondary-text);letter-spacing:3px;border:1px dashed var(--border-color);text-transform:uppercase}

.present-header{display:flex;align-items:flex-end;justify-content:flex-start;margin-bottom:0;position:relative}
.present-header::after{content:'';flex-grow:1;height:1px;background:var(--border-color);margin-left:16px;margin-bottom:8px}
.present-header .section-title{margin-bottom:14px}

.char-selector-buttons{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-left:20px}
.char-select-btn{padding:6px 16px;font-size:13px;font-weight:600;border:1px solid var(--card-border);border-bottom-width:0;background:transparent;color:var(--text-color);cursor:pointer;transition:background-color 0.2s ease,color 0.2s ease,border-color 0.2s ease;font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;letter-spacing:1px;border-radius:2px 2px 0 0;position:relative;z-index:1;margin-bottom:1px}
.char-select-btn:hover{background:rgba(0,0,0,0.03)}
.char-select-btn.active{background:var(--bg-color);padding-bottom:8px;margin-bottom:-1px;z-index:3}

.char-card{border:1px solid var(--card-border);padding:24px;margin-bottom:20px;background:transparent;border-radius:0 2px 2px 2px}
.char-card-top-row{display:flex;gap:20px;margin-bottom:24px;align-items:stretch}
@media(min-width:577px){
  .char-card-top-row .portrait-box{flex:0 0 176px;width:176px;height:176px}
}

.diary-preview{flex:0 0 30%;min-width:0;box-sizing:border-box;background:var(--bg-color);border:1px solid var(--card-border);padding:16px 14px;border-radius:1px;display:flex;flex-direction:column;cursor:pointer;transition:opacity 0.2s,border-color 0.2s;position:relative;min-height:120px}
.diary-preview:hover{opacity:0.8;border-color:var(--text-color)}
.diary-preview-title{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--secondary-text);margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed var(--tag-border)}
.diary-preview-content{font-size:12px;line-height:1.7;color:var(--text-color);flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;text-overflow:ellipsis;font-family:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;letter-spacing:0.3px}
.diary-preview-empty{color:var(--secondary-text);font-style:italic;font-size:11px}
.diary-preview-time{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:9px;color:var(--secondary-text);letter-spacing:1px;margin-top:8px}
.diary-preview-ellipsis{font-size:11px;color:var(--secondary-text);margin-top:4px;letter-spacing:1px}

.sticky-note{flex:1 1 50%;flex-grow:1;min-width:0;box-sizing:border-box;background:#fdfdf9;padding:16px 20px;border-radius:1px;box-shadow:0 3px 12px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.06),inset 0 0 60px rgba(0,0,0,0.02);transform:rotate(-0.6deg);position:relative;border-left:4px solid #e8e8e0;display:flex;flex-direction:column;font-family:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;overflow:hidden;min-height:120px}
.sticky-note::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,transparent 48%,rgba(0,0,0,0.02) 49%,rgba(0,0,0,0.02) 51%,transparent 52%),linear-gradient(225deg,transparent 48%,rgba(0,0,0,0.015) 49%,rgba(0,0,0,0.015) 51%,transparent 52%);background-size:24px 24px;pointer-events:none}
.sticky-note::after{content:'';position:absolute;top:-8px;left:50%;transform:translateX(-50%) rotate(1deg);width:56px;height:22px;background:rgba(245,245,235,0.85);box-shadow:0 1px 3px rgba(0,0,0,0.08),inset 0 0 12px rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.05)}
.sticky-note-lines{position:absolute;top:44px;left:0;right:0;bottom:0;background:repeating-linear-gradient(transparent,transparent 27px,rgba(160,180,220,0.2) 27px,rgba(160,180,220,0.2) 28px);pointer-events:none}
.note-content{font-size:15px;line-height:26px;color:#3c3c36;flex-grow:1;transform:rotate(-0.3deg);word-wrap:break-word;position:relative;z-index:1;text-shadow:0 0 1px rgba(0,0,0,0.05);letter-spacing:0.3px;margin-top:4px}
.note-emotion{position:relative;top:auto;right:auto;font-size:12px;display:flex;align-items:center;gap:4px;z-index:2}
/* 顶行：情绪块与操作簇。便签宽是**容器宽**（非视口宽），故换行能力必须无条件写在基类里，
   禁用 @media 断点修（MEMORY 铁律 #19）。行可换行 ⇒ 操作簇在窄屏整行下移，不再被挤成
   「簇吃满整行 + 情绪块顶出右端」；操作簇自身也允许换行且不外扩，超长时内部折行。 */
.note-top-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed rgba(0,0,0,0.06)}
.note-top-actions{display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap;max-width:100%;min-width:0}

.char-tooltip{position:fixed;z-index:10000;background:var(--bg-color);color:var(--text-color);border:1px solid var(--border-color);padding:10px 14px;font-size:12px;line-height:1.6;max-width:240px;box-shadow:0 4px 16px rgba(0,0,0,0.12);pointer-events:none;opacity:0;transition:opacity 0.2s ease;font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;letter-spacing:0.3px}
.char-tooltip.visible{opacity:1}
.char-tooltip-age{color:var(--secondary-text);font-size:11px;margin-bottom:2px;letter-spacing:1px}
.char-tooltip-intro{color:var(--text-color);font-size:12px;font-style:italic}

.nsfw-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(0,0,0,0.4);z-index:10001;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.nsfw-overlay.show{display:flex}
@keyframes nsfw-popup-in{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.name-hoverable{position:relative}
.train-value-clickable{cursor:pointer;transition:opacity 0.2s;border-bottom:1px solid var(--text-color);padding-bottom:1px}
.train-value-clickable:hover{opacity:0.7}

.panel-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(0,0,0,0.4);z-index:10000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.panel-overlay.show{display:flex}
.panel-popup{background:var(--bg-color);border:1px solid var(--card-border);max-width:380px;width:90%;max-height:70vh;min-height:200px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:nsfw-popup-in 0.3s ease}
.panel-popup-head{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0}
.panel-popup-title{font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;font-size:var(--ub-popup-font-title,16px);font-weight:700;letter-spacing:2px;color:var(--text-color);flex:1}
.panel-popup-close,.panel-popup-back{background:transparent;border:1px solid var(--border-color);color:var(--secondary-text);width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all 0.2s;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;flex-shrink:0}
.panel-popup-back{width:auto;padding:0 8px;font-size:11px;letter-spacing:1px;border-radius:2px;margin-right:8px}
.panel-popup-warehouse-toggle{font-size:10px;width:auto;padding:0 10px;height:24px;border:1px solid var(--border-color);background:transparent;color:var(--secondary-text);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin-right:8px;letter-spacing:1px;text-transform:uppercase}
.panel-popup-warehouse-toggle:hover{border-color:var(--text-color);color:var(--text-color)}
.panel-popup-close:hover,.panel-popup-back:hover{border-color:var(--text-color);color:var(--text-color)}
.panel-popup-body{padding:16px 20px;flex:1 1 auto;min-height:0;overflow-y:auto}
.panel-popup-body::-webkit-scrollbar{width:4px}
.panel-popup-body::-webkit-scrollbar-track{background:transparent}
.panel-popup-body::-webkit-scrollbar-thumb{background:var(--border-color);border-radius:2px}
/* 角色信息弹窗 */
.char-info-popup{max-width:420px;width:90%;max-height:80vh;display:flex;flex-direction:column}
.char-info-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px 20px}
.char-info-body::-webkit-scrollbar{width:4px}
.char-info-body::-webkit-scrollbar-track{background:transparent}
.char-info-body::-webkit-scrollbar-thumb{background:var(--border-color);border-radius:2px}
.char-info-panel{display:none}
.char-info-panel.active{display:flex;flex-direction:column;gap:0}
.char-info-card{border:1px solid var(--border-color);padding:16px}
.char-info-card-name{font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;font-size:16px;font-weight:700;letter-spacing:2px;color:var(--text-color);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border-color)}
.char-info-card-rows{display:flex;flex-direction:column;gap:6px}
.char-info-card-rows .info-row{font-size:var(--ub-ui-font-12,12px);align-items:flex-start}
.char-info-card-rows .info-label{width:55px;flex-shrink:0;color:var(--secondary-text);letter-spacing:1px}
.panel-empty{text-align:center;padding:40px 0;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:11px;color:var(--secondary-text);letter-spacing:3px;text-transform:uppercase}

.memo-list-item,.item-list-item,.mission-list-item,.diary-list-item{padding:12px 0;border-bottom:1px solid var(--tag-border);cursor:pointer;transition:opacity 0.2s}
.memo-list-item:hover,.item-list-item:hover,.mission-list-item:hover,.diary-list-item:hover{opacity:0.8}
.memo-list-item:last-child,.item-list-item:last-child,.mission-list-item:last-child,.diary-list-item:last-child{border-bottom:none}
.memo-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.memo-title{font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--text-color);letter-spacing:0.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.memo-type{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:9px;color:var(--secondary-text);padding:2px 6px;border:1px solid var(--tag-border);border-radius:2px;letter-spacing:1px;flex-shrink:0}
.memo-item-sub{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:var(--ub-ui-font-10,10px);color:var(--secondary-text)}
.memo-status,.memo-char,.memo-time-badge{padding:1px 4px;letter-spacing:0.5px;font-size:9px}
.item-top{display:flex;align-items:center;gap:8px}
.item-name{font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--text-color);letter-spacing:0.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item-qty{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10px;font-weight:600;color:var(--text-color);padding:1px 6px;border:1px solid var(--border-color);border-radius:2px;flex-shrink:0;letter-spacing:1px}
.item-type{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:9px;color:var(--secondary-text);padding:2px 6px;border:1px solid var(--tag-border);border-radius:2px;letter-spacing:1px;flex-shrink:0}
.item-wardrobe-badge{display:inline-flex;align-items:center;border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:2px;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:1px;flex-shrink:0;margin-left:4px;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.item-desc{font-size:var(--ub-ui-font-11,11px);color:var(--secondary-text);margin-top:4px;letter-spacing:0.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.mission-list-item{position:relative}
.mission-list-item.completed{opacity:0.7}
.mission-list-item .mission-delete{position:absolute;top:8px;right:0;background:transparent;border:none;color:var(--secondary-text);font-size:14px;cursor:pointer;transition:color 0.2s;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;padding:2px}
.mission-list-item .mission-delete:hover{color:#c04040}
.mission-name{font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--text-color);letter-spacing:0.5px;margin-bottom:4px;padding-right:24px}
.mission-desc{font-size:var(--ub-ui-font-11,11px);color:var(--secondary-text);margin-bottom:6px;line-height:1.5}
.mission-desc-clickable{cursor:pointer;transition:opacity 0.2s}
.mission-desc-clickable:hover{opacity:0.7}
.mission-objective{font-size:var(--ub-ui-font-11,11px);color:var(--secondary-text);padding:8px 10px;background:var(--bg-color);border:1px solid var(--tag-border);border-left:3px solid var(--text-color);line-height:1.6;border-radius:2px}
.mission-status{display:inline-block;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10px;padding:2px 8px;border:1px solid var(--tag-border);border-radius:2px;margin-top:8px;letter-spacing:1px;cursor:pointer;transition:all 0.2s}
.mission-status:hover{opacity:0.8}
.mission-status.pending{color:var(--secondary-text);background:transparent}
.mission-status.completed{color:var(--bg-color);background:var(--text-color);border-color:var(--text-color)}

.diary-item-top{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--secondary-text);margin-bottom:4px}
.diary-time{flex-shrink:0}
.diary-item-content{font-size:var(--ub-ui-font-12,12px);color:var(--secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.3px}


.panel-popup-body .detail-content{display:block;margin-top:12px;padding-top:12px;border-top:1px solid var(--tag-border)}
.panel-popup-body .detail-content .dc-label{color:var(--secondary-text);font-size:10px;letter-spacing:1px;text-transform:uppercase;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin-bottom:6px;display:block}
.panel-popup-body .detail-content .dc-text{color:var(--text-color);font-size:var(--ub-ui-font-12,12px);line-height:1.8}
.item-detail-actions{display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--tag-border)}
.item-detail-actions .btn-line{flex:1;text-align:center}
.item-discard-btn{color:#c04040;border-color:#c04040}
.item-warehouse-btn{color:var(--secondary-text);border-color:var(--border-color)}
.item-warehouse-btn:hover{border-color:var(--text-color);color:var(--text-color)}
.diary-detail-writer{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;font-size:13px;color:var(--text-color);letter-spacing:1px;margin-bottom:10px}
.diary-nav-btn{flex:0 0 auto;width:26px;height:26px;line-height:24px;text-align:center;border:1px solid var(--border-color);border-radius:50%;background:transparent;color:var(--text-color);cursor:pointer;font-size:var(--ub-ui-font-10,10px);padding:0;transition:opacity .2s,border-color .2s}
.diary-nav-btn:hover:not(:disabled){opacity:.8;border-color:var(--text-color)}
.diary-nav-btn:disabled{opacity:.3;cursor:default}
.diary-nav-indicator{text-align:center;font-size:var(--ub-ui-font-10,10px);color:var(--secondary-text);margin-top:8px;letter-spacing:1px}
.diary-content{padding:10px 0}
.diary-content .dc{color:var(--secondary-text);font-size:12px;line-height:1.9;font-style:italic}

/* ===== 日记本背景 ===== */
.diary-notebook{position:relative;padding:24px 28px;margin:10px 0;background:linear-gradient(180deg,#fdfdf9 0%,#f7f7f0 100%);border:1px solid var(--border-color);border-radius:1px;box-shadow:0 2px 8px rgba(0,0,0,0.06),inset 0 0 30px rgba(0,0,0,0.02)}
.diary-notebook::before{content:'';position:absolute;top:0;left:40px;bottom:0;width:1px;background:rgba(180,180,180,0.3);pointer-events:none;z-index:1}
.diary-notebook::after{content:'';position:absolute;top:0;left:44px;bottom:0;width:1px;background:rgba(180,180,180,0.15);pointer-events:none;z-index:1}
.diary-notebook-lines{position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(transparent,transparent 27px,rgba(160,180,220,0.15) 27px,rgba(160,180,220,0.15) 28px);pointer-events:none;z-index:0}
.diary-notebook .diary-content{position:relative;z-index:1;padding:0}
.diary-notebook .diary-content .dc{font-family:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;font-size:14px;line-height:28px;color:var(--text-color);font-style:normal;letter-spacing:0.5px}
/* 铅笔划掉线 — 粗线，石墨色 */
.diary-notebook .diary-content .dc .strikethrough{text-decoration:line-through;text-decoration-thickness:0.12em;text-decoration-color:#888;opacity:0.7}
/* 水彩笔标记 — 半透明藤黄色块 */
.diary-notebook .diary-content .dc .highlight{background:linear-gradient(180deg,rgba(255,235,160,0.5) 0%,rgba(250,220,140,0.58) 100%);padding:2px 6px;border-radius:3px 7px 4px 5px;box-shadow:0 0 0 1px rgba(220,200,130,0.16),inset 0 -1px 2px rgba(200,180,120,0.1)}
/* 蜡笔波浪下划线 — 灰蓝色 */
.diary-notebook .diary-content .dc .underline{text-decoration:underline;text-decoration-style:wavy;text-decoration-thickness:from-font;text-underline-offset:4px;text-decoration-color:#8899bb}
/* 圆珠笔圈圈标注 */
.diary-notebook .diary-content .dc .emphasis{display:inline-block;border:2px solid #667788;border-radius:42% 58% 55% 45% / 48% 45% 55% 52%;padding:0 5px;transform:rotate(-0.5deg);color:inherit;font-weight:600}
/* 铅笔手写体 */
.diary-notebook .diary-content .dc .handwritten{font-family:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi","楷体",cursive;font-size:15px;color:#2c2c2c;text-shadow:0.5px 0.5px 0 rgba(0,0,0,0.06);letter-spacing:0.3px}
/* 潦草字迹 */
.diary-notebook .diary-content .dc .messy{display:inline-block;transform:rotate(-1.2deg) translateY(1px);font-family:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi","楷体",cursive;font-size:14px;color:#3a3a3a;text-shadow:0.5px 1px 0 rgba(0,0,0,0.05);letter-spacing:-0.2px}
/* 铅笔涂改遮盖 — 石墨色柔和斜线 */
.diary-notebook .diary-content .dc .censored{position:relative;color:rgba(0,0,0,0.25);padding:0 4px;border-radius:2px;cursor:pointer;transition:all 0.3s;background-color:rgba(0,0,0,0.04);background-image:repeating-linear-gradient(-5deg,transparent,transparent 2.5px,rgba(120,120,120,0.32) 2.5px,rgba(120,120,120,0.32) 3.5px),repeating-linear-gradient(12deg,transparent,transparent 3px,rgba(140,140,140,0.25) 3px,rgba(140,140,140,0.25) 4px),repeating-linear-gradient(-18deg,transparent,transparent 3.5px,rgba(100,100,100,0.28) 3.5px,rgba(100,100,100,0.28) 4.5px);background-repeat:repeat;background-size:24px 24px}
.diary-notebook .diary-content .dc .censored:hover{background-image:none;background-color:transparent;color:inherit;padding:0 4px}
.dark-mode .diary-notebook{background:linear-gradient(180deg,#1e1e1e 0%,#1a1a1a 100%);border-color:var(--border-color);box-shadow:0 2px 8px rgba(0,0,0,0.2),inset 0 0 30px rgba(0,0,0,0.1)}
.dark-mode .diary-notebook::before{background:rgba(80,80,80,0.2)}
.dark-mode .diary-notebook::after{background:rgba(80,80,80,0.1)}
.dark-mode .diary-notebook-lines{background:repeating-linear-gradient(transparent,transparent 27px,rgba(160,180,220,0.08) 27px,rgba(160,180,220,0.08) 28px)}
.dark-mode .diary-notebook .diary-content .dc{color:var(--text-color)}
/* 深色 — highlight 暖金 */
.dark-mode .diary-notebook .diary-content .dc .highlight{background:linear-gradient(180deg,rgba(255,235,160,0.35) 0%,rgba(245,220,140,0.42) 100%);box-shadow:0 0 0 1px rgba(220,200,130,0.14),inset 0 -1px 2px rgba(200,180,120,0.08)}
/* 深色 — underline 亮灰蓝 */
.dark-mode .diary-notebook .diary-content .dc .underline{text-decoration-color:#aabbcc}
/* 深色 — emphasis 亮灰 */
.dark-mode .diary-notebook .diary-content .dc .emphasis{border-color:#99aabb;color:var(--text-color)}
/* 深色 — strikethrough 亮灰 */
.dark-mode .diary-notebook .diary-content .dc .strikethrough{text-decoration-color:#aaa}
.dark-mode .diary-notebook .diary-content .dc .handwritten{color:#e0e0e0}
.dark-mode .diary-notebook .diary-content .dc .messy{color:#d0d0d0}
/* 深色 — 涂改遮盖：浅灰柔和斜线 */
.dark-mode .diary-notebook .diary-content .dc .censored{color:rgba(240,240,240,0.22);background-color:rgba(180,180,180,0.05);background-image:repeating-linear-gradient(-5deg,transparent,transparent 2.5px,rgba(190,190,190,0.3) 2.5px,rgba(190,190,190,0.3) 3.5px),repeating-linear-gradient(12deg,transparent,transparent 3px,rgba(200,200,200,0.24) 3px,rgba(200,200,200,0.24) 4px),repeating-linear-gradient(-18deg,transparent,transparent 3.5px,rgba(180,180,180,0.26) 3.5px,rgba(180,180,180,0.26) 4.5px)}
.dark-mode .diary-notebook .diary-content .dc .censored:hover{background-image:none;background-color:transparent;color:inherit}
.diary-detail-popup{max-width:520px !important}

.train-bar-wrap{display:flex;align-items:center;gap:8px;width:100%}
.train-bar{flex:1;height:4px;background:var(--tag-border);border-radius:2px;overflow:hidden}
.train-fill{height:100%;background:var(--text-color);border-radius:2px;transition:width 0.5s ease}
.train-value{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10px;color:var(--secondary-text);letter-spacing:0.5px;min-width:48px;text-align:right;flex-shrink:0}

.click-heart{position:fixed;pointer-events:none;z-index:9999;font-size:14px;color:var(--text-color);opacity:0.5;animation:heart-rise 1.5s ease-out forwards}
.click-text{position:fixed;pointer-events:none;z-index:9999;font-size:11px;color:var(--secondary-text);white-space:nowrap;animation:text-drift 1.8s ease-out forwards;opacity:0.6;letter-spacing:0.5px}
@keyframes heart-rise{0%{opacity:0.5;transform:translateY(0) scale(0.5)}30%{opacity:0.5;transform:translateY(-20px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(0.3)}}
@keyframes text-drift{0%{opacity:0;transform:translateY(0) scale(0.8)}15%{opacity:0.6;transform:translateY(-10px) scale(1)}100%{opacity:0;transform:translateY(-50px) translateX(var(--drift-x,20px)) scale(0.6)}}

.play-section{margin-top:28px;padding-top:20px;border-top:1px solid var(--card-border)}
.play-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px;flex-wrap:wrap}
.play-section.collapsed .play-grid{display:none}
.play-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.play-select{flex:1;width:100%;max-width:160px;background:var(--bg-color);background-color:var(--bg-color)!important;color:var(--text-color)!important;border:1px solid var(--border-color)!important;padding:4px 8px;font-size:11px;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;outline:none;cursor:pointer;transition:border-color 0.2s;appearance:none;border-radius:2px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center}
.play-select:focus{border-color:var(--text-color)}
.play-select option{background:var(--bg-color)!important;color:var(--text-color)!important}
.play-collapse-btn{background:transparent;border:1px solid var(--border-color);color:var(--secondary-text);width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:all 0.2s;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin-right:8px;border-radius:2px}
.play-collapse-btn:hover{border-color:var(--text-color);color:var(--text-color)}
.energy-badge{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10px;color:var(--secondary-text);letter-spacing:1px;padding:4px 8px;border:1px solid var(--border-color);border-radius:2px;margin-right:8px}
/* 钱包入口（F35）：紧贴 ⚡ 徽章，取 .energy-badge 同几何（等宽小徽章）；此排最挤故只显「图标+余额」，
   币名在 title；深色由 .minimal-container.dark-mode 变量块自动覆盖（单色系）。 */
.ub-wallet-entry{font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10px;color:var(--text-color);letter-spacing:1px;padding:4px 8px;border:1px solid var(--border-color);border-radius:2px;margin-right:8px;background:var(--card);display:inline-flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;--ub-danger:#c0392b}
.ub-wallet-entry:hover{border-color:var(--text-color)}
.ub-wallet-entry b{font-weight:700;font-variant-numeric:tabular-nums}
.ub-wallet-entry b.neg{color:var(--ub-danger)}
.ub-wallet-entry.ub-wallet-empty{opacity:.55;border-style:dashed}
.minimal-container.dark-mode .ub-wallet-entry{--ub-danger:#ff8f8f}
.item-use-toggle{background:transparent;color:var(--text-color);border:1px solid var(--border-color);padding:4px 8px;font-size:10px;letter-spacing:1px;cursor:pointer;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;transition:background-color 0.3s ease,color 0.3s ease,border-color 0.3s ease;border-radius:2px}
.item-use-toggle:hover{background:var(--btn-hover-bg);color:var(--btn-hover-text)}
.item-use-toggle.active{background:var(--text-color);color:var(--bg-color);border-color:var(--text-color)}
.nsfw-guidance-btn{background:var(--text-color);color:var(--bg-color);border:1px solid var(--text-color);padding:4px 8px;font-size:10px;letter-spacing:1px;cursor:pointer;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;transition:all .3s ease;border-radius:2px;white-space:nowrap}
.nsfw-guidance-btn:hover{background:var(--btn-hover-bg);color:var(--btn-hover-text)}
.nsfw-guidance-btn:disabled{opacity:.5;cursor:wait}

.settings-btn{background:transparent;border:1px solid var(--border-color);color:var(--secondary-text);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s ease;flex-shrink:0;width:24px;height:24px;border-radius:50%;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.settings-btn:hover{border-color:var(--text-color);background:var(--btn-hover-bg);color:var(--btn-hover-text)}
/* 场景一键切换按钮 */
.scene-btn{background:transparent;border:1px solid var(--border-color);color:var(--secondary-text);font-size:10px;letter-spacing:1px;cursor:pointer;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;transition:all .3s ease;border-radius:2px;padding:4px 8px;flex-shrink:0}
.scene-btn:hover{border-color:var(--text-color);background:var(--btn-hover-bg);color:var(--btn-hover-text)}
.scene-btn:disabled{opacity:0.5;cursor:not-allowed}
.scene-btn.scene-active-daily{border-color:var(--text-color);color:var(--text-color);background:transparent}
.scene-btn.scene-active-nsfw{border-color:var(--text-color);color:var(--bg-color);background:var(--text-color)}
.settings-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(0,0,0,0.4);z-index:10002;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.settings-overlay.show{display:flex}
.settings-popup{background:var(--bg-color,#ffffff);border:1px solid var(--card-border,#111111);max-width:320px;width:90%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:nsfw-popup-in 0.3s ease}
.settings-popup-head{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0}
.settings-popup-title{font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;font-size:var(--ub-popup-font-title,15px);font-weight:700;letter-spacing:2px;color:var(--text-color);flex:1}
.settings-popup-close{background:transparent;border:1px solid var(--border-color);color:var(--secondary-text);width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all .2s;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;border-radius:50%}
.settings-popup-close:hover{border-color:var(--text-color);color:var(--text-color)}
.settings-tabs{display:flex;border-bottom:1px solid var(--border-color);padding:0 20px;background:var(--bg-color)}
.settings-tab{flex:1;padding:12px 8px;border:none;background:transparent;color:var(--secondary-text);font-size:14px;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;letter-spacing:1px;cursor:pointer;transition:all .2s;position:relative;font-weight:500}
.settings-tab:hover{color:var(--text-color);background:rgba(0,0,0,0.03)}
.settings-tab.active{color:var(--text-color);font-weight:600;background:rgba(0,0,0,0.05)}
.settings-tab.active::after{content:'';position:absolute;bottom:-1px;left:10%;right:10%;height:2px;background:var(--card-border)}
.settings-popup-body{padding:16px 20px;min-height:120px;overflow-y:auto;flex:1}
.settings-tab-content{display:none}
.settings-tab-content.active{display:block;animation:fade-in .2s ease}
.settings-section{margin:14px 0;padding:12px 14px;border-radius:6px;background:rgba(0,0,0,0.02);border:1px solid var(--tag-border)}
@keyframes fade-in{from{opacity:0}to{opacity:1}}
.settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--tag-border)}
.settings-row:last-child{border-bottom:none}
.settings-label{font-size:var(--ub-ui-font-13,13px);color:var(--text-color);letter-spacing:1px}
.settings-toggle{width:44px;height:24px;border-radius:12px;background:var(--tag-border);cursor:pointer;position:relative;transition:background .2s;border:none;padding:0}
.settings-toggle.on{background:var(--text-color)}
/* 深色：--text-color 翻为近白，白色旋钮在 ON 轨道上不可见（H10），ON 轨道改中灰 */
.dark-mode .settings-toggle.on{background:#666}
.settings-toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.settings-toggle.on::after{transform:translateX(20px)}

.investigate-btn{font-size:10px;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif CJK SC","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;cursor:pointer;padding:2px 8px;border:1px solid var(--border-color);background:transparent;color:var(--secondary-text);letter-spacing:1px;transition:all .2s;white-space:nowrap;border-radius:2px;flex-shrink:0}
.investigate-btn:hover{border-color:var(--text-color);background:var(--btn-hover-bg);color:var(--btn-hover-text)}
@keyframes popup-in{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}

@media(max-width:576px){
  .char-card-top-row{flex-direction:column;align-items:center;gap:16px}
  .sticky-note{width:100%;transform:rotate(0deg);box-sizing:border-box}
  .diary-preview{width:100%;box-sizing:border-box}
  .note-content{transform:rotate(0deg)}
  .minimal-container{padding:16px 12px}
  .play-grid{grid-template-columns:repeat(2,1fr);gap:8px}
  .top-actions{flex-wrap:wrap;gap:4px;margin-bottom:4px}
  .present-actions{flex-wrap:wrap}
  .present-header{flex-wrap:wrap}
  .char-selector-buttons{margin-left:0;margin-top:8px}
  /* 增大移动端触摸目标 */
  .settings-btn,.play-collapse-btn{min-width:32px;min-height:32px}
  .char-select-btn{min-height:36px;padding:8px 14px;font-size:12px}
  .btn-line{min-height:32px;padding:6px 14px;font-size:11px}
}

/* ===== 固定模式折叠状态 ===== */
#ac-statusbar-wrapper.ub-collapsed{display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:hidden!important}

/* 新手帮助提示按钮 */
.help-tip-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid var(--border-color);background:transparent;color:var(--secondary-text);font-size:10px;font-weight:bold;cursor:help;flex-shrink:0;line-height:1;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;transition:all .2s}
.help-tip-btn:hover{border-color:var(--text-color);color:var(--text-color)}

.help-tooltip-global{position:fixed;z-index:100000;max-width:260px;padding:10px 14px;border-radius:4px;background:var(--bg-color);border:1px solid var(--border-color);color:var(--text-color);font-size:11px;line-height:1.7;letter-spacing:0.5px;white-space:pre-line;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.2)}
/* === 过往经历时间轴 · 萦绕（极简，变量驱动，含 dark-mode 继承） === */
.pe-intro{border-left:2px solid var(--border-color,#e0e0e0);padding-left:10px;background:transparent}
.pe-intro-label{color:var(--secondary-text,#666);font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',sans-serif}
.pe-intro-text{color:var(--text-color,#111)}
.pe-rail::before{background:var(--border-color,#e0e0e0)}
.pe-dot{background:var(--bg-color,#fff);border:1.5px solid var(--secondary-text,#666);width:11px;height:11px;top:5px}
.pe-date{color:var(--secondary-text,#666);font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;letter-spacing:1.5px;font-weight:600}
.pe-card{color:var(--text-color,#111);background:transparent;border:none;border-left:1px solid var(--divider-light,#eaeaea);padding-left:10px}
/* === db 弹窗 token 桥接：minimal :root 定义 --card 非 --card-light，补 --card-light（text/divider 已定义；accent=#ddd 系极简审美不动） === */
.db-viewer-popup,.db-row-detail-popup,.db-confirm-popup{--card-light:var(--card)}
` + baseCSS + /* css */ `
/* 角色中枢 / 剧情回顾：留白档案 */
.char-hub-theme-minimal,.chronicle-reader-theme-minimal{--hub-bg:var(--card);--hub-panel:var(--bg-color);--hub-line:var(--border-color);--hub-ink:var(--text-color);--hub-muted:var(--secondary-text);--hub-accent:var(--text-color);--hub-soft:transparent;--hub-day:transparent;--hub-night:#f0f0f2;--hub-night-ink:var(--hub-ink);--hub-pref:var(--hub-accent)}
.char-hub-theme-minimal .char-hub-gsym.is-female{color:#d63384}.char-hub-theme-minimal .char-hub-gsym.is-male{color:#3a7bd5}
.char-hub-theme-minimal .char-hub-lead-banner{background:transparent;border-inline-start:2px solid var(--hub-accent)}
.char-hub-theme-minimal .char-hub-action--investigate{color:#3a7bd5;border-color:var(--hub-line);background:transparent}
.char-hub-theme-minimal .char-hub-action--interview{color:#3a8a5a;border-color:var(--hub-line);background:transparent}
.char-hub-theme-minimal .char-hub-identity,.chronicle-reader-theme-minimal .chronicle-reader-card{border-color:var(--hub-line);background:var(--hub-bg);box-shadow:none}
.char-hub-theme-minimal .char-hub-card{border-width:0 0 1px;background:transparent}.char-hub-theme-minimal .char-hub-card:hover{transform:none}
.char-hub-theme-minimal .char-hub-profile-lede{border-width:0 0 0 2px;background:transparent}.char-hub-theme-minimal .char-hub-profile-lede>span{display:none}
.char-hub-theme-minimal .char-hub-prose-card,.char-hub-theme-minimal .char-hub-logic{border-width:1px 0 0;background:transparent}.char-hub-theme-minimal .char-hub-section-kicker{text-transform:uppercase;letter-spacing:.14em}
.char-hub-theme-minimal .char-hub-logic-index{border:0;border-bottom:2px solid var(--hub-accent)}
.char-hub-theme-minimal .char-hub-trait-balance{gap:0;border:1px solid var(--hub-line)}.char-hub-theme-minimal .char-hub-trait-column{border:0;background:transparent}.char-hub-theme-minimal .char-hub-trait-column+ .char-hub-trait-column{border-left:1px solid var(--hub-line)}
.char-hub-theme-minimal .char-hub-relation-card{border-width:1px 0 0;background:transparent}.char-hub-theme-minimal .char-hub-relation-avatar{border-width:0 0 1px;background:transparent}
.char-hub-theme-minimal .char-hub-history-preview{gap:0;border-top:1px solid var(--hub-line)}.char-hub-theme-minimal .char-hub-history-background,.char-hub-theme-minimal .char-hub-history-latest{border-width:0;background:transparent}.char-hub-theme-minimal .char-hub-history-latest{border-left:1px solid var(--hub-line)}
.char-hub-theme-minimal .char-hub-not-equal{border-width:1px 0;background:transparent}.char-hub-theme-minimal .char-hub-not-equal-label{background:transparent}
.char-hub-theme-minimal .char-hub-intimacy-slip{border-width:1px 0 0;background:transparent}.char-hub-theme-minimal .char-hub-intimacy-slip header span{letter-spacing:.18em}
.char-hub-theme-minimal .char-hub-vitals-strip,.char-hub-theme-minimal .char-hub-vitals-raw,.char-hub-theme-minimal .char-hub-nsfw-card,.char-hub-theme-minimal .char-hub-dual-stat{border-radius:0;background:transparent;box-shadow:none;border-width:1px 0 0}
.char-hub-theme-minimal .char-hub-speech{border-radius:0;box-shadow:none}
.char-hub-theme-minimal .char-hub-speech-day{background:transparent}
.panel-overlay.dark .char-hub-theme-minimal{--hub-day:transparent;--hub-night:#242426;--hub-night-ink:var(--hub-ink);--hub-pref:var(--hub-accent)}
.char-hub-theme-minimal .char-hub-ms-hero{border-top:2px solid var(--hub-ink);border-bottom:1px solid var(--hub-line);padding:8px 2px;margin:0 0 6px;justify-content:space-between}
.char-hub-theme-minimal .char-hub-ms-hero b{font-size:22px}
.char-hub-theme-minimal .char-hub-ms-node{width:auto;height:auto;border:0;background:none;font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.5px;min-width:64px;text-align:left;cursor:pointer;padding:0}
.char-hub-theme-minimal .char-hub-ms-item.is-latest .char-hub-ms-node{color:var(--hub-accent);font-weight:700}
.char-hub-theme-minimal .char-hub-ms-item.is-latest .char-hub-ms-desc{font-weight:600}
body.dark-mode .char-hub-theme-minimal .char-hub-ms-node{color:var(--hub-muted)}
body.dark-mode .char-hub-theme-minimal .char-hub-ms-item.is-latest .char-hub-ms-node{color:var(--hub-accent)}
.char-hub-theme-minimal{--ms-cat-first:#7a6a5a;--ms-cat-relation:#a8564e;--ms-cat-status:#4f7f8a}
body.dark-mode .char-hub-theme-minimal{--ms-cat-first:#b8a892;--ms-cat-relation:#d98a7a;--ms-cat-status:#8fc1c9}
.chronicle-reader-theme-minimal .chronicle-timeline-node{width:7px;height:7px;border-radius:0;background:var(--hub-bg);box-shadow:0 0 0 1px var(--hub-accent)}
.chronicle-reader-theme-minimal .chronicle-timeline-content{border-width:1px 0 0;background:transparent;box-shadow:none}.chronicle-reader-theme-minimal .chronicle-timeline-content:hover{transform:none}
.chronicle-reader-theme-minimal .chronicle-detail-text{border-width:1px 0 0;border-inline-start:0;background:transparent;box-shadow:none}.chronicle-reader-theme-minimal .chronicle-detail-dialogue{border-width:1px 0 0;background:transparent;box-shadow:none}
.chronicle-reader-theme-minimal .chronicle-dialogue-line{border-width:1px 0 0;background:transparent}.chronicle-reader-theme-minimal .chronicle-dialogue-speaker{border-width:0 0 1px;background:transparent}
/* ===== ★ 主角立绘摆位：身份栏顶部居中（证件卡式） ===== */
.sys-header .portrait-box{flex:0 0 96px;width:96px;height:96px;margin:0 auto 12px;display:block}
@media (max-width:576px){
  .sys-header .portrait-box{flex-basis:72px;width:72px;height:72px;margin-bottom:8px}
}
`;
