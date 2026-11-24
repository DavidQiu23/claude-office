import { openAsks, settle } from './reduce.js';
import type { Change, OfficeState } from './types.js';

export const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const remove = (state: OfficeState, ids: string[]): { state: OfficeState; changes: Change[] } => {
  if (!ids.length) return { state, changes: [] };
  const employees = { ...state.employees };
  for (const id of ids) delete employees[id];
  return {
    state: { ...state, employees },
    changes: ids.map((sessionId) => ({ type: 'leave' as const, sessionId })),
  };
};

/** keep：確定還活著、不套用逾時的員工（Desktop 的紀錄說 session 還開著） */
export const sweep = (state: OfficeState, now: number, keep: ReadonlySet<string> = new Set()) =>
  remove(
    state,
    Object.values(state.employees)
      .filter((e) => now - e.lastEventAt > IDLE_TIMEOUT_MS && !keep.has(e.sessionId))
      .map((e) => e.sessionId),
  );

export const dismiss = (state: OfficeState, sessionId: string) =>
  remove(state, Object.hasOwn(state.employees, sessionId) ? [sessionId] : []);

/** 前景助理開工時 hook 不給 agentId，伺服器查到後用這裡補上 */
export const bindAgent = (state: OfficeState, sessionId: string, toolUseId: string, agentId: string): { state: OfficeState; changes: Change[] } => {
  const emp = Object.hasOwn(state.employees, sessionId) ? state.employees[sessionId] : undefined;
  if (!emp?.assistants.some((a) => a.id === toolUseId)) return { state, changes: [] };
  const employee = { ...emp, assistants: emp.assistants.map((a) => (a.id === toolUseId ? { ...a, agentId } : a)) };
  return {
    state: { ...state, employees: { ...state.employees, [sessionId]: employee } },
    changes: [{ type: 'upsert', employee }],
  };
};

export const setTitle = (state: OfficeState, sessionId: string, title: string): { state: OfficeState; changes: Change[] } => {
  const emp = Object.hasOwn(state.employees, sessionId) ? state.employees[sessionId] : undefined;
  if (!emp || emp.title === title) return { state, changes: [] };
  const employee = { ...emp, title };
  return {
    state: { ...state, employees: { ...state.employees, [sessionId]: employee } },
    changes: [{ type: 'upsert', employee }],
  };
};

/** 你按 Esc 或拒絕權限中斷了這一輪：沒有任何 hook，伺服器從 transcript 讀到後用這裡收尾，效果和 Stop 一樣。at 比主 session 最近的事件早，表示之後又開始了 */
export const interrupt = (state: OfficeState, sessionId: string, at: number): { state: OfficeState; changes: Change[] } => {
  const emp = Object.hasOwn(state.employees, sessionId) ? state.employees[sessionId] : undefined;
  if (!emp || at < emp.lastTopAt || emp.status === 'idle') return { state, changes: [] };
  const assistants = emp.assistants.map((a) => (a.status === 'working' && !a.background ? { ...a, status: 'done' as const } : a));
  const employee = settle({ ...emp, turn: 'idle', activity: null, assistants, asks: openAsks(emp.asks, assistants), lastTopAt: at });
  return {
    state: { ...state, employees: { ...state.employees, [sessionId]: employee } },
    changes: [{ type: 'upsert', employee }],
  };
};
