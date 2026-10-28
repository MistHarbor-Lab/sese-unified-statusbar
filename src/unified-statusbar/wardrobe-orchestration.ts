// ===== 衣柜编排（提案三 S2 拆分，2026-09-15）=====
// 自 index.ts 原样迁出：投影代际/协调器、自动化 tick、面板开关协调、ub-wardrobe-action
// 动作分发（穿戴/卸下/随机/池/提交/设计/生成批次等）、动作事件桥。
// 本模块禁止 import index.ts——render/活跃弹窗/当前主题经 initWardrobeOrchestration 注入。
import { getConfig } from './core/config-store';
import { UB_EVENT } from './core/events';
import { getToastr } from './core/env';
import { getCellByHeader, getSheetByName } from './core/data-manager';
import { getAiReplyContext } from './core/map-system';
import { getCurrentStoryChatKey } from './core/story-floor-store';
import { getTodayDateKey } from './core/calendar-core';
import type { StyleType } from './core/constants';
import {
  applyWardrobeOutfitMetaSuggestion,
  closeWardrobeDialog,
  failWardrobeDesign,
  failWardrobeOutfitMeta,
  openWardrobeOutfitEditorForDesign,
  showWardrobeDesignReview,
  showWardrobePanel,
} from './renderers/wardrobe-panel';
import { getWardrobeContentRev, getWardrobeSnapshot, isSafeStoredImagePath } from './core/wardrobe-store';
import { resolveWardrobeItems, wardrobeService } from './core/wardrobe-service';
import {
  createWardrobePanelOpenCoordinator,
  createWardrobeProjectionCoordinator,
  createWardrobeProjectionOrchestrator,
  disableWardrobeWorldbook,
  syncWardrobeWorldbook,
} from './core/wardrobe-worldbook';
import {
  collectWardrobeRoster,
  readWardrobeRosterSources,
  wardrobeRosterSourcesFingerprint,
  type WardrobeRosterEntry,
} from './core/wardrobe-roster';
import { PROTAGONIST_ACTOR_KEY } from './core/wardrobe-actors';
import { appendNpcDressInstruction } from './core/wardrobe-input';
import { exportWardrobeItemToInventory } from './core/wardrobe-inventory';
import { getWardrobeRuntime } from './core/wardrobe-runtime';
import type { PresentCharacterClothing, WardrobeExtractionCandidate } from './core/wardrobe-prompts';
import { selectionItemIds, type WardrobeCategory, type WardrobeState } from './core/wardrobe-types';

/** index.ts 注入的局部能力（双向解耦）。 */
export interface WardrobeOrchestrationDeps {
  render(force?: boolean): void;
  getActivePopup(): string | null;
  getCurrentStyle(): StyleType;
}

let deps: WardrobeOrchestrationDeps;

/** 注入 index 局部依赖；须在任一编排函数被调用前执行（index 模块顶层调用）。 */
export function initWardrobeOrchestration(theDeps: WardrobeOrchestrationDeps): void {
  deps = theDeps;
}

interface WardrobeActionEventDetail {
  action?: string;
  id?: string;
  payload?: any;
  view?: {
    actorKey?: string;
    wearTargetActorKey?: string;
    poolTargetActorKey?: string;
    npcTarget?: string;
    outfitModelMode?: 'female' | 'male' | 'story';
    outfitModelCharacter?: string;
  };
}

function collectPresentCharacterClothing(): PresentCharacterClothing[] {
  const sheet = getSheetByName('在场角色表');
  const characters: PresentCharacterClothing[] = [];
  for (let row = 1; row < (sheet?.content?.length || 1); row++) {
    const name = getCellByHeader('在场角色表', row, '姓名') || '';
    if (!name) continue;
    characters.push({
      name,
      currentOutfit: getCellByHeader('在场角色表', row, '当前穿搭') || '',
      top: getCellByHeader('在场角色表', row, '上装') || '',
      bottom: getCellByHeader('在场角色表', row, '下装') || '',
      inner: getCellByHeader('在场角色表', row, '内衣/内裤') || '',
      socks: getCellByHeader('在场角色表', row, '袜子') || '',
      shoes: getCellByHeader('在场角色表', row, '鞋子') || '',
      accessories: getCellByHeader('在场角色表', row, '饰品') || '',
    });
  }
  return characters;
}

