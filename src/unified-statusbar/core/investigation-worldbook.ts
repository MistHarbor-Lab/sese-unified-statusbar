import { getTavernHelper } from './env';
import { STANDARD_RECURSION } from './constants';
// core/investigation-worldbook.ts
// 大调查档案 → 角色世界书注入:把用户勾选的档案模块写成一条世界书条目。
// 镜像 core/skill-worldbook.ts 的 makeNewEntry / getWorldbook+replaceWorldbook 模式,
// 但用绿灯(selective)+ 角色名关键词触发(而非蓝灯常驻),落点角色定义前 order 100。

import { wbEntryName } from './worldbook-entry';
import { dsCachePos } from './wb-position';

/** 写入条目的显示名前缀(=内部键,双写 name+comment 跨版本命中) */
export const INVESTIGATION_WB_PREFIX = '大调查档案-';

/** 大调查档案在世界书条目中的固定 order(角色定义前) */
export const INVESTIGATION_WB_ORDER = 100;


/** 模块定义:每个模块覆盖一组字段别名(复用 investigation-parser 的字段名集合)。
 *  字段名匹配为「子串包含」(兼容 AI 输出中可能带冒号/变体)。 */
export interface InvestigationModuleDef {
  id: string;
  label: string;       // 模块标题(写入内容的【模块名】)
  aliases: string[];   // 字段名别名(任一命中即归入本模块)
}

// 10 大模块定义;顺序即写入时的展示顺序。
export const INVESTIGATION_MODULE_DEFS: InvestigationModuleDef[] = [
  {
    id: 'basic',
    label: '基础档案',
    aliases: ['姓名', '性别', '年龄', '特写', '外貌', '身材数据', '身材', '身体数据'],
  },
  {
    id: 'appearance',
    label: '外貌风格',
    aliases: ['日常服装风格', '日常服装', '服装风格', '私密服装风格', '私密服装', '内衣风格', '妆容风格', '妆容'],
  },
  {
    id: 'psychology',
    label: '心理性向',
    aliases: ['性取向', '核心性癖', '核心XP', '羞耻指数', '性自信指数', '自信指数', '性开放度', '开放度'],
  },
  {
    id: 'purity',
    label: '纯洁档案',
    aliases: ['是否为处女', '是否为处男', '破处对象', '破处时间', '纯洁值', '纯洁度明细', '部位纯洁度明细'],
  },
  {
    id: 'stats',
    label: '性爱统计',
    aliases: ['性爱次数', '总次数', '性爱人数', '对象男女比', '性爱对象男女比', '男女比', '男女人数', '主要性爱名单', '性爱名单', '性伴名单', '性爱频率', '频率', '最常使用体位', '常用体位', '体位', '性爱场所分布', '场所分布', '场所'],
  },
  {
    id: 'fertility',
    label: '生育记录',
    aliases: ['怀孕', '生产', '打胎次数', '孕产', '详细生育记录', '生育记录', '生育详情', '使人怀孕次数', '使人怀孕', '详细使人怀孕记录'],
  },
  {
    id: 'development',
    label: '开发状态',
    aliases: ['口部开发', '手部开发', '足部开发', '乳部开发', '阳具开发', '阴部开发', '肛部开发'],
  },
  {
    id: 'masturbation',
    label: '自慰档案',
    aliases: ['自慰总次数', '自慰次数', '自慰频率', '第一次自慰', '首次自慰', '常用自慰方式', '自慰方式'],
  },
  {
    id: 'experience',
    label: '性经历档案',
    aliases: ['第一次性经历', '初体验', '最近一次性经历', '最近经历', '最爽一次性经历', '最爽经历'],
  },
  {
    id: 'charm',
    label: '综合魅力评估',
    aliases: ['魅力类型', '魅力标签', '色情分类TAG', '色情TAG', '色情标签', '全球排名', '排名', '品级评定', '品级', '评级', '排名优势因素', '优势因素', '优势', '排名劣势因素', '劣势因素', '劣势', '最具性吸引力部位', '最具吸引力部位', '吸引力部位', '声音档案', '声音魅力', '声音', '流言与评价', '异性评价', '同性评价', '他人评价', '评价', '使用者备注', '备注', '人物自评'],
  },
];

/** 把档案原始文本按【字段名】切成 {字段名: 内容} 映射。
 *  与 investigation-parser.splitFields 一致语义,但保留全部字段(不过滤空)。 */
function splitInvestigationFields(content: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!content) return out;
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('【');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const sepIdx = block.indexOf('】');
    if (sepIdx === -1) continue;
    const key = block.substring(0, sepIdx).trim();
    const value = block.substring(sepIdx + 1).replace(/\s+$/g, '').trim();
    if (key && value) out.set(key, value);
  }
  return out;
}

/** 判断字段名是否命中某模块(字段名包含任一别名,或别名包含字段名 —— 双向兼容) */
function fieldMatchesModule(fieldKey: string, def: InvestigationModuleDef): boolean {
  for (const a of def.aliases) {
    if (!a) continue;
    if (fieldKey.includes(a) || a.includes(fieldKey)) return true;
  }
  return false;
}

