import { expect, test } from 'vitest';
import { assignAssistantSeats, edgeHints, floorAlert, floorPlan, floorWidth, helperKey, plateText, seatCenter, visibleSpan, atBottom, DOOR_X, walkMs, walkPos, withLeaving, vacate, helperRoster, HELPER_LINGER, type HelperTrack } from '../web/src/floors.js';
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

// ---- 助理座位 ----
const seatsOf = (...seats: number[]) => seats.map((s, i) => emp('e' + i, 'working', { seat: s }));
const helperOf = (owner: Employee, id = 't1'): { owner: Employee; a: Assistant } => ({ owner, a: asst({ id }) });

test('assignAssistantSeats：坐主人右邊第一張空桌', () => {
  const es = seatsOf(0, 1, 3);
  const h = helperOf(es[0]);
  expect(assignAssistantSeats(new Map(), es, [h]).get(helperKey(h))).toBe(2);
});

test('assignAssistantSeats：沒有空桌就接在最後', () => {
  const es = seatsOf(0, 1, 2);
  const h1 = helperOf(es[0], 'a');
  const h2 = helperOf(es[0], 'b');
  const m = assignAssistantSeats(new Map(), es, [h1, h2]);
  expect(m.get(helperKey(h1))).toBe(3);
  expect(m.get(helperKey(h2))).toBe(4);
});

test('assignAssistantSeats：在的期間座位不變', () => {
  const es = seatsOf(0, 1);
  const h = helperOf(es[0]);
  expect(assignAssistantSeats(new Map([[helperKey(h), 3]]), es, [h]).get(helperKey(h))).toBe(3);
});

test('assignAssistantSeats：真員工撞到助理座位時，助理換位', () => {
  const es = seatsOf(0, 1, 2);
  const h = helperOf(es[0]);
  expect(assignAssistantSeats(new Map([[helperKey(h), 2]]), es, [h]).get(helperKey(h))).toBe(3);
});

test('assignAssistantSeats：主人不在就不分配', () => {
  const es = seatsOf(0);
  const ghost = helperOf(emp('ghost', 'working', { seat: 1 }));
  const m = assignAssistantSeats(new Map([[helperKey(ghost), 2]]), es, [ghost]);
  expect(m.has(helperKey(ghost))).toBe(false);
  expect(m.size).toBe(0);
});

test('assignAssistantSeats：不同專案的座位互不影響', () => {
  const a = emp('a', 'working', { seat: 0, cwd: '/x/a' });
  const b = emp('b', 'working', { seat: 1, cwd: '/x/b' });
  const h = helperOf(a);
  expect(assignAssistantSeats(new Map(), [a, b], [h]).get(helperKey(h))).toBe(1);
});

// ---- 邊緣提示 ----
test('edgeHints：只算看不到的真員工，紅色優先，target 是最近的那位', () => {
  const view = { left: seatCenter(2) - 60, right: seatCenter(5) + 60 };
  const build = (s8: Employee['status']) => floorOf(
    ee('waiting'), null, null, null, null, null, null, ee('idle'), { kind: 'employee', emp: emp('x8', s8) },
  );
  expect(edgeHints(build('waiting'), view)).toEqual({ left: { status: 'waiting', count: 1, target: 0 }, right: { status: 'waiting', count: 1, target: 8 } });
  expect(edgeHints(build('working'), view).right).toEqual({ status: 'idle', count: 1, target: 7 });
  // 看不到的只有助理 → null
  const onlyAsst = floorOf({ kind: 'assistant', owner: emp('o'), a: asst() }, null, null, null, null, null, null, null, { kind: 'assistant', owner: emp('o'), a: asst({ id: 't2' }) });
  expect(edgeHints(onlyAsst, view)).toEqual({ left: null, right: null });
});

test('edgeHints：同側多位時 waiting 計人數，target 取離可見範圍最近的 waiting', () => {
  const view = { left: seatCenter(4) - 60, right: seatCenter(5) + 60 };
  const f = floorOf(ee('waiting'), ee('idle'), ee('waiting'), ee('working'), null, null, ee('idle'), ee('working'));
  expect(edgeHints(f, view)).toEqual({ left: { status: 'waiting', count: 2, target: 2 }, right: { status: 'idle', count: 1, target: 6 } });
  // 全看得到 → 都是 null
  expect(edgeHints(f, { left: 0, right: 99999 })).toEqual({ left: null, right: null });
});

