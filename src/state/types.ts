export interface HookEvent {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  transcript_path?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_response?: Record<string, unknown>; // 背景 Agent 的 PostToolUse：status 'async_launched'、agentId（docs/findings.md §6）
  notification_type?: string;
  message?: string;
  agent_id?: string;           // subagent 內部事件才有（docs/findings.md §1）
  agent_type?: string;         // subagent 內部事件才有（docs/findings.md §1）
  sentAt: number;              // hook 腳本附上的 Date.now()
}

export type EmployeeStatus = 'working' | 'waiting' | 'idle';

// 人物動作用的工具類型（docs/superpowers/specs/2026-11-01-figure-actions-design.md）
export type ToolKind = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'think' | 'other';

export interface Assistant {
  id: string;                  // tool_use_id，或 `seq-<n>`
  description: string;
  status: 'working' | 'done';
  startedAt: number;
  agentId?: string;            // 背景助理：async_launched 後記下，SubagentStop 用它配對
  kind?: string;               // subagent_type，例如 Explore、Plan；沒給就不記
  background?: boolean;        // run_in_background：PostToolUse 與 Stop 都不代表完成
}

export interface Employee {
  sessionId: string;
  folder: string;
  cwd: string;
  lastPrompt: string;
  firstPrompt: string;         // session 的第一個 prompt，通常最能代表主題
  title: string;               // transcript 裡的 ai-title；還沒產生時為空字串
  transcriptPath: string;
  status: EmployeeStatus;
  activity: string | null;
  toolKind: ToolKind | null;   // 剛送出 prompt 或工具剛用完是 think，閒置是 null；只在工作中有意義
  seat: number;                // 從 0 開始
  arrivedAt: number;
  lastEventAt: number;
  assistants: Assistant[];
}

export interface OfficeState {
  employees: Record<string, Employee>;
  seq: number;                 // 產生 `seq-<n>` 用
}

export type Change =
  | { type: 'upsert'; employee: Employee }
  | { type: 'leave'; sessionId: string };

export const emptyState = (): OfficeState => ({ employees: {}, seq: 0 });
