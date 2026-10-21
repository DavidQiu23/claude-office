# 桌島分區與扁平向量風格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把辦公室畫面改成「只有一片地板、每個專案一座桌島」，並把像素美術換成扁平向量插畫。

**Architecture:** 素材是「圖形清單」純資料（`web/src/flat.ts`，可在 Node 測試）；`art.ts` 用 Phaser Graphics 把圖形清單乘上倍率 3 畫出來，再 `generateTexture` 烘成貼圖。`view.ts` 的 `layout()` 改成以專案（cwd）為單位排島；`OfficeScene.ts` 畫地板、島底色、招牌、徽章，員工與桌子位置改為島內格子。

**Tech Stack:** TypeScript 5、Phaser 3.90、Vite 6、Vitest 3（現有專案，沿用）。

**Spec:** `docs/superpowers/specs/2026-10-21-flat-vector-project-islands-design.md`（實作前先完整讀過；尺寸、顏色、規則以它為準）。素材來源 `docs/superpowers/specs/assets/flat-shapes.js`。

## Global Constraints

- 所有尺寸為場景座標（邏輯單位）；格子 96×124；桌子 72×36；角色 40×56；助理 24×24；驚嘆號 20×28；名牌寬 84 高 14。
- 地板 `#2d3558`；專案色 8 種：`#4a90d9`、`#e98f3f`、`#4fb477`、`#8e6fc9`、`#d9669a`、`#38a8a0`、`#e6c34a`、`#d9534f`，依 `cwd` 雜湊取餘數 8。
- 島寬 `欄數 × 96 + 28`（欄數 = `min(3, 桌數)`），島高 `26 + 排數 × 124 + 10`；島間水平走道 44；左右與下邊距 40；第一行島距上緣 72；兩行島垂直距離 72；換行寬度 1100。
- 只准用四種圖形（圓角矩形、圓、橢圓、多邊形）加透明度；不用漸層、模糊、旋轉、外框線。
- 內部渲染倍率 `PIXEL_RATIO = 3`；貼圖以 3 倍烘焙、以 1/3 顯示。
- 介面文字繁體中文；「等你回覆」＝ `status === 'waiting'`，與 `summary()` 一致；完成標籤文字「✓ 完成」。
- 不動 `src/`（伺服器、hook、reducer、installer）、資訊卡、氣泡、名牌文字邏輯。
- 只改前端與 `test/`；每個 task 結束時 `npm test` 全過。

## Review Focus

1. **座位有空缺**（只有座位 0 與 4 有人）：島要有 5 張桌、2 排、空桌照畫 → Task 2 測試。
2. **`cwd` 為空字串或 `undefined` 的 session**：仍要有一座島、有顏色、有標題，不能丟例外 → Task 2 測試。
3. **超過 8 個專案**：顏色重複但不報錯、版面換行 → Task 2 測試。
4. **等你回覆數量改變但版面簽名不變**：招牌徽章要即時更新（出現、消失、數字變化）→ Task 4 的 `updateSigns` 與 Task 5 的瀏覽器檢查。
5. **版面程式在瀏覽器丟例外**：上一版曾讓畫面畫到一半就停、測試完全沒抓到 → Task 4 把 store 監聽包上 `console.error`，Task 5 必須在真實瀏覽器跑並確認 console 沒有錯誤。

---

### Task 1: 向量素材資料 `flat.ts`

**Files:**
- Create: `web/src/flat.ts`
- Create: `test/flat.test.ts`

