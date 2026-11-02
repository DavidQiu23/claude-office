// 鳥山明前期風的 Q 版人物：純函式產生 SVG 字串（不碰 DOM）。座標系 60×84，x 30 是座位中心，桌面在 y 69.5（以下被桌子擋住）。
// 造型照 2026-11-02 的動作示範頁移植：大頭（寬橢圓臉，瀏海壓到眉毛、五官在下半部）、稜角髮束、硬影用加深的實色、只露前臂。
// 線稿：外輪廓 ol（粗）、內線 mk-thin（細）。顏色規則：一律寫在 style 或 class，不用 fill="色"／stroke="色" 屬性。
import { circle, ellipse, fill, line, path, rect, tag } from './svg.js';
import { HAIR_COLORS, SHIRT_COLORS, type Look } from './view.js';

export const FIG = { w: 60, h: 84 } as const;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Pt = [number, number];

const n = (v: number) => Math.round(v * 100) / 100;
const g = (cls: string, children: string) => tag('g', { class: cls }, children);
const text = (x: number, y: number, size: number, s: string, style: string, cls?: string, anchor?: string) =>
  tag('text', { class: cls, x, y, 'font-size': size, 'font-weight': 500, 'text-anchor': anchor, style }, s);

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** 把顏色 a 往 b 混 t：硬影用同色加深的實色 */
const mix = (a: string, b: string, t: number) =>
  '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i]! - v) * t).toString(16).padStart(2, '0')).join('');
const hairShade = (c: string) => mix(c, '#10081a', 0.45);
const clothShade = (c: string) => mix(c, '#3a2a5a', 0.3);

const SKIN = fill('var(--skin)');
const SKIN_SHADE = fill('#f0b48e');
const INK = fill('var(--fig-ink)');
const WHITE = fill('#fff');
const PANTS = fill('#2b2f4a');
const MOUTH_IN = fill('#4a1f3a'); // 張大的嘴裡：深紫，不用紅
const FX_STROKE = (w: number) => `fill:none;stroke:var(--fx);stroke-width:${w};stroke-linecap:round`;
/** 墨色筆畫（眉毛、閉眼、嘴、睫毛） */
const pen = (w: number) => `fill:none;stroke:var(--fig-ink);stroke-width:${w};stroke-linecap:round;stroke-linejoin:round`;
const inkStroke = (d: string, w: number) => path(d, undefined, pen(w));

// ── 頭髮：大塊稜角髮束，不畫髮絲；每束右側一塊加深的硬影。後髮在身體後面 ──

interface Hair { back: string; front: string }

