// Claude 辦公室 · 扁平向量素材：每個素材是「圖形清單」，只用矩形（可圓角）、圓、橢圓、多邊形，加透明度。
// 純資料、不依賴 Phaser；遊戲用 Graphics 的 fillRoundedRect / fillCircle / fillEllipse / fillPoints 逐一畫出。
// 移植自 docs/superpowers/specs/assets/flat-shapes.js，行為相同。a 省略為 1。

import { toScreen } from './iso.js';

export type Shape =
  | { t: 'r'; x: number; y: number; w: number; h: number; r?: number; c: string; a?: number }
  | { t: 'c'; x: number; y: number; r: number; c: string; a?: number }
  | { t: 'e'; x: number; y: number; rx: number; ry: number; c: string; a?: number }
  | { t: 'p'; pts: number[]; c: string; a?: number };

export type Pt = { x: number; y: number };
export interface FlatSprite {
  w: number; h: number; shapes: Shape[];
  clay?: 'box' | 'figure'; // 省略為 box
  shadow?: { fx: number; fy: number; r: number }; // 接地投影，地板座標（素材自己的座標系）
}

export type Pose = 'sit0' | 'sit1' | 'up' | 'idle' | 'walk0' | 'walk1';
export type Outfit = 'tee' | 'hoodie' | 'shirt';
export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';

export interface CharOpts {
  pose: Pose;
  style: number;
  outfit: Outfit;
  glasses: boolean;
  hair: string;
  shirt: string;
  chair: boolean; // false：不畫看板椅背與腳底陰影（2.5D 場景由等角椅子與接地投影提供）
}

const toRgb = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]): string => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number): string => {
  const A = toRgb(a), B = toRgb(b);
  return toHex(A.map((v, i) => v + (B[i]! - v) * t));
};
const darker = (h: string, t: number): string => mix(h, '#1d1a2e', t);
const lighter = (h: string, t: number): string => mix(h, '#ffffff', t);

const r = (x: number, y: number, w: number, h: number, rad: number, c: string, a?: number): Shape => ({ t: 'r', x, y, w, h, r: rad, c, a });
const c = (x: number, y: number, rad: number, col: string, a?: number): Shape => ({ t: 'c', x, y, r: rad, c: col, a });
const e = (x: number, y: number, rx: number, ry: number, col: string, a?: number): Shape => ({ t: 'e', x, y, rx, ry, c: col, a });
const p = (pts: number[], col: string, a?: number): Shape => ({ t: 'p', pts, c: col, a });

/** 所有圖形的實際範圍：圓用 x±r、橢圓用 x±rx、多邊形用點的最小最大值。 */
export function extent(s: FlatSprite): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (ax: number, ay: number, bx: number, by: number): void => {
    if (ax < x0) x0 = ax;
    if (ay < y0) y0 = ay;
    if (bx > x1) x1 = bx;
    if (by > y1) y1 = by;
  };
  for (const sh of s.shapes) {
    if (sh.t === 'r') add(sh.x, sh.y, sh.x + sh.w, sh.y + sh.h);
    else if (sh.t === 'c') add(sh.x - sh.r, sh.y - sh.r, sh.x + sh.r, sh.y + sh.r);
    else if (sh.t === 'e') add(sh.x - sh.rx, sh.y - sh.ry, sh.x + sh.rx, sh.y + sh.ry);
    else {
      for (let i = 0; i + 1 < sh.pts.length; i += 2) add(sh.pts[i]!, sh.pts[i + 1]!, sh.pts[i]!, sh.pts[i + 1]!);
    }
  }
  if (s.shadow) {
    const o = toScreen(s.shadow.fx, s.shadow.fy);
    const rx = s.shadow.r * Math.SQRT2, ry = s.shadow.r / Math.SQRT2;
    add(o.x - rx, o.y - ry, o.x + rx, o.y + ry);
  }
  return { x0, y0, x1, y1 };
}

