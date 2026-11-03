// 圓滾滾機械風物件：桌子、椅子、圓窗、右端家具、房間的兩側斜牆。純函式產生 SVG 字串（不碰 DOM），defsSvg() 放進頁面共用的隱藏 <svg>，再用 <use href="#id"> 擺上去。
// 畫風和人物一樣：黑色線稿（mk 粗、mk-thin 細）、一階硬影（右側一塊加深的實色，不用網點）、圓角、鉚釘。
// 座標：原點 = 底邊中點，x 往右、y 往上是負的；symbol 的 viewBox = `${-w/2} ${-h} ${w} ${h}`。
// 顏色規則：一律寫在 style 或 class，不用 fill="色"／stroke="色" 屬性。
// 文件的 CSS 選擇器進不了 <use> 的影子樹，所以依日夜顯示的群組用 style="opacity:var(--day)"／"opacity:var(--night)"（繼承的變數進得去）。
import { circle, ellipse, fill, line, path, rect, tag } from './svg.js';

export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';
export type FurnitureId = 'waterCooler' | 'vending' | 'plant' | 'bookshelf' | 'copier' | 'sofa' | 'floorLamp' | 'sideTable';
export type ObjectId = `desk-${DeskState}` | 'chair' | 'window' | FurnitureId;
/** 原點 = 底邊中點；symbol 的 viewBox = `${-w/2} ${-h} ${w} ${h}` */
export interface ObjectSpec { w: number; h: number }

const DESK: ObjectSpec = { w: 112, h: 88 }; // 放在座位中心、底邊在樓層 y 192
export const OBJECTS: Record<ObjectId, ObjectSpec> = {
  'desk-empty': DESK,
  'desk-working': DESK,
  'desk-waiting': DESK,
  'desk-idle': DESK,
  chair: { w: 56, h: 60 },
  window: { w: 52, h: 52 },
  waterCooler: { w: 28, h: 78 },
  vending: { w: 56, h: 112 },
  plant: { w: 34, h: 74 },
  bookshelf: { w: 60, h: 104 },
  copier: { w: 50, h: 68 },
  sofa: { w: 92, h: 46 },
  floorLamp: { w: 28, h: 102 },
  sideTable: { w: 30, h: 37 },
};

// ── 小工具（共用的圖形在 svg.ts） ──

const g = (style: string, children: string) => tag('g', { style }, children);
const day = (children: string) => g('opacity:var(--day)', children);
const night = (children: string) => g('opacity:var(--night)', children);
/** 夜晚的暖光：--lamp-glow（白天是 transparent），不透明度 0.1 */
const glow = (cx: number, cy: number, rx: number, ry: number) => ellipse(cx, cy, rx, ry, undefined, 'fill:var(--lamp-glow);opacity:.1');
/** 鉚釘：奶油白小圓點加細墨線 */
const rivet = (x: number, y: number) => circle(x, y, 1.3, 'mk-thin', 'fill:#fff8e8;stroke-width:.8');
/** 硬影：一塊加深的實色，不描邊 */
const shade = (x: number, y: number, w: number, h: number, rx: number, c: string) => rect(x, y, w, h, rx, undefined, fill(c));
/** 圓（用 path 畫，才能和別的形狀一起用 evenodd 挖洞） */
const circlePath = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const WHITE = fill('#fff');
const STEEL = '#8c8f99';
const BOOKS = ['#9cd3ff', '#5cba69', '#f2f2f2', '#9b7fd8', '#43b0c8', '#5a8fd8', '#b6ddd3', '#d9d2f2'];

// ── 房間的兩側斜牆：寬 16、高 192（樓板以上），左牆的形狀；右牆由 building.css 鏡像（.side-r）並換成較暗的 --side-wall-r。
//    同一張圖也畫天花板（0–10）和木地板（156–192）的斜角，中段由 building.css 的 .ceil、.wall、.boards 接上 ──

const SIDE = 16, CEIL = 10, BACK = 156, FLOOR = 192;
export const ROOM_SIDE = tag('svg', { xmlns: 'http://www.w3.org/2000/svg', width: SIDE, height: FLOOR, viewBox: `0 0 ${SIDE} ${FLOOR}`, 'aria-hidden': 'true', style: 'overflow:visible' },
  path(`M0 0 H${SIDE} V${CEIL}Z`, undefined, fill('var(--ceiling)'))
  + path(`M0 0 L${SIDE} ${CEIL} V${BACK} L0 ${FLOOR}Z`, undefined, fill('var(--side-wall)'))
  + path(`M${SIDE} ${BACK} V${FLOOR} H0Z`, undefined, fill('var(--floor-wood)'))
  + line(`M0 0 L${SIDE} ${CEIL} V${BACK} L0 ${FLOOR}`, 'mk'));

