import { getTavernHelper } from './env';
import { STANDARD_RECURSION } from './constants';
// ===== 月信与孕育系统 · 世界书注入（P1：经期条目） =====
// 详见 docs/经期孕期功能设计.md §4
//
// 经期条目：comment = '瑟瑟灵感状态栏-经期（请勿手动开启）'
//   enabled 规则：任意被追踪角色 isOnPeriod===true → true；全员非经期 → false
//   内容更新：经期在场的角色清单变化时重写（§4.2 模板）
//
// off 真零开销：cycleMode==='off' 时 handleCycleTick 早退，根本不调用本模块；
// 这里仍兜底判 cycleMode/cycleWorldbookPeriod。
//
// 幂等：_wbSignature（enabled + 排序后的 name:day 列表）未变则不 replaceWorldbook；
//       _wbInFlight 上次写入未完成时跳过（下一 tick 重试，失败重置签名保证最终一致）。
import { getStorageWorldbookName } from './map-system';
import { dsCachePos, registerManagedWbEntry } from './wb-position';
import { wbEntryName, wbEntryIndexByName } from './worldbook-entry';
import { getCurrentStoryChatKey } from './story-floor-store';
import { hasWorldbookProjectionDispatcher, requestWorldbookProjection } from './worldbook-projection-events';

/** 经期世界书条目名（与日历条目同前缀，便于用户识别「请勿手动开启」） */
export const PERIOD_WB_NAME = 'UBS-周期-经期（请勿手动开启）';
/** 孕期世界书条目名（P2） */
export const PREGNANCY_WB_NAME = 'UBS-周期-孕期（请勿手动开启）';
// O18-A：旧版条目名（`瑟瑟灵感状态栏-*`）兼容已退役——改由 core/legacy-worldbook-entries.ts
// 在投影全量刷新时统一回收；本模块只认当前名。

/** 一位处于经期的角色（由 cycle-engine 预算后传入）。 */
export interface OnPeriodChar {
  name: string;
  day: number;          // 经期第几天（1-based）
  periodLength: number; // 经期总天数（前/中/后分段用，clamp [2,10]）
  seed: number;         // 确定性种子 = hashPeriodSeed(name, lastPeriodStart)；
                        // 保证同角色同经期每天 roll 稳定、跨经期重新分布
}

/** 一位处于孕期的角色（由 cycle-engine 预算后传入）。 */
export interface PregnantChar {
  name: string;
  weeks: number;       // 当前孕周（1-based）
  trimester: 1 | 2 | 3; // 早/中/晚期
  confirmed: boolean;  // 玩家是否已验孕知晓（影响文案：未确认→疑似/隐瞒；已确认→明示）
  daysToDue: number;   // 距预产期天数（负=已过预产期）
}

/** 一位处于产后/小产后恢复期的角色（由 cycle-engine 预算后传入）。 */
export interface PostpartumChar {
  name: string;
  kind: 'delivery' | 'abortion';                  // 产后（足月分娩）/ 小产后（堕胎）
  method?: 'medical' | 'surgical' | 'induction';   // 堕胎方式（kind='abortion' 时）
  weeksAtTerm: number;                             // 终止时孕周
  daysToRecover: number;                           // 距恢复日天数（负=已过）
}

// ═══════════════════════════════════════════════════════════════
// 内容拼装（§4.2 改造版）
//
// 经期描述 = 阶段固定基调 + 确定性 roll 的附加意外事件。
//   · 阶段：按 (day-1)/periodLength 分位映射前/中/后期（periodLength≤2 退化为前/后）
//   · 意外：13 项日常不适（痛经/经量偏多/乏力/腰酸/情绪低落/头痛/畏寒/肠胃/水肿/
//           食欲/乳房胀痛/爆痘/失眠），按阶段权重 d100 抽样，强度档位先 roll 数量
//   · 种子：hashPeriodSeed(name, lastPeriodStart)，同角色同经期每天稳定、跨经期重分布
//   · 排除极端：仅"能照常生活但明显不适"尺度，无晕厥/大出血不止/剧吐/发热/急救等
// ═══════════════════════════════════════════════════════════════

type PeriodStage = 'early' | 'mid' | 'late';

