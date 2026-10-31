import Phaser from 'phaser';
import type { Employee } from '../../src/state/types.js';
import { addSprite, bakeSprite, bakeTextures, CHAIR_KEY, deskKey, drawShapes, ensureChar, HAIR_COLORS, OUTFITS, PERSON_SHADOW_KEY, setSprite, type DeskState, type Pose } from './art.js';
import { drawClay } from './clay.js';
import { character, FLOOR, isoRoom, mix, quad, type Shape } from './flat.js';
import { planWall } from './furniture.js';
import { chairDepth, deskDepth, focusCamera, islandsBox, personDepth, plateAt, roomBox, roomSize, toScreen } from './iso.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, assistantList, entryPath, formatTime, layout, layoutSig, nameplate, PALETTE, PLATE, plateFit, platePrefix, plateWidths, projectColor,
  roomKey, seatCell, signFit, signMaxW, statusCount, BASE_H, BASE_W, DOOR_X, SEAT, type Island, type Layout,
} from './view.js';

const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const TYPE_MS = 200; // 打字動畫換幀間隔
const WALK_MS = 140; // 走路換幀間隔
const MAX_ZOOM = 2; // 鏡頭放大上限（人少時對準島放大，最多 2 倍）

type Pt = { x: number; y: number };

const FAILED_SIG = '\u0000failed'; // 不會等於任何版面簽名：強制下次重畫
// 地上招牌：色帶在島前緣外 20–44 的地板上（避開前排名牌）；等待人數圓章直立在色帶尾端外側
const SIGN = { gap: 20, h: 24, r: 6, pad: 9, badge: 0xff4d4d, badgeR: 9 };
// 輪到你（status idle）：琥珀色，比等你處理的紅色安靜一階（不脈動）
const TURN = { fill: 0xf2b83d, ink: '#2b1d00' };
// 頭上的泡泡：尾巴尖端在腳底點 (+6, −61)，頭頂右上；固定螢幕大小（同名牌，每幀抵銷鏡頭縮放）
const BUBBLE = { x: 6, y: -61 };

// 一格（seatCell 左上角）裡各物件的相對位置：座位點見 view.ts 的 SEAT
const PLATE_DEPTH = 1000; // 名牌永遠在人與桌之上
// 名牌（設計稿 10：桌上名片座）：卡片色依狀態，底座是桌子前緣的木色
const PLATE_COLORS: Record<Employee['status'], { face: number; edge: number; ink: string }> = {
  working: { face: 0xf3e9d6, edge: 0xd8c7aa, ink: '#3b2f2a' },
  waiting: { face: 0xd63434, edge: 0xa82a2a, ink: '#ffffff' },
  idle: { face: 0xf2b83d, edge: 0xc9952c, ink: '#2b1d00' },
};
const PLATE_WOOD = { fill: 0xb87a45, edge: 0x8d5a31 };
// 角色素材 (0,0) 相對地板點（縮放前）：素材 40×56，底部中心（腳底陰影）對到地板點
const CHAR = { x: -20, y: -54 };
const CHAR_SCALE = 1; // 套在 figure 容器上
const SIT_Y = -6; // 坐著時身體上移，臀部落在椅墊上（走路時 0）
const RAISE_Y = -6; // 舉手時再上移
const HEAD = { y: CHAR.y + 16 + SIT_Y, r: 12.5 }; // 坐著時臉的圓心（相對地板點）與半徑：素材頭部圓 (20, 16) r12.5

const hexNum = (h: string): number => parseInt(h.slice(1), 16) || 0;

