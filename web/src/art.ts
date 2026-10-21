// 像素美術：全部用程式畫在小畫布上再放大（pixelArt 模式用最近鄰縮放），不依賴外部素材。
import Phaser from 'phaser';

export const SCALE = 2; // 所有像素貼圖的放大倍率
export type Pose = 'sit0' | 'sit1' | 'up' | 'idle' | 'walk0' | 'walk1';
export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';

export const CHAR_W = 20;
export const CHAR_H = 28;

const OUTLINE = '#2b2233';
const SKIN = '#f6d3b0';
const SKIN_SHADE = '#e0ae86';
const BLUSH = '#f0a39a';

// 髮色（依 appearance.hair 索引）；髮型與眼鏡也由同一個索引決定
export const HAIR_COLORS = ['#2b2233', '#6a4630', '#e8be52', '#b85a30', '#a8aeb6', '#4a3560', '#2c4a6e', '#e07aa5'];
const GLASSES = new Set([1, 4, 6]);

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/** 調暗（amt>0）或調亮（amt<0）色碼 */
const shade = (css: string, amt: number): string => {
  const n = parseInt(css.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v * (1 - amt) : v + (255 - v) * -amt)));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
};

type Ctx = CanvasRenderingContext2D;
const rect = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}

// ---- 角色（20x28）：髮型 4 種、部分戴眼鏡、椅背、明暗 ----

