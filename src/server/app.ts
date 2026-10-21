import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { dismiss, setTitle, sweep } from '../state/maintenance.js';
import { reduce } from '../state/reduce.js';
import { readAiTitle } from './title.js';
import { emptyState, type Change, type HookEvent } from '../state/types.js';

export const portInUseMessage = (port: number): string =>
  `port ${port} 已被占用，請在 %USERPROFILE%\\.claude-office\\config.json 修改 port`;

const MAX_BODY = 1024 * 1024;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function createApp(opts: { staticDir: string; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const root = resolve(opts.staticDir);
  let state = emptyState();
  const clients = new Set<http.ServerResponse>();

  const apply = (r: { state: typeof state; changes: Change[] }) => {
    state = r.state;
    for (const c of r.changes)
      for (const res of clients) {
        try {
          res.write(`data: ${JSON.stringify(c)}\n\n`);
        } catch {} // 死掉的用戶端不可拖垮其他人或 sweep 計時器
      }
  };

  const readBody = (req: http.IncomingMessage) =>
    new Promise<string | null>((done, fail) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) {
          chunks.length = 0;
          done(null);
          req.pause(); // 停止讀取；呼叫端回 413 後關閉連線
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
      req.on('error', fail);
      req.on('close', () => done(null)); // 上傳中斷時不要懸著（已 resolve 則無作用）
    });

  const serveStatic = async (urlPath: string, res: http.ServerResponse) => {
    try {
      const rel = decodeURIComponent(urlPath) === '/' ? 'index.html' : decodeURIComponent(urlPath);
      const file = resolve(join(root, rel));
      if (!file.startsWith(root + sep)) throw new Error('outside');
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end();
    }
  };

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0];
    const method = req.method;

    // 本機安全：擋 DNS rebinding（Host）與跨站 POST（Origin）；hook 的 fetch 不帶 Origin
    const host = req.headers.host ?? '';
    const hostname = host.replace(/:\d*$/, '');
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') return void res.writeHead(403).end();
    const origin = req.headers.origin;
    if (method === 'POST' && origin !== undefined && origin !== `http://${host}`) return void res.writeHead(403).end();

    if (method === 'POST' && path === '/events') {
      const raw = await readBody(req);
      if (raw === null) {
        res.writeHead(413, { Connection: 'close' }).end(() => req.destroy());
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {}
      if (typeof body !== 'object' || body === null || Array.isArray(body)) return void res.writeHead(400).end();
      const ev = body as Record<string, any>;
      if (typeof ev.session_id !== 'string' || !ev.session_id) return void res.writeHead(400).end();
      // 型別不符的欄位視為不存在，避免 reduce 內部丟錯
      for (const k of ['cwd', 'transcript_path', 'prompt', 'tool_name', 'tool_use_id', 'notification_type', 'message', 'agent_id', 'agent_type'])
        if (typeof ev[k] !== 'string') delete ev[k];
      if (typeof ev.hook_event_name !== 'string') ev.hook_event_name = '';
      if (typeof ev.tool_input !== 'object' || ev.tool_input === null || Array.isArray(ev.tool_input)) delete ev.tool_input;
      if (!Number.isFinite(ev.sentAt)) ev.sentAt = now();
      const r = reduce(state, ev as HookEvent);
      apply(r);
      // 標題在第一輪回應後才會寫進 transcript；回合結束時背景讀取，不拖慢 hook 回應
      const emp = ev.hook_event_name === 'Stop' && !ev.agent_id ? r.state.employees[ev.session_id] : undefined;
      if (emp?.transcriptPath)
        void readAiTitle(emp.transcriptPath).then((t) => {
          if (t) apply(setTitle(state, emp.sessionId, t));
        });
      return void res.writeHead(204).end();
    }
    if (method === 'GET' && path === '/state') {
      const employees = Object.values(state.employees).sort((a, b) => a.seat - b.seat);
      return void res.writeHead(200, { 'Content-Type': TYPES['.json'] }).end(JSON.stringify({ employees }));
    }
    if (method === 'GET' && path === '/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.flushHeaders();
      clients.add(res);
      return void res.on('close', () => clients.delete(res));
    }
    const m = method === 'POST' && path.match(/^\/employees\/([^/]+)\/dismiss$/);
    if (m) {
      let id: string;
      try {
        id = decodeURIComponent(m[1]);
      } catch {
        return void res.writeHead(400).end();
      }
      apply(dismiss(state, id));
      return void res.writeHead(204).end();
    }
    if (method === 'GET') return serveStatic(path, res);
    res.writeHead(404).end();
  };

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  return {
    server,
    sweepNow: () => apply(sweep(state, now())),
    clientCount: () => clients.size,
  };
}
