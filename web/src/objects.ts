// 圓滾滾機械風物件：桌子、椅子、圓窗、家具、房間的兩側斜牆、木地板的透視板縫。純函式產生 SVG 字串（不碰 DOM），defsSvg() 放進頁面共用的隱藏 <svg>，再用 <use href="#id"> 擺上去。
// 畫風和人物一樣：黑色線稿（mk 粗、mk-thin 細）、一階硬影（右側一塊加深的實色，不用網點）、圓角、鉚釘。
// 座標：原點 = 底邊中點，x 往右、y 往上是負的；symbol 的 viewBox = `${-w/2} ${-h} ${w} ${h}`。
// 顏色規則：一律寫在 style 或 class，不用 fill="色"／stroke="色" 屬性。
// 文件的 CSS 選擇器進不了 <use> 的影子樹，所以依日夜顯示的群組用 style="opacity:var(--day)"／"opacity:var(--night)"（繼承的變數進得去）。
import { circle, ellipse, fill, line, path, rect, tag } from './svg.js';

export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';
export type FurnitureId = 'coffeeBar' | 'waterCooler' | 'fridge' | 'binderShelf' | 'fileCabinet' | 'copier' | 'serverRack' | 'networkCabinet' | 'whiteboard' | 'highTable';
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
  // 茶水間、檔案區、機房角、小會議角（furniture.ts 的 SETS）
  coffeeBar: { w: 62, h: 88 },
  waterCooler: { w: 28, h: 78 },
  fridge: { w: 44, h: 92 },
  binderShelf: { w: 60, h: 104 },
  fileCabinet: { w: 40, h: 102 },
  copier: { w: 50, h: 68 },
  serverRack: { w: 50, h: 114 },
  networkCabinet: { w: 52, h: 64 },
  whiteboard: { w: 76, h: 106 },
  highTable: { w: 86, h: 80 },
};

// ── 小工具（共用的圖形在 svg.ts） ──

const g = (style: string, children: string) => tag('g', { style }, children);
const night = (children: string) => g('opacity:var(--night)', children);
/** 鉚釘：奶油白小圓點加細墨線 */
const rivet = (x: number, y: number) => circle(x, y, 1.3, 'mk-thin', 'fill:#fff8e8;stroke-width:.8');
/** 圓（用 path 畫，才能和別的形狀一起用 evenodd 挖洞） */
const circlePath = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/** 帶 class 和顏色的圖形：下面的物件大多是一串這些；cls 空字串就不加 class */
const st = (f: string, extra = '') => `fill:${f}${extra ? `;${extra}` : ''}`;
const R = (x: number, y: number, w: number, h: number, rx: number, cls: string, f: string, extra = '') => rect(x, y, w, h, rx, cls || undefined, st(f, extra));
const C = (cx: number, cy: number, r: number, cls: string, f: string, extra = '') => circle(cx, cy, r, cls || undefined, st(f, extra));
const E = (cx: number, cy: number, rx: number, ry: number, cls: string, f: string, extra = '') => ellipse(cx, cy, rx, ry, cls || undefined, st(f, extra));
const P = (d: string, cls: string, f: string, extra = '') => path(d, cls || undefined, st(f, extra));
const L = (d: string, cls: string, extra = '') => line(d, cls, extra || undefined);
const STEEL = '#8c8f99';

// ── 房間的兩側斜牆：寬 16、高 192（樓板以上），左牆的形狀；右牆由 building.css 鏡像（.side-r）並換成較暗的 --side-wall-r。
//    同一張圖也畫天花板（0–10）和木地板（156–192）的斜角，中段由 building.css 的 .ceil、.wall、.boards 接上 ──

const SIDE = 16, CEIL = 10, BACK = 156, FLOOR = 192;
/** 木地板靠後牆那條較深的帶子高度（building.css 的 .boards 畫中段，這裡畫斜角） */
const FLOOR_BAND = 9;
export const ROOM_SIDE = tag('svg', { xmlns: 'http://www.w3.org/2000/svg', width: SIDE, height: FLOOR, viewBox: `0 0 ${SIDE} ${FLOOR}`, 'aria-hidden': 'true', style: 'overflow:visible' },
  path(`M0 0 H${SIDE} V${CEIL}Z`, undefined, fill('var(--ceiling)'))
  + path(`M0 0 L${SIDE} ${CEIL} V${BACK} L0 ${FLOOR}Z`, undefined, fill('var(--side-wall)'))
  + path(`M${SIDE} ${BACK} V${FLOOR} H0Z`, undefined, fill('var(--floor-wood)'))
  + path(`M${SIDE} ${BACK} V${BACK + FLOOR_BAND} H${SIDE * (1 - FLOOR_BAND / (FLOOR - BACK))}Z`, undefined, fill('var(--floor-back)'))
  + line(`M0 0 L${SIDE} ${CEIL} V${BACK} L0 ${FLOOR}`, 'mk'));

/** 木地板的透視板縫（設計稿）：後緣每約 42 一條，往前散開，前緣對到樓層兩端，像兩側斜牆一樣往外收。
 *  width 是樓層寬，座標從樓層左緣、後牆底（樓層 y 156）起算；floor.ts 依樓層寬重畫 */
