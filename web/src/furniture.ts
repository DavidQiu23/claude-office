// Claude 辦公室 · 正面家具與後牆窗（剖面大樓）。
// 每個建構函式回傳正面 FlatSprite，原點 = 物件底邊中點（地板線）；x 從中線往左右、y 往上是負的。
// 落地家具帶正面接地投影 shadow（中心在原點），由 sprites.ts 用 softShadow 畫。配色沿用舊等角家具的夜間配色。

import { GEO } from './floors.js';
import { extent, type FlatSprite, type Shape } from './flat.js';

const r = (x: number, y: number, w: number, h: number, rad: number, c: string, a?: number): Shape => ({ t: 'r', x, y, w, h, r: rad, c, a });
const c = (x: number, y: number, rad: number, col: string, a?: number): Shape => ({ t: 'c', x, y, r: rad, c: col, a });
const e = (x: number, y: number, rx: number, ry: number, col: string, a?: number): Shape => ({ t: 'e', x, y, rx, ry, c: col, a });
const p = (pts: number[], col: string, a?: number): Shape => ({ t: 'p', pts, c: col, a });
const sprite = (shapes: Shape[], extra: Partial<FlatSprite> = {}): FlatSprite => {
  const x = extent({ w: 0, h: 0, shapes, ...extra });
  return { w: x.x1 - x.x0, h: x.y1 - x.y0, shapes, ...extra };
};
/** 落地家具：投影中心在原點（地板線中點），半徑 = 半寬 */
const floorItem = (shapes: Shape[], r0: number, clay?: FlatSprite['clay']): FlatSprite => sprite(shapes, { shadow: { fx: 0, fy: 0, r: r0 }, ...(clay ? { clay } : {}) });

const FRAME = '#2a3150';

// ---------- 茶水間 ----------
/** 飲水機：寬 28、高 78 */
export function waterCooler(): FlatSprite {
  return floorItem([
    r(-12, -6, 24, 6, 1.5, '#c3cde6'), // 底座
    r(-14, -48, 28, 43, 4, '#dfe6f5'), r(-12, -46, 5, 38, 2.5, '#f4f6fb'), // 機身與亮邊
    r(-8, -40, 16, 13, 2, '#aeb9d6'), r(-6, -38, 4, 4, 1, '#4a90d9'), r(2, -38, 4, 4, 1, '#d9534f'), r(-7, -29.5, 14, 2, 1, '#8089ad'), // 出水口
    r(-12, -52, 24, 4, 1.5, '#c3cde6'), r(-4, -55, 8, 4, 1, '#a8d6ff'), // 機頂、瓶口
    r(-11, -78, 22, 24, 8, '#cfe8ff', 0.85), r(-10, -68, 20, 13, 6, '#8cc7ff', 0.9), r(-8, -75, 3, 16, 1.5, '#ffffff', 0.5), // 水桶
  ], 14);
}

const SNACKS = ['#ffd166', '#4fb477', '#4a90d9', '#ff9ac1', '#e98f3f', '#8e6fc9', '#38a8a0', '#ffd166', '#d9534f'];
/** 販賣機：寬 56、高 112；左邊亮著的商品窗、右邊投幣與按鈕 */
export function vending(): FlatSprite {
  const out: Shape[] = [
    r(-26, -3, 8, 3, 1, '#3f4558'), r(18, -3, 8, 3, 1, '#3f4558'), // 腳
    r(-28, -112, 56, 110, 4, '#d9534f'), r(-26, -110, 4, 104, 2, '#e57773'), // 機身與亮邊
    r(-24, -108, 48, 10, 2, '#b23f3c'), r(-20, -106, 40, 6, 2, '#ffe9a8'), // 燈箱
    r(-24, -94, 34, 62, 2, '#1c2a52'),
  ];
  SNACKS.forEach((col, i) => {
    const x = -21 + (i % 3) * 10.5, y = -88 + Math.floor(i / 3) * 20;
    out.push(r(x, y, 7, 12, 2, col));
  });
  for (const y of [-75.5, -55.5, -35.5]) out.push(r(-23, y, 32, 1.5, 0.5, '#8089ad')); // 層板
  out.push(
    r(-24, -94, 34, 22, 2, '#2c4078', 0.5), // 玻璃反光
    r(14, -88, 8, 12, 1.5, '#8089ad'), r(17, -85, 2, 6, 1, '#3a3f52'), // 投幣口
    r(15, -70, 6, 4, 1, '#ffe9a8'), r(15, -63, 6, 4, 1, '#46d983'), r(15, -56, 6, 4, 1, '#ffe9a8'), // 按鈕
    r(-22, -26, 44, 13, 2, '#8c1f1c'), r(-19, -23, 38, 7, 1.5, '#5a1414'), // 取物口
  );
  return floorItem(out, 28);
}

