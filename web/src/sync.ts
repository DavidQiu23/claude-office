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

// 每次連上（含 EventSource 斷線後的自動重連）server 第一筆都是 reset 快照，所以不另外取 /state，也不會漏掉兩者之間的變化
export function connect(store: OfficeStore, base = ''): void {
  new EventSource(`${base}/stream`).onmessage = (m) => {
    let c: Change | { type: 'reset'; employees: Employee[] };
    try {
      c = JSON.parse(m.data);
    } catch {
      return; // 壞資料忽略
    }
    // apply 在 try 外：listener 的錯誤不該被當成壞資料吞掉
    if (c?.type === 'reset' && Array.isArray(c.employees)) store.reset(c.employees);
    else if (
      (c?.type === 'upsert' && typeof c.employee === 'object' && c.employee !== null) ||
      (c?.type === 'leave' && typeof c.sessionId === 'string')
    )
      store.apply(c);
  };
}
