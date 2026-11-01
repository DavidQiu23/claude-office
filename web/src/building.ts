// 整棟大樓：天空（白天太陽白雲、夜晚月牙星星）、屋頂、樓層（最高樓在上、1F 在下）、地面人行道；沒人時是空大廳。store 每個事件都重算 floorPlan，差異套到既有的樓層與人物
import type { Employee } from '../../src/state/types.js';
import { InfoCard } from './card.js';
import type { ElevatorPanel } from './elevator.js';
import { div } from './dom.js';
import { FloorView, lobby } from './floor.js';
import { atBottom, buildingPlan, buildingWidth, floorAlert, GEO, seatCenter, type Floor } from './floors.js';
import { Person, type Act } from './person.js';
import type { OfficeStore } from './sync.js';
import { appearance } from './view.js';

const ACT: Record<Employee['status'], Act> = { working: 'work', waiting: 'up', idle: 'idle' };

/** 坐在座位上的人。emp = 上次套用的資料 */
interface Rec { p: Person; floor: string; emp: Employee }
/** 正在退場的人：座位已空，等「辛苦了～」淡出才移除人物（那層最後一人時才拆樓） */
interface Leaving { emp: Employee; p: Person; floor: string }

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

export class Building {
  private stack = div('floors');
  private empty = lobby();
  private floors = new Map<string, FloorView>(); // 依 floor key
  private people = new Map<string, Rec>(); // 依 sessionId
  private leaving = new Map<string, Leaving>(); // 正在退場、store 已經沒有的人
  private minW = ''; // 上次寫進 body 的最小寬度，沒變就不寫
  private minDesks = new Map<string, number>(); // 依 floor key（roomKey）：這層至少要留的桌數，人走了桌子不收，拆樓才刪
  private card = new InfoCard();
  private scrolled = false; // 第一次 reset 後是否已捲到底
  private live = false; // 第一次 reset 之後，新來的人才播登場
  private sig = ''; // 上次的樓層 key 順序（字串，比對有沒有變）
  private order: string[] = []; // 上次的樓層 key 順序（1F 在前），下次排樓層時還在的樓層維持這個順序

  constructor(root: HTMLElement, private store: OfficeStore, private panel: ElevatorPanel) {
    root.replaceChildren(sky(), roof(), this.stack, div('ground'));
    store.on((c) => {
      if (c.type === 'reset') this.clearPeople();
      else if (c.type === 'leave') this.leave(c.sessionId);
      this.render(c.type !== 'reset' && this.live);
      if (c.type === 'reset') this.live = true;
      // 打開頁面（第一次載入完成）捲到最底看 1F；之後重連的 reset 不動使用者的捲動位置
      if (c.type === 'reset' && !this.scrolled) {
        this.scrolled = true;
        window.scrollTo({ top: document.documentElement.scrollHeight }); // 沒給 left：不動橫向捲動位置
      }
    });
    // 視窗變寬變窄、或直向捲軸出現時，樓層寬跟著重算；觀察 <html>，因為樓層變寬後 .floors 不再跟著視窗變。
    // 狀態列寬（--view-w）只跟視窗寬有關，也在這裡更新
    let w = -1;
    new ResizeObserver(() => {
      const a = this.avail();
      if (a === w) return;
      w = a;
      document.documentElement.style.setProperty('--view-w', `${document.documentElement.clientWidth}px`);
      this.render();
    }).observe(document.documentElement);
    // 頁面捲動時，卡片的位置就不對了，先藏起來
    document.addEventListener('scroll', () => this.card.hide(), true);
    this.render();
  }

  /** 樓層可用寬 = 視窗寬（不含捲軸）− 左邊電梯面板 − 右邊距 */
  private avail(): number {
    return Math.max(0, document.documentElement.clientWidth - GEO.gutter - GEO.rightMargin);
  }

  /** animate：新來的人播登場「到！」（reset 與第一次載入時直接坐好） */
  private render(animate = this.live): void {
    const emps = [...this.store.employees.values()];
    // 正在退場的人也算進樓層（最後一人淡出前不拆），但座位已空
    const going = [...this.leaving.values()].map((l) => l.emp).filter((e) => !this.store.employees.has(e.sessionId));
    const next = buildingPlan(emps, going, this.minDesks, this.order);
    const plan = next.plan;
    this.minDesks = next.minDesks;
    // 樓層增減或換順序才需要穩住畫面（只在這時讀版面）；瀏覽器在 scrollY 0 不會自己錨定，所以全部自己做
    const order = plan.map((f) => f.key), sig = order.join('\n'), changed = sig !== this.sig;
    this.sig = sig;
    this.order = order;
    const root = document.documentElement;
    const stick = changed && atBottom(window.scrollY, root.scrollHeight, root.clientHeight); // clientHeight 不含橫向捲軸
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
    if (stick) window.scrollTo({ top: root.scrollHeight }); // 沒給 left：不動橫向捲動位置
    else if (anchor?.el.isConnected) window.scrollBy(0, anchor.el.getBoundingClientRect().top - anchor.top);
    this.placePeople(plan, animate);
    this.panel.update(plan.map((f) => ({ level: f.level, title: f.title, alert: floorAlert(f), el: this.floors.get(f.key)!.el })));
  }

