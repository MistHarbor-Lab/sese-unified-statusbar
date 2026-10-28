// ===== 通知美化 · 普通包装基底 CSS（素瓷/云墨双皮肤 · 2026-08-24 重设计）=====
// 详见 docs/notification-system/04-需求与设计.md §八、docs/notification-system/mockup-notify-refine.html
//
// 职责：把酒馆 toastr 套上「素瓷/云墨」主题壳——
//   素瓷（ub-skin-light）：暖白瓷面玻璃 + 墨色字 + 主题渐变亮边，亮暗通吃；
//   云墨（ub-skin-dark）：半透明深青岩玻璃 + 毛玻璃 + 顶部内高光，告别近黑；
//   自适应：浅色用素瓷、深色模式自动换云墨（皮肤类由 setNotifyBeautifyEnabled 按 darkTheme 计算）。
// 三色严重度区分保留：常规 success/info = 主题边；warning = 琥珀边+暖纸底；error/持久 = 红边+红纸底。
// 小巧精致：fit-content 宽度（单行通知自动变胶囊）、15px 图标章、紧凑内边距；
//   例行短通知由包装器自动合并为单行（标题并入正文或去冗余标题），错误/持久通知保持完整详情。
// ACU 填表进度 toast：文案压缩（保留 第几批/第几次重试 关键信息），标题行「数据库插件」去除。
// 注入点：parent.document.head（toastr 由酒馆托管，容器 #toast-container 在父文档）。
//
// 性能纪律：纯 CSS 覆盖，无匹配零重绘；倒计时条由 toastr 方法包装按本条 timeOut 注入（每条一次，无轮询）；
//   ACU 进度压缩用挂在进度 span 上的 MutationObserver（插件 .text() 直更 DOM 绕过包装器，须持续跟写；
//   观察器随 toast 节点移除而失效，无泄漏）；未触发任何 toastr 时开销为零。
// 零依赖纪律：本模块不得引入任何运行时 import（reinject-guard-leak.test.cjs 以「依赖即抛错」加载）；
//   深色判定经 setNotifyBeautifyEnabled 的 isDark 参数注入（index.ts 读 darkTheme）。
//
// 容器类由 _ensureNotifyClasses 同步（不写 toastr.options.positionClass）：
//   ub-notify-container（基底）+ ub-theme-<style>（6 主题 ring 变量）
//   + ub-align-<left|center|right>（定位）+ ub-skin-<light|dark>（皮肤变量）。
// 例行通知单行 = 纯 CSS（.toast-title display:inline + ::after「·」分隔点）；禁止向 message 注入
// HTML——酒馆 toastr escapeHtml:true 会把标签原样显示（2026-08-24 三轮实测教训）。

import { type StyleType } from '../core/constants';
import { type NotifyAlign } from '../core/config-store';

// 6 主题 ring 配色（取各主题 --ub-ft-ring-start/end/glow 实际值；bridge 取深色变体亮青，亮色根的暗 teal 在深色雾面底上不发光）
const THEME_RING: Record<StyleType, { rs: string; re: string; rg: string }> = {
  ancient: { rs: '#e2c36c', re: '#c24a3f', rg: 'rgba(201,168,76,.34)' },
  flirtatious: { rs: '#f293bd', re: '#9b61d4', rg: 'rgba(208,96,160,.38)' },
  minimal: { rs: '#b8f5ff', re: '#669cff', rg: 'rgba(126,232,255,.34)' },
  sweet: { rs: '#ffb5c9', re: '#a98de6', rg: 'rgba(255,143,171,.4)' },
  xianxia: { rs: '#b6e2ce', re: '#c8a850', rg: 'rgba(104,176,144,.36)' },
  bridge: { rs: '#77e5e0', re: '#ffbd5a', rg: 'rgba(119,229,224,.28)' },
  ios: { rs: '#64d2ff', re: '#0a84ff', rg: 'rgba(10,132,255,.32)' },
};

function themeRingCss(): string {
  return (Object.keys(THEME_RING) as StyleType[]).map(t => {
    const v = THEME_RING[t];
    return `#toast-container.ub-notify-container.ub-theme-${t}{--ub-ntf-rs:${v.rs};--ub-ntf-re:${v.re};--ub-ntf-rg:${v.rg};}`;
  }).join('\n');
}

