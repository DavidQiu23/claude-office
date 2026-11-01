# 簡化：助理不佔座位、拿掉邊緣提示與樓層捲動、整理文件與重複程式碼

日期：2026-11-01

取代：`2026-10-21-claude-office-design.md`、`2026-10-31-cutaway-building-design.md`、`2026-11-01-manga-paper-redesign-design.md` 裡**助理的座位與人物**、**邊緣提示**、**樓層左右捲動**三部分。其餘規則（狀態、樓層分配與順序、電梯進出、日夜、資訊卡、捲動錨定）全部仍然有效。

## 意圖

使用者想讓系統之後好改、好維護，願意為此犧牲一部分畫面。討論後只拿掉兩項功能，其他照舊：

- **助理不再是獨立人物**：前端為了讓助理坐桌子、完成後停留再走回電梯，有一整套座位分配與名單追蹤，是前端最複雜的部分之一。
- **畫面上「哪裡需要你」的提示有四種**（狀態列、分頁標題、電梯燈號、邊緣提示）。拿掉邊緣提示，連帶拿掉它存在的理由：每層各自左右捲動。

另外做不改行為的整理：刪掉過時的設計文件、合併重複的 SVG 小工具、併掉只剩一個使用者的小檔。

## 非目標

- 不改伺服器 `src/`：助理照樣由 reducer 記在 `Employee.assistants`，`scripts/simulate.ts` 照樣派助理。
- 不動電梯進出動畫、日夜主題、樓層順序穩定與捲動錨定、狀態列、電梯面板、分頁標題、資訊卡的其他內容。
- 不拿掉 hook 的 `--record` 錄製模式：`docs/findings.md` 還有 Notification、AskUserQuestion 等未驗證的項目，之後補錄要用它。

## 1. 助理不佔座位

### 畫面

- 助理不再有人物、桌子、名牌。座位只坐真員工。
- 主人的名牌右邊多一個小標「↳N」，N = 主人 `assistants` 裡 `status === 'working'` 的數量；N 為 0 時不顯示。小標不被名牌文字的「…」截掉（名牌文字縮，小標不縮）。
- 助理的詳細資料只在主人的資訊卡：現有的「助理 · N」清單不變（類型、描述、工作中／完成，最多 4 列，其餘併一行）。
- 助理完成時小標數字立刻減少；不再有「↳ ✓ 完成」停留 3 秒、走回電梯。
- 電梯燈號、狀態列、分頁標題原本就不算助理，不變。

### 程式

- `web/src/floors.ts`
  - 刪除 `Helper`、`helperKey`、`HelperTrack`、`Roster`、`helperRoster`、`HELPER_LINGER`、`assignAssistantSeats`。
  - `Occupant` 型別刪除，`Seat.occ` 改為 `Employee | null`。
  - `floorPlan(employees, minDesks, prevOrder)`：桌數 = max(最大座位 + 1, minDesks)。
  - `buildingPlan(employees, going, minDesks, prevOrder)`：回傳 `{ plan, minDesks }`。
  - `plateText(e)` 回傳 `{ text, tone, helpers }`：`helpers` 是工作中助理數；`PlateTone` 剩 `working | waiting | idle`。
  - `floorAlert` 不必再排除助理。
- `web/src/building.ts`：刪除 `helpers` 群、`track`、`gone`、`helperSeats`、`lingerT`、`rollCall`、`ownerOf`。只剩員工一群，`Crowd` 抽象攤平成 `people` 與 `leaving` 兩個 Map；`same` 改成比對員工物件；`settle` 只處理員工。
- `web/src/floor.ts`：`deskState`、`occKey` 只處理員工（`occKey` 刪掉，直接用 `sessionId`）；名牌裡加小標元素，`helpers` 為 0 時藏起來。
- `web/src/card.ts`：刪除 `showHelper`、`fillHelper`、`helper` 欄位、`HELPER_STATUS`；hover 只會是員工。
- CSS：刪除 `.plate.assistant`、`.plate.done`、`.person[data-kind="assistant"]`；新增名牌小標樣式（墨線小圓角框，配色沿用原本助理名牌的綠）。

## 2. 拿掉邊緣提示與樓層左右捲動

### 畫面