/** 返回当前档案里实际有内容的模块 id 列表(供对话框只显示有数据的模块,顺序同 MODULE_DEFS)。 */
export function getPresentModules(content: string): string[] {
  const fields = splitInvestigationFields(content);
  if (fields.size === 0) return [];
  const present: string[] = [];
  for (const def of INVESTIGATION_MODULE_DEFS) {
    let hit = false;
    for (const key of fields.keys()) {
      if (fieldMatchesModule(key, def)) { hit = true; break; }
    }
    if (hit) present.push(def.id);
  }
  return present;
}

/** 构建将写入世界书条目的 content 文本。
 *  只保留 selectedIds 指定的模块,按 MODULE_DEFS 顺序输出。
 *  每个模块以【模块名】行分隔,其下保留命中的字段原始【字段名】内容。 */
export function buildDossierWorldbookContent(
  content: string,
  selectedIds: string[],
  charName: string,
  timestamp: string,
): string {
  const fields = splitInvestigationFields(content);
  const selected = new Set(selectedIds);
  const includedLabels: string[] = [];
  const moduleBlocks: string[] = [];

  for (const def of INVESTIGATION_MODULE_DEFS) {
    if (!selected.has(def.id)) continue;
    const fieldLines: string[] = [];
    for (const [key, value] of fields) {
      if (fieldMatchesModule(key, def)) {
        fieldLines.push(`【${key}】${value}`);
      }
    }
    if (fieldLines.length === 0) continue;
    includedLabels.push(def.label);
    moduleBlocks.push(`【${def.label}】\n${fieldLines.join('\n')}`);
  }

  if (moduleBlocks.length === 0) return '';

  const header = `${charName} 的大调查档案(${timestamp || '未知时间'},来源:统一状态栏)\n含:${includedLabels.join(' / ')}`;
  return `${header}\n\n${moduleBlocks.join('\n\n')}`;
}

/** 取写入落点的世界书名:优先角色主世界书,无则取附加世界书;再无则返回 null(由调用方提示用户绑定角色世界书)。
 *  不再回退 getOrCreateChatWorldbook(会为每张新角色卡自动新建聊天世界书);并对绑定名做存在性校验,避免向已不存在的世界书写入抛错。 */
async function resolveTargetWorldbook(th: any): Promise<string | null> {
  try {
    const charWbs = th.getCharWorldbookNames?.('current');
    if (charWbs) {
      const names: string[] = th.getWorldbookNames?.() || [];
      if (charWbs.primary && names.includes(charWbs.primary)) return charWbs.primary;
      if (Array.isArray(charWbs.additional)) {
        for (const n of charWbs.additional) if (names.includes(n)) return n;
      }
    }
  } catch (_e) { /* fall through */ }
  return null;
}

/** 把选定的档案模块写入角色世界书条目(覆盖同名旧条目)。
 *  @returns {ok, msg} 供调用方 toastr 提示。 */
export async function addDossierToWorldbook(
  charName: string,
  content: string,
  selectedIds: string[],
  timestamp: string,
): Promise<{ ok: boolean; msg: string }> {
  const th = getTavernHelper();
  if (!th || typeof th.getWorldbook !== 'function' || typeof th.replaceWorldbook !== 'function') {
    return { ok: false, msg: '无法访问世界书接口(TavernHelper 不可用)' };
  }

  const body = buildDossierWorldbookContent(content, selectedIds, charName, timestamp);
  if (!body) {
    return { ok: false, msg: '所选模块无有效内容,未写入' };
  }

  const wbName = await resolveTargetWorldbook(th);
  if (!wbName) {
    return { ok: false, msg: '未找到当前角色卡绑定的角色世界书,请先在角色卡设置中绑定角色世界书' };
  }

  const entryName = INVESTIGATION_WB_PREFIX + charName;
  const newEntry = {
    name: entryName,
    comment: entryName,
    enabled: true,
    content: body,
    strategy: {
      type: 'selective' as const,
      keys: [charName],
      keys_secondary: { logic: 'and_any' as const, keys: [] },
      scan_depth: 'same_as_global' as const,
    },
    position: dsCachePos({
      type: 'before_character_definition',
      role: 'system',
      depth: 0,
      order: INVESTIGATION_WB_ORDER,
    }),
    recursion: STANDARD_RECURSION,
    addMemo: true,
  };

  try {
    const entries: any[] = await th.getWorldbook(wbName);
    const list = Array.isArray(entries) ? entries : [];
    const idx = list.findIndex((e) => wbEntryName(e) === entryName);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newEntry };
    } else {
      list.push(newEntry);
    }
    await th.replaceWorldbook(wbName, list, { render: 'debounced' });
    return { ok: true, msg: `已写入世界书《${wbName}》(角色定义前 · 顺序 ${INVESTIGATION_WB_ORDER} · 角色名触发)` };
  } catch (e) {
    return { ok: false, msg: '写入世界书失败:' + (e as Error).message };
  }
}
