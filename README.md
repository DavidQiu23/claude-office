# Claude 辦公室

把本機的 Claude Code session 顯示成夜間的剖面大樓：一個專案一層樓，每個 session 是坐在桌前的員工，subagent 是坐在主人旁邊的助理。一眼就能看出哪個 session 還在工作、哪個在等你處理、哪個已經輪到你。

![Claude 辦公室：紅色狀態列，左側電梯面板的 6F 與 1F 亮紅燈、3F 與 2F 亮琥珀燈；最上面的 6F crm 坐滿員工，右端一位站著舉手、名牌是紅色「! 處理客戶需…」；往下是 5F、4F，後牆有夜景窗，右端各放一組家具](docs/images/office.png)

*上圖是 `npm run simulate` 跑到一半的畫面：狀態列圖例「等你處理 2 · 輪到你 7 · 工作中 7 · 共 16 位」，因為有人等你處理，外框是紅色。左側電梯面板的 6F 與 1F 亮紅燈、3F 與 2F 亮琥珀燈。最上面的 6F crm 坐滿員工：琥珀色「✓ CRM 任務 …」名牌配打勾泡泡、白色名牌的是工作中，右端有一位站著舉手，名牌是紅色「! 處理客戶需…」，右緣的暗影表示這層還能往右捲。其下是 5F（招牌 customer-portal-redesi… 放不下，以「…」截斷）有一位員工，右端是書櫃、邊桌與立燈；4F docs 有兩位員工，右端是飲水機、販賣機與盆栽；最下面露出一部分 3F shop。後牆都有夜景窗。*

## 功能

- **一個 session 一位員工，一個專案一層樓**：依 session 的 cwd 分樓層，先到的專案在 1F，往上排；招牌寫在後牆左上，例如「3F shop」。
- **三種狀態一眼分辨**：工作中（打字、名牌是米白色）、等你處理（站起來舉手、紅色名牌）、輪到你（閉眼休息、琥珀色名牌與打勾泡泡）。
- **狀態列一眼看比例**：圖例依緊急程度列出各狀態人數，下方比例條用紅／琥珀／綠顯示人數比例；狀態列黏在頁面頂端。
- **電梯面板**：固定在視窗左側，一層一顆按鈕，亮紅燈＝那層有人等你處理、亮琥珀燈＝沒有人等你但有人輪到你；不管頁面捲到哪裡都看得到，點按鈕會捲到那層。
- **原生捲動**：樓層由上到下排成一棟大樓，用瀏覽器的捲軸看；打開頁面時停在最底（1F）。
- **放不下的樓層自己左右捲**：一層人多時只有那一層左右捲，邊緣有暗影；看不到的座位有人在等，邊緣會出現紅色或琥珀色提示，點了捲過去。
- **搭電梯上下班**：員工從電梯走出來、走到座位坐下；下班走回電梯，最後一人離開後那層才拆掉。
- **助理也是員工**：subagent 坐在主人那層的桌子，名牌以「↳」開頭，完成後 3 秒離開；助理不算在電梯燈、邊緣提示與狀態列。
- **分頁標題帶數字**：例如 `(!1 ✓2) Claude 辦公室`，分頁在背景也看得到。
- **資訊卡**：滑鼠移到員工或助理身上會出現資訊卡；員工的卡片列出他的助理，並可「請他下班」。
- **只在本機執行**：伺服器只監聽 127.0.0.1；hook 最多等 300 毫秒，送不到伺服器時靜默結束，不影響 Claude Code。

## 需求

- Node.js（本專案以 Node 22 開發，`@types/node` 為 22 版）
- Windows：hook 會經由 Git Bash 執行，請先安裝 Git for Windows（見下方「已知限制」）

## 快速開始

```
npm install
npm run build
npm run install-hooks
npm start
```

然後用瀏覽器打開 http://127.0.0.1:47823 。之後每個 Claude Code session 送出事件時，員工就會走進辦公室。

## 安裝與建置

