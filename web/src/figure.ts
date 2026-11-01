// 日式漫畫風人物：純函式產生 SVG 字串（不碰 DOM）。座標系 60×84，x 30 是座位中心。
// 顏色規則：一律寫在 style 或 class（mk／mk-thin／tone），不用 fill="色"／stroke="色" 屬性，日夜變數才會生效。
import { tag } from './svg.js';
import { HAIR_COLORS, SHIRT_COLORS, type Look } from './view.js';

export const FIG = { w: 60, h: 84 } as const;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Pt = [number, number];

const n = (v: number) => Math.round(v * 100) / 100;
const g = (cls: string, children: string) => tag('g', { class: cls }, children);
const rect = (x: number, y: number, w: number, h: number, rx: number, cls: string | undefined, style?: string) =>
  tag('rect', { x, y, width: w, height: h, rx, class: cls, style });
const circle = (cx: number, cy: number, r: number, cls: string | undefined, style: string) => tag('circle', { cx, cy, r, class: cls, style });
const ellipse = (cx: number, cy: number, rx: number, ry: number, cls: string | undefined, style: string) =>
  tag('ellipse', { cx, cy, rx, ry, class: cls, style });
const path = (d: string, cls: string | undefined, style?: string) => tag('path', { d, class: cls, style });
const line = (d: string, cls: string) => tag('path', { d, class: cls, fill: 'none' }); // 只有墨線、不填色
const text = (x: number, y: number, size: number, s: string, style: string, cls?: string, anchor?: string) =>
  tag('text', { class: cls, x, y, 'font-size': size, 'font-weight': 500, 'text-anchor': anchor, style }, s);
const fill = (c: string) => `fill:${c}`;

const SKIN = fill('var(--skin)');
const INK = fill('var(--fig-ink)');
const WHITE = fill('#fff');
const CHAIR = fill('#8f8270');
const PANTS = fill('#3a3a4a');
const FX_STROKE = (w: number) => `fill:none;stroke:var(--fx);stroke-width:${w};stroke-linecap:round`;
const HIGHLIGHT = 'fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;opacity:.85';

// ── 頭髮：後髮（在身體後面）、前髮、暗面網點、高光線 ──

interface Hair { back: string; front: string; tone: string; hi: string }

/** 捲髮：外緣一圈小弧、瀏海往下鼓的小弧 */
const curly = (): string => {
  const R = 15, cx = 30, cy = 28.5, k = 8;
  const at = (deg: number): Pt => [n(cx + R * Math.cos((deg * Math.PI) / 180)), n(cy + R * Math.sin((deg * Math.PI) / 180))];
  const [sx, sy] = at(165);
  let d = `M${sx} ${sy}`;
  for (let i = 1; i <= k; i++) {
    const [x, y] = at(165 + (210 * i) / k);
    d += ` A4.4 4.4 0 0 1 ${x} ${y}`;
  }
  for (const [x, y] of [[43, 25], [37, 23.5], [30, 23], [23, 23.5], [17, 25]] as Pt[]) d += ` A3.8 3.8 0 0 1 ${x} ${y}`;
  return d + 'Z';
};

