# 2.5D 等角辦公室 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Phaser 辦公室從俯視平面畫面整個換成 2.5D 等角畫面，版面邏輯不動，頭上不放文字，小幫手只出現在資訊卡。

**Architecture:** `view.ts` 照舊算地板座標（px）；新增 `web/src/iso.ts` 做「地板座標 → 世界畫面座標」投影與鏡頭計算，K 固定為 1，所有縮放交給 Phaser 相機。等角素材（桌子、房間）仍是 `flat.ts` 的圖形清單，用現有 `drawShapes` / 烘貼圖流程。`OfficeScene` 的人物改成「位置存在地板座標、每次移動後投影」。

**Tech Stack:** TypeScript、Phaser 3.90、Vite、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-29-isometric-office-design.md`（實作前必讀；設計稿 13、14、17 在 claude.ai artifact `P3nBrZxz9wgvDNEXzKgwci`）。

## Global Constraints

- 開工前工作區要乾淨：`src/state/reduce.ts`、`test/reduce.test.ts` 有不屬於本計畫的未 commit 修改，先問使用者要 commit 還是收起來，不要混進本計畫的 commit。
- 不改 `layout`、`columnsFor`、`seatCell`、`entryPath`、`waitingCount`、`nameplate`、`fitText`、`fitMiddle` 的行為。
- `src/state` 只新增助理類型欄位，其他不動。
- commit 訊息用繁體中文，保留 `feat:`/`fix:`/`docs:`/`refactor:`/`test:` 前綴，**不加** Co-Authored-By、Claude-Session、Generated with 之類的 trailer；對上一個 commit 的修正用 `--fixup` 併回，不單獨 commit。
- 畫面文字一律繁體中文；資訊卡內容一律用 `textContent` / DOM 建立（現有規則）。
- 投影：`screen = { x: fx − fy, y: (fx + fy) / 2 − z }`，`depth = fx + fy`（K = 1，比例 2:1）。
- 狀態燈顏色沿用 `LED`；等你處理的桌面偏紅（`mix('#e0a96d', '#ff4d4d', 0.3)`，同現有 `desk()`）。
- 每個 task 結束前 `npx vitest run` 全綠、`npm run build` 成功。

## Review Focus

- 標題很長（24 字中文）加上長動作的名牌：不能超過 `PLATE_MAX`，相鄰座位名牌不能疊在一起 — Task 4 的 `plateLabel` 測試。
- 專案名稱很長、島只有 1 桌：地上招牌字縮到 12 仍放不下時中間截斷，不伸進右邊鄰島 — Task 4 的 `signFit` 測試。
- 一個人都沒有（`islands` 為空）：鏡頭不能算出 NaN / 0 縮放，「目前沒有人上班」置中可見 — Task 2 的 `fitCamera` 測試。
- 員工走到一半時版面重排（新專案加入、島搬動）：人要從目前地板位置改走新路線，不能瞬移到舊座標的投影位置 — Task 7 的手動驗證步驟。
- 舊資料或 `SendMessage` 叫回的助理沒有類型：資訊卡那一行不顯示類型小標，不顯示 `undefined` — Task 1、Task 5 的測試。

---

### Task 1: 助理記下類型

**Files:**
- Modify: `src/state/types.ts:20-27`
- Modify: `src/state/reduce.ts:94-102`
- Test: `test/reduce.test.ts`（若 `test/fixtures-replay.test.ts` 的快照因新欄位改變，一併更新）

**Interfaces:**
- Produces: `Assistant.kind?: string` — `PreToolUse` 的 `tool_input.subagent_type`（非空字串才記）。

- [ ] **Step 1: 寫失敗測試** `test('PreToolUse 建立助理時記下 subagent_type', ...)`：送一個 `tool_name: 'Agent'`、`tool_input: { description: 'x', subagent_type: 'Explore' }` 的 PreToolUse，斷言 `assistants[0].kind === 'Explore'`；再送一個沒有 `subagent_type` 的，斷言 `'kind' in assistants[1] === false`。
- [ ] **Step 2: 執行** `npx vitest run test/reduce.test.ts`，預期新測試 FAIL。
- [ ] **Step 3: 實作**：`types.ts` 的 `Assistant` 加 `kind?: string; // subagent_type，例如 Explore、Plan；沒給就不記`；`reduce.ts` 建立助理時照 `background` 的寫法條件展開 `...(typeof e.tool_input?.subagent_type === 'string' && e.tool_input.subagent_type ? { kind: e.tool_input.subagent_type } : {})`。`SendMessage` 叫回的那一支不加。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠（快照有變就確認差異只多了 `kind` 再更新）。
- [ ] **Step 5: Commit** `feat: 助理記下 subagent 類型`

