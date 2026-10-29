# 2.5D 辦公室物件與黏土風格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把現在的米色 2.5D 辦公室換成設計稿 57 版：深藍夜間房間、牆面與靠牆家具、轉 45° 的桌椅、E 黏土質感、名牌固定螢幕字級、鏡頭框住整個房間。

**Architecture:** 素材仍是 `flat.ts` 風格的圖形清單（純資料、可測）；新增 `web/src/clay.ts` 把圖形清單用 Canvas 2D 畫成黏土質感（純函式，吃 `CanvasRenderingContext2D`），`art.ts` 改用 `textures.createCanvas` 烘貼圖。房間外殼仍用 Graphics 畫在場景上。家具與牆面掛件放在新的 `web/src/furniture.ts`，擺放規則是純函式。`iso.ts` 改成框住整個房間的鏡頭。

**Tech Stack:** TypeScript、Phaser 4.2.1、Vite、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-29-iso-office-objects-design.md`（下稱「規格」，§ 為其章節；所有尺寸、色碼照它）。設計稿：claude.ai artifact `P3nBrZxz9wgvDNEXzKgwci` 第 1–7 張，畫面要長得像第 4、5 張。

## Global Constraints

- 不改 `layout`、`columnsFor`、`seatCell`、`entryPath`、`waitingCount`、`nameplate`、`fitText`、`fitMiddle`、`signFit`、`signMaxW` 的行為；`src/` 伺服器與狀態不動。
- 世界座標 = 地板 px，`toScreen(fx, fy, z) = { x: fx − fy, y: (fx + fy)/2 − z }`，縮放全交給鏡頭。
- 不用 shader、不用外部圖檔；黏土效果只在烘貼圖時做（規格 §16）。地上招牌、等待圓章、名牌、提示字不套黏土效果。
- 狀態燈顏色沿用 `LED`；`PIXEL_RATIO` 沿用。
- 畫面文字繁體中文；資訊卡內容一律 `textContent` / DOM 建立。
- commit 訊息繁體中文，保留 `feat:`/`fix:`/`refactor:`/`test:`/`docs:` 前綴，**不加** Co-Authored-By、Claude-Session、Generated with 等 trailer；修正前一個 commit 用 `--fixup` 併回。
- 每個 task 結束前 `npx vitest run` 全綠、`npm run build` 成功。
- 測試或截圖產生的暫存資料夾、headless Edge（含 `--user-data-dir`）、測試伺服器、模擬器，用完自己清掉並列出行程與資料夾確認。測試伺服器用 port 47911 與暫存 HOME/USERPROFILE，**不可**動 port 47823 與 `~/.claude-office`。

## Review Focus

- 島數變多、房間變寬：牆面家具位置固定從左排，不能因寬度改變而跳位 — Task 5 的 `planWall` 測試。
- 鏡頭剛好 0.8 倍與 0.79 倍：0.8 顯示「名字 · 動作」、0.79 只顯示名字；等你處理在兩邊都保留紅底與「! 」 — Task 1 的測試。
- 沒有任何人：房間用 1006 × 420，鏡頭倍率有限且 > 0，提示字在地板 (503, 250) — Task 2 的測試。
- 很長的中文名字加長動作、等你處理：名牌不超過寬度上限，動作是開頭加「…」而不是中間截 — Task 1 的測試。
- 走路的人經過空桌：椅子 < 人 < 桌子的深度順序，走在桌間空隙時在後排桌前、前排桌後 — Task 4 的深度測試。

---

### Task 1: 名牌文字規則

**Files:**
- Modify: `web/src/view.ts:119-138`（`PLATE_MAX`、`plateLabel`）
- Test: `test/view.test.ts:212-260`

**Interfaces:**
- Produces:
  - `PLATE_NAME_ONLY_ZOOM = 0.8`
  - `plateMaxW(zoom: number): number` — 名牌整條（含左右內距 6+6）在**螢幕**上的最大寬度：`zoom >= 0.8 ? Math.min(170, 180 * zoom - 8) : Math.min(200, 160 * zoom)`。
  - `plateLabel(e: Employee, fits: (s: string) => boolean, nameOnly = false): { text: string; waiting: boolean }` — `nameOnly` 時把動作當成空；動作改用 `fitText` 截。
  - 移除 `PLATE_MAX`（呼叫端在 Task 7 改用 `plateMaxW`）。

- [ ] **Step 1: 改測試**
  - 刪 `PLATE_MAX` 測試，加 `test('plateMaxW', ...)`：`plateMaxW(1)` = 170、`plateMaxW(0.82)` ≈ 139.6（`toBeCloseTo(139.6, 5)`）、`plateMaxW(0.8)` = 136、`plateMaxW(0.79)` ≈ 126.4、`plateMaxW(2)` = 170、`plateMaxW(0.5)` = 80。
  - `plateLabel：長動作先截動作，名字完整`：斷言改成 `p.text.startsWith('登入流程重構 · 編輯')`、`p.text.endsWith('…')`，且動作部分是原動作的前綴（`'編輯非常長的檔案名稱.ts 與其他內容'.startsWith(動作去掉「…」)`）。
  - `plateLabel：等你處理又要截字`：同樣改成前綴加「…」，仍以 `'! '` 開頭。
  - 新增 `plateLabel：nameOnly 只顯示名字`：`plateLabel(plateEmp('working', '編輯 view.ts'), lim(40), true)` → `{ text: '登入流程重構', waiting: false }`；`plateEmp('waiting', ...)` 加 `true` → `text` 為 `'! 登入流程重構'`、`waiting: true`。
- [ ] **Step 2: 執行** `npx vitest run test/view.test.ts`，預期新／改的測試 FAIL。
- [ ] **Step 3: 實作** 上面三個介面。`plateLabel` 裡 `const cut = fitMiddle(act, …)` 改 `fitText(act, …)`；名字仍用 `fitMiddle`；「動作至少 4 字加…」規則照舊。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠（`npm run build` 會因 `OfficeScene` 還用 `PLATE_MAX` 失敗：本 task 在 `OfficeScene.ts` 暫時把 `PLATE_MAX` 換成 `plateMaxW(1)`，Task 7 再接正式規則）。
- [ ] **Step 5: Commit** `feat: 名牌動作從尾端截斷，寬度上限依鏡頭倍率`

### Task 2: 房間大小、鏡頭與深度

**Files:**
- Modify: `web/src/iso.ts`
- Test: `test/iso.test.ts`

**Interfaces:**
- Consumes: `Island`（view.ts）。
- Produces:
  - `FURN_END = 1006`、`WALL_TOP_Z = 118`（牆頂含厚度）、`FLOOR_DEPTH_Z = -10`。
  - `roomSize(islands: Island[]): { w: number; h: number }` — 規格 §3：`w = max(島群右緣 + 40, FURN_END)`、`h = max(島群下緣 + 50, 420)`；沒有島時 `{ w: 1006, h: 420 }`。
  - `roomBox(w: number, h: number): Box` — 規格 §12 的 6 點外框。
  - `fitCamera(b: Box, viewW: number, viewH: number, maxZoom: number, margin = 12): { zoom: number; cx: number; cy: number }` — `zoom = min(maxZoom, (viewW − 2·margin)/b.w, (viewH − 2·margin)/b.h)`，中心是框中心。不再接受 `null`。
  - `chairDepth(cell: Pt): number` = `cell.x + cell.y + 88`（規格 §2）。
  - 刪除 `islandsBounds`。

- [ ] **Step 1: 寫失敗測試**
  - `roomSize([])` → `{ w: 1006, h: 420 }`；一座島 `{ x: 40, y: 96, w: 316, h: 160 }` → `{ w: 1006, h: 420 }`；一座 `{ x: 900, y: 96, w: 400, h: 500 }` → `{ w: 1340, h: 646 }`。
  - `roomBox(1006, 420)`：`x` = `toScreen(0, 420).x`、右緣 = `toScreen(1006, 0).x`、`y` = `toScreen(0, 0, 118).y`、下緣 = `toScreen(1006, 420, -10).y`。
  - `fitCamera(roomBox(1006, 420), 1280, 720, 2)`：`zoom` 有限、`> 0`、`<= 2`，且框四角乘 zoom 後與中心距離都在 `(1280−24)/2`、`(720−24)/2` 之內。
  - `fitCamera({ x: 0, y: 0, w: 100, h: 100 }, 1280, 720, 2).zoom` = 2。
  - `chairDepth({ x: 0, y: 0 })` = 88，並斷言對同一格 `chairDepth(c) < personDepth({ x: c.x + 48, y: c.y + 48 }) < deskDepth(c)`。
  - 刪掉 `islandsBounds` 測試，改寫 `fitCamera(null…)` 測試。
- [ ] **Step 2: 執行** `npx vitest run test/iso.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作** 上面介面。`OfficeScene.fitView` 暫時改成 `fitCamera(roomBox(...roomSize 的 w,h), BASE_W, BASE_H, MAX_ZOOM)` 讓 build 通過（Task 6 再接房間繪製）。
- [ ] **Step 4: 執行** `npx vitest run` 與 `npm run build`，預期全過。
- [ ] **Step 5: Commit** `feat: 鏡頭改成框住整個房間`