export function floorSeams(width: number): string {
  const n = Math.max(1, Math.round((width - 2 * SIDE) / 42)), round1 = (v: number) => Math.round(v * 10) / 10;
  let d = '';
  for (let i = 1; i < n; i++) d += `M${round1(SIDE + (i / n) * (width - 2 * SIDE))} 0 L${round1((i / n) * width)} ${FLOOR - BACK}`;
  return tag('svg', { xmlns: 'http://www.w3.org/2000/svg', width, height: FLOOR - BACK, 'aria-hidden': 'true' },
    line(d, 'mk-thin', 'stroke-width:.9;stroke-opacity:.35'));
}

// ── 天際線：屋頂後面的遠景，遠近兩層平塗的樓，都有墨線、右側一階硬影；近的一層有窗格，夜晚零星的窗亮冷白色。
//    顏色在 building.css 的 .skyline。亂數固定種子，寬度變大時前面的樓長得一樣 ──

export const SKYLINE_H = 120;
export function skylineSvg(width: number): string {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const box = (cls: string, x: number, y: number, w: number, h: number, rx = 0) => rect(x, y, w, h, rx, cls);
  let far = '', near = '', lit = '';
  for (let x = -10; x < width;) {
    const w = 34 + rnd() * 60, h = 40 + rnd() * 70, y = SKYLINE_H - h;
    far += box('far', x, y, w, h + 4, 3) + box('shade-far', x + w * 0.7, y + 1, w * 0.3 - 0.6, h + 2);
    x += w + 4 + rnd() * 10;
  }
  for (let x = 0; x < width;) {
    const w = 26 + rnd() * 46, h = 22 + rnd() * 48, y = SKYLINE_H - h;
    near += box('near', x, y, w, h + 4, 2) + box('shade-near', x + w * 0.7, y + 1, w * 0.3 - 0.7, h + 2);
    for (let wy = y + 7; wy < SKYLINE_H - 6; wy += 9) {
      for (let wx = x + 5; wx < x + w * 0.7 - 4; wx += 8) {
        near += box('pane', wx, wy, 3, 4);
        if (rnd() < 0.18) lit += box('win', wx, wy, 3, 4);
      }
    }
    x += w + 8 + rnd() * 26;
  }
  return tag('svg', { class: 'skyline', xmlns: 'http://www.w3.org/2000/svg', width, height: SKYLINE_H, viewBox: `0 0 ${width} ${SKYLINE_H}`, 'aria-hidden': 'true' }, far + near + lit);
}

// ── 牆上的裝飾：掛畫 76×50（墨線框、白襯紙，只用藍、綠、紫、青瓷）。座標從左上角起算 ──

const INK = 'var(--ink)';
const frame = (inner: string) => `<svg width="76" height="50" viewBox="0 0 76 50" aria-hidden="true">
  <rect x="1" y="1" width="74" height="48" rx="3" style="fill:#fff;stroke:${INK};stroke-width:1.8"/>
  <rect x="7" y="7" width="62" height="36" rx="1.5" style="fill:#dff1fb;stroke:${INK};stroke-width:1.3"/>${inner}
  <rect x="1" y="1" width="74" height="48" rx="3" style="fill:none;stroke:${INK};stroke-width:1.8"/></svg>`;
/** 三幅掛畫：山和海、圓和方塊、一片大葉子 */
export const ARTS = [
  frame(`<path d="M8 36 L24 18 L34 28 L44 14 L68 36 L68 42 L8 42Z" style="fill:#6f9a5e;stroke:${INK};stroke-width:1.2;stroke-linejoin:round"/>
    <path d="M44 14 L68 36 L58 36 Z" style="fill:#5b8450"/><path d="M8 37 H68 V42 H8Z" style="fill:#4f86b8;stroke:${INK};stroke-width:1.2"/>`),
  frame(`<circle cx="26" cy="25" r="11" style="fill:#8a74b0;stroke:${INK};stroke-width:1.2"/><rect x="38" y="14" width="22" height="22" rx="2" style="fill:#4a9a94;stroke:${INK};stroke-width:1.2"/>
    <path d="M49 14 H60 V36 H49Z" style="fill:#3d8580"/><path d="M12 38 H64" style="stroke:${INK};stroke-width:1.2"/>`),
  frame(`<path d="M18 38 C18 20 40 10 58 12 C56 30 40 40 18 38Z" style="fill:#7fbf7a;stroke:${INK};stroke-width:1.2;stroke-linejoin:round"/>
    <path d="M18 38 C30 30 42 22 54 15" style="fill:none;stroke:${INK};stroke-width:1.1;stroke-linecap:round"/><path d="M40 24 C46 30 52 24 56 16 C50 28 46 32 40 24Z" style="fill:#67a866"/>`),
];


// ── 桌子 112×88：我們看到的是桌子正面的擋板（人坐在後面，抽屜和放腳的空間朝著他）。映像管在右邊 x 16–54、y −87 到 −54；正面 y −42 到 −23 留白給 HTML 名牌 ──

/** 映像管的深藍底（設計稿）：空桌畫一道淡藍弧、工作中疊亮色程式碼（DESK_CODE）、等你處理疊權限對話框；只有輪到你是琥珀色（狀態信號） */
const NAVY = '#1f3a66';
const SCREEN: Record<DeskState, string> = { empty: NAVY, working: NAVY, waiting: NAVY, idle: 'var(--screen-turn)' };
/** 映像管的畫面（DESK_CODE 也切在這個範圍） */
const SCR = { x: 19, y: -84, w: 29, h: 24 } as const;

