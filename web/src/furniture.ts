// Claude 辦公室 · 2.5D 牆面掛件與靠牆家具（規格 §4–6）與擺放規則。
// 每個建構函式回傳 FlatSprite，座標原點 = 物件左緣 fx、牆面 fy = 0 的地板點（左牆物件 fx = 0；門與門墊用絕對 fx）。
// 落地物件帶 §16.5 的接地投影參數 shadow，由場景用 softShadow 畫。

import { baseCols, extent, FLOOR, isoBox, mix, quad, type FlatSprite, type Shape } from './flat.js';

type Cols = string | [string, string, string];
type Pt3 = [number, number, number];

const p = (pts: number[], c: string, a?: number): Shape => ({ t: 'p', pts, c, a });
const sprite = (shapes: Shape[], extra: Partial<FlatSprite> = {}): FlatSprite => {
  const x = extent({ w: 0, h: 0, shapes, ...extra });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes, ...extra };
};

/** 方塊：x 範圍 × fy 範圍 × z 範圍；cols 給基色或 [上, 左, 右]。 */
const B = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cols: Cols, a?: number): Shape[] => {
  const [t, l, r] = typeof cols === 'string' ? baseCols(cols) : cols;
  return isoBox(x0, y0, x1, y1, z0, z1, t, l, r, a);
};
/** 正面（fy = y 的垂直面）與頂面（高度 z 的水平面）上的細節。 */
const F = (x0: number, x1: number, z0: number, z1: number, y: number, c: string, a?: number): Shape => p(quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]), c, a);
const T = (x0: number, x1: number, y0: number, y1: number, z: number, c: string, a?: number): Shape => p(quad([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]), c, a);

/** 牆面座標（u 沿牆、d 離牆、z 高）：back 在 fy = 常數面，left 在 fx = 常數面。 */
const plane = (left = false) => {
  const m = (u: number, d: number, z: number): Pt3 => (left ? [d, u, z] : [u, d, z]);
  const poly = (pts: [number, number][], c: string, a?: number, d = 0): Shape => p(quad(pts.map(([u, z]) => m(u, d, z))), c, a);
  return {
    face: (u0: number, u1: number, z0: number, z1: number, c: string, a?: number, d = 0): Shape => poly([[u0, z0], [u1, z0], [u1, z1], [u0, z1]], c, a, d),
    poly,
    circ: (u: number, z: number, r: number, c: string, a?: number, d = 0): Shape =>
      poly(Array.from({ length: 24 }, (_, i): [number, number] => [u + r * Math.cos(i * Math.PI / 12), z + r * Math.sin(i * Math.PI / 12)]), c, a, d),
    box: (u0: number, u1: number, d0: number, d1: number, z0: number, z1: number, cols: Cols, a?: number): Shape[] =>
      (left ? B(d0, d1, u0, u1, z0, z1, cols, a) : B(u0, u1, d0, d1, z0, z1, cols, a)),
  };
};
const bk = plane();

/** 地上的橢圓（地板座標，28 點）。 */
const floorEll = (cx: number, cy: number, rx: number, ry: number, c: string, a?: number): Shape =>
  p(quad(Array.from({ length: 28 }, (_, i): Pt3 => [cx + rx * Math.cos(i * Math.PI / 14), cy + ry * Math.sin(i * Math.PI / 14), 0])), c, a);

const FRAME = '#2a3150';