function findWardrobeRosterActor(
  roster: readonly WardrobeRosterEntry[],
  actorKey: unknown,
): WardrobeRosterEntry | undefined {
  const normalizedKey = String(actorKey || '').trim();
  return roster.find(actor => actor.actorKey === normalizedKey);
}

let wardrobeProjectionEpoch = 0;
let wardrobeProjectionChatKey = getCurrentStoryChatKey();

function currentWardrobeProjectionIdentity(): string {
  const chatKey = getCurrentStoryChatKey();
  if (chatKey !== wardrobeProjectionChatKey) {
    wardrobeProjectionChatKey = chatKey;
    wardrobeProjectionEpoch++;
  }
  return `${wardrobeProjectionEpoch}:${wardrobeProjectionChatKey}`;
}

export function advanceWardrobeProjectionEpoch(): void {
  wardrobeProjectionChatKey = getCurrentStoryChatKey();
  wardrobeProjectionEpoch++;
}

const coordinateWardrobeProjection = createWardrobeProjectionCoordinator(
  currentWardrobeProjectionIdentity,
);

function projectWardrobeSnapshot(
  state: WardrobeState,
  roster: readonly WardrobeRosterEntry[],
  enabled: boolean,
  originChatKey: string,
) {
  return coordinateWardrobeProjection(
    originChatKey,
    isCurrent => syncWardrobeWorldbook(state, roster, enabled, { isCurrent }),
  );
}

const runWardrobeProjectionOrchestration = createWardrobeProjectionOrchestrator({
  isEnabled: () => getConfig().wardrobeEnabled,
  getProjectionIdentity: currentWardrobeProjectionIdentity,
  collectRoster: collectWardrobeRoster,
  process: (roster, dateKey, rng) =>
    wardrobeService.processWardrobeAutomationTick(roster, dateKey, rng),
  getSnapshot: getWardrobeSnapshot,
  project: projectWardrobeSnapshot,
  disable: originChatKey => coordinateWardrobeProjection(
    originChatKey,
    isCurrent => disableWardrobeWorldbook({ isCurrent }),
  ),
});

/** 穿戴/换装等用户操作后的投影结果反馈：无角色世界书 → 每卡一次绑定提示 + 正常成功反馈，
 *  其余失败 → 世界书同步失败警告。stale 已由调用方早退，此处不处理。 */
function reportWardrobeProjectionOutcome(
  syncResult: { ok: boolean; error?: string },
  successText: string,
  failureText: string,
): void {
  if (syncResult.ok) {
    getToastr()?.success(successText, '衣柜');
    return;
  }
  getToastr()?.warning(failureText, '衣柜');
}

export async function reconcileWardrobeStateAndProjection(
  dateKey = '',
  originIdentity?: string,
) {
  const result = await runWardrobeProjectionOrchestration({
    dateKey,
    rng: Math.random,
    originIdentity,
  });
  if (result.ok || result.stale) return result;
  getToastr()?.warning(
    result.error === '衣柜保存失败'
      ? '衣柜名单协调保存失败；后续将自动重试'
      : '衣柜世界书同步失败；后续将自动重试',
    '衣柜',
  );
  return result;
}