function desk(state: DeskState): string {
  const lit = state !== 'empty';
  let o = '';
  // 圓頭檯燈：只有非空桌。白天是關著的冷灰色，夜晚亮起（燈光是 building.css 疊在遮罩上的 .desk .glow）
  if (lit) {
    const shadePath = 'M-55 -61 Q-55 -71 -48 -71 Q-41 -71 -41 -61Z';
    o += L('M-48 -48.5 V-61', 'mk', 'stroke-width:1.6') + E(-48, -49.5, 5, 1.6, 'mk-thin', '#a5a8b2')
      + g('opacity:var(--day)', P(shadePath, 'mk', '#cfd6de') + P('M-45 -70.4 Q-41 -68 -41 -61 L-45 -61Z', '', '#b5bfca'))
      + g('opacity:var(--night)', P(shadePath, 'mk', '#fff3c4') + L('M-54 -61 H-42', 'mk-thin', 'stroke:#fff;stroke-width:1.4;opacity:.9'));
  }
  // 映像管：頂面和散熱孔（交代厚度）、外殼、內框、畫面、下巴上的銘牌、旋鈕和電源燈（青色，不用狀態色；空桌是灰的）、兩層底座
  o += R(24, -56, 22, 5, 2, 'mk-thin', '#cfd2d8') + R(20, -52.5, 30, 3.5, 1.75, 'mk-thin', '#bfc3ca')
    + P('M18 -87 L23 -91 H49 L54 -87Z', 'mk', '#f3efe6') + L('M28 -89 h4 M35 -89 h4 M42 -89 h4', 'mk-thin', 'stroke-width:.9')
    + R(16, -87, 38, 33, 9, 'mk', '#e9e4d8') + R(48.5, -84.5, 4, 28, 2, '', '#c8c0ae')
    + R(17.5, -85.5, 32.5, 28.5, 7, 'mk-thin', '#ddd7c9')
    + R(SCR.x, SCR.y, SCR.w, SCR.h, 5, 'mk-thin', SCREEN[state])
    + R(22, -58.2, 9, 2.4, 1, 'mk-thin', '#c8c0ae') + C(45, -57, 1.4, 'mk-thin', lit ? '#9fe6ff' : '#9aa3ab') + C(40.5, -57, 1.3, 'mk-thin', '#cfc8b8');
  // 便利貼：外殼右上角，薄荷色（黃色太接近琥珀）；貼左上會靠到人臉，空桌沒有
  if (lit) o += tag('g', { transform: 'rotate(10 55 -82)' }, R(51, -87, 8, 8, 0.8, 'mk-thin', '#c9f0dc') + L('M53 -84 h4 M53 -81.5 h3', 'mk-thin', 'stroke-width:.7'));
  if (state === 'empty') o += L(`M${SCR.x + 9} ${SCR.y + 14} q5.5 -5 11 0`, 'mk-thin', 'stroke:#7ab0ff;stroke-width:1.6;opacity:.7');
  if (state === 'waiting') o += tag('g', { class: 'dialog' }, R(SCR.x + 4, SCR.y + 4, 21, 16, 1.5, 'mk-thin', '#fff')
    + R(SCR.x + 4, SCR.y + 4, 21, 4, 1, '', 'var(--screen-waiting)')
    + R(SCR.x + 6.5, SCR.y + 13.5, 7, 3, 1, '', '#5cba69') + R(SCR.x + 15.5, SCR.y + 13.5, 7, 3, 1, '', '#c9c2b6'));
  if (lit) o += L(`M${SCR.x + 3.5} ${SCR.y + 5} q3.5 -2.5 8.5 -2.5`, 'mk-thin', 'stroke:#fff;stroke-width:1.6;opacity:.55'); // 反光
  // 桌上：馬克杯（輪到你時冒煙，見 DESK_STEAM）、一排鍵的鍵盤、滑鼠。不放筆筒：和燈、杯子擠在桌角，縮小後像一塊碎片
  o += R(-40, -57, 9, 8.5, 3, 'mk-thin', '#fff') + L('M-31 -55 q3 0 3 2.5 q0 2.5 -3 2.5', 'mk-thin')
    + R(-16, -52, 32, 3.5, 1.2, 'mk-thin', '#f2f2f2') + L('M-13 -50.3 h2 M-9 -50.3 h2 M-5 -50.3 h2 M-1 -50.3 h2 M3 -50.3 h2 M7 -50.3 h2 M11 -50.3 h2', 'mk-thin', 'stroke-width:.8')
    + E(20, -50, 3, 1.6, 'mk-thin', '#f2f2f2');
  // 桌身：桌面有前緣厚度和右側硬影，底下一條細飾條、右側一階硬影、兩端一對桌腳
  o += R(-56, -48.5, 112, 46, 8, 'mk', 'var(--desk)') + R(36, -39, 15, 33, 5, '', 'var(--desk-shade)')
    + L('M-50 -14 H50', 'mk-thin', 'stroke-width:1;opacity:.55')
    + R(-53, -4, 10, 4, 1.5, 'mk-thin', '#a5a8b2') + R(43, -4, 10, 4, 1.5, 'mk-thin', '#a5a8b2')
    + R(-56, -48.5, 112, 8, 4, 'mk', 'var(--desk-top)') + R(-55, -42.6, 110, 2.2, 0, '', 'color-mix(in srgb, var(--desk-shade) 45%, var(--desk-top))') + R(40, -47.5, 14, 6, 2.5, '', 'color-mix(in srgb, var(--desk-shade) 60%, var(--desk-top))')
    + rivet(-50, -9) + rivet(50, -9);
  return o;
}