function hair(look: Look): Hair {
  const c = HAIR_COLORS[look.hair]!;
  const lock = (d: string, shade: string) => path(d, 'ol', fill(c)) + path(shade, undefined, fill(hairShade(c)));
  switch (look.style) {
    case 1: // 齊瀏海鮑伯頭
      return {
        back: lock('M9 19.5 Q8 -0.5 30 -1.5 Q52 -0.5 51 19.5 L51 41.5 L9 41.5Z', 'M42 3.5 Q51 7.5 51 19.5 L51 41.5 L45 41.5Z'),
        front: lock('M11 27.5 Q9 -0.5 30 -1.5 Q51 -0.5 49 27.5 L46 27.5 L46 17.5 L14 17.5 L14 27.5Z', 'M39 1 Q49 4.5 49 27.5 L46 27.5 L46 17.5 L41 17.5Z'),
      };
    case 2: // 包頭：瀏海往一邊掃
      return {
        back: circle(32, -3.5, 8, 'ol', fill(c)),
        front: lock('M11 26.5 Q9 1.5 30 0.5 Q51 1.5 49 26.5 L46 20.5 Q34 19.5 24 9.5 Q20 18.5 14 22.5Z', 'M39 3 Q49 6.5 49 26.5 L46 20.5 Q42 20 39 18.5Z'),
      };
    case 3: // 旁分短髮
      return {
        back: '',
        front: lock('M12 27.5 L10 12 Q14 0 30 -1 Q46 0 50 12 L49 27.5 L46 18 Q38 17 31 9 Q26 16 16 17 L14 25Z', 'M40 1 Q48 5 50 12 L49 27.5 L46 18 Q43 17.5 41 16.5Z'),
      };
    case 4: // 中分長髮：後髮垂到肩下
      return {
        back: lock('M9 19.5 Q8 -0.5 30 -1.5 Q52 -0.5 51 19.5 L52 50 L46 46 L42 51 L18 51 L14 46 L8 50Z', 'M42 3.5 Q51 7.5 51 19.5 L52 50 L46 46Z'),
        front: lock('M11 27.5 Q9 -0.5 30 -1.5 Q51 -0.5 49 27.5 L45 22 Q40 12 31 6 L29 6 Q20 12 15 22Z', 'M39 1 Q49 4.5 49 27.5 L45 22 Q43 17 40 13Z'),
      };
    case 5: { // 毛帽：帽子用衣服色，兩側露一束頭髮
      const s = SHIRT_COLORS[look.shirt]!;
      return {
        back: '',
        front: path('M12 17 L11 27 L15 24 L16 17Z M48 17 L49 27 L45 24 L44 17Z', 'ol', fill(c))
          + circle(30, -7, 4, 'ol', fill(s)) + path('M11 14 Q11 -5 30 -5 Q49 -5 49 14Z', 'ol', fill(s)) + path('M40 -3 Q49 1 49 11 L41 11Z', undefined, fill(clothShade(s)))
          + rect(10, 10.5, 40, 7, 3.5, 'ol', fill(s)) + line([15, 20, 25, 30, 35, 40, 45].map((x) => `M${x} 12 v4`).join(' '), 'mk-thin'),
      };
    }
    default: // 0 尖角短髮
      return {
        back: '',
        front: lock('M12 27.5 L9 11.5 L16 3.5 L24 -1.5 L36 -2.5 L46 1.5 L54 -4.5 L51 8.5 L49 27.5 L45 17.5 L42 23.5 L36 13.5 L32 22.5 L26 12.5 L22 21.5 L16 13.5Z',
          'M36 -2.5 L46 1.5 L54 -4.5 L51 8.5 L49 27.5 L45 17.5 L42 23.5 L39 15.5Z'),
      };
  }
}

// ── 臉：眼睛在 y 26（臉的下半部），左右眼 x 23／37。眼型 0 角度眼加粗斜眉、1 大圓眼加睫毛。鼻子一小筆 ──

type Mood = 'work' | 'wait' | 'turn';
const EY = 26;
const EYES_X: [number, number][] = [[23, -1], [37, 1]]; // [x, 外側方向]
const both = (f: (ex: number, side: number) => string) => EYES_X.map(([ex, side]) => f(ex, side)).join('');

const openEye = (round: boolean) => (ex: number, side: number) => round
  ? ellipse(ex, EY, 3.7, 4.5, 'mk-thin', WHITE) + ellipse(ex + 0.3, EY + 0.6, 2.5, 3.3, undefined, INK) + circle(ex - 0.6, EY - 0.7, 1.1, undefined, WHITE)
    + inkStroke(`M${ex + side * 3.4} ${EY - 3.2} l${side * 1.8} -1.4 M${ex + side * 3.9} ${EY - 1.6} l${side * 1.9} -.6`, 1.1)
  : path(`M${ex - 4} ${EY - 2.4} L${ex + 4} ${EY - 2.4} Q${ex + 4.4} ${EY + 3} ${ex} ${EY + 3.2} Q${ex - 4.4} ${EY + 3} ${ex - 4} ${EY - 2.4}Z`, 'mk-thin', WHITE)
    + ellipse(ex, EY + 0.6, 1.6, 2.3, undefined, INK) + circle(ex - 0.5, EY - 0.3, 0.6, undefined, WHITE);
