import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { connect, OfficeStore } from '../web/src/sync.js';
import type { Employee } from '../src/state/types.js';

const emp = (id: string): Employee => ({
  sessionId: id, folder: 'p', cwd: '/p', lastPrompt: '', firstPrompt: '', title: '', transcriptPath: '', status: 'idle', activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [],
});

class FakeES {
  static all: FakeES[] = [];
  onmessage: ((m: { data: string }) => void) | null = null;
  constructor(public url: string) { FakeES.all.push(this); }
}

beforeEach(() => {
  FakeES.all = [];
  vi.stubGlobal('EventSource', FakeES);
});
afterEach(() => vi.unstubAllGlobals());

const send = (data: unknown) => FakeES.all[0].onmessage!({ data: typeof data === 'string' ? data : JSON.stringify(data) });

test('connect：開 SSE，第一筆 reset 換掉整份狀態，之後的訊息套用到 store，壞資料被忽略', () => {
  const store = new OfficeStore();
  const seen: string[] = [];
  store.on((c) => seen.push(c.type));
  connect(store);
  expect(FakeES.all[0].url).toBe('/stream');
  send({ type: 'reset', employees: [emp('a')] });
  expect([...store.employees.keys()]).toEqual(['a']);
  send({ type: 'upsert', employee: emp('b') });
  expect(store.employees.has('b')).toBe(true);
  expect(() => send('{oops')).not.toThrow();
  // 重連後的 reset 會把斷線期間的變化一併校正
  send({ type: 'reset', employees: [emp('c')] });
  expect([...store.employees.keys()]).toEqual(['c']);
  expect(seen).toEqual(['reset', 'upsert', 'reset']);
});

test('型別錯誤的訊息被忽略；listener 丟錯不被吞掉', () => {
  const store = new OfficeStore();
  const seen: string[] = [];
  store.on((c) => seen.push(c.type));
  connect(store);
  for (const data of ['null', '42', '{"type":"reset"}', '{"type":"reset","employees":{}}', '{"type":"nope"}', '{"type":"upsert"}', '{"type":"upsert","employee":null}', '{"type":"leave"}', '{"type":"leave","sessionId":1}'])
    send(data);
  expect(seen).toEqual([]);
  store.on(() => { throw new Error('boom'); });
  expect(() => send({ type: 'leave', sessionId: 'a' })).toThrow('boom');
});