### Task 2: 等角投影與鏡頭

**Files:**
- Create: `web/src/iso.ts`
- Test: `test/iso.test.ts`

**Interfaces:**
- Produces:
  - `toScreen(fx: number, fy: number, z?: number): Pt` — 上面的投影公式。
  - `isoDepth(fx: number, fy: number): number` — `fx + fy`。
  - `HEAD_Z = 110` — 人頭頂的高度（世界座標），鏡頭範圍要包含。
  - `islandsBounds(islands: Island[]): { x: number; y: number; w: number; h: number } | null` — 每座島的地板矩形往後擴 60、往左右擴 40、往前擴 70（前方要容納名牌與地上招牌），後兩角加上 `HEAD_Z`，投影後取外框；沒有島回傳 `null`。
  - `fitCamera(b: {x,y,w,h} | null, viewW: number, viewH: number, maxZoom: number): { zoom: number; cx: number; cy: number }` — `zoom = min(maxZoom, viewW / b.w, viewH / b.h)`，`(cx, cy)` 是 `b` 的中心；`b` 為 `null` 時回傳 `{ zoom: 1, cx: toScreen(BASE_W/2, BASE_H/2).x, cy: toScreen(BASE_W/2, BASE_H/2).y }`。

- [ ] **Step 1: 寫失敗測試**：
  - `toScreen(100, 0)` → `{x: 100, y: 50}`；`toScreen(0, 100)` → `{x: -100, y: 50}`；`toScreen(10, 10, 30)` → `{x: 0, y: -20}`。
  - `isoDepth(3, 4) === 7`。
  - `islandsBounds([])` 為 `null`；一座 `{x:40,y:96,w:316,h:160}` 的島，外框包含 `toScreen(40, 96, HEAD_Z)` 與 `toScreen(356+40, 256+70)`。
  - `fitCamera(null, 1280, 720, 2.5)` 的 `zoom` 為 1 且 `cx`、`cy` 是有限數字；`fitCamera({x:0,y:0,w:640,h:360}, 1280, 720, 2.5).zoom === 2`；`fitCamera({x:0,y:0,w:100,h:100}, 1280, 720, 2.5).zoom === 2.5`。
- [ ] **Step 2: 執行** `npx vitest run test/iso.test.ts`，預期 FAIL（模組不存在）。
- [ ] **Step 3: 實作** `web/src/iso.ts`（只 import `view.ts` 的型別與 `BASE_W`/`BASE_H`）。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠。
- [ ] **Step 5: Commit** `feat: 等角投影與鏡頭範圍計算`

### Task 3: 等角素材（桌子、房間）

