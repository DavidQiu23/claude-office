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
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeES.all.push(this); }
  close() { this.closed = true; }
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  FakeES.all = [];
  fetchMock.mockReset().mockImplementation(async () => ({ json: async () => ({ employees: [emp('a')] }) }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', FakeES);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('connect：先 reset 再開 SSE，訊息套用到 store，壞資料被忽略', async () => {
  const store = new OfficeStore();
  const seen: string[] = [];
  store.on((c) => seen.push(c.type));
  connect(store);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledWith('/state');
  expect(seen).toEqual(['reset']);
  expect(FakeES.all[0].url).toBe('/stream');
  FakeES.all[0].onmessage!({ data: JSON.stringify({ type: 'upsert', employee: emp('b') }) });
  expect(store.employees.has('b')).toBe(true);
  expect(() => FakeES.all[0].onmessage!({ data: '{oops' })).not.toThrow();
  expect(seen).toEqual(['reset', 'upsert']);
});

test('型別錯誤的訊息被忽略；listener 丟錯不被吞掉', async () => {
  const store = new OfficeStore();
  const seen: string[] = [];
  store.on((c) => seen.push(c.type));
  connect(store);
  await vi.advanceTimersByTimeAsync(0);
  for (const data of ['null', '42', '{"type":"reset"}', '{"type":"nope"}', '{"type":"upsert"}', '{"type":"upsert","employee":null}', '{"type":"leave"}', '{"type":"leave","sessionId":1}'])
    FakeES.all[0].onmessage!({ data });
  expect(seen).toEqual(['reset']);
  store.on(() => { throw new Error('boom'); });
  expect(() => FakeES.all[0].onmessage!({ data: JSON.stringify({ type: 'leave', sessionId: 'a' }) })).toThrow('boom');
});

test('出錯後關閉，2 秒後重新取完整狀態並重連', async () => {
  const store = new OfficeStore();
  connect(store);
  await vi.advanceTimersByTimeAsync(0);
  FakeES.all[0].onerror!();
  expect(FakeES.all[0].closed).toBe(true);
  await vi.advanceTimersByTimeAsync(1999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(FakeES.all).toHaveLength(2);
});

test('fetch 失敗也會 2 秒後重試', async () => {
  fetchMock.mockRejectedValueOnce(new Error('down'));
  connect(new OfficeStore());
  await vi.advanceTimersByTimeAsync(0);
  expect(FakeES.all).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(2000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(FakeES.all).toHaveLength(1);
});
