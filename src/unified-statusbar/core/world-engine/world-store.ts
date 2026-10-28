// core/world-engine/world-store.ts
// 世界演化存储：journal `world` feature key，单对象整替换（write-behind）。

import { readStoryFeature, writeStoryFeature, hasStoryFeature, getStoryJournalDataToken } from '../story-floor-store';
import { WORLD_FEATURE_KEY, WORLD_SCHEMA_VERSION, INTRUSION_ACT_TTL, emptyWorldState, type WorldState } from './world-types';

// O25：整份世界状态深拷贝是渲染热路径上最重的一次性克隆（镜头之外入口判断在每主题渲染路径
// 各调一次 loadWorldState）。调用面契约（O25 落地时逐点审计过）：所有突变方（triggerIntrusion /
// enqueueIntrusion / removeIntrusion / syncWorldRoster / doEvolve 写路径）都先 JSON 深拷贝再改，
// 渲染方（beyond-lens / html-builder / world-window / bridge / ios）全部只读——
// 因此可按 journal 令牌缓存并返回共享对象；令牌含聊天键与 pending 变异序号，任何写入/切卡都会换键。
let _loadCache: WorldState | null = null;
let _loadCacheToken: string | null = null;

export function loadWorldState(): WorldState {
  const token = getStoryJournalDataToken();
  if (_loadCache && _loadCacheToken === token) return _loadCache;
  const raw = readStoryFeature<Partial<WorldState> | null>(WORLD_FEATURE_KEY, null);
  let state: WorldState;
  if (!raw || raw.version !== WORLD_SCHEMA_VERSION) {
    state = emptyWorldState();
  } else {
    const base = emptyWorldState();
    // 隐情机制已删除：读时剥离旧存量（plots 数组 + plot_surfaced 入镜项），死数据不残留
    const legacy = raw as any;
    delete legacy.plots;
    // F28：awareness 字段已删（无消费者）——读时显式剥离老存档里的残值，避免死数据跟着对象走
    for (const p of Object.values((raw.profiles || {}) as Record<string, any>)) {
      if (p && typeof p === 'object') delete p.awareness;
    }
    const pendingIntrusions = Array.isArray(raw.pendingIntrusions)
      ? (raw.pendingIntrusions as any[])
          // 旧 dismissed=用户明确不想要（且旧台前渲染无视状态，忽略后残留无意义）→ 直接删；
          // 旧 plot_surfaced 已随隐情机制删除
          .filter(i => i?.kind !== 'plot_surfaced' && i?.status !== 'dismissed')
          // 旧 acted 无 ttl → 补 INTRUSION_ACT_TTL 自然过期
          .map(i => i?.status === 'acted' && typeof i.ttl !== 'number' ? { ...i, ttl: INTRUSION_ACT_TTL } : i)
      : base.pendingIntrusions;
    state = {
      ...base,
      ...raw,
      profiles: raw.profiles ?? base.profiles,
      rumors: Array.isArray(raw.rumors) ? raw.rumors : base.rumors,
      chronicle: Array.isArray(raw.chronicle) ? raw.chronicle : base.chronicle,
      pendingIntrusions,
      evolveExcluded: Array.isArray(raw.evolveExcluded) ? raw.evolveExcluded.filter(n => typeof n === 'string' && n) : base.evolveExcluded,
    };
  }
  _loadCache = state;
  _loadCacheToken = token;
  return state;
}

export function hasWorldState(): boolean {
  return hasStoryFeature(WORLD_FEATURE_KEY);
}

export async function saveWorldState(state: WorldState): Promise<boolean> {
  return await writeStoryFeature(WORLD_FEATURE_KEY, state);
}
