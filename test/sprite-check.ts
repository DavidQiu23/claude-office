// 素材格式檢查（flat.test.ts、furniture.test.ts 共用）：數字有限、顏色 #rrggbb、透明度 0–1、多邊形至少三點
import { expect } from 'vitest';
import type { FlatSprite } from '../web/src/flat.js';

export function checkSprite(s: FlatSprite): void {
  expect(s.shapes.length).toBeGreaterThan(0);
  for (const sh of s.shapes) {
    expect(sh.c).toMatch(/^#[0-9a-f]{6}$/);
    if (sh.a !== undefined) {
      expect(sh.a).toBeGreaterThanOrEqual(0);
      expect(sh.a).toBeLessThanOrEqual(1);
    }
    if (sh.t === 'p') {
      expect(sh.pts.length % 2).toBe(0);
      expect(sh.pts.length).toBeGreaterThanOrEqual(6);
      for (const v of sh.pts) expect(Number.isFinite(v)).toBe(true);
    } else {
      const nums = sh.t === 'r' ? [sh.x, sh.y, sh.w, sh.h, sh.r ?? 0]
        : sh.t === 'c' ? [sh.x, sh.y, sh.r] : [sh.x, sh.y, sh.rx, sh.ry];
      for (const v of nums) expect(Number.isFinite(v)).toBe(true);
    }
  }
}
