import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { readAiTitle } from '../src/server/title.js';
import { setTitle } from '../src/state/maintenance.js';
import { reduce } from '../src/state/reduce.js';
import { emptyState } from '../src/state/types.js';

const dir = mkdtempSync(join(tmpdir(), 'title-'));
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
const rec = (o: object) => JSON.stringify(o) + '\n';
const write = (name: string, body: string) => (writeFileSync(join(dir, name), body), join(dir, name));

test('readAiTitle 取最後一筆 ai-title', async () => {
  const p = write('a.jsonl', rec({ type: 'ai-title', aiTitle: '舊標題' }) + rec({ type: 'user' }) + rec({ type: 'ai-title', aiTitle: '新標題' }));
  expect(await readAiTitle(p)).toBe('新標題');
});

test('readAiTitle 標題在檔尾視窗之外也找得到', async () => {
  const filler = rec({ type: 'user', text: 'x'.repeat(1000) }).repeat(700);
  const p = write('big.jsonl', rec({ type: 'ai-title', aiTitle: '很早的標題' }) + filler);
  expect(await readAiTitle(p)).toBe('很早的標題');
});

test('readAiTitle：沒有標題、檔案不存在、非 jsonl 都回空字串', async () => {
  expect(await readAiTitle(write('none.jsonl', rec({ type: 'user' })))).toBe('');
  expect(await readAiTitle(join(dir, 'missing.jsonl'))).toBe('');
  expect(await readAiTitle(write('x.txt', rec({ type: 'ai-title', aiTitle: 'x' })))).toBe('');
});

test('setTitle 更新員工；沒變或查無此人不產生 change', () => {
  const { state } = reduce(emptyState(), { hook_event_name: 'SessionStart', session_id: 's1', cwd: '/p', sentAt: 1 });
  const r = setTitle(state, 's1', '標題');
  expect(r.state.employees.s1.title).toBe('標題');
  expect(r.changes).toHaveLength(1);
  expect(setTitle(r.state, 's1', '標題').changes).toEqual([]);
  expect(setTitle(r.state, 'nobody', 'x').changes).toEqual([]);
});

test('readAiTitle 已有標題時只讀檔尾：標題在檔尾視窗之外就回空字串（呼叫端保留原標題）', async () => {
  const filler = rec({ type: 'user', text: 'x'.repeat(1000) }).repeat(700);
  const p = write('big2.jsonl', rec({ type: 'ai-title', aiTitle: '很早的標題' }) + filler);
  expect(await readAiTitle(p, true)).toBe('');
});
