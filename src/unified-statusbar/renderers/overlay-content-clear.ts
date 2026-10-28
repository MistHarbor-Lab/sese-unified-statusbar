// ===== 弹窗关闭后的内容延迟清空（第十一轮 F38）=====
// 现状病灶：closePanelOverlay 只摘 .show，最后一个弹窗的整棵 DOM 长期驻留——地图弹窗的
// 内联 SVG 可达 MB 级，是最重的一份「白占内存」。
// 延迟 600ms 才清：覆盖「关闭链内仍要读 DOM」的路径（如数据库未保存检查在决定关闭前
// 读编辑值）；执行前复查 .show——600ms 内重开则跳过（重开路径本就整块重写 innerHTML，
// 不会读到半清状态；打开是同步代码块，定时器回调必然看到最终态）。
// overlay 是 display 切换、无淡出过渡（styles 各主题 .panel-overlay 规则），延迟清空在
// 视觉上无感。零依赖：html-builder 收编调用，行为测试直连本模块。
const _overlayClearTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function scheduleOverlayContentClear(overlay: HTMLElement, delayMs = 600): void {
  const prev = _overlayClearTimers.get(overlay);
  if (prev) clearTimeout(prev);
  _overlayClearTimers.set(overlay, setTimeout(() => {
    _overlayClearTimers.delete(overlay);
    if (overlay.isConnected && !overlay.classList.contains('show')) overlay.innerHTML = '';
  }, delayMs));
}
