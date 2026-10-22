import { describe, it, expect } from 'vitest';
import {
  character, desk, bot, exclamation, extent, LED, officeShell, CHAIRS, windowNight, clock, door, whiteboard, bookcase, poster, plant, cooler, bin,
  banner, calendar, sofa, table, vending, fridge, lamp, beanbag, cat, counter, station, meeting, planterRow,
  type FlatSprite, type Pose, type Outfit, type DeskState,
} from '../web/src/flat.js';

const POSES: Pose[] = ['sit0', 'sit1', 'up', 'idle', 'walk0', 'walk1'];
const OUTFITS: Outfit[] = ['tee', 'hoodie', 'shirt'];
const STATES: DeskState[] = ['empty', 'working', 'waiting', 'idle'];

function checkSprite(s: FlatSprite): void {
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

describe('flat', () => {
  it('角色：所有姿勢 × 髮型 × 衣服 × 眼鏡都能組出 40×56', () => {
    for (const pose of POSES) for (let style = 0; style <= 5; style++)
      for (const outfit of OUTFITS) for (const glasses of [false, true]) {
        const s = character({ pose, style, outfit, glasses });
        expect(s.w).toBe(40);
        expect(s.h).toBe(56);
        expect(s.shapes.length).toBeGreaterThan(0);
      }
  });

  it('所有圖形的數字有限、顏色是 #rrggbb、透明度在 0–1', () => {
    checkSprite(character({}));
    for (const st of STATES) checkSprite(desk(st));
    checkSprite(bot(false));
    checkSprite(bot(true));
    checkSprite(exclamation());
  });

  it('素材名義尺寸固定', () => {
    expect([desk('empty').w, desk('empty').h]).toEqual([72, 36]);
    expect([bot(false).w, bot(false).h]).toEqual([24, 24]);
    expect([exclamation().w, exclamation().h]).toEqual([20, 28]);
  });

  it('extent：桌子的螢幕與光暈超出名義外框', () => {
    expect(extent(desk('waiting')).y0).toBeLessThan(0);
  });

  it('桌子四種狀態的燈色不同', () => {
    expect(new Set(Object.values(LED)).size).toBe(4);
  });

  it('等你回覆的桌子比工作中多紅色光暈', () => {
    expect(desk('waiting').shapes.length).toBeGreaterThanOrEqual(desk('working').shapes.length);
  });
});

describe('office shell', () => {
  const inside = (sp: FlatSprite): void => {
    const e = extent(sp);
    expect(e.x0).toBeGreaterThanOrEqual(0);
    expect(e.y0).toBeGreaterThanOrEqual(-1); // 出口燈頂端可能略出牆
    expect(e.x1).toBeLessThanOrEqual(sp.w);
    expect(e.y1).toBeLessThanOrEqual(sp.h);
  };

  it('每種寬度都畫出合法圖形，且不超出辦公室範圍', () => {
    for (const [w, h] of [[320, 300], [396, 346], [700, 500], [1116, 532], [1500, 900]] as const) {
      const sh = officeShell(w, h, [{ x: 40, y: 200, w: 124, h: 140 }]);
      checkSprite(sh);
      inside(sh);
      expect(sh.w).toBe(w);
      expect(sh.h).toBe(h);
    }
  });

  it('家具依寬度增減：窄的辦公室只留優先的組，寬的全留', () => {
    const narrow = officeShell(396, 346), wide = officeShell(1116, 532);
    expect(wide.shapes.length).toBeGreaterThan(narrow.shapes.length);
    // 沙發區優先：窄辦公室也要有沙發的紫色
    expect(narrow.shapes.some((sh) => sh.c === '#7b5fb5')).toBe(true);
    // 影印區（書櫃棕色）最後留：396 寬放不下
    expect(narrow.shapes.some((sh) => sh.c === '#6a4a38')).toBe(false);
    expect(wide.shapes.some((sh) => sh.c === '#6a4a38')).toBe(true);
  });

  it('空地：夠大擺閱讀角、較小擺花槽、太小不擺', () => {
    const base = officeShell(800, 500).shapes.length;
    expect(officeShell(800, 500, [{ x: 40, y: 200, w: 124, h: 140 }]).shapes.length).toBeGreaterThan(officeShell(800, 500, [{ x: 40, y: 200, w: 124, h: 60 }]).shapes.length);
    expect(officeShell(800, 500, [{ x: 40, y: 200, w: 124, h: 60 }]).shapes.length).toBeGreaterThan(base);
    expect(officeShell(800, 500, [{ x: 40, y: 200, w: 124, h: 20 }]).shapes.length).toBe(base);
  });

  it('背景物件格式合法、尺寸固定', () => {
    for (const sp of [windowNight(), clock(), door(), whiteboard(), bookcase(), poster(0), poster(1), poster(2), plant(), cooler(), bin(), banner(), calendar(),
      sofa(), table(), vending(), fridge(), lamp(), beanbag(), cat(), counter(), station(), meeting(), planterRow(90)]) checkSprite(sp);
    expect([meeting().w, meeting().h]).toEqual([116, 80]);
    expect(CHAIRS.length).toBe(4);
    for (const c of CHAIRS) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(116);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(80);
    }
  });
});