```
npm install
npm run build
```

`npm run build` 會依序執行 `tsc`（把 `src/` 的伺服器、hook、installer 編譯到 `dist/`）、`tsc -p web`（前端只做型別檢查，不輸出）與 `vite build`（前端輸出到 `dist/web`）。

## 安裝與移除 hooks

```
npm run install-hooks
```

- 請**先 build 再安裝 hook**：hook 指令指向 `dist/hook/send.js`，沒有 build 就沒有這個檔。
- `install-hooks` 會把 hook 寫入 `~/.claude/settings.json`（13 個事件：SessionStart、UserPromptSubmit、PreToolUse、PostToolUse、PostToolUseFailure、PermissionRequest、Notification、Elicitation、ElicitationResult、Stop、StopFailure、SubagentStop、SessionEnd）。
- hook 寫的是這個資料夾的絕對路徑，**專案搬移後請重新 build 並重新執行 `install-hooks`**。更新版本後也請重新執行一次，才會掛上新增的事件。
- 重複執行不會重複新增：會先拿掉舊的 claude-office 項目再寫入。

移除：

```
npm run uninstall-hooks
```

只會從 `~/.claude/settings.json` 移除 claude-office 的項目（指令帶有 `--tag=claude-office` 的 hook），其他 hook 保留。

- `install-hooks` 與 `uninstall-hooks` 在 `settings.json` 已存在時，會先建立原始檔備份 `settings.json.claude-office.bak`（備份已存在就不會覆蓋，永遠保留最初的原始檔）；原本沒有 `settings.json` 就不會備份。
- `settings.json` 不是合法的 JSON，或 `hooks` 欄位不是物件時，會中止且不做任何修改。

## 啟動

```
npm start
```

然後用瀏覽器打開 http://127.0.0.1:47823 。伺服器只監聽 127.0.0.1，僅限本機存取。滑鼠移到員工身上會出現資訊卡，可按「請他下班」。

port 已被占用時，伺服器會顯示 `port 47823 已被占用，請在 %USERPROFILE%\.claude-office\config.json 修改 port` 並結束，請見「設定」。

## 用 simulate 示範

沒有真實 session 時，可以用模擬事件讓辦公室有人：

```
npm start                       # 先開伺服器（另開一個終端機）
npm run simulate                # 跑一輪 17 個模擬 session（7 個專案）
npm run simulate -- --loop      # 一直重複
```

- `simulate` 只是把事件送給本機伺服器，所以**必須先 `npm start`**；伺服器沒開時會顯示「送不出事件」並結束。
- 它和伺服器讀同一個設定檔取得 port，改過 port 也不用另外指定。
- 一輪約 86 秒（73 個事件，多數每 1.5 秒一個，員工陸續走進來的部分每 0.3 秒一個）。劇本涵蓋：
  - 多個樓層：api、blog、shop、docs、tools、crm，約 6 層，超過一個畫面要上下捲；tools 的資料夾名超長，招牌會以「…」截斷。
  - 擠滿的樓層：crm 有 9 位員工，那層要左右捲；座位 8 的員工等你處理、座位 7 輪到你，視窗較窄時他們在畫面外，邊緣會出現提示。
  - 多位助理：shop 派出 2 位、crm 一次派出 3 位（一位有類型、一位沒有描述），陸續完成後離開。
  - 有人等你處理（權限詢問）、有人輪到你，docs 整層下班後拆掉，mobile 再在最上面加蓋新樓層。
  - 最後全部搭電梯下班，大樓回到空大廳。
  想停在某個畫面，可在中途按 Ctrl+C；停下後模擬員工會留在大樓裡，直到按「請他下班」、重新啟動伺服器（狀態只存在記憶體），或 12 小時沒有事件。
- 模擬用的假 transcript 放在系統暫存資料夾，結束時（含 Ctrl+C）會自動刪除；不會寫入 `~/.claude` 或 `~/.claude-office`。

## 設定

設定檔只有一個選項 `port`，預設 `47823`：