// 各阶段固定基调（确定性，随阶段切换）
const STAGE_TONE: Record<PeriodStage, string> = {
  early: '经量渐起、腹部坠胀隐痛、精力下滑、情绪敏感易波动',
  mid:   '流量趋于稳定、腰酸绵延、畏寒怕冷、注意力难集中',
  late:  '流量递减转淡、乏力嗜睡余韵、情绪回暖但仍易疲倦',
};

// 13 项附加意外事件（id → 描述基调），均为日常不适尺度
const PERIOD_EVENTS: Record<string, string> = {
  cramp:    '小腹绞痛阵发、面色发白',
  heavy:    '经量明显偏多、需频繁更换',
  fatigue:  '困倦乏力、提不起精神',
  backache: '后腰酸沉、久坐加重',
  moody:    '莫名低落、易红眼眶',
  headache: '太阳穴胀痛、畏光',
  chill:    '手脚冰凉、比平时怕冷',
  gi:       '经期肠胃不适、如厕频繁',
  bloat:    '脸与手脚轻微胀满',
  appetite: '嗜甜或反胃厌食',
  breast:   '乳房胀痛、触碰明显',
  acne:     '下巴额头冒痘',
  insomnia: '夜里辗转、睡眠浅',
};

// 各阶段权重表（每阶段权重和 = 100，等价 d100 区间）。后期痛经/经量多归零（生理退场）
const STAGE_WEIGHTS: Record<PeriodStage, Array<[string, number]>> = {
  early: [
    ['cramp', 22], ['heavy', 18], ['breast', 14], ['fatigue', 13],
    ['backache', 11], ['chill', 9], ['headache', 6], ['gi', 4], ['insomnia', 3],
  ],
  mid: [
    ['cramp', 14], ['fatigue', 14], ['backache', 14], ['moody', 12],
    ['breast', 10], ['headache', 9], ['heavy', 7], ['chill', 6],
    ['appetite', 5], ['insomnia', 5], ['acne', 4],
  ],
  late: [
    ['fatigue', 18], ['moody', 16], ['backache', 12], ['headache', 10],
    ['bloat', 10], ['appetite', 8], ['breast', 7], ['gi', 6],
    ['insomnia', 6], ['acne', 4], ['chill', 3],
  ],
};

/** FNV-1a 32-bit 字符串哈希（确定性，无需 crypto）。 */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 经期种子：name + lastPeriodStart → 同角色同经期稳定，跨经期重分布。供 engine 注入。 */
export function hashPeriodSeed(name: string, lastPeriodStart: string): number {
  return hashStr(name + '|' + lastPeriodStart);
}