function hair(look: Look): Hair {
  const H = fill(HAIR_COLORS[look.hair]);
  const S = fill(SHIRT_COLORS[look.shirt]);
  const cap = (d: string) => path(d, 'mk', H);
  switch (look.style) {
    case 1: // 旁分：左邊分線，瀏海斜蓋右額
      return {
        back: '',
        front: cap('M15 30 A15 15 0 0 1 45 30 Q43 23 36 24 Q27 24 22 18 Q19 23 15 30Z') + line('M22 18 l1.5 -3.5', 'mk-thin'),
        tone: 'M38 20 Q44 24 44.5 30 L41 27Z',
        hi: 'M26 17 q5 -1.5 9 1',
      };
    case 2: // 長髮：中分瀏海、兩側垂髮、多一片後髮
      return {
        back: rect(13, 22, 34, 30, 10, 'mk', H),
        front: cap('M15.5 32 A15 15 0 1 1 44.5 32 Q43 22 30 20 Q17 22 15.5 32Z')
          + cap('M15 31 Q14 41 17.5 47 L20 45.5 Q17.5 39 18.5 31Z') + cap('M45 31 Q46 41 42.5 47 L40 45.5 Q42.5 39 41.5 31Z'),
        tone: 'M38 21 Q44 25 44.5 31 L41 28Z',
        hi: 'M20.5 21 q4 -3.5 8.5 -3.5',
      };
    case 3: // 包頭：髮線高、頭頂一顆髮髻（在頭後面）
      return {
        back: circle(30, 11.5, 6, 'mk', H) + line('M27 9.5 q3 -2 6 0', 'mk-thin'),
        front: cap('M15.5 29 A14.5 14.5 0 0 1 44.5 29 Q42 19 30 18.5 Q18 19 15.5 29Z'),
        tone: 'M37 20 Q43 23 44 28.5 L40.5 27Z',
        hi: 'M23 17 q5 -2 10 0',
      };
    case 4: // 捲髮
      return { back: '', front: cap(curly()), tone: 'M38 19 Q44 22 44.5 29 L41 27Z', hi: 'M23 17.5 q5 -2 10 0' };
    case 5: // 毛帽：帽子用衣服色，兩側露一點頭髮
      return {
        back: '',
        front: cap('M15 27 Q14 32 16.5 34 L18 30Z') + cap('M45 27 Q46 32 43.5 34 L42 30Z')
          + circle(30, 9.5, 3.8, 'mk', S) + path('M15.5 25 Q15.5 10.5 30 10.5 Q44.5 10.5 44.5 25Z', 'mk', S)
          + rect(14, 21.5, 32, 6.5, 3.2, 'mk', S) + line([18, 22, 26, 30, 34, 38, 42].map((x) => `M${x} 23 v3.5`).join(' '), 'mk-thin'),
        tone: 'M37 13 Q44 17 44 21.5 L39 21.5Z',
        hi: 'M21 16 q5 -4 11 -4.5',
      };
    default: // 0 短髮
      return {
        back: '',
        front: cap('M15 30 A15 15 0 0 1 45 29 Q41 19 31 20 Q24 22 22 26 Q19 22 15 30Z'),
        tone: 'M37 21 Q43 24 44 29 L40 28Z',
        hi: 'M23 19 q5 -2 10 0',
      };
  }
}

// ── 臉：工作中（大黑眼）、等你處理（白眼小瞳孔、張嘴）、輪到你（閉眼） ──

const FACES = {
  work: ellipse(25, 29.5, 2.7, 4, undefined, INK) + ellipse(35, 29.5, 2.7, 4, undefined, INK)
    + circle(26, 28, 1.2, undefined, WHITE) + circle(36, 28, 1.2, undefined, WHITE) + line('M28 35.5 q2 1.6 4 0', 'mk-thin'),
  wait: ellipse(25, 29, 3.4, 4.5, 'mk-thin', WHITE) + ellipse(35, 29, 3.4, 4.5, 'mk-thin', WHITE)
    + circle(25, 29.5, 1.3, undefined, INK) + circle(35, 29.5, 1.3, undefined, INK) + ellipse(30, 37, 2.4, 2.8, 'mk-thin', fill('#7a2e3a')),
  turn: line('M21.5 30 q3 3.2 6 0 M32.5 30 q3 3.2 6 0', 'mk') + line('M28 36 q2 1.4 4 0', 'mk-thin'),
};
const CHEEKS = path('M19 33.5 l1.6 -1.6 M21 33.5 l1.6 -1.6 M37.4 33.5 l1.6 -1.6 M39.4 33.5 l1.6 -1.6', undefined,
  'fill:none;stroke:#d9746a;stroke-width:.9;stroke-linecap:round');
