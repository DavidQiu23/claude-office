import type { Assistant, Employee } from '../../src/state/types.js';
import { nameplate, oneLine, projectColor, roomKey, shortPath } from './view.js';

// ---- 剖面大樓的尺寸（CSS px）----
export const GEO = { floorH: 200, slab: 8, seatW: 120, bayMin: 180, groundH: 72, panelW: 40, gutter: 56, rightMargin: 16, sideGap: 24 } as const; // bayMin：最窄的家具區；sideGap：桌子、招牌、家具區離樓層左右緣的距離（兩側斜牆寬 16）

/** 三張桌子接一個家具區 */
const DESKS_PER_BAY = 3;
export interface Bay { x: number; w: number }
/** 一層樓的格線，樓層內座標：seats 是每個座位的中心 x（第 i 號座位坐第 i 格），groups 是被家具區隔開的每組座位，bays 是每個家具區 */
export interface SeatGrid { seats: number[]; groups: number[][]; bays: Bay[] }

/** 樓層寬 width 排得下幾張桌子、幾個家具區；u 是扣掉兩側留白的可用寬 */
function gridCounts(width: number): { u: number; nBays: number; nDesks: number } {
  const u = Math.max(0, width - 2 * GEO.sideGap);
  const nBays = Math.max(1, Math.floor(u / (DESKS_PER_BAY * GEO.seatW + GEO.bayMin)));
  return { u, nBays, nDesks: Math.max(0, Math.floor((u - nBays * GEO.bayMin) / GEO.seatW)) };
}

/** 只跟樓層寬有關，所以各層相同：從左邊開始，三張桌子接一個家具區，餘數平均給家具區。桌子不會把家具推走 */
export function seatGrid(width: number): SeatGrid {
  const { u, nBays, nDesks } = gridCounts(width);
  const bayW = (u - nDesks * GEO.seatW) / nBays;
  const grid: SeatGrid = { seats: [], groups: [], bays: [] };
  let x = GEO.sideGap;
  for (let left = nDesks, b = nBays; left > 0 || b > 0; b--) {
    const n = Math.min(DESKS_PER_BAY, left), group = Array.from({ length: n }, (_, i) => x + i * GEO.seatW + GEO.seatW / 2);
    if (n) { grid.seats.push(...group); grid.groups.push(group); }
    x += n * GEO.seatW;
    left -= n;
    if (b > 0) { grid.bays.push({ x, w: bayW }); x += bayW; }
  }
  return grid;
}

/** 座位上的人：員工，或工作中的助理（assistant 是助理本人、owner 是主人；sessionId 換成助理 id，人物外觀、資訊卡和退場都靠它） */
export type Occupant = Employee & { owner?: Employee; assistant?: Assistant };
export interface Seat { index: number; occ: Occupant | null }
export interface Floor { key: string; level: number; title: string; color: string; desks: number; seats: Seat[] }
export type Alert = 'waiting' | 'idle' | null;

/**
 * 一個專案（cwd）一層樓，1F 在 index 0。minDesks：該層至少要留的桌數（人走了桌子不收，由呼叫端記）。
 * prevOrder：上一次的樓層 key（1F 在前）。還在的樓層維持原本的相對順序（只有整層走光時上面才往下遞補），新樓層蓋在最上面；沒有 prevOrder（第一次、重新連線）就全部算新樓層
 */
