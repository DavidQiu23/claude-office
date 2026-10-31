import type { Pt } from './flat.js';

// 地板座標（fx, fy）與高度 z 投影到等角螢幕座標（Task 9 換成正面素材後刪掉）
export const toScreen = (fx: number, fy: number, z = 0): Pt => ({ x: fx - fy, y: (fx + fy) / 2 - z });
