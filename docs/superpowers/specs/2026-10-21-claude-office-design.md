# Claude Office 設計文件

- 日期：2026-10-21
- 狀態：待審閱

## 1. 目的與範圍

### 1.1 要解決的問題

同時開好幾個 Claude Code session 時，很難一眼看出每個 session 在做什麼，特別是哪個 session 卡住、正在等使用者批准。Claude Office 把本機所有 session 畫成一間像素風辦公室：每個 session 是一位員工，subagent 是坐在員工旁邊的助理，用畫面呈現各自的狀態。

設計原則：**以狀態資訊為主，辦公室形式為輔**。畫面要好看，但狀態必須準確、好讀。

### 1.2 成功標準

1. 打開網頁就能看到本機所有進行中的 session，每位員工的狀態和真實 session 一致。
2. 「等你處理」狀態在事件發生後 1 秒內出現在畫面上，而且在畫面上最醒目。
3. 光看名牌就能分辨每位員工屬於哪個專案、最近在處理什麼任務。
4. 不論伺服器有沒有開，Claude Code 的使用體驗都不受影響（不變慢、不報錯）。

### 1.3 已確認的需求

- 平台：Windows，畫面在瀏覽器網頁中顯示。
- 一個 session 對應一位員工，名牌顯示**資料夾名稱**和**最近一次 prompt 摘要**。
- 員工狀態：工作中、等你處理、閒置、下班。
- subagent 是助理，狀態只有工作中和完成。
- 「等你處理」只有畫面變化，不出聲音、不跳系統通知。
- 視覺風格：像素風俯視角。

### 1.4 不在範圍內

- 跨電腦或多人共用的辦公室。
- 從畫面反向操作 session（例如批准權限、送出 prompt）。唯一例外是「請他下班」按鈕，而且只影響畫面（見 5.4）。
- 顯示 session title、讀取對話紀錄檔。
- 聲音、系統通知。
- 狀態存檔（伺服器重啟後不保留）。
- 包成桌面應用程式（之後可用 Tauri 包裝同一份網頁，但不在本次範圍）。

## 2. 架構

```
Claude Code session ──(hook 事件)──▶ ① Hook 回報腳本
                                          │ HTTP POST（短逾時）
                                          ▼
                                     ② 本機伺服器 ◀──▶ ③ 狀態模型（純邏輯）
                                          │ SSE 推送
                                          ▼
                                     ④ 前端辦公室畫面（瀏覽器）
```

資料來源只用 Claude Code hooks，不讀取對話紀錄檔。

### 2.1 技術選擇

- 執行環境：Node.js（LTS）+ TypeScript。
- 伺服器：Node 內建 `http` 模組，不另外引入框架。
- 即時推送：SSE（Server-Sent Events）。只需要伺服器到網頁的單向推送，比 WebSocket 簡單。
- 前端：Phaser 3。
- 測試：Vitest。

## 3. 元件

### 3.1 Hook 回報腳本（`src/hook/`）

- 由 Claude Code 在每個 hook 事件觸發時執行，從標準輸入讀取事件 JSON。
- 附上送出時間戳（`sentAt`，毫秒）後，POST 到 `http://127.0.0.1:<port>/events`。
- **硬性要求**：
  - 連線逾時 300 ms；任何錯誤（伺服器沒開、逾時、回應錯誤）都安靜放棄。
  - 一律以結束碼 0 結束，不輸出任何內容到標準輸出，避免影響 Claude Code 的行為。
- 讀取與伺服器相同的設定檔取得 port。

### 3.2 本機伺服器（`src/server/`）

- 只監聽 `127.0.0.1`，不對外開放。
- 端點：
  - `POST /events`：接收 hook 事件，交給狀態模型處理，再把產生的變化推送給所有連線中的網頁。
  - `GET /state`：回傳目前完整的辦公室狀態。
  - `GET /stream`：SSE 串流，推送狀態變化。
  - `POST /employees/:sessionId/dismiss`：「請他下班」，只從畫面移除員工。
  - 靜態檔案：提供前端網頁。
- 每分鐘執行一次逾時檢查（見 5.4）。

### 3.3 狀態模型（`src/state/`）

- 純函式：`reduce(state, event) → { state, changes }`，不涉及網路、檔案或畫面。
- 資料結構：

