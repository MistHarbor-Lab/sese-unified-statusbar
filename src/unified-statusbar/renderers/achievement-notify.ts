// ===== 成就通知美化 · 自建 4 档组件（ACH01/ACH02）=====
// 详见 docs/notification-system/04-需求与设计.md §三
//
// 职责：替换 onAchievementUnlocks 中的 toastr 调用——按稀有度 r3/r2/r1/r0 自建 4 档卡片，
//   尺寸/配色/入场动画/信息密度全维度差异；全档趣评全显、点击关闭（无自动消失）；r3/r2「成就簿→」跳转；
//   同批 ≥5 合并为最高档汇总卡；6 主题风格微调；r3 金光粒子（CSS keyframes）+ 边框环境金光流转。
// 挂载点：parent.document（规避 iframe fixed 被 SillyTavern transform 压扁的坑）。
// 性能：仅解锁瞬间触发（低频），不进扫描循环；纯 CSS 动画，无 JS 粒子系统、无轮询；
//   通知关闭即清 DOM；<style> 注入一次复用。深色免判定：卡片自带深色底，亮暗通吃。
//
// 与 achievement-ui.ts 解耦：不 import showAchievementPopup（避免循环依赖），跳转通过 onGoto 回调注入。

import { ubIcon } from '../core/icons';
import { ensureStyleOnce } from './style-once';
import { getAchievement } from '../core/achievement-catalog';
import { RARITY_LABEL, RARITY_COLOR, rarityOf, rarityRgba } from '../core/achievement-rarity';
import { computeTierSnapshot } from '../core/achievement-tier';
import type { LogEntry } from '../core/achievement-types';
import { type StyleType } from '../core/constants';
import { getConfig, type NotifyAlign } from '../core/config-store';
import { escapeHtml as _esc } from '../core/html-escape';

/**
 * 决定成就卡片栈的水平位置。
 * 美化模式 → 用 notifyAlign；原版模式 → 默认居中（忽略 notifyAlign）。
 * 抽成纯函数便于测试，且与 notify-base 的 toastr 位置逻辑解耦。
 */
export function resolveAchievementAlign(notifyEffect: string | undefined, notifyAlign: NotifyAlign): NotifyAlign {
  return notifyEffect === 'original' ? 'center' : notifyAlign;
}

// 字体栈（notify CSS 挂父文档，iframe 的 --serif/--sans 变量不可达，硬编码）
const _SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif';
const _SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif';

function _parentDoc(): Document {
  try { if ((window as any).parent && (window.parent as any).document) return (window.parent as any).document; } catch { /* cross-origin */ }
  return document;
}

// ===== 稀有度 → 显示映射（第九轮 U19）=====
// 名称/档位/色板统一走 core/achievement-rarity.ts（与成就簿卡片同一份定义）；
// 下面 CSS 里的主色与半透明主色也由它拼出，只保留装饰性渐变浅色（如 #ffe580）就地表意。
function _rarityOf(entry: LogEntry): number {
  return rarityOf(getAchievement(entry.id));
}

