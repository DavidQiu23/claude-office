import type { Change, Employee } from '../../src/state/types.js';

export type StoreEvent = Change | { type: 'reset' };

export class OfficeStore {
  employees = new Map<string, Employee>();
  private listeners: Array<(c: StoreEvent) => void> = [];

  apply(c: Change): void {
    if (c.type === 'upsert') this.employees.set(c.employee.sessionId, c.employee);
    else this.employees.delete(c.sessionId);
    this.emit(c);
  }

  reset(list: Employee[]): void {
    this.employees = new Map(list.map((e) => [e.sessionId, e]));
    this.emit({ type: 'reset' });
  }

  on(fn: (c: StoreEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(c: StoreEvent): void {
    for (const fn of this.listeners) fn(c);
  }
}

export const RECONNECT_MS = 2000;

export function connect(store: OfficeStore, base = ''): void {
  const retry = () => setTimeout(() => connect(store, base), RECONNECT_MS);
  fetch(`${base}/state`)
    .then((r) => r.json() as Promise<{ employees: Employee[] }>)
    .then(({ employees }) => {
      store.reset(employees);
      const es = new EventSource(`${base}/stream`);
      es.onmessage = (m) => {
        let c: Change;
        try {
          c = JSON.parse(m.data) as Change;
        } catch {
          return; // 壞資料忽略
        }
        // apply 在 try 外：listener 的錯誤不該被當成壞資料吞掉
        if (
          (c?.type === 'upsert' && typeof c.employee === 'object' && c.employee !== null) ||
          (c?.type === 'leave' && typeof c.sessionId === 'string')
        )
          store.apply(c);
      };
      es.onerror = () => {
        es.close();
        retry();
      };
    })
    .catch(retry);
}
