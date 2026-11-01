// 一個人：漫畫人物 SVG（椅背、姿勢群組、漫符都在 SVG 裡）。el 的 left = 人的中心 x（樓層座標）
// 姿勢、表情、漫符與動畫全交給 figure.css 依 data-act／data-fx 決定，這裡只設屬性
import { div } from './dom.js';
import { figureSvg, FIG } from './figure.js';
import type { Look } from './view.js';

export type Act = 'work' | 'up' | 'idle';

export const ENTER_MS = 600; // 登場「到！」；figure.css 的 fig-in 同值
export const EXIT_MS = 500; // 退場「辛苦了～」；figure.css 的 fig-out 同值

export class Person {
  readonly el = div('person');
  private act: Act | null = null;
  private fxT: ReturnType<typeof setTimeout> | undefined; // 登場或退場的計時器，同時只有一個

  constructor(look: Look) {
    this.el.innerHTML = figureSvg(look); // figure.ts 產生、不含使用者資料
    this.el.style.marginLeft = `${-FIG.w / 2}px`;
    this.setAct('work');
  }

  /** 只設 data-act；姿勢、表情、漫符與坐下站起的過場由 CSS 接手 */
  setAct(a: Act): void {
    if (a === this.act) return;
    this.act = a;
    this.el.dataset.act = a;
  }

  placeAt(x: number): void {
    this.el.style.left = `${x}px`;
  }

  /** 登場：彈出、冒「到！」，ENTER_MS 後回到狀態漫符 */
  enter(): void {
    this.fx('in', ENTER_MS, () => delete this.el.dataset.fx);
  }

  /** 退場：冒「辛苦了～」往上淡出，EXIT_MS 後呼叫 done（由呼叫端移除）。用計時器而不是 animationend：樓層 DOM 被搬動時動畫會被取消 */
  exit(done: () => void): void {
    this.fx('out', EXIT_MS, done);
  }

  /** 退場中又回來：停掉退場，回到座位上的樣子 */
  cancelExit(): void {
    clearTimeout(this.fxT);
    delete this.el.dataset.fx;
  }

  private fx(kind: 'in' | 'out', ms: number, then: () => void): void {
    clearTimeout(this.fxT);
    this.el.dataset.fx = kind;
    this.fxT = setTimeout(then, ms);
  }

  destroy(): void {
    clearTimeout(this.fxT);
    this.el.remove();
  }
}
