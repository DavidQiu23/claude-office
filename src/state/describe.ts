import type { HookEvent, ToolKind } from './types.js';

export const truncate = (text: string, max: number): string => {
  const chars = [...text]; // 以 code point 計算，emoji 不會被切半
  return chars.length > max ? chars.slice(0, max).join('') + '…' : text;
};

const base = (p: string): string => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

export const folderName = (cwd: string): string => base(cwd);

export const isSubagentTool = (toolName: string | undefined): boolean =>
  toolName === 'Task' || toolName === 'Agent';

export function describeTool(toolName: string, input: Record<string, unknown> | undefined): string {
  switch (toolName) {
    case 'Read':
      return '讀取 ' + base(String(input?.file_path ?? '檔案'));
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
      return '編輯 ' + base(String(input?.file_path ?? '檔案'));
    case 'Bash':
      return '執行 ' + truncate(String(input?.command ?? ''), 30);
    case 'Grep':
    case 'Glob':
      return '搜尋程式碼';
    case 'WebSearch':
    case 'WebFetch':
      return '搜尋網路';
    case 'Task':
    case 'Agent':
      return '派出助理';
    case 'AskUserQuestion':
      return '提問中';
    default:
      return '使用 ' + toolName;
  }
}

export function toolKindOf(toolName: string): ToolKind {
  switch (toolName) {
    case 'Read':
    case 'Grep':
    case 'Glob':
    case 'LS':
      return 'read';
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
    case 'TodoWrite':
      return 'edit';
    case 'Bash':
    case 'BashOutput':
    case 'KillShell':
      return 'run';
    case 'WebSearch':
    case 'WebFetch':
      return 'web';
    default:
      return isSubagentTool(toolName) ? 'agent' : 'other';
  }
}

// 依官方 hooks 文件的 notification_type：這三種是在等使用者處理（權限請求、MCP 表單、MCP 要開網址）。
// 其餘（idle_prompt、auth_success、agent_* 等）不算。舊版沒有 notification_type 時才退回用訊息文字判斷。
const WAITING_NOTIFICATIONS = new Set(['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog']);
export const isWaitingNotification = (e: HookEvent): boolean =>
  e.notification_type !== undefined
    ? WAITING_NOTIFICATIONS.has(e.notification_type)
    : /permission|needs your|權限/i.test(e.message ?? '');
