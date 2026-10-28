// ===== 地图地点消歧：解析、默认策略与系统决策队列接入 =====

import { getCurrentStoryChatKey } from './story-floor-store';
import { enqueueSystemDecision, SYSTEM_DECISION_PRIORITY } from './system-decision-queue';
import { applyLocationChoice, applyAnchorChoice } from './map-location-identity';
import { resolveMapLocation, type LocationCandidate } from './map-location-resolver';
import {
  deriveFullPathFromIndex,
  ensureChainInIndex,
  parseLocationHierarchy,
  readTreeIndex,
  writeTreeIndex,
  type MapTreeIndex,
} from './map-tree-store';
import type { SystemDecisionView } from '../renderers/system-decision-popup';
import { escapeHtmlAttr as escapeHtml } from './html-escape';

export type MapLocationConflictStrategy = 'always-ask' | 'prefer-existing' | 'prefer-current';

export type MapLocationReady = {
  status: 'ready';
  index: MapTreeIndex;
  nodeId: string;
  canonicalPath: string;
  /** 非空表示本次 ready 由锚点自动匹配产生，调用方应 toast 提示 */
  autoMergeNote?: string;
};

export type MapLocationPending = { status: 'pending' };

interface LocationDecisionChoice {
  action: 'retain-existing' | 'adopt-current' | 'create-new' | 'anchor-attach' | 'anchor-absorb' | 'anchor-retain';
  nodeId?: string;
  rebasedPath?: string;
  anchorK?: number;
}

function anchorActionFor(c: LocationCandidate): 'anchor-attach' | 'anchor-absorb' | 'anchor-retain' {
  return c.anchorType === 'deeper' ? 'anchor-attach' : c.anchorType === 'shallower' ? 'anchor-absorb' : 'anchor-retain';
}

function buildAnchorNote(c: LocationCandidate, rawPath: string, canonicalPath: string): string {
  if (c.anchorType === 'deeper') return `已将「${rawPath}」挂到「${c.fullPath}」之下（按名匹配同名节点）`;
  if (c.anchorType === 'shallower') return `已将「${c.fullPath}」并入「${canonicalPath}」之下（按名匹配同名节点）`;
  return `已将「${rawPath}」认作已有节点「${c.fullPath}」（按名匹配同名节点）`;
}

async function createCanonicalPath(rawPath: string): Promise<{ ok: boolean; nodeId?: string; error?: string }> {
  const index = await readTreeIndex();
  const segments = parseLocationHierarchy(rawPath).segments;
  if (segments.length === 0) return { ok: false, error: '当前地点为空，无法创建节点' };
  const ensured = ensureChainInIndex(index, segments);
  if (!ensured.leafNodeId) return { ok: false, error: '无法建立地点节点' };
  if (ensured.changed && !(await writeTreeIndex(ensured.index))) {
    return { ok: false, error: '地点节点写回失败' };
  }
  return { ok: true, nodeId: ensured.leafNodeId };
}

async function executeChoice(rawPath: string, choice: LocationDecisionChoice): Promise<{ ok: boolean; error?: string }> {
  if (choice.action === 'create-new') return createCanonicalPath(rawPath);
  if (choice.action === 'retain-existing' || choice.action === 'adopt-current') {
    if (!choice.nodeId) return { ok: false, error: '请选择要保留的候选节点' };
    const result = await applyLocationChoice(choice.action, rawPath, choice.nodeId);
    return result.ok ? { ok: true } : { ok: false, error: result.error || '地点映射写回失败' };
  }
  if (choice.action === 'anchor-attach' || choice.action === 'anchor-absorb' || choice.action === 'anchor-retain') {
    if (!choice.nodeId) return { ok: false, error: '请选择要保留的候选节点' };
    const result = await applyAnchorChoice(choice.action, rawPath, { nodeId: choice.nodeId, rebasedPath: choice.rebasedPath, anchorK: choice.anchorK });
    return result.ok ? { ok: true } : { ok: false, error: result.error || '锚点匹配写回失败' };
  }
  return { ok: false, error: '未知操作' };
}