**Interfaces:**
- Produces（Task 3 依賴）:
  - `type Shape = { t: 'r'; x: number; y: number; w: number; h: number; r?: number; c: string; a?: number } | { t: 'c'; x: number; y: number; r: number; c: string; a?: number } | { t: 'e'; x: number; y: number; rx: number; ry: number; c: string; a?: number } | { t: 'p'; pts: number[]; c: string; a?: number }`
  - `interface FlatSprite { w: number; h: number; shapes: Shape[] }`
  - `type Pose = 'sit0' | 'sit1' | 'up' | 'idle' | 'walk0' | 'walk1'`、`type Outfit = 'tee' | 'hoodie' | 'shirt'`、`type DeskState = 'empty' | 'working' | 'waiting' | 'idle'`
  - `interface CharOpts { pose: Pose; style: number; outfit: Outfit; glasses: boolean; hair: string; shirt: string }`
  - `character(opts: Partial<CharOpts>): FlatSprite`、`desk(state: DeskState): FlatSprite`、`bot(done: boolean): FlatSprite`、`exclamation(): FlatSprite`
  - `extent(s: FlatSprite): { x0: number; y0: number; x1: number; y1: number }`：所有圖形的實際範圍（圓用 `x±r`、橢圓用 `x±rx`、多邊形用點的最小最大值）
  - `HAIR_COLORS: string[]`、`SHIRT_COLORS: string[]`（各 8 色，與 `flat-shapes.js` 相同）
  - `LED: Record<DeskState, string>`

- [ ] **Step 1: 寫測試 `test/flat.test.ts`**，內容：
  - `'角色：所有姿勢 × 髮型 × 衣服 × 眼鏡都能組出 40×56'`：迴圈走完 6 姿勢、髮型 0–5、3 衣服、眼鏡真假，`w === 40`、`h === 56`、`shapes.length > 0`。
  - `'所有圖形的數字有限、顏色是 #rrggbb、透明度在 0–1'`：對 `character`、四種 `desk`、兩種 `bot`、`exclamation` 的每個 shape 檢查（`pts` 長度為偶數且至少 6）。
  - `'素材名義尺寸固定'`：`desk` 為 72×36、`bot` 為 24×24、`exclamation` 為 20×28。
  - `'extent：桌子的螢幕與光暈超出名義外框'`：`extent(desk('waiting')).y0 < 0`。
  - `'桌子四種狀態的燈色不同'`：`LED` 的四個值互不相同。
  - `'等你回覆的桌子比工作中多紅色光暈'`：`desk('waiting').shapes.length >= desk('working').shapes.length`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run test/flat.test.ts`
Expected: FAIL（找不到 `../web/src/flat.js`）

- [ ] **Step 3: 實作 `web/src/flat.ts`**：把 `docs/superpowers/specs/assets/flat-shapes.js` 移植成 ES module，行為完全相同。去掉 IIFE 與 `module.exports`，加上上面的型別與 `export`，新增 `extent()`。保留 `mix/darker/lighter`（內部用，不必匯出）。移除 `svgOf` 與 `move`（遊戲不用）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run test/flat.test.ts`
Expected: PASS（6 個測試）

- [ ] **Step 5: Commit**

```bash
git add web/src/flat.ts test/flat.test.ts
git commit -m "feat: add flat vector sprite data"
```

---

### Task 2: 以專案為單位排島（`view.ts`）

**Files:**
- Modify: `web/src/view.ts`（`ROOM`、`Room`、`Layout`、`layout`、`seatCell`、`doorPos`、`layoutSig`、`DESK_W`、`DESK_H`；`appearance` 與其他函式不動）
- Modify: `test/view.test.ts`（把「layout」「seatCell 與 doorPos」相關三個測試換成下面的新測試；其餘不動；檔頭 import 的 `DESK_H`、`doorPos` 換成新名稱）

**Interfaces:**
- Produces（Task 3、4 依賴）:
  - `const ISLAND = { cellW: 96, cellH: 124, pad: 14, top: 26, bottom: 10, gap: 44, marginX: 40, marginTop: 72, vgap: 72, marginBottom: 40, maxRowW: 1100, maxCols: 3 }`
  - `const PROJECT_COLORS: string[]`（8 色，順序如 Global Constraints）
  - `interface Island { key: string; title: string; x: number; y: number; w: number; h: number; cols: number; rows: number; desks: number; color: string }`
  - `interface Layout { islands: Island[]; width: number; height: number }`
  - `layout(employees: Employee[]): Layout`
  - `projectColor(key: string): string`
  - `seatCell(island: Island, seat: number): { x: number; y: number }`：該格左上角
  - `waitingCount(employees: Iterable<Employee>, key: string): number`：該 `roomKey` 下 `status === 'waiting'` 的人數
  - `entryPath(island: Island, seat: number): { x: number; y: number }[]`：員工中心點的路線，依序為 `(0, py)`、`(sx, py)`、`(sx, sy)`，其中 `py = island.y - 16 - 28`（腳踩在島上緣上方 16）、`sx = cell.x + 48`、`sy = cell.y + 48`；下班走這條的反向
  - `layoutSig(l: Layout): string`
  - 保留 `roomKey`、`appearance`、`nameplate`、`summary`、`formatTime`、`DoneClock`、`fitText`、`BASE_W`、`BASE_H`、`PALETTE`

