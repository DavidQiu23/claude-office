import { expect, test } from 'vitest';
import { appearance, nameplate, PALETTE, seatPosition, summary } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import { truncate } from '../src/state/describe.js';
import type { Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});

test('seatPosition：0 到 3 在同一排、4 換到下一排、8 再往下', () => {
  const p = [0, 1, 3, 4, 8].map(seatPosition);
  expect(p[0]).toEqual({ x: 64, y: 128 });
  expect(p[1]).toEqual({ x: 160, y: 128 });
  expect(p[2]).toEqual({ x: 352, y: 128 });
  expect(p[3]).toEqual({ x: 64, y: 224 });
  expect(p[4]).toEqual({ x: 64, y: 320 });
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
