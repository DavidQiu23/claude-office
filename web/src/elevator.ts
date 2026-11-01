// 電梯面板：固定在視窗左側，一層一顆按鈕（最高樓在上），燈色 = 該層提示；看得到的樓層用半透明框圈起來；點按鈕捲到那層
import { div } from './dom.js';
import { visibleSpan, type Alert } from './floors.js';
import { reduceMotion } from './motion.js';

export interface ElevatorFloor { level: number; title: string; alert: Alert; el: HTMLElement }

export class ElevatorPanel {
  private inner = div('elev-in');
  private frame = div('elev-frame');
  private btns: HTMLButtonElement[] = []; // 上到下
  private els: HTMLElement[] = []; // 與 btns 同序
  private visible = new Set<HTMLElement>();
  private io: IntersectionObserver;
  private barH = 0; // 黏在頂端的狀態列高度：只在狀態列底下的樓層不算看得到

  constructor(private root: HTMLElement) {
    const bar = document.getElementById('top');
    this.barH = bar?.offsetHeight ?? 0;
    this.io = this.observer();
    if (bar) {
      // 狀態列高度變了（換行、字級、有沒有紅框）就用新的上緣重建觀察者
      new ResizeObserver(() => {
        const h = bar.offsetHeight;
        if (h === this.barH) return;
        this.barH = h;
        this.reobserve();
      }).observe(bar);
    }
    this.frame.hidden = true;
    this.inner.append(this.frame);
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

  /** 上緣內縮狀態列的高度，樓層要露出狀態列之下才算看得到 */
  private observer(): IntersectionObserver {
    return new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) this.visible.add(el);
        else this.visible.delete(el);
      }
      this.drawFrame();
    }, { threshold: 0, rootMargin: `-${this.barH}px 0px 0px 0px` });
  }

  private reobserve(): void {
    this.io.disconnect();
    this.visible.clear();
    this.io = this.observer();
    for (const el of this.els) this.io.observe(el); // 新觀察者第一次回報就會補上目前看得到的
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
      b.textContent = String(f.level);
      b.title = f.title;
      b.setAttribute('aria-label', `${f.level}F ${f.title}`);
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
