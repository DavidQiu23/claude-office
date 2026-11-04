import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface DesktopSession {
  ended: boolean;   // 已封存或已刪除
  title: string;
  cliIds: string[]; // 這個 Desktop session 目前和先前用過的 CLI session_id
}

const children = (dir: string): string[] => {
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch {
    return [];
  }
};

const defaultRoots = (): string[] => [
  // 只在 Windows 商店版實測過，其他路徑找不到時會退回 12 小時逾時
  ...children(join(process.env.LOCALAPPDATA ?? '', 'Claude-Data')).map((p) => join(p, 'claude-code-sessions')),
  join(process.env.APPDATA ?? '', 'Claude', 'claude-code-sessions'),
  join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions'),
  join(homedir(), '.config', 'Claude', 'claude-code-sessions'),
];

/**
 * Desktop 的 session 紀錄：<根>/<帳號>/<組織>/local_<id>.json，刪除後只留 deleted_<id>。
 * 這不是公開格式，所以判斷不了就回 null（不是當成結束），呼叫端退回 12 小時逾時。
 */
export function readDesktopSession(hostId: string, roots: string[] = defaultRoots()): DesktopSession | null {
  if (!/^local_[0-9a-zA-Z-]+$/.test(hostId)) return null; // id 來自 HTTP 請求，會拼進路徑
  for (const root of roots)
    for (const account of children(root))
      for (const org of children(account)) {
        const file = join(org, `${hostId}.json`);
        if (existsSync(file)) {
          try {
            const r = JSON.parse(readFileSync(file, 'utf8'));
            const prior: unknown[] = Array.isArray(r.priorCliSessionIds) ? r.priorCliSessionIds : [];
            return {
              ended: r.isArchived === true,
              title: typeof r.title === 'string' ? r.title : '',
              cliIds: [r.cliSessionId, ...prior].filter((x): x is string => typeof x === 'string'),
            };
          } catch {
            return null; // 可能正在寫入
          }
        }
        if (existsSync(join(org, `deleted_${hostId.slice('local_'.length)}`))) return { ended: true, title: '', cliIds: [] };
      }
  return null;
}
