// styles/world-window-base.ts
// 世界演化窗口 ·「一幕两光」：台前/幕后共用同一张主题表面（--surf），
// 幕后仅以一层薄暗纱（--veil）+ 灰调区分，不再整块换底色。
// 每主题只定义一组语义变量；深色模式 = 翻转同一组变量。
export const worldWindowBaseCSS = /* css */ `
.world-window{position:relative;overflow:hidden;display:flex;flex-direction:column;max-width:620px;width:100%;max-height:85vh;max-height:85dvh;box-sizing:border-box;}
.ww-header{position:relative;flex-shrink:0;display:flex;justify-content:flex-end;padding:8px 12px;}
.ww-close-btn{background:transparent;border:none;font-size:var(--ub-ui-font-20,20px);cursor:pointer;line-height:1;color:var(--ww-mut,#888);}
.ww-manual-evolve{margin-right:6px;font-size:var(--ub-ui-font-11,11px);font-family:inherit;padding:3px 12px;border:1px solid currentColor;border-radius:12px;cursor:pointer;background:transparent;opacity:.85;}
.ww-undo-evolve{margin-right:auto;font-size:var(--ub-ui-font-11,11px);font-family:inherit;padding:3px 12px;border:1px solid currentColor;border-radius:12px;cursor:pointer;background:transparent;opacity:.85;}
.ww-manual-evolve:hover,.ww-undo-evolve:hover{opacity:1;}
.ww-manual-evolve.is-busy,.ww-undo-evolve.is-busy{opacity:.5;cursor:wait;}
.ww-undo-evolve:disabled{opacity:.4;cursor:not-allowed;}
.ww-tabs{display:flex;gap:6px;padding:0 12px 8px;}
.ww-tab-btn{flex:1;padding:6px 8px;font-size:var(--ub-ui-font-12,12px);font-family:inherit;border:1px solid var(--ww-line);border-radius:6px;cursor:pointer;background:transparent;color:var(--ww-mut);}
.ww-tab-btn.is-active{font-weight:700;background:var(--ww-acc);color:var(--ww-acc-ink);border-color:var(--ww-acc);}
.ww-pane{overflow-y:auto;min-height:0;padding-bottom:12px;}
.ww-tab-front,.ww-tab-back,.ww-tab-intrusion,.ww-tab-arc{display:none;}
.ww-tab-front.is-active,.ww-tab-back.is-active,.ww-tab-intrusion.is-active,.ww-tab-arc.is-active{display:block;}

/* ===== 台前 · 展签语言 ===== */
.ww-front-head{text-align:center;padding:12px 16px 10px;}
.ww-front-title{font-size:calc(var(--ub-ui-font-12,12px) * 1.6);font-weight:700;letter-spacing:4px;line-height:1.2;color:var(--ww-acc);}
.ww-front-date{font-size:var(--ub-ui-font-11,11px);letter-spacing:2px;padding-top:5px;color:var(--ww-mut);}
.ww-front-body{padding:2px 16px 16px;}
.ww-front-sec{margin-bottom:18px;}
.ww-front-sec-title{font-size:var(--ub-ui-font-12,12px);font-weight:700;letter-spacing:2px;padding-bottom:5px;margin-bottom:9px;border-bottom:2px solid var(--ww-line);color:var(--ww-mut);opacity:.95;}
/* 台前入镜/传闻区（2026-08-21 B 结构：入镜置顶+传闻在下，空模块隐藏；纯色禁渐变） */
.ww-arrival-card{position:relative;border:1px solid var(--ww-accent-line);border-radius:9px;padding:9px 12px;margin:0 0 8px;background:var(--ww-card);box-shadow:none;}
.ww-arrival-who{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-weight:700;font-size:var(--ub-popup-font-body,13px);letter-spacing:.5px;color:var(--ww-acc-strong);}
.ww-arrival-badge{font-style:normal;font-size:var(--ub-ui-font-10,10px);padding:1px 7px;border-radius:8px;letter-spacing:1px;flex:0 0 auto;background:var(--ww-acc);color:var(--ww-acc-ink);}
.ww-arrival-hook{font-size:var(--ub-popup-font-body,13px);line-height:1.6;margin-top:3px;color:var(--ww-ink);}
.ww-arrival-hook::before{content:'「';}
.ww-arrival-hook::after{content:'」';}
.ww-arrival-hook::before,.ww-arrival-hook::after{color:var(--ww-acc);}
.ww-front-rumor{border:1px solid var(--ww-line);border-radius:8px;padding:8px 11px;margin:0 0 7px;background:var(--ww-card);}
.ww-front-rumor-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-weight:600;font-size:var(--ub-popup-font-body,13px);color:var(--ww-ink);}
.ww-front-rumor-level{font-style:normal;font-size:var(--ub-ui-font-10,10px);padding:1px 7px;border-radius:8px;letter-spacing:1px;flex:0 0 auto;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-front-rumor-level.ww-front-rumor-known{background:var(--ww-acc);color:var(--ww-acc-ink);}
.ww-front-rumor-time{font-style:normal;font-size:var(--ub-ui-font-10,10px);margin-left:auto;opacity:.7;}
.ww-front-rumor-body{font-size:var(--ub-popup-font-body,13px);line-height:1.6;margin-top:2px;color:var(--ww-ink);opacity:.92;}
.ww-front-rumor-status{font-size:var(--ub-ui-font-10,10px);margin-top:3px;letter-spacing:.5px;color:var(--ww-mut);}

/* ===== 幕后 · 密档语言（同表面 + 一层薄纱） ===== */
.ww-tab-back{background:var(--ww-veil);border-top:1px solid var(--ww-line);padding-top:4px;}
.ww-back-head{display:flex;align-items:center;gap:6px;font-weight:700;padding:12px 12px 6px;letter-spacing:2px;color:var(--ww-mut);}
.ww-back-block-title{font-weight:700;padding:10px 12px 4px;letter-spacing:2px;font-size:var(--ub-ui-font-12,12px);color:var(--ww-mut);}
.ww-profiles,.ww-rumors{padding-bottom:2px;}
.ww-profiles-toggle{cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px;}
.ww-profiles.collapsed{display:none;}
.ww-fold-all{cursor:pointer;font-size:var(--ub-ui-font-11,11px);opacity:.75;margin-left:auto;}
.ww-fold-all:hover{opacity:1;}
.ww-vault-card{position:relative;border:1px solid var(--ww-line);border-radius:9px;padding:9px 12px;margin:0 12px 8px;background:var(--ww-card);box-shadow:none;}
.ww-vault-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:600;font-size:var(--ub-popup-font-body,13px);color:var(--ww-ink);}
.ww-vault-del{flex:0 0 auto;width:20px;height:20px;border:none;background:none;color:inherit;font-size:var(--ub-ui-font-12,12px);line-height:1;cursor:pointer;opacity:.5;border-radius:5px;padding:0;}
.ww-vault-del:hover{opacity:1;background:rgba(128,128,128,.15);}
.ww-time-badge{font-style:normal;font-size:var(--ub-ui-font-10,10px);opacity:.65;margin-left:auto;}
.ww-vault-row{font-size:var(--ub-popup-font-body,13px);line-height:1.5;padding:1px 0;color:var(--ww-ink);opacity:.88;}
.ww-thread-bar{height:4px;border-radius:2px;overflow:hidden;margin:4px 0 2px;background:var(--ww-chip);}
.ww-thread-bar span{display:block;height:100%;background:var(--ww-mut);}
/* 传闻密档：密档卡，等级徽标复用「主角不知」徽标色系 */
.ww-rumor-card{position:relative;border:1px solid var(--ww-line);border-radius:9px;padding:9px 12px;margin:0 12px 8px;background:var(--ww-card);box-shadow:none;}
.ww-rumor-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:600;font-size:var(--ub-popup-font-body,13px);color:var(--ww-ink);}
.ww-rumor-desc{font-size:var(--ub-popup-font-body,13px);line-height:1.55;margin-top:2px;color:var(--ww-ink);opacity:.9;}
.ww-rumor-level.ww-rumor-vague{opacity:.72;}
.ww-rumor-del{margin-left:auto;flex:0 0 auto;width:20px;height:20px;border:none;background:none;color:inherit;font-size:var(--ub-ui-font-12,12px);line-height:1;cursor:pointer;opacity:.5;border-radius:5px;padding:0;}
.ww-rumor-del:hover{opacity:1;background:rgba(128,128,128,.15);}
.ww-rumor-meter{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:var(--ub-ui-font-10,10px);opacity:.85;}
.ww-rumor-meter .ww-thread-bar{flex:1;}
.ww-rumor-meter-label{flex:0 0 auto;font-style:normal;letter-spacing:.5px;}
.ww-rumor-meter-num{flex:0 0 auto;font-style:normal;min-width:2.5em;text-align:right;}
/* ===== F31：可点姓名 / 可点日期 / 已停用演化（恢复入口） ===== */
/* 姓名钮：只做「可点」信号，配色/字重全继承卡头（各主题零额外分支） */
.ww-vault-name-btn{border:none;background:transparent;padding:0;font:inherit;color:inherit;cursor:pointer;}
.ww-vault-name-btn:hover{text-decoration:underline;}
/* 日期跳转：点线下划 + 悬停取主题特征色；空日期（旧纪事）不带此类，保持死文本观感 */
.ww-date-jump{cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;}
.ww-date-jump:hover{color:var(--ww-acc);}
.ww-excluded{padding-bottom:2px;}
.ww-excluded-row{display:flex;align-items:center;gap:8px;border:1px solid var(--ww-line);border-radius:9px;padding:7px 12px;margin:0 12px 8px;background:var(--ww-card);}
.ww-excluded-name{font-weight:600;font-size:var(--ub-popup-font-body,13px);color:var(--ww-ink);}
.ww-excluded-note{font-style:normal;font-size:var(--ub-ui-font-10,10px);color:var(--ww-mut);}
.ww-excluded-restore{margin-left:auto;flex:0 0 auto;padding:3px 10px;font-size:var(--ub-ui-font-11,11px);font-family:inherit;border-radius:6px;cursor:pointer;background:transparent;color:var(--ww-acc);border:1px solid var(--ww-acc);}
.ww-excluded-restore:hover{background:var(--ww-acc);color:var(--ww-acc-ink);}
.ww-excluded-hint{padding:0 12px 4px;font-size:var(--ub-ui-font-10,10px);line-height:1.5;color:var(--ww-mut);opacity:.85;}
.ww-chron-gone{margin-top:2px;font-size:var(--ub-ui-font-11,11px);opacity:.65;}
.ww-hidden{opacity:.8;}
.ww-empty{padding:14px 16px;font-size:var(--ub-popup-font-body,13px);opacity:.7;}
.ww-notknown,.ww-onstage,.ww-offstage,.ww-rumor-level,.ww-count,.ww-triggered{font-style:normal;font-size:var(--ub-ui-font-10,10px);padding:1px 7px;border-radius:8px;letter-spacing:.5px;display:inline-block;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-onstage{background:var(--ww-hot-bg);color:var(--ww-hot-ink);}
.ww-triggered{background:var(--ww-warm-bg);color:var(--ww-warm-ink);}

/* ===== 入镜队列（幕后同源）===== */
.ww-intrusion{position:relative;border:1px solid var(--ww-line);border-radius:9px;padding:9px 12px;margin:0 12px 8px;background:var(--ww-card);box-shadow:none;}
.ww-intrusion-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:600;font-size:var(--ub-popup-font-body,13px);color:var(--ww-ink);}
.ww-intrusion-hook{font-size:var(--ub-popup-font-body,13px);line-height:1.5;margin-top:2px;color:var(--ww-mut);opacity:.95;}
.ww-intrusion-fill,.ww-intrusion-delete{padding:4px 12px;font-size:var(--ub-ui-font-11,11px);font-family:inherit;border-radius:6px;cursor:pointer;margin-top:7px;}
.ww-intrusion-fill{background:var(--ww-acc);color:var(--ww-acc-ink);border:1px solid var(--ww-acc);}
.ww-intrusion-delete{margin-left:6px;background:transparent;color:var(--ww-mut);border:1px solid var(--ww-line);}

/* ===== 演化纪事（台前时间线，仅展示不注入）===== */
.ww-chronicle{position:relative;padding-left:20px;margin:2px 16px 0 16px;}
.ww-chronicle::before{content:'';position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--ww-line);}
.ww-chronicle .ww-chronicle-item{position:relative;padding:7px 4px;border-bottom:none;}
.ww-chron-dot{position:absolute;left:-16px;top:13px;width:10px;height:10px;border-radius:50%;background:var(--ww-acc);}
.ww-chron-big .ww-chron-dot{background:var(--ww-hot-dot);}
.ww-chron-meta{display:flex;align-items:center;gap:8px;font-size:var(--ub-ui-font-11,11px);color:var(--ww-mut);opacity:1;}
.ww-chron-kind{font-size:var(--ub-ui-font-10,10px);padding:1px 6px;border-radius:7px;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-chron-summary{margin-top:2px;font-size:var(--ub-popup-font-body,13px);line-height:1.5;color:var(--ww-ink);}

/* ===== 演化回廊（变化时间轴，仅展示不注入世界书）=====
   一轮演化=一张轮次卡；卡内每行 = 定宽分类标签列 + 内容列。
   内容列首行是「可折行的仪表行」：身份 + 等级胶囊 + 增量条 + 读数 + 增量徽标同处一个
   flex 容器——放得下并成一行，放不下由 .ww-arc-gauge 抱团整条折行。动向另起前/后对比块。
   全部走 --ww-* 语义变量，六主题与深色自动适配；刻意不用 color-mix 与 :has
   （用户引擎≈Chromium 79-87 不支持）。 */
.ww-tab-arc{background:var(--ww-veil);border-top:1px solid var(--ww-line);padding-top:4px;}
.ww-arc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px 8px;}
.ww-arc-title{font-weight:700;letter-spacing:2px;font-size:var(--ub-ui-font-12,12px);color:var(--ww-mut);}
.ww-arc-sub{font-style:normal;font-weight:400;font-size:var(--ub-ui-font-10,10px);letter-spacing:.5px;opacity:.7;margin-left:6px;}
.ww-arc-item[hidden]{display:none;}
.ww-arc-tools{display:flex;gap:5px;}
.ww-arc-tool{font-size:var(--ub-ui-font-10,10px);padding:1px 9px;border:1px solid var(--ww-line);border-radius:999px;cursor:pointer;color:var(--ww-mut);background:transparent;font-family:inherit;line-height:1.7;}
.ww-arc-tool.is-on{background:var(--ww-acc);color:var(--ww-acc-ink);border-color:var(--ww-acc);font-weight:700;}
.ww-arc-list{position:relative;padding:4px 16px 10px 34px;}
.ww-arc-list::before{content:'';position:absolute;left:22px;top:10px;bottom:14px;width:2px;background:var(--ww-line);}
.ww-arc-item{position:relative;margin-bottom:10px;}
.ww-arc-dot{position:absolute;left:-17px;top:14px;width:9px;height:9px;border-radius:50%;background:var(--ww-mut);}
.ww-arc-item.is-latest .ww-arc-dot{background:var(--ww-acc);box-shadow:0 0 0 3px var(--ww-chip);}
.ww-arc-card{border:1px solid var(--ww-line);border-radius:9px;background:var(--ww-card);}
.ww-arc-item.is-latest .ww-arc-card{border-color:var(--ww-accent-line);}
.ww-arc-card-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 11px 7px;border-bottom:1px dashed var(--ww-line);}
.ww-arc-date{font-style:normal;font-size:var(--ub-ui-font-10,10px);letter-spacing:.5px;color:var(--ww-mut);}
.ww-arc-kind{font-style:normal;font-size:var(--ub-ui-font-10,10px);padding:1px 7px;border-radius:8px;letter-spacing:.5px;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-arc-kind.is-big{background:var(--ww-hot-bg);color:var(--ww-hot-ink);}
/* 轮次卡头只留「日期 + 轮次 + 变化构成」：不回显 world summary（与台前「演化纪事」逐字重复） */
.ww-arc-sum{font-size:var(--ub-ui-font-11,11px);color:var(--ww-mut);opacity:.85;}
.ww-arc-tally{display:flex;align-items:center;gap:9px;font-size:var(--ub-ui-font-10,10px);color:var(--ww-mut);font-variant-numeric:tabular-nums;}
.ww-arc-dotk{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:4px;vertical-align:1px;background:var(--ww-mut);}
.ww-arc-dotk.is-profile{background:var(--ww-warm-ink);}
.ww-arc-dotk.is-rumor{background:var(--ww-hot-ink);}
.ww-arc-dotk.is-intrusion{background:var(--ww-acc);}
.ww-arc-dotk.is-gone{opacity:.45;}
.ww-arc-now{margin-left:auto;font-style:normal;font-size:var(--ub-ui-font-10,10px);font-weight:700;color:var(--ww-acc);}
.ww-arc-lines{padding:7px 11px 9px;display:flex;flex-direction:column;gap:5px;}
.ww-arc-line{display:flex;gap:7px;align-items:baseline;font-size:var(--ub-popup-font-body,13px);line-height:1.5;color:var(--ww-ink);}
/* 标签定宽成列，内容列左边缘对齐——原来标签随文字浮动，扫读时找不到锚点 */
.ww-arc-tag{flex:0 0 auto;min-width:2.2em;text-align:center;font-size:var(--ub-ui-font-10,10px);padding:1px 6px;border-radius:8px;letter-spacing:.5px;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-arc-tag.is-move{background:var(--ww-warm-bg);color:var(--ww-warm-ink);}
.ww-arc-tag.is-new{background:var(--ww-hot-bg);color:var(--ww-hot-ink);}
.ww-arc-tag.is-gone{opacity:.6;}
.ww-arc-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;}
.ww-arc-top{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;}
.ww-arc-key{font-size:var(--ub-popup-font-body,13px);font-weight:700;line-height:1.4;color:var(--ww-ink);}
/* 前/后对照：两个值各占一行、一律全文（高度由轮次折叠兜住；旧版「前值收一行 + 展开按钮」整体已删）。
   ★「前 / 后」是挂进正文列左槽的单字形标记，不是一列 —— 见下方 v7 段的绝对定位。 */
.ww-arc-side{display:flex;gap:6px;align-items:baseline;font-size:var(--ub-popup-font-body,13px);line-height:1.5;color:var(--ww-ink);}
.ww-arc-side-lab{flex:0 0 auto;font-style:normal;font-size:var(--ub-ui-font-10,10px);line-height:1.6;min-width:1.5em;text-align:center;border-radius:4px;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-arc-side-text{min-width:0;}
.ww-arc-side.is-was{opacity:.58;}
.ww-arc-side.is-after>.ww-arc-side-lab{background:var(--ww-acc);color:var(--ww-acc-ink);}
/* 等级跃迁胶囊 */
.ww-arc-levels{display:flex;align-items:center;gap:5px;font-size:var(--ub-ui-font-10,10px);line-height:1.5;}
.ww-arc-lv{font-style:normal;padding:1px 7px;border-radius:8px;letter-spacing:.5px;background:var(--ww-chip);color:var(--ww-chip-ink);}
.ww-arc-lv.is-on{background:var(--ww-acc);color:var(--ww-acc-ink);font-weight:700;}
.ww-arc-lvarr{font-style:normal;color:var(--ww-mut);opacity:.75;}
/* 增量条：底段=起点（灰）/ 亮段=增量（特征色），轨道复用幕后 .ww-thread-bar。
   条定宽 96px 只承担「量感」，精确值交给数字与增量徽标——数字 tabular-nums 纵向成列。 */
.ww-arc-gauge{display:inline-flex;align-items:center;gap:7px;margin-left:auto;font-size:var(--ub-ui-font-11,11px);}
.ww-arc-meter{position:relative;flex:0 0 auto;width:96px;margin:0;height:5px;}
.ww-arc-meter .ww-arc-meter-base{position:absolute;left:0;top:0;height:100%;background:var(--ww-mut);opacity:.32;}
.ww-arc-meter .ww-arc-meter-gain{position:absolute;top:0;height:100%;background:var(--ww-acc);}
.ww-arc-meter.is-down .ww-arc-meter-gain{background:var(--ww-hot-dot);}
.ww-arc-num{font-style:normal;flex:0 0 auto;font-variant-numeric:tabular-nums;color:var(--ww-mut);}
.ww-arc-num.is-on{color:var(--ww-ink);font-weight:700;}
.ww-arc-arr{font-style:normal;flex:0 0 auto;color:var(--ww-mut);opacity:.7;}
.ww-arc-delta{flex:0 0 auto;font-weight:700;min-width:3.2em;text-align:right;font-variant-numeric:tabular-nums;color:var(--ww-hot-ink);}
.ww-arc-delta.is-flat{color:var(--ww-mut);}
.ww-arc-delta.is-step{min-width:0;padding:0 6px;border-radius:7px;text-align:center;background:var(--ww-acc);color:var(--ww-acc-ink);}
/* 旧纪事（无 deltas）降级：名单胶囊，不假装有前后值 */
.ww-arc-chips{display:flex;flex-wrap:wrap;gap:4px;}
.ww-arc-chip{font-size:var(--ub-ui-font-10,10px);line-height:1.7;padding:1px 8px;border-radius:999px;background:var(--ww-chip);color:var(--ww-chip-ink);}
/* 消散：划掉的是「传闻名」而不是标签本身 */
.ww-arc-line[data-arc-kind="gone"] .ww-arc-chip{text-decoration:line-through;opacity:.7;}
/* 过滤器：行的显隐走 CSS，整卡显隐由 JS 置 hidden（不用 :has()——Chrome 105+ 才有，用户引擎≈79-87 不支持）
   「只看角色」= 除传闻外都算角色相关（含入镜块：说书人这类无名册对象），所以是**黑名单**：只隐藏 rumor/gone */
.ww-arc-list[data-arc-filter="profile"] .ww-arc-line[data-arc-kind="rumor"],
.ww-arc-list[data-arc-filter="profile"] .ww-arc-line[data-arc-kind="gone"]{display:none;}
.ww-arc-list[data-arc-filter="rumor"] .ww-arc-line:not([data-arc-kind="rumor"]):not([data-arc-kind="gone"]){display:none;}

/* ===== 回廊 v7：一个角色一块（块内按维度分行）+ 每轮折叠成摘要 =====
   （内容形态）块头 = 角色名整行；块内四条维度各占一行：动向 / 打算 / 暗线 / 入镜。
   两个「空档」来源都从这里去掉：① 名字不再占侧栏格子（第 2 行起左栏不再空着）；
   ② 维度标签用两字芯片的自然宽度，不再用给「暗中打算」预留的 5.2em 定宽列。 */
.ww-arc-who{font-size:var(--ub-popup-font-body,13px);font-weight:700;line-height:1.45;color:var(--ww-ink);margin-bottom:1px;}
.ww-arc-line[data-arc-kind="profile"]>.ww-arc-body,
.ww-arc-line[data-arc-kind="intrusion"]>.ww-arc-body{gap:4px;}
.ww-arc-dim{display:flex;gap:24px;align-items:flex-start;}
.ww-arc-dim-lab{flex:0 0 auto;min-width:0;text-align:center;font-style:normal;
  font-size:var(--ub-ui-font-10,10px);line-height:1.7;padding:1px 6px;border-radius:8px;
  letter-spacing:.5px;background:var(--ww-chip);color:var(--ww-chip-ink);}
/* 暗中打算属「主角不知」：warm 底色承载（与幕后页签同口径）；
   border:0 是为了压掉 bridge 主题给 .ww-notknown 加的那道描边（同一枚芯片挂两个类） */
.ww-arc-dim.is-hidden>.ww-arc-dim-lab{background:var(--ww-warm-bg);color:var(--ww-warm-ink);border:0;}
.ww-arc-dim-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.ww-arc-dim-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;}
/* 块内仪表不再靠 margin-left:auto 顶到行尾（那是单行形态的排法） */
.ww-arc-dim .ww-arc-gauge{margin-left:0;}
/* ★正文列只有一个起点：传闻行与维度行的「标签芯片 → 正文」间距统一成 24px。
   「前 / 后」是挂进这 24px 左槽里的单字形标记（绝对定位 ⇒ 占宽 0），不是一列 ——
   它若按行内芯片排，会把动向/打算的正文整整推右一列（实测 21px，正是「左边缘对不齐」的最后残差）。 */
.ww-arc-line{gap:24px;}
.ww-arc-side{position:relative;}
.ww-arc-side-lab{position:absolute;left:-21px;top:2px;width:15px;min-width:0;padding:0;
  text-align:center;line-height:1.5;}
/* 块与块之间插虚线分界：光靠间距说不清「一块 = 一个角色」，顺带把「传闻不属角色」画出来 */
.ww-arc-line[data-arc-kind="profile"]+.ww-arc-line[data-arc-kind="profile"],
.ww-arc-line[data-arc-kind="intrusion"]+.ww-arc-line[data-arc-kind="profile"],
.ww-arc-line[data-arc-kind="profile"]+.ww-arc-line[data-arc-kind="rumor"],
.ww-arc-line[data-arc-kind="intrusion"]+.ww-arc-line[data-arc-kind="rumor"],
.ww-arc-line[data-arc-kind="rumor"]+.ww-arc-line[data-arc-kind="gone"]{
  margin-top:10px;padding-top:10px;border-top:1px dashed var(--ww-line);}
/* 暗中打算的「目标」正文 / 入镜的标题与引文 */
.ww-arc-goal{min-width:0;font-size:var(--ub-popup-font-body,13px);line-height:1.4;color:var(--ww-ink);}
.ww-arc-goal::before{content:'目标：';font-size:var(--ub-ui-font-10,10px);color:var(--ww-mut);}
.ww-arc-hook{font-size:var(--ub-popup-font-body,13px);line-height:1.5;color:var(--ww-mut);}
.ww-arc-hook::before{content:'「';} .ww-arc-hook::after{content:'」';}
.ww-arc-hook::before,.ww-arc-hook::after{color:var(--ww-acc);}
.ww-arc-arrival-title{font-size:var(--ub-popup-font-body,13px);font-weight:700;line-height:1.4;color:var(--ww-ink);}
/* （外壳·轮次折叠）折叠态整段正文不渲染，只留卡头；点卡头任意处开合 */
.ww-arc-item:not(.is-open) .ww-arc-lines{display:none;}
.ww-arc-card-head{position:relative;cursor:pointer;padding-right:26px;transition:background .16s;}
.ww-arc-card-head:hover{background:var(--ww-chip);}
.ww-arc-item.is-noopen .ww-arc-card-head{cursor:default;}
.ww-arc-item.is-noopen .ww-arc-card-head:hover{background:transparent;}
/* 开合指示：纯 CSS 折角（零字形，不碰 emoji 门禁），展开时转成向上 */
.ww-arc-head-chev{position:absolute;right:12px;top:14px;width:6px;height:6px;font-style:normal;
  border-right:1.6px solid var(--ww-mut);border-bottom:1.6px solid var(--ww-mut);
  transform:rotate(45deg);transition:transform .18s;}
.ww-arc-item.is-open .ww-arc-head-chev{transform:rotate(-135deg);}
/* （外壳·摘要名录）折叠态才出现：展开后正文自己会说话，同一份信息不占两遍 */
.ww-arc-roster{flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 7px;
  font-size:var(--ub-ui-font-11,11px);line-height:1.6;color:var(--ww-mut);}
.ww-arc-item.is-open .ww-arc-roster{display:none;}
.ww-arc-subj{color:var(--ww-ink);opacity:.8;}
.ww-arc-subj.is-more{opacity:.55;}
.ww-arc-sep{flex:0 0 auto;font-style:normal;width:1px;height:.85em;background:var(--ww-line);}
/* （外壳·分批）未展示的轮次整卡隐藏 + 页脚续载提示 */
.ww-arc-item[data-arc-far="1"]{display:none;}
.ww-arc-foot{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 0 2px;
  font-size:var(--ub-ui-font-10,10px);letter-spacing:.5px;color:var(--ww-mut);opacity:.9;}
.ww-arc-foot.is-end{opacity:.5;}
.ww-arc-foot.is-more{cursor:pointer;}
.ww-arc-foot.is-more:hover{color:var(--ww-acc);opacity:1;}
.ww-arc-foot-chev{font-style:normal;width:6px;height:6px;margin-top:-3px;
  border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);}

/* ===== 六主题 · 每主题一组语义变量（surf 表面 / ink 墨 / mut 灰 / line 边线 / acc 特征色 /
   card 卡底 / accent-line 特征边 / chip 徽标底 / hot·warm 语义色 / veil 幕后薄纱） ===== */

/* ancient 古风：米白纸面 · 绛红特征色 */
.ww-theme-ancient{--ww-surf:#faf5ea;--ww-ink:#3a2e20;--ww-mut:#8b6e4e;--ww-line:#dccfae;--ww-acc:#a03430;--ww-acc-ink:#f8f1de;--ww-acc-strong:#8a2f28;--ww-accent-line:#c9b078;--ww-card:#fffdf4;--ww-chip:#efe5cb;--ww-chip-ink:#5a4426;--ww-hot-bg:#f3ddd6;--ww-hot-ink:#8a352a;--ww-warm-bg:#f0e6c8;--ww-warm-ink:#6e5618;--ww-hot-dot:#c14a40;--ww-veil:rgba(58,46,32,.05);
background:var(--ww-surf);color:var(--ww-ink);border:2px solid #c8b898;font-family:var(--ub-font-reading);}
/* xianxia 云海仙踪：青白瓷面 · 黛蓝特征色 */
.ww-theme-xianxia{--ww-surf:#eef6fa;--ww-ink:#12303f;--ww-mut:#4a7a92;--ww-line:#bcd9e6;--ww-acc:#207193;--ww-acc-ink:#eef7fb;--ww-acc-strong:#1e5a75;--ww-accent-line:#7db4cc;--ww-card:#ffffff;--ww-chip:#ddebf2;--ww-chip-ink:#27576b;--ww-hot-bg:#d8e8ee;--ww-hot-ink:#17505f;--ww-warm-bg:#ecead0;--ww-warm-ink:#5f5722;--ww-hot-dot:#d4564e;--ww-veil:rgba(18,48,63,.05);
background:var(--ww-surf);color:var(--ww-ink);border:1px solid #8fc3dd;font-family:var(--ub-font-reading);}
/* flirtatious 瑟瑟：夜幕紫面 · 霓虹粉特征色（本就偏暗） */
.ww-theme-flirtatious{--ww-surf:#220e2e;--ww-ink:#eedaf6;--ww-mut:#b48bc9;--ww-line:#452652;--ww-acc:#ff7bd0;--ww-acc-ink:#24001e;--ww-acc-strong:#ff9ee0;--ww-accent-line:#8a4a80;--ww-card:#2c1438;--ww-chip:#3a1a42;--ww-chip-ink:#ff9ee0;--ww-hot-bg:#4a2030;--ww-hot-ink:#ff9aa8;--ww-warm-bg:#46321e;--ww-warm-ink:#ffcf96;--ww-hot-dot:#ff8090;--ww-veil:rgba(0,0,0,.14);
background:var(--ww-surf);color:var(--ww-ink);border:1px solid #b055d0;}
/* sweet 甜恋糖果：奶油粉面 · 莓粉特征色 */
.ww-theme-sweet{--ww-surf:var(--sweet-bg,#fff3f8);--ww-ink:var(--sweet-text,#7a3b54);--ww-mut:var(--sweet-text-soft,#c08ba2);--ww-line:var(--sweet-border,#f2cddc);--ww-acc:#e7548f;--ww-acc-ink:#fff;--ww-acc-strong:#e7548f;--ww-accent-line:#eda0be;--ww-card:var(--sweet-card,#ffffff);--ww-chip:#fadfe9;--ww-chip-ink:#a85070;--ww-hot-bg:#fadfe9;--ww-hot-ink:#c04a68;--ww-warm-bg:#f6ecd4;--ww-warm-ink:#7a6028;--ww-hot-dot:#d84a6e;--ww-veil:rgba(122,59,84,.05);
background:var(--ww-surf);color:var(--ww-ink);border:1px solid #f2a8c4;}
/* minimal 萦绕：纯白亮屏 · 墨色特征色 */
.ww-theme-minimal{--ww-surf:#fafafa;--ww-ink:#333;--ww-mut:#999;--ww-line:#dedede;--ww-acc:#222;--ww-acc-ink:#fff;--ww-acc-strong:#222;--ww-accent-line:#bdbdbd;--ww-card:#fff;--ww-chip:#eee;--ww-chip-ink:#444;--ww-hot-bg:#eee;--ww-hot-ink:#333;--ww-warm-bg:#eee;--ww-warm-ink:#555;--ww-hot-dot:#555;--ww-veil:rgba(0,0,0,.04);
background:var(--ww-surf);color:var(--ww-ink);border:1px solid #d6d6d6;}
/* bridge 舰桥：深舱面板 · 全息青特征色（本就暗） */
.ww-theme-bridge{--ww-surf:#10232b;--ww-ink:#9fe8f5;--ww-mut:#5d8fa0;--ww-line:#1e5a6b;--ww-acc:#23758a;--ww-acc-ink:#04141a;--ww-acc-strong:#8eeaff;--ww-accent-line:#23758a;--ww-card:#0c1c22;--ww-chip:#0d242e;--ww-chip-ink:#8eeaff;--ww-hot-bg:#0d3a48;--ww-hot-ink:#9fe8f5;--ww-warm-bg:#33331a;--ww-warm-ink:#e8dc90;--ww-hot-dot:#ff9a90;--ww-veil:rgba(0,0,0,.15);
background:var(--ww-surf);color:var(--ww-ink);border:1px solid #23758a;font-family:var(--bridge-font-data,'Consolas',monospace);}
/* ios 灵动玻璃：系统灰面 · 系统蓝特征色 */
.ww-theme-ios{--ww-surf:#f2f2f7;--ww-ink:#1c1c1e;--ww-mut:rgba(60,60,67,.62);--ww-line:rgba(60,60,67,.12);--ww-acc:#007aff;--ww-acc-ink:#fff;--ww-acc-strong:#007aff;--ww-accent-line:rgba(0,122,255,.35);--ww-card:#ffffff;--ww-chip:rgba(120,120,128,.12);--ww-chip-ink:rgba(60,60,67,.85);--ww-hot-bg:rgba(255,59,48,.1);--ww-hot-ink:#d70015;--ww-warm-bg:rgba(255,149,0,.12);--ww-warm-ink:#b25000;--ww-hot-dot:#ff3b30;--ww-veil:rgba(60,60,67,.04);
background:var(--ww-surf);color:var(--ww-ink);border:1px solid rgba(60,60,67,.12);font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif);}

/* 各主题形制差异（非配色，保持原样） */
.ww-theme-minimal .ww-arrival-card{border-radius:5px;border-left:3px solid var(--ww-acc);}
.ww-theme-minimal .ww-front-rumor,.ww-theme-minimal .ww-front-rumor-level{border-radius:5px;}
.ww-theme-minimal .ww-front-title{letter-spacing:4px;}
.ww-theme-minimal .ww-front-rumor-top{font-weight:500;}
.ww-theme-sweet .ww-arrival-card,.ww-theme-sweet .ww-front-rumor{border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
.ww-theme-bridge .ww-tab-btn,.ww-theme-bridge .ww-arrival-badge,.ww-theme-bridge .ww-arrival-card,.ww-theme-bridge .ww-front-rumor,.ww-theme-bridge .ww-vault-card,.ww-theme-bridge .ww-rumor-card,.ww-theme-bridge .ww-intrusion,.ww-theme-bridge .ww-notknown,.ww-theme-bridge .ww-onstage,.ww-theme-bridge .ww-offstage,.ww-theme-bridge .ww-rumor-level,.ww-theme-bridge .ww-triggered,.ww-theme-bridge .ww-chron-kind,.ww-theme-bridge .ww-intrusion-fill,.ww-theme-bridge .ww-intrusion-delete,.ww-theme-bridge .ww-arc-card,.ww-theme-bridge .ww-arc-tag,.ww-theme-bridge .ww-arc-kind,.ww-theme-bridge .ww-arc-tool,.ww-theme-bridge .ww-arc-lv,.ww-theme-bridge .ww-arc-chip,.ww-theme-bridge .ww-arc-side-lab,.ww-theme-bridge .ww-arc-dim-lab,.ww-theme-bridge .ww-excluded-row,.ww-theme-bridge .ww-excluded-restore{border-radius:2px;}
.ww-theme-bridge .ww-arrival-badge{background:var(--ww-chip);color:var(--ww-chip-ink);border:1px solid var(--ww-acc);}
.ww-theme-bridge .ww-front-rumor-level{border:1px solid var(--ww-line);}
.ww-theme-bridge .ww-front-title{letter-spacing:3px;}
.ww-theme-bridge .ww-notknown,.ww-theme-bridge .ww-offstage,.ww-theme-bridge .ww-rumor-level,.ww-theme-bridge .ww-chron-kind{border:1px solid var(--ww-line);}
.ww-theme-bridge .ww-onstage{border:1px solid var(--ww-line);}
.ww-theme-ancient .ww-tab-btn.is-active,.ww-theme-xianxia .ww-tab-btn.is-active,.ww-theme-sweet .ww-tab-btn.is-active{box-shadow:none;}

/* ===== 深色模式：翻转同一组语义变量 ===== */
.dark .ww-theme-ancient{--ww-surf:#1c1610;--ww-ink:#d8ccb4;--ww-mut:#a4937e;--ww-line:#453824;--ww-acc:#c05550;--ww-acc-ink:#fdf4e0;--ww-acc-strong:#e0b488;--ww-accent-line:#5a4a2e;--ww-card:#241d13;--ww-chip:#332a1a;--ww-chip-ink:#c9a06a;--ww-hot-bg:#3c2620;--ww-hot-ink:#e8a090;--ww-warm-bg:#38301a;--ww-warm-ink:#e8cc90;--ww-hot-dot:#d4564e;--ww-veil:rgba(0,0,0,.16);
background:var(--ww-surf);border-color:#5a4634;}
.dark .ww-theme-xianxia{--ww-surf:#0d1e26;--ww-ink:#a8ccd8;--ww-mut:#5d8fa0;--ww-line:#1e4a58;--ww-acc:#39b3d8;--ww-acc-ink:#062430;--ww-acc-strong:#9fe8f5;--ww-accent-line:#25566a;--ww-card:#10242c;--ww-chip:#123240;--ww-chip-ink:#7edce8;--ww-hot-bg:#123a48;--ww-hot-ink:#9fe8f5;--ww-warm-bg:#3a3616;--ww-warm-ink:#eee09a;--ww-hot-dot:#ff8a80;--ww-veil:rgba(0,0,0,.16);
background:var(--ww-surf);border-color:#1e4a58;}
.dark .ww-theme-flirtatious{--ww-surf:#180822;--ww-veil:rgba(0,0,0,.18);border-color:#4a2a52;}
.dark .ww-theme-sweet{--ww-surf:var(--sweet-bg,#241018);--ww-ink:var(--sweet-text,#e8c0cc);--ww-mut:var(--sweet-text-soft,#a88090);--ww-line:var(--sweet-border,#4a2a3a);--ww-acc:#ff7da6;--ww-acc-ink:#fff;--ww-acc-strong:#ffb0c8;--ww-accent-line:#5a3244;--ww-card:var(--sweet-card,#2c161e);--ww-chip:#3a1a28;--ww-chip-ink:#ff9db8;--ww-hot-bg:#40202c;--ww-hot-ink:#ff90a8;--ww-warm-bg:#3a3018;--ww-warm-ink:#ffd8a8;--ww-veil:rgba(0,0,0,.16);
background:var(--ww-surf);border-color:#5a3a4a;}
.dark .ww-theme-minimal{--ww-surf:#161616;--ww-ink:#ccc;--ww-mut:#888;--ww-line:#2e2e2e;--ww-acc:#eee;--ww-acc-ink:#161616;--ww-acc-strong:#eee;--ww-accent-line:#3a3a3a;--ww-card:#1c1c1c;--ww-chip:#262626;--ww-chip-ink:#aaa;--ww-hot-bg:#262626;--ww-hot-ink:#ddd;--ww-warm-bg:#262626;--ww-warm-ink:#bbb;
background:var(--ww-surf);border-color:#3a3a3a;}
.dark .ww-theme-bridge{--ww-surf:#0c1a20;border-color:#1e5a6b;}
.dark .ww-theme-ios{--ww-surf:#1c1c1e;--ww-ink:#f2f2f7;--ww-mut:rgba(235,235,245,.62);--ww-line:rgba(235,235,245,.12);--ww-acc:#0a84ff;--ww-acc-ink:#fff;--ww-acc-strong:#64d2ff;--ww-accent-line:rgba(10,132,255,.4);--ww-card:#2c2c2e;--ww-chip:rgba(120,120,128,.28);--ww-chip-ink:rgba(235,235,245,.85);--ww-hot-bg:rgba(255,69,58,.14);--ww-hot-ink:#ff9a8a;--ww-warm-bg:rgba(255,159,10,.16);--ww-warm-ink:#ffd60a;--ww-hot-dot:#ff453a;--ww-veil:rgba(0,0,0,.2);
background:var(--ww-surf);border-color:rgba(235,235,245,.12);}
/* ios 形制：胶囊页签 + 圆角卡 */
.ww-theme-ios .ww-tab-btn{border-radius:999px;font-weight:600}
.ww-theme-ios .ww-tab-btn.is-active{box-shadow:none}
.ww-theme-ios .ww-arrival-card,.ww-theme-ios .ww-front-rumor,.ww-theme-ios .ww-vault-card,.ww-theme-ios .ww-rumor-card,.ww-theme-ios .ww-intrusion,.ww-theme-ios .ww-arc-card,.ww-theme-ios .ww-excluded-row{border-radius:14px}
.ww-theme-ios .ww-front-rumor-level,.ww-theme-ios .ww-arrival-badge,.ww-theme-ios .ww-chron-kind,.ww-theme-ios .ww-arc-tag,.ww-theme-ios .ww-arc-kind,.ww-theme-ios .ww-arc-lv,.ww-theme-ios .ww-arc-chip,.ww-theme-ios .ww-arc-side-lab,.ww-theme-ios .ww-arc-dim-lab,.ww-theme-ios .ww-excluded-restore{border-radius:999px}
.ww-theme-ios .ww-front-title{letter-spacing:0;font-weight:700}
`;
