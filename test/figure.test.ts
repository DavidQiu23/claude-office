import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AURA_BOX, FIG, FIST_BOX, FX_BOXES, HAIR_UP_BOX, ROCKS_BOX, STAND_Y, avatarSvg, figureSvg } from '../web/src/figure.js';
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

test('線稿 class（theme.css）：外輪廓 ol 比內線 mk-thin 粗', () => {
  const css = readFileSync('web/src/styles/theme.css', 'utf8');
  expect(css).toMatch(/\.mk \{ stroke: var\(--fig-ink\); stroke-width: 1\.5; \}/);
  expect(css).toMatch(/\.mk-thin \{ stroke: var\(--fig-ink\); stroke-width: 1\.1; \}/);
  const ol = Number(css.match(/\.ol \{ stroke: var\(--fig-ink\); stroke-width: ([\d.]+); \}/)?.[1]);
  expect(ol).toBeGreaterThan(1.1);
  expect(css).not.toMatch(/\.fig(-thin)?\b/);
});

test('人物不用網點：硬影是同色加深的實色', () => {
  for (const l of looks) expect(figureSvg(l)).not.toContain('class="tone"');
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
  // 拿掉的漫符
  expect(css).not.toMatch(/fx-wait|\.lines|\.burst|\.drop|fig-wave/);
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

test('漫符在自己的座位內', () => {
  for (const b of Object.values(FX_BOXES)) {
    expect(b.x0).toBeGreaterThanOrEqual(-30);
    expect(b.x1).toBeLessThanOrEqual(90);
    expect(b.x0).toBeLessThan(b.x1);
    expect(b.y0).toBeLessThan(b.y1);
  }
});

// ── 爆氣的外框：樓層位置從 CSS 讀，換成人物座標（人物框左上角 = 原點，x 30 = 座位中心） ──
const px = (file: string, sel: string, prop: string) => Number(rule(file, sel).match(new RegExp(`(?<![\\w-])${prop}: ([\\d.]+)px`))?.[1]);
const PERSON_TOP = px('web/src/styles/figure.css', '.person', 'top');
const SIGN_TOP = px('web/src/styles/building.css', '.sign', 'top') - PERSON_TOP;
const SIGN_BOTTOM = SIGN_TOP + px('web/src/styles/building.css', '.sign', 'height');
const SIGN_TEXT_BOTTOM = SIGN_BOTTOM - px('web/src/styles/building.css', '.sign', 'border'); // 框線以內都算文字範圍
const PLATE_TOP = px('web/src/styles/building.css', '.plate', 'top') - PERSON_TOP;
const DESK_TOP = 143.5 - PERSON_TOP; // 桌子底邊在樓層 y 192（floor.ts），桌面高 48.5（objects.ts）
const SEAT = { x0: 30 - 60, x1: 30 + 60 };

test('版面常數讀得到', () => {
  expect([PERSON_TOP, SIGN_TOP, SIGN_BOTTOM, SIGN_TEXT_BOTTOM, PLATE_TOP]).toEqual([74, -60, -34, -35.6, 76]);
});

test('站起來的位移和 figure.css 一致', () => {
  expect(rule('web/src/styles/figure.css', '.person[data-act="up"] .fig')).toContain(`translateY(-${STAND_Y}px)`);
});

test('氣場（含跳動）：左右在自己座位內，頂端最多碰到招牌下緣幾 px、不進入招牌文字', () => {
  expect(AURA_BOX.x0).toBeGreaterThanOrEqual(SEAT.x0);
  expect(AURA_BOX.x1).toBeLessThanOrEqual(SEAT.x1);
  expect(AURA_BOX.y0).toBeGreaterThanOrEqual(SIGN_TEXT_BOTTOM);
  expect(AURA_BOX.y0).toBeGreaterThanOrEqual(SIGN_BOTTOM - 3);
  expect(AURA_BOX.y0).toBeLessThan(SIGN_BOTTOM + 10); // 真的是一團大火，不是縮在身後
});

test('小石子：在座位內、名牌上緣以上', () => {
  expect(ROCKS_BOX.x0).toBeGreaterThanOrEqual(SEAT.x0);
  expect(ROCKS_BOX.x1).toBeLessThanOrEqual(SEAT.x1);
  expect(ROCKS_BOX.y1).toBeLessThanOrEqual(PLATE_TOP);
});

test('豎起的頭髮（站著、含抖動）不進入招牌文字', () => {
  expect(HAIR_UP_BOX.y0).toBeGreaterThanOrEqual(SIGN_TEXT_BOTTOM);
});

test('氣場排在人後面；集中線、「！」框、汗滴拿掉了', () => {
  for (const l of looks) {
    const s = figureSvg(l);
    expect(s.indexOf('class="aura"')).toBeLessThan(s.indexOf('class="fig"'));
    expect(s).not.toMatch(/>！<|class="(lines|burst|drop)"/);
  }
});

test('爆氣的拳頭站起來後高於桌面', () => {
  expect(FIST_BOX.y1).toBeLessThan(DESK_TOP);
});

test('avatarSvg 對所有外觀都畫得出來', () => {
  for (const l of looks) expect(avatarSvg(l).startsWith('<svg')).toBe(true);
});

test('進出漫符不蓋住招牌，也在座位內', () => {
  for (const k of ['in', 'out'] as const) {
    expect(FX_BOXES[k].y0, k).toBeGreaterThanOrEqual(-29);
    expect(FX_BOXES[k].x0, k).toBeGreaterThanOrEqual(-30);
    expect(FX_BOXES[k].x1, k).toBeLessThanOrEqual(90);
  }
});

test('進出漫符的文字', () => {
  const s = figureSvg(looks[0]!);
  expect(s).toContain('到！');
  expect(s).toContain('辛苦了～');
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

test('退場往上淡出的整段過程，貼紙都不蓋住招牌', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  const rise = Number(css.match(/@keyframes fig-out \{[^}]*translateY\(-(\d+(?:\.\d+)?)px\)/)?.[1]);
  expect(rise).toBeGreaterThan(0);
  expect(FX_BOXES.out.y0 - rise).toBeGreaterThanOrEqual(-29);
});
