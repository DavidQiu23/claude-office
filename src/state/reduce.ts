import { describeTool, folderName, isPermissionNotification, isSubagentTool } from './describe.js';
import type { Assistant, Change, Employee, HookEvent, OfficeState } from './types.js';

export function reduce(state: OfficeState, e: HookEvent): { state: OfficeState; changes: Change[] } {
  if (!e.session_id) return { state, changes: [] };
  const id = e.session_id;
  const existing = state.employees[id];

  if (e.hook_event_name === 'SessionEnd') {
    if (!existing) return { state, changes: [] };
    const { [id]: _gone, ...rest } = state.employees;
    return { state: { ...state, employees: rest }, changes: [{ type: 'leave', sessionId: id }] };
  }

  let seq = state.seq;
  let emp: Employee;
  if (existing) {
    emp = { ...existing };
  } else {
    const taken = new Set(Object.values(state.employees).map((x) => x.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    emp = {
      sessionId: id,
      folder: e.cwd ? folderName(e.cwd) : '(未知)',
      cwd: e.cwd ?? '',
      lastPrompt: '',
      status: 'idle',
      activity: null,
      seat,
      arrivedAt: e.sentAt,
      lastEventAt: e.sentAt,
      assistants: [],
    };
  }

  // 已完成的助理在下一個事件時移除；複製一份，避免改到傳入的 state
  let assistants: Assistant[] = emp.assistants.filter((a) => a.status !== 'done');
  const fresh = e.sentAt >= emp.lastEventAt;

  if (fresh) {
    switch (e.hook_event_name) {
      case 'UserPromptSubmit':
        emp.status = 'working';
        emp.lastPrompt = e.prompt ?? '';
        emp.activity = null;
        break;
      case 'PreToolUse':
        emp.status = 'working';
        emp.activity = describeTool(e.tool_name ?? '', e.tool_input);
        break;
      case 'PostToolUse':
        emp.status = 'working';
        break;
      case 'Notification':
        if (isPermissionNotification(e)) emp.status = 'waiting';
        break;
      case 'Stop':
        emp.status = 'idle';
        emp.activity = null;
        break;
    }
  }

  // 助理配對不受事件先後影響
  if (e.hook_event_name === 'PreToolUse' && isSubagentTool(e.tool_name)) {
    const aid = e.tool_use_id ?? 'seq-' + ++seq;
    assistants.push({
      id: aid,
      description: String(e.tool_input?.description ?? ''),
      status: 'working',
      startedAt: e.sentAt,
    });
  } else if (e.hook_event_name === 'PostToolUse' && e.tool_use_id) {
    assistants = assistants.map((a) => (a.id === e.tool_use_id ? { ...a, status: 'done' } : a));
  } else if (e.hook_event_name === 'SubagentStop' && !e.tool_use_id) {
    const i = assistants.findIndex((a) => a.status === 'working' && a.id.startsWith('seq-'));
    if (i >= 0) assistants[i] = { ...assistants[i], status: 'done' };
  }

  emp.assistants = assistants;
  emp.lastEventAt = Math.max(emp.lastEventAt, e.sentAt);
  return {
    state: { ...state, seq, employees: { ...state.employees, [id]: emp } },
    changes: [{ type: 'upsert', employee: emp }],
  };
}
