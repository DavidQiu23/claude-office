import type { HookEvent } from './types.js';

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
    default:
      return '使用 ' + toolName;
  }
}

// provisional: no real Notification fixture (UNVERIFIED in docs/findings.md); controller ruling.
// Replace with the confirmed discriminator once a real permission Notification is captured.
export const isPermissionNotification = (e: HookEvent): boolean =>
  e.notification_type === 'permission_prompt' || /permission|needs your|權限/i.test(e.message ?? '');
