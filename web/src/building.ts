// 整棟大樓：夜空、樓層（最高樓在上、1F 在下）、地面；沒人時是空大廳。store 每個事件都重算 floorPlan，差異套到既有的樓層與人物
import type { Employee } from '../../src/state/types.js';
import { InfoCard } from './card.js';
import { FloorView, lobby } from './floor.js';
import { floorPlan, GEO, seatCenter, type Floor } from './floors.js';
import { Person, type Act } from './person.js';
import type { OfficeStore } from './sync.js';
import { appearance } from './view.js';

const ACT: Record<Employee['status'], Act> = { working: 'work', waiting: 'up', idle: 'idle' };

const div = (cls: string): HTMLDivElement => {
  const n = document.createElement('div');
  n.className = cls;
  return n;
};

export class Building {
  private stack = div('floors');
  private empty = lobby();
  private floors = new Map<string, FloorView>(); // 依 floor key
  private people = new Map<string, { p: Person; floor: string; emp?: Employee }>(); // 依 sessionId；emp = 上次套用的資料
  private card = new InfoCard();

  constructor(root: HTMLElement, private store: OfficeStore) {
    root.replaceChildren(div('sky'), this.stack, div('ground'));
    store.on(() => this.render());
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
    this.layoutFloors(plan);
    this.placePeople(plan);
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
