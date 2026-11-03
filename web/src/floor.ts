// 一層樓：淺盒房間（天花板、後牆、木地板、兩側斜牆）、樓板、招牌「NF 專案名」、圓窗、一排椅子（在人後面）、正面桌與名牌、右端一組家具。人物由 building.ts 放進 people 圖層
import type { Employee } from '../../src/state/types.js';
import { GEO, plateText, seatCenter, type Floor } from './floors.js';
import { furnitureSet, layoutSet, SIGN_MAX_W, SIGN_X, windowView, windowXs } from './furniture.js';
import { DESK_CODE, GLASS, OBJECTS, PANO, ROOM_SIDE, type DeskState, type ObjectId } from './objects.js';
import { div, el } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIN_Y = 66; // 圓窗底邊：窗頂 14 與招牌同高，窗在坐著的人頭上
const FURN_Y = 156; // 家具的地板線：與人物腳底同一條（在桌子後面）
const DESK_ORIGIN = { x: GEO.seatW / 2, y: 192 }; // 桌子的原點（底邊中點）在桌子元素內的位置；桌面落在 y 143.5
const CHAIR_Y = 152; // 椅子底邊：下半被桌子擋住，椅背從人的肩膀兩側和頭旁邊露出來

/** <svg class="obj"><use href="#id"/></svg>，絕對定位成原點（物件底邊中點）在 (x, y)（父元素座標）。
 *  symbol 的 viewBox 是 `${-w/2} ${-h} ${w} ${h}`，所以外層 svg 用 0 0 w h、<use> 給 w×h，symbol 自己的 viewBox 就把原點對到底邊中點 */
export function useObj(id: ObjectId, x: number, y: number): SVGSVGElement {
  const { w, h } = OBJECTS[id];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'obj');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.left = `${x - w / 2}px`;
  svg.style.top = `${y - h}px`;
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  use.setAttribute('width', String(w));
  use.setAttribute('height', String(h));
  svg.append(use);
  return svg;
}

/** 一扇窗：玻璃是一個小 svg，viewBox 對到全景（#panorama）上的一塊（placeWindows 依樓層設定）；圓窗框（#window，連同蓋住方形四角的牆色）疊在上面。
 *  全景畫兩份並排，露出的那塊跨過右緣時接得上 */
function windowEl(x: number): SVGSVGElement {
  const win = useObj('window', x, WIN_Y), { w, h } = OBJECTS.window;
  const view = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of [['x', w / 2 + GLASS.x], ['y', h + GLASS.y], ['width', GLASS.w], ['height', GLASS.h]] as const) view.setAttribute(k, String(v));
  for (const at of [0, PANO.w]) {
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#panorama');
    use.setAttribute('x', String(at));
    use.setAttribute('width', String(PANO.w));
    use.setAttribute('height', String(PANO.h));
    view.append(use);
  }
  win.prepend(view);
  return win;
}

/** 房間外殼與樓板（building.css）：兩側斜牆是 ROOM_SIDE，右邊那張由 CSS 鏡像 */
function shell(): HTMLElement[] {
  const side = (cls: string) => {
    const d = div(`side ${cls}`);
    d.innerHTML = ROOM_SIDE; // objects.ts 產生、不含使用者資料
    return d;
  };
  return [div('ceil'), div('wall'), div('boards'), side('side-l'), side('side-r'), div('slab')];
}

const deskState = (e: Employee | null): DeskState => (e ? e.status : 'empty');

interface DeskEl { el: HTMLElement; chair: SVGSVGElement; use: SVGUseElement; plate: HTMLElement; text: HTMLElement; helpers: HTMLElement }

export class FloorView {
  /** 寬度由 building.ts 統一給（各層同寬），不自己捲動 */
  readonly el = div('floor');
  readonly people = div('people');
  private inner = div('floor-in');
  private sign = div('sign');
  private chairs = div('chairs'); // 每張桌子一把，空桌也有
  private deskRow = div('desks');
  private desks: DeskEl[] = [];
  private windows = div('windows');
  private furniture = div('furniture'); // 離右緣 GEO.sideGap、寬 GEO.furnitureW
  private furnKey: string | null = null; // 目前擺的是哪個 roomKey 的那組
  private f: Floor | null = null;

