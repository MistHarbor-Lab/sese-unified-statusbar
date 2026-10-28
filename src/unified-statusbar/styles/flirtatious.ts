// ===== 鐟熺憻鐏垫劅鐘舵€佹爮 - 瀹屾暣CSS =====
import { baseCSS } from './base';
export const flirtatiousCSS = /* css */ `
#ac-statusbar-wrapper,:where(#ac-statusbar-wrapper *){margin:0;padding:0;box-sizing:border-box}
:root{
  /* U38③：全局语义色补齐（与 ancient 同族；深色组内字面量重定义） */
  --ub-success:#3F6A52;--ub-warning:#8A5B14;--ub-danger:#A13B34;
  --card:#fffafd;--head-from:#f1e6f8;--head-to:#e9d8f2;
  --accent:#d060a0;--accent-deep:#b04878;--accent-soft:#f0c0d8;--accent-glow:rgba(208,96,160,0.10);
  --lust:#9050c0;--lust-deep:#7838a8;--lust-soft:#d8c0f0;--lust-glow:rgba(144,80,192,0.10);
  --text:#34223f;--text-sub:#695575;--text-muted:#8f799b;
  --divider:#d9c4df;--divider-light:#ebdfed;--bg-alt:#f7eef9;
  --shimmer-a:rgba(255,255,255,0.25);--shimmer-transparent:transparent;
  --lust-bg-faint:rgba(144,80,192,0.04);--lust-bg:rgba(144,80,192,0.06);
  --lust-bg-hover:rgba(144,80,192,0.1);--lust-bg-active:rgba(144,80,192,0.12);
  --lust-bg-strong:rgba(144,80,192,0.15);--lust-border:rgba(144,80,192,0.15);
  --lust-border-soft:rgba(144,80,192,0.2);
  --accent-bg:rgba(208,96,160,0.1);--accent-bg-faint:rgba(208,96,160,0.08);
  --accent-bg-hover:rgba(208,96,160,0.15);
  /* === 缁熶竴鍙橀噺鍒悕 === */
  --ub-overlay-bg:rgba(0,0,0,0.5);
  --ub-scrollbar-thumb:var(--divider);
  --ub-scrollbar-thumb-hover:var(--lust-soft);
  --ub-text-muted:var(--text-muted);
  --ub-bg-card:var(--card);
  /* 日历兄弟弹窗（长按额外要求 / 事件编辑）挂在 #panelOverlay 直下、不在 .cal-theme-* 内，
     够不到 calendar-base.ts 的弹窗级桥接 → 主题级补同一组变量（浅/深各一套，值取本主题 token） */
  --ub-text:var(--text,#3a2a4a);--ub-divider:var(--divider,#ecdce8);--ub-accent:var(--accent,#d060a0);--ub-hover-bg:var(--lust-bg,rgba(144,80,192,0.06));
  --ub-popup-radius:12px;
  --ub-popup-shadow:0 8px 32px rgba(0,0,0,0.3);
  --ub-popup-border:1px solid var(--divider);
  --ub-popup-bg:var(--card);
  --ub-popup-head-bg:linear-gradient(180deg,var(--head-from),var(--head-to));
  --ub-popup-head-border:1px solid var(--divider);
  --ub-btn-radius:4px;
  --ub-toggle-width:44px;--ub-toggle-height:24px;--ub-toggle-knob:20px;
  --ub-ft-ring-start:#f293bd;--ub-ft-ring-end:#9b61d4;--ub-ft-ring-glow:rgba(208,96,160,.38);
  /* === 立绘主题变量 === */
  --portrait-empty-color:#d060a0;
  --portrait-bg:#fbeaf5;
  --portrait-border:#d060a0;
  --portrait-radius:8px;
  --card-bg:var(--card);
}
#ac-content.dark,
.nsfw-overlay.dark,
.panel-overlay.dark,
.settings-overlay.dark,
#ac-options-bar-floating.dark{
  /* U38③：语义色深色档（字面量重定义） */
  --ub-success:#77B18C;--ub-warning:#D7AC5C;--ub-danger:#E4776D;
  --card:#1c1c1e;--head-from:#2c2c2e;--head-to:#242426;
  --accent:#ff89b3;--accent-deep:#ffa0c4;--accent-soft:#3a1828;--accent-glow:rgba(255,137,179,0.12);
  --lust:#ff6a9e;--lust-deep:#ff82b0;--lust-soft:#301020;--lust-glow:rgba(255,106,158,0.12);
  --text:#e8e8ea;--text-sub:#a8a8ae;--text-muted:#6e6e73;
  --divider:#38383a;--divider-light:#2c2c2e;--bg-alt:#1c1c1e;
  --shimmer-a:rgba(255,137,179,0.06);--shimmer-transparent:rgba(255,137,179,0.06);
  --lust-bg-faint:rgba(255,106,158,0.04);--lust-bg:rgba(255,106,158,0.06);
  --lust-bg-hover:rgba(255,106,158,0.1);--lust-bg-active:rgba(255,106,158,0.12);
  --lust-bg-strong:rgba(255,106,158,0.15);--lust-border:rgba(255,106,158,0.15);
  --lust-border-soft:rgba(255,106,158,0.2);
  --accent-bg:rgba(255,137,179,0.1);--accent-bg-faint:rgba(255,137,179,0.08);
  --accent-bg-hover:rgba(255,137,179,0.15);
  --ub-overlay-bg:rgba(0,0,0,0.55);
  --ub-scrollbar-thumb:var(--divider);
  --ub-scrollbar-thumb-hover:var(--lust-soft);
  --ub-text-muted:var(--text-muted);
  --ub-bg-card:var(--card);
  /* 日历兄弟弹窗变量·深色（字面量兜底；:root 处已按浅色完成替换，深色必须重声明，见 ios.ts 同款注释） */
  --ub-text:var(--text,#e8e8ea);--ub-divider:var(--divider,#38383a);--ub-accent:var(--accent,#ff89b3);--ub-hover-bg:rgba(255,255,255,0.05);
  --ub-popup-radius:12px;
  --ub-popup-shadow:0 8px 32px rgba(0,0,0,0.4);
  --ub-popup-border:1px solid var(--divider);
  --ub-popup-bg:var(--card);
  --ub-popup-head-bg:linear-gradient(180deg,var(--head-from),var(--head-to));
  --ub-popup-head-border:1px solid var(--divider);
  /* === 立绘主题变量（深色覆盖） === */
  --portrait-bg:#3a2a3a;
  --portrait-empty-color:#b85090;
  --card-bg:var(--card);
}
#ac-statusbar-wrapper{font-family:'Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei',sans-serif;background:transparent;color:var(--text);padding:0;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}

.book{width:100%;background:var(--card);overflow:visible;position:relative;border-radius:2px;transition:box-shadow .6s ease}
/* NSFW 边框：静态粉光描边+发光（原 nsfw-breathe 50% 帧），不再每帧重绘 */
.book.nsfw-border{box-shadow:inset 0 -1px 0 var(--divider-light),inset 0 1px 0 var(--divider-light),0 0 0 3px rgba(255,137,179,0.32),0 0 32px rgba(255,137,179,0.18),0 0 16px var(--lust-glow)}

.book-head{background:linear-gradient(180deg,var(--head-from),var(--head-to));padding:10px 18px 10px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:8px}
.book-head::before{content:'';position:absolute;top:0;left:0;width:60%;height:100%;background:linear-gradient(90deg,transparent,var(--shimmer-a),var(--shimmer-transparent));pointer-events:none}
.book-head-left{display:flex;align-items:center;gap:8px;position:relative;z-index:1}
.book-head-right{display:flex;align-items:center;gap:6px;position:relative;z-index:1;flex-shrink:0}
.book-head-location{font-size:11px;color:var(--text-muted);letter-spacing:.5px}
.book-head-time{font-size:10px;color:var(--text-muted);letter-spacing:.3px;cursor:pointer}
.book-head-time:hover{opacity:0.7}
.book-head-main{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--divider-light);background:linear-gradient(180deg,var(--lust-glow),transparent)}
.book-head-main-left{display:flex;flex-direction:column;gap:3px}
.book-head-main-right{display:flex;align-items:center;gap:8px}
.main-char-name{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:15px;font-weight:600;color:var(--lust-deep);letter-spacing:1.5px}
.main-char-status{font-size:11px;color:var(--text-muted);letter-spacing:.3px}
.wardrobe-protagonist-summary{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-top:5px;padding:4px 10px;border:1px solid var(--lust-border-soft);border-radius:6px;background:var(--lust-bg-faint);color:var(--text-muted);font-size:11px;letter-spacing:.3px;line-height:1.35;cursor:pointer;text-align:left;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.wardrobe-protagonist-summary .wr-sum-label{color:var(--lust-deep);font-weight:600;flex-shrink:0}
.wardrobe-protagonist-summary .wr-sum-items{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-sub);border-left:1px solid var(--lust-border-soft);padding-left:6px}
.wardrobe-protagonist-summary:hover{border-color:var(--lust);box-shadow:0 0 8px var(--lust-glow)}

.theme-btn,.memo-head-btn,.item-head-btn{background:transparent;border:1px solid var(--divider);border-radius:4px;color:var(--text-muted);font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;letter-spacing:.5px;flex-shrink:0;transition:all .2s;white-space:nowrap}
.theme-btn:hover,.memo-head-btn:hover,.item-head-btn:hover{border-color:var(--lust);color:var(--lust)}
.memo-head-btn,.item-head-btn{border-color:var(--lust-border-soft);color:var(--lust);background:var(--lust-bg-faint);font-weight:500}
.memo-head-btn:hover,.item-head-btn:hover{background:var(--lust-bg-hover);box-shadow:0 0 8px var(--lust-glow)}
.energy-value{font-size:11px;color:var(--lust-deep);font-weight:600;letter-spacing:.5px;padding:3px 8px;background:var(--lust-bg-faint);border:1px solid var(--lust-border-soft);border-radius:4px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:3px}
/* 钱包入口（F35）：紧贴能量值，与 .energy-value 同几何同字号（色系 lust→accent）；
   深色由 #ac-content.dark 变量块自动覆盖。 */
.ub-wallet-entry{font-size:11px;color:var(--accent-deep);font-weight:600;letter-spacing:.5px;padding:3px 8px;background:var(--accent-bg-faint);border:1px solid var(--accent-bg-hover);border-radius:4px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:3px;cursor:pointer;--ub-danger:#c0392b}
.ub-wallet-entry:hover{background:var(--accent-bg)}
.ub-wallet-entry b{font-weight:800}
.ub-wallet-entry b.neg{color:var(--ub-danger)}
.ub-wallet-entry.ub-wallet-empty{opacity:.55;border-style:dashed}
#ac-content.dark .ub-wallet-entry{--ub-danger:#ff8f8f}
.lottery-head-btn{background:linear-gradient(135deg,var(--accent-bg),var(--lust-bg));border:1px solid var(--accent);border-radius:4px;color:var(--accent-deep);font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;letter-spacing:.5px;flex-shrink:0;transition:all .2s;white-space:nowrap;font-weight:500}
.lottery-head-btn:hover{background:var(--accent-bg-hover);box-shadow:0 0 8px var(--accent-glow);filter:brightness(1.08)}

/* 浅色模式层级：标题承载区 > 内容卡片 > 操作按钮。 */
#ac-content:not(.dark) .book{box-shadow:0 10px 28px rgba(74,42,92,.12),0 0 0 1px var(--divider)}
#ac-content:not(.dark) .book-head{border-bottom:1px solid var(--divider)}
#ac-content:not(.dark) .book-head-main{background:linear-gradient(180deg,rgba(144,80,192,.09),rgba(208,96,160,.025))}
#ac-content:not(.dark) .love-card{padding:14px 16px;background:#fff;border:1px solid var(--divider);border-radius:10px;box-shadow:0 5px 16px rgba(74,42,92,.07)}
#ac-content:not(.dark) .theme-btn,
#ac-content:not(.dark) .settings-btn,
#ac-content:not(.dark) .scene-btn{background:rgba(255,255,255,.82);border-color:#cdb7d5;color:#6d5878}
#ac-content:not(.dark) .memo-head-btn,
#ac-content:not(.dark) .item-head-btn{background:#f0e3f6;border-color:#c7a9d8;color:#713f91}
#ac-content:not(.dark) .lottery-head-btn{background:linear-gradient(135deg,#f6dce9,#eadcf6);border-color:#d060a0;color:#9d3568;box-shadow:0 2px 7px rgba(176,72,120,.12)}

.play-collapse-btn{border-radius:50%;border:1px solid var(--divider);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s;flex-shrink:0;line-height:1;font-family:inherit;width:22px;height:22px;font-size:14px}
.play-collapse-btn:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
.play-section.collapsed .play-collapse-btn{transform:rotate(180deg)}
.play-section.collapsed .play-collapse-btn:hover{filter:brightness(1.1)}

.pink-line{height:2px;background:linear-gradient(90deg,transparent,var(--lust-soft),var(--lust),var(--accent),var(--lust-soft),transparent);opacity:.6}

.book-body{overflow:hidden}

.tabs-wrap{overflow:visible}
.tabs{display:flex;flex-wrap:wrap;gap:4px 6px;padding:8px 16px;border-bottom:1px solid var(--divider);background:var(--bg-alt)}
.tab{flex:0 0 auto;padding:5px 12px 8px;font-size:13px;white-space:nowrap;cursor:pointer;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--text-muted);transition:all .3s;font-family:inherit;letter-spacing:.5px;position:relative;overflow:hidden;font-weight:400}
.tab.active{color:var(--lust-deep);font-weight:500}
.tab.active::before{content:'';position:absolute;bottom:-2px;left:10%;right:10%;height:2px;background:linear-gradient(90deg,var(--lust),var(--accent));border-radius:1px;animation:tab-in .3s ease forwards;will-change:transform}
.tab.active::after{content:'';position:absolute;bottom:-4px;left:15%;right:15%;height:8px;background:var(--lust-glow);filter:blur(4px);border-radius:4px}
@keyframes tab-in{0%{transform:scaleX(0);opacity:0}100%{transform:scaleX(1);opacity:1}}
.tab:hover{color:var(--lust);text-shadow:0 0 8px var(--accent-glow)}

.char-panel{padding:16px 22px 14px 22px;padding-top:20px;animation:fade-in .35s ease;overflow:visible}
@keyframes fade-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.char-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.char-head-info{flex:1;min-width:0}
.char-panel .portrait-box{float:none;margin:0;flex:0 0 120px;width:120px;height:auto;align-self:stretch}
.char-portrait-text-row{display:flex;gap:12px;align-items:stretch}
.char-text-col{flex:1;min-width:0;display:flex;flex-direction:column}
.char-name-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.char-name-actions{display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0}
.char-name{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:17px;font-weight:600;color:var(--text);letter-spacing:2px;cursor:pointer;display:inline-block;transition:all .2s}
.char-name:hover{animation:name-tremble .4s ease;color:var(--accent-deep)}
@keyframes name-tremble{0%,100%{transform:translateX(0)}20%{transform:translateX(-2px)}40%{transform:translateX(2px)}60%{transform:translateX(-1px)}80%{transform:translateX(1px)}}
.char-basic-info{font-size:12px;color:var(--text-muted);letter-spacing:.3px}
.char-status{margin-top:6px;font-size:13px;color:var(--text-sub);line-height:1.6;cursor:default}
.char-status:hover{opacity:0.7;transition:opacity 0.3s}
.char-mood-right{font-size:12px;font-weight:500;letter-spacing:.5px;display:flex;align-items:center;gap:3px;justify-content:flex-end}
.char-right-col{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
.mood-icon{font-size:16px}
.char-inner-thought{margin-top:6px;font-size:12px;color:var(--accent-deep);font-style:italic;letter-spacing:.5px;line-height:1.7;opacity:.9;padding:6px 12px 6px 16px;border-left:2px dashed var(--accent);background:var(--accent-bg-faint);border-radius:0 6px 6px 0;position:relative;display:flex;align-items:center;gap:8px}
.inner-thought-text{flex:1;min-width:0}
.inner-thought-text::before{content:'「';font-size:14px;color:var(--accent);font-weight:700;font-style:normal;margin-right:2px;opacity:.7}
.inner-thought-text::after{content:'」';font-size:14px;color:var(--accent);font-weight:700;font-style:normal;margin-left:2px;opacity:.7}
.char-mood-inline{font-size:12px;font-weight:500;letter-spacing:.5px;display:inline-flex;align-items:center;gap:3px;margin-left:auto;flex-shrink:0;padding-left:12px}
.char-intention{margin-top:2px;font-size:12px;color:var(--text-sub);letter-spacing:.3px}
.char-attitude{margin-top:2px;font-size:12px;color:var(--lust);letter-spacing:.3px;font-weight:500}
.char-outfit-summary{background:var(--lust-bg-faint);border-bottom:2px solid var(--lust-border-soft)!important;gap:10px}
.char-outfit-summary .cl{color:var(--lust-deep)!important;font-weight:600!important;min-width:64px!important}
.char-outfit-summary .cv{color:var(--lust-deep)!important;font-weight:500}
.char-train-wrap{margin-top:8px;display:flex;align-items:center;gap:8px}
.char-train-label{font-size:10px;color:var(--text-muted);letter-spacing:.5px;min-width:36px}
.char-train-bar{flex:1;height:6px;background:var(--lust-bg-hover);border-radius:3px;overflow:hidden;position:relative}
.char-train-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--lust));border-radius:3px;transition:width .5s ease-out;position:relative}
.char-train-fill::after{content:'';position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,0.3),transparent)}
.char-train-glow{position:absolute;top:0;left:0;height:100%;background:linear-gradient(90deg,var(--accent-glow),var(--lust-glow));border-radius:3px;transition:width .5s ease-out;opacity:.5;filter:blur(4px)}
.char-train-value{font-size:10px;color:var(--lust);font-weight:500;min-width:48px;text-align:right}

.icon-btn{background:var(--lust-bg);border:1px solid var(--lust-border);border-radius:4px;color:var(--lust);font-size:11px;font-family:inherit;cursor:pointer;padding:3px 8px;letter-spacing:.5px;transition:all .2s;white-space:nowrap}
.icon-btn:hover{border-color:var(--lust);background:var(--lust-bg-active);box-shadow:0 0 8px var(--lust-glow)}
.icon-btn.active-switch{background:var(--lust-bg-strong);border-color:var(--lust);color:var(--lust-deep);font-weight:500}

.char-section{margin-top:12px}
.char-section-label-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.char-section-label{font-size:10px;color:var(--text-muted);letter-spacing:2.5px;text-transform:uppercase}
.char-switch-btns{display:flex;gap:4px}
.char-switch-btn{font-size:11px;font-family:inherit;cursor:pointer;padding:3px 10px;border-radius:4px;border:1px solid var(--divider);background:transparent;color:var(--text-muted);letter-spacing:.5px;transition:all .2s;white-space:nowrap}
.char-switch-btn.active-switch{background:var(--lust-bg-hover);border-color:var(--lust);color:var(--lust-deep);font-weight:500}
.char-switch-btn:hover{border-color:var(--lust-soft);color:var(--lust)}

.char-clothes-list,.char-body-list{border:1px solid var(--divider);border-radius:8px;overflow:visible}
.char-clothes-item,.char-body-item{display:flex;padding:6px 10px;font-size:12px;line-height:1.6;border-bottom:1px solid var(--divider-light);transition:background .15s}
.char-clothes-item:nth-child(even),.char-body-item:nth-child(even){background:var(--bg-alt)}
.char-clothes-item:last-child,.char-body-item:last-child{border-bottom:none}
.char-clothes-item:hover,.char-body-item:hover{background:linear-gradient(90deg,var(--lust-glow),var(--accent-glow))}
.char-clothes-item.touched{animation:touch-react 1s ease}
@keyframes touch-react{0%{background:transparent}15%{background:rgba(255,137,179,0.2);transform:scaleX(1.02);text-shadow:0 0 4px var(--accent-glow)}30%{transform:translateX(3px);background:rgba(255,137,179,0.15)}50%{transform:translateX(-3px) skewX(-2deg);background:rgba(255,137,179,0.1)}70%{transform:translateX(1px) skewX(1deg)}100%{background:transparent;transform:translateX(0) skewX(0)}}
.char-clothes-item .cl,.char-body-item .bl{color:var(--lust);font-weight:500;letter-spacing:.5px;min-width:40px;flex-shrink:0}
.char-clothes-item .cv,.char-body-item .bv{color:var(--text-sub)}


/* 鐐瑰嚮鐗规晥 */
.click-heart{position:fixed;pointer-events:none;z-index:9999;font-size:14px;color:var(--accent);animation:heart-rise 1.8s ease-out forwards;text-shadow:0 0 6px var(--accent-glow)}
.click-text{position:fixed;pointer-events:none;z-index:9999;font-size:11px;color:var(--accent);white-space:nowrap;animation:text-drift 2s ease-out forwards;opacity:.85;text-shadow:0 0 8px var(--accent-glow);letter-spacing:1px}
@keyframes heart-rise{0%{opacity:1;transform:translateY(0) scale(.5) rotate(0deg)}30%{opacity:1;transform:translateY(-20px) scale(1.2) rotate(-15deg)}100%{opacity:0;transform:translateY(-80px) scale(.3) rotate(20deg)}}
@keyframes text-drift{0%{opacity:0;transform:translateY(0) translateX(0) scale(.8)}15%{opacity:.9;transform:translateY(-10px) translateX(5px) scale(1)}100%{opacity:0;transform:translateY(-60px) translateX(var(--drift-x,30px)) scale(.6)}}
.tab-ripple{position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle,var(--accent-glow) 0%,transparent 70%);animation:tab-glow .6s ease-out forwards;pointer-events:none;border-radius:inherit}
@keyframes tab-glow{0%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.1)}}

.book::after{content:'';position:absolute;bottom:0;left:50%;width:60%;height:1px;background:linear-gradient(90deg,transparent,var(--accent-glow),transparent);opacity:.3;pointer-events:none}


@keyframes spark-fly{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--sx,20px),var(--sy,-15px))}}
.drip{position:fixed;width:6px;height:8px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:radial-gradient(circle at 35% 35%,rgba(255,200,220,0.9),var(--accent));pointer-events:none;z-index:50;animation:drip-fall .9s ease-in forwards}
@keyframes drip-fall{0%{opacity:.9;transform:scale(1)}15%{transform:scaleX(.8) scaleY(1.4)}50%{opacity:.7;transform:scale(1) translateY(40px)}80%{opacity:.3;transform:scale(.8) translateY(65px)}100%{opacity:0;transform:scale(0) translateY(75px)}}

.mouse-glow{position:fixed;width:80px;height:80px;border-radius:50%;pointer-events:none;z-index:100;background:radial-gradient(circle,rgba(255,137,179,0.25) 0%,transparent 70%);transform:translate(-50%,-50%);transition:opacity .3s;opacity:0}
.mouse-glow.active{opacity:1}

/* 寮圭獥 */
.nsfw-overlay,.panel-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(0,0,0,0.5);z-index:10000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.nsfw-overlay.show,.panel-overlay.show{display:flex}
.panel-popup{background:var(--card);border:1px solid var(--divider);border-radius:12px;width:90%;max-width:360px;max-height:70vh;min-height:200px;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:popup-in .3s ease}
.panel-popup{max-width:380px;display:flex;flex-direction:column}
@keyframes popup-in{from{opacity:0;transform:scale(.9) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
.panel-popup-head{position:sticky;top:0;background:linear-gradient(180deg,var(--head-from),var(--head-to));padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--divider);z-index:1}
.panel-popup-head{flex-shrink:0}
.panel-popup-title{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:var(--ub-popup-font-title,15px);font-weight:600;color:var(--text);letter-spacing:2px;flex:1}
.panel-popup-close,.panel-popup-back{width:28px;height:28px;border-radius:50%;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.panel-popup-close:hover,.panel-popup-back:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
.panel-popup-back{font-size:12px;width:auto;border-radius:4px;padding:0 8px;font-family:inherit}
.panel-popup-warehouse-toggle{font-size:11px;width:auto;padding:0 8px;height:24px;border-radius:12px;border:1px solid var(--divider);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;font-family:inherit;margin-right:6px;letter-spacing:.5px}
.panel-popup-warehouse-toggle:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
.panel-popup-body{padding:12px 18px 16px}
.panel-popup-body{flex:1 1 auto;min-height:0;overflow-y:auto}
.panel-popup-body::-webkit-scrollbar{width:4px}
.panel-popup-body::-webkit-scrollbar-track{background:transparent}
.panel-popup-body::-webkit-scrollbar-thumb{background:var(--divider);border-radius:2px}
.panel-popup-body::-webkit-scrollbar-thumb:hover{background:var(--lust-soft)}
.char-info-popup{max-width:420px;width:90%;max-height:80vh;display:flex;flex-direction:column}
.char-info-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px 18px 16px}
.char-info-body::-webkit-scrollbar{width:4px}
.char-info-body::-webkit-scrollbar-track{background:transparent}
.char-info-body::-webkit-scrollbar-thumb{background:var(--divider);border-radius:2px}
.char-info-body::-webkit-scrollbar-thumb:hover{background:var(--lust-soft)}
.char-info-panel{display:none}
.char-info-panel.active{display:flex;flex-direction:column;gap:0}
.char-info-card{border:1px solid var(--divider);padding:14px 16px;background:var(--card);border-radius:8px}
.char-info-card-name{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:15px;font-weight:600;color:var(--lust);letter-spacing:2px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--divider)}
.char-info-card-rows{display:flex;flex-direction:column;gap:6px}
.char-info-card-rows .detail-row{font-size:var(--ub-ui-font-13,13px)}
.char-info-card-rows .dl{color:var(--text-muted);min-width:50px}
.panel-empty{text-align:center;padding:24px 0;color:var(--text-muted);font-size:12px;letter-spacing:1px}

.memo-list-item,.item-list-item,.diary-list-item{padding:10px 12px;margin-bottom:8px;border:1px solid var(--divider-light);border-radius:8px;cursor:pointer;transition:all .2s}
.item-list-item{position:relative}
.memo-list-item:hover,.item-list-item:hover,.diary-list-item:hover{background:linear-gradient(90deg,var(--lust-glow),var(--accent-glow));border-color:var(--lust-soft)}
.memo-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.memo-title{font-size:var(--ub-ui-font-12,12px);font-weight:500;color:var(--text);letter-spacing:.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.memo-type{font-size:9px;color:var(--lust);padding:1px 5px;border-radius:3px;background:var(--lust-bg);letter-spacing:.5px;flex-shrink:0}
.memo-item-sub{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;font-size:var(--ub-ui-font-10,10px);color:var(--text-muted)}
.memo-status,.memo-char,.memo-time-badge{padding:1px 4px;border-radius:3px;background:var(--bg-alt);letter-spacing:.3px;font-size:9px}
.item-qty{font-size:10px;font-weight:600;color:var(--accent);background:var(--accent-bg);padding:1px 6px;border-radius:10px;flex-shrink:0;letter-spacing:.3px}
.item-top{display:flex;align-items:center;gap:6px}
.item-name{font-size:var(--ub-ui-font-12,12px);font-weight:500;color:var(--text);letter-spacing:.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item-type{font-size:9px;color:#fff;padding:2px 6px;border-radius:10px;background:var(--lust);letter-spacing:.5px;flex-shrink:0}
.item-wardrobe-badge{display:inline-flex;align-items:center;border-radius:10px;background:var(--accent);color:#fff;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:.5px;flex-shrink:0;margin-left:4px}
.item-desc{font-size:var(--ub-ui-font-10,10px);color:var(--text-muted);margin-top:4px;letter-spacing:.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mission-list-item{padding:12px 14px;margin-bottom:10px;border:1px solid var(--divider-light);border-radius:8px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.mission-list-item:hover{background:linear-gradient(90deg,var(--lust-glow),var(--accent-glow));border-color:var(--lust-soft)}
.mission-list-item.completed{border-color:var(--lust);background:var(--lust-bg-faint);cursor:pointer}
.mission-list-item.completed:hover{background:var(--lust-bg-hover)}
.mission-list-item .mission-delete{position:absolute;top:6px;right:8px;width:22px;height:22px;border-radius:4px;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:2}
.mission-list-item .mission-delete:hover{border-color:var(--accent);color:var(--accent);background:rgba(255,106,158,0.1)}
.mission-name{font-size:var(--ub-ui-font-13,13px);font-weight:600;color:var(--lust-deep);letter-spacing:.5px;margin-bottom:4px;padding-right:30px}
.mission-desc{font-size:var(--ub-ui-font-11,11px);color:var(--text-sub);margin-bottom:6px;line-height:1.5}
.mission-desc-clickable{cursor:pointer;transition:all 0.2s;padding:2px 4px;border-radius:3px;display:inline-block}
.mission-desc-clickable:hover{background:var(--lust-bg-hover)}
.mission-objective{font-size:var(--ub-ui-font-11,11px);color:var(--text-muted);padding:8px 10px;background:var(--bg-alt);border-radius:6px;border-left:3px solid var(--lust);line-height:1.6}
.mission-status{display:inline-block;font-size:10px;padding:2px 8px;border-radius:10px;margin-top:8px;font-weight:500;cursor:pointer;transition:all .2s}
.mission-status:hover{filter:brightness(1.1)}
.mission-status.pending{color:var(--text-muted);background:rgba(0,0,0,0.05);border:1px solid var(--divider-light)}
.mission-status.completed{color:#fff;background:linear-gradient(135deg,var(--lust),var(--accent));border:1px solid var(--lust)}
/* 深色：--lust/--accent 翻浅，白字对比不足，改深粉渐变 */
.dark .mission-status.completed{color:#fff;background:linear-gradient(135deg,#a8306a,#c0407a);border:1px solid #a8306a}
.diary-item-top{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-muted);margin-bottom:4px}
.diary-time{flex-shrink:0}
.diary-item-content{font-size:var(--ub-ui-font-12,12px);color:var(--text-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:.3px}

.detail-row{display:flex;padding:6px 0;border-bottom:1px solid var(--divider-light);font-size:var(--ub-ui-font-11,11px);line-height:1.6}
.detail-row:last-child{border-bottom:none}
.detail-row .dl{color:var(--lust-deep);font-weight:500;min-width:56px;flex-shrink:0;letter-spacing:.5px;font-size:10px}
.detail-row .dv{color:var(--text-sub);flex:1}
.detail-content{padding:10px 0}
.detail-content .dl{color:var(--lust-deep);font-weight:500;font-size:10px;letter-spacing:.5px;display:block;margin-bottom:6px}
.detail-content .dc{color:var(--text-sub);font-size:var(--ub-ui-font-11,11px);line-height:1.8}
.item-detail-actions{display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--divider-light)}
.item-use-btn,.item-discard-btn{flex:1;padding:6px 12px;border-radius:6px;border:1px solid var(--lust-border-soft);font-size:11px;font-family:inherit;cursor:pointer;letter-spacing:.5px;transition:all .2s;font-weight:500}
.item-use-btn{background:var(--lust-bg);color:var(--lust-deep)}
.item-use-btn:hover{background:var(--lust-bg-hover);border-color:var(--lust);box-shadow:0 0 8px var(--lust-glow)}
.item-discard-btn{background:transparent;color:var(--text-muted);border-color:var(--divider)}
.item-discard-btn:hover{border-color:var(--accent);color:var(--accent);background:rgba(255,106,158,0.1)}
.item-warehouse-btn{flex:1;padding:6px 12px;border-radius:6px;border:1px solid var(--divider);font-size:11px;font-family:inherit;cursor:pointer;letter-spacing:.5px;transition:all .2s;font-weight:500;background:transparent;color:var(--text-sub);border-color:var(--divider-light)}
.item-warehouse-btn:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-bg-faint);box-shadow:0 0 8px var(--lust-glow)}
.diary-detail-writer{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:13px;color:var(--lust);letter-spacing:1px;margin-bottom:10px}
.diary-nav-btn{flex:0 0 auto;width:26px;height:26px;line-height:24px;text-align:center;border:1px solid var(--divider-light);border-radius:50%;background:transparent;color:var(--lust);cursor:pointer;font-size:var(--ub-ui-font-10,10px);padding:0;transition:opacity .2s,border-color .2s}
.diary-nav-btn:hover:not(:disabled){opacity:.8;border-color:var(--lust)}
.diary-nav-btn:disabled{opacity:.3;cursor:default}
.diary-nav-indicator{text-align:center;font-size:var(--ub-ui-font-11,11px);color:var(--text-muted);margin-top:8px;letter-spacing:1px}
.diary-content{padding:10px 0}
.diary-content .dc{color:var(--text-sub);font-size:12px;line-height:1.9;font-style:italic}

/* ===== 鏃ヨ鏈儗鏅?===== */
.diary-notebook{position:relative;padding:24px 28px;margin:10px 0;background:linear-gradient(180deg,#fdf5f8 0%,#f9eaef 100%);border:1px solid var(--divider-light);border-radius:6px;box-shadow:0 2px 8px rgba(200,100,130,0.08),inset 0 0 30px rgba(200,100,130,0.02)}
.diary-notebook::before{content:'';position:absolute;top:0;left:40px;bottom:0;width:1px;background:rgba(220,160,180,0.3);pointer-events:none;z-index:1}
.diary-notebook::after{content:'';position:absolute;top:0;left:44px;bottom:0;width:1px;background:rgba(220,160,180,0.15);pointer-events:none;z-index:1}
.diary-notebook-lines{position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(transparent,transparent 27px,rgba(200,160,180,0.12) 27px,rgba(200,160,180,0.12) 28px);pointer-events:none;z-index:0}
.diary-notebook .diary-content{position:relative;z-index:1;padding:0}
.diary-notebook .diary-content .dc{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:14px;line-height:28px;color:var(--text);font-style:normal;letter-spacing:0.5px}
/* 褰╅搮鍒掓帀绾?鈥?绮楃嚎锛岀帿瑜愯壊 */
.diary-notebook .diary-content .dc .strikethrough{text-decoration:line-through;text-decoration-thickness:0.12em;text-decoration-color:#c47080;opacity:0.75}
/* 姘村僵绗旀爣璁?鈥?鍗婇€忔槑绮夋鑹插潡锛岃竟缂樺井涓嶈鍒?*/
.diary-notebook .diary-content .dc .highlight{background:linear-gradient(180deg,rgba(255,200,210,0.5) 0%,rgba(250,180,195,0.6) 100%);padding:2px 6px;border-radius:3px 7px 4px 5px;box-shadow:0 0 0 1px rgba(230,160,175,0.18),inset 0 -1px 2px rgba(210,140,160,0.12)}
/* 铚＄瑪娉㈡氮涓嬪垝绾?鈥?鐜孩鑹?*/
.diary-notebook .diary-content .dc .underline{text-decoration:underline;text-decoration-style:wavy;text-decoration-thickness:from-font;text-underline-offset:4px;text-decoration-color:#e87090}
/* 鍝佺孩鍦堝湀鏍囨敞 鈥?涓嶈鍒欐き鍦?*/
.diary-notebook .diary-content .dc .emphasis{display:inline-block;border:2px solid #d44068;border-radius:42% 58% 55% 45% / 48% 45% 55% 52%;padding:0 5px;transform:rotate(-0.5deg);color:inherit;font-weight:600}
/* 閾呯瑪鎵嬪啓浣?鈥?娣辩传瑜?*/
.diary-notebook .diary-content .dc .handwritten{font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体','LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC',cursive;font-size:15px;color:#4a2a2a;text-shadow:0.5px 0.5px 0 rgba(0,0,0,0.06);letter-spacing:0.3px}
/* 娼﹁崏瀛楄抗 鈥?姝枩 */
.diary-notebook .diary-content .dc .messy{display:inline-block;transform:rotate(-1.2deg) translateY(1px);font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体','LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC',cursive;font-size:14px;color:#5a3a3a;text-shadow:0.5px 1px 0 rgba(0,0,0,0.05);letter-spacing:-0.2px}
/* 褰╅搮娑傛敼閬洊 鈥?鏌斿拰浜ゅ弶鏂滅嚎 */
.diary-notebook .diary-content .dc .censored{position:relative;color:rgba(80,20,30,0.28);padding:0 4px;border-radius:2px;cursor:pointer;transition:all 0.3s;background-color:rgba(200,150,160,0.06);background-image:repeating-linear-gradient(-5deg,transparent,transparent 2.5px,rgba(180,120,135,0.35) 2.5px,rgba(180,120,135,0.35) 3.5px),repeating-linear-gradient(12deg,transparent,transparent 3px,rgba(190,130,145,0.28) 3px,rgba(190,130,145,0.28) 4px),repeating-linear-gradient(-18deg,transparent,transparent 3.5px,rgba(170,110,125,0.3) 3.5px,rgba(170,110,125,0.3) 4.5px);background-repeat:repeat;background-size:24px 24px}
.diary-notebook .diary-content .dc .censored:hover{background-image:none;background-color:transparent;color:inherit;padding:0 4px}
.dark .diary-notebook{background:linear-gradient(180deg,#1f1518 0%,#1a1114 100%);border-color:var(--divider);box-shadow:0 2px 8px rgba(0,0,0,0.2),inset 0 0 30px rgba(200,100,130,0.03)}
.dark .diary-notebook::before{background:rgba(120,80,90,0.2)}
.dark .diary-notebook::after{background:rgba(120,80,90,0.1)}
.dark .diary-notebook-lines{background:repeating-linear-gradient(transparent,transparent 27px,rgba(200,160,180,0.06) 27px,rgba(200,160,180,0.06) 28px)}
.dark .diary-notebook .diary-content .dc{color:var(--text)}
/* 娣辫壊 鈥?highlight 鏆栫矇璋冧寒 */
.dark .diary-notebook .diary-content .dc .highlight{background:linear-gradient(180deg,rgba(255,200,210,0.38) 0%,rgba(250,180,195,0.45) 100%);box-shadow:0 0 0 1px rgba(240,180,195,0.15),inset 0 -1px 2px rgba(220,160,180,0.1)}
/* 娣辫壊 鈥?underline 浜帿绾?*/
.dark .diary-notebook .diary-content .dc .underline{text-decoration-color:#f090a8}
/* 娣辫壊 鈥?emphasis 浜搧绾?*/
.dark .diary-notebook .diary-content .dc .emphasis{border-color:#e86080;color:#e8d8d0}
/* 娣辫壊 鈥?strikethrough 浜矇瑜?*/
.dark .diary-notebook .diary-content .dc .strikethrough{text-decoration-color:#d898a0}
.dark .diary-notebook .diary-content .dc .handwritten{color:#e8d8d0}
.dark .diary-notebook .diary-content .dc .messy{color:#d8c8c0}
/* 娣辫壊 鈥?娑傛敼閬洊锛氭殩鐏版煍鍜屾枩绾?*/
.dark .diary-notebook .diary-content .dc .censored{color:rgba(232,216,210,0.22);background-color:rgba(200,180,175,0.05);background-image:repeating-linear-gradient(-5deg,transparent,transparent 2.5px,rgba(200,180,175,0.32) 2.5px,rgba(200,180,175,0.32) 3.5px),repeating-linear-gradient(12deg,transparent,transparent 3px,rgba(210,190,185,0.25) 3px,rgba(210,190,185,0.25) 4px),repeating-linear-gradient(-18deg,transparent,transparent 3.5px,rgba(190,170,165,0.28) 3.5px,rgba(190,170,165,0.28) 4.5px)}
.dark .diary-notebook .diary-content .dc .censored:hover{background-image:none;background-color:transparent;color:inherit}
.diary-detail-popup{max-width:520px !important}

/* 鐜╂硶鍖?*/
.play-section{padding:12px 22px;border-top:1px solid var(--divider-light);background:linear-gradient(180deg,var(--lust-glow),transparent)}
.play-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px}
.play-section-label{font-size:10px;color:var(--lust);letter-spacing:2.5px;text-transform:uppercase;flex:1}
.play-section-left{display:flex;align-items:center;gap:8px;flex:1}
.play-section-right{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap}
.play-section.collapsed .play-grid{display:none}
.play-section.collapsed .play-section-head{margin-bottom:0}
.play-clear-btn{font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;border-radius:4px;border:1px solid var(--accent-soft);background:var(--accent-bg-faint);color:var(--accent-deep);letter-spacing:.5px;transition:all .2s}
.play-clear-btn:hover{border-color:var(--accent);background:var(--accent-bg-hover);box-shadow:0 0 8px var(--accent-glow)}
.item-use-toggle{font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;border-radius:4px;border:1px solid var(--lust-border-soft);background:var(--lust-bg-faint);color:var(--lust);letter-spacing:.5px;transition:all .2s;white-space:nowrap}
.item-use-toggle:hover{border-color:var(--lust);background:var(--lust-bg-hover);box-shadow:0 0 8px var(--lust-glow)}
.item-use-toggle.active{background:var(--accent);border-color:var(--accent);color:#f5f0e6;font-weight:500;box-shadow:1px 1px 0 var(--accent-deep)}
/* 深色：--accent 翻浅，奶白字对比不足，改深色字 */
.dark .item-use-toggle.active{color:#1a0a14}
.nsfw-guidance-btn{font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;border-radius:4px;border:1px solid var(--accent);background:var(--accent-bg-faint);color:var(--accent-deep);letter-spacing:.5px;transition:all .2s;white-space:nowrap}
.nsfw-guidance-btn:hover{background:var(--accent);color:#f5f0e6;box-shadow:0 0 8px var(--accent-glow)}
.dark .nsfw-guidance-btn:hover{color:#1a0a14}
.nsfw-guidance-btn:disabled{opacity:.55;cursor:wait;box-shadow:none}
.play-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.play-select{flex:1;width:100%;max-width:160px;background:var(--lust-bg-faint);background-color:var(--lust-bg-faint)!important;color:var(--lust)!important;border:1px solid var(--lust-border)!important;border-radius:4px;padding:4px 8px;font-size:11px;font-family:inherit;outline:none;cursor:pointer;transition:all .2s;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239050c0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center}
.play-select:focus{border-color:var(--lust);box-shadow:0 0 0 2px var(--lust-glow)}
.play-select option{background:var(--card)!important;color:var(--text-sub)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}

/* 璁剧疆涓庡ぇ璋冩煡 */
.settings-btn{background:transparent;border:1px solid var(--divider);color:var(--text-muted);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;width:28px;height:28px;border-radius:50%}
.settings-btn:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
/* 场景一键切换按钮 */
.scene-btn{background:transparent;border:1px solid var(--divider);border-radius:4px;color:var(--text-muted);font-size:10px;font-family:inherit;cursor:pointer;padding:3px 8px;letter-spacing:.5px;flex-shrink:0;transition:all .2s;white-space:nowrap}
.scene-btn:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
.scene-btn:disabled{opacity:0.5;cursor:not-allowed}
.scene-btn.scene-active-daily{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
.scene-btn.scene-active-nsfw{border-color:var(--lust);color:#fff;background:var(--lust);box-shadow:0 0 6px var(--lust-glow)}
.dark .scene-btn.scene-active-nsfw{color:#1a0a14}
.settings-overlay{position:fixed;top:0;left:0;width:100%;height:100vh;height:100dvh;background:rgba(0,0,0,0.5);z-index:10002;display:none;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.settings-overlay.show{display:flex}
.settings-popup{background:var(--card);border:1px solid var(--divider);border-radius:12px;width:90%;max-width:320px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:popup-in .3s ease}
.settings-popup-head{padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--divider);flex-shrink:0}
.settings-popup-title{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-size:var(--ub-popup-font-title,15px);font-weight:600;color:var(--text);letter-spacing:2px;flex:1}
.settings-popup-close{width:28px;height:28px;border-radius:50%;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.settings-popup-close:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}
.settings-tabs{display:flex;border-bottom:1px solid var(--divider);padding:0 18px;background:linear-gradient(180deg,var(--head-from),var(--head-to))}
.settings-tab{flex:1;padding:10px 0;border:none;background:transparent;color:var(--text-muted);font-size:13px;font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;letter-spacing:1px;cursor:pointer;transition:all .2s;position:relative}
.settings-tab:hover{color:var(--text)}
.settings-tab.active{color:var(--lust-deep);font-weight:500}
.settings-tab.active::before{content:'';position:absolute;bottom:-1px;left:10%;right:10%;height:2px;background:linear-gradient(90deg,var(--lust),var(--accent));border-radius:1px}
.settings-tab.active::after{content:'';position:absolute;bottom:-4px;left:15%;right:15%;height:8px;background:var(--lust-glow);filter:blur(4px);border-radius:4px}
.settings-popup-body{padding:16px 18px;overflow-y:auto;flex:1;min-height:120px}
.settings-tab-content{display:none}
.settings-tab-content.active{display:block;animation:fade-in .2s ease}
.settings-section{margin:14px 0;padding:12px 14px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid var(--divider-light)}
.settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--divider-light)}
.settings-row:last-child{border-bottom:none}
.settings-label{font-size:var(--ub-ui-font-13,13px);color:var(--text);letter-spacing:1px}
.settings-toggle{width:44px;height:24px;border-radius:12px;background:var(--divider);cursor:pointer;position:relative;transition:background .2s;border:none;padding:0}
.settings-toggle.on{background:var(--lust)}
.settings-toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.settings-toggle.on::after{transform:translateX(20px)}
.investigate-btn{font-size:11px;font-family:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;cursor:pointer;padding:3px 8px;border:1px solid var(--lust-border);border-radius:4px;background:var(--lust-bg);color:var(--lust);letter-spacing:.5px;transition:all .2s;white-space:nowrap;font-weight:500}
.investigate-btn:hover{border-color:var(--lust);background:var(--lust-bg-active);box-shadow:0 0 8px var(--lust-glow)}

@media(min-width:600px) and (max-width:768px){
  .book-head-main{flex-wrap:wrap;justify-content:flex-start;gap:8px}
  .book-head-main-left{flex:1 1 100%;min-width:100%}
  .book-head-main-right{width:100%;justify-content:flex-start;flex-wrap:wrap}
}
@media(max-width:600px){
  .book-head{padding:8px 12px}
  .tabs{padding:8px 12px;gap:2px 4px}
  .tab{padding:4px 10px 6px;font-size:12px}
  .char-panel{padding:14px 16px 12px}
  .char-name{font-size:16px}
  .char-status{font-size:12px}
  .char-clothes-item,.char-body-item{padding:5px 8px;font-size:11px}
  .char-clothes-item .cl,.char-body-item .bl{min-width:36px}
  .book-head-right{gap:4px}
  .memo-head-btn,.item-head-btn,.theme-btn{font-size:9px;padding:2px 6px}
  .energy-value{font-size:9px;padding:2px 6px}
  .lottery-head-btn{font-size:9px;padding:2px 6px}
  .book-head-main{padding:8px;flex-wrap:wrap;justify-content:flex-start;gap:8px}
  .book-head-main-left{flex:1;min-width:100%}
  .book-head-main-right{width:100%;justify-content:flex-start}
  .main-char-name{font-size:14px}
  .main-char-status{font-size:11px;white-space:normal}
  .play-section{padding:10px 16px}
  .play-grid{grid-template-columns:repeat(2,1fr);gap:8px}
  /* 澧炲ぇ绉诲姩绔Е鎽哥洰鏍?*/
  .settings-btn,.play-collapse-btn{min-width:32px;min-height:32px;font-size:16px}
  .memo-head-btn,.item-head-btn,.theme-btn,.lottery-head-btn{min-height:32px;padding:4px 10px;font-size:10px}
  .tab{padding:6px 12px 8px;font-size:12px}
  .char-portrait-text-row{flex-direction:column;align-items:flex-start}
  .char-panel .portrait-box{flex:0 0 auto;width:120px;height:120px;align-self:auto}
}

/* ===== 鍥哄畾妯″紡鎶樺彔鐘舵€?===== */
#ac-statusbar-wrapper.ub-collapsed{display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:hidden!important}

/* 鏂版墜甯姪鎻愮ず鎸夐挳 */
.help-tip-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid var(--divider);background:transparent;color:var(--text-muted);font-size:10px;font-weight:bold;cursor:help;flex-shrink:0;line-height:1;font-family:inherit;transition:all .2s}
.help-tip-btn:hover{border-color:var(--lust);color:var(--lust);background:var(--lust-glow)}

.help-tooltip-global{position:fixed;z-index:100000;max-width:260px;padding:10px 14px;border-radius:6px;background:var(--head-from);border:1px solid var(--divider);color:var(--text);font-size:11px;line-height:1.7;letter-spacing:0.5px;white-space:pre-line;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.3)}
/* === 过往经历时间轴 · 瑟瑟 === */
.pe-intro{background:linear-gradient(135deg,#f8f2ff,#f3e8f8);border:1px solid #f0c0d8;padding:10px 12px}
.pe-intro-label{color:#b04878}
.pe-intro-text{color:#5a4a6a}
.pe-rail::before{background:linear-gradient(#d060a0,rgba(208,96,160,0.15))}
.pe-dot{background:#d060a0;border:2px solid #fff;box-shadow:0 0 0 1px #d060a0,0 0 8px rgba(208,96,160,0.45);width:11px;height:11px;top:4px}
.pe-date{color:#b04878;letter-spacing:.5px}
.pe-card{background:#faf5fc;border:1px solid #f4ecf2;color:#5a4a6a;border-radius:8px}
/* 暗色 */
.dark .pe-intro{background:linear-gradient(135deg,#2a2230,#241a26);border-color:rgba(255,106,158,0.2)}
.dark .pe-intro-label{color:#ff89b3}
.dark .pe-intro-text{color:#c0b0c8}
.dark .pe-rail::before{background:linear-gradient(#ff89b3,rgba(255,137,179,0.15))}
.dark .pe-dot{background:#ff89b3;border-color:#1c1c1e;box-shadow:0 0 0 1px #ff89b3,0 0 10px rgba(255,137,179,0.55)}
.dark .pe-date{color:#ff89b3}
.dark .pe-card{background:#242426;border-color:#38383a;color:#c0b0c8}
/* === db 弹窗 token 桥接：flirtatious :root 未定义 --card-light，补上（text/divider 已定义） === */
.db-viewer-popup,.db-row-detail-popup,.db-confirm-popup{--card-light:var(--card)}
` + baseCSS + /* css */ `
/* 角色中枢 / 剧情回顾：霓虹私语 */
.char-hub-theme-flirtatious,.chronicle-reader-theme-flirtatious{--hub-bg:var(--card);--hub-panel:var(--card-light,var(--card));--hub-line:var(--divider);--hub-ink:var(--text);--hub-muted:var(--text-muted);--hub-accent:var(--lust);--hub-soft:var(--lust-bg-faint);--hub-day:linear-gradient(135deg,#fff,#f6eefb);--hub-night:rgba(138,90,158,.06);--hub-night-ink:#5a4070;--hub-pref:#8a5a9e}
.char-hub-theme-flirtatious .char-hub-gsym.is-female{color:var(--lust)}.char-hub-theme-flirtatious .char-hub-gsym.is-male{color:#5b8def}
.char-hub-theme-flirtatious .char-hub-lead-banner{background:linear-gradient(90deg,var(--hub-soft),var(--hub-bg));border-inline-start:3px solid var(--hub-accent)}
.char-hub-theme-flirtatious .char-hub-action--investigate{color:#5b8def;border-color:color-mix(in srgb,#5b8def 40%,var(--hub-line));background:color-mix(in srgb,#5b8def 12%,var(--hub-bg))}
.char-hub-theme-flirtatious .char-hub-action--interview{color:#3a8a5a;border-color:color-mix(in srgb,#3a8a5a 40%,var(--hub-line));background:color-mix(in srgb,#3a8a5a 12%,var(--hub-bg))}
.char-hub-theme-flirtatious .char-hub-identity,.chronicle-reader-theme-flirtatious .chronicle-reader-card{border-color:var(--hub-line);background:linear-gradient(135deg,var(--hub-soft),var(--hub-bg));box-shadow:inset 3px 0 var(--hub-accent)}
.char-hub-theme-flirtatious .char-hub-card{border-radius:8px;background:linear-gradient(145deg,var(--hub-bg),var(--hub-soft));box-shadow:0 5px 16px rgba(72,37,54,.08)}
.char-hub-theme-flirtatious .char-hub-profile-lede{border-radius:0 9px 9px 0;background:linear-gradient(90deg,var(--hub-soft),transparent)}
.char-hub-theme-flirtatious .char-hub-prose-card,.char-hub-theme-flirtatious .char-hub-logic{border-radius:8px;background:linear-gradient(150deg,var(--hub-panel),var(--hub-bg));box-shadow:0 4px 14px rgba(72,37,54,.06)}
.char-hub-theme-flirtatious .char-hub-logic-index{border-radius:50%;background:var(--hub-soft)}
.char-hub-theme-flirtatious .char-hub-trait-balance{gap:10px}.char-hub-theme-flirtatious .char-hub-trait-column{border-radius:9px}.char-hub-theme-flirtatious .char-hub-trait{border-radius:6px}
.char-hub-theme-flirtatious .char-hub-relation-card{border-radius:9px;background:linear-gradient(140deg,var(--hub-panel),var(--hub-soft));box-shadow:0 4px 13px rgba(72,37,54,.06)}.char-hub-theme-flirtatious .char-hub-relation-avatar{border-radius:50%;background:var(--hub-soft)}
.char-hub-theme-flirtatious .char-hub-history-preview{gap:10px}.char-hub-theme-flirtatious .char-hub-history-background,.char-hub-theme-flirtatious .char-hub-history-latest{border-radius:9px;background:linear-gradient(145deg,var(--hub-panel),var(--hub-bg));box-shadow:0 4px 12px rgba(72,37,54,.05)}
.char-hub-theme-flirtatious .char-hub-not-equal{overflow:hidden;border-radius:10px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-soft))}.char-hub-theme-flirtatious .char-hub-not-equal-label{background:var(--hub-soft)}
.char-hub-theme-flirtatious .char-hub-intimacy-slip{overflow:hidden;border-radius:9px;background:linear-gradient(135deg,var(--hub-soft),var(--hub-bg));box-shadow:0 5px 15px rgba(72,37,54,.08)}
.char-hub-theme-flirtatious .char-hub-vitals-strip,.char-hub-theme-flirtatious .char-hub-vitals-raw,.char-hub-theme-flirtatious .char-hub-nsfw-card,.char-hub-theme-flirtatious .char-hub-dual-stat,.char-hub-theme-flirtatious .char-hub-speech{border-radius:8px}
.char-hub-theme-flirtatious .char-hub-vitals-strip{background:linear-gradient(145deg,var(--hub-panel),var(--hub-bg))}
.char-hub-theme-flirtatious .char-hub-profile-lede{border-top:1px solid #c8a030;border-bottom:1px solid var(--hub-line);border-radius:0 9px 9px 0;background:linear-gradient(90deg,var(--hub-soft),transparent)}
.panel-overlay.dark .char-hub-theme-flirtatious{--hub-day:rgba(255,255,255,.015);--hub-night:rgba(200,104,138,.06);--hub-night-ink:#e8a0b8;--hub-pref:#9b6db4}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-vitals-num,.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-stat-num{color:#e8b4c8;text-shadow:0 0 6px rgba(232,180,200,.4)}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-stat-fill{box-shadow:0 0 6px rgba(232,180,200,.4)}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-profile-lede{border-top:0;border-bottom:1px solid var(--hub-line)}
.char-hub-theme-flirtatious .char-hub-ms-list{position:relative;padding-left:16px}
.char-hub-theme-flirtatious .char-hub-ms-list::before{content:'';position:absolute;left:35px;top:14px;bottom:14px;width:2px;border-radius:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--lust) 10%,transparent),color-mix(in srgb,var(--accent) 55%,transparent) 20%,color-mix(in srgb,var(--accent) 55%,transparent) 80%,color-mix(in srgb,var(--lust) 10%,transparent));box-shadow:0 0 8px color-mix(in srgb,var(--accent) 30%,transparent)}
.char-hub-theme-flirtatious .char-hub-ms-node{width:36px;height:36px;border-radius:50%;border:2px solid var(--accent);background:var(--hub-bg);box-shadow:0 0 7px color-mix(in srgb,var(--accent) 55%,transparent)}
.char-hub-theme-flirtatious .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--accent);color:#fff;box-shadow:0 0 5px var(--accent),0 0 14px color-mix(in srgb,var(--accent) 75%,transparent)}
.char-hub-theme-flirtatious .char-hub-ms-date{color:var(--lust)}
.char-hub-theme-flirtatious .char-hub-ms-hero b{background:linear-gradient(120deg,var(--lust),var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-ms-list::before{background:linear-gradient(180deg,color-mix(in srgb,var(--lust) 6%,transparent),color-mix(in srgb,var(--accent) 32%,transparent) 20%,color-mix(in srgb,var(--accent) 32%,transparent) 80%,color-mix(in srgb,var(--lust) 6%,transparent));box-shadow:0 0 8px color-mix(in srgb,var(--accent) 16%,transparent)}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-ms-node{background:transparent;box-shadow:0 0 7px color-mix(in srgb,var(--accent) 32%,transparent)}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-ms-item.is-latest .char-hub-ms-node{background:var(--accent);color:#3a1420;box-shadow:0 0 5px var(--accent),0 0 14px color-mix(in srgb,var(--accent) 45%,transparent)}
.panel-overlay.dark .char-hub-theme-flirtatious .char-hub-ms-hero b{background:none;color:var(--accent)}
.char-hub-theme-flirtatious{--ms-cat-first:#ff4d9d;--ms-cat-relation:#c94f9f;--ms-cat-status:#2fb8c9}
.panel-overlay.dark .char-hub-theme-flirtatious{--ms-cat-first:#ff7ab4;--ms-cat-relation:#e87bc0;--ms-cat-status:#5fd3df}
.chronicle-reader-theme-flirtatious .chronicle-timeline-node{box-shadow:0 0 0 4px var(--hub-soft),0 0 12px color-mix(in srgb,var(--hub-accent) 30%,transparent)}
.chronicle-reader-theme-flirtatious .chronicle-timeline-content{border-radius:9px;background:linear-gradient(140deg,var(--hub-bg),var(--hub-soft));box-shadow:0 5px 16px rgba(72,37,54,.07)}
.chronicle-reader-theme-flirtatious .chronicle-detail-text{border-radius:9px;background:linear-gradient(140deg,var(--hub-panel),var(--hub-bg));box-shadow:0 5px 16px rgba(72,37,54,.07)}.chronicle-reader-theme-flirtatious .chronicle-detail-dialogue{border-radius:9px;background:linear-gradient(140deg,var(--hub-bg),var(--hub-soft));box-shadow:0 4px 12px rgba(72,37,54,.05)}
.chronicle-reader-theme-flirtatious .chronicle-dialogue-line{border-radius:7px;background:linear-gradient(135deg,var(--hub-bg),var(--hub-soft));box-shadow:0 3px 10px rgba(72,37,54,.05)}.chronicle-reader-theme-flirtatious .chronicle-dialogue-speaker{border-radius:999px}
/* ===== ★ 主角立绘摆位 ===== */
.book-head-main-left .protagonist-portrait-row{display:flex;align-items:center;gap:12px;min-width:0}
.book-head-main-left .portrait-box{flex:0 0 72px;width:72px;height:72px}
.protagonist-info-col{display:flex;flex-direction:column;gap:3px;min-width:0}
@media (max-width:600px){
  .book-head-main-left .portrait-box{flex:0 0 56px;width:56px;height:56px}
  .book-head-main-left .protagonist-portrait-row{gap:8px}
}
`;
