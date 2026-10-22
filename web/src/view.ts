import type { Employee } from '../../src/state/types.js';
import { truncate } from '../../src/state/describe.js';
import { CHAIRS, MEETING, type Void } from './flat.js';

export const PALETTE = [0xd9534f, 0xe98f3f, 0xe6c34a, 0x4fb477, 0x38a8a0, 0x4a90d9, 0x8e6fc9, 0xd9669a];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // 混合位元，讓只差一個字元的 id（如 sim-a / sim-b）也能拿到不同的衣服與髮色
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

/** 角色外觀（皆由 sessionId 雜湊決定）：hair/shirt 為 PALETTE 索引，style 為髮型 0–5，outfit 為衣服款式 0–2 */
export interface Look { hair: number; shirt: number; style: number; outfit: number; glasses: boolean }

export const HAIR_STYLES = 6;
export const OUTFIT_COUNT = 3;

export const appearance = (sessionId: string): Look => {
  const h = hash(sessionId);
  const n = PALETTE.length;
  return {
    hair: h % n,
    shirt: Math.floor(h / n) % n,
    style: Math.floor(h / (n * n)) % HAIR_STYLES,
    outfit: Math.floor(h / (n * n * HAIR_STYLES)) % OUTFIT_COUNT,
    glasses: (h >>> 24) % 4 === 0,
  };
};

// 名牌：session 標題（沒有就用第一個 prompt），這些在 session 期間不會變，比最近的 prompt 好認。
// 換行/連續空白壓成一格，避免名牌變多行而蓋到下一排
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
export const nameplate = (e: Employee): string => {
  const base = oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt);
  return truncate(base, 24);
};

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

/** 文字太寬時，保留開頭與結尾、中間換成「…」使 fits 為真（結尾多留一字，同開頭的名字仍可分辨）；原本就放得下則原樣回傳。 */
export const fitMiddle = (text: string, fits: (s: string) => boolean): string => {
  if (fits(text)) return text;
  const chars = [...text];
  for (let n = chars.length - 1; n > 0; n--) {
    const head = Math.floor(n / 2);
    const tail = n - head;
    const t = chars.slice(0, head).join('') + '…' + chars.slice(chars.length - tail).join('');
    if (fits(t)) return t;
  }
  return '…';
};

// ---- 版面：一個專案（cwd）一座桌島 ----

// tableArea：座位列下方的討論桌區（桌子在其中往下 30）。marginTop 96：後牆家具腳底 y = 78，招牌從 y = 82 起
export const ISLAND = { cellW: 96, cellH: 124, pad: 14, top: 26, tableArea: 112, bottom: 10, gap: 44, marginX: 40, marginTop: 96, vgap: 72, marginBottom: 40, maxRowW: 1100, maxCols: 3 };
export const TABLE_DY = 30; // 討論桌上緣離座位列下緣的距離
export const BASE_W = 560; // 計算放大倍率時的參考尺寸（典型的 1~3 間辦公室）
export const BASE_H = 400;
export const PROJECT_COLORS: string[] = ['#4a90d9', '#e98f3f', '#4fb477', '#8e6fc9', '#d9669a', '#38a8a0', '#e6c34a', '#d9534f'];

export interface Island {
  key: string; // cwd
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  desks: number;
  color: string;
}
export interface Layout { islands: Island[]; width: number; height: number; voids: Void[] }

export const roomKey = (e: Pick<Employee, 'cwd'>): string => e.cwd ?? '';

export const projectColor = (key: string): string => PROJECT_COLORS[hash(key ?? '') % PROJECT_COLORS.length];

/** 路徑最後兩層，同名資料夾用來區分 */
const shortPath = (cwd: string): string => cwd.split(/[\\/]+/).filter(Boolean).slice(-2).join('/');

