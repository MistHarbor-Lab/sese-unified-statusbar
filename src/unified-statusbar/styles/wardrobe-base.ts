export const WARDROBE_BASE_CSS = `
.wardrobe-overlay{
  width:100%;height:100vh;height:100dvh;
  align-items:center;justify-content:center;
}
.wardrobe-window{
  --wr-bg:var(--card);
  --wr-panel:var(--card-bg,#fff);
  --wr-text:var(--text,#28231f);
  --wr-muted:var(--text-muted,#746d66);
  --wr-line:var(--divider,#ddd);
  --wr-accent:var(--accent,#8d5c42);
  --wr-accent-soft:color-mix(in srgb,var(--wr-accent) 12%,transparent);
  width:min(1120px,96vw);height:min(820px,92vh);height:min(820px,92dvh);
  display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;
  /* iPhone 安全区：≤720px 时本窗是 100dvh 全屏贴边，head/正文/角色穿搭底部在这一处统一让位；
     绝对定位子件（.wardrobe-detail 等）不吃父 padding，故各自另扣（见下）。桌面 env=0 ⇒ 逐像素无变化。 */
  padding-top:var(--safe-top,0px);padding-bottom:var(--safe-bottom,0px);
  color:var(--wr-text);background:var(--wr-bg);border:1px solid var(--wr-line);
  border-radius:16px;box-shadow:0 22px 70px rgba(0,0,0,.24);font-size:13px;
}
.wardrobe-theme-ancient{--wr-accent:#9a633b;--wr-bg:#fbf4e8;--wr-panel:#fffaf1;--wr-line:#d8c2a4}
.wardrobe-theme-flirtatious{--wr-accent:#b34f72;--wr-bg:#fff3f6;--wr-panel:#fffafd;--wr-line:#e7b9c8}
.wardrobe-theme-minimal{--wr-accent:#222;--wr-bg:#f4f4f2;--wr-panel:#fff;--wr-line:#c8c8c4;border-radius:2px}
.wardrobe-theme-sweet{--wr-accent:#df7198;--wr-bg:var(--sweet-bg,#fff0f5);--wr-panel:var(--sweet-card,#fffafd);--wr-line:var(--sweet-border,#efbdd0)}
.wardrobe-theme-xianxia{--wr-accent:#247f76;--wr-bg:#edf5f1;--wr-panel:#f9fcfa;--wr-line:#abcac2}
.wardrobe-theme-bridge{--wr-accent:#2d6074;--wr-bg:#eef4f5;--wr-panel:#f9fcfc;--wr-line:#afc6ca}
.wardrobe-theme-ios{--wr-accent:#007aff;--wr-bg:#f2f2f7;--wr-panel:#ffffff;--wr-line:rgba(60,60,67,.12);--wr-text:#1c1c1e;--wr-muted:rgba(60,60,67,.62);--wr-accent-soft:rgba(0,122,255,.1)}
.panel-overlay.dark .wardrobe-theme-ios,
body.dark-mode .wardrobe-theme-ios{
  --wr-accent:#0a84ff;--wr-bg:#000;--wr-panel:#1c1c1e;--wr-text:#f2f2f7;
  --wr-muted:rgba(235,235,245,.62);--wr-line:rgba(235,235,245,.12);--wr-accent-soft:rgba(10,132,255,.16);
}
.wardrobe-theme-ios .wardrobe-route,.wardrobe-theme-ios .wardrobe-close,.wardrobe-theme-ios .wardrobe-btn,.wardrobe-theme-ios .wardrobe-filter,.wardrobe-theme-ios .wardrobe-mobile-step{border-radius:999px}
.wardrobe-theme-ios .wardrobe-title{letter-spacing:-.3px}
#ac-wardrobe-btn.wardrobe-queue-active{position:relative}
#ac-wardrobe-btn.wardrobe-queue-active::after{
  content:attr(data-wardrobe-remaining);position:absolute;right:-7px;top:-7px;min-width:16px;height:16px;
  display:grid;place-items:center;padding:0 3px;box-sizing:border-box;border-radius:999px;
  background:#c34b4b;color:#fff;font:700 10px/1 sans-serif
}
.panel-overlay.dark .wardrobe-window,
body.dark-mode .wardrobe-window{
  --wr-bg:#191817;--wr-panel:#242220;--wr-text:#f1ece7;--wr-muted:#b3aaa1;
  --wr-line:#494541;--wr-accent:#d49a72;--wr-accent-soft:rgba(212,154,114,.14);
}
.wardrobe-head{display:flex;align-items:center;gap:12px;padding:14px 18px 10px;border-bottom:1px solid var(--wr-line)}
.wardrobe-title{font-size:20px;font-weight:750;white-space:nowrap}
.wardrobe-routes{display:flex;gap:4px;margin-left:auto}
.wardrobe-route,.wardrobe-close,.wardrobe-btn,.wardrobe-filter,.wardrobe-mobile-step{
  border:1px solid var(--wr-line);background:var(--wr-panel);color:var(--wr-text);
  min-height:32px;border-radius:8px;padding:7px 11px;font:inherit;font-size:12px;cursor:pointer;
}
.wardrobe-route[aria-selected="true"],.wardrobe-filter[aria-pressed="true"],.wardrobe-mobile-step[aria-current="step"]{
  color:#fff;background:var(--wr-accent);border-color:var(--wr-accent);
}
.wardrobe-close{min-width:32px;font-size:20px;line-height:1;padding:5px 9px}
.wardrobe-body{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}
.wardrobe-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--wr-line)}
.wardrobe-toolbar-spacer{flex:1}
.wardrobe-filter-row,.wardrobe-actions-row{display:contents}
.wardrobe-search{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--wr-muted)}
.wardrobe-search input{min-width:190px;border:1px solid var(--wr-line);background:var(--wr-bg);color:var(--wr-text);border-radius:7px;padding:7px 9px;font:inherit;font-size:13px}
.wardrobe-editor-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.wardrobe-search.wardrobe-editor-search{width:100%}
.wardrobe-search.wardrobe-editor-search input{min-width:0;width:100%}
.wardrobe-current-outfit{display:flex;align-items:center;gap:9px;padding:9px 14px;border-bottom:1px solid var(--wr-line);background:var(--wr-accent-soft)}
.wardrobe-collapse-btn{flex:0 0 auto;min-width:24px;height:24px;padding:0;border:1px solid var(--wr-line);border-radius:6px;background:var(--wr-panel);color:var(--wr-text);font-size:11px;line-height:1;cursor:pointer}
.wardrobe-current-items{display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap}
.wardrobe-current-chip{border:1px solid var(--wr-line);border-radius:999px;padding:4px 8px;background:var(--wr-panel);color:var(--wr-text);font:inherit;font-size:12px;cursor:pointer}
.wardrobe-content{min-height:0;flex:1;overflow:auto;padding:14px}
.wardrobe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.wardrobe-card{position:relative;display:flex;flex-direction:column;min-width:0;border:1px solid var(--wr-line);border-radius:12px;overflow:hidden;background:var(--wr-panel)}
.wardrobe-generating-overlay{position:absolute;z-index:4;inset:0;display:grid;place-items:center;background:rgba(20,20,24,.58);color:#fff;font-size:12px;font-weight:700;pointer-events:none}
.wardrobe-card.is-generating{box-shadow:0 0 0 2px var(--wr-accent)}
.wardrobe-card-button{display:flex;flex-direction:column;min-width:0;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
.wardrobe-card-image{display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,var(--wr-accent-soft),transparent)}
.wardrobe-item-image{aspect-ratio:1/1}
.wardrobe-outfit-image{aspect-ratio:2/3}
.wardrobe-card-image img{width:100%;height:100%;object-fit:contain;display:block}
.wardrobe-placeholder{font-size:40px;opacity:.55}
.wardrobe-card-copy{padding:9px 10px;min-width:0}
.wardrobe-card-name{font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wardrobe-card-meta,.wardrobe-muted{font-size:12px;color:var(--wr-muted);line-height:1.5}
/* F85：卡 meta 三段各自成签（分类=accent 芯片 / 来源=弱化尾注 / 套装件数=计数徽章） */
.wardrobe-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wb-cat{padding:1px 7px;border-radius:99px;font-size:10px;color:var(--wr-accent,var(--accent));background:var(--wr-soft,var(--accent-bg,var(--bg-alt)));border:1px solid var(--wr-line,var(--divider-light))}
.wb-src{margin-left:auto;color:var(--wr-muted);font-size:10px}
.wb-count{display:inline-flex;align-items:baseline;gap:2px;padding:1px 7px;border-radius:99px;font-size:10px;color:var(--wr-muted);background:var(--wr-soft,var(--bg-alt));border:1px solid var(--wr-line,var(--divider-light))}
.wb-count b.num{font-size:12px;color:var(--wr-accent,var(--accent));font-variant-numeric:tabular-nums}
.wardrobe-card-select{position:absolute;z-index:2;left:6px;top:6px;width:44px;height:44px;transform:scale(.55);transform-origin:top left}
/* 顶部/底部各自扣 iPhone 安全区（绝对定位子件不吃 .wardrobe-window 的 padding；横向沿用 18px） */
.wardrobe-detail{position:absolute;z-index:3;right:0;top:0;bottom:0;width:min(390px,92vw);padding:calc(18px + var(--safe-top,0px)) 18px calc(18px + var(--safe-bottom,0px));box-sizing:border-box;overflow:auto;background:var(--wr-panel);border-left:1px solid var(--wr-line);box-shadow:-14px 0 36px rgba(0,0,0,.12)}
.wardrobe-detail-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wardrobe-detail-title{font-size:16px;line-height:1.35}
.wardrobe-detail-image{margin:12px 0;display:grid;place-items:center;border:1px solid var(--wr-line);border-radius:10px;overflow:hidden}
.wardrobe-detail-image img{width:100%;height:100%;object-fit:contain;cursor:zoom-in}
.wardrobe-detail-description{font-size:13px;line-height:1.6}
.wardrobe-detail-section{margin-top:14px;padding-top:14px;border-top:1px solid var(--wr-line)}
.wardrobe-detail-section h3{margin:0 0 9px;font-size:12px;line-height:1.4;color:var(--wr-muted);font-weight:700}
.wardrobe-detail-actions{display:flex;flex-wrap:wrap;gap:7px}
.wardrobe-wear-option{display:flex;flex-direction:column;gap:9px;padding:11px;border:1px solid var(--wr-line);border-radius:10px;background:var(--wr-bg)}
.wardrobe-wear-option+.wardrobe-wear-option{margin-top:9px}
.wardrobe-wear-copy{display:flex;flex-direction:column;gap:3px}
.wardrobe-wear-copy strong{font-size:13px;line-height:1.4}
.wardrobe-wear-copy span,.wardrobe-wear-help{font-size:12px;line-height:1.5;color:var(--wr-muted)}
.wardrobe-wear-option>.wardrobe-btn{align-self:flex-start}
.wardrobe-npc-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
.wardrobe-npc-controls label{display:flex;min-width:0;flex-direction:column;gap:4px;font-size:12px;color:var(--wr-muted)}
.wardrobe-wear-option select{width:100%;min-width:0;border:1px solid var(--wr-line);background:var(--wr-panel);color:var(--wr-text);border-radius:7px;padding:7px 9px;font:inherit;font-size:12px}
.wardrobe-danger-zone{margin-top:18px}
.wardrobe-btn.primary{background:var(--wr-accent);border-color:var(--wr-accent);color:#fff}
.wardrobe-btn.danger{color:#c34b4b}
.wardrobe-btn:disabled,.wardrobe-wear-option select:disabled{opacity:.55;cursor:not-allowed}
.wardrobe-empty{display:grid;place-items:center;min-height:260px;text-align:center;color:var(--wr-muted)}
.wardrobe-outfit-editor{display:grid;grid-template-columns:1.2fr 1fr .9fr;gap:12px;min-height:0;height:100%}
.wardrobe-editor-column{min-width:0;overflow:auto;border:1px solid var(--wr-line);border-radius:12px;background:var(--wr-panel);padding:12px;box-sizing:border-box}
.wardrobe-editor-title{font-size:13px;font-weight:750;margin-bottom:10px}
.wardrobe-editor-list{display:flex;flex-direction:column;gap:6px}
.wardrobe-editor-option{display:flex;gap:8px;align-items:flex-start;padding:7px;border:1px solid var(--wr-line);border-radius:8px}
.wardrobe-outfit-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.wardrobe-outfit-items li{font-size:12px;line-height:1.5}
.wardrobe-outfit-items li strong{font-weight:600;color:var(--wr-muted)}
.wardrobe-editor-preview-list{display:flex;flex-direction:column;gap:8px}
.wardrobe-editor-preview-item{padding:8px;border-left:3px solid var(--wr-accent);background:var(--wr-accent-soft)}
.wardrobe-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:12px;color:var(--wr-muted)}
.wardrobe-field input,.wardrobe-field textarea,.wardrobe-field select,
.wardrobe-extraction-row input,.wardrobe-extraction-row textarea,.wardrobe-extraction-row select{
  border:1px solid var(--wr-line);background:var(--wr-bg);color:var(--wr-text);border-radius:7px;padding:8px;font:inherit;font-size:13px
}
.wardrobe-toolbar select{border:1px solid var(--wr-line);background:var(--wr-bg);color:var(--wr-text);border-radius:7px;padding:8px;font:inherit;font-size:12px}
.wardrobe-modal-backdrop{position:absolute;z-index:8;inset:0;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.42);box-sizing:border-box}
.wardrobe-modal{width:min(560px,96%);max-height:min(720px,88vh);max-height:min(720px,88dvh);overflow:auto;padding:16px;box-sizing:border-box;border:1px solid var(--wr-line);border-radius:12px;background:var(--wr-panel);box-shadow:0 18px 55px rgba(0,0,0,.28)}
.wardrobe-extraction-review{width:min(900px,98%)}
.wardrobe-extraction-list{display:flex;flex-direction:column;gap:8px}
.wardrobe-extraction-row{display:grid;grid-template-columns:auto 80px minmax(110px,.7fr) 110px minmax(180px,1.5fr);gap:7px;align-items:center;padding:8px;border:1px solid var(--wr-line);border-radius:9px}
/* 设计候选无来源列：名称占原来源列位，描述拿走剩余空间 */
.wardrobe-extraction-row.no-source{grid-template-columns:auto minmax(110px,.8fr) 110px minmax(200px,1.6fr)}
.wardrobe-extraction-row textarea{min-height:56px;resize:vertical}
.wardrobe-confirm{width:min(430px,96%)}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.wardrobe-actor-content{overflow:hidden}
.wardrobe-actor-workbench{
  display:grid;grid-template-columns:minmax(150px,190px) minmax(240px,.8fr) minmax(360px,1.4fr);
  gap:14px;height:100%;min-width:0
}
.wardrobe-actor-rail,.wardrobe-actor-current,.wardrobe-actor-pool{
  min-width:0;overflow:auto;box-sizing:border-box;border:1px solid var(--wr-line);border-radius:12px;background:var(--wr-panel)
}
.wardrobe-actor-rail{padding:10px;display:flex;flex-direction:column;gap:9px}
.wardrobe-actor-search{display:flex;flex-direction:column;align-items:stretch}
.wardrobe-actor-search input{width:100%;min-width:0;box-sizing:border-box}
.wardrobe-actor-list{display:flex;flex-direction:column;gap:6px;min-height:0}
.wardrobe-actor-option{
  display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-width:0;padding:9px 10px;
  border:1px solid var(--wr-line);border-radius:9px;background:var(--wr-bg);color:var(--wr-text);font:inherit;text-align:left;cursor:pointer
}
.wardrobe-actor-option>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.wardrobe-actor-option small{flex:0 0 auto;color:var(--wr-muted)}
.wardrobe-actor-option[aria-selected="true"]{border-color:var(--wr-accent);background:var(--wr-accent-soft);box-shadow:inset 3px 0 0 var(--wr-accent)}
.wardrobe-actor-current,.wardrobe-actor-pool{padding:15px}
.wardrobe-actor-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px}
.wardrobe-actor-section-head h2{margin:0 0 3px;font-size:16px;line-height:1.35}
.wardrobe-actor-source{font-size:12px;color:var(--wr-muted)}
.wardrobe-actor-current-items{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-height:120px}
.wardrobe-actor-current-items .wardrobe-current-chip{display:flex;align-items:center;gap:7px;max-width:100%}
.wardrobe-actor-current-items .wardrobe-current-chip span{color:var(--wr-muted);font-size:11px}
.wardrobe-actor-current-actions,.wardrobe-pool-card-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.wardrobe-actor-empty{padding:18px 10px;color:var(--wr-muted);font-size:12px;line-height:1.6;text-align:center}
.wardrobe-auto-random{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;margin-bottom:12px;border:1px solid var(--wr-line);border-radius:10px;background:var(--wr-bg)}
.wardrobe-auto-random>span{display:flex;flex-direction:column;gap:3px;min-width:0}.wardrobe-auto-random small{color:var(--wr-muted);line-height:1.45}
.wardrobe-auto-random.is-disabled{opacity:.68}
.wardrobe-switch{position:relative;flex:0 0 auto;width:42px;height:24px;padding:2px;border:1px solid var(--wr-line);border-radius:999px;background:var(--wr-line);cursor:pointer}
.wardrobe-switch>span:first-child{display:block;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .16s ease}
.wardrobe-switch[aria-checked="true"]{background:var(--wr-accent);border-color:var(--wr-accent)}
.wardrobe-switch[aria-checked="true"]>span:first-child{transform:translateX(17px)}
.wardrobe-switch:disabled{cursor:not-allowed}
.wardrobe-actor-pool-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}
.wardrobe-pool-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:11px;padding:9px;border:1px solid var(--wr-line);border-radius:10px;background:var(--wr-bg)}
.wardrobe-pool-card-image{border-radius:7px;overflow:hidden;background:linear-gradient(145deg,var(--wr-accent-soft),transparent)}
.wardrobe-pool-card-image img{width:100%;height:100%;display:block;object-fit:contain}
.wardrobe-pool-card-copy{min-width:0}.wardrobe-pool-card-title{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}
.wardrobe-pool-card-title strong{min-width:0;overflow-wrap:anywhere}.wardrobe-pool-card-copy p{margin:6px 0;color:var(--wr-muted);font-size:12px;line-height:1.45}
.wardrobe-random-badge{flex:0 0 auto;padding:2px 6px;border-radius:999px;background:var(--wr-accent);color:#fff;font-size:10px;font-weight:700}
.wardrobe-pool-card-actions{margin-top:9px}.wardrobe-pool-card-actions .wardrobe-btn{padding:5px 8px}
.wardrobe-pool-manager{display:flex;flex-direction:column;gap:12px}
.wardrobe-pool-search{display:flex;align-items:stretch;flex-direction:column}.wardrobe-pool-search input{width:100%;min-width:0;box-sizing:border-box}
.wardrobe-pool-manager-list{display:flex;flex-direction:column;gap:7px;min-height:100px}
.wardrobe-pool-manager-option{display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid var(--wr-line);border-radius:9px;background:var(--wr-bg);cursor:pointer}
.wardrobe-pool-manager-option input{margin-top:2px}.wardrobe-pool-manager-option>span{display:flex;min-width:0;flex-direction:column;gap:3px}
.wardrobe-pool-manager-option small{color:var(--wr-muted);line-height:1.45}.wardrobe-pool-manager-actions{justify-content:flex-end}
.wardrobe-picker{display:flex;flex-direction:column;gap:10px}
.wardrobe-picker-cats{display:flex;gap:6px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px;scrollbar-width:none}
.wardrobe-picker-cats::-webkit-scrollbar{display:none}
.wardrobe-picker-cat{flex:0 0 auto;border:1px solid var(--wr-line);background:var(--wr-panel);color:var(--wr-text);border-radius:999px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}
.wardrobe-picker-cat[aria-pressed="true"]{color:#fff;background:var(--wr-accent);border-color:var(--wr-accent)}
.wardrobe-picker-search{display:flex;align-items:stretch;flex-direction:column}
.wardrobe-picker-search input{width:100%;min-width:0;box-sizing:border-box}
.wardrobe-picker-list{display:flex;flex-direction:column;gap:6px;max-height:min(420px,60vh);overflow:auto}
.wardrobe-picker-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px 10px;border:1px solid var(--wr-line);border-radius:8px;background:var(--wr-bg);color:var(--wr-text);font:inherit;font-size:13px;cursor:pointer}
.wardrobe-picker-item.is-worn{border-color:var(--wr-accent);background:var(--wr-accent-soft)}
.wardrobe-picker-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wardrobe-picker-meta{color:var(--wr-muted);font-size:12px;min-width:0;overflow:hidden;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.wardrobe-picker-worn{margin-left:auto;flex:0 0 auto;padding:2px 7px;border-radius:999px;background:var(--wr-accent);color:#fff;font-size:10px;font-weight:700}
.wardrobe-picker-check{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--wr-line);border-radius:8px;background:var(--wr-bg)}
.wardrobe-picker-check input{margin:0;flex:0 0 auto}
.wardrobe-picker-check.is-in-pool{opacity:.7}
.wardrobe-picker-actions{justify-content:flex-end}
.wardrobe-actor-section-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.wardrobe-mobile-steps{display:none}
.wardrobe-queue-summary{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px;border:1px solid var(--wr-line);border-radius:10px;background:var(--wr-panel);margin-bottom:12px}
.wardrobe-queue-list{display:flex;flex-direction:column;gap:7px}
.wardrobe-task{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 11px;border:1px solid var(--wr-line);border-radius:8px;background:var(--wr-panel)}
.wardrobe-task-error{grid-column:1/-1;color:#c34b4b;font-size:12px}

@media (max-width:900px){
  .wardrobe-actor-content{overflow:auto}
  .wardrobe-actor-workbench{grid-template-columns:minmax(0,1fr);height:auto}
  .wardrobe-actor-rail{overflow:visible}
  .wardrobe-actor-list{flex-direction:row;overflow-x:auto;padding-bottom:3px}
  .wardrobe-actor-option{flex:0 0 auto;width:auto;min-width:112px}
  .wardrobe-actor-option[aria-selected="true"]{box-shadow:inset 0 -3px 0 var(--wr-accent)}
  .wardrobe-actor-current,.wardrobe-actor-pool{overflow:visible}
  .wardrobe-actor-pool-list{grid-template-columns:minmax(0,1fr)}
  .wardrobe-pool-card{grid-template-columns:80px minmax(0,1fr)}
}
@media (max-width:720px){
  .wardrobe-window{width:100%;height:100vh;height:100dvh;border-radius:0;border-left:0;border-right:0}
  .wardrobe-head{padding:8px 10px;gap:8px;flex-wrap:wrap}.wardrobe-title{font-size:17px}
  .wardrobe-toolbar-items .wardrobe-search{width:100%}
  .wardrobe-toolbar-items .wardrobe-search input{flex:1;min-width:0;width:100%}
  .wardrobe-filter-row,.wardrobe-actions-row{display:flex;flex-wrap:nowrap;overflow-x:auto;width:100%;min-width:0;gap:6px;padding-bottom:2px}
  .wardrobe-filter-row .wardrobe-filter,.wardrobe-actions-row .wardrobe-btn{flex:0 0 auto}
  .wardrobe-filter-row,.wardrobe-actions-row,.wardrobe-current-items{scrollbar-width:none}
  .wardrobe-filter-row::-webkit-scrollbar,.wardrobe-actions-row::-webkit-scrollbar,.wardrobe-current-items::-webkit-scrollbar{display:none}
  .wardrobe-toolbar-spacer{display:none}
  .wardrobe-current-items{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}
  .wardrobe-current-chip{flex:0 0 auto}
  .wardrobe-routes{order:3;width:100%;margin:0}.wardrobe-route{flex:1;padding:7px 4px}
  .wardrobe-content{padding:10px}.wardrobe-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .wardrobe-outfit-editor{display:block;height:auto}
  .wardrobe-mobile-steps{display:flex;gap:6px;margin-bottom:9px}
  .wardrobe-mobile-step{flex:1;padding:7px 3px}
  .wardrobe-outfit-editor[data-mobile-step="1"] .wardrobe-editor-column:not(.wardrobe-editor-library),
  .wardrobe-outfit-editor[data-mobile-step="2"] .wardrobe-editor-column:not(.wardrobe-editor-preview),
  .wardrobe-outfit-editor[data-mobile-step="3"] .wardrobe-editor-column:not(.wardrobe-editor-meta){display:none}
  .wardrobe-detail{width:100%}
  .wardrobe-detail .wardrobe-btn,.wardrobe-detail select{min-height:36px}
  .wardrobe-npc-controls{grid-template-columns:1fr}
  .wardrobe-npc-controls .wardrobe-btn{width:100%}
  .wardrobe-modal-backdrop{padding:8px}.wardrobe-modal{width:100%;max-height:94vh;max-height:94dvh}
  .wardrobe-extraction-row{grid-template-columns:auto 1fr}
  .wardrobe-extraction-row textarea{grid-column:1/-1}
}
@media (prefers-reduced-motion:reduce){
  .wardrobe-window *{scroll-behavior:auto!important;transition:none!important;animation:none!important}
}
`;
