import type { Assistant, Employee } from '../../src/state/types.js';

export const PALETTE = [0xd9534f, 0xe98f3f, 0xe6c34a, 0x4fb477, 0x38a8a0, 0x4a90d9, 0x8e6fc9, 0xd9669a];

/** 漫畫人物的衣服色與髮色（日夜相同），各 8 種 */
export const SHIRT_COLORS: string[] = ['#c9d8e8', '#f1d0c4', '#d8e4cf', '#e8dcc0', '#d9c9e6', '#f3c9d2', '#bfe0dc', '#e9c9a8'];
export const HAIR_COLORS: string[] = ['#2a2a2a', '#5a4030', '#3a3a4a', '#8a6a4a', '#a0522d', '#c99a4a', '#8d8a86', '#4a3560'];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // 混合位元，讓只差一個字元的 id（如 sim-a / sim-b）也能拿到不同的衣服與髮色
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

/** 角色外觀（皆由 sessionId 雜湊決定）：hair/shirt 為 HAIR_COLORS/SHIRT_COLORS 索引（0–7），style 為髮型 0–5，outfit 為衣服款式 0–2 */
export interface Look { hair: number; shirt: number; style: number; outfit: number; glasses: boolean }

export const HAIR_STYLES = 6;
export const OUTFIT_COUNT = 3;

export const appearance = (sessionId: string): Look => {
  const h = hash(sessionId);
  const n = SHIRT_COLORS.length;
  return {
    hair: h % n,
    shirt: Math.floor(h / n) % n,
    style: Math.floor(h / (n * n)) % HAIR_STYLES,
    outfit: Math.floor(h / (n * n * HAIR_STYLES)) % OUTFIT_COUNT,
    glasses: (h >>> 24) % 4 === 0,
  };
};

// 名牌：session 標題（沒有就用第一個 prompt），這些在 session 期間不會變，比最近的 prompt 好認。
// 換行/連續空白壓成一格，避免名牌變多行；太長由 CSS 截成「…」
export const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
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

export const PROJECT_COLORS: string[] = ['#4f86b8', '#d08a4a', '#6f9a5e', '#8a74b0', '#c0688a', '#4a9a94', '#c4a23e', '#c0583c'];

// 名牌前綴：等你處理「! 」、輪到你「✓ 」
export const platePrefix = (e: Employee): string => (e.status === 'waiting' ? '! ' : e.status === 'idle' ? '✓ ' : '');
export const roomKey = (e: Pick<Employee, 'cwd'>): string => e.cwd ?? '';

export const projectColor = (key: string): string => PROJECT_COLORS[hash(key ?? '') % PROJECT_COLORS.length];

/** 路徑最後兩層，同名資料夾用來區分 */
export const shortPath = (cwd: string): string => cwd.split(/[\\/]+/).filter(Boolean).slice(-2).join('/');

