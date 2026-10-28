// ===== 常规售卖逻辑 =====
// 选品/定价/特价/刷新/购买。存储通过 shop-store 落世界书；已获集合走 localStorage drawn set。
import { getToastr } from './env';
import {
  RARITY_PRICE_MAP, SHOP_REGULAR_COUNT, SHOP_SALE_COUNT,
  SHOP_SALE_DISCOUNT_MIN, SHOP_SALE_DISCOUNT_MAX, SHOP_REFRESH_COST,
} from './constants';
import { getConfig } from './config-store';
import { getGachaData, getGachaEffectivePools, getGachaDrawnSet, saveGachaDrawnSet, resetGachaDrawn } from './gacha';
import { getAutoCardAPI, invalidateCache, runDbBatch } from './data-manager';
import { readSerseEnergy, adjustSerseEnergy, serseIncrementOp, warnSerseEnergyShort } from './energy-payment';
import {
  loadShopData,
  preserveHiddenRegularWardrobeItems,
  saveShopData,
  type ShopRegularItem,
  type ShopData,
} from './shop-store';
import { type ShopSkillType, type ShopSkillStrength } from './shop-story-product';
import { findOwnedSkill } from './shop-story-ai';
import { ensureSkillTable } from './skill-table-ensure';
import { syncSkillWorldbook } from './skill-worldbook';
import UNIVERSAL_SKILLS_RAW from '../data/universal-skills.json';
import { mapInventoryTypeToWardrobeCategory } from './wardrobe-types';
import { purchaseShopWardrobeItem } from './shop-wardrobe';
import { readStoryClockRaw, formatDateKey } from './calendar-core';

/** 通用技能书目录（唯一事实源 = data/universal-skills.json） */
interface UniversalSkillSeed {
  id: string;
  name: string;
  skillType: ShopSkillType;
  strength: ShopSkillStrength;
  price: number;
  desc: string;
}
const UNIVERSAL_SKILLS: UniversalSkillSeed[] = (UNIVERSAL_SKILLS_RAW as any[])
  .map((raw: any): UniversalSkillSeed | null => {
    if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
    const skillType = raw.skillType === '主动' || raw.skillType === '被动' ? raw.skillType : '被动';
    const strength = ['基础', '实用', '强力', '稀有'].includes(raw.strength) ? raw.strength : '基础';
    return { id: raw.id, name: raw.name, skillType, strength, price: Number(raw.price) || 20, desc: String(raw.desc ?? '') };
  })
  .filter((x): x is UniversalSkillSeed => x !== null);

/** strength→quality 映射（仅作常规售卖非技能分支的后备展示；技能卡走专门渲染，不读 quality） */
const STRENGTH_TO_QUALITY: Record<ShopSkillStrength, string> = {
  基础: '普通', 实用: '优秀', 强力: '稀有', 稀有: '史诗',
};

/** 每期橱窗最多出现的通用技能书数（可为 0） */
const UNIVERSAL_SKILL_MAX_PER_WINDOW = 2;

/** 当前内存态常规售卖商品（弹窗打开期间缓存） */
let _regularItems: ShopRegularItem[] = [];

// 重入闸：「购买」与「手动刷新」都会读-改-写瑟瑟能量与橱窗列表，且中间跨多次 await
// （扣能量 / 批量入库 / 写世界书）。双击或在刷新过程中再点购买时，两次调用会基于同一份
// 能量与橱窗快照各写一次 ⇒ 能量只扣一次却可能多出一件（白嫖）或重复重选。故共用一把闸。
let _regularShopBusy = false;

/** 获取当前内存态常规售卖商品 */
export function getRegularItems(): ShopRegularItem[] {
  return _regularItems;
}

