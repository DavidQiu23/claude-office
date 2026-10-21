import Phaser from 'phaser';
import { OfficeScene } from './OfficeScene.js';
import { connect, OfficeStore } from './sync.js';
import { BASE_H, BASE_W, summary } from './view.js';

const store = new OfficeStore();
const el = document.getElementById('summary')!;
const render = () => {
  const s = summary([...store.employees.values()]);
  el.textContent = s.text;
  el.classList.toggle('alert', s.alert);
};
store.on(render);
render();

// 內部渲染倍率固定 3（整數，文字與像素才清楚）；實際顯示大小再依視窗與辦公室數量用 zoom 調整
const Z = 3;
const MAX_ZOOM = 2.5;
let sceneW = BASE_W;
let sceneH = BASE_H;
// 盡量讓整個辦公室放進視窗（不夠大時才捲動），單間辦公室不會被放得太大
const fitZoom = () => Math.max(1, Math.min(MAX_ZOOM, (window.innerWidth - 24) / sceneW, (window.innerHeight - 110) / sceneH));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_W * Z,
  height: BASE_H * Z,
  backgroundColor: '#1a1726',
  pixelArt: true,
  // 畫布以整數倍率渲染，再用 zoom 微調成實際顯示大小（滑鼠座標由 Phaser 依 zoom 換算）
  scale: { mode: Phaser.Scale.NONE, zoom: fitZoom() / Z },
  scene: new OfficeScene(store),
  callbacks: { preBoot: (g) => g.registry.set('zoom', Z) },
});

// 辦公室數量變動時，畫布大小跟著變，顯示倍率重新計算
const fit = () => {
  game.scale.setZoom(fitZoom() / Z);
  el.style.maxWidth = `${Math.max(Math.round(sceneW * fitZoom()), 360)}px`;
};
game.events.on('office-size', (w: number, h: number) => {
  sceneW = w;
  sceneH = h;
  fit();
});
fit();
window.addEventListener('resize', fit);

connect(store);
