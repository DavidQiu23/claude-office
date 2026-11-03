import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// 夜晚：同一套顏色蓋一層 multiply 遮罩，燈、螢幕、窗外夜空、爆氣的紅光用 screen 疊在遮罩上，名牌和招牌再疊在最上面
const css = (f: string) => readFileSync(`web/src/styles/${f}.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const BUILDING = css('building'), THEME = css('theme'), FIGURE = css('figure');
/** 選擇器那條規則的內容（選擇器要完全相同） */
const rule = (src: string, sel: string): string =>
  src.match(new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
const z = (src: string, sel: string) => Number(rule(src, sel).match(/z-index: (\d+)/)?.[1]);

test('每層樓的遮罩是深藍色 multiply，只在夜晚出現', () => {
  const mask = rule(BUILDING, '.floor-in::after');
  expect(mask).toContain('mix-blend-mode: multiply');
  expect(mask).toContain('pointer-events: none');
  expect(BUILDING).toMatch(/:root\[data-time="night"\] \.floor-in::after[^{]*\{ display: block; \}/);
});

test('光暈用 screen，疊在遮罩上面；人物的紅光也是', () => {
  const glow = rule(BUILDING, '.glow');
  expect(glow).toContain('mix-blend-mode: screen');
  expect(z(BUILDING, '.glow')).toBeGreaterThan(z(BUILDING, '.floor-in::after'));
  expect(FIGURE).toMatch(/:root\[data-time="night"\] \.person\[data-act="up"\]:not\(\[data-fx\]\) \.glow \{ display: block; \}/);
});

test('名牌、招牌、大廳紙條疊在光暈上面，夜晚不被壓暗', () => {
  const top = z(BUILDING, '.glow');
  for (const sel of ['.plate', '.sign', '.lobby-msg']) expect(z(BUILDING, sel), sel).toBeGreaterThan(top);
});

test('環境顏色只有一套：夜晚只切換 --day／--night 和天空', () => {
  const night = rule(THEME, ':root[data-time="night"]');
  expect(night).not.toBe('');
  const vars = [...night.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort();
  expect(vars).toEqual(['--day', '--night', '--sky-bg']);
  for (const v of ['--fx', '--lamp-glow']) expect(THEME + BUILDING + FIGURE, v).not.toContain(`${v}:`);
});
