import { expect, test } from 'vitest';
import { appearance, DESK_H, deskCount, DoneClock, DONE_MS, fitText, formatTime, nameplate, PALETTE, sceneHeight, seatPosition, summary } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import { truncate } from '../src/state/describe.js';
import type { Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});

test('seatPosition：0 到 3 在同一排、4 換到下一排、8 再往下', () => {
  const p = [0, 1, 3, 4, 8].map(seatPosition);
  expect(p[0]).toEqual({ x: 56, y: 160 });
  expect(p[1]).toEqual({ x: 164, y: 160 });
  expect(p[2]).toEqual({ x: 380, y: 160 });
  expect(p[3]).toEqual({ x: 56, y: 280 });
  expect(p[4]).toEqual({ x: 56, y: 400 });
});

test('appearance 對同一個 sessionId 永遠相同', () => {
  expect(appearance('abc')).toEqual(appearance('abc'));
  const a = appearance('abc');
  expect(a.hair).toBeLessThan(PALETTE.length);
  expect(a.shirt).toBeLessThan(PALETTE.length);
});

test('nameplate 截斷 prompt', () => {
  const [f, p] = nameplate(emp('a', 'idle', { lastPrompt: 'x'.repeat(100) }));
  expect(f).toBe('proj');
  expect(p).toBe(truncate('x'.repeat(100), 30));
  expect(p.length).toBeLessThan(100);
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

test('deskCount：至少 8 張，座位超過以整排加桌；sceneHeight 隨排數增加', () => {
  expect(deskCount([])).toBe(8);
  expect(deskCount([emp('a', 'idle', { seat: 7 })])).toBe(8);
  expect(deskCount([emp('a', 'idle', { seat: 8 })])).toBe(12);
  expect(sceneHeight(12)).toBe(sceneHeight(8) + DESK_H);
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
