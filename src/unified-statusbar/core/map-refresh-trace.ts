// ===== 地图刷新诊断追踪（仅保留内存中的最近记录，不参与业务判定） =====

export type MapRefreshTracePhase =
  | 'enter'
  | 'lock-hit'
  | 'location-resolved'
  | 'identity-pending'
  | 'decision'
  | 'ai-start'
  | 'chat-switched-abort'
  | 'explore-log-write'
  | 'map-write'
  | 'finished'
  | 'cache-read';

export interface MapRefreshTraceRecord {
  sequence: number;
  runId: number;
  phase: MapRefreshTracePhase;
  at: number;
  stack?: string;
  [key: string]: unknown;
}

const MAX_TRACE_RECORDS = 80;
let nextRunId = 1;
let nextSequence = 1;
let records: MapRefreshTraceRecord[] = [];

function publish(): void {
  // 便于在宿主开发者工具中直接读取；不写任何故事/数据库存储。
  (globalThis as typeof globalThis & { __ubMapRefreshTrace?: MapRefreshTraceRecord[] }).__ubMapRefreshTrace = records;
}

function append(record: { runId: number; phase: MapRefreshTracePhase; stack?: string; [key: string]: unknown }): void {
  const entry: MapRefreshTraceRecord = { ...record, sequence: nextSequence++, at: Date.now() };
  records.push(entry);
  if (records.length > MAX_TRACE_RECORDS) records = records.slice(-MAX_TRACE_RECORDS);
  publish();
}

export function beginMapRefreshTrace(detail: Record<string, unknown>, stack?: string): number {
  const runId = nextRunId++;
  append({ runId, phase: 'enter', ...(stack ? { stack } : {}), ...detail });
  return runId;
}

export function recordMapRefreshTrace(
  runId: number,
  phase: Exclude<MapRefreshTracePhase, 'enter'>,
  detail: Record<string, unknown> = {},
): void {
  append({ runId, phase, ...detail });
}

export function readMapRefreshTrace(): readonly MapRefreshTraceRecord[] {
  return records.slice();
}

export function clearMapRefreshTrace(): void {
  records = [];
  nextRunId = 1;
  nextSequence = 1;
  publish();
}