// ===== CSS（复刻 mockup §1/§4/§5，类名 ub-an- 前缀，scope #ub-ach-notify-stack）=====
const ACHIEVEMENT_NOTIFY_CSS = `
#ub-ach-notify-stack{
  position:fixed; top:12px; z-index:100002;
  display:flex; flex-direction:column; gap:10px;
  pointer-events:none;
  font-family:${_SANS};
}
#ub-ach-notify-stack.ub-an-align-left{left:12px;right:auto;align-items:flex-start;}
#ub-ach-notify-stack.ub-an-align-center{left:50%;right:auto;transform:translateX(-50%);align-items:center;}
#ub-ach-notify-stack.ub-an-align-right{right:12px;left:auto;align-items:flex-end;}
#ub-ach-notify-stack .ub-an-card{pointer-events:auto;}

/* ===== 卡片基底 ===== */
.ub-an-card{position:relative;border-radius:14px;padding:18px 20px;font-family:${_SANS};overflow:hidden;cursor:pointer;transition:filter .18s ease,box-shadow .18s ease;}
.ub-an-card:hover{filter:brightness(1.06);}
.ub-an-card .ub-an-close{position:absolute;top:10px;right:12px;width:20px;height:20px;border:none;background:transparent;color:currentColor;opacity:.45;cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;border-radius:5px;z-index:3;padding:0;}
.ub-an-card .ub-an-close:hover{opacity:1;background:rgba(255,255,255,.1);}
.ub-an-card .ub-an-head .ub-an-cup,.ub-an-card .ub-an-name .ub-an-cup{margin-right:7px;}

/* ===== r3 传说 ===== */
.ub-an-card.r3{
  width:320px;
  background:linear-gradient(160deg,#2a200a 0%,#15110a 60%,#100c06 100%);
  box-shadow:0 0 0 1px ${rarityRgba(3,.35)},0 4px 18px rgba(0,0,0,.4),0 0 26px rgba(255,180,0,.42),0 0 64px rgba(255,150,0,.22),inset 0 1px 0 rgba(255,225,150,.12);
  color:#fdf6e3;
}
.ub-an-card.r3::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;background:linear-gradient(135deg,#ffe580,${RARITY_COLOR[3]} 30%,#ffa500 70%,#ffd84d);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;}
.ub-an-card.r3::after{content:"";position:absolute;left:24px;right:24px;top:0;height:1px;background:linear-gradient(90deg,transparent,${rarityRgba(3,.7)},transparent);}
.ub-an-card.r3:hover{box-shadow:0 0 0 1px ${rarityRgba(3,.45)},0 5px 20px rgba(0,0,0,.45),0 0 34px rgba(255,180,0,.5),0 0 76px rgba(255,150,0,.28),inset 0 1px 0 rgba(255,225,150,.16);}
.ub-an-card.r3 .ub-an-head{font-family:${_SERIF};font-size:13.5px;letter-spacing:.28em;font-weight:600;margin-bottom:12px;background:linear-gradient(95deg,#ffe580,${RARITY_COLOR[3]},#ffb347);-webkit-background-clip:text;background-clip:text;color:transparent;}
.ub-an-card.r3 .ub-an-name{font-family:${_SERIF};font-size:24px;font-weight:700;line-height:1.25;margin-bottom:10px;color:#fdf6e3;}
.ub-an-card.r3 .ub-an-quote{font-size:13.5px;line-height:1.62;color:#e6d6ac;margin-bottom:12px;}
.ub-an-card.r3 .ub-an-quote .ub-an-qm{color:${rarityRgba(3,.55)};}
.ub-an-card.r3 .ub-an-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.ub-an-card.r3 .ub-an-cat{font-size:12px;letter-spacing:.14em;color:#b5a374;}
.ub-an-card.r3 .ub-an-rating{font-size:13px;letter-spacing:.08em;color:#ffd84d;}
.ub-an-card.r3 .ub-an-her{font-family:${_SERIF};font-size:11.5px;color:rgba(230,214,172,.7);margin-top:10px;letter-spacing:.1em;}
.ub-an-card.r3 .ub-an-goto{position:absolute;right:14px;bottom:12px;font-size:11.5px;color:rgba(255,216,77,.75);letter-spacing:.06em;cursor:pointer;z-index:3;padding:2px 4px;border-radius:4px;}
.ub-an-card.r3 .ub-an-goto:hover{color:#ffd84d;background:${rarityRgba(3,.12)};}

/* ===== r2 史诗 ===== */
.ub-an-card.r2{
  width:280px;
  background:linear-gradient(160deg,#1f1535 0%,#140c22 100%);
  box-shadow:0 0 0 1px ${rarityRgba(2,.3)},0 4px 14px rgba(0,0,0,.36),0 0 20px ${rarityRgba(2,.4)},inset 0 1px 0 rgba(200,150,255,.1);
  color:#f2ecfa;
}
.ub-an-card.r2::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;background:linear-gradient(135deg,#c084fc,${RARITY_COLOR[2]} 45%,#5a189a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;}
.ub-an-card.r2:hover{box-shadow:0 0 0 1px ${rarityRgba(2,.4)},0 5px 16px rgba(0,0,0,.4),0 0 26px ${rarityRgba(2,.5)};}
.ub-an-card.r2 .ub-an-head{font-size:16px;font-weight:600;margin-bottom:8px;}
.ub-an-card.r2 .ub-an-head .ub-an-tag{background:linear-gradient(95deg,#c084fc,${RARITY_COLOR[2]});-webkit-background-clip:text;background-clip:text;color:transparent;margin-right:4px;}
.ub-an-card.r2 .ub-an-quote{font-size:13px;line-height:1.62;color:#cfc3e0;margin-bottom:9px;}
.ub-an-card.r2 .ub-an-quote .ub-an-qm{color:${rarityRgba(2,.6)};}
.ub-an-card.r2 .ub-an-cat{font-size:11.5px;letter-spacing:.14em;color:#a896c4;}
/* 段位勋章落款行较长，避开右下角「成就簿 →」跳转热区 */
.ub-an-card.r2 .ub-an-cat.ub-an-tier-cat{padding-right:64px;}
.ub-an-card.r2 .ub-an-goto{position:absolute;right:12px;bottom:10px;font-size:11.5px;color:rgba(192,132,252,.75);letter-spacing:.06em;cursor:pointer;z-index:3;padding:2px 4px;border-radius:4px;}
.ub-an-card.r2 .ub-an-goto:hover{color:#c084fc;background:${rarityRgba(2,.14)};}
.ub-an-card.r2 .ub-an-close{color:#cfc3e0;}

/* ===== r1 罕见 ===== */
.ub-an-card.r1{
  width:260px;padding:14px 16px;border-radius:10px;
  background:linear-gradient(160deg,#131a2b 0%,#0c111c 100%);
  box-shadow:0 0 0 1px ${rarityRgba(1,.4)},0 3px 12px rgba(0,0,0,.34),0 0 14px ${rarityRgba(1,.18)};
  color:#e6ecf7;
}
.ub-an-card.r1::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:2px;background:${RARITY_COLOR[1]};}
.ub-an-card.r1 .ub-an-head{font-size:14.5px;font-weight:600;margin-bottom:5px;}
.ub-an-card.r1 .ub-an-head .ub-an-tag{color:${RARITY_COLOR[1]};margin-right:4px;}
.ub-an-card.r1 .ub-an-quote{font-size:12px;line-height:1.6;color:#a9b6cc;}
.ub-an-card.r1 .ub-an-quote .ub-an-qm{color:${rarityRgba(1,.55)};}
.ub-an-card.r1 .ub-an-close{color:#a9b6cc;top:8px;right:10px;}

/* ===== r0 常见 ===== */
.ub-an-card.r0{
  width:220px;padding:11px 14px;border-radius:8px;
  background:#1c1c22;box-shadow:0 0 0 1px ${rarityRgba(0,.28)},0 2px 8px rgba(0,0,0,.3);
  color:#c8c8d0;
}
.ub-an-card.r0:hover{filter:brightness(1.08);box-shadow:0 0 0 1px ${rarityRgba(0,.4)},0 3px 10px rgba(0,0,0,.36);}
.ub-an-card.r0 .ub-an-head{font-size:13.5px;font-weight:500;margin-bottom:4px;color:#d2d2da;}
.ub-an-card.r0 .ub-an-head .ub-an-tag{color:${RARITY_COLOR[0]};margin-right:6px;}
.ub-an-card.r0 .ub-an-quote{font-size:11.5px;line-height:1.55;color:#888894;}
.ub-an-card.r0 .ub-an-quote .ub-an-qm{color:${rarityRgba(0,.5)};}
.ub-an-card.r0 .ub-an-close{color:#888894;top:7px;right:9px;width:16px;height:16px;font-size:13px;}

/* ===== 汇总卡（同批 ≥5，按本批最高 rarity 定档）===== */
.ub-an-card.ub-an-summary{width:300px;padding:16px 18px;}
.ub-an-card.ub-an-summary .ub-an-s-title{font-size:15.5px;font-weight:600;margin-bottom:4px;}
.ub-an-card.ub-an-summary .ub-an-s-title .ub-an-tag{background:linear-gradient(95deg,#c084fc,${RARITY_COLOR[2]});-webkit-background-clip:text;background-clip:text;color:transparent;margin-right:4px;}
.ub-an-card.ub-an-summary .ub-an-s-sub{font-size:12px;color:#a896c4;letter-spacing:.1em;margin-bottom:10px;}
.ub-an-card.ub-an-summary ul{list-style:none;padding:0;margin:0;}
.ub-an-card.ub-an-summary li{font-size:12.5px;line-height:1.55;color:#cfc3e0;padding:5px 0;border-top:1px solid ${rarityRgba(2,.15)};}
.ub-an-card.ub-an-summary li:first-child{border-top:none;}
.ub-an-card.ub-an-summary li b{color:#f2ecfa;font-weight:600;margin-right:4px;}
.ub-an-card.ub-an-summary li .ub-an-qm{color:${rarityRgba(2,.55)};}
/* 汇总卡按最高 rarity 取色：r3 金 / r2 紫（默认）/ r1 蓝 / r0 灰，复用各档已定义配色 */
.ub-an-card.ub-an-summary.r3 .ub-an-s-title .ub-an-tag{background:linear-gradient(95deg,#ffe580,${RARITY_COLOR[3]},#ffb347);-webkit-background-clip:text;background-clip:text;color:transparent;}
.ub-an-card.ub-an-summary.r3 .ub-an-s-sub{color:#b5a374;}
.ub-an-card.ub-an-summary.r3 li{color:#e6d6ac;border-top-color:${rarityRgba(3,.15)};}
.ub-an-card.ub-an-summary.r3 li b{color:#fdf6e3;}
.ub-an-card.ub-an-summary.r1 .ub-an-s-sub{color:#a9b6cc;}
.ub-an-card.ub-an-summary.r1 li{color:#a9b6cc;border-top-color:${rarityRgba(1,.15)};}
.ub-an-card.ub-an-summary.r1 li b{color:#e6ecf7;}
.ub-an-card.ub-an-summary.r0 .ub-an-s-sub{color:#888894;}
.ub-an-card.ub-an-summary.r0 li{color:#888894;border-top-color:${rarityRgba(0,.15)};}
.ub-an-card.ub-an-summary.r0 li b{color:#d2d2da;}

/* ===== r3 粒子 & 边框金光流转 & 入场 ===== */
.ub-an-particles{position:absolute;left:50%;top:42%;width:0;height:0;pointer-events:none;z-index:2;}
.ub-an-particles .ub-an-pt{position:absolute;left:0;top:0;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff3c0,${RARITY_COLOR[3]} 40%,rgba(255,165,0,0) 75%);opacity:0;}
.ub-an-card.r3.ub-an-burst .ub-an-particles .ub-an-pt{animation:ub-an-burst 2s cubic-bezier(.18,.7,.3,1) forwards;}
@keyframes ub-an-burst{0%{transform:translate(0,0) scale(.2);opacity:0;}12%{opacity:1;}100%{transform:translate(var(--tx),var(--ty)) scale(1);opacity:0;}}
.ub-an-card.r3 .ub-an-shimmer{position:absolute;inset:-2px;border-radius:inherit;pointer-events:none;z-index:0;background:conic-gradient(from 0deg,transparent 0deg,${rarityRgba(3,.25)} 40deg,transparent 80deg,transparent 360deg);animation:ub-an-spin 6s linear infinite;mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));}
@keyframes ub-an-spin{to{transform:rotate(360deg);}}
.ub-an-card.r3.ub-an-burst{animation:ub-an-pop .5s cubic-bezier(.2,.8,.3,1) both;}
@keyframes ub-an-pop{0%{transform:scale(.82);opacity:0;}60%{opacity:1;}100%{transform:scale(1);opacity:1;}}
.ub-an-card.r2.ub-an-enter{animation:ub-an-slide-y .45s ease-out both;}
@keyframes ub-an-slide-y{from{transform:translateY(-14px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.ub-an-card.r1.ub-an-enter{animation:ub-an-slide-x .4s ease-out both;}
@keyframes ub-an-slide-x{from{transform:translateX(22px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.ub-an-card.r0.ub-an-enter{animation:ub-an-fadein .35s ease-out both;}
.ub-an-card.ub-an-summary.ub-an-enter{animation:ub-an-slide-y .45s ease-out both;}
@keyframes ub-an-fadein{from{opacity:0;}to{opacity:1;}}

/* ===== r3 6 主题风格微调（稀有度配色跨主题统一，主题只改风格）===== */
.ub-an-theme-ancient .ub-an-card.r3{background:linear-gradient(160deg,#2a1410 0%,#1a0e0a 100%);font-family:${_SERIF};border-radius:10px;}
.ub-an-theme-ancient .ub-an-card.r3::before{background:linear-gradient(135deg,#d4a017,#b8860b 45%,#8b6914);}
.ub-an-theme-ancient .ub-an-card.r3::after{background:linear-gradient(90deg,transparent,rgba(212,160,23,.6),transparent);}
.ub-an-theme-ancient .ub-an-card.r3 .ub-an-head{background:linear-gradient(95deg,#f0d080,#d4a017);-webkit-background-clip:text;background-clip:text;color:transparent;}
.ub-an-theme-flirtatious .ub-an-card.r3{border-radius:20px;background:linear-gradient(160deg,#2a1a35 0%,#1a1028 100%);box-shadow:0 0 0 1px ${rarityRgba(3,.3)},0 4px 18px rgba(0,0,0,.4),0 0 22px rgba(255,120,200,.3),0 0 40px rgba(255,165,0,.25);}
.ub-an-theme-flirtatious .ub-an-card.r3::before{background:linear-gradient(135deg,#ffd1ec,${RARITY_COLOR[3]} 50%,#ff8fcf);}
.ub-an-theme-minimal .ub-an-card.r3{background:rgba(20,18,12,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:8px;box-shadow:0 0 0 1px ${rarityRgba(3,.4)},0 4px 14px rgba(0,0,0,.34),0 0 18px rgba(255,180,0,.18);}
.ub-an-theme-minimal .ub-an-card.r3::before{background:linear-gradient(135deg,${rarityRgba(3,.6)},rgba(255,165,0,.3));}
.ub-an-theme-sweet .ub-an-card.r3{border-radius:18px;box-shadow:0 0 0 1px ${rarityRgba(3,.3)},0 6px 22px rgba(200,160,180,.18),0 0 22px rgba(255,181,201,.22),0 0 40px rgba(255,165,0,.2);}
.ub-an-theme-xianxia .ub-an-card.r3{box-shadow:0 0 0 1px ${rarityRgba(3,.3)},0 4px 18px rgba(0,0,0,.4),0 0 22px rgba(182,226,206,.28),0 0 48px rgba(255,165,0,.2);}
.ub-an-theme-xianxia .ub-an-card.r3::before{background:linear-gradient(135deg,#b6e2ce,${RARITY_COLOR[3]} 50%,#c8a850);}
.ub-an-theme-bridge .ub-an-card.r3{border-radius:6px;box-shadow:0 0 0 1px ${rarityRgba(3,.3)},0 4px 18px rgba(0,0,0,.4),0 0 22px rgba(119,229,224,.3),0 0 40px rgba(255,189,90,.2);}
.ub-an-theme-bridge .ub-an-card.r3::before{background:linear-gradient(135deg,#77e5e0,${RARITY_COLOR[3]} 60%,#ffbd5a);}
.ub-an-theme-bridge .ub-an-card.r3 .ub-an-shimmer{animation:none;opacity:.38;background:linear-gradient(120deg,transparent,rgba(119,229,224,.22),transparent);}
.ub-an-theme-ios .ub-an-card.r3{border-radius:18px;background:rgba(28,28,30,.78);backdrop-filter:blur(20px) saturate(1.8);-webkit-backdrop-filter:blur(20px) saturate(1.8);box-shadow:0 0 0 1px ${rarityRgba(3,.45)},0 12px 36px rgba(0,0,0,.32);}
.ub-an-theme-ios .ub-an-card.r3::before{background:linear-gradient(135deg,#ffe580,${RARITY_COLOR[3]} 55%,#ff9f0a);}
.ub-an-theme-ios .ub-an-card.r3 .ub-an-shimmer{animation-duration:8s;opacity:.3;}

@media (prefers-reduced-motion: reduce){
  .ub-an-card.r3 .ub-an-shimmer,.ub-an-card.r3.ub-an-burst,.ub-an-card.r3.ub-an-burst .ub-an-particles .ub-an-pt,
  .ub-an-card.r2.ub-an-enter,.ub-an-card.r1.ub-an-enter,.ub-an-card.r0.ub-an-enter,.ub-an-card.ub-an-summary.ub-an-enter{
    animation:none !important;
  }
}

/* ===== 移动端视口纪律 ===== */
@media (max-width: 599px){
  #ub-ach-notify-stack{width:calc(100% - 24px);box-sizing:border-box;}
  #ub-ach-notify-stack.ub-an-align-center{left:12px;right:12px;width:auto;transform:none;align-items:center;}
  #ub-ach-notify-stack .ub-an-card.r3{width:min(320px,100%);}
  #ub-ach-notify-stack .ub-an-card.r2,#ub-ach-notify-stack .ub-an-card.ub-an-summary{width:min(280px,100%);}
  #ub-ach-notify-stack .ub-an-card.r1{width:min(260px,100%);}
  #ub-ach-notify-stack .ub-an-card.r0{width:min(220px,100%);}
}
`;

