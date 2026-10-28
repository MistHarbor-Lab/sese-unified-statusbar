import { getTavernHelper, getToastr } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY, injectTriggerAndContext } from './ai-request-pipeline';
import { setButtonBusy } from './busy-state';
// ===== 剧情特卖 AI 生成 =====
// 照搬 core/calendar-ai.ts 模式：generateRaw + <sale> 标签 + 手写 YAML 解析。
// 失败返还消耗的 3 点能量（spec §4.3 用户追加条款）。
import {
  SHOP_STORY_MAX, SHOP_STORY_GEN_COUNT,
  SHOP_REFRESH_COST,
} from './constants';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { getAiReplyContext } from './map-system';
import { withNativeScanWorldbook } from './worldbook-entry';
import { getConfig } from './config-store';
import { getCustomApiConfig, validateCustomApiConfig, showPersistentError, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import { showBusyNow, showEnvNotReady, showApiConfigError, showGenOutputError, showGenCatchError } from './notify-presets';
import { readSerseEnergy, serseIncrementOp, warnSerseEnergyShort, deductSerseEnergyDirect, refundSerseEnergyDirect } from './energy-payment';
import {
  getCellByHeader, getSheetByName, getAutoCardAPI,
  invalidateCache, runDbBatch,
} from './data-manager';
import {
  loadShopData, saveShopData, type ShopData, type ShopStoryItem, type ShopStoryRegularItem, type ShopStorySkillItem,
} from './shop-store';
import {
  buildSaleInstruction, canonicalSkillName, parseSaleYaml, storyProductDedupeKey,
} from './shop-story-product';
import { ensureSkillTable } from './skill-table-ensure';
import { SKILL_TABLE_NAME, SKILL_COL } from './skill-types';
import { syncSkillWorldbook } from './skill-worldbook';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 03 待修：同上（与 gacha 的双向读取），解开方向=抽出共享的记录读取层
import { getGachaDrawnSet } from './gacha';
import { purchaseShopWardrobeItem } from './shop-wardrobe';
import { captureChatScope } from './story-floor-store';

let _storyItems: ShopStoryItem[] = [];
let _storyGenInProgress = false;
const _storyPurchaseInProgress = new Set<string>();

/** 获取当前内存态剧情特卖 */
export function getStoryItems(): ShopStoryItem[] { return _storyItems; }
export function setStoryItems(items: ShopStoryItem[]): void {
  _storyItems = items.filter(item => getConfig().wardrobeEnabled || item.kind !== 'wardrobe');
}


/** 从重要角色表/恋爱对象表随机取 N 个姓名（同日历触发世界书扫描） */
function getRandomCharNames(): string[] {
  try {
    const names: string[] = [];
    const tryTable = (table: string, col: string) => {
      // 简化：从 getCellByHeader 逐行读，最多取 2 个
      for (let i = 1; i <= 4; i++) {
        const n = getCellByHeader(table, i, col);
        if (n) names.push(n);
      }
    };
    tryTable('恋爱对象表', '姓名');
    tryTable('在场角色表', '姓名');
    return names.slice(0, 3);
  } catch (e) { return []; }
}

/** 正则抽 <sale>...</sale> */
function extractSaleContent(text: string): string {
  const m = text.match(/<sale>([\s\S]*?)<\/sale>/i);
  return m ? m[1].trim() : '';
}

// U31：扣/返能量走统一出口（原两份本地 helper 与 energy-payment 逐字同语义）。


/**
 * 执行剧情特卖 AI 生成。失败返还扣除的能量。
 * extraPrompt：长按输入的额外要求，不持久化，仅本次注入到指令末尾。
 * cost：本次生成扣除的能量（短按 3 / 长按 5）。
 */
export async function performStorySaleGeneration(
  btn?: HTMLButtonElement,
  extraPrompt?: string,
  cost: number = SHOP_REFRESH_COST,
): Promise<ShopStoryItem[] | null> {
  if (_storyGenInProgress) {
    showBusyNow('剧情特卖', '生成');
    return null;
  }
  const th = getTavernHelper();
  const generateRaw = th?.generateRaw;
  if (!generateRaw) {
    showEnvNotReady('剧情特卖');
    return null;
  }
  const apiErr = validateCustomApiConfig('shopStory');
  if (apiErr) {
    showApiConfigError('剧情特卖', apiErr);
    return null;
  }
  // 能量校验（不扣）
  const energy = readSerseEnergy(); // U31：统一出口
  if (energy < cost) {
    warnSerseEnergyShort('剧情特卖', cost, energy);
    return null;
  }

  _storyGenInProgress = true;
  // 忙碌视觉走 setButtonBusy（F22）；原 disabled 态仍需自行保存恢复
  const originalDisabled = btn?.disabled || false;
  if (btn) setButtonBusy(btn, true, '生成中...');

  // 先扣能量
  const deducted = await deductSerseEnergyDirect(cost);
  if (!deducted) {
    getToastr()?.error('扣除能量失败', '剧情特卖');
    _storyGenInProgress = false;
    if (btn) { setButtonBusy(btn, false, ''); btn.disabled = originalDisabled; }
    return null;
  }

  // 聊天归属守卫：AI 返回后要写当前聊天的 shop story；请求期间切聊天 → 整体丢弃并返还能量。
  const scope = captureChatScope('剧情特卖');

  try {
    const config = getConfig();
    const rawInstruction = buildSaleInstruction(
      config.skillEnabled,
      config.wardrobeEnabled,
      SHOP_STORY_GEN_COUNT,
    );
    let instruction = rawInstruction;
    // 长按额外要求：追加到指令末尾，仅本次生效（与大调查一致）
    if (extraPrompt && extraPrompt.trim()) {
      instruction += '\n\n---\n## 用户额外要求\n' + extraPrompt.trim() + '\n';
    }
    if (typeof th.substitudeMacros === 'function') {
      instruction = th.substitudeMacros(instruction);
    }
    // 进行中提示由统一 AI 活动注册表负责，这里不再单独弹 toast

    // 触发注入（position:'none'，只参与世界书扫描）：随机角色名 + 长按额外要求 + 剧情上下文正文。
    // max_chat_history 置 0 后原生 chat_history 不携带楼层、user_input 不参与绿灯扫描（小手机管线契约）——
    // 关键词条目的激活素材必须全部由本注入显式喂入。
    // 每次尝试都要重做「一次性注入 + 扫描准备 + 生成」：once:true 只在下一次生成生效，
    // 重试若在注入之内会丢掉资料块与触发素材。
    const runShopStoryRequest = async (ctx: TextAiContext) => {
    injectTriggerAndContext(th, {
      triggerId: 'shop_story_gen_trigger', contextId: 'shop_story_gen_context',
      storyContext: getAiReplyContext(config.shopStoryContextCount || 10), extraPrompt, charNames: getRandomCharNames(),
    });

    return await withNativeScanWorldbook({}, () => generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: instruction,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true }),
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      custom_api: getCustomApiConfig('shopStory'),
    }));
    };
    const result = await withTextAiRetry('shopStory', runShopStoryRequest, { feature: 'shopStory' });

    // 聊天归属守卫（写前核对）：切走后不写入新聊天、不打成就，静默丢弃。
    // 不返还能量：返还是写当前聊天（此时已是新聊天），会变成「切卡刷能量」；旧聊天为已发出的 token 付费。
    if (!scope.isCurrent()) return null;

    if (typeof result !== 'string') {
      showGenOutputError('剧情特卖', result);
      await refundSerseEnergyDirect(cost);
      return null;
    }
    const saleText = extractSaleContent(result);
    if (!saleText) {
      showGenOutputError('剧情特卖', result);
      await refundSerseEnergyDirect(cost);
      return null;
    }
    const parsed = parseSaleYaml(saleText);
    if (parsed.length === 0) {
      showGenOutputError('剧情特卖', result, {
        level: 'warning', title: '剧情特卖', suffix: '解析到 0 件有效商品',
      });
      await refundSerseEnergyDirect(cost);
      return null;
    }

    // 为新生成的道具分配全局唯一 id。AI 每次生成都用 sale_1..sale_N，若直接合并会与已存
    // 道具 id 冲突，导致 showDetail/buyStoryItem 按 id 查找时命中旧道具、buyStoryItem/gacha
    // 联动按 id 过滤时误删多件。这里用时间戳前缀保证跨次生成 id 不冲突（spec §2.1 示例
    // id 形如 sale_20260705_1，本就要求跨次唯一）。
    const idPrefix = 'sale_' + Date.now() + '_';
    parsed.forEach((item, i) => { item.id = idPrefix + (i + 1); });

    // 追加到 storySpecials，>20 保留最新 20；按 kind + 规范化名称去重。
    const data = await loadShopData();
    const existingKeys = new Set(data.storySpecials.map(storyProductDedupeKey));
    const fresh = parsed.filter(it => {
      const key = storyProductDedupeKey(it);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    let merged = data.storySpecials.concat(fresh);
    if (merged.length > SHOP_STORY_MAX) merged = merged.slice(merged.length - SHOP_STORY_MAX);
    const saveOk = await saveShopData({ regular: data.regular, storySpecials: merged });
    if (!saveOk) {
      showPersistentError('生成成功但存储失败，能量已返还。', '剧情特卖错误');
      await refundSerseEnergyDirect(cost);
      return null;
    }
    setStoryItems(merged);
    invalidateCache();
    getToastr()?.success('剧情特卖已生成 ' + fresh.length + ' 件新商品', '剧情特卖');
    // 成就打点：剧情特卖 AI 生成成功
    try { (window as any).__ubEmitAchievement?.('shop_story_gen', {}); } catch (e) { /* ignore */ }
    return _storyItems;
  } catch (e) {
    // 聊天已切换：旧聊天的失败也不该在新聊天弹错误（不返还能量，理由同成功分支）。
    if (!scope.isCurrent()) return null;
    if (isAiAbortError(e)) { await refundSerseEnergyDirect(cost); return null; } // 用户终止：静默返还能量
    showGenCatchError('剧情特卖', e, '能量已返还。');
    await refundSerseEnergyDirect(cost);
    return null;
  } finally {
    if (btn) { setButtonBusy(btn, false, ''); btn.disabled = originalDisabled; }
    _storyGenInProgress = false;
  }
}

