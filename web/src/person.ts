// 一個人：漫畫人物 SVG（椅背、姿勢群組、漫符都在 SVG 裡）、水平走路。el 的 left = 人的中心 x（樓層座標）
// 姿勢、表情、漫符與動畫全交給 figure.css 依 data-act／data-bubble 決定，這裡只設屬性
import { figureSvg, FIG } from './figure.js';
import { walkMs, walkPos, type Walk } from './floors.js';
import { reduceMotion } from './motion.js';
import { PoseDriver } from './pose.js';
import type { Look } from './view.js';

export type Act = 'work' | 'up' | 'idle' | 'walk' | 'stand';

export class Person {
  readonly el = document.createElement('div');
  readonly pose: PoseDriver; // 工具動作、等待小動作、歡呼（只設 data-pose，造型在 figure.css）
  private act: Act | null = null;
  private x = 0; // 停著的位置；走路中是目的地
  private walk: Walk | null = null;
  private walkT: ReturnType<typeof setTimeout> | undefined; // 站起來或走路的計時器，到了才呼叫 done

  constructor(look: Look) {
    this.el.className = 'person';
    this.el.innerHTML = figureSvg(look); // figure.ts 產生、不含使用者資料
    this.el.style.marginLeft = `${-FIG.w / 2}px`;
    this.pose = new PoseDriver((p) => {
      if (p) this.el.dataset.pose = p;
      else delete this.el.dataset.pose;
    });
    this.setAct('work');
    this.setBubble(false);
    this.pose.work(null); // 預設打字
  }

  /** 只設 data-act；姿勢、表情、漫符與坐下站起的過場由 CSS 接手 */
  setAct(a: Act): void {
    if (a === this.act) return;
    this.act = a;
    this.el.dataset.act = a;
  }

  /** 只設 data-bubble；泡泡與 zZ 只在 data-act="idle" 且 data-bubble="on" 時顯示 */
  setBubble(on: boolean): void {
    this.el.dataset.bubble = on ? 'on' : 'off';
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
      this.pose.still(null); // 走路時沒有道具
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
      this.pose.still(null); // 站起來：道具收起來、輪替停止
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
    this.stop();
    this.pose.stop();
    this.el.remove();
  }
}
