import Phaser from 'phaser';
import { truncate } from '../../src/state/describe.js';
import type { Assistant, Employee } from '../../src/state/types.js';
import { bakeTextures, deskKey, ensureChar, SCALE, type DeskState, type Pose } from './art.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, doorPos, fitText, formatTime, layout, layoutSig, nameplate, PALETTE, ROOM, roomKey, seatCell,
  DoneClock, BASE_H, BASE_W, type Layout, type Room,
} from './view.js';

const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const FADE_MS = 400;
const PLATE_W = 100;
const MAX_ASSIST = 3;
const TYPE_MS = 200; // 打字動畫換幀間隔
const WALK_MS = 140; // 走路換幀間隔

// 一格裡各物件相對格子左上角的位置
const PERSON = { x: 40, y: 46 }; // 員工座位（人物中心）
const DESK = { x: 40, y: 84 }; // 桌子中心
const PLATE = { y1: 106, y2: 117 };
const strHash = (s: string): number => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const BOT = { x: 90, y: 30, gap: 30 };

interface DeskObj { img: Phaser.GameObjects.Image; line1: Phaser.GameObjects.Text; line2: Phaser.GameObjects.Text }
interface AsstView {
  box: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  done: boolean;
  fadeTimer?: Phaser.Time.TimerEvent;
}
interface Slot {
  emp: Employee;
  person: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Container; // 角色圖；站起來只動它
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  cup: Phaser.GameObjects.Image;
  more: Phaser.GameObjects.Text; // 助理超過 3 個時顯示 +N
  shown: Employee['status'] | null; // 目前套用的動作對應的狀態
  walking: boolean;
  anim?: Phaser.Time.TimerEvent; // 打字換幀
  assist: Map<string, AsstView>;
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
    this.prompt.textContent = `最近的 prompt：${e.lastPrompt || '（無）'}`;
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
  private lay: Layout = { rooms: [], width: BASE_W, height: BASE_H };
  private sig = '';
  private roomObjs: Phaser.GameObjects.GameObject[] = [];
  private desks = new Map<string, DeskObj>();
  private slots = new Map<string, Slot>();
  private leaving = new Map<Phaser.GameObjects.Container, Employee>(); // 走向門口中的人，離開前房間要保留
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
      if (c.type === 'reset') this.rebuild();
      else if (c.type === 'leave') this.leave(c.sessionId);
      else {
        this.relayout();
        this.upsert(c.employee, true);
      }
    });
  }

  // ---- 版面：一個資料夾一間辦公室 ----

  private layoutEmployees(): Employee[] {
    const list = [...this.store.employees.values()];
    for (const e of this.leaving.values()) if (!this.store.employees.has(e.sessionId)) list.push(e);
    return list;
  }

  private roomOf(e: Employee): Room | undefined {
    const k = roomKey(e);
    return this.lay.rooms.find((r) => r.key === k);
  }

  private cellOf(e: Employee): { x: number; y: number } {
    const r = this.roomOf(e);
    return r ? seatCell(r, e.seat) : { x: 0, y: 0 };
  }

  private homeOf(e: Employee): { x: number; y: number } {
    const c = this.cellOf(e);
    return { x: c.x + PERSON.x, y: c.y + PERSON.y };
  }

  private doorOf(e: Employee): { x: number; y: number } {
    const r = this.roomOf(e);
    return r ? doorPos(r) : { x: 24, y: 80 };
  }

  /** 房間的位置、大小或桌數有變才重畫；在座位上的人跟著搬到新位置 */
  private relayout(force = false): void {
    const next = layout(this.layoutEmployees());
    const sig = layoutSig(next);
    if (!force && sig === this.sig) return;
    this.sig = sig;
    this.lay = next;
    for (const o of this.roomObjs) o.destroy();
    this.roomObjs = [];
    this.desks.clear(); // 桌子物件已隨 roomObjs 銷毀
    for (const r of next.rooms) this.drawRoom(r);
    this.emptyText.setPosition(next.width / 2, next.height / 2).setVisible(next.rooms.length === 0);
    this.scale.resize(next.width * this.z, next.height * this.z);
    this.game.events.emit('office-size', next.width, next.height);
    for (const s of this.slots.values()) {
      const home = this.homeOf(s.emp);
      if (s.walking) this.startWalk(s, home);
      else {
        s.person.setPosition(home.x, home.y);
        this.sortDepth(s.person);
      }
      this.drawDesk(s.emp);
      this.syncAssistants(s, s.emp);
    }
  }

  private drawRoom(r: Room): void {
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.roomObjs.push(o);
      return o;
    };
    const R = this.z;
    const h = strHash(r.key);
    const head = ROOM.header;
    keep(this.add.tileSprite(r.x, r.y, r.w, head, 'wall').setOrigin(0).setTileScale(SCALE).setDepth(-100));
    keep(this.add.tileSprite(r.x, r.y + head, r.w, r.h - head, 'floor').setOrigin(0).setTileScale(SCALE).setDepth(-100));
    const g = keep(this.add.graphics().setDepth(-99));
    // 護牆板與踢腳板
    g.fillStyle(0x6b7aa6, 1).fillRect(r.x, r.y + head - 20, r.w, 20);
    g.fillStyle(0x8d9cc6, 1).fillRect(r.x, r.y + head - 20, r.w, 2);
    g.fillStyle(0x4a3d73, 1).fillRect(r.x, r.y + head - 5, r.w, 5);
    g.lineStyle(3, 0x2b2233, 1).strokeRect(r.x, r.y, r.w, r.h);

    // 招牌：資料夾名稱
    const maxW = r.w - 140;
    const title = keep(
      this.add
        .text(0, 0, r.title, { fontFamily: FONT, resolution: R, fontSize: '14px', fontStyle: 'bold', color: '#3b2f4a' })
        .setDepth(-97),
    );
    if (title.width > maxW) title.setText(fitText(r.title, (t) => (title.setText(t), title.width <= maxW)));
    const sw = Math.ceil(title.width) + 20;
    g.fillStyle(0x2b2233, 1).fillRect(r.x + 10, r.y + 8, sw, 28);
    g.fillStyle(0xf2e6c9, 1).fillRect(r.x + 12, r.y + 10, sw - 4, 24);
    title.setOrigin(0.5).setPosition(r.x + 10 + sw / 2, r.y + 22);
    const signEnd = 10 + sw;

    // 右側角落擺一件家具（依資料夾決定），窗戶在它左邊，牆上再掛一件小裝飾
    const corner = ['plant', 'cooler', 'bookcase'][h % 3];
    const cx = r.x + r.w - 26;
    if (corner === 'plant') keep(this.add.image(cx, r.y + head + 22, 'plant').setScale(SCALE).setDepth(-50));
    else if (corner === 'cooler') keep(this.add.image(cx, r.y + head - 6, 'cooler').setScale(SCALE).setDepth(-50));
    else keep(this.add.image(cx, r.y + head - 4, 'bookcase').setScale(SCALE).setDepth(-50));
    const wx = r.w - 90; // 窗戶中心（相對房間左邊）
    if (signEnd < wx - 24) {
      const win = keep(this.add.image(r.x + wx, r.y + 24, 'window').setScale(1.5).setDepth(-98));
      // 窗外灑進來的光
      g.fillStyle(0xfff4c2, 0.13);
      g.fillPoints(
        [
          new Phaser.Geom.Point(win.x - 16, r.y + 38),
          new Phaser.Geom.Point(win.x + 16, r.y + 38),
          new Phaser.Geom.Point(win.x + 58, r.y + r.h - 12),
          new Phaser.Geom.Point(win.x + 6, r.y + r.h - 12),
        ],
        true,
      );
    }
    const dx = wx - 62;
    if (signEnd < dx - 20) {
      const decor = ['clock', 'poster-0', 'poster-1', 'poster-2'][(h >> 3) % 4];
      keep(this.add.image(r.x + dx, r.y + 24, decor).setScale(SCALE).setDepth(-98));
    }

    // 門與門墊
    const d = doorPos(r);
    keep(this.add.image(d.x, d.y, 'door').setScale(SCALE).setDepth(-50));
    g.fillStyle(0x8a3b3b, 1).fillRect(d.x - 18, d.y + 32, 36, 10);
    g.fillStyle(0xb85a5a, 1).fillRect(d.x - 18, d.y + 32, 36, 2);

    for (let i = 0; i < r.desks; i++) {
      const c = seatCell(r, i);
      keep(this.add.image(c.x + DESK.x, c.y + DESK.y + 8, `rug-${h % 3}`).setScale(SCALE).setDepth(-90)); // 腳下地毯
      const txt = () => ({ fontFamily: FONT, resolution: R, fontSize: '9px', color: '#f4efe6', padding: { x: 3, y: 0 } });
      const d2: DeskObj = {
        img: this.add.image(c.x + DESK.x, c.y + DESK.y, deskKey('empty')).setScale(SCALE).setDepth(c.y + DESK.y),
        line1: this.add.text(c.x, c.y + PLATE.y1, '', txt()).setDepth(c.y + DESK.y),
        line2: this.add.text(c.x, c.y + PLATE.y2, '', { ...txt(), color: '#cfc8e8' }).setDepth(c.y + DESK.y),
      };
      keep(d2.img);
      keep(d2.line1);
      keep(d2.line2);
      this.desks.set(`${r.key}#${i}`, d2);
    }
  }

  // ---- 場景管理 ----

  /** reset：全部清掉重建（員工直接站在座位，不走路） */
  private rebuild(): void {
    for (const id of [...this.slots.keys()]) this.destroySlot(id);
    for (const p of this.leaving.keys()) {
      this.tweens.killTweensOf(p);
      p.destroy();
    }
    this.leaving.clear();
    this.card.hide();
    this.relayout(true);
    for (const e of this.store.employees.values()) this.upsert(e, false);
  }

  private destroySlot(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    this.slots.delete(id);
    for (const v of s.assist.values()) this.destroyAsst(v);
    this.clock.prune(`${id}/`, new Set());
    s.anim?.remove(false);
    s.more.destroy();
    this.tweens.killTweensOf([s.person, s.figure, s.mark]);
    s.person.destroy();
  }

  /** 人物深度依腳的 y 排序：坐在桌後時桌子在前面，路過時前後關係自然 */
  private sortDepth(person: Phaser.GameObjects.Container): void {
    person.setDepth(person.y + 28);
  }

  private walkTo(
    person: Phaser.GameObjects.Container,
    to: { x: number; y: number },
    setFrame: (f: 0 | 1) => void,
    done?: () => void,
  ): void {
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

  // ---- 員工 ----

  private upsert(e: Employee, walkIn: boolean): void {
    let s = this.slots.get(e.sessionId);
    const home = this.homeOf(e);
    if (!s) {
      s = this.createSlot(e);
      this.slots.set(e.sessionId, s);
      if (walkIn) {
        const door = this.doorOf(e);
        s.person.setPosition(door.x, door.y);
        s.emp = e;
        this.startWalk(s, home);
      } else {
        s.person.setPosition(home.x, home.y);
        this.sortDepth(s.person);
      }
    } else if (s.emp.seat !== e.seat) {
      this.clearDeskIfFree(s.emp, e.sessionId);
      s.emp = e;
      this.startWalk(s, home);
    }
    s.emp = e;
    this.drawDesk(e);
    this.drawEmployee(s, e);
    this.syncAssistants(s, e);
    if (this.card.id === e.sessionId) this.card.fill(e);
  }

  private startWalk(s: Slot, to: { x: number; y: number }): void {
    const id = s.emp.sessionId;
    s.walking = true;
    s.anim?.remove(false);
    s.anim = undefined;
    s.figure.y = 0;
    this.walkTo(
      s.person,
      to,
      (f) => s.sprite.setTexture(this.charTexture(s.emp, f === 0 ? 'walk0' : 'walk1')),
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
    for (const v of s.assist.values()) this.destroyAsst(v);
    s.assist.clear();
    this.clock.prune(`${id}/`, new Set());
    s.anim?.remove(false);
    s.more.destroy();
    s.cup.setVisible(false);
    this.clearDeskIfFree(s.emp, id);
    if (this.card.id === id) this.card.hide();
    this.tweens.killTweensOf([s.figure, s.mark]);
    s.figure.y = 0;
    person.disableInteractive();
    s.bubble.setVisible(false);
    s.mark.setVisible(false);
    const emp = s.emp;
    this.leaving.set(person, emp); // 走出門之前，這間辦公室先保留
    this.walkTo(person, this.doorOf(emp), (f) => s.sprite.setTexture(this.charTexture(emp, f === 0 ? 'walk0' : 'walk1')), () => {
      this.leaving.delete(person);
      person.destroy();
      this.relayout(); // 最後一個人離開後，辦公室才消失
    });
  }

  private clearDeskIfFree(e: Employee, exceptId: string): void {
    for (const [id, o] of this.slots) if (id !== exceptId && o.emp.seat === e.seat && roomKey(o.emp) === roomKey(e)) return;
    this.drawDesk(undefined, e);
  }

  private charTexture(e: Employee, pose: Pose): string {
    const look = appearance(e.sessionId);
    return ensureChar(this, pose, look.hair, PALETTE[look.shirt]);
  }

  private createSlot(e: Employee): Slot {
    const sprite = this.add.image(0, 0, this.charTexture(e, 'sit0')).setScale(SCALE);
    const figure = this.add.container(0, 0, [sprite]);
    const bubbleBg = this.add.graphics();
    const bubbleText = this.add.text(0, 0, '', { fontFamily: FONT, resolution: this.z, fontSize: '10px', color: '#2b2233' }).setOrigin(0.5);
    const bubble = this.add.container(0, -40, [bubbleBg, bubbleText]).setVisible(false);
    const mark = this.add
      .text(0, -52, '!', {
        fontFamily: FONT, resolution: this.z, fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#e53935', padding: { x: 7, y: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    const cup = this.add.image(26, 4, 'cup').setScale(SCALE).setVisible(false);
    const shadow = this.add.ellipse(0, 27, 30, 8, 0x000000, 0.28);
    const person = this.add.container(0, 0, [shadow, figure, cup, bubble, mark]);
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
    const more = this.add
      .text(0, 0, '', { fontFamily: FONT, resolution: this.z, fontSize: '9px', color: '#fff', backgroundColor: '#2b2233', padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(5000)
      .setVisible(false);
    return { more, emp: e, person, figure, sprite, bubble, bubbleBg, bubbleText, mark, cup, shown: null, walking: false, assist: new Map() };
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
      s.sprite.setTexture(this.charTexture(e, 'sit0'));
      s.anim = this.time.addEvent({
        delay: TYPE_MS,
        loop: true,
        callback: () => {
          f = 1 - f;
          s.sprite.setTexture(this.charTexture(s.emp, f ? 'sit1' : 'sit0'));
        },
      });
    } else {
      s.sprite.setTexture(this.charTexture(e, e.status === 'waiting' ? 'up' : 'idle'));
    }
  }

  private drawEmployee(s: Slot, e: Employee): void {
    this.drawBubble(s, e.status === 'working' ? truncate(e.activity ?? '…', 10) : '');
    if (s.walking) return; // 走路中維持走路姿勢，到座位後再套用狀態動作
    if (s.shown === e.status) return; // 只有狀態改變才重設動作，重複 upsert 不會疊加 tween
    s.shown = e.status;
    this.tweens.killTweensOf([s.figure, s.mark]);
    s.figure.y = 0;
    s.mark.setVisible(e.status === 'waiting').setY(-52);
    s.cup.setVisible(e.status === 'idle');
    this.applyPose(s, e);
    if (e.status === 'idle') this.tweens.add({ targets: s.figure, y: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (e.status === 'waiting') {
      s.figure.y = -6;
      this.tweens.add({ targets: s.mark, y: -60, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawAssistant(v: AsstView, a: Assistant): void {
    v.box.setTexture(a.status === 'done' ? 'bot-done' : 'bot-working');
    v.label.setText(a.status === 'done' ? '👍 完成' : fitText(a.description, (t) => [...t].length <= 4));
  }

  /** e 有值：畫出該員工的桌子；e 為 undefined：把 at 那一桌清成空桌 */
  private drawDesk(e?: Employee, at?: Employee): void {
    const t = e ?? at;
    if (!t) return;
    const d = this.desks.get(`${roomKey(t)}#${t.seat}`);
    if (!d) return;
    d.img.setTexture(deskKey(deskState(e)));
    const [a, b] = e ? nameplate(e) : ['', ''];
    for (const [obj, str] of [[d.line1, a], [d.line2, b]] as const) {
      obj.setBackgroundColor(str ? 'rgba(43,34,51,0.72)' : '');
      obj.setText(str);
      // 依實際寬度裁切並補「…」，避免被硬切在字中間
      if (obj.width > PLATE_W) obj.setText(fitText(str, (x) => (obj.setText(x), obj.width <= PLATE_W)));
    }
  }

  // ---- 助理 ----

  private syncAssistants(s: Slot, e: Employee): void {
    const now = Date.now();
    const present = new Set<string>();
    for (const a of e.assistants) {
      present.add(a.id);
      const key = `${e.sessionId}/${a.id}`;
      let v = s.assist.get(a.id);
      if (!v) {
        if (a.status === 'done' && this.clock.remaining(key, now) <= 0) continue; // 已淡出過，不再出現
        v = this.createAsst();
        s.assist.set(a.id, v);
      }
      if (a.status === 'done') {
        v.done = true;
        this.clock.mark(key, now);
        // 完成 3 秒後淡出，由前端計時；伺服器之後是否移除該助理都不影響
        v.fadeTimer ??= this.time.delayedCall(this.clock.remaining(key, now), () => this.fadeAsst(s, a.id, v!));
      }
      this.drawAssistant(v, a);
    }
    // 還在工作卻從清單消失的助理直接移除；已完成的留給自己的淡出計時
    for (const [id, v] of s.assist) {
      if (!present.has(id) && !v.done) {
        this.destroyAsst(v);
        s.assist.delete(id);
      }
    }
    this.clock.prune(`${e.sessionId}/`, new Set(e.assistants.map((a) => `${e.sessionId}/${a.id}`)));
    // 助理小機器人站在員工右側，標籤在腳下；超過 3 個只顯示前 2 個加「+N」
    const base = this.cellOf(e);
    const all = [...s.assist.values()];
    const shown = all.length > MAX_ASSIST ? MAX_ASSIST - 1 : all.length;
    all.forEach((v, i) => {
      const y = base.y + BOT.y + i * BOT.gap;
      v.box.setPosition(base.x + BOT.x, y).setVisible(i < shown).setDepth(y);
      v.label.setPosition(base.x + BOT.x, y + 20).setVisible(i < shown);
    });
    s.more.setPosition(base.x + BOT.x, base.y + BOT.y + shown * BOT.gap).setText(`+${all.length - shown}`).setVisible(all.length > shown);
  }

  private createAsst(): AsstView {
    const box = this.add.image(0, 0, 'bot-working').setScale(SCALE * 1.5);
    const label = this.add
      .text(0, 0, '', { fontFamily: FONT, resolution: this.z, fontSize: '10px', color: '#fff', backgroundColor: '#2b2233', padding: { x: 3, y: 1 } })
      .setOrigin(0.5)
      .setDepth(5000);
    return { box, label, done: false };
  }

  private fadeAsst(s: Slot, id: string, v: AsstView): void {
    v.fadeTimer = undefined;
    this.tweens.add({
      targets: [v.box, v.label],
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => {
        if (s.assist.get(id) === v) s.assist.delete(id);
        this.destroyAsst(v);
      },
    });
  }

  private destroyAsst(v: AsstView): void {
    v.fadeTimer?.remove(false);
    this.tweens.killTweensOf([v.box, v.label]);
    v.box.destroy();
    v.label.destroy();
  }
}
