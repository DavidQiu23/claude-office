export interface HookEvent {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  transcript_path?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_response?: Record<string, unknown>; // 背景 Agent 的 PostToolUse：status 'async_launched'、agentId
  notification_type?: string;
  message?: string;
  agent_id?: string;           // subagent 內部事件才有
  host_session_id?: string;    // Claude Desktop 的 session 才有，純 CLI 沒有
  sentAt: number;              // hook 腳本附上的 Date.now()
}

export type EmployeeStatus = 'working' | 'waiting' | 'idle';

export interface Assistant {
  id: string;                  // tool_use_id（SendMessage 叫回的助理沒有時用 agentId）
  description: string;
  status: 'working' | 'done';
  startedAt: number;
  seat: number;                // 和員工共用主人那層的座位號碼；完成後就不佔了
  agentId?: string;            // 背景助理：async_launched 時記下；前景助理：伺服器從 meta 檔補上。用來配對內部事件
  kind?: string;               // subagent_type，例如 Explore、Plan；沒給就不記
  activity?: string;           // 目前動作，第一個內部工具事件之後才有
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
  seat: number;                // 從 0 開始
  arrivedAt: number;
  lastEventAt: number;
  assistants: Assistant[];
  hostSessionId?: string;      // Desktop 的員工才有：CLI 停掉不算下班，封存或刪除才算
  cliEnded?: boolean;          // Desktop 的員工：CLI 已停（SessionEnd），下一個新 session_id 就是 fork 出來的
}

export interface OfficeState {
  employees: Record<string, Employee>;
}

export type Change =
  | { type: 'upsert'; employee: Employee }
  | { type: 'leave'; sessionId: string };

export const emptyState = (): OfficeState => ({ employees: {} });
