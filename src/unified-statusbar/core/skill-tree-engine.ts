import { getTavernHelper, getToastr } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
// core/skill-tree-engine.ts
// 天赋树 AI 生成编排：批量（单请求多树）+ 单棵重生 + 解析存储。镜像 map-system.ts。
import {
  buildSkillTreePromptParts, parseTreeJsonBlocks,
  type SkillTreePromptParts,
} from './skill-prompts';
import { validateSkillTree, writeSkillTree, hasSkillTree, readSkillTree } from './skill-store';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import { showEnvNotReady, showBusyNow, showApiConfigError, showAiGenFailed } from './notify-presets';
import { getCellByHeader, getSheetByName, incrementCell } from './data-manager';
import { readSerseEnergy } from './energy-payment';
import { syncSkillWorldbook } from './skill-worldbook';
import { getConfig } from './config-store';
import { isManagedSkillEntry, withNativeScanWorldbook } from './worldbook-entry';
import { getJailbreakTailPrompts } from './jailbreak-config';
import { previewSkillCost, deductSkillExpWithSerseFallback } from './skill-activation';
import {
  SKILL_TABLE_NAME, SKILL_COL,
  SKILL_TREE_GEN_COST, SKILL_RESET_REFUND_RATIO, SKILL_REGEN_REFUND_RATIO,
  type SkillTalentTree,
} from './skill-types';
import { captureChatScope } from './story-floor-store';
import type { ChatScope } from './chat-scope';

let _generating = false;
let _skillTreeAborted = false; // 统一活动取消：调用方据此静默返回，不弹「生成失败」


/** 读主角技能表全部技能 */
function readAllSkills(): { name: string; type: string; desc: string }[] {
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (!sheet || !Array.isArray(sheet.content)) return [];
  const out: { name: string; type: string; desc: string }[] = [];
  for (let i = 1; i < sheet.content.length; i++) {
    const name = getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.name);
    if (!name) continue;
    out.push({
      name: String(name),
      type: String(getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.type) || ''),
      desc: String(getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.desc) || ''),
    });
  }
  return out;
}

/** 读某技能当前描述（基础节点 desc = 技能初始描述）。 */
function getSkillDesc(skillName: string): string {
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (!sheet || !Array.isArray(sheet.content)) return '';
  for (let i = 1; i < sheet.content.length; i++) {
    if (getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.name) === skillName) {
      return String(getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.desc) || '');
    }
  }
  return '';
}

/** 按技能名定位表内行号（content 索引）。 */
function findSkillRow(skillName: string): number {
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (!sheet || !Array.isArray(sheet.content)) return 1;
  for (let i = 1; i < sheet.content.length; i++) {
    if (getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.name) === skillName) return i;
  }
  return 1;
}

async function callGenerateRaw(parts: SkillTreePromptParts): Promise<string | null> {
  _skillTreeAborted = false;
  const th = getTavernHelper();
  if (!th || typeof th.generateRaw !== 'function') {
    showEnvNotReady('天赋树');
    return null;
  }
  const sub = (s: string): string => (typeof th.substitudeMacros === 'function' ? th.substitudeMacros(s) : s);
  // 1A 同构三段式：结构头(破限+防八股+设计师规则) → 原生世界书槽位（触发注入激活绿灯；扫描前经
  // withNativeScanWorldbook 暂停「主角当前技能」自投影条目并预渲染 EJS）→ 角色卡上下文 → 资料块
  // (after_system 注入：主角信息+剧情上下文) → user_input(清单/规则) → 结构尾(防截断)。max_chat_history:0。
  // 重试包在扫描准备之外：一次性注入（once:true）与扫描钩配置都只在「下一次生成」生效，
  // 放在里面的话重试那一发会丢掉触发注入与资料块。错误处理口径不变（抛错→记日志返回 null）。
  const attempt = (ctx: TextAiContext) => withNativeScanWorldbook({ suspend: isManagedSkillEntry }, async () => {
    if (typeof th.injectPrompts === 'function') {
      await th.injectPrompts([{
        id: 'ub_skill_tree_trigger',
        position: 'none',
        depth: 0,
        role: 'system',
        content: parts.trigger,
        should_scan: true,
      }], { once: true });
      if (parts.dossier) {
        await th.injectPrompts([{
          id: 'ub_skill_tree_dossier',
          position: 'after_system',
          depth: 0,
          role: 'system',
          content: sub(parts.dossier),
          should_scan: false,
        }], { once: true });
      }
    }
    const result = await th.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: sub(parts.userInput),
      ordered_prompts: [
        ...parts.head,
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      custom_api: getCustomApiConfig('skillTree'),
    });
    return typeof result === 'string' ? result : null;
  });
  try {
    return await withTextAiRetry('skillTree', attempt, {
      feature: 'skillTree',
      onCancel: () => { _skillTreeAborted = true; },
    });
  } catch (e) {
    if (isAiAbortError(e) || _skillTreeAborted) return null; // 用户终止：静默收口
    console.warn('[技能树] generateRaw 异常:', e);
    return null;
  }
}

