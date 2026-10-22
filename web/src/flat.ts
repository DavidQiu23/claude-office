// Claude 辦公室 · 扁平向量素材：每個素材是「圖形清單」，只用矩形（可圓角）、圓、橢圓、多邊形，加透明度。
// 純資料、不依賴 Phaser；遊戲用 Graphics 的 fillRoundedRect / fillCircle / fillEllipse / fillPoints 逐一畫出。
// 移植自 docs/superpowers/specs/assets/flat-shapes.js，行為相同。a 省略為 1。

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

// ---------- 桌子 72×36（4 種狀態） ----------
export const LED: Record<DeskState, string> = { empty: '#6b7288', working: '#46d983', waiting: '#ff4d4d', idle: '#f2b83d' };
export function desk(state: DeskState): FlatSprite {
  const led = LED[state];
  const top = state === 'waiting' ? mix('#e0a96d', '#ff4d4d', 0.3) : '#e0a96d';
  const out: Shape[] = [];
  out.push(e(36, 34, 35, 2.4, '#000000', 0.22));
  out.push(r(2, 24, 6, 11, 2, '#8a5a34'), r(64, 24, 6, 11, 2, '#8a5a34'));
  out.push(r(0, 10, 72, 18, 6, '#b87a45'), r(0, 6, 72, 17, 7, top), r(2, 7, 68, 3, 1.5, lighter(top, 0.3)));
  out.push(r(26, 18, 20, 7, 2, '#a1673a'), r(33, 20, 6, 2, 1, '#f0d9a0'));
  // 螢幕背面
  out.push(r(22, -10, 28, 20, 5, '#3a3f52'), r(24, -8, 24, 3, 1.5, '#5b6179'), r(32, 9, 8, 5, 1, '#2c3042'), r(27, 13, 18, 3, 1.5, '#2c3042'));
  if (state !== 'empty') {
    out.push(c(36, 0, state === 'waiting' ? 15 : 11, led, state === 'waiting' ? 0.22 : 0.16), c(36, 0, state === 'waiting' ? 9.5 : 7.5, led, 0.3));
  }
  out.push(c(36, 0, 3.2, led));
  if (state === 'waiting') out.push(e(36, 16, 20, 3.2, '#ff4d4d', 0.3));
  // 桌面小物
  out.push(r(6, 11, 12, 9, 2, '#f4efe6'), r(8, 13, 7, 1.4, 0.7, '#a7a3b3'), r(8, 16, 5, 1.4, 0.7, '#a7a3b3'));
  out.push(r(56, 9, 8, 9, 2.5, '#ffffff'), r(56, 9, 8, 2.4, 1.2, '#6f4e37'), r(63, 11, 3.5, 5, 1.8, '#ffffff'));
  out.push(r(21, 12, 5, 5, 1, '#ffd166'), r(48, 14, 5, 5, 1, '#ff9ac1'));
  if (state === 'idle') out.push(e(60, 3, 1.6, 3, '#ffffff', 0.7), e(63, -1, 1.4, 2.6, '#ffffff', 0.5));
  return { w: 72, h: 36, shapes: out };
}

// ---------- 驚嘆號 20×28 ----------
export function exclamation(): FlatSprite {
  return { w: 20, h: 28, shapes: [
    c(10, 10, 10, '#ff4d4d', 0.25), r(2, 1, 16, 21, 8, '#ff4d4d'), p([7, 21, 13, 21, 10, 27], '#ff4d4d'),
    r(8.5, 5, 3, 9, 1.5, '#ffffff'), c(10, 17.5, 1.9, '#ffffff'),
  ] };
}

