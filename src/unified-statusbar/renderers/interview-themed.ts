// ===== 大采访五主题档案渲染 =====

import type { StyleType } from '../core/constants';
import { getInitials } from '../core/data-manager';
import type { InterviewData, InterviewTurn } from '../core/interview-parser';
import { getCurrentPortraitPath } from '../core/portrait-system';
import { escapeHtmlAttr as esc } from '../core/html-escape';

function lines(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br>');
}

function avatarHtml(name: string, role: 'q' | 'a'): string {
  const path = getCurrentPortraitPath(name);
  if (path) return `<span class="itv-avatar itv-avatar-${role} itv-portrait"><img src="${esc(path)}" alt="${esc(name)}"></span>`;
  return `<span class="itv-avatar itv-avatar-${role}">${esc(getInitials(name) || name.slice(0, 1) || '?')}</span>`;
}

function rosterHtml(data: InterviewData, primaryInterviewee: string): string {
  const people = (names: string[], role: 'q' | 'a'): string => names.map(name => (
    `<span class="itv-person">${avatarHtml(name, role)}<span>${esc(name)}${role === 'a' && name === primaryInterviewee ? '<b class="itv-required">★</b>' : ''}</span></span>`
  )).join('');
  return `<section class="itv-roster">
    <div class="itv-roster-side"><span class="itv-roster-label">采访者</span>${people(data.interviewers, 'q')}</div>
    <span class="itv-roster-divider">×</span>
    <div class="itv-roster-side itv-roster-answer"><span class="itv-roster-label">被采访者</span>${people(data.interviewees, 'a')}</div>
  </section>`;
}

function dialogueHtml(turn: InterviewTurn): string {
  const answer = turn.type === 'answer';
  const role = answer ? 'a' : 'q';
  const side = answer ? 'right' : 'left';
  return `<article class="itv-turn itv-${side}">
    ${avatarHtml(turn.speaker || '?', role)}
    <div class="itv-turn-body">
      <div class="itv-speaker">${esc(turn.speaker || '匿名')}${turn.emotion ? `<span class="itv-emotion">${esc(turn.emotion)}</span>` : ''}</div>
      <div class="itv-bubble${answer ? ' itv-redactable' : ''}">${lines(turn.content)}</div>
    </div>
  </article>`;
}

function turnHtml(turn: InterviewTurn): string {
  if (turn.type === 'question' || turn.type === 'answer') return dialogueHtml(turn);
  if (turn.type === 'scene') return `<aside class="itv-scene"><span class="itv-block-label">SCENE</span>${lines(turn.content)}</aside>`;
  if (turn.type === 'sound') return `<aside class="itv-sound"><span>♪ ${lines(turn.content)}</span></aside>`;
  return `<aside class="itv-narration"><span class="itv-block-label">旁白</span>${lines(turn.content)}</aside>`;
}

function archiveHtml(data: InterviewData, primaryInterviewee: string, style: StyleType): string {
  const decorations = style === 'ancient'
    ? '<i class="itv-rod itv-rod-top"></i><i class="itv-rod itv-rod-bottom"></i><i class="itv-stamp">采<br>风</i>'
    : style === 'flirtatious'
      ? '<i class="itv-rec">● REC</i><i class="itv-scanline"></i><i class="itv-cursor">_</i>'
      : style === 'minimal'
        ? '<i class="itv-classified">CLASSIFIED</i><i class="itv-barcode">|||| ||| || |||||</i>'
        : style === 'sweet'
          ? '<i class="itv-ribbon">SECRET</i><i class="itv-wax">♥</i><i class="itv-lace"></i>'
          : style === 'bridge'
            ? '<i class="itv-bridge-status">REC / ARCHIVE</i><i class="itv-bridge-grid"></i><i class="itv-bridge-index">INT-LOG</i>'
            : style === 'ios'
              ? ''
              : '<i class="itv-mist itv-mist-a"></i><i class="itv-mist itv-mist-b"></i><i class="itv-stars">✦ · ✧ · ✦</i><i class="itv-jade-seal">问心</i>';

  return `<div class="itv-overlay itv-theme-${style}${style === 'bridge' ? ' bridge-window bridge-module-interview' : ''}">
    ${decorations}
    <header class="itv-cover">
      <span class="itv-kicker">${style === 'bridge' ? 'COMMS TRANSCRIPT / 通讯采访记录' : style === 'flirtatious' ? 'ON AIR / LIVE INTERVIEW' : style === 'minimal' ? 'CASE FILE / EYES ONLY' : style === 'sweet' ? 'PRIVATE LOVE LETTER' : style === 'xianxia' ? '天机玉简 · 问心实录' : style === 'ios' ? '采访实录 · VOICE MEMO' : '秘卷 · 艳史采风'}</span>
      <h2>${esc(data.title || '采访实录')}</h2>
      <div class="itv-subtitle">${esc(data.subtitle || '未编号')}</div>
      <p>${lines(data.scene || '现场记录')}</p>
      <time>${esc(data.date || '日期未记')}</time>
    </header>
    ${rosterHtml(data, primaryInterviewee)}
    <main class="itv-transcript">${data.turns.map(turnHtml).join('')}</main>
    <footer class="itv-epilogue"><span class="itv-epilogue-label">采访手记</span><p>${lines(data.epilogue || '本次采访至此收录。')}</p></footer>
  </div>`;
}

