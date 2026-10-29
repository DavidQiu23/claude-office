import Phaser from 'phaser';
import type { Employee } from '../../src/state/types.js';
import { addSprite, bakeTextures, deskKey, drawShapes, ensureChar, HAIR_COLORS, OUTFITS, setSprite, type DeskState, type Pose } from './art.js';
import { character, ISO_FLOOR, isoRoom, type Shape } from './flat.js';
import { deskDepth, fitCamera, isoDepth, personDepth, roomBox, roomSize, toScreen } from './iso.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, assistantList, entryPath, formatTime, layout, layoutSig, PALETTE, plateLabel, plateMaxW, projectColor,
  roomKey, seatCell, signFit, signMaxW, waitingCount, BASE_H, BASE_W, DOOR_X, type Island, type Layout,
} from './view.js';

const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const TYPE_MS = 200; // 打字動畫換幀間隔
const WALK_MS = 140; // 走路換幀間隔
const MAX_ZOOM = 2; // 鏡頭最多放大 2 倍（人少時）

type Pt = { x: number; y: number };

const FAILED_SIG = '\u0000failed'; // 不會等於任何版面簽名：強制下次重畫
// 地上招牌：色帶在島前緣外 20–44 的地板上（避開前排名牌）；等待人數圓章直立在色帶尾端外側
const SIGN = { gap: 20, h: 24, r: 6, pad: 9, badge: 0xff4d4d, badgeR: 9 };

// 一格（seatCell 左上角）裡各物件的相對位置
const PERSON = { x: 48, y: 48 }; // 員工座位（人物所在的地板點）
// 名牌錨點（上緣、左起 1/4 處）：長名牌主要往右（桌子那側）長，不會蓋到左下方前排的人臉
const PLATE = { x: 48, y: 100, ox: 0.25 };
const PLATE_DEPTH = 1000; // 名牌永遠在人與桌之上
// 角色素材 (0,0) 相對地板點（縮放前）：素材 40×56，底部中心（腳底陰影）對到地板點
const CHAR = { x: -20, y: -54 };
const CHAR_SCALE = 1.2; // 套在 figure 容器上
const RAISE_Y = -6; // 舉手時身體上移

/** 兩個 #rrggbb 依比例 t 混合（t = 0 為 a），回傳 Phaser 顏色數字 */
const mixColor = (a: string, b: string, t: number): number => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  let out = 0;
  for (let i = 0; i < 3; i++) out = (out << 8) | Math.round(ch(a, i) * (1 - t) + ch(b, i) * t);
  return out;
};
const hexNum = (h: string): number => parseInt(h.slice(1), 16) || 0;

interface DeskObj { img: Phaser.GameObjects.Image; plate: Phaser.GameObjects.Text }
interface SignObj {
  isl: Island;
  badge: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  tween?: Phaser.Tweens.Tween;
  count: number; // 上次畫的等待人數（-1 = 還沒畫過）
}
interface Leaver { emp: Employee; sprite: Phaser.GameObjects.Image; at: Pt }
interface Slot {
  emp: Employee;
  at: Pt; // 目前的地板座標；畫面位置由 place 換算
  person: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Container; // 角色圖；站起來只動它
  sprite: Phaser.GameObjects.Image;
  shown: Employee['status'] | null; // 目前套用的動作對應的狀態
  walking: boolean;
  anim?: Phaser.Time.TimerEvent; // 打字換幀
}
// 走路中的人：tween 動地板座標 at，每幀換算到 obj 的畫面位置
interface Walker { at: Pt; obj: Phaser.GameObjects.Container }

/** 依地板座標放到畫面上，深度依地板點排序 */
const place = (obj: Phaser.GameObjects.Container, at: Pt): void => {
  const p = toScreen(at.x, at.y);
  obj.setPosition(p.x, p.y).setDepth(personDepth(at));
};

// 資訊卡（HTML 浮層）。內容一律用 textContent / DOM 建立，避免 prompt 內容被當成 HTML。
const STATUS: Record<Employee['status'], { text: string; color: string; bg: string }> = {
  working: { text: '工作中', color: '#46d983', bg: '#46d98322' },
  waiting: { text: '等你處理', color: '#ff6b6b', bg: '#ff4d4d26' },
  idle: { text: '閒置', color: '#f2b83d', bg: '#f2b83d22' },
};
const SVG_NS = 'http://www.w3.org/2000/svg';
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();
const clampCss = (n: number): string => `display:-webkit-box;-webkit-line-clamp:${n};-webkit-box-orient:vertical;overflow:hidden;word-break:break-all`;