// ── 桌子 112×88：奶油白桌身、白色桌面、右側抽屜的硬影；胖胖的映像管螢幕在右邊 x 16–54、y −87 到 −54（外殼不放大，畫面放大、邊框變窄）；正面 y −42 到 −23 留白給 HTML 名牌 ──

const SCREEN: Record<DeskState, string> = {
  empty: 'var(--screen-off)',
  working: 'var(--screen-working)',
  waiting: '#1f3a66', // 深藍底，上面是權限對話框（淺紅標題列）
  idle: 'var(--screen-turn)',
};
/** 映像管的畫面（DESK_CODE 也切在這個範圍） */
const SCR = { x: 19, y: -84, w: 29, h: 24 } as const;

function desk(st: DeskState): string {
  const lit = st !== 'empty';
  let o = '';
  // 圓頭檯燈與人周圍的暖光：只有非空桌、只在夜晚
  if (lit) {
    o += night(glow(0, -56, 58, 46)
      + line('M-48 -48.5 V-64', 'mk', 'stroke-width:1.6')
      + path('M-56 -64 Q-56 -74 -48 -74 Q-40 -74 -40 -64Z', 'mk', fill('var(--lamp-glow)')));
  }
  // 映像管：支架、圓角外殼、右側硬影、畫面、兩顆鉚釘
  o += rect(26, -57, 18, 8, 3, 'mk-thin', fill('#cfd2d8'))
    + rect(16, -87, 38, 33, 9, 'mk', fill('#e9e4d8')) + shade(49.5, -84.5, 3.5, 28, 1.75, '#c8c0ae')
    + rect(SCR.x, SCR.y, SCR.w, SCR.h, 5, 'mk-thin', fill(SCREEN[st]))
    + rivet(19.5, -57) + rivet(46.5, -57);
  if (st === 'waiting') o += tag('g', { class: 'dialog' }, rect(SCR.x + 4, SCR.y + 4, 21, 16, 1.5, 'mk-thin', WHITE)
    + rect(SCR.x + 4, SCR.y + 4, 21, 4, 1, undefined, fill('var(--screen-waiting)'))
    + rect(SCR.x + 6.5, SCR.y + 13.5, 7, 3, 1, undefined, fill('#5cba69')) + rect(SCR.x + 15.5, SCR.y + 13.5, 7, 3, 1, undefined, fill('#c9c2b6')));
  if (lit) o += line(`M${SCR.x + 3.5} ${SCR.y + 5} q3.5 -2.5 8.5 -2.5`, 'mk-thin', 'stroke:#fff;stroke-width:1.6;opacity:.55'); // 反光
  // 桌上：馬克杯、鍵盤
  o += rect(-40, -57, 9, 8.5, 3, 'mk-thin', WHITE) + line('M-31 -55 q3 0 3 2.5 q0 2.5 -3 2.5', 'mk-thin')
    + rect(-15, -51, 30, 2.5, 1, 'mk-thin', fill('#f2f2f2'));
  if (st === 'idle') o += path('M-38 -59.5 q-2 -3 0 -6 q2 -3 0 -6 M-34 -60 q-2 -2.5 0 -5 q2 -2.5 0 -5', undefined,
    'fill:none;stroke:var(--fx);stroke-width:1;stroke-linecap:round;opacity:.6'); // 蒸氣
  // 桌子本體：圓角桌身、右側抽屜的硬影、白色桌面、兩顆鉚釘
  o += rect(-56, -48.5, 112, 48.5, 8, 'mk', fill('var(--desk)')) + shade(36, -39, 15, 35, 5, 'var(--desk-shade)')
    + rect(-56, -48.5, 112, 8, 4, 'mk', fill('var(--desk-top)'))
    + rivet(-50, -7) + rivet(50, -7);
  return o;
}

// ── 椅子 56×60：藍色圓角椅背（不用藍綠：會和護牆板混在一起）、淺色靠墊、右側硬影、頂端兩顆鉚釘。放在人後面（floor.ts 的 chairs 圖層），下半被桌子擋住 ──