```json
{"port": 50000}
```

| 系統 | 位置 |
| --- | --- |
| Windows | `%USERPROFILE%\.claude-office\config.json` |
| macOS / Linux | `~/.claude-office/config.json` |

- 沒有設定檔、檔案無法解析，或 `port` 不是 1–65535 的整數時，一律使用預設值 `47823`。
- 伺服器、hook 與 `simulate` 都讀這個檔。改完後**重新啟動伺服器**；hook 每次執行都會重新讀取，所以不必重裝 hook。

## 疑難排解

- **畫面一直是空的**：確認 `npm start` 還在跑，且瀏覽器網址的 port 與設定一致；已經開著的 Claude Code session 要等下一次事件（例如送出下一個 prompt）才會出現。
- **改了 port 但沒有反應**：伺服器要重新啟動；之後新送出的事件才會用新 port。
- **Windows 上所有 hook 一起逾時**：Claude Code 在 Windows 上經由 Git Bash 執行 hook，Git Bash 異常時所有 hook 會一起逾時，辦公室因此收不到事件。這是 Git Bash 的問題，不是 claude-office 的設定；請先確認 `bash.exe -c "echo ok"` 能在一秒內回應。

## 大樓怎麼排

**整體**：畫面由上而下是狀態列（黏在頁面頂端）、夜空（星星、月亮、遠方城市剪影）、屋頂（女兒牆、水塔、冷氣機與閃紅燈的天線）、樓層（最高樓在上、1F 在最下）與地面（人行道與馬路）。頁面用瀏覽器原生捲軸；大樓比視窗矮時，上方的空間就是夜空。打開頁面時停在最底，看到 1F 與地面；之後重新連線不會動你的捲動位置。

沒有人上班時，只有地面和一層空的大廳，中間寫「目前沒有人上班」與「開一個 Claude Code session 就會出現」，電梯面板也不顯示。

**樓層分配**：每個專案（以完整路徑 cwd 判斷，一個資料夾一個）一層樓，依專案裡目前在場的員工中最早的到班時間，從 1F 往上排。專案的人全部離開（包含走進電梯）之後，那層拆掉，上面的樓層往下遞補，樓號跟著改。同名但路徑不同的資料夾，招牌會顯示路徑最後兩層來區分；招牌上的專案色由路徑決定，滑到招牌上會顯示完整路徑。

**一層樓**：高 200px，從左到右是電梯門（門上有樓號）、一排桌子、右端一組家具；後牆有夜景窗，招牌寫在後牆左上，例如「3F shop」（專案色底、白字，放不下以「…」截斷）。右端家具從四組（飲水機＋販賣機＋盆栽、書櫃＋影印機＋盆栽、立燈＋沙發＋邊桌、書櫃＋邊桌＋立燈）裡依專案路徑挑一組，所以同一個專案永遠長一樣。

**桌子與座位**：一張桌子寬 120px，人坐在桌後面向你，螢幕在桌面右側不擋臉。桌數是這層最大座位編號（包含助理的座位）加 1，沒人坐的座位是一張空桌（螢幕是暗的），整層沒人之前空桌都會保留。桌子的狀態一看就懂：

| 桌子狀態 | 螢幕與指示燈 |
| --- | --- |
| 空桌 | 螢幕暗、灰色指示燈 |
| 工作中 | 綠色螢幕光與指示燈 |
| 等你處理 | 紅色螢幕光與指示燈、桌面泛紅、地上有紅光 |
| 輪到你 | 琥珀色螢幕光與指示燈、桌上白杯冒煙 |

**捲動與寬度**：樓層寬度是「視窗寬 − 左邊 56px − 右邊 16px」與「80 + 桌數 × 120 + 200」之間較大的那個。視窗縮小或桌子變多使內容放不下時，只有那一層左右捲（觸控板左右滑、Shift＋滾輪或拖曳捲軸）：

