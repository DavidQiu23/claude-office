// 一個人：漫畫人物 SVG（氣場、姿勢群組都在 SVG 裡）加上瞬移的光痕和殘影、夜晚爆氣的紅光。el 的 left = 人的中心 x（樓層座標）
// 姿勢、表情與動畫全交給 figure.css 依 data-act／data-fx 決定，這裡只設屬性
import { CARD_ID } from './card.js';
import { div } from './dom.js';
import { figureSvg, FIG, WARP_SVG } from './figure.js';
import { appearance, motionDelay } from './view.js';

export type Act = 'work' | 'up' | 'idle';

export const ENTER_MS = 350; // 瞬移登場；figure.css 的 data-fx="in" 動畫同值
export const EXIT_MS = 800; // 點額 300ms＋瞬移消失 500ms；figure.css 的 data-fx="out" 動畫同值

export class Person {
  readonly el = div('person');
  private act: Act | null = null;
  private fxT: ReturnType<typeof setTimeout> | undefined; // 登場或退場的計時器，同時只有一個

  constructor(sessionId: string) {
    this.el.innerHTML = figureSvg(appearance(sessionId)) + WARP_SVG + '<div class="glow"></div>'; // figure.ts 產生、不含使用者資料；glow 是夜晚爆氣的紅光（figure.css）
    this.el.style.setProperty('--delay', `-${motionDelay(sessionId)}s`); // 打字等動作每個人錯開
    this.el.style.marginLeft = `${-FIG.w / 2}px`;
    // 鍵盤也選得到：focus 時開資訊卡（floor.ts），卡片內容當成描述
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-describedby', CARD_ID);
    this.setAct('work');
  }

  label(text: string): void {
    this.el.setAttribute('aria-label', text);
  }

  /** 只設 data-act；姿勢、表情與坐下站起的過場由 CSS 接手 */
  setAct(a: Act): void {
    if (a === this.act) return;
    this.act = a;
    this.el.dataset.act = a;
  }

  placeAt(x: number): void {
    this.el.style.left = `${x}px`;
  }

  /** 登場：瞬移出現，ENTER_MS 後回到狀態動作 */
  enter(): void {
    this.fx('in', ENTER_MS, () => delete this.el.dataset.fx);
  }

  /** 退場：站起來雙指點額，再瞬移消失，EXIT_MS 後呼叫 done（由呼叫端移除）。用計時器而不是 animationend：樓層 DOM 被搬動時動畫會被取消 */
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