const GLASSES = line('M20.6 29.5 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 M30.6 29.5 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 M29.4 29.5 h1.2', 'mk-thin');

function head(look: Look, faces: (keyof typeof FACES)[]): string {
  const h = hair(look);
  return g('head', circle(30, 28, 14, 'mk', SKIN)
    + faces.map((f) => g(`face-${f}`, FACES[f])).join('')
    + CHEEKS + h.front + path(h.tone, 'tone') + path(h.hi, undefined, HIGHLIGHT)
    + (look.glasses ? GLASSES : ''));
}

// ── 身體與衣服：T 恤（領口弧線）、帽 T（帽緣、兩條繩、口袋）、襯衫（白領加領帶） ──

function body(look: Look): string {
  const S = fill(SHIRT_COLORS[look.shirt]);
  const outfit = [
    line('M25 42 Q30 46 35 42', 'mk-thin'),
    path('M20 44.5 Q22 40 30 40.5 Q38 40 40 44.5 Q30 51 20 44.5Z', 'mk-thin', S) + line('M27 47.5 v6.5 M33 47.5 v6.5', 'mk-thin')
      + circle(27, 54.5, 0.9, undefined, INK) + circle(33, 54.5, 0.9, undefined, INK) + line('M23 57 H37 L39.5 64 H20.5Z', 'mk-thin'),
    path('M25 42 L30 47 L27 50Z M35 42 L30 47 L33 50Z', 'mk-thin', WHITE) + path('M30 47 l-2 8 l2 3 l2 -3z', 'mk-thin', fill('#c0583c')),
  ][look.outfit] ?? '';
  return g('body', rect(17, 41, 26, 25, 8, 'mk', S) + rect(34, 43, 7, 21, 0, 'tone') + outfit);
}

// ── 道具：在 fig 裡（跟著身體動）或在手臂群組裡（跟著手臂轉）；顯示與否交給 CSS 依 data-act 決定 ──

const DOC = { x: 20, y: 48, w: 18, h: 14 }; // 胸前的文件
const MOBILE = { x: 26, y: 51, w: 8, h: 12 }; // 胸前的手機
const HANDSET = { x: 14.5, y: 57, w: 4, h: 12 }; // 左手旁的電話聽筒
const MUG = { x: 41, y: 60, w: 6, h: 7 }; // 右手旁的杯子
const SHEET = { x: 40, y: 61, w: 10, h: 13 }; // 右手遞出去的文件
const GLOBE = { cx: -8, cy: 58, r: 7, base: 69.5 }; // 桌上的地球儀，支架到桌面

const propDoc = () => g('prop-doc', rect(DOC.x, DOC.y, DOC.w, DOC.h, 0, 'mk-thin', WHITE)
  + line([3, 7, 11].map((dy, i) => `M${DOC.x + 3} ${DOC.y + dy - 0.5} h${i === 2 ? 8 : 12}`).join(' '), 'mk-thin'));
const propMobile = () => g('prop-mobile', rect(MOBILE.x, MOBILE.y, MOBILE.w, MOBILE.h, 1.5, 'mk-thin', INK)
  + rect(MOBILE.x + 1.2, MOBILE.y + 1.4, MOBILE.w - 2.4, MOBILE.h - 4.2, 0.6, undefined, fill('var(--screen-working)')));
const propHandset = () => g('prop-handset', rect(HANDSET.x, HANDSET.y, HANDSET.w, HANDSET.h, 2, 'mk-thin', INK));
const propMug = () => g('prop-mug', rect(MUG.x, MUG.y, MUG.w, MUG.h, 1, 'mk-thin', fill('#c9d8e8'))
  + line(`M${MUG.x + MUG.w} ${MUG.y + 1.5} q2.6 0 2.6 2 t-2.6 2`, 'mk-thin')
  + path(`M${MUG.x + 1.8} ${MUG.y - 2} q-1.5 -2 0 -4`, 'steam', FX_STROKE(1))
  + path(`M${MUG.x + 4.4} ${MUG.y - 2} q1.5 -2 0 -4`, 'steam', FX_STROKE(1)));