### Task 3: 黏土畫法（Canvas 2D）

**Files:**
- Create: `web/src/clay.ts`
- Modify: `web/src/flat.ts:14`（`FlatSprite` 加 `clay?: 'box' | 'figure'`）、`web/src/art.ts:35-45`（`bakeSprite`）
- Test: `test/clay.test.ts`

**Interfaces:**
- Consumes: `Shape`、`FlatSprite`（flat.ts）、`toScreen`（iso.ts）。
- Produces:
  - `drawClay(ctx: CanvasRenderingContext2D, shapes: Shape[], mode: 'box' | 'figure'): void` — 規格 §16.1（box：多邊形與矩形填色 → 描邊 → 面積 < 3000 加亮塊；圓、橢圓只填色）與 §16.3（figure：矩形／多邊形線性漸層、圓／橢圓放射漸層、r > 3 的圓加高光）。兩種模式下 α < 1 的圖形都只填色。
  - `softShadow(ctx: CanvasRenderingContext2D, fx: number, fy: number, r: number): void` — 規格 §16.5 三層；地板座標半徑 r 的圓投影後是中心 `toScreen(fx, fy)`、`rx = r·√2`、`ry = r/√2` 的橢圓。
  - `FlatSprite.clay` 預設 `'box'`；Task 4 的 `character()` 設 `'figure'`。
  - `bakeSprite` 改用 `scene.textures.createCanvas(key, w·PIXEL_RATIO, h·PIXEL_RATIO)` → `ctx.scale` / `translate` → `drawClay` → `tex.refresh()`；`addSprite` / `setSprite` / `info` 介面不變。