  private layoutFloors(plan: Floor[]): void {
    const keep = new Set(plan.map((f) => f.key));
    for (const [k, v] of this.floors) if (!keep.has(k)) { v.destroy(); this.floors.delete(k); }
    // 各層同寬；放不下時整棟樓變寬（body 撐開、整頁橫向捲動），狀態列由 --view-w 維持視窗寬
    const width = buildingWidth(plan, this.avail());
    const minW = `${width + GEO.gutter + GEO.rightMargin}px`;
    if (minW !== this.minW) document.body.style.minWidth = this.minW = minW;
    // DOM 由上到下 = 樓號由大到小；位置對了就不搬
    let prev: Element | null = null;
    for (const f of [...plan].reverse()) {
      let v = this.floors.get(f.key);
      if (!v) {
        v = new FloorView({
          hover: (e, r) => this.card.show(e, r.right + 4, r.top - 40),
          unhover: () => this.card.scheduleHide(),
        });
        this.floors.set(f.key, v);
      }
      v.update(f, width);
      const want: ChildNode | null = prev ? prev.nextSibling : this.stack.firstChild;
      if (v.el !== want) this.stack.insertBefore(v.el, want);
      prev = v.el;
    }
    if (!plan.length) this.stack.append(this.empty);
    else this.empty.remove();
  }

  private placePeople(plan: Floor[], animate: boolean): void {
    const seen = new Set<string>();
    for (const f of plan) {
      const v = this.floors.get(f.key)!;
      for (const s of f.seats) {
        const e = s.occ;
        if (!e) continue;
        const id = e.sessionId;
        seen.add(id);
        let rec = this.people.get(id);
        const before = rec?.emp; // 新來或剛回來的人沒有上一份資料
        if (!rec) {
          rec = this.comeBack(id, f.key);
          if (!rec) {
            const p = new Person(appearance(id));
            p.el.dataset.key = id; // floor.ts 依 data-key 找這個座位的員工
            rec = { p, floor: '', emp: e };
            if (animate) p.enter(); // 第一次載入與重新連線時直接坐好
          }
          this.people.set(id, rec);
        }
        if (rec.floor !== f.key || rec.p.el.parentElement !== v.people) {
          v.people.append(rec.p.el);
          rec.floor = f.key;
        }
        rec.p.placeAt(seatCenter(s.index));
        // 只在這個人的資料變了才重畫卡片
        if (this.card.id === id && before !== e) this.card.fill(e);
        rec.emp = e;
        rec.p.setAct(ACT[e.status]);
      }
    }
    for (const [id, rec] of this.people) {
      if (seen.has(id)) continue;
      rec.p.destroy();
      this.people.delete(id);
      if (this.card.id === id) this.card.hide();
    }
  }

  /** 下班：座位立刻空出來，人冒「辛苦了～」淡出後才移除（那層沒人才拆） */
  private leave(id: string): void {
    const rec = this.people.get(id);
    if (!rec) return;
    this.people.delete(id);
    if (this.card.id === id) this.card.hide();
    const lv: Leaving = { emp: rec.emp, p: rec.p, floor: rec.floor };
    this.leaving.set(id, lv);
    rec.p.exit(() => {
      if (this.leaving.get(id) !== lv) return; // 回頭上班或重新連線後，這趟下班就作廢
      this.leaving.delete(id);
      lv.p.destroy();
      this.render();
    });
  }

  /** 退場中又上班（同一個 sessionId 又出現在座位上）：同一層就停掉退場、留在座位；換了樓層就重新來過 */
  private comeBack(id: string, key: string): Rec | undefined {
    const lv = this.leaving.get(id);
    if (!lv) return undefined;
    this.leaving.delete(id);
    if (lv.floor === key) {
      lv.p.cancelExit();
      return { p: lv.p, floor: key, emp: lv.emp };
    }
    lv.p.destroy();
    return undefined;
  }

  /** 重新連線：所有人物（含正在退場的）清掉，接著的 render 會把大家直接放回座位 */
  private clearPeople(): void {
    for (const r of this.people.values()) r.p.destroy();
    for (const l of this.leaving.values()) l.p.destroy();
    this.people.clear();
    this.leaving.clear();
    if (this.card.id && !this.store.employees.has(this.card.id)) this.card.hide();
  }
}