export async function handleWardrobeAutomationTick(): Promise<void> {
  if (!getConfig().wardrobeEnabled) return;
  // 欢迎页面无角色卡（chatKey 为空）、世界书未就绪，衣柜名单协调会写角色世界书报错——直接跳过。
  if (!getCurrentStoryChatKey()) return;
  const dateKey = getTodayDateKey() || '';
  // O3：tick 短路。300ms tick 里 99% 的轮次什么都不变，但每次都走 store.load()（catalog 读 +
  // story 全量重放 + 全量克隆）+ 全员名单对账 + 双克隆。投影身份/日期/衣柜内容代/名单全都没变
  // ⇒ 上一次 tick 已得出「无变化」，整条链直接跳过。事件驱动路径（穿戴/落盘/切卡）不走此 memo，
  // 内容代与投影身份任何一处变化自然击穿；名单不可读（null）时不缓存照常重试。
  // O14（修正，2026-10-04）：O3 的短路键要扫 3 张人物表 + JSON.stringify 整份名单，而这一步发生在
  // 比对之前 ⇒ 轮次白扫。预闸必须在「建名单」之前拿到信号，而原键用的 getSheetsDataRevision()
  // 含「缓存代」，每 tick 的 invalidateCache() 都会推进它 ⇒ 预闸永不命中（死闸，已实测确认）。
  // 现改为：先读一次名单来源（四张表的姓名列，预闸的唯一成本）→ 以「来源指纹」作键。
  // 为什么不能只靠修订令牌（getSheetsContentRevision 之类）：它只记录本插件就地写表；插件推送/
  // AI 改名单表（新角色进名单、改名、离场）不推进它 ⇒ 只看内容修订会漏「名单已变」而永久短路。
  // 来源指纹覆盖名单的全部输入（名单 = f(来源)）⇒ 指纹未变则名单必未变，与 O3 键等价，
  // 同时省掉 buildWardrobeRoster 的归一化/actorKey 与整份名单的序列化。仅在「上一次确已短路
  // 成功」时启用（memo 非空），失败重试语义与改造前一致。
  const rosterSources = readWardrobeRosterSources();
  const preKey = `${currentWardrobeProjectionIdentity()}\u0001${dateKey}\u0001${getWardrobeContentRev()}\u0001${wardrobeRosterSourcesFingerprint(rosterSources)}`;
  if (_automationTickMemo !== null && _automationPreKey === preKey) return;

  const roster = collectWardrobeRoster(rosterSources);
  if (roster) {
    const key = JSON.stringify([
      currentWardrobeProjectionIdentity(), dateKey, getWardrobeContentRev(), roster,
    ]);
    if (_automationTickMemo === key) { _automationPreKey = preKey; return; }
    const result = await reconcileWardrobeStateAndProjection(dateKey);
    _automationTickMemo = (result.ok || result.stale) ? key : null;
    _automationPreKey = _automationTickMemo ? preKey : '';
    if (result.ok && !result.stale && result.changed) deps.render(true);
    return;
  }
  _automationTickMemo = null;
  _automationPreKey = '';
  const result = await reconcileWardrobeStateAndProjection(dateKey);
  if (result.ok && !result.stale && result.changed) deps.render(true);
}

/** O3：上一次自动化 tick 的短路键（见 handleWardrobeAutomationTick 内注释）。 */
let _automationTickMemo: string | null = null;
/** O14：对应短路键的「廉价预闸」键（身份 + 日期 + 衣柜内容代 + 名单来源指纹），
 *  命中即免去名单构建（归一化/actorKey）与整份名单序列化；读表本身仍是预闸的成本。 */
let _automationPreKey = '';

const wardrobePanelOpenCoordinator = createWardrobePanelOpenCoordinator(
  () => deps.getActivePopup(),
);

/** 使面板开关代际失效（index.closeActivePopup 关衣柜时走自身清理，防订阅泄漏）。 */
export function invalidateWardrobePanelOpen(): void {
  wardrobePanelOpenCoordinator.invalidate();
}

export async function openWardrobePanel(
  style: StyleType,
  initialRoute: 'items' | 'outfits' | 'actors' | 'queue' = 'items',
): Promise<void> {
  const originIdentity = currentWardrobeProjectionIdentity();
  await wardrobePanelOpenCoordinator.open(
    async () => {
      const result = await reconcileWardrobeStateAndProjection();
      return !result.stale
        && currentWardrobeProjectionIdentity() === originIdentity;
    },
    () => showWardrobePanel(style, initialRoute),
  );
}

