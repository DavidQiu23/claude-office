import type { Pt } from './flat.js';
import { BASE_H, BASE_W, type Island } from './view.js';

export type Box = { x: number; y: number; w: number; h: number };

// 地板座標（fx, fy）與高度 z 投影到等角螢幕座標
export const toScreen = (fx: number, fy: number, z = 0): Pt => ({ x: fx - fy, y: (fx + fy) / 2 - z });

// 越大越靠前，畫的時候排後面
export const isoDepth = (fx: number, fy: number): number => fx + fy;

// 人頭頂的高度（世界座標）
export const HEAD_Z = 110;

// 所有島（含名牌、招牌與人頭）投影後的外框；沒有島回傳 null
export function islandsBounds(islands: Island[]): Box | null {
  if (!islands.length) return null;
  const pts = islands.flatMap(i => {
    const l = i.x - 40, r = i.x + i.w + 40, back = i.y - 60, front = i.y + i.h + 70;
    return [toScreen(l, back, HEAD_Z), toScreen(r, back, HEAD_Z), toScreen(l, front), toScreen(r, front)];
  });
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// 讓外框剛好放進視窗；沒有外框時對準預設畫布中央
export function fitCamera(b: Box | null, viewW: number, viewH: number, maxZoom: number): { zoom: number; cx: number; cy: number } {
  if (!b) {
    const c = toScreen(BASE_W / 2, BASE_H / 2);
    return { zoom: 1, cx: c.x, cy: c.y };
  }
  return { zoom: Math.min(maxZoom, viewW / b.w, viewH / b.h), cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}
