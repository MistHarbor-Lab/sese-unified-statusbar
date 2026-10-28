// ===== 人物关系表：数据模型（读表/解析/聚合，纯函数，零 I/O） =====
// 数据源：人物关系表（sheet_char_relations / renwuguanxibiao），一行一对人物。
// 旧「人际关系」自由文本列已从恋爱对象表/重要角色表剥离（V3.1.0 模板）。
// 与主角的成对关系不入人物关系表：角色表「对主角态度」列以「关系：XX；态度：YY」
// 两段格式承载（下方 parseProtagonistAttitude），主角边由此生成。

export interface CharacterRelation {
  rowId: number;
  charA: string;
  charB: string;
  relationType: string;
  mutualView: string;
  originNote: string;
  currentStatus: string;
}

/** AI 落库常把换行写成字面量 `\n`（JSON 双转义产物）；展示/注入前统一归一（对齐 character-hub-model 踩坑记录）。 */
function normalizeCell(value: unknown): string {
  return String(value ?? '').replace(/\\r\\n|\\n/g, '\n').trim();
}

/** 按表头名读「人物关系表」数据行；表缺/列缺/任一侧姓名为空 → 该行丢弃。 */
export function parseCharacterRelationRows(sheet: { content?: unknown[][] } | null | undefined): CharacterRelation[] {
  const rows = Array.isArray(sheet?.content) ? sheet!.content! : [];
  if (rows.length < 2) return [];
  const headers = (rows[0] || []).map(v => String(v ?? '').trim());
  const col = (...names: string[]): number => {
    for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iA = col('人物A'), iB = col('人物B'), iType = col('关系类型');
  const iView = col('相互看法'), iOrigin = col('起因备注'), iStatus = col('关系状态', '当前状态');
  // 参数名勿用裸 h（roster.ts:160 先例：unplugin-auto-import 会误注入 import {h} from 'vue'）
  const iRowId = headers.findIndex(hdr => hdr === 'row_id' || hdr === 'rowid' || hdr === '行号');
  if (iA < 0 || iB < 0 || iType < 0) return [];
  const out: CharacterRelation[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const charA = normalizeCell(row[iA]);
    const charB = normalizeCell(row[iB]);
    if (!charA || !charB) continue;
    const rowIdRaw = iRowId >= 0 ? parseInt(String(row[iRowId] ?? ''), 10) : NaN;
    out.push({
      rowId: Number.isInteger(rowIdRaw) && rowIdRaw > 0 ? rowIdRaw : i,
      charA,
      charB,
      relationType: normalizeCell(row[iType]),
      mutualView: iView >= 0 ? normalizeCell(row[iView]) : '',
      originNote: iOrigin >= 0 ? normalizeCell(row[iOrigin]) : '',
      currentStatus: iStatus >= 0 ? normalizeCell(row[iStatus]) : '',
    });
  }
  return out;
}

/**
 * 「人物关系表 → 签名」的**廉价路径**（O17）：与 parseCharacterRelationRows **完全相同的
 * 列映射 / 归一 / 丢弃规则 / 主角剔除**，但只产出最终签名字符串，**不构造 CharacterRelation 对象**。
 *
 * 为什么放在本模块：列映射与归一规则只应有一处（`normalizeCell` + 列名候选表），
 * 签名若写在消费方就会与实际解析漂移（漂移的后果是「表没变也发投影」或「变了却不发」）。
 * 与 `computeSignature(parseCharacterRelationRows(sheet) 过滤主角)` 的输出**必须逐字节相同**
 * （tests/character-relation-signature-parity.test.ts 锁死该等价性）。
 *
 * 分配量：旧路径 = 解析对象数组 + filter 数组 + map 数组 + R 个内层数组；
 * 本路径 = 1 个 parts 数组 + R 个字符串（长局关系表越大差距越明显）。
 */
export function characterRelationSignature(
  sheet: { content?: unknown[][] } | null | undefined,
  protagonistName?: string,
): string {
  const rows = Array.isArray(sheet?.content) ? sheet!.content! : [];
  if (rows.length < 2) return '';
  const headers = (rows[0] || []).map(v => String(v ?? '').trim());
  const col = (...names: string[]): number => {
    for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iA = col('人物A'), iB = col('人物B'), iType = col('关系类型');
  const iView = col('相互看法'), iOrigin = col('起因备注'), iStatus = col('关系状态', '当前状态');
  const iRowId = headers.findIndex(hdr => hdr === 'row_id' || hdr === 'rowid' || hdr === '行号');
  if (iA < 0 || iB < 0 || iType < 0) return '';
  const protagonist = String(protagonistName ?? '').trim();
  const parts: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const charA = normalizeCell(row[iA]);
    const charB = normalizeCell(row[iB]);
    if (!charA || !charB) continue;
    // 与主角的成对关系不入本表投影（同 readCharacterRelations 的剔除，旧存档自愈靠它收敛）
    if (protagonist && (charA === protagonist || charB === protagonist)) continue;
    const rowIdRaw = iRowId >= 0 ? parseInt(String(row[iRowId] ?? ''), 10) : NaN;
    const rowId = Number.isInteger(rowIdRaw) && rowIdRaw > 0 ? rowIdRaw : i;
    parts.push(
      rowId + '\u0001' + charA + '\u0001' + charB + '\u0001' + normalizeCell(row[iType])
      + '\u0001' + (iView >= 0 ? normalizeCell(row[iView]) : '')
      + '\u0001' + (iOrigin >= 0 ? normalizeCell(row[iOrigin]) : '')
      + '\u0001' + (iStatus >= 0 ? normalizeCell(row[iStatus]) : ''),
    );
  }
  return parts.join('\u0002');
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/** 无序对去重：(A,B) 与 (B,A) 视为同一对；按 rowId 升序首行胜出，其余进 duplicates（UI 提示用）。 */
export function dedupeCharacterRelations(relations: CharacterRelation[]): { unique: CharacterRelation[]; duplicates: CharacterRelation[] } {
  const seen = new Set<string>();
  const unique: CharacterRelation[] = [];
  const duplicates: CharacterRelation[] = [];
  for (const relation of [...relations].sort((a, b) => a.rowId - b.rowId)) {
    const key = pairKey(relation.charA, relation.charB);
    if (seen.has(key)) { duplicates.push(relation); continue; }
    seen.add(key);
    unique.push(relation);
  }
  return { unique, duplicates };
}

// ── 与主角的关系/态度（角色表「对主角态度」列） ──

export interface ProtagonistAttitude {
  /** 与主角的关系类型短词（如 恋人/挚友/宿敌）；未按两段格式书写时为 ''。 */
  relation: string;
  /** 态度详情段；旧数据（纯态度文本）为整段。 */
  attitude: string;
}

const RELATION_SEG_RE = /^\s*(?:对主角|与主角|和主角|主角)?的?关系\s*[：:]\s*([^；;\n]*)/;
const ATTITUDE_LABEL_RE = /^\s*(?:对主角)?态度\s*[：:]\s*/;

/**
 * 拆分「对主角态度」列（V3.1.0 起指南格式 `关系：XX；态度：YY`）。
 * 旧数据无「关系：」前缀 → relation=''、attitude=整段，自然降级不丢内容。
 */
export function parseProtagonistAttitude(cell: unknown): ProtagonistAttitude {
  const text = normalizeCell(cell);
  if (!text) return { relation: '', attitude: '' };
  const relMatch = text.match(RELATION_SEG_RE);
  if (!relMatch) return { relation: '', attitude: text.replace(ATTITUDE_LABEL_RE, '').trim() || text };
  const relation = relMatch[1].trim();
  const attitude = text
    .slice(relMatch[0].length)
    .replace(/^[\s；;\n]+/, '')
    .replace(ATTITUDE_LABEL_RE, '')
    .trim();
  return { relation, attitude };
}

// ── 关系类别（可视化配色 / 筛选维度） ──

export const RELATION_CATEGORIES = ['亲密', '敌对', '师徒', '家族', '同盟', '其他'] as const;
export type RelationCategory = (typeof RELATION_CATEGORIES)[number];

const CATEGORY_RULES: ReadonlyArray<{ category: RelationCategory; pattern: RegExp }> = [
  // 顺序即优先级：如「恋人兼宿敌」归亲密（关系底色以亲密为先，敌意走敌对描述）
  { category: '亲密', pattern: /恋|爱|情人|暧昧|未婚|夫妻|妻子|丈夫|伴侣|挚爱|心上|炮友|床伴|心上人/ },
  { category: '敌对', pattern: /敌|仇|反目|对手|竞争|死对头|决裂|对立/ },
  { category: '师徒', pattern: /师|徒|导师|老师|弟子|学生|师父|师傅|前辈|后辈/ },
  { category: '家族', pattern: /父|母|兄|弟|姐|妹|儿|女|亲|族|孪生|血缘|家人|祖母|祖父|爷爷|奶奶/ },
  { category: '同盟', pattern: /友|盟|伙伴|同伴|战友|同事|上下级|雇主|主仆|室友|闺蜜|死党|搭档|同窗|同门/ },
];

/** 关系类型关键词归类；无命中归「其他」。 */
export function relationCategory(relationType: string): RelationCategory {
  const text = String(relationType || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return '其他';
}

/** 类别 → ASCII class 片段（配合 `cat-` 前缀使用；配色走 --cr-cat 自定义属性，主界面胶囊与关系网共用）。 */
export function relationCategoryClass(category: RelationCategory): string {
  switch (category) {
    case '亲密': return 'intimate';
    case '敌对': return 'rival';
    case '师徒': return 'mentor';
    case '家族': return 'family';
    case '同盟': return 'ally';
    default: return 'other';
  }
}

// ── 关系图（人物网）模型 ──

export type RelationNodeKind = 'protagonist' | 'romance' | 'important' | 'unknown';

export interface RelationGraphNode {
  name: string;
  kind: RelationNodeKind;
  portraitPath: string | null;
  briefIntro: string;
  /** 参与的关系数（去重后），视觉权重用。 */
  degree: number;
}

export interface RelationGraphEdge {
  relation: CharacterRelation;
  /** 与 nodes[].name 对应的两个端点名。 */
  a: string;
  b: string;
  category: RelationCategory;
  /** 主角边专属：来自角色表「对主角态度」列（relation.currentStatus 同为态度段）；表内边不设。 */
  protagonistAttitude?: string;
}

export interface CharacterRelationGraph {
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    categoryCounts: Partial<Record<RelationCategory, number>>;
  };
}

export interface RelationRosterMember {
  name: string;
  kind?: 'romance' | 'important';
  portraitPath?: string | null;
  briefIntro?: string;
  /** 角色表「对主角态度」列原文（两段格式），主角边的唯一来源。 */
  attitudeCell?: string;
}

/** 组装关系图：节点 = 名册 ∪ 主角 ∪ 关系中出现的姓名；边 = 表内成对行 + 名册成员—主角边（态度列）。纯函数。
 *  表内含主角的成对行不再渲染（与主角的关系已迁往态度列，防双份）。 */
export function buildCharacterRelationGraph(
  relations: CharacterRelation[],
  roster: readonly RelationRosterMember[],
  protagonist: { name: string } | null,
): CharacterRelationGraph {
  const { unique } = dedupeCharacterRelations(relations);
  const protagonistName = protagonist?.name || '';
  const memberByName = new Map<string, RelationRosterMember>();
  for (const member of roster) {
    if (!member.name || memberByName.has(member.name)) continue;
    memberByName.set(member.name, member);
  }
  const nodes = new Map<string, RelationGraphNode>();
  const addNode = (name: string, kind: RelationNodeKind): void => {
    if (!name || nodes.has(name)) return;
    const member = memberByName.get(name);
    nodes.set(name, {
      name,
      kind,
      portraitPath: member?.portraitPath || null,
      briefIntro: member?.briefIntro || '',
      degree: 0,
    });
  };
  if (protagonistName) addNode(protagonistName, 'protagonist');
  for (const member of roster) addNode(member.name, member.kind === 'romance' ? 'romance' : member.kind === 'important' ? 'important' : 'unknown');
  const edges: RelationGraphEdge[] = unique
    .filter(relation => relation.charA !== relation.charB)
    .filter(relation => !protagonistName || (relation.charA !== protagonistName && relation.charB !== protagonistName))
    .map(relation => ({ relation, a: relation.charA, b: relation.charB, category: relationCategory(relation.relationType) }));
  // 主角边：名册成员「对主角态度」列的关系段非空才生成（旧格式纯态度文本不出边，AI 改写后自愈）
  if (protagonistName) {
    let syntheticRowId = 9_900_000;
    for (const member of roster) {
      if (!member.name || member.name === protagonistName) continue;
      const parsed = parseProtagonistAttitude(member.attitudeCell);
      if (!parsed.relation) continue;
      const relation: CharacterRelation = {
        rowId: ++syntheticRowId,
        charA: member.name,
        charB: protagonistName,
        relationType: parsed.relation,
        mutualView: '',
        originNote: '',
        currentStatus: parsed.attitude,
      };
      edges.push({ relation, a: member.name, b: protagonistName, category: relationCategory(parsed.relation), protagonistAttitude: parsed.attitude });
    }
  }
  for (const edge of edges) {
    addNode(edge.a, 'unknown');
    addNode(edge.b, 'unknown');
    const a = nodes.get(edge.a); if (a) a.degree++;
    const b = nodes.get(edge.b); if (b) b.degree++;
  }
  const categoryCounts: Partial<Record<RelationCategory, number>> = {};
  for (const edge of edges) categoryCounts[edge.category] = (categoryCounts[edge.category] || 0) + 1;
  return {
    nodes: [...nodes.values()],
    edges,
    stats: { nodeCount: nodes.size, edgeCount: edges.length, categoryCounts },
  };
}

export interface CharacterRelationWithPartner {
  relation: CharacterRelation;
  partner: string;
  category: RelationCategory;
}

/** 某角色的全部表内关系；按对方姓名在名册中的顺序稳定排序。
 *  excludeName（通常传主角名）：与主角的成对关系已迁往态度列，表内遗留主角对在此剔除。纯函数。 */
export function relationsOfCharacter(
  relations: CharacterRelation[],
  name: string,
  rosterOrder?: readonly string[],
  excludeName?: string,
): CharacterRelationWithPartner[] {
  const { unique } = dedupeCharacterRelations(relations);
  const order = rosterOrder ? new Map(rosterOrder.map((n, i) => [n, i])) : null;
  const out = unique
    .filter(relation => relation.charA === name || relation.charB === name)
    .filter(relation => !excludeName || (relation.charA !== excludeName && relation.charB !== excludeName))
    .map(relation => ({
      relation,
      partner: relation.charA === name ? relation.charB : relation.charA,
      category: relationCategory(relation.relationType),
    }));
  out.sort((x, y) => {
    const ix = order ? order.get(x.partner) ?? 9999 : 0;
    const iy = order ? order.get(y.partner) ?? 9999 : 0;
    if (ix !== iy) return ix - iy;
    return x.relation.rowId - y.relation.rowId;
  });
  return out;
}

export interface RelationInjectionOptions {
  /** 只保留与这组姓名相关的行；both=true 要求两侧都在组内（默认至少一侧）。 */
  involve?: readonly string[];
  both?: boolean;
  /** 输出上限（去重后截断），默认 20。 */
  limit?: number;
}

/** AI 注入用紧凑行：`- A×B｜关系类型｜相互看法｜关系状态`（空段跳过，起因备注不注入）。纯函数。 */
export function formatRelationInjectionLines(relations: CharacterRelation[], opts: RelationInjectionOptions = {}): string[] {
  const { unique } = dedupeCharacterRelations(relations);
  const involve = opts.involve ? new Set(opts.involve.filter(Boolean)) : null;
  const limit = opts.limit && opts.limit > 0 ? Math.floor(opts.limit) : 20;
  const lines: string[] = [];
  for (const relation of unique) {
    if (relation.charA === relation.charB) continue;
    if (involve) {
      const a = involve.has(relation.charA), b = involve.has(relation.charB);
      if (opts.both ? !(a && b) : !(a || b)) continue;
    }
    const parts = [relation.relationType, relation.mutualView, relation.currentStatus].map(v => String(v || '').trim()).filter(Boolean);
    if (!parts.length) continue;
    lines.push(`- ${relation.charA}×${relation.charB}｜${parts.join('｜')}`);
    if (lines.length >= limit) break;
  }
  return lines;
}