// 基底 CSS：皮肤经 CSS 变量注入（--ubn-*），素瓷/云墨只差一组变量；严重度档只换 --ub-ntf-rs/re/rg 与纸底变量。
// #toast-container.ub-notify-container（ID+类，特异性 1,1,0）压过 toastr 自带 #toast-container（1,0,0）与位置类。
// .toast 关键视觉属性加 !important 以压过酒馆 toastr 主题的强覆盖。
export const notifyBaseCSS = `
${themeRingCss()}

/* ===== 皮肤变量 · 素瓷（暖白瓷面玻璃） ===== */
#toast-container.ub-notify-container.ub-skin-light{
  --ubn-bg1:rgba(255,255,255,.96); --ubn-bg2:rgba(249,248,245,.9);
  --ubn-ink:#2c3036; --ubn-ink2:rgba(44,48,54,.92);
  --ubn-inset:inset 0 1px 0 rgba(255,255,255,.85);
  --ubn-sh:0 1px 2px rgba(22,26,34,.08),0 8px 22px rgba(22,26,34,.11),0 18px 40px rgba(22,26,34,.1);
  --ubn-sh-h:0 1px 2px rgba(22,26,34,.09),0 10px 26px rgba(22,26,34,.13),0 22px 48px rgba(22,26,34,.12);
  --ubn-hover:saturate(1.06);
  --ubn-ok:#2e9e6f; --ubn-ok-bg:rgba(47,158,111,.12); --ubn-ok-ring:rgba(47,158,111,.42);
  --ubn-warn:#c07f1d; --ubn-warn-bg:rgba(192,127,29,.14); --ubn-warn-ring:rgba(192,127,29,.45);
  --ubn-err:#c44343; --ubn-err-bg:rgba(196,67,67,.13); --ubn-err-ring:rgba(196,67,67,.45);
  --ubn-info:#3d88b8; --ubn-info-bg:rgba(61,136,184,.12); --ubn-info-ring:rgba(61,136,184,.4);
  --ubn-warn1:rgba(255,251,242,.96); --ubn-warn2:rgba(250,244,232,.9); --ubn-warn-ink:#7d5a1a;
  --ubn-err1:rgba(255,249,248,.96); --ubn-err2:rgba(251,242,242,.9); --ubn-err-ink:#9c3636;
  --ubn-ab-bd:rgba(44,48,54,.26); --ubn-ab-bg:rgba(44,48,54,.05); --ubn-ab-ink:#2c3036; --ubn-ab-ink2:#fff;
  --ubn-close-hover:rgba(44,48,54,.08);
}
/* ===== 皮肤变量 · 云墨（半透明深青岩玻璃，非近黑） ===== */
#toast-container.ub-notify-container.ub-skin-dark{
  --ubn-bg1:rgba(50,56,70,.84); --ubn-bg2:rgba(29,33,44,.88);
  --ubn-ink:#f0f4f9; --ubn-ink2:rgba(240,244,249,.88);
  --ubn-inset:inset 0 1px 0 rgba(255,255,255,.09);
  --ubn-sh:0 1px 2px rgba(8,10,16,.28),0 10px 26px rgba(8,10,16,.32),0 0 16px rgba(8,10,16,.18);
  --ubn-sh-h:0 1px 2px rgba(8,10,16,.3),0 12px 30px rgba(8,10,16,.36),0 0 18px var(--ub-ntf-rg);
  --ubn-hover:brightness(1.07);
  --ubn-ok:#6fd0a0; --ubn-ok-bg:rgba(111,208,160,.13); --ubn-ok-ring:rgba(111,208,160,.42);
  --ubn-warn:#e8b25f; --ubn-warn-bg:rgba(232,178,95,.13); --ubn-warn-ring:rgba(232,178,95,.45);
  --ubn-err:#f09a9a; --ubn-err-bg:rgba(240,154,154,.13); --ubn-err-ring:rgba(240,154,154,.45);
  --ubn-info:#8fd4f5; --ubn-info-bg:rgba(143,212,245,.12); --ubn-info-ring:rgba(143,212,245,.4);
  --ubn-warn1:rgba(62,55,40,.86); --ubn-warn2:rgba(38,32,22,.88); --ubn-warn-ink:#ffe1ae;
  --ubn-err1:rgba(60,42,44,.86); --ubn-err2:rgba(37,23,26,.88); --ubn-err-ink:#ffc9c9;
  --ubn-ab-bd:rgba(238,242,247,.3); --ubn-ab-bg:rgba(238,242,247,.06); --ubn-ab-ink:#eef2f7; --ubn-ab-ink2:#14181f;
  --ubn-close-hover:rgba(255,255,255,.12);
}

/* ===== 容器：固定顶部、按 notifyAlign 定位、堆叠向下（最新在顶）===== */
#toast-container.ub-notify-container{
  position:fixed; top:12px; left:auto; right:auto;
  width:auto; max-width:320px; z-index:100000;
  pointer-events:none;
  --ub-ntf-rs:#b8f5ff; --ub-ntf-re:#669cff; --ub-ntf-rg:rgba(126,232,255,.34);
}
#toast-container.ub-notify-container.ub-align-left{left:12px;right:auto;transform:none;}
#toast-container.ub-notify-container.ub-align-center{left:50%;right:auto;transform:translateX(-50%);}
#toast-container.ub-notify-container.ub-align-right{right:12px;left:auto;transform:none;}

/* ===== 单条 toast：皮肤壳（fit-content 宽度，单行自动变胶囊） ===== */
#toast-container.ub-notify-container .toast{
  position:relative; width:fit-content !important; min-width:0 !important;
  max-width:320px;
  border:1px solid transparent !important; border-radius:10px !important;
  padding:7px 24px 8px 33px !important; overflow:hidden;
  background:linear-gradient(168deg,var(--ubn-bg1),var(--ubn-bg2)) padding-box,
             linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) border-box !important;
  background-image:linear-gradient(168deg,var(--ubn-bg1),var(--ubn-bg2)),
                   linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  color:var(--ubn-ink) !important;
  box-shadow:var(--ubn-inset),var(--ubn-sh) !important;
  -webkit-backdrop-filter:blur(18px) saturate(1.45);
  backdrop-filter:blur(18px) saturate(1.45);
  font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif;
  font-size:12.5px; cursor:pointer; pointer-events:auto;
  transition:filter .18s ease,box-shadow .18s ease;
  margin:0 0 8px;
  opacity:1; /* toastr fade 由 opacity 过渡控制，此处仅保底 */
}
#toast-container.ub-notify-container .toast:hover{
  filter:var(--ubn-hover);
  box-shadow:var(--ubn-inset),var(--ubn-sh-h) !important;
}
/* 严重度三档（跨皮肤统一）：
   常规 success/info = 主题渐变亮边 + 皮肤底（保留主题识别）；
   警告 warning = 琥珀亮边 + 暖纸底；报错 error/持久错误 = 红亮边 + 红纸底。
   覆写 --ub-ntf-* 后，倒计时条 / hover 柔光（云墨） / .toast-progress 自动跟随同色。
   toastr 各类型默认 bg/border-left 清零（避免酒馆主题残留色块抢戏）。*/
#toast-container.ub-notify-container .toast-success,
#toast-container.ub-notify-container .toast-info{
  background-image:linear-gradient(168deg,var(--ubn-bg1),var(--ubn-bg2)),
                   linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  border-left:none !important;
}
#toast-container.ub-notify-container .toast-warning{
  --ub-ntf-rs:#eec27a; --ub-ntf-re:#c9802a; --ub-ntf-rg:rgba(232,178,95,.32);
  background-image:linear-gradient(168deg,var(--ubn-warn1),var(--ubn-warn2)),
                   linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  border-left:none !important;
}
#toast-container.ub-notify-container .toast-error{
  --ub-ntf-rs:#efa0a0; --ub-ntf-re:#cc4444; --ub-ntf-rg:rgba(240,154,154,.3);
  background-image:linear-gradient(168deg,var(--ubn-err1),var(--ubn-err2)),
                   linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  border-left:none !important;
}

/* ===== 严重度小图标章（::before）—— 15px 圆，极轻色光，不抢眼 ===== */
#toast-container.ub-notify-container .toast::before{
  content:""; position:absolute; left:10px; top:9px; width:15px; height:15px;
  border-radius:50%; display:flex; align-items:center; justify-content:center;
  font-size:9.5px; font-weight:700; line-height:1;
}
#toast-container.ub-notify-container .toast-success::before{content:"✓";color:var(--ubn-ok);background:var(--ubn-ok-bg);box-shadow:inset 0 0 0 1px var(--ubn-ok-ring);}
#toast-container.ub-notify-container .toast-error::before{content:"✕";color:var(--ubn-err);background:var(--ubn-err-bg);box-shadow:inset 0 0 0 1px var(--ubn-err-ring);}
#toast-container.ub-notify-container .toast-warning::before{content:"!";color:var(--ubn-warn);background:var(--ubn-warn-bg);box-shadow:inset 0 0 0 1px var(--ubn-warn-ring);}
#toast-container.ub-notify-container .toast-info::before{content:"i";color:var(--ubn-info);background:var(--ubn-info-bg);box-shadow:inset 0 0 0 1px var(--ubn-info-ring);}

/* ===== 标题与正文 =====
   例行通知单行（纯 CSS，禁 HTML 注入——酒馆 toastr escapeHtml:true 会把注入的 span 原样显示）：
   标题保持 toastr 原生 .toast-title 元素 display:inline 流入正文行首，::after 生成「·」分隔点，
   与正文形成字号/字重/颜色三重区分；错误/持久标题恢复独立成行（详情优先）。*/
#toast-container.ub-notify-container .toast .toast-title{
  display:inline; font-weight:600; font-size:12.5px; line-height:1.4; margin:0;
  color:var(--ubn-ink) !important; text-align:left;
}
#toast-container.ub-notify-container .toast .toast-title::after{
  content:" · "; font-weight:400; font-size:12px; color:var(--ubn-ink2);
}
/* 严重度标题色：警告偏暖、报错偏红（跨皮肤统一）*/
#toast-container.ub-notify-container .toast-warning .toast-title{color:var(--ubn-warn-ink) !important;}
#toast-container.ub-notify-container .toast-error .toast-title{color:var(--ubn-err-ink) !important;}
#toast-container.ub-notify-container .toast-message{
  display:inline; font-size:12px; line-height:1.5; margin:0;
  color:var(--ubn-ink2) !important; text-align:left;
  -webkit-font-smoothing:antialiased; word-break:break-word; white-space:pre-line;
}
/* message 内层包装 div（ACU 进度 HTML 等）一并内联，避免打断标题-正文同行流 */
#toast-container.ub-notify-container .toast .toast-message > div{display:inline;}
/* 错误/持久：标题恢复独立成行（块级），无分隔点 */
#toast-container.ub-notify-container .toast-error .toast-title,
#toast-container.ub-notify-container .toast.ub-persist .toast-title{display:block;}
#toast-container.ub-notify-container .toast-error .toast-message,
#toast-container.ub-notify-container .toast.ub-persist .toast-message{display:block;}
#toast-container.ub-notify-container .toast-error .toast-title::after,
#toast-container.ub-notify-container .toast.ub-persist .toast-title::after{content:none;}

/* ===== 关闭按钮（toastr closeButton:true 时出现）===== */
#toast-container.ub-notify-container .toast-close-button{
  position:absolute; top:6px; right:7px; width:15px; height:15px;
  border:none; background:transparent; color:var(--ubn-ink); opacity:.38; cursor:pointer;
  font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center;
  border-radius:4px; padding:0; text-shadow:none;
}
#toast-container.ub-notify-container .toast-close-button:hover{opacity:1;background:var(--ubn-close-hover);}

/* ===== 倒计时条（自动消失型；JS 按本条 timeOut 注入 .ub-ntf-bar，animationDuration 同步）===== */
#toast-container.ub-notify-container .toast .ub-ntf-bar{
  position:absolute; left:0; bottom:0; height:2px; width:100%;
  background:linear-gradient(90deg,var(--ub-ntf-rs),var(--ub-ntf-re)); opacity:.75;
  border-radius:0 0 9px 9px;
  animation:ub-ntf-drain 5s linear forwards;
}
@keyframes ub-ntf-drain{from{width:100%;}to{width:0%;}}

/* ===== 持久通知（ub-persist：PERSIST_OPTS 不自动消失，报错/警告档）紧凑化 =====
   持久通知长期占据屏幕：内边距/字号/行距/图标/关闭钮收窄；错误详情完整保留。 */
#toast-container.ub-notify-container .toast.ub-persist{
  padding:7px 24px 8px 31px !important;
}
#toast-container.ub-notify-container .toast.ub-persist .toast-title{
  font-size:12.5px; line-height:1.35; margin:0 0 1px;
}
#toast-container.ub-notify-container .toast.ub-persist .toast-message{
  font-size:12px; line-height:1.45;
}
#toast-container.ub-notify-container .toast.ub-persist::before{
  left:9px; top:8px; width:14px; height:14px; font-size:9px;
}
#toast-container.ub-notify-container .toast.ub-persist .toast-close-button{
  top:5px; right:6px; width:14px; height:14px; font-size:11px;
}

/* ===== 劫持数据库插件（ACU）.acu-toast：高特异性覆盖其 !important 主题 =====
   插件以 .acu-toast.toast{...!important}(0,2,0) 与 #toast-container .acu-toast.toast.toast-success{...!important}(1,3,0)
   压过我们基础壳 #toast-container.ub-notify-container .toast(1,2,0)。此处容器作用域 + .acu-toast 达 1,3,0，
   类型变体再 +.toast-success 达 1,4,0（不依赖注入顺序）。
   background 拆长属性（image/clip/origin/color）规避插件 background 简写 !important 连带重置 clip。
   视觉值全部走皮肤变量（--ubn-*），素瓷/云墨自动成立。*/
#toast-container.ub-notify-container .toast.acu-toast{
  position:relative; width:fit-content !important; min-width:0 !important; max-width:320px;
  border:1px solid transparent !important; border-left:none !important; border-radius:10px !important;
  padding:7px 24px 8px 31px !important; overflow:hidden;
  opacity:1 !important;
  background-color:transparent !important;
  background-image:linear-gradient(168deg,var(--ubn-bg1),var(--ubn-bg2)),
                    linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  background-clip:padding-box, border-box !important;
  background-origin:padding-box, border-box !important;
  background-repeat:no-repeat !important;
  background-position:0 0 !important;
  color:var(--ubn-ink) !important;
  box-shadow:var(--ubn-inset),var(--ubn-sh) !important;
  font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif !important;
  font-size:12.5px !important; font-weight:400 !important; letter-spacing:normal !important;
  cursor:pointer; pointer-events:auto;
  transition:filter .18s ease,box-shadow .18s ease;
  -webkit-backdrop-filter:blur(18px) saturate(1.45);
  backdrop-filter:blur(18px) saturate(1.45);
}
#toast-container.ub-notify-container .toast.acu-toast:hover{
  filter:var(--ubn-hover);
  box-shadow:var(--ubn-inset),var(--ubn-sh-h) !important;
}
/* 类型变体 1,4,0：稳压插件 1,3,0 的 background 简写；三档染色与基础档同构 */
#toast-container.ub-notify-container .toast.acu-toast.toast-success,
#toast-container.ub-notify-container .toast.acu-toast.toast-info{
  background-color:transparent !important;
  background-image:linear-gradient(168deg,var(--ubn-bg1),var(--ubn-bg2)),
                    linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  background-clip:padding-box, border-box !important;
  background-origin:padding-box, border-box !important;
  background-repeat:no-repeat !important;
  background-position:0 0 !important;
  border-left:none !important;
}
#toast-container.ub-notify-container .toast.acu-toast.toast-warning{
  --ub-ntf-rs:#eec27a !important; --ub-ntf-re:#c9802a !important; --ub-ntf-rg:rgba(232,178,95,.32) !important;
  background-color:transparent !important;
  background-image:linear-gradient(168deg,var(--ubn-warn1),var(--ubn-warn2)),
                    linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  background-clip:padding-box, border-box !important;
  background-origin:padding-box, border-box !important;
  background-repeat:no-repeat !important;
  background-position:0 0 !important;
  border-left:none !important;
}
#toast-container.ub-notify-container .toast.acu-toast.toast-error{
  --ub-ntf-rs:#efa0a0 !important; --ub-ntf-re:#cc4444 !important; --ub-ntf-rg:rgba(240,154,154,.3) !important;
  background-color:transparent !important;
  background-image:linear-gradient(168deg,var(--ubn-err1),var(--ubn-err2)),
                    linear-gradient(145deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  background-clip:padding-box, border-box !important;
  background-origin:padding-box, border-box !important;
  background-repeat:no-repeat !important;
  background-position:0 0 !important;
  border-left:none !important;
}
/* 图标 1,3,1（基）+ 1,4,1（类型）：压插件 1,2,1 的 达/知/警/误 26px 方块，复用我们 ✓/✕/!/i 15px 圆 */
#toast-container.ub-notify-container .toast.acu-toast::before{
  content:"" !important; position:absolute !important; left:10px !important; top:9px !important;
  width:15px !important; height:15px !important; border-radius:50% !important;
  display:flex !important; align-items:center; justify-content:center;
  font-size:9.5px !important; font-weight:700 !important; line-height:1 !important;
  background:transparent !important;
  border:none !important; box-shadow:none !important; filter:none !important;
  transform:none !important;
}
#toast-container.ub-notify-container .toast.acu-toast.toast-success::before{content:"✓" !important;color:var(--ubn-ok) !important;background:var(--ubn-ok-bg) !important;box-shadow:inset 0 0 0 1px var(--ubn-ok-ring) !important;}
#toast-container.ub-notify-container .toast.acu-toast.toast-error::before{content:"✕" !important;color:var(--ubn-err) !important;background:var(--ubn-err-bg) !important;box-shadow:inset 0 0 0 1px var(--ubn-err-ring) !important;}
#toast-container.ub-notify-container .toast.acu-toast.toast-warning::before{content:"!" !important;color:var(--ubn-warn) !important;background:var(--ubn-warn-bg) !important;box-shadow:inset 0 0 0 1px var(--ubn-warn-ring) !important;}
#toast-container.ub-notify-container .toast.acu-toast.toast-info::before{content:"i" !important;color:var(--ubn-info) !important;background:var(--ubn-info-bg) !important;box-shadow:inset 0 0 0 1px var(--ubn-info-ring) !important;}
/* 标题/正文 1,3,0：压插件 .acu-toast.toast .toast-{title,message} (0,3,0) */
#toast-container.ub-notify-container .toast.acu-toast .toast-title{
  font-weight:600 !important; font-size:12.5px !important; line-height:1.35 !important;
  margin:0 0 1px !important; color:var(--ubn-ink) !important; text-align:left !important;
  letter-spacing:normal !important; text-shadow:none !important; background:transparent !important;
}
#toast-container.ub-notify-container .toast.acu-toast.toast-warning .toast-title{color:var(--ubn-warn-ink) !important;}
#toast-container.ub-notify-container .toast.acu-toast.toast-error .toast-title{color:var(--ubn-err-ink) !important;}
#toast-container.ub-notify-container .toast.acu-toast .toast-message{
  font-size:12px !important; line-height:1.45 !important; margin:0 !important;
  color:var(--ubn-ink2) !important; text-align:left !important;
  font-weight:400 !important; letter-spacing:normal !important; text-shadow:none !important;
  background:transparent !important; -webkit-font-smoothing:antialiased;
  word-break:break-word; white-space:pre-line;
}
/* 关闭钮 1,3,0：压插件 .acu-toast.toast .toast-close-button (0,3,0) */
#toast-container.ub-notify-container .toast.acu-toast .toast-close-button{
  position:absolute !important; top:5px !important; right:6px !important;
  width:14px !important; height:14px !important;
  border:none !important; background:transparent !important;
  color:var(--ubn-ink) !important; opacity:.38 !important; cursor:pointer !important;
  font-size:11px !important; line-height:1 !important; text-shadow:none !important;
  display:flex !important; align-items:center; justify-content:center;
  border-radius:4px !important; padding:0 !important;
}
#toast-container.ub-notify-container .toast.acu-toast .toast-close-button:hover{opacity:1 !important;background:var(--ubn-close-hover) !important;}
/* 进度条：插件 progressBar:true 生 .toast-progress（包装器未就绪时不走 .ub-ntf-bar）→ 复用为我们的倒计时条配色 */
#toast-container.ub-notify-container .toast .toast-progress{
  background:linear-gradient(90deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  height:2px !important; opacity:.75;
}
/* 正文内按钮（终止/重新优化等：.qrf-abort-btn、acu-stop-*、acu-opt-toast-reoptimize）：
   插件给的是内联样式琥珀描边小按钮，此统一改皮肤次级按钮（1,3,1 + !important 压内联 style）。
   hover 1,4,1 填充主题渐变。 */
#toast-container.ub-notify-container .toast .toast-message button{
  display:inline-block; vertical-align:middle; margin:2px 0 1px 8px;
  padding:2px 10px !important;
  border-radius:6px !important;
  border:1px solid var(--ubn-ab-bd) !important;
  background:var(--ubn-ab-bg) !important;
  color:var(--ubn-ab-ink) !important;
  font-weight:600 !important;
  font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif !important;
  font-size:11px !important; letter-spacing:.04em;
  cursor:pointer !important; box-shadow:none !important; text-shadow:none !important;
  float:none !important; transition:background .15s ease,border-color .15s ease,color .15s ease;
}
#toast-container.ub-notify-container .toast .toast-message button:hover{
  background:linear-gradient(135deg,var(--ub-ntf-rs),var(--ub-ntf-re)) !important;
  border-color:transparent !important;
  color:var(--ubn-ab-ink2) !important;
}
#toast-container.ub-notify-container .toast .toast-message button:focus-visible{
  outline:2px solid var(--ub-ntf-rs) !important; outline-offset:1px;
}

/* ===== reduced motion ===== */
@media (prefers-reduced-motion: reduce){
  #toast-container.ub-notify-container .toast .ub-ntf-bar{animation:none;width:100%;opacity:.5;}
  #toast-container.ub-notify-container .toast{transition:none;}
}

/* ===== 移动端视口纪律：100dvh、width 100% 非 100vw（SillyTavern transform 压扁 fixed）===== */
@media (max-width: 599px){
  #toast-container.ub-notify-container{max-width:calc(100% - 24px);}
  #toast-container.ub-notify-container.ub-align-center{left:12px;right:12px;transform:none;max-width:none;}
  #toast-container.ub-notify-container .toast{max-width:100% !important;}
}
`;