// ---------- 門、時鐘（後牆） ----------
export function door(doorX: number): FlatSprite {
  const D = doorX;
  return sprite([
    bk.face(D - 22, D + 22, 0, 86, FRAME), bk.face(D - 18, D + 18, 0, 82, '#6b5a4a'), bk.face(D - 15, D + 15, 0, 79, '#7d6a58'), bk.face(D - 15, D + 15, 64, 79, '#8a7663'),
    bk.circ(D + 11, 40, 2.4, '#e8d9a8'),
    ...B(D - 16, D + 16, 0, 3, 90, 100, ['#2a8a5a', '#1f7a4d', '#17603c']), F(D - 13, D + 13, 92, 98, 3, '#7dffb2'),
  ]);
}
export function doorMat(doorX: number): FlatSprite {
  const D = doorX;
  return sprite([T(D - 24, D + 24, 2, 32, 0, '#4a3d33'), T(D - 20, D + 20, 5, 29, 0, '#5e4c3e'), T(D - 20, D + 20, 10, 12, 0, '#4a3d33'), T(D - 20, D + 20, 22, 24, 0, '#4a3d33')]);
}
export function clock(): FlatSprite {
  return sprite([bk.circ(15, 82, 15, FRAME), bk.circ(15, 82, 12, '#f4efe6'), bk.face(14, 16, 82, 91, FRAME), bk.face(15, 22, 81, 83, FRAME), bk.circ(15, 82, 1.8, '#d9534f')]);
}

// ---------- 窗 ----------
function windowSprite(left: boolean): FlatSprite {
  const w = plane(left);
  return sprite([
    floorEll(...(left ? [26, 48, 22, 58] : [48, 26, 58, 22]) as [number, number, number, number], '#ffe9a8', 0.045),
    ...w.box(-4, 100, 0, 6, 33, 38, ['#6a76a6', '#5a6590', '#4d5782']),
    w.face(0, 96, 38, 94, FRAME), w.face(5, 91, 43, 89, '#1c2a52'), w.face(5, 91, 70, 89, '#2c4078', 0.7),
    w.poly([[5, 43], [40, 43], [22, 62]], '#243660', 0.9), w.poly([[30, 43], [91, 43], [62, 66]], '#243660', 0.9),
    w.face(47, 49, 43, 89, FRAME),
    w.circ(16, 82, 1.3, '#ffffff'), w.circ(60, 84, 1, '#ffffff'), w.circ(78, 78, 1.2, '#ffffff'), w.circ(30, 80, 2.4, '#ffe9a8'),
  ]);
}
export const nightWindow = (): FlatSprite => windowSprite(false);
export const leftWindow = (): FlatSprite => windowSprite(true);

// ---------- 掛件 ----------
export function whiteboard(): FlatSprite {
  return sprite([
    bk.face(0, 96, 36, 88, '#9aa3c4'), bk.face(4, 92, 40, 84, '#f4f6fb'), bk.face(4, 92, 76, 84, '#ffffff', 0.7),
    bk.face(10, 52, 68, 70.5, '#4a90d9'), bk.face(10, 44, 60, 62.5, '#a0a8c4'), bk.face(10, 36, 52, 54.5, '#e98f3f'),
    bk.face(64, 84, 60, 78, '#ffd166'), bk.circ(79, 73, 3.5, '#d9534f'),
    ...B(8, 88, 0, 5, 33, 36, '#8089ad'),
  ]);
}
export function banner(): FlatSprite {
  const star = Array.from({ length: 16 }, (_, i): [number, number] => { const r = i % 2 ? 4 : 12, an = i * Math.PI / 8 - Math.PI / 2; return [26 + r * Math.cos(an), 72 + r * Math.sin(an)]; });
  return sprite([bk.face(0, 104, 52, 92, '#1f2542'), bk.face(4, 100, 56, 88, '#d9855c'), bk.poly(star, '#f4e4d4'), bk.face(44, 96, 74, 78, '#f4e4d4'), bk.face(44, 78, 66, 70, '#f4e4d4', 0.7)]);
}
const POSTERS: [string, string][] = [['#e98f3f', '#ffd166'], ['#4a90d9', '#9ad0ff'], ['#4fb477', '#b8f0c8']];
/** pair：海報配色輪流（三組）。 */
export function calendarPoster(pair = 0): FlatSprite {
  const [frame, inner] = POSTERS[pair % 3]!;
  const out: Shape[] = [bk.face(0, 32, 48, 90, '#f4f6fb'), bk.face(0, 32, 80, 90, '#d9534f')];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) out.push(bk.face(3 + i * 5.4, 7 + i * 5.4, 52 + j * 8, 57 + j * 8, i === 2 && j === 1 ? '#d9534f' : '#a0a8c4'));
  out.push(bk.face(42, 74, 46, 92, frame), bk.face(45, 71, 49, 89, inner));
  return sprite(out);
}