export function floorPlan(employees: Occupant[], minDesks: ReadonlyMap<string, number>, prevOrder: readonly string[] = []): Floor[] {
  const groups = new Map<string, Occupant[]>();
  for (const e of employees) {
    const k = roomKey(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  // 舊樓層照原順序；新樓層蓋在上面，先到的在低樓層（以最早到班時間），同時間依路徑
  const kept = prevOrder.filter((k) => groups.has(k));
  const old = new Set(kept);
  const t = (k: string) => Math.min(...groups.get(k)!.map((e) => e.arrivedAt));
  const fresh = [...groups.keys()].filter((k) => !old.has(k)).sort((a, b) => t(a) - t(b) || a.localeCompare(b));
  const keys = [...kept, ...fresh];
  const names = keys.map((k) => groups.get(k)![0].folder);
  return keys.map((k, i) => {
    const desks = Math.max(...groups.get(k)!.map((e) => e.seat + 1), minDesks.get(k) ?? 0);
    const seats: Seat[] = Array.from({ length: desks }, (_, index) => ({ index, occ: null }));
    for (const e of groups.get(k)!) seats[e.seat].occ = e;
    const dup = names.filter((n) => n === names[i]).length > 1;
    return { key: k, level: i + 1, title: dup && k ? shortPath(k) : names[i], color: projectColor(k), desks, seats };
  });
}

/** 這層的提示：有人等你處理 > 有人輪到你 > 無 */
export function floorAlert(f: Floor): Alert {
  const has = (s: Employee['status']) => f.seats.some((x) => x.occ?.status === s);
  return has('waiting') ? 'waiting' : has('idle') ? 'idle' : null;
}

/** 全部樓層共用的寬度：至少撐滿可用寬，格子放不下桌數最多那層就往右長（整棟樓變寬、整頁橫向捲動）；沒有樓層（空大廳）就是可用寬 */
export function buildingWidth(plan: Floor[], avail: number): number {
  if (!plan.length) return avail;
  const desks = Math.max(...plan.map((f) => f.desks));
  let width = avail;
  while (gridCounts(width).nDesks < desks) width++; // 一格一格試：多出一個家具區時桌數會少，寬度和桌數不是單調的，算不出公式
  return width;
}

/** 主人的工作中助理，坐在主人那層自己的座位（座位由 src/state 分配）；完成的不在座位上 */
export const helpersOf = (e: Employee): Occupant[] =>
  e.assistants.filter((a) => a.status === 'working').map((a) => ({ ...e, sessionId: a.id, status: 'working', activity: null, seat: a.seat, arrivedAt: a.startedAt, assistants: [], owner: e, assistant: a }));

/** 桌上名牌的文字（圓章另外給，底色直接依 e.status）：員工是標題；助理是「↳ 類型 · 描述」 */
export function plateText(e: Occupant): string {
  if (e.assistant) return '↳ ' + ([e.assistant.kind, oneLine(e.assistant.description)].filter(Boolean).join(' · ') || '助理');
  return nameplate(e);
}

const STATUS_LABEL: Record<Employee['status'], string> = { working: '工作中', waiting: '等你處理', idle: '輪到你' };
/** 人物給螢幕閱讀器念的名字：誰加狀態（↳ 不念） */
export const personLabel = (e: Occupant): string =>
  e.assistant ? `助理 ${plateText(e).slice(2)}，工作中` : `${nameplate(e) || '無標題'}，${STATUS_LABEL[e.status]}`;

/** 電梯面板的框：看得到的樓層按鈕（flags 依面板上到下）從第一顆到最後一顆；一顆都沒有回 null */
export function visibleSpan(flags: readonly boolean[]): { from: number; to: number } | null {
  const from = flags.indexOf(true);
  return from < 0 ? null : { from, to: flags.lastIndexOf(true) };
}

/** 頁面是否已在最底（含完全沒有捲軸）：加蓋樓層時要維持貼底，不是貼著某一層 */
export const atBottom = (scrollY: number, scrollHeight: number, viewH: number): boolean => scrollY >= scrollHeight - viewH - 1;

/** 正在退場的人也放進 floorPlan（那層才不會先拆）；排在前面，同座位的新人才會蓋過他；同一人又回來了只算一次 */
export const withLeaving = (employees: Occupant[], leaving: Occupant[]): Occupant[] => {
  const here = new Set(employees.map((e) => e.sessionId));
  return [...leaving.filter((l) => !here.has(l.sessionId)), ...employees];
};

/**
 * Building 每次 render 的樓層配置。employees 的工作中助理也坐上座位；going：正在退場、store 已經沒有的人（含助理），樓層留著但座位空出來。
 * prevOrder 是上次 plan 的樓層 key。回傳的 minDesks 是下一次的輸入（拆掉的樓層從 minDesks 刪掉）
 */
export function buildingPlan(employees: Employee[], going: Occupant[], minDesks: ReadonlyMap<string, number>, prevOrder: readonly string[] = []):
  { plan: Floor[]; minDesks: Map<string, number> } {
  const plan = vacate(floorPlan(withLeaving(employees.flatMap((e) => [e, ...helpersOf(e)]), going), minDesks, prevOrder), new Set(going.map((e) => e.sessionId)));
  return { plan, minDesks: new Map(plan.map((f) => [f.key, f.desks])) };
}

/** 正在退場的人從座位拿掉：桌子變空、沒有名牌、不算電梯燈，但樓層還在 */
export function vacate(plan: Floor[], ids: ReadonlySet<string>): Floor[] {
  if (!ids.size) return plan;
  return plan.map((f) => ({ ...f, seats: f.seats.map((s) => (s.occ && ids.has(s.occ.sessionId) ? { ...s, occ: null } : s)) }));
}
