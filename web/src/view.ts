import type { Assistant, Employee } from '../../src/state/types.js';
import type { Void } from './flat.js';

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
// 換行/連續空白壓成一格，避免名牌變多行而蓋到下一排；長度交給 plateFit 依寬度截
export const oneLine =(s: string) => s.replace(/\s+/g, ' ').trim();
export const nameplate = (e: Employee): string => oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt);

/** 資訊卡的助理清單：工作中排前（同組維持原順序），前 max 位成列，其餘歸入 extra */
export const assistantList = (list: readonly Assistant[], max = 4) => {
  const sorted = [...list.filter((a) => a.status === 'working'), ...list.filter((a) => a.status !== 'working')];
  const rest = sorted.slice(max);
  const extraWorking = rest.filter((a) => a.status === 'working').length;
  return {
    rows: sorted.slice(0, max),
    extra: rest.length,
    extraWorking,
    extraDone: rest.length - extraWorking,
    working: list.filter((a) => a.status === 'working').length,
  };
};

// status 'idle' 在畫面上叫「輪到你」：Claude 做完這一輪、等你下一個指示
export interface SummaryItem { key: Employee['status']; sym: string; label: string; n: number }

/** 狀態列：items 依緊急程度排序（等你處理 → 輪到你 → 工作中），同時是圖例與比例條的順序 */
export function summary(employees: Employee[]): { items: SummaryItem[]; total: number; alert: boolean; turn: boolean; title: string } {
  const n = (s: Employee['status']) => employees.filter((e) => e.status === s).length;
  const waiting = n('waiting');
  const turn = n('idle');
  const badge = [waiting ? `!${waiting}` : '', turn ? `✓${turn}` : ''].filter(Boolean).join(' ');
  return {
    items: [
      { key: 'waiting', sym: '!', label: '等你處理', n: waiting },
      { key: 'idle', sym: '✓', label: '輪到你', n: turn },
      { key: 'working', sym: '●', label: '工作中', n: n('working') },
    ],
    total: employees.length,
    alert: waiting > 0,
    turn: waiting === 0 && turn > 0,
    title: (badge ? `(${badge}) ` : '') + 'Claude 辦公室',
  };
}

// 到班時間 HH:mm（本地時區）
export const formatTime = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

// marginTop 96：後牆家具腳底 y = 78，招牌從 y = 82 起
export const ISLAND = { cellW: 96, cellH: 124, pad: 14, top: 26, bottom: 10, gap: 44, marginX: 40, marginTop: 96, vgap: 72, marginBottom: 40 };

/** 桌數越多欄數越多，島不會一直往下長：1–3 桌 = 桌數欄；4–9 桌 3 欄；10–16 桌 4 欄；17 桌以上 5 欄 */
export const columnsFor = (desks: number): number => (desks <= 3 ? Math.max(1, desks) : desks <= 9 ? 3 : desks <= 16 ? 4 : 5);
// 辦公室的最小尺寸：一開始就是完整的大空間，島長進去；放不下才加寬加高
export const BASE_W = 1280;
export const BASE_H = 720;
/** 一排島最右可以排到的位置（右邊留一個邊距） */
const ROW_RIGHT = BASE_W - ISLAND.marginX;
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
// ---- 名牌（設計稿 10：桌上名片座）----
// cardH = 卡片高（位置與避臉只看它）、h = 含底座與影子的總高（鄰座名牌互撞看它）、pad = 左右內距、gap = 鄰座名牌最小間隔
export const PLATE = { cardH: 19, h: 26, pad: 7, gap: 6, sizes: [13, 12, 11] } as const;
/** 名牌整塊（含左右內距）在螢幕上的最大寬度 */
export const plateMaxW = (zoom: number): number => Math.min(280, 120 + 160 * zoom);
export const platePrefix = (e: Employee): string => (e.status === 'waiting' ? '! ' : e.status === 'idle' ? '✓ ' : '');

/** 名牌只放標題：13 → 11px，11px 還放不下才截中間（前綴不截）。measure 回傳整塊寬（含內距） */
export function plateFit(e: Employee, maxW: number, measure: (s: string, size: number) => number): { text: string; size: number } {
  const pre = platePrefix(e);
  const name = nameplate(e);
  for (const size of PLATE.sizes) if (measure(pre + name, size) <= maxW) return { text: pre + name, size };
  const min = PLATE.sizes[PLATE.sizes.length - 1]!;
  return { text: pre + fitMiddle(name, (s) => measure(pre + s, min) <= maxW), size: min };
}

export interface Circle { x: number; y: number; r: number }
/** 螢幕 px：x, y = 名牌上緣中點，want = 整串標題的寬，head = 這桌的人的臉 */
export interface PlateSlot { x: number; y: number; want: number; head: Circle }