- [ ] **Step 1: 寫測試**（取代舊 layout 測試），測試名稱與斷言：
  - `'layout：每個資料夾一座島，桌數 = 最大座位 + 1，欄數最多 3'`：兩個專案各 1 人 → `islands.length === 2`、`desks === 1`、`cols === 1`、`w === 1 * 96 + 28`、`h === 26 + 124 + 10`；第二座島 `x > ` 第一座島 `x`；單人 `seat: 3` → `desks === 4`、`cols === 3`、`rows === 2`、`h === 26 + 2 * 124 + 10`。
  - `'layout：座位有空缺時仍給足桌數'`（Review Focus 1）：座位 0 與 4 有人 → `desks === 5`、`rows === 2`。
  - `'layout：位置規則'`：第一座島 `x === 40`、`y === 72`；3 個專案各 3 欄 → 同一行（`new Set(y).size === 1`），`width === 40 + 3 * 316 + 2 * 44 + 40`；第 4 個專案各 3 欄 → 換行，新行 `y === 72 + 第一行最大高度 + 72`。
  - `'layout：同名資料夾用上一層區分（含反斜線）；空辦公室仍有大小'`：沿用舊測試的斷言，欄位改為 `islands`。
  - `'layout：cwd 為空字串或缺值也有一座島'`（Review Focus 2）：`emp('a', 'idle', { cwd: '' })` 與 `cwd: undefined as unknown as string` → `islands.length === 1`、`color` 屬於 `PROJECT_COLORS`、不丟例外。
  - `'layout：超過 8 個專案'`（Review Focus 3）：10 個專案 → `islands.length === 10`、每個 `color` 屬於 `PROJECT_COLORS`、島不重疊（兩兩比較矩形）。
  - `'projectColor：同一個 key 永遠同色'`。
  - `'waitingCount 只算該專案 status 為 waiting 的人'`。
  - `'seatCell 在島內，entryPath 從最左緣經走道到座位'`：`seatCell(i, k).x >= i.x`、`.y + 124 <= i.y + i.h`；`entryPath` 長度 3，第一點 `x === 0`，第二點與第三點 `x` 相同，第一、二點 `y` 相同且 `< island.y`，最後一點 `y` 大於第二點。
  - `'layoutSig：島的位置或大小改變時簽名不同'`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run test/view.test.ts`
Expected: FAIL（`islands` 未定義）

- [ ] **Step 3: 實作**：把 `Room`/`ROOM`/`doorPos`/`DESK_W`/`DESK_H` 換成上面的 `Island`/`ISLAND`/`entryPath`。排序、分組、同名改用 `shortPath` 的邏輯沿用現有 `layout()`；`projectColor` 用檔案內現有的 `hash`（對 `cwd ?? ''`）取餘數 8。島的排列：依序放入，`x > marginX && x + w > maxRowW` 就換行；新行 `y = 上一行 y + 上一行最大島高 + vgap`；`width = 最右島右緣 + marginX`（至少 320），`height = 最後一行底 + marginBottom`（至少 200）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run test/view.test.ts`
Expected: PASS。注意此時 `OfficeScene.ts` 還引用舊名稱，`npm test` 不受影響（測試不載入場景）。

- [ ] **Step 5: Commit**

```bash
git add web/src/view.ts test/view.test.ts
git commit -m "feat: lay out one island per project"
```

---

### Task 3: 向量貼圖烘焙（`art.ts`）與前端型別檢查