function drawChar(c: Ctx, pose: Pose, hairIdx: number, hairCss: string, shirtCss: string): void {
  const sit = pose === 'sit0' || pose === 'sit1' || pose === 'idle';
  const shirtDark = shade(shirtCss, 0.25);
  const shirtLight = shade(shirtCss, -0.25);
  const hairDark = shade(hairCss, 0.3);
  const hairLight = shade(hairCss, -0.3);
  const style = hairIdx % 4;
  const step = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;

  // 椅背（只在坐姿出現）
  if (sit) {
    rect(c, '#3a4963', 2, 11, 16, 15);
    rect(c, '#4b5d7e', 3, 12, 14, 13);
    rect(c, '#5f7396', 3, 12, 14, 1);
  }

  // 腿與鞋
  rect(c, OUTLINE, 5 + step, 22, 4, 6);
  rect(c, OUTLINE, 11 - step, 22, 4, 6);
  rect(c, '#46537a', 6 + step, 22, 2, 4);
  rect(c, '#46537a', 12 - step, 22, 2, 4);
  rect(c, '#5b3a2a', 5 + step, 26, 4, 2);
  rect(c, '#5b3a2a', 11 - step, 26, 4, 2);

  // 身體
  rect(c, OUTLINE, 3, 13, 14, 10);
  rect(c, shirtCss, 4, 14, 12, 8);
  rect(c, shirtLight, 4, 14, 12, 1);
  rect(c, shirtDark, 4, 20, 12, 2);
  rect(c, SKIN_SHADE, 9, 13, 2, 1); // 領口
  rect(c, shirtLight, 8, 14, 1, 1);
  rect(c, shirtLight, 11, 14, 1, 1);
  rect(c, shirtDark, 6, 17, 2, 2); // 口袋

  // 手臂與手
  const arm = (x: number, y: number, h: number) => {
    rect(c, OUTLINE, x - 1, y - 1, 5, h + 2);
    rect(c, shirtCss, x, y, 3, h);
    rect(c, shirtDark, x + 2, y, 1, h);
  };
  const hand = (x: number, y: number) => {
    rect(c, OUTLINE, x - 1, y - 1, 5, 4);
    rect(c, SKIN, x, y, 3, 2);
  };
  if (pose === 'sit0' || pose === 'sit1') {
    const dx = pose === 'sit0' ? 0 : 1;
    arm(1, 14, 6);
    arm(16, 14, 6);
    hand(3 + dx, 20);
    hand(14 - dx, 20);
  } else if (pose === 'up') {
    arm(1, 14, 7);
    hand(1, 21);
    arm(16, 6, 8); // 舉手
    hand(16, 3);
  } else if (pose === 'idle') {
    arm(1, 14, 6);
    hand(3, 20);
    arm(16, 14, 4);
    hand(16, 17);
  } else {
    arm(1, 14, 7 + step);
    arm(16, 14, 7 - step);
    hand(1, 21 + step);
    hand(16, 21 - step);
  }

  // 頭
  rect(c, OUTLINE, 4, 1, 12, 12);
  rect(c, SKIN, 5, 2, 10, 10);
  rect(c, SKIN_SHADE, 5, 11, 10, 1);
  // 髮型
  rect(c, hairCss, 5, 2, 10, 3);
  rect(c, hairLight, 6, 2, 4, 1);
  if (style === 0) {
    rect(c, hairCss, 5, 4, 1, 3);
    rect(c, hairCss, 14, 4, 1, 3);
    rect(c, hairCss, 6, 4, 4, 1);
  } else if (style === 1) {
    rect(c, hairCss, 5, 4, 6, 2);
    rect(c, hairDark, 5, 6, 3, 1);
    rect(c, hairCss, 14, 4, 1, 5);
  } else if (style === 2) {
    rect(c, OUTLINE, 3, 3, 2, 11);
    rect(c, OUTLINE, 15, 3, 2, 11);
    rect(c, hairCss, 4, 3, 1, 10);
    rect(c, hairCss, 15, 3, 1, 10);
    rect(c, hairCss, 5, 4, 2, 6);
    rect(c, hairCss, 13, 4, 2, 6);
    rect(c, hairDark, 4, 11, 1, 2);
    rect(c, hairDark, 15, 11, 1, 2);
  } else {
    rect(c, OUTLINE, 8, 0, 4, 2);
    rect(c, hairCss, 8, 0, 4, 2); // 髮髻
    rect(c, hairCss, 5, 4, 1, 3);
    rect(c, hairCss, 14, 4, 1, 3);
    rect(c, hairCss, 8, 4, 4, 1);
  }
  rect(c, hairDark, 5, 4, 10, 1);
  rect(c, hairCss, 6, 4, 3, 1);
  // 臉
  const ey = 7;
  rect(c, '#ffffff', 7, ey, 2, 2);
  rect(c, '#ffffff', 11, ey, 2, 2);
  rect(c, OUTLINE, 8, ey, 1, 2);
  rect(c, OUTLINE, 12, ey, 1, 2);
  rect(c, BLUSH, 6, 9, 2, 1);
  rect(c, BLUSH, 12, 9, 2, 1);
  if (pose === 'idle' || pose === 'up') {
    rect(c, '#b5604a', 9, 10, 2, 1);
    rect(c, '#b5604a', 8, 9, 1, 1);
    rect(c, '#b5604a', 11, 9, 1, 1);
  } else {
    rect(c, '#c97b63', 9, 10, 2, 1);
  }
  if (GLASSES.has(hairIdx)) {
    rect(c, '#3a3a4a', 6, 6, 4, 1);
    rect(c, '#3a3a4a', 10, 6, 4, 1);
    rect(c, '#3a3a4a', 6, 9, 4, 1);
    rect(c, '#3a3a4a', 10, 9, 4, 1);
    rect(c, '#3a3a4a', 6, 6, 1, 4);
    rect(c, '#3a3a4a', 9, 6, 2, 1);
    rect(c, '#3a3a4a', 13, 6, 1, 4);
  }
}

export function charKey(pose: Pose, hairIdx: number, shirtCss: number): string {
  return `char-${pose}-${hairIdx}-${shirtCss.toString(16)}`;
}

export function ensureChar(scene: Phaser.Scene, pose: Pose, hairIdx: number, shirt: number): string {
  const key = charKey(pose, hairIdx, shirt);
  canvasTexture(scene, key, CHAR_W, CHAR_H, (c) => drawChar(c, pose, hairIdx, HAIR_COLORS[hairIdx % HAIR_COLORS.length], hex(shirt)));
  return key;
}