const SHARED_CSS = `
.itv-overlay{--itv-bg:#fbf7ef;--itv-card:#fffdf8;--itv-text:#2d241f;--itv-muted:#796b61;--itv-line:#d9c9b8;--itv-q:#96713d;--itv-a:#9f4239;position:relative;width:100%;min-height:100%;overflow:hidden;background:var(--itv-bg);color:var(--itv-text);font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",KaiTi,serif;line-height:1.65;isolation:isolate}
/* 主题类与 .itv-overlay 同元素（archiveHtml 输出 class="itv-overlay itv-theme-<style>"），
   后代选择器不匹配，须用复合选择器才生效；上条后代规则保留以兼容既有断言 */
.itv-theme-ancient .itv-overlay,.itv-theme-xianxia .itv-overlay{font-family:var(--ub-font-reading)}
.itv-theme-ancient.itv-overlay,.itv-theme-xianxia.itv-overlay{font-family:var(--ub-font-reading)}
.itv-cover{position:relative;padding:30px 56px 22px;text-align:center;border-bottom:1px solid var(--itv-line);background:color-mix(in srgb,var(--itv-card) 88%,transparent)}
.itv-kicker{display:block;margin-bottom:8px;color:var(--itv-muted);font-size:10px;letter-spacing:3px;text-transform:uppercase}.itv-cover h2{margin:0;font-size:28px;letter-spacing:5px}.itv-subtitle{margin-top:4px;color:var(--itv-q);font-size:12px;letter-spacing:3px}.itv-cover p{max-width:none;margin:14px auto 5px;color:var(--itv-muted);font-size:13px}.itv-cover time{font-size:10px;color:var(--itv-muted)}
.itv-roster{display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:center;padding:18px 56px;border-bottom:1px solid var(--itv-line);background:var(--itv-card)}.itv-roster-side{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.itv-roster-answer{justify-content:flex-end}.itv-roster-label{width:100%;color:var(--itv-muted);font-size:9px;letter-spacing:2px}.itv-roster-answer .itv-roster-label{text-align:right}.itv-roster-divider{color:var(--itv-line);font-size:20px}.itv-person{display:inline-flex;gap:9px;align-items:center;padding:4px 12px 4px 4px;border:1px solid var(--itv-line);border-radius:999px;font-size:13px;background:var(--itv-bg)}.itv-required{color:var(--itv-a);margin-left:2px}
.itv-avatar{display:inline-flex;flex:0 0 54px;width:54px;height:54px;align-items:center;justify-content:center;border:1px solid var(--itv-q);border-radius:50%;overflow:hidden;background:color-mix(in srgb,var(--itv-q) 12%,var(--itv-card));color:var(--itv-q);font-size:19px;font-weight:700}.itv-avatar-a{border-color:var(--itv-a);color:var(--itv-a);background:color-mix(in srgb,var(--itv-a) 12%,var(--itv-card))}.itv-avatar img{width:100%;height:100%;object-fit:cover}.itv-roster .itv-avatar{flex-basis:46px;width:46px;height:46px;font-size:16px}
.itv-transcript{max-width:none;margin:0;padding:30px 56px 44px}.itv-turn{display:flex;gap:16px;align-items:flex-start;margin:22px 0}.itv-turn.itv-right{flex-direction:row-reverse}.itv-turn-body{max-width:min(74%,760px)}.itv-right .itv-turn-body{text-align:right}.itv-speaker{margin:0 8px 4px;color:var(--itv-muted);font-size:10px;letter-spacing:1px}.itv-emotion{display:inline-block;margin-left:7px;padding:0 6px;border:1px solid var(--itv-line);border-radius:999px;color:var(--itv-q);font-size:9px}.itv-right .itv-emotion{color:var(--itv-a)}.itv-bubble{position:relative;padding:11px 15px;border:1px solid color-mix(in srgb,var(--itv-q) 60%,var(--itv-line));border-radius:3px 15px 15px 15px;background:var(--itv-card);box-shadow:0 4px 14px rgba(50,30,20,.06);text-align:left;font-size:14px}.itv-right .itv-bubble{border-color:color-mix(in srgb,var(--itv-a) 60%,var(--itv-line));border-radius:15px 3px 15px 15px}
.itv-narration,.itv-scene{position:relative;margin:22px 56px;padding:12px 18px;text-align:center;color:var(--itv-muted);font-size:12.5px}.itv-narration{border-top:1px solid var(--itv-line);border-bottom:1px solid var(--itv-line);font-style:italic}.itv-scene{border-left:3px solid var(--itv-q);background:color-mix(in srgb,var(--itv-q) 7%,var(--itv-card));text-align:left}.itv-block-label{display:block;margin-bottom:4px;color:var(--itv-q);font-size:8px;letter-spacing:3px;font-style:normal}.itv-sound{text-align:center;margin:18px 56px}.itv-sound span{display:inline-block;padding:4px 13px;border-radius:999px;background:color-mix(in srgb,var(--itv-a) 9%,var(--itv-card));color:var(--itv-a);font-size:11px;font-style:italic}
.itv-epilogue{position:relative;margin:0 56px 30px;padding:18px 22px;border:1px solid var(--itv-line);background:var(--itv-card)}.itv-epilogue-label{color:var(--itv-a);font-size:10px;letter-spacing:3px}.itv-epilogue p{margin:7px 0 0;font-size:12px}.itv-rod,.itv-stamp,.itv-rec,.itv-scanline,.itv-cursor,.itv-classified,.itv-barcode,.itv-ribbon,.itv-wax,.itv-lace,.itv-mist,.itv-stars,.itv-jade-seal{pointer-events:none;position:absolute;z-index:2}
.panel-overlay.dark .itv-overlay,.panel-overlay .dark .itv-overlay,body.dark-mode .itv-overlay{--itv-bg:#181513;--itv-card:#221e1b;--itv-text:#eee5da;--itv-muted:#ad9f92;--itv-line:#4a4038}
@media(max-width:600px){.itv-cover{padding:24px 18px 18px}.itv-cover h2{font-size:22px}.itv-roster{grid-template-columns:1fr;padding:14px 18px}.itv-roster-divider{display:none}.itv-roster-answer{justify-content:flex-start}.itv-roster-answer .itv-roster-label{text-align:left}.itv-person{padding:3px 10px 3px 3px;font-size:12px;gap:7px}.itv-transcript{padding:20px 16px 28px}.itv-turn-body{max-width:84%}.itv-avatar{flex-basis:40px;width:40px;height:40px;font-size:14px}.itv-roster .itv-avatar{flex-basis:34px;width:34px;height:34px;font-size:12px}.itv-narration,.itv-scene{margin:18px 16px}.itv-sound{margin:18px 16px}.itv-epilogue{margin:0 16px 18px}}
`;