```ts
type EmployeeStatus = 'working' | 'waiting' | 'idle' | 'off';

interface Employee {
  sessionId: string;
  folder: string;          // cwd 的最後一層資料夾名稱
  cwd: string;
  lastPrompt: string;      // 最近一次 prompt 全文（顯示時再截斷）
  status: EmployeeStatus;
  activity: string | null; // 例如「編輯 app.ts」
  seat: number;
  arrivedAt: number;
  lastEventAt: number;     // 最近一次事件的 sentAt
  assistants: Assistant[];
}

interface Assistant {
  id: string;              // 工具呼叫 ID；拿不到時用流水號
  description: string;     // subagent 任務描述
  status: 'working' | 'done';
  startedAt: number;
}
```

### 3.4 前端辦公室畫面（`web/`）

- 載入時先呼叫 `GET /state` 取得完整狀態，再連上 `GET /stream` 接收變化。
- SSE 斷線時自動重連，重連後重新取一次完整狀態，避免漏掉變化。
- 詳見第 6 節。

### 3.5 安裝與移除指令（`src/installer/`）

- `install`：把 hooks 加入使用者層級的 Claude Code 設定檔（`%USERPROFILE%\.claude\settings.json`）。
  - 修改前先備份成 `settings.json.claude-office.bak`。
  - 只新增自己的 hook 項目，保留使用者原本的所有設定和 hooks。
  - 用固定標記辨識自己新增的項目，重複執行不會重複加入。
  - hook 指令中的路徑一律加引號，支援含空格或中文的路徑。
- `uninstall`：只移除帶有標記的項目，其他設定保持不變。

## 4. 事件與狀態對應

### 4.1 員工

| Hook 事件 | 狀態變化 |
|---|---|
| `SessionStart` | 建立員工，分配最小編號的空位，狀態為閒置 |
| `UserPromptSubmit` | 狀態變**工作中**，更新 `lastPrompt` |
| `PreToolUse` | 狀態變**工作中**，更新 `activity` |
| `PostToolUse` | 狀態變**工作中**（若原本是等你處理，代表已批准） |
| `Notification`（需要權限） | 狀態變**等你處理** |
| `Stop` | 狀態變**閒置**，清空 `activity` |
| `SessionEnd` | 狀態變**下班**，播完離場動畫後移除，座位釋出 |

- 收到任何事件時，如果還沒有這個 session 的員工，就先自動建立（補登記），`lastPrompt` 留空。
- `Notification` 只有在確認是權限請求時才變成等你處理；其他通知（例如閒置提醒）忽略。

### 4.2 工具名稱轉換

`activity` 由工具名稱和參數組成：

| 工具 | 顯示 |
|---|---|
| `Read` | 讀取 `<檔名>` |
| `Edit`、`MultiEdit`、`Write` | 編輯 `<檔名>` |
| `Bash` | 執行 `<指令前 30 字>` |
| `Grep`、`Glob` | 搜尋程式碼 |
| `WebSearch`、`WebFetch` | 搜尋網路 |
| `Task`、`Agent` | 派出助理 |
| 其他 | 使用 `<工具名稱>` |

### 4.3 助理（subagent）

- `PreToolUse` 且工具為 `Task` 或 `Agent`：新增助理，`description` 取自工具參數中的任務描述，狀態為工作中。
- 對應的 `PostToolUse`：助理狀態變**完成**，3 秒後移除。
- 以工具呼叫 ID 配對助理。若事件沒有提供 ID，改用 `SubagentStop` 事件，依先進先出順序配對。

### 4.4 事件順序

- 每個事件帶有 hook 腳本附上的 `sentAt`。
- 若事件的 `sentAt` 早於員工的 `lastEventAt`，該事件不改變員工狀態（但仍可用於補登記和助理配對）。

### 4.5 實作前必須驗證的項目

實作第一步先錄下真實事件（見 7.1），用來確認：

1. 派出 subagent 的工具名稱是 `Task` 還是 `Agent`（兩者都支援）。
2. `PreToolUse`、`PostToolUse` 事件是否帶有工具呼叫 ID。
3. `Notification` 事件如何區分權限請求和其他通知。
4. `SessionEnd` 在 Windows 上直接關閉終端機時是否會觸發。

驗證結果若與本設計不符，更新本文件後再繼續實作。

## 5. 異常狀況處理

### 5.1 伺服器沒開

hook 腳本放棄送出，Claude Code 不受影響。伺服器開啟後，已在執行的 session 在下一個事件時自動補登記。