// ===== 注入到 parent.document.head（一次性）=====
let _notifyCssInjected = false;
// 通知美化总开关标志。true=包装器走美化路径（注入倒计时条+容器类+ACU剥离+单行合并+进度压缩）；
// false=包装器直接透传 orig（不注入任何美化 DOM/类）。setNotifyBeautifyEnabled 切换。
let _notifyBeautifyOn = true;
function _parentDoc(): Document {
  try { if ((window as any).parent && (window.parent as any).document) return (window.parent as any).document; } catch { /* cross-origin */ }
  return document;
}
function _getToastr(): any {
  try { return (window as any).toastr || (window.parent as any).toastr; } catch { return null; }
}

export function injectNotifyCSS(): void {
  if (_notifyCssInjected) return;
  const doc = _parentDoc();
  if (doc.getElementById('ub-notify-base-css')) { _notifyCssInjected = true; _wrapToastr(); _installContainerObserver(); return; }
  const style = doc.createElement('style');
  style.id = 'ub-notify-base-css';
  style.textContent = notifyBaseCSS;
  doc.head.appendChild(style);
  _notifyCssInjected = true;
  _wrapToastr();
  _installContainerObserver();
}

// ═══════════════════════════════════════════════════════════════
// 单行合并 + ACU 进度压缩（纯函数，tests/notify-oneline-acu.test.cjs 锁契约）
// ═══════════════════════════════════════════════════════════════

