// 整棟大樓：天空（白天太陽白雲、夜晚月牙星星）、屋頂、樓層（最高樓在上、1F 在下）、地面人行道；沒人時是空大廳。store 每個事件都重算 floorPlan，差異套到既有的樓層與人物
import type { Employee } from '../../src/state/types.js';
import { InfoCard } from './card.js';
import type { ElevatorPanel } from './elevator.js';
import { div, FloorView, lobby } from './floor.js';
import { atBottom, buildingPlan, floorAlert, GEO, helperKey, helperRoster, seatCenter, type Floor, type Helper, type HelperTrack, type Occupant } from './floors.js';
import { Person, type Act } from './person.js';
import { shouldCheer } from './pose.js';
import type { OfficeStore } from './sync.js';
import { appearance } from './view.js';

const ACT: Record<Employee['status'], Act> = { working: 'work', waiting: 'up', idle: 'idle' };
const STAND_MS = 300; // 坐著要走之前先站起來多久

/** 在座位上或走在路上的人。occ = 上次套用的資料；x = 座位中心（走路的目的地）；out = 已走出電梯（或直接放好），false 時還藏在電梯裡等門開 */
interface Rec { p: Person; floor: string; occ?: Occupant; x: number; out: boolean }
/** 下班走去電梯的人。gone = 已進電梯（人物已移除），等門關好才拆那層 */
interface Leaving { occ: Occupant; p: Person; floor: string; gone: boolean }
/** 一群人：真員工依 sessionId、助理依 helperKey，分成兩群各自的 Map，兩種 key 不會撞在一起 */
interface Crowd { kind: Occupant['kind']; people: Map<string, Rec>; leaving: Map<string, Leaving> }
const crowd = (kind: Occupant['kind']): Crowd => ({ kind, people: new Map(), leaving: new Map() });

/** 星星：[左緣 %, 離天空底部 px]（白雲 c1~c3 的位置在 CSS）；日夜由 CSS 依 data-time 顯示 */
const STARS: [number, number][] = [[13, 42], [25, 12], [37, 34], [49, 18], [62, 30], [74, 8], [92, 44]];

/** 天空：太陽、白雲、月牙、星星（造型都在 CSS） */
function sky(): HTMLElement {
  const el = div('sky');
  el.append(div('sun'), div('cloud c1'), div('cloud c2'), div('cloud c3'), div('moon'));
  for (const [x, y] of STARS) {
    const s = div('star');
    s.style.left = `${x}%`;
    s.style.bottom = `${y}px`;
    el.append(s);
  }
  return el;
}

/** 最高樓上面的屋頂：女兒牆、水塔、冷氣機、閃燈天線（造型都在 CSS） */
function roof(): HTMLElement {
  const el = div('roof');
  el.append(div('antenna'), div('ac'), div('tank'), div('parapet'));
  return el;
}

/** 讓這層樓留著的人：員工自己、助理的主人 */
const ownerOf = (o: Occupant): Employee => (o.kind === 'employee' ? o.emp : o.owner);
/** 同一份資料（員工看物件、助理看助理與主人），沒變就不重畫卡片 */
const same = (a: Occupant | undefined, b: Occupant): boolean =>
  !!a && (a.kind === 'employee' ? b.kind === 'employee' && a.emp === b.emp : b.kind === 'assistant' && a.a === b.a && a.owner === b.owner);

export class Building {
  private stack = div('floors');
  private empty = lobby();
  private floors = new Map<string, FloorView>(); // 依 floor key
  private staff = crowd('employee'); // 真員工；leaving = store 已經沒有這個人
  private helpers = crowd('assistant'); // 助理（主人那層的員工）
  private track = new Map<string, HelperTrack>(); // 在大樓裡的助理（helperRoster 的 stay）
  private gone = new Set<string>(); // 已送走、但還列在主人清單上的助理
  private helperSeats = new Map<string, number>(); // 上次的助理座位，下次分配的 prev
  private minDesks = new Map<string, number>(); // 依 floor key（roomKey）：這層至少要留的桌數，人走了桌子不收，拆樓才刪
  private lingerT: ReturnType<typeof setTimeout> | undefined; // 最早一位完成的助理該走的時間
  private card = new InfoCard();
  private scrolled = false; // 第一次 reset 後是否已捲到底
  private live = false; // 第一次 reset 之後，新來的人才搭電梯走進來
  private sig = ''; // 上次的樓層 key 順序（字串，比對有沒有變）
  private order: string[] = []; // 上次的樓層 key 順序（1F 在前），下次排樓層時還在的樓層維持這個順序

