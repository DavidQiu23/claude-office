// 資訊卡（HTML 浮層）。內容一律用 textContent / DOM 建立，避免 prompt 內容被當成 HTML；樣式在 styles/ui.css。
import type { Assistant, Employee } from '../../src/state/types.js';
import { el } from './dom.js';
import type { Occupant } from './floors.js';
import { avatarSvg } from './figure.js';
import { appearance, assistantList, formatTime, nameplate, oneLine, projectColor, roomKey } from './view.js';

export const CARD_ID = 'info-card';
/** 頭像突出卡片上緣的高度，和 ui.css 的 .card-avatar top 對應 */
const AVATAR_RISE = 26;

interface Chip { text: string; cls: string }
const STATUS: Record<Employee['status'], Chip> = {
  working: { text: '工作中', cls: 'chip-working' },
  waiting: { text: '等你處理', cls: 'chip-waiting' },
  idle: { text: '輪到你', cls: 'chip-idle' },
};

/** 這個人的頭與肩膀（和桌上的人同一個外觀；key = 員工 sessionId）。avatarSvg 是程式產生、不含使用者資料的字串 */
function avatar(key: string): HTMLElement {
  const box = el('div', 'card-avatar');
  box.innerHTML = avatarSvg(appearance(key));
  return box;
}

export class InfoCard {
  private box = el('div', 'card');
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private err = '';
  id: string | null = null; // 目前顯示的員工 session id 或助理 id

  private origin: HTMLElement | null = null; // 鍵盤進到卡片前的人物，離開時焦點還給他

  constructor() {
    this.box.id = CARD_ID;
    this.box.onmouseenter = () => clearTimeout(this.hideTimer);
    this.box.onmouseleave = () => this.scheduleHide();
    document.body.append(this.box);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.close();
      // 卡片排在 DOM 最後，Tab 繼續走會離開頁面；回到人物，下一個 Tab 接著走隔壁
      else if (ev.key === 'Tab' && this.box.contains(ev.target as Node)) {
        ev.preventDefault();
        this.close();
      }
    });
  }

  /** 焦點移進卡片裡的按鈕（助理的卡片沒有按鈕，就留在人物上） */
  enter(): void {
    this.origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.box.querySelector('button')?.focus({ preventScroll: true });
  }

  /** 關掉；焦點在卡片裡就還給人物。要先還再藏，藏了焦點就丟了 */
  close(): void {
    if (this.box.contains(document.activeElement)) this.origin?.focus({ preventScroll: true });
    this.hide();
  }

  show(e: Occupant, left: number, top: number): void {
    clearTimeout(this.hideTimer);
    if (this.id !== e.sessionId) this.err = '';
    this.id = e.sessionId;
    this.fill(e);
    this.place(left, top);
  }

  private place(left: number, top: number): void {
    this.box.style.display = 'block';
    this.box.style.left = `${Math.max(0, Math.min(left, window.innerWidth - 320))}px`;
    // 頭像突出卡片頂端 AVATAR_RISE，連同白外圈都要留在視窗內
    this.box.style.top = `${Math.max(AVATAR_RISE + 4, Math.min(top, window.innerHeight - this.box.offsetHeight - 8))}px`;
  }

  /** 卡片外框：頂端專案色帶上寫標題（最多兩行），頭像突出色帶上緣，狀態標籤騎在色帶右上緣（助理沒有） */
  private frame(color: string, key: string, st: Chip | null, title: string, body: HTMLElement): void {
    this.box.style.setProperty('--pc', color); // 專案色：色帶、頭像底、資料夾小方塊都用它
    const bar = el('div', 'card-bar');
    bar.append(el('div', 'card-title clamp clamp-2', title));
    const focused = this.box.contains(document.activeElement); // 內容更新會換掉按鈕，焦點要接回去
    this.box.replaceChildren(bar, avatar(key), ...(st ? [el('span', `chip ${st.cls}`, st.text)] : []), body);
    if (focused) this.box.querySelector('button')?.focus({ preventScroll: true });
  }

  /** 一段「標題 + 文字」（文字最多 lines 行） */
  private section(label: string, text: string, sub: boolean, lines: number): HTMLElement {
    const s = el('div');
    s.append(this.label(label), el('div', `section-text clamp clamp-${lines}${sub ? ' sub' : ''}`, text));
    return s;
  }

  /** 目前動作。clamp 放內層：和 padding 同一層的話，被截掉的下一行會露在 padding 裡 */
  private activity(text: string, red: boolean): HTMLElement {
    const box = el('div', `activity${red ? ' activity-waiting' : ''}`);
    box.append(el('div', 'clamp clamp-2', text));
    return box;
  }

  private label(text: string): HTMLElement {
    return el('div', 'section-label', text);
  }

  fill(e: Occupant): void {
    if (e.assistant && e.owner) return this.fillHelper(e.owner, e.assistant);
    const color = projectColor(roomKey(e));
    const body = el('div', 'card-body');
    const title = nameplate(e) || '（無標題）';
    body.append(el('div', 'folder', e.folder));

    // 目前在做什麼；等你批准時整塊變紅
    if (e.activity) body.append(this.activity(e.activity, e.status === 'waiting'));

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
    const foot = el('div', 'card-foot');
    foot.append(left, btn);
    body.append(foot);

    this.frame(color, e.sessionId, STATUS[e.status], title, body);
  }

  /** 助理：描述、目前動作、類型、主人的標題、開始時間。在座位上一定是工作中，所以不貼狀態標籤，也不能請他下班 */
  private fillHelper(owner: Employee, a: Assistant): void {
    const body = el('div', 'card-body');
    body.append(el('div', 'folder', owner.folder));
    if (a.activity) body.append(this.activity(a.activity, false));
    if (a.kind) body.append(this.section('類型', a.kind, false, 1));
    body.append(this.section('主人', nameplate(owner) || '（無標題）', false, 2));
    const foot = el('div', 'card-foot');
    foot.append(el('span', 'card-foot-text', `開始 ${formatTime(a.startedAt)}`));
    body.append(foot);
    this.frame(projectColor(roomKey(owner)), a.id, null, oneLine(a.description) || '（無描述）', body);
  }

  scheduleHide(): void {
    if (this.box.contains(document.activeElement)) return; // 鍵盤還在卡片裡
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 250);
  }

  hide(): void {
    clearTimeout(this.hideTimer);
    this.box.style.display = 'none';
    this.id = null;
  }
}
