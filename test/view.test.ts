import { expect, test } from 'vitest';
import { appearance, assistantList, PROJECT_COLORS, projectColor, formatTime, nameplate, PALETTE, summary } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import type { Assistant, Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', firstPrompt: '', title: '', transcriptPath: '', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});

test('appearance 對同一個 sessionId 永遠相同', () => {
  expect(appearance('abc')).toEqual(appearance('abc'));
  const a = appearance('abc');
  expect(a.hair).toBeLessThan(PALETTE.length);
  expect(a.shirt).toBeLessThan(PALETTE.length);
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

test('summary 人數、底色與分頁標題', () => {
  const s = summary([emp('a', 'working'), emp('b', 'working'), emp('c', 'idle')]);
  expect(s).toMatchObject({ total: 3, alert: false, turn: true, title: '(✓1) Claude 辦公室' });
  // 依緊急程度排序：等你處理 → 輪到你 → 工作中
  expect(s.items.map((i) => [i.key, i.n])).toEqual([['waiting', 0], ['idle', 1], ['working', 2]]);
  // 有等你處理時紅底優先，標題兩項都列
  expect(summary([emp('a', 'waiting'), emp('b', 'idle'), emp('c', 'idle')])).toMatchObject({ alert: true, turn: false, title: '(!1 ✓2) Claude 辦公室' });
  expect(summary([emp('a', 'working')])).toMatchObject({ alert: false, turn: false, title: 'Claude 辦公室' });
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

test('projectColor：同一個 key 永遠同色', () => {
  expect(projectColor('D:/p/api')).toBe(projectColor('D:/p/api'));
  expect(PROJECT_COLORS).toContain(projectColor('D:/p/api'));
  expect(PROJECT_COLORS.length).toBe(8);
});

test('formatTime：HH:mm 補零', () => {
  expect(formatTime(new Date(2026, 0, 2, 3, 4).getTime())).toBe('03:04');
});

test('nameplate 不截字（寬度交給 CSS）', () => {
  expect(nameplate(emp('abcd', 'idle', { title: 'x'.repeat(40) }))).toBe('x'.repeat(40));
});

const asst = (id: string, status: Assistant['status']): Assistant => ({ id, description: id, status, startedAt: 0 });

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
