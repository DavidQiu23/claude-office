// Claude 辦公室 · E 黏土畫法：把 flat.ts 的圖形清單用 Canvas 2D 畫出軟邊、亮塊、漸層與接地投影（規格 §16）。
// 純函式，只吃 CanvasRenderingContext2D，烘貼圖時才用。

import { mix, type Shape } from './flat.js';

const INK = '#1d1a2e', WHITE = '#ffffff';

function path(ctx: CanvasRenderingContext2D, s: Shape): void {
  ctx.beginPath();
  if (s.t === 'r') {
    if (s.r) ctx.roundRect(s.x, s.y, s.w, s.h, s.r);
    else ctx.rect(s.x, s.y, s.w, s.h);
  } else if (s.t === 'c') {
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  } else if (s.t === 'e') {
    ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
  } else {
    s.pts.forEach((v, i) => { if (i % 2 === 0) (i ? ctx.lineTo(v, s.pts[i + 1]!) : ctx.moveTo(v, s.pts[1]!)); });
    ctx.closePath();
  }
}

/** 外框 x, y, w, h（漸層座標用）。 */
function bounds(s: Shape): { x: number; y: number; w: number; h: number } {
  if (s.t === 'r') return s;
  if (s.t === 'c') return { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
  if (s.t === 'e') return { x: s.x - s.rx, y: s.y - s.ry, w: s.rx * 2, h: s.ry * 2 };
  const xs = s.pts.filter((_, i) => i % 2 === 0), ys = s.pts.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** 多邊形或矩形的頂點（亮塊用）；圓角矩形取四角。 */
function corners(s: Shape): number[] {
  if (s.t === 'p') return s.pts;
  if (s.t === 'r') return [s.x, s.y, s.x + s.w, s.y, s.x + s.w, s.y + s.h, s.x, s.y + s.h];
  return [];
}

function area(pts: number[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    a += pts[i]! * pts[j + 1]! - pts[j]! * pts[i + 1]!;
  }
  return Math.abs(a) / 2;
}

function highlight(ctx: CanvasRenderingContext2D, pts: number[], c: string): void {
  const n = pts.length / 2;
  let ox = 0, oy = 0;
  for (let i = 0; i < pts.length; i += 2) { ox += pts[i]!; oy += pts[i + 1]!; }
  ox /= n; oy /= n;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const x = ox + (pts[i]! - ox) * 0.62 - 0.8, y = oy + (pts[i + 1]! - oy) * 0.55 - 0.8;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = mix(c, WHITE, 0.32);
  ctx.fill();
}

function gradient(ctx: CanvasRenderingContext2D, s: Shape): CanvasGradient {
  const { x, y, w, h } = bounds(s);
  const round = s.t === 'c' || s.t === 'e';
  const g = round
    ? ctx.createRadialGradient(x + 0.38 * w, y + 0.34 * h, 0, x + 0.38 * w, y + 0.34 * h, 0.75 * Math.max(w, h))
    : ctx.createLinearGradient(x, y, x + 0.35 * w, y + h);
  const stops: [number, string][] = round
    ? [[0, mix(s.c, WHITE, 0.45)], [0.45, s.c], [1, mix(s.c, INK, 0.28)]]
    : [[0, mix(s.c, WHITE, 0.3)], [0.55, s.c], [1, mix(s.c, INK, 0.25)]];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

/** box：多邊形與矩形填色 → 圓角描邊 → 小面加亮塊；figure：漸層與高光。α < 1 的圖形與 box 的圓、橢圓只填色。 */
export function drawClay(ctx: CanvasRenderingContext2D, shapes: Shape[], mode: 'box' | 'figure'): void {
  ctx.lineJoin = 'round';
  for (const s of shapes) {
    const solid = (s.a ?? 1) >= 1;
    ctx.globalAlpha = s.a ?? 1;
    path(ctx, s);
    ctx.fillStyle = solid && mode === 'figure' ? gradient(ctx, s) : s.c;
    ctx.fill();
    if (!solid) continue;
    if (mode === 'figure') {
      if (s.t === 'c' && s.r > 3) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = WHITE;
        ctx.beginPath();
        ctx.ellipse(s.x - 0.35 * s.r, s.y - 0.42 * s.r, 0.32 * s.r, 0.2 * s.r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s.t === 'p' || s.t === 'r') {
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = mix(s.c, INK, 0.18);
      ctx.stroke();
      const pts = corners(s);
      if (area(pts) < 3000) highlight(ctx, pts, s.c);
    }
  }
  ctx.globalAlpha = 1;
}

/** 正面接地投影：三層同心橢圓，中心 (fx, fy)（素材座標），rx = r、ry = r / 3。 */
export function softShadow(ctx: CanvasRenderingContext2D, fx: number, fy: number, r: number): void {
  const layers: [number, number][] = [[1, 0.1], [0.75, 0.16], [0.5, 0.22]];
  ctx.fillStyle = '#000000';
  for (const [m, a] of layers) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(fx, fy, r * m, (r / 3) * m, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
