import { expect, test } from 'vitest';
import { appearance, DESK_H, doorPos, layout, seatCell, DoneClock, DONE_MS, fitText, formatTime, nameplate, PALETTE, summary } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import { truncate } from '../src/state/describe.js';
import type { Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});

test('appearance 對同一個 sessionId 永遠相同', () => {
  expect(appearance('abc')).toEqual(appearance('abc'));
  const a = appearance('abc');
  expect(a.hair).toBeLessThan(PALETTE.length);
  expect(a.shirt).toBeLessThan(PALETTE.length);
});

test('nameplate 截斷 prompt', () => {
  const p = nameplate(emp('a', 'idle', { lastPrompt: 'x'.repeat(100) }));
  expect(p).toBe(truncate('x'.repeat(100), 30));
  expect(p.length).toBeLessThan(100);
});

test('nameplate 換行壓成單行', () => {
  expect(nameplate(emp('a', 'idle', { lastPrompt: 'a\n\n  b\r\nc ' }))).toBe('a b c');
});

test('summary 文字與 alert', () => {
  const s = summary([emp('a', 'working'), emp('b', 'working'), emp('c', 'idle')]);
  expect(s).toEqual({ text: '工作中 2 · 等你處理 0 · 閒置 1', alert: false });
  expect(summary([emp('a', 'waiting')]).alert).toBe(true);
});

test('OfficeStore 套用 upsert 與 leave 並通知監聽者', () => {
  const s = new OfficeStore();
  const seen: string[] = [];
  s.on((c) => seen.push(c.type));
  s.apply({ type: 'upsert', employee: emp('a') });
  expect(s.employees.has('a')).toBe(true);
  s.apply({ type: 'leave', sessionId: 'a' });
  expect(s.employees.size).toBe(0);
  s.reset([emp('b')]);
  expect([...s.employees.keys()]).toEqual(['b']);
  expect(seen).toEqual(['upsert', 'leave', 'reset']);
});

test('layout：一個資料夾一間辦公室，桌數隨人數、至少 2 桌', () => {
  const l = layout([emp('a', 'idle', { cwd: 'D:/p/api', folder: 'api' }), emp('b', 'idle', { cwd: 'D:/p/web', folder: 'web' })]);
  expect(l.rooms.map((r) => r.title)).toEqual(['api', 'web']);
  expect(l.rooms[0].desks).toBe(2);
  expect(l.rooms[1].x).toBeGreaterThan(l.rooms[0].x);
  const big = layout([emp('a', 'idle', { cwd: 'D:/p/api', folder: 'api', seat: 3 })]);
  expect(big.rooms[0].cols).toBe(3);
  expect(big.rooms[0].desks).toBe(6);
  expect(big.rooms[0].h).toBeGreaterThan(l.rooms[0].h);
});
test('layout：同名資料夾用上一層區分（含反斜線路徑）、太寬時換行、空辦公室仍有大小', () => {
  const dup = layout([emp('a', 'idle', { cwd: 'D:\\x\\api' }), emp('b', 'idle', { cwd: 'D:\\y\\api' })]);
  expect(dup.rooms.map((r) => r.title).sort()).toEqual(['x/api', 'y/api']);
  const many = layout(['a', 'b', 'c', 'd'].map((n) => emp(n, 'idle', { cwd: 'D:/p/' + n, seat: 2 })));
  expect(new Set(many.rooms.map((r) => r.y)).size).toBeGreaterThan(1);
  expect(layout([]).rooms).toEqual([]);
  expect(layout([]).width).toBeGreaterThan(0);
});
test('seatCell 與 doorPos 落在房間內', () => {
  const [r] = layout([emp('a', 'idle', { cwd: 'D:/p/api', folder: 'api', seat: 4 })]).rooms;
  const c = seatCell(r, 4);
  expect(c.x).toBeGreaterThanOrEqual(r.x);
  expect(c.y + DESK_H).toBeLessThanOrEqual(r.y + r.h);
  expect(doorPos(r).x).toBeLessThan(seatCell(r, 0).x);
});

test('formatTime：HH:mm 補零', () => {
  expect(formatTime(new Date(2026, 0, 2, 3, 4).getTime())).toBe('03:04');
});

test('DoneClock：只記第一次完成時間，3 秒後剩餘為 0', () => {
  const c = new DoneClock();
  expect(c.remaining('x', 100)).toBe(DONE_MS);
  c.mark('x', 1000);
  c.mark('x', 2500);
  expect(c.remaining('x', 2500)).toBe(DONE_MS - 1500);
  expect(c.remaining('x', 9999)).toBe(0);
  c.forget('x');
  expect(c.remaining('x', 9999)).toBe(DONE_MS);
});

test('DoneClock：forget 後再 mark 會有全新的 3 秒；prune 只清沒保留的前綴', () => {
  const c = new DoneClock();
  c.mark('s/a', 0);
  c.forget('s/a');
  c.mark('s/a', 10_000);
  expect(c.remaining('s/a', 11_000)).toBe(DONE_MS - 1000);
  c.mark('s/b', 0);
  c.mark('t/a', 0);
  c.prune('s/', new Set(['s/a']));
  expect(c.remaining('s/b', 9999)).toBe(DONE_MS);
  expect(c.remaining('s/a', 11_000)).toBe(DONE_MS - 1000);
  expect(c.remaining('t/a', 9999)).toBe(0);
});

test('fitText：放得下原樣；放不下以「…」結尾；已有「…」仍保留', () => {
  const fits = (n: number) => (s: string) => [...s].length <= n;
  expect(fitText('abc', fits(5))).toBe('abc');
  expect(fitText('abcdefgh', fits(5))).toBe('abcd…');
  expect(fitText('abcdefgh…', fits(5))).toBe('abcd…');
  expect(fitText('abcde…', fits(6))).toBe('abcde…');
  expect(fitText('abc', fits(0))).toBe('…');
});