/** 读取当前游戏内日期（YYYY-MM-DD，年份带符号、幅值至少 4 位补零，负年份为公元前），失败返回空串 */
function getCurrentGameDate(): string {
  try {
    const raw = readStoryClockRaw();
    // 复用 calendar-core 的日期解析风格：提取带符号年份的日期（年份接受 1-6 位）
    const m = raw.match(/(-?\d{1,6})[-年.](\d{1,2})[-月.](\d{1,2})/);
    if (m) {
      // U32：拼装收编 formatDateKey（口径一致）
      return formatDateKey(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
    }
  } catch (e) { /* ignore */ }
  return '';
}

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 选品 + 定价 + 特价。返回新的 50 件（不足则展示剩余全部）。
 * skillEnabled 开启时，混入 ≤2 本通用技能书（可为 0），不受卡池选择影响。
 * 不写世界书（由调用方决定何时 save）。
 */
function pickRegularItems(): ShopRegularItem[] {
  const data = getGachaData();
  if (!data || !data.items) return [];
  const effectivePools = new Set(getGachaEffectivePools());
  if (effectivePools.size === 0) return [];
  const drawnSet = getGachaDrawnSet();

  // 1) 摇本期通用技能书数量（≤2，可为 0）。skillEnabled 关闭时整组短路 → 对不开技能的玩家零影响。
  const availableSkills = getConfig().skillEnabled
    ? UNIVERSAL_SKILLS.filter(s => !drawnSet.has(s.id))
    : [];
  const skillCap = Math.min(UNIVERSAL_SKILL_MAX_PER_WINDOW, availableSkills.length);
  const skillCount = skillCap > 0 ? Math.floor(Math.random() * (skillCap + 1)) : 0;

  // 2) 卡池商品预留 skillCount 格（总数恒 ≤ SHOP_REGULAR_COUNT）。
  const gachaTarget = Math.max(0, SHOP_REGULAR_COUNT - skillCount);
  const available = (data.items as any[]).filter((item: any) => {
    if (!item.enabled) return false;
    if (drawnSet.has(item.id)) return false;
    if (mapInventoryTypeToWardrobeCategory(item.type) && !getConfig().wardrobeEnabled) return false;
    const tags = item.poolTags || [];
    return tags.some((t: string) => effectivePools.has(t));
  });
  const gachaPicked = shuffle(available).slice(0, gachaTarget);

  // 3) 选 skillCount 本通用技能书（已购的 availableSkills 已过滤掉）。
  const skillPicked = skillCount > 0 ? shuffle(availableSkills).slice(0, skillCount) : [];

  // 4) 合并后再洗牌，技能书不固定出现在末尾。
  const combined: any[] = shuffle(gachaPicked.concat(skillPicked));

  // 定价 + 转 ShopRegularItem
  const items: ShopRegularItem[] = combined.map((item: any) => {
    if (item.kind === 'skill') {
      // 通用技能书：用目录自带固定价（不走 RARITY_PRICE_MAP，价格沿用剧情特卖 strength 档位）
      const s = item as UniversalSkillSeed;
      return {
        id: s.id,
        name: s.name,
        type: '技能',
        quality: STRENGTH_TO_QUALITY[s.strength] || '普通',
        price: s.price,
        desc: s.desc,
        kind: 'skill',
        skillType: s.skillType,
        strength: s.strength,
      };
    }
    const basePrice = RARITY_PRICE_MAP[item.quality] || 3;
    const wardrobeCategory = mapInventoryTypeToWardrobeCategory(item.type);
    return {
      id: item.id,
      name: item.name,
      type: item.type || '道具',
      quality: item.quality || '普通',
      price: basePrice,
      desc: item.description || '',
      ...(wardrobeCategory ? { kind: 'wardrobe' as const, category: wardrobeCategory } : {}),
    };
  });

  // 随机选 SHOP_SALE_COUNT 件打特价（不足则全打）；技能书固定价不参与特价。
  const saleCandidates = items.map((_, i) => i).filter(i => items[i].kind !== 'skill');
  const saleIdx = shuffle(saleCandidates).slice(0, Math.min(SHOP_SALE_COUNT, saleCandidates.length));
  for (const idx of saleIdx) {
    const it = items[idx];
    const discount = SHOP_SALE_DISCOUNT_MIN +
      Math.floor(Math.random() * (SHOP_SALE_DISCOUNT_MAX - SHOP_SALE_DISCOUNT_MIN + 1));
    it.originalPrice = it.price;
    it.discount = discount;
    it.price = Math.max(1, Math.round(it.price * (1 - discount / 100)));
  }
  return items;
}

/**
 * 打开弹窗时调用：若世界书无 regular.items 或日期变更，自动刷新（不消耗能量）。
 * 返回当前应展示的常规售卖商品。
 */
export async function ensureRegularShop(): Promise<ShopRegularItem[]> {
  const data = await loadShopData();
  const today = getCurrentGameDate();
  const needRefresh = data.regular.items.length === 0 || data.regular.date !== today;
  if (needRefresh) {
    const items = pickRegularItems();
    const persistedItems = preserveHiddenRegularWardrobeItems(
      items,
      data.regular.items,
      getConfig().wardrobeEnabled,
    );
    const newData: ShopData = {
      regular: { date: today, items: persistedItems },
      storySpecials: data.storySpecials,
    };
    const ok = await saveShopData(newData);
    if (ok) {
      _regularItems = items;
    } else {
      _regularItems = data.regular.items.filter(item =>
        getConfig().wardrobeEnabled || item.kind !== 'wardrobe');  // 写盘失败回退到旧数据
    }
  } else {
    _regularItems = data.regular.items.filter(item => getConfig().wardrobeEnabled || item.kind !== 'wardrobe');
  }
  return _regularItems;
}

/** 手动刷新：消耗 3 能量 + 重选 + 写世界书 */
export async function manualRefreshRegular(): Promise<boolean> {
  if (_regularShopBusy) {
    getToastr()?.warning('商店正在处理中，请稍候', '商店提示');
    return false;
  }
  const energy = readSerseEnergy(); // U31：统一出口
  if (energy < SHOP_REFRESH_COST) {
    warnSerseEnergyShort('商店提示', SHOP_REFRESH_COST, energy);
    return false;
  }
  // 后端在场判定走统一出口（SeseLedgerAPI 优先——台账接管时 AutoCardUpdaterAPI 别名不在本 iframe，裸读会漏判）
  const api = getAutoCardAPI();
  if (!api) return false;
  _regularShopBusy = true;
  try {
    // 先扣能量
    const ok = await adjustSerseEnergy(-SHOP_REFRESH_COST); // U31：直写通道（先扣后做；增量写）
    if (!ok) {
      getToastr()?.error('扣除能量失败', '商店提示');
      return false;
    }
    // 重选 + 写世界书
    const items = pickRegularItems();
    const data = await loadShopData();
    const persistedItems = preserveHiddenRegularWardrobeItems(
      items,
      data.regular.items,
      getConfig().wardrobeEnabled,
    );
    const newData: ShopData = {
      regular: { date: getCurrentGameDate(), items: persistedItems },
      storySpecials: data.storySpecials,
    };
    const saveOk = await saveShopData(newData);
    if (!saveOk) {
      // 写盘失败：能量不返还（已消耗是事实），但提示用户
      getToastr()?.warning('橱窗已刷新但存储失败，下次打开可能还原', '商店提示');
    } else {
      _regularItems = items;
      getToastr()?.success('橱窗已刷新', '商店提示');
    }
    invalidateCache();
    // 成就打点：手动刷新橱窗成功
    try { (window as any).__ubEmitAchievement?.('shop_refresh', {}); } catch (e) { /* ignore */ }
    return true;
  } finally {
    _regularShopBusy = false;
  }
}

/** 购买常规售卖物品 */
export async function buyRegularItem(itemId: string): Promise<boolean> {
  if (_regularShopBusy) {
    getToastr()?.warning('商店正在处理中，请稍候', '商店提示');
    return false;
  }
  const item = _regularItems.find(it => it.id === itemId);
  if (!item || item.kind === 'wardrobe') {
    getToastr()?.warning('该商品已售出或不存在', '商店提示');
    return false;
  }
  const energy = readSerseEnergy(); // U31：统一出口
  if (energy < item.price) {
    warnSerseEnergyShort('商店提示', item.price, energy);
    return false;
  }
  const api = getAutoCardAPI();
  if (!api) return false;
  // 「检查→置位」之间无 await（上方均为同步读取），单线程下原子；下方跨 await 的整段受 finally 保护。
  _regularShopBusy = true;
  try {
    // 批量写入：扣能量 + 插入物品（结构化入队，flush 单次 SQL 批量；失败整体失败，无原生回退）
    const itemDesc = item.desc + (item.quality ? ' [' + item.quality + ']' : '');
    const batchOk = await runDbBatch([
      serseIncrementOp(-item.price), // U31：统一出口（增量写：并发下不丢扣减）
      {
        kind: 'insertRow', tableName: '物品表',
        data: { '物品名称': item.name, '类型': item.type, '数量': '1', '描述': itemDesc },
      },
    ]);
    if (!batchOk) {
      getToastr()?.error('写入失败，能量未扣除', '商店提示');
      return false;
    }
    // 加入 drawn set
    const drawnSet = getGachaDrawnSet();
    drawnSet.add(item.id);
    saveGachaDrawnSet(drawnSet);
    // 从橱窗移除 + 写世界书
    _regularItems = _regularItems.filter(it => it.id !== itemId);
    const data = await loadShopData();
    await saveShopData({
      regular: {
        date: data.regular.date,
        items: preserveHiddenRegularWardrobeItems(
          _regularItems,
          data.regular.items,
          getConfig().wardrobeEnabled,
        ),
      },
      storySpecials: data.storySpecials,
    });
    invalidateCache();
    getToastr()?.success('已购买：' + item.name, '商店提示');

    // 成就打点：复用 gacha_draw，source='shop_regular'，discount 用于特价判定（无特价为 0）
    const _q = item.quality;
    const _rank = _q === '传说' ? 0 : _q === '史诗' ? 1 : _q === '稀有' ? 2 : _q === '优秀' ? 3 : 4;
    try { (window as any).__ubEmitAchievement?.('gacha_draw', { qualityRank: _rank, source: 'shop_regular', price: item.price, discount: item.discount ?? 0 }); } catch (e) { /* ignore */ }
    try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'gacha_draw' }); } catch (_e) { /* ignore */ }
    if (_rank === 0) { try { (window as any).__ubEmitAchievement?.('gacha_legendary', {}); } catch (e) { /* ignore */ } }
    return true;
  } finally {
    _regularShopBusy = false;
  }
}