// ---------- 靠牆家具（原點 = 左緣 fx、牆 fy = 0） ----------
const SHELF_BOOKS = ['#d9534f', '#4a90d9', '#e6c34a', '#4fb477', '#8e6fc9', '#e98f3f', '#38a8a0'];
export function bookshelf(): FlatSprite {
  const out: Shape[] = [...B(0, 44, 4, 24, 0, 72, ['#8a6650', '#6a4a38', '#523829']), F(3, 41, 3, 69, 24, '#4a3328')];
  let k = 0;
  for (const z of [3, 25, 47]) {
    out.push(F(3, 41, z, z + 2.5, 24, '#6a4a38'));
    for (let x = 4; ; k++) {
      const bw = [4, 5.5, 7][k % 3]!;
      if (x + bw > 40) break;
      out.push(F(x, x + bw, z + 2.5, z + 2.5 + [12, 15, 18][k % 3]!, 24, SHELF_BOOKS[k % 7]!));
      x += bw + 1.2;
    }
  }
  return sprite(out, { shadow: { fx: 22, fy: 16, r: 26 } });
}
export function copier(): FlatSprite {
  return sprite([
    ...B(0, 40, 4, 30, 0, 28, ['#c8cde0', '#a7aec8', '#8a91ab']), ...B(3, 37, 6, 28, 28, 34, ['#f4f6fb', '#e6ebf5', '#cdd3e3']),
    F(6, 34, 16, 20, 30, '#8089ad'), F(6, 34, 4, 12, 30, '#9aa1bb'), T(10, 28, 10, 22, 34, '#ffffff'), bk.circ(34, 24, 1.6, '#46d983', 1, 30),
  ], { shadow: { fx: 20, fy: 19, r: 24 } });
}
export function bin(): FlatSprite {
  return sprite([...B(0, 14, 10, 24, 0, 18, ['#8089ad', '#6b7288', '#4f566b']), T(1.5, 12.5, 11.5, 22.5, 18, '#3a3f52'), F(3.5, 5, 2, 15, 24, '#4f566b'), F(9, 10.5, 2, 15, 24, '#4f566b')],
    { shadow: { fx: 7, fy: 19, r: 11 } });
}
export function waterCooler(): FlatSprite {
  return sprite([
    ...B(0, 18, 6, 24, 0, 30, ['#f4f6fb', '#dfe6f5', '#c3cde6']), F(4, 14, 10, 18, 24, '#aeb9d6'), F(7, 11, 12, 15, 24, '#4a90d9'),
    ...B(2, 16, 8, 22, 30, 41, ['#8cc7ff', '#5aa8f0', '#4a90d9'], 0.95), ...B(2, 16, 8, 22, 41, 50, ['#cfe8ff', '#a8d6ff', '#8cc7ff'], 0.85),
  ], { shadow: { fx: 9, fy: 17, r: 13 } });
}
export function counter(): FlatSprite {
  return sprite([
    ...B(0, 70, 4, 30, 0, 30, ['#e0a96d', '#b87a45', '#9a6838']), F(3, 34, 3, 27, 30, '#a8703e'), F(36, 67, 3, 27, 30, '#a8703e'),
    F(30, 32, 12, 18, 30, '#e8d9a8'), F(38, 40, 12, 18, 30, '#e8d9a8'),
    ...B(-1, 71, 3, 31, 30, 34, ['#f0c48a', '#e0a96d', '#c48a50']),
    ...B(6, 20, 8, 22, 34, 52, ['#4a5068', '#3a3f52', '#2c3042']), F(9, 17, 44, 48, 22, '#f2b83d'),
    ...B(26, 32, 14, 20, 34, 42, ['#6f4e37', '#ffffff', '#ffffff']),
    ...B(42, 64, 8, 24, 34, 40, ['#c8cde0', '#a7aec8', '#8a91ab']), bk.circ(60, 37, 1.4, '#46d983', 1, 24),
  ], { shadow: { fx: 35, fy: 19, r: 39 } });
}
export function fridge(): FlatSprite {
  return sprite([
    ...B(0, 32, 4, 32, 0, 80, ['#f4f6fb', '#e6ebf5', '#c3cde6']), F(0, 32, 54, 55, 32, '#b8c2dc'), F(26, 28, 58, 72, 32, '#8089ad'), F(26, 28, 36, 50, 32, '#8089ad'),
    F(6, 10, 60, 64, 32, '#ffd166'), F(12, 16, 66, 70, 32, '#ff9ac1'),
  ], { shadow: { fx: 16, fy: 20, r: 20 } });
}
export function vending(): FlatSprite {
  const out: Shape[] = [...B(0, 36, 4, 30, 0, 84, ['#e57773', '#d9534f', '#b23f3c']), F(3, 25, 28, 80, 30, '#1c2a52'), F(3, 25, 60, 80, 30, '#2c4078', 0.7)];
  ['#ffd166', '#4fb477', '#4a90d9', '#ff9ac1', '#e98f3f', '#8e6fc9'].forEach((c, i) => out.push(F(5 + (i % 3) * 7, 10 + (i % 3) * 7, i < 3 ? 66 : 46, i < 3 ? 76 : 56, 30, c)));
  out.push(F(28, 32, 60, 64, 30, '#ffe9a8'), F(28, 32, 50, 54, 30, '#8089ad'), F(6, 26, 8, 18, 30, '#8c1f1c'));
  return sprite(out, { shadow: { fx: 18, fy: 19, r: 22 } });
}
export function sofa(): FlatSprite {
  return sprite([
    ...B(0, 100, 4, 14, 0, 38, ['#a68be0', '#7b5fb5', '#6a4fa0']), ...B(10, 90, 14, 40, 0, 16, ['#9b80d4', '#8e72c9', '#7b5fb5']), F(49.5, 50.5, 0, 16, 40, '#6a4fa0'),
    ...B(0, 12, 14, 40, 0, 24, ['#8e72c9', '#6a4fa0', '#5a4290']), ...B(88, 100, 14, 40, 0, 24, ['#8e72c9', '#6a4fa0', '#5a4290']),
    ...B(16, 30, 16, 24, 16, 28, ['#ffe08a', '#ffd166', '#e6b84a']), ...B(70, 84, 16, 24, 16, 28, ['#ffb3d1', '#ff9ac1', '#e57fa6']),
  ], { shadow: { fx: 50, fy: 24, r: 54 } });
}
export function sideTable(): FlatSprite {
  return sprite([
    ...[[0, 8], [27, 8], [0, 31], [27, 31]].flatMap(([x, y]) => B(x!, x! + 3, y!, y! + 3, 0, 16, '#b87a45')),
    ...B(0, 30, 8, 34, 16, 19, ['#f0c48a', '#e0a96d', '#c48a50']), ...B(4, 16, 14, 24, 19, 22, ['#6aa8ea', '#4a90d9', '#3a78bd']), ...B(20, 25, 18, 23, 19, 24, ['#6f4e37', '#ffffff', '#ffffff']),
  ], { shadow: { fx: 15, fy: 23, r: 19 } });
}
export function floorLamp(): FlatSprite {
  const g = quad([[7, 11, 58]]);
  return sprite([
    floorEll(7, 11, 34, 26, '#ffe9a8', 0.07), { t: 'c', x: g[0]!, y: g[1]!, r: 24, c: '#ffe9a8', a: 0.14 },
    ...B(1, 13, 5, 17, 0, 3, ['#6b7288', '#4f566b', '#3f4558']), ...B(6, 8, 10, 12, 3, 54, '#6b7288'), ...B(0, 14, 4, 18, 52, 64, ['#ffe9a8', '#f2d37a', '#d9b65a']),
  ], { shadow: { fx: 7, fy: 12, r: 11 } });
}

