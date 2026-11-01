import type { Employee } from '../../src/state/types.js';
import { nameplate, platePrefix, projectColor, roomKey, shortPath, workingCount } from './view.js';

// ---- 剖面大樓的尺寸（CSS px）----
export const GEO = { floorH: 200, slab: 8, elevatorW: 80, seatW: 120, furnitureW: 200, groundH: 72, panelW: 40, gutter: 56, rightMargin: 16 } as const;

/** 第 i 個座位的中心 x（樓層內座標） */
export const seatCenter = (i: number): number => GEO.elevatorW + i * GEO.seatW + GEO.seatW / 2;

/** 座位只坐真員工；助理只是主人名牌旁的小標 */
export interface Seat { index: number; occ: Employee | null }
export interface Floor { key: string; level: number; title: string; color: string; desks: number; seats: Seat[] }
export type Alert = 'waiting' | 'idle' | null;

/**
 * 一個專案（cwd）一層樓，1F 在 index 0。minDesks：該層至少要留的桌數（人走了桌子不收，由呼叫端記）。
 * prevOrder：上一次的樓層 key（1F 在前）。還在的樓層維持原本的相對順序（只有整層走光時上面才往下遞補），新樓層蓋在最上面；沒有 prevOrder（第一次、重新連線）就全部算新樓層
 */
export function floorPlan(employees: Employee[], minDesks: ReadonlyMap<string, number>, prevOrder: readonly string[] = []): Floor[] {
  const groups = new Map<string, Employee[]>();
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

/** 全部樓層共用的寬度：至少撐滿可用寬，桌數最多那層放不下就往右長（整棟樓變寬、整頁橫向捲動）；沒有樓層（空大廳）就是可用寬 */
export const buildingWidth = (plan: Floor[], avail: number): number =>
  plan.length ? Math.max(avail, GEO.elevatorW + Math.max(...plan.map((f) => f.desks)) * GEO.seatW + GEO.furnitureW) : avail;

/** 桌上名牌：標題加狀態前綴（底色直接依 e.status）；helpers 是工作中的助理數（名牌旁的「↳N」，0 不顯示） */
export function plateText(e: Employee): { text: string; helpers: number } {
  return { text: platePrefix(e) + nameplate(e), helpers: workingCount(e.assistants) };
}

/** 電梯面板的框：看得到的樓層按鈕（flags 依面板上到下）從第一顆到最後一顆；一顆都沒有回 null */
export function visibleSpan(flags: readonly boolean[]): { from: number; to: number } | null {
  const from = flags.indexOf(true);
  return from < 0 ? null : { from, to: flags.lastIndexOf(true) };
}

/** 頁面是否已在最底（含完全沒有捲軸）：加蓋樓層時要維持貼底，不是貼著某一層 */
export const atBottom = (scrollY: number, scrollHeight: number, viewH: number): boolean => scrollY >= scrollHeight - viewH - 1;

// ---- 走路與電梯 ----
/** 電梯門中心 x（樓層內座標，與 seatCenter 同一套） */
export const DOOR_X = GEO.elevatorW / 2;
export const WALK_SPEED = 120; // px/s
/** 走一段路要多久（ms）：距離 ÷ 120px/s，等速 */
export const walkMs = (from: number, to: number): number => (Math.abs(to - from) / WALK_SPEED) * 1000;
export interface Walk { from: number; to: number; start: number; ms: number }
/** 走路中某個時間點的 x（等速內插，時間外夾在起點或終點） */
export const walkPos = (w: Walk, now: number): number =>
  w.ms <= 0 ? w.to : w.from + (w.to - w.from) * Math.min(1, Math.max(0, (now - w.start) / w.ms));

/** 正在走去電梯的人也放進 floorPlan（那層才不會先拆）；排在前面，同座位的新人才會蓋過他；同一人又回來了只算一次 */
export const withLeaving = (employees: Employee[], leaving: Employee[]): Employee[] => {
  const here = new Set(employees.map((e) => e.sessionId));
  return [...leaving.filter((l) => !here.has(l.sessionId)), ...employees];
};

/**
 * Building 每次 render 的樓層配置。going：走去電梯、store 已經沒有的人，樓層留著但座位空出來。
 * prevOrder 是上次 plan 的樓層 key。回傳的 minDesks 是下一次的輸入（拆掉的樓層從 minDesks 刪掉）
 */
export function buildingPlan(employees: Employee[], going: Employee[], minDesks: ReadonlyMap<string, number>, prevOrder: readonly string[] = []):
  { plan: Floor[]; minDesks: Map<string, number> } {
  const plan = vacate(floorPlan(withLeaving(employees, going), minDesks, prevOrder), new Set(going.map((e) => e.sessionId)));
  return { plan, minDesks: new Map(plan.map((f) => [f.key, f.desks])) };
}

/** 走去電梯的人從座位拿掉：桌子變空、沒有名牌、不算電梯燈，但樓層還在 */
export function vacate(plan: Floor[], ids: ReadonlySet<string>): Floor[] {
  if (!ids.size) return plan;
  return plan.map((f) => ({ ...f, seats: f.seats.map((s) => (s.occ && ids.has(s.occ.sessionId) ? { ...s, occ: null } : s)) }));
}
