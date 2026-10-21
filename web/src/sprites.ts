// Claude 辦公室像素素材：全部是文字點陣 + 色表，和 canvas 的 fillRect 一一對應。
// 設計稿（artboard）與遊戲程式讀同一份資料，所以設計稿畫得出來的，程式一定畫得出來。
// 圖層 = { x, y, rows: [字串…] }；'.' 是透明，其他字元查色表；後面的圖層蓋住前面的。

export interface Layer { x: number; y: number; rows: string[] }
export type Palette = Record<string, string>;
/** px[y][x] 是 CSS 顏色，null 為透明 */
export interface Sprite { w: number; h: number; px: (string | null)[][] }
export type Pose = 'sit0' | 'sit1' | 'up' | 'idle' | 'walk0' | 'walk1';
export type Outfit = 'tee' | 'hoodie' | 'shirt';
export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';

// ---------- 色彩工具 ----------
const toRgb = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]): string => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number): string => { const A = toRgb(a), B = toRgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export const darker = (h: string, t: number): string => mix(h, '#1d1a2e', t);
export const lighter = (h: string, t: number): string => mix(h, '#ffffff', t);

// ---------- 通用：圖層合成 ----------
// 回傳 { w, h, px: [h][w] 的顏色字串或 null }
export function compose(w: number, h: number, layers: Layer[], palette: Palette): Sprite {
  const px: (string | null)[][] = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  for (const L of layers) {
    const lw = L.rows[0].length;
    L.rows.forEach((r, j) => { if (r.length !== lw) throw new Error('圖層列寬不一致：第 ' + j + ' 列 ' + r.length + ' ≠ ' + lw + '：' + r); });
    L.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        const x = L.x + i, y = L.y + j;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const c = palette[ch];
        if (!c) throw new Error('色表沒有字元 ' + JSON.stringify(ch));
        px[y][x] = c;
      }
    });
  }
  return { w, h, px };
}

// 轉成 canvas：遊戲程式用（ctx 是 CanvasRenderingContext2D）
export function paint(ctx: CanvasRenderingContext2D, sprite: Sprite, ox = 0, oy = 0): void {
  sprite.px.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1); } }));
}

// ======================================================
//  角色 20×28
//  疊圖順序：椅子 → 腿 → 身體 → 衣服款式 → 手臂 → 頭 → 表情 → 髮型 → 眼鏡
// ======================================================
export const CHAR_W = 20, CHAR_H = 28;

const CHAR_PAL = {
  o: '#1d1a2e', w: '#ffffff', s: '#ffd9b8', d: '#e8a98a', b: '#ff9a8f', m: '#b4584a', n: '#7a2e3a',
  p: '#3b4a7a', q: '#51639b', k: '#4a2f24', K: '#6b4636',
  c: '#34405f', C: '#4b5b85', D: '#262f48', r: '#e0524f', f: '#ff6f61',
};

const rep = (ch: string, n: number) => ch.repeat(n);
const arms = (l: string, r: string) => l + rep('.', 8) + r; // 手臂層一列 = 左 4 格 + 中間 8 格空 + 右 4 格（層從 x=2 開始）

const CHAIR: Layer = { x: 2, y: 11, rows: [
  '.oooooooooooooo.',
  'o' + rep('C', 14) + 'o',
  ...Array(10).fill('o' + rep('c', 14) + 'o'),
  'o' + rep('D', 14) + 'o',
  '.oooooooooooooo.',
] };

const LEGS: Layer = { x: 4, y: 22, rows: [
  '.opqo..opqo.', '.opqo..opqo.', '.opqo..opqo.', '.opqo..opqo.', 'oKkko..oKkko', 'ooooo..ooooo',
] };
const LEGS_W0: Layer = { x: 4, y: 22, rows: [ // 左腳在前
  '..opqo.opqo.', '..opqo.opqo.', '..opqo.opqo.', '..opqo.opqo.', '.oKkko.oKkko', '.ooooo.ooooo',
] };
const LEGS_W1: Layer = { x: 4, y: 22, rows: [ // 右腳在前
  '.opqo.opqo..', '.opqo.opqo..', '.opqo.opqo..', '.opqo.opqo..', 'oKkko.oKkko.', 'ooooo.ooooo.',
] };

// 身體 10 寬；第一列與頭的下緣輪廓重疊（共用同一條線）
const TORSO: Layer = { x: 5, y: 12, rows: [
  '.oooooooo.',
  'oSSSSSSSSo',
  'oUSSSSSSSo',
  'oSSSSSSSSo',
  'oSSSSSSSSo',
  'oSSSSSSSSo',
  'oSSSSSSSSo',
  'oTTTTTTTTo',
  'oTTTTTTTTo',
  '.oooooooo.',
] };

