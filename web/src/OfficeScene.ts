import Phaser from 'phaser';
import { truncate } from '../../src/state/describe.js';
import type { Employee } from '../../src/state/types.js';
import { addSprite, bakeTextures, deskKey, drawShapes, ensureChar, setSprite, type DeskState, type Pose } from './art.js';
import { OFFICE, officeShell } from './flat.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, assistantSeat, asstKey, entryPath, fitMiddle, fitText, formatTime, isAsst, layout, layoutSig, makeAssistant, nameplate, PALETTE,
  roomKey, seatCell, waitingCount, DoneClock, BASE_H, BASE_W, ISLAND, type Island, type Layout, type VEmployee,
} from './view.js';

const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const PLATE_W = 84;
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

// 資訊卡（HTML 浮層）。內容一律用 textContent，避免 prompt 內容被當成 HTML。
class InfoCard {
  private el = document.createElement('div');
  private prompt = document.createElement('div');
  private activity = document.createElement('div');
  private time = document.createElement('div');
  private helpers = document.createElement('div');
  private err = document.createElement('div');
  private btn = document.createElement('button');
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  id: string | null = null;

  constructor() {
    this.el.style.cssText =
      'position:fixed;display:none;z-index:10;max-width:280px;padding:10px 12px;background:#2b2840;color:#eee;' +
      'border:2px solid #8a7fc4;border-radius:4px;font:13px/1.5 system-ui,sans-serif;word-break:break-all;box-shadow:3px 3px 0 #0007';
    this.prompt.style.marginBottom = '4px';
    this.prompt.style.whiteSpace = 'pre-line';
    this.btn.textContent = '請他下班';
    this.btn.style.cssText = 'margin-top:8px;padding:4px 10px;cursor:pointer';
    this.err.style.cssText = 'color:#ff8a80;margin-top:4px';
    this.btn.onclick = async () => {
      const id = this.id;
      if (!id) return;
      try {
        const r = await fetch(`/employees/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
        if (!r.ok) throw new Error(String(r.status));
        this.hide();
      } catch {
        this.err.textContent = '操作失敗，請稍後再試';
      }
    };
    this.el.append(this.prompt, this.activity, this.time, this.helpers, this.btn, this.err);
    this.el.onmouseenter = () => clearTimeout(this.hideTimer);
    this.el.onmouseleave = () => this.scheduleHide();
    document.body.append(this.el);
  }

  show(e: Employee, left: number, top: number): void {
    clearTimeout(this.hideTimer);
    if (this.id !== e.sessionId) this.err.textContent = '';
    this.id = e.sessionId;
    this.fill(e);
    this.el.style.display = 'block';
    this.el.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 300))}px`;
    this.el.style.top = `${Math.max(0, top)}px`;
  }

  fill(e: Employee): void {
    if (isAsst(e)) {
      const { description, done, parentTitle } = e.asst;
      this.prompt.textContent = `助理：${description || '（無描述）'}（${done ? '完成' : '工作中'}）\n主人：${parentTitle || '（無標題）'}`;
      this.activity.textContent = '';
      this.time.textContent = `開始時間：${formatTime(e.arrivedAt)}`;
      this.helpers.textContent = '';
      this.btn.style.display = 'none';
      return;
    }
    this.btn.style.display = '';
    this.prompt.textContent = `${e.title ? `標題：${e.title}\n` : ''}第一個 prompt：${e.firstPrompt || '（無）'}\n最近的 prompt：${e.lastPrompt || '（無）'}`;
    this.activity.textContent = `目前：${e.activity ?? '—'}`;
    this.time.textContent = `到班時間：${formatTime(e.arrivedAt)}`;
    this.helpers.textContent = e.assistants.length
      ? '助理：' + e.assistants.map((a) => `${a.description || '(無描述)'}（${a.status === 'done' ? '完成' : '工作中'}）`).join('、')
      : '';
  }

  scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 250);
  }

  hide(): void {
    clearTimeout(this.hideTimer);
    this.el.style.display = 'none';
    this.id = null;
  }
}

const deskState = (e?: Employee): DeskState =>
  !e ? 'empty' : e.status === 'waiting' ? 'waiting' : e.status === 'working' ? 'working' : 'idle';

export class OfficeScene extends Phaser.Scene {
  private lay: Layout = { islands: [], width: BASE_W, height: BASE_H, voids: [] };
  private virtuals = new Map<string, VEmployee>(); // 助理扮成的虛擬員工（key = 主人 id/助理 id）
  private asstTimers = new Map<string, Phaser.Time.TimerEvent>(); // 助理完成後離開的計時
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
      .text(BASE_W / 2, BASE_H / 2, '目前沒有人上班\n開一個 Claude Code session 就會出現', {
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
    list.push(...this.virtuals.values());
    for (const { emp } of this.leaving.values()) if (!this.store.employees.has(emp.sessionId) && !this.virtuals.has(emp.sessionId)) list.push(emp);
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
      this.emptyText.setPosition(next.width / 2, next.height / 2).setVisible(next.islands.length === 0);
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
    for (const t of this.asstTimers.values()) t.remove(false);
    this.asstTimers.clear();
    this.virtuals.clear();
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
    this.syncAssistants(e);
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
    for (const key of [...this.virtuals.keys()]) if (key.startsWith(`${id}/`)) this.dropAssistant(key); // 主人下班，助理跟著走
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
    plate.setBackgroundColor(str ? (e && isAsst(e) ? 'rgba(44,58,94,0.8)' : 'rgba(20,23,42,0.7)') : ''); // 助理的名牌偏藍
    plate.setText(str);
    // 依實際寬度裁切並補「…」，避免被硬切在字中間
    if (plate.width > PLATE_W) plate.setText(fitText(str, (x) => (plate.setText(x), plate.width <= PLATE_W)));
  }

  // ---- 助理：進行中的助理是主人那座島上的一位員工 ----

  private seatsTaken(cwd: string, except?: string): Set<number> {
    const taken = new Set<number>();
    for (const o of [...this.store.employees.values(), ...this.virtuals.values()]) if (o.cwd === cwd && o.sessionId !== except) taken.add(o.seat);
    return taken;
  }

  /** 虛擬員工的座位不能和真員工（伺服器依 cwd 配的座位，不知道有助理）或其他助理重複；撞到的助理換到新桌 */
  private resolveSeats(cwd: string): void {
    const used = new Set<number>();
    for (const e of this.store.employees.values()) if (e.cwd === cwd) used.add(e.seat);
    for (const v of this.virtuals.values()) {
      if (v.cwd !== cwd) continue;
      if (used.has(v.seat)) v.seat = assistantSeat(this.store.employees.get(v.asst.parentId)?.seat ?? 0, used);
      used.add(v.seat);
    }
  }

  /** 依主人的助理清單增減虛擬員工；完成的助理 3 秒後走出辦公室（由前端計時） */
  private syncAssistants(e: Employee): void {
    const now = Date.now();
    const prefix = `${e.sessionId}/`;
    const present = new Set<string>();
    for (const a of e.assistants) {
      const key = asstKey(e.sessionId, a.id);
      const done = a.status === 'done';
      if (done && !this.virtuals.has(key) && this.clock.remaining(key, now) <= 0) continue; // 已離開過，不再出現
      present.add(key);
      if (done) {
        this.clock.mark(key, now);
        if (!this.asstTimers.has(key)) this.asstTimers.set(key, this.time.delayedCall(this.clock.remaining(key, now), () => this.dropAssistant(key)));
      }
      const seat = this.virtuals.get(key)?.seat ?? assistantSeat(e.seat, this.seatsTaken(e.cwd));
      this.virtuals.set(key, makeAssistant(e, a, seat));
    }
    // 還在工作卻從清單消失的助理直接離開；已完成的留給自己的計時
    for (const [key, v] of [...this.virtuals]) if (key.startsWith(prefix) && !present.has(key) && !v.asst.done) this.dropAssistant(key);
    this.clock.prune(prefix, new Set(e.assistants.map((a) => asstKey(e.sessionId, a.id))));
    this.resolveSeats(e.cwd);
    this.guard(() => this.relayout());
    for (const v of [...this.virtuals.values()]) if (v.cwd === e.cwd) this.guard(() => this.upsert(v, true));
  }

  /** 助理離開：走回門口，空桌保留到整座島沒人 */
  private dropAssistant(key: string): void {
    this.asstTimers.get(key)?.remove(false);
    this.asstTimers.delete(key);
    this.virtuals.delete(key);
    this.leave(key);
  }

}