/** 购买常规售卖衣柜商品：原子写入衣柜与商店，不进入物品表。 */
export async function buyRegularWardrobeItem(itemId: string): Promise<boolean> {
  const item = _regularItems.find(candidate => candidate.id === itemId);
  if (!item || item.kind !== 'wardrobe') {
    getToastr()?.warning('该衣柜商品已售出或不存在', '商店提示');
    return false;
  }
  const result = await purchaseShopWardrobeItem('regular', itemId);
  if (!result.ok) {
    getToastr()?.warning(result.error, '商店提示');
    return false;
  }
  _regularItems = result.shop.regular.items.filter(candidate =>
    getConfig().wardrobeEnabled || candidate.kind !== 'wardrobe');
  const drawnSet = getGachaDrawnSet();
  drawnSet.add(item.id);
  saveGachaDrawnSet(drawnSet);
  invalidateCache();
  getToastr()?.success('已加入衣柜：' + item.name, '商店提示');
  try {
    (window as any).__ubEmitAchievement?.('wardrobe_item_added', {
      category: result.item.category,
      amount: 1,
    });
  } catch (_e) { /* ignore */ }
  return true;
}

/** 购买常规售卖中的通用技能书：写入主角技能表（已掌握则转经验 +100），不入物品表。镜像剧情特卖的 buyStorySkillItem。 */
export async function buyRegularSkillItem(itemId: string, confirm?: (message: string) => boolean | Promise<boolean>): Promise<boolean> {
  const item = _regularItems.find(it => it.id === itemId);
  if (!item || item.kind !== 'skill') {
    getToastr()?.warning('该商品已售出或不存在', '商店提示');
    return false;
  }
  if (!getConfig().skillEnabled) {
    getToastr()?.warning('请先开启技能功能后再购买该技能', '商店提示');
    return false;
  }
  if (!(await ensureSkillTable({ promptOnMissing: true }))) return false;

  const energy = readSerseEnergy(); // U31：统一出口
  if (energy < item.price) {
    warnSerseEnergyShort('商店提示', item.price, energy);
    return false;
  }
  const api = getAutoCardAPI();
  if (!api) return false;

  const skillType = item.skillType || '被动';
  const owned = findOwnedSkill(item.name);
  if (
    owned
    && !await (confirm ?? window.confirm)(`已掌握「${item.name}」，本次购买将转化为该技能经验值 +100，消耗 ${item.price} 点瑟瑟能量。是否继续？`)
  ) return false;

  // 先持久化移除作购买预留，避免双击/重入在数据库写入后重复消费。
  const originalIndex = _regularItems.findIndex(it => it.id === itemId);
  const reservedItems = _regularItems.filter(it => it.id !== itemId);
  const reservedData = await loadShopData();
  const persistedReservedItems = preserveHiddenRegularWardrobeItems(
    reservedItems,
    reservedData.regular.items,
    getConfig().wardrobeEnabled,
  );
  if (!(await saveShopData({
    regular: { date: reservedData.regular.date, items: persistedReservedItems },
    storySpecials: reservedData.storySpecials,
  }))) {
    getToastr()?.error('无法锁定该技能商品，请稍后重试', '商店提示');
    return false;
  }
  _regularItems = reservedItems;

  const skillOp = owned
    ? { kind: 'incrementCell' as const, tableName: '主角技能表', rowId: owned.rowId, colName: '技能经验值', delta: 100 }
    : {
        kind: 'insertRow' as const, tableName: '主角技能表',
        data: { '技能名称': item.name, '技能类别': skillType, '技能经验值': '0', '技能描述': item.desc },
      };
  const batchOk = await runDbBatch([
    serseIncrementOp(-item.price), // U31：统一出口（增量写：并发下不丢扣减）
    skillOp,
  ]);
  if (!batchOk) {
    // 恢复预留商品
    const restored = _regularItems.slice();
    restored.splice(Math.max(0, Math.min(originalIndex, restored.length)), 0, item);
    const failData = await loadShopData();
    const restoredOk = await saveShopData({
      regular: {
        date: failData.regular.date,
        items: preserveHiddenRegularWardrobeItems(
          restored,
          failData.regular.items,
          getConfig().wardrobeEnabled,
        ),
      },
      storySpecials: failData.storySpecials,
    });
    _regularItems = restoredOk ? restored : _regularItems;
    getToastr()?.error(
      restoredOk ? '技能购买失败，能量未扣除且商品已恢复' : '技能购买失败，能量未扣除；商品恢复失败，请重新刷新商店',
      '商店提示',
    );
    return false;
  }

  // 成功：入 drawn set（买过当期不再出现）+ 同步技能世界书
  const drawnSet = getGachaDrawnSet();
  drawnSet.add(item.id);
  saveGachaDrawnSet(drawnSet);
  invalidateCache();
  try {
    await syncSkillWorldbook();
  } catch (error) {
    console.warn('[常规售卖] 技能已写入，但同步主角当前技能世界书失败:', error);
    getToastr()?.warning('技能已获得，但世界书同步失败；后续表更新时将再次同步', '商店提示');
  }
  getToastr()?.success(
    owned ? `已购买：${item.name}，技能经验值 +100` : `已习得技能：${item.name}`,
    '商店提示',
  );
  // 成就打点：技能书购买（常规售卖）
  try {
    const _drawnArr = Array.from(drawnSet);
    const _universalCount = _drawnArr.filter(id => id.startsWith('univ_skill_')).length;
    const _rareSkillIds = new Set(UNIVERSAL_SKILLS.filter(s => s.strength === '稀有').map(s => s.id));
    const _strengthRareCount = _drawnArr.filter(id => _rareSkillIds.has(id)).length;
    const _windowCleared = _regularItems.filter(it => it.kind === 'skill').length === 0 ? 1 : 0;
    (window as any).__ubEmitAchievement?.('skill_book_bought', {
      skillId: item.id,
      skillName: item.name,
      strength: item.strength,
      skillType: item.skillType,
      source: 'shop_regular',
      price: item.price,
      firstTime: owned ? 0 : 1,
      universalCount: _universalCount,
      strengthRareCount: _strengthRareCount,
      windowCleared: _windowCleared,
    });
  } catch (_e) { /* ignore */ }
  return true;
}

/** 重置：清 drawn set + 清空 regular.items（下次打开自动重刷） */
export async function resetShop(): Promise<void> {
  resetGachaDrawn();
  const data = await loadShopData();
  await saveShopData({ regular: { date: '', items: [] }, storySpecials: data.storySpecials });
  _regularItems = [];
  invalidateCache();
}