// 衣服款式：蓋在身體上決定領口與花樣，位置同 TORSO。
const OUTFITS: Record<Outfit, Layer> = {
  tee: { x: 5, y: 13, rows: [
    'oSSddddSSo',
    'oUSSddSSSo',
  ] },
  hoodie: { x: 5, y: 13, rows: [
    'oSTddddTSo',
    'oUSTddTSSo',
    'oSSwSSwSSo',
    'oSSwSSwSSo',
    'oSSwSSwSSo',
    'oSTTTTTTSo',
  ] },
  shirt: { x: 5, y: 13, rows: [
    'oSwddddwSo',
    'oUSwwwwSSo',
    'oSSSrrSSSo',
    'oSSSrrSSSo',
    'oSSSrrSSSo',
    'oSSSrrSSSo',
  ] },
};

const HEAD: Layer = { x: 4, y: 2, rows: [
  '..oooooooo..',
  '.osssssssso.',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  '.osssssssso.',
  '.oddddddddo.',
  '..oooooooo..',
] };

// 眼睛 2×3（左上角高光）分開在 x=2..3 與 8..9，中間留空給鏡框的橋
const FACES: Record<'work' | 'idle' | 'alert', Layer> = {
  work: { x: 4, y: 2, rows: [
    '............', '............', '............', '............',
    '..ow....ow..', '..oo....oo..', '..oo....oo..', '.bb......bb.', '.....mm.....',
  ] },
  idle: { x: 4, y: 2, rows: [
    '............', '............', '............', '............', '............',
    '..oo....oo..', '............', '.bb.m..m.bb.', '.....mm.....',
  ] },
  alert: { x: 4, y: 2, rows: [
    '............', '............', '............', '..oo....oo..',
    '..ow....ow..', '..oo....oo..', '..oo....oo..', '.bb..nn..bb.', '.....nn.....',
  ] },
};

// 眼鏡：彩色鏡框（不用黑色，才不會和眼睛糊在一起），中間一格橋
const GLASSES: Layer = { x: 4, y: 2, rows: [
  '............', '............', '............',
  '.ffff..ffff.', '.f..ffff..f.', '.f..f..f..f.', '.f..f..f..f.', '.ffff..ffff.',
] };

// 髮型：寬 14。H=髮色 h=暗 L=亮。眼睛在 y=6..8、x=6..7 與 12..13，髮型在這幾列只能留兩側髮絲。
const HAIR: Layer[] = [
  // 0 短髮
  { x: 3, y: 1, rows: [
    '...oooooooo...',
    '..ooHHHHHHoo..',
    '.oHHLLHHHHHHo.',
    '.oHHHHHHHHHHo.',
    '.oHHhHHHHhHHo.',
    '.oHH......HHo.',
    '.oH........Ho.',
  ] },
  // 1 側分瀏海
  { x: 3, y: 1, rows: [
    '...oooooooo...',
    '..ooHHHHHHHo..',
    '.oHLLHHHHHHHo.',
    '.oHHHHHHHHHHo.',
    '.oHHHHHHHHhHo.',
    '.oHHHhH....Ho.',
    '.oHH.........',
  ].map((r) => r.padEnd(14, '.')) },
  // 2 長髮
  { x: 3, y: 1, rows: [
    '...oooooooo...',
    '..ooHHHHHHoo..',
    '.oHHLLHHHHHHo.',
    '.oHHHHHHHHHHo.',
    'oHHHhHHHHhHHHo',
    'oHHH......HHHo',
    'oHH........HHo',
    'oHH........HHo',
    'oHH........HHo',
    'oHh........hHo',
    'ohh........hho',
    '.oo........oo.',
  ] },
  // 3 丸子頭
  { x: 3, y: 0, rows: [
    '......oo......',
    '.....oHHo.....',
    '..ooooHHoooo..',
    '.oHHLLHHHHHHo.',
    '.oHHHHHHHHHHo.',
    '.oHHhHHHHhHHo.',
    '.oHH......HHo.',
    '.oH........Ho.',
  ] },
  // 4 蓬鬆捲髮
  { x: 3, y: 1, rows: [
    '...oooooooo...',
    '..oHLHHHLHHo..',
    '.oHHHHHHHHHHo.',
    'oHLHHHHHHHHLHo',
    'oHHHHHHHHHHHHo',
    'oHHHhHHHHhHHHo',
    'oHH........HHo',
    'oHH........HHo',
    '.oH........Ho.',
  ] },
  // 5 毛帽（帽色 = 髮色）
  { x: 3, y: 0, rows: [
    '......oo......',
    '.....oLLo.....',
    '...ooHHHHoo...',
    '..oHHLLHHHHo..',
    '.oHHHHHHHHHHo.',
    '.ohhhhhhhhhho.',
  ] },
];