/** 加权长度：CJK/全角=1，其余=0.5（粗略估宽，阈值判断用） */
function _wlen(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) || 0;
    n += (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x3000 && cp <= 0x303f) ? 1 : 0.5;
  }
  return n;
}

export type ToastOnelinePlan = { mode: 'none' | 'drop-title' };

/**
 * 例行通知单行化决策（「能一排就一排」· 三轮改纯 CSS）：
 * 酒馆 toastr 开 escapeHtml（实测），message 注入 HTML 会原样显示 → 禁止 HTML 内联。
 * 单行观感改由 CSS 承担：标题保持 toastr 原生 .toast-title 元素，display:inline 流入正文行首，
 * ::after 生成「·」分隔点，字号/字重/颜色区分（见基底 CSS「标题与正文」块）；本函数只负责去冗余标题：
 * - 错误 / 持久通知不动（标题独立成行，详情优先）；
 * - 正文含 HTML 疑似字符或多行时不动（信息量）；
 * - 正文已含标题（如 标题「地图」+ 正文「地图生成完成」）→ 去标题，避免「地图 · 地图生成完成」；
 * - 其余保持标题+正文原样（CSS 内联成一行）。
 */
export function planToastOneline(title: string, msg: string, opts: { persist: boolean; type: string }): ToastOnelinePlan {
  if (!title || !msg) return { mode: 'none' };
  if (opts.persist) return { mode: 'none' };
  if (opts.type === 'error') return { mode: 'none' };
  if (/[<>&]/.test(msg)) return { mode: 'none' };
  const trimmed = msg.trim();
  if (!trimmed || /\n/.test(trimmed)) return { mode: 'none' };
  if (trimmed.indexOf(title) !== -1) return { mode: 'drop-title' };
  return { mode: 'none' };
}

