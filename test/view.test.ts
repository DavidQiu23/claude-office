import { expect, test } from 'vitest';
import { appearance, assistantSeat, asstKey, DOOR_X, entryPath, isAsst, makeAssistant, layout, layoutSig, PROJECT_COLORS, projectColor, seatCell, waitingCount, DoneClock, DONE_MS, fitText, fitMiddle, formatTime, nameplate, PALETTE, summary } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import { truncate } from '../src/state/describe.js';
import type { Employee } from '../src/state/types.js';

const emp = (id: string, status: Employee['status'] = 'idle', over: Partial<Employee> = {}): Employee => ({
  sessionId: id, folder: 'proj', cwd: '/x/proj', lastPrompt: 'hi', firstPrompt: '', title: '', transcriptPath: '', status, activity: null,
  seat: 0, arrivedAt: 0, lastEventAt: 0, assistants: [], ...over,
});

test('appearance 對同一個 sessionId 永遠相同', () => {
  expect(appearance('abc')).toEqual(appearance('abc'));
  const a = appearance('abc');
  expect(a.hair).toBeLessThan(PALETTE.length);
  expect(a.shirt).toBeLessThan(PALETTE.length);
});

test('nameplate 截斷內容', () => {
  const p = nameplate(emp('abcd1234', 'idle', { title: 'x'.repeat(100) }));
  expect(p).toBe(truncate('x'.repeat(100), 24));
});

test('nameplate 優先順序：標題 > 第一個 prompt > 最近的 prompt', () => {
  const o = { title: 'T', firstPrompt: 'F', lastPrompt: 'L' };
  expect(nameplate(emp('abcd', 'idle', o))).toBe('T');
  expect(nameplate(emp('abcd', 'idle', { ...o, title: '' }))).toBe('F');
  expect(nameplate(emp('abcd', 'idle', { ...o, title: '', firstPrompt: '' }))).toBe('L');
});

test('nameplate 換行壓成單行', () => {
  expect(nameplate(emp('abcd', 'idle', { title: 'a\n\n  b\r\nc ' }))).toBe('a b c');
});

test('summary 文字與 alert', () => {
  const s = summary([emp('a', 'working'), emp('b', 'working'), emp('c', 'idle')]);
  expect(s).toEqual({ text: '工作中 2 · 等你處理 0 · 閒置 1', alert: false });
  expect(summary([emp('a', 'waiting')]).alert).toBe(true);
});

test('OfficeStore 套用 upsert 與 leave 並通知監聽者', () => {
  const s = new OfficeStore();
  const seen: string[] = [];
  s.on((c) => seen.push(c.type));
  s.apply({ type: 'upsert', employee: emp('a') });
  expect(s.employees.has('a')).toBe(true);
  s.apply({ type: 'leave', sessionId: 'a' });
  expect(s.employees.size).toBe(0);
  s.reset([emp('b')]);
  expect([...s.employees.keys()]).toEqual(['b']);
  expect(seen).toEqual(['upsert', 'leave', 'reset']);
});

test('layout：每個資料夾一座島，桌數 = 最大座位 + 1，欄數最多 3', () => {
  const l = layout([emp('a', 'idle', { cwd: 'D:/p/api', folder: 'api' }), emp('b', 'idle', { cwd: 'D:/p/web', folder: 'web' })]);
  expect(l.islands.length).toBe(2);
  expect(l.islands.map((i) => i.title)).toEqual(['api', 'web']);
  expect(l.islands[0].desks).toBe(1);
  expect(l.islands[0].cols).toBe(1);
  expect(l.islands[0].w).toBe(1 * 96 + 28);
  expect(l.islands[0].h).toBe(26 + 124 + 10);
  expect(l.islands[1].x).toBeGreaterThan(l.islands[0].x);
  const big = layout([emp('a', 'idle', { cwd: 'D:/p/api', folder: 'api', seat: 3 })]);
  expect(big.islands[0].desks).toBe(4);
  expect(big.islands[0].cols).toBe(3);
  expect(big.islands[0].rows).toBe(2);
  expect(big.islands[0].h).toBe(26 + 2 * 124 + 10);
});