- 所有樓層同寬：`width = floorWidth(全部樓層裡最多的桌數, 可用寬)`。可用寬的算法不變（視窗寬 − 左邊電梯面板 − 右邊距）。
- 桌子放不下時整頁由瀏覽器橫向捲動；天空、屋頂、樓層、地面一起變寬（`body` 的最小寬度跟著樓層寬）。電梯面板固定在左側，不受影響；狀態列寬度維持視窗寬，橫向捲動時釘在左邊、整條看得到。
- 點電梯面板按鈕只上下捲到那層，不改變橫向捲動位置。
- 看不到的員工在等你時，不再有「! N」「✓ N」提示；由電梯燈號、狀態列、分頁標題告訴你。
- 沒人時的空大廳照舊撐滿可用寬。

### 程式

- `web/src/floor.ts`：刪除 `EdgeBtn`、左右暗影、`floor-scroll` 捲動容器、`refreshEdges`、`schedule`、`scrollToSeat`、`ResizeObserver` 與 rAF；`update(f, width)` 直接收樓層寬。
- `web/src/floors.ts`：刪除 `edgeHints`、`EdgeHint`。
- `web/src/building.ts`：`layoutFloors` 先算全部樓層共用的寬度，傳給每層，並設定 `body` 的最小寬度與狀態列寬度。視窗寬變化時重算的 `ResizeObserver` 保留，改觀察 `<html>`（樓層變寬後 `.floors` 不再跟著視窗變）。
- CSS：刪除 `.floor-scroll`、`.shade`、`.edge-hint` 相關規則。
- 頁面捲動時藏起資訊卡的處理不變（橫向捲動也會觸發）。

## 3. 整理（行為不變）

### 文件

保留（仍描述現行系統，搭配本文件閱讀）：

- `specs/2026-10-21-claude-office-design.md`
- `specs/2026-10-30-your-turn.md`
- `specs/2026-10-31-cutaway-building-design.md`，與 `specs/assets/2026-10-31-building-*.html`
- `specs/2026-11-01-manga-paper-redesign-design.md`，與 `specs/assets/2026-11-01-manga-paper-final.html`
- `docs/findings.md`

刪除（已放棄的畫風、已撤回的動作、已執行完的計畫；git 歷史仍找得到）：

- `specs/2026-10-21-flat-vector-project-islands-design.md`、`specs/2026-10-22-vector-office-design.md`
- `specs/2026-10-29-iso-office-objects-design.md`、`specs/2026-10-29-iso-office-slanted-desk.md`、`specs/2026-10-29-isometric-office-design.md`、`specs/2026-10-30-iso-office-modern-desk.md`
- `specs/2026-11-01-figure-actions-design.md`
- `specs/assets/flat-shapes.js`、`specs/assets/office-shapes.js`
- `plans/` 底下全部 7 份計畫

### 程式

- `web/src/figure.ts` 與 `web/src/objects.ts` 各自定義的 `rect`、`circle`、`ellipse`、`path`、`line`、`fill` 移到 `web/src/svg.ts`，兩邊改用同一份。兩份的參數若有差異（例如 `line` 是否收 `style`），取較寬的那個版本，輸出的 SVG 字串不變。
- `web/src/motion.ts`（`reduceMotion`）保留：拿掉邊緣提示後 `person.ts` 與 `elevator.ts` 仍在用。

## 測試

- 改寫：`test/helpers.test.ts`（原本測助理座位與名牌的整條流程）改成 reduce → `plateText` 的小標數字串接測試，含背景助理在主人 Stop 後仍算數。
- 刪除：`test/floors.test.ts` 裡 `assignAssistantSeats`、`helperRoster`、`edgeHints`、助理名牌與助理座位相關的測試。
- 修改：`floorPlan`、`buildingPlan`、`floorAlert`、`plateText` 的測試改成新的參數與回傳。
- 新增：
  - `plateText` 的 `helpers`：沒有助理 0；兩位工作中、一位完成 → 2。
  - 共用樓層寬：兩層桌數不同時，兩層拿到同一個寬度，等於桌數多的那層所需寬與可用寬的較大者。
- `figure.test.ts`、`objects.test.ts` 確認合併 SVG 小工具後輸出不變。
- 後端測試（`reduce`、`server`、`fixtures-replay` 等）不受影響，照跑。
- 完成後 `npm test` 與 `npm run build` 都要通過，並用 `npm run simulate` 在瀏覽器看一次：助理小標會增減、窄視窗下整頁橫向捲動、各層同寬。

## README

- 「助理（subagent）」一段改寫：名牌旁「↳N」小標、詳細在資訊卡。
- 「畫面上的其他東西」刪除「邊緣提示」，樓層一項補上「桌子放不下時整頁橫向捲動」。
- 「開發」的檔案表：`floors.ts` 的描述拿掉「邊緣提示」。
- 「示範」一段的「助理」描述跟著改。
