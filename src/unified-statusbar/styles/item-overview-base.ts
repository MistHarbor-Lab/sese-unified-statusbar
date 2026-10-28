// ===== 物品总览图面板共享 CSS（令牌驱动；深色经 .panel-overlay.dark / body.dark-mode 双锚点） =====
// 令牌纪律：--card-bg 全主题浅深双态有定义（见 portrait-base 惯例）；--border/--bg 裸用为死变量禁入。

export const ITEM_OVERVIEW_BASE_CSS = `
.iov-window{
  --iov-panel:var(--card-bg,#faf7f2);
  --iov-bg:var(--card,#fff);
  --iov-text:var(--text,#33302c);
  --iov-muted:var(--text-muted,var(--sweet-text-muted,#8a837a));
  --iov-line:var(--divider-light,rgba(0,0,0,.12));
  --iov-accent:var(--accent,#8d5c42);
  --iov-warn-bg:rgba(198,124,44,.12);
  --iov-warn-text:#a4611a;
}
.panel-overlay.dark .iov-window,
body.dark-mode .iov-window{
  --iov-panel:#242220;--iov-bg:#191817;--iov-text:#f1ece7;--iov-muted:#b3aaa1;
  --iov-line:#494541;--iov-warn-bg:rgba(224,158,74,.16);--iov-warn-text:#e0a45a;
}
.iov-window .panel-popup-body{display:flex;flex-direction:column;gap:10px;}
.iov-stage{
  position:relative;border:1px solid var(--iov-line);border-radius:10px;
  background:var(--iov-panel);aspect-ratio:3/2;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
}
.iov-stage img{max-width:100%;max-height:100%;object-fit:contain;display:block;cursor:zoom-in;}
.iov-placeholder{
  color:var(--iov-muted);font-size:12px;line-height:1.8;text-align:center;padding:12px;
}
.iov-stale{
  position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);
  background:var(--iov-warn-bg);color:var(--iov-warn-text);
  border-radius:999px;padding:3px 10px;font-size:11px;line-height:1.5;
  backdrop-filter:blur(4px);
}
.iov-meta{font-size:11px;color:var(--iov-muted);line-height:1.6;display:flex;flex-wrap:wrap;gap:5px;align-items:baseline;}
/* F86：meta 拆段芯片（关键量 accent 数字 tabular；风格/尺寸 dim 档） */
.iov-chip{display:inline-flex;align-items:baseline;gap:2px;padding:1px 7px;border-radius:5px;font-size:10.5px;background:var(--iov-soft,rgba(128,128,128,.07));border:1px solid var(--iov-line);color:var(--iov-text);font-variant-numeric:tabular-nums;}
.iov-chip.dim{color:var(--iov-muted);}
.iov-chip b.num{color:var(--iov-accent,var(--accent));}
.iov-label{font-size:12px;font-weight:600;color:var(--iov-text);}
.iov-prompt,.iov-extra{
  width:100%;box-sizing:border-box;border:1px solid var(--iov-line);border-radius:8px;
  background:var(--iov-bg);color:var(--iov-text);font:inherit;font-size:12px;
  padding:8px 10px;resize:vertical;
}
.iov-prompt{min-height:64px;font-family:inherit;}
.iov-extra{min-height:32px;resize:none;}
.iov-prompt::placeholder,.iov-extra::placeholder{color:var(--iov-muted);opacity:.8;}
.iov-actions{display:flex;flex-wrap:wrap;gap:8px;}
`;
