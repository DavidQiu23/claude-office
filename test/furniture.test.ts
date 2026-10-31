import { describe, it, test, expect } from 'vitest';
import { GEO } from '../web/src/floors.js';
import * as F from '../web/src/furniture.js';
import { OBJECTS, type ObjectId } from '../web/src/objects.js';

const width = (it: { id: ObjectId }): number => OBJECTS[it.id].w;

describe('家具組', () => {
  test('每組家具都是 OBJECTS 裡的物件', () => {
    for (const set of F.SETS) for (const it of set.items) expect(OBJECTS[it.id], it.id).toBeDefined();
  });

  it('至少三組，每組總寬（含間隔 12）≤ 200 − 24', () => {
    expect(F.SETS.length).toBeGreaterThanOrEqual(3);
    for (const set of F.SETS) {
      const total = set.items.reduce((a, it) => a + width(it), 0) + 12 * (set.items.length - 1);
      expect(total, set.id).toBeLessThanOrEqual(GEO.furnitureW - 24);
    }
  });

  it('組名不重複', () => {
    expect(new Set(F.SETS.map((s) => s.id)).size).toBe(F.SETS.length);
  });

  it('furnitureSet：同一個 key 永遠同一組，20 個 key 至少用到兩組', () => {
    expect(F.furnitureSet('C:/work/api')).toBe(F.furnitureSet('C:/work/api'));
    expect(F.SETS).toContain(F.furnitureSet(''));
    const used = new Set(Array.from({ length: 20 }, (_, i) => F.furnitureSet(`/home/me/proj-${i}`).id));
    expect(used.size).toBeGreaterThanOrEqual(2);
  });

  it('layoutSet：一組排在家具區中間，左右各留 12、彼此間隔 12、不重疊', () => {
    for (const set of F.SETS) {
      const placed = F.layoutSet(set);
      expect(placed.map((p) => p.id)).toEqual(set.items.map((i) => i.id));
      let prev = -Infinity;
      for (const p of placed) {
        const l = p.x - OBJECTS[p.id].w / 2, r = p.x + OBJECTS[p.id].w / 2;
        expect(l, p.id).toBeGreaterThanOrEqual(12 - 1e-9);
        expect(r, p.id).toBeLessThanOrEqual(GEO.furnitureW - 12 + 1e-9);
        if (prev > -Infinity) expect(l - prev, p.id).toBeCloseTo(12, 5);
        prev = r;
      }
      const first = placed[0]!, last = placed[placed.length - 1]!;
      const l = first.x - OBJECTS[first.id].w / 2, r = last.x + OBJECTS[last.id].w / 2;
      expect(l + r).toBeCloseTo(GEO.furnitureW, 5); // 置中
    }
  });
});

describe('後牆窗', () => {
  it('從招牌區右邊開始、每 240 一扇，不壓到右端家具區', () => {
    const w = 1208;
    const xs = F.windowXs(w);
    expect(xs).toEqual([380, 620, 860]);
    expect(xs[0]! - F.WIN.half).toBeGreaterThanOrEqual(F.SIGN_X + F.SIGN_MAX_W);
    for (const c of xs) expect(c + F.WIN.half).toBeLessThanOrEqual(w - GEO.furnitureW);
  });

  it('位置只跟樓層寬有關：變寬只在後面加窗；太窄就沒有窗', () => {
    expect(F.windowXs(400)).toEqual([]);
    const a = F.windowXs(1000), b = F.windowXs(2000);
    expect(b.slice(0, a.length)).toEqual(a);
    expect(F.windowXs(F.WIN.first + F.WIN.half + GEO.furnitureW)).toEqual([F.WIN.first]);
    expect(F.windowXs(F.WIN.first + F.WIN.half + GEO.furnitureW - 1)).toEqual([]);
  });

  it('窗（含窗台）寬不超過 2 × WIN.half', () => {
    expect(OBJECTS.window.w).toBeLessThanOrEqual(2 * F.WIN.half);
  });

  it('招牌最大寬 = 電梯區右側到第一扇窗之前', () => {
    expect(F.SIGN_X).toBeGreaterThanOrEqual(GEO.elevatorW);
    expect(F.SIGN_MAX_W).toBeGreaterThanOrEqual(200);
    expect(F.SIGN_X + F.SIGN_MAX_W).toBeLessThan(F.WIN.first - F.WIN.half);
  });
});
