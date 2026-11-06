// 一層樓：淺盒房間（天花板、後牆、木地板、兩側斜牆）、樓板、招牌「NF 專案名」、圓窗、一排椅子（在人後面）、正面桌與名牌、夾在桌子中間的家具區。人物由 building.ts 放進 people 圖層
import { GEO, plateText, seatGrid, type Floor, type Occupant, type SeatGrid } from './floors.js';
import { furnitureSet, layoutSet, SIGN_MAX_W, SIGN_X, wallPlan, windowView } from './furniture.js';
import { DESK_CODE, DESK_STEAM, FURN_ANIM, GLASS, OBJECTS, PANO, ROOM_SIDE, floorSeams, type DeskState, type ObjectId } from './objects.js';
import { div, el } from './dom.js';
import { motionDelay } from './view.js';

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
function windowEl(x: number): HTMLElement {
  const win = useObj('window', x, WIN_Y), { w, h } = OBJECTS.window;
  const view = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of [['x', w / 2 + GLASS.x], ['y', h + GLASS.y], ['width', GLASS.w], ['height', GLASS.h]] as const) view.setAttribute(k, String(v));
  const panoUse = (id: string, at: number) => {
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${id}`);
    use.setAttribute('x', String(at));
    use.setAttribute('width', String(PANO.w));
    use.setAttribute('height', String(PANO.h));
    return use;
  };
  view.append(panoUse('panorama', 0), panoUse('panorama', PANO.w));
  win.prepend(view);
  // 包一層 display:contents 的 div，窗和夜空的光（building.css 的 .windows .glow）一起增減
  const box = div('win'), glow = div('glow');
  glow.style.left = `${x}px`;
  box.append(win, glow);
  return box;
}

/** 外牆柱、房間外殼與樓板（building.css）：兩側斜牆是 ROOM_SIDE，右邊那張由 CSS 鏡像 */
function shell(): HTMLElement[] {
  const side = (cls: string) => {
    const d = div(`side ${cls}`);
    d.innerHTML = ROOM_SIDE; // objects.ts 產生、不含使用者資料
    return d;
  };
  return [div('pillar pillar-l'), div('pillar pillar-r'), div('ceil'), div('wall'), div('boards'), side('side-l'), side('side-r'), div('slab')];
}

const deskState = (e: Occupant | null): DeskState => (e ? e.status : 'empty');

interface DeskEl { el: HTMLElement; chair: SVGSVGElement; use: SVGUseElement; plate: HTMLElement; text: HTMLElement }

export class FloorView {
  /** 寬度由 building.ts 統一給（各層同寬），不自己捲動 */
  readonly el = div('floor');
  readonly people = div('people');
  private inner = div('floor-in');
  private sign = div('sign');
  private chairs = div('chairs'); // 每張桌子一把，空桌也有（調淡）
  private deskRow = div('desks');
  private desks: DeskEl[] = [];
  private windows = div('windows');
  private bays = div('bays'); // 每個家具區一個 .furniture
  private seams = div('seams'); // 木地板的透視板縫，依樓層寬畫
  private laidOut = ''; // 目前依哪個 roomKey、樓號和寬度排的；窗、板縫、家具只有這個變了才重排
  private f: Floor | null = null;

  constructor(hooks: { hover(e: Occupant, at: DOMRect): void; unhover(): void; enter(): void }) {
    this.sign.style.left = `${SIGN_X}px`;
    this.sign.style.maxWidth = `${SIGN_MAX_W}px`; // 到第一扇窗之前
    this.inner.append(...shell(), this.seams, this.windows, this.sign, this.bays, this.chairs, this.people, this.deskRow);
    this.el.append(this.inner); // 內容座標與 seatGrid 同一套
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
    // 鍵盤：Tab 選到人就開卡片，Enter／空白鍵進到卡片裡的按鈕。進出卡片之間不開關
    const fromCard = (t: EventTarget | null) => t instanceof Element && t.closest('.card');
    this.people.addEventListener('focusin', (ev) => {
      const p = personOf(ev.target);
      if (!p || fromCard(ev.relatedTarget)) return;
      // 等 focus 造成的捲動結束再開：捲動事件會關卡片，位置也要用捲動後的（捲動事件排在 rAF 之前）
      requestAnimationFrame(() => {
        const e = this.f?.seats.find((s) => s.occ?.sessionId === p.dataset.key)?.occ;
        if (e && document.activeElement === p) hooks.hover(e, p.getBoundingClientRect());
      });
    });
    this.people.addEventListener('focusout', (ev) => {
      if (personOf(ev.target) && !fromCard(ev.relatedTarget)) hooks.unhover();
    });
    const openCard = (p: HTMLElement) => {
      const e = this.f?.seats.find((s) => s.occ?.sessionId === p.dataset.key)?.occ;
      if (e) hooks.hover(e, p.getBoundingClientRect()); // 卡片可能被 Esc 關掉了，先打開
      hooks.enter();
    };
    this.people.addEventListener('keydown', (ev) => {
      const p = personOf(ev.target);
      if (!p || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault(); // 空白鍵不捲頁面；Enter 不要接著按到卡片的按鈕
      if (ev.key === 'Enter') openCard(p);
    });
    // 空白鍵等放開才進卡片：按著進去的話，放開時可能按到「請他下班」，那顆沒有確認步驟
    this.people.addEventListener('keyup', (ev) => {
      const p = personOf(ev.target);
      if (p && ev.key === ' ') openCard(p);
    });
  }

  update(f: Floor, width: number): void {
    this.f = f;
    this.el.dataset.key = f.key;
    this.inner.style.width = `${width}px`;
    const grid = seatGrid(width), layout = `${f.key}\n${f.level}\n${width}`;
    if (this.laidOut !== layout) {
      this.laidOut = layout;
      this.seams.innerHTML = floorSeams(width); // objects.ts 產生、不含使用者資料
      this.placeWindows(grid, f.level);
      this.placeFurniture(grid, f.key);
    }
    this.sign.textContent = `${f.level}F ${f.title}`;
    this.sign.title = f.key || f.title;
    this.sign.style.backgroundColor = f.color; // 專案色（不透明）
    // 每一格都有桌有椅，沒人的是空桌；buildingWidth 保證格子放得下這層所有的座位
    while (this.desks.length > grid.seats.length) {
      const d = this.desks.pop()!;
      d.el.remove();
      d.chair.remove();
    }
    while (this.desks.length < grid.seats.length) {
      const desk = div('desk'), pic = useObj('desk-empty', DESK_ORIGIN.x, DESK_ORIGIN.y), plate = div('plate'), text = el('span');
      pic.insertAdjacentHTML('beforeend', DESK_CODE + DESK_STEAM); // 捲動的程式碼、馬克杯的煙疊在桌上（CSS 動畫在 symbol 裡不會動），依狀態顯示
      desk.style.setProperty('--delay', `-${motionDelay(`${f.key}#${this.desks.length}`)}s`); // 各層各座位的煙不同步
      plate.append(text);
      desk.append(pic, div('glow'), plate); // 圖在名牌之前：名牌（HTML）疊在桌子正面上；glow 是夜晚的桌燈與螢幕光（building.css）
      const chair = useObj('chair', 0, CHAIR_Y);
      this.chairs.append(chair);
      this.deskRow.append(desk);
      this.desks.push({ el: desk, chair, use: pic.firstElementChild as SVGUseElement, plate, text });
    }
    this.desks.forEach((d, i) => {
      const x = grid.seats[i]!, occ = f.seats[i]?.occ ?? null, st = deskState(occ);
      d.el.style.left = `${x - GEO.seatW / 2}px`; // 一格寬 120
      d.chair.style.left = `${x - OBJECTS.chair.w / 2}px`;
      d.chair.classList.toggle('vacant', !occ);
      d.use.setAttribute('href', `#desk-${st}`); // 狀態變了就換 symbol
      d.el.dataset.st = st; // building.css 依此顯示螢幕上的程式碼
      // 名牌永遠等於這個座位目前的人；空桌連字與底色一起清掉
      d.plate.hidden = !occ;
      d.plate.className = occ ? `plate ${occ.status}` : 'plate';
      d.text.textContent = occ ? plateText(occ) : '';
    });
  }

  /** 後牆窗：位置跟著格線（wallPlan）；窗景跟著窗的位置與樓層（windowView） */
  private placeWindows(grid: SeatGrid, level: number): void {
    const xs = wallPlan(grid).windows;
    this.windows.replaceChildren(...xs.map(windowEl));
    xs.forEach((x, i) => {
      const v = windowView(x, level);
      this.windows.children[i]!.firstElementChild!.firstElementChild!.setAttribute('viewBox', `${v.x} ${v.y} ${GLASS.w} ${GLASS.h}`); // .win > 窗 svg > 玻璃 svg
    });
  }

  /** 每個家具區擺一組（furniture.ts 決定哪一組），整組置中 */
  private placeFurniture(grid: SeatGrid, key: string): void {
    this.bays.replaceChildren(...grid.bays.map((b, k) => {
      const box = div('furniture');
      box.style.left = `${b.x}px`;
      box.style.width = `${b.w}px`;
      box.append(...layoutSet(furnitureSet(key, k), b.w).flatMap((it) => {
        const n = useObj(it.id, it.x, FURN_Y), anim = FURN_ANIM[it.id];
        n.dataset.id = it.id;
        if (anim) {
          n.insertAdjacentHTML('beforeend', anim); // 葉子、咖啡煙（objects.ts 產生、不含使用者資料）
          n.style.setProperty('--delay', `-${motionDelay(`${key}#${k}#${it.id}`)}s`); // 各層同一件家具不同步
        }
        if (it.id !== 'floorLamp' && it.id !== 'vending') return [n];
        const glow = div(`glow glow-${it.id}`); // 夜晚的燈光（building.css）
        glow.style.left = `${it.x}px`;
        return [n, glow];
      }));
      return box;
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