/** ACU 插件默认标题（旧版/新版），信息量为零，短通知下去除 */
const _ACU_TITLES = ['SP·数据库', '神·数据库'];

/** ACU 填表/规划进度文案压缩（保留 第几批/第几次重试 关键信息；错误类原文保留） */
export function compressAcuProgressText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  const t = text.trim();
  // 批次型：第 X/Y 批：<phase 文案>
  let m = t.match(/^第\s*(\d+)\/(\d+)\s*批[：:]\s*(.*)$/);
  if (m) {
    const b = `${m[1]}/${m[2]}`, rest = m[3];
    let mm = rest.match(/^第\s*(\d+)\/(\d+)\s*次调用AI进行增量更新\.*$/);
    if (mm) return `填表 ${b} · 调用 ${mm[1]}/${mm[2]}`;
    if (/^准备AI输入\.*$/.test(rest)) return `填表 ${b} · 准备输入`;
    if (/^解析并应用AI返回的更新\.*$/.test(rest)) return `填表 ${b} · 解析中`;
    if (/^正在将更新后的数据库保存到聊天记录\.*$/.test(rest)) return `填表 ${b} · 保存中`;
    if (/^分块处理成功\.*$/.test(rest)) return `填表 ${b} · 分块完成`;
    if (/^数据库增量更新成功！$/.test(rest)) return `填表 ${b} · 完成`;
    mm = rest.match(/^第\s*(\d+)\/(\d+)\s*次尝试失败，\d+秒后重试\.*(?:\s*\(.*\))?\s*$/);
    if (mm) return `填表 ${b} · 重试 ${mm[1]}/${mm[2]}`;
    if (/^错误：更新失败。$/.test(rest)) return text; // 错误详情保留原文
    if (/^正在处理\.*$/.test(rest)) return `填表 ${b} · 处理中`;
    return text;
  }
  // 无批次号变体
  m = t.match(/^当前批次[：:]\s*(.*)$/);
  if (m) return `填表 · ${compressAcuProgressText(`第 0/0 批：${m[1]}`).replace(/^填表 0\/0 · /, '')}`;
  // 起止/终止类
  if (/^自动填表正在准备，请稍候\.*$/.test(t)) return '自动填表 · 准备中';
  if (/^手动填表开始。$/.test(t)) return '手动填表 · 开始';
  if (/^填表任务已终止，正在停止当前任务与后续批次\.*$/.test(t)) return '填表已终止 · 停止中';
  if (/^手动填表已终止，正在停止当前任务与后续批次\.*$/.test(t)) return '手动填表已终止 · 停止中';
  if (/^手动追平已终止，正在等待当前安全边界收敛\.*$/.test(t)) return '追平已终止 · 收敛中';
  if (/^正在读取过往的记忆并分析，请稍后\.*$/.test(t)) return '剧情规划 · 分析中';
  if (/^规划任务已被用户中止。$/.test(t)) return '规划任务已中止';
  // 计划播报（瞬态 info）
  m = t.match(/^检测到 (\d+) 个表格需要更新，将分批并发处理 (\d+) 组（每批最多 \d+ 组）。$/);
  if (m) return `${m[1]} 表待更新 · ${m[2]} 组分批`;
  m = t.match(/^检测到 (\d+) 个表格需要更新，将并发处理 (\d+) 组。$/);
  if (m) return `${m[1]} 表待更新 · ${m[2]} 组并发`;
  return text;
}

