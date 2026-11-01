// 日式漫畫風物件：桌子、窗、右端家具。純函式產生 SVG 字串（不碰 DOM），defsSvg() 放進頁面共用的隱藏 <svg>，再用 <use href="#id"> 擺上去。
// 座標：原點 = 底邊中點，x 往右、y 往上是負的；symbol 的 viewBox = `${-w/2} ${-h} ${w} ${h}`。
// 顏色規則：一律寫在 style 或 class（mk／mk-thin／tone／ink），不用 fill="色"／stroke="色" 屬性。
// 文件的 CSS 選擇器進不了 <use> 的影子樹，所以依日夜顯示的群組用 style="opacity:var(--day)"／"opacity:var(--night)"（繼承的變數進得去）。
import { circle, ellipse, fill, line, path, rect, tag } from './svg.js';

export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';
export type FurnitureId = 'waterCooler' | 'vending' | 'plant' | 'bookshelf' | 'copier' | 'sofa' | 'floorLamp' | 'sideTable';
export type ObjectId = `desk-${DeskState}` | 'window' | FurnitureId;
/** 原點 = 底邊中點；symbol 的 viewBox = `${-w/2} ${-h} ${w} ${h}`；standX = 人使用它時站的 x 偏移（子專案 2 用） */
export interface ObjectSpec { w: number; h: number; standX: number }

const DESK: ObjectSpec = { w: 112, h: 76, standX: 0 }; // 放在座位中心、底邊在樓層 y 192
export const OBJECTS: Record<ObjectId, ObjectSpec> = {
  'desk-empty': DESK,
  'desk-working': DESK,
  'desk-waiting': DESK,
  'desk-idle': DESK,
  window: { w: 70, h: 52, standX: 0 },
  waterCooler: { w: 28, h: 78, standX: 0 },
  vending: { w: 56, h: 112, standX: 10 }, // 站在投幣口與按鈕前
  plant: { w: 34, h: 74, standX: -22 }, // 站在旁邊澆水
  bookshelf: { w: 60, h: 104, standX: 0 },
  copier: { w: 50, h: 68, standX: 0 },
  sofa: { w: 92, h: 46, standX: 0 },
  floorLamp: { w: 28, h: 102, standX: 0 },
  sideTable: { w: 30, h: 37, standX: 0 },
};

// ── 小工具（共用的圖形在 svg.ts） ──

const g = (style: string, children: string) => tag('g', { style }, children);
const tone = (x: number, y: number, w: number, h: number) => rect(x, y, w, h, 0, 'tone');

const day = (children: string) => g('opacity:var(--day)', children);
const night = (children: string) => g('opacity:var(--night)', children);
/** 夜晚的暖光：--lamp-glow（白天是 transparent），不透明度 0.1 */
const glow = (cx: number, cy: number, rx: number, ry: number) => ellipse(cx, cy, rx, ry, undefined, 'fill:var(--lamp-glow);opacity:.1');

const WHITE = fill('#fff');
const DARK_STEEL = fill('#8089ad');
const GREEN_LEAF = fill('#9cc08a');
const POT = fill('#c98a6a');
/** 書背：衣服色票（淡色，日夜都看得清楚） */
const BOOKS = ['#c9d8e8', '#f1d0c4', '#d8e4cf', '#e8dcc0', '#d9c9e6', '#f3c9d2', '#bfe0dc', '#e9c9a8'];

// ── 桌子：112×76；桌面上緣 y −48.5、螢幕 x 20–52／y −74 到 −48、正面 y −42 到 −23 留白給 HTML 名牌 ──

const SCREEN: Record<DeskState, string> = {
  empty: 'var(--screen-off)',
  working: 'var(--screen-working)',
  waiting: 'var(--screen-waiting)',
  idle: 'var(--screen-turn)',
};