// ── 椅子 56×60：藍色圓角椅背（不用藍綠：會和護牆板混在一起）、頭枕、靠墊一圈白色縫線、兩側扶手、右側硬影。放在人後面（floor.ts 的 chairs 圖層），下半被桌子擋住。
//    靠墊上不要畫釦子：配上空桌螢幕的弧線會像一張臉 ──

const chair = () =>
  R(-31, -22, 9, 7, 3, 'mk', '#3c66b3') + R(22, -22, 9, 7, 3, 'mk', '#3c66b3')
  + R(-27, -59, 54, 59, 14, 'mk', '#4f7fd6') + R(13, -55, 9, 51, 4.5, '', '#3c66b3')
  + R(-21, -56, 42, 9, 4.5, 'mk-thin', '#3c66b3') + R(9, -55, 10, 7, 3, '', '#335a9f')
  + R(-20, -45, 32, 36, 9, 'mk-thin', '#82a9ec') + R(-17, -42, 26, 30, 7, '', 'none', 'stroke:#e3edff;stroke-width:1;stroke-dasharray:2.5 2')
  + rivet(-21, -52) + rivet(21, -52);

// ── 會動的部件：Chromium 不會把 CSS 動畫帶進 <use> 的複本，所以不放在 symbol 裡，floor.ts 把這些疊在物件的 svg 上。動畫在 theme.css ──

/** 疊在物件上的一張 svg：外框與 viewBox 和 symbol 相同，座標照物件 */
const overlay = ({ w, h }: ObjectSpec, cls: string, body: string) =>
  tag('svg', { class: cls, width: w, height: h, viewBox: `${-w / 2} ${-h} ${w} ${h}`, style: 'overflow:visible' }, body);
/** 從杯口 (x, y) 往上的兩縷煙，第二縷落後半拍（--lag） */
const steam = (x: number, y: number) => [0, 1].map((i) =>
  path(`M${x + i * 4} ${y - i * 0.5} q-2 -3 0 -6 q2 -3 0 -6`, 'steam', `fill:none;stroke:var(--fig-ink);stroke-width:1;stroke-linecap:round;--lag:${i * 1.4}s`)).join('');

/** 輪到你的桌上，馬克杯冒煙（building.css 只在 data-st="idle" 顯示） */
export const DESK_STEAM = overlay(DESK, 'desk-steam', steam(-38, -59.5));

/** 工作中螢幕上捲動的程式碼，只在工作中顯示。畫兩份接起來，theme.css 的 code-scroll 一行一行往上捲一份的高度後接回開頭 */
const CODE_LINES = [[3, 12], [6, 14], [6, 8], [3, 17], [6, 11], [3, 6]];
const CODE_DY = 4; // 行距
/** 一份程式碼的高度：theme.css 的 code-scroll 一輪往上捲這麼多 */
export const CODE_SCROLL = CODE_LINES.length * CODE_DY;
/** 深藍底上的亮色程式碼（設計稿）：綠、藍、白輪流，第 i 行用 CODE_COLORS[i % 3] */
const CODE_COLORS = ['#7dff9a', '#9cd3ff', '#e8f4ff'];
const code = (dy: number, k: number) => CODE_LINES.map(([x, w], i) => (i % CODE_COLORS.length === k ? `M${SCR.x + x!} ${SCR.y + 4 + i * CODE_DY + dy} h${w}` : '')).join('');
export const DESK_CODE = overlay(DESK, 'desk-code',
  tag('svg', { x: SCR.x, y: SCR.y, width: SCR.w, height: SCR.h, viewBox: `${SCR.x} ${SCR.y} ${SCR.w} ${SCR.h}` }, // 內層 svg 切在畫面範圍
    CODE_COLORS.map((c, k) => line(`${code(0, k)} ${code(CODE_SCROLL, k)}`, 'mk-thin code-scroll', `stroke:${c};stroke-width:1.6`)).join('')));

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

// ── 窗景：所有窗共用的一張全景，左上角是原點、y 往下。由上往下：天空（沒有雲和星星）、遠處的屋頂、對面的大樓、街道。
//    左右兩端接得起來（窗多時從頭接）。furniture.ts 的 windowView 決定每扇窗露出哪一塊 ──

export const PANO = { w: 1440, h: 260 } as const;
const STREET_Y = 244;

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

/** 全景 */
function panorama(): string {
  const r = rng(7);
  // 夜晚蓋一片暗夜空：遮罩壓暗後幾乎是黑的，building.css 的 .windows .glow 再用 screen 把設計稿的夜空漸層疊回來
  const sky = rect(0, 0, PANO.w, PANO.h, 0, undefined, fill('var(--window-sky)')) + night(rect(0, 0, PANO.w, PANO.h, 0, undefined, fill('#141c36')));
  // 以前的雲和星星用掉的亂數照樣抽掉，城市長相才不變
  for (let x = 30; x < PANO.w - 40; x += between(r, 110, 190)) r(), r();
  for (let i = 0; i < 294; i++) r();
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
  return sky + g('opacity:.5', far) + night(farLit) + near + street;
}

