import { expect, test } from 'vitest';
import { floorAlert, floorPlan, floorWidth, helperKey, plateText, seatCenter } from '../web/src/floors.js';
import type { Floor } from '../web/src/floors.js';
import { PROJECT_COLORS } from '../web/src/view.js';
import type { Assistant, Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', firstPrompt: '', title: '', transcriptPath: '', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});
const asst = (over: Partial<Assistant> = {}): Assistant => ({ id: 't1', description: '搜尋\n程式碼', status: 'working', startedAt: 0, ...over });
const none = new Map<string, number>();

test('floorPlan：依專案最早到班從 1F 往上排，同時間依路徑', () => {
  const f = floorPlan([
    emp('a', 'working', { cwd: '/b', folder: 'b', arrivedAt: 5 }),
    emp('c', 'working', { cwd: '/a', folder: 'a', arrivedAt: 5 }),
    emp('d', 'working', { cwd: '/z', folder: 'z', arrivedAt: 1 }),
  ], [], none, none);
  expect(f.map((x) => [x.level, x.title])).toEqual([[1, 'z'], [2, 'a'], [3, 'b']]);
});

test('floorPlan：中間一層的人走光後，上面往下遞補', () => {
  const es = [
    emp('a', 'working', { cwd: '/a', folder: 'a', arrivedAt: 1 }),
    emp('b', 'working', { cwd: '/b', folder: 'b', arrivedAt: 2 }),
    emp('c', 'working', { cwd: '/c', folder: 'c', arrivedAt: 3 }),
  ];
  expect(floorPlan(es, [], none, none).map((x) => x.level)).toEqual([1, 2, 3]);
  const f = floorPlan(es.filter((e) => e.sessionId !== 'b'), [], none, none);
  expect(f.map((x) => [x.level, x.title])).toEqual([[1, 'a'], [2, 'c']]);
});

test('floorPlan：桌數 = max(最大座位+1, 助理座位+1, minDesks)，空座位 occ 為 null', () => {
  const f = floorPlan([emp('a', 'working', { seat: 2 })], [], none, new Map([['/x/proj', 5]]));
  expect(f[0].desks).toBe(5);
  expect(f[0].seats.length).toBe(5);
  expect(f[0].seats.map((s) => s.occ?.kind ?? null)).toEqual([null, null, 'employee', null, null]);
  // 沒有 minDesks 時，以最大座位為準；助理座位更大時以助理為準
  expect(floorPlan([emp('a', 'working', { seat: 2 })], [], none, none)[0].desks).toBe(3);
  const o = emp('a', 'working', { seat: 0 });
  const h = { owner: o, a: asst() };
  expect(floorPlan([o], [h], new Map([[helperKey(h), 6]]), none)[0].desks).toBe(7);
});

test('floorPlan：同名資料夾用路徑最後兩層', () => {
  const f = floorPlan([
    emp('a', 'idle', { cwd: 'D:\\x\\api', folder: 'api', arrivedAt: 1 }),
    emp('b', 'idle', { cwd: 'D:\\y\\api', folder: 'api', arrivedAt: 2 }),
  ], [], none, none);
  expect(f.map((x) => x.title)).toEqual(['x/api', 'y/api']);
});

test('floorPlan：cwd 為空字串或缺值也有一層，顏色在 PROJECT_COLORS 裡', () => {
  for (const cwd of ['', undefined as unknown as string]) {
    const f = floorPlan([emp('a', 'idle', { cwd })], [], none, none);
    expect(f.length).toBe(1);
    expect(PROJECT_COLORS).toContain(f[0].color);
  }
});

test('floorPlan：沒有人時回傳空陣列', () => expect(floorPlan([], [], none, none)).toEqual([]));

test('floorPlan：助理放在 helperSeats 指定的座位；主人不在、沒座位就不放', () => {
  const o = emp('o', 'working', { seat: 0 });
  const h = { owner: o, a: asst() };
  const f = floorPlan([o], [h], new Map([[helperKey(h), 1]]), none);
  const occ = f[0].seats[1].occ;
  expect(occ?.kind).toBe('assistant');
  expect(occ && occ.kind === 'assistant' && occ.a.id).toBe('t1');
  // 沒有座位 → 不放
  expect(floorPlan([o], [h], none, none)[0].seats.map((s) => s.occ?.kind ?? null)).toEqual(['employee']);
  // 主人不在 employees → 不出現，也不會多開一層
  const ghost = { owner: emp('g', 'working', { cwd: '/ghost', folder: 'ghost' }), a: asst({ id: 't2' }) };
  const g = floorPlan([o], [h, ghost], new Map([[helperKey(h), 1], [helperKey(ghost), 2]]), none);
  expect(g.length).toBe(1);
  expect(g[0].seats.map((s) => s.occ?.kind ?? null)).toEqual(['employee', 'assistant']);
});

test('helperKey', () => expect(helperKey({ owner: emp('o'), a: asst({ id: 't9' }) })).toBe('o/t9'));

const floorOf = (...occ: Floor['seats'][number]['occ'][]): Floor => ({ key: 'k', level: 1, title: 't', color: '#fff', desks: occ.length, seats: occ.map((o, index) => ({ index, occ: o })) });
const ee = (status: Employee['status']) => ({ kind: 'employee' as const, emp: emp('e' + status, status) });

test('floorAlert：等你處理 > 輪到你 > null，只看真員工', () => {
  expect(floorAlert(floorOf(ee('working'), ee('idle')))).toBe('idle');
  expect(floorAlert(floorOf(ee('idle'), ee('waiting')))).toBe('waiting');
  expect(floorAlert(floorOf(ee('working'), { kind: 'assistant', owner: emp('o'), a: asst() }))).toBe(null);
  expect(floorAlert(floorOf(null, ee('working')))).toBe(null);
});

test('plateText', () => {
  expect(plateText({ kind: 'employee', emp: emp('a', 'waiting', { title: '結帳' }) })).toEqual({ text: '! 結帳', tone: 'waiting' });
  expect(plateText({ kind: 'employee', emp: emp('a', 'idle', { title: '結帳' }) })).toEqual({ text: '✓ 結帳', tone: 'idle' });
  expect(plateText({ kind: 'employee', emp: emp('a', 'working', { title: '結帳' }) })).toEqual({ text: '結帳', tone: 'working' });
  const o = emp('o');
  expect(plateText({ kind: 'assistant', owner: o, a: asst() })).toEqual({ text: '↳ 搜尋 程式碼', tone: 'assistant' });
  expect(plateText({ kind: 'assistant', owner: o, a: asst({ kind: 'Explore' }) }).text).toBe('↳ Explore · 搜尋 程式碼');
  expect(plateText({ kind: 'assistant', owner: o, a: asst({ description: ' ', kind: 'Explore' }) }).text).toBe('↳ 助理');
  expect(plateText({ kind: 'assistant', owner: o, a: asst({ status: 'done' }) })).toEqual({ text: '↳ ✓ 完成', tone: 'done' });
});

test('seatCenter、floorWidth', () => {
  expect(seatCenter(0)).toBe(140);
  expect(seatCenter(2)).toBe(380);
  expect(floorWidth(3, 1000)).toBe(1000);
  expect(floorWidth(9, 1000)).toBe(80 + 9 * 120 + 200);
});