// ---------- 角色 40×56 ----------
const INK = '#1d1a2e', SKIN = '#ffd9b8', SKIN_D = '#f2b995', BLUSH = '#ff9a8f', CORAL = '#ff6f61';
export const HAIR_COLORS: string[] = ['#2b2233', '#6a4630', '#e8be52', '#b85a30', '#a8aeb6', '#4a3560', '#2c4a6e', '#e07aa5'];
export const SHIRT_COLORS: string[] = ['#d9534f', '#e98f3f', '#e6c34a', '#4fb477', '#38a8a0', '#4a90d9', '#8e6fc9', '#d9669a'];

function hairBack(style: number, H: string): Shape[] {
  if (style === 2) return [r(5, 9, 30, 32, 12, H), r(5, 34, 30, 7, 3, darker(H, 0.2))];
  if (style === 4) return [c(9, 14, 7, H), c(31, 14, 7, H), c(7, 22, 6, H), c(33, 22, 6, H)];
  return [];
}
function hairFront(style: number, H: string): Shape[] {
  const L = lighter(H, 0.25), D = darker(H, 0.22);
  if (style === 0) return [r(8, 2, 24, 12, 7, H), r(7, 8, 4, 9, 2, H), r(29, 8, 4, 9, 2, H), r(12, 4, 8, 3, 1.5, L)];
  if (style === 1) return [r(8, 2, 24, 11, 7, H), p([8, 8, 26, 8, 14, 18, 8, 18], H), r(29, 8, 4, 9, 2, H), r(13, 4, 9, 3, 1.5, L), p([8, 14, 14, 18, 8, 18], D)];
  if (style === 2) return [r(8, 2, 24, 12, 7, H), r(7, 8, 5, 13, 2.5, H), r(28, 8, 5, 13, 2.5, H), r(12, 4, 8, 3, 1.5, L)];
  if (style === 3) return [c(20, 1, 5.5, H), r(8, 3, 24, 11, 7, H), r(7, 8, 4, 8, 2, H), r(29, 8, 4, 8, 2, H), r(12, 5, 8, 3, 1.5, L)];
  if (style === 4) return [c(12, 5, 7, H), c(20, 3, 7, H), c(28, 5, 7, H), r(8, 6, 24, 8, 4, H), c(11, 4, 2, L)];
  return [r(7, 3, 26, 10, 6, H), r(6, 10, 28, 5, 2.5, D), c(20, 2, 4, lighter(H, 0.35))]; // 毛帽
}
const FACES: Record<'work' | 'idle' | 'alert', (ink: string) => Shape[]> = {
  work: (ink) => [c(14.5, 18, 2.2, ink), c(25.5, 18, 2.2, ink), c(15.2, 17.2, 0.8, '#ffffff'), c(26.2, 17.2, 0.8, '#ffffff'), r(18, 23.5, 4, 1.6, 0.8, '#b4584a')],
  idle: (ink) => [r(12.5, 18, 4.5, 1.6, 0.8, ink), r(23, 18, 4.5, 1.6, 0.8, ink), e(20, 24, 2.6, 1.8, '#b4584a')],
  alert: (ink) => [c(14.5, 17.5, 2.8, '#ffffff'), c(25.5, 17.5, 2.8, '#ffffff'), c(14.5, 17.5, 1.6, ink), c(25.5, 17.5, 1.6, ink), e(20, 24.5, 2.2, 2.6, '#7a2e3a')],
};

