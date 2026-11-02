import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { FIG, avatarSvg, figureSvg } from '../web/src/figure.js';
import { esc, tag } from '../web/src/svg.js';
import { appearance, EYE_TYPES, HAIR_STYLES, OUTFIT_COUNT, type Look } from '../web/src/view.js';

// 所有髮型 × 衣服 × 眼型 × 有無眼鏡 × 髮色/衣服色取頭尾
const looks: Look[] = [];
for (let style = 0; style < HAIR_STYLES; style++)
  for (let outfit = 0; outfit < OUTFIT_COUNT; outfit++)
    for (let eyes = 0; eyes < EYE_TYPES; eyes++)
      for (const glasses of [false, true])
        for (const c of [0, 7]) looks.push({ hair: c, shirt: 7 - c, style, outfit, eyes, glasses });

const base: Look = { hair: 1, shirt: 2, style: 0, outfit: 0, eyes: 0, glasses: false };

/** CSS 檔裡某個選擇器那條規則的內容（大括號之間） */
const rule = (file: string, sel: string): string =>
  readFileSync(file, 'utf8').match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';

test('tag 與 esc：略過 undefined、自我關閉、跳脫', () => {
  expect(esc(`a&<b>"`)).toBe('a&amp;&lt;b&gt;&quot;');
  expect(tag('rect', { x: 1, y: undefined, class: 'a"b' })).toBe('<rect x="1" class="a&quot;b"/>');
  expect(tag('g', { class: 'g' }, '<x/>')).toBe('<g class="g"><x/></g>');
});

test('所有外觀組合都畫得出來', () => {
  for (const l of looks) expect(figureSvg(l)).toContain(`viewBox="0 0 ${FIG.w} ${FIG.h}"`);
});

test('.person 與人物 SVG 的寬高等於人物框 FIG', () => {
  for (const sel of ['.person', '.person .figure']) {
    const r = rule('web/src/styles/figure.css', sel);
    expect(r, sel).toContain(`width: ${FIG.w}px`);
    expect(r, sel).toContain(`height: ${FIG.h}px`);
  }
});

test('每個部件與漫符群組都在', () => {
  const names = ['fig', 'shake', 'leg-l', 'leg-r', 'hair-back', 'arms-type', 'arm-l', 'body', 'arm-r', 'arms-fist', 'head', 'hair', 'hair-up',
    'aura', 'rocks', 'fx-work', 'fx-turn', 'fx-in', 'fx-out', 'face-work', 'face-wait', 'face-turn'];
  for (const l of looks) {
    const s = figureSvg(l);
    for (const n of names) expect(s, n).toMatch(new RegExp(`class="([^"]* )?${n}( [^"]*)?"`));
    // 姿勢群組 fig 只有一個；線稿 class 不與群組同名
    expect(s).toMatch(/<g class="fig"[ >]/);
    expect(s.match(/class="[^"]*(?<![\w-])fig(?![\w-])[^"]*"/g)).toHaveLength(1);
    // 外輪廓 ol、內線 mk-thin
    for (const c of ['ol', 'mk-thin']) expect(s, c).toMatch(new RegExp(`class="${c}"`));
  }
});

test('figure.css 的狀態規則：漫符與爆氣群組只在對應狀態顯示，減少動態不隱藏', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  const hidden = css.match(/([^{}]*)\{ display: none; \}/g)?.join('\n') ?? '';
  const shown = css.match(/([^{}]*)\{ display: inline; \}/g)?.join('\n') ?? '';
  // 預設藏起來，只在對應狀態顯示
  for (const [act, grp] of [['work', 'fx-work'], ['idle', 'fx-turn'], ['up', 'aura'], ['up', 'rocks'], ['up', 'hair-up'], ['up', 'arms-fist']]) {
    expect(hidden, grp).toMatch(new RegExp(`\\.person \\.${grp}[,{ ]`));
    expect(shown, grp).toContain(`.person[data-act="${act}"] .${grp}`);
    for (const other of ['work', 'up', 'idle'].filter((a) => a !== act)) expect(shown, grp).not.toContain(`.person[data-act="${other}"] .${grp}`);
  }
  // 爆氣時平常的頭髮和打字的手藏起來
  expect(hidden).toContain('.person[data-act="up"] .hair');
  expect(hidden).toContain('.person[data-act="up"] .arms-type');
  // 只有角色自己抖動：抖動掛在人物 SVG 裡的 .shake，不碰樓層
  expect(css).toMatch(/\.person\[data-act="up"\] \.shake \{ animation:/);
  expect(readFileSync('web/src/styles/building.css', 'utf8')).not.toMatch(/animation/);
  // 減少動態：只停動畫與過場，不動 display
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(reduce).toMatch(/animation: none/);
  expect(reduce).toMatch(/transition: none/);
  expect(reduce).not.toMatch(/display/);
});

