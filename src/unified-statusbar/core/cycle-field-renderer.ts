// core/cycle-field-renderer.ts
// L8（对外 API 规格 §I 补全，唯一未实现项）：周期字段渲染注册器。
// 让拓展方（小手机/外部脚本）在自家 UI 渲染周期字段时「只做皮不碰引擎」：
// 注册 (field, fn) 后，由门面 renderCycleField 用引擎现成的记录与玩家可见性掩码取值并调用 fn。
// 零依赖纯模块（照 cycle-api-events 先例）：注册表为进程内 Map，未注册时查询零开销、宿主渲染不受影响。

export type CycleFieldRendererContext = {
  key: string;
  name: string;
  record: Record<string, unknown>;
};
export type CycleFieldRenderer = (value: unknown, ctx: CycleFieldRendererContext) => string;

/** 可接管渲染的白名单：API 周期记录中的「展示型」字段。身份/数据管道字段（key/name/source/age/
 *  female/cycleEnabled/hasCycleRecord/baseCycleLength/periodHistory/lastProcessedDateKey/
 *  eligibilitySuspendedAt）不开放——它们是接线数据，不是渲染目标。 */
export const CYCLE_RENDERABLE_FIELDS = [
  'isOnPeriod',
  'phase',
  'daysIntoCycle',
  'cycleLength',
  'periodLength',
  'regularity',
  'lastPeriodStart',
  'pregnancy',
  'pendingSexForm',
  'lastSeenSexCount',
] as const;
export type CycleRenderableField = (typeof CYCLE_RENDERABLE_FIELDS)[number];

/** 渲染器输出上限：防失控输出拖垮宿主渲染（超出按渲染失败处理）。 */
const RENDER_OUTPUT_MAX = 20_000;

const _renderers = new Map<CycleRenderableField, CycleFieldRenderer>();

/** 注册/注销（fn=null）一个字段的渲染器。重复注册覆盖前者（后注册者赢，语义同决策 delegate）。 */
export function registerCycleFieldRenderer(field: string, fn: CycleFieldRenderer | null): { ok: boolean; message?: string } {
  if (typeof field !== 'string' || !(CYCLE_RENDERABLE_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, message: `字段 ${String(field)} 不在可渲染白名单：${CYCLE_RENDERABLE_FIELDS.join(' / ')}。` };
  }
  const key = field as CycleRenderableField;
  if (fn === null) {
    _renderers.delete(key);
    return { ok: true };
  }
  if (typeof fn !== 'function') {
    return { ok: false, message: 'renderer 须为 (value, ctx) => html 字符串 的函数；传 null 表示注销。' };
  }
  _renderers.set(key, fn);
  return { ok: true };
}

/** 是否已注册（供门面/拓展方零成本探测）。 */
export function hasCycleFieldRenderer(field: string): boolean {
  return _renderers.has(field as CycleRenderableField);
}

/**
 * 经注册表渲染一个字段值。value 必须已由调用方套玩家可见性掩码（未验孕孕情置 null）。
 * 未注册 → { html: null }（调用方回退默认渲染）；渲染器抛错/返回非字符串/超长 → { html: null, error }。
 */
export function renderCycleFieldViaRegistry(
  field: string,
  value: unknown,
  ctx: CycleFieldRendererContext,
): { html: string | null; error?: string } {
  const fn = _renderers.get(field as CycleRenderableField);
  if (!fn) return { html: null };
  let html: unknown;
  try {
    html = fn(value, ctx);
  } catch (e) {
    return { html: null, error: e instanceof Error ? e.message : String(e) };
  }
  if (typeof html !== 'string') return { html: null, error: '渲染器返回值须为字符串。' };
  if (html.length > RENDER_OUTPUT_MAX) return { html: null, error: `渲染器输出超过 ${RENDER_OUTPUT_MAX} 字符上限。` };
  return { html };
}

/** 测试钩子：清空注册表。 */
export function _resetCycleFieldRenderersForTests(): void {
  _renderers.clear();
}
