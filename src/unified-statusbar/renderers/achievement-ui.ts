// ===== 成就系统 · UI 渲染 =====
// 详见 docs/superpowers/specs/2026-06-27-achievement-system-design.md §4
//
// 职责：成就履历面板（打开时才渲染）+ 解锁 toastr（正文即趣评）+ 庆祝特效。纯展示。
// 复用：popup 6 步骨架（showPastExperiencePopup 模式）+ .db-tab 标签切换 + dossier 时间轴视觉
//       + effects.ts（spawnClickText/spawnInkSparks）+ syncDarkClass 深色模式。
// 入口：状态栏系统级按钮区，数据库左侧，受 config.achievementEnabled 总开关控制显隐（index.ts 绑定）。
//
// 第九轮（2026-10-05，主题「会心一笑」）本文件改动：
//   F33 季节成就进度（peek 侧修，本文件只放宽开面板补解锁 C2 的收集判据 → hasTimingCondition）
//   F34 搜索框 / 分类标签进度条与计数 / 近期按日期分组
//   U19 稀有度色条+名牌（色板单一来源 core/achievement-rarity.ts）；统计条补点数与今日增量
//   L10 抬头问候（现实时段，core/real-clock.ts）
//   L11 成就簿互动彩蛋埋点（开面板 / 翻到底，各 1 行 emit）
//   L12 段位勋章档位签 + 统计条改用 core/achievement-tier.ts 单一来源
// ※ 布局口径（用户拍板 2026-10-05）：卡片名称行的右侧信息（分类 / 档位 / 稀有度）全部收进
//   .ach-meta 一个右对齐组，禁止用 space-between 把分类胶囊甩到行中间。
import { ubIcon } from '../core/icons';
import { getAchievements, getAchievement, ensureAchievementCatalog } from '../core/achievement-catalog';
import { getBook, isUnlocked } from '../core/achievement-store';
import type { AchievementDef, LogEntry } from '../core/achievement-types';
import { syncDarkClass, syncDarkClassMinimal, markPopupShown, guardGhostClick, closePanelOverlay } from './html-builder';
import { ensureStyleOnce } from './style-once';
import { peekProgress, hasTimingCondition } from '../core/achievement-progress';
import { unlockDefinitions } from '../core/achievement-engine';
import { type StyleType } from '../core/constants';
import { getConfig } from '../core/config-store';
import { showAchievementNotify } from './achievement-notify';
import { escapeHtml as esc } from '../core/html-escape';
import { RARITY_LABEL, rarityOf, rarityHexA } from '../core/achievement-rarity';
import { TIER_NAMES, computeTierSnapshot } from '../core/achievement-tier';
import { getRealClockParts, matchHourRange } from '../core/real-clock';

