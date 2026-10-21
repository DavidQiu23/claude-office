# Claude Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 瀏覽器中，用像素風辦公室即時顯示本機所有 Claude Code session（員工）與 subagent（助理）的狀態。

**Architecture:** Claude Code hooks 執行一支 Node 回報腳本，把事件 POST 到只聽 `127.0.0.1` 的本機伺服器。伺服器把事件交給純函式狀態模型，再用 SSE 把變化推給 Phaser 前端。安裝指令負責把 hooks 寫入 `%USERPROFILE%\.claude\settings.json`。

**Tech Stack:** Node.js 22 LTS、TypeScript 5、Node 內建 `http`、Vitest 3、Vite 6（只用來打包前端）、Phaser 3.90、tsx（執行腳本）。

**Spec:** `docs/superpowers/specs/2026-10-21-claude-office-design.md`（實作前先完整讀過）

## Global Constraints

- 平台：Windows。所有 npm script 必須在 PowerShell 和 cmd 中都能執行（不要用 `rm -rf`、`&&` 以外的 shell 語法）。
- 伺服器只監聽 `127.0.0.1`，預設 port `47823`。
- 設定檔：`%USERPROFILE%\.claude-office\config.json`，格式 `{ "port": number }`；伺服器和 hook 腳本共用。用 `os.homedir()` 取得使用者資料夾。
- Hook 腳本：連線逾時 300 ms；任何錯誤都安靜放棄；一律結束碼 0；不寫任何內容到 stdout。
- 名牌 prompt 摘要取前 30 字，超過加「…」。以字元（`Array.from`）計算，不是位元組。
- 助理完成後 3 秒從畫面移除。
- 超過 12 小時沒有事件的員工自動下班。
- 預設 8 個工位（2 排 × 4），超過時往下加排。
- 不讀取對話紀錄檔；不做聲音、系統通知、狀態存檔。
- 介面文字一律使用繁體中文，用語與 spec 一致：工作中、等你處理、閒置、下班、完成、請他下班。

## Review Focus

1. **中文與 emoji prompt**：摘要截斷不能把 emoji 切成亂碼，名牌顯示正確 → Task 3 的 `truncate` 測試。
2. **使用者的 settings.json 不存在、是空的、或不是合法 JSON**：不存在時建立新檔；不合法時中止並顯示錯誤，絕不覆蓋 → Task 7 測試。
3. **同一個資料夾開兩個 session**：兩位員工都出現且座位不同 → Task 4 測試。
4. **欄位缺漏或未知的事件**（沒有 `cwd`、未知的 `hook_event_name`、壞掉的 JSON body）：伺服器不當機，回 400 或忽略 → Task 4、Task 6 測試。
5. **瀏覽器分頁關閉後 SSE 連線中斷**：伺服器移除該連線，之後的推送不出錯 → Task 6 測試。

---

## File Structure

```
claude-office/
├─ package.json / tsconfig.json / vitest.config.ts / vite.config.ts / .gitignore
├─ src/
│  ├─ config.ts              讀設定檔，回傳 port
│  ├─ hook/send.ts           Hook 回報腳本（含錄製模式）
│  ├─ state/types.ts         HookEvent、Employee、Assistant、OfficeState、Change
│  ├─ state/describe.ts      工具名稱 → 中文 activity、truncate、權限通知判斷
│  ├─ state/reduce.ts        reduce(state, event)
│  ├─ state/maintenance.ts   sweep(state, now)、dismiss(state, sessionId)
│  ├─ server/app.ts          createApp()：路由、SSE hub、靜態檔案
│  ├─ server/main.ts         啟動指令
│  ├─ installer/settings.ts  addHooks / removeHooks（純函式）
│  └─ installer/main.ts      install / uninstall 指令（讀寫檔、備份）
├─ web/
│  ├─ index.html
│  └─ src/
│     ├─ main.ts             啟動 Phaser
│     ├─ sync.ts             /state + /stream 同步
│     ├─ view.ts             純函式：座位座標、外觀、摘要文字
│     └─ OfficeScene.ts      Phaser 場景
├─ scripts/simulate.ts       模擬事件
└─ test/
   ├─ fixtures/              Task 1 錄下的真實事件
   └─ *.test.ts
```

Build 輸出：`tsc` 把 `src/` 編譯到 `dist/`，Vite 把 `web/` 打包到 `dist/web/`。

---

