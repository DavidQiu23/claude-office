import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CODE_SCROLL, DESK_CODE, DESK_STEAM, FURN_ANIM, OBJECTS, PANO, ROOM_SIDE, defsSvg, floorSeams, type ObjectId } from '../web/src/objects.js';

const IDS = Object.keys(OBJECTS) as ObjectId[];
const DESKS: ObjectId[] = ['desk-empty', 'desk-working', 'desk-waiting', 'desk-idle'];
const FURNITURE: ObjectId[] = ['waterCooler', 'vending', 'plant', 'bookshelf', 'copier', 'sofa', 'floorLamp', 'sideTable'];

/** 取出某個 symbol 的完整標記（<symbol id="id" …>…</symbol>） */
const symbolOf = (svg: string, id: string): string => {
  const m = svg.match(new RegExp(`<symbol id="${id}"[^>]*>[\\s\\S]*?</symbol>`));
  expect(m, id).not.toBeNull();
  return m![0];
};

test('物件表涵蓋四種桌子、椅子、窗與八種家具', () => {
  expect(IDS.sort()).toEqual([...DESKS, 'chair', 'window', ...FURNITURE].sort());
});

test('每個物件都有正的寬高', () => {
  for (const [id, o] of Object.entries(OBJECTS)) {
    expect(o.w, id).toBeGreaterThan(0);
    expect(o.h, id).toBeGreaterThan(0);
  }
});

test('defsSvg 有窗景全景與每個物件的 symbol，id 不重複；不再用網點', () => {
  const s = defsSvg();
  expect(s).not.toContain('id="tone"');
  for (const id of IDS) expect(s, id).toContain(`<symbol id="${id}"`);
  const ids = [...s.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(IDS.length + 2); // + panorama、pano-clouds
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
  for (const s of [defsSvg(), ROOM_SIDE, floorSeams(800)]) expect(s).not.toMatch(/\s(fill|stroke)="(?!none")/);
});

test('房間側牆（含天花板和地板的斜角）用主題變數上色，日夜才切得過去', () => {
  for (const v of ['--ceiling', '--side-wall', '--floor-wood']) expect(ROOM_SIDE).toContain(`var(${v})`);
});

test('日夜群組用變數控制', () => {
  const s = defsSvg();
  expect(symbolOf(s, 'pano-clouds')).toContain('opacity:var(--day)');
  expect(symbolOf(s, 'panorama')).toContain('opacity:var(--night)');
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

test('螢幕上捲動的程式碼：只在工作中的桌子顯示', () => {
  expect(DESK_CODE).toContain('code-scroll');
  expect(DESK_CODE).not.toMatch(/\s(fill|stroke)="(?!none")/);
  expect(defsSvg()).not.toContain('code-scroll'); // 不在 symbol 裡：CSS 動畫在 <use> 的複本裡不會動
  const building = readFileSync('web/src/styles/building.css', 'utf8');
  expect(building).toMatch(/\.desk \.desk-code \{ display: none; \}/);
  expect(building).toContain('.desk[data-st="working"] .desk-code { display: inline; }');
  const theme = readFileSync('web/src/styles/theme.css', 'utf8');
  expect(theme).toMatch(/\.code-scroll \{ animation:/);
  expect(theme).toContain(`translateY(-${CODE_SCROLL}px)`); // 一輪剛好捲完一份，接回開頭時不跳
});

test('盆栽的葉子會晃、咖啡會冒煙：會動的部件疊在 symbol 外面，動作依 --delay 錯開', () => {
  const s = defsSvg();
  for (const c of ['sway', 'steam']) expect(s, c).not.toContain(c); // CSS 動畫在 <use> 的複本裡不會動
  expect(FURN_ANIM.plant).toContain('class="sway"');
  expect(FURN_ANIM.sideTable).toContain('steam');
  expect(DESK_STEAM).toContain('steam');
  for (const o of [FURN_ANIM.plant!, FURN_ANIM.sideTable!, DESK_STEAM]) expect(o).not.toMatch(/\s(fill|stroke)="(?!none")/);
  const theme = readFileSync('web/src/styles/theme.css', 'utf8');
  for (const c of ['sway', 'steam']) expect(theme, c).toMatch(new RegExp(`\\.${c} \\{[^}]*animation:[^;]*var\\(--delay`));
  const building = readFileSync('web/src/styles/building.css', 'utf8');
  expect(building).toMatch(/\.desk \.desk-steam \{ display: none; \}/);
  expect(building).toContain('.desk[data-st="idle"] .desk-steam { display: inline; }');
});

test('窗景的雲是另一張和全景同寬的圖，整片往左飄一個全景寬後接回開頭', () => {
  const s = defsSvg();
  expect(symbolOf(s, 'pano-clouds')).toContain(`viewBox="0 0 ${PANO.w} ${PANO.h}"`);
  expect(symbolOf(s, 'panorama')).not.toContain('opacity:var(--day)'); // 雲不再畫死在全景裡
  const theme = readFileSync('web/src/styles/theme.css', 'utf8');
  expect(theme).toMatch(/\.drift \{ animation:[^;]*infinite/);
  expect(theme).toMatch(new RegExp(`@keyframes drift \\{[^}]*translateX\\(-${PANO.w}px\\)`));
});

test('屋頂上方天空的三朵雲各自慢慢飄，週期不同、不同步', () => {
  const theme = readFileSync('web/src/styles/theme.css', 'utf8');
  const secs = ['c1', 'c2', 'c3'].map((c) => theme.match(new RegExp(`\\.sky \\.cloud\\.${c} \\{[^}]*animation: \\S+ (\\d+)s`))?.[1]);
  expect(secs.every(Boolean), String(secs)).toBe(true);
  expect(new Set(secs).size).toBe(3);
});

test('減少動態：整棟大樓（天空、窗景、家具、螢幕）的環境動畫一條規則全停，不藏東西', () => {
  const theme = readFileSync('web/src/styles/theme.css', 'utf8');
  const reduce = theme.slice(theme.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(reduce).toContain('#building * { animation: none; }');
  expect(reduce).not.toMatch(/display/);
});

test('同一份 defs 每次相同', () => {
  expect(defsSvg()).toBe(defsSvg());
});
