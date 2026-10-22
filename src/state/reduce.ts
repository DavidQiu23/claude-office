import { describeTool, folderName, isWaitingNotification, isSubagentTool } from './describe.js';
import type { Assistant, Change, Employee, HookEvent, OfficeState } from './types.js';

export function reduce(state: OfficeState, e: HookEvent): { state: OfficeState; changes: Change[] } {
  if (!e.session_id) return { state, changes: [] };
  const id = e.session_id;
  const existing = Object.hasOwn(state.employees, id) ? state.employees[id] : undefined;

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
    // 座位以資料夾（cwd）為單位：每個資料夾自己一間辦公室，各自從 0 開始排
    const cwd = e.cwd ?? '';
    const taken = new Set(Object.values(state.employees).filter((x) => x.cwd === cwd).map((x) => x.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    emp = {
      sessionId: id,
      folder: e.cwd ? folderName(e.cwd) : '(未知)',
      cwd: e.cwd ?? '',
      lastPrompt: '',
      firstPrompt: '',
      title: '',
      transcriptPath: '',
      status: 'idle',
      activity: null,
      seat,
      arrivedAt: e.sentAt,
      lastEventAt: e.sentAt,
      assistants: [],
    };
  }

  if (e.transcript_path && !e.agent_id) emp.transcriptPath = e.transcript_path;

  // 已完成的助理在下一個事件時移除；複製一份，避免改到傳入的 state
  let assistants: Assistant[] = emp.assistants.filter((a) => a.status !== 'done');
  const fresh = e.sentAt >= emp.lastEventAt;

  const top = !e.agent_id; // 來自 subagent 內部的事件不動 activity、不清助理
  const finish = () => (assistants = assistants.map((a) => (a.status === 'working' && !a.background ? { ...a, status: 'done' as const } : a)));
  if (fresh) {
    switch (e.hook_event_name) {
      case 'UserPromptSubmit':
        emp.status = 'working';
        emp.lastPrompt = e.prompt ?? '';
        if (!emp.firstPrompt) emp.firstPrompt = emp.lastPrompt;
        if (top) {
          emp.activity = null;
          finish();
        }
        break;
      case 'PreToolUse':
        // AskUserQuestion：Claude 在問問題等你選，和權限詢問一樣算「等你回覆」；回答後的 PostToolUse 會回到工作中
        emp.status = e.tool_name === 'AskUserQuestion' ? 'waiting' : 'working';
        if (top) emp.activity = describeTool(e.tool_name ?? '', e.tool_input);
        break;
      case 'PermissionRequest':
        // 要跳權限詢問了：PreToolUse 在權限判斷之前就會觸發，所以這裡才是真正開始等你（Notification 還要再等約 6 秒）
        emp.status = 'waiting';
        if (top) emp.activity = '等你批准：' + describeTool(e.tool_name ?? '', e.tool_input);
        break;
      case 'PostToolUse':
      case 'PostToolUseFailure':
      case 'ElicitationResult':
        emp.status = 'working';
        break;
      case 'Notification':
        if (isWaitingNotification(e)) emp.status = 'waiting';
        break;
      case 'Elicitation':
        emp.status = 'waiting'; // MCP server 要你輸入
        break;
      case 'Stop':
      case 'StopFailure':
        emp.status = 'idle';
        if (top) {
          emp.activity = null;
          finish();
        }
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
      ...(e.tool_input?.run_in_background === true ? { background: true } : {}),
    });
  } else if ((e.hook_event_name === 'PostToolUse' || e.hook_event_name === 'PostToolUseFailure') && e.tool_use_id) {
    const launched = e.tool_response?.status === 'async_launched';
    assistants = assistants.map((a) =>
      a.id !== e.tool_use_id ? a : launched ? { ...a, background: true, agentId: String(e.tool_response?.agentId ?? '') } : { ...a, status: 'done' },
    );
  } else if (e.hook_event_name === 'SubagentStop' && e.agent_id && assistants.some((a) => a.agentId === e.agent_id)) {
    assistants = assistants.map((a) => (a.agentId === e.agent_id ? { ...a, status: 'done' } : a));
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
