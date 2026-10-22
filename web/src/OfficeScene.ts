import Phaser from 'phaser';
import { truncate } from '../../src/state/describe.js';
import type { Assistant, Employee } from '../../src/state/types.js';
import { addSprite, bakeTextures, deskKey, drawShapes, ensureChar, HAIR_COLORS, OUTFITS, setSprite, type DeskState, type Pose } from './art.js';
import { bot, character, OFFICE, officeShell, type Shape } from './flat.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, entryPath, fitMiddle, fitText, formatTime, helperHome, helperSlots, layout, layoutSig, nameplate, PALETTE, projectColor,
  roomKey, seatCell, waitingCount, DoneClock, BASE_H, BASE_W, ISLAND, type Island, type Layout,
} from './view.js';

const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const PLATE_W = 84;
const EMPTY_DY = 60; // 「目前沒有人上班」放在地板中央偏下，不擋後牆家具
const TYPE_MS = 200; // 打字動畫換幀間隔
const WALK_MS = 140; // 走路換幀間隔

// 地板與島
const FLOOR = OFFICE.floor;
const ISLAND_R = 22;
type Pt = { x: number; y: number };

const FAILED_SIG = '\u0000failed'; // 不會等於任何版面簽名：強制下次重畫
const SIGN = { dx: 16, dy: -14, h: 28, r: 8, color: 0xf4ecd6, text: '#2a2238', badge: 0xff4d4d, badgeH: 20, minName: 48 };