// ===== 成就面板专用 CSS（注入一次）=====
// 5 主题深色适配：4 主题靠 .panel-overlay.dark 继承、minimal 靠 body.dark-mode 继承，禁用单变量硬编码（见记忆 dark-mode-adaptation-requirement）。
// 颜色一律走 5 主题全链回退（card/accent/text/text-muted/divider 五角色），缺失时回退到通用半透明色。
// §3.1 深色缺口补齐 + §3.3 静态质感 B 装饰合并（spec 2026-07-01-static-aesthetic-design.md §2.4）：
//   既有两层链 → 5 主题全链；删 --card-soft；.ach-tab 选中态 accent 全链；5 主题各显 B 招牌装饰（按 .ach-popup.ach-theme-{x} 作用域，纯 CSS 静态）。
//   B 装饰：每主题只动 .ach-card 容器边框/圆角/阴影/背景 + .ach-name 字体 + .ach-cat 分类签 + .ach-flavor 趣评底 + 可选 ::before 印/符。DOM 模板不变。
const _card = 'var(--card,var(--sweet-card,var(--jade-surface-1,var(--bg-color,rgba(255,255,255,.04)))))';
const _accent = 'var(--accent,var(--sweet-pink,var(--jade-deep,var(--text,#888))))';
const _text = 'var(--text,var(--sweet-text,var(--text-color,#111)))';
const _textMuted = 'var(--text-muted,var(--sweet-text-muted,var(--secondary-text,#999)))';
const _divider = 'var(--divider,var(--sweet-border,var(--border-color,rgba(128,128,128,.18))))';
const ACHIEVEMENT_CSS = `
.ach-stat{display:flex;align-items:center;gap:10px;padding:8px 10px;font-size:13px;color:${_text};flex-wrap:wrap;}
.ach-stat-num{font-weight:700;white-space:nowrap;}
.ach-stat-pts{font-size:11px;color:${_textMuted};white-space:nowrap;font-variant-numeric:tabular-nums;}
.ach-stat-today{font-size:10.5px;font-weight:600;color:${_accent};background:color-mix(in srgb,${_accent} 12%,transparent);border-radius:8px;padding:1px 7px;white-space:nowrap;}
.ach-tier-label{color:${_textMuted};white-space:nowrap;font-size:12px;}
.ach-tier-bar{flex:1;min-width:40px;height:4px;border-radius:2px;background:${_divider};overflow:hidden;}
.ach-tier-bar-fill{display:block;height:100%;background:${_accent};transition:width .4s;width:0%;}
.ach-tier-pct{font-size:11px;color:${_textMuted};min-width:28px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
/* F34 搜索框（第九轮）：按名字/条件说明过滤；隐藏成就与未解锁趣评不入搜索（防剧透） */
.ach-search{display:flex;align-items:center;gap:6px;margin:0 10px 6px;padding:6px 9px;border:1px solid ${_divider};border-radius:8px;background:${_card};}
.ach-search .ub-ic{width:14px;height:14px;opacity:.55;flex:none;}
.ach-search input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:inherit;font:inherit;font-size:12.5px;padding:1px 0;}
.ach-search input::placeholder{color:${_textMuted};opacity:.8;}
.ach-search-clear{font-size:13px;line-height:1;opacity:.5;cursor:pointer;padding:0 2px;}
.ach-search-clear:hover{opacity:1;}
.ach-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:4px 10px 8px;border-bottom:1px solid ${_divider};}
.ach-tab{position:relative;font-size:12px;padding:3px 9px 6px;border-radius:10px;cursor:pointer;border:1px solid transparent;background:transparent;color:${_textMuted};}
.ach-tab[data-active="1"]{background:${_accent};color:${_card};border-color:transparent;}
/* F34 分类进度：标签下 2px 细条（完成度）+ 全通 ✦ 高亮 */
.ach-tab-bar{position:absolute;left:8px;right:8px;bottom:2px;height:2px;border-radius:1px;background:${_divider};overflow:hidden;}
.ach-tab-bar>i{display:block;height:100%;border-radius:1px;background:${_accent};}
.ach-tab[data-full="1"]{color:${_accent};}
.ach-tab[data-full="1"] .ach-tab-bar>i{background:${_accent};}
.ach-tab-detail{display:flex;justify-content:space-between;gap:8px;padding:2px 12px 6px;font-size:11px;color:${_textMuted};}
.ach-tab-detail b{font-weight:600;color:${_text};}
.ach-empty{text-align:center;color:${_textMuted};padding:24px 0;font-size:13px;}
/* F23 触控热区：分类 chip 触屏放大（成簇排列不做透明命中桥，防抢相邻分类命中） */
@media (hover:none) and (pointer:coarse){
  .ach-tabs{gap:6px;padding:6px 10px 10px}
  .ach-tab{padding:8px 13px 10px;font-size:13px}
}
.ach-list{padding:6px 10px 14px;max-height:60vh;overflow-y:auto;}
.ach-sentinel{text-align:center;color:${_textMuted};font-size:11px;padding:10px 0 4px;}
.ach-card{padding:10px;margin:6px 0;border:1px solid ${_divider};border-radius:8px;background:${_card};}
.ach-card.locked{opacity:.62;}
.ach-card.hidden-ach .ach-name{color:${_textMuted};}
.ach-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.ach-name{font-weight:600;font-size:14px;color:${_text};min-width:0;}
/* ※ 右侧信息组（分类/档位/稀有度）贴在一起靠右（用户拍板布局口径） */
.ach-meta{display:inline-flex;align-items:baseline;gap:5px;flex:none;white-space:nowrap;}
.ach-cat{font-size:11px;color:${_textMuted};white-space:nowrap;}
/* U19 稀有度：色条 + 名牌（四档色板与解锁弹卡同一来源：core/achievement-rarity.ts） */
.ach-card.ach-r0{border-left:3px solid ${rarityHexA(0,'8c')};}
.ach-card.ach-r1{border-left:3px solid ${rarityHexA(1,'bf')};}
.ach-card.ach-r2{border-left:3px solid ${rarityHexA(2,'cc')};}
.ach-card.ach-r3{border-left:3px solid ${rarityHexA(3,'ff')};}
.ach-card.locked.ach-r0{border-left-color:${rarityHexA(0,'59')};}
.ach-card.locked.ach-r1{border-left-color:${rarityHexA(1,'66')};}
.ach-card.locked.ach-r2{border-left-color:${rarityHexA(2,'6b')};}
.ach-card.locked.ach-r3{border-left-color:${rarityHexA(3,'73')};}
.ach-rar{font-size:10px;font-weight:600;border-radius:8px;padding:1px 6px;white-space:nowrap;letter-spacing:.03em;}
.ach-rar.r0{color:${rarityHexA(0,'ff')};background:${rarityHexA(0,'1f')};}
.ach-rar.r1{color:${rarityHexA(1,'ff')};background:${rarityHexA(1,'1f')};}
.ach-rar.r2{color:${rarityHexA(2,'ff')};background:${rarityHexA(2,'1f')};}
.ach-rar.r3{color:#a97c00;background:${rarityHexA(3,'29')};}
.panel-overlay.dark .ach-rar.r3,body.dark-mode .ach-rar.r3{color:#ffd84d;background:${rarityHexA(3,'2e')};}
/* L12 段位勋章：档位签 */
.ach-tier-chip{font-size:10px;font-weight:700;letter-spacing:.06em;color:#fff;background:linear-gradient(120deg,#b98c1e,#e0a615);border-radius:7px;padding:1px 6px;white-space:nowrap;}
.ach-card.locked .ach-tier-chip{filter:saturate(.4) opacity(.75);}
.ach-intro{font-size:12px;color:${_textMuted};margin:3px 0 0;}
.ach-flavor{font-size:12px;font-style:italic;color:${_accent};margin:3px 0 0;}
.ach-foot{font-size:11px;color:${_textMuted};margin:4px 0 0;display:flex;justify-content:space-between;gap:8px;}
.ach-prog{color:${_textMuted};}
.ach-time{color:${_textMuted};}
/* F34 近期按日期分组（今天/昨天/更早） */
.ach-group{display:flex;align-items:center;gap:8px;font-size:11px;color:${_textMuted};margin:8px 0 2px;letter-spacing:.06em;}
.ach-group::after{content:'';flex:1;height:1px;background:${_divider};}
.ach-tl-item{position:relative;padding:8px 6px 8px 12px;border-bottom:1px dashed ${_divider};}
.ach-tl-item.ach-r0::before,.ach-tl-item.ach-r1::before,.ach-tl-item.ach-r2::before,.ach-tl-item.ach-r3::before{content:'';position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:2px;}
.ach-tl-item.ach-r0::before{background:${rarityHexA(0,'8c')};}
.ach-tl-item.ach-r1::before{background:${rarityHexA(1,'bf')};}
.ach-tl-item.ach-r2::before{background:${rarityHexA(2,'cc')};}
.ach-tl-item.ach-r3::before{background:${rarityHexA(3,'ff')};}
.ach-tl-name{font-weight:600;font-size:13px;margin:1px 0;color:${_text};}
.ach-tl-intro{font-size:12px;color:${_textMuted};margin:1px 0 0;}
.ach-tl-info{font-size:11px;color:${_textMuted};margin:2px 0 0;}

/* === §3.3 B 装饰 · 5 主题各显招牌（按 .ach-popup.ach-theme-{x} 作用域，纯静态 CSS）=== */
/* 古风 ancient：卷轴 + 朱印 */
.ach-popup.ach-theme-ancient .ach-card{border-top:3px solid var(--roller,#8b6e4e);border-radius:2px;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,var(--paper-stain,rgba(139,110,78,0.04)) 2px,var(--paper-stain,rgba(139,110,78,0.04)) 3px);box-shadow:1px 1px 0 var(--accent-soft,#e8c8b8);}
.ach-popup.ach-theme-ancient .ach-name{font-family:var(--ub-font-reading);font-weight:600;letter-spacing:2px;}
.ach-popup.ach-theme-ancient .ach-cat{transform:rotate(-2deg);border:1.5px solid var(--accent,#b5362e);background:var(--accent-bg-faint,rgba(181,54,46,0.06));padding:1px 6px;box-shadow:1px 1px 0 var(--accent-soft,#e8c8b8);}
.ach-popup.ach-theme-ancient .ach-flavor{background:var(--ink-light,rgba(44,24,16,0.06));border-left:3px solid var(--accent,#b5362e);padding:2px 8px;}
.ach-popup.ach-theme-ancient .ach-flavor::before{content:'评';display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;font-size:12px;font-style:normal;color:#f5f0e6;background:var(--accent,#b5362e);border:1.5px solid var(--accent-soft,#e8c8b8);margin-right:6px;vertical-align:middle;letter-spacing:0;}
.panel-overlay.dark .ach-popup.ach-theme-ancient .ach-flavor::before{color:#1a1612;}

/* 瑟瑟 flirtatious：霓虹 */
.ach-popup.ach-theme-flirtatious .ach-card{border-radius:12px;box-shadow:0 0 16px var(--accent-glow,rgba(208,96,160,0.10)),0 2px 12px rgba(0,0,0,.4);}
.ach-popup.ach-theme-flirtatious .ach-name{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-weight:600;color:var(--accent-deep,#b04878);letter-spacing:1px;}
.ach-popup.ach-theme-flirtatious .ach-cat{border-radius:10px;background:var(--accent-bg-faint,rgba(208,96,160,0.08));box-shadow:0 0 8px var(--accent-glow,rgba(208,96,160,0.10));padding:1px 6px;}
.ach-popup.ach-theme-flirtatious .ach-flavor{background:linear-gradient(135deg,var(--accent-bg-faint,rgba(208,96,160,0.08)),var(--lust-bg,rgba(144,80,192,0.06)));border-left:3px solid var(--accent,#d060a0);border-radius:8px;padding:2px 8px;}

/* 萦绕 minimal：极简克制 */
.ach-popup.ach-theme-minimal .ach-card{border-top:1px solid var(--text-color,#111);border-radius:2px;}
.ach-popup.ach-theme-minimal .ach-name{font-family:'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;font-weight:700;letter-spacing:1px;}
.ach-popup.ach-theme-minimal .ach-cat{text-transform:uppercase;letter-spacing:2px;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;}
.ach-popup.ach-theme-minimal .ach-flavor{font-family:'Playfair Display',Georgia,'Times New Roman','Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;border-left:1px solid var(--border-color,#e0e0e0);}

/* 甜恋 sweet：糖果（§3.0 严重① 白底重灾修复，深色 --sweet-card:#241c28）*/
.ach-popup.ach-theme-sweet .ach-card{border-radius:18px;background:linear-gradient(135deg,var(--sweet-card,#ffffff),var(--sweet-bubble,#fff0f5));box-shadow:0 2px 16px rgba(200,160,180,.12);}
.ach-popup.ach-theme-sweet .ach-name{font-family:'ZCOOL KuaiLe','Microsoft YaHei','PingFang SC','Heiti SC','Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei',sans-serif;letter-spacing:1px;}
.ach-popup.ach-theme-sweet .ach-cat{border-radius:12px;background:var(--sweet-pink-light,#ffe0ea);border:1px solid var(--sweet-border,#f0d8e0);padding:1px 8px;}
.ach-popup.ach-theme-sweet .ach-flavor{background:var(--sweet-bubble,#fff0f5);border-left:3px solid var(--sweet-pink,#ff8fab);border-radius:12px;padding:2px 8px;}
.ach-popup.ach-theme-sweet .ach-flavor::before{content:'♡';display:inline-block;font-size:13px;font-style:normal;color:var(--sweet-pink,#ff8fab);margin-right:5px;vertical-align:middle;}

/* 云海仙踪 xianxia：玉金 */
.ach-popup.ach-theme-xianxia .ach-card{border-top:2px solid var(--gold,#b89848);box-shadow:0 0 0 1px var(--gold-pale,rgba(200,170,100,0.18)),0 4px 16px rgba(60,90,70,.08);background:linear-gradient(175deg,var(--jade-surface-1,#f4faf6),var(--jade-surface-2,#e8f2ec));}
.ach-popup.ach-theme-xianxia .ach-name{font-family:var(--ub-font-reading);font-weight:600;letter-spacing:2px;text-shadow:0 1px 0 var(--gold-wash,rgba(210,180,110,0.08));}
.ach-popup.ach-theme-xianxia .ach-cat{transform:rotate(-2deg);color:var(--cinnabar-deep,#983028);border:1px solid var(--cinnabar,#c05048);background:var(--cinnabar-light,rgba(200,100,80,0.12));padding:1px 6px;}
.ach-popup.ach-theme-xianxia .ach-flavor{background:var(--jade-surface-2,#e8f2ec);border-left:3px solid var(--jade,#8ab8a0);padding:2px 8px;}
.ach-popup.ach-theme-xianxia .ach-flavor::before{content:'玉';display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;font-size:12px;font-style:normal;color:#f4faf6;background:var(--jade-deep,#5a9078);border:1px solid var(--gold,#b89848);margin-right:6px;vertical-align:middle;letter-spacing:0;}
.panel-overlay.dark .ach-popup.ach-theme-xianxia .ach-flavor::before{color:#19241e;}

/* 灵动玻璃：系统字体 + 圆角分组卡（配色走 --card/--text/--accent token 链自动跟随） */
.ach-popup.ach-theme-ios{border-radius:20px;font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif);}
.ach-popup.ach-theme-ios .panel-popup-title{letter-spacing:-.2px;font-weight:700;}
.ach-popup.ach-theme-ios .ach-card{border-radius:14px;border-top:none;box-shadow:0 0 0 1px var(--ios-sep,rgba(60,60,67,.12));transition:transform .15s var(--ios-ease-spring,cubic-bezier(.32,1.18,.35,1));}
.ach-popup.ach-theme-ios .ach-card:hover{transform:scale(1.01);}
.ach-popup.ach-theme-ios .ach-cat{border-radius:999px;background:var(--ios-tint,rgba(0,122,255,.1));padding:1px 8px;}
.ach-popup.ach-theme-ios .ach-rar{border-radius:999px;}
.ach-popup.ach-theme-ios .ach-flavor{background:var(--ios-fill,rgba(120,120,128,.1));border-left:3px solid var(--accent,#007aff);border-radius:0 10px 10px 0;padding:2px 10px;}
.ach-popup.ach-theme-ios .ach-tab{border-radius:999px;font-weight:600;}
.ach-popup.ach-theme-ios .ach-tab[data-active="1"]{background:var(--accent,#007aff);color:#fff;}
.ach-popup.ach-theme-ios .ach-tier-bar{border-radius:3px;}
.ach-popup.ach-theme-ios .ach-tier-bar-fill{border-radius:3px;}

/* 深空舰桥：授勋与履历终端 */
.ach-popup.ach-theme-bridge.bridge-module-achievements{border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-panel,#eef3f5);font-family:var(--bridge-font-ui,'Microsoft YaHei','PingFang SC',sans-serif);}
.ach-popup.ach-theme-bridge .panel-popup-head{background:linear-gradient(90deg,var(--bridge-panel-alt,#dde8eb),var(--bridge-panel,#eef3f5));border-bottom:1px solid var(--bridge-line-strong,#23758a);}
.ach-popup.ach-theme-bridge .panel-popup-title{letter-spacing:2px;}
.ach-popup.ach-theme-bridge .panel-popup-title::after{content:' / COMMENDATION LOG';font-size:9px;font-weight:500;color:var(--bridge-text-muted,#62757c);letter-spacing:1.3px;}
.ach-popup.ach-theme-bridge .ach-stat{background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);border-bottom:1px solid var(--bridge-line-strong,#23758a);font-family:var(--bridge-font-data,'Consolas',monospace);}
.ach-popup.ach-theme-bridge .ach-stat-pts{color:var(--bridge-screen-text,#8eeaff);opacity:.75;}
.ach-popup.ach-theme-bridge .ach-stat-today{color:var(--bridge-screen,#152b32);background:var(--bridge-screen-text,#8eeaff);}
.ach-popup.ach-theme-bridge .ach-tier-bar{height:6px;border-radius:0;background:rgba(142,234,255,.16);}
.ach-popup.ach-theme-bridge .ach-tier-bar-fill{background:var(--bridge-screen-text,#8eeaff);}
.ach-popup.ach-theme-bridge .ach-tabs{gap:0;padding:0 10px;background:var(--bridge-panel-inset,#d5e1e5);}
.ach-popup.ach-theme-bridge .ach-tab{min-height:34px;border-radius:0;border-right:1px solid var(--bridge-line,#91a5ad);letter-spacing:.5px;padding-bottom:6px;}
.ach-popup.ach-theme-bridge .ach-tab:first-child{border-left:1px solid var(--bridge-line,#91a5ad);}
.ach-popup.ach-theme-bridge .ach-tab[data-active="1"]{background:var(--bridge-signal,#0a7189);color:var(--bridge-signal-contrast,#fff);}
.ach-popup.ach-theme-bridge .ach-tab-bar{left:6px;right:6px;bottom:4px;background:rgba(65,92,101,.25);}
.ach-popup.ach-theme-bridge .ach-tab-bar>i{background:var(--bridge-signal,#0a7189);}
.ach-popup.ach-theme-bridge .ach-tab[data-active="1"] .ach-tab-bar>i{background:var(--bridge-signal-contrast,#fff);}
.ach-popup.ach-theme-bridge .ach-tab-detail{background:var(--bridge-panel-inset,#d5e1e5);border-bottom:1px solid var(--bridge-line-strong,#23758a);font-family:var(--bridge-font-data,'Consolas',monospace);}
.ach-popup.ach-theme-bridge .ach-search{background:var(--bridge-panel,#eef3f5);border-color:var(--bridge-line,#91a5ad);}
.ach-popup.ach-theme-bridge .ach-search input{color:var(--bridge-text,#1d3a41);font-family:var(--bridge-font-data,'Consolas',monospace);}
.ach-popup.ach-theme-bridge .ach-list{background:linear-gradient(rgba(35,117,138,.035) 1px,transparent 1px);background-size:100% 22px;}
.ach-popup.ach-theme-bridge .ach-group{font-family:var(--bridge-font-data,'Consolas',monospace);}
.ach-popup.ach-theme-bridge .ach-card{position:relative;border-radius:0;border:1px solid var(--bridge-line,#91a5ad);border-left:3px solid var(--bridge-signal,#0a7189);background:var(--bridge-panel,#eef3f5);box-shadow:2px 2px 0 var(--bridge-shadow-soft,rgba(65,92,101,.16));}
.ach-popup.ach-theme-bridge .ach-card::before{content:'LOG';position:absolute;top:5px;right:7px;font:9px/1 var(--bridge-font-data,'Consolas',monospace);color:var(--bridge-text-muted,#62757c);letter-spacing:1px;}
.ach-popup.ach-theme-bridge .ach-name{font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:.8px;color:var(--bridge-signal,#0a7189);}
.ach-popup.ach-theme-bridge .ach-cat{padding:1px 5px;border:1px solid var(--bridge-line,#91a5ad);font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:1px;}
.ach-popup.ach-theme-bridge .ach-rar{border-radius:0;font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:.6px;}
.ach-popup.ach-theme-bridge .ach-flavor{padding:3px 7px;border-left:2px solid var(--bridge-warn,#b47a16);background:var(--bridge-panel-alt,#dde8eb);font-style:normal;}
.ach-popup.ach-theme-bridge .ach-card.locked{opacity:1;border-left-color:var(--bridge-line,#91a5ad);filter:saturate(.45);}
.ach-popup.ach-theme-bridge .ach-card.locked .ach-name{color:var(--bridge-text-muted,#62757c);}
.ach-popup.ach-theme-bridge .ach-card.hidden-ach{opacity:.48;filter:grayscale(1);}
.ach-popup.ach-theme-bridge .ach-card.ach-bridge-new{animation:ach-bridge-edge .58s ease-out 1;}
@keyframes ach-bridge-edge{0%{box-shadow:inset 0 0 0 2px var(--bridge-warn,#b47a16),0 0 22px rgba(180,122,22,.7)}100%{box-shadow:2px 2px 0 var(--bridge-shadow-soft,rgba(65,92,101,.16));}}
@media(max-width:599px){.ach-popup.ach-theme-bridge.bridge-module-achievements{width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0}.ach-popup.ach-theme-bridge .ach-list{max-height:none;flex:1}.ach-popup.ach-theme-bridge .panel-popup-body{display:flex;flex-direction:column;min-height:0}}
@media(prefers-reduced-motion:reduce){.ach-popup.ach-theme-bridge .ach-card.ach-bridge-new{animation:none;box-shadow:inset 3px 0 0 var(--bridge-warn,#b47a16)}}
/* L10 抬头问候（现实时段，随标题下方一行小字） */
.ach-greet{display:block;font-size:10.5px;font-weight:400;color:${_textMuted};margin-top:2px;letter-spacing:.02em;}

/* minimal 深色由 body.dark-mode 继承（syncDarkClassMinimal），其余 4 主题深色 token 已在 .panel-overlay.dark 下重定义，B 装饰引用自动跟随。 */
`;