/** 小 DOM 工具：建立元素、套樣式、放文字 */
const el = (tag: string, css = '', text = ''): HTMLElement => {
  const n = document.createElement(tag);
  n.style.cssText = css;
  if (text) n.textContent = text;
  return n;
};

/** 圖形清單畫成 SVG（資訊卡的頭像用） */
function shapesSvg(shapes: Shape[], viewBox: string, size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.style.display = 'block';
  for (const s of shapes) {
    const n =
      s.t === 'r' ? document.createElementNS(SVG_NS, 'rect')
      : s.t === 'c' ? document.createElementNS(SVG_NS, 'circle')
      : s.t === 'e' ? document.createElementNS(SVG_NS, 'ellipse')
      : document.createElementNS(SVG_NS, 'polygon');
    const set = (k: string, v: number | string) => n.setAttribute(k, String(v));
    if (s.t === 'r') { set('x', s.x); set('y', s.y); set('width', s.w); set('height', s.h); set('rx', s.r ?? 0); }
    else if (s.t === 'c') { set('cx', s.x); set('cy', s.y); set('r', s.r); }
    else if (s.t === 'e') { set('cx', s.x); set('cy', s.y); set('rx', s.rx); set('ry', s.ry); }
    else set('points', s.pts.join(' '));
    set('fill', s.c);
    if (s.a != null && s.a !== 1) set('fill-opacity', s.a);
    svg.append(n);
  }
  return svg;
}

/** 這位員工的頭與肩膀（和桌上的人同一個外觀） */
function avatarSvg(e: Employee): SVGSVGElement {
  const look = appearance(e.sessionId);
  const shirt = '#' + (PALETTE[look.shirt] ?? PALETTE[0]!).toString(16).padStart(6, '0');
  const sprite = character({ pose: 'sit0', style: look.style, outfit: OUTFITS[look.outfit], glasses: look.glasses, hair: HAIR_COLORS[look.hair], shirt });
  return shapesSvg(sprite.shapes, '0 8 40 36', 56);
}

class InfoCard {
  private box = document.createElement('div');
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private err = '';
  id: string | null = null; // 目前顯示的員工 session id

  constructor() {
    this.box.style.cssText =
      'position:fixed;display:none;z-index:10;width:300px;box-sizing:border-box;background:#1e2542;color:#eef0ff;border:1px solid #3a4470;' +
      'border-radius:16px;box-shadow:0 12px 28px #0008;overflow:hidden;font:13px/1.5 system-ui,"Microsoft JhengHei",sans-serif';
    this.box.onmouseenter = () => clearTimeout(this.hideTimer);
    this.box.onmouseleave = () => this.scheduleHide();
    document.body.append(this.box);
  }

