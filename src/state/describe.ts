import type { HookEvent } from './types.js';

export const truncate = (text: string, max: number): string => {
  const chars = [...text]; // 以 code point 計算，emoji 不會被切半
  return chars.length > max ? chars.slice(0, max).join('') + '…' : text;
};

const base = (p: string): string => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

export const folderName = (cwd: string): string => base(cwd);

export const isSubagentTool = (toolName: string | undefined): boolean =>
  toolName === 'Task' || toolName === 'Agent';

// 助理完成、session 之間傳訊等系統通知也走 UserPromptSubmit，hook 沒有欄位能分辨，只能看開頭的標籤。
// 只認這幾個標籤，使用者自己貼的 HTML 不算。
export const isSystemPrompt = (prompt: string | undefined): boolean =>
  /^\s*<(task-notification|agent-message|cross-session-message|side-sessions-event|ci-monitor-event)[\s>]/.test(prompt ?? '');

const oneLine = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim();
/** 指令要看得出在做什麼才能決定要不要批准；資訊卡工作中最多兩行、等你處理最多五行，更長由 CSS 截掉 */
const COMMAND_MAX = 160;

const firstQuestion = (input: Record<string, unknown> | undefined): string => {
  const q: unknown = Array.isArray(input?.questions) ? input.questions[0] : undefined;
  return truncate(oneLine((q as { question?: unknown } | undefined)?.question), COMMAND_MAX);
};

const host = (url: unknown): string => {
  try {
    return new URL(String(url)).host;
  } catch {
    return '';
  }
};

/** MCP 工具（mcp__伺服器__工具）：底線換成空格，長名稱才能在字之間換行；伺服器名稱是一串 id 時不寫 */
const describeMcp = (toolName: string): string | null => {
  const m = /^mcp__(.+?)__(.+)$/.exec(toolName);
  if (!m) return null;
  const words = (s: string) => s.replace(/[_-]+/g, ' ').trim();
  const server = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(m[1]) ? '' : words(m[1]);
  return `使用 ${words(m[2])}${server ? `（${server}）` : ''}`;
};

/** 等你處理時資訊卡寫什麼 */
export function askLabel(toolName: string, input: Record<string, unknown> | undefined): string {
  if (toolName === 'AskUserQuestion') return ['等你回答', firstQuestion(input)].filter(Boolean).join('：');
  if (toolName === 'ExitPlanMode') return '等你看計畫';
  return '等你批准：' + describeTool(toolName, input);
}

export function describeTool(toolName: string, input: Record<string, unknown> | undefined): string {
  switch (toolName) {
    case 'Read':
      return '讀取 ' + base(String(input?.file_path ?? '檔案'));
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
      return '編輯 ' + base(String(input?.file_path ?? '檔案'));
    case 'NotebookEdit':
      return '編輯 ' + base(String(input?.notebook_path ?? '檔案'));
    case 'Bash':
    case 'PowerShell':
      return '執行 ' + truncate(oneLine(input?.command), COMMAND_MAX);
    case 'Grep':
    case 'Glob':
      return '搜尋程式碼';
    case 'WebSearch':
      return '搜尋網路';
    case 'WebFetch':
      return ['讀取網頁', host(input?.url)].filter(Boolean).join(' ');
    case 'Skill':
      return ['使用技能', oneLine(input?.skill)].filter(Boolean).join(' ');
    case 'ToolSearch':
      return '尋找工具';
    case 'SendMessage':
      return '傳訊給助理';
    case 'EnterPlanMode':
      return '開始規劃';
    case 'ExitPlanMode':
      return '提出計畫';
    case 'Task':
    case 'Agent':
      return '派出助理';
    case 'AskUserQuestion':
      return '提問中';
    default:
      return describeMcp(toolName) ?? '使用 ' + toolName;
  }
}

// 依官方 hooks 文件的 notification_type：這三種是在等使用者處理（權限請求、MCP 表單、MCP 要開網址）。
// 其餘（idle_prompt、auth_success、agent_* 等）不算。舊版沒有 notification_type 時才退回用訊息文字判斷。
const WAITING_NOTIFICATIONS = new Set(['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog']);
export const isWaitingNotification = (e: HookEvent): boolean =>
  e.notification_type !== undefined
    ? WAITING_NOTIFICATIONS.has(e.notification_type)
    : /permission|needs your|權限/i.test(e.message ?? '');
