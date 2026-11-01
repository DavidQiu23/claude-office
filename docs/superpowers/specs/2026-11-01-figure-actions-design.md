# 人物動作：依工具換動作、等待小動作、歡呼與交文件（子專案 2）

日期：2026-11-01

建立在 `2026-11-01-manga-paper-redesign-design.md`（子專案 1）之上：人物是行內 SVG 部件（`web/src/figure.ts`，群組 `fig`、`arm-l`、`arm-r`、`head`、`fx-*` 等），姿勢由 `.person` 的 `data-act` 加 CSS 動畫控制。子專案 1 的姿勢、漫符、減少動態規則、座標全部仍然有效，本文件只在上面加東西。`2026-10-30-your-turn.md` 的狀態規則仍然有效。

## 意圖

現在每個人只有三種樣子（工作中打字、等你處理舉手、輪到你打瞌睡），看不出 Claude 正在做什麼。這次讓人物：

- **工作中依工具換動作**：讀檔或搜尋程式碼就翻文件、編輯就打字、跑指令就盯著螢幕上的綠字、上網就轉地球儀、派助理就打電話、剛送出 prompt 還沒用工具就托下巴思考。
- **等待時有小動作**：輪到你時伸懶腰、喝咖啡、滑手機、打瞌睡輪流換；等你處理時舉手、揮手、跳一下輪流換，一律站著、手舉高，所以「誰在等你」仍然一眼看得出來。
- **完成時歡呼一次**，**助理做完後拿文件走到主人桌前再離開**。

核心需求不變：打開畫面最想一眼知道「有哪些專案」與「哪些 session 在等我」。動作是在這個前提下多給一點資訊與趣味，不能蓋過狀態。

### 不做

- 走去飲水機或其他家具（物件表的「站位」先不用）。
- 助理依自己用的工具換動作：subagent 內部事件不追蹤，助理工作中照子專案 1 一律打字。
- 主人接文件的反應。

## 分工

伺服器只回報事實，時間都由前端控制：

- **伺服器**：員工資料加 `toolKind` 欄位，每個事件都如實更新，沒有計時器、不防抖。`reduce` 維持純函式。
- **前端**：每個人物自己決定目前演哪個動作，負責「最短維持 1.5 秒」、等待小動作的輪替、歡呼、交文件。資訊卡、分頁標題、狀態列不受這些延遲影響。

不在伺服器做防抖，是因為「最短維持時間」純粹是畫面上的考量，放在伺服器會讓所有畫面一起變慢，`reduce` 也得加計時器。也不另外送「完成」事件：upsert 已經帶了狀態，前端比對前後就夠了。

實作分兩階段：伺服器欄位（含測試）可以先做；前端要等子專案 1 合併到 main 之後，另寫實作計畫。

## 伺服器資料

### 欄位

`src/state/types.ts`：

```ts
export type ToolKind = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'think' | 'other';

export interface Employee {
  // …既有欄位
  activity: string | null;
  toolKind: ToolKind | null;   // 正在用的工具類型；剛送出 prompt 或工具剛用完是 think，閒置是 null
}
```

`toolKind` 只在 `status === 'working'` 時有意義。等你處理、輪到你的姿勢由 `status` 決定，前端不看這個欄位。

### 工具名稱對應

`src/state/describe.ts` 新增 `toolKindOf(toolName: string): ToolKind`：

| 工具名稱 | `toolKind` |
|---|---|
| `Read`、`Grep`、`Glob`、`LS` | `read` |
| `Edit`、`MultiEdit`、`Write`、`NotebookEdit`、`TodoWrite` | `edit` |
| `Bash`、`BashOutput`、`KillShell` | `run` |
| `WebSearch`、`WebFetch` | `web` |
| `Task`、`Agent`（`isSubagentTool`） | `agent` |
| 其他（MCP 工具、`Skill` 等），包括空字串 | `other` |

`think` 不從工具名稱來，只由事件設定（見下）。

### 何時設定與清除

只看最上層事件（沒有 `agent_id`）；subagent 內部事件與現在的 `activity` 一樣不動它。比目前狀態更舊的事件（`reduce` 裡的 `fresh` 為假）也不動它。

