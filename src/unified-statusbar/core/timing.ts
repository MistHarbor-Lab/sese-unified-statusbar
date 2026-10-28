// ===== 定时辅助统一出口 =====
// debounce：纯 trailing 防抖，多次调用合并为一次延迟执行（clear + setTimeout）。
// U34(十三轮)：返回值带 cancel()——「立绘自动生成/剧情生图/货币投影/弹窗搜索」这类手写防抖
// 历史上不收编的理由就是规范库缺主动取消句柄；补上后同形样板不再需要各写一份。
// ★明确不收编：周期写盘的「只武装一次」闸（换成防抖会在持续变更下无限推迟落盘——那是另一种行为）。

export interface DebouncedFn<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  /** 主动取消：清掉在途计时器（不触发函数）。 */
  cancel(): void;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): DebouncedFn<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const wrapped = ((...args: any[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  }) as DebouncedFn<T>;
  wrapped.cancel = () => {
    if (t) { clearTimeout(t); t = null; }
  };
  return wrapped;
}
