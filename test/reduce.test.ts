import { expect, test } from 'vitest';
import { reduce } from '../src/state/reduce.js';
import { emptyState } from '../src/state/types.js';
import type { Change, HookEvent, OfficeState } from '../src/state/types.js';

let t = 0;
const ev = (name: string, extra: Partial<HookEvent> = {}): HookEvent => ({
  hook_event_name: name,
  session_id: 's1',
  cwd: 'D:\\p\\api',
  sentAt: ++t,
  ...extra,
});
const run = (events: HookEvent[], state: OfficeState = emptyState()) => {
  let changes: Change[] = [];
  for (const e of events) ({ state, changes } = reduce(state, e));
  return { state, changes };
};

test('SessionStart 建立閒置員工並分配座位 0', () => {
  const { state, changes } = run([ev('SessionStart')]);
  const e = state.employees.s1;
  expect(e.status).toBe('idle');
  expect(e.seat).toBe(0);
  expect(e.folder).toBe('api');
  expect(changes).toEqual([{ type: 'upsert', employee: e }]);
});
test('UserPromptSubmit 變工作中並記下 prompt', () => {
  const { state } = run([ev('SessionStart'), ev('UserPromptSubmit', { prompt: '修登入 bug' })]);
  expect(state.employees.s1.status).toBe('working');
  expect(state.employees.s1.lastPrompt).toBe('修登入 bug');
  expect(state.employees.s1.activity).toBeNull();
});
test('PreToolUse 更新 activity', () => {
  const { state } = run([ev('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } })]);
  expect(state.employees.s1.status).toBe('working');
  expect(state.employees.s1.activity).toBe('編輯 app.ts');
});
test('權限通知變等你處理，PostToolUse 回到工作中', () => {
  let r = run([ev('UserPromptSubmit'), ev('Notification', { notification_type: 'permission_prompt' })]);
  expect(r.state.employees.s1.status).toBe('waiting');
  r = run([ev('PostToolUse', { tool_name: 'Bash' })], r.state);
  expect(r.state.employees.s1.status).toBe('working');
});
test('非權限通知不改變狀態', () => {
  const { state } = run([ev('UserPromptSubmit'), ev('Notification', { message: 'Claude is waiting for your input' })]);
  expect(state.employees.s1.status).toBe('working');
});
test('Stop 變閒置並清空 activity', () => {
  const { state } = run([ev('PreToolUse', { tool_name: 'Read', tool_input: {} }), ev('Stop')]);
  expect(state.employees.s1.status).toBe('idle');
  expect(state.employees.s1.activity).toBeNull();
});
test('SessionEnd 移除員工並產生 leave', () => {
  const { state, changes } = run([ev('SessionStart'), ev('SessionEnd')]);
  expect(state.employees.s1).toBeUndefined();
  expect(changes).toContainEqual({ type: 'leave', sessionId: 's1' });
});
test('沒有 SessionStart 也會補登記，lastPrompt 為空', () => {
  const { state } = run([ev('PostToolUse', { tool_name: 'Read' })]);
  expect(state.employees.s1.lastPrompt).toBe('');
  expect(state.employees.s1.seat).toBe(0);
});
test('同資料夾兩個 session 有不同座位', () => {
  const { state } = run([ev('SessionStart'), ev('SessionStart', { session_id: 's2' })]);
  expect(state.employees.s1.seat).toBe(0);
  expect(state.employees.s2.seat).toBe(1);
  expect(state.employees.s1.folder).toBe('api');
  expect(state.employees.s2.folder).toBe('api');
});
test('座位釋出後被重用', () => {
  const { state } = run([
    ev('SessionStart'),
    ev('SessionStart', { session_id: 's2' }),
    ev('SessionEnd'),
    ev('SessionStart', { session_id: 's3' }),
  ]);
  expect(state.employees.s3.seat).toBe(0);
  expect(state.employees.s2.seat).toBe(1);
});
test('較舊的事件不改變狀態', () => {
  const { state } = run([
    ev('Stop', { sentAt: 10 }),
    ev('PreToolUse', { sentAt: 5, tool_name: 'Edit', tool_input: { file_path: 'a.ts' } }),
  ]);
  expect(state.employees.s1.status).toBe('idle');
  expect(state.employees.s1.activity).toBeNull();
  expect(state.employees.s1.lastEventAt).toBe(10);
});
test('以 tool_use_id 配對多個助理', () => {
  const { state } = run([
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a', tool_input: { description: '甲' } }),
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'b', tool_input: { description: '乙' } }),
    ev('PostToolUse', { tool_name: 'Agent', tool_use_id: 'b' }),
  ]);
  const [a, b] = state.employees.s1.assistants;
  expect(a).toMatchObject({ id: 'a', description: '甲', status: 'working' });
  expect(b).toMatchObject({ id: 'b', description: '乙', status: 'done' });
});
test('完成的助理在下一個事件時被移除', () => {
  const { state } = run([
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a' }),
    ev('PostToolUse', { tool_name: 'Agent', tool_use_id: 'a' }),
    ev('PreToolUse', { tool_name: 'Read', tool_input: {} }),
  ]);
  expect(state.employees.s1.assistants).toEqual([]);
});
test('沒有 tool_use_id 時以 SubagentStop 先進先出配對', () => {
  let r = run([ev('PreToolUse', { tool_name: 'Task' }), ev('PreToolUse', { tool_name: 'Task' })]);
  expect(r.state.employees.s1.assistants.map((x) => x.id)).toEqual(['seq-1', 'seq-2']);
  r = run([ev('SubagentStop')], r.state);
  expect(r.state.employees.s1.assistants.map((x) => x.status)).toEqual(['done', 'working']);
});
test('缺少 session_id 的事件被忽略', () => {
  const s = emptyState();
  const { state, changes } = reduce(s, { hook_event_name: 'Stop', sentAt: 1 } as HookEvent);
  expect(state).toEqual(s);
  expect(changes).toEqual([]);
});
test('未知事件只更新 lastEventAt', () => {
  const { state } = run([ev('UserPromptSubmit', { sentAt: 100 }), ev('Whatever', { sentAt: 200 })]);
  expect(state.employees.s1.status).toBe('working');
  expect(state.employees.s1.lastEventAt).toBe(200);
});
test('cwd 缺漏時資料夾顯示 (未知)', () => {
  const { state } = run([ev('SessionStart', { cwd: undefined })]);
  expect(state.employees.s1.folder).toBe('(未知)');
});
test('不修改傳入的 state', () => {
  const s = run([
    ev('SessionStart'),
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a' }),
    ev('PostToolUse', { tool_name: 'Agent', tool_use_id: 'a' }),
  ]).state;
  const before = structuredClone(s);
  reduce(s, ev('Stop'));
  reduce(s, ev('SessionEnd'));
  reduce(s, ev('SessionStart', { session_id: 's9' }));
  expect(s).toEqual(before);
});
