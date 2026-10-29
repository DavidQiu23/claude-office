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
export interface FlatSprite { w: number; h: number; shapes: Shape[] }

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
}

const toRgb = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]): string => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number): string => {
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
  const o: CharOpts = { pose: 'sit0', style: 0, outfit: 'tee', glasses: false, hair: HAIR_COLORS[0]!, shirt: SHIRT_COLORS[3]!, ...opts };
  const sit = o.pose === 'sit0' || o.pose === 'sit1' || o.pose === 'idle';
  const S = o.shirt, SD = darker(S, 0.22);
  const face = o.pose === 'up' ? 'alert' : o.pose === 'idle' ? 'idle' : 'work';
  const out: Shape[] = [];
  out.push(e(20, 54, 15, 2.6, '#000000', 0.22));
  if (sit) out.push(r(3, 24, 34, 28, 9, '#3b4770'), r(3, 24, 34, 5, 3, '#56649a'));
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
  return { w: 40, h: 56, shapes: out };
}

// 桌子狀態燈
export const LED: Record<DeskState, string> = { empty: '#6b7288', working: '#46d983', waiting: '#ff4d4d', idle: '#f2b83d' };


export const ISO_FLOOR = '#e8dcc6'; // 等角地板色（島的色塊也以它混色）

export interface Void { x: number; y: number; w: number; h: number }

// ---------- 等角素材（世界畫面座標：toScreen(fx, fy, z)） ----------
const quad = (pts: [number, number, number][]): number[] => pts.flatMap(([x, y, z]) => { const s = toScreen(x, y, z); return [s.x, s.y]; });

// 方塊三面：上面最亮、左面（y 最大那面）中間、右面（x 最大那面）最暗。
function isoBox(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, top: string, left: string, right: string): Shape[] {
  return [
    p(quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), left),
    p(quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), right),
    p(quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), top),
  ];
}

/** 等角桌，原點是座位格左上角 toScreen(cell.x, cell.y)；格內桌面 x 12–84、y 60–90。 */
export function isoDesk(state: DeskState): FlatSprite {
  const led = LED[state];
  const top = state === 'waiting' ? mix('#e0a96d', '#ff4d4d', 0.3) : '#e0a96d';
  const out: Shape[] = [p(quad([[10, 58, 0], [86, 58, 0], [86, 92, 0], [10, 92, 0]]), '#000000', 0.14)];
  for (const [lx, ly] of [[14, 62], [80, 62], [14, 86], [80, 86]] as const) out.push(...isoBox(lx, ly, lx + 3, ly + 3, 0, 19, '#8a5a34', '#8a5a34', '#6e4628'));
  out.push(...isoBox(12, 60, 84, 90, 19, 25, top, '#b87a45', '#a1673a'));
  out.push(p(quad([[18, 64, 25], [34, 64, 25], [34, 80, 25], [18, 80, 25]]), '#f4efe6')); // 桌上的紙
  out.push(...isoBox(70, 72, 76, 78, 25, 34, '#6f4e37', '#ffffff', '#e6e1d8'));
  out.push(...isoBox(44, 74, 52, 79, 25, 28, '#2c3042', '#2c3042', '#23263a'));
  out.push(...isoBox(34, 72, 62, 75, 28, 50, '#4a5068', '#3a3f52', '#2c3042'));
  const l = toScreen(48, 75, 39); // 螢幕背面中央
  if (state !== 'empty') out.push(c(l.x, l.y, state === 'waiting' ? 7 : 5, led, 0.25));
  out.push(c(l.x, l.y, 2, led));
  const x = extent({ w: 0, h: 0, shapes: out });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes: out };
}

export const WALL_Z = 110;
const GRID = 64;

/** 等角房間：菱形地板加格線、左牆（fx = 0）與後牆（fy = 0）、門、窗。doorX 對應 view.ts 的 DOOR_X（直接 import 會成環，由呼叫端傳入）。 */
export function isoRoom(w: number, h: number, doorX = 40): FlatSprite {
  const out: Shape[] = [p(quad([[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]]), ISO_FLOOR)];
  const line = (x0: number, y0: number, x1: number, y1: number): Shape => p(quad([[x0, y0, 0], [x1, y1, 0], [x1, y1, -1], [x0, y0, -1]]), '#b9a88c', 0.3);
  for (let x = GRID; x < w; x += GRID) out.push(line(x, 0, x, h));
  for (let y = GRID; y < h; y += GRID) out.push(line(0, y, w, y));
  out.push(
    p(quad([[0, h, 0], [0, 0, 0], [0, 0, WALL_Z], [0, h, WALL_Z]]), '#d9cdb2'),
    p(quad([[0, 0, 0], [w, 0, 0], [w, 0, WALL_Z], [0, 0, WALL_Z]]), '#f4ecd6'),
    p(quad([[0, h, 0], [0, 0, 0], [0, 0, 6], [0, h, 6]]), '#b8aa8c'),
    p(quad([[0, 0, 0], [w, 0, 0], [w, 0, 6], [0, 0, 6]]), '#cfc2a4'),
    p(quad([[0, h, WALL_Z], [0, 0, WALL_Z], [w, 0, WALL_Z], [w, -8, WALL_Z], [-8, -8, WALL_Z], [-8, h, WALL_Z]]), '#a89b7e'), // 牆頂
    p(quad([[doorX - 22, 0, 0], [doorX + 22, 0, 0], [doorX + 22, 0, 81], [doorX - 22, 0, 81]]), '#8a5a34'),
    p(quad([[doorX - 18, 0, 0], [doorX + 18, 0, 0], [doorX + 18, 0, 77], [doorX - 18, 0, 77]]), '#a1673a'),
  );
  for (let wx = 300; wx + 140 <= w; wx += 220) {
    out.push(
      p(quad([[wx, 0, 40], [wx + 140, 0, 40], [wx + 140, 0, 90], [wx, 0, 90]]), '#c7b994'),
      p(quad([[wx + 6, 0, 44], [wx + 134, 0, 44], [wx + 134, 0, 86], [wx + 6, 0, 86]]), '#9fd3f0'),
    );
  }
  const x = extent({ w: 0, h: 0, shapes: out });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes: out };
}
