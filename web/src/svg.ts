// 產生 SVG 標記字串的小工具（純函式，不碰 DOM；可在 node 環境測試）

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** <name a="v" ...>children</name>；值為 undefined 的屬性略過；children 省略時自我關閉 */
export function tag(name: string, attrs: Record<string, string | number | undefined>, children?: string): string {
  let a = '';
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) a += ` ${k}="${esc(String(v))}"`;
  return children === undefined ? `<${name}${a}/>` : `<${name}${a}>${children}</${name}>`;
}

// ── 人物（figure.ts）與物件（objects.ts）共用的圖形；顏色一律放 class 或 style ──

/** rx 為 0 時不輸出 */
export const rect = (x: number, y: number, w: number, h: number, rx: number, cls: string | undefined, style?: string) =>
  tag('rect', { x, y, width: w, height: h, rx: rx || undefined, class: cls, style });
export const circle = (cx: number, cy: number, r: number, cls: string | undefined, style: string) => tag('circle', { cx, cy, r, class: cls, style });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, cls: string | undefined, style?: string) =>
  tag('ellipse', { cx, cy, rx, ry, class: cls, style });
export const path = (d: string, cls: string | undefined, style?: string) => tag('path', { d, class: cls, style });
/** 只有線、不填色 */
export const line = (d: string, cls: string, style?: string) => tag('path', { d, class: cls, fill: 'none', style });
export const fill = (c: string) => `fill:${c}`;
