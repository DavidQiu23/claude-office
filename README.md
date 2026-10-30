# Claude 辦公室

把本機的 Claude Code session 顯示成黏土質感的 2.5D 等角夜間辦公室：每個 session 是一位員工，subagent 是他的助理，列在員工的資訊卡裡。

## 需求

- Node 22
- Windows：hook 會經由 Git Bash 執行，請先安裝 Git for Windows（見下方「已知限制」）

## 安裝

```
npm install
npm run build
npm run install-hooks
```

- 請**先 build 再安裝 hook**：hook 指令指向 `dist/hook/send.js`，沒有 build 就沒有這個檔。
- `install-hooks` 會把 hook 寫入 `~/.claude/settings.json`（13 個事件：SessionStart、UserPromptSubmit、PreToolUse、PostToolUse、PostToolUseFailure、PermissionRequest、Notification、Elicitation、ElicitationResult、Stop、StopFailure、SubagentStop、SessionEnd）。
- hook 寫的是這個資料夾的絕對路徑，**專案搬移後請重新 build 並重新執行 `install-hooks`**。更新版本後也請重新執行一次，才會掛上新增的事件。

## 使用

```
npm start
```

然後用瀏覽器打開 http://127.0.0.1:47823 。伺服器只監聽 127.0.0.1，僅限本機存取。滑鼠移到員工身上會出現資訊卡，可按「請他下班」。

沒有真實 session 時，可以先模擬：

```
npm start                       # 先開伺服器（另開一個終端機）
npm run simulate                # 跑一輪 4 個模擬 session（3 個專案）
npm run simulate -- --loop      # 一直重複
```

`simulate` 只是把事件送給本機伺服器，所以**必須先 `npm start`**；伺服器沒開時會顯示「送不出事件」並結束。

### 修改 port

建立設定檔 `config.json`，內容如下：

```json
{"port": 50000}
```

- Windows：`%USERPROFILE%\.claude-office\config.json`
- macOS / Linux：`~/.claude-office/config.json`

改完後**重新啟動伺服器**。hook 每次執行都會重新讀取這個檔，所以不必重裝 hook。

## 疑難排解

- **畫面一直是空的**：確認 `npm start` 還在跑，且瀏覽器網址的 port 與設定一致；已經開著的 Claude Code session 要等下一次事件（例如送出下一個 prompt）才會出現。
- **改了 port 但沒有反應**：伺服器要重新啟動；之後新送出的事件才會用新 port。
- **Windows 上所有 hook 一起逾時**：Claude Code 在 Windows 上經由 Git Bash 執行 hook，Git Bash 異常時所有 hook 會一起逾時，辦公室因此收不到事件。這是 Git Bash 的問題，不是 claude-office 的設定；請先確認 `bash.exe -c "echo ok"` 能在一秒內回應。

## 辦公室怎麼排

辦公室是斜 45 度俯看的 2.5D 等角畫面，深藍色的夜間房間：後牆有門、時鐘、夜景窗、白板與月曆海報，靠牆從左排著書櫃、影印機、茶水櫃、冰箱、販賣機與沙發區（島變多、房間變寬時位置不會跳動），左牆有窗與盆栽。桌子是沿地板格線斜放的現代電腦桌（淺木薄桌面、黑色金屬腳、細邊框螢幕），員工和椅子對齊桌子中間，坐在桌子後方。所有物件都是黏土質感（圓角描邊、亮面與柔和的接地投影），員工從後牆的門進出。鏡頭會對準有人的島：人少時放大（最多 2 倍），人變多時拉遠，畫面不會超出房間，沒人時框住整個房間；島增減時平滑縮放。預設房間沒有橫幅、月曆與海報，房間寬過約 1114 才會多掛上去。視窗比畫面小時，整張畫布會跟著縮小放進視窗；只有視窗小到要縮到 40% 以下時才會出現捲軸。

每個專案（以完整路徑 cwd 判斷，一個資料夾一個）是一座桌子「島」，招牌漆在島左前緣的地板上，顯示專案名稱；同名但路徑不同的資料夾，招牌會顯示路徑最後兩層來區分。招牌上若有 session 等你處理，會立著一個紅色圓形徽章（數字 N = 等你處理的 session 數，會放大縮小）；有 session 輪到你時，後面再接一個琥珀色徽章（不動）。最後一位員工離開，該島才消失。

一座島的桌子數是最大座位編號加 1，空桌會保留。桌子多了就加欄：

| 桌數 | 欄數 |
| --- | --- |
| 1–3 | 桌數（一桌一欄） |
| 4–9 | 3 |
| 10–16 | 4 |
| 17 以上 | 5 |

**員工進出**：上班時從左上角的門走進來，沿島上方的走道走到座位；下班時從座位沿上班路線走回後牆的門口後消失；走到一半就下班的人，沿走道往左走到左牆邊消失。

**名牌**：每張桌子前方有一行名牌，寫成「名牌 · 動作」，太長時先從尾端截動作，再截名牌文字。名牌字級固定（不跟著鏡頭縮放），人多、鏡頭拉遠到 0.8 倍以下時只顯示名字。員工等你處理時，整條名牌變紅並以「! 」開頭；輪到你時，整條名牌變琥珀色並以「✓ 」開頭，頭上多一個琥珀色泡泡打勾（泡泡固定大小，被後排名牌蓋到時名牌在上）。

