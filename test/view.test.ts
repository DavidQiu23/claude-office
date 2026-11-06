import { expect, test } from 'vitest';
import { assistantList, formatTime, nameplate, tabTitle } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import type { Assistant, Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', firstPrompt: '', title: '', transcriptPath: '', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});




test('nameplate 優先順序：標題 > 第一個 prompt > 最近的 prompt', () => {
  const o = { title: 'T', firstPrompt: 'F', lastPrompt: 'L' };
  expect(nameplate(emp('abcd', 'idle', o))).toBe('T');
  expect(nameplate(emp('abcd', 'idle', { ...o, title: '' }))).toBe('F');
  expect(nameplate(emp('abcd', 'idle', { ...o, title: '', firstPrompt: '' }))).toBe('L');
});

test('nameplate 換行壓成單行', () => {
  expect(nameplate(emp('abcd', 'idle', { title: 'a\n\n  b\r\nc ' }))).toBe('a b c');
});

test('tabTitle：等你處理和輪到你的人數，工作中不算', () => {
  expect(tabTitle([emp('a', 'working'), emp('b', 'working'), emp('c', 'idle')])).toBe('(✓1) Claude 辦公室');
  expect(tabTitle([emp('a', 'waiting'), emp('b', 'idle'), emp('c', 'idle')])).toBe('(!1 ✓2) Claude 辦公室');
  expect(tabTitle([emp('a', 'working')])).toBe('Claude 辦公室');
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



test('formatTime：HH:mm 補零', () => {
  expect(formatTime(new Date(2026, 0, 2, 3, 4).getTime())).toBe('03:04');
});

test('nameplate 不截字（寬度交給 CSS）', () => {
  expect(nameplate(emp('abcd', 'idle', { title: 'x'.repeat(40) }))).toBe('x'.repeat(40));
});

const asst = (id: string, status: Assistant['status']): Assistant => ({ id, description: id, status, startedAt: 0, seat: 0 });

test('assistantList：空清單', () => {
  expect(assistantList([])).toEqual({ rows: [], extra: 0, extraWorking: 0, extraDone: 0, working: 0 });
});

test('assistantList：工作中排前，同組維持原順序', () => {
  const r = assistantList([asst('a', 'done'), asst('b', 'working'), asst('c', 'done'), asst('d', 'working')]);
  expect(r.rows.map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  expect(r.working).toBe(2);
});

test('assistantList：超過上限的算進 extra', () => {
  const list = [...[1, 2, 3, 4].map((i) => asst(`d${i}`, 'done')), ...[1, 2, 3, 4, 5].map((i) => asst(`w${i}`, 'working'))];
  const r = assistantList(list);
  expect(r.rows.length).toBe(4);
  expect(r.rows.every((x) => x.status === 'working')).toBe(true);
  expect([r.extra, r.extraWorking, r.extraDone, r.working]).toEqual([5, 1, 4, 5]);
});
