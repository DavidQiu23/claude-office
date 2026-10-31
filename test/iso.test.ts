import { expect, test } from 'vitest';
import { toScreen } from '../web/src/iso.js';

test('toScreen 等角投影', () => {
  expect(toScreen(100, 0)).toEqual({ x: 100, y: 50 });
  expect(toScreen(0, 100)).toEqual({ x: -100, y: 50 });
  expect(toScreen(10, 10, 30)).toEqual({ x: 0, y: -20 });
});
