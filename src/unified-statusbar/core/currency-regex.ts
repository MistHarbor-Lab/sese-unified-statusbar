// ===== 货币正则卡片自动注入（酒馆全局显示正则）=====
// 先例：UBS_phone/core/story-link.ts ensureStoryLinkInjection（getTavernRegexes /
// importRawTavernRegex / updateTavernRegexesWith + 脚本名前缀作归属锚点）。
// 脚本定义单一事实源 = docs/regex-货币正文卡片V1.json（手动导入文件保留兼容；
// 自动注入后无需再手动操作，同名脚本天然去重）。生命周期只随 currencyEnabled：
// 开启注入、关闭撤除；渲染内容为静态样式，无随数据重建的需求。
import currencyRegexJson from '../docs/regex-货币正文卡片V1.json';
import { getConfig } from './config-store';
import { getToastr, getTavernHelper } from './env';

/** 酒馆正则面板可见的脚本名前缀（归属锚点：查重/撤除都以它认领）。 */
export const CURRENCY_REGEX_PREFIX = '【货币卡片】';

interface CurrencyRegexScript {
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
export function currencyRegexScripts(): CurrencyRegexScript[] {
  return Array.isArray(currencyRegexJson) ? (currencyRegexJson as unknown as CurrencyRegexScript[]).map(s => ({ ...s })) : [];
}

const nameOf = (r: unknown): string => String((r as { script_name?: unknown })?.script_name ?? (r as { scriptName?: unknown })?.scriptName ?? '');

/**
 * 幂等注入：缺哪补哪（importRawTavernRegex 纯增量 push），同名脚本内容漂移（用户改动）原地治愈。
 * 返回本次新注入条数；API 不可用/开关关闭返回 0；注入失败抛错由调用方容错。
 */
export async function ensureCurrencyRegexInjection(): Promise<number> {
  if (getConfig().currencyEnabled !== true) return 0;
  const th = getTavernHelper() as { getTavernRegexes?: (o: unknown) => unknown; importRawTavernRegex?: (n: string, raw: string) => unknown; updateTavernRegexesWith?: (fn: unknown, o: unknown) => Promise<unknown> } | null;
  if (!th || typeof th.getTavernRegexes !== 'function' || typeof th.importRawTavernRegex !== 'function') return 0;
  const regexes = th.getTavernRegexes({ type: 'global' });
  const existing = new Map<string, unknown>();
  for (const r of Array.isArray(regexes) ? regexes as unknown[] : []) {
    const name = nameOf(r);
    if (name) existing.set(name, r);
  }
  let added = 0;
  const stale: CurrencyRegexScript[] = [];
  for (const script of currencyRegexScripts()) {
    const cur = existing.get(script.scriptName);
    if (!cur) {
      const ok = th.importRawTavernRegex(script.scriptName, JSON.stringify(script));
      if (!ok) throw new Error(`货币渲染正则「${script.scriptName}」注入失败`);
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
    try { getToastr()?.success(`货币正则卡片已注入 ${added} 条`, '货币系统'); } catch (_e) { /* ignore */ }
  }
  return added;
}

/** 撤除本系统注入的全部正则（按前缀认领；开关关闭时调用；best-effort 静默）。 */
export async function removeCurrencyRegexScripts(): Promise<void> {
  const th = getTavernHelper() as { updateTavernRegexesWith?: (fn: unknown, o: unknown) => Promise<unknown> } | null;
  if (!th || typeof th.updateTavernRegexesWith !== 'function') return;
  await th.updateTavernRegexesWith((list: unknown[]) => (Array.isArray(list) ? list : [])
    .filter((r: unknown) => !nameOf(r).startsWith(CURRENCY_REGEX_PREFIX)), { type: 'global' });
}
