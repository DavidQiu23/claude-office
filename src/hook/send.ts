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
      await fetch(`http://127.0.0.1:${loadConfig().port}/events`, {
        method: 'POST',
        body: JSON.stringify({ ...event, sentAt: Date.now() }),
        signal: AbortSignal.timeout(300),
      });
    }
  }
} catch {}
process.exit(0);