/** 依鄰座分配名牌寬度：不蓋到別人的臉；上下會撞的兩塊，半寬加起來 ≤ 中心距 − gap，短的拿完整寬度、長的拿剩下的，兩塊都長各拿一半 */
export function plateWidths(slots: PlateSlot[], zoom: number): number[] {
  const { cardH, h, gap } = PLATE;
  const w = slots.map((s, i) => {
    let cap = Math.min(s.want, plateMaxW(zoom));
    slots.forEach((o, j) => {
      const f = o.head;
      // 上下只差不到 0.5px 視為沒碰到
      if (j !== i && f.y + f.r > s.y + 0.5 && f.y - f.r < s.y + cardH - 0.5) cap = Math.min(cap, 2 * (Math.abs(f.x - s.x) - f.r - 2));
    });
    return Math.max(0, cap);
  });
  // 一對一對調整；某對縮小後可能讓前面的對又撞上，重複幾輪
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!, b = slots[j]!;
        if (Math.abs(a.y - b.y) >= h + 2) continue;
        const avail = 2 * (Math.abs(a.x - b.x) - gap);
        if (w[i]! + w[j]! <= avail + 0.01) continue;
        const s = w[i]! <= w[j]! ? i : j, l = s === i ? j : i;
        if (w[s]! <= avail / 2) w[l] = avail - w[s]!;
        else w[i] = w[j] = avail / 2;
      }
    }
  }
  return w.map((x) => Math.max(0, x));
}

// ---- 地上招牌 ----
export const SIGN_FONT = { max: 17, min: 12 };

/** 招牌字級從 max 往下縮到放得下；到 min 還放不下才截字 */
export function signFit(title: string, maxW: number, measure: (s: string, size: number) => number): { text: string; size: number } {
  for (let size = SIGN_FONT.max; size >= SIGN_FONT.min; size--) if (measure(title, size) <= maxW) return { text: title, size };
  return { text: fitMiddle(title, (t) => measure(t, SIGN_FONT.min) <= maxW), size: SIGN_FONT.min };
}
export const signMaxW = (isl: Island): number => isl.w + ISLAND.gap - 24;

export interface Layout { islands: Island[]; width: number; height: number; voids: Void[] }

export const roomKey = (e: Pick<Employee, 'cwd'>): string => e.cwd ?? '';

export const projectColor = (key: string): string => PROJECT_COLORS[hash(key ?? '') % PROJECT_COLORS.length];

/** 路徑最後兩層，同名資料夾用來區分 */
export const shortPath =(cwd: string): string => cwd.split(/[\\/]+/).filter(Boolean).slice(-2).join('/');

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
    const cols = columnsFor(desks);
    const rows = Math.ceil(desks / cols);
    const dup = names.filter((n) => n === names[i]).length > 1;
    return {
      key: k,
      title: dup && k ? shortPath(k) : names[i],
      x: 0,
      y: 0,
      w: cols * ISLAND.cellW + ISLAND.pad * 2,
      h: ISLAND.top + rows * ISLAND.cellH + ISLAND.bottom,
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
    if (x > ISLAND.marginX && x + r.w > ROW_RIGHT) {
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
    width: Math.max(right + ISLAND.marginX, BASE_W),
    height: Math.max(y + rowH + ISLAND.marginBottom, BASE_H),
  };
}

/** 某個座位那一格的左上角 */
export const seatCell = (island: Island, seat: number): { x: number; y: number } => ({
  x: island.x + ISLAND.pad + (seat % island.cols) * ISLAND.cellW,
  y: island.y + ISLAND.top + Math.floor(seat / island.cols) * ISLAND.cellH,
});

/** 該專案底下某狀態的人數（招牌圓章：waiting 紅、idle 琥珀） */
export const statusCount = (employees: Iterable<Employee>, key: string, status: Employee['status']): number => {
  let n = 0;
  for (const e of employees) if (roomKey(e) === key && e.status === status) n++;
  return n;
};

/** 後牆左上角的門：員工從這裡進出（人物中心 x） */
export const DOOR_X = 40;

/** 座位點（人坐下時腳下的地板點，格內座標）：桌子長邊中點 fx 62 的正後方 */
export const SEAT = { x: 62, y: 40 };

/** 員工地板點（腳下）的上班路線：門口 → 島上緣外的走道 → 沿該欄左側兩欄桌子之間的空隙往下 → 橫向走進座位（下班走反向） */
export const entryPath = (island: Island, seat: number): { x: number; y: number }[] => {
  const c = seatCell(island, seat);
  const py = island.y - 16 - 28;
  const sy = c.y + SEAT.y;
  return [{ x: DOOR_X, y: py }, { x: c.x, y: py }, { x: c.x, y: sy }, { x: c.x + SEAT.x, y: sy }];
};

/** 版面是否需要重畫（島的位置、大小、桌數有變才重畫） */
export const layoutSig = (l: Layout): string =>
  l.islands.map((r) => [r.key, r.title, r.x, r.y, r.w, r.h, r.desks].join(':')).join('|') + '#' + l.voids.map((v) => [v.x, v.y, v.w, v.h].join(',')).join(';');