// ---- 桌子（36x18）：筆電背面的指示燈顯示狀態，另有桌燈、馬克杯、文件 ----

const LED: Record<DeskState, string> = { empty: '#5d6470', working: '#5cf08a', waiting: '#ff4d4d', idle: '#f2c14e' };
const TOP: Record<DeskState, string> = { empty: '#c99a63', working: '#c99a63', waiting: '#dc7f6a', idle: '#c99a63' };

export const deskKey = (st: DeskState): string => `desk-${st}`;

function drawDesk(c: Ctx, st: DeskState): void {
  const top = TOP[st];
  // 地上的影子
  rect(c, '#00000033', 2, 16, 33, 2);
  // 桌面與桌沿
  rect(c, OUTLINE, 0, 5, 36, 12);
  rect(c, top, 1, 6, 34, 6);
  rect(c, shade(top, -0.2), 1, 6, 34, 1);
  for (const gx of [5, 14, 22, 30]) rect(c, shade(top, 0.12), gx, 8, 5, 1); // 木紋
  rect(c, '#9a6b3f', 1, 12, 34, 4);
  rect(c, '#7d5430', 1, 15, 34, 1);
  rect(c, '#82583a', 14, 13, 8, 2); // 抽屜
  rect(c, '#f0d9a0', 17, 13, 2, 1);
  // 筆電（背面朝向我們）
  rect(c, OUTLINE, 10, 0, 16, 10);
  rect(c, '#cdd4de', 11, 1, 14, 8);
  rect(c, '#e6ebf2', 11, 1, 14, 1);
  rect(c, '#aab2be', 11, 8, 14, 1);
  rect(c, LED[st], 17, 4, 2, 2); // 狀態燈
  if (st !== 'empty') rect(c, shade(LED[st], -0.5), 16, 3, 4, 4); // 燈暈
  if (st !== 'empty') rect(c, LED[st], 17, 4, 2, 2);
  // 馬克杯
  rect(c, OUTLINE, 28, 4, 6, 6);
  rect(c, '#f4f1ea', 29, 5, 4, 4);
  rect(c, '#6f4e37', 29, 5, 4, 1);
  rect(c, OUTLINE, 33, 6, 2, 3);
  // 文件
  rect(c, OUTLINE, 2, 5, 7, 6);
  rect(c, '#f4f1ea', 3, 6, 5, 4);
  rect(c, '#c9c5bb', 4, 7, 3, 1);
  rect(c, '#c9c5bb', 4, 9, 2, 1);
  if (st === 'waiting') {
    // 桌燈變紅
    rect(c, OUTLINE, 5, 0, 3, 5);
    rect(c, '#ff4d4d', 5, 0, 3, 2);
    rect(c, '#ffb3a8', 1, 6, 34, 1);
  }
}

// ---- 其他裝飾 ----

function drawBot(c: Ctx, done: boolean): void {
  const body = done ? '#5fd38a' : '#9fb2c4';
  rect(c, OUTLINE, 3, 0, 2, 2);
  rect(c, done ? '#ffd24a' : '#ff7a7a', 3, 0, 2, 1); // 天線
  rect(c, OUTLINE, 1, 2, 6, 6);
  rect(c, body, 2, 3, 4, 4);
  rect(c, shade(body, -0.3), 2, 3, 4, 1);
  rect(c, '#1f2a36', 2, 4, 1, 1);
  rect(c, '#1f2a36', 5, 4, 1, 1);
  rect(c, done ? '#ffffff' : '#1f2a36', 3, 6, 2, 1);
}