// ── 家具：四種辦公區域（茶水間、檔案區、機房角、小會議角，組合在 furniture.ts 的 SETS）。同一套畫法，墨線、右側一階硬影、左上亮面。
//    會動的部件（咖啡煙、機櫃指示燈）在 FURN_ANIM ──

/** 鋼管：墨線包著鋼色 */
const pipe = (d: string, w = 2.4) => L(d, 'mk', `stroke-width:${w + 2.2}`) + L(d, 'mk', `stroke:${STEEL};stroke-width:${w}`);
/** 白板上的筆跡：只有線、沒有墨線 class */
const ink = (d: string, style: string) => path(d, undefined, `fill:none;${style}`);

// 茶水間

/** 咖啡吧 62×88：木頭矮櫃、白檯面；深鋼色咖啡機（深藍小螢幕、青色燈、滴水盤上一杯咖啡，煙在 FURN_ANIM）、藍蓋糖罐、薄荷色馬克杯 */
const coffeeBar = () =>
  R(-30, -42, 60, 42, 5, 'mk', 'var(--wood)') + R(14, -39, 12, 36, 3, '', 'var(--wood-shade)')
  + R(-26, -36, 25, 30, 3, 'mk-thin', '#d6ad7f') + R(1, -36, 25, 30, 3, 'mk-thin', '#d6ad7f')
  + L('M-5 -25 v7 M5 -25 v7', 'mk', 'stroke-width:1.8')
  + R(-27, -4, 6, 4, 1, 'mk-thin', 'var(--wood-shade)') + R(21, -4, 6, 4, 1, 'mk-thin', 'var(--wood-shade)')
  + R(-31, -46, 62, 6, 3, 'mk', '#f4f6f8') + R(16, -45, 13, 4, 2, '', '#dde2e8')
  + R(-25, -84, 28, 38, 6, 'mk', '#5a6578') + R(-6, -81, 7, 32, 3, '', '#454f61')
  + R(-27, -87, 32, 8, 3, 'mk', '#6e7b8b')
  + R(-21, -76, 15, 6, 2, 'mk-thin', '#22304f') + R(-19.5, -74.5, 6, 1.4, 0.5, '', '#9fd0ff') + C(-1.5, -73, 1.6, 'mk-thin', '#43b0c8')
  + R(-21, -66, 20, 16, 2, 'mk-thin', '#2c3646') + R(-13, -66, 4, 4, 1, 'mk-thin', '#a5a8b2')
  + R(-16, -56, 9, 8, 2.5, 'mk-thin', '#fff') + L('M-7 -54 q2.5 0 2.5 2 q0 2 -2.5 2', 'mk-thin')
  + R(-23, -49, 24, 3, 1.5, 'mk-thin', '#a5a8b2')
  + R(7, -58, 10, 12, 3, 'mk-thin', '#dff1fb') + R(7.5, -61.5, 9, 3.5, 1.5, 'mk-thin', '#3a8ee6')
  + R(20, -54, 7, 8, 2.5, 'mk-thin', '#c9f0dc') + L('M27 -52 q2.5 0 2.5 2 q0 2 -2.5 2', 'mk-thin');

/** 飲水機 28×78：水桶裡有水位和瓶蓋、藍白兩個出水口、接水盤、側邊一管紙杯 */
const waterCooler = () =>
  R(-10, -77, 20, 30, 9, 'mk', '#cfeaff') + R(-8.5, -68, 17, 19.5, 6, '', '#9cd3ff') + L('M-8.5 -68 H8.5', 'mk-thin', 'stroke-width:.8')
  + R(-6, -74, 3, 16, 1.5, '', '#f2faff') + R(-3.5, -80, 7, 3.5, 1, 'mk-thin', '#3a8ee6')
  + R(-4, -49, 8, 4, 1.5, 'mk-thin', '#9cd3ff')
  + R(-13, -46, 26, 46, 7, 'mk', '#e9edf2') + R(5, -43, 6, 40, 3, '', '#c3cdd8')
  + R(-9, -38, 14, 11, 3, 'mk-thin', '#cfd6de')
  + C(-5, -32.5, 2.2, 'mk-thin', '#3a8ee6') + C(1.5, -32.5, 2.2, 'mk-thin', '#fff')
  + R(-9, -24, 14, 3, 1.5, 'mk-thin', '#a5a8b2')
  + R(13, -40, 5, 17, 2, 'mk-thin', '#f4f6f8') + P('M13.6 -23 H17.4 L16.6 -19 H14.4Z', 'mk-thin', '#fff')
  + rivet(-9, -5) + rivet(9, -5);

