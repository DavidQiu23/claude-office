// 像素美術：全部用程式畫在小畫布上再放大（pixelArt 模式用最近鄰縮放），不依賴外部素材。
import Phaser from 'phaser';

export const SCALE = 2; // 所有像素貼圖的放大倍率
export type Pose = 'sit0' | 'sit1' | 'up' | 'idle' | 'walk0' | 'walk1';
export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';

const OUTLINE = '#2b2233';
const SKIN = '#f2c9a0';
const SKIN_SHADE = '#d9a47c';

// 髮色（依 appearance.hair 索引）；衣服顏色來自 view.ts 的 PALETTE
export const HAIR_COLORS = ['#2b2233', '#5a3a22', '#e0b44a', '#b5532b', '#9aa0a6', '#3b2a4a', '#1f3b57', '#d96b9a'];

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/** 把色碼調暗（0~1，越大越暗），用來畫陰影 */
const shade = (css: string, amt: number): string => {
  const n = parseInt(css.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amt)));
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

// ---- 角色（16x24）----

function drawChar(c: Ctx, pose: Pose, hairCss: string, shirtCss: string): void {
  const shirtDark = shade(shirtCss, 0.25);
  const hairDark = shade(hairCss, 0.3);
  const legShift = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;

  // 腿（坐姿時會被桌子擋住）
  rect(c, OUTLINE, 4 + legShift, 19, 3, 5);
  rect(c, OUTLINE, 9 - legShift, 19, 3, 5);
  rect(c, '#3d4a6b', 4 + legShift, 19, 3, 3);
  rect(c, '#3d4a6b', 9 - legShift, 19, 3, 3);
  rect(c, '#5b3a2a', 4 + legShift, 22, 3, 2);
  rect(c, '#5b3a2a', 9 - legShift, 22, 3, 2);

  // 身體
  rect(c, OUTLINE, 2, 10, 12, 10);
  rect(c, shirtCss, 3, 11, 10, 8);
  rect(c, shirtDark, 3, 17, 10, 2);
  rect(c, SKIN, 7, 10, 2, 1); // 領口

  // 手臂
  const arm = (x: number, y: number, h: number) => {
    rect(c, OUTLINE, x - 1, y, 4, h + 1);
    rect(c, shirtCss, x, y, 2, h);
  };
  const hand = (x: number, y: number) => {
    rect(c, OUTLINE, x - 1, y, 4, 3);
    rect(c, SKIN, x, y, 2, 2);
  };
  if (pose === 'sit0' || pose === 'sit1') {
    const dx = pose === 'sit0' ? 0 : 1;
    arm(1, 12, 6);
    arm(13, 12, 6);
    hand(2 + dx, 18);
    hand(12 - dx, 18);
  } else if (pose === 'up') {
    arm(1, 12, 7);
    hand(1, 19);
    arm(13, 5, 7); // 舉手
    hand(13, 3);
  } else if (pose === 'idle') {
    arm(1, 12, 6);
    hand(2, 18);
    arm(13, 12, 5);
    hand(13, 16);
  } else {
    arm(1, 12, 7 + (pose === 'walk0' ? 1 : -1));
    arm(13, 12, 7 + (pose === 'walk0' ? -1 : 1));
    hand(1, 19);
    hand(13, 19);
  }

  // 頭
  rect(c, OUTLINE, 3, 0, 10, 11);
  rect(c, SKIN, 4, 3, 8, 7);
  rect(c, SKIN_SHADE, 4, 9, 8, 1);
  rect(c, hairCss, 4, 1, 8, 3);
  rect(c, hairCss, 3, 2, 1, 6);
  rect(c, hairCss, 12, 2, 1, 6);
  rect(c, hairDark, 4, 3, 8, 1);
  rect(c, OUTLINE, 5, 6, 1, 2);
  rect(c, OUTLINE, 10, 6, 1, 2);
  rect(c, '#ffffff', 5, 6, 1, 1);
  rect(c, '#ffffff', 10, 6, 1, 1);
  if (pose === 'idle') rect(c, '#b5604a', 7, 9, 2, 1); // 微笑／喝咖啡
  else rect(c, '#c97b63', 7, 9, 2, 1);
}

export function charKey(pose: Pose, hairIdx: number, shirtCss: number): string {
  return `char-${pose}-${hairIdx}-${shirtCss.toString(16)}`;
}

export function ensureChar(scene: Phaser.Scene, pose: Pose, hairIdx: number, shirt: number): string {
  const key = charKey(pose, hairIdx, shirt);
  canvasTexture(scene, key, 16, 24, (c) => drawChar(c, pose, HAIR_COLORS[hairIdx % HAIR_COLORS.length], hex(shirt)));
  return key;
}

// ---- 桌子（36x14）：筆電背面的指示燈顯示狀態 ----

const LED: Record<DeskState, string> = { empty: '#5d6470', working: '#5cf08a', waiting: '#ff4d4d', idle: '#f2c14e' };
const TOP: Record<DeskState, string> = { empty: '#b98a5e', working: '#b98a5e', waiting: '#d0705a', idle: '#b98a5e' };