### Task 1: 專案骨架、設定模組、錄製真實事件

這個 task 的目的是驗證 spec 4.5 的四個項目。必須在使用者的 Windows 電腦上，用真的 Claude Code 執行。

**Files:**
- Create: `package.json`、`tsconfig.json`、`vitest.config.ts`、`.gitignore`
- Create: `src/config.ts`、`src/hook/send.ts`（本 task 只做錄製模式）
- Test: `test/config.test.ts`
- Create: `docs/findings.md`

**Interfaces:**
- Produces: `loadConfig(home?: string): { port: number }`；`CONFIG_DIR(home?: string): string`；`DEFAULT_PORT = 47823`

- [ ] **Step 1: 初始化專案**

若資料夾還不是 git repo，先 `git init`。`package.json` 設 `"type": "module"`，scripts：`build`（`tsc && vite build`）、`test`（`vitest run`）、`start`（`node dist/server/main.js`）、`install-hooks`、`uninstall-hooks`、`simulate`（`tsx scripts/simulate.ts`）。`tsconfig`：`strict`、`module`/`moduleResolution` 為 `NodeNext`、`outDir: dist`、`rootDir: src`。`.gitignore`：`node_modules/`、`dist/`。

- [ ] **Step 2: 寫 config 的失敗測試**

```ts
test('沒有設定檔時用預設 port', () => {
  expect(loadConfig(tmpHome)).toEqual({ port: 47823 });
});
test('讀取設定檔中的 port', () => {
  writeFileSync(join(tmpHome, '.claude-office', 'config.json'), '{"port":50000}');
  expect(loadConfig(tmpHome)).toEqual({ port: 50000 });
});
test('設定檔壞掉時用預設 port', () => {
  writeFileSync(join(tmpHome, '.claude-office', 'config.json'), '{not json');
  expect(loadConfig(tmpHome).port).toBe(47823);
});
```

`tmpHome` 在每個測試前用 `mkdtempSync` 建立，並建好 `.claude-office` 子資料夾。

- [ ] **Step 3: 執行 `npm test`，確認失敗**

- [ ] **Step 4: 實作 `src/config.ts`**

`home` 預設為 `os.homedir()`。任何讀取或解析錯誤都回傳預設值，不拋錯（hook 腳本也會用它）。

- [ ] **Step 5: 執行 `npm test`，確認通過**

- [ ] **Step 6: 實作 `src/hook/send.ts` 的錄製模式**

執行 `node dist/hook/send.js --record=<資料夾>` 時，讀完 stdin 後原樣寫成 `<資料夾>/<Date.now()>-<hook_event_name>.json`。外層包 try/catch，一律 `process.exit(0)`。

- [ ] **Step 7: 手動錄製事件（在 Windows 上）**

`npm run build` 後，暫時手動在 `%USERPROFILE%\.claude\settings.json` 為 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Notification`、`Stop`、`SubagentStop`、`SessionEnd` 加上 hook：`node "<專案路徑>/dist/hook/send.js" --record=<專案路徑>/test/fixtures`（路徑用正斜線）。修改前先備份原檔。接著開一個新的 Claude Code session，依序：送一個 prompt、讓它讀檔、讓它執行一個需要權限的指令（先不批准，等通知出現再批准）、讓它派出一個 subagent、等回應結束、最後**直接關閉終端機視窗**。再開一個 session 正常輸入 `/exit` 結束。

- [ ] **Step 8: 寫下驗證結果**

在 `docs/findings.md` 回答 spec 4.5 的四題，每題附上 fixture 檔名作為證據：
1. subagent 工具名稱（`Task` 或 `Agent`）以及描述欄位名稱。
2. `PreToolUse`/`PostToolUse` 是否有 `tool_use_id`。
3. 權限通知如何辨識（例如 `notification_type` 的值或 `message` 內容）。
4. 直接關閉終端機時是否收到 `SessionEnd`。

接著還原 settings.json 備份。若結果和 spec 有出入，先更新 spec 和本計畫的 Task 3、Task 4，再繼續。刪掉 fixtures 中含有個人敏感內容的檔案，或把 prompt 改成無害文字。

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: scaffold project and record real hook events"
```

---

### Task 2: 狀態型別

**Files:**
- Create: `src/state/types.ts`

**Interfaces:**
- Produces（後續所有 task 使用）：

