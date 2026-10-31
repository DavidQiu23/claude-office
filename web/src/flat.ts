// Claude 辦公室 · 扁平向量素材：每個素材是「圖形清單」，只用矩形（可圓角）、圓、橢圓、多邊形，加透明度。
// 純資料、不依賴 DOM；sprites.ts 用 clay.ts（Canvas 2D）把它烘成圖片。
// 移植自 docs/superpowers/specs/assets/flat-shapes.js，行為相同。a 省略為 1。

export type Shape =
  | { t: 'r'; x: number; y: number; w: number; h: number; r?: number; c: string; a?: number }
  | { t: 'c'; x: number; y: number; r: number; c: string; a?: number }
  | { t: 'e'; x: number; y: number; rx: number; ry: number; c: string; a?: number }
  | { t: 'p'; pts: number[]; c: string; a?: number };

export interface FlatSprite {
  w: number; h: number; shapes: Shape[];
  clay?: 'box' | 'figure'; // 省略為 box
  shadow?: { fx: number; fy: number; r: number }; // 正面接地投影：中心 (fx, fy)（素材座標），橢圓 rx = r、ry = r / 3
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
  chair: boolean; // false：不畫椅背與腳底陰影
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
    const { fx, fy, r: rx } = s.shadow, ry = rx / 3;
    add(fx - rx, fy - ry, fx + rx, fy + ry);
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

// 現代桌配色：淺橡木桌面、霧黑金屬框、銀色螢幕支架、白色配件
const DESK_TOP = '#e6c9a0';
const METAL: [string, string, string] = ['#2e3242', '#262a38', '#1c1f2b'];
const SILVER: [string, string, string] = ['#d4d9e4', '#b8bfcf', '#9aa2b6'];
const WHITE: [string, string, string] = ['#f6f7fb', '#e3e6ee', '#c8cdda'];

/** 正面桌（剖面大樓）：寬 80、桌面上緣 y 14、桌腳到 y 40；人坐在桌後中間，螢幕在桌面右側（x 56–78）不擋臉，螢幕光與指示燈用 LED[state]。 */
export function deskFront(state: DeskState): FlatSprite {
  const led = LED[state];
  const top = state === 'waiting' ? mix(DESK_TOP, '#ff4d4d', 0.3) : DESK_TOP;
  const out: Shape[] = [];
  if (state === 'waiting') out.push(e(40, 39, 40, 4, '#ff4d4d', 0.22)); // 地上的紅光
  out.push(
    r(4, 18, 3, 22, 1, METAL[1]), r(73, 18, 3, 22, 1, METAL[1]), // 桌腳
    r(2, 37.5, 8, 2.5, 1, METAL[0]), r(70, 37.5, 8, 2.5, 1, METAL[0]),
    r(8, 19, 64, 16, 1.5, '#c9a77a'), r(8, 31, 64, 4, 1.5, '#b08f66'), // 前擋板（名牌貼在這裡）
    r(0, 14, 80, 5, 2, top), r(2, 14.5, 76, 1.4, 0.7, lighter(top, 0.3)), // 桌面與亮邊
    r(30, 12, 20, 2.4, 1, WHITE[1]), r(52, 12.4, 3, 1.8, 0.9, WHITE[0]), // 鍵盤、滑鼠
    r(14, 11.5, 10, 2.5, 0.8, '#4a90d9'), // 筆記本
    r(6, 6, 6, 8, 1.5, WHITE[0]), r(3.8, 8, 3, 4, 1.5, WHITE[2]), r(6.8, 6.6, 4.4, 1.4, 0.7, '#5a3d2e'), // 白杯
    r(64, 11, 10, 3, 1, SILVER[1]), r(67.5, 5, 3, 7, 1, SILVER[2]), // 螢幕支架
    r(55, -2, 24, 15, 2, '#30354a'), // 螢幕外框
    r(56.5, -0.5, 21, 11, 1, state === 'empty' ? '#20263f' : mix(led, '#1d1a2e', 0.45)), // 螢幕
  );
  if (state !== 'empty') out.push(r(56.5, -0.5, 21, 11, 1, '#ffffff', 0.12), c(67, 5, state === 'waiting' ? 9 : 7, led, 0.18));
  out.push(c(76.5, 11.6, 0.9, led)); // 指示燈
  if (state === 'idle') out.push(e(9, 2.5, 1.5, 2.8, '#ffffff', 0.7), e(11.5, -2.5, 1.3, 2.4, '#ffffff', 0.5)); // 蒸氣
  return { w: 80, h: 40, shapes: out, clay: 'box' };
}