| 事件 | `toolKind` |
|---|---|
| 新進員工（第一次看到這個 session） | `null` |
| `UserPromptSubmit` | `think` |
| `PreToolUse` | `toolKindOf(tool_name)`；但 `AskUserQuestion` 不動（這時是等你處理） |
| `PermissionRequest` | 不動 |
| `PostToolUse`、`PostToolUseFailure` | `think`（Claude 在想下一步） |
| `Stop`、`StopFailure` | `null` |
| 其他事件（`Notification`、`Elicitation`、`ElicitationResult`、`SubagentStop` 等） | 不動 |

`activity` 的規則不變：工具用完之後資訊卡仍顯示上一個工具的描述，而 `toolKind` 已經回到 `think`。兩者用途不同，資訊卡講「最近做了什麼」，人物演「現在在幹嘛」。

## 前端：結構

- 子專案 1 的 `data-act`（`work`、`up`、`idle`、`walk`、`stand`）與它的 CSS 不改。`.person` 另外加 `data-pose` 屬性表示細部動作，CSS 以 `[data-act][data-pose]` 組合選擇。
- 人物 SVG 加上道具與漫符群組，平常隱藏，由 `data-pose` 決定顯示哪些：
  - 道具：`prop-doc`（胸前的文件）、`prop-mobile`（胸前的手機）、`prop-globe`（桌上的地球儀），以及放在手臂群組裡、跟著手臂轉的 `prop-handset`（左臂，電話聽筒）、`prop-mug`（右臂，咖啡杯）、`prop-sheet`（右臂，遞出去的文件）。
  - 漫符：`fx-read`、`fx-run`、`fx-think`、`fx-call`、`fx-cheer`。
- 新的顏色變數 `--code`（綠字），日夜各一個值，夜晚要夠亮。
- **角度的正負**：SVG `rotate` 的度數，正值是畫面上的順時針。手臂下垂時，右臂（畫面右側）轉正值是往身體中間擺，轉負值是往外擺；左臂相反。轉軸在肩膀。
- 桌子疊在人物上面，所以人物 SVG 裡畫在桌面以下或螢幕位置的東西會被擋住。
- 所有道具與漫符都在座位中心 ±60 的範圍內（同子專案 1），以 crm 那層坐滿 8 人的畫面驗證。
- 動畫全部是 CSS `transform`／`opacity`。

`data-pose` 的值：

| `data-act` | `data-pose` |
|---|---|
| `work` | `read`、`edit`、`run`、`web`、`agent`、`think` |
| `idle` | `stretch`、`coffee`、`phone`、`doze`、`cheer` |
| `up` | `raise`、`wave`、`hop` |
| `stand` | `deliver`（只有助理） |
| `walk` | 不設 |

## 前端：工作中的動作

`toolKind` 對應到 `data-pose`；`other` 與 `null` 都用 `edit`。

| `data-pose` | 部件姿勢 | 道具／漫符 | 週期 |
|---|---|---|---|
| `read` | 左臂 −30°、在胸前拿文件；右臂在 20° 和 60° 之間來回翻頁；頭低 4° | `prop-doc`；`fx-read`「沙沙」效果字每 1.2s 閃一次 | 1.2s |
| `edit` | 子專案 1 原本的 `work`：兩手輪流上下 3px | 子專案 1 的「噠噠」與動態線 | 0.42s |
| `run` | 兩手放在桌上不動，頭往螢幕方向轉 8° | `fx-run`：螢幕正上方一個深色小框，三行 `--code` 綠字往上捲（螢幕本身被桌子擋住，畫不到） | 0.9s |
| `web` | 左手撥桌上左側的地球儀，左臂在 40° 和 60° 之間擺動 | `prop-globe`（半徑 7）：經線左右平移，看起來在轉 | 手 0.6s，經線 1.2s |
| `agent` | 左臂舉到 158°，手和聽筒在頭的左外側 | `prop-handset`；`fx-call`「嘟嚕嚕」小字在頭旁閃動 | 0.5s |
| `think` | 右臂 120°，手托下巴；頭歪 6° | `fx-think`：頭右上方三顆小圓點依序出現 | 1.5s |

「噠噠」只在 `edit` 顯示。

### 最短維持 1.5 秒

