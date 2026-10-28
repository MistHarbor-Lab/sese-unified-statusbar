// ===== 抽奖功能（卡池系统） =====
import { ubIcon } from './icons';
import { getConfig, setConfig } from './config-store';
import { getAutoCardAPI, invalidateCache, runDbBatch, type DbWriteOp } from './data-manager';
import { readSerseEnergy, warnSerseEnergyShort, serseIncrementOp } from './energy-payment';
import { type StyleType, GACHA_COST, GACHA10_COST, GACHA_STORY_LINK_RATE } from './constants';
import { loadShopData, saveShopData, type ShopStoryItem } from './shop-store';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 03 待修：抽卡要读「剧情特卖」的抽中集合，而特卖生成要读抽卡记录 ⇒ 二者共用一个记录读取层即可解
import { setStoryItems } from './shop-story-ai';
import { deleteStoryFeature, readStoryFeature, writeStoryFeature } from './story-floor-store';
import { getToastr } from './env';

const GACHA_DRAWN_STORY_KEY = 'gacha.drawn';

/** 获取卡池数据（优先当前窗口，回退父窗口） */
export function getGachaData(): any {
  try {
    const data = (window as any).__ub_gacha_data;
    if (data) return data;
  } catch(e) {}
  try {
    const data = (parent as any).__ub_gacha_data;
    if (data) return data;
  } catch(e) {}
  return null;
}

/** 获取当前聊天的已抽取物品 ID 集合。 */
export function getGachaDrawnSet(): Set<string> {
  return new Set(readStoryFeature<string[]>(GACHA_DRAWN_STORY_KEY, []));
}

/** 保存当前聊天的已抽取物品 ID 集合。 */
export function saveGachaDrawnSet(drawn: Set<string>): void {
  void writeStoryFeature(GACHA_DRAWN_STORY_KEY, Array.from(drawn));
}

/** 获取用户选择的抽奖池子ID列表 */
export function getGachaSelectedPools(): string[] {
  const selected = getConfig().gachaSelectedPoolIds;
  if (selected !== null) return [...selected];
  const allIds = getGachaAllPoolIds();
  setConfig('gachaSelectedPoolIds', allIds);
  return allIds;
}

/** 保存用户选择的抽奖池子ID列表 */
export function setGachaSelectedPools(ids: string[]): void {
  setConfig('gachaSelectedPoolIds', Array.from(new Set(ids)));
}

/** 获取卡池数据中所有池子ID */
export function getGachaAllPoolIds(): string[] {
  const data = getGachaData();
  if (!data || !data.pools) return [];
  return (data.pools as any[]).map((p: any) => p.id);
}

/** 获取当前生效的抽奖池子ID */
export function getGachaEffectivePools(): string[] {
  const selected = getGachaSelectedPools();
  const allIds = getGachaAllPoolIds();
  const valid = selected.filter(id => allIds.includes(id));
  if (valid.length === 0) return allIds;
  return valid;
}

/** 重置抽奖缓存（清空已抽取标记） */
export function resetGachaDrawn(): void {
  void deleteStoryFeature(GACHA_DRAWN_STORY_KEY);
}

/**
 * 从卡池中加权随机抽取一件物品。
 * @param storySpecials 当前剧情特卖橱窗；非空时 GACHA_STORY_LINK_RATE 概率抽其中一件
 * @returns { item, source } 或 null；source='storySpecial' 时 item 为 ShopStoryItem
 */
