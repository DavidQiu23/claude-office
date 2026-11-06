import { expect, test } from 'vitest';
import { buildingPlan, buildingWidth, floorAlert, floorPlan, personLabel, plateText, seatGrid, visibleSpan, atBottom, withLeaving, vacate } from '../web/src/floors.js';
import { furnitureSet, layoutSet, SETS, wallPlan } from '../web/src/furniture.js';
import type { Floor } from '../web/src/floors.js';
import { PROJECT_COLORS } from '../web/src/view.js';
import type { Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', firstPrompt: '', title: '', transcriptPath: '', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});
const none = new Map<string, number>();

test('floorPlan：依專案最早到班從 1F 往上排，同時間依路徑', () => {
  const f = floorPlan([
    emp('a', 'working', { cwd: '/b', folder: 'b', arrivedAt: 5 }),
    emp('c', 'working', { cwd: '/a', folder: 'a', arrivedAt: 5 }),
    emp('d', 'working', { cwd: '/z', folder: 'z', arrivedAt: 1 }),
  ], none);
  expect(f.map((x) => [x.level, x.title])).toEqual([[1, 'z'], [2, 'a'], [3, 'b']]);
});

test('floorPlan：中間一層的人走光後，上面往下遞補', () => {
  const es = [
    emp('a', 'working', { cwd: '/a', folder: 'a', arrivedAt: 1 }),
    emp('b', 'working', { cwd: '/b', folder: 'b', arrivedAt: 2 }),
    emp('c', 'working', { cwd: '/c', folder: 'c', arrivedAt: 3 }),
  ];
  expect(floorPlan(es, none).map((x) => x.level)).toEqual([1, 2, 3]);
  const f = floorPlan(es.filter((e) => e.sessionId !== 'b'), none);
  expect(f.map((x) => [x.level, x.title])).toEqual([[1, 'a'], [2, 'c']]);
});

const proj = (id: string, name: string, arrivedAt: number): Employee => emp(id, 'working', { cwd: `/${name}`, folder: name, arrivedAt });
const order = (f: Floor[]): string[] => f.map((x) => x.key);

test('floorPlan：還有人的樓層不換位置，最早的 session 走了也一樣', () => {
  // A 專案在 t=1 與 t=10 各有一位，B 專案在 t=5：1F A、2F B
  const es = [proj('a1', 'A', 1), proj('a2', 'A', 10), proj('b', 'B', 5)];
  const first = floorPlan(es, none);
  expect(first.map((x) => [x.level, x.title])).toEqual([[1, 'A'], [2, 'B']]);
  // t=1 的 session 離開：A 的最早時間變 10，仍然是 1F A、2F B
  const after = floorPlan(es.filter((e) => e.sessionId !== 'a1'), none, order(first));
  expect(after.map((x) => [x.level, x.title])).toEqual([[1, 'A'], [2, 'B']]);
  // 沒有 prevOrder（頁面剛載入）才依最早到班排
  expect(floorPlan(es.filter((e) => e.sessionId !== 'a1'), none).map((x) => x.title)).toEqual(['B', 'A']);
});

test('floorPlan：中間一層走光，上面的樓層往下一格，其餘維持順序', () => {
  const es = [proj('a', 'A', 1), proj('b', 'B', 2), proj('c', 'C', 3)];
  const first = floorPlan(es, none);
  const f = floorPlan(es.filter((e) => e.sessionId !== 'b'), none, order(first));
  expect(f.map((x) => [x.level, x.title])).toEqual([[1, 'A'], [2, 'C']]);
});

test('floorPlan：新樓層一律蓋在最上面，就算比既有的更早到班；新樓層之間依最早到班再依路徑', () => {
  const first = floorPlan([proj('a', 'A', 10), proj('b', 'B', 20)], none);
  const f = floorPlan([proj('a', 'A', 10), proj('b', 'B', 20), proj('n1', 'N1', 5), proj('n2', 'N2', 3), proj('n0', 'N0', 5)], none, order(first));
  expect(f.map((x) => x.title)).toEqual(['A', 'B', 'N2', 'N0', 'N1']);
  expect(f.map((x) => x.level)).toEqual([1, 2, 3, 4, 5]);
});

test('buildingPlan：prevOrder 一路傳到 floorPlan', () => {
  const es = [proj('a1', 'A', 1), proj('a2', 'A', 10), proj('b', 'B', 5)];
  const p1 = buildingPlan(es, [], none);
  const p2 = buildingPlan(es.filter((e) => e.sessionId !== 'a1'), [], p1.minDesks, order(p1.plan));
  expect(p2.plan.map((f) => f.title)).toEqual(['A', 'B']);
});

test('floorPlan：桌數 = max(最大座位+1, minDesks)，空座位 occ 為 null', () => {
  const f = floorPlan([emp('a', 'working', { seat: 2 })], new Map([['/x/proj', 5]]));
  expect(f[0].desks).toBe(5);
  expect(f[0].seats.map((s) => s.occ?.sessionId ?? null)).toEqual([null, null, 'a', null, null]);
  // 沒有 minDesks 時，以最大座位為準
  expect(floorPlan([emp('a', 'working', { seat: 2 })], none)[0].desks).toBe(3);
});

test('floorPlan：同名資料夾用路徑最後兩層', () => {
  const f = floorPlan([
    emp('a', 'idle', { cwd: 'D:\\x\\api', folder: 'api', arrivedAt: 1 }),
    emp('b', 'idle', { cwd: 'D:\\y\\api', folder: 'api', arrivedAt: 2 }),
  ], none);
  expect(f.map((x) => x.title)).toEqual(['x/api', 'y/api']);
});

test('floorPlan：cwd 為空字串或缺值也有一層，顏色在 PROJECT_COLORS 裡', () => {
  for (const cwd of ['', undefined as unknown as string]) {
    const f = floorPlan([emp('a', 'idle', { cwd })], none);
    expect(f.length).toBe(1);
    expect(PROJECT_COLORS).toContain(f[0].color);
  }
});

test('floorPlan：沒有人時回傳空陣列', () => expect(floorPlan([], none)).toEqual([]));

const floorOf = (...occ: (Employee | null)[]): Floor => ({ key: 'k', level: 1, title: 't', color: '#fff', desks: occ.length, seats: occ.map((o, index) => ({ index, occ: o })) });
const ee = (status: Employee['status']) => emp('e' + status, status);

test('floorAlert：等你處理 > 輪到你 > null', () => {
  expect(floorAlert(floorOf(ee('working'), ee('idle')))).toBe('idle');
  expect(floorAlert(floorOf(ee('idle'), ee('waiting')))).toBe('waiting');
  expect(floorAlert(floorOf(null, ee('working')))).toBe(null);
});

test('plateText：狀態前綴', () => {
  expect(plateText(emp('a', 'waiting', { title: '結帳' }))).toBe('! 結帳');
  expect(plateText(emp('a', 'idle', { title: '結帳' }))).toBe('✓ 結帳');
});

test('personLabel：念誰加狀態，不念前綴；助理念類型和描述', () => {
  expect(personLabel(emp('a', 'waiting', { title: '結帳' }))).toBe('結帳，等你處理');
  expect(personLabel(emp('a', 'idle', { title: '', lastPrompt: '' }))).toBe('無標題，輪到你');
  expect(personLabel({ ...emp('b', 'working'), assistant: { id: 'b', kind: 'Explore', description: '找檔案', status: 'working', seat: 1, startedAt: 0, activity: null } })).toBe('助理 Explore · 找檔案，工作中');
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

test('withLeaving + vacate：最後一人退場時樓層還在、座位已空、不算提示', () => {
  const gone = emp('a', 'waiting', { seat: 1 });
  const plan = vacate(floorPlan(withLeaving([], [gone]), none), new Set(['a']));
  expect(plan).toHaveLength(1);
  expect(plan[0].desks).toBe(2);
  expect(plan[0].seats.every((s) => s.occ === null)).toBe(true);
  expect(floorAlert(plan[0])).toBe(null);
});

test('withLeaving：新人坐上正在離開的人的座位時新人優先；同一人又回來只算一次', () => {
  const gone = emp('a', 'working', { seat: 0 }), fresh = emp('b', 'waiting', { seat: 0 });
  const plan = vacate(floorPlan(withLeaving([fresh], [gone]), none), new Set(['a']));
  expect(plan[0].seats[0].occ).toMatchObject({ sessionId: 'b' });
  const back = emp('a', 'idle', { seat: 2 });
  expect(withLeaving([back], [gone]).map((e) => [e.sessionId, e.seat])).toEqual([['a', 2]]);
});

test('vacate：沒有人在離開時原樣回傳', () => {
  const plan = floorPlan([emp('a')], none);
  expect(vacate(plan, new Set())).toBe(plan);
});

const round = (xs: number[]) => xs.map((x) => Math.round(x * 10) / 10);

test('seatGrid：900 寬（樓層 828）是 3 桌、1 個家具區、2 桌', () => {
  const g = seatGrid(828);
  expect(g.seats).toEqual([84, 204, 324, 624, 744]);
  expect(g.bays).toEqual([{ x: 384, w: 180 }]);
  expect(g.groups.map((x) => x.length)).toEqual([3, 2]);
});

test('seatGrid：1920 寬（樓層 1848）是 10 桌、3 個家具區，餘數平均給家具區', () => {
  const g = seatGrid(1848);
  expect(g.seats.length).toBe(10);
  expect(g.bays).toEqual([{ x: 384, w: 200 }, { x: 944, w: 200 }, { x: 1504, w: 200 }]);
  expect(g.groups.map((x) => x.length)).toEqual([3, 3, 3, 1]);
});

test('seatGrid：桌子和家具區不重疊，最後都在樓層裡', () => {
  for (let w = 0; w <= 4000; w += 37) {
    const g = seatGrid(w);
    const parts = [...g.seats.map((c) => [c - 60, c + 60]), ...g.bays.map((b) => [b.x, b.x + b.w])].sort((a, b) => a[0]! - b[0]!);
    parts.forEach((p, i) => { if (i) expect(p[0]! + 1e-6).toBeGreaterThanOrEqual(parts[i - 1]![1]!); });
    if (g.seats.length) expect(parts.at(-1)![1]! - 1e-6).toBeLessThanOrEqual(w - 24);
  }
});

test('buildingWidth：任何桌數、任何可用寬，格子都放得下；放得下時就是可用寬', () => {
  for (let desks = 1; desks <= 40; desks++) {
    for (const avail of [0, 588, 813, 828, 1128, 1848, 2300]) {
      const w = buildingWidth([floorOf(...Array(desks).fill(null))], avail);
      expect(w).toBeGreaterThanOrEqual(avail);
      expect(seatGrid(w).seats.length).toBeGreaterThanOrEqual(desks);
    }
  }
  expect(buildingWidth([floorOf(null, null)], 828)).toBe(828);
  expect(buildingWidth([floorOf(null, null, null, null)], 813)).toBe(813); // 3 桌、家具區、1 桌放得下，不用加寬
  // 1128 寬多出第二個家具區、只排得下 6 桌，7 桌要再往右長
  expect(seatGrid(buildingWidth([floorOf(...Array(7).fill(null))], 1128)).seats.length).toBeGreaterThanOrEqual(7);
  expect(buildingWidth([], 500)).toBe(500);
});

test('wallPlan：第一組只在第三張桌子上方開窗，不足三張不開，其他組依桌數', () => {
  expect(wallPlan({ seats: [], bays: [], groups: [[84, 204, 324], [564, 684]] }).windows).toEqual([324, 684]);
  expect(wallPlan({ seats: [], bays: [], groups: [[84, 204]] }).windows).toEqual([]);
  expect(round(wallPlan(seatGrid(1848)).windows)).toEqual([324, 644, 884, 1204, 1444, 1764]);
});

test('furnitureSet：同一個 key 第一區永遠同一組，後面依 SETS 順序輪', () => {
  const first = SETS.indexOf(furnitureSet('/x'));
  expect(furnitureSet('/x', 0)).toBe(furnitureSet('/x'));
  expect(furnitureSet('/x', 1)).toBe(SETS[(first + 1) % SETS.length]);
});

test('layoutSet：整組在家具區裡置中', () => {
  for (const set of SETS) {
    const it = layoutSet(set, 180);
    expect(it[0]!.x).toBeGreaterThan(0);
    expect(it.at(-1)!.x).toBeLessThan(180);
  }
});