  constructor(hooks: { hover(e: Employee, at: DOMRect): void; unhover(): void }) {
    this.sign.style.left = `${SIGN_X}px`;
    this.sign.style.maxWidth = `${SIGN_MAX_W}px`; // 到第一扇窗之前
    this.inner.append(...shell(), this.windows, this.sign, this.furniture, this.chairs, this.people, this.deskRow);
    this.el.append(this.inner); // 內容座標與 seatCenter 同一套
    // 滑過人物：依 data-key 找這層目前的佔用者
    const personOf = (t: EventTarget | null): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>('.person') : null);
    this.people.addEventListener('mouseover', (ev) => {
      const p = personOf(ev.target);
      if (!p || p.contains(ev.relatedTarget as Node | null)) return;
      const e = this.f?.seats.find((s) => s.occ?.sessionId === p.dataset.key)?.occ;
      if (e) hooks.hover(e, p.getBoundingClientRect());
    });
    this.people.addEventListener('mouseout', (ev) => {
      const p = personOf(ev.target);
      if (!p || p.contains(ev.relatedTarget as Node | null)) return;
      hooks.unhover();
    });
  }

  update(f: Floor, width: number): void {
    this.f = f;
    this.el.dataset.key = f.key;
    this.inner.style.width = `${width}px`;
    this.placeWindows(width, f.level);
    if (this.furnKey !== f.key) this.placeFurniture(f.key);
    this.sign.textContent = `${f.level}F ${f.title}`;
    this.sign.title = f.key || f.title;
    this.sign.style.backgroundColor = f.color; // 專案色（不透明）
    while (this.desks.length > f.desks) {
      const d = this.desks.pop()!;
      d.el.remove();
      d.chair.remove();
    }
    while (this.desks.length < f.desks) {
      const desk = div('desk'), pic = useObj('desk-empty', DESK_ORIGIN.x, DESK_ORIGIN.y), plate = div('plate'), text = el('span'), helpers = el('b', 'helpers');
      pic.insertAdjacentHTML('beforeend', DESK_CODE); // 捲動的程式碼疊在螢幕上（CSS 動畫在 symbol 裡不會動），只在工作中顯示
      helpers.title = '工作中的助理';
      plate.append(text, helpers);
      desk.append(pic, plate); // 圖在名牌之前：名牌（HTML）疊在桌子正面上
      const x = seatCenter(this.desks.length), chair = useObj('chair', x, CHAIR_Y);
      desk.style.left = `${x - GEO.seatW / 2}px`; // 一格寬 120
      this.chairs.append(chair);
      this.deskRow.append(desk);
      this.desks.push({ el: desk, chair, use: pic.firstElementChild as SVGUseElement, plate, text, helpers });
    }
    f.seats.forEach((s, i) => {
      const d = this.desks[i]!;
      const st = deskState(s.occ);
      d.use.setAttribute('href', `#desk-${st}`); // 狀態變了就換 symbol
      d.el.dataset.st = st; // building.css 依此顯示螢幕上的程式碼
      // 名牌永遠等於這個座位目前的員工；空桌連字與底色一起清掉。「↳N」是工作中的助理數，0 不顯示
      const p = s.occ ? plateText(s.occ) : null;
      d.plate.hidden = !p;
      d.plate.className = s.occ ? `plate ${s.occ.status}` : 'plate';
      d.text.textContent = p ? p.text : '';
      d.helpers.hidden = !p?.helpers;
      d.helpers.textContent = p?.helpers ? `↳${p.helpers}` : '';
    });
  }

  /** 後牆窗：位置只跟樓層寬有關（windowXs），多的拿掉、少的補上；窗景跟著窗的位置與樓層（windowView） */
  private placeWindows(width: number, level: number): void {
    const xs = windowXs(width), wins = this.windows.children;
    while (wins.length > xs.length) wins[wins.length - 1]!.remove();
    while (wins.length < xs.length) this.windows.append(windowEl(xs[wins.length]!));
    xs.forEach((x, i) => {
      const v = windowView(x, level);
      wins[i]!.firstElementChild!.setAttribute('viewBox', `${v.x} ${v.y} ${GLASS.w} ${GLASS.h}`);
    });
  }

  /** 右端家具：依 roomKey 挑一組（同一層永遠同一組），家具區貼著樓層右緣 */
  private placeFurniture(key: string): void {
    this.furnKey = key;
    this.furniture.replaceChildren(...layoutSet(furnitureSet(key)).map((it) => {
      const n = useObj(it.id, it.x, FURN_Y);
      n.dataset.id = it.id;
      return n;
    }));
  }

  destroy(): void {
    this.el.remove();
  }
}

/** 沒有人上班：一層空的大廳，中間一張紙條寫兩行提示 */
export function lobby(): HTMLElement {
  const room = div('floor'), inner = div('floor-in'), msg = div('lobby-msg'), note = div('note');
  note.append(el('b', '', '目前沒有人上班'), el('span', '', '開一個 Claude Code session 就會出現'));
  msg.append(note);
  inner.append(...shell(), msg);
  room.append(inner);
  return room;
}
