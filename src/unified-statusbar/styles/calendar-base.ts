// ===== 日历弹窗样式 — CSS变量驱动 + 五风格主题化 =====
export const calendarBaseCSS = /* css */ `

.calendar-popup {
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  max-height: 88dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--ub-popup-bg, #fff);
  color: var(--ub-text, #111);
  border: var(--ub-popup-border, 1px solid var(--ub-divider, #e0e0e0));
  border-radius: var(--ub-popup-radius, 8px);
  box-shadow: var(--ub-popup-shadow, 0 8px 32px rgba(0,0,0,0.15));
  font-family: inherit;
  letter-spacing: 0.3px;
}

/* ═══════════════════════════════════════════════════ */
/*  头部导航栏                                        */
/* ═══════════════════════════════════════════════════ */
.cal-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  flex-shrink: 0;
  background: var(--ub-popup-head-bg, var(--ub-bg-card, #fafafa));
  border-bottom: var(--ub-popup-head-border, 1px solid var(--ub-divider, #e0e0e0));
  border-radius: var(--ub-popup-radius, 8px) var(--ub-popup-radius, 8px) 0 0;
}

.cal-nav-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-bg-card, #fafafa);
  color: var(--ub-text, #111);
  border-radius: var(--ub-btn-radius, 4px);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}
.cal-nav-btn:hover:not(:disabled) {
  background: var(--ub-hover-bg, rgba(0,0,0,0.06));
  border-color: var(--ub-accent, #4a90d9);
  color: var(--ub-accent, #4a90d9);
}
.cal-nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.cal-newspaper-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-bg-card, #fafafa);
  color: var(--ub-text-muted, #888);
  border-radius: var(--ub-btn-radius, 4px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}
.cal-newspaper-btn .ub-ic {
  width: 20px;
  height: 20px;
}
.cal-newspaper-btn:hover {
  background: var(--ub-hover-bg, rgba(0,0,0,0.06));
  border-color: var(--ub-accent, #4a90d9);
  color: var(--ub-accent, #4a90d9);
}

.cal-month-label {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--ub-text, #111);
}

.cal-refresh-btn {
  background: transparent;
  border: 1px solid var(--ub-divider, #e0e0e0);
  color: var(--ub-text-muted, #888);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 10px;
  letter-spacing: 1px;
  border-radius: var(--ub-btn-radius, 4px);
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
}
.cal-refresh-btn:hover {
  border-color: var(--ub-accent, #4a90d9);
  color: var(--ub-accent, #4a90d9);
}

.cal-close-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--ub-divider, #e0e0e0);
  background: transparent;
  color: var(--ub-text-muted, #888);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ub-btn-radius, 4px);
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}
.cal-close-btn:hover {
  background: rgba(196,30,58,0.1);
  border-color: #c41e3a;
  color: #c41e3a;
}

/* ═══════════════════════════════════════════════════ */
/*  星期标题行                                        */
/* ═══════════════════════════════════════════════════ */
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 4px 2px;
  font-size: 10px;
  color: var(--ub-text-muted, #888);
  letter-spacing: 1px;
}
.cal-weekdays span {
  text-align: center;
}

/* ═══════════════════════════════════════════════════ */
/*  日期网格                                          */
/* ═══════════════════════════════════════════════════ */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 4px 6px 8px;
}

.cal-day {
  aspect-ratio: 1;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ub-text, #111);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--ub-btn-radius, 4px);
  transition: all 0.15s;
  position: relative;
  font-family: inherit;
  min-width: 0;
}
.cal-day:hover {
  background: var(--ub-hover-bg, rgba(0,0,0,0.06));
}

.cal-day.is-outside-month {
  color: var(--ub-text-muted, #bbb);
  opacity: 0.45;
}

.cal-day.is-today {
  border-color: var(--ub-accent, #4a90d9);
  font-weight: 700;
  color: var(--ub-accent, #4a90d9);
  background: color-mix(in srgb, var(--ub-accent, #4a90d9) 10%, transparent);
}

.cal-day.is-selected:not(.is-today) {
  border-color: var(--ub-accent, #4a90d9);
  background: color-mix(in srgb, var(--ub-accent, #4a90d9) 8%, transparent);
}

/* ═══════════════════════════════════════════════════ */
/*  事件指示点                                        */
/* ═══════════════════════════════════════════════════ */
.cal-dots {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
}
.cal-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cal-dot.world { background: var(--ub-cal-world, #4a90d9); }
.cal-dot.major { background: var(--ub-cal-major, #e8a040); }
.cal-dot.character { background: var(--ub-cal-character, #e060a0); }
.cal-dot.memo { background: var(--ub-cal-memo, #50c878); }

.cal-memo-tag {
  font-size: 7px;
  color: var(--ub-cal-memo, #50c878);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  line-height: 1;
}

/* 人物生日蛋糕标注：格子左下角（经期/孕期族占右上/右下；独立成类——周期系统关闭时仍显示） */
.cal-birthday-mark {
  position: absolute;
  left: 7px;
  bottom: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 13px;
  color: var(--ub-cal-birthday, #845ef7);
  pointer-events: none;
  user-select: none;
  z-index: 2;
}
.cal-birthday-mark .ub-ic {
  width: 13px;
  height: 13px;
}

/* ═══════════════════════════════════════════════════ */
/*  详情卡片                                          */
/* ═══════════════════════════════════════════════════ */
.cal-detail {
  border-top: 1px solid var(--ub-divider, #e0e0e0);
  padding: 10px 12px;
  max-height: 180px;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--ub-bg-card, #fafafa);
  border-radius: 0 0 var(--ub-popup-radius, 8px) var(--ub-popup-radius, 8px);
  overscroll-behavior: contain;
}

.cal-detail-empty {
  text-align: center;
  font-size: var(--ub-ui-font-12,12px);
  color: var(--ub-text-muted, #888);
  padding: 16px 0;
  letter-spacing: 1px;
}

.cal-detail-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--ub-text, #111);
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.cal-detail-weather {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--ub-ui-font-11,11px);
  color: var(--ub-accent, #4a90d9);
  padding: 2px 8px;
  background: color-mix(in srgb, var(--ub-accent, #4a90d9) 8%, transparent);
  border-radius: 10px;
  margin-bottom: 8px;
}

.cal-detail-event {
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  background: var(--ub-hover-bg, rgba(0,0,0,0.03));
  border-left: 3px solid transparent;
  font-size: var(--ub-ui-font-11,11px);
  line-height: 1.5;
}
.cal-detail-event:last-child { margin-bottom: 0; }

.cal-detail-event-type {
  display: inline-block;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.5px;
  margin-right: 6px;
  vertical-align: middle;
}
.cal-detail-event-type.world {
  background: color-mix(in srgb, var(--ub-cal-world, #4a90d9) 12%, transparent);
  color: var(--ub-cal-world, #4a90d9);
}
.cal-detail-event-type.major {
  background: color-mix(in srgb, var(--ub-cal-major, #e8a040) 12%, transparent);
  color: var(--ub-cal-major, #e8a040);
}
.cal-detail-event-type.character {
  background: color-mix(in srgb, var(--ub-cal-character, #e060a0) 12%, transparent);
  color: var(--ub-cal-character, #e060a0);
}
.cal-detail-event-type.memo {
  background: color-mix(in srgb, var(--ub-cal-memo, #50c878) 12%, transparent);
  color: var(--ub-cal-memo, #50c878);
}
.cal-detail-event-type.cycle {
  background: color-mix(in srgb, var(--ub-cal-cycle, #c0392b) 12%, transparent);
  color: var(--ub-cal-cycle, #c0392b);
}
.cal-detail-event.cal-detail-cycle {
  border-left-color: var(--ub-cal-cycle, #c0392b);
}
.cal-detail-event-type.birthday {
  background: color-mix(in srgb, var(--ub-cal-birthday, #845ef7) 12%, transparent);
  color: var(--ub-cal-birthday, #845ef7);
}
.cal-detail-event.cal-detail-birthday {
  border-left-color: var(--ub-cal-birthday, #845ef7);
}
.cal-detail-event-type.pregnancy {
  background: color-mix(in srgb, var(--ub-cal-pregnancy, #5b9f7a) 15%, transparent);
  color: var(--ub-cal-pregnancy, #5b9f7a);
}
.cal-detail-event.cal-detail-pregnancy {
  border-left-color: var(--ub-cal-pregnancy, #5b9f7a);
}

.cal-detail-event-title {
  font-weight: 500;
  color: var(--ub-text, #111);
}

.cal-detail-event-desc {
  font-size: var(--ub-ui-font-10,10px);
  color: var(--ub-text-muted, #888);
  margin-top: 2px;
}

.cal-detail-event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
  font-size: 9px;
  color: var(--ub-text-muted, #888);
}
.cal-detail-event-meta span {
  padding: 1px 4px;
  border-radius: 2px;
  background: var(--ub-hover-bg, rgba(0,0,0,0.04));
}

/* F77：事件 meta 图标芯片（emoji → ubIcon SVG） */
.cal-meta-chips {
  gap: 5px;
}
.cal-ev-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 99px;
  font-size: 10px;
  background: var(--ub-hover-bg, rgba(0,0,0,0.04));
  color: var(--ub-text-muted, #888);
  border: 1px solid var(--ub-divider, rgba(128,128,128,0.2));
}
.cal-ev-chip .ub-ic {
  width: 11px;
  height: 11px;
  color: var(--ub-accent, #4a90a4);
  opacity: .85;
}
/* F77：周期/孕期描述 → 天数芯片（数字 tabular 加重；距分娩 ≤3 天转危险色） */
.cal-cyc-desc {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: baseline;
}
.cal-cyc-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--ub-hover-bg, rgba(0,0,0,0.04));
  border: 1px solid var(--ub-divider, rgba(128,128,128,0.2));
  font-size: 11px;
  color: var(--ub-text-muted, #888);
}
.cal-cyc-chip b {
  font-size: 13px;
  color: var(--ub-accent, #4a90a4);
  font-variant-numeric: tabular-nums;
}
.cal-cyc-chip i {
  font-style: normal;
  font-size: 10px;
}
.cal-cyc-chip.plain b {
  color: var(--ub-text, #333);
}
.cal-cyc-chip.dim {
  color: var(--ub-text-muted, #888);
}
.cal-cyc-chip.due b {
  color: var(--ub-warning, #8A5B14);
}
.cal-cyc-chip.due.hot b {
  color: var(--ub-danger, #A13B34);
}
.cal-cyc-bar {
  display: inline-block;
  width: 44px;
  height: 4px;
  border-radius: 2px;
  background: var(--ub-divider, rgba(128,128,128,0.2));
  overflow: hidden;
  align-self: center;
}
.cal-cyc-bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--ub-accent, #4a90a4);
}

/* 详情滚动条 */
.cal-detail::-webkit-scrollbar { width: 4px; }
.cal-detail::-webkit-scrollbar-track { background: transparent; }
.cal-detail::-webkit-scrollbar-thumb {
  background: var(--ub-scrollbar-thumb, #ccc);
  border-radius: 2px;
}
.cal-detail::-webkit-scrollbar-thumb:hover {
  background: var(--ub-scrollbar-thumb-hover, #aaa);
}
.cal-detail { scrollbar-width: thin; scrollbar-color: var(--ub-scrollbar-thumb, #ccc) transparent; }

/* ═══════════════════════════════════════════════════ */
/*  主题专属样式 — 古风                                */
/* ═══════════════════════════════════════════════════ */
.cal-theme-ancient {
  font-family: var(--ub-font-ui);
  letter-spacing: 1px;
}
.cal-theme-ancient .cal-header {
  background: linear-gradient(180deg, #f0e6d0, #f5edd6);
  border-bottom-width: 2px;
}
.cal-theme-ancient .cal-nav-btn,
.cal-theme-ancient .cal-newspaper-btn,
.cal-theme-ancient .cal-refresh-btn,
.cal-theme-ancient .cal-close-btn {
  border-radius: 2px;
  font-family: inherit;
}
.cal-theme-ancient .cal-month-label {
  font-family: var(--ub-font-reading);
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 3px;
}
.cal-theme-ancient .cal-day.is-today {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ub-accent, #b5362e) 40%, transparent),
              0 0 12px color-mix(in srgb, var(--ub-accent, #b5362e) 15%, transparent);
}
.cal-theme-ancient .cal-detail {
  background: linear-gradient(180deg, #faf4e4 0%, #f5edd6 100%);
}
.cal-theme-ancient .cal-detail-event {
  border-left-color: var(--ub-divider, #c8b898);
}
.cal-theme-ancient .cal-day {
  border-radius: 2px;
}
/* 古风装饰：月标两侧印章纹 */
.cal-theme-ancient .cal-month-label::before,
.cal-theme-ancient .cal-month-label::after {
  content: '◆';
  font-size: 6px;
  color: var(--ub-accent, #b5362e);
  vertical-align: middle;
  opacity: 0.55;
  margin: 0 6px;
}
/* 古风装饰：today 格内角印章点 */
.cal-theme-ancient .cal-day.is-today::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  background: var(--ub-accent, #b5362e);
  opacity: 0.7;
}

/* ═══════════════════════════════════════════════════ */
/*  主题专属样式 — 瑟瑟                                */
/* ═══════════════════════════════════════════════════ */
.cal-theme-flirtatious {
  font-family: 'Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei', sans-serif;
  letter-spacing: 0.5px;
}
.cal-theme-flirtatious .cal-header {
  background: linear-gradient(180deg, #f8f2ff, #f3e4f8);
  border-bottom-color: color-mix(in srgb, var(--ub-accent, #d060a0) 30%, transparent);
}
.cal-theme-flirtatious .cal-month-label {
  font-weight: 500;
  letter-spacing: 2px;
}
.cal-theme-flirtatious .cal-nav-btn,
.cal-theme-flirtatious .cal-newspaper-btn,
.cal-theme-flirtatious .cal-refresh-btn,
.cal-theme-flirtatious .cal-close-btn {
  border-radius: 8px;
}
.cal-theme-flirtatious .cal-day {
  border-radius: 10px;
}
.cal-theme-flirtatious .cal-day.is-today {
  box-shadow: 0 0 14px color-mix(in srgb, var(--ub-accent, #d060a0) 25%, transparent),
              inset 0 0 0 1.5px var(--ub-accent, #d060a0);
}
.cal-theme-flirtatious .cal-refresh-btn:hover {
  box-shadow: 0 0 8px color-mix(in srgb, var(--ub-accent, #d060a0) 20%, transparent);
}
/* 瑟瑟装饰：today 格霓虹呼吸光环 */
.cal-theme-flirtatious .cal-day.is-today {
  animation: cal-flirt-pulse 3s ease-in-out infinite;
}
@keyframes cal-flirt-pulse {
  0%, 100% { box-shadow: 0 0 14px color-mix(in srgb, var(--ub-accent, #d060a0) 25%, transparent), inset 0 0 0 1.5px var(--ub-accent, #d060a0); }
  50% { box-shadow: 0 0 20px color-mix(in srgb, var(--ub-accent, #d060a0) 35%, transparent), inset 0 0 0 1.5px var(--ub-accent, #d060a0); }
}
/* 瑟瑟装饰：detail 顶部渐隐装饰条 */
.cal-theme-flirtatious .cal-detail::before {
  content: '';
  display: block;
  height: 3px;
  margin: 0 12px 8px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--ub-accent, #d060a0), transparent);
  opacity: 0.3;
}

/* ═══════════════════════════════════════════════════ */
/*  主题专属样式 — 萦绕                                */
/* ═══════════════════════════════════════════════════ */
.cal-theme-minimal {
  font-family: 'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial, 'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun', sans-serif;
  letter-spacing: 0.3px;
}
.cal-theme-minimal .cal-header {
  background: transparent;
  border-bottom: 0.5px solid var(--ub-divider, #e0e0e0);
}
.cal-theme-minimal .cal-nav-btn,
.cal-theme-minimal .cal-newspaper-btn,
.cal-theme-minimal .cal-refresh-btn,
.cal-theme-minimal .cal-close-btn {
  border-radius: 1px;
  border-width: 0.5px;
}
.cal-theme-minimal .cal-month-label {
  font-weight: 400;
  letter-spacing: 4px;
  text-transform: uppercase;
  font-size: 11px;
}
.cal-theme-minimal .cal-day.is-today {
  box-shadow: inset 0 -2px 0 var(--ub-accent, #111);
  border-color: transparent;
  font-weight: 600;
}
.cal-theme-minimal .cal-detail {
  background: transparent;
}
.cal-theme-minimal .cal-detail-event {
  border-left-width: 1.5px;
}
/* 萦绕装饰：月标两侧细线 */
.cal-theme-minimal .cal-month-label::before,
.cal-theme-minimal .cal-month-label::after {
  content: '';
  display: inline-block;
  width: 18px;
  height: 0.5px;
  background: var(--ub-divider, #e0e0e0);
  vertical-align: middle;
  margin: 0 8px;
}

/* ═══════════════════════════════════════════════════ */
/*  主题专属样式 — 甜恋糖果                            */
/* ═══════════════════════════════════════════════════ */
.cal-theme-sweet {
  font-family: 'Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei', 'ZCOOL XiaoWei','Kaiti SC','STKaiti','KaiTi','楷体', sans-serif;
}
.cal-theme-sweet .cal-header {
  background: linear-gradient(135deg, #fff0f5, #ffe4ec, #f0e6ff);
  border-bottom-style: dashed;
}
.cal-theme-sweet .cal-month-label {
  font-weight: 700;
  letter-spacing: 2px;
  font-size: 15px;
}
.cal-theme-sweet .cal-nav-btn,
.cal-theme-sweet .cal-newspaper-btn,
.cal-theme-sweet .cal-refresh-btn,
.cal-theme-sweet .cal-close-btn,
.cal-theme-sweet .cal-day {
  border-radius: var(--sweet-radius-lg, 12px);
}
.cal-theme-sweet .cal-day.is-today {
  background: linear-gradient(135deg, color-mix(in srgb, var(--ub-accent, #ff8fab) 15%, transparent),
                                     color-mix(in srgb, var(--ub-cal-character, #c9a0d0) 10%, transparent));
  box-shadow: 0 2px 10px color-mix(in srgb, var(--ub-accent, #ff8fab) 20%, transparent);
  border-color: var(--ub-accent, #ff8fab);
  animation: cal-sweet-shimmer 4s ease-in-out infinite;
}
@keyframes cal-sweet-shimmer {
  0%, 100% { box-shadow: 0 2px 10px color-mix(in srgb, var(--ub-accent, #ff8fab) 20%, transparent); }
  50% { box-shadow: 0 2px 16px color-mix(in srgb, var(--ub-accent, #ff8fab) 35%, transparent); }
}
.cal-theme-sweet .cal-dot {
  border-radius: 3px;
}
/* 甜恋装饰：月标两侧星芒 */
.cal-theme-sweet .cal-month-label::before,
.cal-theme-sweet .cal-month-label::after {
  content: '✧';
  font-size: 8px;
  color: var(--ub-accent, #ff8fab);
  vertical-align: middle;
  opacity: 0.5;
  margin: 0 8px;
}
/* 甜恋装饰：detail 顶部柔光带 */
.cal-theme-sweet .cal-detail {
  border-top: 2px dashed color-mix(in srgb, var(--ub-accent, #ff8fab) 25%, transparent);
}

/* ═══════════════════════════════════════════════════ */
/*  主题专属样式 — 云海仙踪                            */
/* ═══════════════════════════════════════════════════ */
.cal-theme-xianxia {
  font-family: var(--ub-font-ui);
  letter-spacing: 1px;
}
.cal-theme-xianxia .cal-header {
  background: linear-gradient(180deg, #e8f4f0, #dcece4);
  border-bottom: 1px solid color-mix(in srgb, var(--ub-accent, #4a90a4) 25%, transparent);
}
.cal-theme-xianxia .cal-month-label {
  font-family: var(--ub-font-reading);
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--ub-accent, #4a90a4);
}
.cal-theme-xianxia .cal-nav-btn,
.cal-theme-xianxia .cal-newspaper-btn,
.cal-theme-xianxia .cal-refresh-btn,
.cal-theme-xianxia .cal-close-btn {
  border-radius: 10px;
  border-color: color-mix(in srgb, var(--ub-accent, #4a90a4) 20%, transparent);
}
.cal-theme-xianxia .cal-nav-btn:hover:not(:disabled),
.cal-theme-xianxia .cal-refresh-btn:hover {
  box-shadow: 0 0 10px color-mix(in srgb, var(--ub-accent, #4a90a4) 18%, transparent);
}
.cal-theme-xianxia .cal-day.is-today {
  box-shadow: 0 0 18px color-mix(in srgb, var(--ub-accent, #4a90a4) 22%, transparent),
              0 0 0 1.5px color-mix(in srgb, var(--ub-accent, #4a90a4) 50%, transparent);
  border-radius: 8px;
}
.cal-theme-xianxia .cal-detail-event {
  border-left-color: color-mix(in srgb, var(--ub-accent, #4a90a4) 30%, transparent);
}
/* 云海装饰：月标两侧云纹 */
.cal-theme-xianxia .cal-month-label::before,
.cal-theme-xianxia .cal-month-label::after {
  content: '☁';
  font-size: 10px;
  color: var(--ub-accent, #4a90a4);
  vertical-align: middle;
  opacity: 0.4;
  margin: 0 8px;
}
/* 云海装饰：today 外层光晕扩散 */
.cal-theme-xianxia .cal-day.is-today::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 12px;
  background: radial-gradient(circle, color-mix(in srgb, var(--ub-accent, #4a90a4) 10%, transparent) 0%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}

/* ═══════════════════════════════════════════════════ */
/*  文字/分隔色变量桥接（全主题）                      */
/*  calendar-popup 用 --ub-text / --ub-divider / --ub-accent / --ub-hover-bg，
    但五风格仅定义了 --ub-text-muted / --ub-bg-card / --ub-popup-bg，未定义这四项，
    导致深色模式下回退到浅色硬编码默认值（#111 等）而完全看不清。
    这里按各主题已有变量做桥接，浅色与暗色都补齐。
    ★ 本层桥接只覆盖 .cal-theme-* 子树（弹窗 + 自带主题类的编辑弹窗）；
      挂在 #panelOverlay 直下、够不到 .cal-theme-* 的兄弟弹窗（长按额外要求弹窗）
      由各主题文件里同名同值的主题级变量兜底（浅/深别名块各一套），此处不再重复定义。 */
/* 古风 */
.cal-theme-ancient{--ub-text:var(--text,#2c1810);--ub-divider:var(--divider,#c8b898);--ub-accent:var(--accent,#b5362e);--ub-hover-bg:var(--ink-light,rgba(44,24,16,0.06))}
/* 瑟瑟 */
.cal-theme-flirtatious{--ub-text:var(--text,#3a2a4a);--ub-divider:var(--divider,#ecdce8);--ub-accent:var(--accent,#d060a0);--ub-hover-bg:var(--lust-bg,rgba(144,80,192,0.06))}
/* 萦绕 */
.cal-theme-minimal{--ub-text:var(--text-color,#111111);--ub-divider:var(--border-color,#e0e0e0);--ub-accent:var(--text-color,#111111);--ub-hover-bg:rgba(0,0,0,0.04)}
/* 甜恋 */
.cal-theme-sweet{--ub-text:var(--sweet-text,#5c3d4a);--ub-divider:var(--sweet-border,#f0d8e0);--ub-accent:var(--sweet-pink,#ff8fab);--ub-hover-bg:var(--sweet-pink-light,rgba(255,143,171,0.08))}
/* 云海 */
.cal-theme-xianxia{--ub-text:var(--text,#2c4a3e);--ub-divider:var(--divider,rgba(70,90,75,0.35));--ub-accent:var(--jade,#8ab8a0);--ub-hover-bg:rgba(90,144,120,0.06)}

/* ═══════════════════════════════════════════════════ */
/*  深色模式适配（全主题）                             */
/* ═══════════════════════════════════════════════════ */

/* 深色：经期事件色 #c0392b 在深色底约 3:1（临界），提亮；其余事件色已足够 */
.panel-overlay.dark,body.dark-mode{--ub-cal-cycle:#e85040}
/* 古风暗色 */
.dark .cal-theme-ancient{--ub-text:var(--text,#e8dcc8);--ub-divider:var(--divider,#3a3228);--ub-accent:var(--accent,#d4564e);--ub-hover-bg:rgba(255,255,255,0.05)}
.dark .cal-theme-ancient .cal-header {
  background: linear-gradient(180deg, #1e1810, #1a1612);
}
.dark .cal-theme-ancient .cal-detail {
  background: linear-gradient(180deg, #1a1612 0%, #14100c 100%);
}

/* 瑟瑟暗色 */
.dark .cal-theme-flirtatious{--ub-text:var(--text,#e8e8ea);--ub-divider:var(--divider,#38383a);--ub-accent:var(--accent,#ff89b3);--ub-hover-bg:rgba(255,255,255,0.05)}
.dark .cal-theme-flirtatious .cal-header {
  background: linear-gradient(180deg, #2c2c2e, #242426);
}

/* 甜恋暗色 */
.dark .cal-theme-sweet{--ub-text:var(--sweet-text,#e8d8e0);--ub-divider:var(--sweet-border,rgba(255,143,171,0.2));--ub-accent:var(--sweet-pink,#ff8fab);--ub-hover-bg:rgba(255,255,255,0.05)}
.dark .cal-theme-sweet .cal-header {
  background: linear-gradient(135deg, #2a1a24, #1e1420, #1a1a2a);
}

/* 萦绕暗色 */
.dark .cal-theme-minimal{--ub-text:var(--text-color,#f0f0f0);--ub-divider:var(--border-color,#333333);--ub-accent:var(--text-color,#f0f0f0);--ub-hover-bg:rgba(255,255,255,0.06)}

/* 云海暗色 */
.dark .cal-theme-xianxia{--ub-text:var(--text,#e4ece0);--ub-divider:var(--divider,rgba(70,90,75,0.35));--ub-accent:var(--jade,#68b090);--ub-hover-bg:rgba(255,255,255,0.05)}
.dark .cal-theme-xianxia .cal-header {
  background: linear-gradient(180deg, #0a1a18, #0d1e1c);
}

/* 全局暗色覆盖（用变量回退处理） */
.dark .calendar-popup .cal-detail-event {
  background: var(--ub-hover-bg, rgba(255,255,255,0.04));
}

/* 天气图标容器（在状态栏中显示） */

/* 深空舰桥：历法与事件遥测 */
.calendar-popup.cal-theme-bridge.bridge-module-calendar{
  --ub-text:var(--bridge-text,#16222c);--ub-text-muted:var(--bridge-text-muted,#62757c);
  --ub-divider:var(--bridge-line,#91a5ad);--ub-accent:var(--bridge-signal,#0a7189);
  --ub-hover-bg:var(--bridge-panel-alt,#dde8eb);
  width:min(94%,820px);max-width:820px;border-radius:0;
  background:var(--bridge-panel,#eef3f5);border:1px solid var(--bridge-line-strong,#23758a);
  box-shadow:0 0 0 3px var(--bridge-panel,#eef3f5),0 0 0 4px var(--bridge-line,#91a5ad),0 16px 38px rgba(5,20,27,.24);
  font-family:var(--bridge-font-ui,'Microsoft YaHei','PingFang SC',sans-serif);
}
.cal-theme-bridge .cal-header{background:linear-gradient(90deg,var(--bridge-panel-alt,#dde8eb),var(--bridge-panel,#eef3f5));border-bottom:1px solid var(--bridge-line-strong,#23758a);}
.cal-theme-bridge .cal-header::after{content:'CHRONOLOGY / EVENT TELEMETRY';font:9px/1 var(--bridge-font-data,'Consolas',monospace);letter-spacing:1.2px;color:var(--bridge-text-muted,#62757c);position:absolute;left:50%;bottom:4px;transform:translateX(-50%);}
.cal-theme-bridge .cal-month-label{font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:1.5px;}
.cal-theme-bridge .cal-nav-btn,.cal-theme-bridge .cal-newspaper-btn,.cal-theme-bridge .cal-refresh-btn,.cal-theme-bridge .cal-close-btn{min-width:34px;min-height:34px;border-radius:0;border:1px solid var(--bridge-line,#91a5ad);background:transparent;color:var(--bridge-text,#16222c);}
.cal-theme-bridge .cal-weekdays{background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);font:10px/1 var(--bridge-font-data,'Consolas',monospace);letter-spacing:1px;}
.cal-theme-bridge .cal-grid{gap:1px;background:var(--bridge-line,#91a5ad);border:1px solid var(--bridge-line,#91a5ad);}
.cal-theme-bridge .cal-day{border-radius:0;border:0;background:var(--bridge-panel,#eef3f5);font-family:var(--bridge-font-data,'Consolas',monospace);aspect-ratio:1.6;}
.cal-theme-bridge .cal-day:hover{background:var(--bridge-panel-alt,#dde8eb);}
.cal-theme-bridge .cal-day.is-today{box-shadow:inset 0 0 0 2px var(--bridge-signal,#0a7189);}
.cal-theme-bridge .cal-day.is-selected{background:var(--bridge-signal,#0a7189);color:var(--bridge-signal-contrast,#fff);}
.cal-theme-bridge .cal-detail{background:var(--bridge-panel-inset,#d5e1e5);border-top:1px solid var(--bridge-line-strong,#23758a);}
.cal-theme-bridge .cal-detail-event{border-radius:0;border-left:3px solid var(--bridge-signal,#0a7189);background:var(--bridge-panel,#eef3f5);}
.cal-theme-bridge .cal-detail-event-type{border-radius:0;font-family:var(--bridge-font-data,'Consolas',monospace);}
@media(max-width:599px){.calendar-popup.cal-theme-bridge.bridge-module-calendar{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0}.cal-theme-bridge .cal-header::after{display:none}.cal-theme-bridge .cal-detail{overflow-y:auto}}

/* ═══════════════════════════════════════════════════ */
/*  主题专属样式 — 灵动玻璃（iOS，token 已由主题根接管，此处仅装饰） */
/* ═══════════════════════════════════════════════════ */
.cal-theme-ios{
  font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif);
  letter-spacing:0;
  --ub-text:var(--ios-label,#1c1c1e);--ub-text-muted:var(--ios-label-2,rgba(60,60,67,.62));
  --ub-divider:var(--ios-sep,rgba(60,60,67,.12));--ub-accent:var(--ios-accent,#007aff);
  --ub-hover-bg:var(--ios-fill,rgba(120,120,128,.1));
}
.cal-theme-ios .cal-header{background:transparent;border-bottom:1px solid var(--ios-sep,rgba(60,60,67,.12));}
.cal-theme-ios .cal-month-label{font-weight:700;letter-spacing:-.2px;font-size:16px;}
.cal-theme-ios .cal-nav-btn,.cal-theme-ios .cal-newspaper-btn,.cal-theme-ios .cal-refresh-btn,.cal-theme-ios .cal-close-btn{
  min-width:32px;min-height:32px;border:none;border-radius:999px;
  background:var(--ios-fill,rgba(120,120,128,.1));color:var(--ios-label,#1c1c1e);
  font-weight:600;transition:transform .15s var(--ios-ease-spring,cubic-bezier(.32,1.18,.35,1)),background .15s;
}
.cal-theme-ios .cal-nav-btn:hover,.cal-theme-ios .cal-refresh-btn:hover,.cal-theme-ios .cal-close-btn:hover{background:var(--ios-fill-2,rgba(120,120,128,.16));}
.cal-theme-ios .cal-nav-btn:active,.cal-theme-ios .cal-refresh-btn:active,.cal-theme-ios .cal-close-btn:active{transform:scale(.9);}
.cal-theme-ios .cal-day{border-radius:999px;border:none;transition:background .15s,transform .15s var(--ios-ease-spring,cubic-bezier(.32,1.18,.35,1));}
.cal-theme-ios .cal-day:hover{background:var(--ios-fill,rgba(120,120,128,.1));}
.cal-theme-ios .cal-day.is-today{background:var(--ios-accent,#007aff);color:#fff;font-weight:600;box-shadow:none;border-color:transparent;}
.cal-theme-ios .cal-day.is-selected{box-shadow:0 0 0 2px var(--ios-accent,#007aff);}
.cal-theme-ios .cal-detail{background:var(--ios-fill,rgba(120,120,128,.08));border-top:1px solid var(--ios-sep,rgba(60,60,67,.12));}
.cal-theme-ios .cal-detail-event{border-radius:12px;border-left:3px solid var(--ios-accent,#007aff);background:var(--ios-surface-solid,#fff);}
.cal-theme-ios .cal-detail-event-type{border-radius:999px;}
.dark .cal-theme-ios{
  --ub-text:var(--ios-label,#fff);--ub-text-muted:var(--ios-label-2,rgba(235,235,245,.62));
  --ub-divider:var(--ios-sep,rgba(235,235,245,.12));--ub-accent:var(--ios-accent,#0a84ff);
  --ub-hover-bg:var(--ios-fill,rgba(120,120,128,.24));
}
.dark .cal-theme-ios .cal-detail-event{background:var(--ios-surface-solid,#1c1c1e);}

/* 按钮动画 */

/* ═══════════════════════════════════════════════════ */
/*  事件编辑入口（详情卡片内）                          */
/* ═══════════════════════════════════════════════════ */
.cal-detail-event-title { display: flex; align-items: center; gap: 4px; }
.cal-detail-event-title-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-ev-actions { display: inline-flex; gap: 4px; flex-shrink: 0; margin-left: auto; }
.cal-ev-edit, .cal-ev-del {
  width: 20px; height: 20px; padding: 0; border: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-popup-bg, #fff); color: var(--ub-text, #111);
  border-radius: var(--ub-btn-radius, 4px); font-size: 10px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; line-height: 1; transition: all 0.15s;
}
.cal-ev-edit:hover, .cal-ev-del:hover { border-color: var(--ub-accent, #4a90d9); color: var(--ub-accent, #4a90d9); }
.cal-ev-del.is-confirming {
  background: var(--ub-accent, #b5362e); color: #fff; border-color: var(--ub-accent, #b5362e);
  font-size: 9px; letter-spacing: 0.5px;
}
.cal-add-btn {
  width: 100%; margin-top: 6px; padding: 5px 0;
  border: 1px dashed color-mix(in srgb, var(--ub-accent, #4a90d9) 50%, var(--ub-divider, #e0e0e0));
  background: transparent; color: var(--ub-accent, #4a90d9);
  border-radius: var(--ub-btn-radius, 4px); font-size: 10px; cursor: pointer;
  letter-spacing: 1px; font-family: inherit;
}
.cal-add-btn:hover { background: color-mix(in srgb, var(--ub-accent, #4a90d9) 6%, transparent); }
.cal-chronicle-btn{width:100%;margin-top:6px;padding:6px 8px;border:1px solid color-mix(in srgb,var(--ub-accent,#4a90d9) 50%,var(--ub-divider,#e0e0e0));border-radius:var(--ub-btn-radius,4px);background:color-mix(in srgb,var(--ub-accent,#4a90d9) 8%,transparent);color:var(--ub-accent,#4a90d9);font:inherit;font-size:10px;letter-spacing:.5px;cursor:pointer}.cal-chronicle-btn:hover{background:color-mix(in srgb,var(--ub-accent,#4a90d9) 15%,transparent)}

/* ═══════════════════════════════════════════════════ */
/*  事件编辑模态弹层                                    */
/* ═══════════════════════════════════════════════════ */
.cal-edit-modal {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; box-sizing: border-box;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.cal-edit-modal-card {
  width: 100%; max-width: 360px; max-height: 80vh; max-height: 80dvh;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--ub-popup-bg, #fff); color: var(--ub-text, #111);
  border: 1px solid var(--ub-divider, #e0e0e0);
  border-radius: var(--ub-popup-radius, 8px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.28);
  font-family: inherit; letter-spacing: inherit;
}
.cal-edit-modal-title {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; font-size: 13px; font-weight: 600; letter-spacing: 1px;
  border-bottom: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-bg-card, #fafafa); flex-shrink: 0;
}
.cal-edit-modal-x {
  width: 24px; height: 24px; border: 1px solid var(--ub-divider, #e0e0e0);
  background: transparent; color: var(--ub-text-muted, #888); font-size: 15px;
  border-radius: var(--ub-btn-radius, 4px); cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.cal-edit-modal-x:hover { color: var(--ub-accent, #4a90d9); border-color: var(--ub-accent, #4a90d9); }
.cal-edit-form {
  padding: 12px 14px; overflow-y: auto; overscroll-behavior: contain; flex: 1;
}
.cal-edit-form::-webkit-scrollbar { width: 4px; }
.cal-edit-form::-webkit-scrollbar-thumb { background: var(--ub-scrollbar-thumb, #ccc); border-radius: 2px; }
.cal-edit-row { margin-bottom: 8px; }
.cal-edit-row.is-hidden { display: none; }
.cal-edit-row label { display: block; font-size: 9px; color: var(--ub-text-muted, #888); letter-spacing: 1px; margin-bottom: 3px; }
.cal-edit-row input, .cal-edit-row textarea {
  width: 100%; box-sizing: border-box; border: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-popup-bg, #fff); color: var(--ub-text, #111);
  border-radius: var(--ub-btn-radius, 4px); padding: 6px 8px; font-size: var(--ub-ui-font-11,11px);
  font-family: inherit; letter-spacing: 0.5px;
}
.cal-edit-row textarea { resize: vertical; min-height: 38px; }
.cal-edit-row input:focus, .cal-edit-row textarea:focus { outline: none; border-color: var(--ub-accent, #4a90d9); }
.cal-edit-type-row { display: flex; gap: 6px; }
.cal-edit-type-btn {
  flex: 1; padding: 6px 0; border: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-popup-bg, #fff); color: var(--ub-text, #111);
  border-radius: var(--ub-btn-radius, 4px); font-size: 11px; cursor: pointer;
  font-family: inherit; letter-spacing: 1px; transition: all 0.15s;
}
.cal-edit-type-btn:hover { border-color: var(--ub-accent, #4a90d9); }
.cal-edit-type-btn.active {
  border-color: var(--ub-accent, #4a90d9); color: var(--ub-accent, #4a90d9);
  background: color-mix(in srgb, var(--ub-accent, #4a90d9) 8%, transparent);
}
.cal-edit-actions {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  border-top: 1px solid var(--ub-divider, #e0e0e0); flex-shrink: 0;
}
.cal-edit-btn {
  padding: 6px 16px; border: 1px solid var(--ub-divider, #e0e0e0);
  background: var(--ub-popup-bg, #fff); color: var(--ub-text, #111);
  border-radius: var(--ub-btn-radius, 4px); font-size: 11px; cursor: pointer;
  font-family: inherit; letter-spacing: 1px; transition: all 0.15s;
}
.cal-edit-btn:hover { border-color: var(--ub-accent, #4a90d9); color: var(--ub-accent, #4a90d9); }
.cal-edit-btn-primary {
  background: var(--ub-accent, #4a90d9); color: #fff; border-color: var(--ub-accent, #4a90d9);
}
.cal-edit-btn-primary:hover { filter: brightness(1.08); color: #fff; }
.cal-edit-btn-danger {
  color: var(--ub-accent, #b5362e); border-color: color-mix(in srgb, var(--ub-accent, #b5362e) 45%, var(--ub-divider, #e0e0e0));
}
.cal-edit-btn-danger:hover { background: var(--ub-accent, #b5362e); color: #fff; }

/* 深色模式：模态遮罩略加深 */
.dark .cal-edit-modal, .cal-edit-modal.dark { background: rgba(0,0,0,0.5); }

/* ═══════════════════════════════════════════════════ */
/*  长按刷新：额外提示词弹窗                            */
/*  （.calendar-popup 的兄弟节点，挂在 #panelOverlay 直下  */
/*    见 renderers/calendar-popup.ts 的 insertAdjacentHTML  */
/*    → 主题变量靠各主题文件的主题级 --ub-text/--ub-divider/  */
/*      --ub-accent/--ub-hover-bg，不靠 .cal-theme-* 桥接） */
/* ═══════════════════════════════════════════════════ */
.cal-extra-overlay {
  position: absolute; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45);
  padding: 16px; box-sizing: border-box;
}
.cal-extra-overlay.dark { background: rgba(0,0,0,0.6); }
.cal-extra-modal {
  width: 100%; max-width: 360px;
  background: var(--ub-popup-bg, #fff);
  color: var(--ub-text, #111);
  border: var(--ub-popup-border, 1px solid var(--ub-divider, #e0e0e0));
  border-radius: var(--ub-popup-radius, 8px);
  box-shadow: var(--ub-popup-shadow, 0 8px 32px rgba(0,0,0,0.2));
  overflow: hidden; font-family: inherit;
}
.cal-extra-title {
  padding: 10px 14px; font-size: 13px; font-weight: 600; letter-spacing: 1px;
  border-bottom: 1px solid var(--ub-divider, #e0e0e0);
}
.cal-extra-field { padding: 12px 14px; }
.cal-extra-label {
  display: block; font-size: var(--ub-ui-font-11,11px); opacity: 0.85; margin-bottom: 8px;
  line-height: 1.6;
}
.cal-extra-label b { color: var(--ub-accent, #b5362e); }
.cal-extra-textarea {
  width: 100%; min-height: 110px; resize: vertical; line-height: 1.6;
  padding: 8px 10px; box-sizing: border-box; font-size: var(--ub-ui-font-12,12px); font-family: inherit;
  background: var(--ub-popup-bg, #fff);
  color: var(--ub-text, #111);
  border: 1px solid var(--ub-divider, #e0e0e0);
  border-radius: var(--ub-btn-radius, 4px);
  outline: none; transition: border-color 0.15s;
}
.cal-extra-textarea:focus { border-color: var(--ub-accent, #4a90d9); }
.cal-extra-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 10px 14px; border-top: 1px solid var(--ub-divider, #e0e0e0);
}

/* ═══════════════════════════════════════════════════ */
/*  PC 分栏布局（A4 左右分栏，≥768px）                  */
/* ═══════════════════════════════════════════════════ */
@media (min-width: 768px) {
  .calendar-popup {
    width: min(94%, 820px) !important;
    max-width: 820px !important;
    max-height: 86vh;
    max-height: 86dvh;
  }
  .calendar-popup[data-cal-layout="split"] {
    display: flex;
    flex-direction: column;
  }
  .cal-split {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .cal-col-cal {
    flex: 1 1 50%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--ub-divider, #e0e0e0);
  }
  .cal-col-cal .cal-weekdays {
    flex-shrink: 0;
  }
  .cal-grid-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-bottom: 8px;
  }
  .calendar-popup[data-cal-layout="split"] .cal-grid {
    grid-auto-rows: auto;
  }
  .calendar-popup[data-cal-layout="split"] .cal-day {
    aspect-ratio: 1.05;
  }
  .cal-col-ev {
    flex: 1 1 50%;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .calendar-popup[data-cal-layout="split"] .cal-col-ev .cal-detail {
    max-height: none;
    flex: 1;
    min-height: 0;
    border-top: none;
    border-left: 1px solid var(--ub-divider, #e0e0e0);
    border-radius: 0;
  }
}
`;
