// 產生 SVG 標記字串的小工具（純函式，不碰 DOM；可在 node 環境測試）

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** <name a="v" ...>children</name>；值為 undefined 的屬性略過；children 省略時自我關閉 */
export function tag(name: string, attrs: Record<string, string | number | undefined>, children?: string): string {
  let a = '';
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) a += ` ${k}="${esc(String(v))}"`;
  return children === undefined ? `<${name}${a}/>` : `<${name}${a}>${children}</${name}>`;
}