export function character(opts: Partial<CharOpts> = {}): FlatSprite {
  const o: CharOpts = { pose: 'sit0', style: 0, outfit: 'tee', glasses: false, hair: HAIR_COLORS[0]!, shirt: SHIRT_COLORS[3]!, chair: true, ...opts };
  const sit = o.pose === 'sit0' || o.pose === 'sit1' || o.pose === 'idle';
  const S = o.shirt, SD = darker(S, 0.22);
  const face = o.pose === 'up' ? 'alert' : o.pose === 'idle' ? 'idle' : 'work';
  const out: Shape[] = [];
  if (o.chair) out.push(e(20, 54, 15, 2.6, '#000000', 0.22));
  if (sit && o.chair) out.push(r(3, 24, 34, 28, 9, '#3b4770'), r(3, 24, 34, 5, 3, '#56649a'));
  // 腿
  const step = o.pose === 'walk0' ? 2 : o.pose === 'walk1' ? -2 : 0;
  out.push(r(11 + step, 42, 7, 12, 3, '#3b4a7a'), r(22 - step, 42, 7, 12, 3, '#3b4a7a'), r(10 + step, 51, 9, 4, 2, '#6b4636'), r(21 - step, 51, 9, 4, 2, '#6b4636'));
  out.push(...hairBack(o.style, o.hair));
  // 手臂（身體後面的一隻）與身體
  const armY = o.pose === 'up' ? 29 : 30;
  out.push(r(7, armY, 7, 16, 3.5, SD));
  out.push(r(9, 27, 22, 20, 8, S));
  if (o.outfit === 'hoodie') out.push(e(20, 28, 9, 4, SD), r(12, 36, 16, 8, 3, SD), r(17.5, 29, 1.6, 7, 0.8, '#ffffff'), r(21, 29, 1.6, 7, 0.8, '#ffffff'));
  else if (o.outfit === 'shirt') out.push(p([20, 28, 14, 27, 17, 34], '#ffffff'), p([20, 28, 26, 27, 23, 34], '#ffffff'), r(19, 31, 2.4, 14, 1, '#d9534f'));
  else out.push(e(20, 28, 5.5, 3, SKIN_D), r(12, 41, 16, 3, 1.5, SD, 0.6));
  out.push(r(26, armY, 7, 16, 3.5, S));
  // 手
  if (o.pose === 'up') out.push(r(27, 8, 7, 22, 3.5, S), c(30.5, 8, 4, SKIN));
  else if (sit) { const d = o.pose === 'sit1' ? 2 : 0; out.push(c(13 + d, 46, 3.6, SKIN), c(27 - d, 46, 3.6, SKIN)); }
  else out.push(c(10.5 + step, 46, 3.4, SKIN), c(29.5 - step, 46, 3.4, SKIN));
  // 頭
  out.push(r(16, 24, 8, 6, 2, SKIN_D), c(20, 16, 12.5, SKIN), e(11, 21, 3, 1.8, BLUSH, 0.65), e(29, 21, 3, 1.8, BLUSH, 0.65));
  out.push(...FACES[face](INK));
  if (o.glasses) out.push(c(14.5, 18, 5.4, CORAL), c(14.5, 18, 3.9, '#ffffff', 0.35), c(25.5, 18, 5.4, CORAL), c(25.5, 18, 3.9, '#ffffff', 0.35), r(19, 17, 2, 1.6, 0.8, CORAL), ...FACES[face](INK).slice(0, 4));
  out.push(...hairFront(o.style, o.hair));
  return { w: 40, h: 56, shapes: out, clay: 'figure' };
}

// 桌子狀態燈
export const LED: Record<DeskState, string> = { empty: '#6b7288', working: '#46d983', waiting: '#ff4d4d', idle: '#f2b83d' };


export interface Void { x: number; y: number; w: number; h: number }

// ---------- 等角素材（世界畫面座標：toScreen(fx, fy, z)） ----------
export const quad = (pts: [number, number, number][]): number[] => pts.flatMap(([x, y, z]) => { const s = toScreen(x, y, z); return [s.x, s.y]; });

/** 轉 45° 座標（規格 §8）：c 為地板點，u 沿 (1,−1)/√2、v 沿 (1,1)/√2；回傳 [fx, fy, z]。 */
export const rpt = (c: Pt, u: number, v: number, z: number): [number, number, number] =>
  [c.x + (u + v) / Math.SQRT2, c.y + (v - u) / Math.SQRT2, z];

const D: Pt = { x: 59, y: 59 }; // 桌子與椅子的中心（人 + 11·(1,1)）

// 轉 45° 方塊只看得到上面與正面（+v），兩面在畫面上都是水平矩形。
// 單一平面：z0 = z1 為水平面（v0…v1），v0 = v1 為正面（z0…z1）。
const rquad = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number): number[] =>
  quad([rpt(D, u0, v0, z0), rpt(D, u1, v0, z0), rpt(D, u1, v1, z1), rpt(D, u0, v1, z1)]);
