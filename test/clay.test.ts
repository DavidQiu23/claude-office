import { describe, it, expect } from 'vitest';
import { drawClay, softShadow } from '../web/src/clay.js';
import { extent, mix, type FlatSprite, type Shape } from '../web/src/flat.js';

interface Rec { op: string; args?: number[]; fillStyle?: unknown; strokeStyle?: unknown; lineWidth?: number; lineJoin?: string; globalAlpha?: number }
interface Grad { kind: string; args: number[]; stops: [number, string][]; addColorStop(o: number, c: string): void }

function fakeCtx() {
  const log: Rec[] = [];
  const grads: Grad[] = [];
  const st: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'miter', globalAlpha: 1 };
  const snap = (op: string, args?: number[]): Rec => ({
    op, args, fillStyle: st.fillStyle, strokeStyle: st.strokeStyle,
    lineWidth: st.lineWidth as number, lineJoin: st.lineJoin as string, globalAlpha: st.globalAlpha as number,
  });
  const noop = (): void => {};
  const mkGrad = (kind: string) => (...args: number[]): Grad => {
    const g: Grad = { kind, args, stops: [], addColorStop(o, c) { g.stops.push([o, c]); } };
    grads.push(g);
    return g;
  };
  const ctx = new Proxy(st, {
    get(t, k: string) {
      if (k === 'fill') return () => log.push(snap('fill'));
      if (k === 'stroke') return () => log.push(snap('stroke'));
      if (k === 'ellipse') return (...a: number[]) => log.push(snap('ellipse', a));
      if (k === 'createLinearGradient') return mkGrad('linear');
      if (k === 'createRadialGradient') return mkGrad('radial');
      if (k in t) return t[k];
      return noop; // beginPath、moveTo、arc、roundRect、save…
    },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log, grads, ops: (op: string) => log.filter((l) => l.op === op) };
}

const sq = (n: number, c = '#808080', a?: number): Shape => ({ t: 'p', pts: [0, 0, n, 0, n, n, 0, n], c, a });

describe('drawClay box', () => {
  it('多邊形：填色、描邊、亮塊', () => {
    const f = fakeCtx();
    drawClay(f.ctx, [sq(20)], 'box');
    const fills = f.ops('fill'), strokes = f.ops('stroke');
    expect(fills).toHaveLength(2);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.lineWidth).toBe(1.4);
    expect(strokes[0]!.lineJoin).toBe('round');
    expect(strokes[0]!.strokeStyle).toBe(mix('#808080', '#1d1a2e', 0.18));
    expect(fills[1]!.globalAlpha).toBe(0.45);
    expect(fills[1]!.fillStyle).toBe(mix('#808080', '#ffffff', 0.32));
  });
  it('大面不加亮塊', () => {
    const f = fakeCtx();
    drawClay(f.ctx, [sq(100)], 'box');
    expect(f.ops('fill')).toHaveLength(1);
  });
  it('圓只填色', () => {
    const f = fakeCtx();
    drawClay(f.ctx, [{ t: 'c', x: 5, y: 5, r: 4, c: '#ff0000' }], 'box');
    expect(f.ops('stroke')).toHaveLength(0);
    expect(f.grads).toHaveLength(0);
    expect(f.ops('fill')).toHaveLength(1);
  });
  it.each(['box', 'figure'] as const)('半透明只填色（%s）', (mode) => {
    const f = fakeCtx();
    drawClay(f.ctx, [sq(20, '#808080', 0.3)], mode);
    expect(f.ops('stroke')).toHaveLength(0);
    expect(f.grads).toHaveLength(0);
    expect(f.ops('fill')).toHaveLength(1);
  });
});

describe('drawClay figure', () => {
  it('矩形線性漸層', () => {
    const f = fakeCtx();
    const c = '#4a90d9';
    drawClay(f.ctx, [{ t: 'r', x: 10, y: 20, w: 20, h: 10, c }], 'figure');
    expect(f.grads).toHaveLength(1);
    expect(f.grads[0]!.kind).toBe('linear');
    expect(f.grads[0]!.args).toEqual([10, 20, 17, 30]);
    expect(f.grads[0]!.stops).toEqual([[0, mix(c, '#ffffff', 0.3)], [0.55, c], [1, mix(c, '#1d1a2e', 0.25)]]);
  });
  it('圓放射漸層與高光', () => {
    const f = fakeCtx();
    const c = '#ffd9b8';
    drawClay(f.ctx, [{ t: 'c', x: 20, y: 16, r: 12.5, c }], 'figure');
    const g = f.grads[0]!;
    expect(g.kind).toBe('radial');
    expect(g.args[0]).toBeCloseTo(20 - 12.5 + 0.38 * 25);
    expect(g.args[1]).toBeCloseTo(16 - 12.5 + 0.34 * 25);
    expect(g.args[2]).toBe(0);
    expect(g.args[5]).toBeCloseTo(0.75 * 25);
    expect(g.stops).toEqual([[0, mix(c, '#ffffff', 0.45)], [0.45, c], [1, mix(c, '#1d1a2e', 0.28)]]);
    const el = f.ops('ellipse');
    expect(el).toHaveLength(1);
    expect(el[0]!.args![0]).toBeCloseTo(20 - 0.35 * 12.5);
    expect(el[0]!.args![1]).toBeCloseTo(16 - 0.42 * 12.5);
    expect(el[0]!.args![2]).toBeCloseTo(0.32 * 12.5);
    expect(el[0]!.args![3]).toBeCloseTo(0.2 * 12.5);
    expect(el[0]!.globalAlpha).toBe(0.55);
  });
  it('小圓沒有高光', () => {
    const f = fakeCtx();
    drawClay(f.ctx, [{ t: 'c', x: 5, y: 5, r: 2, c: '#000000' }], 'figure');
    expect(f.ops('ellipse')).toHaveLength(0);
  });
});

describe('softShadow', () => {
  it('三層正面橢圓：中心 (fx, fy)、半徑 r·m 與 r/3·m', () => {
    const f = fakeCtx();
    softShadow(f.ctx, 12, 30, 9);
    const el = f.ops('ellipse');
    expect(el).toHaveLength(3);
    [1, 0.75, 0.5].forEach((m, i) => {
      expect(el[i]!.args![0]).toBeCloseTo(12);
      expect(el[i]!.args![1]).toBeCloseTo(30);
      expect(el[i]!.args![2]).toBeCloseTo(9 * m);
      expect(el[i]!.args![3]).toBeCloseTo((9 / 3) * m);
    });
    expect(el.map((l) => l.globalAlpha)).toEqual([0.10, 0.16, 0.22]);
    expect(f.ops('fill')).toHaveLength(3);
  });
});

describe('extent 含接地投影', () => {
  it('投影橢圓超出圖形時範圍變大（正面：rx = r、ry = r / 3）', () => {
    const base: FlatSprite = { w: 10, h: 10, shapes: [sq(10)] };
    const a = extent(base);
    const b = extent({ ...base, shadow: { fx: 0, fy: 0, r: 30 } });
    expect(b.x0).toBeCloseTo(-30);
    expect(b.x1).toBeCloseTo(30);
    expect(b.x1).toBeGreaterThan(a.x1);
    expect(b.y0).toBeCloseTo(-10);
    expect(b.y1).toBeCloseTo(10);
  });
});
