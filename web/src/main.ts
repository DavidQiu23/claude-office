import './styles/theme.css';
import './styles/building.css';
import './styles/figure.css';
import './styles/ui.css';
import { Building } from './building.js';
import { defsSvg } from './objects.js';
import { ElevatorPanel } from './elevator.js';
import { connect, OfficeStore } from './sync.js';
import { startTheme } from './theme.js';
import { formatTime, tabTitle } from './view.js';

const store = new OfficeStore();
const offlineNote = document.getElementById('offline')!;
let offlineAt: number | null = null; // 斷線的時間；連著時是 null

const render = () => {
  // 斷線時畫面上的狀態都是舊的：上緣出現說明，分頁標題也標出來
  offlineNote.hidden = offlineAt === null;
  if (offlineAt !== null) offlineNote.textContent = `連線中斷，畫面停在 ${formatTime(offlineAt)}，重新連上會自動更新`;
  document.title = (offlineAt === null ? '' : '(斷線) ') + tabTitle([...store.employees.values()]);
};
// 先標好日夜再建立大樓，第一次繪製就是正確的配色
startTheme((t) => {
  document.documentElement.dataset.time = t;
});

// 桌子、窗、家具共用的 SVG symbol，要在建立大樓之前就位
document.body.insertAdjacentHTML('afterbegin', defsSvg());
new Building(document.getElementById('building')!, store, new ElevatorPanel(document.getElementById('elevator')!));

store.on(render);
render();

connect(store, (online) => {
  offlineAt = online ? null : offlineAt ?? Date.now();
  document.getElementById('building')!.toggleAttribute('data-offline', !online); // theme.css 依此讓大家停住
  render();
});