function injectCss(): void {
  // U28(第十二轮)：改走幂等口（原模块布尔在模块重求值后归 false，会再插一份同名样式表）
  ensureStyleOnce('ub-achievement-css', ACHIEVEMENT_CSS);
}

// ===== 工具 =====
/** 排序键：游戏内日期 YYYY-MM-DD，缺失回退字符串序。
 *  年份幅值统一补到 6 位再拼键——dateKey 允许 4-6 位年份（如 14900），字典序比较必须等宽才正确。 */
function timeSortKey(ts: string): string {
  const m = /(\d{4,6})[-年](\d{1,2})[-月](\d{1,2})/.exec(ts || '');
  if (!m) return ts || '';
  return m[1].padStart(6, '0') + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
}

/** 现实本地时间给她的问候语（L10）：纯展示、零成就、零副作用。 */
const GREET_RULES: ReadonlyArray<{ from: number; to: number; text: string }> = [
  { from: 23, to: 5, text: '这个点还不睡呀……算了，姐姐陪你一会儿。' },
  { from: 5, to: 9, text: '早呀。今天也来翻小本子了？' },
  { from: 9, to: 12, text: '上午好。慢慢看，不着急。' },
  { from: 12, to: 14, text: '到饭点了哦，别一边吃一边看，噎着人家可不负责。' },
  { from: 14, to: 18, text: '下午好呀，今天翻到哪一页了？' },
  { from: 18, to: 23, text: '晚上好。今天也辛苦啦——来看看都记了些什么吧。' },
];
function greetingText(): string {
  try {
    const { hour } = getRealClockParts();
    for (const r of GREET_RULES) if (matchHourRange(hour, r.from, r.to)) return r.text;
  } catch (_e) { /* ignore */ }
  return GREET_RULES[4].text;
}

