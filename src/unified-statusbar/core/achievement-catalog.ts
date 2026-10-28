// ===== 成就系统 · 成就目录（数据导入层 · O39 惰性解析） =====
// 唯一事实源：../achievements/achievements.json（撰写成就只改那个文件，不改本文件）。
// 撰写流程见 ../achievements/authoring-guide.md，字段约束见 ../achievements/schema.md。
//
// O39(第十一轮)：503KB/944 条的目录原本随静态 import 链在插件启动即求值
// （index→engine→catalog，哪怕用户从不开成就簿）。改为**包内动态 import**：
// webpack 在 LimitChunkCountPlugin(maxChunks:1) 下仍把 JSON 留在同一产物文件里
// （零网络请求、零新文件、分发形态与两级产物完全不变），只是把「对象字面量构建+校验」
// 从启动的同步求值路径挪到首次使用。装载在微任务内完成（~毫秒级），远早于外部存档
// 就绪（1~3 秒网络往返）⇒ 第一次扫描/打开面板时目录必已就绪；扫描入口另有就绪门兜底。
import type { AchievementDef, Observe } from './achievement-types';

/** 必填字段 + observe 类型白名单校验。失败条目打 console.warn 并剔除（非致命，不影响其他成就与状态栏）。 */
function validateCatalog(raw: any): AchievementDef[] {
  const VALID_CATS = new Set(['养成', '剧情', '收集', '功能', '纪事', '称号', '隐藏']);
  const VALID_OBS = new Set([
    'numeric-threshold', 'numeric-any-row', 'counter-rows', 'collection',
    'enum-state', 'age-range-rows', 'cross-table-numeric',
    'counter-store', 'snapshot-delta', 'chat-snapshot-delta', 'individuals-delta',
    'feature-event', 'streak-window', 'session-duration', 'meta', 'compound',
    'calendar-event', 'daily-action', 'window-action', 'current-value',
    // 第九轮新增：real-clock = 现实本地时钟彩蛋（L10）；tier-at-least = 段位勋章（L12）
    'real-clock', 'tier-at-least',
  ]);
  const seen = new Set<string>();
  const out: AchievementDef[] = [];
  const list: any[] = Array.isArray(raw?.achievements) ? raw.achievements : [];
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const id = a.id;
    if (typeof id !== 'string' || !id) { console.warn('[achievement] 跳过：缺 id'); continue; }
    if (seen.has(id)) { console.warn('[achievement] 跳过：重复 id =', id); continue; }
    if (typeof a.name !== 'string' || !a.name) { console.warn('[achievement] 跳过：缺 name =', id); continue; }
    if (!VALID_CATS.has(a.cat)) { console.warn('[achievement] 跳过：非法 cat =', a.cat, '(', id, ')'); continue; }
    const obs: Observe | undefined = a.observe;
    if (!obs || typeof obs !== 'object' || !VALID_OBS.has((obs as any).type)) {
      console.warn('[achievement] 跳过：observe 缺失或 type 未识别 =', id, (obs as any)?.type); continue;
    }
    // rarity 必填校验（_^_ 内部条目豁免，不展示不计分）
    if (!id.startsWith('_')) {
      if (typeof a.rarity !== 'number' || ![0, 1, 2, 3].includes(a.rarity)) {
        console.warn('[achievement] 跳过：rarity 缺失或非法 =', id); continue;
      }
    }
    seen.add(id);
    out.push(a as AchievementDef);
  }
  return out;
}

let _catalog: AchievementDef[] | null = null;
let _byId: Map<string, AchievementDef> | null = null;
let _loading: Promise<void> | null = null;

/** 目录是否已解析（就绪门用）。 */
export function achievementCatalogReady(): boolean {
  return _catalog !== null;
}

/** 装载目录（幂等；并发调用共享同一 Promise）。resolve 后 getAchievements/getAchievement 恒可用。 */
export function ensureAchievementCatalog(): Promise<void> {
  if (_catalog) return Promise.resolve();
  if (!_loading) {
    _loading = import('../achievements/achievements.json')
      .then(mod => {
        const list = validateCatalog((mod as { default: unknown }).default);
        // id → def 索引（构建一次；校验保证 id 唯一）。原 ACHIEVEMENTS.find 为 O(n)，
        // 分批渲染每批 40 卡各查一次、解锁弹卡逐条查一次——Map 后 O(1)，行为等价。
        const byId = new Map<string, AchievementDef>();
        for (const a of list) byId.set(a.id, a);
        _catalog = list;
        _byId = byId;
      })
      .finally(() => { _loading = null; });
  }
  return _loading;
}

/** 就绪后的目录访问器（O(1) 读缓存数组）。未就绪时返回空集并触发装载——
 *  扫描入口/启动点火都有就绪门，正常调用不会落在空档里。 */
export function getAchievements(): readonly AchievementDef[] {
  if (!_catalog) { void ensureAchievementCatalog(); return []; }
  return _catalog;
}

/** 按 id 取成就定义（O(1)）。未就绪时返回 undefined 并触发装载。 */
export function getAchievement(id: string): AchievementDef | undefined {
  if (!_byId) { void ensureAchievementCatalog(); return undefined; }
  return _byId.get(id);
}

/** 同步预热（测试/legacy 桩专用，生产零消费）：以现成 JSON 对象填装目录，跳过动态装载。 */
export function __primeAchievementCatalogSync(raw: unknown): void {
  if (_catalog) return;
  const list = validateCatalog(raw);
  const byId = new Map<string, AchievementDef>();
  for (const a of list) byId.set(a.id, a);
  _catalog = list;
  _byId = byId;
}

/** 测试钩子：目录装载状态（生产零消费）。 */
export function __achievementCatalogStatsForTests(): { ready: boolean; size: number } {
  return { ready: _catalog !== null, size: _catalog ? _catalog.length : 0 };
}
