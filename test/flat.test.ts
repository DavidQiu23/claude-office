import { describe, it, expect } from 'vitest';
import { character, deskFront, extent, LED, type FlatSprite, type Pose, type Outfit, type DeskState } from '../web/src/flat.js';
import { checkSprite } from './sprite-check.js';

const POSES: Pose[] = ['sit0', 'sit1', 'up', 'idle', 'walk0', 'walk1'];
const OUTFITS: Outfit[] = ['tee', 'hoodie', 'shirt'];
const STATES: DeskState[] = ['empty', 'working', 'waiting', 'idle'];

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

  it('deskFront：四種狀態都畫得出來，燈色是 LED[state]', () => {
    for (const s of STATES) {
      const d = deskFront(s);
      checkSprite(d);
      expect(d.shapes.some((sh) => sh.c === LED[s])).toBe(true);
    }
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

describe('extent', () => {
  it('正面接地投影：中心 (fx, fy)、rx = r、ry = r / 3', () => {
    const base: FlatSprite = { w: 10, h: 10, shapes: [{ t: 'r', x: 0, y: 0, w: 10, h: 10, c: '#808080' }] };
    expect(extent(base)).toEqual({ x0: 0, y0: 0, x1: 10, y1: 10 });
    const x = extent({ ...base, shadow: { fx: 5, fy: 10, r: 30 } });
    expect(x.x0).toBeCloseTo(-25);
    expect(x.x1).toBeCloseTo(35);
    expect(x.y0).toBeCloseTo(0);
    expect(x.y1).toBeCloseTo(20);
  });
});