function drawCup(c: Ctx): void {
  rect(c, OUTLINE, 0, 2, 6, 6);
  rect(c, '#f4f1ea', 1, 3, 4, 4);
  rect(c, '#6f4e37', 1, 3, 4, 1);
  rect(c, OUTLINE, 5, 3, 2, 3);
  rect(c, '#f4f1ea', 6, 4, 1, 1);
  rect(c, '#ffffffaa', 2, 0, 1, 2); // 蒸氣
  rect(c, '#ffffffaa', 4, 0, 1, 1);
}

function drawPlant(c: Ctx): void {
  rect(c, OUTLINE, 3, 9, 10, 7);
  rect(c, '#c4693d', 4, 10, 8, 5);
  rect(c, '#e0865a', 4, 10, 8, 1);
  rect(c, '#a4532d', 4, 14, 8, 1);
  rect(c, '#2f8f4e', 7, 3, 2, 7);
  rect(c, '#3fb765', 3, 4, 4, 3);
  rect(c, '#3fb765', 9, 2, 4, 3);
  rect(c, '#2f8f4e', 5, 6, 3, 2);
  rect(c, '#2f8f4e', 9, 6, 3, 2);
  rect(c, '#6fd58c', 3, 4, 2, 1);
  rect(c, '#6fd58c', 9, 2, 2, 1);
}

function drawCooler(c: Ctx): void {
  rect(c, OUTLINE, 2, 0, 8, 10);
  rect(c, '#bfe6ff', 3, 1, 6, 8); // 水桶
  rect(c, '#e9f7ff', 3, 1, 2, 8);
  rect(c, OUTLINE, 1, 10, 10, 11);
  rect(c, '#d6dce6', 2, 11, 8, 9);
  rect(c, '#4aa3df', 3, 13, 2, 2); // 冷水
  rect(c, '#e85d4a', 7, 13, 2, 2); // 熱水
  rect(c, '#9aa3b2', 2, 18, 8, 2);
}

function drawBookcase(c: Ctx): void {
  rect(c, OUTLINE, 0, 0, 16, 22);
  rect(c, '#7a5232', 1, 1, 14, 20);
  rect(c, '#5d3d24', 1, 10, 14, 1);
  const books = ['#d9534f', '#4a90d9', '#e6c34a', '#4fb477', '#8e6fc9', '#e98f3f'];
  for (let i = 0; i < 6; i++) {
    rect(c, books[i], 2 + i * 2, 3 + (i % 2), 2, 7 - (i % 2));
    rect(c, books[(i + 3) % 6], 2 + i * 2, 12 + (i % 3), 2, 8 - (i % 3));
  }
}

function drawDoor(c: Ctx): void {
  rect(c, OUTLINE, 0, 0, 16, 28);
  rect(c, '#8b5a3c', 1, 1, 14, 27);
  rect(c, '#a46d49', 2, 2, 5, 11);
  rect(c, '#a46d49', 9, 2, 5, 11);
  rect(c, '#a46d49', 2, 15, 5, 11);
  rect(c, '#a46d49', 9, 15, 5, 11);
  rect(c, '#c28660', 2, 2, 5, 1);
  rect(c, '#c28660', 9, 2, 5, 1);
  rect(c, '#ffd24a', 12, 14, 2, 2); // 門把
}

// 地板：木板
function drawFloor(c: Ctx): void {
  rect(c, '#c79a68', 0, 0, 16, 16);
  rect(c, '#b98c5e', 0, 0, 16, 1);
  rect(c, '#b98c5e', 0, 8, 16, 1);
  rect(c, '#d4a876', 2, 2, 6, 1);
  rect(c, '#d4a876', 9, 10, 5, 1);
  rect(c, '#b98c5e', 7, 1, 1, 7);
  rect(c, '#b98c5e', 12, 9, 1, 7);
}

// 牆面：淡藍壁紙加直條紋，下半是護牆板
function drawWall(c: Ctx): void {
  rect(c, '#8a9bc4', 0, 0, 16, 16);
  rect(c, '#7f90ba', 0, 0, 2, 16);
  rect(c, '#7f90ba', 8, 0, 2, 16);
}

