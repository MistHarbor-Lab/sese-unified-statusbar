import { _lsGet, _lsSet } from './config-store';

// 长按额外提示词缓存：每个长按入口全局一份最近确认输入，长按打开时预填复用。
// 大采访配置弹窗非长按入口，亦复用此机制（打开预填上次确认的额外要求）。
// 短按路径不读写；仅确认时写入（空值不写）。存 localStorage（临时 UI 状态，跨刷新保留）。
export const EXTRA_PROMPT_CACHE_KEYS = {
  investigation: 'ub_extra_investigation',
  nsfwGuidance: 'ub_extra_nsfw_guidance',
  shopStory: 'ub_extra_shop_story',
  calendar: 'ub_extra_calendar',
  mapRefresh: 'ub_extra_map_refresh',
  mapLibGen: 'ub_extra_map_lib_gen',
  skill: 'ub_extra_skill',
  interview: 'ub_extra_interview',
} as const;

export function readExtraPromptCache(key: string): string {
  return (_lsGet(key) || '').trim();
}

export function writeExtraPromptCache(key: string, value: string): void {
  const v = (value || '').trim();
  if (v) _lsSet(key, v);
}