function desk(st: DeskState): string {
  const lit = st !== 'empty';
  let o = '';
  // 檯燈與人周圍的暖光：只有非空桌、只在夜晚
  if (lit) {
    o += night(glow(0, -56, 58, 46)
      + rect(-55, -50.5, 10, 2, 1, 'mk-thin', fill('var(--monitor)'))
      + line('M-50 -50.5 v-14 l8 -6', 'mk', 'stroke-width:1.4')
      + path('M-47 -73 l12 -2 l1 8z', 'mk-thin', fill('var(--lamp-glow)')));
  }
  // 螢幕：外框、畫面、支架
  o += rect(20, -74, 32, 23, 2, 'mk', fill('var(--monitor)'))
    + rect(24, -70, 24, 15, 0, undefined, fill(SCREEN[st]))
    + rect(33, -51, 6, 2.5, 0, 'mk-thin', fill('var(--monitor)'));
  if (st === 'working') o += line('M27 -66.5 h10 M27 -63 h15 M27 -59.5 h7', 'mk-thin', 'stroke:var(--monitor);opacity:.45');
  if (lit) o += path('M25 -69 h6 l-5 7 h-1z', undefined, 'fill:#fff;opacity:.5'); // 反光
  // 桌上：筆記本、馬克杯、鍵盤
  o += rect(-43, -50.5, 12, 2, 0.5, 'mk-thin', fill('#4f86b8')) + rect(-42, -52.5, 10, 2, 0.5, 'mk-thin', fill('var(--plate)'))
    + rect(-30, -56, 7, 7.5, 1.5, 'mk-thin', fill('#c9d8e8')) + line('M-23 -54.5 q3 0 3 2.5 q0 2.5 -3 2.5', 'mk-thin')
    + rect(-15, -51, 30, 2.5, 1, 'mk-thin', fill('var(--plate)'));
  if (st === 'idle') o += path('M-28 -58.5 q-2 -3 0 -6 q2 -3 0 -6 M-25 -59 q-2 -2.5 0 -5 q2 -2.5 0 -5', undefined,
    'fill:none;stroke:var(--fx);stroke-width:1;stroke-linecap:round;opacity:.6'); // 蒸氣
  // 桌子本體：桌面（等你處理混一點紅）、桌板下緣的網點陰影、底邊踢腳線
  o += rect(-56, -48.5, 112, 48.5, 3, 'mk', fill('var(--desk)'));
  if (st === 'waiting') o += rect(-55.25, -47.75, 110.5, 4.25, 2, undefined, 'fill:var(--waiting);opacity:.3');
  o += tone(-55, -43.5, 110, 2.5) + line('M-55 -43.5 H55', 'mk-thin') + line('M-55 -4 H55', 'mk-thin');
  return o;
}

// ── 窗：70×52（含窗台）。只有紙張風墨線窗框與窗台；玻璃裡的風景是下面的全景，由 floor.ts 依窗的位置與樓層露出一塊 ──

/** 窗玻璃在窗 symbol 裡的範圍（原點 = 窗台底邊中點） */
export const GLASS = { x: -32, y: -51, w: 64, h: 44 } as const;

const windowSym = () =>
  rect(GLASS.x, GLASS.y, GLASS.w, GLASS.h, 3, 'ink', 'fill:none') // 窗框
  + rect(-35, -7, 70, 7, 2, 'ink', fill('var(--wall-low)')); // 窗台

// ── 窗景：所有窗共用的一張全景，左上角是原點、y 往下。由上往下：天空（白天有雲；夜晚有星星，不畫月亮：整個畫面只有屋頂上方天空裡那一個）、遠處的屋頂、對面的大樓、街道。
//    左右兩端接得起來（窗多時從頭接）；寬是窗距 240 的整數倍。furniture.ts 的 windowView 決定每扇窗露出哪一塊 ──

export const PANO = { w: 1440, h: 260 } as const;
const STREET_Y = 244;
const STAR = fill('#f1e9d8');

/** 固定種子的亂數（mulberry32）：全景每次畫出來都一樣 */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, a: number, b: number) => Math.round(a + r() * (b - a));

/** 從左排到右的一排樓：[左緣 x, 寬]；最後一棟到全景右緣為止，太窄就不放（右緣接回左緣時是一段空隙） */
function lots(r: () => number, w: [number, number], gap: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  for (let x = between(r, ...gap); ; x += between(r, ...gap)) {
    const bw = Math.min(between(r, ...w), PANO.w - x);
    if (bw < w[0]) return out;
    out.push([x, bw]);
    x += bw;
  }
}

