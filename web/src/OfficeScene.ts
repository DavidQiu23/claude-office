import Phaser from 'phaser';
import { truncate } from '../../src/state/describe.js';
import type { Assistant, Employee } from '../../src/state/types.js';
import type { OfficeStore } from './sync.js';
import {
  appearance, deskCount, DoneClock, fitText, formatTime, nameplate, ORIGIN_Y, PALETTE,
  SCENE_W, sceneHeight, seatPosition,
} from './view.js';

const DOOR = { x: 26, y: ORIGIN_Y + 44 };
const FONT = 'system-ui, "Microsoft JhengHei", sans-serif';
const FADE_MS = 400;
const PLATE_W = 90;
const MAX_ASSIST = 3;
const USE_TINT = true; // 角色圖本身已有配色而顯得混濁時改成 false

interface DeskObj { rect: Phaser.GameObjects.Rectangle; img?: Phaser.GameObjects.Image; line1: Phaser.GameObjects.Text; line2: Phaser.GameObjects.Text }
interface AsstView {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  done: boolean;
  fadeTimer?: Phaser.Time.TimerEvent;
}
interface Slot {
  emp: Employee;
  person: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Container; // 身體 + 頭髮；打字抖動與站起只動它
  body: Phaser.GameObjects.Rectangle;
  hair: Phaser.GameObjects.Rectangle;
  bubble: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Rectangle;
  bubbleText: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  cup: Phaser.GameObjects.Text;
  more: Phaser.GameObjects.Text; // 助理超過 3 個時顯示 +N
  shown: Employee['status'] | null; // 目前套用的動作對應的狀態
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
      'position:fixed;display:none;z-index:10;max-width:280px;padding:10px 12px;background:#2b2b3b;color:#eee;' +
      'border:1px solid #666;border-radius:6px;font:13px/1.5 system-ui,sans-serif;word-break:break-all;box-shadow:0 2px 8px #0008';
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

export class OfficeScene extends Phaser.Scene {
  private desks: DeskObj[] = [];
  private slots = new Map<string, Slot>();
  private leaving = new Set<Phaser.GameObjects.Container>();
  private clock = new DoneClock(); // 跨 reset 保留，已淡出的助理不會因重連又出現
  private card!: InfoCard;

  constructor(private store: OfficeStore) {
    super('office');
  }

  // 素材放在 web/public/assets/（見該資料夾 LICENSE.md）。缺檔或載入失敗時不報錯，沿用色塊。
  preload(): void {
    this.load.on('loaderror', () => {});
    this.load.image('worker', 'assets/worker.png');
    this.load.image('desk', 'assets/desk.png');
  }

  create(): void {
    this.add.text(64, 24, 'Claude 辦公室', { fontFamily: FONT, fontSize: '18px', color: '#cdd6f4' });
    this.add.rectangle(DOOR.x, DOOR.y, 32, 56, 0x6d4c41).setStrokeStyle(2, 0x3e2723);
    this.add.text(DOOR.x, DOOR.y + 40, '門', { fontFamily: FONT, fontSize: '12px', color: '#aaa' }).setOrigin(0.5);
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
      d.rect.destroy();
      d.img?.destroy();
      d.line1.destroy();
      d.line2.destroy();
    }
    while (this.desks.length < n) {
      const i = this.desks.length;
      const p = seatPosition(i);
      const txt = () => ({ fontFamily: FONT, fontSize: '9px', color: '#ddd' });
      const rect = this.add.rectangle(p.x + 40, p.y + 66, 72, 22, 0x8d6e63).setStrokeStyle(1, 0x5d4037);
      this.desks.push({
        rect,
        // 在文字之前建立，且深度低於人物（10）與助理（5），不會蓋住它們
        img: this.textures.exists('desk') ? this.add.image(rect.x, rect.y, 'desk').setDisplaySize(72, 22).setDepth(-1) : undefined,
        line1: this.add.text(p.x - 2, p.y + 78, '', txt()),
        line2: this.add.text(p.x - 2, p.y + 87, '', { ...txt(), color: '#9aa' }),
      });
      this.drawDesk(i);
    }
    this.scale.resize(SCENE_W, sceneHeight(n));
  }

