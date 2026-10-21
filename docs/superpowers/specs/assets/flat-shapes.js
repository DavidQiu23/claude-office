// Claude 辦公室 · 扁平向量素材：每個素材是「圖形清單」，只用矩形（可圓角）、圓、橢圓、多邊形，加透明度。
// 設計稿把清單轉成 SVG；遊戲用 Phaser Graphics 的 fillRoundedRect / fillCircle / fillEllipse / fillPoints 逐一畫出，兩邊讀同一份資料。
// 圖形：{ t:'r', x, y, w, h, r, c, a } 矩形 · { t:'c', x, y, r, c, a } 圓 · { t:'e', x, y, rx, ry, c, a } 橢圓 · { t:'p', pts:[x,y,…], c, a } 多邊形。a 省略為 1。
(function (root) {
  'use strict';
  const toRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = toRgb(a), B = toRgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const darker = (h, t) => mix(h, '#1d1a2e', t);
  const lighter = (h, t) => mix(h, '#ffffff', t);

  const r = (x, y, w, h, rad, c, a) => ({ t: 'r', x, y, w, h, r: rad, c, a });
  const c = (x, y, rad, col, a) => ({ t: 'c', x, y, r: rad, c: col, a });
  const e = (x, y, rx, ry, col, a) => ({ t: 'e', x, y, rx, ry, c: col, a });
  const p = (pts, col, a) => ({ t: 'p', pts, c: col, a });
  const move = (shapes, dx, dy) => shapes.map((s) => {
    const o = Object.assign({}, s);
    if (s.t === 'p') o.pts = s.pts.map((v, i) => v + (i % 2 ? dy : dx)); else { o.x = s.x + dx; o.y = s.y + dy; }
    return o;
  });

  function svgOf(shapes) {
    const f = (a) => (a == null || a === 1 ? '' : ` fill-opacity="${a}"`);
    return shapes.map((s) => {
      if (s.t === 'r') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r || 0}" fill="${s.c}"${f(s.a)}/>`;
      if (s.t === 'c') return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.c}"${f(s.a)}/>`;
      if (s.t === 'e') return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" fill="${s.c}"${f(s.a)}/>`;
      return `<polygon points="${s.pts.join(' ')}" fill="${s.c}"${f(s.a)}/>`;
    }).join('');
  }

  // ---------- 角色 40×56（和像素版同外框，所以版面不變） ----------
  const INK = '#1d1a2e', SKIN = '#ffd9b8', SKIN_D = '#f2b995', BLUSH = '#ff9a8f', CORAL = '#ff6f61';
  const HAIR_COLORS = ['#2b2233', '#6a4630', '#e8be52', '#b85a30', '#a8aeb6', '#4a3560', '#2c4a6e', '#e07aa5'];
  const SHIRT_COLORS = ['#d9534f', '#e98f3f', '#e6c34a', '#4fb477', '#38a8a0', '#4a90d9', '#8e6fc9', '#d9669a'];

  function hairBack(style, H) {
    if (style === 2) return [r(5, 9, 30, 32, 12, H), r(5, 34, 30, 7, 3, darker(H, 0.2))];
    if (style === 4) return [c(9, 14, 7, H), c(31, 14, 7, H), c(7, 22, 6, H), c(33, 22, 6, H)];
    return [];
  }
  function hairFront(style, H) {
    const L = lighter(H, 0.25), D = darker(H, 0.22);
    if (style === 0) return [r(8, 2, 24, 12, 7, H), r(7, 8, 4, 9, 2, H), r(29, 8, 4, 9, 2, H), r(12, 4, 8, 3, 1.5, L)];
    if (style === 1) return [r(8, 2, 24, 11, 7, H), p([8, 8, 26, 8, 14, 18, 8, 18], H), r(29, 8, 4, 9, 2, H), r(13, 4, 9, 3, 1.5, L), p([8, 14, 14, 18, 8, 18], D)];
    if (style === 2) return [r(8, 2, 24, 12, 7, H), r(7, 8, 5, 13, 2.5, H), r(28, 8, 5, 13, 2.5, H), r(12, 4, 8, 3, 1.5, L)];
    if (style === 3) return [c(20, 1, 5.5, H), r(8, 3, 24, 11, 7, H), r(7, 8, 4, 8, 2, H), r(29, 8, 4, 8, 2, H), r(12, 5, 8, 3, 1.5, L)];
    if (style === 4) return [c(12, 5, 7, H), c(20, 3, 7, H), c(28, 5, 7, H), r(8, 6, 24, 8, 4, H), c(11, 4, 2, L)];
    return [r(7, 3, 26, 10, 6, H), r(6, 10, 28, 5, 2.5, D), c(20, 2, 4, lighter(H, 0.35))]; // 毛帽
  }
  const FACES = {
    work: (ink) => [c(14.5, 18, 2.2, ink), c(25.5, 18, 2.2, ink), c(15.2, 17.2, 0.8, '#fff'), c(26.2, 17.2, 0.8, '#fff'), r(18, 23.5, 4, 1.6, 0.8, '#b4584a')],
    idle: (ink) => [r(12.5, 18, 4.5, 1.6, 0.8, ink), r(23, 18, 4.5, 1.6, 0.8, ink), e(20, 24, 2.6, 1.8, '#b4584a')],
    alert: (ink) => [c(14.5, 17.5, 2.8, '#fff'), c(25.5, 17.5, 2.8, '#fff'), c(14.5, 17.5, 1.6, ink), c(25.5, 17.5, 1.6, ink), e(20, 24.5, 2.2, 2.6, '#7a2e3a')],
  };

  // opts: pose sit0|sit1|up|idle|walk0|walk1, style 0-5, outfit tee|hoodie|shirt, glasses, hair, shirt
  function character(o) {
    o = Object.assign({ pose: 'sit0', style: 0, outfit: 'tee', glasses: false, hair: HAIR_COLORS[0], shirt: SHIRT_COLORS[3] }, o);
    const sit = o.pose === 'sit0' || o.pose === 'sit1' || o.pose === 'idle';
    const S = o.shirt, SD = darker(S, 0.22), SL = lighter(S, 0.2);
    const face = o.pose === 'up' ? 'alert' : o.pose === 'idle' ? 'idle' : 'work';
    const out = [];
    out.push(e(20, 54, 15, 2.6, '#000', 0.22));
    if (sit) out.push(r(3, 24, 34, 28, 9, '#3b4770'), r(3, 24, 34, 5, 3, '#56649a'));
    // 腿
    const step = o.pose === 'walk0' ? 2 : o.pose === 'walk1' ? -2 : 0;
    out.push(r(11 + step, 42, 7, 12, 3, '#3b4a7a'), r(22 - step, 42, 7, 12, 3, '#3b4a7a'), r(10 + step, 51, 9, 4, 2, '#6b4636'), r(21 - step, 51, 9, 4, 2, '#6b4636'));
    out.push(...hairBack(o.style, o.hair));
    // 手臂（身體後面的一隻）與身體
    const armY = o.pose === 'up' ? 29 : 30;
    out.push(r(7, armY, 7, 16, 3.5, SD));
    out.push(r(9, 27, 22, 20, 8, S));
    if (o.outfit === 'hoodie') out.push(e(20, 28, 9, 4, SD), r(12, 36, 16, 8, 3, SD), r(17.5, 29, 1.6, 7, 0.8, '#fff'), r(21, 29, 1.6, 7, 0.8, '#fff'));
    else if (o.outfit === 'shirt') out.push(p([20, 28, 14, 27, 17, 34], '#fff'), p([20, 28, 26, 27, 23, 34], '#fff'), r(19, 31, 2.4, 14, 1, '#d9534f'));
    else out.push(e(20, 28, 5.5, 3, SKIN_D), r(12, 41, 16, 3, 1.5, SD, 0.6));
    out.push(r(26, armY, 7, 16, 3.5, S));
    // 手
    if (o.pose === 'up') out.push(r(27, 8, 7, 22, 3.5, S), c(30.5, 8, 4, SKIN));
    else if (sit) { const d = o.pose === 'sit1' ? 2 : 0; out.push(c(13 + d, 46, 3.6, SKIN), c(27 - d, 46, 3.6, SKIN)); }
    else out.push(c(10.5 + step, 46, 3.4, SKIN), c(29.5 - step, 46, 3.4, SKIN));
    // 頭
    out.push(r(16, 24, 8, 6, 2, SKIN_D), c(20, 16, 12.5, SKIN), e(11, 21, 3, 1.8, BLUSH, 0.65), e(29, 21, 3, 1.8, BLUSH, 0.65));
    out.push(...FACES[face](INK));
    if (o.glasses) out.push(c(14.5, 18, 5.4, CORAL), c(14.5, 18, 3.9, '#fff', 0.35), c(25.5, 18, 5.4, CORAL), c(25.5, 18, 3.9, '#fff', 0.35), r(19, 17, 2, 1.6, 0.8, CORAL), ...FACES[face](INK).slice(0, 4));
    out.push(...hairFront(o.style, o.hair));
    return { w: 40, h: 56, shapes: out };
  }

  // ---------- 桌子 72×36（4 種狀態） ----------
  const LED = { empty: '#6b7288', working: '#46d983', waiting: '#ff4d4d', idle: '#f2b83d' };
  function desk(state) {
    const led = LED[state];
    const top = state === 'waiting' ? mix('#e0a96d', '#ff4d4d', 0.3) : '#e0a96d';
    const out = [];
    out.push(e(36, 34, 35, 2.4, '#000', 0.22));
    out.push(r(2, 24, 6, 11, 2, '#8a5a34'), r(64, 24, 6, 11, 2, '#8a5a34'));
    out.push(r(0, 10, 72, 18, 6, '#b87a45'), r(0, 6, 72, 17, 7, top), r(2, 7, 68, 3, 1.5, lighter(top, 0.3)));
    out.push(r(26, 18, 20, 7, 2, '#a1673a'), r(33, 20, 6, 2, 1, '#f0d9a0'));
    // 螢幕背面
    out.push(r(22, -10, 28, 20, 5, '#3a3f52'), r(24, -8, 24, 3, 1.5, '#5b6179'), r(32, 9, 8, 5, 1, '#2c3042'), r(27, 13, 18, 3, 1.5, '#2c3042'));
    if (state !== 'empty') {
      out.push(c(36, 0, state === 'waiting' ? 15 : 11, led, state === 'waiting' ? 0.22 : 0.16), c(36, 0, state === 'waiting' ? 9.5 : 7.5, led, 0.3));
    }
    out.push(c(36, 0, 3.2, led));
    if (state === 'waiting') out.push(e(36, 16, 20, 3.2, '#ff4d4d', 0.3));
    // 桌面小物
    out.push(r(6, 11, 12, 9, 2, '#f4efe6'), r(8, 13, 7, 1.4, 0.7, '#a7a3b3'), r(8, 16, 5, 1.4, 0.7, '#a7a3b3'));
    out.push(r(56, 9, 8, 9, 2.5, '#fff'), r(56, 9, 8, 2.4, 1.2, '#6f4e37'), r(63, 11, 3.5, 5, 1.8, '#fff'));
    out.push(r(21, 12, 5, 5, 1, '#ffd166'), r(48, 14, 5, 5, 1, '#ff9ac1'));
    if (state === 'idle') out.push(e(60, 3, 1.6, 3, '#fff', 0.7), e(63, -1, 1.4, 2.6, '#fff', 0.5));
    return { w: 72, h: 36, shapes: out };
  }

  // ---------- 助理機器人 24×24、驚嘆號 20×28、名牌底 ----------
  function bot(done) {
    const B = done ? '#5fd38a' : '#9fb2c4', BD = darker(B, 0.2);
    return { w: 24, h: 24, shapes: [
      e(12, 22.5, 8, 1.6, '#000', 0.22),
      r(11, 0, 2, 5, 1, '#6b7288'), c(12, 1.5, 2.2, done ? '#ffd24a' : '#ff7a7a'),
      r(3, 4, 18, 13, 6, B), r(3, 12, 18, 5, 3, BD, 0.5),
      c(8.5, 10, 2.6, '#fff'), c(15.5, 10, 2.6, '#fff'),
      c(8.8, 10.2, 1.4, INK), c(15.8, 10.2, 1.4, INK),
      done ? e(12, 14.6, 3.2, 1.8, '#fff') : r(9.5, 14, 5, 1.4, 0.7, INK),
      r(6, 17, 12, 4, 2, BD), r(7, 20, 3.5, 3, 1.5, '#2c3042'), r(13.5, 20, 3.5, 3, 1.5, '#2c3042'),
    ] };
  }
  const exclamation = () => ({ w: 20, h: 28, shapes: [
    c(10, 10, 10, '#ff4d4d', 0.25), r(2, 1, 16, 21, 8, '#ff4d4d'), p([7, 21, 13, 21, 10, 27], '#ff4d4d'),
    r(8.5, 5, 3, 9, 1.5, '#fff'), c(10, 17.5, 1.9, '#fff'),
  ] });

  const api = { toRgb, mix, darker, lighter, move, svgOf, character, desk, bot, exclamation, HAIR_COLORS, SHIRT_COLORS, LED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FLAT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
