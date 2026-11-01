# 拿掉電梯與走路：人在座位上登場、退場

日期：2026-11-01

取代：`2026-10-31-cutaway-building-design.md` 裡**樓層內部的電梯**、**人物動態的上班與下班**、**重新連線時「不播電梯與走路動畫」**，以及 `2026-11-01-simplify-design.md` 沿用的電梯進出動畫。電梯面板（左側固定的樓層按鈕）、樓層分配與順序、捲動錨定、狀態姿勢、資訊卡全部仍然有效。

## 意圖

使用者想讓系統之後好改、好維護，願意拿掉功能換簡單，但畫面要保留生命力。

- 電梯進出動畫是前端最複雜、又沒有測試的部分：門的排隊、人走出去時樓層要留著、走到一半被打斷、站起來與走路與開門關門的計時接力。
- 人不再走路之後，每層的電梯就沒有用處，一起拿掉。
- 生命力改由兩處提供：坐著時的狀態動作（不動），加上進出時一次播完的漫畫風效果。

## 非目標

- 不改伺服器 `src/`、`scripts/simulate.ts` 的事件。
- 不動左側電梯面板（`elevator.ts`、`#elevator`）的外觀、名稱與行為。
- 不動坐著時的狀態動作：工作中打字「噠噠」、等你處理站起來冒「！」、輪到你打瞌睡冒 zZ。
- 不特別處理「減少動態」：`person.ts` 不查 `reduceMotion()`；figure.css 既有的 `.person * { animation: none }` 自然會停掉子元素的動畫，貼紙照樣出現與消失。
- 不加 DOM 測試環境（happy-dom）。

## 1. 畫面

### 樓層

- 每層的電梯、門、門上的樓號都拿掉；樓號已寫在招牌「3F 專案名」上。
- 整層往左移 80px：招牌左緣 x 12、第一扇窗中心 300、座位 0 中心 60。招牌最大寬（到第一扇窗前）仍是 240。
- 樓層寬 = `max(可用寬, 座位數 × 120 + 200)`；可用寬的算法不變。
- 空大廳也拿掉電梯，只留中間的提示紙條。

### 登場

- 只在即時事件時播；打開頁面與重新連線（`reset`）時大家直接坐好，不播。
- 人直接出現在自己的座位，從小彈到稍大再回原尺寸，約 0.6 秒。
- 頭的右上方冒「到！」貼紙（和等你處理的「！」框同一區，不蓋到招牌），0.6 秒後消失。
- 這 0.6 秒只顯示「到！」；狀態漫符（噠噠、集中線與「！」、zZ 與泡泡）等貼紙消失才出現。姿勢與表情照目前狀態。

### 退場

- 一下班，桌子立刻變空桌、名牌消失（和現在相同，由 `vacate` 做）。
- 人留在原位，頭旁冒「辛苦了～」，帶速度線往上淡出，約 0.5 秒後移除。這 0.5 秒不顯示狀態漫符。
- 退場中的人滑鼠移上去不顯示資訊卡（座位已空，和現在走去電梯的人相同）。
- 那層最後一個人退場時，樓層等他淡出後才拆，拆樓的捲動錨定照現在的做法。
- 退場播到一半同一人又回到同一層：取消退場，直接留在座位上，不再播登場。回到不同層：舊人物移除，新的照登場規則出現。

## 2. 程式

### 刪除

- `web/src/door.ts`、`test/door.test.ts`。

### `web/src/person.ts`

- 刪除走路：`walkTo`、`at`、`moving`、`stop`、`walk`、`walkT`，以及對 `walkMs`／`walkPos`／`reduceMotion` 的 import。
- `placeAt(x)` 保留，只設 `left`。
- `Act` 剩 `'work' | 'up' | 'idle'`。
- 新增：
  - `ENTER_MS = 600`、`EXIT_MS = 500`（figure.css 的 keyframes 註明同值）。
  - `enter()`：設 `data-fx="in"`，`ENTER_MS` 後刪掉 `data-fx`。
  - `exit(done)`：設 `data-fx="out"`，`EXIT_MS` 後呼叫 `done`。
  - `cancelExit()`：清計時器、刪掉 `data-fx`。
  - `destroy()`：清計時器並移除元素。
- 同一個人物同時只有一個效果計時器；新的效果會取消舊的。

### `web/src/building.ts`