function buildDecisionView(rawPath: string, candidates: LocationCandidate[]): SystemDecisionView {
  const rows = candidates.map((candidate, index) => {
    const reason = candidate.reason === 'chain-anchor'
      ? (candidate.anchorType === 'deeper' ? '同名非叶·更深' : candidate.anchorType === 'shallower' ? '同名非叶·更浅' : '单段同名')
      : candidate.reason === 'missing-parent-levels' ? '层级缺失匹配' : '同父节点名称包含匹配';
    const opHint = candidate.reason === 'chain-anchor' ? ' · 点「执行锚点匹配」' : ' · 保留旧路径 / 采用当前名称';
    return `
    <label class="map-location-candidate">
      <input type="radio" name="mapLocationCandidate" value="${index}"${index === 0 ? ' checked' : ''}>
      <span><b>${escapeHtml(candidate.fullPath)}</b><small>${reason}${opHint}</small></span>
    </label>`;
  }).join('');
  return {
    title: '确认地图地点归属',
    dismissible: true,
    bodyHtml: `
      <div class="map-location-current">数据库当前地点：<b>${escapeHtml(rawPath)}</b></div>
      <div class="map-location-help">检测到可能指向同一地点的旧节点。选择候选后点对应操作；或创建新节点。</div>
      <div class="map-location-candidates">${rows}</div>
      <div class="map-location-actions">
        <button type="button" data-map-location-action="retain-existing">保留旧节点</button>
        <button type="button" data-map-location-action="adopt-current">采用当前名称</button>
        <button type="button" data-map-location-action="execute-anchor">执行锚点匹配</button>
        <button type="button" data-map-location-action="create-new">创建新节点</button>
      </div>`,
    bind: host => {
      host.body.querySelectorAll<HTMLElement>('[data-map-location-action]').forEach(button => {
        button.addEventListener('click', () => {
          const action = button.dataset.mapLocationAction as string;
          if (action === 'create-new') { void host.submit({ action: 'create-new' } satisfies LocationDecisionChoice); return; }
          const selected = host.body.querySelector<HTMLInputElement>('input[name="mapLocationCandidate"]:checked');
          if (!selected) { host.setError('请先选择一个候选节点'); return; }
          const candidate = candidates[Number(selected.value)];
          if (!candidate) { host.setError('候选无效'); return; }
          if (action === 'execute-anchor') {
            if (candidate.reason !== 'chain-anchor') { host.setError('所选候选不是锚点类型'); return; }
            void host.submit({
              action: anchorActionFor(candidate),
              nodeId: candidate.nodeId,
              rebasedPath: candidate.rebasedPath,
              anchorK: candidate.anchorK,
            } satisfies LocationDecisionChoice);
            return;
          }
          if (candidate.reason === 'chain-anchor') { host.setError('锚点候选请点「执行锚点匹配」'); return; }
          void host.submit({ action: action as 'retain-existing' | 'adopt-current', nodeId: candidate.nodeId } satisfies LocationDecisionChoice);
        });
      });
    },
  };
}

function enqueueLocationDecision(
  rawPath: string,
  candidates: LocationCandidate[],
  isCurrent: () => boolean,
  onResolved: () => void,
): void {
  // 无候选的归属决策无法被任何按钮有意义地解决（选项依赖候选，create-new 也会写失败），
  // 只会在弹窗里显示空列表 + 全部按钮失效。禁止入队，由调用方等待下次刷新重试。
  if (!candidates || candidates.length === 0) return;
  const contextKey = getCurrentStoryChatKey();
  enqueueSystemDecision<SystemDecisionView, LocationDecisionChoice>({
    key: `map-location:${contextKey}:${rawPath}`,
    contextKey,
    priority: SYSTEM_DECISION_PRIORITY.mapLocation,
    payload: buildDecisionView(rawPath, candidates),
    isValid: () => getCurrentStoryChatKey() === contextKey && isCurrent(),
    resolve: async choice => {
      if (getCurrentStoryChatKey() !== contextKey || !isCurrent()) return { ok: false, stale: true, error: '当前地点已经变化' };
      const result = await executeChoice(rawPath, choice);
      if (!result.ok) return result;
      queueMicrotask(onResolved);
      return { ok: true };
    },
    merge: (current, incoming) => { current.payload = incoming.payload; },
  });
}