interface OwnedSkill {
  rowIndex: number;
  rowId: number;
  exp: number;
}

/** 查主角技能表是否已掌握某技能（canonicalSkillName 规范化比对）；供常规售卖技能书购买复用。 */
export function findOwnedSkill(skillName: string): OwnedSkill | null {
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (!sheet || !Array.isArray(sheet.content) || sheet.content.length < 2) return null;
  const target = canonicalSkillName(skillName);
  const headers = sheet.content[0] || [];
  const rowIdCol = headers.indexOf('row_id');
  for (let rowIndex = 1; rowIndex < sheet.content.length; rowIndex++) {
    const existingName = getCellByHeader(SKILL_TABLE_NAME, rowIndex, SKILL_COL.name);
    if (canonicalSkillName(existingName) !== target) continue;
    const rawRowId = rowIdCol >= 0 ? sheet.content[rowIndex]?.[rowIdCol] : rowIndex;
    const rowId = Math.max(1, Number.parseInt(String(rawRowId), 10) || rowIndex);
    const exp = Math.max(
      0,
      Number.parseInt(getCellByHeader(SKILL_TABLE_NAME, rowIndex, SKILL_COL.exp) || '0', 10) || 0,
    );
    return { rowIndex, rowId, exp };
  }
  return null;
}

