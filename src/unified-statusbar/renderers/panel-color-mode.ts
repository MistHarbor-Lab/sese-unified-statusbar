// renderers/panel-color-mode.ts
// 弹窗配色来源：跟随插件（默认，状态栏自身明暗）或跟随酒馆（SillyTavern 明暗）。
// 仅影响弹窗；状态栏本体始终跟随插件明暗开关。
// 开销纪律：plugin 模式下 syncDarkClass 只多一次对模块缓存布尔值的比较，
// 不探测、不查 getComputedStyle；tavern 模式仅在开弹窗 / 切选项两个既有事件点做事，无观察者。
import { getConfig } from '../core/config-store';

let _panelColorMode: 'plugin' | 'tavern' = 'plugin';

export function setPanelColorMode(mode: 'plugin' | 'tavern'): void {
  _panelColorMode = mode === 'tavern' ? 'tavern' : 'plugin';
}

export function getPanelColorMode(): 'plugin' | 'tavern' {
  return _panelColorMode;
}

/** rgb/rgba → 亮度；非 rgb 串或 alpha<0.15 返回 null（让调用方逐级回退）。 */
function _rgbDark(color: string | null | undefined): boolean | null {
  const m = String(color ?? '').match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?/i);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.15)) return null;
  return (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255 < 0.5;
}

/** 酒馆明暗探测：CSS 变量 → 元素背景 → prefers-color-scheme 三级回退。 */
export function isHostDark(): boolean {
  for (const v of ['--SmartThemeBlurTintColor', '--SmartThemeBodyColor']) {
    const d = _rgbDark(getComputedStyle(document.documentElement).getPropertyValue(v));
    if (d !== null) return d;
  }
  for (const sel of ['#sheld', '#chat', '#form_sheld', 'body']) {
    const el = document.querySelector(sel);
    const d = el ? _rgbDark(getComputedStyle(el).backgroundColor) : null;
    if (d !== null) return d;
  }
  return !!(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

/** tavern 模式下给单个弹窗 overlay 应用深色；minimal 额外同步 body.dark-mode。 */
export function applyOverlayDark(overlay: HTMLElement, minimal: boolean): void {
  const dark = isHostDark();
  overlay.classList.toggle('dark', dark);
  if (minimal) document.body.classList.toggle('dark-mode', dark);
}

/** 切换选项后重同步所有已打开弹窗（含 tavern→plugin 回切：否则已开弹窗残留酒馆深色，设置面板自身正开着，用户会直接看到「不生效」）。 */
export function resyncOpenOverlays(): void {
  // 助手弹窗无 .show 态（挂载即显示、关闭即移除），按裸类名匹配，无残留误匹配。
  const overlays = document.querySelectorAll('.settings-overlay.show, .nsfw-overlay.show, .panel-overlay.show, .assistant-overlay');
  if (!overlays.length) return;
  const minimal = getConfig().style === 'minimal';
  if (_panelColorMode !== 'tavern') {
    // plugin 模式：与 html-builder 的 syncDarkClass*/plugin 路径同源（内联以免循环依赖）。
    // 配置即事实源，不依赖主面板锚点类（折叠/首启时锚点可能未挂主题类）。
    const dark = getConfig().darkTheme;
    if (minimal) document.body.classList.toggle('dark-mode', dark);
    overlays.forEach(ov => (ov as HTMLElement).classList.toggle('dark', dark));
    return;
  }
  overlays.forEach(ov => applyOverlayDark(ov as HTMLElement, minimal));
}
