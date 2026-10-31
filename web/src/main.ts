import './styles/theme.css';
import './styles/building.css';
import './styles/figure.css';
import './styles/ui.css';
import { Building } from './building.js';
import { defsSvg } from './objects.js';
import { ElevatorPanel } from './elevator.js';
import { connect, OfficeStore } from './sync.js';
import { startTheme } from './theme.js';
import { summary } from './view.js';

const store = new OfficeStore();
const el = document.getElementById('summary')!;
const render = () => {
  const s = summary([...store.employees.values()]);
  // 內容只有固定字串與數字，可以直接組 HTML；比例條是圖例的重複資訊，對螢幕閱讀器隱藏
  el.innerHTML =
    `<div class="legend">${s.items.map((i) => `<span class="${i.key}${i.n ? '' : ' zero'}"><i aria-hidden="true">${i.sym}</i>${i.label}<b>${i.n}</b></span>`).join('')}` +
    `<span class="total">共 ${s.total} 位</span></div>` +
    `<div class="bar" aria-hidden="true">${s.items.filter((i) => i.n).map((i) => `<span class="${i.key}" style="flex:${i.n}"></span>`).join('')}</div>`;
  el.classList.toggle('alert', s.alert);
  el.classList.toggle('turn', s.turn);
  document.title = s.title;
};
store.on(render);
render();

// 先標好日夜再建立大樓，第一次繪製就是正確的配色
startTheme((t) => {
  document.documentElement.dataset.time = t;
});

// 桌子、窗、家具共用的 SVG symbol，要在建立大樓之前就位
document.body.insertAdjacentHTML('afterbegin', defsSvg());
new Building(document.getElementById('building')!, store, new ElevatorPanel(document.getElementById('elevator')!));

connect(store);
