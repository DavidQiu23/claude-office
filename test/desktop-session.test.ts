import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/server/app.js';
import { readDesktopSession, type DesktopSession } from '../src/server/desktop.js';
import { IDLE_TIMEOUT_MS } from '../src/state/maintenance.js';

const HOST = 'local_11111111-2222-3333-4444-555555555555';
const tmp = mkdtempSync(join(tmpdir(), 'office-desktop-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

// ---- 讀 Desktop 的紀錄 ----
const orgDir = join(tmp, 'sessions', 'acct', 'org');
mkdirSync(orgDir, { recursive: true });
const record = (id: string, body: object) => writeFileSync(join(orgDir, `${id}.json`), JSON.stringify(body));
const read = (id: string) => readDesktopSession(id, [join(tmp, 'sessions')]);

test('readDesktopSession 讀出標題、目前與先前的 CLI id', () => {
  record('local_aaa', { isArchived: false, title: '修登入', cliSessionId: 'c2', priorCliSessionIds: ['c1'] });
  expect(read('local_aaa')).toEqual({ ended: false, title: '修登入', cliIds: ['c2', 'c1'] });
});
test('readDesktopSession：封存算結束', () => {
  record('local_bbb', { isArchived: true, title: 't', cliSessionId: 'c' });
  expect(read('local_bbb')?.ended).toBe(true);
});
test('readDesktopSession：只剩 deleted_ 標記算結束', () => {
  writeFileSync(join(orgDir, 'deleted_ccc'), '1');
  expect(read('local_ccc')?.ended).toBe(true);
});
test('readDesktopSession：找不到或壞掉的紀錄回 null（判斷不了，不能當成結束）', () => {
  expect(read('local_none')).toBeNull();
  writeFileSync(join(orgDir, 'local_bad.json'), '{ 寫到一半');
  expect(read('local_bad')).toBeNull();
  expect(readDesktopSession('local_x', [join(tmp, 'no-such-dir')])).toBeNull();
});
test('readDesktopSession：不是 local_ 開頭的 id 不碰檔案系統', () => {
  record('escape', { isArchived: true });
  expect(read('../org/escape')).toBeNull();
  expect(read('escape')).toBeNull();
});

// ---- 伺服器行為 ----
let app: ReturnType<typeof createApp>;
let base: string;
let clock = 1000;
let desktop: Record<string, DesktopSession | null> = {};

beforeEach(async () => {
  clock = 1000;
  desktop = {};
  app = createApp({ staticDir: tmp, now: () => clock, desktopSession: (id) => desktop[id] ?? null });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  app.server.closeAllConnections();
  await new Promise((r) => app.server.close(r));
});

let t = 1000;
const send = (name: string, id: string, extra: object = {}) =>
  fetch(base + '/events', { method: 'POST', body: JSON.stringify({ hook_event_name: name, session_id: id, cwd: 'D:\\p\\api', sentAt: ++t, ...extra }) });
const fromDesktop = { host_session_id: HOST };
const employees = async () => ((await (await fetch(base + '/state')).json()) as any).employees as any[];
const ids = async () => (await employees()).map((e) => e.sessionId).sort();
const alive = (cliIds: string[], title = ''): DesktopSession => ({ ended: false, title, cliIds });

test('Desktop：CLI 停掉（SessionEnd）不下班，改成輪到你、清掉助理', async () => {
  await send('UserPromptSubmit', 'a', { ...fromDesktop, prompt: '第一句' });
  await send('PreToolUse', 'a', { ...fromDesktop, tool_name: 'Agent', tool_use_id: 't1', tool_input: { description: 'x' } });
  await send('SessionEnd', 'a', fromDesktop);
  const [e] = await employees();
  expect([e.sessionId, e.status, e.activity, e.assistants, e.firstPrompt]).toEqual(['a', 'idle', null, [], '第一句']);
});
test('Desktop：暫停再喚醒（同一個 id），資料都接得上', async () => {
  await send('UserPromptSubmit', 'a', { ...fromDesktop, prompt: '第一句' });
  await send('SessionEnd', 'a', fromDesktop);
  await send('SessionStart', 'a', fromDesktop);
  const [e] = await employees();
  expect([e.firstPrompt, e.lastPrompt, e.status]).toEqual(['第一句', '第一句', 'idle']);
});
test('Desktop：rewind fork 出新 id 仍是同一位，座位和內容不變', async () => {
  await send('UserPromptSubmit', 'a', { ...fromDesktop, prompt: '第一句', transcript_path: 'a.jsonl' });
  await send('SessionEnd', 'a', fromDesktop);
  await send('SessionStart', 'b', { ...fromDesktop, transcript_path: 'b.jsonl' });
  await send('UserPromptSubmit', 'b', { ...fromDesktop, prompt: '第二句' });
  const list = await employees();
  expect(list).toHaveLength(1);
  expect([list[0].sessionId, list[0].seat, list[0].firstPrompt, list[0].lastPrompt, list[0].transcriptPath]).toEqual(['a', 0, '第一句', '第二句', 'b.jsonl']);
});
test('Desktop：fork 後新 id 的 SessionEnd 也不會讓人下班', async () => {
  await send('SessionStart', 'a', fromDesktop);
  await send('SessionEnd', 'a', fromDesktop);
  await send('SessionStart', 'b', fromDesktop);
  await send('SessionEnd', 'b', fromDesktop);
  expect(await ids()).toEqual(['a']);
});
test('Desktop：沒收到 SessionEnd 時，新 id 先分開，等紀錄列出它才併回同一位', async () => {
  await send('UserPromptSubmit', 'a', { ...fromDesktop, prompt: '第一句' });
  await send('SessionStart', 'b', fromDesktop);
  expect(await ids()).toEqual(['a', 'b']);
  desktop[HOST] = alive(['b', 'a']);
  await send('UserPromptSubmit', 'b', { ...fromDesktop, prompt: '第二句' });
  const list = await employees();
  expect(list.map((e) => e.sessionId)).toEqual(['a']);
  expect([list[0].firstPrompt, list[0].lastPrompt]).toEqual(['第一句', '第二句']);
});
test('Desktop 裡開的 CLI 子行程：是獨立的員工，下班不影響主人', async () => {
  await send('UserPromptSubmit', 'a', { ...fromDesktop, prompt: '主人' });
  desktop[HOST] = alive(['a']);
  await send('UserPromptSubmit', 'child', { ...fromDesktop, prompt: '子行程' });
  expect(await ids()).toEqual(['a', 'child']);
  await send('SessionEnd', 'child', fromDesktop);
  const list = await employees();
  expect(list.map((e) => e.sessionId)).toEqual(['a']);
  expect([list[0].lastPrompt, list[0].status]).toEqual(['主人', 'working']);
});
test('子行程在主人 CLI 停掉後才結束：不會被併到主人身上', async () => {
  await send('SessionStart', 'a', fromDesktop);
  await send('SessionStart', 'child', fromDesktop);
  await send('SessionEnd', 'a', fromDesktop);
  await send('UserPromptSubmit', 'child', { ...fromDesktop, prompt: '子行程' });
  expect(await ids()).toEqual(['a', 'child']);
});
test('Desktop：超過 12 小時沒事件仍留著，紀錄封存或刪除才下班', async () => {
  await send('SessionStart', 'a', fromDesktop);
  desktop[HOST] = alive(['a']);
  clock = t + IDLE_TIMEOUT_MS + 1;
  app.sweepNow();
  expect(await ids()).toEqual(['a']);
  desktop[HOST] = { ended: true, title: '', cliIds: ['a'] };
  app.sweepNow();
  expect(await ids()).toEqual([]);
});
test('Desktop：紀錄讀不到時退回 12 小時逾時', async () => {
  await send('SessionStart', 'a', fromDesktop);
  app.sweepNow();
  expect(await ids()).toEqual(['a']);
  clock = t + IDLE_TIMEOUT_MS + 1;
  app.sweepNow();
  expect(await ids()).toEqual([]);
});
test('Desktop：名牌標題來自紀錄，巡檢和 Stop 都會更新', async () => {
  await send('SessionStart', 'a', fromDesktop);
  desktop[HOST] = alive(['a'], '修登入');
  app.sweepNow();
  expect((await employees())[0].title).toBe('修登入');
  desktop[HOST] = alive(['a'], '修登入流程');
  await send('Stop', 'a', fromDesktop);
  expect((await employees())[0].title).toBe('修登入流程');
});
test('Desktop：請他下班仍然有效', async () => {
  await send('SessionStart', 'a', fromDesktop);
  await fetch(base + '/employees/a/dismiss', { method: 'POST' });
  expect(await ids()).toEqual([]);
});
test('host_session_id 格式不對就當成純 CLI', async () => {
  await send('SessionStart', 'a', { host_session_id: '../../etc' });
  await send('SessionEnd', 'a', { host_session_id: '../../etc' });
  expect(await ids()).toEqual([]);
});

// ---- 純 CLI 完全照舊 ----
test('純 CLI：SessionEnd 立刻下班，再來的事件是重新登場', async () => {
  await send('UserPromptSubmit', 'a', { prompt: '第一句' });
  await send('SessionEnd', 'a');
  expect(await ids()).toEqual([]);
  await send('SessionStart', 'a');
  expect((await employees())[0].firstPrompt).toBe('');
});
test('純 CLI：不同 session_id 永遠是不同員工，就算有人剛下班', async () => {
  await send('SessionStart', 'a');
  await send('SessionEnd', 'a');
  await send('SessionStart', 'b');
  await send('SessionStart', 'c');
  expect(await ids()).toEqual(['b', 'c']);
});
test('純 CLI：12 小時逾時照舊，也不會去讀 Desktop 的紀錄', async () => {
  let reads = 0;
  const seen = createApp({ staticDir: tmp, now: () => clock, desktopSession: () => (reads++, null) });
  await new Promise<void>((r) => seen.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(seen.server.address() as AddressInfo).port}/events`;
  await fetch(url, { method: 'POST', body: JSON.stringify({ hook_event_name: 'Stop', session_id: 'a', cwd: 'x', sentAt: 1 }) });
  clock = IDLE_TIMEOUT_MS + 2;
  seen.sweepNow();
  const list = await (await fetch(url.replace('/events', '/state'))).json() as any;
  seen.server.closeAllConnections();
  await new Promise((r) => seen.server.close(r));
  expect(list.employees).toEqual([]);
  expect(reads).toBe(0);
});
test('純 CLI 不帶 Desktop 專用欄位，送給前端的資料不變', async () => {
  await send('SessionStart', 'a');
  const [e] = await employees();
  expect(e).not.toHaveProperty('hostSessionId');
  expect(e).not.toHaveProperty('cliEnded');
});
