// core/db-standard-template.ts
// 数据库模板修复功能的标准模板（唯一事实源）。webpack 自动把 JSON 内联进产物。
// 改版本：重命名 docs/ 下的 JSON + 改下方 import 路径 + core/constants.ts 的 DB_TEMPLATE_FILE。
// 其余（DB_TEMPLATE_VERSION/PRESET_NAME、打包脚本、UI、测试）由 constants 派生或读 docs/ 实际文件，无需改。
//
// O39(第十一轮)：101KB 模板改为惰性解析（与 achievement-catalog 同口径）——原静态 import
// 随启动链求值，而其消费方（模板修复弹窗 / 建全局预设 / 表开关默认注入判定）全是交互期
// 路径，启动时并不需要。动态 import 在 LimitChunkCount(maxChunks:1) 下仍留在同一产物文件，
// 零网络零新文件；getter 未就绪时触发装载并返回空集（消费方均在用户操作路径，毫秒级空档无感）。
//
// ⚠ 惰性装载消费纪律（O39 回归教训，2026-10-07）：
//   1) **禁止在模块顶层求值后固化**——`export const X = { template: getStandardDbTemplate() }`
//      这类写法会把"未就绪时的空对象"永久钉死（模块体只求值一次），后续 ensure 完也不会更新。
//      要长期持有必须用 getter（每次读实时状态），或改为函数式取用。
//   2) **派生缓存（无过滤版/分组版/按表名索引）不得在未就绪时写入缓存**，否则同样固化空模板。
//   3) **交互入口必须先 `await ensureStandardTemplate()`**，或走 `getStandardDbTemplateOrNull()`
//      门禁：空标准模板在「模板修复」里语义等于"所有表都是多余表"，会把整库判成待删。
let _tpl: Record<string, unknown> | null = null;
let _sheets: Record<string, unknown> | null = null;
let _byName: Record<string, unknown> | null = null;
let _loading: Promise<void> | null = null;

export function standardTemplateReady(): boolean {
  return _tpl !== null;
}

export function ensureStandardTemplate(): Promise<void> {
  if (_tpl) return Promise.resolve();
  if (!_loading) {
    _loading = import('../docs/色色灵感数据库模板V3.3.4.json')
      .then(mod => {
        const tpl = (mod as { default: Record<string, unknown> }).default;
        const sheets = Object.fromEntries(
          Object.keys(tpl).filter(k => k.startsWith('sheet_')).map(k => [k, tpl[k]]),
        );
        const byName = Object.fromEntries(
          Object.values(sheets).map((s: any) => [s.name, s]),
        );
        _tpl = tpl;
        _sheets = sheets;
        _byName = byName;
      })
      .finally(() => { _loading = null; });
  }
  return _loading;
}

/** 标准模板整体（就绪后只读引用；消费方按需 plainClone）。未就绪返回空对象并触发装载。 */
export function getStandardDbTemplate(): any {
  if (!_tpl) { void ensureStandardTemplate(); return {}; }
  return _tpl;
}

/** 标准模板整体，但**区分未就绪**：未就绪返回 null（并触发装载），就绪返回模板引用。
 *  给"空模板有破坏性语义"的调用方用（模板修复的计划/写回：空标准 = 所有表判多余）。
 *  普通同步渲染路径用 getStandardDbTemplate()（空对象足够）即可。 */
export function getStandardDbTemplateOrNull(): any | null {
  if (!_tpl) { void ensureStandardTemplate(); return null; }
  return _tpl;
}

/** 标准 sheet 键 → sheet 对象（仅 sheet_*）。 */
export function getStandardSheets(): Record<string, any> {
  if (!_sheets) { void ensureStandardTemplate(); return {}; }
  return _sheets as Record<string, any>;
}

/** 标准表名（sheet.name）→ sheet 对象。比对按表名匹配用。 */
export function getStandardSheetByName(name: string): any {
  if (!_byName) { void ensureStandardTemplate(); return undefined; }
  return (_byName as Record<string, any>)[name];
}

/** 测试钩子：装载状态（生产零消费）。 */
export function __standardTemplateStatsForTests(): { ready: boolean; sheetCount: number } {
  return { ready: _tpl !== null, sheetCount: _sheets ? Object.keys(_sheets).length : 0 };
}
