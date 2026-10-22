# 驗證結果（spec 4.5）

- 日期：2026-10-21，Windows 11，Claude Code 2.1.306，模型 claude-sonnet-5-5
- 方法：`npm run build` 後，用暫存 settings 檔（不碰 `%USERPROFILE%\.claude\settings.json`）掛上 8 個事件的錄製 hook，以 `claude -p "<prompt>" --settings <檔>` 跑真實的 headless session。fixture 已將使用者名稱取代為 `user`。
- 限制：本次全部在 headless（`-p`）模式下錄製，沒有開互動式 session。

## 1. subagent 的工具名稱與描述欄位：已驗證

- 工具名稱是 **`Agent`**（不是 `Task`）。證據：`1792564590711-PreToolUse.json`，`tool_name: "Agent"`。
- 描述欄位是 **`tool_input.description`**（例如 `"count files"`），另有 `tool_input.prompt`、`subagent_type`、`run_in_background`。
- 結論：spec 的「`Task` 或 `Agent` 都支援」維持不變；`Task` 在本版未出現，保留相容即可。

補充發現（會影響 Task 3）：
- subagent 內部自己呼叫工具時，`PreToolUse`/`PostToolUse` 會多帶 `agent_id`、`agent_type`（例如 `1792564594673-PreToolUse.json`、`1792564600601-PreToolUse.json`、`1792564600897-PostToolUse.json`）；主 session 的事件沒有這兩個欄位。reducer 要決定這些事件是否也算員工的 `activity`，且不能把它們當成新的 `Agent` 派出事件。
- `SubagentStop`（`1792564602672-SubagentStop.json`）帶 `agent_id`、`agent_transcript_path`，**沒有** `tool_use_id`。
- 派出 `Agent` 的 `PostToolUse`（`1792564602882-PostToolUse.json`）的 `tool_response.agentId` 等於 `SubagentStop.agent_id`，但 `PostToolUse.tool_use_id` 與 `PreToolUse.tool_use_id` 相同，配對用 `tool_use_id` 即可。

## 2. `PreToolUse`/`PostToolUse` 是否有 `tool_use_id`：已驗證，有

- 格式 `toolu_...`。`Read`：`1792564586708-PreToolUse.json` 與 `1792564586980-PostToolUse.json` 相同；`Bash`：`1792564587288-PreToolUse.json` 與 `1792564588419-PostToolUse.json` 相同；`Agent`：`1792564590711-PreToolUse.json` 與 `1792564602882-PostToolUse.json` 相同（`toolu_01ABPttjVnaEMoEAWr1J7qcc`）。
- 結論：助理以 `tool_use_id` 配對可行，不需要退回 `SubagentStop` 先進先出。
- 另外：工具被權限拒絕時，只有 `PreToolUse`，沒有 `PostToolUse`（`1792564622290-PreToolUse.json` 之後直接是 `1792564625681-Stop.json`）。也就是說 `PreToolUse` 在權限判斷之前就會觸發，「PreToolUse 後變工作中」可能是等待批准中的假工作中，要靠 `Notification` 才會切到等你處理。

## 3. 權限通知如何辨識：未驗證（UNVERIFIED）

- 嘗試：`--permission-mode default` 要求執行 `mkdir`（`-p` 文字模式與 `--input-format stream-json` 各一次，fixture session `1a9200f4`、`72cf490c`）。headless 模式下需要批准的工具直接被拒絕，**完全沒有 `Notification` 事件**。
- 互動式 TUI 需要真實終端機，無法在這個自動化流程中操作，所以沒有取得真實的 `Notification` fixture。
- 沒有證據可以寫欄位值；spec 4.1 的「確認是權限請求才變等你處理」維持原樣，Task 3 實作前仍需補一次人工互動錄製。
- 待確認清單：`notification_type`（或 `message` 內容）如何區分權限請求與閒置提醒。

## 4. 直接關閉終端機是否收到 `SessionEnd`：部分驗證

