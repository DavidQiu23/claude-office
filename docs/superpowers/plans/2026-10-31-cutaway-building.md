# 剖面大樓辦公室 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Phaser 等角辦公室換成用 DOM 組成的剖面大樓：一個專案一層樓、原生捲動、每層放不下時自己左右捲、電梯面板顯示各層狀態、subagent 也是員工。

**Architecture:** 會不會畫錯的計算（樓層、座位、助理座位、邊緣提示、名牌文字）全部放在純函式 `web/src/floors.ts`，用 vitest 測。DOM 模組（`building.ts` → `floor.ts` → `person.ts`，加上 `elevator.ts`、`card.ts`）每次 store 變動時呼叫 `floorPlan`，把差異套到畫面。人物與家具仍是 `flat.ts`／`furniture.ts` 的圖形清單，由 `sprites.ts` 用 `clay.ts` 烘成 `<img>`。

**Tech Stack:** TypeScript、Vite、Vitest（node 環境，沒有 DOM 測試框架）、Canvas 2D。拿掉 Phaser。

**Spec:** `docs/superpowers/specs/2026-10-31-cutaway-building-design.md`（實作前必讀；兩張示意圖在 `docs/superpowers/specs/assets/2026-10-31-building-*.html`，用瀏覽器打開）。

## Global Constraints

- `src/` 底下（伺服器、hook、安裝程式、reducer）與 `web/src/sync.ts` 一行都不改。
- 尺寸（CSS px）照 spec：層高 200（含 8 樓板）、電梯區寬 80、座位寬 120、右端家具區寬 200、地面高 72、電梯面板寬 40、大樓左邊留 56、右邊距 16；人物 40×56 以 1.5 倍顯示。
- 時間：打字換幀 200ms、走路換幀 140ms、走路速度 120px/s、電梯門 300ms、助理完成後停留 3000ms。
- 顏色：等你處理紅 `#d63434`、輪到你琥珀 `#f2b83d`；名牌卡片色沿用 `OfficeScene.ts` 的 `PLATE_COLORS`；助理名牌底 `#cfe0f7`、字 `#1f3550`；桌子狀態燈沿用 `flat.ts` 的 `LED`。
- 只有真員工會讓電梯燈、邊緣提示、狀態列、分頁標題、「共 N 位」變化；助理永遠不算。
- 畫面文字一律繁體中文；動態文字一律用 `textContent` 放進 DOM（現有規則），不用 `innerHTML` 拼使用者資料。
- commit 訊息用繁體中文、保留 `feat:`/`fix:`/`docs:`/`refactor:`/`test:` 前綴，結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 每個 task 結束前：`npx vitest run` 全綠、`npm run build` 成功。從 Task 4 起，另外在瀏覽器跑該 task 的檢查步驟。
- 瀏覽器檢查一律用隔離的伺服器，不碰使用者在 47823 上的伺服器：
  ```bash
  H=<scratchpad>/home && mkdir -p $H/.claude-office && echo '{"port":47900}' > $H/.claude-office/config.json
  HOME=$H node dist/server/main.js            # 背景執行
  HOME=$H npx tsx scripts/simulate.ts --loop  # 背景執行
  ```
  然後打開 http://127.0.0.1:47900 。

## Review Focus

- 兩個專案資料夾同名、路徑不同：招牌要顯示路徑最後兩層，不能兩層都叫 `api` — Task 1 的 `floorPlan` 同名測試。
- cwd 是空字串或缺值：仍然有一層樓、有專案色，不能讓整棟崩潰 — Task 1 的空 cwd 測試。
- 一個人都沒有：`floorPlan` 回傳 `[]`，畫面是空大廳加提示字，不是白畫面 — Task 1 測試＋Task 4 瀏覽器步驟。
- 員工還在走進來就被請下班，或樓層正在拆時又有人進來：不能留下沒人管的人物、不能讓樓層卡住不拆 — Task 7 的瀏覽器步驟。
- 很長的任務標題或專案名（例如 40 個中文字）：名牌、招牌在自己的寬度內用「…」截斷，不壓到鄰座或窗戶 — Task 4 的瀏覽器步驟（`simulate.ts` 在 Task 3 放一個超長標題）。

---

### Task 1: 樓層配置純函式

**Files:**
- Create: `web/src/floors.ts`
- Modify: `web/src/view.ts`（`oneLine` 加 `export`；`shortPath` 搬到 `floors.ts`）
- Test: `test/floors.test.ts`