  constructor(root: HTMLElement, private store: OfficeStore, private panel: ElevatorPanel) {
    root.replaceChildren(sky(), roof(), this.stack, div('ground'));
    store.on((c) => {
      if (c.type === 'reset') this.clearPeople();
      else if (c.type === 'leave') this.leave(this.staff, c.sessionId);
      this.render(c.type !== 'reset' && this.live);
      if (c.type === 'reset') this.live = true;
      // 打開頁面（第一次載入完成）捲到最底看 1F；之後重連的 reset 不動使用者的捲動位置
      if (c.type === 'reset' && !this.scrolled) {
        this.scrolled = true;
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    });
    // 視窗變寬變窄、或直向捲軸出現時，樓層寬跟著重算
    let w = -1;
    new ResizeObserver(() => {
      const a = this.avail();
      if (a !== w) { w = a; this.render(); }
    }).observe(this.stack);
    // 頁面或任何樓層捲動時，卡片的位置就不對了，先藏起來
    document.addEventListener('scroll', () => this.card.hide(), true);
    this.render();
  }

  /** 樓層可用寬 = 視窗寬（不含捲軸）− 左邊電梯面板 − 右邊距 */
  private avail(): number {
    return Math.max(0, document.documentElement.clientWidth - GEO.gutter - GEO.rightMargin);
  }

  /** animate：新來的人搭電梯走進來（reset 與第一次載入時直接坐好） */
  private render(animate = this.live): void {
    const emps = [...this.store.employees.values()];
    const helpers = this.rollCall(emps);
    // 走去電梯的人（含走出去的助理的主人）也算進樓層（最後一人進電梯前不拆），但座位已空
    const going = new Map<string, Employee>();
    for (const c of [this.staff, this.helpers]) {
      for (const l of c.leaving.values()) {
        const e = ownerOf(l.occ);
        if (!this.store.employees.has(e.sessionId)) going.set(e.sessionId, e);
      }
    }
    const next = buildingPlan(emps, [...going.values()], helpers, this.helperSeats, this.minDesks, this.order);
    const plan = next.plan;
    this.helperSeats = next.helperSeats;
    this.minDesks = next.minDesks;
    // 樓層增減或換順序才需要穩住畫面（只在這時讀版面）；瀏覽器在 scrollY 0 不會自己錨定，所以全部自己做
    const order = plan.map((f) => f.key), sig = order.join('\n'), changed = sig !== this.sig;
    this.sig = sig;
    this.order = order;
    const root = document.documentElement;
    const stick = changed && atBottom(window.scrollY, root.scrollHeight, window.innerHeight);
    // 不在最底：記住第一個看得到的樓層（狀態列之下）的位置
    let anchor: { el: HTMLElement; top: number } | null = null;
    if (changed && !stick) {
      const bar = document.getElementById('top')?.getBoundingClientRect().bottom ?? 0;
      for (const v of this.floors.values()) {
        const r = v.el.getBoundingClientRect();
        if (r.bottom > bar && (!anchor || r.top < anchor.top)) anchor = { el: v.el, top: r.top };
      }
    }
    this.layoutFloors(plan);
    if (stick) window.scrollTo(0, root.scrollHeight);
    else if (anchor?.el.isConnected) window.scrollBy(0, anchor.el.getBoundingClientRect().top - anchor.top);
    this.placePeople(plan, animate);
    this.panel.update(plan.map((f) => ({ level: f.level, title: f.title, alert: floorAlert(f), el: this.floors.get(f.key)!.el })));
  }

  private layoutFloors(plan: Floor[]): void {
    const keep = new Set(plan.map((f) => f.key));
    for (const [k, v] of this.floors) if (!keep.has(k)) { v.destroy(); this.floors.delete(k); }
    const avail = this.avail();
    // DOM 由上到下 = 樓號由大到小；位置對了就不搬（搬動會重設該層的左右捲動）
    let prev: Element | null = null;
    for (const f of [...plan].reverse()) {
      let v = this.floors.get(f.key);
      if (!v) {
        v = new FloorView({
          hover: (o, r) => {
            if (o.kind === 'employee') this.card.show(o.emp, r.right + 4, r.top - 40);
            else this.card.showHelper(o.owner, o.a, r.right + 4, r.top - 40);
          },
          unhover: () => this.card.scheduleHide(),
        });
        this.floors.set(f.key, v);
      }
      v.update(f, avail);
      const want: ChildNode | null = prev ? prev.nextSibling : this.stack.firstChild;
      if (v.el !== want) this.stack.insertBefore(v.el, want);
      prev = v.el;
    }
    if (!plan.length) this.stack.append(this.empty);
    else this.empty.remove();
  }

  /** 助理點名：誰在大樓裡（工作中、完成後停留中），該走的走回電梯；時間到再 render 一次 */
  private rollCall(emps: Employee[]): Helper[] {
    const now = performance.now();
    const r = helperRoster(this.track, this.gone, emps, now);
    this.track = r.stay;
    this.gone = r.gone;
    for (const k of r.out) this.leave(this.helpers, k);
    clearTimeout(this.lingerT);
    this.lingerT = r.next === null ? undefined : setTimeout(() => this.render(), r.next - now);
    return [...r.stay.values()].map(({ owner, a }) => ({ owner, a }));
  }

  /** 這群人裡誰的卡片正打開著 */
  private shown(c: Crowd, id: string): boolean {
    return (c.kind === 'employee' ? this.card.id : this.card.helper) === id;
  }

  private placePeople(plan: Floor[], animate: boolean): void {
    const seen = { employee: new Set<string>(), assistant: new Set<string>() };
    for (const f of plan) {
      const v = this.floors.get(f.key)!;
      for (const s of f.seats) {
        const o = s.occ;
        if (!o) continue;
        const c = o.kind === 'employee' ? this.staff : this.helpers;
        const id = o.kind === 'employee' ? o.emp.sessionId : helperKey({ owner: o.owner, a: o.a });
        const x = seatCenter(s.index);
        seen[o.kind].add(id);
        let rec = c.people.get(id);
        if (!rec) {
          rec = this.comeBack(c, id, f.key);
          if (!rec) {
            const p = new Person(appearance(id));
            p.el.dataset.key = id; // 與 floor.ts 的 occKey 同一套
            if (o.kind === 'assistant') p.el.dataset.kind = 'assistant'; // 助理縮小 0.85 倍（figure.css）
            rec = { p, floor: '', x, out: false };
          }
          c.people.set(id, rec); // 先登記再搭電梯：開門回呼用 people 判斷是不是同一個人
          if (animate && !rec.out) this.enter(c, id, rec, v, f.key);
        }
        if (rec.floor !== f.key || rec.p.el.parentElement !== v.people) {
          // 第一次出現（不播動畫）或換了樓層：直接放到座位
          v.people.append(rec.p.el);
          rec.floor = f.key;
          rec.p.el.hidden = false;
          rec.out = true;
          rec.x = x;
          rec.p.placeAt(x);
        } else if (!rec.out) rec.x = x; // 還在電梯裡：出來後走去最新的座位
        else if (rec.x !== x) {
          rec.x = x;
          this.walk(rec);
        }
        // 只在這個人的資料變了才重畫卡片
        if (this.shown(c, id) && !same(rec.occ, o)) {
          if (o.kind === 'employee') this.card.fill(o.emp);
          else this.card.fillHelper(o.owner, o.a);
        }
        // 工作中變輪到你才歡呼（要在更新 rec.occ 之前比；走路中的人不歡呼）
        const cheer = o.kind === 'employee' && rec.occ?.kind === 'employee' && shouldCheer(rec.occ.emp.status, o.emp.status);
        rec.occ = o;
        if (rec.out && !rec.p.moving) this.settle(rec, cheer); // 走路中的狀態變化到座位再套用
      }
    }
    for (const c of [this.staff, this.helpers]) {
      for (const [id, rec] of c.people) {
        if (seen[c.kind].has(id)) continue;
        rec.p.destroy();
        c.people.delete(id);
        if (this.shown(c, id)) this.card.hide();
      }
    }
  }

  /** 坐下（或站著）：依最新狀態擺姿勢與泡泡。助理不舉手、沒有泡泡：工作中打字、完成就閒著。cheer：這次剛從工作中變輪到你 */
  private settle(rec: Rec, cheer = false): void {
    const o = rec.occ;
    if (!o) return;
    if (o.kind === 'assistant') {
      if (o.a.status === 'done') {
        rec.p.setAct('idle');
        rec.p.pose.still(null); // 之後換成遞文件
      } else {
        rec.p.setAct('work');
        rec.p.pose.work(null);
      }
      rec.p.setBubble(false);
      return;
    }
    rec.p.setAct(ACT[o.emp.status]);
    rec.p.setBubble(o.emp.status === 'idle');
    if (o.emp.status === 'working') rec.p.pose.work(o.emp.toolKind);
    else if (o.emp.status === 'waiting') rec.p.pose.up();
    else if (cheer) rec.p.pose.cheer();
    else rec.p.pose.idle();
  }

  /** 走去 rec.x（坐著的先站起來；走路中直接轉向），到了坐下 */
  private walk(rec: Rec): void {
    rec.p.setBubble(false);
    rec.p.walkTo(rec.x, () => this.settle(rec), rec.p.moving ? 0 : STAND_MS);
  }

  /** 上班：人先藏在電梯裡，門開好才從門口走出來 */
  private enter(c: Crowd, id: string, rec: Rec, v: FloorView, key: string): void {
    rec.p.el.hidden = true;
    v.people.append(rec.p.el);
    rec.floor = key;
    void v.openDoor(() => {
      if (c.people.get(id) !== rec || rec.out) return; // 等門時已經下班、換樓層或重新連線
      rec.out = true;
      rec.p.el.hidden = false;
      rec.p.placeAt(v.doorX);
      rec.p.setBubble(false);
      rec.p.walkTo(rec.x, () => this.settle(rec)); // 一出電梯就走，不必先站起來
    });
  }

  /** 下班（助理：完成後停留到時、工作中消失、主人下班）：站起來走回電梯，門開了進去，門關好才把他從樓層拿掉（那層沒人才拆） */
  private leave(c: Crowd, id: string): void {
    const rec = c.people.get(id);
    if (!rec) return;
    c.people.delete(id);
    if (this.shown(c, id)) this.card.hide();
    const v = this.floors.get(rec.floor);
    if (!rec.out || !rec.occ || !v) {
      rec.p.destroy(); // 還沒走出電梯：直接不見
      return;
    }
    const lv: Leaving = { occ: rec.occ, p: rec.p, floor: rec.floor, gone: false };
    c.leaving.set(id, lv);
    const mine = () => c.leaving.get(id) === lv; // 回頭上班或重新連線後，這趟下班就作廢
    rec.p.setBubble(false);
    rec.p.walkTo(v.doorX, () => {
      void v.openDoor(() => {
        if (!mine()) return;
        lv.gone = true;
        lv.p.destroy();
      }).then(() => {
        if (!mine()) return;
        c.leaving.delete(id);
        this.render();
      });
    }, rec.p.moving ? 0 : STAND_MS);
  }

  /** 下班途中又上班（同一個 key 又出現在座位上）：還沒進電梯就從目前位置走回座位 */
  private comeBack(c: Crowd, id: string, key: string): Rec | undefined {
    const lv = c.leaving.get(id);
    if (!lv) return undefined;
    c.leaving.delete(id);
    if (!lv.gone && lv.floor === key) return { p: lv.p, floor: key, occ: lv.occ, x: NaN, out: true }; // x NaN：一定會 walk
    lv.p.destroy(); // 已進電梯或換了樓層：重新來過
    return undefined;
  }

  /** 重新連線：所有人物（含正在下班的）與計時器都清掉、電梯門直接關上，接著的 render 會把大家直接放回座位（完成的助理從現在重新計時） */
  private clearPeople(): void {
    for (const c of [this.staff, this.helpers]) {
      for (const r of c.people.values()) r.p.destroy();
      for (const l of c.leaving.values()) l.p.destroy();
      c.people.clear();
      c.leaving.clear();
    }
    clearTimeout(this.lingerT);
    this.lingerT = undefined;
    this.track.clear();
    this.gone.clear();
    for (const v of this.floors.values()) v.shutDoor();
    if (this.card.helper || (this.card.id && !this.store.employees.has(this.card.id))) this.card.hide();
  }
}