const rbox = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, top: string, front: string): Shape[] =>
  [p(rquad(u0, u1, v1, v1, z0, z1), front), p(rquad(u0, u1, v0, v1, z1, z1), top)];

/** 等角椅，原點是座位格左上角 toScreen(cell.x, cell.y)。 */
export function isoChair(): FlatSprite {
  const out: Shape[] = [
    ...rbox(-10, 10, -27, -9, 0, 3, '#3f4670', '#2a3150'),
    ...rbox(-2, 2, -19, -16, 3, 14, '#2a3150', '#20253f'),
    ...rbox(-11, 11, -28, -24, 16, 48, '#56649a', '#3b4770'),
    p(rquad(-11, 11, -24, -24, 44, 48), '#4a5788'), // 椅背上緣亮邊
    ...rbox(-12, 12, -26, -8, 14, 19, '#56649a', '#3b4770'),
  ];
  const x = extent({ w: 0, h: 0, shapes: out });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes: out, clay: 'box', shadow: { fx: 44, fy: 44, r: 16 } };
}

/** 等角桌，原點同 isoChair；桌子中心 D = cell + (59, 59)。 */
export function isoDesk(state: DeskState): FlatSprite {
  const led = LED[state];
  const top = state === 'waiting' ? '#e98d63' : '#e0a96d';
  const out: Shape[] = [];
  if (state === 'waiting') { const g = toScreen(69, 69); out.push(e(g.x, g.y, 20 * Math.SQRT2, 20 / Math.SQRT2, '#ff4d4d', 0.22)); }
  out.push(
    ...rbox(-24, -21, -10, -7, 0, 16, '#8a5a34', '#8a5a34'), ...rbox(-24, -21, 7, 10, 0, 16, '#8a5a34', '#8a5a34'),
    ...rbox(10, 24, -10, 11, 0, 16, '#b87a45', '#a1673a'),
    p(rquad(12, 22, 11, 11, 10, 11.5), '#e0a96d'), p(rquad(12, 22, 11, 11, 4, 5.5), '#e0a96d'), // 抽屜把手
    ...rbox(-21, 10, -8, -6, 4, 16, '#a1673a', '#9a6838'),
    ...rbox(-26, 26, -12, 12, 16, 21, top, '#b87a45'),
    p(rquad(-26, 26, -12, -10, 21, 21), mix(top, '#ffffff', 0.3)), // 桌面後緣亮邊
    p(rquad(-22, -10, -4, 8, 21.2, 21.2), '#f4efe6'),
    p(rquad(-20, -12, -2, 5, 21.3, 21.3), '#a7a3b3', 0.5), // 紙上的字
    p(rquad(-22, -17, 8.5, 11, 21.2, 21.2), '#ffd166'),
    ...rbox(-9, 9, -10, -5, 21, 22.5, '#c8cde0', '#a7aec8'), // 鍵盤
    ...rbox(11, 14, -9, -6, 21, 22.5, '#c8cde0', '#a7aec8'), // 滑鼠
    ...rbox(15, 21, -1, 5, 21, 29, '#6f4e37', '#ffffff'), ...rbox(21, 23, 1, 3, 23, 27, '#ffffff', '#ffffff'), // 馬克杯與杯耳
    ...rbox(-6, 6, 0, 5, 21, 22.5, '#3a3f52', '#2c3042'), ...rbox(-1.5, 1.5, 1.5, 3, 22.5, 25, '#3a3f52', '#2c3042'),
    ...rbox(-14, 14, 3, 5, 24, 37, '#4a5068', '#3a3f52'),
    p(rquad(-10, 10, 5, 5, 33.5, 35), '#5b6179'), // 散熱條
  );
  const l = toScreen(...rpt(D, 0, 5, 29));
  if (state !== 'empty') out.push(c(l.x, l.y, state === 'waiting' ? 6 : 4.5, led, 0.25));
  out.push(c(l.x, l.y, 1.8, led));
  if (state === 'idle') {
    const m = toScreen(...rpt(D, 18, 2, 31));
    out.push(e(m.x, m.y, 1.5, 2.8, '#ffffff', 0.7), e(m.x + 1, m.y - 6, 1.3, 2.4, '#ffffff', 0.5));
  }
  const x = extent({ w: 0, h: 0, shapes: out });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes: out, clay: 'box', shadow: { fx: 62, fy: 62, r: 30 } };
}

