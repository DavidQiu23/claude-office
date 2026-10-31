// 一個人：人物圖（1.5 倍、椅背在圖裡）、姿勢、打字/走路換幀、輪到你的泡泡、水平走路。el 的 left = 人的中心 x（樓層座標）
import type { Pose } from './flat.js';
import { walkMs, walkPos, type Walk } from './floors.js';
import { reduceMotion } from './motion.js';
import { charImg, placeImg } from './sprites.js';
import type { Look } from './view.js';

export type Act = 'work' | 'up' | 'idle' | 'walk' | 'stand';

const TYPE_MS = 200; // 打字換幀
const WALK_MS = 140; // 走路換幀
const W = 60; // 素材 40 × 1.5
// 輪到你（status idle）：琥珀色，比等你處理的紅色安靜一階
const TURN = { fill: '#f2b83d', ink: '#2b1d00' };
// 泡泡尾巴尖端在人物素材 (26, −1)（頭頂右上），× 1.5；泡泡本身以 BUBBLE.k 倍畫
const BUBBLE = { x: 39, y: -1.5, k: 1.25, ox: 5, oy: 25, w: 28, h: 28 }; // ox/oy = 尾巴尖端在小畫布裡的位置（未乘 k）

/** 輪到你的泡泡（尾巴尖端在原點）：琥珀圓角框 22×17、白邊，裡面一個深色勾 */
function drawBubble(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = TURN.fill;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(1, -6); ctx.lineTo(7, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-3, -22, 22, 17, 6);
  ctx.fill(); ctx.stroke();
  ctx.fillRect(1.8, -6.6, 4.4, 2.2); // 蓋掉框與尾巴接縫的白邊
  ctx.strokeStyle = TURN.ink;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(3, -13.3); ctx.lineTo(6.5, -9.9); ctx.lineTo(13.2, -17.1);
  ctx.stroke();
}

function bubbleCanvas(): HTMLCanvasElement {
  const { k, ox, oy, w, h } = BUBBLE;
  const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
  const cv = document.createElement('canvas');
  cv.className = 'bubble';
  cv.width = Math.ceil(w * k * dpr);
  cv.height = Math.ceil(h * k * dpr);
  cv.style.cssText = `left:${BUBBLE.x - ox * k}px;top:${BUBBLE.y - oy * k}px;width:${w * k}px;height:${h * k}px`;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.scale(k * dpr, k * dpr);
    ctx.translate(ox, oy);
    drawBubble(ctx);
  }
  return cv;
}

export class Person {
  readonly el = document.createElement('div');
  private fig = document.createElement('div'); // 站起來、浮動只動它
  private img = document.createElement('img');
  private bubble: HTMLCanvasElement | null = null;
  private act: Act | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private x = 0; // 停著的位置；走路中是目的地
  private walk: Walk | null = null;
  private walkT: ReturnType<typeof setTimeout> | undefined; // 站起來或走路的計時器，到了才呼叫 done

  constructor(private look: Look) {
    this.el.className = 'person';
    this.fig.className = 'fig';
    this.img.alt = '';
    this.img.draggable = false;
    this.fig.append(this.img);
    this.el.append(this.fig);
    this.el.style.marginLeft = `${-W / 2}px`;
    this.setAct('work');
  }

  private pose(p: Pose): void {
    placeImg(this.img, charImg(p, this.look));
  }

  /** 兩個姿勢每 ms 交替（減少動態時只顯示第一格） */
  private loop(a: Pose, b: Pose, ms: number): void {
    let f = 0;
    this.pose(a);
    if (reduceMotion()) return;
    this.timer = setInterval(() => this.pose((f = 1 - f) ? b : a), ms);
  }

  setAct(a: Act): void {
    if (a === this.act) return;
    this.act = a;
    clearInterval(this.timer);
    this.timer = undefined;
    this.el.dataset.act = a;
    if (a === 'work') this.loop('sit0', 'sit1', TYPE_MS);
    else if (a === 'walk') this.loop('walk0', 'walk1', WALK_MS);
    else this.pose(a === 'stand' ? 'walk0' : a); // stand：站著不動（走路第一格），不舉手
  }

  setBubble(on: boolean): void {
    if (on && !this.bubble) this.fig.append((this.bubble = bubbleCanvas()));
    if (this.bubble) this.bubble.hidden = !on;
  }

  /** 畫面上目前的 x：走路中依時間內插（不讀版面） */
  get at(): number {
    return this.walk ? walkPos(this.walk, performance.now()) : this.x;
  }

  /** 正在站起來或走路（還沒到目的地） */
  get moving(): boolean {
    return this.walkT !== undefined;
  }

  /** 直接放到 x（取消走路，不呼叫原本的 done） */
  placeAt(x: number): void {
    this.stop();
    this.x = x;
    this.el.style.transition = '';
    this.el.style.left = `${x}px`;
  }

  /**
   * 從目前位置等速（120px/s）走到 x，到了呼叫 done；走路中再呼叫就從當下位置轉向，前一次的 done 作廢。
   * standMs > 0：先站起來（stand）停一下再走；到了先站著不動（stand），done 再決定姿勢（坐下或等電梯門）
   */
  walkTo(x: number, done?: () => void, standMs = 0): void {
    this.placeAt(this.at);
    const go = (): void => {
      const from = this.x, ms = walkMs(from, x);
      this.setAct('walk');
      this.x = x;
      if (reduceMotion()) {
        // 減少動態：直接放到目的地，沒有滑動；計時器照舊，所以到座位的時間與順序不變
        this.el.style.transition = '';
        this.el.style.left = `${x}px`;
      } else {
        void this.el.offsetWidth; // 先讓「停在 from、沒有 transition」（含剛取消 hidden）生效，transition 才會從這裡開始
        this.el.style.transition = `left ${ms}ms linear`;
        this.el.style.left = `${x}px`;
        this.walk = { from, to: x, start: performance.now(), ms };
      }
      // 用計時器而不是 transitionend：樓層 DOM 被搬動時 transition 會被取消、不會有 transitionend
      this.walkT = setTimeout(() => {
        this.stop();
        this.el.style.transition = '';
        this.setAct('stand');
        done?.();
      }, ms);
    };
    if (standMs > 0) {
      this.setAct('stand');
      this.walkT = setTimeout(go, standMs);
    } else go();
  }

  private stop(): void {
    clearTimeout(this.walkT);
    this.walkT = undefined;
    this.walk = null;
  }

  destroy(): void {
    clearInterval(this.timer);
    this.stop();
    this.el.remove();
  }
}