// 手臂層（x=2,y=13）。姿勢決定手的位置。
const A_ = arms;
const AR = A_('oSTo', 'oTSo');
interface PoseDef { chair: boolean; legs: Layer; face: 'work' | 'idle' | 'alert'; raise?: boolean; arms: string[] }
const POSES: Record<Pose, PoseDef> = {
  sit0: { chair: true, legs: LEGS, face: 'work', arms: [AR, AR, AR, AR, AR, AR, A_('osso', 'oTSo'), A_('osdo', 'osso'), A_('.oo.', 'osdo'), A_('....', '.oo.')] },
  sit1: { chair: true, legs: LEGS, face: 'work', arms: [AR, AR, AR, AR, AR, AR, A_('oSTo', 'osso'), A_('osso', 'osdo'), A_('osdo', '.oo.'), A_('.oo.', '....')] },
  up: { chair: false, legs: LEGS, face: 'alert', raise: true, arms: [AR, A_('oSTo', '....'), A_('oSTo', '....'), A_('oSTo', '....'), A_('oSTo', '....'), A_('oSTo', '....'), A_('oSTo', '....'), A_('osso', '....'), A_('osdo', '....'), A_('.oo.', '....')] },
  idle: { chair: true, legs: LEGS, face: 'idle', arms: [AR, AR, AR, AR, AR, AR, A_('osso', 'oTSo'), A_('osdo', 'osso'), A_('.oo.', 'osdo'), A_('....', '.oo.')] },
  walk0: { chair: false, legs: LEGS_W0, face: 'work', arms: [AR, AR, AR, AR, AR, AR, A_('oSTo', 'osso'), A_('osso', 'osdo'), A_('osdo', '.oo.'), A_('.oo.', '....')] },
  walk1: { chair: false, legs: LEGS_W1, face: 'work', arms: [AR, AR, AR, AR, AR, AR, A_('osso', 'oTSo'), A_('osdo', 'osso'), A_('.oo.', 'osdo'), A_('....', '.oo.')] },
};

// 舉起的右手（等你處理）：x=14,y=3
const RAISE: Layer = { x: 14, y: 3, rows: [
  '...oo.', '..osso', '..osdo', '..oTSo', '..oTSo', '..oTSo', '..oTSo', '..oTSo', '.oTSo.', 'oTSo..',
] };

export const HAIR_COLORS = ['#2b2233', '#6a4630', '#e8be52', '#b85a30', '#a8aeb6', '#4a3560', '#2c4a6e', '#e07aa5'];
export const SHIRT_COLORS = ['#d9534f', '#e98f3f', '#e6c34a', '#4fb477', '#38a8a0', '#4a90d9', '#8e6fc9', '#d9669a'];

// opts: { pose, style(0-5), outfit('tee'|'hoodie'|'shirt'), glasses(bool), hair('#rrggbb'), shirt('#rrggbb') }
// 回傳依序疊圖的圖層清單與色表；設計稿用它做分層展示，遊戲程式用 character() 即可。
export interface CharOpts { pose: Pose; style: number; outfit: Outfit; glasses: boolean; hair: string; shirt: string }
function characterParts(opts: Partial<CharOpts>) {
  const o: CharOpts = Object.assign({ pose: 'sit0', style: 0, outfit: 'tee', glasses: false, hair: HAIR_COLORS[0], shirt: SHIRT_COLORS[3] }, opts);
  const P = POSES[o.pose];
  const palette: Palette = Object.assign({}, CHAR_PAL, {
    H: o.hair, h: darker(o.hair, 0.28), L: lighter(o.hair, 0.3),
    S: o.shirt, T: darker(o.shirt, 0.25), U: lighter(o.shirt, 0.25),
  });
  const layers: { name: string; layer: Layer }[] = [];
  if (P.chair) layers.push({ name: 'chair', layer: CHAIR });
  layers.push({ name: 'legs', layer: P.legs }, { name: 'torso', layer: TORSO }, { name: 'outfit', layer: OUTFITS[o.outfit] }, { name: 'arms', layer: { x: 2, y: 13, rows: P.arms } });
  if (P.raise) layers.push({ name: 'raised-arm', layer: RAISE });
  layers.push({ name: 'head', layer: HEAD }, { name: 'face', layer: FACES[P.face] }, { name: 'hair', layer: HAIR[o.style] });
  if (o.glasses) layers.push({ name: 'glasses', layer: GLASSES });
  return { palette, layers };
}
export function character(opts: Partial<CharOpts>): Sprite {
  const p = characterParts(opts);
  return compose(CHAR_W, CHAR_H, p.layers.map((l) => l.layer), p.palette);
}

// ======================================================
//  桌子 36×18（4 種狀態）：螢幕背面的指示燈 + 光暈是狀態主角，夜晚的辦公室裡燈會發光
// ======================================================
export const DESK_W = 36, DESK_H = 18;
export const LED_COLORS: Record<DeskState, string> = { empty: '#6b7288', working: '#5cf08a', waiting: '#ff4d4d', idle: '#f2c14e' };

