// 資訊卡（HTML 浮層）。內容一律用 textContent / DOM 建立，避免 prompt 內容被當成 HTML。
import type { Employee } from '../../src/state/types.js';
import { drawClay } from './clay.js';
import { character, HAIR_COLORS } from './flat.js';
import { OUTFITS } from './sprites.js';
import { appearance, assistantList, formatTime, oneLine, PALETTE, projectColor, roomKey } from './view.js';

const STATUS: Record<Employee['status'], { text: string; color: string; bg: string }> = {
  working: { text: '工作中', color: '#46d983', bg: '#46d98322' },
  waiting: { text: '等你處理', color: '#ff6b6b', bg: '#ff4d4d26' },
  idle: { text: '輪到你', color: '#f2b83d', bg: '#f2b83d22' },
};
const clampCss = (n: number): string => `display:-webkit-box;-webkit-line-clamp:${n};-webkit-box-orient:vertical;overflow:hidden;word-break:break-all`;

/** 小 DOM 工具：建立元素、套樣式、放文字 */
const el = (tag: string, css = '', text = ''): HTMLElement => {
  const n = document.createElement(tag);
  n.style.cssText = css;
  if (text) n.textContent = text;
  return n;
};

/** 這位員工的頭與肩膀（和桌上的人同一個外觀） */
function avatarCanvas(e: Employee): HTMLCanvasElement {
  const look = appearance(e.sessionId);
  const shirt = '#' + (PALETTE[look.shirt] ?? PALETTE[0]!).toString(16).padStart(6, '0');
  const sprite = character({ pose: 'sit0', style: look.style, outfit: OUTFITS[look.outfit], glasses: look.glasses, hair: HAIR_COLORS[look.hair], shirt });
  const cv = document.createElement('canvas');
  const dpr = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  cv.width = cv.height = 56 * dpr; // 依螢幕解析度，顯示 56px
  cv.style.cssText = 'display:block;width:56px;height:56px';
  const ctx = cv.getContext('2d');
  if (ctx) {
    // 素材 x 0–40、y 8–44 放大 1.4 倍置中到 56×56
    ctx.scale(1.4 * dpr, 1.4 * dpr);
    ctx.translate(0, -6);
    drawClay(ctx, sprite.shapes, 'figure');
  }
  return cv;
}

export class InfoCard {
  private box = document.createElement('div');
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private err = '';
  id: string | null = null; // 目前顯示的員工 session id

  constructor() {
    this.box.style.cssText =
      'position:fixed;display:none;z-index:10;width:300px;box-sizing:border-box;background:#1e2542;color:#eef0ff;border:1px solid #3a4470;' +
      'border-radius:16px;box-shadow:0 12px 28px #0008;overflow:hidden;font:13px/1.5 system-ui,"Microsoft JhengHei",sans-serif';
    this.box.onmouseenter = () => clearTimeout(this.hideTimer);
    this.box.onmouseleave = () => this.scheduleHide();
    document.body.append(this.box);
  }