**Interfaces:**
- Consumes: `view.ts` 的 `roomKey`、`projectColor`、`nameplate`、`oneLine`；`src/state/types.ts` 的 `Employee`、`Assistant`。
- Produces:
  ```ts
  export const GEO = { floorH: 200, slab: 8, elevatorW: 80, seatW: 120, furnitureW: 200, groundH: 72, panelW: 40, gutter: 56, rightMargin: 16 } as const;
  export const seatCenter = (i: number): number;            // GEO.elevatorW + i * GEO.seatW + GEO.seatW / 2
  export const floorWidth = (desks: number, avail: number): number; // max(avail, elevatorW + desks*seatW + furnitureW)
  export interface Helper { owner: Employee; a: Assistant }  // 在大樓裡的助理（含完成後停留、走出中的）
  export const helperKey = (h: Helper): string;              // `${owner.sessionId}/${a.id}`
  export type Occupant = { kind: 'employee'; emp: Employee } | { kind: 'assistant'; owner: Employee; a: Assistant };
  export interface Seat { index: number; occ: Occupant | null }
  export interface Floor { key: string; level: number; title: string; color: string; desks: number; seats: Seat[] }
  export type Alert = 'waiting' | 'idle' | null;
  export type PlateTone = 'working' | 'waiting' | 'idle' | 'assistant' | 'done';
  export function floorPlan(employees: Employee[], helpers: Helper[], helperSeats: ReadonlyMap<string, number>, minDesks: ReadonlyMap<string, number>): Floor[];
  export function floorAlert(f: Floor): Alert;
  export function plateText(o: Occupant): { text: string; tone: PlateTone };
  ```
  `floorPlan` 回傳 1F 在 index 0；`seats.length === desks`；`helpers` 裡主人不在 `employees` 的、或不在 `helperSeats` 的不放。

- [ ] **Step 1: 寫失敗測試**（`emp()` 工廠照 `test/view.test.ts` 的寫法）
  ```ts
  test('floorPlan：依專案最早到班從 1F 往上排，同時間依路徑', () => {
    const f = floorPlan([emp('a', 'working', { cwd: '/b', folder: 'b', arrivedAt: 5 }), emp('c', 'working', { cwd: '/a', folder: 'a', arrivedAt: 5 }), emp('d', 'working', { cwd: '/z', folder: 'z', arrivedAt: 1 })], [], new Map(), new Map());
    expect(f.map((x) => [x.level, x.title])).toEqual([[1, 'z'], [2, 'a'], [3, 'b']]);
  });
  test('floorPlan：中間一層的人走光後，上面往下遞補', () => { /* 三層 → 拿掉 2F 的人 → levels [1,2]、titles 原 1F 與原 3F */ });
  test('floorPlan：桌數 = max(最大座位+1, 助理座位+1, minDesks)，空座位 occ 為 null', () => {
    const f = floorPlan([emp('a', 'working', { seat: 2 })], [], new Map(), new Map([['/x/proj', 5]]));
    expect(f[0].desks).toBe(5);
    expect(f[0].seats.map((s) => s.occ?.kind ?? null)).toEqual([null, null, 'employee', null, null]);
  });
  test('floorPlan：同名資料夾用路徑最後兩層', () => { /* cwd 'D:\\x\\api' 與 'D:\\y\\api' → titles ['x/api', 'y/api'] */ });
  test('floorPlan：cwd 為空字串或缺值也有一層，顏色在 PROJECT_COLORS 裡', () => { /* 同 view.test 舊的島測試 */ });
  test('floorPlan：沒有人時回傳空陣列', () => expect(floorPlan([], [], new Map(), new Map())).toEqual([]));
  test('floorPlan：助理放在 helperSeats 指定的座位；主人不在就不放', () => { /* helper 座位 1 → seats[1].occ.kind === 'assistant'；owner 不在 employees → 不出現 */ });
  test('floorAlert：等你處理 > 輪到你 > null，只看真員工', () => {
    // [working, idle] → 'idle'；[idle, waiting] → 'waiting'；只有工作中的員工加一位助理 → null
  });
  test('plateText', () => {
    expect(plateText({ kind: 'employee', emp: emp('a', 'waiting', { title: '結帳' }) })).toEqual({ text: '! 結帳', tone: 'waiting' });
    expect(plateText({ kind: 'employee', emp: emp('a', 'idle', { title: '結帳' }) })).toEqual({ text: '✓ 結帳', tone: 'idle' });
    expect(plateText({ kind: 'employee', emp: emp('a', 'working', { title: '結帳' }) })).toEqual({ text: '結帳', tone: 'working' });
    const a = (over: Partial<Assistant>): Assistant => ({ id: 't1', description: '搜尋\n程式碼', status: 'working', startedAt: 0, ...over });
    const o = emp('o');
    expect(plateText({ kind: 'assistant', owner: o, a: a({}) })).toEqual({ text: '↳ 搜尋 程式碼', tone: 'assistant' });
    expect(plateText({ kind: 'assistant', owner: o, a: a({ kind: 'Explore' }) }).text).toBe('↳ Explore · 搜尋 程式碼');
    expect(plateText({ kind: 'assistant', owner: o, a: a({ description: ' ', kind: 'Explore' }) }).text).toBe('↳ 助理');
    expect(plateText({ kind: 'assistant', owner: o, a: a({ status: 'done' }) })).toEqual({ text: '↳ ✓ 完成', tone: 'done' });
  });
  test('seatCenter、floorWidth', () => {
    expect(seatCenter(0)).toBe(140);
    expect(floorWidth(3, 1000)).toBe(1000);
    expect(floorWidth(9, 1000)).toBe(80 + 9 * 120 + 200);
  });
  ```
