// ===== 现实本地时钟（第九轮 L10）=====
// 与「游戏内日期」（全局数据表.当前时间）**彻底分开**：这里读的是玩家浏览器的本地时间。
// 服务两个消费者：
//   ① 成就引擎 real-clock 观察类型（凌晨/早八/工作日摸鱼等彩蛋）
//   ② 成就簿面板抬头问候语（按现实时段切换文案）
//
// ★ 性能与监视纪律（用户口径「成就添加不得带来过度性能与监视负担」）：
//   - 不注册任何定时器 / 监听 / 轮询；只被动等在既有扫描或面板打开时被调用。
//   - 结果按「分钟」记忆：一分钟内任意次调用只构造一次 Date；对小时级窗口语义零影响。
//   - 闰秒/时区/夏令时交给平台 Date，本模块不做任何自行换算。

export interface RealClockParts {
  /** 本地小时（0-23） */
  hour: number;
  /** 本地分钟（0-59） */
  minute: number;
  /** 本地周几，1=周一…7=周日（与 calendar-event 的 weekday 同口径） */
  weekday: number;
  /** 「HH:MM」显示串（面板进度文本用） */
  hhmm: string;
  /** 本地日期键「YYYY-MM-DD」（统计条「今日 +N」与 02 页分组用） */
  dateKey: string;
}

let _memoKey = -1;
let _memo: RealClockParts | null = null;

/** 取当前本地时钟（按分钟记忆；不产生任何副作用）。 */
export function getRealClockParts(): RealClockParts {
  const now = Date.now();
  const key = Math.floor(now / 60000);
  if (_memo && _memoKey === key) return _memo;
  const d = new Date(now);
  const jsDay = d.getDay(); // 0=Sun … 6=Sat
  const hour = d.getHours();
  const minute = d.getMinutes();
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  _memo = {
    hour,
    minute,
    weekday: jsDay === 0 ? 7 : jsDay,
    hhmm: pad(hour) + ':' + pad(minute),
    dateKey: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
  };
  _memoKey = key;
  return _memo;
}

/**
 * 整点半开区间判定：`from <= hour < to`。
 * 支持跨零点（如 23 → 5 表示 23:00 起至次日 04:59）；from === to 视为空区间恒 false。
 */
export function matchHourRange(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  if (from < to) return hour >= from && hour < to;
  return hour >= from || hour < to;
}
