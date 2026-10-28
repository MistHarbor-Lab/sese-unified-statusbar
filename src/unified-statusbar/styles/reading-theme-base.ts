// ub-literary-v1: shared reading-first layout layer for ancient + xianxia.
// Contains NO theme colors — only structural layout, typography scale,
// component states, responsive rules, focus and reduced-motion.
// Ancient/xianxia supply all color via --ub-* tokens defined in their own files.
export const readingThemeCSS = /* css */ `
/* ub-literary-v1: reading-first shared layer for ancient + xianxia */

/* === 排版阶梯（§7.2）=== */
.ub-reading-shell{
  --ub-type-caption:12px/18px;--ub-type-caption-size:12px;
  --ub-type-label:13px/20px;--ub-type-label-size:13px;
  --ub-type-section:16px/24px;--ub-type-section-size:16px;
  --ub-type-title:28px/38px;--ub-type-title-size:28px;
  font-family:var(--ub-font-ui);
  color:var(--ub-text-1);
  background:var(--ub-canvas);
  border-radius:var(--ub-radius-shell);
  box-shadow:var(--ub-shadow-1);
  padding:0;
  margin:0;
  overflow:hidden;
}
.ub-reading-shell *{min-width:0}

/* === A. 身份栏 .ub-masthead（§9.1）=== */
.ub-masthead{
  display:flex;flex-direction:column;gap:8px;position:relative;
  padding:16px 18px 12px;
  border-bottom:1px solid var(--ub-border-subtle);
  background:var(--ub-surface-1);
}
.ub-masthead-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:12px;min-width:0}
.ub-masthead-row[data-row="identity"]{margin:0 18px}
.ub-masthead-name{
  flex:0 1 auto;min-width:0;
  font-family:var(--ub-font-reading);font-weight:600;
  font-size:var(--ub-type-title-size);line-height:38px;
  letter-spacing:.02em;color:var(--ub-text-1);
  overflow-wrap:anywhere;cursor:pointer;
  transition:color 120ms cubic-bezier(.2,0,0,1);
}
.ub-masthead-name:hover{color:var(--ub-accent)}
.ub-masthead-resource{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;
  margin-right:4px;
  font-size:var(--ub-type-caption-size);color:var(--ub-text-3);white-space:nowrap;
}
.ub-masthead-resource b{font-size:15px;font-weight:600;color:var(--ub-text-1);font-family:var(--ub-font-ui);font-variant-numeric:tabular-nums}
.ub-masthead-resource svg{flex:none;color:var(--ub-accent)}
.ub-masthead-status{
  flex:1 1 100%;font-family:var(--ub-font-reading);
  font-size:var(--ub-content-font-13,14.3px);line-height:22px;color:var(--ub-text-2);font-weight:600;
  overflow-wrap:anywhere;
}
.ub-masthead-status[data-clamped="true"]{
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
}
.ub-masthead-meta{
  display:flex;flex-wrap:wrap;gap:8px 16px;
  font-size:var(--ub-type-caption-size);color:var(--ub-text-3);line-height:18px;
}
.ub-masthead-meta-item{display:inline-flex;align-items:center;gap:4px;min-width:0}
.ub-masthead-meta-item svg{flex:none;color:var(--ub-text-3)}
/* 右对齐操作簇（masthead / profile）：须可被压缩（flex 收缩因子 1）。
   窄屏时父级 flex-wrap 会把整簇挤到下一行，若此处声明 flex:0 0 auto / flex-shrink:0，
   簇会保持 max-content 宽度冲出 .ub-reading-shell（overflow:hidden）——尾部按钮被静默裁掉
   且无法滚动到（古风「手记」= 日记按钮曾整颗不可见）。簇自带 flex-wrap:wrap，
   压到行宽后按钮自行折行，永不截断。 */
.ub-masthead-actions{display:flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;flex-wrap:wrap;margin-left:auto}
.ub-sys-btn{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:36px;min-height:36px;padding:0 8px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-text-2);cursor:pointer;
  transition:color 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1),border-color 120ms cubic-bezier(.2,0,0,1);
}
.ub-sys-btn:hover{background:var(--ub-surface-2);border-color:var(--ub-border-strong);color:var(--ub-text-1)}
.ub-sys-btn:active{transform:translateY(1px)}
.ub-sys-btn[aria-pressed="true"]{background:var(--ub-accent-soft);border-color:var(--ub-accent);color:var(--ub-accent)}
/* 场景切换按钮统一为 literary 操作按钮几何，保留 daily/nsfw 激活态语义色 */
.ub-reading-shell .scene-btn{
  display:inline-flex;align-items:center;justify-content:center;
  min-height:36px;padding:0 10px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-text-2);font:400 var(--ub-type-label) var(--ub-font-ui);
  cursor:pointer;white-space:nowrap;flex-shrink:0;
  transition:color 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1),border-color 120ms cubic-bezier(.2,0,0,1);
}
.ub-reading-shell .scene-btn:hover{background:var(--ub-surface-2);border-color:var(--ub-border-strong);color:var(--ub-text-1)}
.ub-reading-shell .scene-btn:active{transform:translateY(1px)}
.ub-reading-shell .scene-btn.scene-active-daily{border-color:var(--ub-accent);color:var(--ub-accent);background:var(--ub-accent-soft)}
.ub-reading-shell .scene-btn.scene-active-nsfw{border-color:var(--ub-nsfw,var(--ub-accent));color:var(--ub-nsfw,var(--ub-accent));background:var(--ub-nsfw-soft,var(--ub-accent-soft))}

/* === B. 高频工具栏 .ub-toolrail（§9.2）=== */
.ub-toolrail{
  display:flex;gap:8px;padding:10px 14px;
  background:var(--ub-surface-2);border-bottom:1px solid var(--ub-border-subtle);
  overflow-x:auto;scrollbar-width:thin;
}
.ub-tool-btn{
  flex:1 1 0;min-width:0;min-height:36px;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:0 12px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-text-2);font:400 var(--ub-type-label) var(--ub-font-ui);
  cursor:pointer;white-space:nowrap;
  transition:color 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1),border-color 120ms cubic-bezier(.2,0,0,1);
}
.ub-tool-btn:hover{background:var(--ub-surface-3);border-color:var(--ub-border-strong);color:var(--ub-text-1)}
.ub-tool-btn:active{transform:translateY(1px)}
.ub-tool-btn[data-primary="true"]{
  background:var(--ub-accent);border-color:var(--ub-accent);color:var(--ub-text-on-accent);font-weight:600;
}
.ub-tool-btn[data-primary="true"]:hover{background:var(--ub-accent-hover);border-color:var(--ub-accent-hover)}
.ub-tool-btn svg{flex:none}
.ub-tool-btn .ub-tool-label{overflow:hidden;text-overflow:ellipsis}

/* === C. 玩法折叠区 .ub-play-disclosure（§9.3）=== */
.ub-play-disclosure{padding:12px 14px 0;background:var(--ub-surface-1)}
.ub-play-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ub-play-head-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.ub-play-collapse-btn{
  display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 12px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-text-1);font:600 var(--ub-type-label) var(--ub-font-ui);
  cursor:pointer;
  transition:color 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1),border-color 120ms cubic-bezier(.2,0,0,1);
}
.ub-play-collapse-btn:hover{background:var(--ub-surface-2);border-color:var(--ub-border-strong)}
.ub-play-collapse-btn .ub-play-chevron{transition:transform 180ms cubic-bezier(.2,0,0,1)}
.ub-play-collapse-btn[aria-expanded="true"] .ub-play-chevron{transform:rotate(180deg)}
.ub-play-summary{font-size:var(--ub-type-caption-size);color:var(--ub-text-3)}
.ub-play-body{padding-top:12px}
.ub-play-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px}
.ub-play-card{display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--ub-surface-2);border:1px solid var(--ub-border-subtle);border-radius:var(--ub-radius-panel)}
.ub-play-card-select{
  flex:1;min-width:0;min-height:36px;padding:0 8px;
  border:1px solid var(--ub-border)!important;border-radius:var(--ub-radius-control);
  background:var(--ub-surface-1);background-color:var(--ub-surface-1)!important;color:var(--ub-text-1)!important;font:400 var(--ub-type-label) var(--ub-font-ui);
}
.ub-play-card-select option{background:var(--ub-surface-1)!important;color:var(--ub-text-1)!important}
.ub-play-card-select:focus-visible{outline:2px solid var(--ub-focus);outline-offset:2px}
.ub-play-action-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:36px;padding:0 10px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-text-2);font:400 var(--ub-type-label) var(--ub-font-ui);cursor:pointer;white-space:nowrap;
  transition:color 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1),border-color 120ms cubic-bezier(.2,0,0,1);
}
.ub-play-action-btn:hover{background:var(--ub-surface-2);border-color:var(--ub-border-strong);color:var(--ub-text-1)}
.ub-play-action-btn:active{transform:translateY(1px)}
.ub-play-action-btn:disabled{opacity:.55;cursor:wait;box-shadow:none}

/* === D. 角色页签 .ub-character-tabs（§5.3）=== */
.ub-character-tabs{
  display:flex;gap:4px;padding:14px 14px 8px;
  overflow-x:auto;scrollbar-width:thin;
  border-bottom:1px solid var(--ub-border-subtle);
  background:var(--ub-surface-1);
}
.ub-character-tabs[role="tablist"]{scroll-snap-type:x proximity}
.ub-char-tab{
  flex:0 0 auto;min-height:36px;padding:0 14px;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  background:transparent;border:1px solid transparent;border-radius:var(--ub-radius-control);
  color:var(--ub-text-2);font:400 var(--ub-type-label) var(--ub-font-ui);
  cursor:pointer;white-space:nowrap;scroll-snap-align:start;
  transition:background 160ms cubic-bezier(.2,0,0,1),border-color 160ms cubic-bezier(.2,0,0,1),color 160ms cubic-bezier(.2,0,0,1);
}
.ub-char-tab:hover{background:var(--ub-surface-2);color:var(--ub-text-1)}
.ub-char-tab[aria-selected="true"]{
  background:var(--ub-accent-soft);border-color:var(--ub-accent);color:var(--ub-accent);font-weight:600;
}

/* === E. 角色档案 .ub-character-profile（§9.4）=== */
.ub-character-profile{padding:16px 14px 16px;background:var(--ub-surface-1)}
.ub-profile-top{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start}
.ub-profile-portrait{
  flex:0 0 auto;width:92px;height:126px;border-radius:var(--ub-radius-panel);overflow:hidden;
  border:1px solid var(--ub-border);background:var(--ub-surface-3);cursor:pointer;
}
.ub-profile-portrait img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.ub-profile-head{display:flex;flex-direction:column;gap:4px;min-width:0}
.ub-profile-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.ub-profile-name{font-family:var(--ub-font-reading);font-weight:600;font-size:var(--ub-type-title-size);line-height:38px;color:var(--ub-text-1);overflow-wrap:anywhere;cursor:pointer;transition:color 120ms cubic-bezier(.2,0,0,1)}
.ub-profile-name:hover{color:var(--ub-accent)}
.ub-profile-emotion{font-size:var(--ub-type-label-size);color:var(--ub-text-3)}
.ub-profile-bio{font-size:var(--ub-type-caption-size);color:var(--ub-text-3);overflow-wrap:anywhere}
.ub-profile-thought{
  margin:12px 0 0;padding:8px 12px;border-left:3px solid var(--ub-accent);
  background:var(--ub-surface-2);border-radius:var(--ub-radius-control);
  font-family:var(--ub-font-reading);font-size:var(--ub-content-font-12,13.2px);line-height:24px;color:var(--ub-text-2);font-weight:600;
  overflow-wrap:anywhere;
}
.ub-profile-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 12px;margin:14px 0 0}
.ub-profile-facts .ub-fact-label{font-size:var(--ub-type-caption-size);color:var(--ub-text-3);align-self:start;line-height:22px}
.ub-profile-facts .ub-fact-value{font-size:var(--ub-content-font-13,14.3px);line-height:22px;color:var(--ub-text-2);overflow-wrap:anywhere;min-width:0}
/* 同上：角色上下文操作簇（大调查/采风/往事/手记）必须可压缩，否则窄屏下尾部按钮出框不可见。 */
.ub-context-actions{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto;flex-shrink:1;min-width:0}
.ub-context-actions .ub-ctx-btn{
  display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-text-2);font:400 var(--ub-type-label) var(--ub-font-ui);cursor:pointer;
  transition:color 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1),border-color 120ms cubic-bezier(.2,0,0,1);
}
.ub-context-actions .ub-ctx-btn:hover{background:var(--ub-surface-2);border-color:var(--ub-border-strong);color:var(--ub-text-1)}
.ub-context-actions .ub-ctx-btn:active{transform:translateY(1px)}
.ub-meter-row{display:flex;align-items:center;gap:10px;margin:14px 0 0}
.ub-meter-label{flex:0 0 auto;font:600 var(--ub-type-label) var(--ub-font-ui);color:var(--ub-text-2)}
.ub-meter-track{flex:1;min-width:0;height:6px;background:var(--ub-surface-3);border-radius:999px;overflow:hidden}
.ub-meter-fill{height:100%;background:var(--ub-accent);border-radius:999px;transition:width 260ms cubic-bezier(.2,0,0,1)}
.ub-meter-value{flex:0 0 auto;font-size:var(--ub-type-caption-size);color:var(--ub-text-3);font-variant-numeric:tabular-nums}

/* === F. 衣着/身体详情 .ub-detail-list（§9.5）=== */
.ub-detail-tabs{display:flex;gap:8px;margin:14px 0 0;border-bottom:1px solid var(--ub-border-subtle)}
.ub-detail-tab{
  flex:0 0 auto;min-height:36px;padding:0 12px;
  background:transparent;border:none;border-bottom:2px solid transparent;
  color:var(--ub-text-3);font:400 var(--ub-type-label) var(--ub-font-ui);cursor:pointer;
  transition:color 160ms cubic-bezier(.2,0,0,1),border-color 160ms cubic-bezier(.2,0,0,1);
}
.ub-detail-tab:hover{color:var(--ub-text-1)}
.ub-detail-tab[aria-selected="true"]{color:var(--ub-text-1);border-bottom-color:var(--ub-accent);font-weight:600}
.ub-detail-list{display:flex;flex-direction:column;margin:0;padding:0}
.ub-detail-row{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px 12px;padding:8px 0;border-bottom:1px solid var(--ub-border-subtle)}
.ub-detail-row:last-child{border-bottom:none}
.ub-detail-row .ub-detail-label{font-size:var(--ub-type-caption-size);color:var(--ub-text-3);line-height:22px}
.ub-detail-row .ub-detail-value{font-size:var(--ub-content-font-12,13.2px);line-height:22px;color:var(--ub-text-2);overflow-wrap:anywhere;min-width:0}
.ub-detail-summary .ub-detail-value{color:var(--ub-text-1)}

/* === 配色切换按钮（古风/仙侠 合并风格内）=== */
.ub-scheme-toggle{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:36px;min-height:36px;padding:0 8px;
  background:transparent;border:1px solid var(--ub-border);border-radius:var(--ub-radius-control);
  color:var(--ub-accent);cursor:pointer;
  transition:color 160ms cubic-bezier(.2,0,0,1),background 160ms cubic-bezier(.2,0,0,1),border-color 160ms cubic-bezier(.2,0,0,1);
}
.ub-scheme-toggle:hover{background:var(--ub-surface-2);border-color:var(--ub-border-strong)}
.ub-scheme-toggle svg{flex:none;color:var(--ub-accent)}

/* === 焦点指示（§12）=== */
.ub-reading-shell :where(button,summary,[role="tab"],[role="menuitem"],.ub-sys-btn,.ub-tool-btn,.ub-char-tab,.ub-ctx-btn,.ub-detail-tab,.ub-play-collapse-btn,.ub-play-action-btn,.ub-scheme-toggle):focus-visible{
  outline:2px solid var(--ub-focus);outline-offset:2px;
}
.ub-reading-shell :where(select,input,textarea):focus-visible{outline:2px solid var(--ub-focus);outline-offset:2px}

/* === 响应式（§8.2 中窄屏 <760px：工具栏切竖排宫格，图标在上二字标签在下，永不截断）=== */
@media (max-width:759px){
  .ub-toolrail{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 10px;overflow-x:visible}
  .ub-toolrail .ub-tool-btn{flex-direction:column;gap:3px;padding:8px 4px;min-height:56px}
  .ub-toolrail .ub-tool-btn .ub-tool-label{font-size:var(--ub-type-caption-size);line-height:1.2;max-width:100%}
}

/* === 响应式（§8.3 移动端 <560px）=== */
@media (max-width:559px){
  .ub-masthead{padding:12px 12px 10px}
  .ub-masthead-row[data-row="identity"]{margin:0 12px}
  .ub-masthead-name{font-size:24px;line-height:32px}
  .ub-masthead-actions{width:100%;justify-content:flex-start;margin-left:0}
  .ub-play-disclosure{padding:10px 12px 0}
  .ub-play-grid{grid-template-columns:1fr}
  .ub-character-tabs{padding:10px 12px 6px}
  .ub-char-tab{min-height:44px}
  .ub-character-profile{padding:12px 12px 14px}
  .ub-profile-top{grid-template-columns:auto 1fr;gap:12px}
  .ub-profile-portrait{width:72px;height:96px}
  .ub-profile-name{font-size:24px;line-height:32px}
  .ub-detail-row{grid-template-columns:68px minmax(0,1fr)}
  .ub-context-actions .ub-ctx-btn{min-height:44px}
  .ub-detail-tab{min-height:44px}
}

/* === 极窄（§8.4）=== */
@media (max-width:360px){
  .ub-masthead-meta{font-size:12px}
  .ub-tool-btn{padding:0 6px}
}

/* === 弹窗三段式骨架（§9.6）—— overlay 共享，各 *-base 已有具体尺寸 === */
.ub-reading-shell .ub-popup{display:flex;flex-direction:column;max-height:calc(100dvh - 24px - var(--safe-top,0px) - var(--safe-bottom,0px))}
.ub-popup-head{position:sticky;top:0;z-index:2;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--ub-surface-1);border-bottom:1px solid var(--ub-border-subtle)}
.ub-popup-body{flex:1;min-height:0;overflow:auto;padding:16px;background:var(--ub-surface-1);overflow-wrap:anywhere}
.ub-popup-foot{position:sticky;bottom:0;z-index:2;padding:12px 16px;background:var(--ub-surface-1);border-top:1px solid var(--ub-border-subtle)}

/* === 旧主题类残留兼容：新骨架元素仍携带 .book / .spine-label / .xx-char-pill，
   旧主题 CSS 对它们的装饰（卷轴竹简/竖排毛笔/胶囊发光）须被新骨架视觉接管。=== */
.ub-reading-shell.book::before,
.ub-reading-shell.book::after{display:none}
.ub-char-tab.spine-label,
.ub-char-tab.xx-char-pill{
  writing-mode:horizontal-tb;text-orientation:mixed;letter-spacing:normal;
  min-height:36px;border-bottom:none;font-family:var(--ub-font-ui);
}
.ub-char-tab.spine-label::before,
.ub-char-tab.spine-label::after,
.ub-char-tab.xx-char-pill::after{display:none}

/* === 减弱动画（§11）=== */
@media (prefers-reduced-motion:reduce){
  .ub-reading-shell,.ub-reading-shell *,
  .ub-reading-shell *::before,.ub-reading-shell *::after{
    animation:none!important;transition:none!important;
  }
}
/* ===== ★ 主角立绘摆位（ancient/xianxia 共享：书扉页式两列，等比方框） ===== */
.ub-masthead.pp-enabled{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px 16px;align-items:start}
.ub-masthead.pp-enabled>.portrait-box{grid-column:1;grid-row:1/span 4;flex:0 0 96px;width:96px;height:96px;align-self:start}
.ub-masthead.pp-enabled>.ub-masthead-row,
.ub-masthead.pp-enabled>.ub-masthead-status,
.ub-masthead.pp-enabled>.wardrobe-protagonist-summary,
.ub-masthead.pp-enabled>.ub-masthead-meta{grid-column:2}
@media (max-width:600px){
  .ub-masthead.pp-enabled{gap:8px 10px;padding:12px 12px 10px}
  .ub-masthead.pp-enabled>.portrait-box{flex-basis:72px;width:72px;height:72px}
  .ub-masthead.pp-enabled .ub-masthead-name{font-size:22px;line-height:30px}
}
`;