test('visibleSpan：框住第一顆到最後一顆看得到的按鈕，都看不到是 null', () => {
  expect(visibleSpan([])).toBeNull();
  expect(visibleSpan([false, false])).toBeNull();
  expect(visibleSpan([false, true, true, false])).toEqual({ from: 1, to: 2 });
  expect(visibleSpan([true, false, false])).toEqual({ from: 0, to: 0 });
  expect(visibleSpan([false, false, true])).toEqual({ from: 2, to: 2 });
});

test('atBottom：沒有捲軸或捲到底（容許 1px）算在最底', () => {
  expect(atBottom(0, 700, 700)).toBe(true); // 沒有捲軸
  expect(atBottom(0, 1500, 700)).toBe(false); // 在最上
  expect(atBottom(800, 1500, 700)).toBe(true);
  expect(atBottom(799.5, 1500, 700)).toBe(true); // 小數捲動位置
  expect(atBottom(500, 1500, 700)).toBe(false);
});

test('walkMs：距離 ÷ 120px/s，左右走一樣久，原地為 0；電梯門中心在電梯區正中', () => {
  expect(walkMs(40, 280)).toBe(2000);
  expect(walkMs(280, 40)).toBe(2000);
  expect(walkMs(100, 100)).toBe(0);
  expect(DOOR_X).toBe(40);
});

test('walkPos：等速內插，半路轉向從那裡開始；時間外夾在起終點；0ms 直接在終點', () => {
  const w = { from: 40, to: 280, start: 1000, ms: 2000 };
  expect(walkPos(w, 1000)).toBe(40);
  expect(walkPos(w, 2000)).toBe(160);
  expect(walkPos(w, 500)).toBe(40);
  expect(walkPos(w, 9000)).toBe(280);
  expect(walkPos({ from: 280, to: 40, start: 0, ms: 1000 }, 250)).toBe(220);
  expect(walkPos({ from: 5, to: 5, start: 0, ms: 0 }, 0)).toBe(5);
});

test('withLeaving + vacate：最後一人走去電梯時樓層還在、座位已空、不算提示', () => {
  const gone = emp('a', 'waiting', { seat: 1 });
  const plan = vacate(floorPlan(withLeaving([], [gone]), [], none, none), new Set(['a']));
  expect(plan).toHaveLength(1);
  expect(plan[0].desks).toBe(2);
  expect(plan[0].seats.every((s) => s.occ === null)).toBe(true);
  expect(floorAlert(plan[0])).toBe(null);
});

test('withLeaving：新人坐上正在離開的人的座位時新人優先；同一人又回來只算一次', () => {
  const gone = emp('a', 'working', { seat: 0 }), fresh = emp('b', 'waiting', { seat: 0 });
  const plan = vacate(floorPlan(withLeaving([fresh], [gone]), [], none, none), new Set(['a']));
  expect(plan[0].seats[0].occ).toMatchObject({ kind: 'employee', emp: { sessionId: 'b' } });
  const back = emp('a', 'idle', { seat: 2 });
  expect(withLeaving([back], [gone]).map((e) => [e.sessionId, e.seat])).toEqual([['a', 2]]);
});

test('vacate：沒有人在離開時原樣回傳', () => {
  const plan = floorPlan([emp('a')], [], none, none);
  expect(vacate(plan, new Set())).toBe(plan);
});

// ---- 助理在大樓裡的名單 ----
const track = (owner: Employee, a: Assistant, doneAt: number | null = null): [string, HelperTrack] => [helperKey({ owner, a }), { owner, a, doneAt }];
const keysOf = (m: ReadonlyMap<string, unknown>) => [...m.keys()];

test('helperRoster：工作中的助理在大樓裡，主人換成最新的資料', () => {
  const a = asst({ id: 't1' }), o = emp('o', 'working', { assistants: [a] });
  const r = helperRoster(new Map(), new Set(), [o], 100);
  expect(keysOf(r.stay)).toEqual(['o/t1']);
  expect(r.stay.get('o/t1')).toEqual({ owner: o, a, doneAt: null });
  expect(r.out).toEqual([]);
  expect(r.next).toBeNull();
});

