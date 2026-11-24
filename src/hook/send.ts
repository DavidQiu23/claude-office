// Hook 回報腳本。--record=<資料夾> 為錄製模式；否則 POST 到本機伺服器。
// 啟動要快（多個 session 同時觸發），所以只 import 輕量模組，且任何錯誤都靜默、一律 exit 0。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config.js';

try {
  const dir = process.argv.find((a) => a.startsWith('--record='))?.slice('--record='.length);
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks);
  if (dir) {
    let name = 'unknown';
    try { name = String(JSON.parse(raw.toString('utf8')).hook_event_name ?? name); } catch {}
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${Date.now()}-${name}.json`), raw);
  } else {
    const event = JSON.parse(raw.toString('utf8'));
    if (event && typeof event === 'object') {
      // 工具結果可能很大（圖片、整個檔案），超過伺服器上限整個事件會被丟掉；只留配對助理要用的欄位
      const r = event.tool_response;
      if (r && typeof r === 'object') event.tool_response = { status: r.status, agentId: r.agentId, resumedAgentId: r.resumedAgentId };
      else delete event.tool_response;
      if (Array.isArray(event.tool_calls)) event.tool_calls = event.tool_calls.map((c: { tool_name?: string } | null) => ({ tool_name: c?.tool_name }));
      const host = process.env.CLAUDE_CODE_HOST_SESSION_ID; // Desktop 的 session id，rewind 換 session_id 時也不變
      await fetch(`http://127.0.0.1:${loadConfig().port}/events`, {
        method: 'POST',
        body: JSON.stringify({ ...event, sentAt: Date.now(), ...(host ? { host_session_id: host } : {}) }),
        signal: AbortSignal.timeout(300),
      });
    }
  }
} catch {}
process.exit(0);