/** 軸對齊等角方塊（規格 §1）：先畫左面（fy = y1）、右面（fx = x1），最後上面。 */
export function isoBox(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, top: string, left: string, right: string, a?: number): Shape[] {
  return [
    p(quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), left, a),
    p(quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), right, a),
    p(quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), top, a),
  ];
}
/** 基色 → [上, 左, 右]（規格 §1）。 */
export const baseCols = (b: string): [string, string, string] => [lighter(b, 0.18), b, darker(b, 0.2)];

export const FLOOR = '#2d3558'; // 房間地板色（島地毯、地墊以它混色）
export const WALL_Z = 110;
const GRID = 64;

/** 等角房間外殼（規格 §3）：深藍地板、棋盤、格線、牆腳陰影、地板厚度、後牆（fy = 0）、左牆（fx = 0）、牆頂、端面。門與窗在 furniture.ts。 */
export function isoRoom(w: number, h: number): FlatSprite {
  const flat = (x0: number, y0: number, x1: number, y1: number, col: string, a?: number): Shape => p(quad([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]), col, a);
  const back = (z0: number, z1: number, col: string): Shape => p(quad([[0, 0, z0], [w, 0, z0], [w, 0, z1], [0, 0, z1]]), col);
  const left = (z0: number, z1: number, col: string): Shape => p(quad([[0, h, z0], [0, 0, z0], [0, 0, z1], [0, h, z1]]), col);
  const out: Shape[] = [flat(0, 0, w, h, FLOOR)];
  for (let ix = 0; ix * GRID < w; ix++) for (let iy = 0; iy * GRID < h; iy++) {
    if ((ix + iy) % 2 === 0) out.push(flat(ix * GRID, iy * GRID, Math.min(w, (ix + 1) * GRID), Math.min(h, (iy + 1) * GRID), '#ffffff', 0.025));
  }
  for (let x = GRID; x < w; x += GRID) out.push(flat(x, 0, x + 1, h, '#ffffff', 0.05));
  for (let y = GRID; y < h; y += GRID) out.push(flat(0, y, w, y + 1, '#ffffff', 0.05));
  out.push(
    flat(0, 0, w, 14, '#000000', 0.16), flat(0, 0, 10, h, '#000000', 0.12),
    p(quad([[0, h, -10], [w, h, -10], [w, h, 0], [0, h, 0]]), '#1f2440'),
    p(quad([[w, 0, -10], [w, h, -10], [w, h, 0], [w, 0, 0]]), '#181c33'),
    back(0, WALL_Z, '#46507a'), back(0, 44, '#3b4468'), back(44, 47, '#5a6590'), back(0, 6, '#252b48'),
    left(0, WALL_Z, '#3c4570'), left(0, 44, '#323a5c'), left(44, 47, '#4d5782'), left(0, 6, '#1f2440'),
    p(quad([[0, h, WALL_Z], [0, 0, WALL_Z], [w, 0, WALL_Z], [w, -8, WALL_Z], [-8, -8, WALL_Z], [-8, h, WALL_Z]]), '#5f6a98'), // 牆頂（L 形，厚 8）
    p(quad([[w, -8, 0], [w, 0, 0], [w, 0, WALL_Z], [w, -8, WALL_Z]]), '#2a3150'),
    p(quad([[-8, h, 0], [0, h, 0], [0, h, WALL_Z], [-8, h, WALL_Z]]), '#343c62'),
  );
  const x = extent({ w: 0, h: 0, shapes: out });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes: out };
}