```ts
export interface HookEvent {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  notification_type?: string;
  message?: string;
  sentAt: number;              // hook 腳本附上的 Date.now()
}

export type EmployeeStatus = 'working' | 'waiting' | 'idle';

export interface Assistant {
  id: string;                  // tool_use_id，或 `seq-<n>`
  description: string;
  status: 'working' | 'done';
  startedAt: number;
}

export interface Employee {
  sessionId: string;
  folder: string;
  cwd: string;
  lastPrompt: string;
  status: EmployeeStatus;
  activity: string | null;
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
```

「下班」不是存在狀態中的值：員工下班時從 state 移除，並送出 `leave` 變化，由前端播放離場動畫。

若 Task 1 的發現顯示欄位名稱不同，以發現為準調整 `HookEvent`。

- [ ] **Step 1: 建立檔案，執行 `npx tsc --noEmit` 確認無錯誤**
- [ ] **Step 2: Commit** `git commit -m "feat: add state types"`

---

### Task 3: 事件描述工具

**Files:**
- Create: `src/state/describe.ts`
- Test: `test/describe.test.ts`

**Interfaces:**
- Consumes: `HookEvent`（Task 2）
- Produces:
  - `truncate(text: string, max: number): string`
  - `describeTool(toolName: string, input: Record<string, unknown> | undefined): string`
  - `isSubagentTool(toolName: string | undefined): boolean`
  - `isPermissionNotification(e: HookEvent): boolean`
  - `folderName(cwd: string): string`

- [ ] **Step 1: 寫失敗測試**

```ts
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
  expect(describeTool('Bash', { command: 'x'.repeat(40) })).toBe('執行 ' + 'x'.repeat(30) + '…');
  expect(describeTool('Grep', {})).toBe('搜尋程式碼');
  expect(describeTool('Glob', {})).toBe('搜尋程式碼');
  expect(describeTool('WebSearch', {})).toBe('搜尋網路');
  expect(describeTool('WebFetch', {})).toBe('搜尋網路');
  expect(describeTool('Task', {})).toBe('派出助理');
  expect(describeTool('Agent', {})).toBe('派出助理');
  expect(describeTool('mcp__foo__bar', {})).toBe('使用 mcp__foo__bar');
  expect(describeTool('Read', undefined)).toBe('讀取 檔案');
});
test('folderName 支援兩種斜線', () => {
  expect(folderName('D:\\project\\my-shop-api')).toBe('my-shop-api');
  expect(folderName('/home/a/my-shop-api/')).toBe('my-shop-api');
});
test('isPermissionNotification', () => {
  // 依 docs/findings.md 的真實 fixture 改寫：至少一個權限通知為 true、一個閒置通知為 false
});
```

最後一個測試要用 `test/fixtures` 中的真實檔案組出事件，斷言權限通知回傳 `true`、其他通知回傳 `false`。

- [ ] **Step 2: 執行 `npm test`，確認失敗**
- [ ] **Step 3: 實作 `src/state/describe.ts`**

`file_path` 缺漏時用「檔案」。`isPermissionNotification` 依 `docs/findings.md` 的辨識方式實作。

- [ ] **Step 4: 執行 `npm test`，確認通過**
- [ ] **Step 5: Commit** `git commit -m "feat: describe tool activity in Chinese"`

---

### Task 4: 狀態模型 reduce

**Files:**
- Create: `src/state/reduce.ts`
- Test: `test/reduce.test.ts`

**Interfaces:**
- Consumes: Task 2 的型別；Task 3 的 `describeTool`、`isSubagentTool`、`isPermissionNotification`、`folderName`
- Produces: `reduce(state: OfficeState, e: HookEvent): { state: OfficeState; changes: Change[] }`（不修改傳入的 state）