test('layout：座位有空缺時仍給足桌數', () => {
  const l = layout([emp('a', 'idle', { seat: 0 }), emp('b', 'idle', { seat: 4 })]);
  expect(l.islands[0].desks).toBe(5);
  expect(l.islands[0].rows).toBe(2);
});

test('layout：位置規則', () => {
  const three = layout(['a', 'b', 'c'].map((n) => emp(n, 'idle', { cwd: 'D:/p/' + n, folder: n, seat: 2 })));
  expect(three.islands[0].x).toBe(40);
  expect(three.islands[0].y).toBe(96);
  expect(new Set(three.islands.map((i) => i.y)).size).toBe(1);
  expect(three.width).toBe(40 + 3 * 316 + 2 * 44 + 40);
  const four = layout(['a', 'b', 'c', 'd'].map((n, k) => emp(n, 'idle', { cwd: 'D:/p/' + n, folder: n, seat: 2, arrivedAt: k })));
  const rowH = Math.max(...four.islands.slice(0, 3).map((i) => i.h));
  expect(four.islands[3].x).toBe(40);
  expect(four.islands[3].y).toBe(96 + rowH + 72);
});

test('layout：同名資料夾用上一層區分（含反斜線）；空辦公室仍有大小', () => {
  const dup = layout([emp('a', 'idle', { cwd: 'D:\\x\\api' }), emp('b', 'idle', { cwd: 'D:\\y\\api' })]);
  expect(dup.islands.map((r) => r.title).sort()).toEqual(['x/api', 'y/api']);
  expect(layout([]).islands).toEqual([]);
  expect(layout([]).width).toBeGreaterThan(0);
  expect(layout([]).height).toBeGreaterThan(0);
});

test('layout：cwd 為空字串或缺值也有一座島', () => {
  for (const cwd of ['', undefined as unknown as string]) {
    const l = layout([emp('a', 'idle', { cwd })]);
    expect(l.islands.length).toBe(1);
    expect(PROJECT_COLORS).toContain(l.islands[0].color);
  }
});

test('layout：超過 8 個專案', () => {
  const l = layout(Array.from({ length: 10 }, (_, k) => emp('s' + k, 'idle', { cwd: 'D:/p/p' + k, folder: 'p' + k, seat: 2, arrivedAt: k })));
  expect(l.islands.length).toBe(10);
  for (const i of l.islands) expect(PROJECT_COLORS).toContain(i.color);
  for (const a of l.islands) for (const b of l.islands) {
    if (a === b) continue;
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(overlap).toBe(false);
  }
});

test('projectColor：同一個 key 永遠同色', () => {
  expect(projectColor('D:/p/api')).toBe(projectColor('D:/p/api'));
  expect(PROJECT_COLORS).toContain(projectColor('D:/p/api'));
  expect(PROJECT_COLORS.length).toBe(8);
});

test('waitingCount 只算該專案 status 為 waiting 的人', () => {
  const es = [emp('a', 'waiting'), emp('b', 'working'), emp('c', 'waiting', { cwd: '/other' }), emp('d', 'waiting')];
  expect(waitingCount(es, '/x/proj')).toBe(2);
  expect(waitingCount(new Map(es.map((e) => [e.sessionId, e])).values(), '/other')).toBe(1);
});