const ANCIENT_CSS = `
.itv-theme-ancient{--itv-bg:#efe3c9;--itv-card:#f8efd9;--itv-text:#382619;--itv-muted:#806a55;--itv-line:#c9ab78;--itv-q:#8a642c;--itv-a:#9e352c;background-image:linear-gradient(90deg,rgba(119,82,35,.035) 1px,transparent 1px),linear-gradient(rgba(119,82,35,.025) 1px,transparent 1px);background-size:18px 18px}.itv-theme-ancient .itv-cover{border-top:7px double #8a642c}.itv-theme-ancient .itv-rod{left:4%;right:4%;height:8px;border:1px solid #715126;border-radius:5px;background:linear-gradient(#c6a366,#8a642c,#d7bd83)}.itv-theme-ancient .itv-rod-top{top:10px}.itv-theme-ancient .itv-rod-bottom{bottom:10px}.itv-theme-ancient .itv-stamp{right:34px;top:90px;width:46px;height:46px;display:grid;place-items:center;border:3px double var(--itv-a);color:var(--itv-a);font:700 14px/1.1 KaiTi;transform:rotate(-8deg);opacity:.76;animation:itvStamp .45s ease-out}.itv-theme-ancient .itv-transcript{border-left:1px solid rgba(158,53,44,.18);border-right:1px solid rgba(138,100,44,.15)}@keyframes itvStamp{from{transform:scale(1.5) rotate(-8deg);opacity:0}to{transform:scale(1) rotate(-8deg);opacity:.76}}
.panel-overlay.dark .itv-theme-ancient,body.dark-mode .itv-theme-ancient{--itv-bg:#21170f;--itv-card:#2c2016;--itv-text:#ead9bd;--itv-muted:#af9575;--itv-line:#5a442d;--itv-q:#c79b54;--itv-a:#c06040}
`;

