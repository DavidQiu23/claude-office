// 模擬多個專案、多個 session 對本機伺服器送事件（多樓層、擠滿的樓層、subagent、等待中、整層拆掉、加蓋新樓層）。用法：npx tsx scripts/simulate.ts [--loop]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const GAP_MS = 1500;
const url = `http://127.0.0.1:${loadConfig().port}/events`;
const loop = process.argv.includes('--loop');

// 名稱 = 專案名 + 座位序號（例如 crm0…crm8）；session id、資料夾、標題都由名稱產生
const sid = (n: string) => `${n}-sim`;
const project = (n: string) => n.replace(/\d+$/, '');
const LONG_FOLDER = 'customer-portal-redesign-app-2'; // 30 個字元的超長資料夾名
const CWD: Record<string, string> = {
  api: 'C:/work/api', blog: 'C:/work/blog', shop: 'C:/work/shop', docs: 'C:/work/docs',
  tools: `C:/work/${LONG_FOLDER}`, crm: 'C:/work/crm', mobile: 'C:/work/mobile',
};
// 假 transcript：只放 ai-title，Stop 之後伺服器會讀到並顯示在名牌上
const LONG_TITLE = '把登入流程整個重構成可以測試的小模組再補齊單元測試與整合測試並整理錯誤訊息格式化'; // 40 個中文字
const TITLES: Record<string, string> = {
  api0: LONG_TITLE, blog0: '部落格標題修正', shop0: '結帳頁面實作', shop1: '商品資料表整理',
  docs0: '安裝說明改寫', docs1: 'API 文件校對', tools0: '批次匯入腳本', mobile0: '行動版首頁',
};
if (LONG_TITLE.length !== 40 || LONG_FOLDER.length !== 30) throw new Error('超長標題／資料夾長度不符');
const titleOf = (n: string) => TITLES[n] ?? `${project(n).toUpperCase()} 任務 ${n.replace(/^\D+/, '')}`;
const tdir = mkdtempSync(join(tmpdir(), 'office-sim-'));
// 結束時（含 Ctrl+C / 被終止）刪除暫存資料夾
process.on('exit', () => rmSync(tdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
const transcript = (n: string) => {
  const p = join(tdir, `${sid(n)}.jsonl`);
  writeFileSync(p, JSON.stringify({ type: 'ai-title', aiTitle: titleOf(n), sessionId: sid(n) }) + '\n');
  return p;
};
const ev = (n: string, hook_event_name: string, extra: Record<string, unknown> = {}) => ({
  hook_event_name, session_id: sid(n), cwd: CWD[project(n)], transcript_path: transcript(n), ...extra,
});
const prompt = (n: string, p: string) => ev(n, 'UserPromptSubmit', { prompt: p });
const tool = (n: string, tool_name: string, tool_input: Record<string, unknown>) => ev(n, 'PreToolUse', { tool_name, tool_input });
const spawn = (n: string, id: string, description: string, subagent_type?: string) =>
  ev(n, 'PreToolUse', { tool_name: 'Task', tool_use_id: id, tool_input: { description, ...(subagent_type ? { subagent_type } : {}) } });
const done = (n: string, id: string) => ev(n, 'PostToolUse', { tool_name: 'Task', tool_use_id: id });

// 互不相干、可以連著送的事件（員工陸續走進來）用較短的間隔，其餘維持 GAP_MS
const quickSet = new WeakSet<object>();
const quick = <T extends object>(e: T): T => (quickSet.add(e), e);
const CRM = Array.from({ length: 9 }, (_, i) => `crm${i}`);

const script = [
  // --- 開場：api、blog、shop（同層兩人）---
  prompt('api0', '幫我重構登入流程，並補上單元測試'),
  prompt('blog0', '修正部落格文章的標題顯示錯誤'),
  tool('api0', 'Read', { file_path: 'src/login.ts' }),
  prompt('shop0', '實作購物車結帳頁面'),
  tool('blog0', 'Edit', { file_path: 'src/post.ts' }),
  prompt('shop1', '整理商店的商品資料表欄位'),
  ev('blog0', 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
  tool('shop0', 'Bash', { command: 'npm test' }),
  ev('blog0', 'PostToolUse', { tool_name: 'Bash' }), // 等你處理後恢復工作
  spawn('shop0', 'sim-t1', '搜尋舊的結帳程式碼'),
  spawn('shop0', 'sim-t2', '檢查 API 文件'),
  done('shop0', 'sim-t1'),
  tool('api0', 'Bash', { command: 'npm run lint' }),
  done('shop0', 'sim-t2'),
  prompt('api0', '好，繼續'),
  ev('api0', 'Stop'), // 超長標題在這之後出現
  tool('shop1', 'Grep', { pattern: 'products' }),
  ev('blog0', 'Stop'),
  ev('shop0', 'Stop'),
  ev('shop1', 'Stop'),

  // --- 更多樓層：docs（兩人）、tools（超長資料夾名）---
  prompt('docs0', '改寫安裝說明，補上常見問題'),
  prompt('docs1', '校對 API 文件的範例程式碼'),
  prompt('tools0', '寫一支批次匯入客戶資料的腳本'),

  // --- crm：一層擠滿 9 人（座位 0–8，要左右捲）---
  ...CRM.map((n, i) => quick(prompt(n, `處理客戶需求單第 ${i + 1} 批`))),
  tool('crm4', 'Edit', { file_path: 'src/crm/contact.ts' }),
  tool('crm5', 'Bash', { command: 'npm run build' }),
  tool('crm6', 'Grep', { pattern: 'customer' }),
  ev('crm1', 'Stop'),
  ev('crm2', 'Stop'),
  ev('crm3', 'Stop'),

  // --- crm0 一次派出 3 個 subagent（一個 Explore、一個沒有描述），陸續完成 ---
  quick(spawn('crm0', 'sim-c1', '盤點客戶資料表欄位', 'Explore')),
  quick(spawn('crm0', 'sim-c2', '')),
  spawn('crm0', 'sim-c3', '比對舊版匯出格式'), // quick 縮短的是「送出後」的等待：最後一個用正常間隔，三個助理才會一起工作 3 秒以上
  tool('crm0', 'Read', { file_path: 'docs/schema.md' }),
  done('crm0', 'sim-c2'),
  done('crm0', 'sim-c1'),
  done('crm0', 'sim-c3'),

  // --- 看不到的座位 8 等你處理、座位 7 輪到你 ---
  ev('crm8', 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
  ev('crm7', 'Stop'),
  tool('tools0', 'Bash', { command: 'node import.js' }),
  ev('api0', 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Edit' }),
  tool('crm4', 'Bash', { command: 'npm test' }),
  ev('crm0', 'Stop'),
  ev('docs0', 'Stop'),
  ev('docs1', 'Stop'),

  // --- docs 整層人都下班（樓層拆掉），之後新專案 mobile 在最上面加蓋 ---
  ev('docs0', 'SessionEnd'),
  ev('docs1', 'SessionEnd'),
  prompt('mobile0', '調整行動版首頁的版面'),
  tool('mobile0', 'Edit', { file_path: 'src/home.tsx' }),
  ev('mobile0', 'Stop'),

  // --- 全部下班（--loop 時重來）---
  ev('api0', 'SessionEnd'),
  ev('blog0', 'SessionEnd'),
  ev('shop0', 'SessionEnd'),
  ev('shop1', 'SessionEnd'),
  ev('tools0', 'SessionEnd'),
  ev('mobile0', 'SessionEnd'),
  ...CRM.map((n) => quick(ev(n, 'SessionEnd'))),
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
    await sleep(quickSet.has(e) ? Math.round(GAP_MS / 5) : GAP_MS);
  }
} while (loop);