export function layout(employees: Employee[]): Layout {
  const groups = new Map<string, Employee[]>();
  for (const e of employees) {
    const k = roomKey(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  // 先到的專案排前面（以最早到班時間），同時間依路徑
  const keys = [...groups.keys()].sort((a, b) => {
    const t = (k: string) => Math.min(...groups.get(k)!.map((e) => e.arrivedAt));
    return t(a) - t(b) || a.localeCompare(b);
  });
  const names = keys.map((k) => groups.get(k)![0].folder);
  const islands: Island[] = keys.map((k, i) => {
    const desks = Math.max(...groups.get(k)!.map((e) => e.seat + 1));
    const cols = Math.min(ISLAND.maxCols, desks);
    const rows = Math.ceil(desks / cols);
    const dup = names.filter((n) => n === names[i]).length > 1;
    return {
      key: k,
      title: dup && k ? shortPath(k) : names[i],
      x: 0,
      y: 0,
      w: cols * ISLAND.cellW + ISLAND.pad * 2,
      h: ISLAND.top + rows * ISLAND.cellH + ISLAND.tableArea + ISLAND.bottom,
      cols,
      rows,
      desks,
      color: projectColor(k),
    };
  });
  // 由左到右排，超過一行寬度就換行
  let x = ISLAND.marginX, y = ISLAND.marginTop, rowH = 0, right = 0;
  const voids: Void[] = [];
  let row: Island[] = [];
  const closeRow = (): void => {
    // 同一排較矮的島，下方到該排底部是空地
    for (const r of row) if (r.h < rowH) voids.push({ x: r.x, y: r.y + r.h, w: r.w, h: rowH - r.h });
    row = [];
  };
  for (const r of islands) {
    if (x > ISLAND.marginX && x + r.w > ISLAND.maxRowW) {
      closeRow();
      x = ISLAND.marginX;
      y += rowH + ISLAND.vgap;
      rowH = 0;
    }
    r.x = x;
    r.y = y;
    x += r.w + ISLAND.gap;
    rowH = Math.max(rowH, r.h);
    right = Math.max(right, r.x + r.w);
    row.push(r);
  }
  closeRow();
  return {
    islands,
    voids,
    width: Math.max(right + ISLAND.marginX, 320),
    height: Math.max(y + rowH + ISLAND.marginBottom, 200),
  };
}

/** 某個座位那一格的左上角 */
export const seatCell = (island: Island, seat: number): { x: number; y: number } => ({
  x: island.x + ISLAND.pad + (seat % island.cols) * ISLAND.cellW,
  y: island.y + ISLAND.top + Math.floor(seat / island.cols) * ISLAND.cellH,
});

/** 該專案底下等你回覆（waiting）的人數 */
export const waitingCount = (employees: Iterable<Employee>, key: string): number => {
  let n = 0;
  for (const e of employees) if (roomKey(e) === key && e.status === 'waiting') n++;
  return n;
};

/** 後牆左上角的門：員工從這裡進出（人物中心 x） */
export const DOOR_X = 40;

/** 員工中心點的上班路線：門口 → 島上緣外的走道 → 座位（下班走反向） */
export const entryPath = (island: Island, seat: number): { x: number; y: number }[] => {
  const c = seatCell(island, seat);
  const py = island.y - 16 - 28;
  const sx = c.x + 48;
  return [{ x: DOOR_X, y: py }, { x: sx, y: py }, { x: sx, y: c.y + 48 }];
};

/** 這座島討論桌的左上角 */
export const tableOrigin = (island: Island): { x: number; y: number } => ({
  x: island.x + (island.w - MEETING.w) / 2,
  y: island.y + ISLAND.top + island.rows * ISLAND.cellH + TABLE_DY,
});

/** 第 chair 張椅子上的人物中心（人物腳底落在椅子上） */
export const chairSpot = (island: Island, chair: number): { x: number; y: number } => {
  const t = tableOrigin(island);
  const c = CHAIRS[chair % CHAIRS.length]!;
  return { x: t.x + c.x, y: t.y + c.y - 20 };
};

/** 座位 → 討論桌的路線：沿座位右邊的走道（兩桌之間）往下，再橫向走到椅子；回座位走反向 */
export const tableRoute = (island: Island, seat: number, chair: number): { x: number; y: number }[] => {
  const c = seatCell(island, seat);
  const spot = chairSpot(island, chair);
  const gx = c.x + ISLAND.cellW;
  return [{ x: gx, y: c.y + 48 }, { x: gx, y: spot.y }, spot];
};

/** 助理機器人在桌邊的位置（機器人左上角）：站在椅子靠桌心的一側，第 2 個再往內往下錯開 */
export const tableBotSpot = (island: Island, chair: number, i: number): { x: number; y: number } => {
  const t = tableOrigin(island);
  const c = CHAIRS[chair % CHAIRS.length]!;
  const d = c.x < MEETING.w / 2 ? 1 : -1;
  return { x: t.x + c.x + d * (28 + i * 16) - 12, y: t.y + c.y - 6 + i * 14 };
};

/** 版面是否需要重畫（島的位置、大小、桌數有變才重畫） */
export const layoutSig = (l: Layout): string =>
  l.islands.map((r) => [r.key, r.title, r.x, r.y, r.w, r.h, r.desks].join(':')).join('|') + '#' + l.voids.map((v) => [v.x, v.y, v.w, v.h].join(',')).join(';');