test('名牌小標「↳N」不縮，名牌太長時縮的是文字', () => {
  expect(rule('web/src/styles/building.css', '.plate > .helpers')).toMatch(/flex: none/);
  expect(rule('web/src/styles/building.css', '.plate > span')).toMatch(/min-width: 0/);
});

test('狀態列在整頁橫向捲動時釘在左邊', () => {
  expect(rule('web/src/styles/ui.css', '#top')).toMatch(/left: 0/);
});

test('同一個外觀每次相同', () => {
  expect(figureSvg(appearance('abc'))).toBe(figureSvg(appearance('abc')));
  expect(avatarSvg(appearance('abc'))).toBe(avatarSvg(appearance('abc')));
});

test('髮型、眼型與衣服真的不同', () => {
  const all = <K extends keyof Look>(k: K, n: number) => new Set(Array.from({ length: n }, (_, v) => figureSvg({ ...base, [k]: v }))).size;
  expect(all('style', HAIR_STYLES)).toBe(HAIR_STYLES);
  expect(all('outfit', OUTFIT_COUNT)).toBe(OUTFIT_COUNT);
  expect(all('eyes', EYE_TYPES)).toBe(EYE_TYPES);
  expect(new Set(Array.from({ length: EYE_TYPES }, (_, eyes) => avatarSvg({ ...base, eyes }))).size).toBe(EYE_TYPES);
  expect(figureSvg({ ...base, glasses: true })).not.toBe(figureSvg(base));
});

test('顏色不寫在屬性上', () => {
  for (const l of looks) {
    expect(figureSvg(l)).not.toMatch(/\s(fill|stroke)="(?!none")/);
    expect(avatarSvg(l)).not.toMatch(/\s(fill|stroke)="(?!none")/);
  }
});

test('avatarSvg 對所有外觀都畫得出來', () => {
  for (const l of looks) expect(avatarSvg(l).startsWith('<svg')).toBe(true);
});

test('figure.css：data-fx 期間只顯示進出漫符，狀態漫符藏起來', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  expect(css).toMatch(/\.person \.fx-in, \.person \.fx-out \{ display: none; \}/);
  expect(css).toContain('.person[data-fx="in"] .fx-in');
  expect(css).toContain('.person[data-fx="out"] .fx-out');
  expect(css).toMatch(/\.person\[data-fx\] \.fx-work, \.person\[data-fx\] \.fx-turn, \.person\[data-fx\] \.aura, \.person\[data-fx\] \.rocks \{ display: none !important; \}/);
  // 動畫放在 .figure（不是 .fig，.fig 的 transform 給站起來用）
  expect(css).toMatch(/\.person\[data-fx="in"\] \.figure \{ animation: fig-in 600ms/);
  expect(css).toMatch(/\.person\[data-fx="out"\] \.figure \{ animation: fig-out 500ms/);
});

test('進出貼紙是白底，字用固定深色（夜晚的 --fx 是淺色，會看不見）', () => {
  const s = figureSvg(looks[0]!);
  for (const t of ['到！', '辛苦了～']) {
    const el = s.match(new RegExp(`<text[^>]*>${t}</text>`))?.[0] ?? '';
    expect(el, t).not.toBe('');
    expect(el, t).not.toContain('var(--fx)');
  }
});