規則（spec 第 4 節）：
- 缺少 `session_id` → 原樣回傳，`changes` 為空。
- 員工不存在且事件不是 `SessionEnd` → 先建立：`seat` 取最小的空位編號、`status: 'idle'`、`lastPrompt: ''`、`arrivedAt = lastEventAt = e.sentAt`。`cwd` 缺漏時 `folder` 為 `'(未知)'`。
- `e.sentAt < employee.lastEventAt` → 不改 `status`/`activity`/`lastPrompt`，但仍處理助理配對；`lastEventAt` 不倒退。
- 狀態轉換：`UserPromptSubmit` → working、更新 `lastPrompt`、清空 `activity`；`PreToolUse` → working、`activity = describeTool(...)`；`PostToolUse` → working；權限 `Notification` → waiting；其他 `Notification` 不變；`Stop` → idle、`activity = null`；`SessionEnd` → 移除員工並產生 `leave`；未知事件 → 只更新 `lastEventAt`。
- 助理：`PreToolUse` 且 `isSubagentTool` → 新增助理，`id = tool_use_id ?? 'seq-' + (++seq)`，`description = tool_input.description ?? ''`。`PostToolUse` 且有相符的 `tool_use_id` → 該助理 `done`。`SubagentStop` → 只在沒有 `tool_use_id` 的情況下（id 以 `seq-` 開頭），把最早的 working 助理設為 `done`。每次處理事件時，先移除這位員工所有已經是 `done` 的助理（前端負責顯示完成後 3 秒）。
- 員工有任何變化時，產生一個 `upsert`，內容為完整的新員工物件。

- [ ] **Step 1: 寫失敗測試**

用輔助函式 `ev(name, extra)` 產生事件（預設 `session_id: 's1'`、`cwd: 'D:\\p\\api'`、`sentAt` 遞增）。測試名稱與斷言：

```ts
test('SessionStart 建立閒置員工並分配座位 0');           // status 'idle', seat 0, folder 'api'
test('UserPromptSubmit 變工作中並記下 prompt');          // status 'working', lastPrompt '修登入 bug'
test('PreToolUse 更新 activity');                        // activity '編輯 app.ts'
test('權限通知變等你處理，PostToolUse 回到工作中');
test('非權限通知不改變狀態');
test('Stop 變閒置並清空 activity');
test('SessionEnd 移除員工並產生 leave');                 // changes 含 {type:'leave', sessionId:'s1'}
test('沒有 SessionStart 也會補登記，lastPrompt 為空');
test('同資料夾兩個 session 有不同座位');                 // seats 0 和 1, 兩者 folder 都是 'api'
test('座位釋出後被重用');                                // s1 離開後新的 s3 拿到 seat 0
test('較舊的事件不改變狀態');                            // Stop(sentAt 10) 後收到 PreToolUse(sentAt 5)，仍為 idle
test('以 tool_use_id 配對多個助理');                     // 派出 a、b；PostToolUse b → b done, a working
test('完成的助理在下一個事件時被移除');
test('沒有 tool_use_id 時以 SubagentStop 先進先出配對'); // seq-1 先 done
test('缺少 session_id 的事件被忽略');                    // changes 為 []
test('未知事件只更新 lastEventAt');
test('cwd 缺漏時資料夾顯示 (未知)');
test('不修改傳入的 state');                              // 用 structuredClone 比對
```

若 Task 1 發現事件一定有 `tool_use_id`，SubagentStop 測試仍保留（作為保險）。

- [ ] **Step 2: 執行 `npm test`，確認失敗**
- [ ] **Step 3: 實作 `src/state/reduce.ts`**
- [ ] **Step 4: 執行 `npm test`，確認通過**
- [ ] **Step 5: Commit** `git commit -m "feat: add office state reducer"`

---

### Task 5: 自動下班與請他下班

**Files:**
- Create: `src/state/maintenance.ts`
- Test: `test/maintenance.test.ts`

**Interfaces:**
- Consumes: Task 2 型別、Task 4 `reduce`（測試用）
- Produces:
  - `IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000`
  - `sweep(state: OfficeState, now: number): { state: OfficeState; changes: Change[] }`
  - `dismiss(state: OfficeState, sessionId: string): { state: OfficeState; changes: Change[] }`

- [ ] **Step 1: 寫失敗測試**

```ts
test('超過 12 小時沒事件的員工下班');       // lastEventAt = 0, now = IDLE_TIMEOUT_MS + 1 → leave
test('剛好 12 小時內的員工保留');           // now = IDLE_TIMEOUT_MS → 無 changes
test('dismiss 移除員工並產生 leave');
test('dismiss 不存在的員工時沒有變化');
test('被 dismiss 的 session 再有事件時會回來'); // dismiss 後 reduce(PreToolUse) → 員工重新出現
```

- [ ] **Step 2: 執行 `npm test`，確認失敗**
- [ ] **Step 3: 實作 `src/state/maintenance.ts`**
- [ ] **Step 4: 執行 `npm test`，確認通過**
- [ ] **Step 5: Commit** `git commit -m "feat: add sweep and dismiss"`