  private destroySlot(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    this.slots.delete(id);
    for (const v of s.assist.values()) this.destroyAsst(v);
    this.clock.prune(`${id}/`, new Set());
    s.more.destroy();
    this.tweens.killTweensOf([s.person, s.figure, s.mark]);
    s.person.destroy();
  }

  private homeOf(seat: number): { x: number; y: number } {
    const p = seatPosition(seat);
    return { x: p.x + 30, y: p.y + 44 };
  }

  private walkTo(person: Phaser.GameObjects.Container, to: { x: number; y: number }, done?: () => void): void {
    this.tweens.killTweensOf(person);
    const dist = Math.hypot(person.x - to.x, person.y - to.y);
    this.tweens.add({ targets: person, x: to.x, y: to.y, duration: Math.max(200, dist * 4), onComplete: done });
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
        this.walkTo(s.person, home);
      } else {
        s.person.setPosition(home.x, home.y);
      }
    } else if (s.emp.seat !== e.seat) {
      this.clearDeskIfFree(s.emp.seat, e.sessionId);
      this.walkTo(s.person, home);
    }
    s.emp = e;
    if (e.seat < this.desks.length) this.drawDesk(e.seat, e);
    this.drawEmployee(s, e);
    this.syncAssistants(s, e);
    if (this.card.id === e.sessionId) this.card.fill(e);
  }

  private leave(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    const { person } = s;
    this.slots.delete(id);
    for (const v of s.assist.values()) this.destroyAsst(v);
    s.assist.clear();
    this.clock.prune(`${id}/`, new Set());
    s.more.destroy();
    s.cup.setVisible(false);
    this.clearDeskIfFree(s.emp.seat, id);
    if (this.card.id === id) this.card.hide();
    this.tweens.killTweensOf([s.figure, s.mark]);
    person.disableInteractive();
    s.bubble.setVisible(false);
    s.mark.setVisible(false);
    this.leaving.add(person);
    this.walkTo(person, DOOR, () => {
      this.leaving.delete(person);
      person.destroy();
    });
  }

  private clearDeskIfFree(seat: number, exceptId: string): void {
    if (seat >= this.desks.length) return;
    for (const [id, o] of this.slots) if (id !== exceptId && o.emp.seat === seat) return;
    this.drawDesk(seat);
  }

  private createSlot(e: Employee): Slot {
    const bodyRect = this.add.rectangle(0, 0, 20, 24, 0xffffff);
    const hair = this.add.rectangle(0, -16, 20, 8, 0xffffff);
    const figure = this.add.container(0, 0, [bodyRect, hair]);
    const bubbleBg = this.add.rectangle(0, 0, 10, 10, 0xffffff).setStrokeStyle(1, 0x333333);
    const bubbleText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: '#222' }).setOrigin(0.5);
    const bubble = this.add.container(0, -36, [bubbleBg, bubbleText]).setVisible(false);
    const mark = this.add
      .text(0, -34, '!', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#e53935' })
      .setOrigin(0.5)
      .setVisible(false);
    const cup = this.add.text(18, 2, '☕', { fontFamily: FONT, fontSize: '14px' }).setOrigin(0.5).setVisible(false);
    const person = this.add.container(0, 0, [figure, cup, bubble, mark]).setDepth(10);
    person.setInteractive(new Phaser.Geom.Rectangle(-16, -28, 32, 56), Phaser.Geom.Rectangle.Contains);
    const id = e.sessionId;
    person.on('pointerover', () => {
      const cur = this.slots.get(id);
      if (!cur) return;
      const r = this.game.canvas.getBoundingClientRect();
      this.card.show(cur.emp, r.left + person.x + 14, r.top + person.y - 40);
    });
    person.on('pointerout', () => this.card.scheduleHide());
    const more = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '9px', color: '#fff', backgroundColor: '#222', padding: { x: 2, y: 1 } })
      .setOrigin(0, 0.5)
      .setDepth(20)
      .setVisible(false);
    return { more, emp: e, person, figure, body: bodyRect, hair, bubble, bubbleBg, bubbleText, mark, cup, shown: null, assist: new Map() };
  }

  // ---- 繪製（素材只動 preload / drawEmployee / drawDesk；drawAssistant 刻意維持色塊，目前沒有助理素材）----

  private drawEmployee(s: Slot, e: Employee): void {
    const look = appearance(e.sessionId);
    s.body.setFillStyle(PALETTE[look.shirt]);
    s.hair.setFillStyle(PALETTE[look.hair]);
    if (this.textures.exists('worker')) {
      let img = s.figure.getByName('sprite') as Phaser.GameObjects.Image | null;
      if (!img) {
        img = this.add.image(0, 0, 'worker').setName('sprite').setDisplaySize(20, 32);
        s.figure.add(img);
      }
      if (USE_TINT) img.setTint(PALETTE[look.shirt]); // 單一影格以衣服顏色區分員工；坐、走由 tween 表現
      s.body.setVisible(false);
      s.hair.setVisible(false);
    }

    const text = e.status === 'working' ? truncate(e.activity ?? '…', 10) : '';
    s.bubble.setVisible(text !== '');
    if (text) {
      s.bubbleText.setText(text);
      s.bubbleBg.setSize(s.bubbleText.width + 10, s.bubbleText.height + 6);
    }

    if (s.shown === e.status) return; // 只有狀態改變才重設動作，重複 upsert 不會疊加 tween
    s.shown = e.status;
    this.tweens.killTweensOf([s.figure, s.mark]);
    s.figure.y = 0;
    s.mark.setVisible(e.status === 'waiting').setY(-34);
    s.cup.setVisible(e.status === 'idle');
    if (e.status === 'working') {
      this.tweens.add({ targets: s.figure, y: 2, duration: 160, yoyo: true, repeat: -1 });
    } else if (e.status === 'waiting') {
      s.figure.y = -10;
      this.tweens.add({ targets: s.mark, y: -42, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawAssistant(v: AsstView, a: Assistant): void {
    v.box.setFillStyle(a.status === 'done' ? 0x2ecc71 : 0x95a5a6);
    v.label.setText(a.status === 'done' ? '👍 完成' : fitText(a.description, (t) => [...t].length <= 4));
  }

  private drawDesk(seat: number, e?: Employee): void {
    const d = this.desks[seat];
    d.rect.setFillStyle(e?.status === 'waiting' ? 0xc0392b : 0x8d6e63);
    if (d.img) {
      d.img.setTint(e?.status === 'waiting' ? 0xff8a80 : 0xffffff); // 等你處理時桌面泛紅
      d.rect.setVisible(false);
    }
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
    // 助理放在員工右側、桌子上方，方塊與標籤都在 96px 格子內；超過 3 個只顯示前 2 個加「+N」
    const base = seatPosition(e.seat);
    const all = [...s.assist.values()];
    const shown = all.length > MAX_ASSIST ? MAX_ASSIST - 1 : all.length;
    all.forEach((v, i) => {
      const y = base.y + 8 + i * 14;
      v.box.setPosition(base.x + 50, y).setVisible(i < shown);
      v.label.setPosition(base.x + 58, y).setVisible(i < shown);
    });
    s.more.setPosition(base.x + 46, base.y + 8 + shown * 14).setText(`+${all.length - shown}`).setVisible(all.length > shown);
  }

  private createAsst(): AsstView {
    const box = this.add.rectangle(0, 0, 10, 10, 0x95a5a6).setDepth(5);
    const label = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '9px', color: '#fff', backgroundColor: '#222', padding: { x: 2, y: 1 } })
      .setOrigin(0, 0.5)
      .setDepth(20);
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
