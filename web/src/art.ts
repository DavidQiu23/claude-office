// 扁平向量美術：素材資料在 flat.ts（圖形清單），這裡用 Phaser Graphics 烘成貼圖（PIXEL_RATIO 倍解析度，顯示時縮回 1/PIXEL_RATIO）。
import Phaser from 'phaser';
import {
  character, extent, HAIR_COLORS, isoDesk, SHIRT_COLORS,
  type DeskState, type FlatSprite, type Outfit, type Pose, type Shape,
} from './flat.js';
import type { Look } from './view.js';

export const PIXEL_RATIO = 3; // 貼圖解析度倍率（內部渲染倍率）
export type { Pose, DeskState, Outfit };
export { HAIR_COLORS, SHIRT_COLORS };
export const OUTFITS: Outfit[] = ['tee', 'hoodie', 'shirt'];

interface TexInfo { x0: number; y0: number; w: number; h: number }
const info = new Map<string, TexInfo>();

export function drawShapes(g: Phaser.GameObjects.Graphics, shapes: Shape[], k: number, dx: number, dy: number): void {
  for (const s of shapes) {
    g.fillStyle(parseInt(s.c.slice(1), 16), s.a ?? 1);
    if (s.t === 'r') {
      if (s.r) g.fillRoundedRect((s.x + dx) * k, (s.y + dy) * k, s.w * k, s.h * k, s.r * k);
      else g.fillRect((s.x + dx) * k, (s.y + dy) * k, s.w * k, s.h * k);
    } else if (s.t === 'c') {
      g.fillCircle((s.x + dx) * k, (s.y + dy) * k, s.r * k);
    } else if (s.t === 'e') {
      g.fillEllipse((s.x + dx) * k, (s.y + dy) * k, s.rx * 2 * k, s.ry * 2 * k);
    } else {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i + 1 < s.pts.length; i += 2) pts.push(new Phaser.Math.Vector2((s.pts[i]! + dx) * k, (s.pts[i + 1]! + dy) * k));
      g.fillPoints(pts, true);
    }
  }
}

function bakeSprite(scene: Phaser.Scene, key: string, sprite: FlatSprite): void {
  if (scene.textures.exists(key)) return;
  const e = extent(sprite);
  const x0 = Math.floor(e.x0), y0 = Math.floor(e.y0);
  const x1 = Math.ceil(e.x1), y1 = Math.ceil(e.y1);
  const g = scene.make.graphics({}, false);
  drawShapes(g, sprite.shapes, PIXEL_RATIO, -x0, -y0);
  g.generateTexture(key, Math.ceil((x1 - x0) * PIXEL_RATIO), Math.ceil((y1 - y0) * PIXEL_RATIO));
  g.destroy();
  info.set(key, { x0, y0, w: x1 - x0, h: y1 - y0 });
}

export const charKey = (pose: Pose, look: Look, shirt: number): string =>
  `char-${pose}-${look.hair}-${look.style}-${look.outfit}-${look.glasses ? 1 : 0}-${shirt.toString(16)}`;

export function ensureChar(scene: Phaser.Scene, pose: Pose, look: Look, shirt: number): string {
  const key = charKey(pose, look, shirt);
  bakeSprite(
    scene,
    key,
    character({
      pose,
      style: look.style,
      outfit: OUTFITS[look.outfit],
      glasses: look.glasses,
      hair: HAIR_COLORS[look.hair],
      shirt: '#' + shirt.toString(16).padStart(6, '0'),
    }),
  );
  return key;
}

export const deskKey = (st: DeskState): string => `desk-${st}`;

export function bakeTextures(scene: Phaser.Scene): void {
  for (const st of ['empty', 'working', 'waiting', 'idle'] as DeskState[]) bakeSprite(scene, deskKey(st), isoDesk(st));}

function applyOrigin(img: Phaser.GameObjects.Image, key: string): void {
  const t = info.get(key);
  if (t) img.setOrigin(-t.x0 / t.w, -t.y0 / t.h);
}

/** 建立 Image，使素材座標 (0,0) 落在 (x, y)，縮放 1 / PIXEL_RATIO。 */
export function addSprite(scene: Phaser.Scene, key: string, x: number, y: number): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, key).setScale(1 / PIXEL_RATIO);
  applyOrigin(img, key);
  return img;
}

export function setSprite(img: Phaser.GameObjects.Image, key: string): void {
  img.setTexture(key);
  applyOrigin(img, key);
}