const FLIRTATIOUS_CSS = `
.itv-theme-flirtatious{--itv-bg:#090712;--itv-card:#111020;--itv-text:#f2ecff;--itv-muted:#8e87a5;--itv-line:#30294a;--itv-q:#b869ff;--itv-a:#ff4fa1;font-family:"Courier New",monospace;background:radial-gradient(circle at 20% 10%,rgba(184,105,255,.12),transparent 34%),#090712}.itv-theme-flirtatious .itv-cover{text-align:left;border-bottom-color:#b869ff;box-shadow:0 0 18px rgba(184,105,255,.2)}.itv-theme-flirtatious .itv-cover h2{text-shadow:0 0 12px rgba(255,79,161,.55)}.itv-theme-flirtatious .itv-bubble{box-shadow:0 0 12px rgba(184,105,255,.14)}.itv-theme-flirtatious .itv-right .itv-bubble{box-shadow:0 0 12px rgba(255,79,161,.14)}.itv-theme-flirtatious .itv-rec{right:18px;top:14px;color:#ff4f65;font:700 11px "Courier New";animation:itvBlink 1.2s steps(1) infinite}.itv-theme-flirtatious .itv-scanline{inset:0;z-index:5;background:repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px);mix-blend-mode:screen}.itv-theme-flirtatious .itv-cursor{left:20px;bottom:14px;color:var(--itv-q);animation:itvBlink .7s steps(1) infinite}.itv-theme-flirtatious .itv-scene{border:1px dashed var(--itv-q);background:rgba(184,105,255,.06)}@keyframes itvBlink{50%{opacity:.2}}
/* 深色：瑟瑟本即深色终端，恢复自身变量，避免被 SHARED_CSS 通用深色劫持成褐色 */
.panel-overlay.dark .itv-theme-flirtatious,body.dark-mode .itv-theme-flirtatious{--itv-bg:#090712;--itv-card:#111020;--itv-text:#f2ecff;--itv-muted:#8e87a5;--itv-line:#30294a;--itv-q:#b869ff;--itv-a:#ff4fa1}
`;

const MINIMAL_CSS = `
.itv-theme-minimal{--itv-bg:#f2f1ed;--itv-card:#fff;--itv-text:#171717;--itv-muted:#666;--itv-line:#bbb;--itv-q:#b22038;--itv-a:#9a751f;font-family:"Courier New",monospace}.itv-theme-minimal .itv-cover{text-align:left;border-bottom:4px solid #171717}.itv-theme-minimal .itv-cover h2{font-size:25px;letter-spacing:1px}.itv-theme-minimal .itv-classified{right:22px;top:27px;padding:4px 9px;border:3px solid #b22038;color:#b22038;font:700 13px "Courier New";letter-spacing:2px;transform:rotate(5deg)}.itv-theme-minimal .itv-barcode{right:23px;bottom:18px;color:#171717;font:16px/1 "Courier New";letter-spacing:-2px}.itv-theme-minimal .itv-bubble,.itv-theme-minimal .itv-person{border-radius:0;box-shadow:none}.itv-theme-minimal .itv-redactable{transition:color .2s,background .2s}.itv-theme-minimal .itv-redactable:not(:hover){color:transparent;background:#171717;text-shadow:none}.itv-theme-minimal .itv-redactable:not(:hover)::after{content:"HOVER TO DECLASSIFY";position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#ddd;font-size:8px;letter-spacing:1px}.itv-theme-minimal .itv-epilogue{border-left:6px solid #171717}.panel-overlay.dark .itv-theme-minimal,body.dark-mode .itv-theme-minimal{--itv-bg:#111;--itv-card:#1b1b1b;--itv-text:#e5e5e5;--itv-muted:#999;--itv-line:#3d3d3d;--itv-q:#d34258;--itv-a:#d0aa43}.panel-overlay.dark .itv-theme-minimal .itv-cover,body.dark-mode .itv-theme-minimal .itv-cover{border-bottom-color:#e5e5e5}
/* 深色：#171717 条形码/遮蔽条/epilogue 边框在 #111 底上不可见，翻为浅色（H8） */
.panel-overlay.dark .itv-theme-minimal .itv-barcode,body.dark-mode .itv-theme-minimal .itv-barcode{color:#e5e5e5}
.panel-overlay.dark .itv-theme-minimal .itv-redactable:not(:hover),body.dark-mode .itv-theme-minimal .itv-redactable:not(:hover){background:#e5e5e5}
.panel-overlay.dark .itv-theme-minimal .itv-redactable:not(:hover)::after,body.dark-mode .itv-theme-minimal .itv-redactable:not(:hover)::after{color:#333}
.panel-overlay.dark .itv-theme-minimal .itv-epilogue,body.dark-mode .itv-theme-minimal .itv-epilogue{border-left-color:#e5e5e5}
`;

