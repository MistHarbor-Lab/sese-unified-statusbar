// ===== 纪要表只读行（跨功能共用） =====
//
// 从 chronicle-merge-engine 抽出：备忘录 AI 规划、人物世界书等只读纪要的功能也要用它。
// 状态栏合并功能后续移除时，本模块必须保留（否则这些无关功能会被一起打断）。
//
// 读取必须走 queryLogicalTableRows 兼容层：数据库插件在表映射缺失时会把「纪要表」误改成
// 「chronicle_text表」。不写死物理名（chronicle/拼音均禁），交兼容层按逻辑名解析。
// null = 读取失败；[] = 真实空表。

import { queryLogicalTableRows } from './data-manager';

/** 纪要表一行（与 chronicle 表 6 列对应）。row_id 为数字；其余为字符串。 */
export interface ChronicleRow {
  row_id: number;
  code_index: string; // 'AMxxxx'
  time_span: string; // '{start} ~ {end}'
  summary: string;
  chronicle_text: string;
  key_dialogue: string; // 可空字符串
}

export function readChronicleRows(): ChronicleRow[] | null {
  // 请求中文列名（台账口径；真数据库后端返回的物理列名由 data-manager 按请求顺序归一）
  const rawRows = queryLogicalTableRows({
    tableName: '纪要表',
    columns: ['row_id', '编码索引', '时间跨度', '概览', '纪要', '重要对话'],
    orderBy: { column: 'row_id', direction: 'ASC' },
  });
  if (rawRows === null) return null;
  return rawRows.map((r: any) => ({
    row_id: Number(r.row_id),
    code_index: String(r['编码索引'] ?? ''),
    time_span: String(r['时间跨度'] ?? ''),
    summary: String(r['概览'] ?? ''),
    chronicle_text: String(r['纪要'] ?? ''),
    key_dialogue: String(r['重要对话'] ?? ''),
  }));
}
