// ===== 地图渲染层（纯字符串，无 DOM 依赖） =====
//
// 职责：
//   - renderLocalSVG(structure)        单阶段模式：把结构 JSON 自绘为 SVG（几何线条风）
//   - generateCharacterSvg(char,pos)   角色标记 SVG 片段（用 class 驱动配色，便于主题化）
//   - generateDefaultPositions         AI 未给坐标时的默认布局兜底
//   - applyAIPositions                  把 AI 给的坐标叠加到角色布局
//   - renderFullMapSVG(svg,positions)   在 </svg> 前拼接角色标记
//   - updateMapDisplay(container,cb)    标记点击绑定 + 防重绑 guard
//   - generateDefaultMapSVG(location)   生成/解析失败时的占位图
//
// 颜色全部用 CSS class（.character-protagonist 等），实际配色在 styles/map-base.ts + 各主题变量定义。

import { escapeHtmlAttr } from './html-escape';

// ─────────────────────────────────────────────────────────────
// 类型（与 AI 输出 JSON Schema 对应）
// ─────────────────────────────────────────────────────────────
export type MapRole = 'protagonist' | 'ally' | 'npc' | 'enemy' | 'item';
export type RoomType = 'room' | 'corridor' | 'landmark';

export interface MapRoom {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: RoomType;
  color?: string;
}

export interface MapDoor {
  from?: string;
  to?: string;
  x: number;
  y: number;
}

export interface MapExit {
  id: string;
  label: string;
  targetNodeId: string;
  kind: 'parent' | 'child' | 'sibling';
  x: number;
  y: number;
}

export interface MapCharacter {
  name: string;
  role?: MapRole;
  roomId?: string;
  x?: number;
  y?: number;
  detail?: string;
}

export interface MapStructure {
  title?: string;
  mapSize?: { width: number; height: number };
  rooms?: MapRoom[];
  doors?: MapDoor[];
  exits?: MapExit[];
  characters?: MapCharacter[];
  /** 缓存时附带的元数据（不发给 AI） */
  storyHash?: string;
  updatedAt?: number;
  /** 大类（地点第一个 - 之前的部分，如"A小区"），用于缓存列表分组 */
  region?: string;
}

export interface CharacterPosition {
  name: string;
  role: MapRole;
  x: number;
  y: number;
  detail?: string;
}

// 默认坐标系（AI 约定）
export const DEFAULT_MAP_SIZE = { width: 800, height: 600 };

// ─────────────────────────────────────────────────────────────
// 工具：XML 文本转义（U2：统一出口 core/html-escape.ts；&#39; 与 &apos; 在 XML/SVG 等价）
// ─────────────────────────────────────────────────────────────
function escapeXml(s: string): string {
  return escapeHtmlAttr(s);
}

// 取角色首字（用于标记内文字）
function firstChar(name: string): string {
  const n = (name || '').trim();
  return n ? n.charAt(0) : '?';
}

// ─────────────────────────────────────────────────────────────
// 单阶段本地渲染：结构 JSON → SVG
// ─────────────────────────────────────────────────────────────
export function renderLocalSVG(structure: MapStructure): string {
  const size = structure.mapSize && structure.mapSize.width && structure.mapSize.height
    ? structure.mapSize
    : DEFAULT_MAP_SIZE;
  const W = size.width;
  const H = size.height;
  const title = structure.title || '';

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="map-svg" preserveAspectRatio="xMidYMid meet">`;
  // 背景（颜色由 --map-bg 驱动）
  svg += `<rect x="0" y="0" width="${W}" height="${H}" class="map-bg-rect"/>`;
  // 边框
  svg += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" class="map-frame-rect" rx="10"/>`;

  if (title) {
    svg += `<text x="${W / 2}" y="30" text-anchor="middle" class="map-title-text">${escapeXml(title)}</text>`;
  }

  // 房间
  const rooms = Array.isArray(structure.rooms) ? structure.rooms : [];
  for (const room of rooms) {
    if (room == null) continue;
    const x = Number(room.x) || 0;
    const y = Number(room.y) || 0;
    const w = Math.max(0, Number(room.width) || 0);
    const h = Math.max(0, Number(room.height) || 0);
    const type = room.type === 'corridor' ? 'corridor' : room.type === 'landmark' ? 'landmark' : 'room';
    const cls = `map-room map-room-${type}`;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${cls}"`;
    if (room.color) svg += ` fill="${escapeXml(room.color)}"`;
    svg += `/>`;
    // 房间名
    if (room.name) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" class="map-room-label">${escapeXml(room.name)}</text>`;
    }
  }

  // 门
  const doors = Array.isArray(structure.doors) ? structure.doors : [];
  for (const door of doors) {
    if (door == null) continue;
    const x = Number(door.x) || 0;
    const y = Number(door.y) || 0;
    // 用白色短线打断墙体
    svg += `<line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}" class="map-door-line"/>`;
  }

  svg += `</svg>`;
  return svg;
}