- 左右各有一條 22px 的暗影，那一側還有內容才顯示，捲到底就消失。
- 座位中心在可見範圍外的算「看不到」。左、右兩側各自計算看不到的真員工：有等你處理的就出現紅色提示（右側「! 2 ›」、左側「‹ ! 2」，數字是人數）；沒有等你處理但有輪到你的，出現琥珀色「✓ N」。助理不算。
- 點提示：在那一側找離可見範圍最近、而且狀態跟提示顏色相同的員工，把這層捲到讓他的座位置中。捲動或視窗大小改變時重新計算。

**電梯面板**：固定在視窗左側垂直置中，一層一顆圓形按鈕寫樓號，最高樓在上；樓層太多放不下時面板自己可以上下捲。燈色跟那層的提示一致：紅色＝有員工等你處理，琥珀色＝沒有人等你但有人輪到你，都沒有就是暗的。目前在視窗內看得到（任何部分）的樓層，會用一個半透明的框框起來。點按鈕平滑捲到那層（系統設定了「減少動態效果」時直接跳過去），滑過按鈕會顯示專案名稱。

**加蓋樓層**：新專案的第一位員工來時，先在最上面加蓋一層。你停在最底時，畫面維持貼底；停在中間時，畫面停在原本看的那層，不會跳動。

**員工進出**：上班時電梯門打開（0.3 秒），員工從門口走出來，沿著樓層等速（每秒 120px）走到座位坐下。下班時先站起來，走回電梯、門打開、進去、門關上；這層最後一個人進電梯、門關好後，那層才拆掉。走到一半座位變了或要下班，會從目前的位置轉向。重新連線（例如重新整理頁面或伺服器重啟）時，大家直接坐在座位上，不播放電梯與走路的動畫；之後陸續進來的人才會走進來。

**名牌**：每張有人的桌子正面有一行名牌，13px，最寬 112px，放不下以「…」截斷。員工的名牌是 session 標題（transcript 裡的 ai-title），還沒有標題時用第一個 prompt，再沒有就用最近的 prompt。員工等你處理時，名牌是紅色並以「! 」開頭；輪到你時，名牌是琥珀色並以「✓ 」開頭，頭上多一個打勾的琥珀色泡泡；工作中是米白色。助理的名牌見下。

**狀態列與分頁標題**：畫面上方的狀態列分兩行：

- 圖例：依緊急程度排成「等你處理（紅色 !）→ 輪到你（琥珀色 ✓）→ 工作中（綠色 ●）」，每項是色塊符號加人數；人數為 0 的項目變灰。最右側顯示「共 N 位」。
- 比例條：依人數比例分成紅、琥珀、綠三段，人數為 0 的狀態不畫。
- 外框跟著最緊急的狀態變色：有等你處理時外框紅色、底色暗紅；沒有但有輪到你時外框琥珀色；都沒有時維持原本的紫色外框。

瀏覽器分頁標題也會帶數字，例如 `(!1 ✓2) Claude 辦公室`，分頁在背景也看得到；數字為 0 的那一項省略，兩項都是 0 時只顯示 `Claude 辦公室`。

**助理**是主人那層的一位員工，坐在主人右邊第一張空桌，沒有空桌就接在這層最後面；助理在的期間座位不變，真員工被配到同一個座位時助理換位。外觀（髮型、衣服）由主人與助理的編號決定。

- 名牌是偏藍的底色：「↳ 描述」；有類型（取自 subagent 的 `subagent_type`，例如 Explore、Plan）時是「↳ 類型 · 描述」；沒有描述時是「↳ 助理」。
- 助理開始時從電梯走出來，走到座位打字。完成後換成閒著的姿勢，名牌變「↳ ✓ 完成」，3 秒後走回電梯離開；工作中卻從主人的清單消失，或主人下班，會立刻走回電梯。助理離開後空桌保留，直到整層沒人。
- 助理不舉手、沒有打勾泡泡，也不算「等你處理」：電梯燈、邊緣提示、狀態列、分頁標題與「共 N 位」都只算員工。不過 subagent 內部的權限詢問等事件會改變主人的狀態。

