import { describe, it, expect } from 'vitest';
import {
  character, desk, bot, exclamation, extent, LED,
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