const LEAVES = ['#3f9a5b', '#4fb477', '#5cc487'];
/** 盆栽：寬 34、高 74（陶盆＋一叢葉子，clay = figure） */
export function plant(): FlatSprite {
  return floorItem([
    e(-10, -48, 7, 17, LEAVES[0]!), e(10, -48, 7, 17, LEAVES[0]!), c(-11, -36, 6, LEAVES[1]!), c(11, -36, 6, LEAVES[1]!),
    e(0, -56, 8, 18, LEAVES[1]!), e(-4, -42, 5, 11, LEAVES[2]!), e(5, -40, 5, 10, LEAVES[2]!),
    p([-12, -24, 12, -24, 9, 0, -9, 0], '#b86b4a'), // 陶盆
    r(-14, -29, 28, 6, 2.5, '#cc7e5a'), e(0, -29, 10, 1.6, '#5a3d2e'), // 盆緣、土
  ], 13, 'figure');
}

// ---------- 書房、影印 ----------
const SHELF_BOOKS = ['#d9534f', '#4a90d9', '#e6c34a', '#4fb477', '#8e6fc9', '#e98f3f', '#38a8a0'];
/** 書櫃：寬 60、高 104，三層書 */
export function bookshelf(): FlatSprite {
  const out: Shape[] = [
    r(-30, -104, 60, 104, 3, '#6a4a38'), r(-26, -98, 52, 92, 1.5, '#4a3328'), // 外框、內背板
    r(-30, -104, 60, 6, 2, '#8a6650'), r(-30, -6, 60, 6, 2, '#523829'), // 頂板、底座
    r(-26, -38.5, 52, 2.5, 0.8, '#8a6650'), r(-26, -70.5, 52, 2.5, 0.8, '#8a6650'), // 層板
  ];
  let k = 0;
  for (const floor of [-6, -36, -68]) { // 每層書的底（層板上緣）
    for (let x = -25; ; k++) {
      const bw = [4, 5.5, 7][k % 3]!, bh = [16, 20, 24][k % 3]!;
      if (x + bw > 25) break;
      out.push(r(x, floor - bh, bw, bh, 1, SHELF_BOOKS[k % 7]!));
      x += bw + 1.2;
    }
  }
  return floorItem(out, 30);
}

/** 影印機：寬 50、高 68 */
export function copier(): FlatSprite {
  return floorItem([
    r(-23, -4, 46, 4, 1, '#8a91ab'), // 底座
    r(-25, -50, 50, 47, 4, '#c8cde0'),
    r(-21, -31, 42, 12, 2, '#a7aec8'), r(-21, -17, 42, 12, 2, '#a7aec8'), r(-6, -27, 12, 2, 1, '#8089ad'), r(-6, -13, 12, 2, 1, '#8089ad'), // 紙匣
    r(-14, -46, 28, 4, 1, '#ffffff'), // 出紙
    r(-23, -62, 46, 13, 3, '#f4f6fb'), r(-25, -68, 50, 6, 2, '#e6ebf5'), // 掃描器與上蓋
    r(8, -59, 13, 6, 1.5, '#8089ad'), c(18, -56, 1.4, '#46d983'), // 操作面板
  ], 25);
}

// ---------- 休息區 ----------
/** 沙發：寬 92、高 46，兩個抱枕 */
export function sofa(): FlatSprite {
  return floorItem([
    r(-40, -4, 4, 4, 1, '#3a2a55'), r(36, -4, 4, 4, 1, '#3a2a55'), // 腳
    r(-44, -46, 88, 28, 8, '#7b5fb5'), r(-42, -45, 84, 4, 2, '#a68be0'), // 椅背
    r(-40, -15, 80, 11, 3, '#6a4fa0'), // 座框
    r(-36, -25, 35.5, 12, 4, '#8e72c9'), r(0.5, -25, 35.5, 12, 4, '#8e72c9'), // 坐墊
    r(-32, -37, 16, 13, 4, '#ffd166'), r(16, -37, 16, 13, 4, '#ff9ac1'), // 抱枕
    r(-46, -33, 12, 29, 5, '#8e72c9'), r(34, -33, 12, 29, 5, '#8e72c9'), // 扶手
  ], 44);
}