// ---------- 貓與盆栽葉（看板，clay = figure）：舊 office.js 素材縮放後對到地板點 ----------
const xf = (shapes: Shape[], ox: number, oy: number, ax: number, ay: number, s: number): Shape[] =>
  shapes.map((sh): Shape => {
    const X = (v: number): number => ox + (v - ax) * s, Y = (v: number): number => oy + (v - ay) * s;
    if (sh.t === 'r') return { ...sh, x: X(sh.x), y: Y(sh.y), w: sh.w * s, h: sh.h * s, r: (sh.r ?? 0) * s };
    if (sh.t === 'c') return { ...sh, x: X(sh.x), y: Y(sh.y), r: sh.r * s };
    if (sh.t === 'e') return { ...sh, x: X(sh.x), y: Y(sh.y), rx: sh.rx * s, ry: sh.ry * s };
    return { ...sh, pts: sh.pts.map((v, i) => (i % 2 ? Y(v) : X(v))) };
  });
const e = (x: number, y: number, rx: number, ry: number, c: string, a?: number): Shape => ({ t: 'e', x, y, rx, ry, c, a });
const circle = (x: number, y: number, r: number, c: string): Shape => ({ t: 'c', x, y, r, c });
const CAT = '#e98f3f';

export function cat(): FlatSprite {
  const a = quad([[14, 22, 0]]);
  const shapes = xf([
    e(13, 10, 11, 5.5, CAT), circle(23, 8, 5, CAT), p([19.5, 4.5, 21, 0, 23.5, 4], CAT), p([24, 4, 27, 0.5, 27.5, 5.5], CAT),
    e(10, 11, 7, 3, '#f4a560', 0.7), { t: 'r', x: 1, y: 10, w: 6, h: 3, r: 1.5, c: CAT }, circle(24.5, 8.2, 0.9, '#2a2238'),
  ], a[0]!, a[1]!, 14, 14.5, 1.2);
  return sprite(shapes, { clay: 'figure', shadow: { fx: 14, fy: 22, r: 8.5 } }); // r 8.5 ≈ rx 12、ry 6
}

