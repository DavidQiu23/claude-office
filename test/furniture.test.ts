import { describe, it, expect } from 'vitest';
import { extent, type FlatSprite } from '../web/src/flat.js';
import * as F from '../web/src/furniture.js';
import { planWall, type Placed } from '../web/src/furniture.js';

const find = (ps: Placed[], id: string): Placed[] => ps.filter((q) => q.id === id);
const right = (q: Placed): number => q.fx + q.w;
const ZONE_IDS = ['bookshelf', 'waterCooler', 'whiteboard', 'sofa', 'plantPot-big'];

describe('planWall', () => {
  it('門旁 fx 0–160 不放落地家具（門墊例外）', () => {
    for (const q of planWall(1006, 420, [96], 40)) {
      if (!q.wall && q.id !== 'doorMat') expect(q.fx, q.id).toBeGreaterThanOrEqual(160);
    }
  });

  it('家具固定從左排，房間變寬不跳位', () => {
    const a = planWall(1006, 420, [96], 40), b = planWall(1600, 420, [96], 40);
    for (const id of ZONE_IDS) expect(find(b, id)[0]!.fx, id).toBe(find(a, id)[0]!.fx);
    expect(find(a, 'bookshelf')[0]!.fx).toBe(172); // 160 + 內距 12
  });

  it('寬房間補掛件：旗幟、月曆＋海報、窗，最後一件右緣 ≤ W − 20', () => {
    const ps = planWall(1600, 420, [96], 40);
    const plant = find(ps, 'plantPot-big')[0]!;
    const extra = ps.filter((q) => q.wall === 'back' && q.fx > plant.fx);
    expect(extra.slice(0, 3).map((q) => q.id)).toEqual(['banner', 'calendarPoster', 'nightWindow']);
    expect(Math.max(...extra.map(right))).toBeLessThanOrEqual(1580);
  });

  it('窄房間不補掛件，家具排完不超過 FURN_END − 60', () => {
    const ps = planWall(1006, 420, [96], 40);
    expect(find(ps, 'banner')).toHaveLength(0);
    for (const q of ps) if (!q.id.startsWith('plant')) expect(right(q), q.id).toBeLessThanOrEqual(946);
    expect(right(find(ps, 'plantPot-big')[0]!)).toBeLessThanOrEqual(1006);
  });

  it('大盆栽葉子深度 = 盆 + 0.5', () => {
    const ps = planWall(1006, 420, [96], 40);
    expect(find(ps, 'plantLeaves-big')[0]!.depth).toBe(find(ps, 'plantPot-big')[0]!.depth + 0.5);
  });

  it('左牆窗 fy 150、390、630', () => {
    expect(find(planWall(1006, 900, [96], 40), 'leftWindow').map((q) => q.fy)).toEqual([150, 390, 630]);
  });

  it('小盆栽每排島一盆', () => {
    const ps = planWall(1006, 900, [96, 400], 40);
    expect(find(ps, 'plantPot-small').map((q) => q.fy)).toEqual([130, 434]);
    expect(find(ps, 'plantLeaves-small')).toHaveLength(2);
  });
});

describe('接地投影 r = max(w, d)/2 + 4（§16.5）', () => {
  const T: [string, () => FlatSprite, number][] = [
    ['bookshelf', F.bookshelf, 26], ['copier', F.copier, 24], ['bin', F.bin, 11], ['waterCooler', F.waterCooler, 13], ['counter', F.counter, 39],
    ['fridge', F.fridge, 20], ['vending', F.vending, 22], ['sofa', F.sofa, 54], ['sideTable', F.sideTable, 19], ['floorLamp', F.floorLamp, 11],
  ];
  it.each(T)('%s', (_n, make, r) => expect(make().shadow?.r).toBe(r));
});

describe('海報配色', () => {
  it('連續兩個月曆＋海報用不同配色', () => {
    const cals = find(planWall(2200, 420, [96], 40), 'calendarPoster');
    expect(cals.length).toBeGreaterThanOrEqual(2);
    const cs = (q: Placed): string[] => q.make().shapes.map((s) => s.c);
    expect(cs(cals[0]!)).not.toEqual(cs(cals[1]!));
  });
});

describe('建構函式', () => {
  it('每個素材 extent 有限且寬高 > 0', () => {
    const all: FlatSprite[] = [
      F.door(40), F.doorMat(40), F.clock(), F.nightWindow(), F.leftWindow(), F.whiteboard(), F.banner(), F.calendarPoster(),
      F.bookshelf(), F.copier(), F.bin(), F.waterCooler(), F.counter(), F.fridge(), F.vending(), F.sofa(), F.sideTable(),
      F.floorLamp(), F.cat(), ...[false, true].flatMap((b) => [F.plantPot(b), F.plantLeaves(b)]), F.zoneMat(138, '#5a6a7a'),
    ];
    for (const s of all) {
      const x = extent(s);
      for (const v of [x.x0, x.y0, x.x1, x.y1]) expect(Number.isFinite(v)).toBe(true);
      expect(x.x1 - x.x0).toBeGreaterThan(0);
      expect(x.y1 - x.y0).toBeGreaterThan(0);
    }
  });

  it('落地家具有接地投影，貓與葉子是 figure', () => {
    expect(F.sofa().shadow).toBeDefined();
    expect(F.plantPot(false).shadow?.r).toBeCloseTo(14.4);
    expect(F.cat().clay).toBe('figure');
    expect(F.plantLeaves(true).clay).toBe('figure');
    expect(F.plantPot(true).clay ?? 'box').toBe('box');
  });
});