// ---------- 助理小幫手 24×24（工作中灰藍、天線紅燈；完成綠色、天線黃燈） ----------
export function bot(done: boolean): FlatSprite {
  const B = done ? '#5fd38a' : '#9fb2c4', BD = darker(B, 0.2);
  return { w: 24, h: 24, shapes: [
    e(12, 22.5, 8, 1.6, '#000000', 0.22),
    r(11, 0, 2, 5, 1, '#6b7288'), c(12, 1.5, 2.2, done ? '#ffd24a' : '#ff7a7a'),
    r(3, 4, 18, 13, 6, B), r(3, 12, 18, 5, 3, BD, 0.5),
    c(8.5, 10, 2.6, '#ffffff'), c(15.5, 10, 2.6, '#ffffff'),
    c(8.8, 10.2, 1.4, INK), c(15.8, 10.2, 1.4, INK),
    done ? e(12, 14.6, 3.2, 1.8, '#ffffff') : r(9.5, 14, 5, 1.4, 0.7, INK),
    r(6, 17, 12, 4, 2, BD), r(7, 20, 3.5, 3, 1.5, '#2c3042'), r(13.5, 20, 3.5, 3, 1.5, '#2c3042'),
  ] };
}

// ---------- 辦公室背景物件（移植自 docs/superpowers/specs/assets/office-shapes.js）----------
const shifted = (shapes: Shape[], dx: number, dy: number): Shape[] =>
  shapes.map((sh) => (sh.t === 'p' ? { ...sh, pts: sh.pts.map((v, i) => v + (i % 2 ? dy : dx)) } : { ...sh, x: sh.x + dx, y: sh.y + dy }));

export const OFFICE = { floor: '#2d3558', wall: '#46507a', wainscot: '#3b4468', base: '#252b48', frame: '#2a3150', wallH: 56, baseH: 8, side: 10 };
export const FLOOR_TOP = OFFICE.wallH + OFFICE.baseH; // 64：地板從這裡開始
export const WALL_FEET = 78; // 靠牆家具的腳底線