  show(e: Employee, left: number, top: number): void {
    clearTimeout(this.hideTimer);
    if (this.id !== e.sessionId) this.err = '';
    this.id = e.sessionId;
    this.fill(e);
    this.box.style.display = 'block';
    this.box.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 320))}px`;
    this.box.style.top = `${Math.max(0, Math.min(top, window.innerHeight - this.box.offsetHeight - 8))}px`;
  }

  private label(text: string): HTMLElement {
    return el('div', 'font-size:11px;font-weight:700;letter-spacing:.08em;color:#8d95bd;margin-bottom:4px', text);
  }

  fill(e: Employee): void {
    const color = projectColor(roomKey(e));
    const st = STATUS[e.status];
    const body = el('div', 'padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px');

    // 頭像 + 標題 + 狀態標籤 + 專案資料夾
    const avatar = el('div', `width:56px;height:56px;border-radius:16px;background:${color}33;border:1px solid ${color}88;overflow:hidden;flex:none`);
    avatar.append(avatarCanvas(e));
    const chip = el('span', `display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:999px;background:${st.bg};color:${st.color};font-size:12px;font-weight:700`);
    chip.append(el('span', `width:7px;height:7px;border-radius:50%;background:${st.color}`), document.createTextNode(st.text));
    const folder = el('span', 'font-size:12px;color:#8d95bd');
    folder.append(el('span', `display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px`), document.createTextNode(e.folder));
    const title = oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt) || '（無標題）';
    const head = el('div', 'display:flex;gap:12px;align-items:center');
    head.append(avatar, el('div', 'min-width:0;display:flex;flex-direction:column;gap:6px'));
    head.lastElementChild!.append(el('div', `font-size:16px;font-weight:700;line-height:1.35;${clampCss(2)}`, title), (() => {
      const row = el('div', 'display:flex;align-items:center;gap:8px;flex-wrap:wrap');
      row.append(chip, folder);
      return row;
    })());
    body.append(head);

    // 目前在做什麼；等你批准時整塊變紅
    if (e.activity) {
      const red = e.status === 'waiting';
      body.append(el('div', `background:${red ? '#ff4d4d1f' : '#ffffff0d'};border:1px solid ${red ? '#ff6b6b66' : '#ffffff14'};border-radius:10px;padding:8px 10px;color:${red ? '#ffb3b3' : '#dfe3ff'};${clampCss(2)}`, e.activity));
    }

    // prompt：第一個只在和最近的不同時才顯示
    const last = el('div');
    last.append(this.label('最近的 PROMPT'), el('div', `line-height:1.55;color:#c9cee8;${clampCss(3)}`, oneLine(e.lastPrompt) || '（無）'));
    body.append(last);
    if (e.firstPrompt && oneLine(e.firstPrompt) !== oneLine(e.lastPrompt)) {
      const first = el('div');
      first.append(this.label('第一個 PROMPT'), el('div', `line-height:1.55;color:#8d95bd;${clampCss(1)}`, oneLine(e.firstPrompt)));
      body.append(first);
    }

    // 助理：工作中排前，最多 4 位，其餘併成一行
    if (e.assistants.length) {
      const { rows, extra, extraWorking, extraDone, working } = assistantList(e.assistants);
      const list = el('div', 'border-top:1px solid #ffffff14');
      for (const a of rows) {
        const done = a.status === 'done';
        const row = el('div', `display:flex;align-items:center;gap:8px;padding:5px 0${done ? ';opacity:.55' : ''}`);
        row.append(el('span', `width:8px;height:8px;border-radius:50%;background:${done ? '#f2b83d' : '#46d983'};flex:none`));
        if (typeof a.kind === 'string' && a.kind) {
          row.append(el('span', 'max-width:76px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px ui-monospace,Consolas,monospace;color:#b9c0e6;background:#ffffff14;border-radius:4px;padding:0 5px', a.kind));
        }
        const desc = oneLine(a.description);
        row.append(
          el('span', `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${desc ? (done ? '#8d95bd' : '#dfe3ff') : '#6b7399'}`, desc || '（無描述）'),
          el('span', 'font-size:12px;color:#8d95bd;flex:none', done ? '完成' : '工作中'),
        );
        list.append(row);
      }
      if (extra > 0) {
        const parts = [extraWorking && `${extraWorking} 位工作中`, extraDone && `${extraDone} 位已完成`].filter(Boolean);
        const more = el('div', 'display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:#8d95bd');
        more.append(el('span', 'border:1px solid #ffffff33;border-radius:999px;padding:0 7px;flex:none', `+${extra}`), el('span', '', `另有 ${parts.join('、')}`));
        list.append(more);
      }
      const title = this.label(`助理 · ${e.assistants.length}`);
      if (working) title.append(el('span', 'margin-left:8px;color:#46d983;letter-spacing:0', `${working} 位工作中`));
      const help = el('div');
      help.append(title, list);
      body.append(help);
    }

    // 頁尾：到班時間 / 錯誤，右邊「請他下班」
    const left = el('span', `flex:1;font-size:12px;color:${this.err ? '#ff8a80' : '#8d95bd'}`, this.err || `到班 ${formatTime(e.arrivedAt)}`);
    const btn = el('button', 'cursor:pointer;padding:6px 12px;border-radius:8px;font:inherit;color:#c9cee8;background:transparent;border:1px solid #ffffff26', '請他下班');
    btn.onmouseenter = () => { btn.style.color = '#ffb3b3'; btn.style.borderColor = '#ff6b6b99'; };
    btn.onmouseleave = () => { btn.style.color = '#c9cee8'; btn.style.borderColor = '#ffffff26'; };
    btn.onclick = async () => {
      const id = this.id;
      if (!id) return;
      try {
        const r = await fetch(`/employees/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
        if (!r.ok) throw new Error(String(r.status));
        this.hide();
      } catch {
        this.err = '操作失敗，請稍後再試';
        const cur = this.id === id ? e : null;
        if (cur) this.fill(cur);
      }
    };
    const foot = el('div', 'border-top:1px solid #ffffff14;padding-top:12px;display:flex;align-items:center;gap:8px');
    foot.append(left, btn);
    body.append(foot);

    this.box.replaceChildren(el('div', `height:5px;background:${color}`), body);
  }

  scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 250);
  }

  hide(): void {
    clearTimeout(this.hideTimer);
    this.box.style.display = 'none';
    this.id = null;
  }
}