test('seatCell 在島內，entryPath 從門口經走道到座位', () => {
  const [i] = layout([emp('a', 'idle', { cwd: 'D:/p/api', folder: 'api', seat: 4 })]).islands;
  const c = seatCell(i, 4);
  expect(c.x).toBeGreaterThanOrEqual(i.x);
  expect(c.y + 124).toBeLessThanOrEqual(i.y + i.h);
  const p = entryPath(i, 4);
  expect(p.length).toBe(4);
  expect(p[0].x).toBe(DOOR_X);
  expect(p[0].y).toBe(p[1].y);
  expect(p[1].y).toBeLessThan(i.y);
  expect(p[1].y).toBe(i.y - 16 - 28);
  // 沿兩欄桌子之間的走道往下，不穿過上一排的桌子，最後才橫向走進座位
  expect(p[1].x).toBe(p[2].x);
  expect(p[2].x).toBeLessThan(c.x + 12);
  expect(p[2].x).toBeGreaterThanOrEqual(i.x);
  expect(p[2].y).toBe(c.y + 48);
  expect(p[3]).toEqual({ x: c.x + 48, y: c.y + 48 });
});

test('layoutSig：島的位置或大小改變時簽名不同', () => {
  const a = layout([emp('a', 'idle', { seat: 0 })]);
  const b = layout([emp('a', 'idle', { seat: 3 })]);
  const c = layout([emp('x', 'idle', { cwd: '/q', folder: 'q', arrivedAt: -1 }), emp('a', 'idle', { seat: 0 })]);
  expect(layoutSig(a)).toBe(layoutSig(layout([emp('a', 'idle', { seat: 0 })])));
  expect(layoutSig(a)).not.toBe(layoutSig(b));
  expect(layoutSig(a)).not.toBe(layoutSig(c));
});

test('formatTime：HH:mm 補零', () => {
  expect(formatTime(new Date(2026, 0, 2, 3, 4).getTime())).toBe('03:04');
});

test('DoneClock：只記第一次完成時間，3 秒後剩餘為 0', () => {
  const c = new DoneClock();
  expect(c.remaining('x', 100)).toBe(DONE_MS);
  c.mark('x', 1000);
  c.mark('x', 2500);
  expect(c.remaining('x', 2500)).toBe(DONE_MS - 1500);
  expect(c.remaining('x', 9999)).toBe(0);
  c.forget('x');
  expect(c.remaining('x', 9999)).toBe(DONE_MS);
});

test('DoneClock：forget 後再 mark 會有全新的 3 秒；prune 只清沒保留的前綴', () => {
  const c = new DoneClock();
  c.mark('s/a', 0);
  c.forget('s/a');
  c.mark('s/a', 10_000);
  expect(c.remaining('s/a', 11_000)).toBe(DONE_MS - 1000);
  c.mark('s/b', 0);
  c.mark('t/a', 0);
  c.prune('s/', new Set(['s/a']));
  expect(c.remaining('s/b', 9999)).toBe(DONE_MS);
  expect(c.remaining('s/a', 11_000)).toBe(DONE_MS - 1000);
  expect(c.remaining('t/a', 9999)).toBe(0);
});

test('fitText：放得下原樣；放不下以「…」結尾；已有「…」仍保留', () => {
  const fits = (n: number) => (s: string) => [...s].length <= n;
  expect(fitText('abc', fits(5))).toBe('abc');
  expect(fitText('abcdefgh', fits(5))).toBe('abcd…');
  expect(fitText('abcdefgh…', fits(5))).toBe('abcd…');
  expect(fitText('abcde…', fits(6))).toBe('abcde…');
  expect(fitText('abc', fits(0))).toBe('…');
});

test('fitMiddle：放得下原樣；放不下保留開頭與結尾、中間換成「…」', () => {
  const fits = (n: number) => (s: string) => [...s].length <= n;
  expect(fitMiddle('shop', fits(10))).toBe('shop');
  const a = fitMiddle('claudeOffice-islands', fits(10));
  expect(a).toContain('…');
  expect(fits(10)(a)).toBe(true);
  expect(a.startsWith('cl')).toBe(true);
  expect(a.endsWith('ands')).toBe(true);
  expect([...a].length).toBe(10);
  // 同樣開頭的兩個名字截斷後仍可分辨
  expect(fitMiddle('claudeOffice', fits(10))).not.toBe(a);
  expect(fitMiddle('專案名稱非常非常長的資料夾', fits(6))).toMatch(/^專.*….*夾$/);
  expect(fitMiddle('abc', fits(0))).toBe('…');
});