const SWEET_CSS = `
.itv-theme-sweet{--itv-bg:var(--sweet-bg,#fff0f4);--itv-card:var(--sweet-card,#fffafd);--itv-text:var(--sweet-text,#532b3d);--itv-muted:var(--sweet-text-soft,#9c7586);--itv-line:var(--sweet-border,#efb9ca);--itv-q:var(--sweet-pink,#ec7fa3);--itv-a:#c03f70;font-family:var(--sweet-font-body,"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei",sans-serif);background-image:radial-gradient(circle at 15px 15px,rgba(236,127,163,.08) 0 2px,transparent 2px)}.itv-theme-sweet .itv-cover h2{font-family:var(--sweet-font-title,"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei",sans-serif);color:var(--itv-a)}.itv-theme-sweet .itv-bubble{border-radius:18px 18px 18px 5px}.itv-theme-sweet .itv-right .itv-bubble{border-radius:18px 18px 5px 18px}.itv-theme-sweet .itv-person{background:#fff;border-style:dashed}.itv-theme-sweet .itv-ribbon{left:18px;top:0;padding:11px 7px 17px;background:#ec7fa3;color:#fff;font-size:9px;font-weight:700;font-family:var(--sweet-font-title,"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei",sans-serif);writing-mode:vertical-rl;clip-path:polygon(0 0,100% 0,100% 87%,50% 100%,0 87%)}.itv-theme-sweet .itv-wax{right:25px;top:82px;width:48px;height:48px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e77b99,#b82f5e);color:#fff;box-shadow:0 4px 9px rgba(125,29,68,.25);transform:rotate(8deg)}.itv-theme-sweet .itv-lace{left:0;right:0;bottom:0;height:13px;background:radial-gradient(circle at 7px 0,transparent 6px,var(--itv-line) 6px 7px,transparent 7px) 0 0/14px 14px}.itv-theme-sweet .itv-epilogue{transform:rotate(-.4deg);border-style:dashed}.panel-overlay.dark .itv-theme-sweet,body.dark-mode .itv-theme-sweet{--itv-bg:var(--sweet-bg,#25151e);--itv-card:var(--sweet-card,#321c28);--itv-text:var(--sweet-text,#ffe5ee);--itv-muted:var(--sweet-text-soft,#c394a8);--itv-line:var(--sweet-border,#65384b);--itv-q:var(--sweet-pink,#ff8fab);--itv-a:#e25c89}
`;

