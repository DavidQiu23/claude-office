// 助理從伺服器狀態到名牌小標的整條純邏輯：reduce → plateText(...).helpers（工作中的助理數）
import { expect, test } from 'vitest';
import { reduce } from '../src/state/reduce.js';
import { emptyState, type HookEvent, type OfficeState } from '../src/state/types.js';
import { plateText } from '../web/src/floors.js';

const ID = 'crm0-sim';
const ev = (hook_event_name: string, extra: Partial<HookEvent> = {}): Omit<HookEvent, 'sentAt'> => ({ hook_event_name, session_id: ID, cwd: '/sim/crm', ...extra });
const spawn = (id: string, background = false) =>
  ev('PreToolUse', { tool_name: 'Agent', tool_use_id: id, tool_input: { description: id, ...(background ? { run_in_background: true } : {}) } });

test('名牌小標：派三個 3、前景完成一個 2、背景啟動仍 2、主人 Stop 後只剩背景的 1、SubagentStop 後 0', () => {
  let state: OfficeState = emptyState();
  let now = 0;
  const helpers = (e: Omit<HookEvent, 'sentAt'>): number => {
    state = reduce(state, { ...e, sentAt: (now += 1000) } as HookEvent).state;
    return plateText(state.employees[ID]).helpers;
  };
  expect(helpers(ev('UserPromptSubmit', { prompt: '整理客戶資料' }))).toBe(0);
  helpers(spawn('t1'));
  helpers(spawn('t2'));
  expect(helpers(spawn('t3', true))).toBe(3);
  expect(helpers(ev('PostToolUse', { tool_name: 'Agent', tool_use_id: 't1' }))).toBe(2);
  expect(helpers(ev('PostToolUse', { tool_name: 'Agent', tool_use_id: 't3', tool_response: { status: 'async_launched', agentId: 'ag1' } }))).toBe(2);
  expect(helpers(ev('Stop'))).toBe(1);
  expect(helpers(ev('SubagentStop', { agent_id: 'ag1' }))).toBe(0);
});
