// 把 flat.ts 的圖形清單用 Canvas 2D（clay.ts）烘成圖片網址，給 <img> 用。相同 key＋倍率共用快取。
import { drawClay, softShadow } from './clay.js';
import { character, extent, HAIR_COLORS, type FlatSprite, type Outfit, type Pose } from './flat.js';
import { PALETTE, type Look } from './view.js';

/** CSS px；(x0, y0) = 素材原點在圖片裡的位置（相對圖片左上） */
export interface SpriteImg { url: string; x0: number; y0: number; w: number; h: number }

export const OUTFITS: Outfit[] = ['tee', 'hoodie', 'shirt'];
const cache = new Map<string, SpriteImg>();

/** 以 scale × ceil(devicePixelRatio) 的解析度烘圖，顯示大小 = 素材大小 × scale */
export function spriteImg(key: string, make: () => FlatSprite, scale: number): SpriteImg {
  const id = `${key}@${scale}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const sp = make();
  const e = extent(sp);
  const x0 = Math.floor(e.x0), y0 = Math.floor(e.y0), x1 = Math.ceil(e.x1), y1 = Math.ceil(e.y1);
  const k = scale * Math.max(1, Math.ceil(window.devicePixelRatio || 1));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil((x1 - x0) * k));
  cv.height = Math.max(1, Math.ceil((y1 - y0) * k));
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.scale(k, k);
    ctx.translate(-x0, -y0);
    if (sp.shadow) softShadow(ctx, sp.shadow.fx, sp.shadow.fy, sp.shadow.r);
    drawClay(ctx, sp.shapes, sp.clay ?? 'box');
  }
  const img: SpriteImg = { url: cv.toDataURL(), x0: -x0 * scale, y0: -y0 * scale, w: (x1 - x0) * scale, h: (y1 - y0) * scale };
  cache.set(id, img);
  return img;
}

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/** 人物（椅背畫在素材裡），1.5 倍顯示 */
export const charImg = (pose: Pose, look: Look): SpriteImg =>
  spriteImg(`char-${pose}-${look.hair}-${look.style}-${look.outfit}-${look.glasses ? 1 : 0}-${look.shirt}`, () => character({
    pose,
    style: look.style,
    outfit: OUTFITS[look.outfit],
    glasses: look.glasses,
    hair: HAIR_COLORS[look.hair],
    shirt: hex(PALETTE[look.shirt] ?? PALETTE[0]!),
    chair: true,
  }), 1.5);

/** 把 <img> 放成素材原點在 (x, y)（父元素座標） */
export function placeImg(img: HTMLImageElement, s: SpriteImg, x = 0, y = 0): void {
  if (img.getAttribute('src') !== s.url) img.src = s.url;
  img.style.left = `${x - s.x0}px`;
  img.style.top = `${y - s.y0}px`;
  img.style.width = `${s.w}px`;
  img.style.height = `${s.h}px`;
}
