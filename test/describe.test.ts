import { expect, test } from 'vitest';
import { askLabel, describeTool, folderName, isWaitingNotification, isSubagentTool, truncate } from '../src/state/describe.js';
import type { HookEvent } from '../src/state/types.js';

test('truncate 以字元計算', () => {
  expect(truncate('短句', 30)).toBe('短句');
  expect(truncate('一'.repeat(31), 30)).toBe('一'.repeat(30) + '…');
  expect(truncate('😀'.repeat(31), 30)).toBe('😀'.repeat(30) + '…');
});
test('describeTool', () => {
  expect(describeTool('Read', { file_path: 'C:\\repo\\src\\app.ts' })).toBe('讀取 app.ts');
  expect(describeTool('Edit', { file_path: '/repo/a.ts' })).toBe('編輯 a.ts');
  expect(describeTool('MultiEdit', { file_path: 'b.ts' })).toBe('編輯 b.ts');
  expect(describeTool('Write', { file_path: 'c.ts' })).toBe('編輯 c.ts');
  expect(describeTool('Bash', { command: 'npm test' })).toBe('執行 npm test');
  expect(describeTool('Bash', { command: 'x'.repeat(170) })).toBe('執行 ' + 'x'.repeat(160) + '…');
  expect(describeTool('PowerShell', { command: 'Get-Item a |\n  Remove-Item' })).toBe('執行 Get-Item a | Remove-Item');
  expect(describeTool('NotebookEdit', { notebook_path: 'D:\\n\\a.ipynb' })).toBe('編輯 a.ipynb');
  expect(describeTool('Grep', {})).toBe('搜尋程式碼');
  expect(describeTool('Glob', {})).toBe('搜尋程式碼');
  expect(describeTool('WebSearch', {})).toBe('搜尋網路');
  expect(describeTool('WebFetch', { url: 'https://code.claude.com/docs' })).toBe('讀取網頁 code.claude.com');
  expect(describeTool('WebFetch', {})).toBe('讀取網頁');
  expect(describeTool('Skill', { skill: 'code-review' })).toBe('使用技能 code-review');
  expect(describeTool('Task', {})).toBe('派出助理');
  expect(describeTool('Agent', {})).toBe('派出助理');
  expect(describeTool('mcp__foo__bar', {})).toBe('使用 bar（foo）');
  expect(describeTool('mcp__Claude_Browser__browser_batch', {})).toBe('使用 browser batch（Claude Browser）');
  expect(describeTool('mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__update', {})).toBe('使用 update');
  expect(describeTool('Whatever', {})).toBe('使用 Whatever');
  expect(describeTool('Read', undefined)).toBe('讀取 檔案');
});
test('isSubagentTool', () => {
  expect(isSubagentTool('Task')).toBe(true);
  expect(isSubagentTool('Agent')).toBe(true);
  expect(isSubagentTool('Read')).toBe(false);
  expect(isSubagentTool(undefined)).toBe(false);
});
test('folderName 支援兩種斜線', () => {
  expect(folderName('D:\\project\\my-shop-api')).toBe('my-shop-api');
  expect(folderName('/home/a/my-shop-api/')).toBe('my-shop-api');
});
// 依官方文件（hooks 參考）的 notification_type；沒有真實 fixture，用合成事件
const note = (o: Partial<HookEvent>): HookEvent =>
  ({ hook_event_name: 'Notification', session_id: 's', sentAt: 0, ...o });
test('isWaitingNotification：權限與 MCP 表單／網址要你處理，其餘不算', () => {
  for (const t of ['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog']) expect(isWaitingNotification(note({ notification_type: t }))).toBe(true);
  for (const t of ['idle_prompt', 'auth_success', 'elicitation_complete', 'elicitation_response', 'agent_needs_input', 'agent_completed', 'plugin_notification'])
    expect(isWaitingNotification(note({ notification_type: t, message: 'Claude needs your permission' }))).toBe(false);
  // 舊版沒有 notification_type：才退回用訊息文字判斷
  expect(isWaitingNotification(note({ message: 'Claude needs your permission to use Bash' }))).toBe(true);
  expect(isWaitingNotification(note({ message: 'Claude is waiting for your input' }))).toBe(false);
  expect(isWaitingNotification(note({}))).toBe(false);
});
test('describeTool：權限詢問與提問', () => {
  expect(describeTool('AskUserQuestion', {})).toBe('提問中');
  expect(askLabel('PowerShell', { command: 'rm x' })).toBe('等你批准：執行 rm x');
  expect(askLabel('ExitPlanMode', {})).toBe('等你看計畫');
  expect(askLabel('AskUserQuestion', { questions: [{ question: '要用哪個\n資料庫？' }] })).toBe('等你回答：要用哪個 資料庫？');
  for (const input of [undefined, {}, { questions: [] }, { questions: 'x' }, { questions: [null] }]) expect(askLabel('AskUserQuestion', input)).toBe('等你回答');
});