/** 解析多树块并写入；返回成功/失败技能名。基础节点由系统从技能表当前描述提供（非 AI 生成）。
 *  scope：聊天归属守卫；每棵树落盘前核对（AI 期间切聊天 → 停止写入，已写的保留）。 */
async function ingestBlocks(raw: string, expected: Set<string>, scope: ChatScope): Promise<{ ok: string[]; fail: string[] }> {
  const blocks = parseTreeJsonBlocks(raw);
  const ok: string[] = [];
  const fail: string[] = [];
  const handled = new Set<string>();
  if (!scope.isCurrent()) return { ok, fail: [...expected] };
  for (const b of blocks) {
    // 只写清单内的技能：单技能请求时 AI 可能受上下文里其它技能名诱导而多返回，
    // 用 expected 守卫丢弃清单外的块，避免"点单个技能却生成了所有技能的树"。
    // 容错：AI 可能把清单里的类别拼进 skill 名（如「本能支配（被动）」），去尾部括号后缀后匹配 expected 原名；
    // 匹配上则用 expected 原名覆盖 b.skillName，保证 writeSkillTree 按技能表原名写入、后续 readSkillTree 能读到。
    let matchName: string | undefined = expected.has(b.skillName) ? b.skillName : undefined;
    if (!matchName) {
      const stripped = b.skillName.replace(/[（(][^（()）)]*[）)]\s*$/, '').trim();
      if (stripped !== b.skillName) matchName = [...expected].find((e) => e === stripped);
    }
    if (!matchName) continue;
    b.skillName = matchName;
    const json: any = b.json && typeof b.json === 'object' ? b.json : {};
    json.nodes = json.nodes && typeof json.nodes === 'object' ? json.nodes : {};
    json.mainLines = Array.isArray(json.mainLines) ? json.mainLines : [];
    // 基础节点由系统提供（技能初始描述）；移除 AI 可能误生成的 base
    for (const id of Object.keys(json.nodes)) {
      if (json.nodes[id]?.kind === 'base') delete json.nodes[id];
    }
    json.nodes['base'] = {
      id: 'base', kind: 'base', lineId: '', tier: 0,
      title: b.skillName + '·基础', desc: getSkillDesc(b.skillName), cost: 0, parentId: null,
    };
    json.rootId = 'base';
    // 主线第一节点 parentId 接到 base（AI 应为 null；兜底处理悬空 parentId）
    for (const ml of json.mainLines) {
      const firstId = ml?.nodeIds?.[0];
      if (firstId && json.nodes[firstId] && (json.nodes[firstId].parentId == null || !json.nodes[json.nodes[firstId].parentId])) {
        json.nodes[firstId].parentId = 'base';
      }
    }
    const tree = validateSkillTree({ ...json, skillName: b.skillName, version: 1, schema: 'skill_talent_tree', storyHash: '' });
    if (!tree) {
      if (!handled.has(b.skillName)) fail.push(b.skillName);
      continue;
    }
    // 落盘失败（只读/未就绪返回 false）计 fail 不计 ok：防止「扣费成功但树没写入」。
    // 聊天归属守卫：AI 期间切聊天 → 后续树不再写入新聊天（已写的保留，按 fail 上报）。
    if (!scope.isCurrent()) {
      if (!handled.has(b.skillName)) fail.push(b.skillName);
      continue;
    }
    const saved = await writeSkillTree(tree).catch(() => false);
    if (!saved) {
      if (!handled.has(b.skillName)) fail.push(b.skillName);
      continue;
    }
    handled.add(b.skillName);
    ok.push(b.skillName);
  }
  for (const name of expected) if (!handled.has(name)) fail.push(name);
  return { ok, fail };
}

