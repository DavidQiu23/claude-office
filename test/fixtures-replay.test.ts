import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { reduce } from '../src/state/reduce.js';
import { emptyState } from '../src/state/types.js';
import type { HookEvent, OfficeState } from '../src/state/types.js';

const dir = join(import.meta.dirname, 'fixtures');
const load = (prefix: string): HookEvent[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), 'utf8')), sentAt: Number(f.split('-')[0]) }) as HookEvent)
    .filter((e) => e.session_id.startsWith(prefix))
    .sort((a, b) => a.sentAt - b.sentAt);

test('真實 fixtures：Agent 工具建立助理、配對完成、Stop 閒置、SessionEnd 離開', () => {
  let state: OfficeState = emptyState();
  const agentPre = 'toolu_01ABPttjVnaEMoEAWr1J7qcc';
  let sawActivityDuringSub = false;
  for (const e of load('588638c2')) {
    const before = state.employees[e.session_id]?.assistants;
    state = reduce(state, e).state;
    const emp = state.employees[e.session_id];
    const name = e.hook_event_name;
    if (name === 'PreToolUse' && e.tool_use_id === agentPre) {
      expect(e.tool_name).toBe('Agent');
      expect(emp.assistants).toEqual([expect.objectContaining({ id: agentPre, description: 'count files', status: 'working' })]);
      var agentActivity = emp.activity;
    } else if (name === 'PostToolUse' && e.tool_use_id === agentPre) {
      expect(emp.assistants).toEqual([expect.objectContaining({ id: agentPre, status: 'done' })]);
    } else if (name === 'SessionEnd') {
      expect(emp).toBeUndefined();
    } else if (e.agent_id || name === 'SubagentStop') {
      expect(emp.assistants).toEqual(before); // 內部事件與 SubagentStop 不動助理
      if (e.agent_id) {
        expect(emp.activity).toBe(agentActivity);
        sawActivityDuringSub = true;
      }
    }
    if (name === 'Stop') {
      expect(emp.status).toBe('idle');
      expect(emp.assistants).toEqual([]); // 下一個事件已清掉 done
    }
  }
  expect(sawActivityDuringSub).toBe(true);
  expect(state.employees).toEqual({});
});

test('真實 fixtures：headless 權限被拒的 session 在 Stop 後閒置', () => {
  let state: OfficeState = emptyState();
  const events = load('1a9200f4');
  for (const e of events.filter((x) => x.hook_event_name !== 'SessionEnd')) state = reduce(state, e).state;
  const emp = Object.values(state.employees)[0];
  expect(emp.status).toBe('idle');
  expect(emp.activity).toBeNull();
  expect(emp.assistants).toEqual([]);
});

test('真實 fixtures：PermissionRequest 讓員工等你批准，Stop 後閒置', () => {
  let state: OfficeState = emptyState();
  let sawWaiting = false;
  for (const e of load('52b23d01')) {
    state = reduce(state, e).state;
    const emp = state.employees[e.session_id];
    if (e.hook_event_name === 'PermissionRequest') {
      sawWaiting = true;
      expect(emp.status).toBe('waiting');
      expect(emp.activity).toContain('等你批准');
    }
  }
  expect(sawWaiting).toBe(true);
});

test('真實 fixtures：背景 Agent 在 async_launched 與 Stop 後仍進行中，SubagentStop 才完成', () => {
  let state: OfficeState = emptyState();
  const checks: string[] = [];
  for (const e of load('0ab96839')) {
    state = reduce(state, e).state;
    const emp = state.employees[e.session_id];
    if (!emp) continue;
    const a = emp.assistants[0];
    if (e.hook_event_name === 'PostToolUse' && e.tool_name === 'Agent') {
      expect(a).toEqual(expect.objectContaining({ status: 'working', agentId: 'a78cbbfe08a9c76f0' }));
      checks.push('post');
    } else if (e.hook_event_name === 'Stop' && !e.agent_id && a) {
      expect(a.status).toBe('working');
      checks.push('stop');
    } else if (e.hook_event_name === 'SubagentStop') {
      expect(a.status).toBe('done');
      checks.push('subStop');
    }
  }
  expect(checks).toEqual(['post', 'stop', 'subStop']);
});