const chair = () =>
  rect(-27, -59, 54, 59, 14, 'mk', fill('#4f7fd6')) + shade(13, -55, 9, 51, 4.5, '#3c66b3')
  + rect(-20, -52, 32, 42, 10, 'mk-thin', fill('#82a9ec'))
  + rivet(-21, -53) + rivet(21, -53);

/** 工作中螢幕上捲動的程式碼。Chromium 不會把 CSS 動畫帶進 <use> 的複本，所以不放在桌子 symbol 裡：
 *  floor.ts 把這段疊在每張桌子的 svg 上（外層 viewBox 和 symbol 相同，座標照桌子），只在工作中顯示。
 *  畫兩份接起來，theme.css 的 code-scroll 一行一行往上捲一份的高度後接回開頭 */
const CODE_LINES = [[3, 12], [6, 14], [6, 8], [3, 17], [6, 11], [3, 6]];
const CODE_DY = 4; // 行距
/** 一份程式碼的高度：theme.css 的 code-scroll 一輪往上捲這麼多 */
export const CODE_SCROLL = CODE_LINES.length * CODE_DY;
const code = (dy: number) => CODE_LINES.map(([x, w], i) => `M${SCR.x + x!} ${SCR.y + 4 + i * CODE_DY + dy} h${w}`).join(' ');
export const DESK_CODE = tag('svg', { class: 'desk-code', width: DESK.w, height: DESK.h, viewBox: `${-DESK.w / 2} ${-DESK.h} ${DESK.w} ${DESK.h}`, style: 'overflow:visible' },
  tag('svg', { x: SCR.x, y: SCR.y, width: SCR.w, height: SCR.h, viewBox: `${SCR.x} ${SCR.y} ${SCR.w} ${SCR.h}` }, // 內層 svg 切在畫面範圍
    line(`${code(0)} ${code(CODE_SCROLL)}`, 'mk-thin code-scroll', 'stroke:var(--monitor);opacity:.45')));

// ── 窗：52×52 的鉚釘圓窗。玻璃裡的風景是下面的全景，由 floor.ts 依窗的位置與樓層露出一塊（方形），這裡的圖疊在上面：
//    先用牆色蓋住方形玻璃在圓外的四個角，再畫金屬窗框、八顆鉚釘和玻璃反光 ──

/** 窗玻璃在窗 symbol 裡的範圍（原點 = 窗框底邊中點）：圓窗玻璃的外接正方形 */
export const GLASS = { x: -21, y: -47, w: 42, h: 42 } as const;
const WIN_C = -26; // 圓心 y

const windowSym = () =>
  path(`M-22 -48 h44 v44 h-44z ${circlePath(0, WIN_C, 21)}`, undefined, 'fill:var(--wall);fill-rule:evenodd')
  + path(`${circlePath(0, WIN_C, 25)} ${circlePath(0, WIN_C, 21)}`, 'mk', 'fill:#c9ccd2;fill-rule:evenodd')
  + line('M-13 -36 a17 17 0 0 1 10 -6', 'mk-thin', 'stroke:#fff;stroke-width:2.6;opacity:.75')
  + Array.from({ length: 8 }, (_, i) => rivet(+(23 * Math.cos((i * Math.PI) / 4)).toFixed(2), +(WIN_C + 23 * Math.sin((i * Math.PI) / 4)).toFixed(2))).join('');

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

// ── 右端家具（尺寸沿用原本的版本，layoutSet 排出來的位置不變）：都是圓角，右側一塊硬影 ──

/** 飲水機 28×78：圓水桶、機身、藍白兩個出水口 */
const waterCooler = () =>
  rect(-10, -77, 20, 30, 9, 'mk', fill('#9cd3ff')) + shade(-6, -72, 3, 18, 1.5, '#e8f6ff')
  + rect(-4, -49, 8, 4, 1.5, 'mk-thin', fill('#9cd3ff'))
  + rect(-13, -46, 26, 46, 7, 'mk', fill('#e9edf2')) + shade(5, -43, 6, 40, 3, '#c3cdd8')
  + rect(-9, -38, 14, 11, 3, 'mk-thin', fill('#cfd6de'))
  + circle(-5, -32.5, 2.2, 'mk-thin', fill('#3a8ee6')) + circle(1.5, -32.5, 2.2, 'mk-thin', WHITE)
  + rivet(-9, -5) + rivet(9, -5);

