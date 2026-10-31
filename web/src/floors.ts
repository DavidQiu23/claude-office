import type { Assistant, Employee } from '../../src/state/types.js';
import { nameplate, oneLine, platePrefix, projectColor, roomKey, shortPath } from './view.js';

// ---- 剖面大樓的尺寸（CSS px）----
export const GEO = { floorH: 200, slab: 8, elevatorW: 80, seatW: 120, furnitureW: 200, groundH: 72, panelW: 40, gutter: 56, rightMargin: 16 } as const;

/** 第 i 個座位的中心 x（樓層內座標） */
export const seatCenter = (i: number): number => GEO.elevatorW + i * GEO.seatW + GEO.seatW / 2;
/** 樓層寬：至少撐滿可用寬，桌子多就往右長（放不下的由該層自己捲動） */
export const floorWidth = (desks: number, avail: number): number => Math.max(avail, GEO.elevatorW + desks * GEO.seatW + GEO.furnitureW);

/** 在大樓裡的助理（含完成後停留、走出中的） */
export interface Helper { owner: Employee; a: Assistant }
export const helperKey = (h: Helper): string => `${h.owner.sessionId}/${h.a.id}`;

export type Occupant = { kind: 'employee'; emp: Employee } | { kind: 'assistant'; owner: Employee; a: Assistant };
export interface Seat { index: number; occ: Occupant | null }
export interface Floor { key: string; level: number; title: string; color: string; desks: number; seats: Seat[] }
export type Alert = 'waiting' | 'idle' | null;
export type PlateTone = 'working' | 'waiting' | 'idle' | 'assistant' | 'done';

/** 一個專案（cwd）一層樓，1F 在 index 0。minDesks：該層至少要留的桌數（人走了桌子不收，由呼叫端記） */
export function floorPlan(employees: Employee[], helpers: Helper[], helperSeats: ReadonlyMap<string, number>, minDesks: ReadonlyMap<string, number>): Floor[] {
  const groups = new Map<string, Employee[]>();
  for (const e of employees) {
    const k = roomKey(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  // 先到的專案在低樓層（以最早到班時間），同時間依路徑
  const keys = [...groups.keys()].sort((a, b) => {
    const t = (k: string) => Math.min(...groups.get(k)!.map((e) => e.arrivedAt));
    return t(a) - t(b) || a.localeCompare(b);
  });
  const names = keys.map((k) => groups.get(k)![0].folder);
  // 主人還在、又有座位的助理才放進大樓
  const placed = helpers.filter((h) => helperSeats.has(helperKey(h)) && employees.some((e) => e.sessionId === h.owner.sessionId));
  return keys.map((k, i) => {
    const mine = placed.filter((h) => roomKey(h.owner) === k);
    const seatOf = (h: Helper): number => helperSeats.get(helperKey(h))!;
    const desks = Math.max(...groups.get(k)!.map((e) => e.seat + 1), ...mine.map((h) => seatOf(h) + 1), minDesks.get(k) ?? 0);
    const seats: Seat[] = Array.from({ length: desks }, (_, index) => ({ index, occ: null }));
    for (const e of groups.get(k)!) seats[e.seat].occ = { kind: 'employee', emp: e };
    for (const h of mine) if (!seats[seatOf(h)].occ) seats[seatOf(h)].occ = { kind: 'assistant', owner: h.owner, a: h.a };
    const dup = names.filter((n) => n === names[i]).length > 1;
    return { key: k, level: i + 1, title: dup && k ? shortPath(k) : names[i], color: projectColor(k), desks, seats };
  });
}

/** 這層的提示：有人等你處理 > 有人輪到你 > 無。助理不算 */
export function floorAlert(f: Floor): Alert {
  const has = (s: Employee['status']) => f.seats.some((x) => x.occ?.kind === 'employee' && x.occ.emp.status === s);
  return has('waiting') ? 'waiting' : has('idle') ? 'idle' : null;
}

/** 桌上名牌的字與底色：員工是標題加狀態前綴，助理是「↳ 種類 · 描述」，做完顯示「↳ ✓ 完成」 */
export function plateText(o: Occupant): { text: string; tone: PlateTone } {
  if (o.kind === 'employee') return { text: platePrefix(o.emp) + nameplate(o.emp), tone: o.emp.status };
  if (o.a.status === 'done') return { text: '↳ ✓ 完成', tone: 'done' };
  const desc = oneLine(o.a.description);
  return { text: '↳ ' + (desc ? (o.a.kind ? `${o.a.kind} · ${desc}` : desc) : '助理'), tone: 'assistant' };
}