  show(e: Employee, left: number, top: number): void {
    clearTimeout(this.hideTimer);
    if (this.id !== e.sessionId) this.err = '';
    this.id = e.sessionId;
    this.fill(e);
    this.box.style.display = 'block';
    this.box.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 320))}px`;
    this.box.style.top = `${Math.max(0, Math.min(top, window.innerHeight - this.box.offsetHeight - 8))}px`;
  }

  private label(text: string): HTMLElement {
    return el('div', 'font-size:11px;font-weight:700;letter-spacing:.08em;color:#8d95bd;margin-bottom:4px', text);
  }

  fill(e: Employee): void {
    const color = projectColor(roomKey(e));
    const st = STATUS[e.status];
    const body = el('div', 'padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px');

    // 頭像 + 標題 + 狀態標籤 + 專案資料夾
    const avatar = el('div', `width:56px;height:56px;border-radius:16px;background:${color}33;border:1px solid ${color}88;overflow:hidden;flex:none`);
    avatar.append(avatarSvg(e));
    const chip = el('span', `display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:999px;background:${st.bg};color:${st.color};font-size:12px;font-weight:700`);
    chip.append(el('span', `width:7px;height:7px;border-radius:50%;background:${st.color}`), document.createTextNode(st.text));
    const folder = el('span', 'font-size:12px;color:#8d95bd');
    folder.append(el('span', `display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px`), document.createTextNode(e.folder));
    const title = oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt) || '（無標題）';
    const head = el('div', 'display:flex;gap:12px;align-items:center');
    head.append(avatar, el('div', 'min-width:0;display:flex;flex-direction:column;gap:6px'));
    head.lastElementChild!.append(el('div', `font-size:16px;font-weight:700;line-height:1.35;${clampCss(2)}`, title), (() => {
      const row = el('div', 'display:flex;align-items:center;gap:8px;flex-wrap:wrap');
      row.append(chip, folder);
      return row;
    })());
    body.append(head);

    // 目前在做什麼；等你批准時整塊變紅
    if (e.activity) {
      const red = e.status === 'waiting';
      body.append(el('div', `background:${red ? '#ff4d4d1f' : '#ffffff0d'};border:1px solid ${red ? '#ff6b6b66' : '#ffffff14'};border-radius:10px;padding:8px 10px;color:${red ? '#ffb3b3' : '#dfe3ff'};${clampCss(2)}`, e.activity));
    }

    // prompt：第一個只在和最近的不同時才顯示
    const last = el('div');
    last.append(this.label('最近的 PROMPT'), el('div', `line-height:1.55;color:#c9cee8;${clampCss(3)}`, oneLine(e.lastPrompt) || '（無）'));
    body.append(last);
    if (e.firstPrompt && oneLine(e.firstPrompt) !== oneLine(e.lastPrompt)) {
      const first = el('div');
      first.append(this.label('第一個 PROMPT'), el('div', `line-height:1.55;color:#8d95bd;${clampCss(1)}`, oneLine(e.firstPrompt)));
      body.append(first);
    }

    // 助理：工作中排前，最多 4 位，其餘併成一行
    if (e.assistants.length) {
      const { rows, extra, extraWorking, extraDone, working } = assistantList(e.assistants);
      const list = el('div', 'border-top:1px solid #ffffff14');
      for (const a of rows) {
        const done = a.status === 'done';
        const row = el('div', `display:flex;align-items:center;gap:8px;padding:5px 0${done ? ';opacity:.55' : ''}`);
        row.append(el('span', `width:8px;height:8px;border-radius:50%;background:${done ? '#f2b83d' : '#46d983'};flex:none`));
        if (typeof a.kind === 'string' && a.kind) {
          row.append(el('span', 'max-width:76px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px ui-monospace,Consolas,monospace;color:#b9c0e6;background:#ffffff14;border-radius:4px;padding:0 5px', a.kind));
        }
        const desc = oneLine(a.description);
        row.append(
          el('span', `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${desc ? (done ? '#8d95bd' : '#dfe3ff') : '#6b7399'}`, desc || '（無描述）'),
          el('span', 'font-size:12px;color:#8d95bd;flex:none', done ? '完成' : '工作中'),
        );
        list.append(row);
      }
      if (extra > 0) {
        const parts = [extraWorking && `${extraWorking} 位工作中`, extraDone && `${extraDone} 位已完成`].filter(Boolean);
        const more = el('div', 'display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:#8d95bd');
        more.append(el('span', 'border:1px solid #ffffff33;border-radius:999px;padding:0 7px;flex:none', `+${extra}`), el('span', '', `另有 ${parts.join('、')}`));
        list.append(more);
      }
      const title = this.label(`助理 · ${e.assistants.length}`);
      if (working) title.append(el('span', 'margin-left:8px;color:#46d983;letter-spacing:0', `${working} 位工作中`));
      const help = el('div');
      help.append(title, list);
      body.append(help);
    }

    // 頁尾：到班時間 / 錯誤，右邊「請他下班」
    const left = el('span', `flex:1;font-size:12px;color:${this.err ? '#ff8a80' : '#8d95bd'}`, this.err || `到班 ${formatTime(e.arrivedAt)}`);
    const btn = el('button', 'cursor:pointer;padding:6px 12px;border-radius:8px;font:inherit;color:#c9cee8;background:transparent;border:1px solid #ffffff26', '請他下班');
    btn.onmouseenter = () => { btn.style.color = '#ffb3b3'; btn.style.borderColor = '#ff6b6b99'; };
    btn.onmouseleave = () => { btn.style.color = '#c9cee8'; btn.style.borderColor = '#ffffff26'; };
    btn.onclick = async () => {
      const id = this.id;
      if (!id) return;
      try {
        const r = await fetch(`/employees/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
        if (!r.ok) throw new Error(String(r.status));
        this.hide();
      } catch {
        this.err = '操作失敗，請稍後再試';
        const cur = this.id === id ? e : null;
        if (cur) this.fill(cur);
      }
    };
    const foot = el('div', 'border-top:1px solid #ffffff14;padding-top:12px;display:flex;align-items:center;gap:8px');
    foot.append(left, btn);
    body.append(foot);

    this.box.replaceChildren(el('div', `height:5px;background:${color}`), body);
  }

  scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 250);
  }

  hide(): void {
    clearTimeout(this.hideTimer);
    this.box.style.display = 'none';
    this.id = null;
  }
}

const deskState = (e?: Employee): DeskState =>
  !e ? 'empty' : e.status === 'waiting' ? 'waiting' : e.status === 'working' ? 'working' : 'idle';

export class OfficeScene extends Phaser.Scene {
  private lay: Layout = { islands: [], width: BASE_W, height: BASE_H, voids: [] };
  private sig = '';
  private roomObjs: Phaser.GameObjects.GameObject[] = [];
  private desks = new Map<string, DeskObj>();
  private signs = new Map<string, SignObj>();
  private slots = new Map<string, Slot>();
  private leaving = new Map<Phaser.GameObjects.Container, Leaver>(); // 走向出口中的人，離開前島要保留
  private card!: InfoCard;
  private emptyText!: Phaser.GameObjects.Text;
  private z = 1; // 內部渲染倍率（整數）：畫布放大、文字以同倍率繪製才不會糊

  constructor(private store: OfficeStore) {
    super('office');
  }

  create(): void {
    this.z = this.registry.get('zoom') ?? 1;
    this.cameras.main.setOrigin(0.5).setZoom(this.z);
    bakeTextures(this);
    const mid = toScreen(BASE_W / 2, BASE_H / 2);
    this.emptyText = this.add
      .text(mid.x, mid.y, '目前沒有人上班\n開一個 Claude Code session 就會出現', {
        fontFamily: FONT, resolution: this.z, fontSize: '14px', color: '#8a82b3', align: 'center',
      })
      .setOrigin(0.5);
    this.card = new InfoCard();
    this.rebuild();
    this.store.on((c) => {
      // 兩步各自 try：重排出錯時仍要把員工放上去
      if (c.type === 'reset') this.guard(() => this.rebuild());
      else if (c.type === 'leave') this.guard(() => this.leave(c.sessionId));
      else {
        this.guard(() => this.relayout());
        this.guard(() => this.upsert(c.employee, true));
      }
    });
  }

  /** 執行 fn，例外只記錄不往外丟（避免中斷 Phaser 的每幀迴圈或留下畫一半的場景） */
  private guard(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }

  // ---- 版面：一片地板，一個專案一座島 ----

  private layoutEmployees(): Employee[] {
    const list = [...this.store.employees.values()];
    for (const { emp } of this.leaving.values()) if (!this.store.employees.has(emp.sessionId)) list.push(emp);
    return list;
  }

  private islandOf(e: Employee): Island | undefined {
    const k = roomKey(e);
    return this.lay.islands.find((r) => r.key === k);
  }

  private cellOf(e: Employee): Pt {
    const r = this.islandOf(e);
    return r ? seatCell(r, Math.max(0, e.seat)) : { x: 0, y: 0 };
  }

  private homeOf(e: Employee): Pt {
    const c = this.cellOf(e);
    return { x: c.x + PERSON.x, y: c.y + PERSON.y };
  }

  /** 上班路線：最左緣 → 島上方走道 → 座位（找不到島時直接到座位） */
  private entryOf(e: Employee): Pt[] {
    const r = this.islandOf(e);
    return r ? entryPath(r, Math.max(0, e.seat)) : [this.homeOf(e)];
  }

  /** 走路中重新規劃路線：先回到島上方走道，再沿走道、桌間空隙到座位；已在座位那一列就直接走進去 */
  private rerouteTo(e: Employee, from: Pt): Pt[] {
    const p = this.entryOf(e);
    const seat = p[3];
    if (p.length < 4 || !seat) return [this.homeOf(e)];
    if (Math.abs(from.y - seat.y) < 1) return [seat]; // 已在座位那一列：往上走會穿過上一排的桌子
    return [{ x: from.x, y: p[1].y }, ...p.slice(1)];
  }

  /** 下班路線：從目前位置上到走道，再往左走出辦公室 */
  private exitOf(e: Employee, from: Pt): Pt[] {
    const p = this.entryOf(e);
    const corridor = p[1];
    if (p.length < 4 || !corridor) return [{ x: 0, y: from.y }];
    const seat = p[3];
    // 在座位上：照上班路線反過來走；走到一半：先回桌間空隙（在座位那一列時），再上走道出去
    if (seat && Math.hypot(seat.x - from.x, seat.y - from.y) < 1) return [...p].reverse();
    const gap = seat && Math.abs(from.y - seat.y) < 1 ? [p[2]] : [{ x: from.x, y: from.y }];
    return [...gap, { x: gap[0].x, y: corridor.y }, { x: 0, y: corridor.y }];
  }

  /** 島的位置、大小或桌數有變才重畫；在座位上的人跟著搬到新位置 */
  private relayout(force = false): void {
    const next = layout(this.layoutEmployees());
    const sig = layoutSig(next);
    if (!force && sig === this.sig) return;
    // 簽名等全部畫成功才記下；中途出錯時下一次 relayout 會重畫，不會停在畫一半的狀態
    this.sig = FAILED_SIG;
    this.lay = next;
    for (const s of this.signs.values()) this.tweens.killTweensOf(s.badge);
    this.signs.clear();
    for (const o of this.roomObjs) o.destroy();
    this.roomObjs = [];
    this.desks.clear(); // 桌子物件已隨 roomObjs 銷毀
    let ok = true;
    try {
      this.drawFloor(next);
    } catch (e) {
      ok = false;
      console.error(e);
    }
    for (const r of next.islands) {
      try {
        this.drawIsland(r);
      } catch (e) {
        ok = false;
        console.error(e); // 一座島畫失敗不影響其他島
      }
    }
    if (ok) this.sig = sig;
    this.guard(() => {
      this.emptyText.setVisible(next.islands.length === 0);
      this.fitView();
    });
    for (const s of this.slots.values()) {
      this.guard(() => {
        if (s.walking) this.startWalk(s, this.rerouteTo(s.emp, s.at));
        else place(s.person, (s.at = this.homeOf(s.emp)));
        this.drawDesk(s.emp);
      });
    }
    // 島搬動了，走出中的人重新規劃路線
    for (const [person, l] of [...this.leaving]) this.guard(() => this.walkOut(person, l));
    this.guard(() => this.updateSigns());
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.roomObjs.push(o);
    return o;
  }

  /** 鏡頭縮放並框住整個房間；畫布大小固定 */
  private fitView(): void {
    const { w, h } = roomSize(this.lay.islands);
    const { zoom, cx, cy } = fitCamera(roomBox(w, h), BASE_W, BASE_H, MAX_ZOOM);
    this.cameras.main.setZoom(this.z * zoom).centerOn(cx, cy);
  }

  private drawFloor(l: Layout): void {
    const g = this.keep(this.add.graphics().setDepth(-100));
    drawShapes(g, isoRoom(l.width, l.height, DOOR_X).shapes, 1, 0, 0);
  }

  private drawIsland(isl: Island): void {
    const R = this.z * MAX_ZOOM; // 文字以鏡頭最大倍率繪製，放大時才不會糊
    const corners = [toScreen(isl.x, isl.y), toScreen(isl.x + isl.w, isl.y), toScreen(isl.x + isl.w, isl.y + isl.h), toScreen(isl.x, isl.y + isl.h)];
    this.keep(this.add.graphics().setDepth(-90)).fillStyle(mixColor(ISO_FLOOR, isl.color, 0.3), 1).fillPoints(corners.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);

    // 招牌：平面色帶畫好後貼到地板上。地板的 fx、fy 單位向量是 (1, 0.5)、(-1, 0.5)，
    // 等於先轉 45° 再把 x 放大 √2、y 縮成 √2/2，所以用兩層 Container（內層轉、外層縮放）做出斜切。
    // 外層先 keep 再加子物件：中途出錯時子物件也會隨重畫一起銷毀
    const gy = isl.y + isl.h + SIGN.gap;
    const o = toScreen(isl.x, gy);
    const outer = this.keep(this.add.container(o.x, o.y).setScale(Math.SQRT2, Math.SQRT1_2).setDepth(-80));
    const inner = this.add.container(0, 0).setRotation(Math.PI / 4);
    outer.add(inner);
    const font = { fontFamily: FONT, resolution: R, fontStyle: 'bold', color: '#ffffff' };
    const label = this.add.text(SIGN.pad, SIGN.h / 2, '', font).setOrigin(0, 0.5);
    inner.add(label);
    const measure = (s: string, size: number): number => (label.setFontSize(size).setText(s), label.width + SIGN.pad * 2);
    const fit = signFit(isl.title, signMaxW(isl), measure);
    const bandW = measure(fit.text, fit.size);
    inner.addAt(this.add.graphics().fillStyle(hexNum(isl.color), 0.9).fillRoundedRect(0, 0, bandW, SIGN.h, SIGN.r), 0);

    // 等待人數圓章：直立在色帶中線、尾端外側，數字由 updateSigns 填
    const b = toScreen(isl.x + bandW + 9, gy + SIGN.h / 2);
    const badge = this.keep(this.add.container(b.x, b.y).setDepth(-79).setVisible(false));
    badge.add(this.add.graphics().fillStyle(SIGN.badge, 1).fillCircle(0, 0, SIGN.badgeR).lineStyle(2, 0xffffff, 1).strokeCircle(0, 0, SIGN.badgeR));
    const text = this.add.text(0, 0, '', { ...font, fontSize: '11px' }).setOrigin(0.5);
    badge.add(text);
    this.signs.set(isl.key, { isl, badge, text, count: -1 });

    for (let i = 0; i < isl.desks; i++) {
      const c = seatCell(isl, i);
      const s = toScreen(c.x, c.y);
      const p = toScreen(c.x + PLATE.x, c.y + PLATE.y);
      const d: DeskObj = {
        img: this.keep(addSprite(this, deskKey('empty'), s.x, s.y).setDepth(deskDepth(c))),
        plate: this.keep(
          this.add
            .text(p.x, p.y, '', { fontFamily: FONT, resolution: R, fontSize: '9px', color: '#f4efe6', padding: { x: 6, y: 2 } })
            .setOrigin(PLATE.ox, 0)
            .setDepth(isoDepth(c.x + PLATE.x, c.y + PLATE.y) + PLATE_DEPTH),
        ),
      };
      this.desks.set(`${isl.key}#${i}`, d);
    }
  }

  /** 招牌：依各專案等你回覆的人數更新圓章（數量 > 0 才顯示並放大縮小） */
  private updateSigns(): void {
    for (const s of this.signs.values()) {
      if (!s.badge.active) continue;
      const n = waitingCount(this.store.employees.values(), s.isl.key);
      if (n === s.count) continue;
      s.count = n;
      const show = n > 0;
      s.badge.setVisible(show);
      if (show) {
        s.text.setText(String(n));
        if (!s.tween || !s.tween.isPlaying()) {
          s.badge.setScale(0.94);
          s.tween = this.tweens.add({ targets: s.badge, scale: 1.06, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      } else {
        this.tweens.killTweensOf(s.badge);
        s.tween = undefined;
        s.badge.setScale(1);
      }
    }
  }

  // ---- 場景管理 ----

  /** reset：全部清掉重建（員工直接坐在座位，不走路） */
  private rebuild(): void {
    for (const id of [...this.slots.keys()]) this.destroySlot(id);
    for (const [p, l] of this.leaving) {
      this.tweens.killTweensOf(l.at);
      p.destroy();
    }
    this.leaving.clear();
    this.card.hide();
    this.relayout(true);
    for (const e of this.store.employees.values()) this.guard(() => this.upsert(e, false));
    this.updateSigns();
  }

  private destroySlot(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    this.slots.delete(id);
    s.anim?.remove(false);
    this.tweens.killTweensOf([s.at, s.figure]);
    s.person.destroy();
  }

  /** tween 動地板座標 at，每幀與完成時用 place 換算畫面位置與深度 */
  private walkTo(m: Walker, to: Pt, setFrame: (f: 0 | 1) => void, done?: () => void): void {
    this.tweens.killTweensOf(m.at);
    const dist = Math.hypot(m.at.x - to.x, m.at.y - to.y);
    this.tweens.add({
      targets: m.at,
      x: to.x,
      y: to.y,
      duration: Math.max(200, dist * 4),
      onUpdate: () => {
        setFrame((Math.floor(performance.now() / WALK_MS) % 2) as 0 | 1);
        place(m.obj, m.at);
      },
      onComplete: () => {
        place(m.obj, m.at);
        done?.();
      },
    });
  }

  /** 依序走過每個點（與目前位置重疊的點略過） */
  private walkPath(m: Walker, pts: Pt[], setFrame: (f: 0 | 1) => void, done?: () => void): void {
    let i = 0;
    while (i < pts.length && Math.hypot(pts[i]!.x - m.at.x, pts[i]!.y - m.at.y) < 1) i++;
    const to = pts[i];
    if (!to) {
      this.tweens.killTweensOf(m.at);
      const last = pts[pts.length - 1];
      if (last) Object.assign(m.at, { x: last.x, y: last.y });
      place(m.obj, m.at);
      done?.();
      return;
    }
    const rest = pts.slice(i + 1);
    this.walkTo(m, to, setFrame, () => {
      if (!m.obj.active) return;
      this.walkPath(m, rest, setFrame, done);
    });
  }

  // ---- 員工 ----

  private upsert(e: Employee, walkIn: boolean): void {
    let s = this.slots.get(e.sessionId);
    if (!s) {
      s = this.createSlot(e);
      this.slots.set(e.sessionId, s);
      if (walkIn) {
        const path = this.entryOf(e);
        const start = path[0] ?? this.homeOf(e);
        place(s.person, (s.at = { x: start.x, y: start.y }));
        s.emp = e;
        this.startWalk(s, path);
      } else {
        place(s.person, (s.at = this.homeOf(e)));
      }
    } else if (s.emp.seat !== e.seat) {
      this.clearDeskIfFree(s.emp, e.sessionId);
      s.emp = e;
      this.startWalk(s, [this.homeOf(e)]); // 換座位：直接走到新座位
    }
    s.emp = e;
    this.drawDesk(e);
    this.drawEmployee(s, e);
    if (this.card.id === e.sessionId) this.card.fill(e);
    this.updateSigns();
  }

  private startWalk(s: Slot, path: Pt[]): void {
    const id = s.emp.sessionId;
    s.walking = true;
    s.anim?.remove(false);
    s.anim = undefined;
    this.tweens.killTweensOf(s.figure);
    s.figure.y = 0;
    this.walkPath(
      { at: s.at, obj: s.person },
      path,
      (f) => setSprite(s.sprite, this.charTexture(s.emp, f === 0 ? 'walk0' : 'walk1')),
      () => {
        const cur = this.slots.get(id);
        if (cur !== s) return;
        s.walking = false;
        s.shown = null; // 強制重新套用目前狀態的姿勢
        this.drawEmployee(s, s.emp);
      },
    );
  }

  private leave(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    const { person } = s;
    this.slots.delete(id);
    s.anim?.remove(false);
    this.clearDeskIfFree(s.emp, id);
    if (this.card.id === id) this.card.hide();
    this.tweens.killTweensOf(s.figure);
    s.figure.y = 0;
    person.disableInteractive();
    const l: Leaver = { emp: s.emp, sprite: s.sprite, at: s.at };
    this.leaving.set(person, l); // 走出辦公室之前，這座島先保留
    this.walkOut(person, l);
    this.updateSigns();
  }

  /** 從目前位置走出辦公室；走到出口後移除並重排（最後一個人離開後，島才消失） */
  private walkOut(person: Phaser.GameObjects.Container, l: Leaver): void {
    this.walkPath(
      { at: l.at, obj: person },
      this.exitOf(l.emp, l.at),
      (f) => setSprite(l.sprite, this.charTexture(l.emp, f === 0 ? 'walk0' : 'walk1')),
      () => {
        if (this.leaving.get(person) !== l) return;
        this.leaving.delete(person);
        person.destroy();
        // 可能在 relayout 途中同步走完（人已在出口），延到下一輪再重排，避免巢狀重畫
        this.time.delayedCall(0, () => this.guard(() => this.relayout()));
      },
    );
  }

  private clearDeskIfFree(e: Employee, exceptId: string): void {
    for (const [id, o] of this.slots) if (id !== exceptId && o.emp.seat === e.seat && roomKey(o.emp) === roomKey(e)) return;
    this.drawDesk(undefined, e);
  }

  private charTexture(e: Employee, pose: Pose): string {
    const look = appearance(e.sessionId);
    return ensureChar(this, pose, look, PALETTE[look.shirt] ?? PALETTE[0]!);
  }

  private createSlot(e: Employee): Slot {
    const sprite = addSprite(this, this.charTexture(e, 'sit0'), CHAR.x, CHAR.y);
    const figure = this.add.container(0, 0, [sprite]).setScale(CHAR_SCALE);
    const person = this.add.container(0, 0, [figure]); // 陰影已畫在角色素材裡
    const S = CHAR_SCALE;
    person.setInteractive(new Phaser.Geom.Rectangle(CHAR.x * S, CHAR.y * S, 40 * S, 56 * S), Phaser.Geom.Rectangle.Contains);
    const id = e.sessionId;
    person.on('pointerover', () => {
      const cur = this.slots.get(id);
      if (!cur) return;
      // 世界座標 → 螢幕座標：扣掉鏡頭視野左上角、乘鏡頭倍率，再換成畫布在頁面上的 CSS 大小
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.width / this.game.canvas.width;
      const left = r.left + (person.x - cam.worldView.x) * cam.zoom * k + 26 * cam.zoom * k;
      const top = r.top + (person.y - cam.worldView.y) * cam.zoom * k - 40 * cam.zoom * k;
      this.card.show(cur.emp, left, top);
    });
    person.on('pointerout', () => this.card.scheduleHide());
    return { emp: e, at: { x: 0, y: 0 }, person, figure, sprite, shown: null, walking: false };
  }

  // ---- 繪製 ----

  private applyPose(s: Slot, e: Employee): void {
    s.anim?.remove(false);
    s.anim = undefined;
    if (e.status === 'working') {
      let f = 0;
      setSprite(s.sprite, this.charTexture(e, 'sit0'));
      s.anim = this.time.addEvent({
        delay: TYPE_MS,
        loop: true,
        callback: () => {
          f = 1 - f;
          setSprite(s.sprite, this.charTexture(s.emp, f ? 'sit1' : 'sit0'));
        },
      });
    } else {
      setSprite(s.sprite, this.charTexture(e, e.status === 'waiting' ? 'up' : 'idle'));
    }
  }

  private drawEmployee(s: Slot, e: Employee): void {
    if (s.walking) return; // 走路中維持走路姿勢，到座位後再套用狀態動作
    if (s.shown === e.status) return; // 只有狀態改變才重設動作，重複 upsert 不會疊加 tween
    s.shown = e.status;
    this.tweens.killTweensOf(s.figure);
    s.figure.y = 0;
    this.applyPose(s, e);
    if (e.status === 'idle') this.tweens.add({ targets: s.figure, y: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (e.status === 'waiting') s.figure.y = RAISE_Y;
  }

  /** e 有值：畫出該員工的桌子；e 為 undefined：把 at 那一桌清成空桌 */
  private drawDesk(e?: Employee, at?: Employee): void {
    const t = e ?? at;
    if (!t) return;
    const d = this.desks.get(`${roomKey(t)}#${t.seat}`);
    if (!d || !d.img.active || !d.plate.active) return;
    setSprite(d.img, deskKey(deskState(e)));
    const plate = d.plate;
    plate.setVisible(!!e); // 空桌不顯示名牌
    if (!e) return;
    // 一行「名字 · 動作」，依實際寬度截斷，相鄰名牌不會疊在一起
    const { text, waiting } = plateLabel(e, (s) => (plate.setText(s), plate.width <= plateMaxW(1)));
    plate.setText(text).setBackgroundColor(waiting ? 'rgba(214,52,52,0.92)' : 'rgba(20,23,42,0.78)');
  }
}
