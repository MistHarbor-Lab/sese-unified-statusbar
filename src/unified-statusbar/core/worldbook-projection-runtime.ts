import { getTavernHelper } from './env';
import { getConfig } from './config-store';
import { reconcileCalendarWorldbookEntries } from './calendar-core';
import {
  getLatestCycleWorldbookChars,
  getLatestPregnancyWorldbookChars,
  reconcileCycleWorldbookEntries,
  reconcilePregnancyWorldbookEntries,
  resetCycleWorldbookProjectionInputs,
} from './cycle-worldbook';
import {
  getLatestItemUseWorldbookActive,
  getLatestPlayWorldbookSelection,
  getPlayData,
  getPlayWorldbookProjectionInput,
  reconcileItemUseWorldbookEntries,
  reconcilePlayWorldbookEntries,
} from './play-worldbook';
import { getSkillWorldbookContent, reconcileSkillWorldbookEntries } from './skill-worldbook';
import { buildCurrencyGuideContent, reconcileCurrencyWorldbookEntries } from './currency-worldbook';
import { buildMapNodeWorldbookTargets, reconcileMapNodeWorldbookEntries } from './map-worldbook-inject';
import { getWardrobeSnapshot } from './wardrobe-store';
import { collectWardrobeRoster } from './wardrobe-roster';
import { reconcileWardrobeWorldbookEntries } from './wardrobe-worldbook';
import { reconcileCharacterDynamicEntries, reconcileWorldWorldbookEntries } from './world-engine/world-worldbook';
import { isCharacterRelationWorldbookEnabled, ledgerOwnsCharacterRelationWorldbook, readCharacterRelations, reconcileCharacterRelationEntries, resetCharacterRelationWorldbookCache } from './character-relation-worldbook';
import { createWorldbookProjectionCoordinator } from './worldbook-projection';
import { createWorldbookProjectionRegistry, isValidExternalProjection, type RegisteredWorldbookProjection } from './worldbook-projection-registry';
import { reclaimLegacyWorldbookEntries } from './legacy-worldbook-entries';
import { setWorldbookProjectionDispatcher, type WorldbookProjectionReason } from './worldbook-projection-events';
import { isRefillMode } from './refill-mode';

let registry: ReturnType<typeof createWorldbookProjectionRegistry> | null = null;
/** registry 初始化前注册的外部投影（台账/小手机可能先于主项目 init）：init 时统一补注册。 */
const pendingExternal = new Map<string, RegisteredWorldbookProjection>();
/** registry 初始化前到达的外部异步请求：init 时补发（重填模式直接丢弃，关闭后 refreshAll 重建）。 */
const pendingExternalRequests = new Set<string>();

