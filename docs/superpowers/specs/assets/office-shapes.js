// 扁平向量辦公室外殼與背景物件：和 shapes.js 同格式的圖形清單。設計稿與遊戲讀同一份資料。
const F = require('./shapes.js');
const { mix, darker, lighter, move } = F;
const r = (x, y, w, h, rad, c, a) => ({ t: 'r', x, y, w, h, r: rad, c, a });
const c = (x, y, rad, col, a) => ({ t: 'c', x, y, r: rad, c: col, a });
const e = (x, y, rx, ry, col, a) => ({ t: 'e', x, y, rx, ry, c: col, a });
const p = (pts, col, a) => ({ t: 'p', pts, c: col, a });

const OFFICE = { floor: '#2d3558', wall: '#46507a', wainscot: '#3b4468', base: '#252b48', frame: '#2a3150', wallH: 56, baseH: 8, side: 10 };
const FLOOR_TOP = OFFICE.wallH + OFFICE.baseH; // 64：地板從這裡開始

const windowNight = () => ({ w: 76, h: 44, shapes: [
  r(0, 0, 76, 40, 5, OFFICE.frame), r(4, 4, 68, 32, 3, '#1c2a52'), r(4, 4, 68, 13, 3, '#2c4078', 0.7), r(37, 4, 2, 32, 0, OFFICE.frame),
  c(14, 14, 1, '#ffffff', 0.85), c(30, 26, 1, '#ffffff', 0.6), c(52, 12, 1, '#ffffff', 0.7), c(62, 24, 1.3, '#ffe9a8', 0.95),
  p([44, 36, 56, 22, 72, 36], '#243660', 0.9), p([4, 36, 16, 26, 30, 36], '#243660', 0.9),
  r(-2, 39, 80, 5, 2.5, '#5a6590'),
] });
const clock = () => ({ w: 30, h: 30, shapes: [
  c(15, 15, 15, OFFICE.frame), c(15, 15, 12, '#f4efe6'), r(14, 6, 2, 10, 1, '#2a3150'), r(14, 14, 8, 2, 1, '#2a3150'), c(15, 15, 1.8, '#d9534f'),
] });
const door = () => ({ w: 44, h: 64, shapes: [
  r(0, 8, 44, 56, 4, OFFICE.frame), r(4, 12, 36, 52, 2, '#6b5a4a'), r(7, 15, 30, 49, 1, '#7d6a58'), r(7, 15, 30, 12, 1, '#8a7663'), c(33, 42, 2.2, '#e8d9a8'),
  r(6, 0, 32, 10, 3, '#1f7a4d'), r(9, 3, 26, 4, 2, '#7dffb2'),
] });
const whiteboard = () => ({ w: 76, h: 44, shapes: [
  r(0, 0, 76, 42, 4, '#9aa3c4'), r(3, 3, 70, 33, 2, '#f4f6fb'), r(3, 3, 70, 8, 2, '#ffffff', 0.7),
  r(9, 10, 28, 3, 1.5, '#4a90d9'), r(9, 17, 40, 3, 1.5, '#a0a8c4'), r(9, 24, 22, 3, 1.5, '#e98f3f'), r(48, 8, 18, 14, 3, '#ffd166', 0.9), c(60, 28, 3, '#d9534f'),
  r(10, 38, 56, 6, 3, '#8089ad'), r(14, 39, 8, 3, 1.5, '#4a90d9'), r(26, 39, 8, 3, 1.5, '#d9534f'),
] });
const bookcase = () => {
  const out = [r(0, 0, 44, 58, 3, '#6a4a38'), r(3, 3, 38, 52, 2, '#4a3328')];
  const cols = ['#d9534f', '#4a90d9', '#e6c34a', '#4fb477', '#8e6fc9', '#e98f3f', '#38a8a0'];
  [3, 21, 39].forEach((y, row) => {
    out.push(r(3, y + 12, 38, 3, 0, '#6a4a38'));
    let x = 5;
    for (let i = 0; i < 6; i++) { const w = 4 + ((i + row) % 3) * 1.5, h = 9 + ((i * 2 + row) % 3) * 2; out.push(r(x, y + 12 - h, w, h, 1, cols[(i + row * 2) % cols.length])); x += w + 1.2; }
  });
  return { w: 44, h: 58, shapes: out };
};
const poster = (i) => {
  const cols = [['#e98f3f', '#ffd166'], ['#4a90d9', '#9ad0ff'], ['#4fb477', '#b8f0c8']][i % 3];
  const art = [
    [c(14, 18, 7, cols[1]), p([2, 34, 12, 22, 24, 34], mix(cols[0], '#000000', 0.2), 1)],
    [r(5, 8, 18, 3, 1.5, cols[1]), r(5, 15, 12, 3, 1.5, cols[1]), r(5, 22, 16, 3, 1.5, cols[1])],
    [e(14, 20, 8, 8, cols[1]), c(14, 20, 3.5, cols[0])],
  ][i % 3];
  return { w: 28, h: 38, shapes: [r(0, 0, 28, 38, 3, OFFICE.frame), r(2, 2, 24, 34, 2, cols[0])].concat(art) };
};
const plant = () => ({ w: 28, h: 40, shapes: [
  e(14, 38, 11, 2.5, '#000000', 0.2), r(6, 26, 16, 13, 3.5, '#b86b4a'), r(5, 24, 18, 5, 2.5, '#cc7e5a'),
  e(7, 16, 5, 11, '#3f9a5b'), e(21, 16, 5, 11, '#3f9a5b'), e(14, 11, 5.5, 13, '#4fb477'), e(10, 18, 3, 8, '#5cc487'),
] });
const cooler = () => ({ w: 24, h: 44, shapes: [
  e(12, 42.5, 10, 2, '#000000', 0.2), r(2, 20, 20, 23, 3, '#dfe6f5'), r(2, 20, 20, 5, 3, '#c3cde6'), r(6, 29, 12, 9, 2, '#aeb9d6'), r(9, 32, 6, 3, 1.5, '#4a90d9'),
  r(3, 0, 18, 22, 6, '#8cc7ff', 0.85), r(3, 11, 18, 11, 3, '#5aa8f0', 0.9), c(8, 6, 1.4, '#ffffff', 0.7),
] });
const printer = () => ({ w: 34, h: 26, shapes: [
  e(17, 24.5, 15, 2, '#000000', 0.2), r(0, 8, 34, 15, 4, '#c8cde0'), r(4, 3, 26, 7, 2, '#f4f6fb'), r(7, 14, 20, 3, 1.5, '#8089ad'), c(28, 12, 1.6, '#46d983'),
] });
const bin = () => ({ w: 18, h: 22, shapes: [
  e(9, 20.5, 8, 1.8, '#000000', 0.2), r(2, 6, 14, 15, 3, '#6b7288'), r(1, 3, 16, 5, 2.5, '#8089ad'), r(5, 10, 2, 8, 1, '#4f566b'), r(11, 10, 2, 8, 1, '#4f566b'),
] });
const coffee = () => ({ w: 34, h: 30, shapes: [
  e(17, 28.5, 15, 2, '#000000', 0.2), r(2, 16, 30, 11, 3, '#b87a45'), r(6, 4, 14, 14, 3, '#3a3f52'), r(8, 6, 10, 5, 2, '#f2b83d'), r(9, 13, 8, 5, 1, '#1d1a2e'),
  r(23, 12, 8, 8, 2, '#ffffff'), r(23, 12, 8, 2.4, 1.2, '#6f4e37'),
] });