const dRow = (l: string, mid: string, r: string, n: number) => l + mid.repeat(n) + r;
const grainRow = () => { const a = Array(34).fill('W'); [3, 4, 14, 15, 25, 26].forEach((i) => (a[i] = 'V')); return 'o' + a.join('') + 'o'; };
const DESK_BASE: Layer = { x: 0, y: 5, rows: [
  'o'.repeat(36),
  dRow('o', 'U', 'o', 34),
  dRow('o', 'W', 'o', 34),
  grainRow(),
  dRow('o', 'W', 'o', 34),
  dRow('o', 'V', 'o', 34),
  'o'.repeat(36),
  dRow('o', 'v', 'o', 34),
  'o' + 'v'.repeat(11) + 'o' + 'V'.repeat(10) + 'o' + 'v'.repeat(11) + 'o',
  'o' + 'v'.repeat(11) + 'o' + 'VVVVyyVVVV' + 'o' + 'v'.repeat(11) + 'o',
  'o' + 'v'.repeat(11) + 'o' + 'o'.repeat(10) + 'o' + 'v'.repeat(11) + 'o',
  'o'.repeat(36),
  '.' + 'x'.repeat(34) + '.',
] };
const MONITOR: Layer = { x: 10, y: 0, rows: [
  '.oooooooooooooo.',
  'oNNNNNNNNNNNNNNo',
  'oMMMMMMMMMMMMMMo',
  'oMMMMMMMMMMMMMMo',
  'oMMMMMMMMMMMMMMo',
  'oMMMMMMMMMMMMMMo',
  'oMMMMMMMMMMMMMMo',
  'oZZZZZZZZZZZZZZo',
  '.oooooooooooooo.',
  '....oZZZZZZo....',
  '...oZZZZZZZZo...',
] };
const MUG = { x: 28, y: 5, rows: ['oooo.', 'oMMo.', 'owwoo', 'owwo.', 'oooo.'] };
const PAPERS = { x: 3, y: 6, rows: ['.ooooo.', 'oxxxxxo', 'oxzzzxo', 'ooooooo'] };

// state: 'empty' | 'working' | 'waiting' | 'idle'
export function desk(state: DeskState): Sprite {
  const led = LED_COLORS[state];
  const top = state === 'waiting' ? mix('#d9a066', '#ff4d4d', 0.28) : '#d9a066';
  const pal = {
    o: '#1d1a2e', x: 'rgba(0,0,0,0.28)', U: lighter(top, 0.25), W: top, V: darker(top, 0.22), v: '#7a4a2a', y: '#f0d9a0',
    N: '#5b6179', M: '#3a3f52', Z: '#2c3042',
  };
  const px = compose(DESK_W, DESK_H, [DESK_BASE, MONITOR], pal).px;
  const lay = (layers: Layer[], p: Palette) => compose(DESK_W, DESK_H, layers, p).px.forEach((r, y) => r.forEach((c, x) => { if (c) px[y][x] = c; }));
  lay([{ x: 11, y: 2, rows: ['yy', 'yy'] }], { y: '#ffd166' });          // 黃色便利貼
  lay([{ x: 23, y: 5, rows: ['pp', 'pp'] }], { p: '#ff9ac1' });          // 粉色便利貼
  lay([PAPERS, MUG], { o: '#1d1a2e', x: '#f4efe6', z: '#a7a3b3', M: '#6f4e37', w: '#ffffff' });
  const put = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < DESK_W && y < DESK_H) px[y][x] = c; };
  if (state !== 'empty') {
    const R = state === 'waiting' ? 3 : 2; // 光暈半徑
    const halo = mix('#3a3f52', led, 0.5);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R + 1; dx++)
      if (Math.abs(dx - 0.5) + Math.abs(dy - 0.5) <= R + 0.5) put(17 + dx, 4 + dy, halo);
  }
  for (const [x, y] of [[17, 4], [18, 4], [17, 5], [18, 5]]) put(x, y, led);
  if (state === 'waiting') for (let x = 13; x <= 22; x++) put(x, 9, mix(px[9][x] || top, '#ff4d4d', 0.4)); // 紅光灑在桌面
  if (state === 'idle') { put(29, 1, '#ffffffaa'); put(29, 2, '#ffffffaa'); put(30, 0, '#ffffff77'); put(30, 3, '#ffffff77'); } // 咖啡蒸氣
  return { w: DESK_W, h: DESK_H, px };
}