/** 今日（现实日期）解锁条数（U19 统计条「今日 +N」）。log 已被 store 规范化，成本 O(log)。 */
function countTodayUnlocks(): number {
  try {
    const { dateKey } = getRealClockParts();
    let n = 0;
    for (const e of getBook().log) if (e.ts && e.ts.startsWith(dateKey)) n++;
    return n;
  } catch (_e) { return 0; }
}

const RECENT_COUNT = 20;

// ===== 卡片 HTML =====
// 右侧信息组（.ach-meta）统一承载：段位档位签（L12）/ 分类签 / 稀有度名牌（U19），整体右对齐。
// 进度可视化：未解锁非隐藏卡用 peekProgress(a).text 显示（§2.2 全类型纯读 peek）。
// C2 补通路：renderList 遍历时，对「未解锁 + 非隐藏 + 含时间类子条件且当前命中」的卡片
//   收集进 collector，面板渲染完后由 showAchievementPopup 调 unlockDefinitions 解锁 + 触发庆祝。
//   零额外遍历：peekProgress 本就要算，C2 只在同一遍多判一个 hasTimingCondition && peek.complete。
function rarityChipHTML(def: AchievementDef): string {
  const r = rarityOf(def);
  return '<span class="ach-rar r' + r + '">' + RARITY_LABEL[r] + '</span>';
}

