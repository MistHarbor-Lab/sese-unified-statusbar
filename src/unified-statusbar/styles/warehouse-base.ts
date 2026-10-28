// ===== 仓库分组 UI 共享样式（令牌驱动；深色经 .panel-overlay.dark / body.dark-mode 双锚点） =====
// 只放分组条 / 每组总览图卡片 / 分组管理 / 入库·转移选择弹窗的结构样式；
// 主题色一律走 var(--wh-*) 级联链，禁单变量 + 浅色 hex 回退。

export const WAREHOUSE_BASE_CSS = `
.panel-overlay{
  --wh-card:var(--card,var(--sweet-card,var(--jade-surface-1,var(--ios-surface-solid,#fff))));
  --wh-text:var(--text,var(--sweet-text,var(--jade-text,var(--ios-label,#252525))));
  --wh-muted:var(--text-muted,var(--sweet-text-muted,var(--jade-muted,var(--ios-secondary-label,#777))));
  --wh-line:var(--divider,var(--sweet-border,var(--jade-line,var(--ios-sep,rgba(128,128,128,.28)))));
  --wh-soft:var(--bg-alt,var(--sweet-tag,var(--jade-surface-2,var(--ios-fill,rgba(128,128,128,.08)))));
  --wh-accent:var(--accent,var(--lust,var(--sweet-primary,var(--jade-primary,var(--ios-accent,#7b4b58)))));
  --wh-danger:var(--danger,var(--ub-danger,#c04040));
}

/* === 分组条 === */
.wh-groupbar{display:flex;align-items:center;gap:6px;margin:0 0 10px;min-width:0}
.wh-group-chips{
  display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;
  overflow-x:auto;padding:2px 1px 3px;scrollbar-width:none;
}
.wh-group-chips::-webkit-scrollbar{height:0}
.wh-group-chip{flex:0 0 auto;margin-right:0!important;white-space:nowrap;gap:5px;opacity:.64}
.wh-group-chip.active{opacity:1;font-weight:700;box-shadow:inset 0 0 0 1px currentColor}
.wh-group-count{
  display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:14px;padding:0 4px;
  border-radius:999px;background:rgba(128,128,128,.16);font-size:9px;font-weight:600;line-height:1;
  font-variant-numeric:tabular-nums;
}
.wh-group-add{flex:0 0 auto;margin-right:0!important;width:26px!important;padding:0!important;font-size:14px!important;line-height:1}

/* === 每组总览图封面（有图整图可点 / 无图细条占位） === */
.wh-cover{
  display:block;position:relative;width:100%;box-sizing:border-box;min-height:64px;margin:0 0 10px;padding:0;
  border:1px solid var(--wh-line);border-radius:10px;background:var(--wh-soft);
  overflow:hidden;cursor:pointer;font:inherit;color:inherit;text-align:left;
  -webkit-tap-highlight-color:transparent;transition:border-color .18s;
}
.wh-cover:hover{border-color:var(--wh-accent)}
.wh-cover img{display:block;width:100%;height:auto;transition:transform .3s ease,filter .18s ease}
.wh-cover:hover img{transform:scale(1.012)}
.wh-cover:active img{transform:scale(1.004);filter:brightness(.96)}
.wh-cover-empty{
  display:flex;align-items:center;justify-content:center;gap:7px;
  width:100%;box-sizing:border-box;min-height:48px;margin:0 0 10px;padding:0 12px;
  border:1px dashed var(--wh-line);border-radius:10px;background:transparent;
  color:var(--wh-muted);font:inherit;font-size:11.5px;letter-spacing:.5px;cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:border-color .18s,color .18s,background .18s;
}
.wh-cover-empty:hover{border-color:var(--wh-accent);color:var(--wh-accent);background:var(--wh-soft)}
.wh-cover:focus-visible,.wh-cover-empty:focus-visible{outline:2px solid var(--wh-accent);outline-offset:2px}
.wh-cover-plus{font-size:16px;line-height:1;font-weight:300}
.wh-stale-pill{
  position:absolute;top:8px;right:8px;padding:2px 7px;border-radius:999px;
  background:rgba(20,16,12,.62);color:#ffd28a;font-size:10px;font-weight:600;line-height:1.5;
  border:1px solid rgba(255,210,138,.36);white-space:nowrap;
}

/* === 分组管理 === */
.wh-manage-note{
  margin:0 0 10px;padding:7px 9px;border-left:2px solid var(--wh-line);background:var(--wh-soft);
  color:var(--wh-muted);font-size:10.5px;line-height:1.6;
}
.wh-group-list{display:flex;flex-direction:column;gap:8px}
.wh-group-row{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 10px;
  border:1px solid var(--wh-line);border-radius:9px;background:var(--wh-soft);
}
.wh-group-row.active{box-shadow:inset 0 0 0 1px var(--wh-accent)}
.wh-group-row-main{flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:3px}
.wh-group-row-name{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:12px;font-weight:600;color:var(--wh-text)}
.wh-group-row-meta{font-size:10px;color:var(--wh-muted);line-height:1.45}
.wh-group-row-actions{display:flex;gap:5px;flex-wrap:wrap;flex:0 0 auto}
.wh-group-act{height:24px!important;margin:0!important;padding:0 8px!important;font-size:10px!important;opacity:1!important}
.wh-group-act.danger{color:var(--wh-danger)!important;border-color:currentColor!important;background:transparent!important}
.wh-group-act:disabled{opacity:.38!important;cursor:not-allowed}
.wh-badge{
  display:inline-flex;align-items:center;padding:1px 5px;border-radius:4px;
  background:var(--wh-accent);color:#fff;font-size:9px;font-weight:600;line-height:1.2;
}
.wh-add-group{
  width:100%;margin-top:10px;padding:8px;border:1px dashed var(--wh-line);border-radius:8px;
  background:transparent;color:var(--wh-accent);font:inherit;font-size:12px;cursor:pointer;
}
.wh-add-group:hover{background:var(--wh-soft)}

/* === 入库 / 转移 / 合并目标选择弹窗 === */
.wh-put-dialog{max-width:460px!important}
.wh-put-dialog .ub-confirm-message{padding-top:10px}
.wh-pick-sub{font-size:12px;line-height:1.65;color:var(--wh-text);white-space:pre-line;margin:0 0 10px}
.wh-pick-section{margin:0 0 11px}
.wh-pick-label{font-size:10.5px;font-weight:600;color:var(--wh-muted);letter-spacing:.4px;margin:0 0 6px}
.wh-pick-list{display:flex;flex-direction:column;gap:5px;max-height:190px;overflow-y:auto;overscroll-behavior:contain}
.wh-pick-row{
  display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;
  border:1px solid var(--wh-line);border-radius:8px;background:var(--wh-card);color:var(--wh-text);
  font:inherit;font-size:12px;cursor:pointer;text-align:left;
}
.wh-pick-row:hover{background:var(--wh-soft)}
.wh-pick-row.selected{border-color:var(--wh-accent);box-shadow:inset 0 0 0 1px var(--wh-accent)}
.wh-pick-radio{
  flex:0 0 14px;width:14px;height:14px;border-radius:50%;border:1.5px solid var(--wh-line);
  display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;color:transparent;
}
.wh-pick-row.selected .wh-pick-radio{border-color:var(--wh-accent);background:var(--wh-accent);color:#fff}
.wh-pick-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wh-pick-count{flex:0 0 auto;font-size:10px;color:var(--wh-muted);font-variant-numeric:tabular-nums}
.wh-mode{display:flex;flex-direction:column;gap:6px}
.wh-mode-opt{
  display:flex;align-items:flex-start;gap:8px;width:100%;padding:8px 10px;
  border:1px solid var(--wh-line);border-radius:8px;background:var(--wh-card);color:var(--wh-text);
  font:inherit;text-align:left;cursor:pointer;
}
.wh-mode-opt:hover{background:var(--wh-soft)}
.wh-mode-opt.selected{border-color:var(--wh-accent);box-shadow:inset 0 0 0 1px var(--wh-accent)}
.wh-mode-dot{
  flex:0 0 14px;width:14px;height:14px;margin-top:1px;border-radius:50%;border:1.5px solid var(--wh-line);
  display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;color:transparent;
}
.wh-mode-opt.selected .wh-mode-dot{border-color:var(--wh-accent);background:var(--wh-accent);color:#fff}
.wh-mode-copy b{display:block;font-size:12px;font-weight:600}
.wh-mode-copy small{display:block;margin-top:2px;font-size:10px;line-height:1.45;color:var(--wh-muted)}
.wh-put-note{
  margin:2px 0 0;padding:6px 8px;border-radius:6px;background:var(--wh-soft);
  font-size:10px;line-height:1.55;color:var(--wh-muted);white-space:pre-line;
}
.wh-put-note.danger{color:var(--wh-danger)}
.wh-pick-empty{padding:14px 0;text-align:center;font-size:11px;color:var(--wh-muted)}

@media(max-width:460px){
  .wh-group-act{padding:0 6px!important;font-size:9.5px!important}
}
`;
