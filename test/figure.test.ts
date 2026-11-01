import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { BURST_BOX, FIG, FX_BOXES, avatarSvg, figureSvg } from '../web/src/figure.js';
import { esc, tag } from '../web/src/svg.js';
import { appearance, type Look } from '../web/src/view.js';

// 6 種髮型 × 3 種衣服 × 有無眼鏡 × 髮色/衣服色取頭尾
const looks: Look[] = [];
for (let style = 0; style < 6; style++)
  for (let outfit = 0; outfit < 3; outfit++)
    for (const glasses of [false, true])
      for (const c of [0, 7]) looks.push({ hair: c, shirt: 7 - c, style, outfit, glasses });

const base: Look = { hair: 1, shirt: 2, style: 0, outfit: 0, glasses: false };

test('tag 與 esc：略過 undefined、自我關閉、跳脫', () => {
  expect(esc(`a&<b>"`)).toBe('a&amp;&lt;b&gt;&quot;');
  expect(tag('rect', { x: 1, y: undefined, class: 'a"b' })).toBe('<rect x="1" class="a&quot;b"/>');
  expect(tag('g', { class: 'g' }, '<x/>')).toBe('<g class="g"><x/></g>');
});

test('所有外觀組合都畫得出來', () => {
  expect(FIG).toEqual({ w: 60, h: 84 });
  for (const l of looks) expect(figureSvg(l)).toContain('viewBox="0 0 60 84"');
});

test('每個部件與漫符群組都在', () => {
  const names = ['chair', 'fig', 'leg-l', 'leg-r', 'hair-back', 'arm-l', 'body', 'arm-r', 'head', 'fx-work', 'fx-wait', 'fx-turn', 'face-work', 'face-wait', 'face-turn'];
  for (const l of looks) {
    const s = figureSvg(l);
    for (const n of names) expect(s, n).toMatch(new RegExp(`class="[^"]*\\b${n}\\b`));
    // 姿勢群組 fig 只有一個；墨線 class 已改名 mk／mk-thin，不再與群組同名
    expect(s).toMatch(/<g class="fig"[ >]/);
    expect(s.match(/class="[^"]*(?<![\w-])fig(?![\w-])[^"]*"/g)).toHaveLength(1);
    expect(s).not.toMatch(/class="[^"]*\bfig-thin\b/);
    expect(s).toMatch(/class="mk"/);
    expect(s).toMatch(/class="mk-thin"/);
  }
});

test('墨線 class 是 mk／mk-thin（theme.css）', () => {
  const css = readFileSync('web/src/styles/theme.css', 'utf8');
  expect(css).toMatch(/\.mk \{ stroke: var\(--fig-ink\); stroke-width: 1\.5; \}/);
  expect(css).toMatch(/\.mk-thin \{ stroke: var\(--fig-ink\); stroke-width: 1\.1; \}/);
  expect(css).not.toMatch(/\.fig(-thin)?\b/);
});

test('figure.css 的狀態規則：漫符只在對應狀態顯示，減少動態不隱藏漫符', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  // 預設全藏
  expect(css).toMatch(/\.person \.fx-work, \.person \.fx-wait, \.person \.fx-turn \{ display: none; \}/);
  // 顯示條件：工作中的 fx-work、站起來的 fx-wait、坐著且有泡泡的 fx-turn
  const shown = css.match(/([^{}]*)\{ display: inline; \}/g)?.join('\n') ?? '';
  expect(shown).toContain('.person[data-act="work"] .fx-work');
  expect(shown).toContain('.person[data-act="up"] .fx-wait');
  expect(shown).toContain('.person[data-act="idle"][data-bubble="on"] .fx-turn');
  // 減少動態：只停動畫與過場，不動 display
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(reduce).toMatch(/animation: none/);
  expect(reduce).toMatch(/transition: none/);
  expect(reduce).not.toMatch(/display/);
});

test('名牌小標「↳N」不縮、文字可截短；沒有助理名牌與助理人物的樣式', () => {
  const css = readFileSync('web/src/styles/building.css', 'utf8');
  const rule = (sel: string) => css.match(new RegExp(`${sel.replace(/[.>]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
  expect(rule('.plate > .helpers')).toMatch(/flex: none/);
  expect(rule('.plate > span')).toMatch(/min-width: 0/);
  expect(css).not.toMatch(/\.plate\.(assistant|done)/);
  expect(readFileSync('web/src/styles/figure.css', 'utf8')).not.toMatch(/data-kind="assistant"/);
});

test('樓層不再各自左右捲：沒有捲動容器、暗影與邊緣提示；狀態列橫向捲動時釘在左邊、維持視窗寬', () => {
  const css = readFileSync('web/src/styles/building.css', 'utf8');
  expect(css).not.toMatch(/\.floor-scroll|\.shade|\.edge-hint/);
  const top = readFileSync('web/src/styles/ui.css', 'utf8').match(/#top \{([^}]*)\}/)?.[1] ?? '';
  expect(top).toMatch(/left: 0/);
  expect(top).toMatch(/width: var\(--view-w/);
});

test('同一個外觀每次相同', () => {
  expect(figureSvg(appearance('abc'))).toBe(figureSvg(appearance('abc')));
});

test('髮型與衣服真的不同', () => {
  expect(new Set([0, 1, 2, 3, 4, 5].map((style) => figureSvg({ ...base, style }))).size).toBe(6);
  expect(new Set([0, 1, 2].map((outfit) => figureSvg({ ...base, outfit }))).size).toBe(3);
  expect(figureSvg({ ...base, glasses: true })).not.toBe(figureSvg(base));
});

test('顏色不寫在屬性上', () => {
  for (const l of looks) {
    expect(figureSvg(l)).not.toMatch(/\s(fill|stroke)="(?!none")/);
    expect(avatarSvg(l)).not.toMatch(/\s(fill|stroke)="(?!none")/);
  }
});

test('漫符在自己的座位內', () => {
  // 等你處理的漫符是站著時顯示：集中線以站姿頭心 (30, 16) 為圓心（最遠半徑 52），汗滴在站姿頭的左側，都不低於 y 20
  expect(FX_BOXES.wait.y0).toBeLessThanOrEqual(16 - 52);
  expect(FX_BOXES.wait.y1).toBeLessThan(20);
  for (const b of Object.values(FX_BOXES)) {
    expect(b.x0).toBeGreaterThanOrEqual(-30);
    expect(b.x1).toBeLessThanOrEqual(90);
    expect(b.x0).toBeLessThan(b.x1);
    expect(b.y0).toBeLessThan(b.y1);
  }
});

test('「！」框（含脈動）不蓋住招牌，也不超出座位右緣', () => {
  // 人物頂在樓層 y 74、招牌在樓層 y 14–40 → 人物座標 y −29 以上會碰到招牌
  expect(BURST_BOX.y0).toBeGreaterThanOrEqual(-29);
  expect(BURST_BOX.x1).toBeLessThanOrEqual(90);
});

test('avatarSvg 對所有外觀都畫得出來', () => {
  for (const l of looks) expect(avatarSvg(l).startsWith('<svg')).toBe(true);
});