/** 小冰箱加微波爐 44×92：冷白冰箱分冷凍和冷藏、左側鋼把手、幾顆磁鐵和一張薄荷色便條；上面一台微波爐，深藍玻璃門、右側按鍵 */
const fridge = () =>
  R(-21, -62, 42, 62, 8, 'mk', '#e9edf2') + R(9, -59, 9, 56, 4, '', '#c3cdd8')
  + L('M-21 -43 H21', 'mk')
  + R(-17, -58, 3, 11, 1.5, 'mk-thin', STEEL) + R(-17, -38, 3, 20, 1.5, 'mk-thin', STEEL)
  + C(3, -53, 2.6, 'mk-thin', '#9cd3ff') + tag('g', { transform: 'rotate(-6 0 -30)' }, R(-5, -36, 11, 11, 1, 'mk-thin', '#c9f0dc') + L('M-3 -32 h6 M-3 -29 h4', 'mk-thin', 'stroke-width:.7')) + C(7, -20, 2.4, 'mk-thin', '#9b7fd8')
  + R(-18, -3, 6, 3, 1, '', '#3a4658') + R(12, -3, 6, 3, 1, '', '#3a4658')
  + R(-22, -90, 44, 27, 5, 'mk', '#d5dbe2') + R(12, -88, 8, 23, 3, '', '#c1c9d2')
  + R(-18, -86, 24, 19, 3, 'mk-thin', '#22304f') + L('M-15 -82 q4 -3 9 -3', 'mk-thin', 'stroke:#fff;stroke-width:1.4;opacity:.5')
  + R(10, -86, 8, 5, 1.5, 'mk-thin', '#22304f') + C(12, -76, 1.3, 'mk-thin', '#fff') + C(16, -76, 1.3, 'mk-thin', '#fff') + C(12, -71.5, 1.3, 'mk-thin', '#fff') + C(16, -71.5, 1.3, 'mk-thin', '#fff');

// 檔案區

const BINDERS = ['#3a8ee6', '#5cba69', '#f2f2f2', '#9b7fd8', '#43b0c8', '#b6ddd3'];
/** 檔案夾：書背白標籤、下面一個指孔、右側硬影 */
const binder = (x: number, bottom: number, w: number, h: number, c: string) =>
  R(x, bottom - h, w, h, 1.5, 'mk-thin', c) + R(x + 1.2, bottom - h + 3, w - 2.4, 6, 0.8, '', '#fff') + C(x + w / 2, bottom - 5, 1.2, 'mk-thin', '#fff', 'stroke-width:.7')
  + R(x + w - 2, bottom - h + 1, 1.4, h - 2, 0, '', 'rgb(0 0 0 / .14)');

/** 資料櫃 60×104：冷白鋼架、兩層一排排檔案夾（一本斜靠）、最下層兩個有標籤的文件盒 */
function binderShelf(): string {
  let o = R(-29, -100, 58, 100, 5, 'mk', '#e9edf2') + R(-25, -95, 50, 87, 3, 'mk-thin', '#8e9bb0') + R(18, -95, 7, 87, 0, '', 'rgb(0 0 0 / .16)');
  let k = 0;
  for (const [top, bottom, stop] of [[-95, -69, 25], [-65, -39, 12]] as const) {
    for (let x = -23; x + 7 <= stop; x += 8, k++) o += binder(x, bottom, 7, Math.min(bottom - top - 3, 23 - (k % 3)), BINDERS[k % BINDERS.length]!);
  }
  o += tag('g', { transform: 'rotate(16 18 -39)' }, binder(13, -39, 7, 22, '#9b7fd8'));
  o += R(-22, -33, 20, 22, 3, 'mk-thin', '#dfe4ea') + R(-17, -27, 10, 4, 1, 'mk-thin', '#fff') + R(1, -33, 20, 22, 3, 'mk-thin', '#cfeaff') + R(6, -27, 10, 4, 1, 'mk-thin', '#fff');
  for (const y of [-69, -39]) o += R(-25, y, 50, 4, 1, 'mk-thin', '#f4f6f8') + R(14, y + 0.8, 11, 2.4, 0, '', '#dde2e8');
  o += R(-30, -104, 60, 8, 3, 'mk', '#f4f6f8') + R(16, -103, 12, 6, 2, '', '#dde2e8');
  o += R(-28, -8, 56, 8, 2, 'mk', STEEL);
  return o + rivet(-26, -100) + rivet(26, -100);
}

/** 鐵檔案櫃 40×102：灰藍四抽屜、每格白標籤和握把，櫃頂一疊文件夾 */
function fileCabinet(): string {
  let o = R(-19, -90, 38, 90, 5, 'mk', '#9aa7b8') + R(9, -87, 7, 84, 3, '', '#7f8ea2');
  for (let i = 0; i < 4; i++) {
    const y = -86 + i * 21;
    o += R(-15, y, 26, 18, 3, 'mk-thin', '#b4c0cf') + R(-7, y + 3, 10, 4, 1, 'mk-thin', '#fff') + L(`M-8 ${y + 12} h12`, 'mk', 'stroke-width:2.2');
  }
  o += R(-20, -93, 40, 5, 2, 'mk', '#b4c0cf') + R(8, -92, 10, 3, 1.5, '', '#9aa7b8');
  o += R(-14, -98, 22, 5, 1.5, 'mk-thin', '#9cd3ff') + R(-12, -101.5, 20, 3.5, 1, 'mk-thin', '#f2f2f2');
  return o + rivet(-16, -4) + rivet(16, -4);
}