- [ ] **Step 1: 寫失敗測試**，用記錄呼叫的假 ctx（自己寫一個物件，紀錄 `fillStyle`、`strokeStyle`、`lineWidth`、`lineJoin`、`globalAlpha` 的設定值，以及 `fill`、`stroke`、`ellipse`、`createLinearGradient`、`createRadialGradient` 與其參數；漸層物件記錄 `addColorStop`）：
  - `box 多邊形：填色、描邊、亮塊`：一個 20×20 的方形多邊形 `#808080` → 有一次 `fill`、一次 `stroke` 且 `lineWidth` 1.4、`lineJoin` `'round'`、`strokeStyle` = `mix('#808080', '#1d1a2e', 0.18)`；之後有一次 `globalAlpha` 0.45 的 `fill`，`fillStyle` = `mix('#808080', '#ffffff', 0.32)`。
  - `box 大面不加亮塊`：100×100 方形 → 只有 1 次 `fill`。
  - `半透明只填色`：`a: 0.3` 的多邊形在兩種模式都沒有 `stroke`、沒有漸層。
  - `box 圓只填色`：圓沒有 `stroke`、沒有漸層（狀態燈）。
  - `figure 矩形線性漸層`：`{ t: 'r', x: 10, y: 20, w: 20, h: 10 }` → `createLinearGradient(10, 20, 17, 30)`，色階 `[0, mix(c,'#ffffff',0.30)]`、`[0.55, c]`、`[1, mix(c,'#1d1a2e',0.25)]`。
  - `figure 圓放射漸層與高光`：`{ t: 'c', x: 20, y: 16, r: 12.5 }` → `createRadialGradient` 圓心 `(20 − 12.5 + 0.38·25, 16 − 12.5 + 0.34·25)`、r0 0、r1 `0.75·25`；另有一個 `ellipse`，中心 `(20 − 0.35·12.5, 16 − 0.42·12.5)`、`rx 0.32·12.5`、`ry 0.2·12.5`，`globalAlpha` 0.55。`r: 2` 的圓沒有高光 ellipse。
  - `softShadow 三層`：`softShadow(ctx, 0, 0, 10)` → 3 次 `ellipse`，半徑 `rx` 依序 `10√2·1`、`·0.75`、`·0.5`，`globalAlpha` 依序 0.10、0.16、0.22，中心 (0, 0)。
  - `mix` 若在 flat.ts 是私有函式，改成 export 給 clay.ts 用（測試也用它算預期色）。
