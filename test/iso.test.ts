import { expect, test } from 'vitest';
import { chairDepth, deskDepth, fitCamera, focusCamera, islandsBox, isoDepth, personDepth, plateAt, roomBox, roomSize, toScreen } from '../web/src/iso.js';
import type { Employee } from '../src/state/types.js';
import { entryPath, ISLAND, layout, seatCell, SEAT, BASE_H, BASE_W, type Island } from '../web/src/view.js';

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
  expect(chairDepth({ x: 0, y: 0 })).toBe(96);
  expect(personDepth({ x: SEAT.x, y: SEAT.y })).toBe(132);
  expect(deskDepth({ x: 0, y: 0 })).toBe(134);
  const c = { x: 120, y: 200 };
  expect(chairDepth(c)).toBeLessThan(personDepth({ x: c.x + SEAT.x, y: c.y + SEAT.y }));
  expect(personDepth({ x: c.x + SEAT.x, y: c.y + SEAT.y })).toBeLessThan(deskDepth(c));
});

test('深度：人與桌子前後', () => {
  // 3 欄 2 排的島；座位地板點 = 格子左上角 + SEAT
  const isl = { x: 40, y: 96, w: 3 * ISLAND.cellW + ISLAND.pad * 2, h: 0, cols: 3, rows: 2, desks: 6 } as Island;
  const home = (seat: number) => { const c = seatCell(isl, seat); return { x: c.x + SEAT.x, y: c.y + SEAT.y }; };
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

test('plateAt：錨點 (89, 67) 跟人同一個 x，下緣夾在 cell.y + 94', () => {
  const cell = { x: 100, y: 40 }; // toScreen(cell) = (60, 70)
  const a = toScreen(cell.x + 89, cell.y + 67);
  expect(a.x).toBe(toScreen(cell.x + SEAT.x, cell.y + SEAT.y).x);
  expect(plateAt(cell, 1)).toEqual({ x: a.x, y: Math.min(a.y, 70 + 94 - 15) });
  expect(plateAt(cell, 0.5)).toEqual({ x: a.x, y: Math.min(a.y, 70 + 94 - 30) });
});

test('focusCamera：沒人時框整個房間', () => {
  const room = roomBox(1006, 420);
  expect(islandsBox([])).toBeNull();
  expect(focusCamera(null, room, BASE_W, BASE_H, 2)).toEqual(fitCamera(room, BASE_W, BASE_H, 2));
});

test('focusCamera：人少放大到上限，人多拉遠，畫面都在房間內', () => {
  const people = (n: number) => Array.from({ length: n }, (_, i) => ({ sessionId: `s${i}`, folder: `p${i % 5}`, cwd: `C:/p${i % 5}`, lastPrompt: '', firstPrompt: '', title: '', transcriptPath: '', status: 'working', activity: null, seat: Math.floor(i / 5), arrivedAt: 0, lastEventAt: 0, assistants: [] }) as Employee);
  const cam = (n: number) => {
    const l = layout(people(n)), { w, h } = roomSize(l.islands), room = roomBox(w, h);
    return { c: focusCamera(islandsBox(l.islands), room, BASE_W, BASE_H, 2), room };
  };
  const one = cam(1), many = cam(30);
  expect(one.c.zoom).toBe(2);
  expect(many.c.zoom).toBeLessThan(one.c.zoom);
  expect(many.c.zoom).toBeGreaterThanOrEqual(fitCamera(many.room, BASE_W, BASE_H, 2).zoom);
  for (const { c, room } of [one, many]) {
    const hw = BASE_W / 2 / c.zoom, hh = BASE_H / 2 / c.zoom;
    if (room.w > 2 * hw) { expect(c.cx - hw).toBeGreaterThanOrEqual(room.x - 1e-9); expect(c.cx + hw).toBeLessThanOrEqual(room.x + room.w + 1e-9); }
    if (room.h > 2 * hh) { expect(c.cy - hh).toBeGreaterThanOrEqual(room.y - 1e-9); expect(c.cy + hh).toBeLessThanOrEqual(room.y + room.h + 1e-9); }
  }
});