export const deskKey = (st: DeskState): string => `desk-${st}`;

function drawDesk(c: Ctx, st: DeskState): void {
  const top = TOP[st];
  rect(c, OUTLINE, 0, 0, 36, 14);
  rect(c, top, 1, 1, 34, 8); // 桌面
  rect(c, shade(top, 0.12), 1, 1, 34, 1);
  rect(c, '#8a6240', 1, 9, 34, 4); // 桌沿
  rect(c, '#6e4c30', 1, 12, 34, 1);
  // 筆電（背面朝向我們）
  rect(c, OUTLINE, 10, 0, 16, 8);
  rect(c, '#c5ccd6', 11, 1, 14, 6);
  rect(c, '#aab2be', 11, 6, 14, 1);
  rect(c, LED[st], 17, 3, 2, 2); // 狀態燈
  // 馬克杯
  rect(c, OUTLINE, 28, 2, 5, 5);
  rect(c, '#f4f1ea', 29, 3, 3, 3);
  rect(c, '#6f4e37', 29, 3, 3, 1);
  // 紙張
  rect(c, '#f4f1ea', 3, 3, 5, 4);
  rect(c, '#c9c5bb', 4, 4, 3, 1);
  if (st === 'waiting') {
    rect(c, '#ff4d4d', 2, 0, 1, 1); // 桌燈泛紅
    rect(c, '#ffb3a8', 1, 8, 34, 1);
  }
}

// ---- 其他裝飾 ----

function drawBot(c: Ctx, done: boolean): void {
  const body = done ? '#5fd38a' : '#9fb2c4';
  rect(c, OUTLINE, 3, 0, 2, 2);
  rect(c, done ? '#ffd24a' : '#ff7a7a', 3, 0, 2, 1); // 天線
  rect(c, OUTLINE, 1, 2, 6, 6);
  rect(c, body, 2, 3, 4, 4);
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
  rect(c, '#ffffff99', 2, 0, 1, 2); // 蒸氣
  rect(c, '#ffffff99', 4, 0, 1, 1);
}

function drawPlant(c: Ctx): void {
  rect(c, OUTLINE, 3, 9, 10, 7);
  rect(c, '#c4693d', 4, 10, 8, 5);
  rect(c, '#a4532d', 4, 14, 8, 1);
  rect(c, '#2f8f4e', 7, 3, 2, 7);
  rect(c, '#3fb765', 3, 4, 4, 3);
  rect(c, '#3fb765', 9, 2, 4, 3);
  rect(c, '#2f8f4e', 5, 6, 3, 2);
  rect(c, '#2f8f4e', 9, 6, 3, 2);
}

function drawDoor(c: Ctx): void {
  rect(c, OUTLINE, 0, 0, 16, 28);
  rect(c, '#8b5a3c', 1, 1, 14, 27);
  rect(c, '#a46d49', 2, 2, 5, 11);
  rect(c, '#a46d49', 9, 2, 5, 11);
  rect(c, '#a46d49', 2, 15, 5, 11);
  rect(c, '#a46d49', 9, 15, 5, 11);
  rect(c, '#ffd24a', 12, 14, 2, 2); // 門把
}

function drawFloor(c: Ctx): void {
  rect(c, '#46506b', 0, 0, 16, 16);
  rect(c, '#4c5774', 0, 0, 8, 8);
  rect(c, '#4c5774', 8, 8, 8, 8);
  rect(c, '#414b65', 0, 15, 16, 1);
  rect(c, '#414b65', 15, 0, 1, 16);
}

function drawWall(c: Ctx): void {
  rect(c, '#6b5b95', 0, 0, 16, 16);
  rect(c, '#62538b', 0, 0, 16, 1);
  rect(c, '#7a6aa6', 0, 8, 16, 1);
}

function drawWindow(c: Ctx): void {
  rect(c, OUTLINE, 0, 0, 24, 16);
  rect(c, '#8fd3ff', 1, 1, 22, 14);
  rect(c, '#bfe9ff', 1, 1, 22, 4);
  rect(c, '#ffffffcc', 3, 2, 5, 1);
  rect(c, '#ffffffcc', 14, 3, 6, 1);
  rect(c, OUTLINE, 11, 1, 2, 14);
  rect(c, OUTLINE, 1, 8, 22, 1);
}

export function bakeTextures(scene: Phaser.Scene): void {
  for (const st of ['empty', 'working', 'waiting', 'idle'] as DeskState[]) {
    canvasTexture(scene, deskKey(st), 36, 14, (c) => drawDesk(c, st));
  }
  canvasTexture(scene, 'bot-working', 8, 8, (c) => drawBot(c, false));
  canvasTexture(scene, 'bot-done', 8, 8, (c) => drawBot(c, true));
  canvasTexture(scene, 'cup', 8, 8, drawCup);
  canvasTexture(scene, 'plant', 16, 16, drawPlant);
  canvasTexture(scene, 'door', 16, 28, drawDoor);
  canvasTexture(scene, 'floor', 16, 16, drawFloor);
  canvasTexture(scene, 'wall', 16, 16, drawWall);
  canvasTexture(scene, 'window', 24, 16, drawWindow);
}