/** 已激活非基础节点 cost 之和（= 历史已消耗经验）。 */
function sumConsumed(tree: SkillTalentTree): number {
  let sum = 0;
  for (const id of tree.activated) if (id !== tree.rootId) sum += Number(tree.nodes[id]?.cost || 0);
  return sum;
}

/** 把经验加回该技能 skill_exp（best-effort，退还用；不涉及瑟瑟能量——1:5 折算下等值，且避免套利）。 */
async function addSkillExp(skillName: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const rowIdx = findSkillRow(skillName);
  // 增量写（列 = 列 + N）：并发下不丢增减（旧「读当前值 + amount」在并发窗口里只生效一次）
  try { await incrementCell(SKILL_TABLE_NAME, rowIdx, SKILL_COL.exp, amount); } catch (_e) { /* best-effort */ }
}

/** 批量生成预览（只读）：未成树技能清单、总花费、是否全部付得起（瑟瑟能量为共享池，按技能顺序扣减）。 */
export interface BatchGenPreview {
  missing: string[];
  affordable: boolean;
  shortSkill?: string;     // 首个付不起的技能（全部中止时定位）
  shortNeedExp?: number;
  shortNeedSerse?: number;
  curSerse: number;
  totalExpDeduct: number;  // 预计从各技能 skill_exp 扣的总量
  totalSerseNeed: number;  // 预计从瑟瑟能量扣的总量
}

export function previewBatchGeneration(): BatchGenPreview {
  const all = readAllSkills();
  const missing = all.filter((s) => !hasSkillTree(s.name)).map((s) => s.name);
  const curSerse = readSerseEnergy(); // U31：统一出口
  let remainingSerse = curSerse;
  let totalExpDeduct = 0, totalSerseNeed = 0;
  let affordable = true;
  let shortSkill: string | undefined, shortNeedExp = 0, shortNeedSerse = 0;
  for (const name of missing) {
    const pv = previewSkillCost(name, SKILL_TREE_GEN_COST);
    totalExpDeduct += pv.expDeduct;
    totalSerseNeed += pv.needSerse;
    if (affordable) {
      if (pv.needSerse > remainingSerse) {
        affordable = false;
        shortSkill = name; shortNeedExp = pv.needExp; shortNeedSerse = pv.needSerse;
      } else {
        remainingSerse -= pv.needSerse;
      }
    }
  }
  return { missing, affordable, shortSkill, shortNeedExp, shortNeedSerse, curSerse, totalExpDeduct, totalSerseNeed };
}

/** 批量：单次请求生成所有未成树技能的天赋树。extraReq 仅长按时传入。
 *  生成每棵扣 SKILL_TREE_GEN_COST 经验（不足用瑟瑟能量补足）；任一技能付不起 → 整批中止，不发 AI、不扣费。
 *  仅对实际生成成功的技能扣费（AI 失败的不扣）。 */
