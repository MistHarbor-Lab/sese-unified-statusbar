// ===== 带幂等注入的样式助手（第十一轮 F44）=====
// 现状病灶：采访/调查弹窗的大段 <style>（采访 ~120 行、调查另有七处主题样式）随每次
// 交互整窗 innerHTML 重建而被浏览器重新解析，正文滚动也随之重置。
// 改法对齐 achievement-notify.ts:9 的既有范式：样式内容是常量 ⇒ 注入一次常驻复用，
// 交互重建只重建正文。CSS 作用域不变——<style> 无论挂在 overlay 内还是 head，规则都是
// 文档级生效（原实现亦如此）。
// 零依赖：popup-manager / investigation-themed 收编调用；行为测试直连本模块。
export function ensureStyleOnce(id: string, css: string, doc?: Document): void {
  // U35：可选目标文档——成就通知注入**父文档**、正文图查看器注入**宿主文档**，规范口原先写死
  // document 是能力缺口不是收编障碍。缺省仍是当前 document；node 测试环境（无 DOM）安全降级。
  const d = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!d) return;
  if (d.getElementById(id)) return;
  const style = d.createElement('style');
  style.id = id;
  style.textContent = css;
  d.head.appendChild(style);
}

/** 由内容派生稳定 id：同内容幂等复用，不同内容各得其所（调查七主题各自一份）。 */
export function styleIdFromContent(prefix: string, css: string): string {
  let hash = 5381;
  for (let i = 0; i < css.length; i++) hash = ((hash * 33) ^ css.charCodeAt(i)) >>> 0;
  return `${prefix}-${css.length.toString(36)}-${hash.toString(36)}`;
}

/** 调查主题渲染器的便捷口：注入并返回 ''（保持 `return ivStyleOnce(css) + '<div…'` 的表达式形态）。 */
export function ivStyleOnce(css: string): string {
  ensureStyleOnce(styleIdFromContent('ub-ivt-style', css), css);
  return '';
}