const propSheet = () => g('prop-sheet', rect(SHEET.x, SHEET.y, SHEET.w, SHEET.h, 0, 'mk-thin', WHITE));
const propGlobe = () => g('prop-globe', circle(GLOBE.cx, GLOBE.cy, GLOBE.r, 'mk-thin', fill('#7fb3d5'))
  + path('M-12 55 q2 -3 4 -1 q1 2 -2 4 q-3 1 -2 -3z M-7 61 q2.5 -1 3.5 1 q-1 2.5 -3 2z', undefined, fill('#8bc48a'))
  + g('meridians', ellipse(GLOBE.cx, GLOBE.cy, 3, GLOBE.r, undefined, 'fill:none;stroke:var(--fig-ink);stroke-width:.6')
    + line(`M${GLOBE.cx - GLOBE.r} ${GLOBE.cy} h${GLOBE.r * 2}`, 'mk-thin'))
  + line(`M${GLOBE.cx} ${GLOBE.cy + GLOBE.r} v${n(GLOBE.base - GLOBE.cy - GLOBE.r)} M${GLOBE.cx - 4} ${GLOBE.base} h8`, 'mk'));

const arm = (side: 'l' | 'r', look: Look, props = true) => {
  const x = side === 'l' ? 12.5 : 39.5;
  const held = !props ? '' : side === 'l' ? propHandset() : propMug() + propSheet();
  return g(`arm arm-${side}`, rect(x, 44, 8, 19, 4, 'mk', fill(SHIRT_COLORS[look.shirt])) + circle(x + 4, 63, 3.4, 'mk-thin', SKIN) + held);
};

const leg = (side: 'l' | 'r') => {
  const x = side === 'l' ? 22.5 : 30.5;
  return g(`leg leg-${side}`, rect(x, 62, 7, 17, 3, 'mk', PANTS)
    + path(`M${x - 1} 81.5 v-2 q0 -3 3.5 -3 h2 q3 0 3 3 v2z`, 'mk-thin', INK));
};

// ── 漫符：幾何資料同時拿來畫與算外框（FX_BOXES），兩邊不會對不上 ──

/** 集中線：只在站著（等你處理，.fig 上移 12）時顯示，以站姿頭心 (30, 16) 為圓心，−170° 到 −10° 每 14° 一條，半徑 30 → 44，每隔一條畫到 52 並加粗 */
const LINES = Array.from({ length: 12 }, (_, i) => {
  const a = ((-170 + i * 14) * Math.PI) / 180, long = i % 2 === 1, r1 = long ? 52 : 44;
  return { x1: n(30 + 30 * Math.cos(a)), y1: n(16 + 30 * Math.sin(a)), x2: n(30 + r1 * Math.cos(a)), y2: n(16 + r1 * Math.sin(a)), long };
});
/** 「！」尖角框：站姿頭的右上方、集中線外側；16 個頂點的相對位置（外凸 8 點、內凹 8 點）縮成 0.8 倍（寬 38 高 30）。放在站姿頭的右側偏上，含 1.12 倍脈動後頂端不高於人物座標 y −29（= 樓層 y 45），才不會蓋住坐在座位 0 的人上方的招牌（樓層 y 14–40） */
const BURST_C: Pt = [66, -11];
const BURST_PTS: Pt[] = [[0, -19], [5, -10], [16, -15], [12, -4], [24, 0], [12, 4], [16, 15], [5, 10], [0, 19], [-5, 10], [-16, 15], [-12, 4], [-24, 0], [-12, -4], [-16, -15], [-5, -10]];
const burstAt = (k: number): Pt[] => BURST_PTS.map(([x, y]) => [n(BURST_C[0] + x * k), n(BURST_C[1] + y * k)]);
const BURST_K = 0.8;
const BURST = burstAt(BURST_K);
const BURST_PULSE = burstAt(BURST_K * 1.12); // CSS 以框的中心放大到 1.12 倍時的範圍
const DROP: Pt = [11, 8]; // 汗滴頂點（站姿頭的左側，在集中線內圈裡面）
const BUBBLE = { cx: 56, cy: -18, r: 11 };
const SFX = { x: -24, y: 40, size: 14 }; // 「噠噠」
const READ = { x: -24, y: 40, size: 12 }; // 「沙沙」（在「噠噠」的位置）
const RUN = { x0: 52, y0: 28, x1: 80, y1: 44 }; // 深色小框在螢幕正上方（桌子疊在人物上面，畫在螢幕位置會被擋住）
const RUN_LINES = ['M56 33 h12', 'M56 37 h18', 'M56 41 h9'];
const THINK: [number, number, number][] = [[46, 10, 1.5], [51, 5, 2], [57, -1, 2.5]];
const CALL = { x: -24, y: 24, size: 9 }; // 「嘟嚕嚕」
const CHEER = { x: 12, y: 6, size: 14 }; // 「耶！」
const Z1 = { x: -4, y: -4, size: 13 }, Z2 = { x: 0, y: -14, size: 16 };

