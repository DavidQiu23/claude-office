import type { Assistant, Employee } from '../../src/state/types.js';

/** 漫畫人物的衣服色（照美術定稿：中明度的飽和色，避開紅、橘、黃）與髮色（黑、深棕、深紫等自然色），各 8 種，日夜相同 */
export const SHIRT_COLORS: string[] = ['#4f8fd8', '#6cc28a', '#9b7fd8', '#43b0c8', '#e88ab8', '#8fc860', '#5a6fd8', '#f2f2ec'];
export const HAIR_COLORS: string[] = ['#2a2a2a', '#3a2a20', '#1f1b2e', '#8a6a4a', '#2b2b33', '#5a3a8a', '#5a4030', '#2f4a6e'];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // 混合位元，讓只差一個字元的 id（如 sim-a / sim-b）也能拿到不同的衣服與髮色
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

/** 角色外觀（皆由 sessionId 雜湊決定）：hair/shirt 為 HAIR_COLORS/SHIRT_COLORS 索引（0–7），style 為髮型 0–5，outfit 為衣服款式 0–2，
 *  eyes 為眼型（0 角度眼加粗斜眉、1 大圓眼加睫毛） */
export interface Look { hair: number; shirt: number; style: number; outfit: number; eyes: number; glasses: boolean }

export const HAIR_STYLES = 6;
export const OUTFIT_COUNT = 3;
export const EYE_TYPES = 2;

/** 人物動畫的錯開量（秒，0–7）：person.ts 設成負的 animation-delay，大家不同步。另加字尾雜湊，和外觀互不相關 */
export const motionDelay = (sessionId: string): number => (hash(`${sessionId}#motion`) % 7000) / 1000;

export const appearance = (sessionId: string): Look => {
  const h = hash(sessionId);
  const n = SHIRT_COLORS.length;
  return {
    hair: h % n,
    shirt: Math.floor(h / n) % n,
    style: Math.floor(h / (n * n)) % HAIR_STYLES,
    outfit: Math.floor(h / (n * n * HAIR_STYLES)) % OUTFIT_COUNT,
    eyes: Math.floor(h / (n * n * HAIR_STYLES * OUTFIT_COUNT)) % EYE_TYPES,
    glasses: (h >>> 24) % 4 === 0,
  };
};

// 名牌：session 標題（沒有就用第一個 prompt），這些在 session 期間不會變，比最近的 prompt 好認。
// 換行/連續空白壓成一格，避免名牌變多行；太長由 CSS 截成「…」
export const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
export const nameplate = (e: Employee): string => oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt);

/** 工作中的助理數：資訊卡的「N 位工作中」 */
export const workingCount = (list: readonly Assistant[]): number => list.filter((a) => a.status === 'working').length;

/** 資訊卡的助理清單：工作中排前（同組維持原順序），前 max 位成列，其餘歸入 extra */
export const assistantList = (list: readonly Assistant[], max = 4) => {
  const sorted = [...list.filter((a) => a.status === 'working'), ...list.filter((a) => a.status !== 'working')];
  const rest = sorted.slice(max);
  const extraWorking = workingCount(rest);
  return {
    rows: sorted.slice(0, max),
    extra: rest.length,
    extraWorking,
    extraDone: rest.length - extraWorking,
    working: workingCount(list),
  };
};

// status 'idle' 在畫面上叫「輪到你」：Claude 做完這一輪、等你下一個指示
/** 分頁標題：有人等你處理或輪到你時，人數寫在最前面 */
export function tabTitle(employees: Employee[]): string {
  const n = (s: Employee['status']) => employees.filter((e) => e.status === s).length;
  const badge = [n('waiting') ? `!${n('waiting')}` : '', n('idle') ? `✓${n('idle')}` : ''].filter(Boolean).join(' ');
  return (badge ? `(${badge}) ` : '') + 'Claude 辦公室';
}

// 到班時間 HH:mm（本地時區）
export const formatTime = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const PROJECT_COLORS: string[] = ['#4f86b8', '#3d4f7a', '#6f9a5e', '#8a74b0', '#c0688a', '#4a9a94', '#a64d9e', '#6e7b8b'];

// 名牌前綴：等你處理「! 」、輪到你「✓ 」
export const platePrefix = (e: Employee): string => (e.status === 'waiting' ? '! ' : e.status === 'idle' ? '✓ ' : '');
export const roomKey = (e: Pick<Employee, 'cwd'>): string => e.cwd ?? '';

export const projectColor = (key: string): string => PROJECT_COLORS[hash(key ?? '') % PROJECT_COLORS.length];

/** 路徑最後兩層，同名資料夾用來區分 */
export const shortPath = (cwd: string): string => cwd.split(/[\\/]+/).filter(Boolean).slice(-2).join('/');

