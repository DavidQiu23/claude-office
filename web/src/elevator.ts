// 電梯面板：固定在視窗左側，一層一顆按鈕（最高樓在上），燈色 = 該層提示；看得到的樓層用虛線框圈起來；點按鈕捲到那層
import { div } from './dom.js';
import { visibleSpan, type Alert } from './floors.js';
import { reduceMotion } from './motion.js';

const LAMP = { waiting: { mark: '!', text: '有人等你處理' }, idle: { mark: '✓', text: '有人輪到你' } } as const;

export interface ElevatorFloor { level: number; title: string; alert: Alert; el: HTMLElement }

export class ElevatorPanel {
  private inner = div('elev-in');
  private frame = div('elev-frame');
  private btns: HTMLButtonElement[] = []; // 上到下
  private els: HTMLElement[] = []; // 與 btns 同序
  private visible = new Set<HTMLElement>();
  private io: IntersectionObserver;

  constructor(private root: HTMLElement) {
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) this.visible.add(el);
        else this.visible.delete(el);
      }
      this.drawFrame();
    });
    this.frame.hidden = true;
    const ind = div('elev-ind'); // 頂端的上下箭頭顯示窗，只是裝飾
    ind.setAttribute('aria-hidden', 'true');
    ind.innerHTML = '<svg width="16" height="10" viewBox="0 0 16 10"><path d="M4 1 L7 5 H1Z" style="fill:#9fd0ff"/><path d="M12 9 L9 5 H15Z" style="fill:#9fd0ff;opacity:.45"/></svg>';
    this.inner.append(ind, this.frame);
    root.replaceChildren(this.inner);
    root.hidden = true;
    root.addEventListener('click', (ev) => {
      const b = ev.target instanceof Element ? ev.target.closest<HTMLButtonElement>('button') : null;
      const el = b && this.els[this.btns.indexOf(b)];
      if (!el) return;
      // 只上下捲到那層置中，不動橫向捲動位置（scrollIntoView 會連橫向一起捲）
      const r = el.getBoundingClientRect();
      window.scrollBy({ top: r.top + r.height / 2 - document.documentElement.clientHeight / 2, behavior: reduceMotion() ? 'auto' : 'smooth' }); // clientHeight 不含橫向捲軸
    });
  }

  update(floors: ElevatorFloor[]): void {
    const list = [...floors].sort((a, b) => b.level - a.level);
    this.root.hidden = !list.length; // 沒有樓層（空大廳）就不顯示
    while (this.btns.length > list.length) this.btns.pop()!.remove();
    while (this.btns.length < list.length) {
      const b = document.createElement('button');
      b.type = 'button';
      this.inner.append(b);
      this.btns.push(b);
    }
    // 追蹤的樓層元素跟著增減
    const next = new Set(list.map((f) => f.el));
    for (const el of this.els) if (!next.has(el)) { this.io.unobserve(el); this.visible.delete(el); }
    for (const el of next) if (!this.els.includes(el)) this.io.observe(el);
    this.els = list.map((f) => f.el);
    list.forEach((f, i) => {
      const b = this.btns[i]!;
      const lamp = f.alert ? LAMP[f.alert] : null;
      b.textContent = `${f.level}${lamp?.mark ?? ''}`; // 記號和名牌前綴相同，燈色不是唯一的線索
      b.title = lamp ? `${f.title}（${lamp.text}）` : f.title;
      b.setAttribute('aria-label', lamp ? `${f.level}F ${f.title}，${lamp.text}` : `${f.level}F ${f.title}`);
      b.className = f.alert ?? '';
    });
    this.drawFrame();
  }

  private drawFrame(): void {
    const span = visibleSpan(this.els.map((el) => this.visible.has(el)));
    this.frame.hidden = !span;
    if (!span) return;
    const a = this.btns[span.from]!, z = this.btns[span.to]!;
    this.frame.style.top = `${a.offsetTop - 3}px`;
    this.frame.style.height = `${z.offsetTop + z.offsetHeight - a.offsetTop + 6}px`;
  }
}
