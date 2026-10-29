import { expect, test } from 'vitest';
import { fitCamera, HEAD_Z, isoDepth, islandsBounds, toScreen } from '../web/src/iso.js';
import type { Island } from '../web/src/view.js';

test('toScreen 等角投影', () => {
  expect(toScreen(100, 0)).toEqual({ x: 100, y: 50 });
  expect(toScreen(0, 100)).toEqual({ x: -100, y: 50 });
  expect(toScreen(10, 10, 30)).toEqual({ x: 0, y: -20 });
});

test('isoDepth', () => expect(isoDepth(3, 4)).toBe(7));

test('islandsBounds', () => {
  expect(islandsBounds([])).toBeNull();
  const b = islandsBounds([{ x: 40, y: 96, w: 316, h: 160 } as Island])!;
  for (const p of [toScreen(40, 96, HEAD_Z), toScreen(356 + 40, 256 + 70)]) {
    expect(p.x).toBeGreaterThanOrEqual(b.x);
    expect(p.x).toBeLessThanOrEqual(b.x + b.w);
    expect(p.y).toBeGreaterThanOrEqual(b.y);
    expect(p.y).toBeLessThanOrEqual(b.y + b.h);
  }
});

test('fitCamera', () => {
  const c = fitCamera(null, 1280, 720, 2.5);
  expect(c.zoom).toBe(1);
  expect(Number.isFinite(c.cx) && Number.isFinite(c.cy)).toBe(true);
  expect(fitCamera({ x: 0, y: 0, w: 640, h: 360 }, 1280, 720, 2.5).zoom).toBe(2);
  expect(fitCamera({ x: 0, y: 0, w: 100, h: 100 }, 1280, 720, 2.5).zoom).toBe(2.5);
});
