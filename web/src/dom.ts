// 建立 HTML 元素的小工具。文字一律用 textContent 放，避免 prompt 等使用者內容被當成 HTML

/** 建立元素、套 class、放文字（空字串就不設） */
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

/** <div class="cls"> */
export const div = (cls: string): HTMLDivElement => el('div', cls);