// 一格（seatCell 左上角）裡各物件的相對位置
const PERSON = { x: 48, y: 48 }; // 員工座位（人物中心）
const DESK = { x: 12, y: 66, h: 36 }; // 桌子素材 (0,0) 位置與高度
const PLATE = { x: 6, y: 108 }; // 名牌顯示標題或第一個 prompt（專案名稱在招牌上）
const CHAR = { x: -20, y: -28 }; // 角色素材 (0,0) 相對人物中心
// 驚嘆號素材 (0,0) 相對人物中心，每 0.4 秒上下跳。素材高 27；舉手時頭髮頂端約 -28 + RAISE_Y + 2 = -32
// （丸子頭 -38.5、舉起的手 -30），驚嘆號底部放在 -36，比一般頭髮高 4
const EXCL = { x: -10, y: -36 - 27 };
const EXCL_BOUNCE = 4;
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
  board: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Container;
  badgeBg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  tween?: Phaser.Tweens.Tween;
  count: number; // 上次畫的等待人數（-1 = 還沒畫過）
}
interface Leaver { emp: Employee; sprite: Phaser.GameObjects.Image }
interface Slot {
  emp: Employee;
  person: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Container; // 角色圖；站起來只動它
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Image;
  shown: Employee['status'] | null; // 目前套用的動作對應的狀態
  walking: boolean;
  anim?: Phaser.Time.TimerEvent; // 打字換幀
}
// 主人桌邊的小幫手（一位助理一個）
interface Helper {
  c: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  ownerId: string;
  aid: string; // 助理 id（資訊卡用）
  slot: number; // 0 = 人物左側、1 = 右側
  done: boolean;
  walking: boolean;
}
const helperKey = (ownerId: string, id: string): string => `${ownerId}/${id}`;
const HELPER_R = 12; // 小幫手素材 24×24，容器中心在素材正中

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
  id: string | null = null; // 目前顯示的員工 session id（小幫手的卡也記主人的 id）
  private asstId: string | null = null; // 不是 null 就顯示這位小幫手自己的卡

  constructor() {
    this.box.style.cssText =
      'position:fixed;display:none;z-index:10;width:300px;box-sizing:border-box;background:#1e2542;color:#eef0ff;border:1px solid #3a4470;' +
      'border-radius:16px;box-shadow:0 12px 28px #0008;overflow:hidden;font:13px/1.5 system-ui,"Microsoft JhengHei",sans-serif';
    this.box.onmouseenter = () => clearTimeout(this.hideTimer);
    this.box.onmouseleave = () => this.scheduleHide();
    document.body.append(this.box);
  }

  show(e: Employee, left: number, top: number, asstId: string | null = null): void {
    clearTimeout(this.hideTimer);
    if (this.id !== e.sessionId) this.err = '';
    this.id = e.sessionId;
    this.asstId = asstId;
    this.fill(e);
    this.box.style.display = 'block';
    this.box.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 320))}px`;
    this.box.style.top = `${Math.max(0, Math.min(top, window.innerHeight - this.box.offsetHeight - 8))}px`;
  }

  private label(text: string): HTMLElement {
    return el('div', 'font-size:11px;font-weight:700;letter-spacing:.08em;color:#8d95bd;margin-bottom:4px', text);
  }

  /** 小幫手自己的卡：機器人頭像、描述、狀態、屬於哪位主人、開始時間；沒有「請他下班」 */
  private fillHelper(e: Employee, a: Assistant): void {
    const color = projectColor(roomKey(e));
    const done = a.status === 'done';
    const st = done ? { text: '完成', color: '#f2b83d', bg: '#f2b83d22' } : { text: '工作中', color: '#46d983', bg: '#46d98322' };
    const body = el('div', 'padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px');
    const avatar = el('div', `width:56px;height:56px;border-radius:16px;background:${color}33;border:1px solid ${color}88;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center`);
    avatar.append(shapesSvg(bot(done).shapes, '0 0 24 24', 44));
    const chip = el('span', `display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:999px;background:${st.bg};color:${st.color};font-size:12px;font-weight:700`);
    chip.append(el('span', `width:7px;height:7px;border-radius:50%;background:${st.color}`), document.createTextNode(st.text));
    const text = el('div', 'min-width:0;display:flex;flex-direction:column;gap:6px');
    const chipRow = el('div');
    chipRow.append(chip);
    text.append(
      el('div', 'font-size:11px;font-weight:700;letter-spacing:.08em;color:#8d95bd', '助理'),
      el('div', `font-size:16px;font-weight:700;line-height:1.35;${clampCss(2)}`, oneLine(a.description) || '（無描述）'),
      chipRow,
    );
    const head = el('div', 'display:flex;gap:12px;align-items:center');
    head.append(avatar, text);
    const owner = el('div', 'background:#ffffff0d;border:1px solid #ffffff14;border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:8px');
    owner.append(
      el('span', `width:8px;height:8px;border-radius:2px;background:${color};flex:none`),
      el('span', 'color:#8d95bd;flex:none', '屬於'),
      el('span', 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt) || '（無標題）'),
      el('span', 'color:#8d95bd;font-size:12px;flex:none', e.folder),
    );
    body.append(head, owner, el('div', 'border-top:1px solid #ffffff14;padding-top:12px;font-size:12px;color:#8d95bd', `開始 ${formatTime(a.startedAt)}`));
    this.box.replaceChildren(el('div', `height:5px;background:${color}`), body);
  }

  fill(e: Employee): void {
    if (this.asstId) {
      const a = e.assistants.find((x) => x.id === this.asstId);
      if (a) return this.fillHelper(e, a);
      this.hide(); // 這位小幫手已經離開
      return;
    }
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

    // 助理：每位一行
    if (e.assistants.length) {
      const list = el('div', 'border-top:1px solid #ffffff14');
      for (const a of e.assistants) {
        const done = a.status === 'done';
        const row = el('div', 'display:flex;align-items:center;gap:8px;padding:5px 0');
        row.append(
          el('span', `width:8px;height:8px;border-radius:50%;background:${done ? '#f2b83d' : '#46d983'};flex:none`),
          el('span', `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${done ? '#8d95bd' : '#dfe3ff'}`, oneLine(a.description) || '（無描述）'),
          el('span', 'font-size:12px;color:#8d95bd', done ? '完成' : '工作中'),
        );
        list.append(row);
      }
      const help = el('div');
      help.append(this.label(`助理 · ${e.assistants.length}`), list);
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

  /** 這位小幫手離開時，如果正顯示它的卡就收起來 */
  hideHelper(ownerId: string, asstId: string): void {
    if (this.id === ownerId && this.asstId === asstId) this.hide();
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
  private helpers = new Map<string, Helper>(); // 桌邊小幫手（key = 主人 id/助理 id）
  private helperTimers = new Map<string, Phaser.Time.TimerEvent>(); // 助理完成後離開的計時
  private badges = new Map<string, Phaser.GameObjects.Container>(); // 主人 id → 「+N」徽章
  private sig = '';
  private roomObjs: Phaser.GameObjects.GameObject[] = [];
  private desks = new Map<string, DeskObj>();
  private signs = new Map<string, SignObj>();
  private slots = new Map<string, Slot>();
  private leaving = new Map<Phaser.GameObjects.Container, Leaver>(); // 走向出口中的人，離開前島要保留
  private clock = new DoneClock(); // 跨 reset 保留，已淡出的助理不會因重連又出現
  private card!: InfoCard;
  private emptyText!: Phaser.GameObjects.Text;
  private z = 1; // 內部渲染倍率（整數）：畫布放大、文字以同倍率繪製才不會糊

  constructor(private store: OfficeStore) {
    super('office');
  }

  create(): void {
    this.z = this.registry.get('zoom') ?? 1;
    this.cameras.main.setOrigin(0, 0).setZoom(this.z);
    bakeTextures(this);
    this.emptyText = this.add
      .text(BASE_W / 2, BASE_H / 2 + EMPTY_DY, '目前沒有人上班\n開一個 Claude Code session 就會出現', {
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
        this.guard(() => this.upsertReal(c.employee, true));
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
      this.emptyText.setPosition(next.width / 2, next.height / 2 + EMPTY_DY).setVisible(next.islands.length === 0);
      this.scale.resize(next.width * this.z, next.height * this.z);
      this.game.events.emit('office-size', next.width, next.height);
    });
    for (const s of this.slots.values()) {
      this.guard(() => {
        if (s.walking) this.startWalk(s, this.rerouteTo(s.emp, s.person));
        else {
          const home = this.homeOf(s.emp);
          s.person.setPosition(home.x, home.y);
          this.sortDepth(s.person);
        }
        this.drawDesk(s.emp);
        this.syncHelpers(s.emp);
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

  private drawFloor(l: Layout): void {
    const g = this.keep(this.add.graphics().setDepth(-100));
    drawShapes(g, officeShell(l.width, l.height, l.voids).shapes, 1, 0, 0);
  }

  private drawIsland(isl: Island): void {
    const R = this.z;
    const base = this.keep(this.add.graphics().setDepth(-90));
    base.fillStyle(mixColor(FLOOR, isl.color, 0.3), 1).fillRoundedRect(isl.x, isl.y, isl.w, isl.h, ISLAND_R);
    // 招牌：米色板 + 專案色塊 + 專案名；等你回覆的人數由 updateSigns 畫徽章並調整板寬
    const depth = isl.y + 20;
    const sx = isl.x + SIGN.dx;
    const sy = isl.y + SIGN.dy;
    const board = this.keep(this.add.graphics().setDepth(depth));
    const name = this.keep(
      this.add
        .text(sx + 22, sy + SIGN.h / 2, isl.title, { fontFamily: FONT, resolution: R, fontSize: '14px', fontStyle: 'bold', color: SIGN.text })
        .setOrigin(0, 0.5)
        .setDepth(depth),
    );
    const badgeBg = this.add.graphics();
    const text = this.add
      .text(0, 0, '', { fontFamily: FONT, resolution: R, fontSize: '11px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    const badge = this.keep(this.add.container(sx, sy + SIGN.h / 2, [badgeBg, text]).setDepth(depth).setVisible(false));
    this.signs.set(isl.key, { isl, board, name, badge, badgeBg, text, count: -1 });

    for (let i = 0; i < isl.desks; i++) {
      const c = seatCell(isl, i);
      const d: DeskObj = {
        img: this.keep(addSprite(this, deskKey('empty'), c.x + DESK.x, c.y + DESK.y).setDepth(c.y + DESK.y + DESK.h)),
        plate: this.keep(
          this.add
            .text(c.x + PLATE.x, c.y + PLATE.y, '', { fontFamily: FONT, resolution: R, fontSize: '9px', color: '#f4efe6', padding: { x: 3, y: 1 } })
            .setDepth(c.y + DESK.y + DESK.h),
        ),
      };
      this.desks.set(`${isl.key}#${i}`, d);
    }
  }

  /** 招牌：依各專案等你回覆的人數更新徽章（數量 > 0 才顯示並放大縮小），板寬隨之重畫 */
  private updateSigns(): void {
    for (const s of this.signs.values()) {
      if (!s.board.active || !s.badge.active) continue;
      const n = waitingCount(this.store.employees.values(), s.isl.key);
      if (n === s.count) continue;
      s.count = n;
      const show = n > 0;
      const { isl } = s;
      const sx = isl.x + SIGN.dx;
      const sy = isl.y + SIGN.dy;

      let bw = 0;
      if (show) {
        s.text.setText(`等你 ${n}`);
        bw = Math.ceil(s.text.width) + 14;
        s.badgeBg.clear().fillStyle(SIGN.badge, 1).fillRoundedRect(-bw / 2, -SIGN.badgeH / 2, bw, SIGN.badgeH, SIGN.badgeH / 2);
      }

      // 招牌可以伸進右側走道：整塊招牌右緣最多到島右緣 + 走道寬 - 8（不碰下一座島的招牌）。
      // 1 欄的島：無徽章時專案名最寬 112，有徽章時約 112 - 2 - 徽章寬
      const boardMax = isl.w + ISLAND.gap - 8 - SIGN.dx;
      const maxName = Math.max(SIGN.minName, show ? boardMax - 34 - bw : boardMax - 32);
      s.name.setText(isl.title);
      // 放不下時從中間截斷，保留開頭與結尾（同開頭的專案仍可分辨）
      if (s.name.width > maxName) s.name.setText(fitMiddle(isl.title, (t) => (s.name.setText(t), s.name.width <= maxName)));
      const nameW = Math.ceil(s.name.width);

      const boardW = show ? 22 + nameW + 8 + bw + 4 : 22 + nameW + 10;
      s.board.clear();
      s.board.fillStyle(SIGN.color, 1).fillRoundedRect(sx, sy, boardW, SIGN.h, SIGN.r);
      s.board.fillStyle(hexNum(isl.color), 1).fillRoundedRect(sx + 10, sy + (SIGN.h - 16) / 2, 6, 16, 2);

      s.badge.setVisible(show);
      if (show) {
        s.badge.setPosition(sx + 22 + nameW + 8 + bw / 2, sy + SIGN.h / 2);
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
    for (const p of this.leaving.keys()) {
      this.tweens.killTweensOf(p);
      p.destroy();
    }
    this.leaving.clear();
    for (const key of [...this.helpers.keys()]) this.dropHelper(key);
    for (const b of this.badges.values()) b.destroy();
    this.badges.clear();
    this.card.hide();
    this.relayout(true);
    for (const e of this.store.employees.values()) this.guard(() => this.upsertReal(e, false));
    this.updateSigns();
  }

  private destroySlot(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    this.slots.delete(id);
    this.clock.prune(`${id}/`, new Set());
    s.anim?.remove(false);
    this.tweens.killTweensOf([s.person, s.figure, s.mark]);
    s.person.destroy();
  }

  /** 人物深度依腳的 y 排序：坐在桌後時桌子在前面，路過時前後關係自然 */
  private sortDepth(person: Phaser.GameObjects.Container): void {
    person.setDepth(person.y + 28);
  }

  private walkTo(person: Phaser.GameObjects.Container, to: Pt, setFrame: (f: 0 | 1) => void, done?: () => void): void {
    this.tweens.killTweensOf(person);
    const dist = Math.hypot(person.x - to.x, person.y - to.y);
    this.tweens.add({
      targets: person,
      x: to.x,
      y: to.y,
      duration: Math.max(200, dist * 4),
      onUpdate: () => {
        setFrame((Math.floor(performance.now() / WALK_MS) % 2) as 0 | 1);
        this.sortDepth(person);
      },
      onComplete: () => {
        this.sortDepth(person);
        done?.();
      },
    });
  }

  /** 依序走過每個點（與目前位置重疊的點略過） */
  private walkPath(person: Phaser.GameObjects.Container, pts: Pt[], setFrame: (f: 0 | 1) => void, done?: () => void): void {
    let i = 0;
    while (i < pts.length && Math.hypot(pts[i]!.x - person.x, pts[i]!.y - person.y) < 1) i++;
    const to = pts[i];
    if (!to) {
      this.tweens.killTweensOf(person);
      person.setPosition(pts[pts.length - 1]?.x ?? person.x, pts[pts.length - 1]?.y ?? person.y);
      this.sortDepth(person);
      done?.();
      return;
    }
    const rest = pts.slice(i + 1);
    this.walkTo(person, to, setFrame, () => {
      if (!person.active) return;
      this.walkPath(person, rest, setFrame, done);
    });
  }

  // ---- 員工 ----

  private upsertReal(e: Employee, walkIn: boolean): void {
    this.upsert(e, walkIn);
    this.syncHelpers(e);
  }

  private upsert(e: Employee, walkIn: boolean): void {
    let s = this.slots.get(e.sessionId);
    if (!s) {
      s = this.createSlot(e);
      this.slots.set(e.sessionId, s);
      if (walkIn) {
        const path = this.entryOf(e);
        const start = path[0] ?? this.homeOf(e);
        s.person.setPosition(start.x, start.y);
        this.sortDepth(s.person);
        s.emp = e;
        this.startWalk(s, path);
      } else {
        const home = this.homeOf(e);
        s.person.setPosition(home.x, home.y);
        this.sortDepth(s.person);
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
      s.person,
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
    for (const key of [...this.helpers.keys()]) if (key.startsWith(`${id}/`)) this.dropHelper(key); // 主人下班，助理一起消失
    this.badges.get(id)?.destroy();
    this.badges.delete(id);
    const s = this.slots.get(id);
    if (!s) return;
    const { person } = s;
    this.slots.delete(id);
    this.clock.prune(`${id}/`, new Set());
    s.anim?.remove(false);
    this.clearDeskIfFree(s.emp, id);
    if (this.card.id === id) this.card.hide();
    this.tweens.killTweensOf([s.figure, s.mark]);
    s.figure.y = 0;
    person.disableInteractive();
    s.bubble.setVisible(false);
    s.mark.setVisible(false);
    const l: Leaver = { emp: s.emp, sprite: s.sprite };
    this.leaving.set(person, l); // 走出辦公室之前，這座島先保留
    this.walkOut(person, l);
    this.updateSigns();
  }

  /** 從目前位置走出辦公室；走到出口後移除並重排（最後一個人離開後，島才消失） */
  private walkOut(person: Phaser.GameObjects.Container, l: Leaver): void {
    this.walkPath(
      person,
      this.exitOf(l.emp, person),
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
    const figure = this.add.container(0, 0, [sprite]);
    const bubbleBg = this.add.graphics();
    const bubbleText = this.add.text(0, 0, '', { fontFamily: FONT, resolution: this.z, fontSize: '10px', color: '#2b2233' }).setOrigin(0.5);
    const bubble = this.add.container(0, -40, [bubbleBg, bubbleText]).setVisible(false);
    const mark = addSprite(this, 'exclamation', EXCL.x, EXCL.y).setVisible(false);
    const person = this.add.container(0, 0, [figure, bubble, mark]); // 陰影已畫在角色素材裡
    person.setInteractive(new Phaser.Geom.Rectangle(-20, -28, 40, 56), Phaser.Geom.Rectangle.Contains);
    const id = e.sessionId;
    person.on('pointerover', () => {
      const cur = this.slots.get(id);
      if (!cur) return;
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.width / this.lay.width; // 畫面被放大後，場景座標要換成螢幕座標
      this.card.show(cur.emp, r.left + (person.x + 26) * k, r.top + (person.y - 40) * k);
    });
    person.on('pointerout', () => this.card.scheduleHide());
    return { emp: e, person, figure, sprite, bubble, bubbleBg, bubbleText, mark, shown: null, walking: false };
  }

  // ---- 繪製 ----

  private drawBubble(s: Slot, text: string): void {
    s.bubble.setVisible(text !== '');
    if (!text) return;
    s.bubbleText.setText(text);
    const w = Math.ceil(s.bubbleText.width) + 14;
    const h = Math.ceil(s.bubbleText.height) + 8;
    const g = s.bubbleBg.clear();
    g.fillStyle(0x2b2233, 1).fillRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 5);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    g.fillStyle(0x2b2233, 1).fillTriangle(-5, h / 2, 5, h / 2, 0, h / 2 + 7);
    g.fillStyle(0xffffff, 1).fillTriangle(-3, h / 2 - 1, 3, h / 2 - 1, 0, h / 2 + 4);
    s.bubble.setY(-28 - 6 - h / 2);
  }

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
    this.drawBubble(s, e.status === 'working' ? truncate(e.activity ?? '…', 10) : '');
    if (s.walking) return; // 走路中維持走路姿勢，到座位後再套用狀態動作
    if (s.shown === e.status) return; // 只有狀態改變才重設動作，重複 upsert 不會疊加 tween
    s.shown = e.status;
    this.tweens.killTweensOf([s.figure, s.mark]);
    s.figure.y = 0;
    s.mark.setVisible(e.status === 'waiting').setY(EXCL.y);
    this.applyPose(s, e);
    if (e.status === 'idle') this.tweens.add({ targets: s.figure, y: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (e.status === 'waiting') {
      s.figure.y = RAISE_Y;
      this.tweens.add({ targets: s.mark, y: EXCL.y - EXCL_BOUNCE, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** e 有值：畫出該員工的桌子；e 為 undefined：把 at 那一桌清成空桌 */
  private drawDesk(e?: Employee, at?: Employee): void {
    const t = e ?? at;
    if (!t) return;
    const d = this.desks.get(`${roomKey(t)}#${t.seat}`);
    if (!d || !d.img.active || !d.plate.active) return;
    setSprite(d.img, deskKey(deskState(e)));
    const str = e ? nameplate(e) : '';
    const plate = d.plate;
    plate.setBackgroundColor(str ? 'rgba(20,23,42,0.7)' : '');
    plate.setText(str);
    // 依實際寬度裁切並補「…」，避免被硬切在字中間
    if (plate.width > PLATE_W) plate.setText(fitText(str, (x) => (plate.setText(x), plate.width <= PLATE_W)));
  }

  // ---- 助理：主人桌邊的小幫手，不佔座位 ----

  private placeHelper(h: Helper, e: Employee, mode: 'snap' | 'move'): void {
    const isl = this.islandOf(e);
    if (!isl) return;
    const seat = Math.max(0, e.seat);
    const home = helperHome(isl, seat, h.slot);
    this.tweens.killTweensOf(h.c);
    h.walking = false;
    if (mode === 'snap') {
      h.c.setPosition(home.x, home.y);
      this.sortDepth(h.c);
    } else if (mode === 'move') {
      this.startHelperWalk(h, [home]);
    }
  }

  private startHelperWalk(h: Helper, path: Pt[]): void {
    h.walking = true;
    this.walkPath(h.c, path, () => {}, () => {
      h.walking = false;
    });
  }

  private makeHelper(e: Employee, slot: number, aid: string): Helper {
    const img = addSprite(this, 'bot-work', -HELPER_R, -HELPER_R);
    const c = this.add.container(0, 0, [img]);
    c.setInteractive(new Phaser.Geom.Rectangle(-HELPER_R, -HELPER_R, HELPER_R * 2, HELPER_R * 2), Phaser.Geom.Rectangle.Contains);
    const ownerId = e.sessionId;
    c.on('pointerover', () => {
      const cur = this.store.employees.get(ownerId);
      if (!cur) return;
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.width / this.lay.width;
      this.card.show(cur, r.left + (c.x + 20) * k, r.top + (c.y - 30) * k, aid);
    });
    c.on('pointerout', () => this.card.scheduleHide());
    return { c, img, ownerId, aid, slot, done: false, walking: false };
  }

  /** 工作中的小幫手上下輕晃 1 px；完成的不動 */
  private applyHelperLook(h: Helper, done: boolean, force: boolean): void {
    if (!force && h.done === done) return;
    h.done = done;
    this.tweens.killTweensOf(h.img);
    h.img.y = -HELPER_R;
    setSprite(h.img, done ? 'bot-done' : 'bot-work');
    if (!done) this.tweens.add({ targets: h.img, y: -HELPER_R + 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** 依主人的助理清單增減桌邊小幫手：最多畫 2 位，其餘合併成「+N」；完成的助理 3 秒後走出辦公室（由前端計時） */
  private syncHelpers(e: Employee): void {
    const isl = this.islandOf(e);
    if (!isl) return;
    const now = Date.now();
    const id = e.sessionId;
    const prefix = `${id}/`;
    // 已經走掉的完成助理（計時已過）不再出現，重連或下一個事件都不會讓它復活
    const live = e.assistants.filter((a) => a.status !== 'done' || this.helpers.has(helperKey(id, a.id)) || this.clock.remaining(helperKey(id, a.id), now) > 0);
    const { shown, extra } = helperSlots(live);
    const keep = new Set<string>();
    shown.forEach((a, slot) => {
      const key = helperKey(id, a.id);
      const done = a.status === 'done';
      keep.add(key);
      if (done) {
        this.clock.mark(key, now);
        if (!this.helperTimers.has(key)) this.helperTimers.set(key, this.time.delayedCall(this.clock.remaining(key, now), () => this.dropHelper(key)));
      }
      let h = this.helpers.get(key);
      if (!h) {
        h = this.makeHelper(e, slot, a.id);
        this.helpers.set(key, h);
        this.placeHelper(h, e, 'snap'); // 直接出現在主人桌邊，不從門口走進來
        this.applyHelperLook(h, done, true);
        return;
      }
      if (h.slot !== slot) {
        h.slot = slot;
        this.placeHelper(h, e, 'move');
      } else if (!h.walking) {
        this.placeHelper(h, e, 'snap'); // 島搬動或重畫後回到自己的位置
      }
      this.applyHelperLook(h, done, false);
    });
    for (const key of [...this.helpers.keys()]) if (key.startsWith(prefix) && !keep.has(key)) this.dropHelper(key);
    this.clock.prune(prefix, new Set(e.assistants.map((a) => helperKey(id, a.id))));
    this.drawBadge(e, isl, extra);
  }

  private drawBadge(e: Employee, isl: Island, extra: number): void {
    let b = this.badges.get(e.sessionId);
    if (extra <= 0) {
      b?.destroy();
      this.badges.delete(e.sessionId);
      return;
    }
    const c = seatCell(isl, Math.max(0, e.seat));
    if (!b || !b.active) {
      const g = this.add.graphics().fillStyle(0xe98f3f, 1).fillCircle(0, 0, 9);
      const t = this.add.text(0, 0, '', { fontFamily: FONT, resolution: this.z, fontSize: '11px', fontStyle: 'bold', color: '#1d1a2e' }).setOrigin(0.5);
      const badge = this.add.container(0, 0, [g, t]);
      badge.setInteractive(new Phaser.Geom.Circle(0, 0, 9), Phaser.Geom.Circle.Contains);
      const ownerId = e.sessionId;
      badge.on('pointerover', () => {
        const cur = this.store.employees.get(ownerId);
        if (!cur) return;
        const r = this.game.canvas.getBoundingClientRect();
        const k = r.width / this.lay.width;
        this.card.show(cur, r.left + (badge.x + 14) * k, r.top + (badge.y - 20) * k);
      });
      badge.on('pointerout', () => this.card.scheduleHide());
      this.badges.set(e.sessionId, badge);
      b = badge;
    }
    (b.list[1] as Phaser.GameObjects.Text).setText(`+${extra}`);
    b.setPosition(c.x + 82, c.y + 20).setDepth(c.y + 120);
  }

  /** 小幫手離開：原地消失 */
  private dropHelper(key: string): void {
    this.helperTimers.get(key)?.remove(false);
    this.helperTimers.delete(key);
    const h = this.helpers.get(key);
    if (!h) return;
    this.helpers.delete(key);
    this.card.hideHelper(h.ownerId, h.aid);
    this.tweens.killTweensOf([h.c, h.img]);
    h.c.destroy();
  }
}