function metaHTML(def: AchievementDef, isHiddenCard: boolean): string {
  const parts: string[] = [];
  if (def.observe && def.observe.type === 'tier-at-least') {
    // 段位勋章：档位签取代分类签（勋章必然属「称号」，省一枚冗余标签）
    parts.push('<span class="ach-tier-chip">第 ' + def.observe.tier + ' 档</span>');
  } else {
    parts.push('<span class="ach-cat">' + esc(isHiddenCard ? '隐藏' : def.cat) + '</span>');
  }
  if (!isHiddenCard) parts.push(rarityChipHTML(def));
  return '<span class="ach-meta">' + parts.join('') + '</span>';
}

function cardHTML(a: AchievementDef, collector?: AchievementDef[]): string {
  const unlocked = isUnlocked(a.id);
  const isHidden = !!a.hidden;
  const rar = isHidden && !unlocked ? '' : ' ach-r' + rarityOf(a);
  if (unlocked) {
    const book = getBook();
    const ts = book.unlockedAt[a.id] || '';
    const card = book.unlockedCard[a.id] || '';
    const foot = card
      ? ubIcon('check') + ' 解锁自 ' + esc(card) + ' · ' + esc(ts || '—')
      : ubIcon('check') + ' 解锁 · ' + esc(ts || '—');
    return '<div class="ach-card' + rar + '" data-ach-id="' + esc(a.id) + '">'
      + '<div class="ach-row"><span class="ach-name">✦ ' + esc(a.name) + '</span>' + metaHTML(a, false) + '</div>'
      + '<div class="ach-intro">' + esc(a.intro) + '</div>'
      + '<div class="ach-flavor">«' + esc(a.趣评) + '»</div>'
      + '<div class="ach-foot"><span class="ach-prog">' + foot + '</span></div>'
      + '</div>';
  }
  if (isHidden) {
    // 防剧透：隐藏成就不调 peekProgress，沿用「??? 偶然触发 / 未解锁」
    return '<div class="ach-card locked hidden-ach" data-ach-id="' + esc(a.id) + '">'
      + '<div class="ach-row"><span class="ach-name">✦ ???</span>' + metaHTML(a, true) + '</div>'
      + '<div class="ach-intro">??? 偶然触发</div>'
      + '<div class="ach-foot"><span class="ach-prog">' + ubIcon('lock') + ' 未解锁</span></div>'
      + '</div>';
  }
  // 未解锁 + 非隐藏：算 peek 进度（纯读，无副作用）
  const peek = peekProgress(a);
  // C2 收集：含时间类子条件且当前完全命中（peekEvaluate===true）→ 待开面板后解锁
  if (collector && hasTimingCondition(a.observe) && peek.complete) collector.push(a);
  const prog = peek.text;
  return '<div class="ach-card locked' + rar + '" data-ach-id="' + esc(a.id) + '">'
    + '<div class="ach-row"><span class="ach-name">✦ ' + esc(a.name) + '</span>' + metaHTML(a, false) + '</div>'
    + '<div class="ach-intro">' + esc(a.intro) + '</div>'
    + '<div class="ach-foot"><span class="ach-prog">' + (prog ? '⬢ ' + prog : ubIcon('lock') + ' 未解锁') + '</span></div>'
    + '</div>';
}