function panorama(): string {
  const r = rng(7);
  const sky = rect(0, 0, PANO.w, PANO.h, 0, undefined, fill('var(--window-sky)'));
  let clouds = '';
  for (let x = 30; x < PANO.w - 40; x += between(r, 110, 190)) {
    const y = between(r, 22, 105), k = 0.8 + r() * 0.8;
    clouds += ellipse(x, y, 9 * k, 3.2 * k, undefined, WHITE) + ellipse(x + 6 * k, y - 2.5 * k, 5 * k, 2.6 * k, undefined, WHITE);
  }
  let stars = '';
  for (let i = 0; i < 90; i++) stars += circle(between(r, 2, PANO.w - 2), between(r, 6, 120), 0.5 + r() * 0.4, undefined, STAR);
  for (let i = 0; i < 12; i++) {
    const x = between(r, 4, PANO.w - 4), y = between(r, 10, 100);
    stars += line(`M${x - 2} ${y} h4 M${x} ${y - 2} v4`, 'mk-thin', 'stroke:#f1e9d8;stroke-width:.9');
  }
  // 遠處的屋頂：淡一點，夜裡有零星的燈
  let far = '', farLit = '';
  for (const [x, w] of lots(r, [30, 70], [0, 10])) {
    const top = between(r, 92, 140);
    far += rect(x, top, w, 210 - top, 0, undefined, fill('var(--city)'));
    for (let i = 0; i < 3; i++) farLit += rect(x + between(r, 3, w - 5), between(r, top + 4, 200), 2, 2, 0, undefined, fill('var(--city-lit)'));
  }
  // 對面的大樓：墨線外框、一格格窗（約三成亮著），有些樓頂有水塔或天線
  let near = '';
  for (const [x, w] of lots(r, [56, 110], [8, 24])) {
    const top = between(r, 140, 186), cols = Math.floor((w - 8) / 14), left = x + (w - cols * 14) / 2 + 3.5;
    near += rect(x, top, w, STREET_Y - top, 0, 'mk-thin', fill('var(--city)'));
    for (let y = top + 9; y + 7 <= STREET_Y - 8; y += 16) {
      for (let c = 0; c < cols; c++) near += rect(left + c * 14, y, 7, 7, 0, undefined, fill(r() < 0.28 ? 'var(--city-lit)' : 'var(--window-sky)'));
    }
    const roof = r(), at = x + between(r, 8, w - 20);
    if (roof < 0.3) near += line(`M${at + 2} ${top} v-4 M${at + 10} ${top} v-4`, 'mk-thin') + rect(at, top - 12, 12, 8, 1.5, 'mk-thin', fill('var(--roof)'));
    else if (roof < 0.5) near += line(`M${at} ${top} v-14 M${at - 3} ${top - 10} h6`, 'mk-thin');
  }
  const street = rect(0, STREET_Y, PANO.w, PANO.h - STREET_Y, 0, undefined, fill('var(--ground)'))
    + line(`M0 ${STREET_Y} H${PANO.w}`, 'mk-thin')
    + line(`M4 ${STREET_Y + 9} H${PANO.w}`, 'mk-thin', 'stroke:var(--paper);stroke-dasharray:10 8;opacity:.7');
  return sky + day(clouds) + night(stars) + g('opacity:.5', far) + night(farLit) + near + street;
}

// ── 右端家具（尺寸沿用現在的版本，layoutSet 排出來的位置不變） ──

/** 飲水機 28×78：水桶、機身、兩個出水口 */
const waterCooler = () =>
  rect(-10, -77, 20, 31, 8, 'mk', fill('#bfe0f5')) + line('M-6 -72 v18', 'mk-thin', 'stroke:#fff;stroke-width:1.6;opacity:.8')
  + rect(-4, -48.5, 8, 3, 1, 'mk-thin', fill('#bfe0f5'))
  + rect(-13, -46, 26, 46, 4, 'mk', fill('#eef2f6')) + tone(6.5, -44, 5, 42)
  + rect(-9, -39, 14, 11, 2, 'mk-thin', fill('#dfe6ee'))
  + circle(-5, -33.5, 2.2, undefined, fill('#4a90d9')) + circle(1.5, -33.5, 2.2, undefined, fill('var(--waiting)'))
  + line('M-9 -24 H5', 'mk-thin');

