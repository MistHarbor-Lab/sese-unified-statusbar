import type { MapExit, MapNode, MapNodeDoor, MapNodeRoom } from './map-tree-store';
import type { MapSceneImageRecord } from './map-scene-store';
import type { MapScenePromptInput } from './map-scene-prompts';

export interface MapSceneNodeIdentity {
  nodeId: string;
  canonicalPath: string;
  locationLabel: string;
  sourceMapHash: string;
}

const EXIT_KIND_LABEL: Record<MapExit['kind'], string> = {
  parent: '通往外层/上级区域',
  child: '通往内层/下级区域',
  sibling: '通往同级相邻区域',
};

function roomLabel(room: MapNodeRoom): string {
  const name = room.name?.trim();
  if (name) return name;
  switch (room.type) {
    case 'corridor': return '通道';
    case 'landmark': return '地标';
    default: return '房间';
  }
}

function compassFromCenter(centerX: number, centerY: number, cx: number, cy: number): string {
  const dx = cx - centerX;
  const dy = cy - centerY;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return '中部';
  const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  const sectors = ['东侧', '东南侧', '南侧', '西南侧', '西侧', '西北侧', '北侧', '东北侧'];
  return sectors[Math.round(deg / 45) % 8];
}

function sizeLabel(area: number, maxArea: number): string {
  if (maxArea <= 0) return '中等';
  const ratio = area / maxArea;
  if (ratio >= 0.6) return '宽敞';
  if (ratio <= 0.3) return '狭小';
  return '中等';
}

function resolveCenter(rooms: MapNodeRoom[], mapSize: { width: number; height: number }): { cx: number; cy: number } {
  if (mapSize.width > 0 && mapSize.height > 0) {
    return { cx: mapSize.width / 2, cy: mapSize.height / 2 };
  }
  if (rooms.length === 0) return { cx: 0, cy: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function buildSpatialFeatures(
  rooms: MapNodeRoom[],
  exits: MapExit[],
  doors: MapNodeDoor[],
  mapSize: { width: number; height: number },
): string[] {
  const { cx, cy } = resolveCenter(rooms, mapSize);
  const maxArea = rooms.reduce((max, r) => Math.max(max, r.width * r.height), 0);
  const roomById = new Map<string, MapNodeRoom>();
  for (const room of rooms) roomById.set(room.id, room);
  const features: string[] = [];
  for (const room of rooms.slice(0, 100)) {
    const rx = room.x + room.width / 2;
    const ry = room.y + room.height / 2;
    features.push(`${roomLabel(room)} (${sizeLabel(room.width * room.height, maxArea)}, ${compassFromCenter(cx, cy, rx, ry)})`);
  }
  for (const door of doors.slice(0, 50)) {
    const fromRoom = door.from ? roomById.get(door.from) : undefined;
    const toRoom = door.to ? roomById.get(door.to) : undefined;
    if (!fromRoom && !toRoom) continue;
    features.push(`门: ${fromRoom ? roomLabel(fromRoom) : '?'} ↔ ${toRoom ? roomLabel(toRoom) : '?'}`);
  }
  for (const exit of exits.slice(0, 50)) {
    const compass = compassFromCenter(cx, cy, exit.x, exit.y);
    features.push(`${exit.label || '出口'} (${EXIT_KIND_LABEL[exit.kind] || '通往其他区域'}, ${compass})`);
  }
  return features;
}

/** 将 SVG 地图节点压缩成场景图需要的环境资料；刻意不读取 structure.characters。 */
export function buildMapSceneInputFromNode(
  node: MapNode,
  identity: MapSceneNodeIdentity,
  extraPrompt?: string,
): MapScenePromptInput {
  const structure = node.structure;
  const rooms = Array.isArray(structure?.rooms) ? structure.rooms : [];
  const exits = Array.isArray(structure?.exits) ? structure.exits : [];
  const doors = Array.isArray(structure?.doors) ? structure.doors : [];
  const mapSize = structure?.mapSize || { width: 0, height: 0 };
  const mapFeatures = buildSpatialFeatures(rooms, exits, doors, mapSize);
  const desc = node.explorationDesc || { summary: '', items: [], directions: '' };
  return {
    nodeId: identity.nodeId,
    canonicalPath: identity.canonicalPath,
    locationLabel: identity.locationLabel,
    sourceMapHash: identity.sourceMapHash,
    summary: desc.summary || '',
    items: Array.isArray(desc.items) ? desc.items.slice(0, 100) : [],
    directions: desc.directions || '',
    mapFeatures,
    extraPrompt,
  };
}

/** 自动补图只发生在本次成功生成 SVG 的新节点上，避免打开旧地图时静默补图烧 API。 */
export function shouldAutoGenerateMapSceneImage(record: MapSceneImageRecord | null): boolean {
  return record === null;
}