- 正常結束：`-p` 跑完會收到 `SessionEnd`（`reason: "other"`，例如 `1792564604985-SessionEnd.json`）。
- 強制終止行程（`Stop-Process -Force`，session `32b55914`，工具執行中被殺）：只有 `SessionStart`、`UserPromptSubmit`、`PreToolUse`，**沒有 `Stop` 也沒有 `SessionEnd`**。另一次在 `Stop` 之後、背景工作等待中以 `taskkill /T /F` 終止（session `a4a62f77`），同樣沒有 `SessionEnd`。
- 未驗證：真正「關閉終端機視窗」（console 收到 CTRL_CLOSE_EVENT）。headless 行程沒有可關閉的視窗，嘗試 `CloseMainWindow()` 回傳 False（`MainWindowHandle` 為 0）。強制終止的結果可視為最壞情況：關窗很可能也收不到 `SessionEnd`，所以 5.4 的「請他下班」與 12 小時逾時機制是必要的，維持現有設計。

## 5. 對照官方 hooks 文件後的事件對應（2026-10-22）

依 code.claude.com/docs/en/hooks（共 33 個事件）重新對齊。**以下來自文件，尚未用真實互動式 session 錄製驗證**；第 2 節的實測（`PreToolUse` 在權限判斷之前就觸發）是需要 `PermissionRequest` 的原因。

| 事件 | 對員工的影響 |
| --- | --- |
| `PermissionRequest` | 立刻「等你處理」，記下要批准的工具（`等你批准：…`）；原本 `Notification` 要等提示出現約 6 秒才送 |
| `Notification` | 只有 `permission_prompt`、`elicitation_dialog`、`elicitation_url_dialog` 算等你處理；`idle_prompt`、`auth_success`、`agent_*` 等不算。沒有 `notification_type`（舊版）才退回用訊息文字判斷 |
| `Elicitation` / `ElicitationResult` | MCP server 要你輸入時等你處理；回應之後回到工作中 |
| `PostToolUseFailure` | 同 `PostToolUse`：回到工作中，並讓同 `tool_use_id` 的助理完成 |
| `StopFailure` | 同 `Stop`：閒置、清氣泡、助理完成 |
| 不收 | `SubagentStart`（沒有 description，助理仍由 `PreToolUse` 的 `Agent` 建立）、`PermissionDenied`（只在 auto 模式，之後沒有狀態變化）、`idle_prompt`、`PostToolBatch` 等 |

## 6. 補錄：PermissionRequest 與背景 Agent（2026-10-22，Claude Code 2.1.307，headless `-p`）

fixture：`52b23d01`（權限）、`0ab96839`（背景 Agent）。使用者名稱已取代為 `user`。

- **`PermissionRequest`：已驗證**。headless 模式也會觸發（`PreToolUse` → `PermissionRequest` → `Stop`），欄位有 `tool_name`、`tool_input`、`permission_suggestions`。第 3 節「headless 沒有 `Notification`」仍成立，但 `PermissionRequest` 補上了這個缺口。
- **`AskUserQuestion`：未驗證**。headless 沒有這個工具（模型自己回報不在工具清單），只能在互動式 session 錄。
- **`run_in_background` 的 Agent：已驗證，行為和前景不同**：
  - `PostToolUse` 立刻觸發，`tool_response` 是 `{status: "async_launched", agentId, ...}`，不代表助理完成。
  - 主 session 的 `Stop` 會在助理還在跑時就觸發；助理內部事件（帶 `agent_id`）在 `Stop` 之後才出現。
  - `SubagentStop`（帶 `agent_id`）才是真正完成，之後還會有一個內容為 `<task-notification>` 的 `UserPromptSubmit`，再一個 `Stop`。
  - 處理：reducer 對背景助理記下 `agentId`，`PostToolUse`／`Stop`／`UserPromptSubmit` 不結束它，由 `SubagentStop.agent_id` 配對完成。
- Esc 中斷、直接關終端機：仍需互動式 session，headless 無法驗證。
