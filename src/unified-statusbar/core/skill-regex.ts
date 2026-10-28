// ===== 技能正则卡片自动注入（酒馆全局显示正则；发动 + 新增两条）=====
// 先例：core/currency-regex.ts（getTavernRegexes / importRawTavernRegex / updateTavernRegexesWith +
// 脚本名前缀作归属锚点）。
// 脚本定义单一事实源 = docs/regex-技能正文卡片V1.json（手动导入文件兼容；自动注入后无需再手动操作，
// 同名脚本天然去重——存量用户已手动导入的旧「技能发动」正则靠同名漂移治愈原地升级为新卡片）。
// 生命周期只随 skillEnabled：开启注入、关闭撤除；渲染内容为静态样式，无随数据重建的需求
// （发动卡效果文本由点击时前端实时读取填入，见 index.ts 委托监听）。
import skillRegexJson from '../docs/regex-技能正文卡片V1.json';
import { getConfig } from './config-store';
import { getToastr, getTavernHelper } from './env';

/** 酒馆正则面板可见的脚本名前缀（归属锚点：查重/撤除都以它认领）。 */
export const SKILL_REGEX_PREFIX = '【技能发动】';

interface SkillRegexScript {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  disabled: boolean;
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: number;
  minDepth: null;
  maxDepth: null;
}

/** 注入用快照（每次取新数组，防调用方误改 JSON 常量）。 */
export function skillRegexScripts(): SkillRegexScript[] {
  return Array.isArray(skillRegexJson) ? (skillRegexJson as unknown as SkillRegexScript[]).map(s => ({ ...s })) : [];
}

const nameOf = (r: unknown): string => String((r as { script_name?: unknown })?.script_name ?? (r as { scriptName?: unknown })?.scriptName ?? '');

/**
 * 幂等注入：缺哪补哪（importRawTavernRegex 纯增量 push），同名脚本内容漂移（用户改动/旧版本）原地治愈。
 * 返回本次新注入条数；API 不可用/开关关闭返回 0；注入失败抛错由调用方容错。
 */
export async function ensureSkillRegexInjection(): Promise<number> {
  if (getConfig().skillEnabled !== true) return 0;
  const th = getTavernHelper() as { getTavernRegexes?: (o: unknown) => unknown; importRawTavernRegex?: (n: string, raw: string) => unknown; updateTavernRegexesWith?: (fn: unknown, o: unknown) => Promise<unknown> } | null;
  if (!th || typeof th.getTavernRegexes !== 'function' || typeof th.importRawTavernRegex !== 'function') return 0;
  const regexes = th.getTavernRegexes({ type: 'global' });
  const existing = new Map<string, unknown>();
  for (const r of Array.isArray(regexes) ? regexes as unknown[] : []) {
    const name = nameOf(r);
    if (name) existing.set(name, r);
  }
  let added = 0;
  const stale: SkillRegexScript[] = [];
  for (const script of skillRegexScripts()) {
    const cur = existing.get(script.scriptName);
    if (!cur) {
      const ok = th.importRawTavernRegex(script.scriptName, JSON.stringify(script));
      if (!ok) throw new Error(`技能渲染正则「${script.scriptName}」注入失败`);
      added++;
    } else if (String((cur as { find_regex?: unknown })?.find_regex ?? (cur as { findRegex?: unknown })?.findRegex ?? '') !== script.findRegex
      || String((cur as { replace_string?: unknown })?.replace_string ?? (cur as { replaceString?: unknown })?.replaceString ?? '') !== script.replaceString) {
      stale.push(script);
    }
  }
  if (stale.length && typeof th.updateTavernRegexesWith === 'function') {
    const patchByName = new Map(stale.map(s => [s.scriptName, s] as const));
    await th.updateTavernRegexesWith((list: unknown[]) => (Array.isArray(list) ? list : []).map((r: unknown) => {
      const patch = patchByName.get(nameOf(r));
      return patch ? { ...(r as Record<string, unknown>), find_regex: patch.findRegex, replace_string: patch.replaceString } : r;
    }), { type: 'global' });
  }
  if (added) {
    try { getToastr()?.success(`技能正则卡片已注入 ${added} 条`, '技能'); } catch (_e) { /* ignore */ }
  }
  return added;
}

/** 撤除本系统注入的全部正则（按前缀认领；开关关闭时调用；best-effort 静默）。 */
export async function removeSkillRegexScripts(): Promise<void> {
  const th = getTavernHelper() as { updateTavernRegexesWith?: (fn: unknown, o: unknown) => Promise<unknown> } | null;
  if (!th || typeof th.updateTavernRegexesWith !== 'function') return;
  await th.updateTavernRegexesWith((list: unknown[]) => (Array.isArray(list) ? list : [])
    .filter((r: unknown) => !nameOf(r).startsWith(SKILL_REGEX_PREFIX)), { type: 'global' });
}