const SNACKS = ['#ffd166', '#4fb477', '#4a90d9'];
/** 販賣機 56×112：燈箱（夜晚亮起、周圍暖光）、商品窗、投幣口與按鈕、取物口 */
function vending(): string {
  let snacks = '';
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    snacks += rect(-18 + col * 10.5, -86 + row * 20, 7, 12, 1.5, undefined, fill(SNACKS[(col + row) % 3]!));
  }
  return night(glow(0, -56, 46, 56))
    + rect(-27, -111, 54, 111, 4, 'mk', fill('#d9534f'))
    + rect(-21, -105, 42, 10, 1, 'mk-thin', fill('#ffe9a8'))
    + night(rect(-21, -105, 42, 10, 1, 'mk-thin', fill('#fff3c4')))
    + rect(-21, -90, 34, 60, 0, 'mk-thin', fill('#24324f')) + snacks
    + line('M-21 -73.5 H13 M-21 -53.5 H13', 'mk-thin', 'stroke:#8089ad;stroke-width:1')
    + tone(15, -90, 10, 84)
    + rect(17, -86, 5, 8, 1, 'mk-thin', DARK_STEEL)
    + circle(19.5, -70, 1.8, 'mk-thin', fill('#ffe9a8')) + circle(19.5, -63, 1.8, 'mk-thin', fill('#4fb477'))
    + rect(-21, -22, 34, 10, 2, 'mk-thin', fill('#5a1414'));
}

/** 盆栽 34×74：三片大葉、暗面網點、陶盆 */
const plant = () =>
  ellipse(-8, -46, 8, 16, 'mk', GREEN_LEAF) + ellipse(8, -47, 8, 17, 'mk', GREEN_LEAF) + ellipse(0, -56, 7, 17.5, 'mk', GREEN_LEAF)
  + ellipse(10, -44, 3.5, 10, 'tone')
  + rect(-12, -24, 24, 24, 4, 'mk', POT) + tone(4, -22, 6, 20)
  + rect(-13.5, -27, 27, 5, 2, 'mk', POT);

/** 書櫃 60×104：木框、四層、書背（淡色）、右側內壁網點 */
function bookshelf(): string {
  let books = '';
  const rows: [number, number][] = [[-99, -77], [-77, -51], [-51, -25], [-25, -4]]; // [層頂, 層底]
  let k = 0;
  rows.forEach(([top, bottom], r) => {
    for (let x = -26 + (r % 2) * 2; ; k++) {
      const w = [6, 8, 5, 7][k % 4]!, h = Math.min(bottom - top - 2, [17, 20, 15, 19][k % 4]!);
      if (x + w > 17) break;
      if ((k + r) % 5 !== 3 && r < 3) books += rect(x, bottom - h, w, h, 1, 'mk-thin', fill(BOOKS[k % BOOKS.length]!)); // 每五格空一格；最下層放書盒
      x += w + 1;
    }
  });
  books += rect(-24, -15, 16, 11, 1, 'mk-thin', fill('#e8dcc0')) + rect(-5, -15, 16, 11, 1, 'mk-thin', fill('#c9d8e8'));
  return rect(-29, -103, 58, 103, 2, 'mk', fill('var(--wood)'))
    + books
    + tone(19, -101, 8, 97)
    + line(rows.map(([, b]) => `M-28 ${b} H28`).join(' '), 'mk-thin');
}

/** 影印機 68 高：掃描蓋、出紙口、操作面板、兩個紙匣、右側網點 */
const copier = () =>
  rect(-24, -51, 48, 51, 4, 'mk', fill('#eef2f6')) + tone(16, -49, 6, 47)
  + rect(-23, -60, 46, 10, 2, 'mk', fill('#dfe6ee')) + rect(-25, -67, 50, 7.5, 2, 'mk', fill('#d6dce6'))
  + rect(8, -58, 12, 5, 1.5, 'mk-thin', DARK_STEEL) + circle(17.5, -55.5, 1.2, undefined, fill('var(--working)'))
  + rect(-15, -49, 24, 3, 0.5, 'mk-thin', WHITE)
  + rect(-20, -40, 34, 13, 2, 'mk-thin', fill('#dfe6ee')) + rect(-20, -23, 34, 13, 2, 'mk-thin', fill('#dfe6ee'))
  + line('M-8 -33.5 h10 M-8 -16.5 h10', 'mk', 'stroke-width:1.8');