---

### Task 6: 本機伺服器

**Files:**
- Create: `src/server/app.ts`、`src/server/main.ts`
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes: `reduce`、`sweep`、`dismiss`、`emptyState`、`loadConfig`
- Produces: `createApp(opts: { staticDir: string; now?: () => number }): { server: http.Server; sweepNow(): void; clientCount(): number }`

路由：
- `POST /events`：body 解析為 `HookEvent`；不是合法 JSON 或不是物件時回 `400`；否則交給 `reduce`，把每個 change 以 `data: <JSON>\n\n` 推給所有 SSE 用戶端，回 `204`。
- `GET /state`：回 `200`，`{ employees: Employee[] }`（依 seat 排序）。
- `GET /stream`：`Content-Type: text/event-stream`、`Cache-Control: no-cache`；連線 `close` 時移除該用戶端。
- `POST /employees/:sessionId/dismiss`：呼叫 `dismiss` 並推送，回 `204`。`sessionId` 需 `decodeURIComponent`。
- 其他 `GET`：從 `staticDir` 提供檔案（`/` 對應 `index.html`），必須防止 `..` 跳出 `staticDir`；找不到回 `404`。

`main.ts`：用 `loadConfig().port` 監聽 `127.0.0.1`；每 60 秒呼叫 `sweepNow()`；`EADDRINUSE` 時印出「port 47823 已被占用，請在 %USERPROFILE%\.claude-office\config.json 修改 port」（數字用實際 port）並以結束碼 1 結束；啟動成功時印出網址。

- [ ] **Step 1: 寫失敗測試**

測試在 port `0` 上啟動 `createApp`，用 `fetch` 呼叫。

```ts
test('POST 事件後 GET /state 看得到員工');
test('SSE 用戶端收到 upsert');                         // 讀取 /stream 的第一個 data 行，type === 'upsert'
test('壞掉的 JSON 回 400，伺服器仍可用');              // 接著 GET /state 仍回 200
test('dismiss 後員工消失並推送 leave');
test('SSE 斷線後 clientCount 歸零，之後 POST 不出錯'); // abort 後等待 close，再 POST 回 204
test('靜態檔案無法用 .. 跳出 staticDir');              // GET /../package.json → 404
test('sweepNow 移除逾時員工');                         // 注入 now
```

- [ ] **Step 2: 執行 `npm test`，確認失敗**
- [ ] **Step 3: 實作 `src/server/app.ts` 與 `src/server/main.ts`**
- [ ] **Step 4: 執行 `npm test`，確認通過**
- [ ] **Step 5: Commit** `git commit -m "feat: add local server with SSE"`

---

### Task 7: Hook 回報模式與安裝指令

**Files:**
- Modify: `src/hook/send.ts`（加入正常回報模式）
- Create: `src/installer/settings.ts`、`src/installer/main.ts`
- Test: `test/hook.test.ts`、`test/installer.test.ts`

**Interfaces:**
- Consumes: `loadConfig`
- Produces:
  - `HOOK_EVENTS = ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Notification','Stop','SubagentStop','SessionEnd']`
  - `MARKER = '--tag=claude-office'`
  - `hookCommand(scriptPath: string): string` → `node "<路徑，反斜線換成正斜線>" --tag=claude-office`
  - `addHooks(settings: object, command: string): object`
  - `removeHooks(settings: object): object`

Hook 正常模式（沒有 `--record` 參數）：讀 stdin → `JSON.parse` → 加上 `sentAt: Date.now()` → 用 `fetch` 加 `AbortSignal.timeout(300)` POST 到 `http://127.0.0.1:<port>/events`。stdin 為空或不是 JSON 時直接結束。整段包 try/catch，最後一律 `process.exit(0)`，不 `console.log`。

`addHooks` 為每個事件加入 `{ hooks: [{ type: 'command', command }] }`（`PreToolUse`、`PostToolUse` 另加 `matcher: '*'`），先移除含有 `MARKER` 的舊項目再加入，保留其他所有內容。`removeHooks` 移除含 `MARKER` 的 hook；若某事件陣列因此變空就刪掉該 key；若 `hooks` 物件變空就刪掉 `hooks`。