### 5.2 伺服器重啟

狀態只存在記憶體中，重啟後辦公室清空，依 5.1 的方式逐漸補回。

### 5.3 事件順序錯亂

依 4.4 的時間戳規則處理。

### 5.4 幽靈員工

直接關閉終端機可能收不到 `SessionEnd`，員工會一直留在畫面上。

- 資訊卡上有「請他下班」按鈕：只從畫面移除，不影響真實 session。若該 session 仍在執行，下一個事件時會自動回來。
- 超過 12 小時沒有任何事件的員工自動下班。

### 5.5 Port 衝突

預設 port 為 `47823`，可在設定檔 `%USERPROFILE%\.claude-office\config.json` 修改。伺服器和 hook 腳本讀取同一份設定。若 port 已被占用，伺服器啟動時顯示明確的錯誤訊息並結束。

## 6. 前端畫面

### 6.1 辦公室格局

- 預設 8 個工位（2 排 × 4 張桌子），一側有門。
- 超過 8 位員工時往下新增一排桌子，畫面可捲動。
- 員工外觀（髮色、衣服顏色）由 session ID 的雜湊值決定，重新整理後仍然相同。

### 6.2 狀態表現

| 狀態 | 畫面 |
|---|---|
| 工作中 | 坐在桌前打字，頭上對話泡泡顯示 `activity` |
| 等你處理 | 站起來舉手，頭上紅色驚嘆號跳動，桌燈變紅 |
| 閒置 | 靠在椅背上喝咖啡 |
| 下班 | 走向門口後消失 |
| 助理工作中 | 坐在員工桌邊的小凳子上，泡泡顯示任務描述 |
| 助理完成 | 比讚，3 秒後走出門 |

新員工到班時從門口走到座位。

### 6.3 名牌與資訊卡

- 名牌第一行為資料夾名稱，第二行為 `lastPrompt` 前 30 字（超過則加上「…」）。
- 滑鼠移到員工身上顯示資訊卡：完整的最近 prompt、目前的 `activity`、到班時間、「請他下班」按鈕。

### 6.4 頂部摘要列

顯示各狀態人數，例如「工作中 3 · 等你處理 1 · 閒置 2」。等你處理人數大於 0 時用醒目顏色標示。

### 6.5 素材

- 開發初期用色塊人物和簡單圖形當替身，先讓功能可用。
- 之後換成可商用的免費像素辦公室素材，採用前確認授權條款，並在專案中附上授權說明。
- 素材集中管理，換素材不影響狀態邏輯。

## 7. 測試

### 7.1 錄製真實事件

先實作一個錄製模式的 hook，把每個事件原樣存成 JSON 檔。用來驗證 4.5 的項目，錄下的事件放入 `test/fixtures/` 作為測試資料。

### 7.2 自動化測試

- **狀態模型**：每種事件的狀態變化、補登記、事件順序錯亂、多個助理同時進出的配對、12 小時自動下班、請他下班後再收到事件會回來。
- **Hook 腳本**：伺服器沒開時在 500 ms 內以結束碼 0 結束，且沒有任何輸出。
- **伺服器**：POST 一個事件後，SSE 用戶端收到對應的變化；`GET /state` 回傳正確的完整狀態。
- **安裝指令**：用範例設定檔確認原有 hooks 保留、產生備份、重複安裝不會重複加入、移除後還原乾淨。

### 7.3 模擬腳本

`scripts/simulate` 可以假造多個 session 和助理的事件序列並送到伺服器，用來目視檢查動畫和名牌，不用真的開啟多個 Claude Code session。

## 8. 專案結構

```
claude-office/
├─ src/
│  ├─ hook/        Hook 回報腳本
│  ├─ server/      本機伺服器與 SSE 推送
│  ├─ state/       狀態模型（純邏輯）
│  └─ installer/   安裝與移除 hooks
├─ web/            Phaser 辦公室畫面
├─ scripts/        模擬事件腳本
├─ test/
│  └─ fixtures/    錄下的真實事件
└─ docs/
```

## 9. 使用方式

1. 第一次使用：執行安裝指令，把 hooks 加入 Claude Code 設定。
2. 平常使用：執行啟動指令開啟伺服器，用瀏覽器打開 `http://127.0.0.1:47823`。
3. 不想用了：執行移除指令。
