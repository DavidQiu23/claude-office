import Phaser from 'phaser';
import { OfficeScene } from './OfficeScene.js';
import { connect, OfficeStore } from './sync.js';
import { SCENE_W, sceneHeight, MIN_DESKS, summary } from './view.js';

const store = new OfficeStore();
const el = document.getElementById('summary')!;
const render = () => {
  const s = summary([...store.employees.values()]);
  el.textContent = s.text;
  el.classList.toggle('alert', s.alert);
};
store.on(render);
render();

// 內部渲染倍率（整數）：依螢幕大小決定，之後只用 CSS 微調顯示大小
const fitZoom = () => Math.max(1, Math.min(4, (window.innerWidth - 24) / SCENE_W, (window.innerHeight - 110) / sceneHeight(MIN_DESKS)));
const Z = Math.ceil(fitZoom());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCENE_W * Z,
  height: sceneHeight(MIN_DESKS) * Z,
  backgroundColor: '#46506b',
  pixelArt: true,
  scale: { mode: Phaser.Scale.WIDTH_CONTROLS_HEIGHT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: new OfficeScene(store),
  callbacks: { preBoot: (g) => g.registry.set('zoom', Z) },
});

// 依視窗大小放大整個畫面（以最少 8 桌的高度為準；員工變多往下捲動）
const fit = () => {
  const z = fitZoom();
  const w = Math.round(SCENE_W * z);
  document.getElementById('game')!.style.width = `${w}px`;
  el.style.maxWidth = `${w}px`;
  game.scale.refresh();
};
fit();
window.addEventListener('resize', fit);

connect(store);