// ======================================================
//  助理機器人 10×10（工作中 / 完成）與頭頂圖示
// ======================================================
const BOT: Layer = { x: 0, y: 0, rows: [
  '....ff....',
  '....oo....',
  '.oooooooo.',
  'oBBBBBBBBo',
  'oBwOBBwOBo',
  'oBOOBBOOBo',
  'oBBBmmBBBo',
  '.oooooooo.',
  '.oBBBBBBo.',
  '..oo..oo..',
] };
const BOT_DONE: Layer = { x: 0, y: 0, rows: [
  '....ff....',
  '....oo....',
  '.oooooooo.',
  'oBBBBBBBBo',
  'oBOOBBOOBo',
  'oBBBBBBBBo',
  'oBmmmmmmBo',
  '.oooooooo.',
  '.oBBBBBBo.',
  '..oo..oo..',
] };
export function bot(done: boolean): Sprite {
  const body = done ? '#5fd38a' : '#9fb2c4';
  return compose(10, 10, [done ? BOT_DONE : BOT], {
    o: '#1d1a2e', B: body, w: '#ffffff', O: '#1d1a2e', m: done ? '#ffffff' : '#1d1a2e', f: done ? '#ffd24a' : '#ff7a7a',
  });
}
const EXCL: Layer = { x: 0, y: 0, rows: [
  '.oooooo.', 'oRRRRRRo', 'oRRwwRRo', 'oRRwwRRo', 'oRRwwRRo', 'oRRwwRRo', 'oRRRRRRo', 'oRRwwRRo', 'oRRwwRRo', 'oRRRRRRo', '.oooooo.', '...oo...',
] };
export const exclamation = () => compose(8, 12, [EXCL], { o: '#1d1a2e', R: '#ff4d4d', w: '#ffffff' });

// ======================================================
//  場景：牆、地板與擺設。每個物件有自己的色表（鍵只在該物件內有意義）。
// ======================================================
const grid = (w: number, h: number, f: (x: number, y: number) => string): string[] => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const center = (s: string, w: number) => { const l = Math.floor((w - s.length) / 2); return '.'.repeat(l) + s + '.'.repeat(w - s.length - l); };
const one = (w: number, h: number, rows: string[], pal: Palette) => compose(w, h, [{ x: 0, y: 0, rows }], pal);
// 在 w×h 的空白畫布上依序蓋章：stamps = [{x,y,rows}]，回傳 rows（字串陣列）
const stampRows = (w: number, h: number, base: ((y: number) => string) | null, stamps: Layer[]): string[] => {
  const g = Array.from({ length: h }, (_, y) => (base ? base(y) : '.'.repeat(w)).split(''));
  for (const st of stamps) st.rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && g[st.y + j] && st.x + i < w) g[st.y + j][st.x + i] = ch; }));
  return g.map((r) => r.join(''));
};

export const tileFloor = () => one(16, 16, grid(16, 16, (x, y) => {
  if (y === 7 || y === 15) return 'H';
  if (y < 7 && x === 5) return 'H';
  if (y > 7 && y < 15 && x === 13) return 'H';
  if (y === 1 && x >= 2 && x <= 5) return 'I';
  if (y === 9 && x >= 9 && x <= 12) return 'I';
  if (y === 3 && x >= 9 && x <= 11) return 'H';
  if (y === 11 && x >= 2 && x <= 4) return 'H';
  return 'G';
}), { G: '#b98557', H: '#a67048', I: '#caa06f' });

export const tileWall = () => one(16, 16, grid(16, 16, (x, y) => {
  if ((x === 5 && y === 4) || (x === 13 && y === 12) || (x === 5 && y === 12) || (x === 13 && y === 4)) return 'C';
  return x < 2 || (x >= 8 && x < 10) ? 'B' : 'A';
}), { A: '#46567f', B: '#4f5f8a', C: '#5a6a96' });

export const tileWainscot = () => one(16, 8, grid(16, 8, (x, y) => (y <= 1 ? 'E' : y === 7 ? 'F' : x === 0 || x === 8 ? 'F' : 'D')),
  { E: '#5b6c9a', D: '#2f3b5e', F: '#222c47' });

// 窗戶 24×18：夜晚、月亮、城市燈火、紫色窗簾
export function windowNight() {
  const tops = [12, 11, 12, 13, 11, 12, 12, 11, 13, 12, 12, 11, 12, 13, 12, 11, 12, 12, 13, 11];
  const stars = new Set(['3,0', '7,1', '16,0', '18,2', '5,3', '12,3']);
  const moon: Record<number, number[]> = { 1: [13, 14, 15, 16].slice(1, 3), 2: [13, 14, 15, 16], 3: [14, 15] };
  const glass = grid(20, 14, (x, y) => {
    if (x <= 2) return x === 1 ? 'p' : 'P';
    if (x >= 17) return x === 18 ? 'p' : 'P';
    if (x === 9 || x === 10 || y === 7) return 'v';
    if (moon[y] && moon[y].includes(x)) return 'q';
    if (stars.has(x + ',' + y)) return 'w';
    if (y >= 11) {
      if (y >= tops[x]) return x % 3 === 1 && y % 2 === 0 && y > tops[x] ? 'y' : 'M';
      return 'L';
    }
    return y < 4 ? 'J' : y < 8 ? 'K' : 'L';
  });
  const rows = [
    'o'.repeat(24), 'o' + 'v'.repeat(22) + 'o',
    ...glass.map((g) => 'ov' + g + 'vo'),
    'o' + 'W'.repeat(22) + 'o', 'o'.repeat(24),
  ];
  return one(24, 18, rows, { o: '#1d1a2e', v: '#7a4a2a', W: '#b87a45', J: '#1b2750', K: '#2a3a74', L: '#44579a', M: '#0f1730', y: '#ffd166', w: '#ffffff', q: '#fff2b8', P: '#7a5a9c', p: '#5f4580' });
}