async function restoreReservedStoryItem(
  item: ShopStoryItem,
  originalIndex: number,
): Promise<boolean> {
  const latest = await loadShopData();
  if (latest.storySpecials.some(candidate => candidate.id === item.id)) {
    _storyItems = latest.storySpecials;
    return true;
  }
  const restored = latest.storySpecials.slice();
  restored.splice(Math.max(0, Math.min(originalIndex, restored.length)), 0, item);
  const ok = await saveShopData({ regular: latest.regular, storySpecials: restored });
  if (ok) _storyItems = restored;
  return ok;
}

async function buyStorySkillItem(
  itemId: string,
  data: ShopData,
  item: ShopStorySkillItem,
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<boolean> {
  if (!getConfig().skillEnabled) {
    getToastr()?.warning('请先开启技能功能后再购买该技能', '剧情特卖');
    return false;
  }
  if (!(await ensureSkillTable({ promptOnMissing: true }))) return false;

  const energy = readSerseEnergy(); // U31：统一出口
  if (energy < item.price) {
    warnSerseEnergyShort('剧情特卖', item.price, energy);
    return false;
  }
  const api = getAutoCardAPI();
  if (!api) return false;

  const owned = findOwnedSkill(item.name);
  if (
    owned
    && !await (confirm ?? window.confirm)(`已掌握「${item.name}」，本次购买将转化为该技能经验值 +100，消耗 ${item.price} 点瑟瑟能量。是否继续？`)
  ) return false;

  // 先持久化移除作为购买预留，避免双击/重入在数据库写入后重复消费。
  const originalIndex = data.storySpecials.findIndex(candidate => candidate.id === itemId);
  const reservedStory = data.storySpecials.filter(candidate => candidate.id !== itemId);
  const reservedData: ShopData = { regular: data.regular, storySpecials: reservedStory };
  if (!(await saveShopData(reservedData))) {
    getToastr()?.error('无法锁定该技能商品，请稍后重试', '剧情特卖');
    return false;
  }
  _storyItems = reservedStory;

  const skillOp = owned
    ? { kind: 'incrementCell' as const, tableName: '主角技能表', rowId: owned.rowId, colName: '技能经验值', delta: 100 }
    : {
        kind: 'insertRow' as const, tableName: '主角技能表',
        data: { '技能名称': item.name, '技能类别': item.skillType, '技能经验值': '0', '技能描述': item.desc },
      };
  const batchOk = await runDbBatch([
    serseIncrementOp(-item.price), // U31：统一出口（增量写：并发下不丢扣减）
    skillOp,
  ]);
  if (!batchOk) {
    const restored = await restoreReservedStoryItem(item, originalIndex);
    getToastr()?.error(
      restored ? '技能购买失败，能量未扣除且商品已恢复' : '技能购买失败，能量未扣除；商品恢复失败，请重新刷新商店',
      '剧情特卖',
    );
    return false;
  }

  invalidateCache();
  try {
    await syncSkillWorldbook();
  } catch (error) {
    console.warn('[剧情特卖] 技能已写入，但同步主角当前技能世界书失败:', error);
    getToastr()?.warning('技能已获得，但世界书同步失败；后续表更新时将再次同步', '剧情特卖');
  }
  getToastr()?.success(
    owned ? `已购买：${item.name}，技能经验值 +100` : `已习得技能：${item.name}`,
    '剧情特卖',
  );
  // 成就打点：技能书购买（剧情特卖）
  try {
    const _drawnArr = Array.from(getGachaDrawnSet());
    (window as any).__ubEmitAchievement?.('skill_book_bought', {
      skillId: item.id,
      skillName: item.name,
      strength: item.strength,
      skillType: item.skillType,
      source: 'shop_story',
      price: item.price,
      firstTime: owned ? 0 : 1,
      universalCount: _drawnArr.filter(id => id.startsWith('univ_skill_')).length,
    });
  } catch (_e) { /* ignore */ }
  return true;
}

async function buyStoryRegularItem(
  itemId: string,
  data: ShopData,
  item: ShopStoryRegularItem,
): Promise<boolean> {
  const energy = readSerseEnergy(); // U31：统一出口
  if (energy < item.price) {
    warnSerseEnergyShort('剧情特卖', item.price, energy);
    return false;
  }
  const api = getAutoCardAPI();
  if (!api) return false;
  const itemDesc = item.desc + ' [剧情特卖]';
  const batchOk = await runDbBatch([
    serseIncrementOp(-item.price), // U31：统一出口（增量写：并发下不丢扣减）
    {
      kind: 'insertRow', tableName: '物品表',
      data: { '物品名称': item.name, '类型': item.type, '数量': '1', '描述': itemDesc },
    },
  ]);
  if (!batchOk) {
    getToastr()?.error('写入失败，能量未扣除', '剧情特卖');
    return false;
  }
  const newStory = data.storySpecials.filter(it => it.id !== itemId);
  await saveShopData({ regular: data.regular, storySpecials: newStory });
  _storyItems = newStory;
  invalidateCache();
  getToastr()?.success('已购买：' + item.name, '剧情特卖');

  // 成就打点：source='shop_story'，剧情特卖无 quality 字段，qualityRank 用价格档推算
  const _rank = item.price >= 15 ? 0 : item.price >= 12 ? 1 : item.price >= 9 ? 2 : item.price >= 6 ? 3 : 4;
  try { (window as any).__ubEmitAchievement?.('gacha_draw', { qualityRank: _rank, source: 'shop_story', price: item.price }); } catch (e) { /* ignore */ }
  try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'gacha_draw' }); } catch (_e) { /* ignore */ }
  if (_rank === 0) { try { (window as any).__ubEmitAchievement?.('gacha_legendary', {}); } catch (e) { /* ignore */ } }
  return true;
}

