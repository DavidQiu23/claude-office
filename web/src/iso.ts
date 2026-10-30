import type { Pt } from './flat.js';
import type { Island } from './view.js';

export type Box = { x: number; y: number; w: number; h: number };

// 地板座標（fx, fy）與高度 z 投影到等角螢幕座標
export const toScreen = (fx: number, fy: number, z = 0): Pt => ({ x: fx - fy, y: (fx + fy) / 2 - z });

// 越大越靠前，畫的時候排後面
export const isoDepth = (fx: number, fy: number): number => fx + fy;

// 人的深度（at = 腳下地板點）；+30 讓人蓋過同一點的地板物件
export const personDepth = (at: Pt): number => isoDepth(at.x, at.y) + 30;
// 桌子的深度（cell = seatCell 左上角）：以桌子前緣中點 (62, 72) 排序，坐在桌後的人在它後面
export const deskDepth = (cell: Pt): number => isoDepth(cell.x + 62, cell.y + 72);

export const FURN_END = 1006;
export const WALL_TOP_Z = 118; // 牆頂（含厚度）
export const FLOOR_DEPTH_Z = -10; // 地板厚度

// 椅子的深度（cell = seatCell 左上角）：以椅子中心 (62, 34) 排序，在坐著的人與桌子之前畫
export const chairDepth = (cell: Pt): number => isoDepth(cell.x + 62, cell.y + 34);

// 名牌上緣中點（現代桌規格 §4）：錨點 (89, 67) 在畫面上跟人同一個 x、桌子前緣下方；下緣不超過 toScreen(cell).y + 94（避開右下斜鄰座舉手時的額頭）。
// h = 名牌螢幕高度，zoom = 畫面倍率（不含內部渲染倍率）
export const plateAt = (cell: Pt, zoom: number, h = 15): Pt => {
  const top = toScreen(cell.x + 89, cell.y + 67);
  return { x: top.x, y: Math.min(top.y, toScreen(cell.x, cell.y).y + 94 - h / zoom) };
};

// 畫面用房間的地板大小：裝得下所有島（右 +40、下 +50），不小於家具排寬度與 420
export function roomSize(islands: Island[]): { w: number; h: number } {
  return {
    w: Math.max(FURN_END, ...islands.map(i => i.x + i.w + 40)),
    h: Math.max(420, ...islands.map(i => i.y + i.h + 50)),
  };
}

const bbox = (pts: Pt[]): Box => {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

// 房間含牆頂投影後的外框
export function roomBox(w: number, h: number): Box {
  return bbox([toScreen(0, 0, WALL_TOP_Z), toScreen(w, 0, WALL_TOP_Z), toScreen(w, 0, FLOOR_DEPTH_Z),
    toScreen(0, h, WALL_TOP_Z), toScreen(0, h, FLOOR_DEPTH_Z), toScreen(w, h, FLOOR_DEPTH_Z)]);
}

export const HEAD_Z = 90; // 人頭（含舉手）上方留白

// 所有島投影後的外框：後方含人頭，前方含名牌與招牌；沒有島回傳 null
export function islandsBox(islands: Island[]): Box | null {
  if (!islands.length) return null;
  return bbox(islands.flatMap(i => {
    const l = i.x - 30, r = i.x + i.w + 30, back = i.y - 10, front = i.y + i.h + 60;
    return [toScreen(l, back, HEAD_Z), toScreen(r, back, HEAD_Z), toScreen(l, front), toScreen(r, front)];
  }));
}

// 讓外框剛好放進視窗，四邊各留 margin
export function fitCamera(b: Box, viewW: number, viewH: number, maxZoom: number, margin = 12): { zoom: number; cx: number; cy: number } {
  return {
    zoom: Math.min(maxZoom, (viewW - 2 * margin) / b.w, (viewH - 2 * margin) / b.h),
    cx: b.x + b.w / 2,
    cy: b.y + b.h / 2,
  };
}

// 鏡頭對準有人的地方（focus），人少放大到 maxZoom、人多拉遠；中心夾在房間內，畫面不露出房間外。沒人時框整個房間。
export function focusCamera(focus: Box | null, room: Box, viewW: number, viewH: number, maxZoom: number): { zoom: number; cx: number; cy: number } {
  const whole = fitCamera(room, viewW, viewH, maxZoom);
  if (!focus) return whole;
  const f = fitCamera(focus, viewW, viewH, maxZoom);
  const zoom = Math.max(f.zoom, whole.zoom); // 整個房間都放得下時不必再拉遠
  const clamp = (c: number, lo: number, size: number, half: number): number =>
    (size <= 2 * half ? lo + size / 2 : Math.min(Math.max(c, lo + half), lo + size - half));
  return { zoom, cx: clamp(f.cx, room.x, room.w, viewW / 2 / zoom), cy: clamp(f.cy, room.y, room.h, viewH / 2 / zoom) };
}
