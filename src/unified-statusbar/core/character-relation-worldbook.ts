// ===== 人物关系表 → 角色主世界书投影（与触发条目） =====
// 神数据库通用拆行注入只支持主关键词（多 key = OR），无法表达「A 与 B 同时在场才注入」；
// 本模块用 TavernHelper 原生 selective + keys_secondary(and_any) 实现真正的与触发：
//   primary keys = [人物A]，secondary keys = [人物B]（and_any）——两名字都在扫描文本才激活。
// 注入位置：before_character_definition order 8006（重要角色表 8005 之后）。
import { sameStringArray } from './type-guards';
import { STANDARD_RECURSION } from './constants';
import { fnv1a36 } from './stable-hash';
import { getConfig } from './config-store';
import { getCellByHeader, getSheetByName } from './data-manager';
import { dedupeCharacterRelations, parseCharacterRelationRows, characterRelationSignature, type CharacterRelation } from './character-relation-model';
import { dsCachePos, registerManagedWbEntry, type WbPosSpec } from './wb-position';
import { hasWorldbookProjectionDispatcher, requestWorldbookProjection } from './worldbook-projection-events';
import { ledgerHandlesTableWorldbook } from './ledger-takeover';

export const CHAR_RELATION_TABLE_NAME = '人物关系表';
export const CHAR_RELATION_WB_PREFIX = 'UBS-关系-';
const CHAR_RELATION_WB_COMMENT_PREFIX = 'UBS-关系-';
const CHAR_RELATION_WB_ORDER = 8006;
const CHAR_RELATION_ORIG_POS: WbPosSpec = { type: 'before_character_definition', role: 'system', depth: 2, order: CHAR_RELATION_WB_ORDER };

export function isCharacterRelationWorldbookEnabled(): boolean {
  return getConfig().charRelationWorldbook !== false;
}

/** 读「人物关系表」当前数据行（表缺失/未修复 → 空数组）。
 *  与主角的成对关系不入本表投影：主角关系随角色表「对主角态度」列走角色表条目（8005），
 *  表内遗留的主角对在此剔除（旧存档自愈，随 reconcile 收敛掉对应条目）。 */
export function readCharacterRelations(): CharacterRelation[] {
  const rows = parseCharacterRelationRows(getSheetByName(CHAR_RELATION_TABLE_NAME));
  const protagonist = String(getCellByHeader('主角信息表', 1, '姓名') || '').trim();
  if (!protagonist) return rows;
  return rows.filter(relation => relation.charA !== protagonist && relation.charB !== protagonist);
}

/** 无序对稳定短哈希：A×B 与 B×A 同名（FNV-1a 32 位 base36，循环走 stable-hash 单源 U46）。 */
function pairHash(a: string, b: string): string {
  const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
  return fnv1a36(key);
}

function entryIdentity(a: string, b: string): { name: string; comment: string } {
  return {
    name: `${CHAR_RELATION_WB_PREFIX}${pairHash(a, b)}`,
    comment: `${CHAR_RELATION_WB_COMMENT_PREFIX}${a}×${b}`,
  };
}

/** 条目正文（用户指定格式；空字段以「未记录」占位保持骨架稳定）。 */
export function buildCharacterRelationEntryContent(relation: CharacterRelation): string {
  return [
    `${relation.charA}和${relation.charB}的关系：`,
    `【关系类型】${relation.relationType || '未记录'}`,
    `【相互看法】${relation.mutualView || '未记录'}`,
    `【起因备注】${relation.originNote || '未记录'}`,
    `【关系状态】${relation.currentStatus || '未记录'}`,
  ].join('\n');
}

