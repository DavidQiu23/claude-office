import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { CONFIG_FILE } from '../config.js';
import { bindAgent, dismiss, setTitle, sweep } from '../state/maintenance.js';
import { reduce } from '../state/reduce.js';
import { isHostSessionId, readDesktopSession, type DesktopSession } from './desktop.js';
import { readAiTitle, readContinuedIn, readSubagentToolUseId } from './title.js';
import { emptyState, type Change, type HookEvent } from '../state/types.js';

/** file 預設是這台機器上設定檔的完整路徑（macOS／Linux 是 ~/.claude-office/config.json，Windows 是 %USERPROFILE%\.claude-office\config.json） */
export const portInUseMessage = (port: number, file: string = CONFIG_FILE()): string =>
  `port ${port} 已被占用，請在 ${file} 修改 port`;

const MAX_BODY = 1024 * 1024;
/** 同一個新 session_id 多久才再查一次 Desktop 的紀錄：查一次要掃好幾層資料夾，不能每個事件都同步做 */
export const DESKTOP_RECHECK_MS = 5_000;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function createApp(opts: { staticDir: string; now?: () => number; desktopSession?: (hostId: string) => DesktopSession | null }) {
  const now = opts.now ?? Date.now;
  const desktopSession = opts.desktopSession ?? readDesktopSession;
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

  // 接續的新 session_id → 原本那位員工的 id；同一段對話換了 id 仍是同一位員工（外觀、座位都不變）
  const aliases = new Map<string, string>();
  const checkedAt = new Map<string, number>(); // 新 session_id → 上次查 Desktop 紀錄的時間（子行程每個事件都會走到這裡）
  const scanned = new Set<string>(); // 整份 transcript 找過標題的員工；之後的標題一定寫在檔尾，只讀檔尾
  const recordLists = (host: string, id: string): boolean => {
    const last = checkedAt.get(id);
    if (last !== undefined && now() - last < DESKTOP_RECHECK_MS) return false;
    checkedAt.set(id, now());
    return !!desktopSession(host)?.cliIds.includes(id);
  };
  const desktopOwner = (host: string) => Object.values(state.employees).find((e) => e.hostSessionId === host);
  const continuedFrom = (id: string, cwd: unknown, host: string | undefined): string => {
    const known = aliases.get(id);
    if (known) return known;
    const owner = host ? desktopOwner(host) : undefined;
    if (owner && owner.sessionId !== id) {
      // 帶同一個 Desktop id 的新 session_id 可能是 rewind fork 出來的，也可能是 session 裡開的 CLI 子行程（環境變數會繼承）。
      // fork 一定在舊 CLI 停掉之後才出現；SessionEnd 沒送到時，等 Desktop 的紀錄列出它再併回來。
      const seen = Object.hasOwn(state.employees, id);
      if ((owner.cliEnded && !seen) || recordLists(host!, id)) {
        if (seen) apply(dismiss(state, id));
        checkedAt.delete(id);
        aliases.set(id, owner.sessionId);
        return owner.sessionId;
      }
    }
    if (Object.hasOwn(state.employees, id) || typeof cwd !== 'string') return id;
    const prev = Object.values(state.employees).find((e) => e.cwd === cwd && e.transcriptPath && readContinuedIn(e.transcriptPath) === id);
    if (!prev) return id;
    aliases.set(id, prev.sessionId);
    return prev.sessionId;
  };

  // Desktop 的 transcript 沒有 ai-title，標題要看 Desktop 自己的紀錄
  const refreshDesktopTitle = (id: string, host: string) => {
    const title = desktopSession(host)?.title;
    if (title) apply(setTitle(state, id, title));
  };

  // 前景助理的第一個內部事件才查 agentId；背景助理在 async_launched 就有了，都配對好的 session 不讀檔
  const bindForeground = (id: string, transcript: string | undefined, agentId: string | undefined) => {
    if (!transcript || !agentId || !Object.hasOwn(state.employees, id)) return;
    const list = state.employees[id].assistants;
    if (list.some((a) => a.agentId === agentId) || !list.some((a) => a.status === 'working' && !a.agentId)) return;
    const toolUseId = readSubagentToolUseId(transcript, agentId);
    if (toolUseId) apply(bindAgent(state, id, toolUseId, agentId));
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
      for (const k of ['cwd', 'transcript_path', 'prompt', 'tool_name', 'tool_use_id', 'notification_type', 'message', 'agent_id', 'host_session_id'])
        if (typeof ev[k] !== 'string') delete ev[k];
      if (!isHostSessionId(ev.host_session_id ?? '')) delete ev.host_session_id;
      if (typeof ev.hook_event_name !== 'string') ev.hook_event_name = '';
      if (typeof ev.tool_input !== 'object' || ev.tool_input === null || Array.isArray(ev.tool_input)) delete ev.tool_input;
      if (!Number.isFinite(ev.sentAt)) ev.sentAt = now();
      ev.session_id = continuedFrom(ev.session_id, ev.cwd, ev.host_session_id);
      const owner = ev.host_session_id ? desktopOwner(ev.host_session_id) : undefined;
      // CLI 子行程：當成一般 CLI 的員工。shortcut: 伺服器剛重啟、子行程比主人先送事件時會被當成主人，真的碰到再查紀錄的 cliSessionId
      if (owner && owner.sessionId !== ev.session_id) delete ev.host_session_id;
      bindForeground(ev.session_id, ev.transcript_path, ev.agent_id);
      const r = reduce(state, ev as HookEvent);
      apply(r);
      // 標題在第一輪回應後才會寫進 transcript；回合結束時背景讀取，不拖慢 hook 回應
      const emp = ev.hook_event_name === 'Stop' && !ev.agent_id ? r.state.employees[ev.session_id] : undefined;
      if (emp?.hostSessionId) refreshDesktopTitle(emp.sessionId, emp.hostSessionId);
      else if (emp?.transcriptPath) {
        const tailOnly = !!emp.title || scanned.has(emp.sessionId);
        scanned.add(emp.sessionId);
        void readAiTitle(emp.transcriptPath, tailOnly).then((t) => {
          if (t) apply(setTitle(state, emp.sessionId, t));
        });
      }
      return void res.writeHead(204).end();
    }
    const employees = () => Object.values(state.employees).sort((a, b) => a.seat - b.seat);
    if (method === 'GET' && path === '/state')
      return void res.writeHead(200, { 'Content-Type': TYPES['.json'] }).end(JSON.stringify({ employees: employees() }));
    if (method === 'GET' && path === '/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.flushHeaders();
      // 快照和加入 clients 在同一個 tick：之後的變化一定會送到，不會落在快照與串流之間
      res.write(`data: ${JSON.stringify({ type: 'reset', employees: employees() })}\n\n`);
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
    sweepNow: () => {
      const alive = new Set<string>();
      for (const e of Object.values(state.employees)) {
        if (!e.hostSessionId) continue;
        const record = desktopSession(e.hostSessionId);
        if (!record) continue; // 判斷不了就交給 12 小時逾時
        if (record.ended) {
          apply(dismiss(state, e.sessionId));
          continue;
        }
        alive.add(e.sessionId);
        if (record.title) apply(setTitle(state, e.sessionId, record.title));
      }
      apply(sweep(state, now(), alive));
      // 只留還在的員工相關的紀錄，長時間開著不會越積越多
      const here = (id: string) => Object.hasOwn(state.employees, id);
      for (const [id, to] of aliases) if (!here(to)) aliases.delete(id);
      for (const [id, at] of checkedAt) if (!here(id) && now() - at >= DESKTOP_RECHECK_MS) checkedAt.delete(id);
      for (const id of scanned) if (!here(id)) scanned.delete(id);
    },
    clientCount: () => clients.size,
  };
}