/** 文字的大略外框：全形字寬 = 字級，半形 0.6 字級；基線以上一個字級、以下 0.25 */
const textPts = (x: number, y: number, size: number, w: number): Pt[] => [[x, y - size], [x + w, y + size * 0.25]];

function boxOf(pts: Pt[], pad: number): Box {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: n(Math.min(...xs) - pad), y0: n(Math.min(...ys) - pad), x1: n(Math.max(...xs) + pad), y1: n(Math.max(...ys) + pad) };
}

/** 「！」框含脈動（1.12 倍）的外框（不含 pad），測試用來確認不會蓋到招牌 */
export const BURST_BOX: Box = boxOf(BURST_PULSE, 0);

/** 漫符在人物座標裡的外框（人物座標 x 30 = 座位中心；座位 ±60 → x −30 到 90）；pad 涵蓋線寬 */
export const FX_BOXES: Record<'work' | 'wait' | 'turn' | 'read' | 'run' | 'think' | 'call' | 'cheer' | 'globe', Box> = {
  work: boxOf([...textPts(SFX.x, SFX.y, SFX.size, SFX.size * 2), [1, 48], [6, 56], [54, 48], [59, 56]], 1),
  wait: boxOf([...LINES.flatMap((l): Pt[] => [[l.x1, l.y1], [l.x2, l.y2]]), ...BURST_PULSE, [DROP[0] - 4, DROP[1]], [DROP[0] + 4, DROP[1] + 9]], 1),
  turn: boxOf([[BUBBLE.cx - BUBBLE.r, BUBBLE.cy - BUBBLE.r], [BUBBLE.cx + BUBBLE.r, BUBBLE.cy + BUBBLE.r],
    ...textPts(Z1.x, Z1.y, Z1.size, Z1.size * 0.6), ...textPts(Z2.x, Z2.y, Z2.size, Z2.size * 0.6)], 1),
  read: boxOf(textPts(READ.x, READ.y, READ.size, READ.size * 2), 1),
  run: boxOf([[RUN.x0, RUN.y0], [RUN.x1, RUN.y1]], 1),
  think: boxOf(THINK.flatMap(([x, y, r]): Pt[] => [[x - r, y - r], [x + r, y + r]]), 1),
  call: boxOf(textPts(CALL.x, CALL.y, CALL.size, CALL.size * 3), 1),
  cheer: boxOf(textPts(CHEER.x, CHEER.y, CHEER.size, CHEER.size * 2), 1),
  globe: boxOf([[GLOBE.cx - GLOBE.r, GLOBE.cy - GLOBE.r], [GLOBE.cx + GLOBE.r, GLOBE.cy + GLOBE.r],
    [GLOBE.cx - 4, GLOBE.base], [GLOBE.cx + 4, GLOBE.base]], 1),
};