const angryEye = (ex: number, side: number) =>
  path(`M${n(ex - 4.2)} ${n(EY - 1.2 - side * 1.2)} L${n(ex + 4.2)} ${n(EY - 1.2 + side * 1.2)} Q${ex + 4} ${EY + 3.2} ${ex} ${EY + 3.2} Q${ex - 4} ${EY + 3.2} ${n(ex - 4.2)} ${n(EY - 1.2 - side * 1.2)}Z`, 'mk-thin', WHITE)
  + circle(ex, EY + 1.2, 1.3, undefined, INK);
const shutEye = (ex: number) => inkStroke(`M${ex - 4} ${EY + 0.5} q4 2.4 8 0`, 1.6);

function face(look: Look, m: Mood): string {
  const round = look.eyes === 1;
  const parts: Record<Mood, () => string> = {
    // 角度眼的粗眉幾乎水平：專心但不兇（往中間壓的眉毛留給爆氣）
    work: () => both(openEye(round)) + (round ? '' : inkStroke('M19 18.6 L27 19.6 M33 19.6 L41 18.6', 2.4)) + inkStroke('M27.8 33.5 L32.2 33.5', 1.4),
    wait: () => both(angryEye) + inkStroke('M18 16 L27 20.5 M33 20.5 L42 16', 2.8) // 大喊：上下排牙齒
      + path('M24 31.5 Q30 30 36 31.5 Q35 42 30 42 Q25 42 24 31.5Z', 'mk-thin', MOUTH_IN)
      + path('M24.8 32.3 L35.2 32.3 L34.8 33.7 L25.2 33.7Z', undefined, WHITE) + path('M26 40.5 L34 40.5 L33.4 39.3 L26.6 39.3Z', undefined, WHITE),
    turn: () => both(shutEye) + inkStroke('M19 19.5 L27 20 M33 20 L41 19.5', 1.8) + inkStroke('M27.4 34 L32.6 34', 1.4),
  };
  return g(`face-${m}`, parts[m]());
}

const GLASSES = line('M17.8 26 a5.2 5.2 0 1 0 10.4 0 a5.2 5.2 0 1 0 -10.4 0 M31.8 26 a5.2 5.2 0 1 0 10.4 0 a5.2 5.2 0 1 0 -10.4 0 M28.2 25.5 h3.6', 'mk');

function head(look: Look, moods: Mood[]): string {
  return g('head', rect(26.5, 35.5, 7, 7, 0, 'mk-thin', SKIN_SHADE) // 脖子
    + ellipse(30, 22.5, 18, 17, 'ol', SKIN)
    + path('M40 35.5 Q47 30.5 47.5 21.5 Q48 35.5 36 38.9Z', undefined, SKIN_SHADE) // 下巴右側的硬影
    + path('M12 24.5 q-3.2 1 -1.5 5 q1 2 2.4 1.4 M48 24.5 q3.2 1 1.5 5 q-1 2 -2.4 1.4', 'mk-thin', SKIN) // 耳朵
    + line('M30.3 29.1 l1.4 1.8 l-1.6 .4', 'mk-thin') // 鼻子
    + moods.map((m) => face(look, m)).join('')
    + hair(look).front + (look.glasses ? GLASSES : ''));
}

// ── 身體與衣服：窄肩的身體、右側一條硬影。T 恤（領口弧線）、帽 T（帽緣、兩條繩、口袋）、襯衫（白領加領帶） ──

function body(look: Look): string {
  const c = SHIRT_COLORS[look.shirt]!;
  const tie = SHIRT_COLORS[(look.shirt + 5) % SHIRT_COLORS.length]!; // 領帶換一個和衣服對比的顏色
  const outfit = [
    line('M24 41 Q30 46.5 36 41', 'mk-thin'),
    path('M19 44 Q21 39 30 39.5 Q39 39 41 44 Q30 50 19 44Z', 'mk-thin', fill(c)) + line('M27 47 v7 M33 47 v7', 'mk-thin')
      + circle(27, 54.5, 0.9, undefined, INK) + circle(33, 54.5, 0.9, undefined, INK) + line('M22.5 60 H37.5 L39.5 67 H20.5Z', 'mk-thin'),
    path('M24 40.8 L30 46 L26.5 49.5Z M36 40.8 L30 46 L33.5 49.5Z', 'mk-thin', WHITE) + path('M30 46 l-2.2 9 l2.2 3.2 l2.2 -3.2z', 'mk-thin', fill(tie)),
  ][look.outfit] ?? '';
  return g('body', path('M15 85.5 L15 51.5 Q15 41.5 25 40.5 L35 40.5 Q45 41.5 45 51.5 L45 85.5Z', 'ol', fill(c))
    + path('M36 41.5 Q45 42.5 45 51.5 L45 85.5 L37 85.5Z', undefined, fill(clothShade(c))) + outfit);
}