- [ ] **Step 2: 執行** `npx vitest run test/floors.test.ts`，預期 FAIL（模組不存在）。
- [ ] **Step 3: 實作** `floors.ts`。分組與標題邏輯照 `view.ts` 現有 `layout` 的前半段（`groups`、排序、`dup` 判斷）搬過來；不要動 `layout` 本身（Task 4 才刪）。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠。
- [ ] **Step 5: Commit** `feat: 剖面大樓的樓層配置純函式`

### Task 2: 助理座位與邊緣提示

**Files:**
- Modify: `web/src/floors.ts`
- Test: `test/floors.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Helper`、`helperKey`、`Floor`、`Seat`、`seatCenter`。
- Produces:
  ```ts
  export function assignAssistantSeats(prev: ReadonlyMap<string, number>, employees: Employee[], helpers: Helper[]): Map<string, number>;
  export interface EdgeHint { status: 'waiting' | 'idle'; count: number; target: number } // target = 座位 index
  export function edgeHints(f: Floor, view: { left: number; right: number }): { left: EdgeHint | null; right: EdgeHint | null };
  ```
  `assignAssistantSeats` 規則：只處理主人在 `employees` 裡的 helper；先保留 `prev` 的座位（沒被同專案真員工佔用、沒被已保留的助理佔用）；其餘依 `helpers` 順序，在主人座位右邊找第一個「不是同專案真員工座位、也沒被助理佔用」的 index，上限是目前桌數 `max(真員工最大座位, 已分配助理座位) + 1`；找不到就用該上限（接在最後）。回傳只含這次的 helper。
  `edgeHints`：座位中心 `seatCenter(i)` 不在 `[view.left, view.right]` 裡的算看不到；每一側只算真員工；有 `waiting` 就是 `waiting` 與其人數，否則 `idle`；`target` 是該狀態裡離可見範圍最近的座位。

- [ ] **Step 1: 寫失敗測試**
  ```ts
  test('assignAssistantSeats：坐主人右邊第一張空桌', () => { /* 主人 seat 0、真員工 seat 1、空 2 → 助理拿 2 */ });
  test('assignAssistantSeats：沒有空桌就接在最後', () => { /* 主人 0、真員工 1、2 → 助理拿 3；第二位助理拿 4 */ });
  test('assignAssistantSeats：在的期間座位不變', () => { /* prev {k: 3}，雖然 2 空著仍拿 3 */ });
  test('assignAssistantSeats：真員工撞到助理座位時，助理換位', () => { /* prev {k: 2}，新真員工 seat 2 → 助理拿 3 */ });
  test('assignAssistantSeats：主人不在就不分配', () => { /* helper 的 owner 不在 employees → 回傳的 Map 沒有它的 key */ });
  test('assignAssistantSeats：不同專案的座位互不影響', () => { /* 專案 A 主人 seat 0、專案 B 有真員工 seat 1 → A 的助理仍拿 1 */ });
  test('edgeHints：只算看不到的真員工，紅色優先，target 是最近的那位', () => {
    // 9 張桌：seat 0 waiting、seat 7 idle、seat 8 waiting；view = [seatCenter(2)-60, seatCenter(5)+60]
    // → left: { status: 'waiting', count: 1, target: 0 }、right: { status: 'waiting', count: 1, target: 8 }
    // 把 seat 8 改成 working → right: { status: 'idle', count: 1, target: 7 }
    // 看不到的只有助理 → null
  });
  ```
