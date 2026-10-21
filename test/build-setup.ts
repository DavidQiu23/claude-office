// vitest globalSetup：測試前編譯一次 TS，讓 hook / installer 測試跑最新的 dist（只跑 tsc，不跑 vite）
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function setup(): void {
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { stdio: 'pipe' });
}
