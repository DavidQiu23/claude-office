import Phaser from 'phaser';
import { PIXEL_RATIO } from './art.js';
import { OfficeScene } from './OfficeScene.js';
import { connect, OfficeStore } from './sync.js';
import { BASE_H, BASE_W, summary } from './view.js';

const store = new OfficeStore();
const el = document.getElementById('summary')!;
const render = () => {
  const s = summary([...store.employees.values()]);
  el.textContent = s.text;
  el.classList.toggle('alert', s.alert);
  el.classList.toggle('turn', s.turn);
  document.title = s.title;
};
store.on(render);
render();

// 內部渲染倍率固定 3（整數，文字與向量圖形才清楚）；實際顯示大小再依視窗用 zoom 調整（畫布大小固定，島多島少由場景鏡頭處理）
const Z = PIXEL_RATIO;
const MAX_ZOOM = 2.5;
// 整張畫布縮放到放進視窗，但不會被放得太大；縮到 0.4 倍以下才改成捲動
const fitZoom = () => Math.max(0.4, Math.min(MAX_ZOOM, (window.innerWidth - 24) / BASE_W, (window.innerHeight - 110) / BASE_H));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_W * Z,
  height: BASE_H * Z,
  backgroundColor: '#1a1726',
  pixelArt: false,
  antialias: true,
  // 畫布以整數倍率渲染，再用 zoom 微調成實際顯示大小（滑鼠座標由 Phaser 依 zoom 換算）
  scale: { mode: Phaser.Scale.NONE, zoom: fitZoom() / Z },
  scene: new OfficeScene(store),
  callbacks: { preBoot: (g) => g.registry.set('zoom', Z) },
});

// 視窗大小變動時重新計算顯示倍率
const fit = () => {
  game.scale.setZoom(fitZoom() / Z);
  el.style.maxWidth = `${Math.max(Math.round(BASE_W * fitZoom()), 360)}px`;
};
fit();
window.addEventListener('resize', fit);

connect(store);
