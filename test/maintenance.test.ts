import { expect, test } from 'vitest';
import { reduce } from '../src/state/reduce.js';
import { dismiss, IDLE_TIMEOUT_MS, sweep } from '../src/state/maintenance.js';
import { emptyState } from '../src/state/types.js';

const ev = (name: string, sentAt: number) => ({
  hook_event_name: name,
  session_id: 's1',
  cwd: 'D:\\p\\api',
  sentAt,
});
const start = () => reduce(emptyState(), ev('SessionStart', 0)).state;

test('超過 12 小時沒事件的員工下班', () => {
  const s = start();
  const { state, changes } = sweep(s, IDLE_TIMEOUT_MS + 1);
  expect(state.employees.s1).toBeUndefined();
  expect(changes).toEqual([{ type: 'leave', sessionId: 's1' }]);
  expect(s.employees.s1).toBeDefined();
});
test('剛好 12 小時內的員工保留', () => {
  const { state, changes } = sweep(start(), IDLE_TIMEOUT_MS);
  expect(state.employees.s1).toBeDefined();
  expect(changes).toEqual([]);
});
test('dismiss 移除員工並產生 leave', () => {
  const s = start();
  const { state, changes } = dismiss(s, 's1');
  expect(state.employees.s1).toBeUndefined();
  expect(changes).toEqual([{ type: 'leave', sessionId: 's1' }]);
  expect(s.employees.s1).toBeDefined();
});
test('dismiss 不存在的員工時沒有變化', () => {
  const s = start();
  const r = dismiss(s, 'nope');
  expect(r.state).toBe(s);
  expect(r.changes).toEqual([]);
});
test('被 dismiss 的 session 再有事件時會回來', () => {
  const { state } = dismiss(start(), 's1');
  const r = reduce(state, { ...ev('PreToolUse', 5), tool_name: 'Edit' });
  expect(r.state.employees.s1).toBeDefined();
  expect(r.changes[0].type).toBe('upsert');
});