// ===== CSS 注入（父文档 head，一次性）=====
let _achNotifyCssInjected = false;
function _injectAchNotifyCss(): void {
  if (_achNotifyCssInjected) return;
  const doc = _parentDoc();
  ensureStyleOnce('ub-ach-notify-css', ACHIEVEMENT_NOTIFY_CSS, doc); // U35：收编幂等注入（目标＝父文档）
  _achNotifyCssInjected = true;
}

// ===== 堆栈容器（父文档 body，惰性创建复用）=====
function _getStack(doc: Document, align: NotifyAlign): HTMLElement {
  let stack = doc.getElementById('ub-ach-notify-stack');
  if (!stack) {
    stack = doc.createElement('div');
    stack.id = 'ub-ach-notify-stack';
    doc.body.appendChild(stack);
  }
  // 更新对齐类（支持用户中途改对齐：新卡片按当前对齐；已存卡片也跟随）
  stack.classList.remove('ub-an-align-left', 'ub-an-align-center', 'ub-an-align-right');
  stack.classList.add('ub-an-align-' + align);
  // 主题微调类（r3 主题风格）
  stack.classList.remove('ub-an-theme-ancient', 'ub-an-theme-flirtatious', 'ub-an-theme-minimal', 'ub-an-theme-sweet', 'ub-an-theme-xianxia', 'ub-an-theme-bridge', 'ub-an-theme-ios');
  return stack;
}
function _applyThemeClass(stack: HTMLElement, style: StyleType): void {
  stack.classList.add('ub-an-theme-' + style);
}

