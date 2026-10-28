import { getToastr } from './env';
// ===== 通知收敛封装 R1-R11（普通包装 · 逻辑收敛 + 文案统一）=====
// 详见 docs/notification-system/03-收敛去重方案.md
//
// 职责：把 66 处重复通知调用收敛为封装函数。底层：
//   持久类 → showPersistentError/Warning（api-config.ts，PERSIST_OPTS 不自动消失，套报错档红壳）
//   即时类 → getToastr()?.xxx（自动消失，notify-base 倒计时条）
// 文案/标题由本模块统一生成，调用点只传模块名与必要参数。
// 视觉由 styles/notify-base.ts 的主题化 CSS 统一美化，本模块不涉及 DOM/样式。
//
// 生成结果不合预期（原 R3/R4/R6 三族）已合并为 showGenOutputError：
// 按原始回复内容量细分「空回（<50 字）/ 格式错误」两类文案。
//
// 性能纪律：纯函数按需触发，未触发零开销；无轮询、无定时器。

import { showPersistentError, showPersistentWarning } from './api-config';

// 本模块局部 getToastr（与各 core 文件同模式：window.toastr || window.parent.toastr）

// ═══════════════════════════════════════════════════════════════
// R1-R9、R11：生成/操作类通知封装
// ═══════════════════════════════════════════════════════════════

/** R1「无法访问 generateRaw」环境错误（6 处）— 持久 error */
export function showEnvNotReady(module: string): void {
  showPersistentError(
    'AI 生成环境未就绪（无法访问 generateRaw/injectPrompts），请检查酒馆助手/MVU 是否正常加载',
    `${module} 环境错误`,
  );
}

/** R2「生成失败 catch 兜底」（4 处）— 持久 error。err 接 unknown，调用点直接传 catch 的 e */
export function showGenCatchError(module: string, err: unknown, suffix?: string): void {
  const errMsg = err instanceof Error ? err.message : String(err ?? '');
  const msg = `${module}生成失败: ${errMsg}\n\n请检查网络/API设置/模型是否可用${suffix ? '\n' + suffix : ''}`;
  showPersistentError(msg, `${module}生成错误`);
}

// ═══════════════════════════════════════════════════════════════
// 生成结果不合预期：统一按原始回复内容量细分「空回 / 格式错误」
// （替代原 R3「格式错误（非文本）」/ R4「输出内容异常截断」/ R6「未找到 X 标签」三族——
//   旧文案各说各话，用户看不出是「模型没吭声」还是「模型写跑偏了」。2026-10-06 用户拍板细分。）
// ═══════════════════════════════════════════════════════════════

/** 「空回」判定阈值：原始回复（剥 HTML 标签 + 去全部空白后）字符数低于此值即视为空回。 */
export const EMPTY_REPLY_CHAR_LIMIT = 50;

export type GenFailureKind = 'empty' | 'format';

/** 统计 AI 原始回复字符数（剥 HTML 标签 + 去全部空白；与世界演化 countReplyChars 同口径）。 */
export function countGenReplyChars(text: unknown): number {
  return String(text ?? '').replace(/<\/?[^>]+>/g, '').replace(/\s+/g, '').length;
}

/**
 * 生成结果不合预期时按原始回复内容量分两类：
 * - `empty`：回复为空或不足 EMPTY_REPLY_CHAR_LIMIT 字符——模型实际没说什么（被中断/拒绝/流断）；
 * - `format`：其余——模型说了不少，但没按约定标签/结构产出所需内容。
 * 非字符串入参没有文本可量：null/undefined（含 generateRaw 返回空）→ 空回；
 * 其余结构化返回（tool_calls 等）→ 格式错误（有产出，只是形状不对）。
 */
export function classifyGenFailure(raw: unknown): GenFailureKind {
  if (raw == null) return 'empty';
  if (typeof raw !== 'string') return 'format';
  return countGenReplyChars(raw) < EMPTY_REPLY_CHAR_LIMIT ? 'empty' : 'format';
}

/** 分类文案头（两类各一句，调用点可再拼具体说明）。 */
export function genFailureHead(raw: unknown): string {
  return classifyGenFailure(raw) === 'empty'
    ? `AI 空回：本次回复不足 ${EMPTY_REPLY_CHAR_LIMIT} 字，可能被中断或拒绝`
    : 'AI 回复格式错误：未按要求产出所需内容';
}

export interface GenOutputNoticeOptions {
  /** 追加在分类文案后的模块特定说明（缺省用统一的「请重试或换模型」）。 */
  suffix?: string;
  /** 通知级别：error = 持久报错档（默认）；warning = 持久警告档（部分成功场景，如解析到 0 条）。 */
  level?: 'error' | 'warning';
  /** 通知标题；缺省 `${module}生成错误`（部分成功场景沿用原标题，去重键与打扰程度不变）。 */
  title?: string;
}

/**
 * 「AI 输出不合预期」的统一报错：按原始回复内容量自动选「空回 / 格式错误」文案。
 * raw = 本次生成的原始回复；拿不到原始回复时传 null（按空回处理）。
 */
export function showGenOutputError(module: string, raw: unknown, opts: GenOutputNoticeOptions = {}): void {
  const msg = `${genFailureHead(raw)}，${opts.suffix || '请重试或换模型'}`;
  const title = opts.title || `${module}生成错误`;
  if (opts.level === 'warning') showPersistentWarning(msg, title);
  else showPersistentError(msg, title);
}

/** R5「apiErr 动态 API 校验错误」（9 处）— persistent=true 持久 7 处 / false 即时 2 处（天赋树，不打扰） */
export function showApiConfigError(module: string, apiErr: string, persistent = true): void {
  if (persistent) showPersistentError(apiErr, `${module}错误`);
  else getToastr()?.error(apiErr, `${module}错误`);
}

/** R7「并发节流 正在生成/处理中」（4 处）— 即时 warning */
export function showBusyNow(module: string, action = '生成'): void {
  getToastr()?.warning(`正在${action}中，请稍候`, module);
}

/** R8「瑟瑟能量不足」— 即时 warning。U31(十三轮) 起为规范入口：current 传入时输出统一文案
 *  「瑟瑟能量不足（当前 X / 需要 Y）」（口径 A，13 处一致）；缺省保持旧两档文案兼容零散调用。 */
export function showEnergyShort(module = '剧情特卖', need?: number, current?: number): void {
  getToastr()?.warning(
    current !== undefined && need !== undefined
      ? `瑟瑟能量不足（当前 ${current} / 需要 ${need}）`
      : need ? `当前瑟瑟能量不足，生成需要 ${need} 点` : '当前瑟瑟能量不足',
    module,
  );
}

/** R11「AI 生成失败」短提示（2 处，全在 skill-tree-engine）— 即时 error */
export function showAiGenFailed(module = '天赋树'): void {
  getToastr()?.error('AI 生成失败', module);
}