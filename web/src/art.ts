// 像素美術：素材資料在 sprites.ts（文字點陣 + 色表），這裡只負責烘成 Phaser 貼圖（pixelArt 模式用最近鄰縮放）。
import Phaser from 'phaser';
import * as S from './sprites.js';
import { HAIR_STYLES, type Look } from './view.js';

export const SCALE = 2; // 所有像素貼圖的放大倍率
export type Pose = S.Pose;
export type DeskState = S.DeskState;
export type Outfit = S.Outfit;

export const CHAR_W = S.CHAR_W;
export const CHAR_H = S.CHAR_H;
export const HAIR_COLORS = S.HAIR_COLORS;
export const SHIRT_COLORS = S.SHIRT_COLORS;
export const OUTFITS: Outfit[] = ['tee', 'hoodie', 'shirt'];

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

function canvasTexture(scene: Phaser.Scene, key: string, sprite: S.Sprite): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, sprite.w, sprite.h)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  S.paint(ctx, sprite);
  tex.refresh();
}

// ---- 角色（20x28）：9 個圖層疊成，貼圖依外觀快取 ----

export const charKey = (pose: Pose, look: Look, shirtCss: number): string =>
  `char-${pose}-${look.hair}-${look.style}-${look.outfit}-${look.glasses ? 1 : 0}-${shirtCss.toString(16)}`;

export function ensureChar(scene: Phaser.Scene, pose: Pose, look: Look, shirt: number): string {
  const key = charKey(pose, look, shirt);
  canvasTexture(
    scene,
    key,
    S.character({
      pose,
      style: look.style % HAIR_STYLES,
      outfit: OUTFITS[look.outfit % OUTFITS.length],
      glasses: look.glasses,
      hair: HAIR_COLORS[look.hair % HAIR_COLORS.length],
      shirt: hex(shirt),
    }),
  );
  return key;
}

export const deskKey = (st: DeskState): string => `desk-${st}`;

export const RUG_COLORS: [string, string][] = [['#3d7a8a', '#5aa0b0'], ['#8a4a5a', '#b06a7c'], ['#5a6f3d', '#82985a']];

export function bakeTextures(scene: Phaser.Scene): void {
  for (const st of ['empty', 'working', 'waiting', 'idle'] as DeskState[]) canvasTexture(scene, deskKey(st), S.desk(st));
  canvasTexture(scene, 'bot-working', S.bot(false));
  canvasTexture(scene, 'bot-done', S.bot(true));
  canvasTexture(scene, 'exclamation', S.exclamation());
  canvasTexture(scene, 'floor', S.tileFloor());
  canvasTexture(scene, 'wall', S.tileWall());
  canvasTexture(scene, 'wainscot', S.tileWainscot());
  canvasTexture(scene, 'window', S.windowNight());
  canvasTexture(scene, 'clock', S.clock());
  canvasTexture(scene, 'sconce', S.sconce());
  canvasTexture(scene, 'bookcase', S.bookcase());
  canvasTexture(scene, 'door', S.door());
  canvasTexture(scene, 'exit', S.exitSign());
  canvasTexture(scene, 'plant', S.plant());
  canvasTexture(scene, 'cooler', S.cooler());
  canvasTexture(scene, 'whiteboard', S.whiteboard());
  canvasTexture(scene, 'coffee', S.coffee());
  canvasTexture(scene, 'printer', S.printer());
  canvasTexture(scene, 'bin', S.bin());
  canvasTexture(scene, 'cat-0', S.cat(0));
  canvasTexture(scene, 'cat-1', S.cat(1));
  for (let i = 0; i < 3; i++) {
    canvasTexture(scene, `poster-${i}`, S.poster(i));
    canvasTexture(scene, `rug-${i}`, S.rug(i, RUG_COLORS[i][0], RUG_COLORS[i][1]));
  }
}
