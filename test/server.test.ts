import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeEach, expect, test } from 'vitest';
import { createApp, portInUseMessage } from '../src/server/app.js';
import { CONFIG_FILE } from '../src/config.js';

let app: ReturnType<typeof createApp>;
let base: string;
let clock = 1000;
const dir = mkdtempSync(join(tmpdir(), 'office-'));
writeFileSync(join(dir, 'index.html'), '<h1>hi</h1>');
writeFileSync(join(dir, 'a.js'), '1');

afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

beforeEach(async () => {
  clock = 1000;
  app = createApp({ staticDir: dir, now: () => clock });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  app.server.closeAllConnections();
  await new Promise((r) => app.server.close(r));
});

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const start = (id = 's1') =>
  post('/events', { hook_event_name: 'SessionStart', session_id: id, cwd: 'D:\\p\\api', sentAt: clock });
const employees = async () => ((await (await fetch(base + '/state')).json()) as any).employees;
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(cond()).toBe(true);
};

test('POST 事件後 GET /state 看得到員工', async () => {
  expect((await start()).status).toBe(204);
  const res = await fetch(base + '/state');
  expect(res.status).toBe(200);
  const list = (await res.json() as any).employees;
  expect(list).toHaveLength(1);
  expect(list[0].sessionId).toBe('s1');
});

/** 逐筆讀出 SSE 的 data 訊息 */
const sse = (res: Response) => {
  const reader = res.body!.getReader();
  let buf = '';
  return async () => {
    while (!buf.includes('\n\n')) buf += new TextDecoder().decode((await reader.read()).value);
    const i = buf.indexOf('\n\n');
    expect(buf.startsWith('data: ')).toBe(true);
    const msg = JSON.parse(buf.slice(6, i));
    buf = buf.slice(i + 2);
    return msg;
  };
};

test('SSE 第一筆是目前狀態的 reset 快照，之後收到 upsert', async () => {
  await start();
  const ac = new AbortController();
  const res = await fetch(base + '/stream', { signal: ac.signal });
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  expect(res.headers.get('cache-control')).toBe('no-cache');
  const next = sse(res);
  const first = await next();
  expect(first.type).toBe('reset');
  expect(first.employees.map((e: any) => e.sessionId)).toEqual(['s1']);
  await post('/events', { hook_event_name: 'Stop', session_id: 's1', sentAt: clock + 1 });
  expect((await next()).type).toBe('upsert');
  ac.abort();
});

test('壞掉的 JSON 回 400，伺服器仍可用', async () => {
  expect((await post('/events', '{oops')).status).toBe(400);
  expect((await post('/events', '[1]')).status).toBe(400);
  expect((await post('/events', 'null')).status).toBe(400);
  expect((await fetch(base + '/state')).status).toBe(200);
});

test('過大的 body 回 413', async () => {
  expect((await post('/events', 'x'.repeat(1024 * 1024 + 1))).status).toBe(413);
  expect((await fetch(base + '/state')).status).toBe(200);
});

test('缺少 sentAt 時以 now() 補上', async () => {
  clock = 5000;
  await post('/events', { hook_event_name: 'SessionStart', session_id: 's1', cwd: 'D:\\p\\api' });
  expect((await employees())[0].lastEventAt).toBe(5000);
});

test('dismiss 後員工消失並推送 leave', async () => {
  await start();
  const ac = new AbortController();
  const res = await fetch(base + '/stream', { signal: ac.signal });
  const next = sse(res);
  expect((await next()).type).toBe('reset');
  expect((await post('/employees/s1/dismiss', '')).status).toBe(204);
  expect(await employees()).toHaveLength(0);
  expect(await next()).toEqual({ type: 'leave', sessionId: 's1' });
  ac.abort();
  expect((await post('/employees/toString/dismiss', '')).status).toBe(204);
});

test('SSE 斷線後 clientCount 歸零，之後 POST 不出錯', async () => {
  const ac = new AbortController();
  await fetch(base + '/stream', { signal: ac.signal });
  await until(() => app.clientCount() === 1);
  ac.abort();
  await until(() => app.clientCount() === 0);
  expect((await start()).status).toBe(204);
});

test('靜態檔案無法用 .. 跳出 staticDir', async () => {
  const get = (p: string) =>
    new Promise<number>((resolve, reject) => {
      // fetch 會正規化 ..，改用原始 http 送出
      import('node:http').then(({ request }) => {
        const u = new URL(base);
        request({ host: u.hostname, port: u.port, path: p }, (r) => (r.resume(), resolve(r.statusCode!))).on('error', reject).end();
      });
    });
  expect(await get('/../package.json')).toBe(404);
  expect(await get('/%2e%2e/package.json')).toBe(404);
  expect(await get('/..%5cpackage.json')).toBe(404);
  const ok = await fetch(base + '/');
  expect(ok.status).toBe(200);
  expect(ok.headers.get('content-type')).toContain('text/html');
  expect((await fetch(base + '/a.js')).headers.get('content-type')).toContain('javascript');
  expect((await fetch(base + '/nope.png')).status).toBe(404);
});

test('sweepNow 移除逾時員工', async () => {
  await start();
  clock += 12 * 60 * 60 * 1000 + 1;
  app.sweepNow();
  expect(await employees()).toHaveLength(0);
});

