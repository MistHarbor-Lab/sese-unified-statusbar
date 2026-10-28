// ===== 旧版世界书条目名 · 唯一回收名单（O18-A）=====
//
// 这些名字/前缀是本插件 **2026-07 统一改名之前**（一律加 `UBS-` 前缀）的旧形态。
// 改名后，8 个子系统各自留了一份「旧名字对照表」（合计 14 处 LEGACY_* 常量）去**认领**旧条目——
// 于是「改一次名 = 永久背 8 套兼容」，且散落各处、后人无法判断哪个还是活的。
//
// 现已退役（改名已过去数月，旧条目早被自动就地改写；残留只可能出现在
// 「自 7 月起就没再打开过」的聊天）：**各子系统一律只认当前名**，
// 旧名条目由本名单在**投影全量刷新时统一删除**（即下次打开该聊天时清干净），
// 不再出现「新名条目 + 旧名条目」双份注入。
//
// ★旧前缀 `瑟瑟灵感状态栏-` 当时覆盖**全部**条目（玩法/物品使用/日历/经期/孕期/世界动态/角色动态），
//   所以一个前缀就等价于原先那 8 个散落的旧全名。

export const LEGACY_WB_ENTRY_PREFIXES = [
  '瑟瑟灵感状态栏-',            // 改名前的全插件保留前缀（覆盖上述 7 类旧条目名）
  '__map_node_',                // 地图节点旧前缀
  '__char_relation_',           // 人物关系旧前缀
  '__skill_current',            // 技能旧前缀
  '__wardrobe_protagonist_current',   // 衣柜（主角）旧条目名
  '__wardrobe_character_current_',    // 衣柜（角色）旧前缀
] as const;

/** 名字是否属于旧版保留命名（含 comment / name 两种取名的调用方自行取值后传入）。 */
export function isLegacyWorldbookEntryName(name: string): boolean {
  const n = String(name || '');
  if (!n) return false;
  return LEGACY_WB_ENTRY_PREFIXES.some(prefix => n.startsWith(prefix));
}

/**
 * 就地删除世界书里的旧名条目，返回是否确有删除（供投影协调器决定是否落盘）。
 * 幂等：没有旧名条目时零改动、返回 false。
 */
export function reclaimLegacyWorldbookEntries(entries: any[]): boolean {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  let removed = 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i] as { comment?: unknown; name?: unknown } | null | undefined;
    const name = String(entry?.comment || entry?.name || '');
    if (isLegacyWorldbookEntryName(name)) {
      entries.splice(i, 1);
      removed += 1;
    }
  }
  return removed > 0;
}
