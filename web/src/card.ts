// 資訊卡（HTML 浮層）。內容一律用 textContent / DOM 建立，避免 prompt 內容被當成 HTML；樣式在 styles/ui.css。
import type { Assistant, Employee } from '../../src/state/types.js';
import { avatarSvg } from './figure.js';
import { helperKey } from './floors.js';
import { appearance, assistantList, formatTime, nameplate, oneLine, projectColor, roomKey } from './view.js';

interface Chip { text: string; cls: string }
const STATUS: Record<Employee['status'], Chip> = {
  working: { text: '工作中', cls: 'chip-working' },
  waiting: { text: '等你處理', cls: 'chip-waiting' },
  idle: { text: '輪到你', cls: 'chip-idle' },
};
// 助理：工作中綠、完成琥珀（和主人卡片助理清單的圓點同色）
const HELPER_STATUS: Record<Assistant['status'], Chip> = {
  working: { text: '工作中', cls: 'chip-working' },
  done: { text: '完成', cls: 'chip-done' },
};

/** 小 DOM 工具：建立元素、套 class、放文字 */
const el = (tag: string, cls = '', text = ''): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

/** 這個人的頭與肩膀（和桌上的人同一個外觀；key = 員工 sessionId 或助理 helperKey）。avatarSvg 是程式產生、不含使用者資料的字串 */
function avatar(key: string): HTMLElement {
  const box = el('div', 'card-avatar');
  box.innerHTML = avatarSvg(appearance(key));
  return box;
}

/** 卡片頂部：頭像 + 標題（最多兩行）+ 狀態標籤 + 專案資料夾 */
function cardHead(key: string, title: string, st: Chip, folderName: string): HTMLElement {
  const row = el('div', 'card-meta');
  row.append(el('span', `chip ${st.cls}`, st.text), el('span', 'folder', folderName));
  const text = el('div', 'card-text');
  text.append(el('div', 'card-title clamp clamp-2', title), row);
  const head = el('div', 'card-head');
  head.append(avatar(key), text);
  return head;
}

const cardBody = (): HTMLElement => el('div', 'card-body');
const cardFoot = (): HTMLElement => el('div', 'card-foot');

export class InfoCard {
  private box = document.createElement('div');
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private err = '';
  id: string | null = null; // 目前顯示的員工 session id
  helper: string | null = null; // 目前顯示的助理 helperKey（和 id 分開放，兩種 key 不會混在一起）

  constructor() {
    this.box.className = 'card';
    this.box.onmouseenter = () => clearTimeout(this.hideTimer);
    this.box.onmouseleave = () => this.scheduleHide();
    document.body.append(this.box);
  }

  show(e: Employee, left: number, top: number): void {
    clearTimeout(this.hideTimer);
    if (this.id !== e.sessionId) this.err = '';
    this.id = e.sessionId;
    this.helper = null;
    this.fill(e);
    this.place(left, top);
  }

  /** 助理的卡片：類型、描述、主人的任務標題、狀態、開始時間；沒有「請他下班」 */
  showHelper(owner: Employee, a: Assistant, left: number, top: number): void {
    clearTimeout(this.hideTimer);
    this.id = null;
    this.helper = helperKey({ owner, a });
    this.fillHelper(owner, a);
    this.place(left, top);
  }

  private place(left: number, top: number): void {
    this.box.style.display = 'block';
    this.box.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 320))}px`;
    this.box.style.top = `${Math.max(0, Math.min(top, window.innerHeight - this.box.offsetHeight - 8))}px`;
  }

  /** 卡片外框：頂端一條專案色 */
  private frame(color: string, body: HTMLElement): void {
    this.box.style.setProperty('--pc', color); // 專案色：頂條、頭像底、資料夾小方塊都用它
    this.box.replaceChildren(el('div', 'card-bar'), body);
  }

  /** 一段「標題 + 文字」（文字最多 lines 行） */
  private section(label: string, text: string, sub: boolean, lines: number): HTMLElement {
    const s = el('div');
    s.append(this.label(label), el('div', `section-text clamp clamp-${lines}${sub ? ' sub' : ''}`, text));
    return s;
  }

  private label(text: string): HTMLElement {
    return el('div', 'section-label', text);
  }

  fill(e: Employee): void {
    const color = projectColor(roomKey(e));
    const body = cardBody();
    const title = oneLine(e.title) || oneLine(e.firstPrompt) || oneLine(e.lastPrompt) || '（無標題）';
    body.append(cardHead(e.sessionId, title, STATUS[e.status], e.folder));

    // 目前在做什麼；等你批准時整塊變紅
    if (e.activity) {
      const red = e.status === 'waiting';
      body.append(el('div', `activity clamp clamp-2${red ? ' activity-waiting' : ''}`, e.activity));
    }

    // prompt：第一個只在和最近的不同時才顯示
    body.append(this.section('最近的 PROMPT', oneLine(e.lastPrompt) || '（無）', false, 3));
    if (e.firstPrompt && oneLine(e.firstPrompt) !== oneLine(e.lastPrompt)) {
      body.append(this.section('第一個 PROMPT', oneLine(e.firstPrompt), true, 1));
    }

    // 助理：工作中排前，最多 4 位，其餘併成一行
    if (e.assistants.length) {
      const { rows, extra, extraWorking, extraDone, working } = assistantList(e.assistants);
      const list = el('div', 'helper-list');
      for (const a of rows) {
        const done = a.status === 'done';
        const row = el('div', `helper-row${done ? ' done' : ''}`);
        row.append(el('span', 'helper-dot'));
        if (typeof a.kind === 'string' && a.kind) {
          row.append(el('span', 'helper-kind', a.kind));
        }
        const desc = oneLine(a.description);
        row.append(
          el('span', `helper-desc${desc ? '' : ' empty'}`, desc || '（無描述）'),
          el('span', 'helper-state', done ? '完成' : '工作中'),
        );
        list.append(row);
      }
      if (extra > 0) {
        const parts = [extraWorking && `${extraWorking} 位工作中`, extraDone && `${extraDone} 位已完成`].filter(Boolean);
        const more = el('div', 'helper-more');
        more.append(el('b', '', `+${extra}`), el('span', '', `另有 ${parts.join('、')}`));
        list.append(more);
      }
      const title = this.label(`助理 · ${e.assistants.length}`);
      if (working) title.append(el('span', 'count-working', `${working} 位工作中`));
      const help = el('div');
      help.append(title, list);
      body.append(help);
    }

    // 頁尾：到班時間 / 錯誤，右邊「請他下班」
    const left = el('span', `card-foot-text${this.err ? ' error' : ''}`, this.err || `到班 ${formatTime(e.arrivedAt)}`);
    const btn = el('button', 'dismiss', '請他下班');
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
    const foot = cardFoot();
    foot.append(left, btn);
    body.append(foot);

    this.frame(color, body);
  }

  fillHelper(owner: Employee, a: Assistant): void {
    const color = projectColor(roomKey(owner));
    const body = cardBody();
    body.append(cardHead(helperKey({ owner, a }), oneLine(a.description) || '（無描述）', HELPER_STATUS[a.status], owner.folder));
    body.append(this.section('類型', a.kind || '（未指定）', false, 1));
    body.append(this.section('主人', nameplate(owner) || '（無標題）', false, 2));
    const foot = cardFoot();
    foot.append(el('span', 'card-foot-text', `開始 ${formatTime(a.startedAt)}`));
    body.append(foot);
    this.frame(color, body);
  }

  scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 250);
  }

  hide(): void {
    clearTimeout(this.hideTimer);
    this.box.style.display = 'none';
    this.id = null;
    this.helper = null;
  }
}
