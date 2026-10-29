import { expect, test } from 'vitest';
import { chairDepth, deskDepth, fitCamera, isoDepth, personDepth, plateAt, roomBox, roomSize, toScreen } from '../web/src/iso.js';
import { entryPath, ISLAND, seatCell, type Island } from '../web/src/view.js';

test('toScreen 等角投影', () => {
  expect(toScreen(100, 0)).toEqual({ x: 100, y: 50 });
  expect(toScreen(0, 100)).toEqual({ x: -100, y: 50 });
  expect(toScreen(10, 10, 30)).toEqual({ x: 0, y: -20 });
});

test('isoDepth', () => expect(isoDepth(3, 4)).toBe(7));

test('roomSize', () => {
  expect(roomSize([])).toEqual({ w: 1006, h: 420 });
  expect(roomSize([{ x: 40, y: 96, w: 316, h: 160 } as Island])).toEqual({ w: 1006, h: 420 });
  expect(roomSize([{ x: 900, y: 96, w: 400, h: 500 } as Island])).toEqual({ w: 1340, h: 646 });
});

test('roomBox', () => {
  const b = roomBox(1006, 420);
  expect(b.x).toBe(toScreen(0, 420).x);
  expect(b.x + b.w).toBe(toScreen(1006, 0).x);
  expect(b.y).toBe(toScreen(0, 0, 118).y);
  expect(b.y + b.h).toBe(toScreen(1006, 420, -10).y);
});

test('chairDepth 在桌子與人之間', () => {
  expect(chairDepth({ x: 0, y: 0 })).toBe(88);
  const c = { x: 120, y: 200 };
  expect(chairDepth(c)).toBeLessThan(personDepth({ x: c.x + 48, y: c.y + 48 }));
  expect(personDepth({ x: c.x + 48, y: c.y + 48 })).toBeLessThan(deskDepth(c));
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
  const b = roomBox(1006, 420);
  const c = fitCamera(b, 1280, 720, 2);
  expect(Number.isFinite(c.zoom) && c.zoom > 0 && c.zoom <= 2).toBe(true);
  for (const px of [b.x, b.x + b.w]) expect(Math.abs((px - c.cx) * c.zoom)).toBeLessThanOrEqual((1280 - 24) / 2 + 1e-9);
  for (const py of [b.y, b.y + b.h]) expect(Math.abs((py - c.cy) * c.zoom)).toBeLessThanOrEqual((720 - 24) / 2 + 1e-9);
  expect(fitCamera({ x: 0, y: 0, w: 100, h: 100 }, 1280, 720, 2).zoom).toBe(2);
});

test('plateAt：置中在桌子中心 x，倍率小時下緣夾在 cell.y + 90', () => {
  const cell = { x: 100, y: 40 }; // toScreen(cell) = (60, 70)
  expect(plateAt(cell, 1)).toEqual({ x: 60, y: 70 + 67.5 }); // 15 / 1 = 15 < 22.5：照桌子正面下緣
  expect(plateAt(cell, 0.5)).toEqual({ x: 60, y: 70 + 90 - 30 }); // 下緣 = 70 + 90
  expect(plateAt(cell, 15 / 22.5).y).toBeCloseTo(70 + 67.5); // 剛好相接
});
