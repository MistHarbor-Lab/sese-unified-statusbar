// ===== 货币弹窗样式（对齐 claude_memory/currency-system.md 钱包场景；历史 mockup 已清理）=====
// 结构契约：壳复用 panel-popup（bridge 走 bridgeWindowClass），本样式只管 .ub-wallet body；
// 分风格 = 一张 CSS 变量皮肤表（§3.1），币种图标不随主题变；深浅色由弹窗 overlay 的
// syncDarkClass 链路自动覆盖 --ub-* 桥接变量（皮肤变量独立于明暗，仅在浅色基线出值）。
export const CURRENCY_POPUP_CSS = /* css */ `
/* ═══ 钱包 body（基线 = 灵动玻璃） ═══ */
.ub-wallet{
  --wk-bg:#f7f8fa;--wk-head:#ffffff;--wk-line:#eceef2;--wk-line-2:#eef0f4;
  --wk-text:#1c1c1e;--wk-sub:#9aa0ab;
  --wk-accent:#2fa47e;--wk-accent-deep:#28926f;--wk-accent-soft:rgba(47,164,126,.09);
  --wk-panel:#ffffff;--wk-gold:rgba(232,162,19,.09);
  --wk-radius:14px;--wk-btn:#f0f1f4;--wk-btn-text:#57606e;
  background:var(--wk-bg);color:var(--wk-text);border-radius:var(--wk-radius);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei UI","Segoe UI",system-ui,sans-serif;
  padding:0 14px 12px;
}
.ub-wallet .wk-head{display:flex;align-items:center;gap:8px;padding:12px 2px 9px;border-bottom:1px solid var(--wk-line)}
.ub-wallet .wk-sub{flex:1;font-size:10.5px;color:var(--wk-sub);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ub-wallet .wk-btn{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;border-radius:9px;padding:7px 12px;transition:.15s;flex:none;cursor:pointer;border:none;color:inherit;background:none}
.ub-wallet .wk-btn.ai{background:var(--wk-accent);color:var(--wk-accent-fg,#fff)}
.ub-wallet .wk-btn.ai:hover{background:var(--wk-accent-deep)}
.ub-wallet .wk-btn.ai:disabled{opacity:.6;cursor:wait}
.ub-wallet .wk-btn.new{background:var(--wk-btn);color:var(--wk-btn-text)}
.ub-wallet .wk-btn.new:hover{filter:brightness(.96)}
.ub-wallet .wk-cur{display:flex;align-items:center;gap:11px;padding:12px 8px;border-bottom:1px solid var(--wk-line-2)}
.ub-wallet .wk-cur.wk-primary{background:var(--wk-primary-tint,var(--wk-gold));border-radius:10px;border-bottom-color:transparent;margin-bottom:2px}
.ub-wallet .wk-icon{cursor:pointer;border-radius:50%;transition:.15s;flex:none;display:inline-flex}
.ub-wallet .wk-icon:hover{transform:scale(1.08)}
.ub-wallet .wk-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex:none}
.ub-wallet .wk-info{flex:1;min-width:0;cursor:pointer}
.ub-wallet .wk-info b{font-size:14.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ub-wallet .wk-subline{font-size:11px;color:var(--wk-sub);margin-top:2px;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.ub-wallet .wk-ptag{font-size:10px;font-weight:700;color:#b07a10;background:rgba(232,162,19,.15);border-radius:5px;padding:1.5px 6px;flex:none}
.ub-wallet .wk-negtag{font-size:10px;font-weight:700;color:#d5402f;background:rgba(255,59,48,.12);border-radius:5px;padding:1.5px 6px;flex:none}
.ub-wallet .wk-qty{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.3px;cursor:pointer;padding:3px 8px;border-radius:8px;transition:.15s;flex:none}
.ub-wallet .wk-qty:hover{background:var(--wk-accent-soft)}
.ub-wallet .wk-qty.neg{color:#e0483c}
.ub-wallet .wk-star,.ub-wallet .wk-del{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;transition:.15s;flex:none;cursor:pointer;border:none;background:none;color:#c2c6cf;font-size:15px}
.ub-wallet .wk-star:hover,.ub-wallet .wk-del:hover{background:var(--wk-btn)}
.ub-wallet .wk-star.on{color:#e8a213;background:rgba(232,162,19,.12)}
.ub-wallet .wk-del:hover{color:#d5402f;background:rgba(255,59,48,.09)}
/* 内嵌编辑面板（AI 提案 / 新建 / 调账 / 图标选择共用外壳） */
.ub-wallet .wk-panel{margin:10px 0 4px;background:var(--wk-panel);border:1.5px solid var(--wk-accent);border-radius:14px;padding:13px 14px;animation:wk-pop .22s ease}
.ub-wallet .wk-panel .wk-ptitle{font-size:13.5px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ub-wallet .wk-panel .wk-phint{font-size:11px;color:var(--wk-sub);margin-bottom:10px;line-height:1.7}
.ub-wallet .wk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:9px}
.ub-wallet .wk-row label{font-size:12px;color:var(--wk-sub);flex:none}
.ub-wallet .wk-input{border:1.5px solid var(--wk-line);border-radius:9px;padding:7px 10px;font-size:13px;outline:none;background:var(--wk-panel);color:inherit;transition:.15s;font-family:inherit}
.ub-wallet .wk-input:focus{border-color:var(--wk-accent)}
.ub-wallet .wk-actions{display:flex;gap:8px;margin-top:13px}
.ub-wallet .wk-mini{font-size:12px;font-weight:600;border-radius:8px;padding:6px 12px;background:var(--wk-btn);color:var(--wk-btn-text);transition:.15s;cursor:pointer;border:none}
.ub-wallet .wk-mini:hover{filter:brightness(.96)}
.ub-wallet .wk-mini.pri{background:var(--wk-accent);color:#fff}
/* AI 提案卡 */
.ub-wallet .wk-prop{display:flex;gap:10px;align-items:flex-start;border:1.5px solid var(--wk-line);border-radius:12px;padding:11px 12px;margin-top:9px;transition:.15s}
.ub-wallet .wk-prop.pick{border-color:var(--wk-accent);background:var(--wk-accent-soft)}
.ub-wallet .wk-prop.exists{opacity:.55}
.ub-wallet .wk-prop input{margin-top:3px;accent-color:var(--wk-accent);flex:none}
.ub-wallet .wk-prop .wk-pbody{flex:1;min-width:0}
.ub-wallet .wk-prop .wk-pbody b{font-size:13.5px}
.ub-wallet .wk-prop .wk-pbody .wk-pdesc{font-size:11.5px;color:var(--wk-sub);line-height:1.6;margin-top:2px}
.ub-wallet .wk-prop .wk-pbody .wk-pmeta{font-size:10.5px;color:var(--wk-sub);opacity:.75;margin-top:4px}
/* 图标选择器 */
.ub-wallet .wk-icon-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:4px 0}
.ub-wallet .wk-icon-cell{display:flex;flex-direction:column;align-items:center;gap:5px;border:1.5px solid var(--wk-line);border-radius:11px;padding:9px 2px 6px;cursor:pointer;transition:.15s;font-size:9.5px;color:var(--wk-sub);background:none}
.ub-wallet .wk-icon-cell:hover{border-color:var(--wk-accent)}
.ub-wallet .wk-icon-cell.on{border-color:var(--wk-accent);background:var(--wk-accent-soft)}
/* 流水 */
.ub-wallet .wk-sect{display:flex;align-items:center;gap:8px;padding:14px 2px 8px;font-size:12px;font-weight:700;color:var(--wk-sub);letter-spacing:1px}
.ub-wallet .wk-sect::after{content:"";flex:1;height:1px;background:var(--wk-line)}
.ub-wallet .wk-sect .wk-sect-hint{font-size:11px;font-weight:400;letter-spacing:0;opacity:.75}
.ub-wallet .wk-ledger{max-height:248px;overflow-y:auto;padding:0 2px 8px}
.ub-wallet .wk-ledger::-webkit-scrollbar{width:5px}
.ub-wallet .wk-ledger::-webkit-scrollbar-thumb{background:var(--wk-line);border-radius:3px}
/* user-select:none：移动端长按删除不能被浏览器的选词手势抢走（选词会让长按计时随 pointercancel 取消） */
.ub-wallet .wk-led{display:flex;align-items:center;gap:10px;padding:9px 6px;border-radius:10px;user-select:none;-webkit-user-select:none}
.ub-wallet .wk-led:hover{background:var(--wk-panel)}
.ub-wallet .wk-led .wk-ledsrc{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.ub-wallet .wk-led .wk-ledmain{flex:1;min-width:0}
.ub-wallet .wk-led .wk-ledmain b{font-size:13px;font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ub-wallet .wk-led .wk-ledmain span{font-size:11px;color:var(--wk-sub)}
.ub-wallet .wk-led .wk-ledamt{font-size:14.5px;font-weight:800;font-variant-numeric:tabular-nums;flex:none}
.ub-wallet .wk-led .wk-ledamt.in{color:#2e9e52}
.ub-wallet .wk-led .wk-ledamt.out{color:#e0483c}
.ub-wallet .wk-empty{padding:44px 20px;text-align:center;color:var(--wk-sub);font-size:13px;line-height:2}
@keyframes wk-pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ═══ 分风格皮肤（7 风格全量；ios=基线） ═══ */
.ub-wallet[data-skin="ancient"]{
  --wk-bg:#f6f0e1;--wk-head:#fbf6e9;--wk-line:#e0d4b8;--wk-line-2:#e6dcc4;
  --wk-text:#42392c;--wk-sub:#98876a;
  --wk-accent:#8c3a28;--wk-accent-deep:#753021;--wk-accent-soft:rgba(140,58,40,.10);
  --wk-panel:#fbf7ec;--wk-gold:rgba(176,141,60,.14);
  --wk-radius:8px;--wk-btn:#efe6d0;--wk-btn-text:#6b5c3e;
  font-family:"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif;
}
.ub-wallet[data-skin="ancient"] .wk-ptitle{font-family:"Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi",cursive;font-size:16px;letter-spacing:2px}
.ub-wallet[data-skin="xianxia"]{
  --wk-bg:#1d2430;--wk-head:#232c3b;--wk-line:#32405a;--wk-line-2:#2c3850;
  --wk-text:#dfe6f2;--wk-sub:#8b98b0;
  --wk-accent:#4fd1a5;--wk-accent-deep:#3cba8f;--wk-accent-soft:rgba(79,209,165,.10);
  --wk-panel:#212a38;--wk-gold:rgba(79,209,165,.08);
  --wk-radius:14px;--wk-btn:#2a3548;--wk-btn-text:#c7d2e4;
  font-family:"Noto Serif SC","Source Han Serif SC","Songti SC",serif;
}
.ub-wallet[data-skin="xianxia"] .wk-ptag{color:#ffd98a}
.ub-wallet[data-skin="xianxia"] .wk-prop{background:transparent}
.ub-wallet[data-skin="sweet"]{
  --wk-bg:#fff5f8;--wk-head:#ffffff;--wk-line:#f3d9e2;--wk-line-2:#f6e2ea;
  --wk-text:#5c4450;--wk-sub:#b390a0;
  --wk-accent:#e5698f;--wk-accent-deep:#d5557c;--wk-accent-soft:rgba(229,105,143,.10);
  --wk-panel:#fffdfd;--wk-gold:rgba(229,105,143,.10);
  --wk-radius:22px;--wk-btn:#fbe9ef;--wk-btn-text:#a4627c;
}
.ub-wallet[data-skin="minimal"]{
  --wk-bg:#ffffff;--wk-head:#ffffff;--wk-line:#e5e5e5;--wk-line-2:#eeeeee;
  --wk-text:#222222;--wk-sub:#999999;
  --wk-accent:#111111;--wk-accent-deep:#000000;--wk-accent-soft:rgba(0,0,0,.06);
  --wk-panel:#ffffff;--wk-gold:rgba(0,0,0,.05);
  --wk-radius:4px;--wk-btn:#f2f2f2;--wk-btn-text:#333333;
}
.ub-wallet[data-skin="flirtatious"]{
  --wk-bg:#fff5f8;--wk-head:#ffffff;--wk-line:#f6dbe4;--wk-line-2:#f9e4ec;
  --wk-text:#523440;--wk-sub:#b98ba0;
  --wk-accent:#d94f7e;--wk-accent-deep:#c23a69;--wk-accent-soft:rgba(217,79,126,.10);
  --wk-panel:#fffdfd;--wk-gold:rgba(217,79,126,.10);
  --wk-radius:20px;--wk-btn:#fae7ee;--wk-btn-text:#a05070;
}
.ub-wallet[data-skin="bridge"]{
  --wk-bg:#10161f;--wk-head:#141c28;--wk-line:#243447;--wk-line-2:#1e2b3b;
  --wk-text:#c9d6e8;--wk-sub:#6b7f99;
  --wk-accent:#37b8ff;--wk-accent-deep:#2a9fe0;--wk-accent-soft:rgba(55,184,255,.10);
  --wk-panel:#131b26;--wk-gold:rgba(55,184,255,.08);
  --wk-radius:6px;--wk-btn:#1a2534;--wk-btn-text:#9fb2c9;
  font-family:"Consolas","Cascadia Mono","Courier New",monospace;
}
.ub-wallet[data-skin="bridge"] .wk-ptitle{font-size:12px;letter-spacing:1px}

/* ═══ F37 钱包弹窗改版（2026-10-05 用户定稿）═══
   a 标题行合并：壳不再输出 panel-popup-head，标题/副题/两个按钮/关闭同一行；
   b 深色适配：5 张浅色皮肤各配一套深色（仙侠/舰桥本就深色，不动）；
   c 字号跟随：正文/数据文本/输入控件走「弹窗/设置面板字号」token（--ub-ui-font-*），
     标题、按钮、图标、结构性小标签保持固定（与设置里那条契约一致）；
   d 浑然一体：列表与流水同底连续，常用行整行浅底（不再是渐变卡片）；
   ★ 主色按钮文字色统一走 --wk-accent-fg —— 萦绕深色主色近白（#f0f0f0），白字压白底看不清（用户实测）。 */
.panel-popup[data-popup="currency"] .panel-popup-body{padding:0}
.ub-wallet{padding:0 14px 10px;--wk-primary-tint:var(--wk-gold)}
.ub-wallet .wk-head{gap:9px;padding:13px 2px 11px}
.ub-wallet .wk-head-icon{width:27px;height:27px;border-radius:9px;flex:none;display:inline-flex;align-items:center;justify-content:center;background:var(--wk-accent-soft);color:var(--wk-accent)}
.ub-wallet .wk-head-icon svg{width:16px;height:16px}
.ub-wallet .wk-title{font-size:var(--ub-popup-font-title,15px);font-weight:800;letter-spacing:.2px;flex:none;color:var(--wk-text)}
.ub-wallet .wk-head .wk-sub{font-size:10.5px;flex:1;min-width:0}
.ub-wallet .wk-head .wk-btn{padding:6px 10px}
.ub-wallet .wk-close{margin-left:2px}
/* c 字号跟随（只列正文/数据/输入控件；按钮 .wk-btn/.wk-mini、标题、★常用/欠款/收支流水 均不缩放） */
.ub-wallet .wk-info b{font-size:var(--ub-ui-font-14,14px)}
.ub-wallet .wk-subline{font-size:var(--ub-ui-font-11,11px)}
.ub-wallet .wk-qty{font-size:calc(var(--ub-ui-font-14,14px) * 1.36)}
.ub-wallet .wk-led .wk-ledmain b{font-size:var(--ub-ui-font-13,13px)}
.ub-wallet .wk-led .wk-ledmain span{font-size:var(--ub-ui-font-11,11px)}
.ub-wallet .wk-led .wk-ledamt{font-size:calc(var(--ub-ui-font-14,14px) * 1.04)}
.ub-wallet .wk-empty{font-size:var(--ub-ui-font-13,13px)}
.ub-wallet .wk-phint{font-size:var(--ub-ui-font-11,11px)}
.ub-wallet .wk-input{font-size:var(--ub-ui-font-13,13px)}
.ub-wallet .wk-row label{font-size:var(--ub-ui-font-12,12px)}
/* d 浑然一体 */
.ub-wallet .wk-cur{padding:11px 6px;border-bottom:1px solid var(--wk-line-2)}
.ub-wallet .wk-sect{padding:13px 2px 6px}
/* ★ 主色按钮的浅底配深字（仙侠/舰桥皮肤本就存在同类对比度问题，一并修） */
.ub-wallet[data-skin="xianxia"]{--wk-accent-fg:#0d2b22}
.ub-wallet[data-skin="bridge"]{--wk-accent-fg:#06121c}
/* b 深色皮肤（值取自各风格状态栏既有深色变量；xianxia/bridge 不动） */
.panel-overlay.dark .ub-wallet[data-skin="ios"]{
  --wk-bg:#141416;--wk-head:#1a1a1c;--wk-line:#2c2c2e;--wk-line-2:#232325;
  --wk-text:#e8e8ea;--wk-sub:#8e8e93;
  --wk-accent:#34c77b;--wk-accent-deep:#2bb36d;--wk-accent-soft:rgba(52,199,123,.16);
  --wk-panel:#1c1c1e;--wk-gold:rgba(232,162,19,.14);
  --wk-btn:#232325;--wk-btn-text:#c7c7cc;--wk-primary-tint:rgba(52,199,123,.07);
}
.panel-overlay.dark .ub-wallet[data-skin="ancient"]{
  --wk-bg:#1e1810;--wk-head:#241d12;--wk-line:#3a2e1a;--wk-line-2:#322616;
  --wk-text:#e0c8a0;--wk-sub:#a09078;
  --wk-accent:#d9a05b;--wk-accent-deep:#c08a45;--wk-accent-soft:rgba(211,179,107,.14);
  --wk-panel:#241d12;--wk-gold:rgba(176,141,60,.18);
  --wk-btn:#2a2216;--wk-btn-text:#cbae82;--wk-primary-tint:rgba(176,141,60,.12);
}
.panel-overlay.dark .ub-wallet[data-skin="sweet"]{
  --wk-bg:#1a141c;--wk-head:#241c28;--wk-line:#3a2a38;--wk-line-2:#302230;
  --wk-text:#e8d8e0;--wk-sub:#b390a0;
  --wk-accent:#ff8fab;--wk-accent-deep:#e87a99;--wk-accent-soft:rgba(255,143,171,.14);
  --wk-panel:#241c28;--wk-gold:rgba(229,105,143,.16);
  --wk-btn:#2a1c28;--wk-btn-text:#c8a8b8;--wk-primary-tint:rgba(232,162,19,.10);
}
.panel-overlay.dark .ub-wallet[data-skin="minimal"]{
  --wk-bg:#141414;--wk-head:#1a1a1a;--wk-line:#2a2a2a;--wk-line-2:#232323;
  --wk-text:#f0f0f0;--wk-sub:#999999;
  --wk-accent:#f0f0f0;--wk-accent-deep:#ffffff;--wk-accent-soft:rgba(255,255,255,.08);
  --wk-accent-fg:#141414;
  --wk-panel:#1a1a1a;--wk-gold:rgba(255,255,255,.06);
  --wk-btn:#1f1f1f;--wk-btn-text:#cfcfcf;--wk-primary-tint:rgba(255,255,255,.05);
}
.panel-overlay.dark .ub-wallet[data-skin="flirtatious"]{
  --wk-bg:#1c1c1e;--wk-head:#242426;--wk-line:#38383a;--wk-line-2:#2c2c2e;
  --wk-text:#e8e8ea;--wk-sub:#b98ba0;
  --wk-accent:#ff89b3;--wk-accent-deep:#ffa0c4;--wk-accent-soft:rgba(255,137,179,.12);
  --wk-panel:#242426;--wk-gold:rgba(217,79,126,.18);
  --wk-btn:#2a2a2c;--wk-btn-text:#c8a8b8;--wk-primary-tint:rgba(217,79,126,.10);
}
`;