**Files:**
- Modify: `web/src/flat.ts`（新增函式；舊的 `desk`、`officeShell` 在 Task 6 改用新函式後刪除）
- Test: `test/flat.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `toScreen`。
- Produces:
  - `isoDesk(state: DeskState): FlatSprite` — 座標是世界畫面座標、以座位格左上角 `toScreen(cell.x, cell.y)` 為原點。格內地板範圍與高度（世界單位）：陰影 x 10–86、y 58–92；四支桌腳 3×3 在 (14,62)(80,62)(14,86)(80,86) 高 0–19；桌面 x 12–84、y 60–90、z 19–25；咖啡杯 x 70–76、y 72–78、z 25–34；螢幕底座 x 44–52、y 74–79、z 25–28；螢幕 x 34–62、y 72–75、z 28–50；狀態燈在螢幕背面中央 `(48, 75, 39)`，非空桌外加半透明光暈。方塊三面：上面最亮、左面（y 最大那面）中間、右面（x 最大那面）最暗。用色參考設計稿 13。
  - `isoRoom(w: number, h: number): FlatSprite` — 世界畫面座標：菱形地板（`toScreen` 的四角 (0,0)(w,0)(w,h)(0,h)）與每 64 一條的淡格線；左牆（fx = 0，沿 fy）與後牆（fy = 0，沿 fx）高 `WALL_Z = 110`，含踢腳板與牆頂；後牆 `DOOR_X` 處一扇門（寬 44、高 81）；後牆每隔約 220 一扇窗。顏色自訂，但地板、牆要跟現在深藍色系或設計稿 13 米色系二選一，整體一致。
  - `isoIslandFloor` 不需要：島的地板色塊在 Task 6 直接用 `fillPoints` 畫。

- [ ] **Step 1: 寫失敗測試**：
  - `isoDesk('waiting').shapes` 含 `LED.waiting` 顏色；`isoDesk('empty').shapes` 不含任何 `a < 1` 的 `LED.empty` 光暈。
  - `extent(isoDesk('working'))` 的 `y0 < -40`（螢幕高出桌面）且 `x0 < 0 < x1`。
  - `extent(isoRoom(1280, 720))` 的 `x0 ≈ -720`、`x1 ≈ 1280`、`y0 ≈ -WALL_Z`、`y1 ≈ 1000`（容差 10，牆頂厚度可超出一點）。
- [ ] **Step 2: 執行** `npx vitest run test/flat.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作**：在 `flat.ts` 加一個私有 `isoBox(x0,y0,x1,y1,z0,z1, top,left,right): Shape[]`（三個 `p` 多邊形），兩個公開函式用它組。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠。
- [ ] **Step 5: Commit** `feat: 等角桌子與房間素材`

### Task 4: 名牌與地上招牌的文字規則

**Files:**
- Modify: `web/src/view.ts`
- Test: `test/view.test.ts`

**Interfaces:**
- Produces:
  - `PLATE_MAX = ISLAND.cellW + ISLAND.cellH - 20`（= 200，世界單位）— 名牌整條最大寬度（含左右內距）。
  - `plateLabel(e: Employee, fits: (s: string) => boolean): { text: string; waiting: boolean }` — 規則：
    1. `pre = e.status === 'waiting' ? '! ' : ''`，`name = nameplate(e)`，`act = oneLine(e.activity ?? '')`（空字串就只有名字）。
    2. `pre + name + (act ? ' · ' + act : '')` 放得下就用它。
    3. 否則截動作：`fitMiddle(act, a => fits(pre + name + ' · ' + a))`，但動作至少保留 4 個字加「…」；保留 4 字仍放不下，動作固定為那 4 字加「…」，改用 `fitMiddle(name, n => fits(pre + n + ' · ' + minAct))` 截名字。
    4. `waiting` 等於 `e.status === 'waiting'`。
  - `SIGN_FONT = { max: 17, min: 12 }`。
  - `signFit(title: string, maxW: number, measure: (s: string, size: number) => number): { text: string; size: number }` — 從 `max` 往下每次減 1，`measure(title, size) <= maxW` 就停；到 `min` 仍放不下就 `fitMiddle(title, t => measure(t, min) <= maxW)`。
  - `signMaxW(isl: Island): number` — `isl.w + ISLAND.gap - 24`。
- [ ] **Step 1: 寫失敗測試**（`fits` 用 `s => [...s].length <= N` 模擬寬度）：
  - 工作中、標題「登入流程重構」、動作「編輯 view.ts」、N = 40 → `{ text: '登入流程重構 · 編輯 view.ts', waiting: false }`。
  - 等你處理、同上 → 以 `'! 登入流程重構 · '` 開頭、`waiting: true`。
  - 閒置、`activity: null` → 文字只有名字，不含「 · 」。
  - 長動作、N = 16 → 名字完整保留，動作被截短且含「…」。
  - 24 字標題 + 長動作、N = 14 → 結果長度 ≤ 14，動作部分恰為 4 字 +「…」，名字含「…」。
  - `signFit('claudeOffice', 1000, m)` → `size === 17`；放不下時 `size` 逐步降到 12；`size === 12` 仍放不下 → 文字含「…」且 `measure(text, 12) <= maxW`。
  - `signMaxW({ w: 124, ... })` → `124 + 44 - 24`。