/** ACU HTML 消息内的进度 span 文本压缩（acu-toast-progress-message / toastr-message 两种壳） */
function _compressAcuHtml(html: string): string {
  let out = html.replace(/(<span\s+class="acu-toast-progress-message">)([\s\S]*?)(<\/span>)/, (_a, a, b, c) => a + compressAcuProgressText(b) + c);
  out = out.replace(/(<span\s+class="toastr-message"[^>]*>)([^<]*)(<\/span>)/, (_a, a, b, c) => a + compressAcuProgressText(b) + c);
  return out;
}

function _isShortSingleLine(s: string): boolean {
  if (typeof s !== 'string' || !s) return false;
  const t = s.replace(/<[^>]*>/g, '').trim();
  return !!t && t.indexOf('\n') === -1 && _wlen(t) <= 24;
}

/** ACU 进度 span 持续压缩：插件用 .text() 直更 DOM 绕过包装器，须 MutationObserver 跟写（随节点销毁失效，无泄漏） */
function _installAcuProgressCompressor(toast: HTMLElement): void {
  try {
    const span = toast.querySelector('.acu-toast-progress-message');
    if (!span) return;
    const apply = () => {
      const cur = span.textContent || '';
      const c = compressAcuProgressText(cur);
      if (c !== cur) span.textContent = c;
    };
    apply();
    const win = toast.ownerDocument && (toast.ownerDocument.defaultView as any);
    if (!win || !win.MutationObserver) return;
    const obs = new win.MutationObserver(apply);
    obs.observe(span, { childList: true, characterData: true, subtree: true });
  } catch { /* ignore */ }
}