export function initializeWorldbookProjectionRuntime(): void {
  if (registry) return;
  const coordinator = createWorldbookProjectionCoordinator({ getHelper: getTavernHelper });
  registry = createWorldbookProjectionRegistry({
    coordinator,
    projections: [
      {
        // O18-A：旧版条目名统一回收（唯一一处）。全量刷新时先于各功能跑，删掉改名前的
        // `瑟瑟灵感状态栏-*` / `__map_node_` / `__char_relation_` / `__skill_current` /
        // `__wardrobe_*_current*` 残留，避免「新名条目 + 旧名条目」双份注入。
        // 幂等：无旧条目时零改动；各功能侧已不再各自维护旧名对照表。
        id: 'legacy-reclaim',
        isEnabled: () => true,
        reconcile: entries => reclaimLegacyWorldbookEntries(entries),
      },
      {
        id: 'calendar',
        isEnabled: () => getConfig().calendarEnabled !== false,
        reconcile: entries => reconcileCalendarWorldbookEntries(entries),
      },
      {
        id: 'cycle-period',
        isEnabled: () => getConfig().cycleMode !== 'off' && getConfig().cycleWorldbookPeriod === true,
        reconcile: entries => reconcileCycleWorldbookEntries(entries, getLatestCycleWorldbookChars()),
      },
      {
        id: 'cycle-pregnancy',
        isEnabled: () => getConfig().cycleMode === 'full' && getConfig().cycleWorldbookPregnancy === true,
        reconcile: entries => {
          const current = getLatestPregnancyWorldbookChars();
          return reconcilePregnancyWorldbookEntries(entries, current.pregnant, current.postpartum);
        },
      },
      {
        id: 'play',
        isEnabled: () => getConfig().nsfwPlayEnabled === true,
        reconcile: entries => {
          const config = getConfig();
          return reconcilePlayWorldbookEntries(
            entries,
            config.nsfwPlayEnabled ? getLatestPlayWorldbookSelection() : [],
            getPlayWorldbookProjectionInput(),
          );
        },
      },
      {
        id: 'item-use',
        isEnabled: () => getConfig().nsfwPlayEnabled === true && getConfig().itemUseEnabled === true,
        reconcile: entries => {
          const config = getConfig();
          return reconcileItemUseWorldbookEntries(
            entries,
            config.nsfwPlayEnabled && config.itemUseEnabled && getLatestItemUseWorldbookActive(),
            getPlayData(),
          );
        },
      },
      {
        id: 'skills',
        isEnabled: () => getConfig().skillEnabled === true,
        reconcile: entries => reconcileSkillWorldbookEntries(
          entries,
          getConfig().skillEnabled ? getSkillWorldbookContent() : '',
        ),
      },
      {
        // 货币体系：开关开启且有币种 → 注入（余额摘要随变动节流重建）；关闭/无币种 → 空内容移除条目。
        id: 'currency',
        isEnabled: () => getConfig().currencyEnabled === true,
        reconcile: entries => reconcileCurrencyWorldbookEntries(entries, buildCurrencyGuideContent()),
      },
      {
        id: 'map-nodes',
        isEnabled: () => getConfig().mapEnabled === true,
        reconcile: async entries => reconcileMapNodeWorldbookEntries(entries, await buildMapNodeWorldbookTargets()),
      },
      {
        id: 'wardrobe',
        isEnabled: () => getConfig().wardrobeEnabled === true,
        reconcile: entries => {
          const roster = collectWardrobeRoster();
          // 名单表不可读时跳过：空名单会把 NPC 世界书条目整体重排（churn），等表暖后自然重试。
          if (!roster) return false;
          return reconcileWardrobeWorldbookEntries(
            entries,
            getWardrobeSnapshot(),
            roster,
            getConfig().wardrobeEnabled,
          );
        },
      },
      {
        id: 'world',
        isEnabled: () => getConfig().worldEnabled !== false,
        reconcile: entries => reconcileWorldWorldbookEntries(entries),
      },
      {
        id: 'character-dynamic',
        isEnabled: () => getConfig().worldEnabled !== false,
        reconcile: entries => reconcileCharacterDynamicEntries(entries),
      },
      {
        // 人物关系表 → 与触发关键词条目（姓名A 主关键词 + 姓名B 次关键词 and_any）
        // 台账模式且台账侧给本表开了世界书注入 → 由台账独占投影（同形条目），此处给空集撤场
        id: 'char-relations',
        isEnabled: () => isCharacterRelationWorldbookEnabled(),
        reconcile: entries => reconcileCharacterRelationEntries(
          entries,
          readCharacterRelations(),
          isCharacterRelationWorldbookEnabled() && !ledgerOwnsCharacterRelationWorldbook(),
        ),
      },
    ],
  });
  // 初始化前注册的外部投影 / 外部请求：registry 就绪后统一补上。
  for (const descriptor of pendingExternal.values()) registry.registerExternal(descriptor);
  pendingExternal.clear();
  const externalIds = [...pendingExternalRequests];
  pendingExternalRequests.clear();
  if (!isRefillMode()) {
    for (const id of externalIds) void registry.requestProjection(id, 'data-change');
  }
  setWorldbookProjectionDispatcher((id: string, reason: WorldbookProjectionReason) => { void registry?.requestProjection(id, reason); });
}

export function advanceWorldbookProjectionScope(): void {
  if (!registry) return;
  registry.advanceScope();
  resetCycleWorldbookProjectionInputs();
  resetCharacterRelationWorldbookCache();
}

export function refreshAllWorldbookProjections(): Promise<void> {
  // 重填模式：所有自动世界书写入一律抑制；关闭后本函数会按当前数据整本重建。
  if (isRefillMode()) return Promise.resolve();
  return registry?.refreshAllForCurrentScope() || Promise.resolve();
}

export function setWorldbookProjectionEnabled(id: string, enabled: boolean): Promise<void> {
  return registry?.setFeatureEnabled(id, enabled) || Promise.resolve();
}

/**
 * 伴生插件（小手机/瑟瑟台账）经宿主桥注册外部投影：进入与内部模块同一套协调器调度
 * （串行化整书读写 / 切卡 epoch / refreshAll / DS 缓存重定位后的全量刷新）。
 * registry 尚未初始化时先进 pending，init 完成后补注册（返回 true=已受理）。
 */
export function registerExternalWorldbookProjection(descriptor: RegisteredWorldbookProjection): boolean {
  if (!isValidExternalProjection(descriptor)) return false;
  if (!registry) {
    pendingExternal.set(descriptor.id, descriptor);
    return true;
  }
  return registry.registerExternal(descriptor);
}

/** 注销外部投影（脚本卸载/重注入时调用；pending 中的也一并移除）。 */
export function unregisterExternalWorldbookProjection(id: string): boolean {
  if (!id) return false;
  pendingExternal.delete(id);
  return registry?.unregisterExternal(id) ?? false;
}

/**
 * 外部投影的异步请求：返回是否实际执行成功（无世界书/读写异常/重填抑制 = false）。
 * registry 尚未初始化时记为 pending，init 后补发。
 */
export function requestExternalWorldbookProjectionAsync(
  id: string,
  reason: WorldbookProjectionReason,
): Promise<boolean> {
  if (!id || isRefillMode()) return Promise.resolve(false);
  if (!registry) {
    pendingExternalRequests.add(id);
    return Promise.resolve(true);
  }
  return registry.requestProjection(id, reason);
}

/** 手工清理等非投影写入的串行入口：与所有投影共用同一条队列。 */
export function runWorldbookProjectionExclusive<T>(task: () => Promise<T>): Promise<T> {
  if (!registry) return task();
  return registry.exclusive(task);
}