// ===== r3 金光粒子（CSS keyframes，JS 只 seed 位置变量）=====
function _seedParticles(card: HTMLElement, n: number): void {
  const box = card.querySelector('.ub-an-particles') as HTMLElement | null;
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const p = card.ownerDocument.createElement('span');
    p.className = 'ub-an-pt';
    const ang = (Math.PI * 2 * i / n) + (Math.random() - 0.5) * 0.4;
    const dist = 60 + Math.random() * 50;
    const size = 3 + Math.random() * 4;
    p.style.setProperty('--tx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    p.style.setProperty('--ty', (Math.sin(ang) * dist).toFixed(1) + 'px');
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
    box.appendChild(p);
  }
}

// ===== 关闭单卡 =====
function _closeCard(card: HTMLElement): void {
  if (!card.isConnected) return;
  const stack = card.parentElement;
  card.remove();
  // 堆栈空了清容器（<style> 留作下次复用）
  if (stack && stack.id === 'ub-ach-notify-stack' && stack.childElementCount === 0) stack.remove();
}

// ===== 单条卡片 HTML（按 rarity 分档；主题由堆栈 ub-an-theme-<style> 作用域带，无需入参）=====
function _buildCard(entry: LogEntry, onGoto: () => void): HTMLElement {
  const doc = _parentDoc();
  const def = getAchievement(entry.id);
  const r = _rarityOf(entry);
  const name = def ? def.name : entry.name;
  const flavor = def ? def.趣评 : '';
  const cat = def ? def.cat : entry.cat;
  // L12 段位勋章：同一张稀有度卡，头部标签改「段位晋升」、落款给出档位与收藏度（零新视觉资产）
  const tierMedal = def && def.observe && def.observe.type === 'tier-at-least' ? def.observe.tier : 0;
  const tierCatText = tierMedal
    ? '— 段位 · 第 ' + tierMedal + ' 档 · 收藏度 ' + Math.round(computeTierSnapshot().completion * 100) + '%'
    : '— ' + _esc(cat);
  const tierTag = tierMedal ? '段位晋升' : '';
  const card = doc.createElement('div');
  card.className = 'ub-an-card r' + r + (r === 3 ? ' ub-an-burst' : ' ub-an-enter');
  // close 按钮（全档）
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'ub-an-close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.innerHTML = ubIcon('close');
  card.appendChild(closeBtn);

  if (r === 3) {
    // 传说：金渐变大卡 + 粒子 + 流转金光 + 仪式感头部
    const shimmer = doc.createElement('span');
    shimmer.className = 'ub-an-shimmer';
    card.appendChild(shimmer);
    const particles = doc.createElement('div');
    particles.className = 'ub-an-particles';
    card.appendChild(particles);
    card.insertAdjacentHTML('beforeend',
      '<div class="ub-an-head">✦ ✦ &nbsp;' + (tierTag || '传说成就') + '&nbsp; ✦ ✦</div>'
      + '<div class="ub-an-name"><span class="ub-an-cup">' + ubIcon('trophy') + '</span>' + _esc(name) + '</div>'
      + '<div class="ub-an-quote"><span class="ub-an-qm">«</span>' + _esc(flavor) + '<span class="ub-an-qm">»</span></div>'
      + '<div class="ub-an-meta"><span class="ub-an-cat">' + tierCatText + '</span><span class="ub-an-rating"><span class="ub-an-stars">★★★★★</span> &nbsp;' + (tierMedal ? '段位' : '传说') + '</span></div>'
      + '<div class="ub-an-her">— 她记</div>'
      + '<span class="ub-an-goto">成就簿 →</span>');
    _seedParticles(card, 14);
  } else if (r === 2) {
    card.insertAdjacentHTML('beforeend',
      '<div class="ub-an-head"><span class="ub-an-tag">★ ' + (tierTag || '史诗') + '</span> · <span class="ub-an-cup">' + ubIcon('trophy') + '</span>' + _esc(name) + '</div>'
      + '<div class="ub-an-quote"><span class="ub-an-qm">«</span>' + _esc(flavor) + '<span class="ub-an-qm">»</span></div>'
      + '<div class="ub-an-cat' + (tierMedal ? ' ub-an-tier-cat' : '') + '">' + tierCatText + '</div>'
      + '<span class="ub-an-goto">成就簿 →</span>');
  } else if (r === 1) {
    card.insertAdjacentHTML('beforeend',
      '<div class="ub-an-head"><span class="ub-an-tag">◆ ' + (tierTag || '罕见') + '</span> · <span class="ub-an-cup">' + ubIcon('trophy') + '</span>' + _esc(name) + '</div>'
      + '<div class="ub-an-quote"><span class="ub-an-qm">«</span>' + _esc(flavor) + '<span class="ub-an-qm">»</span></div>'
      + (tierMedal ? '<div class="ub-an-cat">' + tierCatText + '</div>' : ''));
  } else {
    card.insertAdjacentHTML('beforeend',
      '<div class="ub-an-head"><span class="ub-an-tag">' + (tierMedal ? '✦ ' + tierTag : ubIcon('check')) + '</span>' + _esc(name) + '</div>'
      + '<div class="ub-an-quote"><span class="ub-an-qm">«</span>' + _esc(flavor) + '<span class="ub-an-qm">»</span></div>'
      + (tierMedal ? '<div class="ub-an-cat">' + tierCatText + '</div>' : ''));
  }

  // 交互：点卡片关闭；关闭按钮 仅关闭；「成就簿→」跳转 + 关闭（r3/r2）
  card.addEventListener('click', function (e) {
    const t = e.target as HTMLElement;
    if (t.closest('.ub-an-close')) { e.stopPropagation(); _closeCard(card); return; }
    if (t.closest('.ub-an-goto')) { e.stopPropagation(); try { onGoto(); } catch (_) { /* ignore */ } _closeCard(card); return; }
    _closeCard(card);
  });
  return card;
}