- [ ] **Step 2: 執行** `npx vitest run test/clay.test.ts`，預期 FAIL（找不到模組）。
- [ ] **Step 3: 實作** `clay.ts`；`bakeSprite` 換成 Canvas 版。圓角矩形用 `ctx.roundRect`。
- [ ] **Step 4: 執行** `npx vitest run`、`npm run build`，預期全過；`npm start` 用測試 port（見 Global Constraints）開起來截一張圖，確認桌子、人物仍正常顯示（此時還是舊造型，只是改用 Canvas 烘），看完清掉。
- [ ] **Step 5: Commit** `feat: 烘貼圖改用 Canvas 2D 畫黏土質感`

### Task 4: 新座位：椅子、桌子、人物素材

**Files:**
- Modify: `web/src/flat.ts:88-156`（`character`、`isoDesk`）
- Test: `test/flat.test.ts`

**Interfaces:**
- Consumes: `toScreen`、`chairDepth`、`deskDepth`、`personDepth`。
- Produces:
  - `rpt(c: Pt, u: number, v: number, z: number): [number, number, number]` — 規格 §8 的轉 45° 座標（相對座位格原點，c 傳 `{ x: 59, y: 59 }` 即桌子中心 D）。
  - `isoChair(): FlatSprite` — 規格 §8 椅子表，原點 = 座位格左上角 `toScreen(cell)`。
  - `isoDesk(state: DeskState): FlatSprite` — 改成規格 §9 全部部件（含等你處理紅光、閒置蒸氣），原點同上。
  - `CharOpts.chair?: boolean`（預設 `true`）：`false` 時不畫看板椅背（`r(3,24,34,28,…)`、`r(3,24,34,5,…)`）也不畫腳底陰影 `e(20,54,…)`。`character()` 回傳 `clay: 'figure'`。
  - `isoDesk`、`isoChair` 回傳 `clay: 'box'`。

- [ ] **Step 1: 寫失敗測試**
  - `人、螢幕、桌子垂直對齊`：`isoDesk('working')` 裡顏色 = `LED.working` 且不透明的圓，其 `x` 等於 `toScreen(48, 48).x`（`toBeCloseTo(…, 5)`）。
  - `螢幕頂端低於下巴`：`isoDesk` 螢幕最高點的 y（`toScreen` 後最小 y，限螢幕部件；可由測試用 `rpt` 自己算 `toScreen(...rpt(D, 0, 4, 37))`）大於人物下巴的 y：`toScreen(48, 48).y + (30 − 54)·1.2`。
  - `等你處理有紅光、桌面偏紅`：`isoDesk('waiting')` 有 `#ff4d4d`、α 0.22 的橢圓或多邊形；有一面顏色是 `#e98d63`。
  - `閒置有蒸氣`：`isoDesk('idle')` 有白色、α 0.7 的橢圓；`'working'` 沒有。
  - `isoChair 有椅背與坐墊`：含 `#56649a` 與 `#3b4770` 的面。
  - `character({ chair: false })`：沒有 `w 34 h 28` 的矩形、沒有 `y 54` 的橢圓；`character()` 預設仍有（資訊卡頭像用）；`character().clay === 'figure'`。
  - 原有 `isoDesk` 狀態燈測試保留。
