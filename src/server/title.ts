import { open, stat } from 'node:fs/promises';

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

export async function readAiTitle(path: string): Promise<string> {
  if (!path.endsWith('.jsonl')) return '';
  try {
    const size = (await stat(path)).size;
    const fh = await open(path, 'r');
    try {
      for (const len of size > TAIL ? [TAIL, size] : [size]) {
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