export async function generateAllSkillTrees(extraReq?: string): Promise<{ ok: string[]; fail: string[] }> {
  if (_generating) { showBusyNow('天赋树', '生成'); return { ok: [], fail: [] }; }
  const pv = previewBatchGeneration();
  if (pv.missing.length === 0) { getToastr()?.info('所有技能已有天赋树', '天赋树'); return { ok: [], fail: [] }; }
  if (!pv.affordable) {
    getToastr()?.error(`经验不足：「${pv.shortSkill}」瑟瑟能量不足（当前 ${pv.curSerse} / 还需 ${pv.shortNeedSerse} 补足），已中止批量生成`, '天赋树'); // U31 文案对齐
    return { ok: [], fail: pv.missing.slice() };
  }
  const apiErr = validateCustomApiConfig('skillTree');
  if (apiErr) { showApiConfigError('天赋树', apiErr, false); return { ok: [], fail: pv.missing.slice() }; }

  _generating = true;
  const cfg = getConfig();
  try {
    // 聊天归属守卫：天赋树写的是当前聊天的 story；AI 期间切聊天 → 不写入、不扣费。
    const scope = captureChatScope('天赋树');
    // 即时反馈由统一 AI 活动注册表负责（提示条/悬浮钮/统一 toast），这里不再单独弹 toast
    const missingSkills = readAllSkills().filter((s) => pv.missing.includes(s.name));
    const parts = await buildSkillTreePromptParts({
      skills: missingSkills,
      extraReq,
      contextCount: cfg.skillContextCount,
    });
    const raw = await callGenerateRaw(parts);
    if (!raw) {
      if (_skillTreeAborted) return { ok: [], fail: [] };
      if (!scope.isCurrent()) return { ok: [], fail: [] };
      showAiGenFailed(); return { ok: [], fail: pv.missing.slice() };
    }
    const res = await ingestBlocks(raw, new Set(pv.missing), scope);
    if (!scope.isCurrent()) return { ok: [], fail: [] };
    await syncSkillWorldbook();
    // 仅对实际生成成功的技能各扣 SKILL_TREE_GEN_COST（不足用瑟瑟能量补足）
    let charged = 0;
    for (const name of res.ok) {
      const r = await deductSkillExpWithSerseFallback(name, SKILL_TREE_GEN_COST);
      if (r.ok) charged++;
    }
    if (res.ok.length) {
      try { (window as any).__ubEmitAchievement?.('skill_tree_generated', { skillName: res.ok[0], count: res.ok.length }); } catch (_e) { /* ignore */ }
      const costTail = charged < res.ok.length ? `（${charged}/${res.ok.length} 扣费成功）` : `（每棵 ${SKILL_TREE_GEN_COST} 经验）`;
      getToastr()?.success(`生成 ${res.ok.length} 棵天赋树${costTail}` + (res.fail.length ? `，失败 ${res.fail.length}` : ''), '天赋树');
    }
    if (res.fail.length) getToastr()?.warning('失败：' + res.fail.join('、'), '天赋树');
    return res;
  } finally {
    _generating = false;
  }
}

/** 单棵生成：独立小请求，共享上下文照常，仅清单只含该技能。
 *  chargeCost=true（首次生成）时扣 SKILL_TREE_GEN_COST 经验：付不起不发 AI；成功后才扣。
 *  resetAndRegenerateSkillTree 内部调用时传 false（重新生成不另收生成费，只退还 50%）。 */