export const clock = () => one(10, 9, [
  '..oooooo..', '.oxxxxxxo.', 'oxxxxoxxxo', 'oxxxxoxxxo', 'oxxxxoooxo', 'oxxxxxxxxo', 'oxxxxxxxxo', '.oxxxxxxo.', '..oooooo..',
], { o: '#1d1a2e', x: '#f4efe6' });

// 壁燈 20×24：暖光燈罩 + 往下擴散的光錐（半透明像素）
export function sconce() {
  const cone = grid(20, 24, (x, y) => {
    if (y < 7) return '.';
    const w = Math.min(20, 6 + (y - 6)); const l = Math.floor((20 - w) / 2);
    if (x < l || x >= l + w) return '.';
    return y < 10 ? '1' : y < 14 ? '2' : y < 18 ? '3' : '4';
  });
  const shade = ['oooooooo', 'oyyyyyyo', 'oyqqqqyo', 'oyqqqqyo', 'oyyyyyyo', 'oooooooo', '..oddo..'].map((r) => center(r, 20));
  return compose(20, 24, [{ x: 0, y: 0, rows: cone }, { x: 0, y: 0, rows: shade }],
    { o: '#1d1a2e', y: '#ffd166', q: '#fff2b8', d: '#b87a45', 1: 'rgba(255,209,102,0.13)', 2: 'rgba(255,209,102,0.09)', 3: 'rgba(255,209,102,0.055)', 4: 'rgba(255,209,102,0.03)' });
}

const POSTER_TAIL = ['oxxxxxxxxxxo', 'oxxzzzzzzxxo', 'oxxxxxxxxxxo', 'oxxzzzzxxxxo', 'oxxxxxxxxxxo', 'oooooooooooo'];
const POSTER_ROWS = [
  // 0 月亮與山
  ['oooooooooooo', 'oxxxxxxxxxxo', 'oxJJJJJJJJxo', 'oxJJJJyyJJxo', 'oxJJJJyyJJxo', 'oxJJJJJJJJxo', 'oxJJMJJJJJxo', 'oxJMMMJJMJxo', 'oxMMMMMMMMxo', 'oxMMMMMMMMxo', ...POSTER_TAIL],
  // 1 機器人
  ['oooooooooooo', 'oxxxxxxxxxxo', 'oxTTTTTTTTxo', 'oxTTTrrTTTxo', 'oxTTaaaaTTxo', 'oxTayaayaTxo', 'oxTaaaaaaTxo', 'oxTaooooaTxo', 'oxTTaaaaTTxo', 'oxTTTTTTTTxo', ...POSTER_TAIL],
  // 2 程式碼
  ['oooooooooooo', 'oxxxxxxxxxxo', 'oxNNNNNNNNxo', 'oxNSSSNNNNxo', 'oxNNNPPPNNxo', 'oxNNNTTNNNxo', 'oxNSSNNNNNxo', 'oxNNNSSSSNxo', 'oxNNNNNNNNxo', 'oxNNNNNNNNxo', ...POSTER_TAIL],
];
const POSTER_PALS: Palette[] = [
  { o: '#1d1a2e', x: '#f4efe6', J: '#2a3a74', y: '#ffd166', M: '#0f1730', z: '#a7a3b3' },
  { o: '#1d1a2e', x: '#f4efe6', T: '#38a8a0', a: '#cdd4de', r: '#ff7a7a', y: '#ffd166', z: '#a7a3b3' },
  { o: '#1d1a2e', x: '#f4efe6', N: '#232a4a', S: '#5cf08a', P: '#ff9ac1', T: '#6fc3ff', z: '#a7a3b3' },
];
export const poster = (i: number) => one(12, 16, POSTER_ROWS[i], POSTER_PALS[i]);

// 書櫃 16×22
export function bookcase() {
  const base = grid(16, 22, (x, y) => {
    if (x === 0 || x === 15 || y === 0 || y === 21) return 'o';
    if (x === 1 || x === 14) return 'V';
    if (y === 1 || y === 10 || y === 20) return 'W';
    return 'u';
  });
  const g = base.map((r) => r.split(''));
  const shelf = (books: { w: number; h: number; c: string }[], floorY: number) => { let x = 2; for (const b of books) { for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) g[floorY - j][x + i] = b.c; x += b.w; } };
  shelf([{ w: 2, h: 7, c: 'R' }, { w: 1, h: 6, c: 'y' }, { w: 2, h: 7, c: 't' }, { w: 2, h: 5, c: 'g' }, { w: 1, h: 6, c: 'P' }, { w: 2, h: 7, c: 'O' }, { w: 2, h: 4, c: 'R' }], 9);
  shelf([{ w: 2, h: 7, c: 'g' }, { w: 1, h: 7, c: 'O' }, { w: 2, h: 6, c: 't' }, { w: 3, h: 3, c: 'x' }, { w: 2, h: 7, c: 'y' }, { w: 2, h: 5, c: 'P' }], 19);
  return one(16, 22, g.map((r) => r.join('')), { o: '#1d1a2e', V: '#7a4a2a', W: '#b87a45', u: '#3f2515', R: '#d9534f', y: '#e6c34a', t: '#4a90d9', g: '#4fb477', P: '#8e6fc9', O: '#e98f3f', x: '#f4efe6' });
}