// ===== toastr 方法包装：单行合并 + ACU 压缩 + 倒计时条注入 =====
// 一次性包装 success/info/warning/error；克隆 opts 避免污染共享对象（如 PERSIST_OPTS）；
// 链式保留调用方原 onShown；全程 try/catch 兜底回退到原方法。未触发 toastr 时零开销。
let _toastrWrapped = false;
function _wrapToastr(): void {
  if (_toastrWrapped) return;
  const toastr = _getToastr();
  if (!toastr) return;
  _toastrWrapped = true;
  const methods = ['success', 'info', 'warning', 'error'] as const;
  for (const k of methods) {
    if (typeof toastr[k] !== 'function') continue;
    const orig = toastr[k];
    toastr[k] = function (msg: any, title: any, opts?: any) {
      if (!_notifyBeautifyOn) return orig.call(this, msg, title, opts);
      try {
        _ensureNotifyClasses(); // 每次 toast 调用前确保容器带当前主题/对齐/皮肤类（包在 try 内：异常回退原 opts，绝不向调用方抛错）
        const baseOpts = opts && typeof opts === 'object' ? opts : {};
        const defaultTimeOut = (typeof toastr.options?.timeOut === 'number') ? toastr.options.timeOut : 5000;
        const tOut = (typeof baseOpts.timeOut === 'number') ? baseOpts.timeOut : defaultTimeOut;
        const isPersist = tOut <= 0;
        // 克隆 opts，避免给共享对象（PERSIST_OPTS）挂 onShown
        const o: any = Object.assign({}, baseOpts);
        // 劫持数据库插件（ACU）toast：剥离 acu-toast* 类（其 CSS 带 !important 会盖过我们的壳），
        // 关闭其内置 progressBar（我们用 .ub-ntf-bar 倒计时条，避免双条）。
        const _tc = typeof o.toastClass === 'string' ? o.toastClass : '';
        const isAcu = _tc.indexOf('acu-toast') !== -1;
        let m = msg;
        let t = title;
        let acuProgress = false;
        if (isAcu) {
          o.toastClass = _tc.split(/\s+/).filter((c: string) => c && c.indexOf('acu-toast') !== 0).join(' ').trim() || 'toast';
          o.progressBar = false;
          if (typeof m === 'string') {
            if (m.indexOf('acu-toast-progress-message') !== -1 || m.indexOf('toastr-message') !== -1) {
              acuProgress = true;
              m = _compressAcuHtml(m);
            } else {
              m = compressAcuProgressText(m);
            }
          }
          // ACU 默认标题信息量为零：短单行下去除（错误长文保留标题定位模块）
          if (typeof t === 'string' && _ACU_TITLES.indexOf(t.trim()) !== -1 && (acuProgress || _isShortSingleLine(String(m)))) {
            t = undefined;
          }
        } else if (k !== 'error') {
          // 例行通知去冗余标题（单行观感由 CSS display:inline 承担，禁 HTML 注入——酒馆 toastr escapeHtml:true）
          const plan = planToastOneline(typeof t === 'string' ? t : '', typeof m === 'string' ? m : '', { persist: isPersist, type: k });
          if (plan.mode === 'drop-title') {
            t = undefined;
          }
        }
        const prevOnShown = o.onShown;
        const wantBar = !isPersist && typeof tOut === 'number' && tOut > 0;
        if (wantBar || acuProgress) {
          // jQuery 以 resolveWith(elem,[animation]) 调用动画 complete：this=toast 元素，首参是 Animation 对象
          // （无 querySelector，曾按首参取元素→必然抛错被吞→倒计时条/ACU 跟写观察器从未装上）。
          o.onShown = function (this: any, _anim: any) {
            try {
              const toast: any = (this && typeof this.querySelector === 'function') ? this
                : (_anim && typeof _anim.querySelector === 'function') ? _anim : null;
              if (wantBar && toast && !toast.querySelector('.ub-ntf-bar')) {
                const bar = toast.ownerDocument.createElement('div');
                bar.className = 'ub-ntf-bar';
                bar.style.animationDuration = tOut + 'ms';
                toast.appendChild(bar);
              }
              if (acuProgress && toast) _installAcuProgressCompressor(toast);
            } catch { /* ignore */ }
            if (typeof prevOnShown === 'function') { try { prevOnShown.apply(this, arguments); } catch { /* ignore */ } }
          };
        }
        return orig.call(this, m, t, o);
      } catch {
        return orig.call(this, msg, title, opts);
      }
    };
  }
}

// ===== 应用主题 + 对齐 + 皮肤：同步已存 toastr 容器的 ub-* 类（不写 toastr.options.positionClass）=====
let _curNotifyCls = '';

