import Phaser from 'phaser';
import { truncate } from '../../src/state/describe.js';
import type { Assistant, Employee } from '../../src/state/types.js';
import { bakeTextures, deskKey, ensureChar, SCALE, type DeskState, type Pose } from './art.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, deskCount, DoneClock, fitText, formatTime, nameplate, ORIGIN_Y, PALETTE,
  SCENE_W, sceneHeight, seatPosition,
} from './view.js';

const WALL_H = 120;
const DOOR = { x: 28, y: ORIGIN_Y + 46 };
const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const FADE_MS = 400;
const PLATE_W = 100;
const MAX_ASSIST = 3;
const TYPE_MS = 200; // 打字動畫換幀間隔
const WALK_MS = 140; // 走路換幀間隔

// 一格裡各物件相對格子左上角 (p) 的位置
const PERSON = { x: 40, y: 46 }; // 員工座位（人物中心）
const DESK = { x: 40, y: 80 }; // 桌子中心
const PLATE = { y1: 96, y2: 106 };
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
  private desks: DeskObj[] = [];
  private slots = new Map<string, Slot>();
  private leaving = new Set<Phaser.GameObjects.Container>();
  private clock = new DoneClock(); // 跨 reset 保留，已淡出的助理不會因重連又出現
  private card!: InfoCard;
  private floor!: Phaser.GameObjects.TileSprite;

  constructor(private store: OfficeStore) {
    super('office');
  }

  create(): void {
    bakeTextures(this);
    this.drawBackdrop();
    this.card = new InfoCard();
    this.rebuild();
    this.store.on((c) => {
      if (c.type === 'reset') this.rebuild();
      else if (c.type === 'leave') this.leave(c.sessionId);
      else {
        this.setDesks(Math.max(this.desks.length, deskCount([...this.store.employees.values()])));
        this.upsert(c.employee, true);
      }
    });
  }

  // ---- 背景：牆、窗、招牌、地板、門、盆栽 ----

  private drawBackdrop(): void {
    this.add.tileSprite(0, 0, SCENE_W, WALL_H, 'wall').setOrigin(0).setTileScale(SCALE).setDepth(-100);
    this.floor = this.add
      .tileSprite(0, WALL_H, SCENE_W, sceneHeight(8) - WALL_H, 'floor')
      .setOrigin(0)
      .setTileScale(SCALE)
      .setDepth(-100);
    const g = this.add.graphics().setDepth(-99);
    g.fillStyle(0x4a3d73, 1).fillRect(0, WALL_H - 8, SCENE_W, 8); // 踢腳板
    g.fillStyle(0x2b2233, 1).fillRect(0, WALL_H, SCENE_W, 2);
    for (const x of [250, 345, 440]) this.add.image(x, 56, 'window').setScale(SCALE).setDepth(-98);
    // 招牌
    g.fillStyle(0x2b2233, 1).fillRect(46, 20, 138, 36);
    g.fillStyle(0xf2e6c9, 1).fillRect(49, 23, 132, 30);
    this.add.text(115, 38, 'Claude 辦公室', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#3b2f4a' })
      .setOrigin(0.5).setDepth(-97);
    this.add.image(DOOR.x, DOOR.y, 'door').setScale(SCALE).setDepth(-50);
    g.fillStyle(0x8a3b3b, 1).fillRect(DOOR.x - 18, DOOR.y + 32, 36, 10); // 門墊
    this.add.image(SCENE_W - 26, WALL_H + 20, 'plant').setScale(SCALE).setDepth(-50);
  }

  // ---- 場景管理 ----

  /** reset：全部清掉重建（員工直接站在座位，不走路） */
  private rebuild(): void {
    for (const id of [...this.slots.keys()]) this.destroySlot(id);
    for (const p of this.leaving) {
      this.tweens.killTweensOf(p);
      p.destroy();
    }
    this.leaving.clear();
    this.card.hide();
    const list = [...this.store.employees.values()];
    this.setDesks(0); // 先清空再依員工數重建
    this.setDesks(deskCount(list));
    for (const e of list) this.upsert(e, false);
  }

  private setDesks(n: number): void {
    while (this.desks.length > n) {
      const d = this.desks.pop()!;
      d.img.destroy();
      d.line1.destroy();
      d.line2.destroy();
    }
    while (this.desks.length < n) {
      const i = this.desks.length;
      const p = seatPosition(i);
      const txt = () => ({ fontFamily: FONT, fontSize: '9px', color: '#e6e1f5' });
      this.desks.push({
        img: this.add.image(p.x + DESK.x, p.y + DESK.y, deskKey('empty')).setScale(SCALE).setDepth(p.y + DESK.y),
        line1: this.add.text(p.x, p.y + PLATE.y1, '', txt()).setDepth(p.y + DESK.y),
        line2: this.add.text(p.x, p.y + PLATE.y2, '', { ...txt(), color: '#a9a3c9' }).setDepth(p.y + DESK.y),
      });
      this.drawDesk(i);
    }
    this.scale.resize(SCENE_W, sceneHeight(n));
    this.floor.setSize(SCENE_W, sceneHeight(n) - WALL_H);
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

  private homeOf(seat: number): { x: number; y: number } {
    const p = seatPosition(seat);
    return { x: p.x + PERSON.x, y: p.y + PERSON.y };
  }

  /** 人物深度依腳的 y 排序：坐在桌後時桌子在前面，路過時前後關係自然 */
  private sortDepth(person: Phaser.GameObjects.Container): void {
    person.setDepth(person.y + 24);
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
    const home = this.homeOf(e.seat);
    if (!s) {
      s = this.createSlot(e);
      this.slots.set(e.sessionId, s);
      if (walkIn) {
        s.person.setPosition(DOOR.x, DOOR.y);
        this.startWalk(s, home);
      } else {
        s.person.setPosition(home.x, home.y);
        this.sortDepth(s.person);
      }
    } else if (s.emp.seat !== e.seat) {
      this.clearDeskIfFree(s.emp.seat, e.sessionId);
      this.startWalk(s, home);
    }
    s.emp = e;
    if (e.seat < this.desks.length) this.drawDesk(e.seat, e);
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
    this.clearDeskIfFree(s.emp.seat, id);
    if (this.card.id === id) this.card.hide();
    this.tweens.killTweensOf([s.figure, s.mark]);
    s.figure.y = 0;
    person.disableInteractive();
    s.bubble.setVisible(false);
    s.mark.setVisible(false);
    this.leaving.add(person);
    this.walkTo(person, DOOR, (f) => s.sprite.setTexture(this.charTexture(s.emp, f === 0 ? 'walk0' : 'walk1')), () => {
      this.leaving.delete(person);
      person.destroy();
    });
  }

  private clearDeskIfFree(seat: number, exceptId: string): void {
    if (seat >= this.desks.length) return;
    for (const [id, o] of this.slots) if (id !== exceptId && o.emp.seat === seat) return;
    this.drawDesk(seat);
  }

  private charTexture(e: Employee, pose: Pose): string {
    const look = appearance(e.sessionId);
    return ensureChar(this, pose, look.hair, PALETTE[look.shirt]);
  }

  private createSlot(e: Employee): Slot {
    const sprite = this.add.image(0, 0, this.charTexture(e, 'sit0')).setScale(SCALE);
    const figure = this.add.container(0, 0, [sprite]);
    const bubbleBg = this.add.graphics();
    const bubbleText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#2b2233' }).setOrigin(0.5);
    const bubble = this.add.container(0, -40, [bubbleBg, bubbleText]).setVisible(false);
    const mark = this.add
      .text(0, -40, '!', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#e53935', padding: { x: 7, y: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    const cup = this.add.image(22, 6, 'cup').setScale(SCALE).setVisible(false);
    const person = this.add.container(0, 0, [figure, cup, bubble, mark]);
    person.setInteractive(new Phaser.Geom.Rectangle(-16, -24, 32, 48), Phaser.Geom.Rectangle.Contains);
    const id = e.sessionId;
    person.on('pointerover', () => {
      const cur = this.slots.get(id);
      if (!cur) return;
      const r = this.game.canvas.getBoundingClientRect();
      this.card.show(cur.emp, r.left + person.x + 22, r.top + person.y - 40);
    });
    person.on('pointerout', () => this.card.scheduleHide());
    const more = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '9px', color: '#fff', backgroundColor: '#2b2233', padding: { x: 3, y: 1 } })
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
    s.bubble.setY(-24 - 6 - h / 2 + (s.emp.status === 'waiting' ? -6 : 0));
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
    s.mark.setVisible(e.status === 'waiting').setY(-48);
    s.cup.setVisible(e.status === 'idle');
    this.applyPose(s, e);
    this.drawBubble(s, e.status === 'working' ? truncate(e.activity ?? '…', 10) : '');
    if (e.status === 'waiting') {
      s.figure.y = -6;
      this.tweens.add({ targets: s.mark, y: -56, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawAssistant(v: AsstView, a: Assistant): void {
    v.box.setTexture(a.status === 'done' ? 'bot-done' : 'bot-working');
    v.label.setText(a.status === 'done' ? '👍 完成' : fitText(a.description, (t) => [...t].length <= 4));
  }

  private drawDesk(seat: number, e?: Employee): void {
    const d = this.desks[seat];
    d.img.setTexture(deskKey(deskState(e)));
    const [a, b] = e ? nameplate(e) : ['', ''];
    for (const [obj, str] of [[d.line1, a], [d.line2, b]] as const) {
      obj.setText(str);
      // 依實際寬度裁切並補「…」，避免被硬切在字中間
      if (obj.width > PLATE_W) obj.setText(fitText(str, (t) => (obj.setText(t), obj.width <= PLATE_W)));
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
    const base = seatPosition(e.seat);
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
      .text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#fff', backgroundColor: '#2b2233', padding: { x: 3, y: 1 } })
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