const banner = () => ({ w: 84, h: 34, shapes: [
  r(0, 0, 84, 34, 6, '#1f2542'), r(3, 3, 78, 28, 4, '#d9855c'),
  c(20, 17, 9, '#f4e4d4'), p([20, 6, 22.5, 14.5, 31, 17, 22.5, 19.5, 20, 28, 17.5, 19.5, 9, 17, 17.5, 14.5], '#d9855c'),
  r(36, 11, 38, 4, 2, '#f4e4d4'), r(36, 19, 26, 4, 2, '#f4e4d4', 0.7),
] });
const calendar = () => ({ w: 28, h: 36, shapes: [
  r(0, 0, 28, 36, 3, '#f4f6fb'), r(0, 0, 28, 9, 3, '#d9534f'), r(6, -2, 3, 6, 1.5, '#8089ad'), r(19, -2, 3, 6, 1.5, '#8089ad'),
  ...[0, 1, 2, 3, 4].flatMap((i) => [0, 1, 2].map((j) => r(4 + i * 4.4, 13 + j * 7, 3, 4, 1, (i + j * 5) % 7 === 3 ? '#d9534f' : '#a0a8c4'))),
] });
const vent = () => ({ w: 64, h: 14, shapes: [r(0, 0, 64, 14, 3, '#5a6590'), ...[0, 1, 2, 3, 4, 5].map((i) => r(5 + i * 9.5, 4, 6, 6, 3, '#363e66'))] });
const shelf = () => ({ w: 76, h: 28, shapes: [
  r(0, 24, 76, 4, 2, '#8a6a4c'), r(6, 14, 7, 10, 1.5, '#4a90d9'), r(14, 11, 6, 13, 1.5, '#e6c34a'), r(21, 15, 7, 9, 1.5, '#d9534f'),
  r(42, 16, 12, 8, 3, '#b86b4a'), e(48, 12, 4, 6, '#4fb477'), e(44, 14, 3, 5, '#3f9a5b'), e(53, 14, 3, 5, '#5cc487'), r(62, 12, 8, 12, 2, '#ffffff'), r(62, 12, 8, 3, 1.5, '#6f4e37'),
] });
const sofa = () => ({ w: 104, h: 44, shapes: [
  e(52, 42, 48, 3, '#000000', 0.22), r(4, 4, 96, 24, 10, '#7b5fb5'), r(0, 18, 14, 24, 6, '#6a4fa0'), r(90, 18, 14, 24, 6, '#6a4fa0'),
  r(12, 22, 80, 18, 6, '#8e72c9'), r(14, 24, 38, 14, 5, '#9b80d4'), r(54, 24, 36, 14, 5, '#9b80d4'), r(4, 4, 96, 6, 3, '#a68be0', 0.6),
  r(20, 14, 16, 12, 5, '#ffd166'), r(70, 14, 16, 12, 5, '#ff9ac1'),
] });
const table = () => ({ w: 48, h: 24, shapes: [
  e(24, 22, 22, 2.5, '#000000', 0.2), r(2, 6, 44, 6, 3, '#e0a96d'), r(6, 12, 4, 10, 1.5, '#b87a45'), r(38, 12, 4, 10, 1.5, '#b87a45'),
  r(10, 1, 9, 6, 2, '#ffffff'), r(10, 1, 9, 2, 1, '#6f4e37'), r(26, 0, 12, 7, 2, '#f4efe6'), r(28, 2, 8, 1.4, 0.7, '#a7a3b3'),
] });
const vending = () => ({ w: 38, h: 60, shapes: [
  e(19, 58, 17, 2.5, '#000000', 0.22), r(0, 0, 38, 58, 5, '#d9534f'), r(3, 4, 24, 36, 3, '#1c2a52'), r(3, 4, 24, 12, 3, '#2c4078', 0.7),
  ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => r(6 + j * 11, 8 + i * 10.5, 8, 7, 2, ['#ffd166', '#4fb477', '#4a90d9', '#ff9ac1', '#e98f3f', '#8e6fc9'][i * 2 + j]))),
  r(30, 6, 5, 4, 1.5, '#ffe9a8'), r(30, 14, 5, 4, 1.5, '#8089ad'), r(5, 44, 28, 9, 2.5, '#8c1f1c'),
] });
const fridge = () => ({ w: 34, h: 62, shapes: [
  e(17, 60, 15, 2.5, '#000000', 0.22), r(0, 0, 34, 60, 5, '#e6ebf5'), r(0, 21, 34, 2, 0, '#b8c2dc'), r(26, 8, 3, 9, 1.5, '#8089ad'), r(26, 28, 3, 16, 1.5, '#8089ad'),
  r(6, 6, 11, 8, 2, '#ffd166'), r(8, 30, 14, 10, 2, '#ff9ac1'),
] });
const lamp = () => ({ w: 22, h: 60, shapes: [
  e(11, 58, 8, 2, '#000000', 0.2), r(10, 18, 2.4, 40, 1.2, '#6b7288'), r(5, 56, 12, 3, 1.5, '#4f566b'), p([3, 18, 19, 18, 15, 2, 7, 2], '#f2d37a'), e(11, 20, 12, 8, '#ffe9a8', 0.18),
] });
const beanbag = () => ({ w: 40, h: 28, shapes: [e(20, 26, 18, 2.5, '#000000', 0.2), r(2, 6, 36, 20, 12, '#38a8a0'), e(20, 8, 13, 6, '#4cc3ba'), r(8, 10, 8, 3, 1.5, '#ffffff', 0.25)] });
const cat = () => ({ w: 28, h: 16, shapes: [
  e(14, 14.5, 12, 1.8, '#000000', 0.2), e(13, 10, 11, 5.5, '#e98f3f'), c(23, 8, 5, '#e98f3f'), p([19.5, 4.5, 21, 0, 23.5, 4], '#e98f3f'), p([24, 4, 27, 0.5, 27.5, 5.5], '#e98f3f'),
  e(10, 11, 7, 3, '#f4a560', 0.7), r(1, 10, 6, 3, 1.5, '#e98f3f'), c(24.5, 8.2, 0.9, '#2a2238'),
] });
const counter = () => ({ w: 76, h: 48, shapes: [
  e(38, 46, 34, 2.5, '#000000', 0.2), r(0, 20, 76, 26, 3, '#b87a45'), r(0, 18, 76, 5, 2.5, '#e0a96d'), r(3, 26, 33, 17, 2, '#9a6838'), r(40, 26, 33, 17, 2, '#9a6838'),
  r(8, 3, 16, 16, 3, '#3a3f52'), r(10, 6, 12, 5, 2, '#f2b83d'), r(11, 14, 10, 6, 1, '#1d1a2e'), r(32, 8, 10, 11, 2.5, '#ffffff'), r(32, 8, 10, 3, 1.5, '#6f4e37'), r(50, 12, 18, 7, 2, '#c8cde0'), r(52, 14, 10, 3, 1.5, '#46d983'),
] });
const station = () => ({ w: 48, h: 44, shapes: [
  e(24, 42, 22, 2.5, '#000000', 0.2), r(2, 16, 44, 4, 2, '#c8cde0'), r(5, 20, 38, 22, 2, '#a7aec8'), r(8, 24, 32, 4, 1, '#8089ad'),
  r(8, 3, 32, 14, 4, '#e6ebf5'), r(12, 0, 24, 6, 2, '#f4f6fb'), r(16, 8, 16, 3, 1.5, '#8089ad'), c(36, 12, 1.6, '#46d983'),
] });

