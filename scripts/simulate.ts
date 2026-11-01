// 模擬幾個 session 對本機伺服器送事件，一段一段演出畫面上的情境（最多 3 層、5 個人）；一輪約 28 秒，每段開頭在終端機印出情境標題。用法：npx tsx scripts/simulate.ts [--loop]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const GAP_MS = 600; // 事件之間的預設間隔
const url = `http://127.0.0.1:${loadConfig().port}/events`;
const loop = process.argv.includes('--loop');

// 名稱 = 專案名 + 序號（例如 api0、api1）；session id、資料夾、標題都由名稱產生
const sid = (n: string) => `${n}-sim`;
const project = (n: string) => n.replace(/\d+$/, '');
const CWD: Record<string, string> = { api: '/work/api', web: '/work/web', docs: '/work/docs' };
// 假 transcript：只放 ai-title，Stop 之後伺服器會讀到並顯示在名牌上
const LONG_TITLE = '把登入流程整個重構成可以測試的小模組再補齊單元測試與整合測試並整理錯誤訊息格式化'; // 太長，名牌會截成「…」
const TITLES: Record<string, string> = { api0: '訂單 API 加分頁', api1: LONG_TITLE, web0: '首頁改版', web1: '首頁改版（新對話）', docs0: '安裝說明改寫' };
const tdir = mkdtempSync(join(tmpdir(), 'office-sim-'));
// 結束時（含 Ctrl+C / 被終止）刪除暫存資料夾
process.on('exit', () => rmSync(tdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
const transcript = (n: string) => {
  const p = join(tdir, `${sid(n)}.jsonl`);
  writeFileSync(p, JSON.stringify({ type: 'ai-title', aiTitle: TITLES[n], sessionId: sid(n) }) + '\n');
  return p;
};
const ev = (n: string, hook_event_name: string, extra: Record<string, unknown> = {}) => ({
  hook_event_name, session_id: sid(n), cwd: CWD[project(n)], transcript_path: transcript(n), ...extra,
});
const prompt = (n: string, p: string) => ev(n, 'UserPromptSubmit', { prompt: p });
const ask = (n: string) => ev(n, 'PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'npm test' } });
const spawn = (n: string, id: string, description: string, subagent_type?: string) =>
  ev(n, 'PreToolUse', { tool_name: 'Agent', tool_use_id: id, tool_input: { description, ...(subagent_type ? { subagent_type } : {}) } });
const done = (n: string, id: string) => ev(n, 'PostToolUse', { tool_name: 'Agent', tool_use_id: id });
const end = (n: string) => ev(n, 'SessionEnd');

// 字串 = 情境標題（印出來）；數字 = 多等幾毫秒；物件 = 送出事件，之後等 GAP_MS
const script: (string | number | object)[] = [
  '登場與三種狀態：api0 工作中、api1 輪到你（名牌太長）、web0 等你處理',
  prompt('api0', '幫訂單 API 加上分頁'),
  ev('api1', 'Stop'),
  ev('web0', 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
  1500,

  '狀態切換：api0 工作中 → 等你批准 → 回到工作中 → 輪到你',
  ask('api0'), 1200,
  ev('api0', 'PostToolUse', { tool_name: 'Bash' }), 800,
  ev('api0', 'Stop'), 1200,

  '助理：web0 派出兩位（名牌旁 ↳2），陸續完成',
  prompt('web0', '把首頁拆成元件'),
  spawn('web0', 'sim-a1', '盤點首頁用到的元件', 'Explore'),
  spawn('web0', 'sim-a2', ''), 2500,
  done('web0', 'sim-a2'), 800,
  done('web0', 'sim-a1'), 800,

  '加蓋與拆樓：docs0 上班（最上面多一層），之後下班（退場完那層拆掉）',
  prompt('docs0', '改寫安裝說明'), 2000,
  end('docs0'), 1500,

  '退場中又回來：api1 下班，0.2 秒後又有新事件（留在座位）',
  end('api1'), -400,
  prompt('api1', '等等，還有一件事'), 1500,

  '交班：web0 下班，同資料夾的新 session web1 坐上同一個座位',
  end('web0'), -500,
  prompt('web1', '接著做首頁'), 1500,

  '全部下班（--loop 時重來）',
  end('api0'), -400,
  end('api1'), -400,
  end('web1'), 2000,
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
  let wait = 0; // 下一個事件送出前要等多久：每送一個事件重設成 GAP_MS，數字加上去（負數 = 提早送）
  for (const s of script) {
    if (typeof s === 'string') console.log(`\n▶ ${s}`);
    else if (typeof s === 'number') wait += s;
    else {
      await sleep(Math.max(0, wait));
      console.log('  ', (s as { session_id: string }).session_id, (s as { hook_event_name: string }).hook_event_name);
      await send(s);
      wait = GAP_MS;
    }
  }
  await sleep(Math.max(0, wait));
} while (loop);