// 确保父文档 toastr 容器带当前主题/对齐/皮肤类（防酒馆/数据库插件重置 positionClass 致丢类）。
// 只动容器 classList，绝不写 toastr.options.positionClass（其须为单类，写多类串会污染酒馆共享
// toastr 选项致 getContainer 失败、每次 toast 新建 #toast-container，并可能让调用方抛错）。
// 容器被 toastr 重建时由 body 观察器回调重新补 ub-* 类。循环安全：仅当 ub-* 类与目标不一致才写。
function _ensureNotifyClasses(): void {
  if (!_curNotifyCls) return;
  const doc = _parentDoc();
  const container = doc.getElementById('toast-container');
  if (container) {
    const desired = _curNotifyCls.split(' ').filter(Boolean);
    const desiredSet = new Set(desired);
    const currentUb = Array.from(container.classList).filter((c) => c.indexOf('ub-') === 0);
    const currentSet = new Set(currentUb);
    const same = currentUb.length === desired.length && currentUb.every((c) => desiredSet.has(c)) && desired.every((c) => currentSet.has(c));
    if (!same) {
      for (const c of currentUb) if (!desiredSet.has(c)) container.classList.remove(c);
      for (const c of desired) if (!currentSet.has(c)) container.classList.add(c);
    }
  }
}

// ===== MutationObserver 安全网：toastr 可能因 positionClass 变更重建/改类 #toast-container，
// 确保容器始终带我们的主题/对齐/皮肤类——这样数据库插件等第三方 toast 也套上我们的壳。
// 事件驱动（非轮询），窄范围观察 body childList + 容器 class；未触发 toastr 时零开销。
let _bodyObserver: MutationObserver | null = null;
let _containerObserver: MutationObserver | null = null;
function _observeContainerClass(container: Element): void {
  if (_containerObserver) { try { _containerObserver.disconnect(); } catch { /* ignore */ } _containerObserver = null; }
  const win = _parentDoc().defaultView as any;
  if (!win || !win.MutationObserver) return;
  const obs = new win.MutationObserver(() => _ensureNotifyClasses());
  _containerObserver = obs;
  obs.observe(container, { attributes: true, attributeFilter: ['class'] });
}
function _installContainerObserver(): void {
  const doc = _parentDoc();
  const win = doc.defaultView as any;
  if (!win || !win.MutationObserver) return;
  const body = doc.body;
  if (!body) return;
  // 重启用（整段脚本重跑 → 新模块实例、_bodyObserver 重置为 null）时旧实例的观察器仍挂父页 body，
  // 且旧闭包 _curNotifyCls 会过期（换主题后旧闭包会把过期类补回容器）。window 级引用跨重跑存活：
  // 先断开旧实例再装新，既防堆叠又清掉旧闭包。同实例幂等（_bodyObserver === prev）时零操作。
  const prev = win.__ub_notify_body_observer as MutationObserver | null | undefined;
  if (_bodyObserver && prev === _bodyObserver) return;
  if (prev) { try { prev.disconnect(); } catch { /* ignore */ } }
  const obs = new win.MutationObserver(() => {
    const container = doc.getElementById('toast-container');
    if (container) { _ensureNotifyClasses(); _observeContainerClass(container); }
  });
  _bodyObserver = obs;
  win.__ub_notify_body_observer = obs;
  obs.observe(body, { childList: true, subtree: false });
  const existing = doc.getElementById('toast-container');
  if (existing) { _ensureNotifyClasses(); _observeContainerClass(existing); }
}

/** 通知效果四档（与 config-store NotifyEffect 对齐；缺省 auto 保持旧行为兼容） */
export type NotifyEffectMode = 'porcelain' | 'inkglass' | 'auto' | 'original';

/**
 * 切换通知美化（四档）。
 * enabled=false（= original 原版）：移除已注入 CSS + 移除容器 ub-* 类 + 断开观察器 + 标志置 false（包装器透传）。
 * enabled=true：注入 CSS + 包装 toastr + 装/复用观察器 + 应用 ub-* 容器类。
 *   皮肤：porcelain→素瓷(light)；inkglass→云墨(dark)；auto→按 isDark（index.ts 读 darkTheme）轻素瓷深云墨。
 * style/align/isDark 仅在 enabled=true 时用于 _curNotifyCls。
 */
export function setNotifyBeautifyEnabled(enabled: boolean, style: StyleType, align: NotifyAlign, effect?: NotifyEffectMode, isDark?: boolean): void {
  _notifyBeautifyOn = enabled;
  if (enabled) {
    injectNotifyCSS();
    _wrapToastr(); // 重试包装：toastr 若晚于 init 就绪，下次补上
    _installContainerObserver(); // 重试观察器：parent.body 若晚于 init 就绪，下次补上
    const eff: NotifyEffectMode = effect === 'porcelain' || effect === 'inkglass' || effect === 'auto' || effect === 'original' ? effect : 'auto';
    const dark = eff === 'inkglass' || (eff === 'auto' && isDark === true);
    _curNotifyCls = `ub-notify-container ub-theme-${style} ub-align-${align} ub-skin-${dark ? 'dark' : 'light'}`;
    _ensureNotifyClasses();
  } else {
    const doc = _parentDoc();
    const styleEl = doc.getElementById('ub-notify-base-css');
    if (styleEl) styleEl.remove();
    const container = doc.getElementById('toast-container');
    if (container) {
      const ubClasses = Array.from(container.classList).filter((c) => c.indexOf('ub-') === 0);
      for (const c of ubClasses) container.classList.remove(c);
    }
    if (_bodyObserver) { try { _bodyObserver.disconnect(); } catch { /* ignore */ } _bodyObserver = null; }
    if (_containerObserver) { try { _containerObserver.disconnect(); } catch { /* ignore */ } _containerObserver = null; }
    // 清 window 级观察器引用：允许关闭后重开时干净重装（_installContainerObserver 会断开旧实例）
    try { const _w = _parentDoc().defaultView as any; if (_w) _w.__ub_notify_body_observer = null; } catch { /* ignore */ }
    _curNotifyCls = '';
    _notifyCssInjected = false; // 允许再次注入
    // _toastrWrapped 保持 true（若已装）；包装器靠 _notifyBeautifyOn 透传。
    // 若从未装（toastr 一直未就绪），原版下也不需要装——纯原生。
  }
}
