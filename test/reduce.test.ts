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
test('firstPrompt 只記第一個 prompt；transcript_path 被記下', () => {
  const { state } = run([
    ev('SessionStart', { transcript_path: '/t/s1.jsonl' }),
    ev('UserPromptSubmit', { prompt: '第一個' }),
    ev('UserPromptSubmit', { prompt: '第二個' }),
  ]);
  expect(state.employees.s1.firstPrompt).toBe('第一個');
  expect(state.employees.s1.lastPrompt).toBe('第二個');
  expect(state.employees.s1.transcriptPath).toBe('/t/s1.jsonl');
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
test('不同資料夾各自從座位 0 開始', () => {
  const { state } = run([ev('SessionStart'), ev('SessionStart', { session_id: 's2', cwd: 'D:\p\web' })]);
  expect(state.employees.s1.seat).toBe(0);
  expect(state.employees.s2.seat).toBe(0);
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

test.each(['toString', '__proto__', 'constructor'])('原型鏈名稱 %s 的 session_id 視為一般新員工', (id) => {
  const r = reduce(emptyState(), ev('SessionStart', { session_id: id }));
  expect(r.changes).toHaveLength(1);
  expect(Object.hasOwn(r.state.employees, id)).toBe(true);
});

const withAssistant = () =>
  run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a1', tool_input: { description: 'x' } })]).state;
test('PreToolUse 建立助理時記下 subagent_type', () => {
  const { state } = run([
    ev('UserPromptSubmit'),
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'k1', tool_input: { description: 'x', subagent_type: 'Explore' } }),
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'k2', tool_input: { description: 'y' } }),
  ]);
  const a = state.employees.s1.assistants;
  expect(a[0].kind).toBe('Explore');
  expect('kind' in a[1]).toBe(false);
});
test('Stop 把仍在工作的助理標為完成', () => {
  const s0 = withAssistant();
  expect(run([ev('Stop')], s0).state.employees.s1.assistants[0].status).toBe('done');
});
test('UserPromptSubmit 把仍在工作的助理標為完成', () => {
  const s0 = withAssistant();
  expect(run([ev('UserPromptSubmit')], s0).state.employees.s1.assistants[0].status).toBe('done');
});
test('帶 agent_id 的 Stop / UserPromptSubmit 不結束助理', () => {
  const s0 = withAssistant();
  const r = run([ev('Stop', { agent_id: 'sub' }), ev('UserPromptSubmit', { agent_id: 'sub' })], s0);
  expect(r.state.employees.s1.assistants[0].status).toBe('working');
});
test('帶 agent_id 的事件不覆寫 activity，但仍可把等你處理救回工作中', () => {
  let r = run([ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a2', tool_input: { description: 'd' } })]);
  const act = r.state.employees.s1.activity;
  r = run(
    [ev('Notification', { notification_type: 'permission_prompt' }), ev('PostToolUse', { tool_name: 'Read', tool_use_id: 'in', agent_id: 'sub' }),
     ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'a.ts' }, agent_id: 'sub' })],
    r.state,
  );
  expect(r.state.employees.s1.activity).toBe(act);
  expect(r.state.employees.s1.status).toBe('working');
});

test('PreToolUse AskUserQuestion：等你回覆，氣泡「提問中」；使用者回答後 PostToolUse 回到工作中', () => {
  const asked = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'AskUserQuestion', tool_use_id: 'q1', tool_input: { questions: [] } })]);
  expect(asked.state.employees.s1.status).toBe('waiting');
  expect(asked.state.employees.s1.activity).toBe('提問中');
  const answered = run([ev('PostToolUse', { tool_name: 'AskUserQuestion', tool_use_id: 'q1' })], asked.state);
  expect(answered.state.employees.s1.status).toBe('working');
});

test('subagent 內部的 AskUserQuestion 也讓員工等你回覆，但不動氣泡', () => {
  const { state } = run([
    ev('UserPromptSubmit'),
    ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'a.ts' } }),
    ev('PreToolUse', { tool_name: 'AskUserQuestion', tool_use_id: 'q2', agent_id: 'sub' }),
  ]);
  expect(state.employees.s1.status).toBe('waiting');
  expect(state.employees.s1.activity).toBe('讀取 a.ts');
});

test('PermissionRequest：立刻等你回覆，記下要批准什麼；PostToolUse 回到工作中', () => {
  const asked = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'mkdir x' } }), ev('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'mkdir x' } })]);
  expect(asked.state.employees.s1.status).toBe('waiting');
  expect(asked.state.employees.s1.activity).toBe('等你批准：執行 mkdir x');
  const ok = run([ev('PostToolUse', { tool_name: 'Bash', tool_use_id: 't1' })], asked.state);
  expect(ok.state.employees.s1.status).toBe('working');
});

test('PermissionRequest 來自 subagent：員工也等你，但不動氣泡', () => {
  const { state } = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'a.ts' } }), ev('PermissionRequest', { tool_name: 'Bash', agent_id: 'sub' })]);
  expect(state.employees.s1.status).toBe('waiting');
  expect(state.employees.s1.activity).toBe('讀取 a.ts');
});

test('PostToolUseFailure：回到工作中，並讓對應的助理完成', () => {
  const sent = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'ag', tool_input: { description: 'x' } }), ev('PermissionRequest', { tool_name: 'Agent' })]);
  expect(sent.state.employees.s1.status).toBe('waiting');
  const failed = run([ev('PostToolUseFailure', { tool_name: 'Agent', tool_use_id: 'ag' })], sent.state);
  expect(failed.state.employees.s1.status).toBe('working');
  expect(failed.state.employees.s1.assistants[0].status).toBe('done');
});