export const windowNight = (): FlatSprite => ({ w: 76, h: 44, shapes: [
  r(0, 0, 76, 40, 5, OFFICE.frame), r(4, 4, 68, 32, 3, '#1c2a52'), r(4, 4, 68, 13, 3, '#2c4078', 0.7), r(37, 4, 2, 32, 0, OFFICE.frame),
  c(14, 14, 1, '#ffffff', 0.85), c(30, 26, 1, '#ffffff', 0.6), c(52, 12, 1, '#ffffff', 0.7), c(62, 24, 1.3, '#ffe9a8', 0.95),
  p([44, 36, 56, 22, 72, 36], '#243660', 0.9), p([4, 36, 16, 26, 30, 36], '#243660', 0.9),
  r(-2, 39, 80, 5, 2.5, '#5a6590'),
] });
export const clock = (): FlatSprite => ({ w: 30, h: 30, shapes: [
  c(15, 15, 15, OFFICE.frame), c(15, 15, 12, '#f4efe6'), r(14, 6, 2, 10, 1, '#2a3150'), r(14, 14, 8, 2, 1, '#2a3150'), c(15, 15, 1.8, '#d9534f'),
] });
export const door = (): FlatSprite => ({ w: 44, h: 64, shapes: [
  r(0, 8, 44, 56, 4, OFFICE.frame), r(4, 12, 36, 52, 2, '#6b5a4a'), r(7, 15, 30, 49, 1, '#7d6a58'), r(7, 15, 30, 12, 1, '#8a7663'), c(33, 42, 2.2, '#e8d9a8'),
  r(6, 0, 32, 10, 3, '#1f7a4d'), r(9, 3, 26, 4, 2, '#7dffb2'),
] });
export const whiteboard = (): FlatSprite => ({ w: 76, h: 44, shapes: [
  r(0, 0, 76, 42, 4, '#9aa3c4'), r(3, 3, 70, 33, 2, '#f4f6fb'), r(3, 3, 70, 8, 2, '#ffffff', 0.7),
  r(9, 10, 28, 3, 1.5, '#4a90d9'), r(9, 17, 40, 3, 1.5, '#a0a8c4'), r(9, 24, 22, 3, 1.5, '#e98f3f'), r(48, 8, 18, 14, 3, '#ffd166', 0.9), c(60, 28, 3, '#d9534f'),
  r(10, 38, 56, 6, 3, '#8089ad'), r(14, 39, 8, 3, 1.5, '#4a90d9'), r(26, 39, 8, 3, 1.5, '#d9534f'),
] });
export const bookcase = (): FlatSprite => {
  const out: Shape[] = [r(0, 0, 44, 58, 3, '#6a4a38'), r(3, 3, 38, 52, 2, '#4a3328')];
  const cols = ['#d9534f', '#4a90d9', '#e6c34a', '#4fb477', '#8e6fc9', '#e98f3f', '#38a8a0'];
  [3, 21, 39].forEach((y, row) => {
    out.push(r(3, y + 12, 38, 3, 0, '#6a4a38'));
    let x = 5;
    for (let i = 0; i < 6; i++) {
      const w = 4 + ((i + row) % 3) * 1.5, h = 9 + ((i * 2 + row) % 3) * 2;
      out.push(r(x, y + 12 - h, w, h, 1, cols[(i + row * 2) % cols.length]!));
      x += w + 1.2;
    }
  });
  return { w: 44, h: 58, shapes: out };
};
export const poster = (i: number): FlatSprite => {
  const cols = [['#e98f3f', '#ffd166'], ['#4a90d9', '#9ad0ff'], ['#4fb477', '#b8f0c8']][i % 3]!;
  const art: Shape[][] = [
    [c(14, 18, 7, cols[1]!), p([2, 34, 12, 22, 24, 34], mix(cols[0]!, '#000000', 0.2))],
    [r(5, 8, 18, 3, 1.5, cols[1]!), r(5, 15, 12, 3, 1.5, cols[1]!), r(5, 22, 16, 3, 1.5, cols[1]!)],
    [e(14, 20, 8, 8, cols[1]!), c(14, 20, 3.5, cols[0]!)],
  ];
  return { w: 28, h: 38, shapes: [r(0, 0, 28, 38, 3, OFFICE.frame), r(2, 2, 24, 34, 2, cols[0]!), ...art[i % 3]!] };
};
export const plant = (): FlatSprite => ({ w: 28, h: 40, shapes: [
  e(14, 38, 11, 2.5, '#000000', 0.2), r(6, 26, 16, 13, 3.5, '#b86b4a'), r(5, 24, 18, 5, 2.5, '#cc7e5a'),
  e(7, 16, 5, 11, '#3f9a5b'), e(21, 16, 5, 11, '#3f9a5b'), e(14, 11, 5.5, 13, '#4fb477'), e(10, 18, 3, 8, '#5cc487'),
] });
export const cooler = (): FlatSprite => ({ w: 24, h: 44, shapes: [
  e(12, 42.5, 10, 2, '#000000', 0.2), r(2, 20, 20, 23, 3, '#dfe6f5'), r(2, 20, 20, 5, 3, '#c3cde6'), r(6, 29, 12, 9, 2, '#aeb9d6'), r(9, 32, 6, 3, 1.5, '#4a90d9'),
  r(3, 0, 18, 22, 6, '#8cc7ff', 0.85), r(3, 11, 18, 11, 3, '#5aa8f0', 0.9), c(8, 6, 1.4, '#ffffff', 0.7),
] });
export const bin = (): FlatSprite => ({ w: 18, h: 22, shapes: [
  e(9, 20.5, 8, 1.8, '#000000', 0.2), r(2, 6, 14, 15, 3, '#6b7288'), r(1, 3, 16, 5, 2.5, '#8089ad'), r(5, 10, 2, 8, 1, '#4f566b'), r(11, 10, 2, 8, 1, '#4f566b'),
] });
export const banner = (): FlatSprite => ({ w: 84, h: 34, shapes: [
  r(0, 0, 84, 34, 6, '#1f2542'), r(3, 3, 78, 28, 4, '#d9855c'),
  c(20, 17, 9, '#f4e4d4'), p([20, 6, 22.5, 14.5, 31, 17, 22.5, 19.5, 20, 28, 17.5, 19.5, 9, 17, 17.5, 14.5], '#d9855c'),
  r(36, 11, 38, 4, 2, '#f4e4d4'), r(36, 19, 26, 4, 2, '#f4e4d4', 0.7),
] });
export const calendar = (): FlatSprite => ({ w: 28, h: 36, shapes: [
  r(0, 0, 28, 36, 3, '#f4f6fb'), r(0, 0, 28, 9, 3, '#d9534f'), r(6, -2, 3, 6, 1.5, '#8089ad'), r(19, -2, 3, 6, 1.5, '#8089ad'),
  ...[0, 1, 2, 3, 4].flatMap((i) => [0, 1, 2].map((j) => r(4 + i * 4.4, 13 + j * 7, 3, 4, 1, (i + j * 5) % 7 === 3 ? '#d9534f' : '#a0a8c4'))),
] });
export const sofa = (): FlatSprite => ({ w: 104, h: 44, shapes: [
  e(52, 42, 48, 3, '#000000', 0.22), r(4, 4, 96, 24, 10, '#7b5fb5'), r(0, 18, 14, 24, 6, '#6a4fa0'), r(90, 18, 14, 24, 6, '#6a4fa0'),
  r(12, 22, 80, 18, 6, '#8e72c9'), r(14, 24, 38, 14, 5, '#9b80d4'), r(54, 24, 36, 14, 5, '#9b80d4'), r(4, 4, 96, 6, 3, '#a68be0', 0.6),
  r(20, 14, 16, 12, 5, '#ffd166'), r(70, 14, 16, 12, 5, '#ff9ac1'),
] });
export const table = (): FlatSprite => ({ w: 48, h: 24, shapes: [
  e(24, 22, 22, 2.5, '#000000', 0.2), r(2, 6, 44, 6, 3, '#e0a96d'), r(6, 12, 4, 10, 1.5, '#b87a45'), r(38, 12, 4, 10, 1.5, '#b87a45'),
  r(10, 1, 9, 6, 2, '#ffffff'), r(10, 1, 9, 2, 1, '#6f4e37'), r(26, 0, 12, 7, 2, '#f4efe6'), r(28, 2, 8, 1.4, 0.7, '#a7a3b3'),
] });
export const vending = (): FlatSprite => ({ w: 38, h: 60, shapes: [
  e(19, 58, 17, 2.5, '#000000', 0.22), r(0, 0, 38, 58, 5, '#d9534f'), r(3, 4, 24, 36, 3, '#1c2a52'), r(3, 4, 24, 12, 3, '#2c4078', 0.7),
  ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => r(6 + j * 11, 8 + i * 10.5, 8, 7, 2, ['#ffd166', '#4fb477', '#4a90d9', '#ff9ac1', '#e98f3f', '#8e6fc9'][i * 2 + j]!))),
  r(30, 6, 5, 4, 1.5, '#ffe9a8'), r(30, 14, 5, 4, 1.5, '#8089ad'), r(5, 44, 28, 9, 2.5, '#8c1f1c'),
] });
export const fridge = (): FlatSprite => ({ w: 34, h: 62, shapes: [
  e(17, 60, 15, 2.5, '#000000', 0.22), r(0, 0, 34, 60, 5, '#e6ebf5'), r(0, 21, 34, 2, 0, '#b8c2dc'), r(26, 8, 3, 9, 1.5, '#8089ad'), r(26, 28, 3, 16, 1.5, '#8089ad'),
  r(6, 6, 11, 8, 2, '#ffd166'), r(8, 30, 14, 10, 2, '#ff9ac1'),
] });
export const lamp = (): FlatSprite => ({ w: 22, h: 60, shapes: [
  e(11, 58, 8, 2, '#000000', 0.2), r(10, 18, 2.4, 40, 1.2, '#6b7288'), r(5, 56, 12, 3, 1.5, '#4f566b'), p([3, 18, 19, 18, 15, 2, 7, 2], '#f2d37a'), e(11, 20, 12, 8, '#ffe9a8', 0.18),
] });
export const beanbag = (): FlatSprite => ({ w: 40, h: 28, shapes: [
  e(20, 26, 18, 2.5, '#000000', 0.2), r(2, 6, 36, 20, 12, '#38a8a0'), e(20, 8, 13, 6, '#4cc3ba'), r(8, 10, 8, 3, 1.5, '#ffffff', 0.25),
] });
export const cat = (): FlatSprite => ({ w: 28, h: 16, shapes: [
  e(14, 14.5, 12, 1.8, '#000000', 0.2), e(13, 10, 11, 5.5, '#e98f3f'), c(23, 8, 5, '#e98f3f'), p([19.5, 4.5, 21, 0, 23.5, 4], '#e98f3f'), p([24, 4, 27, 0.5, 27.5, 5.5], '#e98f3f'),
  e(10, 11, 7, 3, '#f4a560', 0.7), r(1, 10, 6, 3, 1.5, '#e98f3f'), c(24.5, 8.2, 0.9, '#2a2238'),
] });
export const counter = (): FlatSprite => ({ w: 76, h: 48, shapes: [
  e(38, 46, 34, 2.5, '#000000', 0.2), r(0, 20, 76, 26, 3, '#b87a45'), r(0, 18, 76, 5, 2.5, '#e0a96d'), r(3, 26, 33, 17, 2, '#9a6838'), r(40, 26, 33, 17, 2, '#9a6838'),
  r(8, 3, 16, 16, 3, '#3a3f52'), r(10, 6, 12, 5, 2, '#f2b83d'), r(11, 14, 10, 6, 1, '#1d1a2e'), r(32, 8, 10, 11, 2.5, '#ffffff'), r(32, 8, 10, 3, 1.5, '#6f4e37'), r(50, 12, 18, 7, 2, '#c8cde0'), r(52, 14, 10, 3, 1.5, '#46d983'),
] });
export const station = (): FlatSprite => ({ w: 48, h: 44, shapes: [
  e(24, 42, 22, 2.5, '#000000', 0.2), r(2, 16, 44, 4, 2, '#c8cde0'), r(5, 20, 38, 22, 2, '#a7aec8'), r(8, 24, 32, 4, 1, '#8089ad'),
  r(8, 3, 32, 14, 4, '#e6ebf5'), r(12, 0, 24, 6, 2, '#f4f6fb'), r(16, 8, 16, 3, 1.5, '#8089ad'), c(36, 12, 1.6, '#46d983'),
] });
export const planterRow = (w: number): FlatSprite => {
  const out: Shape[] = [r(0, 8, w, 16, 4, '#8a6a4c'), r(0, 8, w, 4, 2, '#a07c5a')];
  for (let x = 14; x < w - 8; x += 30) out.push(e(x, 4, 8, 10, '#3f9a5b'), e(x + 6, 3, 6, 12, '#4fb477'), e(x - 5, 5, 5, 8, '#5cc487'));
  return { w, h: 24, shapes: out };
};