- `Rec` 剩 `{ p, floor, emp }`；`Leaving` 剩 `{ emp, p, floor }`。
- 刪除 `enter`、`walk`、`STAND_MS`。
- `placePeople`：新來的人直接 `append` 到該層並 `placeAt(seatCenter)`；`animate` 為真時呼叫 `p.enter()`。換樓層（同一人換到別層）直接搬過去放好。每次都 `settle`（`setAct`）。
- `leave(id)`：從 `people` 移到 `leaving`，呼叫 `p.exit(() => { 仍是同一趟才 destroy、從 leaving 刪掉、render })`。
- `comeBack(id, key)`：`leaving` 裡有且同一層 → `cancelExit()`，沿用原人物；不同層 → `destroy`，回傳沒有。
- `clearPeople`：拿掉關電梯門；其餘不變。
- `withLeaving`、`vacate`、`buildingPlan` 不變。

### `web/src/floor.ts`

- 刪除電梯元素、門、`door-num`、`ElevatorDoor`、`doorX`、`openDoor`、`shutDoor`；`destroy` 只移除元素。
- `lobby()` 不再放電梯。

### `web/src/floors.ts`、`web/src/furniture.ts`

- `GEO.elevatorW` 刪除；`seatCenter(i) = i × 120 + 60`；`buildingWidth` 少加 80。
- 刪除 `DOOR_X`、`WALK_SPEED`、`walkMs`、`Walk`、`walkPos`。
- `SIGN_X` 92 → 12；`WIN.first` 380 → 300；`SIGN_MAX_W` 由兩者算出，仍是 240。

### `web/src/figure.ts`、`web/src/styles/figure.css`

- 人物 SVG 加兩組漫符：`fx-in`（「到！」貼紙）、`fx-out`（「辛苦了～」貼紙與往上的速度線），平時 `display: none`。
- `FX_BOXES` 加 `in`、`out` 兩項外框。
- CSS：
  - `data-fx="in"`：顯示 `fx-in`，整張人物 SVG（`.figure`，含椅背）播彈出 keyframes。
  - `data-fx="out"`：顯示 `fx-out`，`.figure` 播往上淡出 keyframes。
  - keyframes 放在 `.figure` 而不是 `.fig`：`.fig` 已用 `transform` 做站起來的上移（等你處理），兩者不能互相蓋掉。
  - `data-fx` 存在時藏起 `fx-work`、`fx-wait`、`fx-turn`。
  - 動畫放在 `.person` 的子元素上（不放 `.person` 本身），才會被既有的減少動態規則一起停掉。
- 刪除 `walk`、`stand` 的姿勢、表情與走路動畫規則。

### `web/src/styles/building.css`、`theme.css`

- 刪除 `.elevator`、`.door`、`.door-num` 的規則，以及減少動態區塊裡關於門的那條。
- `.lobby-msg` 的 `left` 改 0。
- 刪除 `--door` 變數；`--elevator` 保留（屋頂水塔與冷氣機在用）。

### 文件

- README：「員工在這些時候走回電梯下班」改成「下班」，其餘提到電梯進出的地方改成登場與退場；檔案表刪掉 `door.ts`。
- `2026-10-31-cutaway-building-design.md` 開頭加註：電梯與走路已由本文件取代。

## 3. 測試與驗證

- 刪除：`test/door.test.ts`；`floors.test.ts` 裡 `walkMs`、`walkPos`、`DOOR_X` 的測試。
- 修改：
  - `floors.test.ts`：`seatCenter`、`buildingWidth` 的期望值改成沒有電梯寬；`withLeaving`、`vacate` 照留。
  - `furniture.test.ts`：第一扇窗 300、`SIGN_MAX_W` 仍 240；窗景寫死 x 的期望值跟著窗位調整。
  - `figure.test.ts`：刪掉 `walk`、`stand` 的斷言。
- 新增（`figure.test.ts`）：
  - `FX_BOXES.in`、`FX_BOXES.out` 的頂端不高於招牌底（和現在檢查「！」框同一條線），右緣不超過座位右界。
  - CSS 裡 `data-fx` 存在時藏起三種狀態漫符。
- 不自動測：`person.ts` 的效果計時與 `building.ts` 的退場流程要碰 DOM，vitest 沒有 DOM 環境。
- 完成後 `npm test`、`npm run build` 都通過，並用 `npm run simulate` 在瀏覽器看（白天、夜晚各一次）：
  - 登場彈出、冒「到！」，貼紙消失後才出現狀態漫符。
  - 退場冒「辛苦了～」、速度線淡出。
  - 最後一人下班，樓層等他淡出才拆。
  - 樓層左邊沒有電梯，招牌、窗、桌子左移，左側電梯面板照常。