const SNACKS = ['#3a8ee6', '#5cba69', '#f2f2f2', '#9b7fd8', '#43b0c8'];
/** 販賣機 56×112：鋼藍圓角機身、燈箱（夜晚亮起、周圍暖光）、三層商品窗、取物口、四角鉚釘 */
function vending(): string {
  let o = night(glow(0, -56, 46, 56))
    + rect(-27, -111, 54, 111, 10, 'mk', fill('#8a9bb0')) + shade(16, -107, 8, 103, 4, '#6f8096')
    + rect(-21, -105, 34, 9, 3, 'mk-thin', fill('#dfe8f2'))
    + night(rect(-21, -105, 34, 9, 3, 'mk-thin', fill('#fff3c4')));
  for (let row = 0; row < 3; row++) {
    const y = -92 + row * 24;
    o += rect(-21, y, 34, 21, 4, 'mk-thin', fill('#4c5a6e'));
    for (let c = 0; c < 4; c++) o += rect(-18.5 + c * 8, y + 3 + ((c + row) % 2) * 2, 6, 16 - ((c + row) % 2) * 2, 2, 'mk-thin', `${fill(SNACKS[(c + row * 2) % SNACKS.length]!)};stroke-width:.8`);
  }
  return o + rect(-21, -18, 34, 9, 3, 'mk-thin', fill('#3a4658'))
    + rivet(-22.5, -106.5) + rivet(22.5, -106.5) + rivet(-22.5, -4.5) + rivet(22.5, -4.5);
}

/** 盆栽 34×74：三團圓葉（深淺綠）、藍色圓盆加盆緣 */
const plant = () =>
  circle(-8, -40, 10, 'mk', fill('#4aa35a')) + circle(9, -42, 10, 'mk', fill('#3d8f4d')) + circle(0, -58, 13, 'mk', fill('#5cba69'))
  + line('M-6 -63 q4 -5 10 -3', 'mk-thin', 'stroke:#9be0a4;stroke-width:2')
  + path('M-12 -24 Q-12 0 0 0 Q12 0 12 -24Z', 'mk', fill('#5a8fd8')) + path('M5 -24 Q11 -24 11 -14 Q10 -4 4 -1.5Z', undefined, fill('#4673b8'))
  + rect(-14, -28, 28, 7, 3.5, 'mk', fill('#7aa8e8'));

/** 書櫃 60×104：圓角木框、四層、書背（淺色）、右側內壁硬影、頂端兩顆鉚釘 */
function bookshelf(): string {
  let books = '';
  const rows: [number, number][] = [[-97, -75], [-75, -51], [-51, -27], [-27, -6]]; // [層頂, 層底]
  let k = 0;
  rows.forEach(([top, bottom], r) => {
    for (let x = -24 + (r % 2) * 2; ; k++) {
      const w = [6, 8, 5, 7][k % 4]!, h = Math.min(bottom - top - 3, [17, 20, 15, 19][k % 4]!);
      if (x + w > 17) break;
      if ((k + r) % 5 !== 3 && r < 3) books += rect(x, bottom - h, w, h, 2, 'mk-thin', fill(BOOKS[k % BOOKS.length]!)); // 每五格空一格；最下層放書盒
      x += w + 1;
    }
  });
  books += rect(-22, -17, 16, 11, 3, 'mk-thin', fill('#b6ddd3')) + rect(-3, -17, 16, 11, 3, 'mk-thin', fill('#9cd3ff'));
  return rect(-29, -103, 58, 103, 8, 'mk', fill('var(--wood)'))
    + rect(-25, -98, 50, 92, 4, 'mk-thin', fill('var(--wood-shade)'))
    + books
    + shade(18, -97, 6, 91, 3, '#00000026')
    + line(rows.map(([, b]) => `M-25 ${b} H25`).join(' '), 'mk-thin')
    + rivet(-25, -100) + rivet(25, -100);
}