**Files:**
- Rewrite: `web/src/art.ts`
- Delete: `web/src/sprites.ts`、`test/sprites.test.ts`
- Modify: `web/src/main.ts`（`Z` 改用 `PIXEL_RATIO`）
- Create: `web/tsconfig.json`
- Modify: `package.json`（`build` 加上前端型別檢查）

**Interfaces:**
- Consumes: Task 1 的 `character/desk/bot/exclamation/extent` 與型別；Task 2 的 `Look`（`view.ts` 既有）。
- Produces（Task 4 依賴）:
  - `const PIXEL_RATIO = 3`
  - `type Pose`、`type DeskState`（重新匯出自 `flat.ts`）
  - `bakeTextures(scene: Phaser.Scene): void`：烘焙 `desk-empty|working|waiting|idle`、`bot-working`、`bot-done`、`exclamation`
  - `deskKey(st: DeskState): string`（回傳 `desk-${st}`，沿用）
  - `ensureChar(scene: Phaser.Scene, pose: Pose, look: Look, shirt: number): string`（簽名沿用，回傳貼圖鍵）
  - `addSprite(scene: Phaser.Scene, key: string, x: number, y: number): Phaser.GameObjects.Image`：建立 Image，使素材的 (0, 0) 落在 `(x, y)`（以貼圖的 `origin` 補償 `extent` 的偏移），縮放 `1 / PIXEL_RATIO`
  - `setSprite(img: Phaser.GameObjects.Image, key: string): void`：換貼圖並更新 origin（用貼圖鍵查到的 extent）

- [ ] **Step 1: 建立 `web/tsconfig.json`**：`strict`、`target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`、`noEmit: true`、`lib: ["ES2022", "DOM"]`、`skipLibCheck: true`、`include: ["src", "../src/state"]`（前端會 import `../../src/state/*.js`）。`package.json` 的 `build` 改為 `tsc && tsc -p web && vite build`。

- [ ] **Step 2: 實作 `art.ts`**：
  - `drawShapes(g: Phaser.GameObjects.Graphics, shapes: Shape[], k: number, dx: number, dy: number)`：依 `t` 呼叫 `fillStyle(parseInt(c.slice(1), 16), a ?? 1)` 後 `fillRoundedRect`（圓角 `r * k`，`r` 為 0 時用 `fillRect`）、`fillCircle`、`fillEllipse(x, y, rx * 2, ry * 2)`、`fillPoints`，所有座標先加 `dx, dy` 再乘 `k`。
  - `bakeSprite(scene, key, sprite)`：若貼圖已存在就返回；用 `extent` 算寬高（各向外取整），建立 `scene.make.graphics({}, false)`，`drawShapes(g, shapes, PIXEL_RATIO, -x0, -y0)`，`g.generateTexture(key, ceil((x1-x0) * PIXEL_RATIO), ceil((y1-y0) * PIXEL_RATIO))`，`g.destroy()`；把 `{ x0, y0, w, h }` 存進模組內的 `Map<string, ...>`（key 為貼圖鍵）供 `addSprite/setSprite` 查詢。
  - `ensureChar` 的貼圖鍵沿用 `char-${pose}-${hair}-${style}-${outfit}-${glasses ? 1 : 0}-${shirt.toString(16)}`；呼叫 `character({ pose, style: look.style, outfit: OUTFITS[look.outfit], glasses: look.glasses, hair: HAIR_COLORS[look.hair], shirt: '#' + shirt.toString(16).padStart(6, '0') })`。
  - 移除所有像素素材（地板、牆、門、窗、書櫃、貓、地毯等）與對 `sprites.ts` 的 import。
  - `main.ts`：`const Z = PIXEL_RATIO;`（從 `art.js` import）。

- [ ] **Step 3: 型別檢查**

Run: `npx tsc -p web`
Expected: 只剩 `OfficeScene.ts` 引用舊名稱（`ROOM`、`doorPos`、`Room`、`bakeTextures` 以外的素材鍵等）的錯誤；`art.ts`、`flat.ts`、`view.ts`、`main.ts` 本身無錯。這些場景錯誤由 Task 4 修掉。

- [ ] **Step 4: 刪除舊檔並跑測試**

Run: `git rm web/src/sprites.ts test/sprites.test.ts && npm test`
Expected: 全過（測試不載入 Phaser）。

