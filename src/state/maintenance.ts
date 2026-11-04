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

export const setTitle = (state: OfficeState, sessionId: string, title: string): { state: OfficeState; changes: Change[] } => {
  const emp = Object.hasOwn(state.employees, sessionId) ? state.employees[sessionId] : undefined;
  if (!emp || emp.title === title) return { state, changes: [] };
  const employee = { ...emp, title };
  return {
    state: { ...state, employees: { ...state.employees, [sessionId]: employee } },
    changes: [{ type: 'upsert', employee }],
  };
};
