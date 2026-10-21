import type { Employee } from '../../src/state/types.js';
import { truncate } from '../../src/state/describe.js';

export const DESK_W = 108;
export const DESK_H = 120;
const ORIGIN = { x: 56, y: 160 };
const PER_ROW = 4;

// 簡單讀法：每排 4 桌，「每 2 排一組」僅是視覺分組，不額外加間距
export const seatPosition = (seat: number): { x: number; y: number } => ({
  x: ORIGIN.x + (seat % PER_ROW) * DESK_W,
  y: ORIGIN.y + Math.floor(seat / PER_ROW) * DESK_H,
});

export const PALETTE = [0xd9534f, 0xe98f3f, 0xe6c34a, 0x4fb477, 0x38a8a0, 0x4a90d9, 0x8e6fc9, 0xd9669a];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // 混合位元，讓只差一個字元的 id（如 sim-a / sim-b）也能拿到不同的衣服與髮色
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

// hair/shirt 為 PALETTE 索引
export const appearance = (sessionId: string): { hair: number; shirt: number } => {
  const h = hash(sessionId);
  return { hair: h % PALETTE.length, shirt: Math.floor(h / PALETTE.length) % PALETTE.length };
};

export const nameplate = (e: Employee): [string, string] => [e.folder, truncate(e.lastPrompt, 30)];

export function summary(employees: Employee[]): { text: string; alert: boolean } {
  const n = (s: Employee['status']) => employees.filter((e) => e.status === s).length;
  const waiting = n('waiting');
  return { text: `工作中 ${n('working')} · 等你處理 ${waiting} · 閒置 ${n('idle')}`, alert: waiting > 0 };
}

export const MIN_DESKS = 8;
export const ORIGIN_Y = ORIGIN.y;
export const SCENE_W = ORIGIN.x + PER_ROW * DESK_W + 16;

// 桌數：至少 8 張，員工座位超過時以一整排（4 張）為單位往下加
export const deskCount = (employees: Employee[]): number => {
  const need = employees.reduce((m, e) => Math.max(m, e.seat + 1), 0);
  return Math.max(MIN_DESKS, Math.ceil(need / PER_ROW) * PER_ROW);
};

export const sceneHeight = (desks: number): number => ORIGIN.y + Math.ceil(desks / PER_ROW) * DESK_H + 16;

// 到班時間 HH:mm（本地時區）
export const formatTime = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const DONE_MS = 3000;

// 助理「完成」後 3 秒淡出：由前端自己計時，不依賴伺服器何時移除
export class DoneClock {
  private since = new Map<string, number>();
  /** 第一次看到完成的時間（之後重複呼叫不會重置） */
  mark(key: string, now: number): number {
    if (!this.since.has(key)) this.since.set(key, now);
    return this.since.get(key)!;
  }
  /** 距離淡出還剩幾毫秒（尚未標記回傳 DONE_MS） */
  remaining(key: string, now: number): number {
    const s = this.since.get(key);
    return s === undefined ? DONE_MS : Math.max(0, DONE_MS - (now - s));
  }
  forget(key: string): void {
    this.since.delete(key);
  }
  /** 清掉以 prefix 開頭、但不在 keep 內的紀錄（助理離開清單、員工離開時用） */
  prune(prefix: string, keep: Set<string>): void {
    for (const k of this.since.keys()) if (k.startsWith(prefix) && !keep.has(k)) this.since.delete(k);
  }
}

/** 文字太寬時，取最長的前綴加「…」使 fits 為真；原本就放得下則原樣回傳。 */
export const fitText = (text: string, fits: (s: string) => boolean): string => {
  const base = text.endsWith('…') ? text.slice(0, -1) : text;
  const chars = [...base];
  if (fits(text)) return text;
  for (let n = chars.length - 1; n > 0; n--) {
    const t = chars.slice(0, n).join('') + '…';
    if (fits(t)) return t;
  }
  return '…';
};