- [ ] **Step 2: 執行** `npx vitest run test/view.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作**上述函式（`oneLine` 已在檔內）。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠。
- [ ] **Step 5: Commit** `feat: 一行名牌與地上招牌的截字規則`

### Task 5: 資訊卡的助理清單

**Files:**
- Modify: `web/src/view.ts`（純函式）、`web/src/OfficeScene.ts:135-299`（`InfoCard`）
- Test: `test/view.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Assistant.kind`。
- Produces: `assistantList(list: readonly Assistant[], max = 4): { rows: Assistant[]; extra: number; extraWorking: number; extraDone: number; working: number }` — 工作中排前、完成排後，同組維持原順序；`rows` 取前 `max` 位，其餘算進 `extra`（再分工作中／完成）；`working` 是全部工作中人數。

- [ ] **Step 1: 寫失敗測試** `assistantList`：
  - 空清單 → `{ rows: [], extra: 0, extraWorking: 0, extraDone: 0, working: 0 }`。
  - `[done a, work b, done c, work d]` → `rows` 的 id 依序 `b, d, a, c`，`working === 2`。
  - 9 位（5 工作中、4 完成）→ `rows.length === 4` 且全是工作中，`extra === 5`、`extraWorking === 1`、`extraDone === 4`。
- [ ] **Step 2: 執行** `npx vitest run test/view.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作** `assistantList`；改 `InfoCard.fill` 的「助理」區塊照設計稿 11：
  - 標題 `助理 · ${list.length}`，後面接綠色 `${working} 位工作中`（0 位不顯示）。
  - 每行：狀態圓點（工作中 `#46d983`、完成 `#f2b83d`）、`a.kind` 存在時才加等寬字小標（最寬 76px，超出 `text-overflow: ellipsis`）、描述（空的寫灰色「（無描述）」，單行截斷）、狀態文字；完成的整行降低不透明度。
  - `extra > 0` 時加一行：外框小徽章 `+${extra}`，後接 `另有 ${extraWorking} 位工作中、${extraDone} 位已完成`（某一項為 0 時省略該項與頓號）。
  - 刪除 `fillHelper`、`hideHelper`、`asstId` 欄位與 `show()` 的 `asstId` 參數（小幫手卡不再存在）。
- [ ] **Step 4: 執行** `npx vitest run` 與 `npm run build`，預期全綠且編譯通過（`OfficeScene` 裡呼叫 `card.show(..., aid)` 與 `hideHelper` 的地方先改成不帶 `aid`／刪掉呼叫，小幫手本身在 Task 7 才移除）。
- [ ] **Step 5: Commit** `feat: 資訊卡助理清單顯示類型，最多 4 位`

### Task 6: 等角場景：房間、島、桌子、名牌、地上招牌、鏡頭

**Files:**
- Modify: `web/src/OfficeScene.ts`（`relayout`、`drawFloor`、`drawIsland`、`updateSigns`、`drawDesk`、`create`）
- Modify: `web/src/main.ts`
- Modify: `web/src/art.ts`（`bakeTextures` 改烘 `isoDesk`）
- Modify: `web/src/flat.ts`（刪除不再使用的 `desk`、`officeShell` 及只被它用到的牆邊家具；`test/flat.test.ts` 對應測試一併刪除）

**Interfaces:**
- Consumes: Task 2 `toScreen`、`isoDepth`、`islandsBounds`、`fitCamera`、`HEAD_Z`；Task 3 `isoDesk`、`isoRoom`；Task 4 `plateLabel`、`PLATE_MAX`、`signFit`、`signMaxW`。
- Produces: `OfficeScene` 私有 `fitView(): void` — 依 `islandsBounds(this.lay.islands)` 與 `fitCamera(..., BASE_W, BASE_H, MAX_ZOOM)` 設定 `cameras.main.setZoom(this.z * zoom).centerOn(cx, cy)`；`MAX_ZOOM = 2`。Task 7 用它。