**狀態列與分頁標題**：畫面上方一行「工作中 N · 等你處理 N · 輪到你 N」，有等你處理時紅底，沒有但有輪到你時琥珀底。瀏覽器分頁標題也會帶數字，例如 `(!1 ✓2) Claude 辦公室`，分頁在背景也看得到；數字為 0 的那一項省略。

**助理**不佔座位，也不畫在桌邊，只列在主人的資訊卡裡：每位顯示類型標籤（例如 Explore、Plan，取自 subagent 的 `subagent_type`）、描述與狀態，最多列 4 位，其餘合併成「+N」。助理完成後在卡上變暗並標示「完成」，等該員工的下一個事件進來才從清單移除；主人下班時一起消失。助理不會「等你回覆」，招牌徽章的數字也不算助理。

**資訊卡**（滑鼠移上去就會出現）：

- 員工：專案色條與頭像、標題、狀態標籤、目前動作、最近的 prompt（和第一個不同時才另列第一個）、助理清單（類型、描述、狀態），以及「請他下班」（按一下就送出）。

## 狀態說明

| 角色 | 狀態 | 外觀 | 觸發 |
| --- | --- | --- | --- |
| 員工 | 工作中 | 坐在桌前打字（雙手交替），螢幕背面指示燈綠色，名牌後面接目前動作 | 送出 prompt、工具執行，批准或回答之後（PostToolUse、PostToolUseFailure、ElicitationResult） |
| 員工 | 等你處理 | 站起來舉手，名牌整條變紅並以「! 」開頭，桌面泛紅、螢幕背面指示燈變紅，招牌出現紅色數字徽章 | 要跳權限詢問（PermissionRequest）、Claude 用 AskUserQuestion 問你（PreToolUse）、MCP 要你輸入（Elicitation），或權限／MCP 表單的 Notification |
| 員工 | 輪到你 | 坐著閉眼休息，頭上琥珀色泡泡打勾，名牌整條變琥珀色並以「✓ 」開頭，桌上咖啡冒煙、螢幕背面指示燈黃色，招牌出現琥珀色數字徽章；一直到你送出下一個 prompt。剛開、還沒送過 prompt 的 session 也算 | 回合結束（Stop、StopFailure） |
| 員工 | 下班 | 沿上班路線走回門口後消失（走到一半下班則往左走到左牆邊） | SessionEnd、按「請他下班」、12 小時沒有任何事件 |
| 助理 | 工作中 | 主人資訊卡的助理清單出現一列，狀態為工作中 | subagent 啟動（`PreToolUse` 的 `Agent`，相容舊名 `Task`） |
| 助理 | 完成 | 該列變暗並標示「完成」，該員工下一個事件進來時移除 | subagent 結束（前景看 `PostToolUse`，背景看 `SubagentStop`） |

## 已知限制

**已驗證**（headless 實測）

- `PermissionRequest` 會觸發，在跳詢問時立刻觸發；`Notification` 要等提示出現約 6 秒才送，所以兩者都收，前者讓員工馬上舉手。
- `run_in_background` 的 Agent：`PostToolUse` 與主 session 的 `Stop` 都早於助理真正結束，所以背景助理要等 `SubagentStop`（依 `agent_id`）才算完成。

**未驗證**（需要互動式 session，headless 收不到）

- `AskUserQuestion` 算等你處理，是依工具名稱推論；如果你選擇答案後員工沒回到工作中，通常是 PostToolUse 沒收到。
- Elicitation（MCP 輸入）：依官方 hooks 文件的事件與 `notification_type`（`elicitation_dialog`、`elicitation_url_dialog`）判斷。
- 按 Esc 中斷：不會觸發 Stop，員工可能一直停在「工作中」（或拒絕互動式權限後停在「等你處理」），直到下一次 prompt／事件。
- 直接關閉終端機視窗：可能收不到 SessionEnd，員工會留在辦公室。請用「請他下班」，或等 12 小時自動離開。

**Windows**：hook 經由 Git Bash 執行，Git Bash 異常時 hook 會一起逾時（見「疑難排解」）。

細節見 `docs/findings.md`。

## 設定與移除

- 設定：只有 port（見「修改 port」）。
- 移除：

```
npm run uninstall-hooks
```

只會從 `~/.claude/settings.json` 移除 claude-office 的項目。`install-hooks` 與 `uninstall-hooks` 在 `settings.json` 已存在時，會先建立原始檔備份 `settings.json.claude-office.bak`（備份已存在就不會覆蓋，永遠保留最初的原始檔）；原本沒有 `settings.json` 就不會備份。

## 開發

```
npm test            # vitest
npx tsc             # 型別檢查（伺服器、hook、installer）
npx tsc -p web      # 型別檢查（前端）
npm run build       # tsc + tsc -p web + vite build
```

架構一行：hook 腳本（`src/hook/send.ts`）把事件 POST 給本機伺服器（`src/server`），狀態由 `src/state` 整理後推給瀏覽器，前端用 Phaser 畫辦公室（`web/src`）。

美術全是向量圖形，素材資料是 `web/src/flat.ts`（圖形清單，等角投影見 `web/src/iso.ts`，牆面與靠牆家具見 `web/src/furniture.ts`），再由 `web/src/art.ts` 用 `web/src/clay.ts` 的 Canvas 2D 黏土畫法烘焙成貼圖，沒有使用外部素材。想改外觀（髮色、桌子、配色）請改 `web/src/flat.ts`，再執行 `npm run build`。
