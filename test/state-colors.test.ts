import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { avatarSvg, figureSvg } from '../web/src/figure.js';
import { defsSvg } from '../web/src/objects.js';
import { HAIR_COLORS, HAIR_STYLES, OUTFIT_COUNT, PROJECT_COLORS, SHIRT_COLORS, type Look } from '../web/src/view.js';

// 紅色只代表「等你處理」、琥珀色只代表「輪到你」：其他地方的 hex 色不能和這兩色同色相又夠鮮豔
const THEME = readFileSync('web/src/styles/theme.css', 'utf8');
/** 只有這些主題變數可以是狀態色 */
const STATE_VARS = ['--waiting', '--turn', '--screen-waiting', '--screen-turn'];

const rgb = (hex: string): [number, number, number] => {
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1, 7);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
/** HSV 的色相（度）與彩度（0–1） */
const hsv = (hex: string) => {
  const [r, g, b] = rgb(hex), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (h * 60 + 360) % 360, sat: max === 0 ? 0 : d / max };
};
const themeVar = (name: string) => THEME.match(new RegExp(`(?<![\\w-])${name}: (#[0-9a-f]+);`, 'i'))![1]!;
const STATE_HUES = [themeVar('--waiting'), themeVar('--turn')].map((c) => hsv(c).hue);
/** 色相離 --waiting 或 --turn 20° 內、彩度 ≥ 0.55 */
const isStateLike = (hex: string) => {
  const { hue, sat } = hsv(hex);
  return sat >= 0.55 && STATE_HUES.some((s) => Math.min(Math.abs(hue - s), 360 - Math.abs(hue - s)) <= 20);
};
const hexes = (s: string) => [...new Set(s.match(/#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? [])];

const looks: Look[] = [];
for (let c = 0; c < HAIR_COLORS.length; c++)
  for (let style = 0; style < HAIR_STYLES; style++)
    for (let outfit = 0; outfit < OUTFIT_COUNT; outfit++)
      for (const glasses of [false, true]) looks.push({ hair: c, shirt: c, style, outfit, glasses });

test('判斷式抓得到紅與琥珀、放過淡色和暗色', () => {
  for (const c of ['#d63434', '#f2b83d', '#d9534f', '#c99a4a', '#d08a4a']) expect(isStateLike(c), c).toBe(true);
  for (const c of ['#fbe6d4', '#ffd98a', '#4f86b8', '#6fae7a', '#2a2a2a']) expect(isStateLike(c), c).toBe(false);
});

test('人物 SVG（所有外觀組合）沒有狀態色', () => {
  const found = new Set(looks.flatMap((l) => [...hexes(figureSvg(l)), ...hexes(avatarSvg(l))]).filter(isStateLike));
  expect([...found]).toEqual([]);
});

test('環境 SVG 沒有狀態色，也不引用狀態色變數', () => {
  const s = defsSvg();
  expect(hexes(s).filter(isStateLike)).toEqual([]);
  expect(s).not.toMatch(/var\(--(waiting|turn)\)/);
});

test('主題 CSS：只有狀態色變數是狀態色', () => {
  const bad = [...THEME.matchAll(/(--[\w-]+): (#[0-9a-f]+);/gi)].filter(([, n, c]) => !STATE_VARS.includes(n!) && isStateLike(c!)).map(([d]) => d);
  expect(bad).toEqual([]);
});

test('髮色、衣服色、專案色三張表沒有狀態色', () => {
  expect([...HAIR_COLORS, ...SHIRT_COLORS, ...PROJECT_COLORS].filter(isStateLike)).toEqual([]);
});

test('大樓外殼（building.css）只有名牌用狀態色變數', () => {
  const css = readFileSync('web/src/styles/building.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const users = [...css.matchAll(new RegExp(`([^{}]*)\\{[^}]*var\\((${STATE_VARS.join('|')})\\)[^}]*\\}`, 'g'))].map((m) => m[1]!.trim());
  for (const sel of users) expect(sel).toMatch(/^\.plate\b/);
});

test('專案色 8 個，兩兩分得出來', () => {
  expect(PROJECT_COLORS).toHaveLength(8);
  const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => (v - rgb(b)[i]!) * 255));
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) expect(dist(PROJECT_COLORS[i]!, PROJECT_COLORS[j]!), `${PROJECT_COLORS[i]} ${PROJECT_COLORS[j]}`).toBeGreaterThan(35);
});