**資訊卡**（滑鼠移到員工或助理身上就會出現，移開 0.25 秒後隱藏；卡片在人的右上方，頁面或任何一層樓捲動時先藏起來）：上方一條專案色條。

員工的卡片：

- 頭像、標題（同名牌的名字來源）、狀態標籤、專案資料夾名稱
- 目前動作（等你處理時整塊變紅）
- 最近的 prompt；第一個 prompt 和最近的不同時另外列出
- 助理清單：每位顯示類型標籤、描述與狀態；工作中的排前面，最多列 4 位，其餘合併成一行「+N 另有 N 位工作中、N 位已完成」。助理完成後在清單上變暗並標示「完成」，等該員工的下一個事件進來才從清單移除；主人下班時一起消失
- 頁尾：到班時間（HH:mm）與「請他下班」按鈕。按下就送出，沒有確認步驟；失敗時頁尾顯示「操作失敗，請稍後再試」

助理的卡片：頭像、描述、狀態標籤（工作中或完成）與專案資料夾名稱，接著是類型（沒有則「（未指定）」）、主人的任務標題，頁尾是開始時間（HH:mm）。助理的卡片沒有「請他下班」。

## 狀態說明

| 角色 | 狀態 | 外觀 | 觸發 |
| --- | --- | --- | --- |
| 員工 | 工作中 | 坐在桌前打字（雙手交替），螢幕與指示燈綠色，名牌是米白色 | 送出 prompt（UserPromptSubmit）、工具執行（PreToolUse，AskUserQuestion 除外），批准或回答之後（PostToolUse、PostToolUseFailure、ElicitationResult） |
| 員工 | 等你處理 | 站起來舉手，名牌整條變紅並以「! 」開頭，桌面泛紅、螢幕與指示燈變紅，電梯面板那層亮紅燈 | 要跳權限詢問（PermissionRequest）、Claude 用 AskUserQuestion 問你（PreToolUse）、MCP 要你輸入（Elicitation），或 `notification_type` 為 `permission_prompt`、`elicitation_dialog`、`elicitation_url_dialog` 的 Notification |
| 員工 | 輪到你 | 坐著閉眼、身體輕輕上下浮動，頭上琥珀色泡泡打勾，名牌整條變琥珀色並以「✓ 」開頭，桌上白杯冒煙、螢幕與指示燈琥珀色，電梯面板那層亮琥珀燈（該層沒有人等你處理時）；維持到下一個改變狀態的事件（通常是你送出下一個 prompt） | 回合結束（Stop、StopFailure）；新 session 剛出現、還沒收到會改變狀態的事件時（例如只收到 SessionStart）也是這個狀態 |
| 員工 | 下班 | 走回電梯、進去後消失（見「員工進出」） | SessionEnd、按「請他下班」、12 小時沒有任何事件（伺服器每分鐘檢查一次） |
| 助理 | 工作中 | 從電梯走出來，坐在主人那層的桌子打字，名牌是「↳ …」；主人資訊卡的助理清單出現一列 | subagent 啟動（`PreToolUse` 的 `Agent`，相容舊名 `Task`），或用 SendMessage 叫回已停下的 subagent |
| 助理 | 完成 | 名牌變「↳ ✓ 完成」、閒著不動，3 秒後走回電梯離開；主人資訊卡的那列變暗並標示「完成」，該員工下一個事件進來時移除 | 前景助理：同 `tool_use_id` 的 `PostToolUse`／`PostToolUseFailure`，或主 session 回合結束、送出新 prompt；背景助理（`run_in_background`）：同 `agent_id` 的 `SubagentStop` |

## 已知限制

**已驗證**（Claude Code 2.1.307，headless `-p` 實測）