// ─────────────────────────────────────────────────────────────
// 角色标记 SVG 片段（用 class 驱动配色）
// ─────────────────────────────────────────────────────────────
export function generateCharacterSvg(pos: CharacterPosition): string {
  const { name, role, x, y, detail } = pos;
  const roleClass = `character-marker character-${role || 'npc'}`;
  const id = 'map-char-' + String(name).replace(/\s/g, '_').replace(/[^\w一-鿿-]/g, '');
  // 透明大命中圆 + 可见小圆 + 首字标签
  let g = `<g id="${escapeXml(id)}" class="${roleClass}" data-name="${escapeXml(name)}" data-role="${escapeXml(role || 'npc')}" data-detail="${escapeXml(detail || '')}" transform="translate(${x},${y})" style="cursor:pointer">`;
  // SVG 原生 <title>：hover 时浏览器显示为 tooltip，展示人物当前行为（detail 含身份简述+当前行为）
  // 无论数据库中有无该人物信息均可展示（detail 由 AI 在地图生成时填写）
  const tooltipText = detail ? `${name}：${detail}` : name;
  g += `<title>${escapeXml(tooltipText)}</title>`;
  // 透明命中区（半径 16，便于点击）
  g += `<circle cx="0" cy="0" r="16" fill="transparent"/>`;
  // 可见标记圆
  g += `<circle cx="0" cy="0" r="11" class="character-marker-circle"/>`;
  // 首字
  g += `<text x="0" y="4" text-anchor="middle" class="character-marker-text">${escapeXml(firstChar(name))}</text>`;
  // 名字（下方）
  g += `<text x="0" y="28" text-anchor="middle" class="character-marker-name">${escapeXml(name)}</text>`;
  g += `</g>`;
  return g;
}

// ─────────────────────────────────────────────────────────────
// 默认角色布局（AI 未给坐标时兜底）
// ─────────────────────────────────────────────────────────────
export function generateDefaultPositions(
  characters: { name: string; role?: MapRole; detail?: string }[],
  mapSize: { width: number; height: number } = DEFAULT_MAP_SIZE,
): CharacterPosition[] {
  const W = mapSize.width || DEFAULT_MAP_SIZE.width;
  const H = mapSize.height || DEFAULT_MAP_SIZE.height;
  const positions: CharacterPosition[] = [];
  let allyIdx = 0;
  let enemyIdx = 0;
  let itemIdx = 0;

  for (const c of characters) {
    const role: MapRole = c.role || 'npc';
    if (role === 'protagonist') {
      positions.push({ name: c.name, role, x: Math.round(W * 0.3), y: Math.round(H * 0.5), detail: c.detail });
    } else if (role === 'enemy') {
      positions.push({
        name: c.name, role,
        x: Math.round(W * 0.72 + (enemyIdx % 2) * 60),
        y: Math.round(H * 0.35 + Math.floor(enemyIdx / 2) * 70),
        detail: c.detail,
      });
      enemyIdx++;
    } else if (role === 'item') {
      positions.push({
        name: c.name, role,
        x: Math.round(40 + (itemIdx % 8) * 70),
        y: Math.round(H - 40 - Math.floor(itemIdx / 8) * 30),
        detail: c.detail,
      });
      itemIdx++;
    } else {
      // ally / npc：在主角右侧环绕
      positions.push({
        name: c.name, role,
        x: Math.round(W * 0.3 + 80 + (allyIdx % 3) * 60),
        y: Math.round(H * 0.5 - 80 + Math.floor(allyIdx / 3) * 70),
        detail: c.detail,
      });
      allyIdx++;
    }
  }
  return positions;
}

