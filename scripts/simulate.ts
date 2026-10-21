// 模擬 4 個 session 對本機伺服器送事件。用法：npx tsx scripts/simulate.ts [--loop]
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const GAP_MS = 1500;
const url = `http://127.0.0.1:${loadConfig().port}/events`;
const loop = process.argv.includes('--loop');

const SIDS: Record<string, string> = { a: '3f9a-sim-a', b: 'b27c-sim-b', c: '91de-sim-c', d: 'c4a0-sim-d' };
const sid = (n: string) => SIDS[n];
const CWD: Record<string, string> = { a: 'C:/work/api', b: 'C:/work/blog', c: 'C:/work/shop', d: 'C:/work/shop' };
// 假 transcript：只放 ai-title，Stop 之後伺服器會讀到並顯示在名牌上
const TITLES: Record<string, string> = { a: '登入流程重構', b: '部落格標題修正', c: '結帳頁面實作', d: '商品資料表整理' };
const tdir = mkdtempSync(join(tmpdir(), 'office-sim-'));
const transcript = (n: string) => {
  const p = join(tdir, `${sid(n)}.jsonl`);
  writeFileSync(p, JSON.stringify({ type: 'ai-title', aiTitle: TITLES[n], sessionId: sid(n) }) + '\n');
  return p;
};
const ev = (n: string, hook_event_name: string, extra: Record<string, unknown> = {}) => ({
  hook_event_name, session_id: sid(n), cwd: CWD[n], transcript_path: transcript(n), ...extra,
});
const prompt = (n: string, p: string) => ev(n, 'UserPromptSubmit', { prompt: p });
const tool = (n: string, tool_name: string, tool_input: Record<string, unknown>) => ev(n, 'PreToolUse', { tool_name, tool_input });
const spawn = (n: string, id: string, description: string) =>
  ev(n, 'PreToolUse', { tool_name: 'Task', tool_use_id: id, tool_input: { description } });
const done = (n: string, id: string) => ev(n, 'PostToolUse', { tool_name: 'Task', tool_use_id: id });

const script = [
  prompt('a', '幫我重構登入流程，並補上單元測試'),
  prompt('b', '修正部落格文章的標題顯示錯誤'),
  tool('a', 'Read', { file_path: 'src/login.ts' }),
  prompt('c', '實作購物車結帳頁面'),
  tool('b', 'Edit', { file_path: 'src/post.ts' }),
  prompt('d', '整理商店的商品資料表欄位'),
  ev('b', 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
  tool('c', 'Bash', { command: 'npm test' }),
  ev('b', 'PostToolUse', { tool_name: 'Bash' }), // 等你處理後恢復工作
  spawn('c', 'sim-t1', '搜尋舊的結帳程式碼'),
  spawn('c', 'sim-t2', '檢查 API 文件'),
  done('c', 'sim-t1'),
  tool('a', 'Bash', { command: 'npm run lint' }),
  done('c', 'sim-t2'),
  prompt('a', '好，繼續'),
  ev('a', 'Stop'),
  tool('d', 'Grep', { pattern: 'products' }),
  ev('b', 'Stop'),
  ev('c', 'Stop'),
  ev('d', 'Stop'),
  ev('b', 'SessionEnd'),
  ev('a', 'SessionEnd'),
  ev('c', 'SessionEnd'),
  ev('d', 'SessionEnd'),
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(e: object): Promise<void> {
  try {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify({ ...e, sentAt: Date.now() }) });
    if (!r.ok) console.error(`伺服器回應 ${r.status}`);
  } catch {
    console.error('送不出事件。伺服器沒開？請先 npm start');
    process.exit(1);
  }
}

do {
  for (const e of script) {
    console.log((e as { session_id: string }).session_id, (e as { hook_event_name: string }).hook_event_name);
    await send(e);
    await sleep(GAP_MS);
  }
} while (loop);