export async function resolveMapLocationForRefresh(
  rawPath: string,
  strategy: MapLocationConflictStrategy,
  isCurrent: () => boolean,
  onResolved: () => void,
): Promise<MapLocationReady | MapLocationPending> {
  let index = await readTreeIndex();
  const resolution = resolveMapLocation(index, rawPath);

  if (resolution.kind === 'exact') {
    return {
      status: 'ready',
      index,
      nodeId: resolution.nodeId,
      canonicalPath: deriveFullPathFromIndex(index, resolution.nodeId) || resolution.normalizedPath,
    };
  }

  if (resolution.kind === 'new') {
    const created = await createCanonicalPath(rawPath);
    if (!created.ok || !created.nodeId) {
      // 无候选可弹：new 地点本应静默自动建节点。写失败（存储过渡窗口 / 聊天无 AI 楼层）时
      // 不得入队空候选决策——否则弹出「确认地图地点归属」死弹窗：无候选、四个按钮全因
      // 「请先选择候选节点」或写失败而看似失效，只能点右上角 ✕ 退出。返回 pending 等下次
      // 刷新（存储就绪 / 剧情推进后）重试，届时自动建节点即可。
      return { status: 'pending' };
    }
    index = await readTreeIndex();
    return {
      status: 'ready',
      index,
      nodeId: created.nodeId,
      canonicalPath: deriveFullPathFromIndex(index, created.nodeId) || resolution.normalizedPath,
    };
  }

  if (resolution.kind === 'candidates') {
    const candidates = resolution.candidates;
    const anchors = candidates.filter(c => c.reason === 'chain-anchor');
    const fuzzy = candidates.filter(c => c.reason !== 'chain-anchor');

    // 单锚点候选（无 fuzzy）→ 自动执行，绕过 always-ask（D4）。shallower 冲突升级弹窗（D2）。
    if (anchors.length === 1 && fuzzy.length === 0) {
      const ac = anchors[0];
      const applied = await applyAnchorChoice(anchorActionFor(ac), rawPath, {
        nodeId: ac.nodeId, rebasedPath: ac.rebasedPath, anchorK: ac.anchorK,
      });
      if (applied.ok && applied.canonicalNodeId) {
        index = await readTreeIndex();
        const canonicalPath = deriveFullPathFromIndex(index, applied.canonicalNodeId) || resolution.normalizedPath;
        return {
          status: 'ready', index, nodeId: applied.canonicalNodeId, canonicalPath,
          autoMergeNote: buildAnchorNote(ac, rawPath, canonicalPath),
        };
      }
      // 冲突或失败 → 升级弹窗
      enqueueLocationDecision(rawPath, candidates, isCurrent, onResolved);
      return { status: 'pending' };
    }

    // 单 fuzzy 候选（无锚点）→ 现有策略行为不变（prefer-existing/prefer-current 自动；always-ask 弹窗）
    if (anchors.length === 0 && fuzzy.length === 1 && strategy !== 'always-ask') {
      const candidate = fuzzy[0];
      const action = strategy === 'prefer-existing' ? 'retain-existing' : 'adopt-current';
      const applied = await applyLocationChoice(action, rawPath, candidate.nodeId);
      if (applied.ok) {
        index = await readTreeIndex();
        const re = resolveMapLocation(index, rawPath);
        if (re.kind === 'exact') {
          return {
            status: 'ready', index, nodeId: re.nodeId,
            canonicalPath: deriveFullPathFromIndex(index, re.nodeId) || resolution.normalizedPath,
          };
        }
      }
    }

    // ≥2 候选 / always-ask 单 fuzzy / 自动失败 → 弹窗
    enqueueLocationDecision(rawPath, candidates, isCurrent, onResolved);
    return { status: 'pending' };
  }

  return { status: 'pending' };
}