function drawWindow(c: Ctx): void {
  rect(c, OUTLINE, 0, 0, 24, 18);
  rect(c, '#8fd3ff', 1, 1, 22, 16);
  rect(c, '#bfe9ff', 1, 1, 22, 4);
  rect(c, '#ffffffcc', 3, 2, 5, 1);
  rect(c, '#ffffffcc', 14, 3, 6, 1);
  rect(c, OUTLINE, 11, 1, 2, 16);
  rect(c, OUTLINE, 1, 9, 22, 1);
  rect(c, '#e98aa8', 1, 1, 4, 16); // 窗簾
  rect(c, '#e98aa8', 19, 1, 4, 16);
  rect(c, '#c96a8a', 3, 1, 1, 16);
  rect(c, '#c96a8a', 20, 1, 1, 16);
  rect(c, OUTLINE, 0, 0, 24, 1);
}

function drawClock(c: Ctx): void {
  rect(c, OUTLINE, 1, 0, 8, 10);
  rect(c, OUTLINE, 0, 1, 10, 8);
  rect(c, '#f4f1ea', 1, 1, 8, 8);
  rect(c, OUTLINE, 5, 2, 1, 3);
  rect(c, OUTLINE, 5, 5, 3, 1);
}

function drawPoster(c: Ctx, variant: number): void {
  rect(c, OUTLINE, 0, 0, 12, 16);
  rect(c, '#f4f1ea', 1, 1, 10, 14);
  const cols = [['#4a90d9', '#e6c34a', '#d9534f'], ['#4fb477', '#8e6fc9', '#e98f3f'], ['#d9669a', '#38a8a0', '#2c4a6e']][variant % 3];
  rect(c, cols[0], 2, 2, 8, 6);
  rect(c, cols[1], 3, 4, 3, 3);
  rect(c, cols[2], 6, 3, 3, 4);
  rect(c, '#9aa3b2', 2, 10, 8, 1);
  rect(c, '#9aa3b2', 2, 12, 5, 1);
}

function drawRug(c: Ctx, variant: number): void {
  const cols = [['#3d7a8a', '#5aa0b0'], ['#8a4a5a', '#b06a7c'], ['#5a6f3d', '#82985a']][variant % 3];
  rect(c, cols[0], 0, 0, 40, 18);
  rect(c, cols[1], 2, 2, 36, 14);
  rect(c, cols[0], 4, 4, 32, 10);
  for (let x = 0; x < 40; x += 4) {
    rect(c, cols[1], x, 0, 2, 1);
    rect(c, cols[1], x, 17, 2, 1);
  }
}

export function bakeTextures(scene: Phaser.Scene): void {
  for (const st of ['empty', 'working', 'waiting', 'idle'] as DeskState[]) {
    canvasTexture(scene, deskKey(st), 36, 18, (c) => drawDesk(c, st));
  }
  canvasTexture(scene, 'bot-working', 8, 8, (c) => drawBot(c, false));
  canvasTexture(scene, 'bot-done', 8, 8, (c) => drawBot(c, true));
  canvasTexture(scene, 'cup', 8, 8, drawCup);
  canvasTexture(scene, 'plant', 16, 16, drawPlant);
  canvasTexture(scene, 'cooler', 12, 21, drawCooler);
  canvasTexture(scene, 'bookcase', 16, 22, drawBookcase);
  canvasTexture(scene, 'door', 16, 28, drawDoor);
  canvasTexture(scene, 'floor', 16, 16, drawFloor);
  canvasTexture(scene, 'wall', 16, 16, drawWall);
  canvasTexture(scene, 'window', 24, 18, drawWindow);
  canvasTexture(scene, 'clock', 10, 10, drawClock);
  for (let i = 0; i < 3; i++) {
    canvasTexture(scene, `poster-${i}`, 12, 16, (c) => drawPoster(c, i));
    canvasTexture(scene, `rug-${i}`, 40, 18, (c) => drawRug(c, i));
  }
}