test('helperRoster：第一次看到 done 記時間，停留 HELPER_LINGER 後走出去並記在 gone', () => {
  expect(HELPER_LINGER).toBe(3000);
  const w = asst({ id: 't1' }), d = asst({ id: 't1', status: 'done' });
  const o0 = emp('o', 'working', { assistants: [w] }), o1 = emp('o', 'working', { assistants: [d] });
  const r1 = helperRoster(new Map([track(o0, w)]), new Set(), [o1], 1000);
  expect(r1.stay.get('o/t1')?.doneAt).toBe(1000);
  expect(r1.next).toBe(4000);
  // 之後的 render 不重記時間
  const r2 = helperRoster(r1.stay, r1.gone, [o1], 3999);
  expect(r2.stay.get('o/t1')?.doneAt).toBe(1000);
  expect(r2.out).toEqual([]);
  const r3 = helperRoster(r2.stay, r2.gone, [o1], 4000);
  expect(keysOf(r3.stay)).toEqual([]);
  expect(r3.out).toEqual(['o/t1']);
  expect([...r3.gone]).toEqual(['o/t1']);
  // 還列在清單上（伺服器下一個事件才清掉 done）也不會再進來
  const r4 = helperRoster(r3.stay, r3.gone, [o1], 5000);
  expect(keysOf(r4.stay)).toEqual([]);
  expect(r4.out).toEqual([]);
  expect([...r4.gone]).toEqual(['o/t1']);
  // 從清單消失後 gone 也清掉
  expect([...helperRoster(r4.stay, r4.gone, [emp('o')], 6000).gone]).toEqual([]);
});

test('helperRoster：done 從清單消失（伺服器清掉）仍停留到時間到', () => {
  const d = asst({ id: 't1', status: 'done' }), o = emp('o', 'working', { assistants: [d] }), o2 = emp('o', 'idle');
  const r = helperRoster(new Map([track(o, d, 1000)]), new Set(), [o2], 2000);
  expect(r.stay.get('o/t1')).toEqual({ owner: o2, a: d, doneAt: 1000 });
  expect(r.next).toBe(4000);
  expect(helperRoster(r.stay, r.gone, [o2], 4000).out).toEqual(['o/t1']);
});

test('helperRoster：工作中卻從清單消失、或主人不在了，立刻走出去', () => {
  const a = asst({ id: 't1' }), b = asst({ id: 't2', status: 'done' });
  const o = emp('o', 'working', { assistants: [a, b] });
  const prev = new Map([track(o, a), track(o, b, 1000)]);
  expect(helperRoster(prev, new Set(), [emp('o')], 1500).out).toEqual(['o/t1']);
  const gone = helperRoster(prev, new Set(), [], 1500);
  expect(gone.out).toEqual(['o/t1', 'o/t2']);
  expect(keysOf(gone.stay)).toEqual([]);
});

test('helperRoster：重新整理時第一次看到的 done 從現在開始算', () => {
  const d = asst({ id: 't1', status: 'done' }), o = emp('o', 'working', { assistants: [d] });
  const r = helperRoster(new Map(), new Set(), [o], 500);
  expect(r.stay.get('o/t1')?.doneAt).toBe(500);
  expect(r.next).toBe(3500);
});

test('helperRoster：next 是最早到期的時間；不同主人的助理分開', () => {
  const a = asst({ id: 't1', status: 'done' }), b = asst({ id: 't1', status: 'done' });
  const o = emp('o', 'working', { assistants: [a] }), p = emp('p', 'working', { assistants: [b] });
  const r = helperRoster(new Map([track(o, a, 2000), track(p, b, 1000)]), new Set(), [o, p], 2500);
  expect(keysOf(r.stay)).toEqual(['o/t1', 'p/t1']);
  expect(r.next).toBe(4000);
});

test('helperRoster：主人回來（同一個 session）時，gone 已清掉的工作中助理重新進來', () => {
  const a = asst({ id: 't1' }), o = emp('o', 'working', { assistants: [a] });
  const away = helperRoster(new Map([track(o, a)]), new Set(), [], 0);
  expect(away.out).toEqual(['o/t1']);
  expect(keysOf(helperRoster(away.stay, away.gone, [o], 10).stay)).toEqual(['o/t1']);
});