test('Notification：只有權限與 MCP 表單／網址才等你回覆，閒置提醒不改狀態', () => {
  const base = run([ev('UserPromptSubmit')]);
  for (const t of ['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog'])
    expect(run([ev('Notification', { notification_type: t })], base.state).state.employees.s1.status).toBe('waiting');
  const idle = run([ev('Stop'), ev('Notification', { notification_type: 'idle_prompt', message: 'Claude is waiting for your input' })]);
  expect(idle.state.employees.s1.status).toBe('idle');
});

test('Elicitation：MCP 要你輸入時等你回覆，ElicitationResult 之後回到工作中', () => {
  const asked = run([ev('UserPromptSubmit'), ev('Elicitation')]);
  expect(asked.state.employees.s1.status).toBe('waiting');
  expect(run([ev('ElicitationResult')], asked.state).state.employees.s1.status).toBe('working');
});

test('StopFailure（API 錯誤結束回合）和 Stop 一樣：閒置、清氣泡、助理完成', () => {
  const { state } = run([
    ev('UserPromptSubmit'),
    ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'ag', tool_input: { description: 'x' } }),
    ev('StopFailure'),
  ]);
  expect(state.employees.s1.status).toBe('idle');
  expect(state.employees.s1.activity).toBeNull();
  expect(state.employees.s1.assistants[0].status).toBe('done');
});

test('SendMessage 叫回已停下的 subagent 時多一位背景助理，SubagentStop 才完成；queued 不另加', () => {
  const resume = ev('PostToolUse', {
    tool_name: 'SendMessage',
    tool_use_id: 'toolu_r',
    tool_input: { to: 'a1', summary: '請複審' },
    tool_response: { success: true, resumedAgentId: 'a1' },
  });
  let { state } = run([ev('UserPromptSubmit'), resume, ev('Stop')]);
  expect(state.employees.s1.assistants).toMatchObject([{ id: 'toolu_r', description: '請複審', status: 'working', agentId: 'a1' }]);
  ({ state } = run([ev('SubagentStop', { agent_id: 'a1' })], state));
  expect(state.employees.s1.assistants[0].status).toBe('done');
  const queued = ev('PostToolUse', { tool_name: 'SendMessage', tool_use_id: 'toolu_q', tool_response: { success: true, message: 'Message queued' } });
  expect(run([queued], state).state.employees.s1.assistants).toEqual([]);
});

test('toolKind：新進員工是 null，送出 prompt 是 think', () => {
  expect(run([ev('SessionStart')]).state.employees.s1.toolKind).toBeNull();
  expect(run([ev('UserPromptSubmit', { prompt: 'x' })]).state.employees.s1.toolKind).toBe('think');
});
test('toolKind：PreToolUse 依工具名稱設定', () => {
  const kind = (tool_name: string) => run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name, tool_input: {} })]).state.employees.s1.toolKind;
  expect(kind('Read')).toBe('read');
  expect(kind('Edit')).toBe('edit');
  expect(kind('Bash')).toBe('run');
  expect(kind('WebFetch')).toBe('web');
  expect(kind('Agent')).toBe('agent');
  expect(kind('mcp__foo__bar')).toBe('other');
});
test('toolKind：工具用完（含失敗）回到 think，Stop／StopFailure 清成 null', () => {
  const used = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Read', tool_input: {} })]);
  expect(run([ev('PostToolUse', { tool_name: 'Read' })], used.state).state.employees.s1.toolKind).toBe('think');
  expect(run([ev('PostToolUseFailure', { tool_name: 'Read' })], used.state).state.employees.s1.toolKind).toBe('think');
  expect(run([ev('Stop')], used.state).state.employees.s1.toolKind).toBeNull();
  expect(run([ev('StopFailure')], used.state).state.employees.s1.toolKind).toBeNull();
});
test('toolKind：AskUserQuestion 與 PermissionRequest 不改', () => {
  const used = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' } })]);
  expect(run([ev('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'ls' } })], used.state).state.employees.s1.toolKind).toBe('run');
  expect(run([ev('PreToolUse', { tool_name: 'AskUserQuestion', tool_input: {} })], used.state).state.employees.s1.toolKind).toBe('run');
});
test('toolKind：帶 agent_id 的事件不改', () => {
  const used = run([ev('UserPromptSubmit'), ev('PreToolUse', { tool_name: 'Agent', tool_use_id: 'a1', tool_input: { description: 'd' } })]);
  const { state } = run(
    [ev('PreToolUse', { tool_name: 'Read', tool_input: {}, agent_id: 'sub' }), ev('PostToolUse', { tool_name: 'Read', agent_id: 'sub' }),
     ev('UserPromptSubmit', { agent_id: 'sub' }), ev('Stop', { agent_id: 'sub' })],
    used.state,
  );
  expect(state.employees.s1.toolKind).toBe('agent');
});
test('toolKind：較舊的事件不改', () => {
  const { state } = run([
    ev('Stop', { sentAt: 10 }),
    ev('PreToolUse', { sentAt: 5, tool_name: 'Edit', tool_input: { file_path: 'a.ts' } }),
  ]);
  expect(state.employees.s1.toolKind).toBeNull();
});