export async function handleWardrobeActionEvent(event: Event): Promise<void> {
  if (!getConfig().wardrobeEnabled) return;
  const detail = (event as CustomEvent<WardrobeActionEventDetail>).detail || {};
  const action = String(detail.action || '');
  const id = String(detail.id || '');
  const toastr = getToastr();
  const runtime = getWardrobeRuntime();
  const originChatKey = currentWardrobeProjectionIdentity();

  if (action === 'wear-item' || action === 'wear-outfit') {
    const roster = collectWardrobeRoster() ?? [];
    const actor = findWardrobeRosterActor(roster, detail.view?.wearTargetActorKey);
    if (!actor) {
      toastr?.error('目标角色已不在当前衣柜名单中，请刷新后重试', '衣柜');
      return;
    }
    const result = action === 'wear-item'
      ? await wardrobeService.applyItemToActor(actor.actorKey, actor.displayName, id)
      : await wardrobeService.applyOutfitToActor(actor.actorKey, actor.displayName, id);
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    const syncResult = await projectWardrobeSnapshot(
      getWardrobeSnapshot(),
      roster,
      true,
      originChatKey,
    );
    if (syncResult.stale) return;
    reportWardrobeProjectionOutcome(
      syncResult,
      `已更新${actor.displayName}当前穿搭`,
      '穿搭已保存，但世界书同步失败；下次重载时会重试',
    );
    if (actor.actorKey === PROTAGONIST_ACTOR_KEY) {
      try {
        (window as any).__ubEmitAchievement?.('wardrobe_protagonist_dressed', {
          targetType: action === 'wear-item' ? 'item' : 'outfit',
          itemCount: selectionItemIds(result.value.currentOutfit).length,
        });
      } catch (_e) { /* ignore */ }
    }
    deps.render(true);
    return;
  }

  if (
    action === 'actor-unwear-item'
    || action === 'actor-clear-outfit'
    || action === 'unwear-item'
    || action === 'clear-protagonist-outfit'
  ) {
    const roster = collectWardrobeRoster() ?? [];
    const actorKey = action.startsWith('actor-')
      ? detail.view?.actorKey
      : PROTAGONIST_ACTOR_KEY;
    const actor = findWardrobeRosterActor(roster, actorKey);
    if (!actor) {
      toastr?.error('目标角色已不在当前衣柜名单中，请刷新后重试', '衣柜');
      return;
    }
    const unwear = action === 'actor-unwear-item' || action === 'unwear-item';
    const result = unwear
      ? await wardrobeService.removeActorItem(actor.actorKey, id)
      : await wardrobeService.clearActorOutfit(actor.actorKey);
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    const syncResult = await projectWardrobeSnapshot(
      getWardrobeSnapshot(),
      roster,
      true,
      originChatKey,
    );
    if (syncResult.stale) return;
    reportWardrobeProjectionOutcome(
      syncResult,
      unwear ? '已卸下服饰' : `已清空${actor.displayName}当前穿搭`,
      '穿搭已保存，但世界书同步失败；下次重载时会重试',
    );
    deps.render(true);
    return;
  }

  if (action === 'actor-random-now') {
    const roster = collectWardrobeRoster() ?? [];
    const actor = findWardrobeRosterActor(roster, detail.view?.actorKey);
    if (!actor) {
      toastr?.error('目标角色已不在当前衣柜名单中，请刷新后重试', '衣柜');
      return;
    }
    const result = await wardrobeService.randomizeActorOutfit(actor.actorKey, Math.random);
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    const syncResult = await projectWardrobeSnapshot(
      getWardrobeSnapshot(),
      roster,
      true,
      originChatKey,
    );
    if (syncResult.stale) return;
    reportWardrobeProjectionOutcome(
      syncResult,
      `已为${actor.displayName}随机换装`,
      '换装已保存，但世界书同步失败；下次重载时会重试',
    );
    deps.render(true);
    return;
  }

  if (
    action === 'actor-toggle-random-candidate'
    || action === 'actor-set-auto-random'
    || action === 'actor-save-pool'
    || action === 'actor-remove-outfit-from-pool'
    || action === 'add-outfit-to-pool'
  ) {
    const roster = collectWardrobeRoster() ?? [];
    const actorKey = action === 'add-outfit-to-pool'
      ? detail.view?.poolTargetActorKey
      : detail.view?.actorKey;
    const actor = findWardrobeRosterActor(roster, actorKey);
    if (!actor) {
      toastr?.error('目标角色已不在当前衣柜名单中，请刷新后重试', '衣柜');
      return;
    }
    const profile = getWardrobeSnapshot().actorProfiles[actor.actorKey];
    let result;
    if (action === 'actor-toggle-random-candidate') {
      const randomIds = new Set(profile?.randomOutfitIds || []);
      if (randomIds.has(id)) randomIds.delete(id);
      else randomIds.add(id);
      result = await wardrobeService.setActorRandomOutfits(
        actor.actorKey,
        actor.displayName,
        Array.from(randomIds),
      );
    } else if (action === 'actor-set-auto-random') {
      result = await wardrobeService.setActorAutoRandom(
        actor.actorKey,
        actor.displayName,
        detail.payload?.enabled === true,
        getTodayDateKey() || undefined,
      );
    } else {
      const outfitPoolIds = action === 'actor-save-pool'
        ? (Array.isArray(detail.payload?.outfitPoolIds)
          ? detail.payload.outfitPoolIds.map(String)
          : [])
        : action === 'actor-remove-outfit-from-pool'
          ? (profile?.outfitPoolIds || []).filter(outfitId => outfitId !== id)
          : Array.from(new Set([...(profile?.outfitPoolIds || []), id]));
      result = await wardrobeService.setActorOutfitPool(
        actor.actorKey,
        actor.displayName,
        outfitPoolIds,
      );
    }
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    if (action === 'actor-remove-outfit-from-pool') closeWardrobeDialog();
    toastr?.success(
      action === 'actor-set-auto-random'
        ? (result.value.autoRandomEnabled ? '已开启日期变化自动随机' : '已关闭日期变化自动随机')
        : '套装池设置已保存',
      '衣柜',
    );
    return;
  }

  if (action === 'wear-npc-item' || action === 'wear-npc-outfit') {
    const state = getWardrobeSnapshot();
    const itemIds = action === 'wear-npc-item'
      ? [id]
      : state.outfits.find(outfit => outfit.id === id)?.itemIds || [];
    const resolvedItems = resolveWardrobeItems(itemIds);
    const result = appendNpcDressInstruction(
      String(detail.view?.npcTarget || ''),
      resolvedItems,
    );
    if (result.ok) {
      toastr?.success('剧情换装指令已追加到输入框，请确认后发送', '衣柜');
      try {
        (window as any).__ubEmitAchievement?.('wardrobe_npc_injected', {
          targetType: action === 'wear-npc-item' ? 'item' : 'outfit',
          itemCount: resolvedItems.length,
        });
      } catch (_e) { /* ignore */ }
    } else {
      toastr?.error(result.error, '衣柜');
    }
    return;
  }

  if (action === 'submit-item') {
    const draft = detail.payload || {};
    const result = id
      ? await runtime.updateItem(id, {
        name: String(draft.name || ''),
        category: String(draft.category || '') as WardrobeCategory,
        description: String(draft.description || ''),
        tags: String(draft.tags || ''),
      })
      : await runtime.addItem({
        name: String(draft.name || ''),
        category: String(draft.category || '') as WardrobeCategory,
        description: String(draft.description || ''),
      });
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    closeWardrobeDialog();
    toastr?.success(id ? '服饰资料已更新，旧图已保留' : '服饰已加入衣柜', '衣柜');
    if (!id) {
      try {
        (window as any).__ubEmitAchievement?.('wardrobe_item_added', {
          category: result.value.category,
          amount: 1,
        });
      } catch (_e) { /* ignore */ }
    } else {
      await reconcileWardrobeStateAndProjection('', originChatKey);
    }
    return;
  }

  if (action === 'submit-design') {
    const instruction = String(detail.payload?.instruction || '').trim();
    const createOutfit = detail.payload?.createOutfit === true;
    if (!instruction) {
      failWardrobeDesign();
      toastr?.error('请先输入设计要求', '衣柜');
      return;
    }
    // 1A 三段式：资料块=在场角色穿着资料+最近剧情（固定 1 条，仅最近语境）；触发注入=设计指令（runtime 内装配）
    const result = await runtime.designCandidates({
      instruction,
      presentClothing: collectPresentCharacterClothing(),
      storyContext: getAiReplyContext(1),
    });
    if (!result.ok || !result.value) {
      failWardrobeDesign();
      toastr?.error(result.error || 'AI 未返回有效分件，请调整设计要求后重试', '衣柜');
      return;
    }
    showWardrobeDesignReview(result.value.items, result.value.outfit, createOutfit);
    return;
  }

  if (action === 'suggest-outfit-meta') {
    const itemIds = Array.isArray(detail.payload?.itemIds) ? detail.payload.itemIds.map(String) : [];
    const result = await runtime.suggestOutfitMeta(itemIds);
    if (!result.ok || !result.value) {
      failWardrobeOutfitMeta();
      toastr?.error(result.error || 'AI 未返回有效的套装名称或描述，请重试', '衣柜');
      return;
    }
    applyWardrobeOutfitMetaSuggestion(result.value.name, result.value.description);
    return;
  }

  if (action === 'export-item-inventory') {
    const item = getWardrobeSnapshot().items.find(candidate => candidate.id === id);
    if (!item) {
      toastr?.error('所选服饰已不存在，请刷新衣柜后重试', '衣柜');
      return;
    }
    const result = await exportWardrobeItemToInventory(item);
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    toastr?.success('已提取至物品栏（衣柜原记录保留）', '衣柜');
    return;
  }

  if (action === 'submit-extraction') {
    const candidates = Array.isArray(detail.payload?.candidates)
      ? detail.payload.candidates as WardrobeExtractionCandidate[]
      : [];
    if (candidates.length === 0) {
      toastr?.warning('请至少选择一件服饰', '衣柜');
      return;
    }
    const createOutfit = detail.payload?.design?.createOutfit === true;
    const outfitMeta = detail.payload?.design?.outfit as { name?: string; description?: string } | null | undefined;
    const result = await runtime.addExtracted(candidates);
    closeWardrobeDialog();
    if (result.added.length) {
      toastr?.success(`已加入 ${result.added.length} 件服饰`, '衣柜');
      for (const item of result.added) {
        try {
          (window as any).__ubEmitAchievement?.('wardrobe_item_added', {
            category: item.category,
            amount: 1,
          });
        } catch (_e) { /* ignore */ }
      }
      // 勾选「分件保存后继续保存为套装」：单品已保存（不可回滚），打开套装编辑器预选+预填；取消套装不回滚单品
      if (createOutfit) {
        openWardrobeOutfitEditorForDesign(
          result.added.map(item => item.id),
          String(outfitMeta?.name || ''),
          String(outfitMeta?.description || ''),
        );
      }
    }
    if (result.errors.length) {
      toastr?.warning(`${result.errors.length} 件因重复或资料无效被跳过`, '衣柜');
    }
    return;
  }

  if (action === 'save-outfit') {
    const draft = detail.payload || {};
    const result = await runtime.saveOutfit({
      ...(id ? { id } : {}),
      name: String(draft.name || ''),
      description: String(draft.description || ''),
      itemIds: Array.isArray(draft.itemIds) ? draft.itemIds.map(String) : [],
    });
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    if (result.warning) toastr?.warning(result.warning, '衣柜');
    else toastr?.success(id ? '套装已更新' : '套装已保存', '衣柜');
    closeWardrobeDialog();
    void openWardrobePanel(deps.getCurrentStyle(), 'outfits');
    const outfitItems = resolveWardrobeItems(result.value.itemIds);
    try {
      (window as any).__ubEmitAchievement?.('wardrobe_outfit_saved', {
        itemCount: outfitItems.length,
        categoryCount: new Set(outfitItems.map(item => item.category)).size,
        firstSave: id ? 0 : 1,
      });
    } catch (_e) { /* ignore */ }
    return;
  }

  if (action === 'delete-item-confirmed' || action === 'delete-outfit-confirmed') {
    const result = action === 'delete-item-confirmed'
      ? await runtime.deleteItem(id)
      : await runtime.deleteOutfit(id);
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    closeWardrobeDialog();
    if (result.warning) toastr?.warning(result.warning, '衣柜');
    else toastr?.success('已删除', '衣柜');
    return;
  }

  if (action === 'delete-selected-confirmed') {
    const ids = Array.isArray(detail.payload?.itemIds)
      ? detail.payload.itemIds.map(String)
      : [];
    if (ids.length === 0) return;
    const itemNames = new Map(getWardrobeSnapshot().items.map(item => [item.id, item.name]));
    let deleted = 0;
    const skipped: string[] = [];
    const errors: string[] = [];
    for (const itemId of ids) {
      const result = await runtime.deleteItem(itemId);
      const name = itemNames.get(itemId) || itemId;
      if (result.ok) deleted++;
      else if (result.error?.startsWith('该服饰仍被引用')) skipped.push(name);
      else errors.push(`${name}（${result.error || '未知错误'}）`);
    }
    closeWardrobeDialog();
    if (deleted) toastr?.success(`已删除 ${deleted} 件服饰`, '衣柜');
    if (skipped.length) toastr?.warning(`跳过 ${skipped.length} 件（被套装或当前穿搭引用）：${skipped.join('、')}`, '衣柜');
    if (errors.length) toastr?.error(`删除失败：${errors.join('、')}`, '衣柜');
    return;
  }

  if (action === 'import-item-image') {
    const file = detail.payload?.file;
    if (typeof File === 'undefined' || !(file instanceof File)) {
      toastr?.error('请选择图片文件', '衣柜');
      return;
    }
    const result = await runtime.importItemImage(id, file);
    if (!result.ok) {
      toastr?.error(result.error, '衣柜');
      return;
    }
    if (result.warning) toastr?.warning(result.warning, '衣柜');
    else toastr?.success('图片已导入', '衣柜');
    void openWardrobePanel(deps.getCurrentStyle(), 'items');
    return;
  }

  if (action === 'generate-item' || action === 'generate-outfit' || action === 'generate-selected' || action === 'generate-unimaged' || action === 'generate-item-by-tags') {
    const kind = action === 'generate-outfit' ? 'outfit' : 'item';
    const useStoredTags = action === 'generate-item-by-tags';
    // 单品一次点击最多生成排序靠前的 9 件；批次进行中再点会追加排队，超出部分可再次点击继续
    let ids: string[];
    if (action === 'generate-unimaged') {
      const unimagined = getWardrobeSnapshot().items
        .filter(item => !isSafeStoredImagePath(item.imagePath));
      if (unimagined.length === 0) {
        toastr?.info('没有未生成图片的服饰', '衣柜');
        return;
      }
      ids = unimagined.slice(0, 9).map(item => item.id);
      if (unimagined.length > 9) {
        toastr?.info(`本次先生成前 9 件；还有 ${unimagined.length - 9} 件未生成，可再次点击继续`, '衣柜');
      }
    } else if (action === 'generate-selected') {
      const selected = Array.isArray(detail.payload?.itemIds) ? detail.payload.itemIds.map(String) : [];
      const order = getWardrobeSnapshot().items.map(item => item.id);
      const ordered = selected.filter((itemId: string) => order.includes(itemId)).sort((a: string, b: string) => order.indexOf(a) - order.indexOf(b));
      if (ordered.length > 9) {
        toastr?.info(`一次最多生成 9 件，已取排序靠前的 9 件；其余 ${ordered.length - 9} 件可再次点击继续排队`, '衣柜');
      }
      ids = ordered.slice(0, 9);
    } else {
      ids = [id];
    }
    const model = kind === 'outfit'
      ? {
        mode: detail.view?.outfitModelMode === 'story' ? 'story' as const : (detail.view?.outfitModelMode === 'male' ? 'male' as const : 'female' as const),
        characterName: String(detail.view?.outfitModelCharacter || '').trim() || undefined,
      }
      : undefined;
    const start = runtime.startBatch(kind, ids, model, useStoredTags);
    // 批次创建/追加不再单独弹 toast：衣柜面板内有队列进度（统一 AI 通知只覆盖文字请求阶段）
    const result = await start;
    if (!result.ok) {
      toastr?.error(result.error, '衣柜生图');
      return;
    }
    const snapshot = runtime.getSnapshot();
    // 追加排队后批次仍在跑（或所选目标已全部在队列中）：不打“批次结束”
    if (snapshot && (snapshot.status === 'preparing' || snapshot.status === 'running')) return;
    const success = snapshot?.tasks.filter(task => task.status === 'success').length || 0;
    const failed = snapshot?.tasks.filter(task => task.status === 'failed').length || 0;
    toastr?.success(`批次结束：成功 ${success}，失败 ${failed}`, '衣柜生图');
  }
}

export function setupWardrobeActionBridge(enabled: boolean): void {
  const marker = '__ub_wardrobe_action_bound';
  const bound = !!(window as any)[marker];
  if (enabled && !bound) {
    window.addEventListener(UB_EVENT.wardrobeAction, handleWardrobeActionEvent);
    (window as any)[marker] = true;
  } else if (!enabled && bound) {
    window.removeEventListener(UB_EVENT.wardrobeAction, handleWardrobeActionEvent);
    (window as any)[marker] = false;
  }
}
