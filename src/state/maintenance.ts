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

export const sweep = (state: OfficeState, now: number) =>
  remove(
    state,
    Object.values(state.employees)
      .filter((e) => now - e.lastEventAt > IDLE_TIMEOUT_MS)
      .map((e) => e.sessionId),
  );

export const dismiss = (state: OfficeState, sessionId: string) =>
  remove(state, sessionId in state.employees ? [sessionId] : []);