- 每個人物記住目前的工作 pose 與開始時間。
- 新的工作 pose 進來時：已經演滿 1.5 秒就立刻換；還沒滿就排隊，到 1.5 秒時換成**排隊中最新的那一個**，中間的直接跳過。例如讀檔 → 編輯 → 跑指令都在 0.3 秒內發生，畫面上會是讀檔演滿 1.5 秒，接著直接跳到跑指令。
- 這個規則只管工作中的細部動作。狀態改變（變成等你處理、輪到你，或開始走路）立刻生效，同時清掉排隊；因為「等你處理」必須馬上看得到。
- 從其他狀態回到工作中時，第一個工作 pose 立刻生效，重新開始計時。

## 前端：等待時的小動作

### 輪到你（`idle`）

子專案 1 的琥珀打勾泡泡一直顯示；「z」「Z」只在 `doze` 顯示；閉眼只在 `doze`（以及歡呼），其他三個是一般的睜眼。

| `data-pose` | 姿勢 | 道具／漫符 | 週期 |
|---|---|---|---|
| `stretch` | 兩臂往外舉高（左臂 165°、右臂 −165°）、身體往上 2px，再放下，停 1s | 無 | 3s |
| `coffee` | 右手拿杯子到嘴邊（右臂 100°），再放回桌上 | `prop-mug`，杯口冒蒸氣 | 2.4s |
| `phone` | 兩手在胸前拿手機（左臂 −30°、右臂 30°），頭低 6° | `prop-mobile`，螢幕一閃一閃 | 1.2s |
| `doze` | 子專案 1 的閉眼點頭 | 「z」「Z」往上飄 | 2.6s |

### 等你處理（`up`）

一律站著、右手舉高；子專案 1 的集中線、「！」框、汗滴、睜圓的眼睛照舊。

| `data-pose` | 姿勢 | 週期 |
|---|---|---|
| `raise` | 右臂停在 180°，不揮動 | 靜止 |
| `wave` | 子專案 1 的揮手（160°–195°） | 0.8s |
| `hop` | 手舉著，整個人往上跳 6px 兩下，接著停 | 1.2s |

### 輪替規則

- 一進入輪到你或等你處理，就從該組隨機挑一個。
- 每個小動作維持一段隨機時間：輪到你 6–10 秒、等你處理 3–5 秒（均勻分布）；時間到就換成同組裡**不同於目前**的另一個。
- 狀態一變就立刻換成新狀態的那一組，並重新隨機挑。
- 每個人物各自計時，同一層的人不會同步動作。
- 助理不參與（助理不舉手、沒有泡泡，同子專案 1）。

## 前端：歡呼

- **觸發**：前端收到某位員工的 upsert，前一筆是 `working`、這一筆是 `idle`。
- **不觸發**：頁面打開或重新連線時拿到的初始資料；`waiting → idle`；助理。
- **動作**：`data-act="idle"`、`data-pose="cheer"`，坐著，演 1 秒：兩臂往外高舉成 V 字（左臂 160°、右臂 −160°）、身體往上彈 4px 一次、閉眼笑（`face-turn`）、頭上冒「耶！」效果字（`fx-cheer`），打勾泡泡同時出現。之後進入輪到你的輪替。放在 `idle` 底下，是因為歡呼結束時只換 `data-pose`，不必再改 `data-act`。
- 歡呼不受 1.5 秒規則限制，一觸發就開始。
- 這 1 秒裡狀態又變了（例如馬上送出新 prompt），立刻中止歡呼、改演新狀態。

## 前端：助理交文件

- **觸發**：助理在 `helperRoster` 裡第一次被看到 `done`（`doneAt` 設定的那一刻）。
- **流程**：
  1. 站起來（子專案 1 的過場 300ms）。
  2. 走到主人桌子左側的站位（主人座位中心 x − 50），走路速度照現有的 `WALK_SPEED`。
  3. 停 1 秒：`data-act="stand"`、`data-pose="deliver"`，右臂往右平伸（−80°）、手上拿著 `prop-sheet`。
  4. 收起文件，走回電梯離開（照現有的離開流程）。
- 現在完成後固定停 3 秒的 `HELPER_LINGER`，改成以「交完文件」為準：前端在助理交完時記下來，`helperRoster` 看到才讓他離開名單。另設安全上限 `HELPER_MAX_LINGER = 20000`ms：遞文件一直被打斷，或找不到主人的座位，最晚 20 秒也會離開。
- 遞文件途中座位被重排（有助理加入或離開）：取消這次遞文件，先走回新座位，到了再重新出發。
- 主人已經不在了（下班或樓層拆掉），就跳過 2、3，直接走去電梯。
- 主人這邊不做反應，主人的姿勢照自己的狀態。

