import { expect, test } from 'vitest';
import { deskDepth, fitCamera, HEAD_Z, isoDepth, islandsBounds, personDepth, toScreen } from '../web/src/iso.js';
import { entryPath, ISLAND, seatCell, type Island } from '../web/src/view.js';

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

test('深度：人與桌子前後', () => {
  // 3 欄 2 排的島；座位地板點 = 格子左上角 + (48, 48)（同 OfficeScene 的 PERSON）
  const isl = { x: 40, y: 96, w: 3 * ISLAND.cellW + ISLAND.pad * 2, h: 0, cols: 3, rows: 2, desks: 6 } as Island;
  const home = (seat: number) => { const c = seatCell(isl, seat); return { x: c.x + 48, y: c.y + 48 }; };
  // 坐著的人在自己桌子後面
  for (let s = 0; s < 6; s++) expect(personDepth(home(s))).toBeLessThan(deskDepth(seatCell(isl, s)));
  // 走在桌間空隙（座位 4 的左側）：在左邊鄰桌（座位 3）前面、自己桌子後面
  const gap = entryPath(isl, 4)[2]!;
  expect(personDepth(gap)).toBeGreaterThan(deskDepth(seatCell(isl, 3)));
  expect(personDepth(gap)).toBeLessThan(deskDepth(seatCell(isl, 4)));
  // 後排坐著的人在同一欄前排桌子後面
  for (let s = 0; s < 3; s++) expect(personDepth(home(s))).toBeLessThan(deskDepth(seatCell(isl, s + 3)));
});

test('fitCamera', () => {
  const c = fitCamera(null, 1280, 720, 2.5);
  expect(c.zoom).toBe(1);
  expect(Number.isFinite(c.cx) && Number.isFinite(c.cy)).toBe(true);
  expect(fitCamera({ x: 0, y: 0, w: 640, h: 360 }, 1280, 720, 2.5).zoom).toBe(2);
  expect(fitCamera({ x: 0, y: 0, w: 100, h: 100 }, 1280, 720, 2.5).zoom).toBe(2.5);
});
