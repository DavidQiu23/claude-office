// 電梯門的排隊與計時（不碰 DOM，可用 vitest 假計時器測）：開 300ms → 叫等著的人 → 停一下 → 關 300ms → resolve
export const DOOR_MS = 300; // 電梯門開或關一次；index.html 的 .door 的 transition 同值
export const DOOR_HOLD = 500; // 門開著停多久：人從門中心走出門框（26 + 人半寬 30）約 470ms

export type DoorState = 'closed' | 'opening' | 'open' | 'closing';

export class ElevatorDoor {
  state: DoorState = 'closed';
  private t: ReturnType<typeof setTimeout> | undefined;
  private onOpen: Array<() => void> = []; // 門開好時要做的事（人走出來／走進去）
  private onClosed: Array<() => void> = []; // 門關好時 resolve

  /** show(true/false)：門板開／關的畫面（加減 class） */
  constructor(private show: (open: boolean) => void) {}

  /**
   * 搭一趟：門開好時呼叫 atOpen（一律非同步，呼叫端可以先把自己登記好），門關好時 resolve。
   * 開門中再叫就排隊；開著就重算開著的時間；關到一半就再打開；等最後一次關好才一起 resolve
   */
  ride(atOpen?: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.onClosed.push(resolve);
      if (atOpen) this.onOpen.push(atOpen);
      if (this.state === 'opening') return; // 開好時一起叫
      clearTimeout(this.t);
      if (this.state === 'open') {
        this.t = setTimeout(() => this.opened(), 0); // 已經開著：下一輪就叫，停留時間從那時重算
        return;
      }
      this.state = 'opening';
      this.show(true);
      this.t = setTimeout(() => this.opened(), DOOR_MS);
    });
  }

  private opened(): void {
    this.state = 'open';
    // 先排好關門，atOpen 裡再叫 ride 也只會重排這一個計時器
    this.t = setTimeout(() => {
      this.state = 'closing';
      this.show(false);
      this.t = setTimeout(() => {
        this.state = 'closed';
        for (const r of this.onClosed.splice(0)) r();
      }, DOOR_MS);
    }, DOOR_HOLD);
    for (const f of this.onOpen.splice(0)) f();
  }

  /** 直接當作關好（重新連線、樓層拆掉）：計時器與等著的事都作廢，promise 不再 resolve */
  cancel(): void {
    clearTimeout(this.t);
    this.t = undefined;
    this.state = 'closed';
    this.onOpen = [];
    this.onClosed = [];
  }
}