`installer/main.ts`：`node dist/installer/main.js install|uninstall`。設定檔路徑 `join(os.homedir(), '.claude', 'settings.json')`。檔案不存在時當作 `{}`（並建立資料夾）；內容不是合法 JSON 時印出「settings.json 不是合法的 JSON，已中止，未做任何修改」並以結束碼 1 結束。寫入前先複製成 `settings.json.claude-office.bak`。用 2 格縮排寫回。`package.json` 的 `install-hooks`、`uninstall-hooks` 指到這支指令。

- [ ] **Step 1: 寫失敗測試**

```ts
// test/hook.test.ts（先 npm run build，再用 child_process 執行 dist/hook/send.js）
test('伺服器沒開時 500 ms 內以結束碼 0 結束且沒有輸出');  // 設定檔 port 指向沒人聽的 port
test('stdin 不是 JSON 時以結束碼 0 結束');
test('伺服器開著時事件送達並帶有 sentAt');              // 用 createApp 起伺服器，再 GET /state
```

測試透過環境變數 `USERPROFILE` 和 `HOME` 指向暫存資料夾，讓 `os.homedir()` 讀到測試用設定檔。

```ts
// test/installer.test.ts
test('保留使用者原有的 hooks 與其他設定');
test('重複安裝不會重複加入');                       // 每個事件中含 MARKER 的項目只有 1 個
test('移除後回到安裝前的內容');                     // removeHooks(addHooks(x)) 深度等於 x
test('hookCommand 把反斜線換成正斜線並加引號');     // 'C:\\My Apps\\x.js' → 'node "C:/My Apps/x.js" --tag=claude-office'
test('settings.json 不存在時建立新檔');             // main install，用暫存 home
test('settings.json 不合法時中止且檔案不變');       // 結束碼 1，內容與原本相同
test('安裝時產生備份');
```

- [ ] **Step 2: 執行 `npm run build && npm test`，確認失敗**
- [ ] **Step 3: 實作三個檔案**
- [ ] **Step 4: 執行 `npm run build && npm test`，確認通過**
- [ ] **Step 5: 在 Windows 上手動驗證**

`npm run install-hooks` → `npm start` → 開一個 Claude Code session 送個 prompt → 瀏覽 `http://127.0.0.1:47823/state` 看到員工。關掉伺服器後再送一個 prompt，確認 Claude Code 沒有變慢或報錯。

- [ ] **Step 6: Commit** `git commit -m "feat: add hook reporter and installer"`

---

### Task 8: 前端同步與純畫面邏輯

**Files:**
- Create: `vite.config.ts`（`root: 'web'`、`build.outDir: '../dist/web'`）、`web/index.html`、`web/src/sync.ts`、`web/src/view.ts`
- Test: `test/view.test.ts`、`test/sync.test.ts`

**Interfaces:**
- Consumes: `Employee`、`Change`（從 `src/state/types.ts` 匯入型別）、`truncate`
- Produces:
  - `seatPosition(seat: number): { x: number; y: number }` — 每排 4 桌、每 2 排一組；桌距與排距為常數 `DESK_W = 96`、`DESK_H = 96`、原點 `(64, 128)`
  - `appearance(sessionId: string): { hair: number; shirt: number }` — 從固定的 8 色調色盤中，以字串雜湊挑色
  - `nameplate(e: Employee): [string, string]` — `[folder, truncate(lastPrompt, 30)]`
  - `summary(employees: Employee[]): { text: string; alert: boolean }` — 例如 `'工作中 3 · 等你處理 1 · 閒置 2'`；`alert` 在等你處理大於 0 時為 `true`
  - `class OfficeStore { employees: Map<string, Employee>; apply(c: Change): void; reset(list: Employee[]): void; on(fn: (c: Change | { type: 'reset' }) => void): void }`
  - `connect(store: OfficeStore, base?: string): void` — 先 `fetch('/state')` 再 `store.reset`，接著開 `EventSource('/stream')`；`onerror` 時關閉並在 2 秒後重新 `connect`（重新取完整狀態）

- [ ] **Step 1: 寫失敗測試**

```ts
test('seatPosition：0 到 3 在同一排、4 換到下一排、8 再往下');
test('appearance 對同一個 sessionId 永遠相同');
test('nameplate 截斷 prompt');
test('summary 文字與 alert');            // 等你處理 0 → alert false；1 → true
test('OfficeStore 套用 upsert 與 leave 並通知監聽者');
```

- [ ] **Step 2: 執行 `npm test`，確認失敗**
- [ ] **Step 3: 實作 `view.ts`、`sync.ts` 與 `index.html`**

