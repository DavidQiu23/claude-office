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

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCENE_W,
  height: sceneHeight(MIN_DESKS),
  backgroundColor: '#46506b',
  pixelArt: true,
  scene: new OfficeScene(store),
});

connect(store);
