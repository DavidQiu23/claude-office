import { expect, test } from 'vitest';
import { appearance, assistantList, columnsFor, DOOR_X, entryPath, SEAT, layout, layoutSig, PROJECT_COLORS, projectColor, seatCell, waitingCount, fitText, fitMiddle, formatTime, nameplate, PALETTE, summary, plateMaxW, plateLabel, SIGN_FONT, signFit, signMaxW } from '../web/src/view.js';
import type { Island } from '../web/src/view.js';
import { OfficeStore } from '../web/src/sync.js';
import { truncate } from '../src/state/describe.js';
import type { Assistant, Employee } from '../src/state/types.js';

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
  expect(three.width).toBe(1280); // 3 座島只要 1116，不到最小尺寸，仍是 1280 × 720
  expect(three.height).toBe(720);
  // 一排可以排到 1240（不留 180 的空位）：4 座一欄的小島放得進同一排
  const small = layout(['a', 'b', 'c', 'd'].map((n, k) => emp(n, 'idle', { cwd: 'D:/p/' + n, folder: n, seat: 1, arrivedAt: k })));
  expect(new Set(small.islands.map((i) => i.y)).size).toBe(1);
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
  expect(p[2].y).toBe(c.y + SEAT.y);
  expect(p[3]).toEqual({ x: c.x + SEAT.x, y: c.y + SEAT.y });
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

test('columnsFor：桌數越多欄越多，高度不會一直往上長', () => {
  expect([1, 2, 3].map(columnsFor)).toEqual([1, 2, 3]);
  expect([4, 9].map(columnsFor)).toEqual([3, 3]);
  expect([10, 16].map(columnsFor)).toEqual([4, 4]);
  expect([17, 40].map(columnsFor)).toEqual([5, 5]);
  const l = layout([emp('a', 'idle', { seat: 11 })]);
  expect(l.islands[0].cols).toBe(4);
  expect(l.islands[0].rows).toBe(3);
});

const lim = (n: number) => (s: string) => [...s].length <= n;
const plateEmp = (status: Employee['status'], activity: string | null, title = '登入流程重構') => emp('abcd1234', status, { title, activity });

test('plateMaxW', () => {
  expect(plateMaxW(1)).toBe(170);
  expect(plateMaxW(0.82)).toBeCloseTo(139.6, 5);
  expect(plateMaxW(0.8)).toBe(136);
  expect(plateMaxW(0.79)).toBeCloseTo(126.4, 5);
  expect(plateMaxW(2)).toBe(170);
  expect(plateMaxW(0.5)).toBe(80);
});

test('plateLabel：放得下就完整顯示', () => {
  expect(plateLabel(plateEmp('working', '編輯 view.ts'), lim(40))).toEqual({ text: '登入流程重構 · 編輯 view.ts', waiting: false });
});

test('plateLabel：等你處理加「! 」', () => {
  const p = plateLabel(plateEmp('waiting', '編輯 view.ts'), lim(40));
  expect(p.text.startsWith('! 登入流程重構 · ')).toBe(true);
  expect(p.waiting).toBe(true);
});

test('plateLabel：等你處理又要截字，「! 」也算在寬度內', () => {
  const p = plateLabel(plateEmp('waiting', '編輯非常長的檔案名稱.ts 與其他內容'), lim(16));
  expect(p.text.startsWith('! ')).toBe(true);
  expect(p.waiting).toBe(true);
  expect(p.text.endsWith('…')).toBe(true);
  expect('編輯非常長的檔案名稱.ts 與其他內容'.startsWith(p.text.split(' · ')[1].slice(0, -1))).toBe(true);
  expect([...p.text].length).toBeLessThanOrEqual(16);
});

test('plateLabel：沒有動作只有名字', () => {
  expect(plateLabel(plateEmp('idle', null), lim(40)).text).toBe('登入流程重構');
});

test('plateLabel：長動作先截動作，名字完整', () => {
  const p = plateLabel(plateEmp('working', '編輯非常長的檔案名稱.ts 與其他內容'), lim(16));
  expect(p.text.startsWith('登入流程重構 · 編輯')).toBe(true);
  expect(p.text.endsWith('…')).toBe(true);
  expect('編輯非常長的檔案名稱.ts 與其他內容'.startsWith(p.text.split(' · ')[1].slice(0, -1))).toBe(true);
  expect([...p.text].length).toBeLessThanOrEqual(16);
});

test('plateLabel：nameOnly 只顯示名字', () => {
  expect(plateLabel(plateEmp('working', '編輯 view.ts'), lim(40), true)).toEqual({ text: '登入流程重構', waiting: false });
  expect(plateLabel(plateEmp('waiting', '編輯 view.ts'), lim(40), true)).toEqual({ text: '! 登入流程重構', waiting: true });
});

test('plateLabel：動作至少 4 字加…，其餘截名字', () => {
  const p = plateLabel(plateEmp('working', '編輯非常長的檔案名稱.ts 與其他內容', 'N'.repeat(30)), lim(14));
  const [name, act] = p.text.split(' · ');
  expect([...p.text].length).toBeLessThanOrEqual(14);
  expect(act).toBe('編輯非常…');
  expect(name).toContain('…');
});

test('plateLabel：動作不超過 4 字不截動作', () => {
  const p = plateLabel(plateEmp('working', '讀檔', 'N'.repeat(30)), lim(12));
  expect(p.text.endsWith(' · 讀檔')).toBe(true);
  expect([...p.text].length).toBeLessThanOrEqual(12);
});

const meas = (s: string, size: number) => [...s].length * size;
test('signFit：能放就用最大字級', () => expect(signFit('claudeOffice', 1000, meas).size).toBe(SIGN_FONT.max));
test('signFit：逐步縮小字級', () => {
  const r = signFit('claudeOffice', 12 * 14, meas);
  expect(r.size).toBe(14);
  expect(r.text).toBe('claudeOffice');
});
test('signFit：最小字級仍放不下就截字', () => {
  const r = signFit('claudeOffice', 60, meas);
  expect(r.size).toBe(SIGN_FONT.min);
  expect(r.text).toContain('…');
  expect(meas(r.text, SIGN_FONT.min)).toBeLessThanOrEqual(60);
});
test('signMaxW', () => expect(signMaxW({ w: 124 } as Island)).toBe(124 + 44 - 24));

const asst = (id: string, status: Assistant['status']): Assistant => ({ id, description: id, status, startedAt: 0 });

test('assistantList：空清單', () => {
  expect(assistantList([])).toEqual({ rows: [], extra: 0, extraWorking: 0, extraDone: 0, working: 0 });
});

test('assistantList：工作中排前，同組維持原順序', () => {
  const r = assistantList([asst('a', 'done'), asst('b', 'working'), asst('c', 'done'), asst('d', 'working')]);
  expect(r.rows.map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  expect(r.working).toBe(2);
});

test('assistantList：超過上限的算進 extra', () => {
  const list = [...[1, 2, 3, 4].map((i) => asst(`d${i}`, 'done')), ...[1, 2, 3, 4, 5].map((i) => asst(`w${i}`, 'working'))];
  const r = assistantList(list);
  expect(r.rows.length).toBe(4);
  expect(r.rows.every((x) => x.status === 'working')).toBe(true);
  expect([r.extra, r.extraWorking, r.extraDone, r.working]).toEqual([5, 1, 4, 5]);
});