// ===== 汇总卡（同批 ≥5，按最高 rarity 定档，趣评全列不截断；无跳转入口）=====
function _buildSummary(entries: LogEntry[], maxRarity: number): HTMLElement {
  const doc = _parentDoc();
  const card = doc.createElement('div');
  card.className = 'ub-an-card ub-an-summary r' + maxRarity + ' ub-an-enter';
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'ub-an-close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.innerHTML = ubIcon('close');
  card.appendChild(closeBtn);
  const tierLabel = RARITY_LABEL[maxRarity] || '常见';
  const tagPrefix = maxRarity === 3 ? '✦ 传说 ' : maxRarity === 2 ? '★ 史诗 ' : maxRarity === 1 ? '◆ 罕见 ' : ubIcon('check') + ' ';
  let liHtml = '';
  for (const e of entries) {
    const def = getAchievement(e.id);
    const nm = def ? def.name : e.name;
    const f = def ? def.趣评 : '';
    liHtml += '<li><b>' + _esc(nm) + '</b> <span class="ub-an-qm">«</span>' + _esc(f) + '<span class="ub-an-qm">»</span></li>';
  }
  card.insertAdjacentHTML('beforeend',
    '<div class="ub-an-s-title"><span class="ub-an-tag">' + tagPrefix + '</span>一次性解锁 ' + entries.length + ' 项成就</div>'
    + '<div class="ub-an-s-sub">— 本批最高稀有度 · ' + tierLabel + '</div>'
    + '<ul>' + liHtml + '</ul>');
  card.addEventListener('click', function (e) {
    const t = e.target as HTMLElement;
    if (t.closest('.ub-an-close')) { e.stopPropagation(); _closeCard(card); return; }
    _closeCard(card);
  });
  return card;
}