/** 影印機 50×68：掃描蓋和操作台分開、深藍小螢幕、兩顆按鈕、出紙口一張紙；指示燈是青色，不用工作中的綠 */
const copier = () =>
  R(-24, -50, 48, 50, 7, 'mk', '#e9edf2') + R(13, -47, 8, 44, 3, '', '#c3cdd8')
  + R(-25, -58, 50, 10, 4, 'mk', '#d5dbe2') + R(12, -57, 11, 8, 2, '', '#c1c9d2')
  + R(2, -56.5, 13, 6, 1.5, 'mk-thin', '#22304f') + R(3.5, -55.2, 6, 1.4, 0.5, '', '#9fd0ff')
  + C(-15, -53, 1.9, 'mk-thin', '#fff') + C(-9.5, -53, 1.9, 'mk-thin', '#fff') + C(19, -53, 1.3, '', '#43b0c8')
  + R(-23, -67, 46, 9, 4, 'mk', '#f4f6f8') + R(9, -66, 12, 7, 2, '', '#dde2e8')
  + P('M-14 -47 L-12 -51 H6 L4 -47Z', 'mk-thin', '#fff') + R(-17, -47.5, 26, 3, 1.5, 'mk-thin', '#3a4658')
  + R(-20, -40, 32, 15, 3, 'mk-thin', '#dfe4ea') + R(-20, -22, 32, 15, 3, 'mk-thin', '#dfe4ea')
  + L('M-9 -32.5 h12 M-9 -14.5 h12', 'mk', 'stroke-width:2')
  + R(-20, -1.5, 8, 2.5, 1, '', '#3a4658') + R(12, -1.5, 8, 2.5, 1, '', '#3a4658')
  + rivet(-20, -45) + rivet(20, -45);

// 機房角

/** 伺服器機櫃 50×114：深鋼色、七台一格格的主機（散熱孔、指示燈在 FURN_ANIM 慢慢閃）、輪腳 */
const RACK_UNITS = 7;
const rackY = (i: number) => -104 + i * 13;
function serverRack(): string {
  let o = R(-24, -110, 48, 110, 6, 'mk', '#3f4c60') + R(13, -106, 8, 100, 3, '', '#2c3646') + R(-23, -114, 46, 7, 3, 'mk', '#56647a');
  for (let i = 0; i < RACK_UNITS; i++) {
    const y = rackY(i);
    o += R(-19, y, 31, 10, 2, 'mk-thin', '#56647a') + L(`M-15 ${y + 3.5} h11 M-15 ${y + 6.5} h11`, 'mk-thin', 'stroke:#2c3646;stroke-width:1')
      + C(3, y + 5, 1.4, '', '#22304f') + C(7.5, y + 5, 1.4, '', '#22304f');
  }
  o += C(-15, -2, 2.6, 'mk-thin', '#2c3646') + C(15, -2, 2.6, 'mk-thin', '#2c3646');
  return o + rivet(-20, -106) + rivet(20, -106);
}
/** 機櫃指示燈：青和淺藍疊在暗燈上，依 --lag 錯開慢慢閃（theme.css 的 .led） */
const RACK_LEDS = Array.from({ length: RACK_UNITS }, (_, i) =>
  C(3, rackY(i) + 5, 1.4, 'led', i % 3 === 1 ? '#9fe6ff' : '#43b0c8', `--lag:${(i * 1.7) % 5}s`)
  + (i % 2 ? C(7.5, rackY(i) + 5, 1.4, 'led', '#43b0c8', `--lag:${(i * 2.3 + 1) % 5}s`) : '')).join('');

/** 網路設備矮櫃 52×64：冷白矮櫃、上面一台交換器（一排網孔）和一台雙天線的路由器，三條網路線從交換器垂到櫃子前面 */
function networkCabinet(): string {
  let o = R(-25, -34, 50, 34, 5, 'mk', '#e9edf2') + R(11, -31, 10, 28, 3, '', '#c3cdd8') + R(-21, -30, 28, 24, 2, 'mk-thin', '#dfe4ea')
    + R(-22, -4, 6, 4, 1, 'mk-thin', '#a5a8b2') + R(16, -4, 6, 4, 1, 'mk-thin', '#a5a8b2');
  o += R(-24, -46, 48, 11, 3, 'mk', '#56647a') + R(15, -45, 7, 9, 2, '', '#454f61');
  for (let k = 0; k < 6; k++) o += R(-20 + k * 5, -43, 3.4, 3.4, 0.6, '', '#2c3646');
  o += C(14, -40.5, 1.2, '', '#43b0c8');
  o += L('M-18.3 -39.6 C-22 -30 -12 -22 -16 -8', 'mk-thin', 'stroke:#3a8ee6;stroke-width:1.8')
    + L('M-13.3 -39.6 C-10 -28 -4 -24 -6 -10', 'mk-thin', 'stroke:#5cba69;stroke-width:1.8')
    + L('M-3.3 -39.6 C2 -30 -1 -20 3 -12', 'mk-thin', 'stroke:#9b7fd8;stroke-width:1.8');
  o += L('M6 -55 l-3 -8 M18 -55 l3 -8', 'mk', 'stroke-width:1.8') + R(2, -56, 20, 10, 3, 'mk', '#f4f6f8') + R(15, -55, 6, 8, 2, '', '#dde2e8') + C(7, -51, 1.1, '', '#43b0c8');
  return o;
}

// 小會議角