const meeting = () => {
  const chair = (x, y, col) => r(x, y, 16, 14, 6, col);
  return { w: 116, h: 80, shapes: [
    e(58, 62, 44, 8, '#000000', 0.2),
    chair(14, 8, '#4a90d9'), chair(86, 8, '#e98f3f'), chair(14, 50, '#4fb477'), chair(86, 50, '#d9669a'),
    e(58, 38, 38, 20, '#b87a45'), e(58, 34, 38, 20, '#e0a96d'),
    r(34, 26, 16, 10, 2, '#f4efe6'), r(36, 28, 10, 1.6, 0.8, '#a7a3b3'), r(36, 31, 7, 1.6, 0.8, '#a7a3b3'),
    r(62, 24, 18, 11, 2, '#3a3f52'), r(63.5, 25.5, 15, 7, 1, '#2c4078'), r(60, 35, 24, 2.5, 1.2, '#8089ad'),
    r(50, 36, 6, 6, 2, '#ffffff'), r(50, 36, 6, 2, 1, '#6f4e37'),
  ] };
};
const planterRow = (w) => {
  const out = [r(0, 8, w, 16, 4, '#8a6a4c'), r(0, 8, w, 4, 2, '#a07c5a')];
  for (let x = 14; x < w - 8; x += 30) out.push(e(x, 4, 8, 10, '#3f9a5b'), e(x + 6, 3, 6, 12, '#4fb477'), e(x - 5, 5, 5, 8, '#5cc487'));
  return { w, h: 24, shapes: out };
};

