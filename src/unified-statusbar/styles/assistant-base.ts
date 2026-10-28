// ===== 宅仙只读 AI 小助手 · 独立按需样式 =====
import { ensureStyleOnce } from '../renderers/style-once';

export const ASSISTANT_BASE_CSS = `
.assistant-float-button{position:fixed;width:44px;height:44px;z-index:2147483000;border:1px solid var(--accent-color,var(--border-color,rgba(134,103,70,.52)));border-radius:50%;background:var(--statusbar-bg,var(--main-bg,rgba(255,250,242,.96)));color:var(--text-color,#4b3828);box-shadow:0 6px 24px rgba(0,0,0,.2);cursor:grab;display:grid;place-items:center;font-size:20px;line-height:1;touch-action:none;user-select:none}
.assistant-float-button:active{cursor:grabbing}.assistant-float-button:focus-visible{outline:2px solid var(--accent-color,#a67846);outline-offset:3px}
/* border-box 必须有：遮罩用 100vh/100dvh 做边框盒，content-box 会再加 padding:18px×2 把遮罩撑出视口 36px；
   矮视口（横屏手机）下壳体被居中推出可视区边缘，命中测试在越过视口沿的区域返回空（按钮看得见点不到） */
.assistant-overlay{position:fixed;inset:0;box-sizing:border-box;z-index:2147483001;display:grid;place-items:center;padding:18px;background:rgba(16,12,9,.56);color:var(--text-color,#3c3128)}
/* max-width/height:100% 钳住壳体：矮视口下 min(720px,92vh) 不含遮罩 36px padding，壳体会上下戳出内容盒，
   发送/关闭按钮被推到视口沿外变成死区；钳回内容盒后消息区（1fr 行）自行收缩吸收 */
.assistant-shell{width:min(980px,96vw);height:min(720px,92vh);max-width:100%;max-height:100%;display:grid;grid-template-columns:220px minmax(0,1fr);overflow:hidden;border:1px solid var(--border-color,rgba(130,100,70,.42));border-radius:18px;background:var(--statusbar-bg,var(--main-bg,#fffaf3));box-shadow:0 18px 70px rgba(0,0,0,.34)}
.assistant-session-rail{min-width:0;overflow:auto;padding:14px;border-right:1px solid var(--border-color,rgba(130,100,70,.3));background:var(--secondary-bg,rgba(126,91,53,.07))}
.assistant-rail-head,.assistant-dialogue-head,.assistant-source-head,.assistant-composer-actions,.assistant-session-row,.assistant-source-labels{display:flex;align-items:center;gap:8px}
.assistant-rail-head,.assistant-dialogue-head{justify-content:space-between}.assistant-rail-title{font-weight:700}.assistant-session-list{display:grid;gap:7px;margin-top:12px}
.assistant-session-row{min-width:0}.assistant-session-open{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.assistant-session-open.is-active{font-weight:700;border-color:var(--accent-color,#a67846)}
.assistant-session-confirm{display:grid;gap:6px;padding:8px;border:1px solid var(--border-color,rgba(130,100,70,.3));border-radius:10px}.assistant-session-confirm-actions{display:flex;gap:6px}
.assistant-dialogue{min-width:0;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto}.assistant-dialogue-head{padding:13px 16px;border-bottom:1px solid var(--border-color,rgba(130,100,70,.3))}
.assistant-dialogue-title{font-weight:700}.assistant-header-actions{display:flex;gap:8px}.assistant-mobile-sessions{display:none}
.assistant-source-wrap{padding:9px 16px;border-bottom:1px solid var(--border-color,rgba(130,100,70,.2))}.assistant-source-head{justify-content:space-between}.assistant-source-summary{font-size:12px;opacity:.76}
.assistant-source-panel{display:grid;gap:10px;margin-top:10px;padding:10px;border:1px solid var(--border-color,rgba(130,100,70,.3));border-radius:12px;background:var(--secondary-bg,rgba(126,91,53,.06))}.assistant-source-panel[hidden]{display:none}
.assistant-topic-hint{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 16px 0;padding:6px 10px;border:1px dashed var(--accent-color,var(--border-color,rgba(134,103,70,.5)));border-radius:10px;font-size:12px;background:var(--accent-bg,rgba(146,104,60,.08))}.assistant-topic-hint[hidden]{display:none}.assistant-topic-hint button{padding:3px 9px;font-size:12px}
.assistant-source-chips{display:flex;flex-wrap:wrap;gap:7px}.assistant-source-chip[data-state="include"]{background:rgba(64,140,88,.16);border-color:rgba(64,140,88,.55)}.assistant-source-chip[data-state="exclude"]{background:rgba(180,70,70,.12);border-color:rgba(180,70,70,.48);text-decoration:line-through}
.assistant-table-field{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px}.assistant-table-field input{min-width:0;width:100%;box-sizing:border-box}
.assistant-messages{min-height:0;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}.assistant-welcome{margin:auto;max-width:520px;text-align:center}.assistant-welcome h3{margin:0 0 8px}.assistant-quick-prompts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}
.assistant-message{position:relative;max-width:min(78%,680px);padding:10px 12px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--secondary-bg,rgba(126,91,53,.09))}.assistant-message-user{align-self:flex-end;background:var(--accent-bg,rgba(146,104,60,.18))}.assistant-message-error{border:1px solid rgba(180,70,70,.45);background:rgba(180,70,70,.08)}
.assistant-message-text p{margin:0 0 6px}.assistant-message-text p:last-child{margin-bottom:0}.assistant-message-text h3,.assistant-message-text h4,.assistant-message-text h5,.assistant-message-text h6{margin:10px 0 6px;line-height:1.3}.assistant-message-text h3:first-child,.assistant-message-text h4:first-child{margin-top:0}
.assistant-message-text ul,.assistant-message-text ol{margin:0 0 6px;padding-left:1.35em}.assistant-message-text li{margin:2px 0}
.assistant-message-text code{font-family:ui-monospace,Consolas,monospace;font-size:.92em;padding:1px 5px;border-radius:6px;background:var(--secondary-bg,rgba(126,91,53,.14))}
.assistant-message-text pre{margin:0 0 6px;padding:9px 11px;border-radius:10px;background:var(--secondary-bg,rgba(126,91,53,.14));overflow:auto;white-space:pre-wrap}.assistant-message-text pre code{padding:0;background:none}
.assistant-message-text blockquote{margin:0 0 6px;padding:2px 0 2px 10px;border-left:3px solid var(--border-color,rgba(130,100,70,.42));opacity:.88}.assistant-message-text hr{border:0;border-top:1px solid var(--border-color,rgba(130,100,70,.34));margin:8px 0}
.assistant-source-labels{flex-wrap:wrap;margin-top:8px}.assistant-source-label{font-size:11px;padding:2px 7px;border:1px solid var(--border-color,rgba(130,100,70,.34));border-radius:99px;opacity:.82}.assistant-source-label.is-unavailable{border-color:rgba(180,70,70,.45);color:var(--danger-color,#9d3535)}
.assistant-message-actions{position:absolute;top:100%;margin-top:6px;display:flex;gap:3px;opacity:0;transition:opacity .15s;z-index:2}.assistant-message-user .assistant-message-actions{right:0;justify-content:flex-end}.assistant-message-assistant .assistant-message-actions{left:0}.assistant-message:hover .assistant-message-actions,.assistant-message-actions:focus-within{opacity:1}/* 命中区朝气泡方向补一块隐形「桥」：操作条浮在 top:100%+6px（气泡外），指针从气泡移向按钮
   必经的这 6px 既不属于气泡也不属于按钮——移进去 :hover 立即丢失（按钮淡出为 0）且点击落在
   容器上被 handleClick 无视，表现为「悬停浮现→移过去就消失→点不动」。伪元素属按钮本体：
   悬停它算悬停按钮（:hover 经祖先链保住 .assistant-message:hover），点击也照常命中按钮。
   左右各 1px（按钮间距 3px，不越界抢邻键命中）、上下各留余量把 24px 小目标放大。 */
.assistant-shell .assistant-message-actions button{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;background:transparent;border-radius:7px;font-size:14px;line-height:1;opacity:.6;cursor:pointer;position:relative}.assistant-shell .assistant-message-actions button::before{content:'';position:absolute;left:-1px;right:-1px;top:-6px;bottom:-3px}.assistant-shell .assistant-message-actions button:hover{opacity:1;background:var(--secondary-bg,rgba(126,91,53,.14))}
.assistant-composer{padding:12px 16px calc(15px + var(--safe-bottom,0px));border-top:1px solid var(--border-color,rgba(130,100,70,.3))}.assistant-input{display:block;width:100%;min-height:72px;max-height:180px;resize:vertical;box-sizing:border-box}.assistant-composer-actions{justify-content:flex-end;margin-top:8px}.assistant-status{margin-right:auto;font-size:12px;opacity:.75}.assistant-cancel[hidden]{display:none}
.assistant-streaming-toggle{padding:5px 10px;font-size:12px}.assistant-streaming-toggle.is-active{border-color:var(--accent-color,#a67846);background:var(--accent-bg,rgba(146,104,60,.16))}
.assistant-typing{display:inline-flex;align-items:center;gap:7px;opacity:.78;font-size:.92em}.assistant-typing-dots{display:inline-flex;gap:4px}.assistant-typing-dot{width:6px;height:6px;border-radius:50%;background:currentColor;animation:assistantTypingBlink 1.15s infinite ease-in-out}.assistant-typing-dot:nth-child(2){animation-delay:.18s}.assistant-typing-dot:nth-child(3){animation-delay:.36s}
@keyframes assistantTypingBlink{0%,80%,100%{opacity:.22;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.assistant-float-button.is-busy{animation:assistantFloatPulse 1.6s infinite ease-in-out}
@keyframes assistantFloatPulse{0%,100%{box-shadow:0 6px 24px rgba(0,0,0,.2),0 0 0 0 rgba(146,104,60,.45)}50%{box-shadow:0 6px 24px rgba(0,0,0,.2),0 0 0 9px rgba(146,104,60,0)}}
.assistant-shell button,.assistant-shell input,.assistant-shell textarea{font:inherit;color:inherit;border:1px solid var(--border-color,rgba(130,100,70,.38));border-radius:9px;background:var(--control-bg,var(--main-bg,#fffaf3));padding:7px 9px}.assistant-shell button{cursor:pointer}.assistant-shell button:disabled{cursor:not-allowed;opacity:.55}
.assistant-overlay.dark{--secondary-bg:var(--bg-alt,rgba(255,255,255,.06));--control-bg:var(--card,var(--sweet-card,var(--jade-surface-1,#24211f)));--main-bg:var(--card,var(--sweet-card,var(--jade-surface-1,#24211f)));--statusbar-bg:var(--card,var(--sweet-card,var(--jade-surface-1,#24211f)));--text-color:var(--text,var(--sweet-text,#eee));--border-color:var(--divider,var(--sweet-border,rgba(255,255,255,.18)));--accent-color:var(--accent,var(--sweet-pink,var(--jade,#a67846)));--danger-color:#e07a7a}
.assistant-overlay.dark .assistant-shell{color:var(--text-color);background:var(--statusbar-bg)}
body.dark-mode .assistant-float-button{color:var(--text,var(--sweet-text,#eee));background:var(--card,var(--sweet-card,var(--jade-surface-1,#24211f)));border-color:var(--divider,var(--sweet-border,rgba(255,255,255,.18)))}
@media(max-width:700px){.assistant-overlay{inset:0;padding:0;height:100vh;height:100dvh;width:100%}.assistant-shell{width:100%;height:100%;max-height:none;border:0;border-radius:0;grid-template-columns:1fr}.assistant-session-rail{display:none;position:absolute;z-index:3;inset:52px auto 0 0;width:min(82vw,300px);box-sizing:border-box;border-right:1px solid var(--border-color,rgba(130,100,70,.3));box-shadow:8px 8px 30px rgba(0,0,0,.2)}.assistant-shell.is-rail-open .assistant-session-rail{display:block}.assistant-mobile-sessions{display:inline-flex}.assistant-message{max-width:88%}.assistant-messages{gap:34px}.assistant-message-actions{opacity:1}}
`;

export function ensureAssistantStyles(): void {
  ensureStyleOnce('ub-assistant-style', ASSISTANT_BASE_CSS);
}

export function removeAssistantStyles(): void {
  document.getElementById('ub-assistant-style')?.remove();
}
