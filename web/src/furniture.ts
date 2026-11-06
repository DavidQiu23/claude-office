// Claude 辦公室 · 剖面大樓的家具組與後牆窗的位置。家具與窗的圖在 objects.ts（SVG symbol），這裡只管排哪幾件、怎麼擺。

import { GEO, type SeatGrid } from './floors.js';
import { GLASS, OBJECTS, PANO, type FurnitureId } from './objects.js';

// ---------- 家具組 ----------
export interface FurnItem { id: FurnitureId }
export const SETS: { id: string; items: FurnItem[] }[] = [
  { id: 'pantry', items: [{ id: 'waterCooler' }, { id: 'vending' }, { id: 'plant' }] },
  { id: 'library', items: [{ id: 'bookshelf' }, { id: 'copier' }, { id: 'plant' }] },
  { id: 'lounge', items: [{ id: 'floorLamp' }, { id: 'sofa' }, { id: 'sideTable' }] },
  { id: 'reading', items: [{ id: 'bookshelf' }, { id: 'sideTable' }, { id: 'floorLamp' }] },
];

/** 第 bay 個家具區擺哪一組：第一區依 roomKey 的雜湊挑，同 key 永遠同一組，後面的依 SETS 順序往下輪。FNV-1a 的低位元只看每個字的低位元（只差幾個字的路徑常撞同一組），所以再打散一次 */
export function furnitureSet(key: string, bay = 0): (typeof SETS)[number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return SETS[((h >>> 0) + bay) % SETS.length]!;
}

const FURN_GAP = 12;
/** 一組家具在寬 bayW 的家具區裡的位置：整組置中、彼此間隔 12；x = 該件原點（底邊中點）離家具區左緣的距離 */
export function layoutSet(set: (typeof SETS)[number], bayW: number): (FurnItem & { x: number })[] {
  const total = set.items.reduce((a, it) => a + OBJECTS[it.id].w, 0) + FURN_GAP * (set.items.length - 1);
  let left = (bayW - total) / 2;
  return set.items.map((it) => {
    const w = OBJECTS[it.id].w;
    const at = left + w / 2; // 原點在底邊中點
    left += w + FURN_GAP;
    return { ...it, x: at };
  });
}

// ---------- 後牆：招牌區與窗 ----------
export const SIGN_X = GEO.sideGap; // 招牌左緣：和第一張桌子一樣離左牆一段
/** 招牌最大寬 */
export const SIGN_MAX_W = 228;

/** 後牆上窗的中心 x，只開在桌子區的牆上，家具區留給高的家具。第一組的左邊是招牌，只在第三張桌子上方開一扇，不足三張就不開；其他組：三張兩扇，兩張或一張一扇 */
export function wallPlan(grid: SeatGrid): { windows: number[] } {
  const windows: number[] = [];
  grid.groups.forEach((g, i) => {
    const c = (g[0]! + g[g.length - 1]!) / 2;
    if (i === 0) { if (g.length >= 3) windows.push(g[2]!); }
    else if (g.length >= 3) windows.push(c - GEO.seatW, c + GEO.seatW);
    else if (g.length === 2) windows.push(c + GEO.seatW / 2);
    else windows.push(c);
  });
  return { windows };
}

/** 窗景的上下：每高一層往上看 step；topLevel 以上固定在最高的視角 */
export const VIEW = { step: 50, topLevel: 5 } as const;

/** 中心在 x 的窗、在第 level 層時，玻璃露出的那塊全景的左上角（全景座標）。
 *  所有窗是開在同一片風景上的洞：左右跟著窗在樓層裡的位置（超過全景寬就從頭接），上下跟著樓層（1F 看到最底下的街道） */
export function windowView(x: number, level: number): { x: number; y: number } {
  const l = Math.min(Math.max(level, 1), VIEW.topLevel);
  return { x: (((x + GLASS.x) % PANO.w) + PANO.w) % PANO.w, y: PANO.h - GLASS.h - (l - 1) * VIEW.step };
}