`index.html` 包含頂部摘要列元素 `#summary` 和遊戲容器 `#game`。

- [ ] **Step 4: 執行 `npm test`，確認通過**
- [ ] **Step 5: Commit** `git commit -m "feat: add frontend sync and view helpers"`

---

### Task 9: Phaser 辦公室場景與模擬腳本

**Files:**
- Create: `web/src/main.ts`、`web/src/OfficeScene.ts`、`scripts/simulate.ts`

**Interfaces:**
- Consumes: Task 8 全部；伺服器的 `POST /employees/:id/dismiss`
- Produces: 可在瀏覽器中看到的辦公室畫面；`npm run simulate`

本 task 先用色塊替身（spec 6.5），不引入素材。所有素材繪製集中在 `OfficeScene` 的 `drawEmployee`、`drawAssistant`、`drawDesk` 方法中，之後換素材只改這三個方法。

畫面需求（spec 第 6 節）：
- 依 `seatPosition` 畫桌子；員工數超過目前桌數時往下加排，場景高度跟著變大並可捲動。左側畫一扇門。
- 員工顏色來自 `appearance`。新員工從門口移動到座位；`leave` 時移動到門口後消失。
- 工作中：輕微上下抖動（打字），頭上泡泡顯示 `activity`。等你處理：人物上移（站起），頭上紅色「!」跳動，桌子顏色變紅。閒置：人物旁畫一個咖啡杯，沒有泡泡。
- 助理：員工右側的小色塊，泡泡顯示 `description`；`done` 時顯示「👍 完成」，3 秒後淡出。
- 桌前名牌兩行，使用 `nameplate`。
- 滑鼠移到員工上顯示資訊卡（HTML 浮層即可）：完整 `lastPrompt`、`activity`、到班時間（`HH:mm`）、「請他下班」按鈕。按鈕呼叫 dismiss API。
- `#summary` 用 `summary()` 更新；`alert` 為 `true` 時加上醒目樣式（紅底白字）。

`scripts/simulate.ts`：對 `http://127.0.0.1:<port>/events` 送出事件，模擬 4 個 session（其中 2 個同資料夾），涵蓋：到班、工作、等你處理後恢復、派出 2 個助理並先後完成、閒置、下班。事件間隔 1.5 秒，`sentAt` 用 `Date.now()`，加上 `--loop` 參數時重複執行。

- [ ] **Step 1: 實作 `main.ts`、`OfficeScene.ts`**
- [ ] **Step 2: 實作 `scripts/simulate.ts`**
- [ ] **Step 3: 目視驗證**

`npm run build` → `npm start` → 瀏覽器打開 `http://127.0.0.1:47823` → 另開終端機執行 `npm run simulate`。逐項確認上方畫面需求都有出現；重新整理頁面後員工外觀不變；中途關掉再開伺服器，頁面會自動重連。

- [ ] **Step 4: 執行 `npm test`，確認既有測試仍通過**
- [ ] **Step 5: Commit** `git commit -m "feat: add pixel office scene and simulator"`

---

### Task 10: 像素素材與說明文件

**Files:**
- Create: `web/public/assets/`（素材檔）、`web/public/assets/LICENSE.md`、`README.md`
- Modify: `web/src/OfficeScene.ts`（只改 `drawEmployee`、`drawAssistant`、`drawDesk` 與 `preload`）

- [ ] **Step 1: 選素材**

找一套可商用的免費像素辦公室素材（俯視角，人物需有坐、站、走的影格）。把素材名稱、作者、來源網址和授權條款全文或連結寫進 `LICENSE.md`。授權不允許再散布或商用的素材不採用。**選定前先把候選素材和授權給使用者確認。**

- [ ] **Step 2: 替換三個繪製方法，保留色塊作為素材載入失敗時的備援**
- [ ] **Step 3: 用 `npm run simulate` 目視驗證所有狀態**
- [ ] **Step 4: 撰寫 `README.md`**

內容：需求（Node 22）、安裝（`npm install`、`npm run build`、`npm run install-hooks`）、使用（`npm start` 後打開網址）、修改 port、移除（`npm run uninstall-hooks`）、狀態說明表、素材授權連結。

- [ ] **Step 5: 執行 `npm test` 與 `npm run build`，確認通過**
- [ ] **Step 6: Commit** `git commit -m "feat: add pixel art assets and README"`
