import type { Pt } from './flat.js';
import type { Island } from './view.js';

export type Box = { x: number; y: number; w: number; h: number };

// 地板座標（fx, fy）與高度 z 投影到等角螢幕座標
export const toScreen = (fx: number, fy: number, z = 0): Pt => ({ x: fx - fy, y: (fx + fy) / 2 - z });

// 越大越靠前，畫的時候排後面
export const isoDepth = (fx: number, fy: number): number => fx + fy;

// 人的深度（at = 腳下地板點）；+30 讓人蓋過同一點的地板物件
export const personDepth = (at: Pt): number => isoDepth(at.x, at.y) + 30;
// 桌子的深度（cell = seatCell 左上角）：以桌面前緣附近的點排序，坐在桌後的人在它後面
export const deskDepth = (cell: Pt): number => isoDepth(cell.x + 48, cell.y + 90);

export const FURN_END = 1006;
export const WALL_TOP_Z = 118; // 牆頂（含厚度）
export const FLOOR_DEPTH_Z = -10; // 地板厚度

// 椅子的深度（cell = seatCell 左上角）：在坐著的人之前、桌子之後
export const chairDepth = (cell: Pt): number => cell.x + cell.y + 88;

// 名牌上緣中點（規格 §11）：x 對齊桌子中心；上緣在桌子正面下緣 (67.5, 67.5)，但下緣不超過 toScreen(cell).y + 90。
// h = 名牌螢幕高度，zoom = 畫面倍率（不含內部渲染倍率）
export const plateAt = (cell: Pt, zoom: number, h = 15): Pt => {
  const top = toScreen(cell.x + 67.5, cell.y + 67.5);
  return { x: top.x, y: Math.min(top.y, toScreen(cell.x, cell.y).y + 90 - h / zoom) };
};

// 畫面用房間的地板大小：裝得下所有島（右 +40、下 +50），不小於家具排寬度與 420
export function roomSize(islands: Island[]): { w: number; h: number } {
  return {
    w: Math.max(FURN_END, ...islands.map(i => i.x + i.w + 40)),
    h: Math.max(420, ...islands.map(i => i.y + i.h + 50)),
  };
}

// 房間含牆頂投影後的外框
export function roomBox(w: number, h: number): Box {
  const pts = [toScreen(0, 0, WALL_TOP_Z), toScreen(w, 0, WALL_TOP_Z), toScreen(w, 0, FLOOR_DEPTH_Z),
    toScreen(0, h, WALL_TOP_Z), toScreen(0, h, FLOOR_DEPTH_Z), toScreen(w, h, FLOOR_DEPTH_Z)];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// 讓外框剛好放進視窗，四邊各留 margin
export function fitCamera(b: Box, viewW: number, viewH: number, maxZoom: number, margin = 12): { zoom: number; cx: number; cy: number } {
  return {
    zoom: Math.min(maxZoom, (viewW - 2 * margin) / b.w, (viewH - 2 * margin) / b.h),
    cx: b.x + b.w / 2,
    cy: b.y + b.h / 2,
  };
}
