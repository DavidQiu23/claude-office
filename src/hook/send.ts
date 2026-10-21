// Hook 回報腳本。本 task 只有錄製模式：--record=<資料夾>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
  }
} catch {}
process.exit(0);