/** 构造与触发条目：人物A 为主关键词，人物B 为次关键词（and_any = 与关系）。 */
export function buildCharacterRelationEntry(relation: CharacterRelation): any {
  const { name, comment } = entryIdentity(relation.charA, relation.charB);
  return {
    name,
    comment,
    enabled: true,
    content: buildCharacterRelationEntryContent(relation),
    strategy: {
      type: 'selective',
      keys: [relation.charA],
      keys_secondary: { logic: 'and_any' as const, keys: [relation.charB] },
      scan_depth: 'same_as_global' as const,
    },
    position: dsCachePos(CHAR_RELATION_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

function isManagedRelationEntry(entry: any): boolean {
  // O18-A：旧前缀 `__char_relation_` 兼容已退役（由 core/legacy-worldbook-entries.ts 统一回收）
  const name = String(entry?.name || '');
  return name.startsWith(CHAR_RELATION_WB_PREFIX);
}

function sameRelationEntry(entry: any, target: any): boolean {
  return entry?.name === target.name
    && entry?.enabled === true
    && entry?.content === target.content
    && entry?.strategy?.type === 'selective'
    && sameStringArray(entry?.strategy?.keys, target.strategy.keys)
    && entry?.strategy?.keys_secondary?.logic === 'and_any'
    && sameStringArray(entry?.strategy?.keys_secondary?.keys, target.strategy.keys_secondary.keys)
    && entry?.position?.type === target.position.type
    && entry?.position?.role === target.position.role
    && entry?.position?.depth === target.position.depth
    && entry?.position?.order === target.position.order
    && entry?.recursion?.prevent_incoming === true
    && entry?.recursion?.prevent_outgoing === true
    && entry?.recursion?.delay_until == null;
}

/**
 * 把受管条目族收敛到目标集合（去重后的关系行）。
 * 关闭（enabled=false）→ 清空族；表缺失/空表 → 同样清空。返回是否变更。
 * 供投影协调器调用（对齐 reconcileWardrobeWorldbookEntries 的整族替换语义）。
 */
export function reconcileCharacterRelationEntries(entries: any[], relations: CharacterRelation[], enabled: boolean): boolean {
  const desired = enabled ? dedupeCharacterRelations(relations).unique.map(buildCharacterRelationEntry) : [];
  const managedIndices = entries
    .map((entry, index) => (isManagedRelationEntry(entry) ? index : -1))
    .filter(index => index >= 0);
  if (managedIndices.length !== desired.length) {
    applyDesired(entries, managedIndices, desired);
    return true;
  }
  for (let i = 0; i < desired.length; i++) {
    if (!sameRelationEntry(entries[managedIndices[i]], desired[i])) {
      applyDesired(entries, managedIndices, desired);
      return true;
    }
  }
  return false;
}

function applyDesired(entries: any[], managedIndices: readonly number[], desired: readonly any[]): void {
  const insertionIndex = managedIndices[0] ?? entries.length;
  const next = entries.filter(entry => !isManagedRelationEntry(entry));
  next.splice(Math.min(insertionIndex, next.length), 0, ...desired);
  entries.splice(0, entries.length, ...next);
}

// ── 数据 tick 驱动（签名幂等，对齐 syncSkillWorldbook 模式） ──

let _lastSignature: string | null = null;

/** 台账接管本表的注入（台账模式 + 本表在台账侧启用世界书注入）→ 主项目族退场。
 *  台账的「关键词列 + 逻辑=与」投影与主项目同形（keys=[A] + keys_secondary(and_any)=[B]），
 *  两边同时投影＝双份同名数据，故由台账独占（台账里关掉该表注入即自动让回）。 */
export function ledgerOwnsCharacterRelationWorldbook(): boolean {
  return ledgerHandlesTableWorldbook(CHAR_RELATION_TABLE_NAME);
}

/** 台账接管态下的占位签名：只请求一次清理（把 UBS-关系-* 族撤掉），此后不再跟随表数据重投影。 */
const LEDGER_HANDOFF_SIGNATURE = '__ledger_handoff__';

/**
 * 数据 tick：人物关系表签名变化且投影开启时请求一次投影（无 dispatcher 静默跳过）。
 *
 * O17：签名改走 `characterRelationSignature`（**直接用原始单元格算**），不再先
 * `readCharacterRelations()` 构造一整份 `CharacterRelation[]` + filter + map ——
 * 旧路径里那些对象**除算指纹外没有任何别的用途**（算完即弃），而本函数每 300ms 就被调一次，
 * 长局里关系表越攒越大、白做的解析与分配也越重。新路径与旧路径输出**逐字节相同**
 * （parity 测试锁死）；只有签名真的变了才 requestWorldbookProjection（解析交给协调器那一次）。
 */
export function syncCharacterRelationWorldbook(): void {
  if (!isCharacterRelationWorldbookEnabled()) { _lastSignature = null; return; }
  if (!hasWorldbookProjectionDispatcher()) return;
  if (ledgerOwnsCharacterRelationWorldbook()) {
    if (_lastSignature !== LEDGER_HANDOFF_SIGNATURE) {
      _lastSignature = LEDGER_HANDOFF_SIGNATURE;
      requestWorldbookProjection('char-relations', 'config-change'); // 一次收敛：主项目族撤场（reconcile 侧按接管态给空集）
    }
    return;
  }
  const protagonist = String(getCellByHeader('主角信息表', 1, '姓名') || '').trim();
  const signature = characterRelationSignature(getSheetByName(CHAR_RELATION_TABLE_NAME), protagonist);
  if (signature === _lastSignature) return;
  _lastSignature = signature;
  requestWorldbookProjection('char-relations', 'data-change');
}

/** 强制下次 tick 重新请求（切卡/测试用）。 */
export function resetCharacterRelationWorldbookCache(): void {
  _lastSignature = null;
}

// DS 缓存优化登记（开关翻转时 repositionManagedWbEntries 会重写本族条目 position）
registerManagedWbEntry({
  match: entry => isManagedRelationEntry(entry),
  origPos: () => CHAR_RELATION_ORIG_POS,
});
