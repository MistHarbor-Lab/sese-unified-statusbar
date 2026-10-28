import { getTavernHelper } from './env';
// core/db-plugin-worldbook-cleanup.ts
// 修复后清理数据库插件注入到角色世界书的 Wrapper/PersonsHeader/Memory 条目（陈旧注入）。
// 与数据库插件的删除后清理逻辑保持一致。
// 只删 comment 后缀匹配 TavernDB-ACU-WrapperStart/End/PersonsHeader/MemoryStart/MemoryEnd 的条目
// （后缀匹配覆盖所有隔离前缀 ACU-[code]-）；不碰状态栏自有的经期/立绘/地图/日历/成就条目。
// 详见 docs/superpowers/specs/2026-08-04-db-template-repair-strengthen-design.md


const PLUGIN_WRAPPER_SUFFIXES = [
  'TavernDB-ACU-WrapperStart',
  'TavernDB-ACU-WrapperEnd',
  'TavernDB-ACU-PersonsHeader',
  'TavernDB-ACU-MemoryStart',
  'TavernDB-ACU-MemoryEnd',
];

function isPluginWrapperEntry(comment: unknown): boolean {
  if (typeof comment !== 'string') return false;
  return PLUGIN_WRAPPER_SUFFIXES.some((s) => comment === s || comment.endsWith(s));
}

/** 取写入落点的世界书名：优先角色主世界书，无则取附加世界书；再无返回 null。镜像 investigation-worldbook.ts:161。 */
function resolveTargetWorldbook(th: any): string | null {
  try {
    const charWbs = th.getCharWorldbookNames?.('current');
    if (charWbs) {
      const names: string[] = th.getWorldbookNames?.() || [];
      if (charWbs.primary && names.includes(charWbs.primary)) return charWbs.primary;
      if (Array.isArray(charWbs.additional)) {
        for (const n of charWbs.additional) if (names.includes(n)) return n;
      }
    }
  } catch { /* fall through */ }
  return null;
}

/** 删除主 lorebook 中插件注入的 Wrapper/PersonsHeader/Memory 条目。best-effort，失败仅 warn 不阻断修复。 */
export async function cleanupPluginWrapperEntries(): Promise<{ deleted: number; skipped: boolean }> {
  const th = getTavernHelper();
  if (!th || typeof th.getWorldbook !== 'function' || typeof th.replaceWorldbook !== 'function') {
    return { deleted: 0, skipped: true };
  }
  const wbName = resolveTargetWorldbook(th);
  if (!wbName) return { deleted: 0, skipped: true };
  try {
    const entries: any[] = await th.getWorldbook(wbName);
    const list = Array.isArray(entries) ? entries : [];
    const kept = list.filter((e) => !isPluginWrapperEntry(e?.comment));
    const deleted = list.length - kept.length;
    if (deleted > 0) await th.replaceWorldbook(wbName, kept);
    return { deleted, skipped: false };
  } catch (e) {
    console.warn('[数据库模板修复] 清理插件 lorebook 注入条目失败（不影响修复）：', e);
    return { deleted: 0, skipped: true };
  }
}