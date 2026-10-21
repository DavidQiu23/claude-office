import type { Employee } from '../../src/state/types.js';
import { truncate } from '../../src/state/describe.js';

export const DESK_W = 108;
export const DESK_H = 120;
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

// ---- 版面：一個資料夾（cwd）一間小辦公室 ----

export const ROOM = { gutter: 44, header: 40, pad: 10, gap: 14, maxRowW: 760, minCols: 2, maxCols: 3 };
export const BASE_W = 560; // 計算放大倍率時的參考尺寸（典型的 1~3 間辦公室）
export const BASE_H = 330;

export interface Room {
  key: string; // cwd
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  desks: number;
}
export interface Layout { rooms: Room[]; width: number; height: number }

export const roomKey = (e: Pick<Employee, 'cwd'>): string => e.cwd ?? '';

/** 路徑最後兩層，同名資料夾用來區分 */
const shortPath = (cwd: string): string => cwd.split(/[\\/]+/).filter(Boolean).slice(-2).join('/');

export function layout(employees: Employee[]): Layout {
  const groups = new Map<string, Employee[]>();
  for (const e of employees) {
    const k = roomKey(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  // 先到的資料夾排前面（以最早到班時間），同時間依路徑
  const keys = [...groups.keys()].sort((a, b) => {
    const t = (k: string) => Math.min(...groups.get(k)!.map((e) => e.arrivedAt));
    return t(a) - t(b) || a.localeCompare(b);
  });
  const names = keys.map((k) => groups.get(k)![0].folder);
  const rooms: Room[] = keys.map((k, i) => {
    const need = Math.max(...groups.get(k)!.map((e) => e.seat + 1));
    const cols = Math.min(ROOM.maxCols, Math.max(ROOM.minCols, need));
    const desks = Math.ceil(Math.max(need, cols) / cols) * cols;
    const dup = names.filter((n) => n === names[i]).length > 1;
    return {
      key: k,
      title: dup && k ? shortPath(k) : names[i],
      x: 0,
      y: 0,
      w: ROOM.gutter + cols * DESK_W + ROOM.pad,
      h: ROOM.header + (desks / cols) * DESK_H + ROOM.pad,
      cols,
      desks,
    };
  });
  // 由左到右排，超過一行寬度就換行
  let x = ROOM.gap, y = ROOM.gap, rowH = 0, width = 0;
  for (const r of rooms) {
    if (x > ROOM.gap && x + r.w > ROOM.maxRowW) {
      x = ROOM.gap;
      y += rowH + ROOM.gap;
      rowH = 0;
    }
    r.x = x;
    r.y = y;
    x += r.w + ROOM.gap;
    rowH = Math.max(rowH, r.h);
    width = Math.max(width, x);
  }
  return { rooms, width: Math.max(width, 320), height: Math.max(y + rowH + ROOM.gap, 200) };
}

/** 某個座位那一格的左上角 */
export const seatCell = (room: Room, seat: number): { x: number; y: number } => ({
  x: room.x + ROOM.gutter + (seat % room.cols) * DESK_W,
  y: room.y + ROOM.header + Math.floor(seat / room.cols) * DESK_H,
});

/** 辦公室的門（員工進出的位置），與第一排的人物同高 */
export const doorPos = (room: Room): { x: number; y: number } => ({ x: room.x + 24, y: room.y + ROOM.header + 46 });

/** 版面是否需要重畫（房間位置、大小、桌數有變才重畫） */
export const layoutSig = (l: Layout): string =>
  l.rooms.map((r) => [r.key, r.title, r.x, r.y, r.w, r.h, r.desks].join(':')).join('|');