- [ ] **Step 1: 畫布固定大小**：`main.ts` 畫布維持 `BASE_W * Z × BASE_H * Z`，`fitZoom` 只依視窗與 `BASE_W/BASE_H` 計算；刪除 `office-size` 事件、`sceneW/sceneH`。`relayout` 不再 `scale.resize`、不再 emit `office-size`，改呼叫 `fitView()`。相機原點改回中心（`setOrigin(0.5)`），`centerOn` 才會對準。
- [ ] **Step 2: 房間與島**：`drawFloor` 用 `isoRoom(l.width, l.height)` 畫在 depth -100；`drawIsland` 的地板色塊改成島矩形四角投影後 `fillPoints`（顏色沿用 `mixColor(FLOOR, isl.color, 0.3)`，depth -90）。`l.voids` 不再使用（空地擺設拿掉）。
- [ ] **Step 3: 桌子**：每個座位 `addSprite(this, deskKey(...), sx, sy)`，`(sx, sy) = toScreen(c.x, c.y)`，depth `isoDepth(c.x + 48, c.y + 90)`。
- [ ] **Step 4: 名牌**：每桌一個 `Text`（`fontSize 9px`、內距 `{x:6,y:2}`、`setOrigin(0.5, 0)`），位置 `toScreen(c.x + 48, c.y + 100)`，depth `isoDepth(c.x + 48, c.y + 100) + 1000`（名牌永遠在人與桌之上，因為頭上已沒有文字，不會被擋住臉）。`drawDesk` 改用 `plateLabel(e, s => (plate.setText(s), plate.width <= PLATE_MAX))`；背景 `waiting ? 'rgba(214,52,52,0.92)' : 'rgba(20,23,42,0.78)'`；空桌不顯示。刪除 `PLATE_W`、`PLATE`。
- [ ] **Step 5: 地上招牌**：每座島一個招牌：用 `signFit(isl.title, signMaxW(isl), measure)` 決定字與字級，畫成一張平面貼圖（色帶高 24、圓角 6、島色 0.9 不透明、白字粗體、左右內距 9），再貼到地板平面：色帶左上角在地板點 `(isl.x, isl.y + isl.h + 6)`，x 軸沿地板 fx 方向、y 軸沿 fy 方向（世界座標下 fx 單位向量 = `(1, 0.5)`、fy 單位向量 = `(-1, 0.5)`）。實作方式自選（例如 `Phaser.GameObjects.Mesh`/`Plane`，或把文字烘成貼圖後 `setTransform` 無法做斜切時改用 `RenderTexture` + 四角 mesh）；depth `-80`（在島地板之上、在所有桌人之下）。`measure` 用一個離屏 `Text` 量。等待人數圓章：直立 `Container`（紅圓 r 9、白框 2、白字 11px 粗體），位置 `toScreen(isl.x + 色帶寬 + 9, isl.y + isl.h + 18)`，depth `-79`，0 人隱藏，保留現有的放大縮小 tween。刪除舊的 `SIGN` 米色板。
- [ ] **Step 6: 「目前沒有人上班」**：位置 `toScreen(BASE_W/2, BASE_H/2)`。
- [ ] **Step 7: 驗證**：`npx vitest run`、`npm run build` 通過；`npm start` 後另開終端 `npm run simulate`，瀏覽器開 `http://127.0.0.1:47823`，截圖確認：等角房間、島色塊、桌子方向（螢幕背面朝觀看者、狀態燈顏色正確）、名牌一行且等你處理變紅、地上招牌斜躺在島左前緣、鏡頭對準有人的島。人物此時位置可能錯，Task 7 修。
- [ ] **Step 8: Commit** `feat: 等角房間、桌子、名牌與地上招牌，鏡頭跟著島`

### Task 7: 人物：地板座標走路、深度、拿掉頭上文字與小幫手

**Files:**
- Modify: `web/src/OfficeScene.ts`（`Slot`、`Leaver`、`createSlot`、`walkTo`、`walkPath`、`sortDepth`、`upsert`、`startWalk`、`leave`、`walkOut`、`rerouteTo`/`exitOf` 的呼叫端、`drawEmployee`、`relayout`、`rebuild`、`destroySlot`；刪除所有小幫手程式）
- Modify: `web/src/view.ts`（刪除 `helperSlots`、`helperHome`、`HELPER_MAX`、`DoneClock`、`DONE_MS`）
- Modify: `web/src/art.ts`（不再烘 `bot-work`、`bot-done`）
- Modify: `web/src/flat.ts`（`bot` 若已無人使用就刪除）
- Test: `test/view.test.ts`、`test/flat.test.ts`（刪除對應測試）

