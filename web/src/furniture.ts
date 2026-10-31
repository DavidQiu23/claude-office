// Claude 辦公室 · 剖面大樓的右端家具組與後牆窗的位置。家具與窗的圖在 objects.ts（SVG symbol），這裡只管排哪幾件、怎麼擺。

import { GEO } from './floors.js';
import { OBJECTS, type FurnitureId } from './objects.js';

// ---------- 家具組（右端家具區） ----------
export interface FurnItem { id: FurnitureId }
export const SETS: { id: string; items: FurnItem[] }[] = [
  { id: 'pantry', items: [{ id: 'waterCooler' }, { id: 'vending' }, { id: 'plant' }] },
  { id: 'library', items: [{ id: 'bookshelf' }, { id: 'copier' }, { id: 'plant' }] },
  { id: 'lounge', items: [{ id: 'floorLamp' }, { id: 'sofa' }, { id: 'sideTable' }] },
  { id: 'reading', items: [{ id: 'bookshelf' }, { id: 'sideTable' }, { id: 'floorLamp' }] },
];

/** 依 roomKey 的雜湊挑一組，同 key 永遠同一組。FNV-1a 的低位元只看每個字的低位元（只差幾個字的路徑常撞同一組），所以再打散一次 */
export function furnitureSet(key: string): (typeof SETS)[number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return SETS[(h >>> 0) % SETS.length]!;
}

const FURN_GAP = 12;
/** 一組家具在家具區（寬 GEO.furnitureW）裡的位置：整組置中、彼此間隔 12；x = 該件原點（底邊中點）離家具區左緣的距離 */
export function layoutSet(set: (typeof SETS)[number]): (FurnItem & { x: number })[] {
  const total = set.items.reduce((a, it) => a + OBJECTS[it.id].w, 0) + FURN_GAP * (set.items.length - 1);
  let left = (GEO.furnitureW - total) / 2;
  return set.items.map((it) => {
    const w = OBJECTS[it.id].w;
    const at = left + w / 2; // 原點在底邊中點
    left += w + FURN_GAP;
    return { ...it, x: at };
  });
}

// ---------- 後牆：招牌區與窗 ----------
export const SIGN_X = 92; // 招牌左緣（電梯區右側再留 12）
/** 窗：第一扇中心 380、之後每 240 一扇；half = 半寬（含窗台） */
export const WIN = { first: 380, step: 240, half: 36 } as const;
/** 招牌最大寬：到第一扇窗之前再留 12 */
export const SIGN_MAX_W = WIN.first - WIN.half - 12 - SIGN_X;

/** 樓層寬 width 時後牆每扇窗的中心 x；從招牌區右邊開始，不壓到右端家具區。只跟寬度有關 */
export function windowXs(width: number): number[] {
  const out: number[] = [];
  for (let x = WIN.first; x + WIN.half <= width - GEO.furnitureW; x += WIN.step) out.push(x);
  return out;
}