async function buyStoryWardrobeItem(itemId: string): Promise<boolean> {
  const result = await purchaseShopWardrobeItem('story', itemId);
  if (!result.ok) {
    getToastr()?.warning(result.error, '剧情特卖');
    return false;
  }
  setStoryItems(result.shop.storySpecials);
  invalidateCache();
  getToastr()?.success('已加入衣柜：' + result.item.name, '剧情特卖');
  try {
    (window as any).__ubEmitAchievement?.('wardrobe_item_added', {
      category: result.item.category,
      amount: 1,
    });
  } catch (_e) { /* ignore */ }
  return true;
}

/** 购买剧情特卖物品；技能商品走技能表，普通商品保持原物品表行为。 */
export async function buyStoryItem(itemId: string, confirm?: (message: string) => boolean | Promise<boolean>): Promise<boolean> {
  if (_storyPurchaseInProgress.has(itemId)) {
    showBusyNow('剧情特卖', '处理');
    return false;
  }
  _storyPurchaseInProgress.add(itemId);
  try {
    const data = await loadShopData();
    const item = data.storySpecials.find(candidate => candidate.id === itemId);
    if (!item) {
      getToastr()?.warning('该商品已售出或不存在', '剧情特卖');
      return false;
    }
    if (item.kind === 'skill') return await buyStorySkillItem(itemId, data, item, confirm);
    if (item.kind === 'wardrobe') return await buyStoryWardrobeItem(itemId);
    return await buyStoryRegularItem(itemId, data, item);
  } finally {
    _storyPurchaseInProgress.delete(itemId);
  }
}