/**
 * 成就解锁通知入口（替换 onAchievementUnlocks 中的 toastr 调用）。
 * - 同批 ≥5：合并为最高档汇总卡（趣评全列不截断）。
 * - 否则：每条按各自 rarity 独立呈现，最新在顶。
 * - 全档点击关闭（无自动消失）；r3/r2「成就簿→」跳转（onGoto 回调，与关闭分离）。
 * @param entries 本批新解锁（已含 name/cat/ts）
 * @param style 当前主题（r3 风格微调）
 * @param onGoto 跳转成就簿回调（由 achievement-ui 注入，避免循环依赖）
 */
export function showAchievementNotify(entries: LogEntry[], style: StyleType, onGoto: () => void): void {
  if (!entries || entries.length === 0) return;
  _injectAchNotifyCss();
  const doc = _parentDoc();
  const _cfg = getConfig();
  const align = resolveAchievementAlign(_cfg.notifyEffect, _cfg.notifyAlign);
  const stack = _getStack(doc, align);
  _applyThemeClass(stack, style);

  const fragment = doc.createDocumentFragment();
  if (entries.length >= 5) {
    let maxRarity = 0;
    for (const e of entries) { const r = _rarityOf(e); if (r > maxRarity) maxRarity = r; }
    fragment.appendChild(_buildSummary(entries, maxRarity));
  } else {
    // 最新在顶：倒序插入（堆叠向下，第一条最新）
    for (let i = entries.length - 1; i >= 0; i--) {
      fragment.appendChild(_buildCard(entries[i], onGoto));
    }
  }
  // 插到堆栈顶部（最新在顶）
  stack.insertBefore(fragment, stack.firstChild);
}