const XIANXIA_CSS = `
.itv-theme-xianxia{--itv-bg:#eaf2ef;--itv-card:#f7fbf8;--itv-text:#253c38;--itv-muted:#708d86;--itv-line:#a9c7bf;--itv-q:#278c82;--itv-a:#a67b24;background:radial-gradient(circle at 50% -10%,rgba(255,255,255,.9),transparent 48%),linear-gradient(135deg,#e5f1ee,#f4f0df);font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",KaiTi,serif}.itv-theme-xianxia .itv-cover{border-top:1px solid var(--itv-a);border-bottom:1px solid var(--itv-q)}.itv-theme-xianxia .itv-cover h2{text-shadow:0 2px 12px rgba(39,140,130,.15)}.itv-theme-xianxia .itv-bubble{border-radius:12px 2px 12px 12px;box-shadow:0 7px 24px rgba(39,90,80,.08)}.itv-theme-xianxia .itv-right .itv-bubble{border-radius:2px 12px 12px 12px}.itv-theme-xianxia .itv-mist{width:190px;height:70px;border-radius:50%;filter:blur(16px);background:rgba(255,255,255,.55);animation:itvMist 7s ease-in-out infinite alternate}.itv-theme-xianxia .itv-mist-a{left:-30px;top:90px}.itv-theme-xianxia .itv-mist-b{right:-30px;bottom:80px;animation-delay:-3s}.itv-theme-xianxia .itv-stars{right:30px;top:25px;color:var(--itv-a);letter-spacing:8px;animation:itvStars 2.5s ease-in-out infinite}.itv-theme-xianxia .itv-jade-seal{right:30px;bottom:23px;width:48px;height:48px;display:grid;place-items:center;border:2px double var(--itv-q);color:var(--itv-q);font:700 12px KaiTi;transform:rotate(-5deg)}@keyframes itvMist{to{transform:translateX(55px)}}@keyframes itvStars{50%{opacity:.35;text-shadow:0 0 9px currentColor}}.panel-overlay.dark .itv-theme-xianxia,body.dark-mode .itv-theme-xianxia{--itv-bg:#0f201f;--itv-card:#172c29;--itv-text:#dcebe5;--itv-muted:#8cb0a7;--itv-line:#345c55;--itv-q:#58bdb0;--itv-a:#d1ab57;background:radial-gradient(circle at 50% -10%,rgba(84,145,132,.16),transparent 48%),#0f201f}
`;

const BRIDGE_CSS = `
.itv-theme-bridge{--itv-bg:var(--bridge-panel,#eef3f5);--itv-card:var(--bridge-panel-alt,#dde8eb);--itv-text:var(--bridge-text,#16222c);--itv-muted:var(--bridge-text-muted,#62757c);--itv-line:var(--bridge-line,#91a5ad);--itv-q:var(--bridge-signal,#0a7189);--itv-a:var(--bridge-warn,#b47a16);border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);font-family:var(--bridge-font-ui,"Microsoft YaHei","PingFang SC",sans-serif);background-color:var(--itv-bg);background-image:linear-gradient(rgba(35,117,138,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(35,117,138,.035) 1px,transparent 1px);background-size:22px 22px}
.itv-theme-bridge .itv-cover{padding:24px 48px 18px;text-align:left;background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);border-bottom:1px solid var(--bridge-line-strong,#23758a)}
.itv-theme-bridge .itv-cover h2{font-family:var(--bridge-font-data,"Consolas",monospace);font-size:24px;letter-spacing:2px}.itv-theme-bridge .itv-kicker,.itv-theme-bridge .itv-cover time{color:var(--bridge-screen-muted,#a3c2c9);font-family:var(--bridge-font-data,"Consolas",monospace)}.itv-theme-bridge .itv-subtitle{color:var(--bridge-screen-text,#8eeaff);font-family:var(--bridge-font-data,"Consolas",monospace)}.itv-theme-bridge .itv-cover p{color:var(--bridge-screen-muted,#a3c2c9)}
.itv-theme-bridge .itv-bridge-status,.itv-theme-bridge .itv-bridge-index,.itv-theme-bridge .itv-bridge-grid{pointer-events:none;position:absolute;z-index:2}.itv-theme-bridge .itv-bridge-status{right:18px;top:15px;padding:3px 7px;border:1px solid var(--bridge-warn,#b47a16);color:var(--bridge-warn,#b47a16);font:9px var(--bridge-font-data,"Consolas",monospace);letter-spacing:1px}.itv-theme-bridge .itv-bridge-index{right:18px;bottom:14px;color:var(--bridge-text-muted,#62757c);font:9px var(--bridge-font-data,"Consolas",monospace);letter-spacing:1px}.itv-theme-bridge .itv-bridge-grid{inset:0;background:linear-gradient(rgba(142,234,255,.025) 1px,transparent 1px);background-size:100% 6px}
.itv-theme-bridge .itv-roster{padding:14px 48px;background:var(--bridge-panel-inset,#d5e1e5);border-bottom:1px solid var(--bridge-line-strong,#23758a)}.itv-theme-bridge .itv-person{border-radius:0;background:var(--itv-card);border-color:var(--itv-line)}.itv-theme-bridge .itv-avatar{border-radius:0;background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);font-family:var(--bridge-font-data,"Consolas",monospace)}
.itv-theme-bridge .itv-transcript{padding:24px 48px 36px}.itv-theme-bridge .itv-turn{padding:8px;border-left:2px solid var(--itv-q);background:color-mix(in srgb,var(--itv-card) 78%,transparent)}.itv-theme-bridge .itv-turn.itv-right{border-left:0;border-right:2px solid var(--itv-a)}.itv-theme-bridge .itv-bubble,.itv-theme-bridge .itv-right .itv-bubble{border-radius:0;box-shadow:none;background:var(--itv-card)}.itv-theme-bridge .itv-emotion{border-radius:0}.itv-theme-bridge .itv-speaker{font-family:var(--bridge-font-data,"Consolas",monospace);letter-spacing:.8px}
.itv-theme-bridge .itv-scene,.itv-theme-bridge .itv-narration{border-radius:0;background:var(--bridge-panel-inset,#d5e1e5)}.itv-theme-bridge .itv-sound span{border-radius:0;border:1px solid var(--itv-line);background:var(--itv-card);font-family:var(--bridge-font-data,"Consolas",monospace)}.itv-theme-bridge .itv-epilogue{border-radius:0;border-left:3px solid var(--itv-a);background:var(--itv-card)}
/* 深色：重新映射 --itv-* 到 --bridge-*（bridge.ts 深色块已覆盖 --bridge-*），避免被 SHARED_CSS 通用深色劫持 */
.panel-overlay.dark .itv-theme-bridge,body.dark-mode .itv-theme-bridge{--itv-bg:var(--bridge-panel,#0f1a1f);--itv-card:var(--bridge-panel-alt,#16242b);--itv-text:var(--bridge-text,#cfe6ee);--itv-muted:var(--bridge-text-muted,#7a8e95);--itv-line:var(--bridge-line,#23758a);--itv-q:var(--bridge-signal,#1aa9c6);--itv-a:var(--bridge-warn,#d49530)}
@media(max-width:599px){.itv-overlay.itv-theme-bridge.bridge-module-interview{width:100%;height:100vh;height:100dvh;max-width:none;max-height:none}.itv-theme-bridge .itv-cover,.itv-theme-bridge .itv-roster,.itv-theme-bridge .itv-transcript{padding-left:14px;padding-right:14px}.itv-theme-bridge .itv-turn{gap:9px}}
`;