- [ ] **Step 2: 執行** `npx vitest run test/floors.test.ts`，預期新測試 FAIL。
- [ ] **Step 3: 實作** 上面兩個函式。
- [ ] **Step 4: 執行** `npx vitest run`，預期全綠。
- [ ] **Step 5: Commit** `feat: 助理座位分配與樓層邊緣提示`

### Task 3: 模擬劇本涵蓋所有情境

**Files:**
- Modify: `scripts/simulate.ts`

**Interfaces:**
- Consumes: 現有的 `ev`、`prompt`、`tool`、`spawn`、`done` 輔助函式與 `--loop`。

- [ ] **Step 1: 擴充預設劇本**（不加選項）：
  - 6 個專案：現有的 api、blog、shop，再加 `C:/work/docs`、`C:/work/tools`、`C:/work/crm`；`crm` 有 9 個 session（座位 0–8，那層要左右捲）。
  - `crm` 座位 8 的 session 後來變成等你處理（`Notification` permission_prompt），座位 7 的 `Stop` 變成輪到你。
  - 一個 session 一次派出 3 個 subagent（其中一個帶 `subagent_type: 'Explore'`，一個 `description` 為空），陸續完成。
  - 一個 session 的 `TITLES` 是 40 個中文字的超長標題；一個專案的 `CWD` 最後一層是 30 個字元的超長資料夾名。
  - `docs` 的所有人在劇本後段 `SessionEnd`（整層拆掉），之後再有一個新專案進來（在最上面加蓋）。
  - 劇本最後所有人 `SessionEnd`，`--loop` 時重來。
  - 事件間隔維持 `GAP_MS`；`SIDS` 改成依名稱產生（例如 `crm0`…`crm8`），不要手寫 20 個常數。
- [ ] **Step 2: 驗證** 照 Global Constraints 起隔離伺服器跑一次（舊畫面仍可用），`curl -s 127.0.0.1:47900/state | node -e "..."` 在劇本中段確認有 6 個不同 cwd、`crm` 9 人、有 `waiting` 與帶 `kind` 的助理。
- [ ] **Step 3: Commit** `feat: 模擬劇本涵蓋多樓層、擠滿的樓層與多個助理`

### Task 4: 換掉 Phaser：靜態的大樓

這是切換點：完成後 `npm start` 看到的是大樓（還沒有動畫、電梯面板與正面家具）。

**Files:**
- Create: `web/src/sprites.ts`、`web/src/card.ts`、`web/src/person.ts`、`web/src/floor.ts`、`web/src/building.ts`
- Modify: `web/src/flat.ts`（新增 `deskFront`）、`web/src/main.ts`、`web/index.html`、`web/src/view.ts`、`package.json`、`package-lock.json`
- Delete: `web/src/OfficeScene.ts`、`web/src/art.ts`
- Test: `test/flat.test.ts`、`test/view.test.ts`

