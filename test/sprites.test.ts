import { expect, test } from 'vitest';
import * as S from '../web/src/sprites.js';
import { appearance, HAIR_STYLES, OUTFIT_COUNT } from '../web/src/view.js';

// compose 會檢查每個圖層列寬一致、用到的字元都在色表裡；這裡把所有組合都畫一遍，打錯字的點陣會直接丟錯。

const POSES: S.Pose[] = ['sit0', 'sit1', 'up', 'idle', 'walk0', 'walk1'];
const OUTFITS: S.Outfit[] = ['tee', 'hoodie', 'shirt'];

test('角色：所有姿勢、髮型、衣服、眼鏡都能組出 20x28', () => {
  for (const pose of POSES) {
    for (let style = 0; style < HAIR_STYLES; style++) {
      for (const outfit of OUTFITS) {
        for (const glasses of [false, true]) {
          const c = S.character({ pose, style, outfit, glasses });
          expect(c.w).toBe(S.CHAR_W);
          expect(c.h).toBe(S.CHAR_H);
          expect(c.px).toHaveLength(S.CHAR_H);
          for (const row of c.px) expect(row).toHaveLength(S.CHAR_W);
        }
      }
    }
  }
});

test('角色：不同髮色與衣服色會得到不同的像素', () => {
  const a = S.character({ hair: S.HAIR_COLORS[0], shirt: S.SHIRT_COLORS[0] });
  const b = S.character({ hair: S.HAIR_COLORS[2], shirt: S.SHIRT_COLORS[5] });
  expect(a.px).not.toEqual(b.px);
});

test('桌子：四種狀態 36x18，燈色不同', () => {
  const states: S.DeskState[] = ['empty', 'working', 'waiting', 'idle'];
  const seen = new Set<string>();
  for (const st of states) {
    const d = S.desk(st);
    expect([d.w, d.h]).toEqual([S.DESK_W, S.DESK_H]);
    expect([S.DESK_W, S.DESK_H]).toEqual([36, 18]);
    seen.add(d.px[4][17]!);
  }
  expect(seen.size).toBe(4);
});

test('機器人 10x10、驚嘆號 8x12', () => {
  for (const done of [false, true]) expect([S.bot(done).w, S.bot(done).h]).toEqual([10, 10]);
  expect([S.exclamation().w, S.exclamation().h]).toEqual([8, 12]);
});

test('場景物件尺寸固定', () => {
  const dims = (s: S.Sprite) => [s.w, s.h];
  expect(dims(S.tileFloor())).toEqual([16, 16]);
  expect(dims(S.tileWall())).toEqual([16, 16]);
  expect(dims(S.tileWainscot())).toEqual([16, 8]);
  expect(dims(S.windowNight())).toEqual([24, 18]);
  expect(dims(S.clock())).toEqual([10, 9]);
  expect(dims(S.sconce())).toEqual([20, 24]);
  for (let i = 0; i < 3; i++) expect(dims(S.poster(i))).toEqual([12, 16]);
  expect(dims(S.bookcase())).toEqual([16, 22]);
  expect(dims(S.door())).toEqual([16, 28]);
  expect(dims(S.exitSign())).toEqual([12, 6]);
  expect(dims(S.plant())).toEqual([16, 16]);
  expect(dims(S.cooler())).toEqual([12, 21]);
  for (let k = 0; k < 3; k++) expect(dims(S.rug(k, '#3d7a8a', '#5aa0b0'))).toEqual([40, 18]);
  expect(dims(S.whiteboard())).toEqual([28, 18]);
  expect(dims(S.coffee())).toEqual([12, 14]);
  expect(dims(S.printer())).toEqual([14, 12]);
  expect(dims(S.bin())).toEqual([8, 10]);
  expect(dims(S.sofa('#d9784a'))).toEqual([28, 14]);
  expect(dims(S.cat(0))).toEqual([12, 7]);
  expect(dims(S.cat(1))).toEqual([12, 7]);
});

test('貓的兩幀不同（呼吸）', () => {
  expect(S.cat(0).px).not.toEqual(S.cat(1).px);
});

test('compose：列寬不一致或色表缺字元會丟錯', () => {
  expect(() => S.compose(4, 1, [{ x: 0, y: 0, rows: ['ab', 'a'] }], { a: '#000', b: '#fff' })).toThrow('列寬');
  expect(() => S.compose(4, 1, [{ x: 0, y: 0, rows: ['az'] }], { a: '#000' })).toThrow('色表');
});

test('appearance：外觀參數都在範圍內且穩定', () => {
  for (const id of ['a', 'abc', 'sim-a', 'sim-b', '0f8e1c2a-aaaa']) {
    const l = appearance(id);
    expect(l.style).toBeGreaterThanOrEqual(0);
    expect(l.style).toBeLessThan(HAIR_STYLES);
    expect(l.outfit).toBeLessThan(OUTFIT_COUNT);
    expect(typeof l.glasses).toBe('boolean');
    expect(appearance(id)).toEqual(l);
  }
});