test('layout：較矮的島下方是空地，高度相同的島沒有空地', () => {
  const l = layout([
    emp('a', 'idle', { cwd: 'D:/p/a', folder: 'a', seat: 2, arrivedAt: 0 }),
    emp('b', 'idle', { cwd: 'D:/p/b', folder: 'b', seat: 3, arrivedAt: 1 }),
  ]);
  const [a, b] = l.islands;
  expect(l.voids).toEqual([{ x: a.x, y: a.y + a.h, w: a.w, h: b.h - a.h }]);
  expect(layout([emp('a', 'idle', { seat: 2 })]).voids).toEqual([]);
  expect(layoutSig(l)).not.toBe(layoutSig(layout([emp('a', 'idle', { cwd: 'D:/p/a', folder: 'a', seat: 3 }), emp('b', 'idle', { cwd: 'D:/p/b', folder: 'b', seat: 3 })])));
});

test('assistantSeat：優先主人之後第一張空桌，沒有就接在最後', () => {
  expect(assistantSeat(0, new Set([0]))).toBe(1);
  expect(assistantSeat(0, new Set([0, 1, 2]))).toBe(3);
  expect(assistantSeat(0, new Set([0, 2]))).toBe(1);
  expect(assistantSeat(1, new Set([0, 1, 3]))).toBe(2);
  expect(assistantSeat(2, new Set([0, 1, 2]))).toBe(3); // 主人之前的空桌不回頭找
  expect(assistantSeat(1, new Set([1, 5]))).toBe(2);
});

test('makeAssistant：工作中是 working，完成是 idle；名牌是「↳ 描述」', () => {
  const parent = emp('p', 'working', { title: '主題', seat: 2 });
  const w = makeAssistant(parent, { id: 'a1', description: '  寫  測試 ', status: 'working', startedAt: 5 }, 3);
  expect(w.sessionId).toBe('p/a1');
  expect(asstKey('p', 'a1')).toBe('p/a1');
  expect(isAsst(w)).toBe(true);
  expect(isAsst(parent)).toBe(false);
  expect(w.status).toBe('working');
  expect(w.seat).toBe(3);
  expect(w.cwd).toBe(parent.cwd);
  expect(w.folder).toBe(parent.folder);
  expect(w.assistants).toEqual([]);
  expect(nameplate(w)).toBe('↳ 寫 測試');
  expect(w.asst).toEqual({ parentId: 'p', parentTitle: '主題', description: '寫 測試', done: false });
  const d = makeAssistant(parent, { id: 'a1', description: '寫測試', status: 'done', startedAt: 5 }, 3);
  expect(d.status).toBe('idle');
  expect(nameplate(d)).toBe('↳ ✓ 完成');
  expect(d.asst.done).toBe(true);
  expect(nameplate(makeAssistant(parent, { id: 'a2', description: '', status: 'working', startedAt: 6 }, 4))).toBe('↳ 助理');
});

test('助理扮成的員工參與排版：每位助理多一張桌，招牌的等你人數不算助理', () => {
  const parent = emp('p', 'waiting', { seat: 0 });
  const a1 = makeAssistant(parent, { id: '1', description: 'x', status: 'working', startedAt: 1 }, 1);
  const a2 = makeAssistant(parent, { id: '2', description: 'y', status: 'working', startedAt: 2 }, 2);
  const l = layout([parent, a1, a2]);
  expect(l.islands.length).toBe(1);
  expect(l.islands[0].desks).toBe(3);
  expect(waitingCount([parent, a1, a2], parent.cwd)).toBe(1);
  expect(appearance(a1.sessionId)).not.toEqual(appearance(a2.sessionId));
});
