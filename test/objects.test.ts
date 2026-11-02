import { expect, test } from 'vitest';
import { OBJECTS, PANO, defsSvg, type ObjectId } from '../web/src/objects.js';

const IDS = Object.keys(OBJECTS) as ObjectId[];
const DESKS: ObjectId[] = ['desk-empty', 'desk-working', 'desk-waiting', 'desk-idle'];
const FURNITURE: ObjectId[] = ['waterCooler', 'vending', 'plant', 'bookshelf', 'copier', 'sofa', 'floorLamp', 'sideTable'];

/** 取出某個 symbol 的完整標記（<symbol id="id" …>…</symbol>） */
const symbolOf = (svg: string, id: string): string => {
  const m = svg.match(new RegExp(`<symbol id="${id}"[^>]*>[\\s\\S]*?</symbol>`));
  expect(m, id).not.toBeNull();
  return m![0];
};

test('物件表涵蓋四種桌子、窗與八種家具', () => {
  expect(IDS.sort()).toEqual([...DESKS, 'window', ...FURNITURE].sort());
});

test('每個物件都有正的寬高', () => {
  for (const [id, o] of Object.entries(OBJECTS)) {
    expect(o.w, id).toBeGreaterThan(0);
    expect(o.h, id).toBeGreaterThan(0);
  }
});

test('defsSvg 有網點、窗景全景與每個物件的 symbol，id 不重複', () => {
  const s = defsSvg();
  expect(s).toContain('<pattern id="tone"');
  for (const id of IDS) expect(s, id).toContain(`<symbol id="${id}"`);
  const ids = [...s.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(IDS.length + 2); // + tone、panorama
});

test('symbol 的 viewBox 依原點在底邊中點', () => {
  const s = defsSvg();
  for (const id of IDS) {
    const { w, h } = OBJECTS[id];
    const m = s.match(new RegExp(`<symbol id="${id}" viewBox="([^"]*)"`));
    expect(m, id).not.toBeNull();
    expect(m![1], id).toBe(`${-w / 2} ${-h} ${w} ${h}`);
  }
});

test('四種桌子都存在且彼此不同', () => {
  const s = defsSvg();
  const bodies = DESKS.map((d) => symbolOf(s, d).replace(/^<symbol[^>]*>/, ''));
  expect(new Set(bodies).size).toBe(4);
  // 螢幕色依狀態
  expect(symbolOf(s, 'desk-empty')).toContain('var(--screen-off)');
  expect(symbolOf(s, 'desk-working')).toContain('var(--screen-working)');
  expect(symbolOf(s, 'desk-waiting')).toContain('var(--screen-waiting)');
  expect(symbolOf(s, 'desk-idle')).toContain('var(--screen-turn)');
});

test('顏色不寫在屬性上', () => {
  expect(defsSvg()).not.toMatch(/\s(fill|stroke)="(?!none")/);
});

test('日夜群組用變數控制', () => {
  const s = defsSvg();
  const pano = symbolOf(s, 'panorama');
  expect(pano).toContain('opacity:var(--day)');
  expect(pano).toContain('opacity:var(--night)');
  expect(symbolOf(s, 'desk-empty')).not.toContain('var(--night)');
  for (const d of ['desk-working', 'desk-waiting', 'desk-idle']) expect(symbolOf(s, d), d).toContain('opacity:var(--night)');
  for (const f of ['vending', 'floorLamp']) {
    expect(symbolOf(s, f), f).toContain('opacity:var(--night)');
    expect(symbolOf(s, f), f).toContain('var(--lamp-glow)');
  }
});

test('窗景是一張共用的全景：整片天空、街道與城市', () => {
  const s = defsSvg();
  const pano = symbolOf(s, 'panorama');
  expect(pano).toContain(`viewBox="0 0 ${PANO.w} ${PANO.h}"`);
  expect(pano).toContain('var(--window-sky)');
  expect(pano).toContain('var(--city-lit)');
});

test('同一份 defs 每次相同', () => {
  expect(defsSvg()).toBe(defsSvg());
});
