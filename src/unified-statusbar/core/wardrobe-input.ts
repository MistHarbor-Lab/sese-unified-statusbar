// ===== 给在场 NPC 穿戴：只追加酒馆输入框，不自动发送 =====
import {
  WARDROBE_DISPLAY_ORDER,
  type WardrobeResolvedItem,
} from './wardrobe-types';

export interface WardrobeInputDeps {
  getTextarea(): any | null;
  setNativeValue(textarea: any, value: string): void;
  createInputEvent(): any;
}

export type WardrobeInputResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function orderedItems(items: readonly WardrobeResolvedItem[]): WardrobeResolvedItem[] {
  const order = new Map(WARDROBE_DISPLAY_ORDER.map((category, index) => [category, index]));
  return items.slice().sort((left, right) =>
    (order.get(left.category) ?? 999) - (order.get(right.category) ?? 999));
}

export function buildNpcDressInstruction(
  npc: string,
  items: readonly WardrobeResolvedItem[],
): string {
  const name = String(npc || '').trim();
  const clothing = orderedItems(items)
    .map(item => `${String(item.name || '').trim()}（${String(item.description || '').trim()}）`)
    .filter(value => value !== '（）');
  if (!name || clothing.length === 0) return '';
  return `让${name}穿上${clothing.join('、')}`;
}

function runtimeDeps(): WardrobeInputDeps {
  return {
    getTextarea(): any | null {
      try {
        const parentDocument = (window.parent as any).document;
        return parentDocument?.getElementById('send_textarea') || null;
      } catch (_e) {
        return typeof document !== 'undefined' ? document.getElementById('send_textarea') : null;
      }
    },
    setNativeValue(textarea: any, value: string): void {
      const view = textarea?.ownerDocument?.defaultView || (window.parent as any) || window;
      const prototype = view?.HTMLTextAreaElement?.prototype;
      const setter = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (!setter) throw new Error('无法访问 textarea 原生 value setter');
      setter.call(textarea, value);
    },
    createInputEvent(): Event {
      let EventCtor: typeof Event = Event;
      try {
        EventCtor = (window.parent as any).Event || window.Event;
      } catch (_e) { /* use local */ }
      return new EventCtor('input', { bubbles: true });
    },
  };
}

export function appendNpcDressInstruction(
  npc: string,
  items: readonly WardrobeResolvedItem[],
  deps: WardrobeInputDeps = runtimeDeps(),
): WardrobeInputResult {
  const text = buildNpcDressInstruction(npc, items);
  if (!text) return { ok: false, error: '角色或服饰为空，无法生成穿戴指令' };
  const textarea = deps.getTextarea();
  if (!textarea) return { ok: false, error: '酒馆输入框不可用' };
  const current = String(textarea.value || '');
  const next = current ? `${current}\n${text}` : text;
  try {
    deps.setNativeValue(textarea, next);
    textarea.dispatchEvent(deps.createInputEvent());
    textarea.selectionStart = next.length;
    textarea.selectionEnd = next.length;
    textarea.focus();
    return { ok: true, text };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}