// ─────────────────────────────────────────────────────────────
// 应用 AI 给的坐标（按 name 匹配；匹配不到的保留默认）
// roomId 锚定：AI 给 roomId 时，优先用房间中心算坐标；AI 同时给 x/y 则覆盖
// ─────────────────────────────────────────────────────────────
export function applyAIPositions(
  characters: { name: string; role?: MapRole; detail?: string }[],
  aiCharacters: MapCharacter[] | null | undefined,
  mapSize: { width: number; height: number } = DEFAULT_MAP_SIZE,
  rooms?: MapRoom[],
): CharacterPosition[] {
  const positions = generateDefaultPositions(characters, mapSize);
  if (!aiCharacters || !Array.isArray(aiCharacters)) return positions;
  const norm = (s: string) => String(s || '').trim();
  // roomId → 房间中心坐标查找表
  const roomCenters = new Map<string, { x: number; y: number }>();
  if (rooms && Array.isArray(rooms)) {
    for (const r of rooms) {
      if (r.id) {
        roomCenters.set(norm(r.id), {
          x: Math.round((r.x || 0) + (r.width || 0) / 2),
          y: Math.round((r.y || 0) + (r.height || 0) / 2),
        });
      }
    }
  }
  for (const pos of positions) {
    const match = aiCharacters.find(a => norm(a.name) === norm(pos.name));
    if (!match) continue;
    // roomId 锚定优先：先用房间中心
    if (match.roomId && roomCenters.has(norm(match.roomId))) {
      const center = roomCenters.get(norm(match.roomId))!;
      pos.x = center.x;
      pos.y = center.y;
    }
    // AI 给了明确 x/y 则覆盖（微调用）
    if (typeof match.x === 'number' && typeof match.y === 'number') {
      pos.x = match.x;
      pos.y = match.y;
    }
    // AI detail（身份简述+当前行为）优先于数据库近况，用于 hover tooltip 展示人物当前行为
    if (match.detail) pos.detail = match.detail;
  }
  // 把 AI 输出但不在数据库中的角色也加入 positions（如临场 NPC/路人）
  const posNames = new Set(positions.map(p => norm(p.name)));
  if (aiCharacters && Array.isArray(aiCharacters)) {
    for (const ai of aiCharacters) {
      const n = norm(ai.name);
      if (!n || posNames.has(n)) continue;
      posNames.add(n);
      // AI 未给 role 的默认 npc；AI 给了 x/y 则用，否则用默认布局
      const role: MapRole = (ai.role as MapRole) || 'npc';
      let x = typeof ai.x === 'number' ? ai.x : Math.round((mapSize.width || 800) * 0.5);
      let y = typeof ai.y === 'number' ? ai.y : Math.round((mapSize.height || 600) * 0.5);
      // roomId 锚定优先
      if (ai.roomId && roomCenters.has(norm(ai.roomId))) {
        const center = roomCenters.get(norm(ai.roomId))!;
        x = center.x; y = center.y;
      }
      positions.push({ name: ai.name, role, x, y, detail: ai.detail });
    }
  }
  return positions;
}

// ─────────────────────────────────────────────────────────────
// 在 SVG 的 </svg> 前拼接角色标记 + 出口热点
// ─────────────────────────────────────────────────────────────
function exitIcon(kind: MapExit['kind']): string {
  // parent 上级↑ / child 下级↓ / sibling 同级↔
  return kind === 'parent' ? '↑' : kind === 'sibling' ? '↔' : '↓';
}

function generateExitSvg(exit: MapExit, mapSize?: { width: number; height: number }): string {
  const W = mapSize?.width || 800, H = mapSize?.height || 600, r = 18, pad = 6;
  // 钳制坐标到 viewBox 安全边距内，避免圆形/标签被 .map-container overflow:hidden 裁切
  const x = Math.max(r + pad, Math.min(W - r - pad, exit.x));
  const y = Math.max(r + pad, Math.min(H - r - pad, exit.y));
  const labelY = y < 30 ? y + r + 14 : y - r - 6;
  return `<g class="map-exit-marker" data-exit-id="${escapeXml(exit.id)}" data-target-node="${escapeXml(exit.targetNodeId)}" data-exit-kind="${escapeXml(exit.kind)}" style="cursor:pointer">
    <circle cx="${x}" cy="${y}" r="${r}" class="map-exit-circle" />
    <text x="${x}" y="${y + 4}" text-anchor="middle" class="map-exit-icon">${exitIcon(exit.kind)}</text>
    <text x="${x}" y="${labelY}" text-anchor="middle" class="map-exit-label">${escapeXml(exit.label)}</text>
  </g>`;
}

export function renderFullMapSVG(svg: string, positions: CharacterPosition[], exits?: MapExit[], mapSize?: { width: number; height: number }): string {
  const markers = positions.map(generateCharacterSvg).join('');
  const exitMarkers = (exits && exits.length > 0) ? exits.map(e => generateExitSvg(e, mapSize)).join('') : '';
  const overlays = markers + exitMarkers;
  if (svg.includes('</svg>')) {
    return svg.replace('</svg>', overlays + '</svg>');
  }
  // 兜底：SVG 末尾无闭合标签时直接追加
  return svg + overlays + '</svg>';
}