// ===== F21 分批渲染（成就 700+：全量 join+注入 + 数百次 peek 是打开卡顿主因）=====
// 语义保持：C2 解锁收集独立成数据遍历（只对含时间类条件的候选 peek，结果集与原「渲染时顺带收集」
// 完全一致）；卡片渲染按批切片，滚动到尾部续载；bridge「新解锁」标记跨批次补挂。
const ACH_BATCH_SIZE = 40;
let _achListIO: IntersectionObserver | null = null;
let _achView = '全部';
let _achRendered = 0;
let _achPendingBridge: Set<string> | null = null;
/** 当前视图（或搜索结果）的成就列表——批次观察器与续载共用，避免每次重算。 */
let _achList: AchievementDef[] = [];
/** F34 搜索词（非空时忽略分类，跨全部过滤；隐藏成就与趣评不入搜索，防剧透）。 */
let _achQuery = '';
let _searchTimer: ReturnType<typeof setTimeout> | null = null;

/** 某视图下可展示的成就（排除内部计数 id；与 renderCardSlice 同判据）。 */
function visibleAchievements(filter: string): AchievementDef[] {
  const list = filter === '全部'
    ? getAchievements()
    : getAchievements().filter(a => a.cat === filter);
  return list.filter(a => !a.id.startsWith('_'));
}

/** F34 搜索：按名字/条件说明匹配（不搜隐藏成就与趣评——前者防剧透、后者是解锁奖励）。 */
function searchedAchievements(query: string): AchievementDef[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return getAchievements().filter(a => !a.id.startsWith('_') && !a.hidden
    && (a.name.toLowerCase().includes(needle) || (a.intro || '').toLowerCase().includes(needle)));
}

/** 当前应展示的列表（搜索优先于分类标签）。 */
function currentAchievements(view: string): AchievementDef[] {
  return _achQuery ? searchedAchievements(_achQuery) : visibleAchievements(view);
}

/** C2 数据遍历：未解锁+非隐藏+含时间类子条件且当前 peek 完全命中（原 renderList 顺带收集的独立版）。 */
function collectTimingCompletions(filter: string): AchievementDef[] {
  return visibleAchievements(filter)
    .filter(a => !isUnlocked(a.id) && !a.hidden && hasTimingCondition(a.observe) && peekProgress(a).complete);
}

function renderCardSlice(list: AchievementDef[], start: number, end: number): string {
  return list.slice(start, end).map(a => cardHTML(a)).join('');
}

const ACH_SENTINEL_HTML = '<div class="ach-sentinel" id="achSentinel">↓ 下滑加载更多</div>';

/** 给已渲染卡片补挂「新解锁」bridge 标记（未渲染进 DOM 的 id 留在待标记集合，后续批次补挂）。 */
function markPendingBridgeCards(scope: ParentNode): void {
  if (!_achPendingBridge || !_achPendingBridge.size) return;
  const ids = [..._achPendingBridge];
  markBridgeNewCards(scope, ids);
  for (const id of ids) {
    if (scope.querySelector('.ach-card[data-ach-id="' + CSS.escape(id) + '"]')) _achPendingBridge.delete(id);
  }
}

/** L11 埋点：把「全部」列表滚到底（真实翻过每一批）。走既有 __ubEmitAchievement 通道，
 *  总开关关闭时该桥为空函数（零成本）；仅玩家亲手滚动触发，搜索态不触发。 */
function emitBookBottomOnce(): void {
  try { (window as any).__ubEmitAchievement?.('ach_book_bottom', {}); } catch (_e) { /* ignore */ }
}

/** 装配滚动续载观察器；无 IntersectionObserver 的老引擎回退整列渲染（与旧行为一致）。 */
function armAchBatchObserver(listEl: HTMLElement): void {
  const sentinel = listEl.querySelector('#achSentinel');
  if (!sentinel || typeof IntersectionObserver === 'undefined') {
    listEl.innerHTML = renderCardSlice(_achList, 0, _achList.length);
    _achRendered = _achList.length;
    markPendingBridgeCards(listEl);
    return;
  }
  _achListIO = new IntersectionObserver((entries) => {
    if (!entries.some(en => en.isIntersecting)) return;
    if (_achRendered >= _achList.length) { _achListIO?.disconnect(); return; }
    const end = Math.min(_achRendered + ACH_BATCH_SIZE, _achList.length);
    sentinel.insertAdjacentHTML('beforebegin', renderCardSlice(_achList, _achRendered, end));
    _achRendered = end;
    markPendingBridgeCards(listEl);
    if (end >= _achList.length) {
      sentinel.remove();
      _achListIO?.disconnect();
      // L11：「全部」列表真正翻到底（搜索态不算——那是找东西，不是通读）
      if (_achView === '全部' && !_achQuery) emitBookBottomOnce();
    }
  }, { root: listEl, rootMargin: '240px 0px' });
  _achListIO.observe(sentinel);
}

/** 近期时间轴（F34）：按现实日期分组（今天/昨天/更早），条目带稀有度色条。 */
function renderRecent(): string {
  const log = getBook().log.slice().sort((x, y) => timeSortKey(x.ts) < timeSortKey(y.ts) ? 1 : -1);
  const recent = log.slice(0, RECENT_COUNT);
  if (recent.length === 0) return '<div class="ach-empty">还没有记录呢。去折腾点什么吧——姐姐的笔早就准备好了。</div>';
  let today = ''; let yesterday = '';
  try {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const y = new Date(d.getTime() - 86400000);
    yesterday = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
  } catch (_e) { /* ignore */ }
  // 先给每条定组（一次遍历），再按组分段输出（组内条数随首条一起算，避免逐组重复过滤）
  const rows = recent.map(e => {
    const day = (e.ts || '').slice(0, 10);
    const group = day === today ? '今天' : day === yesterday ? '昨天' : '更早';
    return { e, group };
  });
  let html = '';
  let lastGroup = '';
  for (let i = 0; i < rows.length; i++) {
    const { e, group } = rows[i];
    if (group !== lastGroup) {
      let count = 0;
      for (let j = i; j < rows.length && rows[j].group === group; j++) count++;
      html += '<div class="ach-group">' + group + ' · ' + count + ' 条</div>';
      lastGroup = group;
    }
    const def = getAchievement(e.id);
    const rar = def && !def.hidden ? ' ach-r' + rarityOf(def) : '';
    const intro = def ? def.intro : '';
    const card = e.card || '';
    const info = card
      ? ubIcon('check') + ' 解锁自 ' + esc(card) + ' · ' + esc(e.ts || '—')
      : ubIcon('check') + ' 解锁 · ' + esc(e.ts || '—');
    html += '<div class="ach-tl-item' + rar + '">'
      + '<div class="ach-tl-name">✦ ' + esc(e.name)
      + (def && !def.hidden ? '<span class="ach-rar r' + rarityOf(def) + '">' + RARITY_LABEL[rarityOf(def)] + '</span>' : '')
      + '</div>'
      + (intro ? '<div class="ach-tl-intro">' + esc(intro) + '</div>' : '')
      + '<div class="ach-tl-info">' + info + '</div>'
      + '</div>';
  }
  return html;
}

