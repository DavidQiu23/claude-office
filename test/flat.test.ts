import { describe, it, expect } from 'vitest';
import { toScreen } from '../web/src/iso.js';
import {
  character, isoDesk, isoChair, rpt, isoRoom, WALL_Z, extent, LED,
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
    expect(x.y0).toBeLessThan(toScreen(...rpt({ x: 59, y: 59 }, 0, -12, 21)).y); // 螢幕頂高過桌面後緣
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

describe('座位素材', () => {
  const D = { x: 59, y: 59 };
  it('人、螢幕、桌子垂直對齊', () => {
    const led = isoDesk('working').shapes.find((sh) => sh.t === 'c' && sh.c === LED.working && (sh.a ?? 1) === 1);
    expect(led && led.t === 'c' && led.x).toBeCloseTo(toScreen(48, 48).x, 5);
  });
  it('螢幕頂端低於下巴', () => {
    const top = toScreen(...(rpt(D, 0, 4, 37).slice(0, 2) as [number, number]), 37).y;
    expect(top).toBeGreaterThan(toScreen(48, 48).y + (30 - 54) * 1.2);
  });
  it('等你處理有紅光、桌面偏紅', () => {
    const sh = isoDesk('waiting').shapes;
    expect(sh.some((s) => s.t === 'e' && s.c === '#ff4d4d' && s.a === 0.22)).toBe(true);
    expect(sh.some((s) => s.c === '#e98d63')).toBe(true);
  });
  it('閒置有蒸氣', () => {
    const steam = (st: DeskState): boolean => isoDesk(st).shapes.some((s) => s.t === 'e' && s.c === '#ffffff' && s.a === 0.7);
    expect(steam('idle')).toBe(true);
    expect(steam('working')).toBe(false);
  });
  it('isoChair 有椅背與坐墊', () => {
    const c = isoChair();
    checkSprite(c);
    expect(c.clay).toBe('box');
    expect(c.shadow).toEqual({ fx: 44, fy: 44, r: 16 });
    expect(c.shapes.some((s) => s.c === '#56649a')).toBe(true);
    expect(c.shapes.some((s) => s.c === '#3b4770')).toBe(true);
  });
  it('isoDesk 是 box、有投影', () => {
    expect(isoDesk('idle').clay).toBe('box');
    expect(isoDesk('idle').shadow).toEqual({ fx: 62, fy: 62, r: 30 });
  });
  it('character({ chair: false }) 沒有椅背與腳底陰影', () => {
    const has = (s: FlatSprite): { back: boolean; shadow: boolean } => ({
      back: s.shapes.some((x) => x.t === 'r' && x.w === 34 && x.h === 28),
      shadow: s.shapes.some((x) => x.t === 'e' && x.y === 54),
    });
    expect(has(character({ chair: false }))).toEqual({ back: false, shadow: false });
    expect(has(character())).toEqual({ back: true, shadow: true });
    expect(character().clay).toBe('figure');
  });
});