// ─────────────────────────────────────────────────────────────
// SVG id 命名空间隔离：给 <svg> 内的 id 与 url(#…) / href="#…" 引用加前缀
//
// 用途：地图库预览的 SVG 与主地图 SVG 同时在 DOM 中，AI 生成的 <defs> 渐变/图案/滤镜
//   id 若与主地图相同，库预览的 fill="url(#bg)" 会解析到首个同名 def（主地图的），
//   导致库预览背景/渐变填充缺失、只剩实心填充元素。前缀化后库预览 def 自引用、与主地图隔离。
// 注意：id 正则要求前面是空白或起始，避免误伤 data-exit-id 之类属性值；
//   exit 热点用 data-exit-id/data-target-node（非 id、非 url），不受影响。
// ─────────────────────────────────────────────────────────────
export function namespaceSvgIds(svg: string, prefix: string): string {
  if (!svg || !prefix) return svg;
  // 1) standalone id="x" / id='x'（前面须空白或起始，排除 data-exit-id 等）
  let out = svg.replace(/(^|\s)(id\s*=\s*)(["'])([^"']*)\3/g,
    (_m, ws: string, pre: string, q: string, id: string) => `${ws}${pre}${q}${prefix}${id}${q}`);
  // 2) href="#x" / xlink:href="#x" 引用（双/单引号）
  out = out.replace(/(^|\s)((?:xlink:href|href)\s*=\s*)(["'])#([^"']*)\3/g,
    (_m, ws: string, pre: string, q: string, id: string) => `${ws}${pre}${q}#${prefix}${id}${q}`);
  // 3) url(#x) 引用（渐变/图案/滤镜，可出现在 fill/stroke/style/<style> 内）
  out = out.replace(/(url\(\s*#)([^)\s]+)(\s*\))/g,
    (_m, pre: string, id: string, post: string) => `${pre}${prefix}${id}${post}`);
  return out;
}

// ─────────────────────────────────────────────────────────────
// 大地图渲染（期4）：AI 俯瞰图 + 子地点 markers 叠加
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 占位图（生成/解析失败时）
// ─────────────────────────────────────────────────────────────
export function generateDefaultMapSVG(location: string): string {
  return `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="map-svg map-default" preserveAspectRatio="xMidYMid meet">
  <rect x="0" y="0" width="800" height="600" class="map-bg-rect"/>
  <rect x="8" y="8" width="784" height="584" class="map-frame-rect" rx="10"/>
  <text x="400" y="40" text-anchor="middle" class="map-title-text">${escapeXml(location || '未知地点')}</text>
  <text x="400" y="300" text-anchor="middle" class="map-empty-text">暂无地图数据</text>
</svg>`;
}

/** 生成中占位图：已在调用 AI 但尚未返回结果时显示，区别于"无数据"占位 */
export function generatingMapSVG(location: string): string {
  return `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="map-svg map-generating" preserveAspectRatio="xMidYMid meet">
  <rect x="0" y="0" width="800" height="600" class="map-bg-rect"/>
  <rect x="8" y="8" width="784" height="584" class="map-frame-rect" rx="10"/>
  <text x="400" y="40" text-anchor="middle" class="map-title-text">${escapeXml(location || '未知地点')}</text>
  <text x="400" y="300" text-anchor="middle" class="map-empty-text">地图生成中...</text>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// 标记点击绑定（防重绑 guard）
// container 为 #mapContainer；onClick(name, role, detail) 由调用方提供（打开弹窗）
// ─────────────────────────────────────────────────────────────
export function updateMapDisplay(
  container: HTMLElement,
  onClick: (name: string, role: MapRole, detail?: string) => void,
): void {
  if (!container) return;
  const markers = container.querySelectorAll<SVGElement>('.character-marker');
  markers.forEach(marker => {
    // 防重绑：已绑定则跳过
    if ((marker as any)._mapClickBound) return;
    (marker as any)._mapClickBound = true;
    marker.addEventListener('click', function (e) {
      e.stopPropagation();
      const name = marker.getAttribute('data-name') || '';
      const role = (marker.getAttribute('data-role') || 'npc') as MapRole;
      const detail = marker.getAttribute('data-detail') || undefined;
      onClick(name, role, detail);
    });
  });
}