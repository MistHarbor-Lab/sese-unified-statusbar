// ===== 衣柜服饰目录（items + outfits）全局共享存储 =====
// 与仓库/成就/设置同级：usb_g_wardrobe_catalog_* snapshot+segment 协议，跨聊天/设备同步。
// 穿搭档案(actorProfiles)不在此域——见 wardrobe-store 双源合成。
import { cloneJson } from './external-storage-codec';
import type { ExternalObjectStore } from './external-object-store';
import type { OutfitPreset, WardrobeItem } from './wardrobe-types';

export interface WardrobeCatalog {
  items: WardrobeItem[];
  outfits: OutfitPreset[];
  /** 套装展示图模特性别；未指定写入时保留已存值。 */
  modelGender?: 'female' | 'male';
}

let _store: ExternalObjectStore | null = null;
let _catalog: WardrobeCatalog | null = null;
let _writeChain: Promise<unknown> = Promise.resolve();

export function configureWardrobeCatalogStorage(store: ExternalObjectStore | null): void {
  _store = store;
  _catalog = null;
  _writeChain = Promise.resolve();
}

export function readWardrobeCatalog(): WardrobeCatalog {
  if (_catalog) return _catalog;
  const raw = _store?.readAll() || {};
  _catalog = {
    items: Array.isArray(raw.items) ? cloneJson(raw.items as WardrobeItem[]) : [],
    outfits: Array.isArray(raw.outfits) ? cloneJson(raw.outfits as OutfitPreset[]) : [],
    modelGender: raw.modelGender === 'male' ? 'male' : 'female',
  };
  return _catalog;
}

export function writeWardrobeCatalog(
  items: WardrobeItem[],
  outfits: OutfitPreset[],
  modelGender?: 'female' | 'male',
): Promise<boolean> {
  const store = _store;
  const current = _catalog || readWardrobeCatalog();
  const next: WardrobeCatalog = {
    items: cloneJson(items),
    outfits: cloneJson(outfits),
    modelGender: modelGender === 'male' || modelGender === 'female'
      ? modelGender
      : (current.modelGender === 'male' ? 'male' : 'female'),
  };
  if (!store) return Promise.resolve(false);
  const run = async (): Promise<boolean> => {
    const ok = await store.patch(next as unknown as Record<string, unknown>);
    if (ok) _catalog = cloneJson(next);
    return ok;
  };
  const result = _writeChain.then(run, run);
  _writeChain = result.then(() => undefined, () => undefined);
  return result;
}

export async function flushWardrobeCatalog(): Promise<void> {
  await _writeChain;
  await _store?.flush();
}

export function getWardrobeCatalogStatus() { return _store?.status() || null; }