- [ ] **Step 2: 執行** `npx vitest run test/flat.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作**。桌子與椅子的「轉 45° 方塊」只畫上面與正面兩面（規格 §8）；顏色照 §8–9 表格。
- [ ] **Step 4: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 5: Commit** `feat: 桌子椅子轉 45° 正面朝觀看者`

### Task 5: 房間外殼、牆面掛件、靠牆家具與擺放規則

**Files:**
- Modify: `web/src/flat.ts:158-184`（`isoRoom`、刪 `ISO_FLOOR`）
- Create: `web/src/furniture.ts`
- Test: `test/furniture.test.ts`、`test/flat.test.ts:63-70`

**Interfaces:**
- Produces:
  - `isoRoom(w: number, h: number, doorX: number): FlatSprite` — 規格 §3 全表（深藍地板、棋盤、格線、牆腳陰影、地板厚度、後牆／左牆含護牆板腰線踢腳、牆頂、端面）。不含門、窗。
  - `furniture.ts` 每個物件一個 `(): FlatSprite` 建構函式，原點 = 物件左緣 fx、牆面 fy = 0（左牆物件 fx = 0）的地板點：`door(doorX)`、`clock()`、`nightWindow()`、`leftWindow()`、`whiteboard()`、`banner()`、`calendarPoster()`、`bookshelf()`、`copier()`、`bin()`、`waterCooler()`、`counter()`、`fridge()`、`vending()`、`sofa()`、`sideTable()`、`floorLamp()`、`cat()`、`plant(big: boolean)`、`zoneMat(width: number, color: string)`。尺寸色碼照規格 §4–6；落地物件內含 §16.5 的接地投影參數 `shadow: { fx, fy, r }`（由 Task 6 用 `softShadow` 畫）。
  - `interface Placed { make: () => FlatSprite; fx: number; fy: number; depth: number; wall?: 'back' | 'left' }`
  - `planWall(w: number, h: number, rowYs: number[], doorX: number): Placed[]` — 規格 §4「擺放」與 §6：門與時鐘、fx 160 起影印區 → 窗 → 茶水間 → 白板 → 沙發區 → 大盆栽，比 `FURN_END` 寬時每 130 依序加旗幟、月曆＋海報、窗到 `w − 20`；左牆窗 fy 150 起每 240；左牆小盆栽每排島一盆 fy = 排 y + 34。深度照規格 §2。

- [ ] **Step 1: 寫失敗測試**
  - `isoRoom 深藍地板`：第一個圖形顏色 `#2d3558`；有 `#46507a`（後牆）與 `#3c4570`（左牆）。
  - `門旁 fx 0–160 不放落地家具`：`planWall(1006, 420, [96], 40)` 中非牆面（`wall` 未設）的物件，`fx >= 160`，只有門墊例外。
  - `家具固定從左排`：`planWall(1006, 420, [96], 40)` 與 `planWall(1600, 420, [96], 40)` 裡影印區、茶水間、白板、沙發區、大盆栽的 `fx` 完全相同。
  - `寬房間補掛件`：`planWall(1600, 420, [96], 40)` 在大盆栽之後依序出現 旗幟、月曆＋海報、窗（以 `make` 名稱或回傳的辨識欄位判斷），最後一件的右緣 ≤ 1580。
  - `家具排完不超過 FURN_END`：`planWall(1006, …)` 所有後牆物件右緣 ≤ 1006 − 60。
  - `左牆窗`：`planWall(1006, 900, [96], 40)` 左牆窗的 fy 為 150、390、630（裁定：窗的右緣 fy + 96 ≤ h − 30，所以 870 不放）。
  - `小盆栽每排一盆`：`rowYs = [96, 400]` → 兩個小盆栽 fy 130、434。
  - 每個建構函式回傳的 `extent` 有限、寬高 > 0（迴圈測全部）。