/** 影印機 50×68：圓角機身、掃描蓋、操作面板（綠燈）、出紙口、兩個紙匣、右側硬影 */
const copier = () =>
  rect(-24, -53, 48, 53, 8, 'mk', fill('#e9edf2')) + shade(14, -49, 7, 45, 3, '#c3cdd8')
  + rect(-23, -61, 46, 11, 5, 'mk', fill('#cfd6de')) + rect(-25, -67, 50, 8, 4, 'mk', fill('#dfe4ea'))
  + rect(6, -58, 13, 5, 2.5, 'mk-thin', fill('#4c5a6e')) + circle(16, -55.5, 1.3, undefined, fill('var(--working)'))
  + rect(-15, -50, 24, 3, 1.5, 'mk-thin', WHITE)
  + rect(-20, -42, 32, 14, 4, 'mk-thin', fill('#dfe4ea')) + rect(-20, -24, 32, 14, 4, 'mk-thin', fill('#dfe4ea'))
  + line('M-8 -35 h8 M-8 -17 h8', 'mk', 'stroke-width:1.8')
  + rivet(-20, -4) + rivet(20, -4);

/** 沙發 92×46：紫色圓角椅背（不用藍綠：會和護牆板混在一起）、兩側扶手、坐墊、奶油色抱枕、椅背右側硬影、短腳 */
const SOFA = '#8a74c9';
const sofa = () =>
  rect(-41, -45, 82, 32, 12, 'mk', fill(SOFA)) + shade(20, -42, 16, 18, 6, '#7060ad')
  + rect(-30, -38, 14, 13, 5, 'mk-thin', fill('#f4e6b8'))
  + rect(-45.5, -33, 16, 31, 8, 'mk', fill(SOFA)) + rect(29.5, -33, 16, 31, 8, 'mk', fill(SOFA))
  + rect(-31, -24, 62, 19, 8, 'mk', fill('#a594dc'))
  + line('M-24 -4 V0 M24 -4 V0', 'mk', 'stroke-width:2.4');

/** 立燈 28×102：圓頂燈罩加小圓鈕（夜晚亮起、周圍暖光）、鋼管、圓底座 */
const DOME = 'M-14 -76 Q-14 -98 0 -98 Q14 -98 14 -76Z';
const floorLamp = () =>
  night(glow(0, -80, 40, 46))
  + line('M0 -76 V-4', 'mk', 'stroke-width:4.5') + line('M0 -76 V-4', 'mk', `stroke:${STEEL};stroke-width:2.2`)
  + ellipse(0, -4, 12, 4, 'mk', fill(STEEL))
  + circle(0, -99.5, 2.5, 'mk-thin', fill('#bfe3ff'))
  + path(DOME, 'mk', fill('#bfe3ff')) + path('M6 -96 Q14 -92 14 -76 L8 -76Z', undefined, fill('#8fbfe0'))
  + night(path(DOME, 'mk', fill('#fff3c4')) + ellipse(0, -76, 12, 2, undefined, 'fill:#fff;opacity:.9'));

/** 邊桌 30×37：圓角桌面、單腳、圓底座；桌上一本書與一杯咖啡 */
const sideTable = () =>
  rect(-2.5, -25, 5, 22, 1.5, 'mk-thin', fill(STEEL))
  + ellipse(0, -2.5, 10, 2.5, 'mk', fill(STEEL))
  + rect(-15, -30, 30, 6, 3, 'mk', fill('var(--wood)')) + shade(7, -28.5, 7, 3, 1.5, '#00000026')
  + rect(-11, -33, 11, 3, 1, 'mk-thin', fill('#5a8fd8'))
  + rect(3, -37, 7, 7, 2.5, 'mk-thin', WHITE) + line('M10 -35 q2.5 0 2.5 2 q0 2 -2.5 2', 'mk-thin');

const DRAW: Record<ObjectId, () => string> = {
  'desk-empty': () => desk('empty'),
  'desk-working': () => desk('working'),
  'desk-waiting': () => desk('waiting'),
  'desk-idle': () => desk('idle'),
  chair,
  window: windowSym,
  waterCooler, vending, plant, bookshelf, copier, sofa, floorLamp, sideTable,
};

/** 隱藏的 <svg>：<defs> 裡有每個 ObjectId 的 <symbol id> 與窗景全景。
 *  symbol 設 overflow:visible：外緣的墨線不被切掉一半，暖光可以超出物件範圍 */
export function defsSvg(): string {
  const symbols = (Object.keys(OBJECTS) as ObjectId[]).map((id) => {
    const { w, h } = OBJECTS[id];
    return tag('symbol', { id, viewBox: `${-w / 2} ${-h} ${w} ${h}`, style: 'overflow:visible' }, DRAW[id]());
  }).join('') + tag('symbol', { id: 'panorama', viewBox: `0 0 ${PANO.w} ${PANO.h}` }, panorama());
  return tag('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    tag('defs', {}, symbols));
}