## 減少動態

`@media (prefers-reduced-motion: reduce)` 時，除了子專案 1 的規則（動畫與過場停止、漫符停在可見的那一格、走路直接放到目的地）之外：

- **不輪替**：輪到你固定 `doze`（跟子專案 1 的靜態畫面一致），等你處理固定 `raise`。
- **不歡呼**：工作中直接變成輪到你。
- **工作中的 pose 照樣依工具切換**，因為它表達了在做什麼，但是不動；1.5 秒規則照舊，避免靜態圖閃來閃去。
- **助理交文件**：直接出現在主人桌旁、`deliver` 停 1 秒，然後直接回到電梯離開。

前端用 `matchMedia('(prefers-reduced-motion: reduce)')` 判斷，輪替與歡呼的計時器在這個情況下不啟動。

## 測試

### 伺服器（這次實作）

- **`describe.test.ts`**：`toolKindOf` 把表格裡每個工具名稱對應到正確的值；不認得的名稱（`mcp__foo__bar`、`Skill`、空字串）都是 `other`。
- **`reduce.test.ts`**：
  - 新進員工 `toolKind` 是 `null`。
  - `UserPromptSubmit` → `think`；`PreToolUse` Read → `read`、Edit → `edit`、Bash → `run`、WebFetch → `web`、Agent → `agent`、MCP 工具 → `other`。
  - `PostToolUse` 與 `PostToolUseFailure` → `think`；`Stop` 與 `StopFailure` → `null`。
  - `PreToolUse` `AskUserQuestion`、`PermissionRequest` 不改 `toolKind`。
  - 帶 `agent_id` 的事件不改 `toolKind`。
  - 較舊的事件不改 `toolKind`。
- **`fixtures-replay.test.ts`**：重播真實事件後，`toolKind` 跟 `activity` 一樣，不受 subagent 內部事件影響；`Stop` 之後是 `null`。
- 既有測試全部照樣通過；`npm run build` 成功（`web/` 的 tsconfig 也包含 `src/state`）。

### 前端（之後另寫計畫）

- 單元測試（純函式，node 環境）：
  - `poseFor(toolKind)` 對應表。
  - 1.5 秒排隊邏輯：抽成純函式（輸入目前 pose、開始時間、新 pose、現在時間，輸出要立刻換或排到何時），測「已滿立刻換」「未滿排隊」「排隊只留最新」「狀態改變清掉排隊」。
  - 輪替挑選：注入亂數，測「不會跟目前的重複」「維持時間在範圍內」。
  - 歡呼觸發：`working → idle` 觸發，`waiting → idle`、初始資料、助理不觸發。
  - `helperRoster`：助理完成後，交完文件才離開名單；超過 `HELPER_MAX_LINGER` 也會離開；主人不在時直接離開。
  - `PoseDriver`（不碰 DOM、用假計時器測）：重複呼叫同一個狀態不重來；歡呼中呼叫 `idle` 不打斷。
  - `figure.test.ts`：新的道具與漫符群組都存在，座標在 x −30 到 90 之內，沒有用屬性寫顏色。
- 瀏覽器檢查（用 `npm run simulate`，白天與夜晚各走一次）：
  1. 六種工作動作都看得到，快速連續換工具時不閃。
  2. 輪到你、等你處理的小動作會輪流換，同一層的人不同步；等你處理一律站著、手舉高。
  3. 工作中變成輪到你時歡呼一次。
  4. 助理完成後走到主人桌旁遞文件，再走回電梯。
  5. crm 那層坐滿 8 人時，道具與漫符沒有蓋到隔壁的人或名牌。
  6. 開啟「減少動態」後，所有小動作停住，狀態仍看得出來；沒有歡呼。
  7. console 沒有錯誤。

## 留給實作者的部分

- 道具（文件、地球儀、聽筒、杯子、手機）與漫符的確切路徑（大略位置見實作計畫 `docs/superpowers/plans/2026-11-01-figure-actions.md`），遵守子專案 1 的漫畫畫法與配色規則。
- 各姿勢的關鍵影格細節（上面的角度與位移是目標，可依畫面微調 ±20%）。
- `--code` 的確切色值。