/** 只露前臂：打字時手在桌緣（大半被桌子擋住） */
const arm = (side: 'l' | 'r', look: Look) => {
  const c = SHIRT_COLORS[look.shirt]!, x = side === 'l' ? 10 : 41;
  return g(`arm arm-${side}`, rect(x, 57.5, 9, 16, 4.5, 'ol', fill(c)) + rect(x + 5.2, 59.5, 2.6, 12, 1.3, undefined, fill(clothShade(c)))
    + circle(x + 4.5, 73.5, 4, 'mk-thin', SKIN));
};

/** 腿：坐著時被桌子擋住，站起來時露出一點 */
const leg = (side: 'l' | 'r') => {
  const x = side === 'l' ? 22.5 : 30.5;
  return g(`leg leg-${side}`, rect(x, 66, 7, 15, 3, 'ol', PANTS) + path(`M${x - 1} 83.5 v-2 q0 -3 3.5 -3 h2 q3 0 3 3 v2z`, 'mk-thin', INK));
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
const Z1 = { x: -4, y: -4, size: 13 }, Z2 = { x: 0, y: -14, size: 16 };
/** 進出貼紙：白底墨線小框（左下一個小尾巴指向頭），和「！」框同在頭的右上方；文字置中 */
const STICK_IN = { x: 44, y: -20, w: 42, h: 18, size: 13, text: '到！' };
const STICK_OUT = { x: 40, y: -22, w: 48, h: 18, size: 11, text: '辛苦了～' };
const RISE = 'M12 8 v-14 M19 2 v-16 M26 -2 v-12'; // 退場往上的速度線（頭的左上方）
const RISE_PTS: Pt[] = [[12, 8], [12, -6], [19, 2], [19, -14], [26, -2], [26, -14]];
type Stick = typeof STICK_IN;
const tail = (s: Stick): Pt[] => [[s.x + 6, s.y + s.h], [s.x, s.y + s.h + 8], [s.x + 12, s.y + s.h]];
const stickPts = (s: Stick): Pt[] => [[s.x, s.y], [s.x + s.w, s.y + s.h], ...tail(s),
  ...textPts(s.x + s.w / 2 - (s.size * [...s.text].length) / 2, s.y + s.h - 5, s.size, s.size * [...s.text].length)];
const sticker = (s: Stick) =>
  tag('polygon', { points: [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], ...tail(s).reverse(), [s.x, s.y + s.h]].map((p) => p.join(',')).join(' '), class: 'mk-thin', style: WHITE })
  + text(s.x + s.w / 2, s.y + s.h - 5, s.size, s.text, INK, undefined, 'middle'); // 白底貼紙：字用墨色（夜晚的 --fx 是淺色）

/** 文字的大略外框：全形字寬 = 字級，半形 0.6 字級；基線以上一個字級、以下 0.25 */
const textPts = (x: number, y: number, size: number, w: number): Pt[] => [[x, y - size], [x + w, y + size * 0.25]];

function boxOf(pts: Pt[], pad: number): Box {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: n(Math.min(...xs) - pad), y0: n(Math.min(...ys) - pad), x1: n(Math.max(...xs) + pad), y1: n(Math.max(...ys) + pad) };
}

/** 「！」框含脈動（1.12 倍）的外框（不含 pad），測試用來確認不會蓋到招牌 */
export const BURST_BOX: Box = boxOf(BURST_PULSE, 0);