export async function regenerateSkillTree(skillName: string, extraReq?: string, chargeCost = false, onInline?: (msg: string) => void): Promise<boolean> {
  if (_generating) { showBusyNow('天赋树', '生成'); return false; }
  const all = readAllSkills();
  const s = all.find((x) => x.name === skillName);
  if (!s) { if (onInline) onInline('未找到该技能'); else console.warn('[skill-tree] regenerateSkillTree: 未找到该技能 ' + skillName); return false; }
  const apiErr = validateCustomApiConfig('skillTree');
  if (apiErr) { showApiConfigError('天赋树', apiErr, false); return false; }

  // 首次生成扣费前置：付不起则不发 AI 请求
  if (chargeCost) {
    const pv = previewSkillCost(skillName, SKILL_TREE_GEN_COST);
    if (!pv.affordable) {
      getToastr()?.error(`经验不足 ${pv.needExp}，需瑟瑟能量 ${pv.needSerse}（当前 ${pv.curSerse}）`, '天赋树');
      return false;
    }
  }

  _generating = true;
  const cfg = getConfig();
  try {
    // 聊天归属守卫：天赋树写的是当前聊天的 story；AI 期间切聊天 → 不写入、不扣费。
    const scope = captureChatScope('天赋树');
    const parts = await buildSkillTreePromptParts({
      skills: [s],
      extraReq,
      contextCount: cfg.skillContextCount,
    });
    const raw = await callGenerateRaw(parts);
    if (!raw) {
      if (!scope.isCurrent()) return false;
      showAiGenFailed(); return false;
    }
    const res = await ingestBlocks(raw, new Set([skillName]), scope);
    if (!scope.isCurrent()) return false;
    await syncSkillWorldbook();
    if (res.ok.length) {
      let costInfo = '';
      if (chargeCost) {
        const r = await deductSkillExpWithSerseFallback(skillName, SKILL_TREE_GEN_COST);
        if (r.ok) costInfo = `，扣 ${r.costExp} 经验${r.costSerse ? ` + ${r.costSerse} 瑟瑟能量` : ''}`;
        else getToastr()?.warning('生成已成功但扣费异常', '天赋树');
      }
      getToastr()?.success(`${chargeCost ? '已生成' : '已重生成'}「${skillName}」天赋树${costInfo}`, '天赋树');
      try { (window as any).__ubEmitAchievement?.('skill_tree_regen', { skillName }); } catch (_e) { /* ignore */ }
      return true;
    }
    getToastr()?.warning('生成失败', '天赋树');
    return false;
  } finally {
    _generating = false;
  }
}

/**
 * 重新生成该技能天赋树：
 * 1. 重新生成**成功后**才退还旧树已消耗经验的 SKILL_REGEN_REFUND_RATIO（50%）→ 加回该技能
 *    skill_exp（直接按比例退还，不涉及瑟瑟能量）。退款前置会造成「失败也退款」可被反复白拿。
 * 2. 派生常亮条目同步由 regenerateSkillTree 内部完成（生成失败时什么都不变，无需同步）。
 * 3. 不另收生成费（regenerateSkillTree chargeCost=false）。
 */
export async function resetAndRegenerateSkillTree(skillName: string, extraReq?: string): Promise<boolean> {
  const tree = readSkillTree(skillName);
  const refund = tree ? Math.round(sumConsumed(tree) * SKILL_REGEN_REFUND_RATIO) : 0;
  const ok = await regenerateSkillTree(skillName, extraReq, false);
  if (ok && refund > 0) await addSkillExp(skillName, refund);
  return ok;
}

export interface ResetActivationsResult { ok: boolean; refund: number; reason?: string; }

/**
 * 重置当前技能：取消该技能所有已激活节点（含主线选择），<b>保留天赋树结构</b>（可重新选择主线/支线）。
 * 退还已消耗经验的 SKILL_RESET_REFUND_RATIO（75%）→ 加回该技能 skill_exp（1:5 折算下等值，不退瑟瑟能量）。
 * 无激活节点则失败。成功后激活态回到仅基础节点。
 */
export async function resetSkillActivations(skillName: string): Promise<ResetActivationsResult> {
  const tree = readSkillTree(skillName);
  if (!tree) return { ok: false, refund: 0, reason: '无天赋树' };
  const hasActiveNonBase = tree.activated.some((id) => id !== tree.rootId);
  if (!hasActiveNonBase) return { ok: false, refund: 0, reason: '无已激活节点' };
  const refund = Math.round(sumConsumed(tree) * SKILL_RESET_REFUND_RATIO);
  tree.activated = [tree.rootId];
  tree.chosenMainLine = null;
  // 先写盘成功再退款：写盘失败时激活态与经验都不变，避免「保留激活还白拿退款」。
  const saved = await writeSkillTree(tree).catch(() => false);
  if (!saved) return { ok: false, refund: 0, reason: '保存天赋树失败，激活态未重置' };
  if (refund > 0) await addSkillExp(skillName, refund);
  await syncSkillWorldbook();
  try { (window as any).__ubEmitAchievement?.('skill_tree_reset', { skillName, refund }); } catch (_e) { /* ignore */ }
  return { ok: true, refund };
}