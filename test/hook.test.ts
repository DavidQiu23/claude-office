import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, type AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { createApp } from '../src/server/app.js';

const script = resolve('dist/hook/send.js');

function homeWithPort(port: number): string {
  const home = mkdtempSync(join(tmpdir(), 'hook-home-'));
  mkdirSync(join(home, '.claude-office'));
  writeFileSync(join(home, '.claude-office', 'config.json'), JSON.stringify({ port }));
  return home;
}
// 必須用非同步 spawn：同步版會卡住同一行程內的測試伺服器
const run = (home: string, input: string, args: string[] = []) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((res) => {
    const p = spawn(process.execPath, [script, ...args], { env: { ...process.env, USERPROFILE: home, HOME: home } });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (status) => res({ status, stdout, stderr }));
    p.stdin.end(input);
  });

test('伺服器沒開時 500 ms 內以結束碼 0 結束且沒有輸出', async () => {
  const home = homeWithPort(1); // port 1 沒人聽
  const t = Date.now();
  const r = await run(home, JSON.stringify({ hook_event_name: 'Stop', session_id: 's' }));
  expect(r.status).toBe(0);
  expect(r.stdout).toBe('');
  expect(r.stderr).toBe('');
  expect(Date.now() - t).toBeLessThan(500 + 300); // 500 ms 加上 node 啟動的寬限
});

test('stdin 不是 JSON 時以結束碼 0 結束且不送出請求', async () => {
  let hits = 0;
  const srv = createServer((s) => (hits++, s.destroy()));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const home = homeWithPort((srv.address() as AddressInfo).port);
    for (const input of ['not json', '']) {
      const r = await run(home, input);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('');
    }
    expect(hits).toBe(0);
  } finally {
    srv.close();
  }
});

test('伺服器接受連線卻不回應時，300 ms 逾時後仍以 0 結束', async () => {
  const sockets: import('node:net').Socket[] = [];
  const srv = createServer((s) => sockets.push(s));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const t = Date.now();
    const r = await run(homeWithPort((srv.address() as AddressInfo).port), JSON.stringify({ hook_event_name: 'Stop', session_id: 's' }));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(sockets.length).toBe(1); // 確實連上了
    expect(Date.now() - t).toBeLessThan(2000);
  } finally {
    sockets.forEach((s) => s.destroy());
    srv.close();
  }
});

test('伺服器開著時事件送達並帶有 sentAt', async () => {
  // server 的備援時間固定為 0；若員工時間戳不是 0，代表 sentAt 是 hook 帶的
  const app = createApp({ staticDir: tmpdir(), now: () => 0 });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const port = (app.server.address() as AddressInfo).port;
    const before = Date.now();
    const r = await run(homeWithPort(port), JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'sx', cwd: 'D:\\p\\api' }));
    expect(r.status).toBe(0);
    const { employees } = (await (await fetch(`http://127.0.0.1:${port}/state`)).json()) as any;
    expect(employees).toHaveLength(1);
    expect(employees[0].sessionId).toBe('sx');
    expect(employees[0].arrivedAt).toBeGreaterThanOrEqual(before);
  } finally {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
  }
});

test('--record 模式仍寫出錄製檔', async () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'rec-')), 'out');
  const r = await run(homeWithPort(1), JSON.stringify({ hook_event_name: 'Stop' }), [`--record=${dir}`]);
  expect(r.status).toBe(0);
  const files = readdirSync(dir);
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/-Stop\.json$/);
  expect(JSON.parse(readFileSync(join(dir, files[0]), 'utf8')).hook_event_name).toBe('Stop');
});