export function drawGachaItem(storySpecials: ShopStoryItem[] = [], drawnOverride?: Set<string>): { item: any; source: 'gacha' | 'storySpecial' } | null {
  // 15% 联动：从剧情特卖抽一件
  if (storySpecials.length > 0 && Math.random() < GACHA_STORY_LINK_RATE) {
    const idx = Math.floor(Math.random() * storySpecials.length);
    return { item: storySpecials[idx], source: 'storySpecial' };
  }
  // 原卡池逻辑
  const data = getGachaData();
  if (!data || !data.items) return null;
  const effectivePools = new Set(getGachaEffectivePools());
  if (effectivePools.size === 0) return null;
  const drawnSet = drawnOverride || getGachaDrawnSet();
  const poolHasItems = new Map<string, boolean>();
  for (const poolId of effectivePools) poolHasItems.set(poolId, false);
  const available = (data.items as any[]).filter((item: any) => {
    if (!item.enabled) return false;
    if (drawnSet.has(item.id)) return false;
    const tags = item.poolTags || [];
    const inPool = tags.some((t: string) => effectivePools.has(t));
    if (inPool) { for (const t of tags) if (effectivePools.has(t)) poolHasItems.set(t, true); }
    return inPool;
  });
  if (available.length === 0) return null;
  const totalWeight = available.reduce((sum: number, item: any) => sum + (item.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  for (const item of available) {
    rand -= (item.weight || 1);
    if (rand <= 0) return { item, source: 'gacha' };
  }
  return { item: available[available.length - 1], source: 'gacha' };
}

let _gachaInProgress = false;

function gachaActionLabel(style: StyleType): string {
  return style === 'ancient' ? '求签' : style === 'xianxia' ? '探宝' : style === 'sweet' ? '心动抽' : style === 'bridge' ? '补给抽取' : '抽奖';
}

/** 执行单抽（5 能量） */
export async function performGachaDraw(
  style: StyleType,
  onRender: () => void,
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<void> {
  if (_gachaInProgress) {
    getToastr()?.warning('正在处理中，请稍候...', gachaActionLabel(style));
    return;
  }
  _gachaInProgress = true;
  try {
    invalidateCache();
    const energy = readSerseEnergy(); // U31：统一出口
    const costLabel = gachaActionLabel(style);
    if (energy < GACHA_COST) { warnSerseEnergyShort(costLabel, GACHA_COST, energy); return; }
    const gachaData = getGachaData();
    if (!gachaData) { getToastr()?.error('卡池数据未加载', costLabel + '提示'); return; }
    if (!await (confirm ?? window.confirm)('确认消耗 ' + GACHA_COST + ' 点瑟瑟能量进行' + costLabel + '？')) return;

    // 读剧情特卖用于联动
    const shopData = await loadShopData();
    const draw = drawGachaItem(shopData.storySpecials);
    if (!draw) { getToastr()?.warning('所有卡池已抽空，请前往设置→功能→商店 重置', costLabel + '提示'); return; }

    const api = getAutoCardAPI();
    if (!api) return;

    const { item, source } = draw;
    const isStory = source === 'storySpecial';
    const qualityLabel = isStory ? '剧情特卖' : (item.quality || '');
    const itemQty = parseInt(String(item.grantQuantity || 1)) || 1;
    const itemDesc = (item.description || item.desc || '') + ' [' + qualityLabel + ']';

    // 批量写入：扣能量 + 插入物品（结构化入队，flush 单次 SQL 批量；失败整体失败，无原生回退）
    const batchOk = await runDbBatch([
      serseIncrementOp(-GACHA_COST), // U31：统一出口（增量写：并发下不丢扣减）
      {
        kind: 'insertRow', tableName: '物品表',
        data: { '物品名称': item.name, '类型': item.type || '道具', '数量': String(itemQty), '描述': itemDesc },
      },
    ]);

    if (batchOk) {
      const drawnSet = getGachaDrawnSet();
      drawnSet.add(item.id);
      saveGachaDrawnSet(drawnSet);
      // 抽到特卖：从 storySpecials 移除 + 写世界书
      if (isStory) {
        const newStory = shopData.storySpecials.filter((it: ShopStoryItem) => it.id !== item.id);
        await saveShopData({ regular: shopData.regular, storySpecials: newStory });
        // 同步内存态剧情特卖缓存（renderShop 读 getStoryItems()），否则抽走的道具仍残留在橱窗
        try { setStoryItems(newStory); } catch (e) { /* ignore */ }
        // 成就打点：单抽联动抽到剧情特卖
        try { (window as any).__ubEmitAchievement?.('shop_story_link', {}); } catch (e) { /* ignore */ }
      }
      invalidateCache();
      const qualityIcon = qualityLabel === '传说' ? ubIcon('star') : qualityLabel === '史诗' ? ubIcon('sparkle') : qualityLabel === '稀有' ? ubIcon('gem') : qualityLabel === '优秀' ? ubIcon('thumb') : isStory ? ubIcon('sparkle') : '';
      getToastr()?.success(
        costLabel + '获得：' + qualityIcon + item.name + (qualityLabel ? ' (' + qualityLabel + ')' : ''),
        costLabel + '提示'
      );
      onRender();
      const _q = isStory ? '' : (item.quality || '');
      const _rank = _q === '传说' ? 0 : _q === '史诗' ? 1 : _q === '稀有' ? 2 : _q === '优秀' ? 3 : 4;
      try { (window as any).__ubEmitAchievement?.('gacha_draw', { qualityRank: _rank, source: 'gacha', price: GACHA_COST }); } catch (e) { /* ignore */ }
      try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'gacha_draw' }); } catch (_e) { /* ignore */ }
      if (_rank === 0) { try { (window as any).__ubEmitAchievement?.('gacha_legendary', {}); } catch (e) { /* ignore */ } }
    } else {
      getToastr()?.error('写入失败，能量未扣除', costLabel + '提示');
    }
  } finally {
    _gachaInProgress = false;
  }
}