- [ ] **Step 5: Commit**

```bash
git add -A web test package.json
git commit -m "feat: bake flat vector textures with Phaser Graphics"
```

---

### Task 4: 場景改畫桌島（`OfficeScene.ts`）

**Files:**
- Modify: `web/src/OfficeScene.ts`

**Interfaces:**
- Consumes: Task 2 的 `layout/ISLAND/seatCell/entryPath/waitingCount/layoutSig/roomKey/Island`；Task 3 的 `bakeTextures/deskKey/ensureChar/addSprite/setSprite/PIXEL_RATIO`。
- Produces: 場景行為（無對外介面）。

這個 task 較大，依序做完下列步驟，每步 `npx tsc -p web` 檢查：

- [ ] **Step 1: 版面與地板**：`this.lay` 改為 `Layout`（`islands`）；`relayout()`、`roomOf`、`cellOf` 改為 `islandOf(e: Employee): Island | undefined` 與 `cellOf`；`drawRoom` 改為 `drawIsland(isl: Island)`；`relayout()` 重畫時先畫整片地板（`this.add.rectangle` 填 `#2d3558`，覆蓋 `lay.width × lay.height`，深度 -100，再疊每 56 單位一條透明度 0.035 的白色細線，用一個 `Graphics`），每次重畫都要把舊物件銷毀（沿用 `roomObjs`，貓的計時器相關程式刪除）。
- [ ] **Step 2: 島底色、招牌、徽章**：每座島畫圓角矩形底色（圓角 22，顏色 = `mix(#2d3558, isl.color, 0.3)`，深度 -90）。招牌：米色圓角板 `#f4ecd6`（高 28、圓角 8）、左側專案色塊（6×16）、專案名 Phaser 文字（粗體 14，色 `#2a2238`，過長用 `fitText` 截斷）；位置 `(isl.x + 16, isl.y - 14)`，深度 `isl.y + 20`。徽章：紅色 `#ff4d4d` 圓角矩形（高 20）加文字「等你 N」，放在招牌右側；做成 `Container` 並記在 `Map<string, { badge: Container; text: Text; tween?: Tween }>`（key 為 `isl.key`）。新增 `private updateSigns(): void`：對每座島用 `waitingCount(this.store.employees.values(), isl.key)` 更新文字與可見性，數量大於 0 時啟動每秒一次、約 ±6% 的放大縮小 tween（已在跑就不重複建），等於 0 時停止 tween 並隱藏。招牌寬度隨有無徽章改變：招牌板固定包含徽章位置的寬度會浪費空間，所以板寬依「專案名寬度 + （徽章可見 ? 徽章寬 : 0）」重畫（用 `Graphics`，每次 `updateSigns` 清除重畫）。
- [ ] **Step 3: 桌子與名牌**：每格（`seatCell`）放桌子 `addSprite(this, deskKey('empty'), c.x + 12, c.y + 66)`（深度 `c.y + 66 + 36`，沿用「桌子在人前面」的排序）與名牌 Text（位置 `(c.x + 6, c.y + 108)`，`PLATE_W = 84`，底色 `rgba(20,23,42,0.7)`，字 9px，過長用 `fitText`）。空桌也畫。`drawDesk` 沿用（換貼圖用 `setSprite`）。
- [ ] **Step 4: 員工**：`PERSON` 改為 `{ x: 48, y: 48 }`（格內人物中心）；人物的 Image 用 `addSprite`，並把素材 (0,0) 放在容器中心偏移 `(-20, -28)`；陰影、氣泡、資訊卡 hover 範圍沿用（`Rectangle(-20, -28, 40, 56)`）；氣泡位置沿用 `-28 - 6 - h / 2`。`charTexture` 改傳整個 `look`（`appearance()` 的回傳）。舉手姿勢（`up`）時 `figure.y = -4`。拿掉 `cup`（桌子自己有馬克杯與蒸氣）。
- [ ] **Step 5: 驚嘆號**：`mark` 改為 `addSprite(this, 'exclamation', -10, -50 - 28)` 的 Image（素材 (0,0) 放在容器中心偏移 `(-10, -78)`，使驚嘆號底部約在頭頂上方 2）；等你回覆時顯示並以 400 ms yoyo tween 上下 4 單位（`EXCL_BOUNCE = 4`）。
- [ ] **Step 6: 助理**：機器人 Image 用 `addSprite`，位置 `(cell.x + 70 + k * 14, cell.y + 78 + k * 4)`（k 為第幾個助理），標籤在機器人下方 `+26`；超過 3 個只顯示前 2 個加 `+N`（沿用）；完成標籤文字改為 `'✓ 完成'`。
- [ ] **Step 7: 進出與走路**：新增 `private walkPath(person, pts: {x:number;y:number}[], setFrame, done?)`：依序對每一段呼叫現有 `walkTo` 的 tween 邏輯（每段 `duration = max(200, dist * 4)`）；`startWalk` 到班時用 `entryPath(island, seat)`，換座位時直接走到新座位（沿用單點行為）；`leave()` 用 `entryPath` 的反向。`upsert` 新員工的起點改為 `entryPath` 第一點（x = 0）。走路中的深度排序沿用 `sortDepth`。
- [ ] **Step 8: 讓錯誤看得見**：`create()` 裡 `this.store.on(...)` 的回呼整段包 `try { ... } catch (e) { console.error(e); }`。在 `upsert`、`leave`、`rebuild`、`relayout` 結尾呼叫 `updateSigns()`（這些會改變 waiting 人數或版面）。
- [ ] **Step 9: 清掉舊引用並型別檢查**

