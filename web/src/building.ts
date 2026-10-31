// 整棟大樓：夜空、樓層（最高樓在上、1F 在下）、地面；沒人時是空大廳。store 每個事件都重算 floorPlan，差異套到既有的樓層與人物
import type { Employee } from '../../src/state/types.js';
import { InfoCard } from './card.js';
import type { ElevatorPanel } from './elevator.js';
import { div, FloorView, lobby } from './floor.js';
import { atBottom, floorAlert, floorPlan, GEO, seatCenter, type Floor } from './floors.js';
import { Person, type Act } from './person.js';
import type { OfficeStore } from './sync.js';
import { appearance } from './view.js';

const ACT: Record<Employee['status'], Act> = { working: 'work', waiting: 'up', idle: 'idle' };

export class Building {
  private stack = div('floors');
  private empty = lobby();
  private floors = new Map<string, FloorView>(); // 依 floor key
  private people = new Map<string, { p: Person; floor: string; emp?: Employee }>(); // 依 sessionId；emp = 上次套用的資料
  private card = new InfoCard();
  private scrolled = false; // 第一次 reset 後是否已捲到底
  private sig = ''; // 上次的樓層 key 順序

  constructor(root: HTMLElement, private store: OfficeStore, private panel: ElevatorPanel) {
    root.replaceChildren(div('sky'), this.stack, div('ground'));
    store.on((c) => {
      this.render();
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

  private render(): void {
    const emps = [...this.store.employees.values()];
    const plan = floorPlan(emps, [], new Map(), new Map());
    // 樓層增減或換順序才需要穩住畫面（只在這時讀版面）；瀏覽器在 scrollY 0 不會自己錨定，所以全部自己做
    const sig = plan.map((f) => f.key).join('\n'), changed = sig !== this.sig;
    this.sig = sig;
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
    this.placePeople(plan);
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
          hover: (o, r) => { if (o.kind === 'employee') this.card.show(o.emp, r.right + 4, r.top - 40); },
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

  private placePeople(plan: Floor[]): void {
    const seen = new Set<string>();
    for (const f of plan) {
      const v = this.floors.get(f.key)!;
      for (const s of f.seats) {
        if (s.occ?.kind !== 'employee') continue;
        const e = s.occ.emp, id = e.sessionId;
        seen.add(id);
        let rec = this.people.get(id);
        if (!rec) {
          const p = new Person(appearance(id));
          p.el.dataset.key = id;
          this.people.set(id, (rec = { p, floor: '' }));
        }
        if (rec.floor !== f.key || rec.p.el.parentElement !== v.people) {
          v.people.append(rec.p.el);
          rec.floor = f.key;
        }
        rec.p.placeAt(seatCenter(s.index));
        rec.p.setAct(ACT[e.status]);
        rec.p.setBubble(e.status === 'idle');
        if (this.card.id === id && rec.emp !== e) this.card.fill(e); // 只在這個人的資料變了才重畫卡片
        rec.emp = e;
      }
    }
    for (const [id, rec] of this.people) {
      if (seen.has(id)) continue;
      rec.p.destroy();
      this.people.delete(id);
      if (this.card.id === id) this.card.hide();
    }
  }
}