- [ ] **Step 2: 執行** `npx vitest run test/furniture.test.ts test/flat.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作**。`planWall` 需要的各組寬度照規格 §5（組寬 = 各家具寬 + 組內間隔 + 左右內距 12×2）。`OfficeScene` 對 `ISO_FLOOR` 的引用暫時改成 `'#2d3558'` 讓 build 通過。
- [ ] **Step 4: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 5: Commit** `feat: 深藍房間、牆面掛件與靠牆家具`

### Task 6: 場景接上房間、家具、地毯與鏡頭

**Files:**
- Modify: `web/src/OfficeScene.ts:358-421`（`relayout`、`fitView`、`drawFloor`、`drawIsland` 的地毯）、`create()` 的提示字

**Interfaces:**
- Consumes: Task 2 `roomSize`、`roomBox`、`fitCamera`；Task 3 `drawClay`、`softShadow`、`bakeSprite`；Task 5 `isoRoom`、`planWall`。

- [ ] **Step 1: 實作**
  - `drawFloor`：用 `roomSize(lay.islands)` 的 w、h 畫 `isoRoom`（Graphics，深度 −100），每個不透明多邊形加 `lineStyle(1, mix(c,'#1d1a2e',0.12))` 描邊（規格 §16.2）。
  - `planWall` 的每個物件烘成貼圖（key 用物件名稱，`textures.exists` 時重用）後放在 `toScreen(fx, fy)`，深度用 `Placed.depth`；接地投影畫在同一張貼圖裡或深度 −1 的位置。
  - 島地毯：外圈 `mix(地板, 專案色, 0.5)`、內縮 6 的內圈 `mix(地板, 專案色, 0.3)`，深度 −90（規格 §7）。
  - `fitView`：`fitCamera(roomBox(w, h), BASE_W, BASE_H, MAX_ZOOM)`；倍率或中心有變時用 300ms tween 平移縮放（第一次直接設定）。
  - 提示字：地板 `(w/2, h/2 + 40)`、14px、`#aab0d0`，並 `setScale(1 / cam.zoom)` 保持螢幕字級。
- [ ] **Step 2: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 3: 截圖驗證**：用 port 47911、暫存 HOME 啟動伺服器，跑 `scripts/simulate.ts`；headless Edge（獨立 `--user-data-dir`、CDP `Emulation.setDeviceMetricsOverride` 1400×900）截沒人、4 人兩張，自己看過：房間深藍、門窗家具都在畫面內、右側不被切、前方沒有大片空地板。清掉伺服器、模擬器、Edge、profile 與截圖，列出確認。
- [ ] **Step 4: Commit** `feat: 場景畫出牆面家具與島地毯，鏡頭框住房間`

### Task 7: 座位、人物、名牌與資訊卡頭像接上新素材

**Files:**
- Modify: `web/src/OfficeScene.ts`（`drawIsland` 桌子與名牌、`createSlot`、`place`、`drawDesk`、`shapesSvg` 頭像、`fitView` 之後更新名牌）
- Modify: `README.md`（畫面描述）

**Interfaces:**
- Consumes: Task 1 `plateLabel(e, fits, nameOnly)`、`plateMaxW`、`PLATE_NAME_ONLY_ZOOM`；Task 2 `chairDepth`；Task 3 `drawClay`、`softShadow`；Task 4 `isoChair`、`isoDesk`、`character({ chair: false })`。

- [ ] **Step 1: 實作**
  - 每個座位加一張 `isoChair` 貼圖，深度 `chairDepth(cell)`；桌子用新 `isoDesk`，深度照舊 `deskDepth(cell)`。
  - 場景上的人物用 `character({ ...look, chair: false })` 烘貼圖（`charKey` 要包含 chair 旗標，避免和頭像共用 key）；人腳下的接地投影 r 11 跟著人走（放在人的 container 裡、最底層）。
  - 名牌：字 11px、高 15、左右內距 6、底色 `#14172a` α0.85／等你處理 `#d63434` α0.92；每次鏡頭倍率改變後 `plate.setScale(1 / cam.zoom)`，以 `plateMaxW(zoom)` 當 `fits` 上限（文字寬 + 12 ≤ 上限，寬度用螢幕 px 比較），倍率 < `PLATE_NAME_ONLY_ZOOM` 時傳 `nameOnly = true`，並重算全部名牌文字。位置照規格 §11：水平置中在桌子中心 x、上緣在 `toScreen(cell.x + 67.5, cell.y + 67.5)`，但下緣不超過 `toScreen(cell).y + 90`。
  - 資訊卡頭像：改成一個 `<canvas>`，用 `drawClay(ctx, character(look).shapes, 'figure')` 畫（取代 `shapesSvg`，若無其他呼叫端就刪掉）。
  - `README.md` 更新畫面描述（深藍夜間、牆面家具、黏土質感、名牌固定字級、人多時只顯示名字）。