- `PermissionRequest` 會觸發（順序是 `PreToolUse` → `PermissionRequest`）。`PreToolUse` 在權限判斷之前就觸發，所以要靠 `PermissionRequest` 才能把員工切到等你處理。
- `run_in_background` 的 Agent：`PostToolUse`（`status: "async_launched"`）與主 session 的 `Stop` 都早於助理真正結束，所以背景助理要等同 `agent_id` 的 `SubagentStop` 才算完成。
- 強制終止 Claude Code 行程時，收不到 `Stop` 與 `SessionEnd`，員工會留在辦公室，直到按「請他下班」或 12 小時後自動離開。

**未驗證**（需要互動式 session，headless 無法錄製）

- `Notification` 的權限提示：headless 模式完全沒有 `Notification` 事件。程式依官方 hooks 文件的 `notification_type` 判斷；沒有 `notification_type` 時才退回用訊息文字判斷。
- `AskUserQuestion`：headless 沒有這個工具。程式依工具名稱把它算成等你處理，並預期你回答後的 `PostToolUse` 讓員工回到工作中。
- Elicitation（MCP 輸入）：依官方 hooks 文件的事件與 `notification_type`（`elicitation_dialog`、`elicitation_url_dialog`）判斷。
- 按 Esc 中斷、直接關閉終端機視窗：會不會送出 `Stop`／`SessionEnd` 尚未確認。如果沒有送出，員工會停在原本的狀態，直到下一個事件、按「請他下班」，或 12 小時後自動離開。

**Windows**：hook 經由 Git Bash 執行，Git Bash 異常時 hook 會一起逾時（見「疑難排解」）。

細節見 `docs/findings.md`。

## 開發與測試

```
npm test            # vitest
npx tsc             # 編譯伺服器、hook、installer 到 dist/（含型別檢查）
npx tsc -p web      # 前端型別檢查（不輸出檔案）
npm run build       # tsc + tsc -p web + vite build
```

架構一行：hook 腳本（`src/hook/send.ts`）把事件 POST 給本機伺服器（`src/server`），狀態由 `src/state` 整理後推給瀏覽器，前端用 DOM 組出剖面大樓（`web/src`，沒有用 Phaser 或其他繪圖框架）。設定讀取在 `src/config.ts`，hook 安裝器在 `src/installer`。

前端模組（`web/src`）：

- `floors.ts`：不碰 DOM 的純函式，會不會畫錯的計算都在這裡（樓層與座位配置 `floorPlan`、助理座位 `assignAssistantSeats`、助理名單 `helperRoster`、電梯燈 `floorAlert`、邊緣提示 `edgeHints`、名牌文字 `plateText`、走路時間），尺寸常數 `GEO` 也在這裡，有 vitest 測試（`test/floors.test.ts`）。
- `building.ts`（整棟大樓、人物進出與重新連線）→ `floor.ts`（一層樓、左右捲與邊緣提示）→ `person.ts`（一個人：姿勢、走路、泡泡）；`elevator.ts` 是電梯面板，`door.ts` 是電梯門的開關計時，`card.ts` 是資訊卡，`main.ts` 負責狀態列與分頁標題，`sync.ts` 接伺服器的事件。
- `view.ts`：外觀雜湊、名牌文字、狀態列摘要、專案配色等小工具。
- 版面與配色的 CSS 在 `web/index.html`。

美術全是向量圖形，沒有使用外部圖檔：`web/src/flat.ts` 與 `web/src/furniture.ts` 是圖形清單（人物、正面桌子、正面家具、夜景窗），`web/src/clay.ts` 用 Canvas 2D 畫成黏土質感，`web/src/sprites.ts` 把它們烘成 `<img>` 並依 `devicePixelRatio` 取整數倍率、快取。想改外觀時：人物、髮色（`HAIR_COLORS`）、桌子在 `web/src/flat.ts`，家具、每層右端的家具組（`SETS`）與夜景窗在 `web/src/furniture.ts`，衣服配色（`PALETTE`）與專案配色（`PROJECT_COLORS`）在 `web/src/view.ts`，樓層與座位的尺寸在 `web/src/floors.ts` 的 `GEO`；改完執行 `npm run build`。