const LEAVES = ['#3f9a5b', '#3f9a5b', '#4fb477', '#5cc487'];
/** 盆：18×18×16（小）／24×24×22（大）；原點 = 盆左緣、靠牆側。 */
export function plantPot(big: boolean): FlatSprite {
  const w = big ? 24 : 18, h = big ? 22 : 16;
  return sprite([...B(0, w, 0, w, 0, h, ['#cc7e5a', '#b86b4a', '#9a573c']), T(1.5, w - 1.5, 1.5, w - 1.5, h, '#5a3d2e')], { shadow: { fx: w / 2, fy: w / 2, r: w * 0.8 } });
}
export function plantLeaves(big: boolean): FlatSprite {
  const w = big ? 24 : 18, h = big ? 22 : 16, a = quad([[w / 2, w / 2, h]]);
  const shapes = xf([e(7, 16, 5, 11, LEAVES[0]!), e(21, 16, 5, 11, LEAVES[1]!), e(14, 11, 5.5, 13, LEAVES[2]!), e(10, 18, 3, 8, LEAVES[3]!)], a[0]!, a[1]!, 14, 25, big ? 1.9 : 1.2);
  return sprite(shapes, { clay: 'figure' });
}

/** 區域地墊（規格 §5）：fx 0…width、fy 2–44；外層混色 0.45、內縮 4 混色 0.3。 */
export function zoneMat(width: number, color: string): FlatSprite {
  return sprite([T(0, width, 2, 44, 0, mix(FLOOR, color, 0.45)), T(4, width - 4, 6, 40, 0, mix(FLOOR, color, 0.3))]);
}

// ---------- 擺放 ----------
export interface Placed {
  id: string; make: () => FlatSprite;
  fx: number; fy: number; depth: number; wall?: 'back' | 'left';
  w: number; // 沿牆佔寬（fx 方向，左牆物件為 fy 方向）
}

