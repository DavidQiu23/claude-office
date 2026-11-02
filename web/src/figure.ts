// 鳥山明前期風的 Q 版人物：純函式產生 SVG 字串（不碰 DOM）。座標系 60×84，x 30 是座位中心，桌面在 y 69.5（以下被桌子擋住）。
// 造型照 2026-11-02 的動作示範頁移植：大頭（寬橢圓臉，瀏海壓到眉毛、五官在下半部）、稜角髮束、硬影用加深的實色、只露前臂。
// 線稿：外輪廓 ol（粗）、內線 mk-thin（細）。顏色規則：一律寫在 style 或 class，不用 fill="色"／stroke="色" 屬性。
import { circle, ellipse, fill, line, path, rect, tag } from './svg.js';
import { HAIR_COLORS, SHIRT_COLORS, type Look } from './view.js';

export const FIG = { w: 60, h: 84 } as const;

type Pt = [number, number];

const n = (v: number) => Math.round(v * 100) / 100;
const g = (cls: string, children: string) => tag('g', { class: cls }, children);

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
/** 爆氣的眼：上緣從外眼角往內眼角壓低（內眼角低） */
const angryEye = (ex: number, side: number) =>
  path(`M${n(ex - 4.2)} ${n(EY - 1.2 + side * 1.2)} L${n(ex + 4.2)} ${n(EY - 1.2 - side * 1.2)} Q${ex + 4} ${EY + 3.2} ${ex} ${EY + 3.2} Q${ex - 4} ${EY + 3.2} ${n(ex - 4.2)} ${n(EY - 1.2 + side * 1.2)}Z`, 'mk-thin', WHITE)
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
    // 冥想：閉眼、眉毛放鬆；右眼那組可以單獨換成睜眼加挑眉（瞄觀看者，figure.css 的 fig-wink）
    turn: () => shutEye(23) + inkStroke('M19 20 L27 20.4', 1.8)
      + g('wink-shut', shutEye(37) + inkStroke('M33 20.4 L41 20', 1.8))
      + g('wink-open', openEye(round)(37, 1) + inkStroke('M33 19.6 Q37 16.6 41 18.2', 1.8))
      + inkStroke('M27.4 34 L32.6 34', 1.4),
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
    + g('hair', hair(look).front) + (moods.includes('wait') ? g('hair-up', hairUp(look)) : '') + (look.glasses ? GLASSES : ''));
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

/** 只露前臂：打字時手在桌緣（下半被桌子擋住，殘影才看得到手）。cls 預設是會打字的手，殘影和推鼻子時靜止的左手另給 class */
const arm = (side: 'l' | 'r', look: Look, cls = `arm arm-${side}`) => {
  const c = SHIRT_COLORS[look.shirt]!, x = side === 'l' ? 10 : 41;
  return g(cls, rect(x, 53, 9, 16, 4.5, 'ol', fill(c)) + rect(x + 5.2, 55, 2.6, 12, 1.3, undefined, fill(clothShade(c)))
    + circle(x + 4.5, 69, 4, 'mk-thin', SKIN));
};
/** 殘像打字：每隻手後面兩層殘影（透明度和落後的時間在 figure.css），排在真的手前面才會畫在後面 */
const typing = (look: Look) => (['l', 'r'] as const).map((s) =>
  arm(s, look, `ghost ghost-2 ghost-${s}`) + arm(s, look, `ghost ghost-1 ghost-${s}`) + arm(s, look)).join('');
/** 推鼻子：左手停在桌緣，右手手肘撐桌、食指推到鼻樑（眼鏡中間） */
const nosePush = (look: Look) => {
  const c = SHIRT_COLORS[look.shirt]!;
  return arm('l', look, 'arm-rest') + g('push', path('M48.3 66.6 L39.7 69.4 L28.7 36.4 L37.3 33.6Z', 'ol', fill(c))
    + rect(29.6, 26.5, 2.6, 8, 1.3, 'mk-thin', SKIN) + circle(32.5, 34.5, 4, 'mk-thin', SKIN));
};

/** 斜的袖子（圓頭粗筆畫：外面一圈墨線、裡面衣服色） */
const sleeve = (c: string, d: string) => path(d, undefined, pen(11.6)) + path(d, undefined, `fill:none;stroke:${c};stroke-width:8.4;stroke-linecap:round`);