/** 沙發 92×46：椅背、兩側扶手、坐墊、抱枕、椅背右側網點、短腳 */
const sofa = () =>
  rect(-41, -45, 82, 32, 8, 'mk', fill('#9fb2d9')) + tone(18, -43, 12, 18)
  + rect(-28, -37, 14, 12, 4, 'mk-thin', fill('#f3c9d2'))
  + rect(-45.5, -33, 16, 33, 6, 'mk', fill('#9fb2d9')) + rect(29.5, -33, 16, 33, 6, 'mk', fill('#9fb2d9'))
  + rect(-31, -24, 62, 19, 5, 'mk', fill('#b9c7e6'))
  + line('M-24 -5 V0 M24 -5 V0', 'mk');

/** 立燈 28×102：燈罩（夜晚亮起、周圍暖光）、燈桿、底座 */
const SHADE = 'M-14 -81 L14 -81 L8 -101 L-8 -101Z';
const floorLamp = () =>
  night(glow(0, -84, 40, 46))
  + line('M0 -81 V-2', 'mk', 'stroke-width:2')
  + ellipse(0, -2, 11, 2.2, undefined, fill('var(--fig-ink)'))
  + path(SHADE, 'mk', fill('#f5f0e4'))
  + night(path(SHADE, 'mk', fill('#ffe9a8')) + ellipse(0, -80, 9, 1.8, undefined, 'fill:#fff3c4;opacity:.9'))
  + path('M5 -99 L8 -99 L12.5 -83 L8.5 -83Z', 'tone');

/** 邊桌 30×37：桌面下網點、桌腳、下層一本書、桌上一本書與一杯咖啡 */
const sideTable = () =>
  rect(-12, -24, 3, 24, 0, 'mk-thin', fill('var(--wood)')) + rect(9, -24, 3, 24, 0, 'mk-thin', fill('var(--wood)'))
  + rect(-10, -10, 20, 2.5, 0, 'mk-thin', fill('var(--wood)')) + rect(-7, -14, 12, 4, 1, 'mk-thin', fill('#4f86b8'))
  + tone(-9, -23.5, 18, 3)
  + rect(-14.5, -28, 29, 4.5, 1.5, 'mk', fill('var(--wood)'))
  + rect(-11, -31, 11, 3, 1, 'mk-thin', fill('#c0583c'))
  + rect(3, -35.5, 6.5, 7.5, 1.5, 'mk-thin', WHITE) + line('M9.5 -33.5 q2.5 0 2.5 2 q0 2 -2.5 2', 'mk-thin');

const DRAW: Record<ObjectId, () => string> = {
  'desk-empty': () => desk('empty'),
  'desk-working': () => desk('working'),
  'desk-waiting': () => desk('waiting'),
  'desk-idle': () => desk('idle'),
  window: windowSym,
  waterCooler, vending, plant, bookshelf, copier, sofa, floorLamp, sideTable,
};

/** 隱藏的 <svg>：<defs> 裡有 <pattern id="tone">（4×4、中心半徑 0.95 的點，style fill var(--fig-ink)、opacity var(--tone-opacity)）與每個 ObjectId 的 <symbol id>。
 *  symbol 設 overflow:visible：外緣的墨線不被切掉一半，暖光可以超出物件範圍 */
export function defsSvg(): string {
  const pattern = tag('pattern', { id: 'tone', width: 4, height: 4, patternUnits: 'userSpaceOnUse' },
    circle(2, 2, 0.95, undefined, 'fill:var(--fig-ink);opacity:var(--tone-opacity)'));
  const symbols = (Object.keys(OBJECTS) as ObjectId[]).map((id) => {
    const { w, h } = OBJECTS[id];
    return tag('symbol', { id, viewBox: `${-w / 2} ${-h} ${w} ${h}`, style: 'overflow:visible' }, DRAW[id]());
  }).join('') + tag('symbol', { id: 'panorama', viewBox: `0 0 ${PANO.w} ${PANO.h}` }, panorama());
  return tag('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    tag('defs', {}, pattern + symbols));
}