/** 立燈：寬 28、高 104，燈罩發光 */
export function floorLamp(): FlatSprite {
  return floorItem([
    c(0, -88, 14, '#ffe9a8', 0.18), // 光暈
    r(-10, -3, 20, 3, 1.5, '#4f566b'), r(-1.5, -86, 3, 84, 1.5, '#6b7288'), // 底座、燈桿
    p([-8, -102, 8, -102, 13, -85, -13, -85], '#f2d37a'), r(-6, -101, 12, 2, 1, '#ffe9a8'), r(-13, -86, 26, 2, 1, '#d9b65a'), // 燈罩
    e(0, -82, 10, 2.5, '#ffe9a8', 0.6),
  ], 10);
}

/** 邊桌：寬 30、高 37，桌上一杯咖啡與一本書 */
export function sideTable(): FlatSprite {
  return floorItem([
    r(-12, -27, 3, 27, 1, '#b87a45'), r(9, -27, 3, 27, 1, '#b87a45'), // 桌腳
    r(-11, -10, 22, 2.5, 1, '#c48a50'), r(-8, -14, 12, 4, 1, '#4a90d9'), // 下層與書
    r(-15, -30, 30, 4, 1.5, '#e0a96d'), r(-14, -27, 28, 2, 1, '#c48a50'), // 桌面
    r(-12, -33, 10, 3, 1, '#d9534f'), // 書
    r(7.5, -35, 2.5, 4, 1.2, '#e3e6ee'), r(2, -37, 6, 7, 1.5, '#ffffff'), r(2.6, -36.4, 4.8, 1.4, 0.7, '#6f4e37'), // 杯子
  ], 14);
}

// ---------- 後牆夜景窗 ----------
/** 夜景窗：窗框 64×46、窗台寬 70；原點 = 窗台底邊中點。玻璃裡是遠方的樓與幾點燈、星星 */
export function nightWindow(): FlatSprite {
  return sprite([
    r(-32, -52, 64, 47, 3, FRAME),
    r(-28, -48, 56, 40, 1.5, '#1c2a52'), r(-28, -22, 56, 14, 1.5, '#2c4078', 0.8), // 玻璃、近地平線的光
    c(-18, -42, 0.9, '#ffffff'), c(9, -44, 0.7, '#ffffff', 0.8), c(22, -38, 0.8, '#ffffff'), c(-6, -36, 0.6, '#ffffff', 0.7),
    r(-27, -19, 10, 11, 0, '#16204a'), r(-15, -26, 9, 18, 0, '#141c3a'), r(3, -17, 11, 9, 0, '#16204a'), r(16, -24, 10, 16, 0, '#141c3a'), // 遠方的樓
    r(-12, -22, 1.6, 1.6, 0, '#ffe9a8', 0.8), r(-9, -16, 1.6, 1.6, 0, '#ffe9a8', 0.6), r(19, -20, 1.6, 1.6, 0, '#ffe9a8', 0.8), r(-23, -15, 1.6, 1.6, 0, '#ffe9a8', 0.5),
    p([-28, -48, -16, -48, -28, -33], '#ffffff', 0.08), // 反光
    r(-1.5, -48, 3, 40, 0.8, FRAME), // 中間窗框
    r(-35, -6, 70, 6, 2, '#5a6590'), r(-33, -5.5, 66, 1.5, 0.7, '#6a76a6'), // 窗台
  ]);
}

// ---------- 家具組（右端家具區） ----------
export interface FurnItem { id: string; make: () => FlatSprite }
export const SETS: { id: string; items: FurnItem[] }[] = [
  { id: 'pantry', items: [{ id: 'waterCooler', make: waterCooler }, { id: 'vending', make: vending }, { id: 'plant', make: plant }] },
  { id: 'library', items: [{ id: 'bookshelf', make: bookshelf }, { id: 'copier', make: copier }, { id: 'plant', make: plant }] },
  { id: 'lounge', items: [{ id: 'floorLamp', make: floorLamp }, { id: 'sofa', make: sofa }, { id: 'sideTable', make: sideTable }] },
  { id: 'reading', items: [{ id: 'bookshelf', make: bookshelf }, { id: 'sideTable', make: sideTable }, { id: 'floorLamp', make: floorLamp }] },
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
  const ext = set.items.map((it) => extent(it.make()));
  const total = ext.reduce((a, x) => a + x.x1 - x.x0, 0) + FURN_GAP * (set.items.length - 1);
  let left = (GEO.furnitureW - total) / 2;
  return set.items.map((it, i) => {
    const x = ext[i]!;
    const at = left - x.x0;
    left += x.x1 - x.x0 + FURN_GAP;
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