// 門 16×28：磨砂玻璃小窗透出光
export function door() {
  const rows = grid(16, 28, (x, y) => {
    if (x === 0 || x === 15 || y === 0 || y === 27) return 'o';
    if (x >= 4 && x <= 11 && y >= 3 && y <= 8) return x === 4 || x === 11 || y === 3 || y === 8 ? 'F' : (x + y) % 3 === 0 ? 'Y' : 'y';
    if (y >= 11 && y <= 25 && ((x >= 2 && x <= 6) || (x >= 9 && x <= 13))) return y === 11 || x === 2 || x === 9 ? 'E' : y === 25 || x === 6 || x === 13 ? 'F' : 'D';
    if (x >= 12 && x <= 13 && y >= 15 && y <= 16) return 'k';
    return 'D';
  });
  return one(16, 28, rows, { o: '#1d1a2e', D: '#8b5a3c', E: '#a46d49', F: '#6b4129', y: '#ffd166', Y: '#fff2b8', k: '#ffd24a' });
}
export const exitSign = () => one(12, 6, ['oooooooooooo', 'oSSSSSSSSSSo', 'oSSSSSwSSSSo', 'oSwwwwwwSSSo', 'oSSSSSwSSSSo', 'oooooooooooo'], { o: '#1d1a2e', S: '#2dbd6e', w: '#ffffff' });

// 盆栽 16×16
export function plant() {
  const leaf = (hl: boolean) => ['.ggg.', hl ? 'hgggg' : 'ggggg', '.ggg.'];
  const stamps = [
    { x: 7, y: 2, rows: ['ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee'] },
    { x: 5, y: 0, rows: leaf(true) }, { x: 1, y: 2, rows: leaf(true) }, { x: 10, y: 2, rows: leaf(false) },
    { x: 3, y: 5, rows: leaf(false) }, { x: 8, y: 5, rows: leaf(true) },
    { x: 2, y: 9, rows: ['.oooooooooo.', 'oPPPPPPPPPPo', 'oppppppppppo', 'oppppppppppo', '.oppppppppo.', '..oorrrroo..', '....oooo....'] },
  ];
  return one(16, 16, stampRows(16, 16, null, stamps), { o: '#1d1a2e', e: '#2a7a46', g: '#3fb765', h: '#7be09a', P: '#e0865a', p: '#c4693d', r: '#8f4326' });
}

// 飲水機 12×21
export const cooler = () => one(12, 21, [
  '...oooooo...', ...['ttttttt', 'ttwtttt', 'tttttwt', 'ttttttt', 'ttwtttt', 'ttttttt', 'ttttttt'].map((m) => '.oT' + m + 'o.'), '.oooooooooo.',
  'oooooooooooo', 'oAAAAAAAAAAo', 'oAkkAAAARRAo', 'oAkkAAAARRAo', 'oAAAAAAAAAAo', 'obbbbbbbbbbo', 'oAAAAAAAAAAo', 'oAAAAAAAAAAo', 'oAAAAAAAAAAo', 'oAAAAAAAAAAo', 'obbbbbbbbbbo', 'oooooooooooo',
], { o: '#1d1a2e', T: '#e9f7ff', t: '#6fc3ff', w: '#ffffff', A: '#d6dce6', b: '#8b94a6', k: '#4aa3df', R: '#e85d4a' });

// 地毯 40×18（3 種花樣）
export function rug(kind: number, main: string, light: string): Sprite {
  const rows = grid(40, 18, (x, y) => {
    if ((y === 0 || y === 17) && x % 4 < 2) return 'U';
    if (y === 0 || y === 17) return '.';
    if (x < 2 || x >= 38 || y < 2 || y >= 16) return 'X';
    if (x < 4 || x >= 36 || y < 4 || y >= 14) return 'U';
    if (kind === 0) return Math.abs(x - 19.5) / 2 + Math.abs(y - 8.5) < 5.5 && (Math.abs(x - 19.5) / 2 + Math.abs(y - 8.5)) > 3.5 ? 'U' : 'X';
    if (kind === 1) return Math.floor((x - 4) / 3) % 2 ? 'U' : 'X';
    return (x + y) % 4 === 0 ? 'U' : 'X';
  });
  return one(40, 18, rows, { X: main, U: light });
}