const rug = (w, h, col) => ({ w, h, shapes: [r(0, 0, w, h, 14, col), r(6, 6, w - 12, h - 12, 10, lighter(col, 0.1))] });

const PROPS = { windowNight, clock, door, whiteboard, bookcase, poster, plant, cooler, printer, bin, coffee, banner, calendar, vent, shelf, sofa, table, vending, fridge, lamp, beanbag, cat, counter, station, meeting, planterRow };

const MARGIN_TOP = 96;         // 第一排島的上緣；牆邊家具腳底在 y = 78，招牌從 y = 82 起，兩者不重疊
const MARGIN_BOTTOM = 40;
const WALL_FEET = 78;          // 靠牆家具的腳底線
/** 辦公室總高 = 島群下緣 + 下邊距 40 */
const officeHeight = (islandsBottom) => islandsBottom + MARGIN_BOTTOM;

// 靠後牆的三組家具：沙發區、茶水間、影印區。優先序決定放不下時留哪些；顯示順序從左到右。
const ZONES = {
  print: { mat: '#5a6a7a', items: () => [bookcase(), station(), bin()], gap: 8 },
  pantry: { mat: '#4a6a8a', items: () => [cooler(), counter(), fridge(), vending()], gap: 6 },
  sofa: { mat: '#6a4fa0', items: () => [sofa(), table(), lamp(), cat()], gap: 10 },
};
const ZONE_PRIORITY = ['sofa', 'pantry', 'print'], ZONE_ORDER = ['print', 'pantry', 'sofa'];
const ZONE_PAD = 12, WALL_LEFT = 70, WALL_RIGHT = 48, WALL_MIN_GAP = 10;
const zoneWidth = (z) => z.items().reduce((s, it) => s + it.w, 0) + z.gap * (z.items().length - 1) + ZONE_PAD * 2;