/** 抱胸（冥想）：兩邊上臂垂在身側，兩條前臂交叉在胸前（圓頭粗筆畫：外面一圈墨線、裡面衣服色），兩隻手搭在對面的上臂上；手肘在桌面以上 */
const armsCross = (look: Look) => {
  const c = SHIRT_COLORS[look.shirt]!;
  return rect(10, 43, 9, 17, 4.5, 'ol', fill(c)) + rect(41, 43, 9, 17, 4.5, 'ol', fill(c)) + rect(46.2, 45, 2.6, 13, 1.3, undefined, fill(clothShade(c)))
    + sleeve(c, 'M45 61 L17 54') + sleeve(c, 'M15 61 L43 54') + circle(14, 53, 4, 'mk-thin', SKIN) + circle(46, 53, 4, 'mk-thin', SKIN);
};

// ── 爆氣 ──

/** 雙拳握在腰側（坐姿座標，站起來後由 figure.css 整個上移）：前臂往下、拳頭上兩條指縫 */
const FISTS: Pt[] = [[11.5, 61.5], [48.5, 61.5]];
const FIST_R = 5;
const fists = (look: Look) => {
  const c = SHIRT_COLORS[look.shirt]!;
  return FISTS.map(([fx, fy]) => rect(fx - 4.5, fy - 19, 9, 18, 4.5, 'ol', fill(c)) + rect(fx + 0.7, fy - 17, 2.6, 14, 1.3, undefined, fill(clothShade(c)))
    + circle(fx, fy, FIST_R, 'ol', SKIN) + line(`M${fx - 2.5} ${fy - 2} h5 M${fx - 2.5} ${fy + 0.5} h5`, 'mk-thin')).join('');
};

/** 豎起的頭髮：所有髮型共用一個往上炸開的形狀，顏色照原本的髮色（不變色） */
const HAIR_UP: Pt[] = [[11, 27.5], [7, 7.5], [13, 9.5], [11, -8.5], [20, 1.5], [22, -18.5], [29, -2.5], [34, -21.5], [38, -3.5], [46, -16.5], [46, 2.5],
  [54, -6.5], [51, 12.5], [49, 27.5], [45, 18.5], [42, 23.5], [36, 14.5], [32, 22.5], [26, 13.5], [22, 21.5], [16, 14.5]];
const poly = (pts: Pt[]) => 'M' + pts.map((p) => p.join(' ')).join(' L') + 'Z';
const hairUp = (look: Look) => {
  const c = HAIR_COLORS[look.hair]!;
  return path(poly(HAIR_UP), 'ol', fill(c)) + path(poly(HAIR_UP.slice(7, 15).concat([[40, 15.5], [39, -0.5]])), undefined, fill(hairShade(c)));
};

/** 氣場：半透明白色的一圈火焰（外層有墨線輪廓），（連續三次貝茲的控制點），底邊在 y 83.5（被桌子擋住）。中、內兩層是同形往底邊中點縮小 */
const AURA_BASE: Pt = [30, 83.5];
const AURA: Pt[] = [[-4, 83.5], [-16, 53.5], [0, 33.5], [-8, 11.5], [4, 19.5], [4, 3.5], [8, -14.5], [16, -2.5], [20, -18.5], [26, -30.5],
  [32, -16.5], [38, -24.5], [42, -30.5], [46, -16.5], [52, -10.5], [58, -18.5], [58, 3.5], [66, 7.5], [72, -0.5], [64, 27.5], [78, 51.5], [64, 83.5]];
const shrink = (k: number): Pt[] => AURA.map(([x, y]) => [n(AURA_BASE[0] + (x - AURA_BASE[0]) * k), n(AURA_BASE[1] + (y - AURA_BASE[1]) * k)]);
const flame = (pts: Pt[]) => `M${pts[0]!.join(' ')} C${pts.slice(1).map((p) => p.join(' ')).join(' ')}Z`;
/** 往上竄的小火舌：從 (x, 27.5) 往上竄（動畫在 figure.css 的 fig-tongue） */
const TONGUES = [6, 22, 40, 56];
/** 小石子：桌子左右外緣，從桌面附近往上飄（figure.css 的 fig-rock），不經過名牌 */
const ROCKS: Pt[] = [[-27, 66], [82, 66], [-22, 66]];
const rockPts = ([x, y]: Pt): Pt[] => [[x, y], [x + 3, y - 2], [x + 6, y - 1], [x + 6.5, y + 2], [x + 3.5, y + 3.5], [x + 0.5, y + 2.5]];