/** 由种子派生 [0,1) 伪随机值（day+rollIndex 介入，保证同种子不同天/不同槽位各异）。 */
function rollUnit(seed: number, day: number, rollIndex: number): number {
  let h = (seed ^ Math.imul(day, 0x9e3779b1) ^ Math.imul(rollIndex, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 11), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/** 经期第 day 天所属阶段。periodLength≤2 退化为前/后（短经期 = 来了就走）。 */
function stageOf(day: number, periodLength: number): PeriodStage {
  if (periodLength <= 2) return day === 1 ? 'early' : 'late';
  const ratio = (day - 1) / periodLength;
  if (ratio < 1 / 3) return 'early';
  if (ratio < 2 / 3) return 'mid';
  return 'late';
}

/** 先 roll 强度档位：45% 平稳(0) / 35% 轻度(1) / 20% 明显(2)。 */
function rollEventCount(seed: number, day: number): number {
  const r = rollUnit(seed, day, 0);
  if (r < 0.45) return 0;
  if (r < 0.80) return 1;
  return 2;
}

/** 从权重表抽样一个事件 id（rollValue∈[0,1)）。 */
function rollEvent(table: Array<[string, number]>, rollValue: number): string {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let acc = rollValue * total;
  for (const [id, w] of table) {
    acc -= w;
    if (acc < 0) return id;
  }
  return table[table.length - 1][0];
}

/** roll 该角色当天的附加意外事件列表（不重复，最多 2 个）。 */
function rollExtras(seed: number, day: number, stage: PeriodStage): string[] {
  const count = rollEventCount(seed, day);
  if (count === 0) return [];
  const table = STAGE_WEIGHTS[stage];
  const picked: string[] = [];
  let slot = 1;
  while (picked.length < count && slot < 8) {
    const id = rollEvent(table, rollUnit(seed, day, slot));
    if (!picked.includes(id)) picked.push(id);
    slot++;
  }
  return picked;
}

function stageLabel(s: PeriodStage): string {
  return s === 'early' ? '前期' : s === 'mid' ? '中期' : '后期';
}

function strengthLabel(n: number): string {
  return n === 0 ? '平稳' : n === 1 ? '轻度不适' : '明显不适';
}

function buildPeriodContent(chars: OnPeriodChar[]): string {
  if (chars.length === 0) return '';
  const sorted = [...chars].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const lines = sorted.map(c => {
    const stage = stageOf(c.day, c.periodLength);
    const extras = rollExtras(c.seed, c.day, stage);
    const head = `· ${c.name}(第${c.day}天)【${stageLabel(stage)}·${strengthLabel(extras.length)}】：基调「${STAGE_TONE[stage]}」`;
    if (extras.length === 0) return head;
    return `${head}\n  · 附加：${extras.map(e => PERIOD_EVENTS[e]).join('；')}`;
  });
  return [
    '[当前处于经期的角色 - 仅供自然描写参考]',
    lines.join('\n'),
    '[描写准则]',
    '- 仅在与该角色有亲密关系、或自然生活场景中体现；非亲密关系者不会主动提及自己的生理状况',
    '- 不同角色表现因人而异(性格/体质不同),勿套用统一模板',
    '- 此为氛围参考,服从剧情逻辑优先,非强制',
  ].join('\n');
}

function computeSignature(chars: OnPeriodChar[]): string {
  // 即便空列表也须并入 chatKey：切卡时最常见的就是"旧卡无人经期↔新卡无人经期"，
  // 若空签名跨身份恒定（v3|empty），新卡永远不会对账、旧卡残留的 enabled 条目不清除。
  const chatKey = getCurrentStoryChatKey();
  if (chars.length === 0) return 'v3|' + chatKey + '|empty';
  const sorted = [...chars].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  // seed+day+periodLength 三者确定 → roll 产物确定，无需把产物写入签名。
  // 版本号 v1→v2：升级后旧签名失效，首次必然全量同步一次。
  // 版本号 v2→v3：并入 chatKey，根治切卡/切聊时签名命中缓存致新卡世界书不对账。
  return 'v3|' + chatKey + '|' + sorted.map(c => `${c.name}:${c.day}:${c.periodLength}:${c.seed}`).join('|');
}

// ═══════════════════════════════════════════════════════════════
// 幂等 + 串行守卫
// ═══════════════════════════════════════════════════════════════

let _inFlight: Promise<void> | null = null;
let _lastSignature: string | null = null;
let _latestPeriodChars: OnPeriodChar[] = [];
// inFlight 期间被跳过的最新 chars：飞完补跑一次，避免切档 disable / 日期变更同步被吞。
let _pending: OnPeriodChar[] | null = null;

// ═══════════════════════════════════════════════════════════════
// 条目字段（仿 calendar-core.ts:243-253 的 ensureCalendarWBEntries）
// ═══════════════════════════════════════════════════════════════

const PERIOD_ORIG_POS = { type: 'at_depth', role: 'system', depth: 0, order: 200 } as const;

function makeNewEntry(content: string): any {
  return {
    name: PERIOD_WB_NAME,
    comment: PERIOD_WB_NAME,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos(PERIOD_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// 同步入口（由 cycle-engine fire-and-forget 调用）
// ═══════════════════════════════════════════════════════════════

export function syncCycleWorldbook(chars: OnPeriodChar[]): void {
  _latestPeriodChars = chars.map(char => ({ ...char }));
  if (hasWorldbookProjectionDispatcher()) {
    requestWorldbookProjection('cycle-period', 'data-change');
    return;
  }
  // 调用方决定 chars（handleCycleTick 已按 cycleWorldbookPeriod 过滤；空列表 → 条目 disabled）
  // 串行守卫：上次写入未完成 → 记下最新 chars，飞完补跑（切档 disable / 日期变更同步不丢最新态）
  if (_inFlight) { _pending = chars; return; }
  // 幂等签名：内容/启用态未变 → 跳过
  const sig = computeSignature(chars);
  if (sig === _lastSignature) return;

  _lastSignature = sig;
  _inFlight = doSync(chars)
    .catch((e) => {
      console.warn('[cycle-wb] sync failed:', e);
      _lastSignature = null; // 失败重置，下次必然重试
    })
    .finally(() => {
      _inFlight = null;
      if (_pending !== null) {
        const next = _pending;
        _pending = null;
        syncCycleWorldbook(next);
      }
    });
}

/** Reconciles only the managed period entry inside an already-loaded worldbook. */
export function reconcileCycleWorldbookEntries(entries: any[], chars: OnPeriodChar[]): boolean {
  const targetEnabled = chars.length > 0;
  const targetContent = buildPeriodContent(chars);
  const idx = wbEntryIndexByName(entries, PERIOD_WB_NAME);
  let changed: boolean;
  if (idx < 0 && !targetEnabled) {
    changed = false;
  } else if (idx < 0) {
    entries.push(makeNewEntry(targetContent));
    changed = true;
  } else {
    const entry = entries[idx];
    const next: any = {
      ...entry,
      name: PERIOD_WB_NAME,
      comment: PERIOD_WB_NAME,
      enabled: targetEnabled,
      position: { type: 'at_depth', role: 'system', depth: 0, order: 200 },
    };
    if (targetEnabled) next.content = targetContent;
    changed = entry.enabled !== next.enabled
      || (targetEnabled && entry.content !== next.content)
      || entry.position?.type !== 'at_depth'
      || entry.position?.depth !== 0
      || entry.position?.order !== 200
      || wbEntryName(entry) !== PERIOD_WB_NAME;
    if (changed) entries[idx] = next;
  }
  return changed;
}

async function doSync(chars: OnPeriodChar[]): Promise<void> {
  const th = getTavernHelper();
  if (!th) {
    // TavernHelper 未注入（iframe 早于酒馆）/ 跨源受限时 bail。此时 syncCycleWorldbook
    // 已把 _lastSignature 缓存为"已同步"，若不清则后续同状态 tick 全部早退、世界书永不注入。
    // 无条件作废：TavernHelper 就绪后下次 tick 必然重试（与 !wbName 分支的毒化防护同源）。
    _lastSignature = null;
    return;
  }
  const wbName = await getStorageWorldbookName();
  if (!wbName) {
    // 有经期角色要注入却无角色世界书 → 提示绑定（空列表 / 禁用路径静默，每卡仅一次）
    if (chars.length > 0) {
      // 首载/切卡时 TavernHelper 或角色世界书可能尚未就绪而 bail。若不重置签名，
      // _lastSignature 已被 syncCycleWorldbook 缓存为"已同步"，后续同状态 tick 全部早退，
      // 即便世界书就绪后也不会补建条目。这里强制作废，保证就绪后能重试。
      _lastSignature = null;
    }
    return;
  }

  const wb = await th.getWorldbook(wbName);
  if (!wb || !Array.isArray(wb)) {
    // 世界书 API 瞬时不可读（重载/卸载窗口返回非数组）时也作废签名，避免与 !th/!wbName
    // 同样的毒化：签名已缓存、条目没写，后续同状态 tick 全部早退。下次必然重试。
    _lastSignature = null;
    return;
  }

  if (reconcileCycleWorldbookEntries(wb, chars)) {
    await th.replaceWorldbook(wbName, wb);
  }
}

/** 重置幂等状态（切档/测试用：强制下次全量同步）。 */
export function resetCycleWorldbookCache(): void {
  _lastSignature = null;
}

export function getLatestCycleWorldbookChars(): OnPeriodChar[] {
  return _latestPeriodChars.map(char => ({ ...char }));
}

export function resetCycleWorldbookProjectionInputs(): void {
  _latestPeriodChars = [];
  _latestPregnancyChars = [];
  _latestPostpartumChars = [];
}

// ═══════════════════════════════════════════════════════════════
// 孕期条目（P2）：任意角色怀孕 → enabled=true + 节点更新
// §4.1 / §4.3
// ═══════════════════════════════════════════════════════════════

function trimesterLabel(t: 1 | 2 | 3): string {
  return t === 1 ? '孕早期' : t === 2 ? '孕中期' : '孕晚期';
}

function trimesterFeature(t: 1 | 2 | 3): string {
  return t === 1
    ? '晨吐/嗜睡/乳房胀痛/需谨慎避免剧烈'
    : t === 2
      ? '显怀/胎动/相对稳定'
      : '笨重/腰背酸/限制深度亲密';
}

function buildPregnancyContent(pregnant: PregnantChar[], postpartum: PostpartumChar[]): string {
  if (pregnant.length === 0 && postpartum.length === 0) return '';
  const sortedPreg = [...pregnant].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const sortedPost = [...postpartum].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const lines: string[] = [];
  for (const c of sortedPreg) {
    const due = c.daysToDue > 0 ? `距预产期约${c.daysToDue}天` : '已近预产期';
    const status = c.confirmed ? '已确认' : '尚未察觉/疑似';
    lines.push(`· ${c.name}：孕${c.weeks}周·${trimesterLabel(c.trimester)}（${status}，${due}）。特征可参考：${trimesterFeature(c.trimester)}`);
  }
  for (const c of sortedPost) {
    const head = c.kind === 'abortion' ? '小产后调养中' : '产后恢复中';
    const method = c.kind === 'abortion' && c.method
      ? { medical: '药流', surgical: '人流', induction: '引产' }[c.method]
      : null;
    const methodText = method ? `${method}，` : '';
    lines.push(`· ${c.name}：${head}（${methodText}孕${c.weeksAtTerm}周），约${c.daysToRecover}天后恢复月信。描写建议：需静养、避免剧烈、情绪需平复`);
  }
  return [
    '[当前处于孕期/恢复期的角色 - 仅供自然描写参考]',
    lines.join('\n'),
    '[描写准则]',
    '- 仅在与该角色有亲密关系、或自然生活场景中体现；非亲密关系者不会主动提及',
    '- 小产后恢复期身心状态因人而异，勿套用统一模板',
    '- 此为氛围参考，服从剧情逻辑优先，非强制',
  ].join('\n');
}

function computePregSignature(pregnant: PregnantChar[], postpartum: PostpartumChar[]): string {
  // 空签名也并入 chatKey（同 computeSignature 的理由：切卡时空↔空命中会跳过新卡对账）。
  const chatKey = getCurrentStoryChatKey();
  if (pregnant.length === 0 && postpartum.length === 0) return 'v2|' + chatKey + '|empty';
  const sortedPreg = [...pregnant].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const sortedPost = [...postpartum].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  // 版本号 v1→v2：并入 chatKey，根治切卡/切聊时签名命中缓存致新卡世界书不对账。
  return 'v2|' + chatKey + '|' + sortedPreg.map(c => `${c.name}:${c.weeks}:${c.confirmed ? 1 : 0}`).join('|')
    + '||' + sortedPost.map(c => `${c.name}:${c.kind}:${c.method ?? ''}:${c.weeksAtTerm}`).join('|');
}

// 孕期条目独立幂等状态（与经期互不影响）
let _pregInFlight: Promise<void> | null = null;
let _pregLastSignature: string | null = null;
let _latestPregnancyChars: PregnantChar[] = [];
let _latestPostpartumChars: PostpartumChar[] = [];
// inFlight 期间被跳过的最新 (pregnant, postpartum)：飞完补跑，避免切档 disable 被吞。
let _pregPending: { pregnant: PregnantChar[]; postpartum: PostpartumChar[] } | null = null;

const PREGNANCY_ORIG_POS = { type: 'at_depth', role: 'system', depth: 0, order: 201 } as const;

function makeNewPregnancyEntry(content: string): any {
  return {
    name: PREGNANCY_WB_NAME,
    comment: PREGNANCY_WB_NAME,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos(PREGNANCY_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

export function syncPregnancyWorldbook(pregnant: PregnantChar[], postpartum: PostpartumChar[]): void {
  _latestPregnancyChars = pregnant.map(char => ({ ...char }));
  _latestPostpartumChars = postpartum.map(char => ({ ...char }));
  if (hasWorldbookProjectionDispatcher()) {
    requestWorldbookProjection('cycle-pregnancy', 'data-change');
    return;
  }
  if (_pregInFlight) { _pregPending = { pregnant, postpartum }; return; }
  const sig = computePregSignature(pregnant, postpartum);
  if (sig === _pregLastSignature) return;
  _pregLastSignature = sig;
  _pregInFlight = doSyncPregnancy(pregnant, postpartum)
    .catch((e) => {
      console.warn('[cycle-wb] pregnancy sync failed:', e);
      _pregLastSignature = null;
    })
    .finally(() => {
      _pregInFlight = null;
      if (_pregPending !== null) {
        const next = _pregPending;
        _pregPending = null;
        syncPregnancyWorldbook(next.pregnant, next.postpartum);
      }
    });
}

/** 重置孕期幂等状态（切档/测试用：强制下次全量同步）。 */
export function resetPregnancyWorldbookCache(): void {
  _pregLastSignature = null;
}

export function getLatestPregnancyWorldbookChars(): { pregnant: PregnantChar[]; postpartum: PostpartumChar[] } {
  return {
    pregnant: _latestPregnancyChars.map(char => ({ ...char })),
    postpartum: _latestPostpartumChars.map(char => ({ ...char })),
  };
}

/** Reconciles only the managed pregnancy entry inside an already-loaded worldbook. */
export function reconcilePregnancyWorldbookEntries(
  entries: any[],
  pregnant: PregnantChar[],
  postpartum: PostpartumChar[],
): boolean {
  const targetEnabled = pregnant.length > 0 || postpartum.length > 0;
  const targetContent = buildPregnancyContent(pregnant, postpartum);
  const idx = wbEntryIndexByName(entries, PREGNANCY_WB_NAME);
  let changed: boolean;
  if (idx < 0 && !targetEnabled) {
    changed = false;
  } else if (idx < 0) {
    entries.push(makeNewPregnancyEntry(targetContent));
    changed = true;
  } else {
    const entry = entries[idx];
    const next: any = {
      ...entry,
      name: PREGNANCY_WB_NAME,
      comment: PREGNANCY_WB_NAME,
      enabled: targetEnabled,
      position: { type: 'at_depth', role: 'system', depth: 0, order: 201 },
    };
    if (targetEnabled) next.content = targetContent;
    changed = entry.enabled !== next.enabled
      || (targetEnabled && entry.content !== next.content)
      || entry.position?.type !== 'at_depth'
      || entry.position?.depth !== 0
      || entry.position?.order !== 201
      || wbEntryName(entry) !== PREGNANCY_WB_NAME;
    if (changed) entries[idx] = next;
  }
  return changed;
}

async function doSyncPregnancy(pregnant: PregnantChar[], postpartum: PostpartumChar[]): Promise<void> {
  const th = getTavernHelper();
  if (!th) {
    // 同 doSync：TavernHelper 未注入 bail 时作废签名，就绪后能重试（否则签名被缓存为"已同步"）。
    _pregLastSignature = null;
    return;
  }
  const wbName = await getStorageWorldbookName();
  if (!wbName) {
    if (pregnant.length > 0 || postpartum.length > 0) {
      // 同 doSync：世界书未就绪而 bail 时作废签名，就绪后能重试（详见 doSync 注释）。
      _pregLastSignature = null;
    }
    return;
  }

  const wb = await th.getWorldbook(wbName);
  if (!wb || !Array.isArray(wb)) {
    // 同 doSync：世界书 API 瞬时不可读时作废签名，避免签名毒化导致永久跳过。
    _pregLastSignature = null;
    return;
  }

  if (reconcilePregnancyWorldbookEntries(wb, pregnant, postpartum)) await th.replaceWorldbook(wbName, wb);
}

// DS 缓存优化：登记经期/孕期条目（翻转开关时由 repositionManagedWbEntries 重定位）
registerManagedWbEntry({ match: (e) => wbEntryName(e) === PERIOD_WB_NAME, origPos: () => PERIOD_ORIG_POS });
registerManagedWbEntry({ match: (e) => wbEntryName(e) === PREGNANCY_WB_NAME, origPos: () => PREGNANCY_ORIG_POS });