**Interfaces:**
- Consumes: Task 1、2 的全部。
- Produces:
  ```ts
  // flat.ts
  export function deskFront(state: DeskState): FlatSprite; // 正面桌：桌面＋正面＋右側螢幕，螢幕光/指示燈用 LED[state]，寬約 80、桌面在 y≈14
  // sprites.ts
  export interface SpriteImg { url: string; x0: number; y0: number; w: number; h: number } // CSS px，(x0,y0) = 素材原點相對圖片左上
  export function spriteImg(key: string, make: () => FlatSprite, scale: number): SpriteImg; // 以 scale × ceil(devicePixelRatio) 烘、toDataURL、依 key+scale 快取
  export function charImg(pose: Pose, look: Look): SpriteImg; // character({ ..., chair: true })，scale 1.5，衣服色 = PALETTE[look.shirt]
  // card.ts（從 OfficeScene.ts 搬來的 InfoCard，外觀與按鈕行為不變）
  export class InfoCard { show(e: Employee, left: number, top: number): void; scheduleHide(): void; hide(): void }
  // person.ts
  export type Act = 'work' | 'up' | 'idle' | 'walk';
  export class Person { readonly el: HTMLElement; constructor(look: Look); setAct(a: Act): void; setBubble(on: boolean): void; placeAt(x: number): void; destroy(): void }
  // floor.ts
  export class FloorView {
    readonly el: HTMLElement; readonly people: HTMLElement; // people = 人物圖層，Person.el 放這裡
    constructor(hooks: { hover(o: Occupant, at: DOMRect): void; unhover(): void });
    update(f: Floor, avail: number): void; // 寬度、招牌、電梯門樓號、桌子（deskFront）、名牌（plateText）
    destroy(): void;
  }
  // building.ts
  export class Building { constructor(root: HTMLElement, store: OfficeStore) }
  ```
  `Person` 的 `work` 每 200ms 換 `sit0`/`sit1`；`up` 用 `up`；`idle` 用 `idle` 加泡泡（沿用 `drawBubble` 的外觀，畫在小 canvas）；`walk` 每 140ms 換 `walk0`/`walk1`。滑過人物時呼叫 `hooks.hover(occ, el.getBoundingClientRect())`。

- [ ] **Step 1: 寫失敗測試** `test('deskFront：四種狀態都畫得出來，燈色是 LED[state]', ...)`：每種狀態 `checkSprite(deskFront(s))`，且 `shapes.some((sh) => sh.c === LED[s])`。
- [ ] **Step 2: 執行** `npx vitest run test/flat.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作 `deskFront`**，跑 `npx vitest run test/flat.test.ts` 通過。
- [ ] **Step 4: 實作 DOM 模組與切換**：
  - `building.ts`：store 的每個事件都重算 `floorPlan`（這個 task 還沒有助理與走路：`helpers` 傳 `[]`）。樓層 DOM 由上到下 = level 由大到小。人物直接 `placeAt(seatCenter(seat))`、`setAct` 依狀態（working → work、waiting → up、idle → idle 加泡泡）。`floorPlan` 回傳空陣列時顯示空大廳與兩行提示字（spec「沒有人上班」）。
  - `main.ts`：刪掉 Phaser 設定與 `fitZoom`／`fit`；`new Building(document.getElementById('building')!, store)`；狀態列與分頁標題的程式不動。
  - `index.html`：`#game` 換成 `#building`；樓層、桌子、名牌（13px、`max-width: 112px`、`text-overflow: ellipsis`、卡片色照 `PLATE_COLORS`）、招牌（專案色不透明度 0.9、白色粗體、`ellipsis`）的 CSS。
  - `view.ts`：刪掉 `layout`、`columnsFor`、`seatCell`、`entryPath`、`layoutSig`、`plateWidths`、`plateFit`、`plateMaxW`、`signFit`、`signMaxW`、`fitMiddle`、`statusCount`、`ISLAND`、`BASE_W`、`BASE_H`、`DOOR_X`、`SEAT`、`PLATE`、`SIGN_FONT`、`Island`、`Layout` 等只給舊畫面用的東西；`test/view.test.ts` 刪掉對應測試。
  - `iso.ts` 只留 `toScreen`（`flat.ts`、`clay.ts`、`furniture.ts` 到 Task 9 前還在用）；刪掉它的鏡頭、島、名牌、深度函式（它們用到剛刪的 `Island`）。`test/iso.test.ts` 只留 `toScreen` 測試；`test/flat.test.ts` 刪掉用到 `SEAT` 的「座位素材」測試。
  - 刪 `OfficeScene.ts`、`art.ts`；`npm uninstall phaser`。
  - `flat.ts` 的 iso 素材與 `furniture.ts` 先留著（Task 9 才換）。
  - 資訊卡位置：`card.show(e, rect.right + 4, rect.top - 40)`（`InfoCard.show` 本來就會貼齊視窗邊界）。
- [ ] **Step 5: 執行** `npx vitest run` 全綠、`npm run build` 成功，且 `dist/web/assets/*.js` 比 1.7MB 小很多（記下數字）。
- [ ] **Step 6: 瀏覽器檢查**（Global Constraints 的隔離伺服器＋模擬）：
  - 各專案一層、1F 在下；招牌是「NF 專案名」；同名資料夾顯示最後兩層。
  - 名牌顏色與前綴正確；40 字標題與 30 字資料夾名都在自己的寬度內截斷，不壓到鄰座。
  - 員工、空桌、站起來舉手、閉眼加泡泡、打字換幀都看得到。
  - 滑到員工出現資訊卡，「請他下班」有效（人消失）。
  - 劇本跑完所有人下班後是空大廳加提示字。console 沒有錯誤。