/** 輪到你的泡泡（螢幕 px，尾巴尖端在原點）：琥珀圓角框 22×17、白邊，裡面一個深色勾 */
const drawBubble = (g: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics => {
  g.fillStyle(TURN.fill, 1).lineStyle(1.5, 0xffffff, 1);
  g.fillTriangle(0, 0, 1, -6, 7, -6).strokeTriangle(0, 0, 1, -6, 7, -6);
  g.fillRoundedRect(-3, -22, 22, 17, 6).strokeRoundedRect(-3, -22, 22, 17, 6);
  g.fillRect(1.8, -6.6, 4.4, 2.2); // 蓋掉框與尾巴接縫的白邊
  g.lineStyle(2.4, hexNum(TURN.ink), 1).beginPath().moveTo(3, -13.3).lineTo(6.5, -9.9).lineTo(13.2, -17.1).strokePath();
  return g;
};

// 名牌 = container（位置、縮放、深度、顯示）裡的圓角底色 bg + 文字 text
// drawn = 上次畫的狀態、字級與文字，沒變就不重畫
interface DeskObj { cell: Pt; img: Phaser.GameObjects.Image; plate: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; emp?: Employee; drawn?: string }
interface SignObj {
  isl: Island;
  badge: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  tween?: Phaser.Tweens.Tween;
  count: number; // 上次畫的等待人數（-1 = 還沒畫過）
  turn: Phaser.GameObjects.Container; // 輪到你人數的琥珀圓章，接在紅圓章後面
  turnText: Phaser.GameObjects.Text;
  turnCount: number;
  at: (dx: number) => Pt; // 圓章位置：色帶尾端外側再往後 dx
}
interface Leaver { emp: Employee; sprite: Phaser.GameObjects.Image; at: Pt }
interface Slot {
  emp: Employee;
  at: Pt; // 目前的地板座標；畫面位置由 place 換算
  person: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Container; // 角色圖；站起來只動它
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Graphics; // 輪到你時頭上的泡泡，放在 figure 裡跟著浮動
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
  idle: { text: '輪到你', color: '#f2b83d', bg: '#f2b83d22' },
};
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();
const clampCss = (n: number): string => `display:-webkit-box;-webkit-line-clamp:${n};-webkit-box-orient:vertical;overflow:hidden;word-break:break-all`;

/** 小 DOM 工具：建立元素、套樣式、放文字 */
const el = (tag: string, css = '', text = ''): HTMLElement => {
  const n = document.createElement(tag);
  n.style.cssText = css;
  if (text) n.textContent = text;
  return n;
};

/** 這位員工的頭與肩膀（和桌上的人同一個外觀） */
function avatarCanvas(e: Employee): HTMLCanvasElement {
  const look = appearance(e.sessionId);
  const shirt = '#' + (PALETTE[look.shirt] ?? PALETTE[0]!).toString(16).padStart(6, '0');
  const sprite = character({ pose: 'sit0', style: look.style, outfit: OUTFITS[look.outfit], glasses: look.glasses, hair: HAIR_COLORS[look.hair], shirt });
  const cv = document.createElement('canvas');
  const dpr = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  cv.width = cv.height = 56 * dpr; // 依螢幕解析度，顯示 56px
  cv.style.cssText = 'display:block;width:56px;height:56px';
  const ctx = cv.getContext('2d');
  if (ctx) {
    // 素材 x 0–40、y 8–44 放大 1.4 倍置中到 56×56
    ctx.scale(1.4 * dpr, 1.4 * dpr);
    ctx.translate(0, -6);
    drawClay(ctx, sprite.shapes, 'figure');
  }
  return cv;
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
    avatar.append(avatarCanvas(e));
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
  private view = { zoom: 0, x: 0, y: 0 }; // 鏡頭目前（或 tween 中）的倍率與中心；zoom 0 = 還沒設定過

  constructor(private store: OfficeStore) {
    super('office');
  }

  create(): void {
    this.z = this.registry.get('zoom') ?? 1;
    this.cameras.main.setOrigin(0.5).setZoom(this.z);
    bakeTextures(this);
    // 位置與縮放由 fitView 設定
    this.emptyText = this.add
      .text(0, 0, '目前沒有人上班\n開一個 Claude Code session 就會出現', {
        fontFamily: FONT, resolution: this.z, fontSize: '14px', color: '#aab0d0', align: 'center',
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
    return { x: c.x + SEAT.x, y: c.y + SEAT.y };
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

  /** 鏡頭對準有人的島（人少放大、人多拉遠，不露出房間外；沒人時框整個房間）；畫布大小固定。第一次直接設定，之後倍率或中心有變就 300ms 平移縮放 */
  private fitView(): void {
    const { w, h } = roomSize(this.lay.islands);
    const { zoom, cx, cy } = focusCamera(islandsBox(this.lay.islands), roomBox(w, h), BASE_W, BASE_H, MAX_ZOOM);
    const mid = toScreen(w / 2, h / 2 + 40);
    this.emptyText.setPosition(mid.x, mid.y);
    const cam = this.cameras.main;
    const to = { zoom: this.z * zoom, x: cx, y: cy };
    // 名牌每幀跟著縮放與移位；文字（寬度上限、只顯示名字）在倍率定下來時才重算
    const apply = (v: typeof to, relabel: boolean): void => {
      cam.setZoom(v.zoom).centerOn(v.x, v.y);
      this.emptyText.setScale(this.z / v.zoom); // 提示字維持 14px 畫面字級
      this.placePlates(relabel);
    };
    this.tweens.killTweensOf(this.view);
    if (this.view.zoom === 0) apply(Object.assign(this.view, to), true);
    else if (this.view.zoom !== to.zoom || this.view.x !== to.x || this.view.y !== to.y) {
      this.card.hide(); // 平移期間卡片會錯位
      this.placePlates(false); // 新畫的名牌先放好，不會在 (0,0) 出現一幀
      this.tweens.add({ targets: this.view, ...to, duration: 300, ease: 'Sine.easeInOut', onUpdate: () => apply(this.view, false), onComplete: () => apply(this.view, true) });
    } else this.placePlates(true); // 鏡頭沒變，但重畫後的名牌還沒放好
  }

  /** 名牌固定螢幕大小：縮放抵銷鏡頭，上緣照 plateAt（以卡片高計算，底座與影子往下垂） */
  private placePlates(relabel: boolean): void {
    const zoom = this.view.zoom / this.z;
    for (const d of this.desks.values()) {
      if (!d.plate.active) continue;
      const p = plateAt(d.cell, zoom, PLATE.cardH);
      d.plate.setPosition(p.x, p.y).setScale(1 / zoom);
    }
    if (relabel) this.labelPlates();
    for (const s of this.slots.values()) s.bubble.setScale(1 / zoom);
  }

  /** 房間類圖形（地板、牆、地墊、地毯）：用 Graphics 填色，不透明多邊形描一條 1px 邊（規格 §16.2） */
  private drawRoom(shapes: Shape[], depth: number, dx = 0, dy = 0): void {
    const g = this.keep(this.add.graphics().setDepth(depth));
    drawShapes(g, shapes, 1, dx, dy);
    for (const s of shapes) {
      if (s.t !== 'p' || (s.a ?? 1) < 1) continue;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i + 1 < s.pts.length; i += 2) pts.push(new Phaser.Math.Vector2(s.pts[i]! + dx, s.pts[i + 1]! + dy));
      g.lineStyle(1, hexNum(mix(s.c, '#1d1a2e', 0.12)), 1).strokePoints(pts, true, true);
    }
  }

  private drawFloor(l: Layout): void {
    const { w, h } = roomSize(l.islands);
    this.drawRoom(isoRoom(w, h).shapes, -100);
    // 牆面與靠牆家具：每種物件烘一次貼圖；地墊、門墊屬房間類，直接畫
    let poster = 0;
    for (const it of planWall(w, h, [...new Set(l.islands.map((i) => i.y))], DOOR_X)) {
      const at = toScreen(it.fx, it.fy);
      if (it.id === 'zoneMat' || it.id === 'doorMat') {
        this.drawRoom(it.make().shapes, it.depth, at.x, at.y);
        continue;
      }
      const key = `furn-${it.id}${it.id === 'calendarPoster' ? `-${poster++}` : ''}`; // 第 k 張月曆配色不同
      bakeSprite(this, key, it.make());
      this.keep(addSprite(this, key, at.x, at.y).setDepth(it.depth));
    }
  }

  private drawIsland(isl: Island): void {
    const R = this.z; // 實際最大倍率約 0.83（ceil 為 1），以 1 倍繪製即清晰
    const rect = (x0: number, y0: number, x1: number, y1: number, c: string): Shape => ({ t: 'p', c, pts: quad([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]) });
    this.drawRoom([
      rect(isl.x, isl.y, isl.x + isl.w, isl.y + isl.h, mix(FLOOR, isl.color, 0.5)),
      rect(isl.x + 6, isl.y + 6, isl.x + isl.w - 6, isl.y + isl.h - 6, mix(FLOOR, isl.color, 0.3)),
    ], -90);

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

    // 人數圓章：直立在色帶中線、尾端外側（紅 = 等你處理、琥珀 = 輪到你），數字與位置由 updateSigns 填
    const at = (dx: number): Pt => toScreen(isl.x + bandW + 9 + dx, gy + SIGN.h / 2);
    const mkBadge = (fill: number, color: string) => {
      const c = this.keep(this.add.container(at(0).x, at(0).y).setDepth(-79).setVisible(false));
      c.add(this.add.graphics().fillStyle(fill, 1).fillCircle(0, 0, SIGN.badgeR).lineStyle(2, 0xffffff, 1).strokeCircle(0, 0, SIGN.badgeR));
      const t = this.add.text(0, 0, '', { ...font, fontSize: '11px', color }).setOrigin(0.5);
      c.add(t);
      return { c, t };
    };
    const red = mkBadge(SIGN.badge, '#ffffff');
    const amber = mkBadge(TURN.fill, TURN.ink);
    this.signs.set(isl.key, { isl, badge: red.c, text: red.t, count: -1, turn: amber.c, turnText: amber.t, turnCount: -1, at });

    for (let i = 0; i < isl.desks; i++) {
      const c = seatCell(isl, i);
      const s = toScreen(c.x, c.y);
      this.keep(addSprite(this, CHAIR_KEY, s.x, s.y).setDepth(chairDepth(c)));
      const img = this.keep(addSprite(this, deskKey('empty'), s.x, s.y).setDepth(deskDepth(c)));
      // 位置與縮放由 placePlates 設定；先 keep 容器再加子物件，中途出錯也會隨重畫銷毀
      const plate = this.keep(this.add.container(0, 0).setVisible(false).setDepth(deskDepth(c) + PLATE_DEPTH));
      const bg = this.add.graphics();
      const text = this.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', resolution: this.z, fontSize: '13px', padding: { x: PLATE.pad, y: 1 }, fixedHeight: PLATE.cardH }).setOrigin(0.5, 0);
      plate.add([bg, text]);
      const d: DeskObj = { cell: c, img, plate, bg, text };
      this.desks.set(`${isl.key}#${i}`, d);
    }
  }

  /** 招牌：依各專案等你處理（紅，放大縮小）與輪到你（琥珀，不動）的人數更新圓章；數量 > 0 才顯示 */
  private updateSigns(): void {
    for (const s of this.signs.values()) {
      if (!s.badge.active) continue;
      const n = statusCount(this.store.employees.values(), s.isl.key, 'waiting');
      const t = statusCount(this.store.employees.values(), s.isl.key, 'idle');
      if (n === s.count && t === s.turnCount) continue;
      s.count = n;
      s.turnCount = t;
      const p = s.at(n > 0 ? 22 : 0);
      s.turn.setPosition(p.x, p.y).setVisible(t > 0);
      s.turnText.setText(String(t));
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
    s.bubble.setVisible(false);
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
    s.bubble.setVisible(false);
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
    return ensureChar(this, pose, look, PALETTE[look.shirt] ?? PALETTE[0]!, false); // 椅背由等角椅子提供
  }

  private createSlot(e: Employee): Slot {
    const sprite = addSprite(this, this.charTexture(e, 'sit0'), CHAR.x, CHAR.y);
    const bubble = drawBubble(this.add.graphics()).setPosition(BUBBLE.x, BUBBLE.y - SIT_Y).setVisible(false); // figure 坐著時在 SIT_Y
    if (this.view.zoom) bubble.setScale(this.z / this.view.zoom);
    const figure = this.add.container(0, 0, [sprite, bubble]).setScale(CHAR_SCALE);
    const person = this.add.container(0, 0, [addSprite(this, PERSON_SHADOW_KEY, 0, 0), figure]); // 接地投影在最底層，不跟著站起或浮動
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
    return { emp: e, at: { x: 0, y: 0 }, person, figure, sprite, bubble, shown: null, walking: false };
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
    s.figure.y = SIT_Y + (e.status === 'waiting' ? RAISE_Y : 0);
    s.bubble.setVisible(e.status === 'idle');
    this.applyPose(s, e);
    if (e.status === 'idle') this.tweens.add({ targets: s.figure, y: SIT_Y + 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** e 有值：畫出該員工的桌子；e 為 undefined：把 at 那一桌清成空桌 */
  private drawDesk(e?: Employee, at?: Employee): void {
    const t = e ?? at;
    if (!t) return;
    const d = this.desks.get(`${roomKey(t)}#${t.seat}`);
    if (!d || !d.img.active || !d.plate.active) return;
    setSprite(d.img, deskKey(deskState(e)));
    d.emp = e;
    d.plate.setVisible(!!e); // 空桌不顯示名牌
    this.labelPlates(); // 標題、狀態（舉手）會影響鄰座能分到的寬度
  }

  // 量名牌寬度用 canvas，不經過 Phaser Text（每次 setText 都會重畫貼圖）
  private readonly measureCtx = document.createElement('canvas').getContext('2d')!;
  /** 名牌整塊寬（字寬 + 左右內距） */
  private plateWidth(s: string, size: number): number {
    this.measureCtx.font = `bold ${size}px ${FONT}`;
    return this.measureCtx.measureText(s).width + 2 * PLATE.pad;
  }

  /** 名牌只放標題；寬度依鄰座整批分配（設計稿 10） */
  private labelPlates(): void {
    const zoom = this.view.zoom / this.z;
    if (!(zoom > 0)) return; // 鏡頭還沒定，fitView 會再呼叫
    const ds = [...this.desks.values()].filter((d) => d.plate.active && d.emp);
    // plateWidths 用螢幕 px：世界座標 × 倍率
    const widths = plateWidths(ds.map((d) => {
      const e = d.emp!;
      const p = plateAt(d.cell, zoom, PLATE.cardH);
      const s = toScreen(d.cell.x + SEAT.x, d.cell.y + SEAT.y);
      const hy = s.y + HEAD.y + (e.status === 'waiting' ? RAISE_Y : 0);
      return { x: p.x * zoom, y: p.y * zoom, want: this.plateWidth(platePrefix(e) + nameplate(e), PLATE.sizes[0]), head: { x: s.x * zoom, y: hy * zoom, r: HEAD.r * zoom } };
    }), zoom);
    ds.forEach((d, i) => this.drawPlate(d, d.emp!, widths[i]!));
  }

  /** 桌上名片座：影子、木頭底座、卡片、上緣亮線（座標原點 = 卡片上緣中點，螢幕 px） */
  private drawPlate(d: DeskObj, e: Employee, maxW: number): void {
    const { text, size } = plateFit(e, maxW, (s, n) => this.plateWidth(s, n));
    const key = `${e.status}|${size}|${text}`;
    if (d.drawn === key) return;
    d.drawn = key;
    const c = PLATE_COLORS[e.status];
    const t = d.text.setFontSize(size).setText(text).setColor(c.ink);
    const w = t.width, x = -w / 2, h = PLATE.cardH;
    d.bg.clear()
      .fillStyle(0x000000, 0.32).fillRoundedRect(x + 2, h + 2, w - 4, 5, 2.5)
      .fillStyle(PLATE_WOOD.fill, 1).fillRoundedRect(x - 3, h - 2, w + 6, 6, 2)
      .lineStyle(1, PLATE_WOOD.edge, 1).strokeRoundedRect(x - 3, h - 2, w + 6, 6, 2)
      .fillStyle(c.face, 1).fillRoundedRect(x, 0, w, h, 3)
      .lineStyle(1.2, c.edge, 1).strokeRoundedRect(x, 0, w, h, 3)
      .fillStyle(0xffffff, 0.45).fillRoundedRect(x + 4, 2, w - 8, 2, 1);
  }
}
