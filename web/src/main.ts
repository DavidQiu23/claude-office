import './styles/theme.css';
import './styles/building.css';
import './styles/figure.css';
import './styles/ui.css';
import { Building } from './building.js';
import { defsSvg } from './objects.js';
import { ElevatorPanel } from './elevator.js';
import { connect, OfficeStore } from './sync.js';
import { startTheme } from './theme.js';
import { reduceMotion } from './motion.js';
import { esc } from './svg.js';
import { formatTime, nameplate, roomKey, summary, waitingList, waitSlots } from './view.js';
import type { Employee } from '../../src/state/types.js';

const store = new OfficeStore();
const el = document.getElementById('summary')!;
el.innerHTML = '<div class="legend"></div><div class="waits" aria-live="polite"></div>';
const legendBox = el.querySelector('.legend')!, waitsBox = el.querySelector('.waits')!;
let offlineAt: number | null = null; // 斷線的時間；連著時是 null
const written = new Map<Element, string>();
// 內容沒變就不重寫：重寫會丟掉鍵盤焦點、讓螢幕閱讀器重念一次，按到一半的按鈕也會消失。變了就把焦點還給同一個人的按鈕
const put = (box: Element, html: string) => {
  if (written.get(box) === html) return;
  written.set(box, html);
  const a = document.activeElement;
  const go = a instanceof HTMLElement && box.contains(a) ? a.dataset.go : undefined;
  box.innerHTML = html;
  if (go) box.querySelector<HTMLElement>(`[data-go="${CSS.escape(go)}"]`)?.focus();
};
const floorEl = (e: Employee) => document.querySelector<HTMLElement>(`.floor[data-key="${CSS.escape(roomKey(e))}"]`);
const waitsHtml = (list: Employee[]) => {
  const waits = waitingList(list);
  if (!waits.length) return '';
  const shown = waits.slice(0, waitSlots(el.clientWidth - 70));
  const cell = (e: Employee) => `<button type="button" data-go="${esc(e.sessionId)}"><b>${esc([floorEl(e)?.querySelector('.sign')?.textContent ?? e.folder, nameplate(e)].filter(Boolean).join('｜'))}</b><span>${esc(e.activity ?? '等你處理')}</span></button>`;
  const more = waits.length - shown.length;
  return `${shown.map(cell).join('')}${more ? `<button type="button" class="more" data-go="${esc(waits[shown.length]!.sessionId)}" aria-label="還有 ${more} 位等你處理">+${more}</button>` : ''}`;
};
// 點一格：捲到那層置中；那個人在畫面外（樓層比視窗寬）才左右捲
el.addEventListener('click', (ev) => {
  const id = ev.target instanceof Element ? ev.target.closest<HTMLElement>('[data-go]')?.dataset.go : undefined;
  const e = id ? store.employees.get(id) : undefined;
  const f = e && floorEl(e), root = document.documentElement;
  if (!e || !f) return;
  const r = f.getBoundingClientRect(), p = f.querySelector(`.person[data-key="${CSS.escape(e.sessionId)}"]`)?.getBoundingClientRect();
  const left = p && (p.right > root.clientWidth || p.left < 56) ? p.left + p.width / 2 - root.clientWidth / 2 : 0;
  window.scrollBy({ top: r.top + r.height / 2 - root.clientHeight / 2, left, behavior: reduceMotion() ? 'auto' : 'smooth' });
});
const render = () => {
  const s = summary([...store.employees.values()]);
  // 圖例只有固定字串與數字。等你處理的標題和內容來自 session，要跳脫
  put(legendBox, s.items.map((i) => `<span class="${i.key}${i.n ? '' : ' zero'}"><i aria-hidden="true">${i.sym}</i>${i.label}<b>${i.n}</b></span>`).join('') + `<span class="total">共 ${s.total} 位</span>`);
  // 斷線時畫面上的狀態都是舊的：紅條換成斷線說明，不再喊有人在等
  put(waitsBox, offlineAt === null ? waitsHtml([...store.employees.values()]) : `<div class="offline">連線中斷，畫面停在 ${formatTime(offlineAt)}，重新連上會自動更新</div>`);
  el.classList.toggle('alert', s.alert && offlineAt === null);
  el.classList.toggle('offline', offlineAt !== null);
  document.title = (offlineAt === null ? '' : '(斷線) ') + s.title;
};
// 先標好日夜再建立大樓，第一次繪製就是正確的配色
startTheme((t) => {
  document.documentElement.dataset.time = t;
});

// 桌子、窗、家具共用的 SVG symbol，要在建立大樓之前就位
document.body.insertAdjacentHTML('afterbegin', defsSvg());
new Building(document.getElementById('building')!, store, new ElevatorPanel(document.getElementById('elevator')!));

// 排在大樓後面：狀態列要讀更新後的樓層招牌
store.on(render);
render();
addEventListener('resize', render);

connect(store, (online) => {
  offlineAt = online ? null : offlineAt ?? Date.now();
  document.getElementById('building')!.toggleAttribute('data-offline', !online); // theme.css 依此讓大家停住
  render();
});