/** 执行十连抽（45 能量，executeSqlBatch 批量写物品表+扣能量） */
export async function performGachaDraw10(
  style: StyleType,
  onRender: () => void,
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<void> {
  if (_gachaInProgress) {
    getToastr()?.warning('正在处理中，请稍候...', '十连抽');
    return;
  }
  _gachaInProgress = true;
  try {
    invalidateCache();
    const energy = readSerseEnergy(); // U31：统一出口
    const costLabel = gachaActionLabel(style);
    if (energy < GACHA10_COST) { warnSerseEnergyShort(costLabel, GACHA10_COST, energy); return; }
    const gachaData = getGachaData();
    if (!gachaData) { getToastr()?.error('卡池数据未加载', costLabel + '提示'); return; }
    if (!await (confirm ?? window.confirm)('确认消耗 ' + GACHA10_COST + ' 点瑟瑟能量进行十连' + costLabel + '？')) return;

    const api = getAutoCardAPI();
    if (!api) return;

    // 读剧情特卖用于联动
    let shopData = await loadShopData();
    const results: { item: any; source: 'gacha' | 'storySpecial' }[] = [];
    const storyToRemove: string[] = [];
    // 循环内即时更新 drawn set 并写 localStorage，避免十连重复抽到同一件 gacha 物品
    // （drawGachaItem 每次读 localStorage drawnSet 过滤已抽，不即时写回会重复抽）
    const drawnSetLive = getGachaDrawnSet();
    for (let i = 0; i < 10; i++) {
      const draw = drawGachaItem(shopData.storySpecials, drawnSetLive);
      if (!draw) break;
      results.push(draw);
      drawnSetLive.add(draw.item.id);
      if (draw.source === 'storySpecial') {
        storyToRemove.push(draw.item.id);
        shopData = { regular: shopData.regular, storySpecials: shopData.storySpecials.filter(it => it.id !== draw.item.id) };
      }
    }
    if (results.length === 0) {
      getToastr()?.warning('所有卡池已抽空，请前往设置→功能→商店 重置', costLabel + '提示');
      return;
    }

    // 批量写入：扣能量 + 10 条物品插入（结构化入队，flush 单次 executeSqlBatch）
    const ops: DbWriteOp[] = [
      // 第 1 条：扣能量（必须成功，否则后续 INSERT 无意义）
      serseIncrementOp(-GACHA10_COST), // U31：统一出口（增量写：并发下不丢扣减）
    ];
    for (const r of results) {
      const it = r.item;
      const q = r.source === 'storySpecial' ? '剧情特卖' : (it.quality || '');
      const desc = (it.description || it.desc || '') + ' [' + q + ']';
      ops.push({
        kind: 'insertRow', tableName: '物品表',
        data: { '物品名称': it.name, '类型': it.type || '道具', '数量': '1', '描述': desc },
      });
    }
    const batchOk = await runDbBatch(ops);
    if (!batchOk) { getToastr()?.error('写入失败，能量未扣除', costLabel + '提示'); return; }

    // 更新 drawn set
    const drawnSet = getGachaDrawnSet();
    for (const r of results) drawnSet.add(r.item.id);
    saveGachaDrawnSet(drawnSet);

    // 一次性写世界书（storySpecials 变化）
    if (storyToRemove.length > 0) {
      await saveShopData(shopData);
      // 同步内存态剧情特卖缓存，否则十连抽走的剧情道具仍残留在橱窗
      try { setStoryItems(shopData.storySpecials); } catch (e) { /* ignore */ }
    }

    invalidateCache();
    // 汇总 toastr
    const names = results.map(r => r.item.name).join('、');
    getToastr()?.success('十连' + costLabel + '获得 ' + results.length + ' 件：' + names, costLabel + '提示');
    onRender();

    // 成就打点：逐件 emit（让 counter-store / streak-window 正常累计）
    // source 统一为 'gacha'（"抽奖方式获得"语义，与单抽一致）；剧情联动用独立事件 'shop_story_link' 追踪，
    // 不依赖 source 字段。这样 gacha_draw 的 source 三种清晰：'gacha'（抽奖，含 story-link）/ 'shop_regular' / 'shop_story'。
    for (const r of results) {
      const _q = r.source === 'storySpecial' ? '' : (r.item.quality || '');
      const _rank = _q === '传说' ? 0 : _q === '史诗' ? 1 : _q === '稀有' ? 2 : _q === '优秀' ? 3 : 4;
      try { (window as any).__ubEmitAchievement?.('gacha_draw', { qualityRank: _rank, source: 'gacha', price: 0 }); } catch (e) { /* ignore */ }
      if (_rank === 0) { try { (window as any).__ubEmitAchievement?.('gacha_legendary', {}); } catch (e) { /* ignore */ } }
      // 抽到剧情特卖联动：独立事件追踪
      if (r.source === 'storySpecial') { try { (window as any).__ubEmitAchievement?.('shop_story_link', {}); } catch (e) { /* ignore */ } }
    }
    // 十连抽成功（一次性事件，用于 gacha10_count 计数器；price 用于 shop_energy_spent 累加 45 能量）
    try { (window as any).__ubEmitAchievement?.('gacha10', { price: GACHA10_COST }); } catch (e) { /* ignore */ }
    try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'gacha_draw' }); } catch (_e) { /* ignore */ }
  } finally {
    _gachaInProgress = false;
  }
}

// 暴露抽奖工具函数到全局（供 config-panel 使用）
export function exposeGachaGlobals(): void {
  (window as any).__ub_getGachaData = getGachaData;
  (window as any).__ub_getGachaDrawnSet = getGachaDrawnSet;
  (window as any).__ub_saveGachaDrawnSet = saveGachaDrawnSet;
  (window as any).__ub_getGachaSelectedPools = getGachaSelectedPools;
  (window as any).__ub_setGachaSelectedPools = setGachaSelectedPools;
  (window as any).__ub_getGachaAllPoolIds = getGachaAllPoolIds;
  (window as any).__ub_resetGachaDrawn = resetGachaDrawn;
}
