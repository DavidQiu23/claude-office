import type { Employee } from '../../src/state/types.js';
import { truncate } from '../../src/state/describe.js';

export const DESK_W = 96;
export const DESK_H = 96;
const ORIGIN = { x: 64, y: 128 };
const PER_ROW = 4;

// 簡單讀法：每排 4 桌，「每 2 排一組」僅是視覺分組，不額外加間距
export const seatPosition = (seat: number): { x: number; y: number } => ({
  x: ORIGIN.x + (seat % PER_ROW) * DESK_W,
  y: ORIGIN.y + Math.floor(seat / PER_ROW) * DESK_H,
});

export const PALETTE = [0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x1abc9c, 0x3498db, 0x9b59b6, 0xe84393];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

// hair/shirt 為 PALETTE 索引
export const appearance = (sessionId: string): { hair: number; shirt: number } => {
  const h = hash(sessionId);
  return { hair: h % PALETTE.length, shirt: Math.floor(h / PALETTE.length) % PALETTE.length };
};

export const nameplate = (e: Employee): [string, string] => [e.folder, truncate(e.lastPrompt, 30)];

export function summary(employees: Employee[]): { text: string; alert: boolean } {
  const n = (s: Employee['status']) => employees.filter((e) => e.status === s).length;
  const waiting = n('waiting');
  return { text: `工作中 ${n('working')} · 等你處理 ${waiting} · 閒置 ${n('idle')}`, alert: waiting > 0 };
}