test('portInUseMessage 寫出實際 port 與這台機器上設定檔的完整路徑', () => {
  expect(portInUseMessage(1234, '/home/me/.claude-office/config.json')).toBe(
    'port 1234 已被占用，請在 /home/me/.claude-office/config.json 修改 port',
  );
  expect(portInUseMessage(1234)).toBe(`port 1234 已被占用，請在 ${CONFIG_FILE()} 修改 port`);
  expect(CONFIG_FILE('/home/me')).toBe(join('/home/me', '.claude-office', 'config.json'));
});

test.each([
  ['toString', 204],
  ['__proto__', 204],
  [123, 400],
  ['', 400],
  [undefined, 400],
])('session_id %j 回 %i 而非 500', async (sid, status) => {
  const r = await post('/events', { hook_event_name: 'SessionStart', session_id: sid, sentAt: 1 });
  expect(r.status).toBe(status);
  expect((await fetch(base + '/state')).status).toBe(200);
});

test('cwd 為數字、tool_input 為字串時不會 500', async () => {
  expect((await post('/events', { hook_event_name: 'SessionStart', session_id: 'a', cwd: 5, sentAt: 1 })).status).toBe(204);
  const r = await post('/events', { hook_event_name: 'PreToolUse', session_id: 'a', tool_name: 'Bash', tool_input: 'x', sentAt: 2 });
  expect(r.status).toBe(204);
  expect((await employees())[0].folder).toBe('(未知)');
});

test('超過 1MB 後伺服器切斷連線，用戶端無法繼續塞資料', async () => {
  const { request } = await import('node:http');
  const u = new URL(base);
  const TOTAL = 10 * 1024 * 1024;
  const chunk = Buffer.alloc(64 * 1024, 'x');
  const req = request({ host: u.hostname, port: u.port, path: '/events', method: 'POST' }); // 無 Content-Length → chunked
  let closed = false;
  req.on('error', () => {});
  req.on('close', () => (closed = true));
  let written = 0;
  while (written < TOTAL && !closed) {
    written += chunk.length;
    if (!req.write(chunk))
      await new Promise<void>((r) => {
        const done = () => (req.off('drain', done), req.off('close', done), r());
        req.on('drain', done);
        req.on('close', done);
      });
  }
  req.destroy();
  expect(closed).toBe(true);
  expect(written).toBeLessThan(TOTAL);
  expect((await fetch(base + '/state')).status).toBe(200);
});

const raw = (method: string, path: string, headers: Record<string, string>, body = '') =>
  new Promise<number>((done, fail) => {
    const req = http.request(base + path, { method, headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      res.resume();
      done(res.statusCode ?? 0);
    });
    req.on('error', fail);
    req.end(body);
  });
const port = () => (app.server.address() as AddressInfo).port;
const evBody = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'x', sentAt: 1 });

test('Host 不是 127.0.0.1 / localhost 回 403', async () => {
  expect(await raw('GET', '/state', { Host: `evil.example:${port()}` })).toBe(403);
  expect(await raw('GET', '/state', { Host: `localhost:${port()}` })).toBe(200);
});
test('外來 Origin 的 POST 被擋，沒建立員工；同源與無 Origin 照常', async () => {
  const h = { Host: `127.0.0.1:${port()}` };
  expect(await raw('POST', '/events', { ...h, Origin: 'http://evil.example', 'Content-Type': 'text/plain' }, evBody)).toBe(403);
  expect(await employees()).toHaveLength(0);
  expect(await raw('POST', '/events', { ...h, Origin: `http://127.0.0.1:${port()}` }, evBody)).toBe(204);
  expect(await raw('POST', '/events', h, evBody.replace('"x"', '"y"'))).toBe(204);
  expect(await employees()).toHaveLength(2);
});
test('Stop 之後從 transcript 讀到標題並更新員工', async () => {
  const tp = join(dir, 'tr.jsonl');
  writeFileSync(tp, JSON.stringify({ type: 'ai-title', aiTitle: '修登入' }) + '\n');
  await post('/events', { hook_event_name: 'SessionStart', session_id: 's1', cwd: 'D:\\p\\api', transcript_path: tp, sentAt: clock });
  await post('/events', { hook_event_name: 'Stop', session_id: 's1', sentAt: clock + 1 });
  for (let i = 0; i < 100; i++) {
    if ((await employees())[0].title) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  expect((await employees())[0].title).toBe('修登入');
});
test('閒置後接續到新 session_id 時沿用原本的員工', async () => {
  const tp = join(dir, 'old.jsonl');
  writeFileSync(tp, JSON.stringify({ type: 'user' }) + '\n');
  await post('/events', { hook_event_name: 'UserPromptSubmit', session_id: 'old', cwd: 'D:\p\api', transcript_path: tp, prompt: '第一句', sentAt: clock });
  await start('other'); // 同資料夾的另一位不受影響
  writeFileSync(tp, JSON.stringify({ type: 'continued-in', sessionId: 'old', continuedInSessionId: 'new' }) + '\n', { flag: 'a' });
  const np = join(dir, 'new.jsonl');
  await post('/events', { hook_event_name: 'UserPromptSubmit', session_id: 'new', cwd: 'D:\p\api', transcript_path: np, prompt: '第二句', sentAt: clock + 1 });
  let list = await employees();
  expect(list.map((e: any) => e.sessionId).sort()).toEqual(['old', 'other']);
  const emp = list.find((e: any) => e.sessionId === 'old');
  expect([emp.firstPrompt, emp.lastPrompt, emp.transcriptPath]).toEqual(['第一句', '第二句', np]);
  await post('/events', { hook_event_name: 'SessionEnd', session_id: 'new', sentAt: clock + 2 });
  list = await employees();
  expect(list.map((e: any) => e.sessionId)).toEqual(['other']);
});