const IOS_CSS = `
.itv-theme-ios{--itv-bg:#f2f2f7;--itv-card:#ffffff;--itv-text:#1c1c1e;--itv-muted:rgba(60,60,67,.62);--itv-line:rgba(60,60,67,.12);--itv-q:#8e8e93;--itv-a:#007aff;font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Microsoft YaHei UI','Segoe UI',sans-serif)}
.itv-theme-ios .itv-cover{text-align:center;padding:34px 56px 22px;border-bottom:1px solid var(--itv-line);background:var(--itv-card)}
.itv-theme-ios .itv-kicker{letter-spacing:1.5px;color:var(--itv-muted)}
.itv-theme-ios .itv-cover h2{font-size:26px;letter-spacing:-.4px;font-weight:800}
.itv-theme-ios .itv-subtitle{color:var(--itv-a);letter-spacing:.5px;font-size:12px}
.itv-theme-ios .itv-cover p{color:var(--itv-muted);font-size:13px}
.itv-theme-ios .itv-roster{background:var(--itv-card);border-bottom:1px solid var(--itv-line)}
.itv-theme-ios .itv-person{border:none;border-radius:999px;background:var(--itv-bg);color:var(--itv-text);font-weight:500}
.itv-theme-ios .itv-avatar{border:none;border-radius:50%;background:rgba(0,122,255,.1);color:var(--itv-a);font-weight:700}
.itv-theme-ios .itv-avatar-a{background:rgba(142,142,147,.14);color:var(--itv-text)}
.itv-theme-ios .itv-required{color:var(--itv-a)}
/* iMessage 气泡：提问=灰（左），回答=蓝（右） */
.itv-theme-ios .itv-bubble{border:none;border-radius:18px;background:rgba(120,120,128,.15);color:var(--itv-text);box-shadow:none;max-width:100%;font-size:14px}
.itv-theme-ios .itv-right .itv-bubble{background:var(--itv-a);color:#fff;border-radius:18px}
.itv-theme-ios .itv-speaker{letter-spacing:.2px}
.itv-theme-ios .itv-emotion{border:none;border-radius:999px;background:rgba(120,120,128,.12);color:var(--itv-muted)}
.itv-theme-ios .itv-right .itv-emotion{background:rgba(255,255,255,.22);color:#fff}
.itv-theme-ios .itv-redactable{transition:filter .25s}
.itv-theme-ios .itv-redactable:not(:hover){filter:blur(5px)}
.itv-theme-ios .itv-scene{border:none;border-radius:14px;background:rgba(52,199,89,.1);color:#248a3d;border-left:3px solid #34c759}
.itv-theme-ios .itv-block-label{color:#248a3d;letter-spacing:1px}
.itv-theme-ios .itv-narration{border-top:1px solid var(--itv-line);border-bottom:1px solid var(--itv-line);color:var(--itv-muted)}
.itv-theme-ios .itv-sound span{border:none;border-radius:999px;background:rgba(142,142,147,.12);color:var(--itv-muted)}
.itv-theme-ios .itv-epilogue{border:none;border-radius:18px;background:var(--itv-card);box-shadow:0 4px 18px rgba(0,0,0,.06)}
.itv-theme-ios .itv-epilogue-label{color:var(--itv-a);letter-spacing:1px}
/* 深色：iOS 暗色聊天（对话底纯黑、卡片 elevated 灰） */
.panel-overlay.dark .itv-theme-ios,body.dark-mode .itv-theme-ios{--itv-bg:#000;--itv-card:#1c1c1e;--itv-text:#f2f2f7;--itv-muted:rgba(235,235,245,.62);--itv-line:rgba(235,235,245,.12);--itv-a:#0a84ff}
.panel-overlay.dark .itv-theme-ios .itv-bubble,body.dark-mode .itv-theme-ios .itv-bubble{background:rgba(120,120,128,.32);color:#f2f2f7}
.panel-overlay.dark .itv-theme-ios .itv-right .itv-bubble,body.dark-mode .itv-theme-ios .itv-right .itv-bubble{background:#0a84ff;color:#fff}
.panel-overlay.dark .itv-theme-ios .itv-scene,body.dark-mode .itv-theme-ios .itv-scene{background:rgba(48,209,88,.14);color:#30d158;border-left-color:#30d158}
.panel-overlay.dark .itv-theme-ios .itv-block-label,body.dark-mode .itv-theme-ios .itv-block-label{color:#30d158}
.panel-overlay.dark .itv-theme-ios .itv-avatar,body.dark-mode .itv-theme-ios .itv-avatar{background:rgba(10,132,255,.2)}
.panel-overlay.dark .itv-theme-ios .itv-epilogue,body.dark-mode .itv-theme-ios .itv-epilogue{box-shadow:none}
`;