const AURA_SVG = g('aura', path(flame(AURA), 'aura-1', `fill:#fff;fill-opacity:.4;${pen(1.4).replace('fill:none;', '')}`)
  + path(flame(shrink(0.78)), 'aura-2', 'fill:#fff;fill-opacity:.5')
  + path(flame(shrink(0.55)), 'aura-3', 'fill:#fff;fill-opacity:.7')
  + TONGUES.map((x, i) => path(`M${x} 27.5 q-4 -8 0 -16 q4 8 0 16z`, 'tongue mk-thin', `fill:#fff;fill-opacity:.85;animation-delay:${n(-0.23 * i)}s`)).join(''));
const ROCKS_SVG = g('rocks', ROCKS.map((r, i) =>
  tag('polygon', { points: rockPts(r).map((p) => p.join(',')).join(' '), class: 'rock mk-thin', style: `${fill(i % 2 ? '#a8a29a' : '#8c8780')};animation-delay:${[0, -0.9, -1.7][i]}s` })).join(''));

/** 腿：坐著時被桌子擋住，站起來時露出一點 */
const leg = (side: 'l' | 'r') => {
  const x = side === 'l' ? 22.5 : 30.5;
  return g(`leg leg-${side}`, rect(x, 66, 7, 15, 3, 'ol', PANTS) + path(`M${x - 1} 83.5 v-2 q0 -3 3.5 -3 h2 q3 0 3 3 v2z`, 'mk-thin', INK));
};

// ── 瞬移 ──

/** 退場的雙指點額：左手垂在身側，右手手肘往外抬，食指和中指併攏朝上、貼在右邊額頭（畫得比真的大，100px 也認得出兩根手指） */
const salute = (look: Look) => {
  const c = SHIRT_COLORS[look.shirt]!;
  return arm('l', look, 'arm-rest') + sleeve(c, 'M43 47 L53 34') + sleeve(c, 'M53 34 L42.5 19')
    + rect(35.2, 4, 3.6, 13, 1.8, 'mk-thin', SKIN) + rect(38.8, 5, 3.6, 12, 1.8, 'mk-thin', SKIN)
    + circle(40.5, 18, 4.4, 'mk-thin', SKIN);
};

const SVG_ATTRS = { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${FIG.w} ${FIG.h}`, overflow: 'visible' };
/** 殘影：人的剪影（頭和上身），淡藍半透明 */
const SILHOUETTE = ellipse(30, 22.5, 18, 17, undefined) + path('M15 70 L15 51.5 Q15 41.5 25 40.5 L35 40.5 Q45 41.5 45 51.5 L45 70Z', undefined);
/** 瞬移的光痕和兩個殘影：放在人物 SVG 外面（.person 的另一個子元素），人被壓成一條線時光痕還看得到。何時出現交給 figure.css 依 data-fx */
export const WARP_SVG = tag('svg', { class: 'warp', ...SVG_ATTRS },
  g('after after-l', SILHOUETTE) + g('after after-r', SILHOUETTE)
  + g('streak', line('M30 -8 V72', 'streak-glow', 'stroke:#8fd8ff;stroke-width:6;stroke-linecap:round;opacity:.6')
    + line('M30 -8 V72', 'streak-core', 'stroke:#fff;stroke-width:2;stroke-linecap:round')));

/** 一個人物（照美術定稿，坐著時不畫椅子）：氣場（排在人後面）、人（腿、後髮、身體、打字／握拳／抱胸的手、頭、推鼻子和點額的手）、小石子；
 *  顯示哪個表情、姿勢交給 CSS 依 data-act／data-fx 決定。.fig 的 transform 給站起來用，抖動放在裡面的 .shake */
export function figureSvg(look: Look): string {
  const fig = g('fig', g('shake', leg('l') + leg('r') + g('hair-back', hair(look).back)
    + body(look) + g('arms-type', g('typing', typing(look))) + g('arms-fist', fists(look)) + g('arms-cross', armsCross(look))
    + head(look, ['work', 'wait', 'turn'])
    + g('nose', nosePush(look)) + g('salute', salute(look)))); // 推鼻子、點額的手要蓋在臉和頭髮上，排在頭後面
  return tag('svg', { class: 'figure', ...SVG_ATTRS }, AURA_SVG + fig + ROCKS_SVG);
}

/** 資訊卡頭像：頭與肩膀、睜眼（工作中的臉），viewBox 只框頭肩 */
export function avatarSvg(look: Look): string {
  return tag('svg', { class: 'avatar', xmlns: 'http://www.w3.org/2000/svg', viewBox: '4 -6 52 52' },
    g('hair-back', hair(look).back) + body(look) + head(look, ['work']));
}