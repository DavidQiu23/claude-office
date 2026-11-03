import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { FIG, WARP_SVG, avatarSvg, figureSvg } from '../web/src/figure.js';
import { ENTER_MS, EXIT_MS } from '../web/src/person.js';
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
  for (const sel of ['.person', '.person .figure', '.person .warp']) {
    const r = rule('web/src/styles/figure.css', sel);
    expect(r, sel).toContain(`width: ${FIG.w}px`);
    expect(r, sel).toContain(`height: ${FIG.h}px`);
  }
});

test('每個部件與漫符群組都在', () => {
  const names = ['fig', 'shake', 'leg-l', 'leg-r', 'hair-back', 'arms-type', 'arm-l', 'body', 'arm-r', 'arms-fist', 'head', 'hair', 'hair-up',
    'aura', 'rocks', 'ghost', 'arms-cross', 'wink-shut', 'wink-open', 'salute', 'face-work', 'face-wait', 'face-turn'];
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
  for (const [act, grp] of [['work', 'ghost'], ['idle', 'face-turn'], ['idle', 'arms-cross'], ['up', 'aura'], ['up', 'rocks'], ['up', 'hair-up'], ['up', 'arms-fist']]) {
    expect(hidden, grp).toMatch(new RegExp(`\\.person \\.${grp}[,{ ]`));
    expect(shown, grp).toContain(`.person[data-act="${act}"] .${grp}`);
    for (const other of ['work', 'up', 'idle'].filter((a) => a !== act)) expect(shown, grp).not.toContain(`.person[data-act="${other}"] .${grp}`);
  }
  // 爆氣時平常的頭髮和打字的手藏起來
  expect(hidden).toContain('.person[data-act="up"] .hair');
  expect(hidden).toContain('.person[data-act="up"] .arms-type');
  // 冥想時打字的手換成抱胸
  expect(hidden).toContain('.person[data-act="idle"] .arms-type');
  // 只有角色自己抖動：抖動掛在人物 SVG 裡的 .shake，不碰樓層
  expect(css).toMatch(/\.person\[data-act="up"\] \.shake \{ animation:/);
  expect(readFileSync('web/src/styles/building.css', 'utf8')).not.toMatch(/animation/);
  // 減少動態：只停動畫與過場，不動 display
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(reduce).toMatch(/animation: none/);
  expect(reduce).toMatch(/transition: none/);
  expect(reduce).not.toMatch(/display/);
});

test('工作中：殘影跟著打字動，動作依 --delay 錯開；「噠噠」拿掉了', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  expect(css).toMatch(/\.person\[data-act="work"\] \.ghost[^{]*\{ animation:/);
  // 打字依 person.ts 設的 --delay 錯開
  expect(css).toMatch(/animation:[^;]*var\(--delay/);
  // 「噠噠」和打字速度線（fx-work 群組）拿掉了
  const s = figureSvg(looks[0]!);
  expect(s).not.toContain('噠噠');
  expect(s).not.toContain('fx-work');
});

test('輪到你：冥想時偶爾睜一隻眼，依 --delay 錯開；減少動態停在閉眼；zZ 和打勾泡泡拿掉了', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  for (const w of ['wink-open', 'wink-shut']) expect(css).toMatch(new RegExp(`\\.person\\[data-act="idle"\\] \\.${w} \\{ animation:[^;]*var\\(--delay`));
  // 沒有動畫時睜眼那組是透明的（減少動態把動畫拿掉，就停在閉眼）；閉眼那組平常看得到
  expect(rule('web/src/styles/figure.css', '.person .wink-open')).toMatch(/opacity: 0/);
  expect(css).not.toMatch(/\.person \.wink-shut \{[^}]*opacity/);
  const s = figureSvg(looks[0]!);
  for (const t of ['>z<', '>Z<', 'bubble', 'fx-turn']) expect(s, t).not.toContain(t);
  // 點頭拿掉了：冥想時頭不動
  expect(css).not.toMatch(/\.person\[data-act="idle"\] \.head/);
});

test('名牌小標「↳N」不縮，名牌太長時縮的是文字', () => {
  expect(rule('web/src/styles/building.css', '.plate > .helpers')).toMatch(/flex: none/);
  expect(rule('web/src/styles/building.css', '.plate > span')).toMatch(/min-width: 0/);
});

test('名牌、招牌、狀態列、電梯面板、資訊卡共用同一組粗黑框、白外圈、硬投影', () => {
  const ui = 'web/src/styles/ui.css', building = 'web/src/styles/building.css';
  for (const [file, sel] of [[building, '.plate > span'], [building, '.plate > .helpers'], [building, '.sign'], [ui, '#summary'], [ui, '#elevator'], [ui, '.card']] as const) {
    const r = rule(file, sel);
    expect(r, sel).toContain('border: var(--ui-border)');
    expect(r, sel).toContain('box-shadow: var(--ui-shadow)');
  }
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

test('figure.css：瞬移的動畫長度等於 ENTER_MS／EXIT_MS，點額只在退場時出現', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  for (const [fx, ms] of [['in', ENTER_MS], ['out', EXIT_MS]] as const) {
    // 動畫放在 .figure（不是 .fig，.fig 的 transform 給站起來用），光痕在 .figure 外面
    expect(css, fx).toMatch(new RegExp(`\\.person\\[data-fx="${fx}"\\] \\.figure \\{ animation: [\\w-]+ ${ms}ms`));
    expect(css, fx).toMatch(new RegExp(`\\.person\\[data-fx="${fx}"\\] \\.streak \\{ animation: [\\w-]+ ${ms}ms`));
    // data-fx 底下的每個動畫都一樣長，不會比計時器早或晚結束
    for (const m of css.matchAll(new RegExp(`\\.person\\[data-fx="${fx}"\\][^{]*\\{ animation: [\\w-]+ (\\d+)ms`, 'g'))) expect(Number(m[1]), m[0]).toBe(ms);
  }
  expect(css).toMatch(/\.person\[data-fx="in"\] \.after-l \{ animation:/);
  expect(rule('web/src/styles/figure.css', '.person .salute')).toMatch(/display: none/);
  expect(css).toMatch(/\.person\[data-fx="out"\] \.salute[^{]*\{ display: inline !important; \}/);
  expect(css).toMatch(/\.person\[data-fx\] \.aura, \.person\[data-fx\] \.rocks \{ display: none !important; \}/);
  // 爆氣中下班：點額時不抖（要蓋過同優先順序的 data-act="up" 抖動）
  expect(rule('web/src/styles/figure.css', '.person[data-fx="out"] .shake')).toMatch(/animation: none !important/);
});

test('瞬移的光痕和殘影在人物 SVG 外面，平常看不到（減少動態時也看不到）', () => {
  for (const n of ['streak', 'after-l', 'after-r']) expect(WARP_SVG, n).toMatch(new RegExp(`class="([^"]* )?${n}( [^"]*)?"`));
  expect(figureSvg(looks[0]!)).not.toContain('streak');
  expect(rule('web/src/styles/figure.css', '.person .warp')).toMatch(/pointer-events: none/);
  expect(rule('web/src/styles/figure.css', '.person .streak, .person .after')).toMatch(/opacity: 0/);
});

test('退場的雙指點額：手排在頭和頭髮後面（畫出來疊在前面）；「到！」、「辛苦了～」拿掉了', () => {
  for (const l of looks) {
    const s = figureSvg(l);
    const salute = s.indexOf('class="salute"');
    expect(salute).toBeGreaterThan(s.lastIndexOf('class="head"'));
    expect(salute).toBeGreaterThan(s.lastIndexOf('class="hair'));
    for (const t of ['到！', '辛苦了～', 'fx-in', 'fx-out']) expect(s, t).not.toContain(t);
  }
});