Run: `npx tsc -p web && npm test`
Expected: 無錯誤，測試全過。

- [ ] **Step 10: Commit**

```bash
git add web/src/OfficeScene.ts
git commit -m "feat: draw project islands, signs and badges in the scene"
```

---

### Task 5: 瀏覽器實測、收尾

**Files:**
- Modify: `README.md`（把「像素風」「辦公室」相關描述改成桌島與扁平向量；用 `grep -n "像素\|房間\|辦公室" README.md` 找出要改的句子）
- Modify: `docs/superpowers/specs/2026-10-21-claude-office-design.md`（檔頭加一行：視覺與分區已由 `2026-10-21-flat-vector-project-islands-design.md` 取代）

**Interfaces:** 無。

這個 task 必須在真實瀏覽器（或 headless Chromium）跑，不能只看測試通過。

- [ ] **Step 1: 建置並啟動**

Run: `npm run build`（會一併跑 `tsc -p web`）；另開終端 `npm start`；再開一個終端 `npm run simulate -- --loop`。
Expected: build 無錯誤；`npm start` 印出 `http://127.0.0.1:47823`。

- [ ] **Step 2: 開 `http://127.0.0.1:47823`，逐項確認並記錄（失敗就回到對應 task 修）**
  - 瀏覽器 console 沒有任何錯誤或 `console.error`。
  - 模擬的 4 個 session（api、blog、shop×2）形成 3 座島，島上方有招牌；shop 島有 2 張桌。
  - 員工從畫面最左緣出現，沿島上方走道走到座位，頭頂沒有被畫布上緣切掉。
  - 工作中：綠燈、打字換幀、氣泡；等你回覆：紅色大光暈、桌面紅光、舉手、驚嘆號上下跳、該專案招牌出現「等你 N」徽章並微微跳動；狀態恢復後徽章消失（Review Focus 4）。
  - 閒置：黃燈、馬克杯蒸氣。
  - 助理：機器人出現在桌子前面右下，完成後變綠並顯示「✓ 完成」，3 秒後淡出。
  - 專案最後一個人下班：他走回最左緣的過程中島還在，走出後島消失、後面的島補位。
  - 滑鼠移到員工上：資訊卡內容正確；名牌顯示 session 標題且過長時以「…」截斷。
  - 專案名很長時招牌以「…」截斷。
- [ ] **Step 3: 改 README 與舊設計文件檔頭**（見 Files）。
- [ ] **Step 4: 最終檢查**

Run: `npm test && npx tsc && npx tsc -p web`
Expected: 全過、無錯誤。

- [ ] **Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: describe project islands and flat vector style"
```
