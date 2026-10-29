import { describe, it, expect } from 'vitest';
import {
  character, isoDesk, isoRoom, WALL_Z, exclamation, extent, LED,
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
    checkSprite(exclamation());
  });

  it('素材名義尺寸固定', () => {
    expect([exclamation().w, exclamation().h]).toEqual([20, 28]);
  });

  it('桌子四種狀態的燈色不同', () => {
    expect(new Set(Object.values(LED)).size).toBe(4);
  });
});

describe('iso art', () => {
  it('等角桌：燈色、光暈、螢幕高度', () => {
    expect(isoDesk('waiting').shapes.some((sh) => sh.c === LED.waiting)).toBe(true);
    expect(isoDesk('empty').shapes.some((sh) => sh.c === LED.empty && (sh.a ?? 1) < 1)).toBe(false);
    expect(isoDesk('working').shapes.some((sh) => sh.c === LED.working && (sh.a ?? 1) < 1)).toBe(true);
    const x = extent(isoDesk('working'));
    expect(x.y0).toBeLessThan(11); // 螢幕頂 (34,72,50)→y=3，高過桌面最高點 (12,60,25)→y=11（原稿 -40 與格內座標不符）
    expect(x.x0).toBeLessThan(0);
    expect(x.x1).toBeGreaterThan(0);
    checkSprite(isoDesk('idle'));
  });

  it('等角房間：範圍與格式', () => {
    const sp = isoRoom(1280, 720);
    checkSprite(sp);
    const x = extent(sp);
    expect(Math.abs(x.x0 + 720)).toBeLessThan(10);
    expect(Math.abs(x.x1 - 1280)).toBeLessThan(10);
    expect(Math.abs(x.y0 + WALL_Z)).toBeLessThan(10);
    expect(Math.abs(x.y1 - 1000)).toBeLessThan(10);
  });
});