// 白板 28×18
export function whiteboard() {
  const g = grid(28, 18, (x, y) => {
    if (x === 0 || x === 27 || y === 0 || y === 17) return 'o';
    if (y >= 15) return 'a';
    if (x === 1 || x === 26 || y === 1) return 'a';
    return 'w';
  }).map((r) => r.split(''));
  const line = (x0: number, x1: number, y: number, c: string) => { for (let x = x0; x <= x1; x++) g[y][x] = c; };
  line(4, 14, 4, 'B'); line(4, 18, 7, 'B'); line(4, 11, 10, 'B');
  line(19, 24, 4, 'R'); line(19, 24, 9, 'R'); for (let y = 4; y <= 9; y++) { g[y][19] = 'R'; g[y][24] = 'R'; }
  g[12][20] = 'G'; g[13][21] = 'G'; g[12][22] = 'G'; g[11][23] = 'G'; // 勾勾
  line(4, 6, 15, 'R'); line(9, 11, 15, 'G'); line(14, 16, 15, 'B');   // 擺在托盤上的筆
  return one(28, 18, g.map((r) => r.join('')), { o: '#1d1a2e', a: '#9aa3b2', w: '#f7f8fb', B: '#4a90d9', R: '#d9534f', G: '#4fb477' });
}

// 咖啡機 12×14
export const coffee = () => one(12, 14, [
  '.oooooooooo.', 'oddddddddddo', 'occSScccRyco', 'occcccccccco', 'occcccooccco', 'occcccMMccco', 'occcccMMccco', 'occcMMMMccco',
  'occcwwwwccco', 'occcwwwwccco', 'occcooooccco', 'occcccccccco', 'oddddddddddo', 'oooooooooooo',
], { o: '#1d1a2e', c: '#4b4f5c', d: '#6b7080', S: '#5cf08a', R: '#e85d4a', y: '#ffd166', M: '#6f4e37', w: '#f4efe6' });

// 影印機 14×12
export const printer = () => one(14, 12, [
  '...oooooooo...', '...owwwwwwo...', '...oxxzzxxo...', 'oooooooooooooo', 'oaaaaaaaaaaaao', 'oaaaaaaaaaaSao', 'oaaoooooooooao', 'oaaaaaaaaaaaao', 'obbbbbbbbbbbbo',
  '..owwwwwwwwo..', '..oxzzzzzzxo..', '..oooooooooo..',
], { o: '#1d1a2e', w: '#ffffff', x: '#f4efe6', z: '#a7a3b3', a: '#dfe3ea', b: '#aab2be', S: '#5cf08a' });

export const bin = () => one(8, 10, [
  '...xx...', 'oooooooo', 'obbbbbbo', 'obcbbcbo', 'obcbbcbo', 'obcbbcbo', 'obcbbcbo', 'obcbbcbo', 'obbbbbbo', '.oooooo.',
], { o: '#1d1a2e', b: '#6b7a8f', c: '#55627a', x: '#f4efe6' });

// 沙發 28×14（顏色可換）
export function sofa(color: string): Sprite {
  const back = (x: number, y: number) => y >= 0 && y <= 7 && x >= 2 && x <= 25;
  const arm = (x: number, y: number) => y >= 3 && y <= 11 && (x <= 3 || x >= 24);
  const seat = (x: number, y: number) => y >= 8 && y <= 11 && x >= 4 && x <= 23;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < 28 && y < 12 && (back(x, y) || arm(x, y) || seat(x, y));
  const rows = grid(28, 14, (x, y) => {
    if (y >= 12) return (x >= 2 && x <= 3) || (x >= 24 && x <= 25) ? 'o' : '.';
    if (!filled(x, y)) return '.';
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !filled(x + dx, y + dy));
    if (edge) return 'o';
    if ((x === 13 || x === 14) && y >= 3) return 'T';
    return y <= 2 || (y === 8 && x >= 5 && x <= 22) ? 'U' : y >= 10 ? 'T' : 'S';
  });
  return one(28, 14, rows, { o: '#1d1a2e', S: color, U: lighter(color, 0.22), T: darker(color, 0.22) });
}

// 睡覺的貓 12×7（2 幀：呼吸）
const CAT: string[][] = [
  ['.o.o........', 'oOoOooooo...', 'oOOOOOOOOoo.', 'oONOOOQQOOo.', 'oOOOOOOOOOoo', '.ooooooooQQo', '..........oo'],
  ['.o.o..oooo..', 'oOoOooOOOOo.', 'oOOOOOOOOOoo', 'oONOOOQQOOo.', 'oOOOOOOOOOoo', '.ooooooooQQo', '..........oo'],
];
export const cat = (frame: number) => one(12, 7, CAT[frame || 0], { o: '#1d1a2e', O: '#e8a860', Q: '#f6cf94', N: '#ff9ac1' });