- [ ] **Step 7: Commit** `feat: 拿掉 Phaser，畫面改成 DOM 組成的剖面大樓`

### Task 5: 整頁捲動與電梯面板

**Files:**
- Create: `web/src/elevator.ts`
- Modify: `web/src/building.ts`、`web/index.html`

**Interfaces:**
- Consumes: Task 1 的 `floorAlert`、`Floor`；Task 4 的 `FloorView.el`。
- Produces: `export class ElevatorPanel { constructor(root: HTMLElement); update(floors: { level: number; title: string; alert: Alert; el: HTMLElement }[]): void }`

- [ ] **Step 1: 實作**：
  - 狀態列 `position: sticky; top: 0`。大樓區塊 `min-height: calc(100vh - 狀態列高)`、內容靠底；上方是夜空（這個 task 先用 CSS 漸層＋星點，Task 9 再加城市剪影與屋頂細節）、下方地面 72px。
  - 第一次 `reset` 後捲到頁面最底。新樓層加在上方時畫面不跳：大樓容器用 `overflow-anchor: auto`；`CSS.supports('overflow-anchor', 'auto')` 為 false 時，加蓋前後補捲新增的高度。
  - `ElevatorPanel`：`position: fixed` 左側垂直置中，寬 40；一顆按鈕一層，最高樓在上；燈色依 `alert`（紅、琥珀、暗）；`title` 屬性 = 專案名；點了 `el.scrollIntoView({ block: 'center', behavior: 'smooth' })`；用 `IntersectionObserver`（`threshold: 0`）追蹤看得到的樓層，連續的看得到的按鈕外面畫一個半透明框；面板高度超過視窗時面板本身可以捲。
- [ ] **Step 2: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 3: 瀏覽器檢查**：視窗高約 700px 時：
  - 少於 3 層時大樓站在底部、上方是夜空，沒有空白。
  - 6 層時打開頁面停在最底；電梯燈色跟各層狀態一致（`crm` 變紅、有人輪到你的層變琥珀）；框住的按鈕跟捲動位置一致；點按鈕捲到那層。
  - 捲在中間時有新專案加蓋，畫面停在原本的樓層。
- [ ] **Step 4: Commit** `feat: 整頁原生捲動與電梯樓層面板`

### Task 6: 樓層左右捲與邊緣提示

**Files:**
- Modify: `web/src/floor.ts`、`web/src/building.ts`、`web/index.html`

**Interfaces:**
- Consumes: Task 2 的 `edgeHints`、`EdgeHint`；Task 1 的 `floorWidth`、`seatCenter`。
- Produces: `FloorView.scrollToSeat(i: number): void`（平滑捲到讓座位置中）。

- [ ] **Step 1: 實作**：
  - 樓層內容寬 `floorWidth(desks, avail)`，`avail = 視窗寬 − 56 − 16`；超過就 `overflow-x: auto`。
  - 左右各 22px 暗影，捲到底的那一側不顯示。
  - 邊緣提示：`scroll` 與 `resize` 時用 `edgeHints(f, { left: scrollLeft, right: scrollLeft + clientWidth })` 更新；紅色「! N ›」（左側「‹ ! N」）、琥珀「✓ N ›」；點了 `scrollToSeat(hint.target)`。
  - 頁面捲動或任何樓層左右捲時 `card.hide()`。
- [ ] **Step 2: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 3: 瀏覽器檢查**：`crm` 那層可以左右捲；座位 8 變成等你處理時右緣出現紅色提示，點了捲過去、提示消失；把視窗拉寬到放得下時捲動與提示都不見；捲動時資訊卡會藏起來。
- [ ] **Step 4: Commit** `feat: 樓層放不下時左右捲，看不到的人在等你時邊緣提示`

### Task 7: 搭電梯上下班

**Files:**
- Modify: `web/src/person.ts`、`web/src/floor.ts`、`web/src/building.ts`、`web/index.html`