interface Item { id: string; make: () => FlatSprite; w: number; y0: number; y1: number }
const ZONES: { mat: string; gap: number; items: Item[] }[] = [
  { mat: '#5a6a7a', gap: 8, items: [{ id: 'bookshelf', make: bookshelf, w: 44, y0: 4, y1: 24 }, { id: 'copier', make: copier, w: 40, y0: 4, y1: 30 }, { id: 'bin', make: bin, w: 14, y0: 10, y1: 24 }] },
  { mat: '#4a6a8a', gap: 6, items: [{ id: 'waterCooler', make: waterCooler, w: 18, y0: 6, y1: 24 }, { id: 'counter', make: counter, w: 70, y0: 3, y1: 31 }, { id: 'fridge', make: fridge, w: 32, y0: 4, y1: 32 }, { id: 'vending', make: vending, w: 36, y0: 4, y1: 30 }] },
  { mat: '#6a4fa0', gap: 10, items: [{ id: 'sofa', make: sofa, w: 100, y0: 4, y1: 40 }, { id: 'sideTable', make: sideTable, w: 30, y0: 8, y1: 34 }, { id: 'floorLamp', make: floorLamp, w: 14, y0: 4, y1: 18 }, { id: 'cat', make: cat, w: 28, y0: 15, y1: 29 }] },
];
const WALL_DEPTH = -55, MAT_DEPTH = -95, ZONE_PAD = 12, SPAN = 112, FIRST = 160;

export function planWall(w: number, h: number, rowYs: number[], doorX: number): Placed[] {
  const out: Placed[] = [];
  const hang = (id: string, make: () => FlatSprite, fx: number, width: number, wall: 'back' | 'left' = 'back', fy = 0): void => {
    out.push({ id, make, fx: wall === 'left' ? 0 : fx, fy: wall === 'left' ? fx : fy, depth: WALL_DEPTH, wall, w: width });
  };
  const plant = (big: boolean, fx: number, fy: number, wall?: 'left'): void => {
    const sz = big ? 24 : 18, id = big ? 'big' : 'small', depth = fx + sz / 2 + fy + sz; // 盆前緣中點
    out.push({ id: `plantPot-${id}`, make: () => plantPot(big), fx, fy, depth, wall, w: sz }, { id: `plantLeaves-${id}`, make: () => plantLeaves(big), fx, fy, depth: depth + 0.5, wall, w: sz });
  };
  out.push({ id: 'doorMat', make: () => doorMat(doorX), fx: 0, fy: 0, depth: MAT_DEPTH, w: doorX + 24 });
  hang('door', () => door(doorX), 0, doorX + 22);
  hang('clock', clock, doorX + 82 - 15, 30);

  const span = (id: string, make: () => FlatSprite, x: number): void => hang(id, make, x + 8, 96);
  let x = FIRST;
  const zone = (z: (typeof ZONES)[number]): void => {
    const zw = z.items.reduce((s, it) => s + it.w, 0) + z.gap * (z.items.length - 1) + ZONE_PAD * 2;
    out.push({ id: 'zoneMat', make: () => zoneMat(zw, z.mat), fx: x, fy: 0, depth: MAT_DEPTH, w: zw });
    let ix = x + ZONE_PAD;
    for (const it of z.items) {
      out.push({ id: it.id, make: it.make, fx: ix, fy: 0, depth: ix + it.w / 2 + it.y1, w: it.w });
      ix += it.w + z.gap;
    }
    x += zw;
  };
  zone(ZONES[0]!); span('nightWindow', nightWindow, x); x += SPAN;
  zone(ZONES[1]!); span('whiteboard', whiteboard, x); x += SPAN;
  zone(ZONES[2]!);
  plant(true, x + 4, 6);
  x += 4 + 24 + 16;

  const extras: [string, () => FlatSprite, number][] = [['banner', banner, 104], ['calendarPoster', calendarPoster, 74], ['nightWindow', nightWindow, 96]];
  for (let i = 0; x + extras[i % 3]![2] <= w - 20; i++, x += 130) {
    const [id, make, width] = extras[i % 3]!, k = Math.floor(i / 3);
    hang(id, id === 'calendarPoster' ? () => calendarPoster(k) : make, x, width);
  }

  for (let v = 150; v + 96 <= h - 30; v += 240) hang('leftWindow', leftWindow, v, 96, 'left');
  for (const y of rowYs) plant(false, 6, y + 34, 'left');
  return out;
}
