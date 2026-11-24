import { askLabel, describeTool, folderName, isSystemPrompt, isWaitingNotification, isSubagentTool } from './describe.js';
import type { Ask, Assistant, Change, Employee, HookEvent, OfficeState } from './types.js';

const ASK_ELICITATION = '(elicitation)'; // MCP server 要你輸入
const ASK_NOTICE = '(notice)'; // 只收到 Notification，不知道是誰在等什麼

/** 工具參數的雜湊：同一次呼叫的 PreToolUse、PermissionRequest、PostToolUse 帶一樣的參數。不存原文，Write 的內容可能很長 */
const digest = (input: unknown): string => {
  let h = 0;
  for (const c of JSON.stringify(input) ?? '') h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return String(h);
};

/** status 由 turn 和 asks 決定 */
export const settle = (e: Employee): Employee => ({ ...e, status: e.asks.length ? 'waiting' : e.turn });

/** 主 session 這一輪結束後還在等的：只剩仍在工作的背景助理 */
export const openAsks = (asks: Ask[], assistants: readonly Assistant[]): Ask[] =>
  asks.filter((a) => a.agent && assistants.some((x) => x.background && x.status === 'working' && x.agentId === a.agent));

export function reduce(state: OfficeState, e: HookEvent): { state: OfficeState; changes: Change[] } {
  if (!e.session_id) return { state, changes: [] };
  const id = e.session_id;
  const existing = Object.hasOwn(state.employees, id) ? state.employees[id] : undefined;

  if (e.hook_event_name === 'SessionEnd') {
    if (!existing) return { state, changes: [] };
    if (existing.hostSessionId) {
      // Desktop 在 rewind、暫停閒置 session 時也會停掉 CLI，session 其實還開著，所以不下班；比目前狀態舊的事件不算
      if (e.sentAt < existing.lastTopAt) return { state, changes: [] };
      const employee = settle({ ...existing, turn: 'idle', asks: [], activity: null, assistants: [], cliEnded: true, lastEventAt: Math.max(existing.lastEventAt, e.sentAt), lastTopAt: e.sentAt });
      return { state: { ...state, employees: { ...state.employees, [id]: employee } }, changes: [{ type: 'upsert', employee }] };
    }
    const { [id]: _gone, ...rest } = state.employees;
    return { state: { ...state, employees: rest }, changes: [{ type: 'leave', sessionId: id }] };
  }

  if (e.hook_event_name === 'PostToolBatch') {
    // 一批工具全部有結果了。拒絕權限時沒有 PostToolUse，只有這個。這個 hook 在背景跑，可能在 Stop 或 SessionEnd 之後才到，
    // 所以只收掉等你處理的事：不登記新員工、不動 turn 和事件時間，也不清剛完成的助理
    const agent = e.agent_id ?? '';
    const done = (a: Ask) =>
      a.at <= e.sentAt && (a.tool === ASK_NOTICE || (a.agent === agent && (a.tool === ASK_ELICITATION || !e.tool_calls || e.tool_calls.some((c) => c.tool_name === a.tool))));
    if (!existing?.asks.some(done)) return { state, changes: [] };
    const employee = settle({ ...existing, asks: existing.asks.filter((a) => !done(a)) });
    return { state: { ...state, employees: { ...state.employees, [id]: employee } }, changes: [{ type: 'upsert', employee }] };
  }

  let emp: Employee;
  if (existing) {
    emp = { ...existing };
  } else {
    const seat = freeSeat(Object.values(state.employees), e.cwd ?? '');
    emp = {
      sessionId: id,
      folder: e.cwd ? folderName(e.cwd) : '(未知)',
      cwd: e.cwd ?? '',
      lastPrompt: '',
      firstPrompt: '',
      title: '',
      transcriptPath: '',
      status: 'idle',
      turn: 'idle',
      asks: [],
      activity: null,
      seat,
      arrivedAt: e.sentAt,
      lastEventAt: e.sentAt,
      lastTopAt: 0,
      assistants: [],
    };
  }

  if (e.transcript_path && !e.agent_id) emp.transcriptPath = e.transcript_path;
  if (e.host_session_id) {
    emp.hostSessionId = e.host_session_id;
    emp.cliEnded = false;
  }

  // 已完成的助理在下一個事件時移除；複製一份，避免改到傳入的 state
  let assistants: Assistant[] = emp.assistants.filter((a) => a.status !== 'done');
  let asks = emp.asks;

  const top = !e.agent_id; // 來自 subagent 內部的事件不動 turn、activity，也不清助理
  // 先後只和主 session 自己的事件比：背景助理的事件常常交錯，它比較新不代表主 session 的 Stop 過期
  const fresh = e.sentAt >= emp.lastTopAt;
  const finish = () => (assistants = assistants.map((a) => (a.status === 'working' && !a.background ? { ...a, status: 'done' as const } : a)));
  if (top && fresh) {
    switch (e.hook_event_name) {
      case 'UserPromptSubmit':
        emp.turn = 'working';
        // 系統通知不是你下的指示，也可能發生在回合中間：Claude 被叫醒才算工作中，其他都不動
        if (isSystemPrompt(e.prompt)) break;
        emp.lastPrompt = e.prompt ?? '';
        if (!emp.firstPrompt) emp.firstPrompt = emp.lastPrompt;
        emp.activity = null;
        finish();
        asks = openAsks(asks, assistants);
        break;
      case 'PreToolUse':
        emp.turn = 'working';
        emp.activity = describeTool(e.tool_name ?? '', e.tool_input);
        break;
      case 'PermissionRequest':
      case 'PostToolUse':
      case 'PostToolUseFailure':
      case 'Elicitation':
      case 'ElicitationResult':
        emp.turn = 'working';
        break;
      case 'Stop':
      case 'StopFailure':
        emp.turn = 'idle';
        emp.activity = null;
        finish();
        asks = openAsks(asks, assistants);
        break;
    }
  }

  // 等你處理的事：記下是誰在等哪個工具，只有它自己有結果才清掉，別人的事件不影響
  const agent = e.agent_id ?? '';
  const tool = e.tool_name ?? '';
  const add = (name: string, label = '') => {
    if (top && !fresh) return; // 這一輪已經結束或中斷了
    const input = digest(e.tool_input);
    if (asks.some((a) => a.agent === agent && a.tool === name && a.input === input)) return; // AskUserQuestion 的 PreToolUse 和 PermissionRequest 是同一件
    asks = [...asks, { agent, tool: name, input, at: e.sentAt, label: top ? label : '' }];
  };
  const drop = (done: (a: Ask) => boolean) => (asks = asks.filter((a) => a.at > e.sentAt || !done(a)));
  switch (e.hook_event_name) {
    case 'PreToolUse':
      drop((a) => a.tool === ASK_NOTICE);
      if (tool === 'AskUserQuestion') add(tool, askLabel(tool, e.tool_input)); // Claude 在問問題等你選
      break;
    case 'PermissionRequest':
      // 要跳權限詢問了：PreToolUse 在權限判斷之前就會觸發，所以這裡才是真正開始等你（Notification 還要再等約 6 秒）
      add(tool, askLabel(tool, e.tool_input));
      break;
    case 'PostToolUse':
    case 'PostToolUseFailure':
      drop((a) => a.tool === ASK_NOTICE || (a.agent === agent && a.tool === tool && (e.tool_input === undefined || a.input === digest(e.tool_input))));
      break;
    case 'SubagentStop':
      if (!top) drop((a) => a.agent === agent);
      break;
    case 'Notification':
      if (!asks.length && isWaitingNotification(e)) add(ASK_NOTICE);
      break;
    case 'Elicitation':
      add(ASK_ELICITATION);
      break;
    case 'ElicitationResult':
      drop((a) => a.tool === ASK_NOTICE || a.tool === ASK_ELICITATION);
      break;
  }

  // 助理配對不受事件先後影響；新助理的座位要連主人這次的變動一起算
  const nextSeat = () => freeSeat([...Object.values(state.employees).filter((x) => x.sessionId !== id), { ...emp, assistants }], emp.cwd);
  if (e.hook_event_name === 'PreToolUse' && isSubagentTool(e.tool_name) && e.tool_use_id) {
    assistants.push({
      id: e.tool_use_id,
      description: String(e.tool_input?.description ?? ''),
      status: 'working',
      startedAt: e.sentAt,
      seat: nextSeat(),
      ...(typeof e.tool_input?.subagent_type === 'string' && e.tool_input.subagent_type ? { kind: e.tool_input.subagent_type } : {}),
      ...(e.tool_input?.run_in_background === true ? { background: true } : {}),
    });
  } else if (e.hook_event_name === 'PostToolUse' && e.tool_name === 'SendMessage' && typeof e.tool_response?.resumedAgentId === 'string') {
    // SendMessage 叫回已停下的 subagent：它在背景重新工作，SubagentStop 才完成（還在跑的只會回 queued，不另加）
    assistants.push({
      id: e.tool_use_id ?? e.tool_response.resumedAgentId,
      description: String(e.tool_input?.summary ?? ''),
      status: 'working',
      startedAt: e.sentAt,
      seat: nextSeat(),
      agentId: e.tool_response.resumedAgentId,
      background: true,
    });
  } else if ((e.hook_event_name === 'PostToolUse' || e.hook_event_name === 'PostToolUseFailure') && e.tool_use_id) {
    // 背景助理靠 agentId 等 SubagentStop；沒給 agentId 就永遠配對不到，只能當成完成，不然會一直坐在座位上
    const agentId = e.tool_response?.status === 'async_launched' ? e.tool_response.agentId : undefined;
    assistants = assistants.map((a) =>
      a.id !== e.tool_use_id ? a : typeof agentId === 'string' && agentId ? { ...a, background: true, agentId } : { ...a, status: 'done' },
    );
  } else if (e.hook_event_name === 'SubagentStop' && e.agent_id) {
    // 前景助理等 PostToolUse：它緊接在後，這裡先完成的話，下一個事件就把剛完成的清掉了
    assistants = assistants.map((a) => (a.background && a.agentId === e.agent_id ? { ...a, status: 'done' } : a));
  }

  // 助理的目前動作。不看 fresh：平行助理的事件常常交錯，別人較新的事件不代表這位的動作過期
  if (e.agent_id && e.hook_event_name === 'PreToolUse') {
    const activity = describeTool(e.tool_name ?? '', e.tool_input);
    assistants = assistants.map((a) => (a.status === 'working' && a.agentId === e.agent_id ? { ...a, activity } : a));
  }

  emp.assistants = assistants;
  emp.asks = asks;
  emp.lastEventAt = Math.max(emp.lastEventAt, e.sentAt);
  if (top) emp.lastTopAt = Math.max(emp.lastTopAt, e.sentAt);
  emp = settle(emp);
  return {
    state: { ...state, employees: { ...state.employees, [id]: emp } },
    changes: [{ type: 'upsert', employee: emp }],
  };
}

/** 座位以資料夾（cwd）為單位，各自從 0 開始：員工和工作中的助理都佔一個，新來的拿號碼最小的空位 */
function freeSeat(employees: Employee[], cwd: string): number {
  const taken = new Set<number>();
  for (const x of employees) {
    if (x.cwd !== cwd) continue;
    taken.add(x.seat);
    for (const a of x.assistants) if (a.status === 'working') taken.add(a.seat);
  }
  let seat = 0;
  while (taken.has(seat)) seat++;
  return seat;
}