- [ ] **Step 2: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 3: 截圖驗證**（同 Task 6 的作法與清理規則）：模擬器 4 人坐定時截圖、滑鼠移到一位員工上截圖。自己看過並確認：人坐在桌子正後方、椅背在頭後、螢幕不擋臉；名牌字清楚、互不重疊、不蓋臉；資訊卡頭像是黏土畫法；走路的人經過桌間時前後遮擋正確。再用瀏覽器縮小視窗讓鏡頭 < 0.8，確認名牌只剩名字。和設計稿第 4、5 張比對，差異列在 commit 前回報。清理並列出確認。
- [ ] **Step 4: Commit** `feat: 新座位、黏土人物與固定字級名牌`

### Task 8: 斜桌子（使用者在第一版實作後追加）

規格：`docs/superpowers/specs/2026-10-29-iso-office-slanted-desk.md`（下稱「斜桌規格」），取代主規格 §8、§9、§2 的椅子／桌子深度與 §11 名牌位置。設計稿第 58 版第 2–5 張。

**Files:**
- Modify: `web/src/flat.ts`（`isoChair`、`isoDesk` 改用現有 `isoBox`；`rpt` 沒有其他呼叫端就刪掉）
- Modify: `web/src/iso.ts`（`deskDepth`、`chairDepth`、`plateAt`）
- Modify: `web/src/OfficeScene.ts`（名牌錨點）
- Test: `test/flat.test.ts`、`test/iso.test.ts`

**Interfaces:**
- Produces（簽名不變，只改數值）：`deskDepth(cell)` = `isoDepth(cell.x + 62, cell.y + 72)`；`chairDepth(cell)` = `isoDepth(cell.x + 42, cell.y + 42)`；`plateAt(cell, zoom, h = 15)` 用錨點格內 (75, 75)、下緣不超過 `toScreen(cell).y + 90`（斜桌規格 §5）。
- `isoChair()`／`isoDesk(state)`：部件、色碼照斜桌規格 §2；`shadow` 照 §3（椅 {42,42,15}、桌 {63,63,28}）；等你處理紅光改成中心 (68,74)、r 22。

- [ ] **Step 1: 改測試**
  - 深度：同一格 `chairDepth(c) < personDepth({x:c.x+48,y:c.y+48}) < deskDepth(c)`，且數值為 cell+84、cell+126、cell+134。
  - `人、螢幕、桌子垂直對齊`：`isoDesk('working')` 不透明狀態燈圓的 x 等於 `toScreen(61, 62).x`，且與 `toScreen(48, 48).x` 相差 ≤ 1。
  - 桌面中心在視線上：桌面上面的四角平均 x 等於 `toScreen(62, 62).x`（`toBeCloseTo`）。
  - 螢幕不擋臉：螢幕部件最高點的 y（取 `isoDesk` 中顏色 `#4a5068` 的上面）大於 `toScreen(48, 48).y + (30 − 54)·1.2`。
  - 等你處理紅光：`isoDesk('waiting')` 有 `#ff4d4d` α 0.22 的圖形，其中心等於 `toScreen(68, 74)`。
  - `plateAt`：zoom 1 時 x 等於 `toScreen(cell.x+75, cell.y+75).x`；y 取 `min(toScreen(cell.x+75,cell.y+75).y, toScreen(cell).y + 90 − 15/zoom)`，用 zoom 1 與 0.5 各測一次。
  - 刪掉只對轉 45° 幾何成立的舊斷言。
- [ ] **Step 2: 執行** `npx vitest run test/flat.test.ts test/iso.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作**。
- [ ] **Step 4: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 5: 截圖驗證**（照 Task 6 的作法與清理規則）：4 人坐定、滑鼠移到一位員工、28 人以上（鏡頭 < 0.8）三張。自己看過並確認：桌子沿後牆方向斜放、人在桌子正後方中央、椅背在頭後、螢幕不擋臉、名牌不疊不蓋臉、走路的人經過桌間時遮擋正確。
- [ ] **Step 6: Commit** `feat: 桌子椅子改成沿後牆斜放`