**Interfaces:**
- Produces:
  - `Person.walkTo(x: number, done?: () => void): void` — 從目前的實際位置（`getComputedStyle` 的 left，或自己記的值）用 CSS `transition: left <dist/120>s linear` 走到 `x`，期間 `setAct('walk')`；再呼叫會取消前一次的 `done` 並從目前位置轉向。
  - `FloorView.openDoor(): Promise<void>` — 電梯門開 300ms、停一下、關 300ms；`FloorView.doorX: number`（電梯門中心）。
  - `building.ts` 內部：`leaving: Map<string, { emp: Employee; person: Person }>`，`floorPlan` 的 `employees` = store 裡的人＋leaving 的人。

- [ ] **Step 1: 實作**：
  - `upsert` 新人（非 reset）：`openDoor()`，人從 `doorX` 出現、`walkTo(seatCenter(seat))`，到了再依狀態 `setAct`。
  - `leave`：放進 `leaving`，站起來 `walkTo(doorX)`，到了 `openDoor()`、移除人物、從 `leaving` 刪掉、重算 `floorPlan`（這時那層沒人才會被拆）。
  - 座位改變（`seat` 變了）：`walkTo` 新座位。
  - 走路途中被請下班或換座位：直接 `walkTo` 新目的地（`walkTo` 會從目前位置轉向）。
  - `reset`：清掉所有人物（含 leaving），全部直接 `placeAt`，不播動畫。
- [ ] **Step 2: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 3: 瀏覽器檢查**：
  - 新 session 從電梯門走出來坐下；`SessionEnd` 走回電梯；`docs` 最後一人進電梯後才拆層、上面往下遞補、電梯面板更新。
  - 人還在走進來時在資訊卡按「請他下班」：轉身走回電梯，沒有殘留人物。
  - 重啟隔離伺服器觸發重新連線：大家直接坐在位子上。console 沒有錯誤。
- [ ] **Step 4: Commit** `feat: 員工搭電梯進出，最後一人離開才拆樓層`

### Task 8: 助理也是員工

**Files:**
- Modify: `web/src/building.ts`、`web/src/card.ts`、`web/src/floor.ts`、`web/index.html`

**Interfaces:**
- Consumes: Task 1 的 `Helper`、`helperKey`、`plateText`；Task 2 的 `assignAssistantSeats`；Task 7 的 `walkTo`、`openDoor`。
- Produces: `InfoCard.showHelper(owner: Employee, a: Assistant, left: number, top: number): void` — 類型、描述（空的寫「（無描述）」）、主人的 `nameplate`、狀態「工作中／完成」、開始時間 `formatTime(a.startedAt)`；沒有「請他下班」。

- [ ] **Step 1: 實作**（`building.ts`）：
  - 在大樓裡的 helper = 每位員工 `assistants` 裡 `working` 的 ＋ 變成 `done` 後 3000ms 內的（第一次看到 `done` 時記時間）＋ 正在走回電梯的。`helperSeats = assignAssistantSeats(prev, employees, helpers)`，結果存起來當下一次的 `prev`。
  - 新 helper 從電梯走到座位打字；`done` 換 `idle` 姿勢（沒有泡泡）；3000ms 後、或工作中卻從清單消失、或主人離開時，走回電梯離開。
  - 外觀 `appearance(helperKey(h))`；名牌用 `plateText` 的 `assistant`／`done` tone（`#cfe0f7` 底、`#1f3550` 字）。
  - `minDesks`：每次把 `floorPlan` 回傳各層的 `desks` 存回 `Map<key, number>`，該層拆掉時刪掉（助理走了空桌保留）。
  - 滑到助理身上呼叫 `card.showHelper(...)`。
- [ ] **Step 2: 執行** `npx vitest run`、`npm run build`。
- [ ] **Step 3: 瀏覽器檢查**：3 個 subagent 從電梯走出來坐在主人右邊的空桌（沒有空桌就接在最後、樓層變寬）；名牌「↳ 描述」「↳ Explore · 描述」「↳ 助理」；完成後「↳ ✓ 完成」、3 秒後走回電梯；空桌留著；助理在工作時電梯燈、狀態列、分頁標題都不變；助理卡片內容正確、沒有「請他下班」。
- [ ] **Step 4: Commit** `feat: subagent 以員工身分坐在主人那層`

### Task 9: 正面家具與場景，刪掉等角程式