/** 帶輪白板 76×106：鋼框白板，用藍綠紫畫的方塊、箭頭、折線和幾條待辦橫線（不寫字），筆槽上兩支筆；兩支鋼腳、四顆輪子 */
const whiteboard = () =>
  pipe('M-29 -50 L-31 -8 M29 -50 L31 -8')
  + R(-38, -9, 16, 4, 2, 'mk-thin', STEEL) + R(22, -9, 16, 4, 2, 'mk-thin', STEEL)
  + C(-35, -2.5, 2.4, 'mk-thin', '#3a4658') + C(-25, -2.5, 2.4, 'mk-thin', '#3a4658') + C(25, -2.5, 2.4, 'mk-thin', '#3a4658') + C(35, -2.5, 2.4, 'mk-thin', '#3a4658')
  + R(-37, -104, 74, 56, 4, 'mk', '#d5dbe2') + R(-34, -101, 68, 50, 2, 'mk-thin', '#fff') + R(27, -100, 6, 48, 0, '', '#eef1f5')
  + R(-29, -95, 15, 10, 2, '', 'none', 'stroke:#3a8ee6;stroke-width:1.4') + ink('M-13 -90 h8 m-3 -2.5 l3 2.5 l-3 2.5', 'stroke:#3a8ee6;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round')
  + R(-3, -95, 15, 10, 2, '', 'none', 'stroke:#3d9a55;stroke-width:1.4') + ink('M4.5 -85 v6 m-2.5 -3 l2.5 3 l2.5 -3', 'stroke:#3d9a55;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round')
  + R(-3, -77, 15, 9, 2, '', 'none', 'stroke:#3d9a55;stroke-width:1.4')
  + ink('M-29 -58 l7 -6 l6 3 l8 -9', 'stroke:#9b7fd8;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round')
  + ink('M17 -94 h10 M17 -89 h7 M17 -84 h9', 'stroke:#9aa7b8;stroke-width:1.3;stroke-linecap:round')
  + R(-31, -51, 62, 3.5, 1.5, 'mk-thin', '#a5a8b2') + R(-22, -54, 9, 2.6, 1, 'mk-thin', '#3a8ee6') + R(-10, -54, 9, 2.6, 1, 'mk-thin', '#5cba69')
  + rivet(-33, -100) + rivet(33, -100);

/** 高腳圓桌加兩張吧台椅 86×80：木桌面、鋼柱、圓底座；桌上一台背對我們的筆電和一杯咖啡；椅墊藍色（和辦公椅同色） */
function highTable(): string {
  const stool = (x: number) => pipe(`M${x - 6} -40 L${x - 8} -3 M${x + 6} -40 L${x + 8} -3`, 1.4) + L(`M${x - 7} -17 h14`, 'mk', 'stroke-width:1.6')
    + R(x - 10, -47, 20, 7, 3.5, 'mk', '#4f7fd6') + R(x + 3, -46, 6, 5, 2.5, '', '#3c66b3');
  return stool(-33) + stool(33)
    + pipe('M0 -60 V-6', 3) + E(0, -3.5, 15, 3.5, 'mk', STEEL)
    + R(-23, -65, 46, 6, 3, 'mk', 'var(--wood)') + R(9, -64, 12, 4, 2, '', 'var(--wood-shade)')
    + P('M-15 -65 L-13 -80 H5 L3 -65Z', 'mk', '#cfd6de') + P('M0 -80 H5 L3 -65 H-1Z', '', '#b5bfca')
    + R(9, -72, 7, 7, 2.5, 'mk-thin', '#fff') + L('M16 -70 q2.5 0 2.5 2 q0 2 -2.5 2', 'mk-thin');
}

/** 家具上會動的部件（floor.ts 疊在那件家具上，夜晚也只有這兩件有光暈）：咖啡機滴水盤上那杯冒煙、機櫃指示燈慢慢閃 */
export const FURN_ANIM: Partial<Record<FurnitureId, string>> = {
  coffeeBar: overlay(OBJECTS.coffeeBar, 'anim', steam(-12, -57)),
  serverRack: overlay(OBJECTS.serverRack, 'anim', RACK_LEDS),
};

const DRAW: Record<ObjectId, () => string> = {
  'desk-empty': () => desk('empty'),
  'desk-working': () => desk('working'),
  'desk-waiting': () => desk('waiting'),
  'desk-idle': () => desk('idle'),
  chair,
  window: windowSym,
  coffeeBar, waterCooler, fridge, binderShelf, fileCabinet, copier, serverRack, networkCabinet, whiteboard, highTable,
};

/** 隱藏的 <svg>：<defs> 裡有每個 ObjectId 的 <symbol id>與窗景全景。
 *  symbol 設 overflow:visible：外緣的墨線不被切掉一半，暖光可以超出物件範圍 */
export function defsSvg(): string {
  const symbols = (Object.keys(OBJECTS) as ObjectId[]).map((id) => {
    const { w, h } = OBJECTS[id];
    return tag('symbol', { id, viewBox: `${-w / 2} ${-h} ${w} ${h}`, style: 'overflow:visible' }, DRAW[id]());
  }).join('') + tag('symbol', { id: 'panorama', viewBox: `0 0 ${PANO.w} ${PANO.h}` }, panorama());
  return tag('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    tag('defs', {}, symbols));
}