/**
 * 整間辦公室底圖。w×h 與遊戲世界座標相同。
 * voids：島群裡的空地 [{x, y, w, h}]（較矮的島下方）：夠大擺閱讀角，其次擺長花槽。
 */
function officeShell(w, h, voids = []) {
  const O = OFFICE, side = O.side, out = [r(0, 0, w, h, 0, O.floor)];
  const put = (spr, x, y) => out.push(...move(spr.shapes, x, y));
  // 地板：磁磚線 + 棋盤淡色
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

  // 靠牆家具：挑放得下的組（沙發區 > 茶水間 > 書櫃影印區），依顯示順序排，剩餘寬度平均分成間隔
  const avail = w - WALL_LEFT - WALL_RIGHT;
  const chosen = [];
  let used = 0;
  for (const name of ZONE_PRIORITY) {
    const zw = zoneWidth(ZONES[name]);
    if (used + zw + WALL_MIN_GAP * (chosen.length + 1) > avail) continue;
    chosen.push(name); used += zw;
  }
  const order = ZONE_ORDER.filter((n) => chosen.includes(n));
  const gap = (avail - used) / (order.length + 1);
  let x = WALL_LEFT + gap;
  const free = []; // 牆上沒有家具的空段，掛窗、白板、旗幟…
  let cursor = WALL_LEFT;
  for (const name of order) {
    const z = ZONES[name], zw = zoneWidth(z);
    free.push([cursor, x]);
    out.push(r(x, 66, zw, 14, 7, z.mat, 0.3));
    let ix = x + ZONE_PAD;
    for (const it of z.items()) { put(it, ix, WALL_FEET - it.h); ix += it.w + z.gap; }
    cursor = x + zw; x += zw + gap;
  }
  free.push([cursor, w - WALL_RIGHT]);
  // 牆面：空段 ≥ 84 掛一件（窗、白板、旗幟、窗、月曆海報輪流）；家具上方的牆面掛海報
  const hang = ['win', 'win', 'board', 'win', 'banner', 'cal'];
  let hi = 0, pi = 0;
  for (const [a0, b0] of free) {
    if (b0 - a0 < 84) continue;
    const cx = (a0 + b0) / 2, t = hang[hi++ % hang.length];
    out.push(e(cx, FLOOR_TOP + 10, 56, 7, '#ffe9a8', 0.045));
    if (t === 'win') put(windowNight(), cx - 38, 6);
    else if (t === 'board') put(whiteboard(), cx - 38, 6);
    else if (t === 'banner') put(banner(), cx - 42, 10);
    else { put(calendar(), cx - 32, 9); put(poster(pi++), cx + 4, 9); }
  }
  // 島群空地：夠大擺閱讀角（懶骨頭、立燈、盆栽），其次擺長花槽
  for (const v of voids) {
    if (v.h >= 80 && v.w >= 120) {
      const bx = v.x + (v.w - 110) / 2, by = v.y + 40;
      put(beanbag(), bx, by); put(lamp(), bx + 52, by - 32); put(plant(), bx + 82, by - 12);
    } else if (v.h >= 50 && v.w >= 60) put(planterRow(Math.floor((v.w - 16) / 30) * 30 + 8), v.x + 8, v.y + 12);
  }
  // 下方兩角：盆栽
  put(plant(), side + 2, h - side - 44);
  put(plant(), w - side - 30, h - side - 44);
  return { w, h, shapes: out };
}
module.exports = Object.assign({ OFFICE, FLOOR_TOP, MARGIN_TOP, MARGIN_BOTTOM, WALL_FEET, officeHeight, officeShell, rug }, PROPS);