**Files:**
- Modify: `web/src/furniture.ts`（重寫）、`web/src/flat.ts`、`web/src/clay.ts`、`web/src/floor.ts`、`web/src/building.ts`、`web/index.html`
- Delete: `web/src/iso.ts`（Task 4 後只剩 `toScreen`）、`test/iso.test.ts`
- Test: `test/furniture.test.ts`（重寫）、`test/flat.test.ts`、`test/clay.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // furniture.ts：每個建構函式回傳正面 FlatSprite，原點 = 物件底邊中點（地板線）
  export function waterCooler(): FlatSprite; vending(): FlatSprite; plant(): FlatSprite; bookshelf(): FlatSprite; copier(): FlatSprite; sofa(): FlatSprite; floorLamp(): FlatSprite; sideTable(): FlatSprite; nightWindow(): FlatSprite;
  export const SETS: { id: string; items: { id: string; make: () => FlatSprite }[] }[]; // 至少三組
  export function furnitureSet(key: string): (typeof SETS)[number]; // 依 roomKey 雜湊挑一組，同 key 永遠同一組
  // clay.ts／flat.ts：shadow 改成正面：中心 (fx, fy) 就是素材座標，橢圓 rx = r、ry = r / 3
  ```
- [ ] **Step 1: 寫失敗測試**：
  - `furniture.test.ts`：每個建構函式 `checkSprite` 通過；每個 `SETS` 的組合總寬（`extent` 寬 + 間隔 12）≤ 200 − 24；`furnitureSet` 對同一個 key 回傳同一組、對 20 個不同 key 至少用到兩組以上。
  - `clay.test.ts` 的 `softShadow`：三層橢圓中心在 `(fx, fy)`、半徑 `r * m` 與 `r / 3 * m`。
  - `flat.test.ts`／`clay.test.ts` 的 extent 投影測試改成正面版本。
- [ ] **Step 2: 執行**，預期 FAIL。
- [ ] **Step 3: 實作**：重寫 `furniture.ts`；`flat.ts` 刪 `isoBox`、`isoChair`、`isoDesk`、`isoRoom`、`quad`、`Void`、`FLOOR`、`WALL_Z` 與刪完沒人用的輔助函式，`extent`／`softShadow` 改成正面投影；刪 `iso.ts`、`test/iso.test.ts` 與其他測試中的 iso 部分。`floor.ts` 右端放 `furnitureSet(f.key)`、後牆每 240px 一扇 `nightWindow`（從招牌右邊開始）。`building.ts`／CSS 補上城市剪影、屋頂、人行道細節。
- [ ] **Step 4: 執行** `npx vitest run` 全綠、`npm run build` 成功、`grep -rn "iso\.js\|toScreen" web/src` 沒有結果。
- [ ] **Step 5: 瀏覽器檢查**：每層右端家具不同、同一層重新整理後不變；窗戶不壓到招牌；上方是星空與城市剪影、最高樓有屋頂、底部人行道；console 沒有錯誤。
- [ ] **Step 6: Commit** `feat: 正面家具與夜景，刪掉等角程式`

### Task 10: 文件與截圖

**Files:**
- Modify: `README.md`、`docs/images/office.png`、`docs/superpowers/specs/2026-10-29-isometric-office-design.md`、`2026-10-29-iso-office-objects-design.md`、`2026-10-29-iso-office-slanted-desk.md`、`2026-10-30-iso-office-modern-desk.md`

- [ ] **Step 1: README**：功能清單與畫面說明改成大樓（樓層、電梯面板、左右捲與邊緣提示、搭電梯、助理也是員工）；刪掉等角、鏡頭、自由控制鏡頭、Phaser 相關段落；「開發」段落的檔案說明照新的模組；每一句都對照程式碼確認（照 commit `1e38371` 的做法）。
- [ ] **Step 2: 截圖**：隔離伺服器跑模擬到中段（有紅、琥珀、助理、要捲的樓層），截整個視窗存成 `docs/images/office.png`，README 的圖說改成描述這張圖的實際內容。
- [ ] **Step 3: 舊 spec 檔頭**：四份各加一行「已由 `2026-10-31-cutaway-building-design.md` 取代（畫面部分）。」
- [ ] **Step 4: 最終檢查**：`npx vitest run`、`npm run build`；照 spec 的「瀏覽器檢查清單」1–10 全部跑一遍。
- [ ] **Step 5: Commit** `docs: README 與截圖改成剖面大樓`
