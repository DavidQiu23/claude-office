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

/**
 * 一個專案（cwd）一層樓，1F 在 index 0。minDesks：該層至少要留的桌數（人走了桌子不收，由呼叫端記）。
 * prevOrder：上一次的樓層 key（1F 在前）。還在的樓層維持原本的相對順序（只有整層走光時上面才往下遞補），新樓層蓋在最上面；沒有 prevOrder（第一次、重新連線）就全部算新樓層
 */
export function floorPlan(employees: Employee[], helpers: Helper[], helperSeats: ReadonlyMap<string, number>, minDesks: ReadonlyMap<string, number>, prevOrder: readonly string[] = []): Floor[] {
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

/**
 * 助理座位：只處理主人還在的 helper。
 * 先保留 prev 的座位（沒被同專案真員工、已保留的助理佔用），其餘依 helpers 順序坐主人右邊第一張空桌，
 * 沒有空桌就接在目前桌數之後。回傳只含這次的 helper。
 */
export function assignAssistantSeats(prev: ReadonlyMap<string, number>, employees: Employee[], helpers: Helper[]): Map<string, number> {
  const out = new Map<string, number>();
  const real = new Map<string, Set<number>>();
  const taken = new Map<string, Set<number>>();
  const setOf = (m: Map<string, Set<number>>, k: string): Set<number> => {
    let s = m.get(k);
    if (!s) m.set(k, (s = new Set()));
    return s;
  };
  for (const e of employees) setOf(real, roomKey(e)).add(e.seat);
  const mine = helpers.flatMap((h) => {
    const owner = employees.find((e) => e.sessionId === h.owner.sessionId);
    return owner ? [{ key: helperKey(h), owner, room: roomKey(owner) }] : [];
  });
  const pending: typeof mine = [];
  for (const m of mine) {
    const s = prev.get(m.key);
    if (s !== undefined && !real.get(m.room)!.has(s) && !setOf(taken, m.room).has(s)) {
      out.set(m.key, s);
      taken.get(m.room)!.add(s);
    } else pending.push(m);
  }
  for (const m of pending) {
    const rs = real.get(m.room)!;
    const ts = setOf(taken, m.room);
    const limit = Math.max(...rs, ...ts) + 1; // 目前桌數
    let s = m.owner.seat + 1;
    while (s < limit && (rs.has(s) || ts.has(s))) s++;
    out.set(m.key, s);
    ts.add(s);
  }
  return out;
}

// ---- 助理在大樓裡的名單 ----
export const HELPER_LINGER = 3000; // 助理完成後停留多久（ms）才走回電梯

/** 一位在大樓裡的助理：owner 是最新的主人資料，doneAt = 第一次看到 done 的時間（工作中為 null） */
export interface HelperTrack { owner: Employee; a: Assistant; doneAt: number | null }
/** stay：這次坐在大樓裡的（依 helperKey）；out：上次在、這次要走回電梯的；gone：已經送走、但還列在主人清單上的（不再放進來）；next：最早到期的時間，沒有則 null */
export interface Roster { stay: Map<string, HelperTrack>; out: string[]; gone: Set<string>; next: number | null }

/**
 * 誰在大樓裡：主人清單上工作中的 ＋ done 後 linger 內的（含已從清單清掉的）。
 * 時間到、工作中卻從清單消失、或主人不在了，就放進 out。
 */
export function helperRoster(prev: ReadonlyMap<string, HelperTrack>, gone: ReadonlySet<string>, employees: Employee[], now: number, linger = HELPER_LINGER): Roster {
  const stay = new Map<string, HelperTrack>(), out: string[] = [], still = new Set<string>(), seen = new Set<string>();
  for (const owner of employees) {
    for (const a of owner.assistants) {
      const k = helperKey({ owner, a });
      seen.add(k);
      if (gone.has(k)) { still.add(k); continue; }
      const doneAt = a.status === 'done' ? (prev.get(k)?.doneAt ?? now) : null;
      if (doneAt !== null && now - doneAt >= linger) {
        still.add(k);
        if (prev.has(k)) out.push(k);
      } else stay.set(k, { owner, a, doneAt });
    }
  }
  for (const [k, t] of prev) {
    if (seen.has(k)) continue;
    const owner = employees.find((e) => e.sessionId === t.owner.sessionId);
    if (owner && t.doneAt !== null && now - t.doneAt < linger) stay.set(k, { ...t, owner });
    else out.push(k);
  }
  const ends = [...stay.values()].flatMap((t) => (t.doneAt === null ? [] : [t.doneAt + linger]));
  return { stay, out, gone: still, next: ends.length ? Math.min(...ends) : null };
}

export interface EdgeHint { status: 'waiting' | 'idle'; count: number; target: number } // target = 座位 index

/** 看不到（座位中心在可見範圍外）的真員工，左右兩側各自的提示：有 waiting 就 waiting，否則 idle；target 是離可見範圍最近的那位 */
export function edgeHints(f: Floor, view: { left: number; right: number }): { left: EdgeHint | null; right: EdgeHint | null } {
  const statusOf = (i: number): Employee['status'] => {
    const o = f.seats[i].occ;
    return o?.kind === 'employee' ? o.emp.status : 'working';
  };
  const side = (hidden: number[], nearest: (xs: number[]) => number): EdgeHint | null => {
    for (const status of ['waiting', 'idle'] as const) {
      const hit = hidden.filter((i) => statusOf(i) === status);
      if (hit.length) return { status, count: hit.length, target: nearest(hit) };
    }
    return null;
  };
  const emps = f.seats.filter((s) => s.occ?.kind === 'employee').map((s) => s.index);
  return {
    left: side(emps.filter((i) => seatCenter(i) < view.left), (xs) => Math.max(...xs)),
    right: side(emps.filter((i) => seatCenter(i) > view.right), (xs) => Math.min(...xs)),
  };
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
 * Building 每次 render 的樓層配置。going：走去電梯、store 已經沒有的人（含走出去的助理的主人），樓層留著但座位空出來；
 * 助理避開所有真員工的座位（含正在離開的，否則會被 vacate 一起清掉）。prevOrder 是上次 plan 的樓層 key。回傳的 helperSeats／minDesks 是下一次的輸入（拆掉的樓層從 minDesks 刪掉）
 */
export function buildingPlan(employees: Employee[], going: Employee[], helpers: Helper[], prevSeats: ReadonlyMap<string, number>, minDesks: ReadonlyMap<string, number>, prevOrder: readonly string[] = []):
  { plan: Floor[]; helperSeats: Map<string, number>; minDesks: Map<string, number> } {
  const all = withLeaving(employees, going);
  const helperSeats = assignAssistantSeats(prevSeats, all, helpers);
  const plan = vacate(floorPlan(all, helpers, helperSeats, minDesks, prevOrder), new Set(going.map((e) => e.sessionId)));
  return { plan, helperSeats, minDesks: new Map(plan.map((f) => [f.key, f.desks])) };
}

/** 走去電梯的人從座位拿掉：桌子變空、沒有名牌、不算電梯燈與邊緣提示，但樓層還在 */
export function vacate(plan: Floor[], ids: ReadonlySet<string>): Floor[] {
  if (!ids.size) return plan;
  return plan.map((f) => ({ ...f, seats: f.seats.map((s) => (s.occ?.kind === 'employee' && ids.has(s.occ.emp.sessionId) ? { ...s, occ: null } : s)) }));
}