**Interfaces:**
- Consumes: Task 2 `toScreen`、`isoDepth`；Task 6 `fitView`。
- Produces: `Slot.at: Pt` 與 `Leaver.at: Pt` — 人物目前的地板座標；畫面位置一律由 `place(obj, at)`（`obj.setPosition(toScreen(at.x, at.y))` + `obj.setDepth(isoDepth(at.x, at.y) + 30)`）算出。

- [ ] **Step 1: 位置改存地板座標**：`walkTo`/`walkPath` 改成操作 `{ at: Pt; obj: Container }`：tween 的 target 是 `at`（x、y），`onUpdate` 與完成時呼叫 `place`；`walkPath` 的「與目前位置重疊」判斷用 `at`。所有原本把 `s.person`、`person` 當地板點傳給 `rerouteTo`/`exitOf` 的地方改傳 `s.at`／`l.at`。`relayout` 中坐著的人用 `place(s.person, s.at = homeOf(e))`。
- [ ] **Step 2: 角色素材**：`CHAR` 錨點改成素材底部中心對到地板點（素材 (0,0) 在 `(-20 * CHAR_SCALE, -54 * CHAR_SCALE)`），`CHAR_SCALE = 1.2`（套在 `figure` 容器上）；互動範圍跟著放大。`RAISE_Y`、閒置晃動、打字換幀照舊。
- [ ] **Step 3: 拿掉頭上文字與小幫手**：刪除 `bubble`、`bubbleBg`、`bubbleText`、`mark`、`drawBubble`、`EXCL*`；等你處理只靠舉手姿勢 + 紅色名牌 + 紅桌。刪除 `helpers`、`helperTimers`、`badges`、`clock`、`placeHelper`、`startHelperWalk`、`makeHelper`、`applyHelperLook`、`syncHelpers`、`drawBadge`、`dropHelper`、`helperKey`、`HELPER_R`、`Helper` 型別；`upsertReal` 只呼叫 `upsert`。同時刪除 `view.ts` 的 `helperSlots`、`helperHome`、`HELPER_MAX`、`DoneClock`、`DONE_MS` 及其測試；`art.ts` 不再烘機器人；`flat.ts` 的 `bot` 沒人用就刪（連同測試）。
- [ ] **Step 4: 資訊卡位置**：滑鼠移到人物時，把人物世界座標換成螢幕座標再顯示卡片：`const cam = this.cameras.main; const r = this.game.canvas.getBoundingClientRect(); const k = r.width / this.game.canvas.width; left = r.left + (person.x - cam.worldView.x) * cam.zoom * k + 26 * cam.zoom * k`，`top` 同理用 y 與 `-40`。
- [ ] **Step 5: 驗證**：`npx vitest run`、`npm run build` 通過；`npm start` + `npm run simulate`，截圖確認：人坐在桌子後方、臉不被螢幕擋住、新進員工沿 `entryPath`（門口 → 島後走道 → 座位）走進來且前後遮擋正確、下班走出門口、頭上沒有泡泡和驚嘆號。另外在 simulate 跑到一半時再開一個新專案的 session（或用 `--loop`），確認走路中的人在版面重排後從目前位置改走新路線，沒有瞬移。
- [ ] **Step 6: Commit** `feat: 人物改用地板座標走路，拿掉頭上文字與桌邊小幫手`

### Task 8: 收尾

**Files:**
- Modify: `README.md`（畫面說明、截圖或文字描述改成 2.5D；小幫手改為資訊卡清單）

- [ ] **Step 1**：`git grep -n "helperHome\|helperSlots\|DoneClock\|officeShell\|bubble\|office-size"`，預期只剩設計文件與計畫裡的提及。
- [ ] **Step 2**：更新 README 中描述畫面的段落（俯視 → 2.5D、助理不再畫在桌邊而列在資訊卡、名牌一行與等你處理變紅、招牌在地上）。
- [ ] **Step 3**：`npx vitest run`、`npm run build` 通過。
- [ ] **Step 4: Commit** `docs: README 改為 2.5D 辦公室說明`
