// core/map-overview-sync.ts
// 把地图库所有节点链序列化写入杂表「已探索地点概览」行（SQL upsert），供全局数据表更新引用规范地名。
// 监听 map-tree-store 4 写原语（registerMapTreeChangeListener），防抖+签名幂等。地图关时早退。
//
// 依赖纪律：本模块 import map-tree-store（读索引/列节点/注册监听器），反向不 import（无环）。
import { sqlColumnName, sqlTableName } from './db-schema-map';
// config-store / data-manager / misc-table-ensure 均无反向依赖，不构成环。
import { readTreeIndex, listAllNodesForUI, registerMapTreeChangeListener, type MapTreeIndex } from './map-tree-store';
import { getAutoCardAPI, emitDbWriteCommitted, getSheetCacheChatKey } from './data-manager';
import { getConfig } from './config-store';
import { ensureMiscTable } from './misc-table-ensure';
import { debounce } from './timing';
import { isRefillMode } from './refill-mode';

const OVERVIEW_NAME = '已探索地点概览';
const OVERVIEW_HEADER = '[已探索地点树，缩进表层级，引用时请拼出完整链条如"A楼-B房间-卧室"]';

/** 纯函数：把 index 序列化为缩进树（每层 2 空格）。含所有节点（pending+generated）。
 *  listAllNodesForUI 已按 rootNodeIds → childIds DFS 序排列，depth=祖先数（根=0），直接复用。 */
export function buildOverviewTree(index: MapTreeIndex): string {
  const all = listAllNodesForUI(index);
  const lines: string[] = [OVERVIEW_HEADER];
  for (const info of all) {
    const indent = '  '.repeat(Math.max(0, info.depth));
    lines.push(`${indent}${info.name}`);
  }
  return lines.join('\n');
}

// F14：签名必须按「聊天」分槽——旧写法是模块级单值 `_lastSig`，没有聊天维度。
// 复制 / 搬家的聊天若地图序列化结果与旧聊天相同，新聊天会被判「已经写过了」而跳过 upsert
// （该聊天的「已探索地点概览」长期空缺或陈旧）。分槽键取「当前表格缓存所属聊天」
// （data-manager 既有 getter；尚无真实快照时为空串，退化为单槽，与旧行为一致）。
const _lastSigByChat = new Map<string, number>();
let _inFlight = false;
// 在飞期间到达的变更请求：旧写法 `if (_inFlight) return` 会把它彻底丢弃（要等下一次地图变动才补）。
let _pending = false;

function _scopeKey(): string {
  try { return getSheetCacheChatKey() || ''; } catch (_e) { return ''; }
}

/** 防抖+签名幂等的同步入口。地图关时早退；inFlight 时只记「待补跑」标志，不丢本次变更。 */
export async function syncMapOverviewToMiscTable(): Promise<void> {
  // 重填模式：暂停「杂表」回写（重填正在重写表格，杂表 upsert 会与之互相覆盖）。
  // 关闭后由 index.ts 恢复链补跑一次；本函数签名幂等，补跑不会重复写入。
  if (isRefillMode()) return;
  if (getConfig().mapEnabled !== true) return;
  if (_inFlight) { _pending = true; return; }
  await _doSync();
}

async function _doSync(): Promise<void> {
  if (getConfig().mapEnabled !== true) return;
  const ok = await ensureMiscTable();
  if (!ok) return; // 杂表不存在→静默跳过（由调用方在开启场景提示修复）
  const index = await readTreeIndex();
  const tree = buildOverviewTree(index);
  // 签名幂等：djb2 风格哈希，相同内容不重复写（按聊天分槽，切卡后互不影响）
  let sig = 0;
  for (let i = 0; i < tree.length; i++) sig = (sig * 31 + tree.charCodeAt(i)) | 0;
  const scope = _scopeKey();
  if (sig === _lastSigByChat.get(scope)) return;
  _inFlight = true;
  try {
    const api = getAutoCardAPI();
    if (!api || typeof (api as any).executeSqlMutation !== 'function') return;
    // 表/列名走适配器：台账后端＝杂表/名称·描述；真数据库后端＝zabiao/misc_name·misc_description
    const table = sqlTableName('杂表');
    const nameCol = sqlColumnName('杂表', '名称') ?? '名称';
    const descCol = sqlColumnName('杂表', '描述') ?? '描述';
    await (api as any).executeSqlMutation(
      `INSERT INTO ${table} (${nameCol}, ${descCol}) VALUES (?, ?)
       ON CONFLICT(${nameCol}) DO UPDATE SET ${descCol} = excluded.${descCol}`,
      [OVERVIEW_NAME, tree],
    );
    emitDbWriteCommitted?.();
    _lastSigByChat.set(scope, sig);
  } catch (_e) {
    /* ignore — 下次变更会重试 */
  } finally {
    _inFlight = false;
    // 在飞期间被推迟的那次变更在此补跑（_inFlight 已置 false，重入可正常执行）。
    if (_pending) {
      _pending = false;
      void syncMapOverviewToMiscTable();
    }
  }
}

/** 防抖包装（监听器回调用）。500ms 内多次变更合并为一次同步。 */
const _debouncedSync = debounce(() => { void syncMapOverviewToMiscTable(); }, 500);

// 模块 import 时自登记监听器（无环：本模块 import map-tree-store，反向不 import）
registerMapTreeChangeListener(_debouncedSync);