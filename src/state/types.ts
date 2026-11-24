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
  tool_calls?: { tool_name?: string }[]; // PostToolBatch：這一批工具（拒絕、失敗的也在內）
  notification_type?: string;
  message?: string;
  agent_id?: string;           // subagent 內部事件才有
  host_session_id?: string;    // Claude Desktop 的 session 才有，純 CLI 沒有
  sentAt: number;              // hook 腳本附上的 Date.now()
}

export type EmployeeStatus = 'working' | 'waiting' | 'idle';

/** 一件等你處理的事。員工有任何一件就是等你處理，全部有結果才回到 turn */
export interface Ask {
  agent: string;               // 誰在等：助理的 agent_id，主 session 是空字串
  tool: string;                // 工具名稱；reduce.ts 的 ASK_ELICITATION、ASK_NOTICE 不是工具
  input: string;               // 工具參數的雜湊，用來認出是哪一次呼叫（PermissionRequest 沒有 tool_use_id）
  at: number;                  // 什麼時候開始等（sentAt）；比它早送出的事件不能把它清掉
  label: string;               // 資訊卡要寫的文字，例如「等你批准：執行 npm test」；助理的和不知道內容的是空字串
}

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
  status: EmployeeStatus;      // asks 有東西就是 waiting，否則等於 turn
  turn: 'working' | 'idle';    // 主 session 這一輪還在跑，或輪到你
  asks: Ask[];
  activity: string | null;
  seat: number;                // 從 0 開始
  arrivedAt: number;
  lastEventAt: number;
  lastTopAt: number;           // 主 session 自己（不是助理內部）最近一個事件的 sentAt，用來判斷事件先後
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
