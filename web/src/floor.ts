// 一層樓：後牆、地板、樓板、左邊電梯門（門上樓號）、後牆招牌「NF 專案名」、一排正面桌與名牌。人物由 building.ts 放進 people 圖層
import { deskFront, type DeskState } from './flat.js';
import { edgeHints, floorWidth, GEO, helperKey, plateText, seatCenter, type EdgeHint, type Floor, type Occupant } from './floors.js';
import { placeImg, spriteImg } from './sprites.js';

export const DESK_SCALE = 1.25; // 正面桌素材寬 80 → 100px
export const DESK_Y = 126; // 桌子素材原點（左上）的 y：桌面在 143.5、桌腳到 176

const deskState = (o: Occupant | null): DeskState => {
  if (!o) return 'empty';
  if (o.kind === 'assistant') return o.a.status === 'working' ? 'working' : 'empty';
  return o.emp.status;
};
/** 人物元素的 data-key：員工是 sessionId，助理是 helperKey */
export const occKey = (o: Occupant): string => (o.kind === 'employee' ? o.emp.sessionId : helperKey({ owner: o.owner, a: o.a }));

interface DeskEl { el: HTMLElement; img: HTMLImageElement; plate: HTMLElement; text: HTMLElement }

export const div = (cls: string): HTMLDivElement => {
  const n = document.createElement('div');
  n.className = cls;
  return n;
};

const reduceMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 看不到的人在等你：貼在樓層可見的左右緣，文字「! N ›」「‹ ✓ N」（waiting 紅、idle 琥珀） */
class EdgeBtn {
  readonly el = document.createElement('button');
  target = -1;
  private key = '';
  constructor(private side: 'left' | 'right') {
    this.el.type = 'button';
    this.el.hidden = true;
  }
  set(h: EdgeHint | null): void {
    this.el.hidden = !h;
    const key = h ? `${h.status}/${h.count}/${h.target}` : '';
    if (key === this.key) return;
    this.key = key;
    if (!h) return;
    this.target = h.target;
    const t = `${h.status === 'waiting' ? '!' : '✓'} ${h.count}`;
    this.el.textContent = this.side === 'right' ? `${t} ›` : `‹ ${t}`;
    this.el.className = `edge-hint ${this.side} ${h.status}`;
    this.el.title = `${h.count} 位${h.status === 'waiting' ? '等你處理' : '輪到你了'}，點了捲過去`;
  }
}

export class FloorView {
  /** 外層：不捲動，放暗影與邊緣提示（疊在可見範圍的左右緣）；內容由 scroller 左右捲 */
  readonly el = div('floor');
  private scroller = div('floor-scroll');
  private shadeL = div('shade left');
  private shadeR = div('shade right');
  private hintL = new EdgeBtn('left');
  private hintR = new EdgeBtn('right');
  private raf = 0;
  readonly people = div('people');
  private inner = div('floor-in');
  private sign = div('sign');
  private doorNum = div('door-num');
  private deskRow = div('desks');
  private desks: DeskEl[] = [];
  private f: Floor | null = null;

  constructor(hooks: { hover(o: Occupant, at: DOMRect): void; unhover(): void }) {
    const elev = div('elevator');
    elev.append(this.doorNum, div('door'));
    this.inner.append(div('wall'), div('ground-strip'), div('slab'), elev, this.sign, this.people, this.deskRow);
    this.scroller.append(this.inner);
    this.el.append(this.scroller, this.shadeL, this.shadeR, this.hintL.el, this.hintR.el);
    // 內容座標（電梯區從 0 開始）與 seatCenter 同一套；一次只讀一次版面
    this.scroller.addEventListener('scroll', () => this.refreshEdges(), { passive: true });
    new ResizeObserver(() => this.schedule()).observe(this.scroller);
    for (const h of [this.hintL, this.hintR]) h.el.addEventListener('click', () => this.scrollToSeat(h.target));
    // 滑過人物：依 data-key 找這層目前的佔用者
    const personOf = (t: EventTarget | null): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>('.person') : null);
    this.people.addEventListener('mouseover', (ev) => {
      const p = personOf(ev.target);
      if (!p || p.contains(ev.relatedTarget as Node | null)) return;
      const o = this.f?.seats.find((s) => s.occ && occKey(s.occ) === p.dataset.key)?.occ;
      if (o) hooks.hover(o, p.getBoundingClientRect());
    });
    this.people.addEventListener('mouseout', (ev) => {
      const p = personOf(ev.target);
      if (!p || p.contains(ev.relatedTarget as Node | null)) return;
      hooks.unhover();
    });
  }

  update(f: Floor, avail: number): void {
    this.f = f;
    this.el.dataset.key = f.key;
    this.inner.style.width = `${floorWidth(f.desks, avail)}px`;
    this.sign.textContent = `${f.level}F ${f.title}`;
    this.sign.title = f.key || f.title;
    this.sign.style.backgroundColor = `${f.color}e6`; // 專案色，不透明度 0.9
    this.doorNum.textContent = String(f.level);
    while (this.desks.length > f.desks) this.desks.pop()!.el.remove();
    while (this.desks.length < f.desks) {
      const el = div('desk'), img = document.createElement('img'), plate = div('plate'), text = document.createElement('span');
      img.alt = '';
      img.draggable = false;
      plate.append(text);
      el.append(img, plate);
      el.style.left = `${seatCenter(this.desks.length) - GEO.seatW / 2}px`; // 一格寬 120
      this.deskRow.append(el);
      this.desks.push({ el, img, plate, text });
    }
    f.seats.forEach((s, i) => {
      const d = this.desks[i]!;
      const st = deskState(s.occ);
      placeImg(d.img, spriteImg(`desk-${st}`, () => deskFront(st), DESK_SCALE), GEO.seatW / 2 - 40 * DESK_SCALE, DESK_Y);
      d.plate.hidden = !s.occ;
      if (!s.occ) return;
      const { text, tone } = plateText(s.occ);
      d.plate.className = `plate ${tone}`;
      d.text.textContent = text;
    });
    this.schedule(); // 寬度或狀態變了不會有 scroll 事件；等這一輪的寫入做完再讀版面
  }

  /** 平滑捲到讓第 i 個座位在這層可見範圍的正中間 */
  scrollToSeat(i: number): void {
    const s = this.scroller;
    s.scrollTo({ left: seatCenter(i) - s.clientWidth / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  private schedule(): void {
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.refreshEdges(); });
  }

  private refreshEdges(): void {
    const s = this.scroller, f = this.f;
    if (!f || !s.clientWidth) return;
    const left = s.scrollLeft, right = left + s.clientWidth;
    this.shadeL.hidden = left <= 0;
    this.shadeR.hidden = right >= s.scrollWidth - 1;
    const h = edgeHints(f, { left, right });
    this.hintL.set(h.left);
    this.hintR.set(h.right);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }
}

/** 沒有人上班：一層空的大廳，中間兩行提示 */
export function lobby(): HTMLElement {
  const el = div('floor lobby'), inner = div('floor-in'), elev = div('elevator'), msg = div('lobby-msg');
  const num = div('door-num');
  num.textContent = '1';
  elev.append(num, div('door'));
  const a = document.createElement('b'), b = document.createElement('span');
  a.textContent = '目前沒有人上班';
  b.textContent = '開一個 Claude Code session 就會出現';
  msg.append(a, b);
  inner.append(div('wall'), div('ground-strip'), div('slab'), elev, msg);
  el.append(inner);
  return el;
}
