// 弹窗/设置字体角色化（仅古风/仙侠 include，追加在主题 CSS 末尾）。
// 三个 token 从 .ub-reading-shell 提升到 :root，供 body 下的弹窗/设置 overlay 引用；
// 收敛类只覆盖主题自有类（标题/标签/页签），独立 <style> 标签里的弹窗字体在各 -base 就地收敛。
export const literaryBaseCSS = /* css */ `
/* === 弹窗/设置字体角色化（literary-base v1）=== */
:root{
  --ub-font-ui:"Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",sans-serif;
  --ub-font-reading:"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif;
  --ub-font-display:"Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi",cursive;
}
/* 弹窗容器正文 → ui 黑体 */
.panel-popup,.settings-popup,.char-info-popup{font-family:var(--ub-font-ui)}
/* 弹窗/设置标题 → reading 宋体 +600（与角色心声 .ub-masthead-status/.ub-profile-thought 同字体同字重） */
.panel-popup-title,.settings-popup-title,.char-info-card-name{font-family:var(--ub-font-reading);font-weight:600}
/* 设置项标签 / 顶栏页签 → ui 黑体 */
.settings-label,.settings-tab{font-family:var(--ub-font-ui)}
/* === 货币资源行（古风/仙侠 masthead；货币系统） === */
/* F56(第十二轮)：三处硬编码深红 → 语义 token（古风/仙侠早已备好深色档 --ub-danger/--ub-accent）——
   深色底上原色对比度≈1.5:1：欠款数字看不清、hover 变暗到读不出、虚线提示消失。 */
.ub-masthead-resource.ub-currency-res{cursor:pointer;border-bottom:1px dashed color-mix(in srgb,var(--ub-danger) 45%,transparent);padding-bottom:1px;transition:color .15s}
.ub-masthead-resource.ub-currency-res:hover{color:var(--ub-accent)}
.ub-masthead-resource.ub-currency-res b.neg{color:var(--ub-danger)}
.ub-masthead-resource.ub-currency-res.ub-currency-empty{opacity:.55;border-bottom-style:dashed}
`;