function markBridgeNewCards(root: ParentNode, ids: readonly string[]): void {
  const bridgePanel = root.querySelector('.ach-theme-bridge');
  if (!bridgePanel) return;
  for (const id of ids) {
    const card = bridgePanel.querySelector('.ach-card[data-ach-id="' + CSS.escape(id) + '"]');
    if (!card) continue;
    card.classList.add('ach-bridge-new');
    card.addEventListener('animationend', () => card.classList.remove('ach-bridge-new'), { once: true });
  }
}

// ===== 统计条（U19 点数/今日 + L12 段位单一来源）=====
// 两个口径刻意分开，且各自内部自洽（第九轮落定）：
//   ① 条数「N/M」= **全部可见条目**（含段位勋章）——与「全部」分类明细行的 N/M 同源，两处数字必然一致；
//   ② 分数与段位 = **核心成就**（core/achievement-tier.ts，排除内部条目与段位勋章）——段位分母不受勋章影响（防自循环）。
function statHTML(): string {
  const snap = computeTierSnapshot();
  let visibleTotal = 0;
  let visibleGot = 0;
  for (const a of getAchievements()) {
    if (a.id.startsWith('_')) continue;
    visibleTotal++;
    if (isUnlocked(a.id)) visibleGot++;
  }
  const today = countTodayUnlocks();
  let tierInner = '';
  if (snap.totalPoints > 0) {
    tierInner = '<span class="ach-tier-label">第' + (snap.tier + 1) + '档 · ' + TIER_NAMES[snap.tier] + '</span>'
      + '<span class="ach-tier-bar"><span class="ach-tier-bar-fill" style="width:' + snap.tierPct + '%;"></span></span>'
      + '<span class="ach-tier-pct">' + snap.tierPct + '%</span>';
  }
  return '<div class="ach-stat">'
    + '<span class="ach-stat-num">' + ubIcon('medal') + ' ' + visibleGot + '/' + visibleTotal + '</span>'
    + '<span class="ach-stat-pts">· ' + snap.unlockedPoints + ' / ' + snap.totalPoints + ' 分</span>'
    + (today > 0 ? '<span class="ach-stat-today">今日 +' + today + '</span>' : '')
    + tierInner
    + '</div>';
}

// ===== 分类标签（F34：进度细条 + 全量计数 + 当前分类明细行）=====
/** 面板打开期内复用同一份分类统计（开面板/解锁后失效重建），避免标签与明细行各算一遍。 */
let _tabStatsMemo: Map<string, { got: number; total: number }> | null = null;

function tabStats(): Map<string, { got: number; total: number }> {
  if (_tabStatsMemo) return _tabStatsMemo;
  const out = new Map<string, { got: number; total: number }>();
  for (const t of ['全部', '养成', '剧情', '收集', '功能', '纪事', '称号', '隐藏']) {
    const list = visibleAchievements(t);
    let got = 0;
    for (const a of list) if (isUnlocked(a.id)) got++;
    out.set(t, { got, total: list.length });
  }
  _tabStatsMemo = out;
  return out;
}

function tabsButtonsHTML(active: string): string {
  const tabs = ['近期', '全部', '养成', '剧情', '收集', '功能', '纪事', '称号', '隐藏'];
  const stats = tabStats();
  let html = '';
  for (const t of tabs) {
    const s = stats.get(t);
    const pct = s && s.total > 0 ? Math.round((s.got / s.total) * 100) : 0;
    const full = !!s && s.total > 0 && s.got >= s.total;
    html += '<button class="ach-tab" data-tab="' + t + '"' + (t === active ? ' data-active="1"' : '') + (full ? ' data-full="1"' : '') + '>'
      + (full ? '✦ ' : '') + t
      + (s ? '<span class="ach-tab-bar"><i style="width:' + pct + '%"></i></span>' : '')
      + '</button>';
  }
  return html;
}

function tabsHTML(active: string): string {
  return '<div class="ach-tabs">' + tabsButtonsHTML(active) + '</div>'
    + '<div class="ach-tab-detail" id="achTabDetail">' + tabDetailHTML(active) + '</div>';
}

/** 当前分类明细行（精确数字；搜索态显示命中数）。 */
function tabDetailHTML(active: string): string {
  if (_achQuery) {
    const n = _achList.length;
    return '<span>搜索「' + esc(_achQuery) + '」· 找到 <b>' + n + '</b> 条</span><span>清空即可回到分类</span>';
  }
  if (active === '近期') return '<span>最近 ' + RECENT_COUNT + ' 条解锁记录</span><span>按最新在前</span>';
  const s = tabStats().get(active);
  if (!s) return '';
  return '<span>' + esc(active) + ' · 已解锁 <b>' + s.got + '/' + s.total + '</b></span><span>' + (active === '全部' ? '按编目顺序' : '该分类条目') + '</span>';
}

