import { open, stat } from 'node:fs/promises';
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

const TAIL = 512 * 1024;
const MARK = '"type":"ai-title"';

// transcript 是 JSONL；ai-title 會隨對話更新，所以取最後一筆。先只讀檔尾，找不到才讀整檔。
const lastTitle = (text: string): string => {
  let i = text.lastIndexOf(MARK);
  while (i >= 0) {
    const start = text.lastIndexOf('\n', i) + 1;
    const end = text.indexOf('\n', i);
    try {
      const rec = JSON.parse(text.slice(start, end < 0 ? undefined : end));
      if (rec.type === 'ai-title' && typeof rec.aiTitle === 'string') return rec.aiTitle;
    } catch {} // 檔尾切到一半的行
    i = text.lastIndexOf(MARK, i - 1);
  }
  return '';
};

/** tailOnly：已經有標題時只讀檔尾，長 transcript 不必每回合整檔讀；找不到就回空字串（呼叫端保留原標題） */
export async function readAiTitle(path: string, tailOnly = false): Promise<string> {
  if (!path.endsWith('.jsonl')) return '';
  try {
    const size = (await stat(path)).size;
    const fh = await open(path, 'r');
    try {
      for (const len of size <= TAIL ? [size] : tailOnly ? [TAIL] : [TAIL, size]) {
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, size - len);
        const t = lastTitle(buf.toString('utf8'));
        if (t) return t;
      }
    } finally {
      await fh.close();
    }
  } catch {} // 檔案不存在或讀不到：沒有標題而已
  return '';
}

// Claude Code 閒置一陣子後會把對話接到新的 session_id，並在舊 transcript 最後寫一筆 continued-in。
// 只在新 session 第一個事件時讀一次，且這筆在檔尾，所以同步讀最後一小段即可。
const CONT_TAIL = 64 * 1024;
export function readContinuedIn(path: string): string {
  if (!path.endsWith('.jsonl')) return '';
  try {
    const fd = openSync(path, 'r');
    try {
      const size = fstatSync(fd).size;
      const len = Math.min(size, CONT_TAIL);
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, size - len);
      for (const line of buf.toString('utf8').split('\n').reverse()) {
        if (!line.includes('"continued-in"')) continue;
        try {
          const rec = JSON.parse(line);
          if (rec.type === 'continued-in' && typeof rec.continuedInSessionId === 'string') return rec.continuedInSessionId;
        } catch {} // 檔尾視窗切到一半的行
      }
    } finally {
      closeSync(fd);
    }
  } catch {}
  return '';
}