function themed(style: StyleType, data: InterviewData, primaryInterviewee: string): string {
  const css = style === 'ancient' ? ANCIENT_CSS
    : style === 'flirtatious' ? FLIRTATIOUS_CSS
      : style === 'minimal' ? MINIMAL_CSS
        : style === 'sweet' ? SWEET_CSS
          : style === 'bridge' ? BRIDGE_CSS
            : style === 'ios' ? IOS_CSS
              : XIANXIA_CSS;
  return `<style>${SHARED_CSS}${css}</style>${archiveHtml(data, primaryInterviewee, style)}`;
}

export function renderAncientInterview(data: InterviewData, primaryInterviewee: string): string { return themed('ancient', data, primaryInterviewee); }
export function renderFlirtatiousInterview(data: InterviewData, primaryInterviewee: string): string { return themed('flirtatious', data, primaryInterviewee); }
export function renderMinimalInterview(data: InterviewData, primaryInterviewee: string): string { return themed('minimal', data, primaryInterviewee); }
export function renderSweetInterview(data: InterviewData, primaryInterviewee: string): string { return themed('sweet', data, primaryInterviewee); }
export function renderXianxiaInterview(data: InterviewData, primaryInterviewee: string): string { return themed('xianxia', data, primaryInterviewee); }
export function renderBridgeInterview(data: InterviewData, primaryInterviewee: string): string { return themed('bridge', data, primaryInterviewee); }
export function renderIosInterview(data: InterviewData, primaryInterviewee: string): string { return themed('ios', data, primaryInterviewee); }

export function renderThemedInterview(data: InterviewData, primaryInterviewee: string, style: StyleType): string {
  if (style === 'bridge') return renderBridgeInterview(data, primaryInterviewee);
  if (style === 'flirtatious') return renderFlirtatiousInterview(data, primaryInterviewee);
  if (style === 'minimal') return renderMinimalInterview(data, primaryInterviewee);
  if (style === 'sweet') return renderSweetInterview(data, primaryInterviewee);
  if (style === 'xianxia') return renderXianxiaInterview(data, primaryInterviewee);
  if (style === 'ios') return renderIosInterview(data, primaryInterviewee);
  return renderAncientInterview(data, primaryInterviewee);
}