export interface Void { x: number; y: number; w: number; h: number }

// 靠後牆的三組家具；優先序決定放不下時留哪些，顯示順序從左到右
interface Zone { mat: string; items: () => FlatSprite[]; gap: number }
const ZONES: Record<'print' | 'pantry' | 'sofa', Zone> = {
  print: { mat: '#5a6a7a', items: () => [bookcase(), station(), bin()], gap: 8 },
  pantry: { mat: '#4a6a8a', items: () => [cooler(), counter(), fridge(), vending()], gap: 6 },
  sofa: { mat: '#6a4fa0', items: () => [sofa(), table(), lamp(), cat()], gap: 10 },
};
const ZONE_PRIORITY = ['sofa', 'pantry', 'print'] as const;
const ZONE_ORDER = ['print', 'pantry', 'sofa'] as const;
const ZONE_PAD = 12, WALL_LEFT = 70, WALL_RIGHT = 48, WALL_MIN_GAP = 10;
const zoneWidth = (z: Zone): number => z.items().reduce((n, it) => n + it.w, 0) + z.gap * (z.items().length - 1) + ZONE_PAD * 2;

/** 整間辦公室底圖（w×h 與遊戲世界座標相同）：地板、後牆與牆上物件、矮牆、靠牆家具、空地擺設、角落盆栽。島與桌子另外畫。 */
export function officeShell(w: number, h: number, voids: Void[] = []): FlatSprite {
  const O = OFFICE, side = O.side;
  const out: Shape[] = [r(0, 0, w, h, 0, O.floor)];
  const put = (spr: FlatSprite, x: number, y: number): void => void out.push(...shifted(spr.shapes, x, y));
  // 地板：棋盤淡色 + 磁磚線
  for (let ix = 0, x = side; x < w - side; ix++, x += 56)
    for (let iy = 0, y = FLOOR_TOP; y < h - side; iy++, y += 56)
      if ((ix + iy) % 2 === 0) out.push(r(x, y, Math.min(56, w - side - x), Math.min(56, h - side - y), 0, '#ffffff', 0.018));
  for (let x = side + 56; x < w - side; x += 56) out.push(r(x, FLOOR_TOP, 1, h - FLOOR_TOP - side, 0, '#ffffff', 0.035));
  for (let y = FLOOR_TOP + 56; y < h - side; y += 56) out.push(r(side, y, w - side * 2, 1, 0, '#ffffff', 0.035));
  // 後牆
  out.push(r(0, 0, w, O.wallH, 0, O.wall), r(0, 34, w, O.wallH - 34, 0, O.wainscot), r(0, 34, w, 2, 0, '#ffffff', 0.08), r(0, O.wallH, w, O.baseH, 0, O.base), r(0, FLOOR_TOP, w, 12, 0, '#000000', 0.14));
  // 左右、下矮牆
  out.push(r(0, 0, side, h, 0, O.wall), r(w - side, 0, side, h, 0, O.wall), r(0, h - side, w, side, 0, O.wall));
  out.push(r(side, FLOOR_TOP, 5, h - FLOOR_TOP - side, 0, '#000000', 0.12), r(w - side - 5, FLOOR_TOP, 5, h - FLOOR_TOP - side, 0, '#000000', 0.12), r(side, h - side - 5, w - side * 2, 5, 0, '#000000', 0.12));
  put(door(), 18, 2);
  put(clock(), w - side - 40, 10);

  // 靠牆家具：挑放得下的組，依顯示順序排，剩餘寬度平均分成間隔
  const avail = w - WALL_LEFT - WALL_RIGHT;
  const chosen: string[] = [];
  let used = 0;
  for (const name of ZONE_PRIORITY) {
    const zw = zoneWidth(ZONES[name]);
    if (used + zw + WALL_MIN_GAP * (chosen.length + 1) > avail) continue;
    chosen.push(name);
    used += zw;
  }
  const order = ZONE_ORDER.filter((n) => chosen.includes(n));
  const gap = (avail - used) / (order.length + 1);
  let x = WALL_LEFT + gap;
  let cursor = WALL_LEFT;
  const free: [number, number][] = []; // 牆上沒有家具的空段
  for (const name of order) {
    const z = ZONES[name], zw = zoneWidth(z);
    free.push([cursor, x]);
    out.push(r(x, 66, zw, 14, 7, z.mat, 0.3));
    let ix = x + ZONE_PAD;
    for (const it of z.items()) {
      put(it, ix, WALL_FEET - it.h);
      ix += it.w + z.gap;
    }
    cursor = x + zw;
    x += zw + gap;
  }
  free.push([cursor, w - WALL_RIGHT]);
  // 牆面：空段 ≥ 84 掛一件（窗、窗、白板、窗、旗幟、月曆加海報輪流）
  const hang = ['win', 'win', 'board', 'win', 'banner', 'cal'];
  let hi = 0, pi = 0;
  for (const [a0, b0] of free) {
    if (b0 - a0 < 84) continue;
    const cx = (a0 + b0) / 2, t = hang[hi++ % hang.length];
    out.push(e(cx, FLOOR_TOP + 10, 56, 7, '#ffe9a8', 0.045)); // 窗光落在地板上
    if (t === 'win') put(windowNight(), cx - 38, 6);
    else if (t === 'board') put(whiteboard(), cx - 38, 6);
    else if (t === 'banner') put(banner(), cx - 42, 10);
    else {
      put(calendar(), cx - 32, 9);
      put(poster(pi++), cx + 4, 9);
    }
  }
  // 島群空地：夠大擺閱讀角（懶骨頭、立燈、盆栽），其次擺長花槽
  for (const v of voids) {
    if (v.h >= 80 && v.w >= 120) {
      const bx = v.x + (v.w - 110) / 2, by = v.y + 40;
      put(beanbag(), bx, by);
      put(lamp(), bx + 52, by - 32);
      put(plant(), bx + 82, by - 12);
    } else if (v.h >= 50 && v.w >= 60) put(planterRow(Math.floor((v.w - 16) / 30) * 30 + 8), v.x + 8, v.y + 12);
  }
  // 下方兩角：盆栽
  put(plant(), side + 2, h - side - 44);
  put(plant(), w - side - 30, h - side - 44);
  return { w, h, shapes: out };
}