const FX = {
  work: text(SFX.x, SFX.y, SFX.size, '噠噠', fill('var(--fx)'), 'sfx')
    + path('M6 48 q-5 3 -2 8 M54 48 q5 3 2 8', 'speed', FX_STROKE(1.2)),
  wait: g('lines', LINES.map((l) => path(`M${l.x1} ${l.y1} L${l.x2} ${l.y2}`, undefined, FX_STROKE(l.long ? 1.8 : 1))).join(''))
    + path(`M${DROP[0]} ${DROP[1]} q-4 6 0 9 q4 -3 0 -9z`, 'drop mk-thin', fill('#bfe3ff'))
    + g('burst', tag('polygon', { points: BURST.map((p) => p.join(',')).join(' '), class: 'mk-thin', style: WHITE })
      + text(BURST_C[0], BURST_C[1] + 5, 14, '！', fill('var(--waiting)'), undefined, 'middle')),
  turn: g('bubble', circle(BUBBLE.cx, BUBBLE.cy, BUBBLE.r, 'mk', fill('var(--turn)'))
    + path(`M${BUBBLE.cx - 5} ${BUBBLE.cy} l4 4 l7 -7`, undefined, 'fill:none;stroke:#4a3000;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round'))
    + text(Z1.x, Z1.y, Z1.size, 'z', fill('var(--fx)'), 'z1') + text(Z2.x, Z2.y, Z2.size, 'Z', fill('var(--fx)'), 'z2'),
  read: text(READ.x, READ.y, READ.size, '沙沙', fill('var(--fx)'), 'sfx'),
  run: rect(RUN.x0, RUN.y0, RUN.x1 - RUN.x0, RUN.y1 - RUN.y0, 2, 'mk-thin', fill('#1b2430'))
    + RUN_LINES.map((d, i) => path(d, `code${i + 1}`, 'fill:none;stroke:var(--code);stroke-width:1.6;stroke-linecap:round')).join(''),
  think: THINK.map(([x, y, r], i) => circle(x, y, r, `dot${i + 1}`, fill('var(--fx)'))).join(''),
  call: text(CALL.x, CALL.y, CALL.size, '嘟嚕嚕', fill('var(--fx)'), 'sfx'),
  cheer: text(CHEER.x, CHEER.y, CHEER.size, '耶！', fill('var(--fx)'), 'sfx'),
};

/** 一個人物：椅背、人（腿、後髮、左臂、身體、胸前文件與手機、右臂、頭）、桌上地球儀、各種漫符；顯示哪個表情／漫符交給 CSS 依 data-act 決定 */
export function figureSvg(look: Look): string {
  const fig = g('fig', leg('l') + leg('r') + g('hair-back', hair(look).back)
    + arm('l', look) + body(look) + propDoc() + propMobile() + arm('r', look) + head(look, ['work', 'wait', 'turn']));
  return tag('svg', { class: 'figure', xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${FIG.w} ${FIG.h}`, overflow: 'visible' },
    g('chair', rect(11, 36, 38, 36, 8, 'mk', CHAIR)) + fig + propGlobe()
    + g('fx-work', FX.work) + g('fx-wait', FX.wait) + g('fx-turn', FX.turn)
    + g('fx-read', FX.read) + g('fx-run', FX.run) + g('fx-think', FX.think) + g('fx-call', FX.call) + g('fx-cheer', FX.cheer));
}

/** 資訊卡頭像：頭與肩膀、睜眼（工作中的臉），viewBox 只框頭肩 */
export function avatarSvg(look: Look): string {
  return tag('svg', { class: 'avatar', xmlns: 'http://www.w3.org/2000/svg', viewBox: '6 3 48 48' },
    g('hair-back', hair(look).back) + arm('l', look, false) + body(look) + arm('r', look, false) + head(look, ['work']));
}