/** 漫符在人物座標裡的外框（人物座標 x 30 = 座位中心；座位 ±60 → x −30 到 90）；pad 涵蓋線寬 */
export const FX_BOXES: Record<'work' | 'wait' | 'turn' | 'in' | 'out', Box> = {
  work: boxOf([...textPts(SFX.x, SFX.y, SFX.size, SFX.size * 2), [1, 48], [6, 56], [54, 48], [59, 56]], 1),
  wait: boxOf([...LINES.flatMap((l): Pt[] => [[l.x1, l.y1], [l.x2, l.y2]]), ...BURST_PULSE, [DROP[0] - 4, DROP[1]], [DROP[0] + 4, DROP[1] + 9]], 1),
  turn: boxOf([[BUBBLE.cx - BUBBLE.r, BUBBLE.cy - BUBBLE.r], [BUBBLE.cx + BUBBLE.r, BUBBLE.cy + BUBBLE.r],
    ...textPts(Z1.x, Z1.y, Z1.size, Z1.size * 0.6), ...textPts(Z2.x, Z2.y, Z2.size, Z2.size * 0.6)], 1),
  in: boxOf(stickPts(STICK_IN), 1),
  out: boxOf([...stickPts(STICK_OUT), ...RISE_PTS], 1),
};

const FX = {
  work: text(SFX.x, SFX.y, SFX.size, '噠噠', fill('var(--fx)'), 'sfx')
    + path('M6 48 q-5 3 -2 8 M54 48 q5 3 2 8', 'speed', FX_STROKE(1.2)),
  wait: g('lines', LINES.map((l) => path(`M${l.x1} ${l.y1} L${l.x2} ${l.y2}`, undefined, FX_STROKE(l.long ? 1.8 : 1))).join(''))
    + path(`M${DROP[0]} ${DROP[1]} q-4 6 0 9 q4 -3 0 -9z`, 'drop mk-thin', fill('#bfe3ff'))
    + g('burst', tag('polygon', { points: BURST.map((p) => p.join(',')).join(' '), class: 'mk-thin', style: WHITE })
      + text(BURST_C[0], BURST_C[1] + 5, 14, '！', fill('var(--waiting)'), undefined, 'middle')),
  turn: g('bubble', circle(BUBBLE.cx, BUBBLE.cy, BUBBLE.r, 'mk', fill('var(--turn)'))
    + path(`M${BUBBLE.cx - 5} ${BUBBLE.cy} l4 4 l7 -7`, undefined, 'fill:none;stroke:var(--fig-ink);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round'))
    + text(Z1.x, Z1.y, Z1.size, 'z', fill('var(--fx)'), 'z1') + text(Z2.x, Z2.y, Z2.size, 'Z', fill('var(--fx)'), 'z2'),
  in: sticker(STICK_IN),
  out: path(RISE, 'speed', FX_STROKE(1.4)) + sticker(STICK_OUT),
};

/** 一個人物（照美術定稿，坐著時不畫椅子）：人（腿、後髮、身體、兩隻前臂、頭）、三種狀態漫符與進出貼紙；顯示哪個表情／漫符交給 CSS 依 data-act／data-fx 決定 */
export function figureSvg(look: Look): string {
  const fig = g('fig', leg('l') + leg('r') + g('hair-back', hair(look).back)
    + body(look) + arm('l', look) + arm('r', look) + head(look, ['work', 'wait', 'turn']));
  return tag('svg', { class: 'figure', xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${FIG.w} ${FIG.h}`, overflow: 'visible' },
    fig
    + g('fx-work', FX.work) + g('fx-wait', FX.wait) + g('fx-turn', FX.turn) + g('fx-in', FX.in) + g('fx-out', FX.out));
}

/** 資訊卡頭像：頭與肩膀、睜眼（工作中的臉），viewBox 只框頭肩 */
export function avatarSvg(look: Look): string {
  return tag('svg', { class: 'avatar', xmlns: 'http://www.w3.org/2000/svg', viewBox: '4 -6 52 52' },
    g('hair-back', hair(look).back) + body(look) + head(look, ['work']));
}