// ===== 面板主函数（6 步骨架）=====
export function showAchievementPopup(style: StyleType): void {
  // O39(第十一轮)：开面板点火目录装载（启动早已点火，此处为兜底——极端时序下目录
  // 未就绪则 getAchievements 返回空集，下一帧列表就位；不引入 async 签名变化）
  void ensureAchievementCatalog();
  injectCss();
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';

  // 确保 store 已加载
  getBook();
  // F21：新开面板重置分批状态（旧观察器断开、待标记集合清空、搜索态清空）
  _achListIO?.disconnect();
  _achListIO = null;
  _achPendingBridge = null;
  _achQuery = '';
  _tabStatsMemo = null;
  if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }

  let html = '<div class="panel-popup ach-popup ach-theme-' + style + ' ub-popup--l'
    + (style === 'bridge' ? ' bridge-window bridge-module-achievements' : '') + '">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">成就簿'
    + '<span class="ach-greet">' + esc(greetingText()) + '</span>'
    + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">';
  html += statHTML();
  // F34 搜索框（防剧透：不搜隐藏成就与趣评）
  html += '<div class="ach-search">' + ubIcon('search')
    + '<input id="achSearch" type="text" autocomplete="off" placeholder="找成就：名字或条件…" aria-label="搜索成就">'
    + '<span class="ach-search-clear" id="achSearchClear" role="button" tabindex="0" aria-label="清空搜索">×</span></div>';
  html += tabsHTML('全部');
  // F21：列表容器留空，open 后按批填充（首屏 ACH_BATCH_SIZE 张）
  html += '<div class="ach-list" id="achList"></div>';
  html += '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');

  // L11 彩蛋埋点：玩家亲手打开成就簿（含当天/季节窗口计数；总开关关闭时桥为空函数零成本）
  try {
    const w = window as any;
    w.__ubEmitAchievement?.('ach_book_open', {});
    w.__ubEmitAchievement?.('action-on-date', { action: 'ach_book_open' });
  } catch (_e) { /* ignore */ }

  // 分批挂载：先渲染首屏；C2 命中时解锁后再重渲首屏（卡片以已解锁态出现），bridge 标记跨批次补挂
  const listEl = overlay.querySelector('#achList') as HTMLElement | null;
  const detailEl = overlay.querySelector('#achTabDetail') as HTMLElement | null;
  const searchEl = overlay.querySelector('#achSearch') as HTMLInputElement | null;
  const mountView = (view: string): void => {
    _achListIO?.disconnect();
    _achListIO = null;
    _achView = view;
    _achList = currentAchievements(view);
    if (detailEl) detailEl.innerHTML = tabDetailHTML(view);
    if (!listEl) return;
    if (view === '近期' && !_achQuery) { listEl.innerHTML = renderRecent(); return; }
    if (_achList.length === 0) {
      listEl.innerHTML = _achQuery
        ? '<div class="ach-empty">没找到呢。是名字记错了，还是它还没发生呀？</div>'
        : '<div class="ach-empty">该分类暂无成就</div>';
      return;
    }
    _achRendered = Math.min(ACH_BATCH_SIZE, _achList.length);
    listEl.innerHTML = renderCardSlice(_achList, 0, _achRendered)
      + (_achList.length > _achRendered ? ACH_SENTINEL_HTML : '');
    markPendingBridgeCards(listEl);
    if (_achList.length > _achRendered) armAchBatchObserver(listEl);
  };
  mountView('全部');

  // C2 补通路：开面板时解锁本批命中时间类条件的成就 + 触发 _onUnlocks 庆祝（复用 scan 的解锁尾巴，
  //   庆祝 DOM 由 _onUnlocks 回调统一处理，不在此重复实现）。零新监听/零新定时器，纯内存一次性。
  const c2Collector = collectTimingCompletions('全部');
  if (c2Collector.length) {
    try { unlockDefinitions(c2Collector); } catch (e) { /* ignore */ }
    // C2: 解锁后重渲当前批次，消"刚解锁显示锁定态、切 tab 才刷新"的陈旧 DOM 瑕疵；
    // 未进首屏的命中成就先记入待标记集合，随续载批次补挂 bridge 标记
    _achPendingBridge = new Set(c2Collector.map(a => a.id));
    // 分类进度条/明细引用的解锁数已变化：失效重建后原样刷新标签区（点击委托在 overlay 上，无需重绑）
    _tabStatsMemo = null;
    const tabsEl = overlay.querySelector('.ach-tabs') as HTMLElement | null;
    if (tabsEl) tabsEl.innerHTML = tabsButtonsHTML('全部');
    mountView('全部');
  }

  // F34 搜索：输入去抖 120ms（仅键入期间存在一个 setTimeout，非常驻定时器）
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      if (_searchTimer) clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => {
        _searchTimer = null;
        const q = searchEl.value.trim();
        if (q === _achQuery) return;
        _achQuery = q;
        mountView(_achView);
      }, 120);
    });
  }

  overlay.onclick = function (e) {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') {
      if (guardGhostClick()) return;
      closePanelOverlay(overlay);
      return;
    }
    if ((e.target as HTMLElement).closest('#achSearchClear')) {
      const input = overlay.querySelector('#achSearch') as HTMLInputElement | null;
      if (input) input.value = '';
      if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }
      if (_achQuery) { _achQuery = ''; mountView(_achView); }
      return;
    }
    const tab = (e.target as HTMLElement).closest('.ach-tab') as HTMLElement | null;
    if (tab) {
      const v = tab.dataset.tab || '全部';
      overlay.querySelectorAll('.ach-tab').forEach(el => el.removeAttribute('data-active'));
      tab.setAttribute('data-active', '1');
      // 点分类 = 退出搜索（可预期：搜索框清空，回到该分类）
      if (_achQuery) {
        _achQuery = '';
        if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }
        const input = overlay.querySelector('#achSearch') as HTMLInputElement | null;
        if (input) input.value = '';
      }
      mountView(v);
    }
  };
}

// ===== 解锁即时反馈：自建 4 档通知卡片（替换原生 toastr）=====
// r3 传说大卡（金光粒子+边框流转）/ r2 史诗 / r1 罕见 / r0 常见；全档趣评全显、点击关闭、r3/r2 跳转成就簿。
// 详见 docs/notification-system/04-需求与设计.md §三 + renderers/achievement-notify.ts。

/** 引擎解锁回调入口。entries = 本批新解锁（已含 name/cat/ts）。
 * 自建通知卡片（≥5 合并汇总）；父文档不可见时跳过（解锁记录已由 unlockBatch 写入 book.log）。
 * 解锁瞬间触发（低频），不进扫描循环。 */
export function onAchievementUnlocks(entries: LogEntry[]): void {
  if (!entries || entries.length === 0) return;
  // 守卫：父文档不可见（离屏/切后台）→ 跳过通知，解锁记录已由 unlockBatch 写入 book.log。
  let parentHidden = false;
  try {
    const pd = (window as any).parent;
    parentHidden = pd && pd.document ? pd.document.hidden : document.hidden;
  } catch (e) { parentHidden = document.hidden; }
  if (parentHidden) return;

  injectCss();
  markBridgeNewCards(document, entries.map(e => e.id));
  // 通知美化：自建 4 档卡片替换 toastr。同批 ≥5 合并汇总、全档点击关闭、r3/r2「成就簿→」跳转、趣评全显。
  // 跳转回调读实时主题（用户可能在解锁后切主题再点跳转）。
  const style = getConfig().style;
  showAchievementNotify(entries, style, () => showAchievementPopup(getConfig().style));
}

// ===== 引用 popup-manager 的公共弹窗辅助（与其保持一致的行为）=====
// markPopupShown / guardGhostClick / closePanelOverlay 统一由 html-builder 提供（无循环依赖）。
