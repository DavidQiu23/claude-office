# 畫風重新設計（手繪紙張背景＋日式漫畫人物）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把剖面大樓的美術全部換成「手繪紙張背景＋日式漫畫人物與物件」，依本地時間顯示白天或夜晚；版面、狀態規則、動作時序都不變。

**Architecture:** 人物與物件改由純函式產生 SVG 標記字串（`figure.ts`、`objects.ts`，可在 vitest 的 node 環境測），DOM 端用 `innerHTML`／`<use>` 放上去；姿勢與漫符是 CSS 動畫，由 `data-act`／`data-bubble` 控制。所有顏色是 CSS 變數，`<html data-time>` 決定用白天或夜晚那組。拿掉 Canvas 黏土畫法（`clay.ts`、`flat.ts`、`sprites.ts`）。

**Tech Stack:** TypeScript、Vite、Vitest（node 環境，沒有 DOM 測試框架）、SVG、CSS。

**Spec:** `docs/superpowers/specs/2026-11-01-manga-paper-redesign-design.md`（實作前必讀，所有顏色、座標、時間以它為準）；示意圖 `docs/superpowers/specs/assets/2026-11-01-manga-paper-final.html`（用瀏覽器打開，人物會動）。

## Global Constraints

- `src/` 底下（伺服器、hook、安裝程式、reducer）與 `web/src/sync.ts`、`web/src/floors.ts`、`web/src/door.ts` 的邏輯一行都不改。
- 版面不變：`GEO` 全部數值、人物框 60×84 放在 `top: 74px`、名牌 `top: 150px`／13px／最寬 112、招牌 `SIGN_X`／`SIGN_MAX_W`、`windowXs`、`furnitureSet` 的挑選規則。
- 時間不變：走路 120px/s、電梯門 300ms、`STAND_MS` 300、助理完成後停留 3000ms。新的動畫時間照 spec「姿勢與漫符」：打字 0.42s、揮手 0.8s、點頭與 zZ 2.6s、集中線／「！」框／汗滴 1.6s、噠噠閃 0.84s、走路擺動 0.56s、坐下站起過場 300ms、天線閃 1.8s。
- 顏色只用 spec「主題變數」表與「色票」裡的值；三種狀態色 `#d63434`／`#f2b83d`／`#6fae7a` 日夜相同。
- **SVG 顏色規則**：`figure.ts`、`objects.ts` 產生的標記裡，顏色一律放在 `style="..."` 或 class，**不可**出現帶顏色的 `fill="..."`／`stroke="..."` 屬性（`fill="none"` 可以）。`<symbol>` 裡要依日夜顯示的群組用 `style="opacity:var(--day)"`／`style="opacity:var(--night)"`（文件的 CSS 選擇器進不了 `<use>` 的影子樹，只有繼承的變數進得去）。
- 動態文字（標題、prompt、描述、專案名）一律用 `textContent` 放進 DOM；只有 `figure.ts`／`objects.ts` 產生、不含任何使用者資料的 SVG 字串可以用 `innerHTML`。
- 畫面文字一律繁體中文。commit 訊息用繁體中文、保留 `feat:`/`fix:`/`docs:`/`refactor:`/`test:` 前綴，結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。直接 commit 在目前分支。
- 每個 task 結束前：`npx vitest run` 全綠、`npm run build` 成功。從 Task 4 起，另外在瀏覽器跑該 task 的檢查步驟，`?time=day` 與 `?time=night` 各看一次。
- 瀏覽器檢查一律用隔離的伺服器，不碰使用者在 47823 上的伺服器（`<scratchpad>` 換成 session 的 scratchpad 路徑）：
  ```bash
  npm run build
  H=<scratchpad>/home && mkdir -p $H/.claude-office && echo '{"port":47900}' > $H/.claude-office/config.json
  HOME=$H node dist/server/main.js            # 背景執行
  HOME=$H npx tsx scripts/simulate.ts --loop  # 背景執行
  ```
  然後打開 http://127.0.0.1:47900/?time=day 與 http://127.0.0.1:47900/?time=night 。

## Review Focus

- 頁面開著跨過 18:00 或 6:00：一分鐘內自動換配色，不必重新整理 — Task 1 的 `startTheme` 假計時器測試。
- `<use>` 引用的桌子、窗、家具在夜晚還是白天的顏色（顏色寫成屬性、或用選擇器控制影子樹裡的元素）— Task 2、Task 3 的「沒有顏色屬性」測試，加上 Task 4 的日夜瀏覽器檢查。
- 一層坐滿 8 人（crm）時，集中線、「！」框、汗滴、zZ 蓋到隔壁的人或名牌 — Task 2 的 `FX_BOXES` 範圍測試，加上 Task 5 的瀏覽器檢查。
- 助理完成後（`idle` 但沒有泡泡）冒出 zZ 或打勾泡泡，看起來像「輪到你」— Task 5 的 CSS 規則（漫符要 `data-act="idle"` 且 `data-bubble="on"`）與瀏覽器檢查。
- 開了「減少動態」時漫符消失，狀態反而看不出來 — Task 5 的 CSS 規則：減少動態只停動畫、漫符停在可見的那一格。

---

### Task 1: 主題切換與 CSS 搬家

完成後畫面看起來與現在完全一樣，只是 CSS 搬進檔案、`<html>` 多了 `data-time`。

**Files:**
- Create: `web/src/theme.ts`、`web/src/vite-env.d.ts`、`web/src/styles/theme.css`、`web/src/styles/building.css`、`web/src/styles/figure.css`、`web/src/styles/ui.css`
- Modify: `web/index.html`（`<style>` 全部搬走，只留骨架）、`web/src/main.ts`
- Test: `test/theme.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // theme.ts
  export type TimeOfDay = 'day' | 'night';
  export function timeOfDay(date: Date): TimeOfDay;           // 本地 6:00（含）–18:00（不含）為 day
  export function themeOverride(search: string): TimeOfDay | null; // ?time=day / ?time=night，其他回傳 null
  export const THEME_CHECK_MS = 60_000;
  /** 有覆寫就固定；否則立刻 apply 一次，之後每 THEME_CHECK_MS 檢查，有變才再 apply。回傳停止函式 */
  export function startTheme(apply: (t: TimeOfDay) => void, now?: () => Date, search?: string): () => void;
  ```
  CSS 變數（`theme.css`）：spec「主題變數」表的全部變數，`:root[data-time="day"]` 與 `:root[data-time="night"]` 各一組；另加 `--day`（白天 1、夜晚 0）與 `--night`（白天 0、夜晚 1）。三種狀態色與螢幕光也在這裡。共用 class：`.ink`（`stroke: var(--ink); stroke-width: 1.6`）、`.mk`（`stroke: var(--fig-ink); stroke-width: 1.5`）、`.mk-thin`（1.1）、`.tone`（`fill: url(#tone)`），全部 `stroke-linecap/linejoin: round`。

- [ ] **Step 1: 寫失敗測試** `test/theme.test.ts`：
  - `timeOfDay`：`new Date(2026, 10, 1, 5, 59)` → `night`、`6:00` → `day`、`17:59` → `day`、`18:00` → `night`、`0:00` → `night`。
  - `themeOverride`：`'?time=day'` → `day`、`'?time=night'` → `night`、`'?x=1&time=night'` → `night`、`'?time=noon'` → `null`、`''` → `null`。
  - `startTheme`（`vi.useFakeTimers()`）：`now` 先回傳 17:59，呼叫後 `apply` 收到 `['day']`；把 `now` 改成 18:00、前進 `THEME_CHECK_MS`，`apply` 收到 `['day', 'night']`；再前進一次（還是 18:00）不再呼叫；呼叫回傳的停止函式後前進時間不再呼叫。
  - `startTheme` 帶 `search='?time=night'` 且 `now` 是中午：`apply` 只收到 `['night']`，前進時間也不再呼叫。
- [ ] **Step 2: 執行** `npx vitest run test/theme.test.ts`，預期 FAIL（找不到 `theme.js`）。
- [ ] **Step 3: 實作 `theme.ts`**（`startTheme` 的 `now` 預設 `() => new Date()`、`search` 預設 `location.search`）。跑 `npx vitest run test/theme.test.ts` 通過。
- [ ] **Step 4: CSS 搬家**：把 `web/index.html` 的 `<style>` 原封不動搬到四個檔案（狀態列與資訊卡以外的介面 → `ui.css`：`#top`、`#summary`、`#elevator`、`.elev-*`；`.person` 相關 → `figure.css`；其餘 → `building.css`），`theme.css` 寫入新變數與共用 class（這個 task 還沒有元素用它們）。`vite-env.d.ts` 內容 `/// <reference types="vite/client" />`。`main.ts` 最前面依序 `import './styles/theme.css'`、`building.css`、`figure.css`、`ui.css`，並在建立 `Building` 之前呼叫 `startTheme((t) => { document.documentElement.dataset.time = t; })`。
- [ ] **Step 5: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 6: 瀏覽器檢查**：畫面與搬家前一樣（沒有掉樣式）；`?time=night` 時 `document.documentElement.dataset.time === 'night'`，`?time=day` 時是 `day`，不帶參數時與目前時間相符。console 沒有錯誤。
- [ ] **Step 7: Commit** `refactor: CSS 搬進檔案，依時間標記白天或夜晚`

### Task 2: 漫畫人物 SVG

**Files:**
- Create: `web/src/svg.ts`、`web/src/figure.ts`
- Modify: `web/src/view.ts`（新增 `SHIRT_COLORS`、`HAIR_COLORS`；`appearance` 改用 `SHIRT_COLORS.length`，結果範圍不變；`PALETTE` 先保留給舊的 `sprites.ts`／`card.ts`，Task 8 刪）
- Test: `test/figure.test.ts`、`test/view.test.ts`

**Interfaces:**
- Consumes: `Look`、`appearance`（`view.ts`）。
- Produces:
  ```ts
  // svg.ts
  export const esc: (s: string) => string;  // & < > " 跳脫
  /** <name a="v" ...>children</name>；值為 undefined 的屬性略過；children 省略時自我關閉 */
  export function tag(name: string, attrs: Record<string, string | number | undefined>, children?: string): string;
  // view.ts
  export const SHIRT_COLORS: string[]; // spec「色票」的 8 種衣服色
  export const HAIR_COLORS: string[];  // spec「色票」的 8 種髮色
  // figure.ts
  export const FIG = { w: 60, h: 84 } as const;
  /** 漫符在人物座標裡的外框（人物座標 x 30 = 座位中心；座位 ±60 → x −30 到 90） */
  export const FX_BOXES: Record<'work' | 'wait' | 'turn', { x0: number; y0: number; x1: number; y1: number }>;
  export function figureSvg(look: Look): string;  // <svg class="figure" viewBox="0 0 60 84" overflow="visible">…
  export function avatarSvg(look: Look): string;  // 資訊卡頭像：頭與肩膀、睜眼，viewBox 只框頭肩
  ```
  `figureSvg` 的群組（class）：`chair`、`fig`（底下 `leg-l`、`leg-r`、`hair-back`、`arm-l`、`body`、`arm-r`、`head`）、`fx-work`、`fx-wait`、`fx-turn`。`head` 裡三種表情各一個群組：`face-work`、`face-wait`、`face-turn`（由 CSS 依 `data-act` 顯示一個）。座標、髮型 6 種、衣服 3 種、眼鏡、網點位置、漫符內容照 spec「人物」；示意圖的 `seat()` 是可參考的寫法。衣服色 `SHIRT_COLORS[look.shirt]`、髮色 `HAIR_COLORS[look.hair]` 直接寫在 `style` 裡；墨線用 class `mk`／`mk-thin`，網點用 class `tone`，膚色 `style="fill:var(--skin)"`，漫符顏色 `var(--fx)`。

- [ ] **Step 1: 寫失敗測試** `test/figure.test.ts`：
  - `test('所有外觀組合都畫得出來')`：`style` 0–5 × `outfit` 0–2 × `glasses` 兩種 × `hair`、`shirt` 取 0 與 7，`figureSvg` 含 `viewBox="0 0 60 84"`。
  - `test('每個部件與漫符群組都在')`：上面列的 11 個 class 加三個 `face-*` 都出現（`class="… arm-l…"` 用 `/class="[^"]*\barm-l\b/` 檢查）。
  - `test('同一個外觀每次相同')`：`figureSvg(appearance('abc')) === figureSvg(appearance('abc'))`。
  - `test('髮型與衣服真的不同')`：固定其他欄位，6 種 `style` 產生 6 個不同字串；3 種 `outfit` 產生 3 個不同字串；`glasses` true/false 不同。
  - `test('顏色不寫在屬性上')`：`figureSvg` 與 `avatarSvg` 都不符合 `/\s(fill|stroke)="(?!none")/`。
  - `test('漫符在自己的座位內')`：三個 `FX_BOXES` 都 `x0 >= -30 && x1 <= 90`。
  - `test('avatarSvg 對所有外觀都畫得出來')`：同第一個測試的組合，字串以 `<svg` 開頭。
  - `test/view.test.ts` 加：`SHIRT_COLORS`、`HAIR_COLORS` 各 8 個 `#rrggbb`；`appearance` 的 `hair`、`shirt` 小於 8。
- [ ] **Step 2: 執行** `npx vitest run test/figure.test.ts test/view.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作 `svg.ts`、`figure.ts` 與 `view.ts` 的色票**。`FX_BOXES` 要與實際畫的漫符座標一致（集中線以頭中心 (30, 28) 為圓心、最遠半徑 52；「！」框在頭右上；汗滴在頭左；「噠噠」在左下；泡泡與 zZ 在頭的兩側上方）。
- [ ] **Step 4: 執行** `npx vitest run` 全綠、`npm run build` 成功（`figure.ts` 還沒有人用，只要型別檢查過）。
- [ ] **Step 5: Commit** `feat: 漫畫人物的 SVG 產生器`

### Task 3: 漫畫物件 SVG

**Files:**
- Create: `web/src/objects.ts`
- Test: `test/objects.test.ts`

**Interfaces:**
- Consumes: `tag`（`svg.ts`）。
- Produces:
  ```ts
  export type DeskState = 'empty' | 'working' | 'waiting' | 'idle';
  export type FurnitureId = 'waterCooler' | 'vending' | 'plant' | 'bookshelf' | 'copier' | 'sofa' | 'floorLamp' | 'sideTable';
  export type ObjectId = `desk-${DeskState}` | 'window' | FurnitureId;
  /** 原點 = 底邊中點；symbol 的 viewBox = `${-w/2} ${-h} ${w} ${h}`；standX = 人使用它時站的 x 偏移（子專案 2 用） */
  export interface ObjectSpec { w: number; h: number; standX: number }
  export const OBJECTS: Record<ObjectId, ObjectSpec>;
  /** 隱藏的 <svg>：<defs> 裡有 <pattern id="tone">（4×4、中心半徑 0.95 的點，style fill var(--fig-ink)、opacity var(--tone-opacity)）與每個 ObjectId 的 <symbol id> */
  export function defsSvg(): string;
  ```
  尺寸：家具沿用現在的寬高（`waterCooler` 28×78、`vending` 56×112、`plant` 34×74、`bookshelf` 60×104、`copier` 50×68、`sofa` 92×46、`floorLamp` 28×102、`sideTable` 30×37），`layoutSet` 排出來的位置才會跟現在一樣；`window` 70×52（含窗台）。四種桌子都是 112×76：放在座位中心、底邊在樓層 y 192，桌面在 symbol 的 y −48.5（＝樓層 y 143.5，與現在相同），螢幕在 x 20–52、y −74 到 −48，正面（名牌貼的地方）在 y −42 到 −23。桌子狀態的螢幕色、桌面混紅、蒸氣、檯燈（只有非空桌、`style="opacity:var(--night)"`）照 spec「桌子」。窗的白雲用 `opacity:var(--day)`、星星與月亮用 `opacity:var(--night)`；販賣機燈箱與立燈的暖光用 `opacity:var(--night)`。

- [ ] **Step 1: 寫失敗測試** `test/objects.test.ts`：
  - `test('每個物件都有正的寬高')`：`Object.values(OBJECTS)` 的 `w`、`h` 都 > 0，`standX` 是有限數。
  - `test('defsSvg 有網點與每個物件的 symbol，id 不重複')`：含 `<pattern id="tone"`；每個 `ObjectId` 都有 `<symbol id="<id>"`；所有 `id="…"` 不重複。
  - `test('symbol 的 viewBox 依原點在底邊中點')`：每個 `<symbol id="x" viewBox="…">` 的 viewBox 等於 `${-w/2} ${-h} ${w} ${h}`。
  - `test('四種桌子都存在且彼此不同')`。
  - `test('顏色不寫在屬性上')`：`defsSvg()` 不符合 `/\s(fill|stroke)="(?!none")/`。
  - `test('日夜群組用變數控制')`：`window` 的 symbol 同時含 `opacity:var(--day)` 與 `opacity:var(--night)`；`desk-empty` 不含 `var(--night)`，其他三種桌子含。
- [ ] **Step 2: 執行** `npx vitest run test/objects.test.ts`，預期 FAIL。
- [ ] **Step 3: 實作 `objects.ts`**：畫法照 spec「物件」與示意圖（`furnish()`、`seat()` 的桌子部分），漫畫墨線用 class `mk`／`mk-thin`、暗面 class `tone`；木頭、桌面、螢幕等主題色用 `style="fill:var(--desk)"` 這類寫法；物件自己的固定色（販賣機紅、書背、盆栽綠）直接寫在 `style`。
- [ ] **Step 4: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 5: Commit** `feat: 漫畫物件的 SVG symbol 與物件表`

### Task 4: 樓層的桌子、窗、家具換成 SVG

完成後桌子、窗、家具是新畫風、會跟著日夜變；人物、牆、介面暫時還是舊的。

**Files:**
- Modify: `web/src/floor.ts`、`web/src/furniture.ts`、`web/src/main.ts`、`web/src/styles/building.css`
- Test: `test/furniture.test.ts`

**Interfaces:**
- Consumes: `OBJECTS`、`defsSvg`、`ObjectId`、`FurnitureId`、`DeskState`（Task 3）。
- Produces:
  ```ts
  // furniture.ts（刪掉所有繪圖函式與 FlatSprite 相關 import）
  export interface FurnItem { id: FurnitureId }
  export const SETS: { id: string; items: FurnItem[] }[];               // 四組內容不變，只是改成 id
  export function layoutSet(set: (typeof SETS)[number]): (FurnItem & { x: number })[]; // 寬度改讀 OBJECTS[id].w；x = 原點離家具區左緣
  // floor.ts
  /** <svg class="obj" width=w height=h viewBox=…><use href="#id"/></svg>，絕對定位成原點在 (x, y)（父元素座標） */
  export function useObj(id: ObjectId, x: number, y: number): SVGSVGElement;
  ```
  `floor.ts` 拿掉 `DESK_SCALE`、`DESK_Y`、`img()`、`placeImg`／`spriteImg`、`deskFront`、`nightWindow`；`deskState` 改用 `objects.ts` 的 `DeskState`。桌子：每張桌一個 `useObj`，原點在 (60, 192)（桌子元素內座標），狀態變了就換 `<use>` 的 `href`；窗：原點 (x, `WIN_Y`=66)；家具：原點 (it.x, `FURN_Y`=156)。`main.ts` 在建立 `Building` 之前把 `defsSvg()` 放進 `document.body` 最前面。

- [ ] **Step 1: 改測試** `test/furniture.test.ts`：刪掉「正面家具」整組與 `flat.js`、`sprite-check.js` 的 import；`width()` 改成 `OBJECTS[it.id].w`；`layoutSet` 測試的左右緣改用 `p.x ± OBJECTS[p.id].w / 2`；其餘（組數、組名、`furnitureSet`、`windowXs`）不動。加 `test('每組家具都是 OBJECTS 裡的物件')`。
- [ ] **Step 2: 執行** `npx vitest run test/furniture.test.ts`，預期 FAIL（`SETS` 還是 `make`）。
- [ ] **Step 3: 實作** `furniture.ts`、`floor.ts`、`main.ts` 的改動；`building.css` 加 `.obj { position: absolute; display: block; overflow: visible; }`，拿掉 `.desk img`、`.windows img`、`.furniture img` 規則；名牌外框改成 1.4px `var(--fig-ink)`、拿掉陰影。
- [ ] **Step 4: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 5: 瀏覽器檢查**（日夜各一次）：
  - 四組家具都出現過、位置和現在差不多、沒有超出家具區。
  - 桌子：空桌螢幕暗；工作中綠、等你處理紅（桌面帶紅）、輪到你琥珀（杯子冒煙）；名牌在桌子正面、文字清楚。
  - 夜晚：有人的桌子有檯燈與暖光、空桌沒有；販賣機與立燈發光；窗裡是星星月亮。白天：窗裡是白雲、沒有檯燈。
  - 用 devtools 把 `<html>` 的 `data-time` 從 `day` 改成 `night`，桌子、窗、家具立刻跟著換色（證明 `<use>` 有吃到變數）。
  - console 沒有錯誤。
- [ ] **Step 6: Commit** `feat: 桌子、窗、家具改成漫畫風 SVG`

### Task 5: 人物換成漫畫 SVG

**Files:**
- Modify: `web/src/person.ts`、`web/src/building.ts`、`web/src/styles/figure.css`

**Interfaces:**
- Consumes: `figureSvg`、`FX_BOXES`（Task 2）。
- Produces（`Person` 的公開介面不變）：
  ```ts
  export type Act = 'work' | 'up' | 'idle' | 'walk' | 'stand';
  export class Person {
    readonly el: HTMLElement;  // .person，data-act = 目前的 Act，data-bubble = 'on' | 'off'
    constructor(look: Look);
    setAct(a: Act): void;      // 只設 data-act，不再用計時器換圖
    setBubble(on: boolean): void; // 只設 data-bubble
    get at(): number; get moving(): boolean;
    placeAt(x: number): void; walkTo(x: number, done?: () => void, standMs?: number): void; destroy(): void;
  }
  ```
  `person.ts` 拿掉 `TYPE_MS`、`WALK_MS`、`loop`、`pose`、`timer`、`drawBubble`、`bubbleCanvas`、`BUBBLE`、`TURN`、`charImg`／`placeImg`；原本的 `.fig` 包裝 `div` 拿掉，`.person` 直接放 `innerHTML = figureSvg(look)` 的 SVG（否則 `.person .fig` 會同時選到包裝 div 與 SVG 裡的 `<g class="fig">`，位移變兩倍）。走路、`walkTo`、`placeAt`、計時器邏輯不動。`building.ts` 建立助理的 `Person` 時加 `p.el.dataset.kind = 'assistant'`。

- [ ] **Step 1: 實作 `person.ts` 與 `building.ts` 的改動**。
- [ ] **Step 2: 寫 `figure.css`**（取代 Task 1 搬來的舊 `.person` 規則；`.person` 的位置與大小不變）：
  - 部件 `transform-box: fill-box`；手臂 `transform-origin: 50% 8%`、腿 `50% 5%`。
  - `data-act="work"`：`face-work`、兩手 `ty` 動畫 0.42s（右手延遲 0.21s）、`fx-work` 顯示且「噠噠」0.84s `steps(1)` 閃。
  - `data-act="up"`：`.fig` `translateY(-12px)`、右臂 160°–195° 揮動 0.8s、`face-wait`、`fx-wait` 顯示（集中線 1.6s 淡到 0.35、「！」框 1.6s 放大到 1.12、汗滴 1.6s 往下滑）。
  - `data-act="idle"`：`face-turn`、頭點 2.6s（−6°）；**只有在 `data-bubble="on"` 時**顯示 `fx-turn`（泡泡與 zZ，zZ 2.6s 往上飄、兩個錯開 1.3s）。
  - `data-act="walk"`：腿與手臂 ±16° 交錯 0.56s、`.fig` 上下 1.5px；椅子隱藏。`data-act="stand"`：站姿、椅子隱藏、手放下。
  - 坐下／站起：`.fig`、腿、椅子的 `transform`／`opacity` 用 `transition: 300ms`，`data-act` 一換就播。
  - 其他 act 下所有 `fx-*` 與非目前表情 `display: none`。
  - `.person[data-kind="assistant"] .figure { transform: scale(.85); transform-origin: 50% 100%; }`。
  - `@media (prefers-reduced-motion: reduce)`：`.person *` 的 `animation` 與 `transition` 全部 `none`；漫符本身照樣顯示（只停動畫，不藏）。
- [ ] **Step 3: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 4: 瀏覽器檢查**（日夜各一次）：
  - 工作中打字、等你處理站起揮手加集中線「！」汗滴、輪到你打盹加泡泡與 zZ，三種一眼分得出來。
  - crm 那層 8 人坐滿時，漫符沒有蓋到隔壁的人或名牌。
  - 上班：電梯開門、走出來（手腳擺動）、坐下有過場；下班：站起來、走回電梯。
  - 助理縮小、打字有「噠噠」；完成後閉眼但**沒有**泡泡與 zZ；不舉手。
  - 夜晚漫符是米白色、看得清楚。
  - 滑到人身上仍會出現資訊卡（頭像暫時是舊的）。console 沒有錯誤。
- [ ] **Step 5: Commit** `feat: 人物改成會動的漫畫 SVG`

### Task 6: 大樓外觀改成手繪紙張風

**Files:**
- Modify: `web/src/styles/building.css`、`web/src/building.ts`（屋頂元素）、`web/src/floor.ts`（`lobby()` 的紙條結構）、`web/src/view.ts`（`PROJECT_COLORS` 換成 spec 的 8 種水彩色）
- Test: `test/view.test.ts`

**Interfaces:**
- Consumes: Task 1 的主題變數。
- Produces: 無新的程式介面；`PROJECT_COLORS` 值改變、長度不變。

- [ ] **Step 1: 改測試** `test/view.test.ts`：`PROJECT_COLORS` 等於 spec「色票」的專案色陣列（照順序）。執行 `npx vitest run test/view.test.ts`，預期 FAIL。
- [ ] **Step 2: 換 `PROJECT_COLORS`**，跑 `npx vitest run test/view.test.ts` 通過。
- [ ] **Step 3: 改 `building.css` 與相關結構**，照 spec「物件 › 屋頂與地面」「電梯」「窗」「介面元件 › 招牌、樓層邊緣提示、空大廳」：
  - 天空：`var(--page-bg)`；白天太陽與白雲、夜晚月牙與星星（CSS 偽元素或 `building.ts` 放一小段靜態 SVG，顏色用變數）；拿掉現在的漸層與城市剪影光暈。
  - 屋頂：女兒牆、水塔、冷氣機、天線用 `var(--roof)`／`var(--elevator)` 平塗加 1.6px `var(--ink)` 框；天線紅燈只在夜晚閃（`:root[data-time="night"] .antenna::after { animation: blink 1.8s steps(1) infinite }`，減少動態時不閃）。
  - 牆：`var(--wall)` 加 20px 寬直條紋 `var(--wall-stripe)`；每層一片鉛筆排線（`repeating-linear-gradient` 斜線，`var(--hatch)`，位置固定在 x 226 一帶）；牆下半 `var(--wall-low)`；樓板 `var(--slab)` 上下各一條墨線。
  - 電梯：框 `var(--elevator)`、門 `var(--door)`，墨線框；右片門加網點（`radial-gradient(circle, var(--fig-ink) 0.95px, transparent 1.2px) 0 0 / 4px 4px`，不透明度用 `color-mix`）；開關門的 transition 不變。
  - 招牌：背景改成不透明的專案色（拿掉 `e6` 透明度，`floor.ts` 改成直接用 `f.color`）、1.6px 墨線框、拿掉陰影。
  - 邊緣暗影：`linear-gradient(90deg, color-mix(in srgb, var(--ink) 35%, transparent), transparent)`；邊緣提示改成 1.6px 墨線框、拿掉陰影。
  - 空大廳：兩行字放在紙條（`var(--paper)`、墨線框、`rotate(-2deg)`）。
  - 地面：`var(--ground)`、上緣墨線、磚縫短線。
  - 拿掉所有 `box-shadow` 與裝飾性漸層。
- [ ] **Step 4: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 5: 瀏覽器檢查**（日夜各一次）：天空、屋頂、牆、窗框、地面、招牌都是紙張風、跟示意圖一致；長專案名在招牌內截斷；夜晚天線閃、白天不閃；邊緣暗影與提示在擠滿的樓層正常、可點；劇本最後的空大廳是紙條。console 沒有錯誤。
- [ ] **Step 6: Commit** `feat: 大樓外觀改成手繪紙張風`

### Task 7: 狀態列、電梯面板、資訊卡改成紙卡

**Files:**
- Modify: `web/src/styles/ui.css`、`web/src/card.ts`

**Interfaces:**
- Consumes: `avatarSvg`（Task 2）、主題變數。
- Produces: `InfoCard` 的公開方法不變（`show`、`showHelper`、`fill`、`fillHelper`、`scheduleHide`、`hide`、`id`、`helper`）。

- [ ] **Step 1: 改 `ui.css`**，照 spec「介面元件 › 狀態列、電梯面板」：
  - `#summary`：`var(--paper)` 底、1.6px `var(--ink)` 框、圓角 8；`.alert` 框 2.6px `var(--waiting)`、`.turn` 框 2.6px `var(--turn)`；圖例方塊與比例條三段加 1.2px 墨線框；`.zero` 用 `var(--text-sub)`；`#top` 背景改 `var(--page-bg)`。拿掉所有陰影。
  - `#elevator`：`var(--paper)` 底、1.6px 墨線框；按鈕直徑 28、墨線框、未亮 `var(--button)`、`.waiting` 填 `var(--waiting)` 白字、`.idle` 填 `var(--turn)` 深字，拿掉發光；`.elev-frame` 改成 1.2px `var(--text)` 虛線框、透明底。
- [ ] **Step 2: 改 `card.ts`**：頭像改成 `avatarSvg(appearance(key))`（放進頭像容器的 `innerHTML`），刪掉 `avatarCanvas` 與 `clay.js`／`flat.js`／`sprites.js` 的 import；把所有寫死顏色的行內樣式換成 class（例如 `card`、`card-head`、`chip`、`chip-working`、`section-label`、`activity`、`activity-waiting`、`helper-row`、`card-foot`、`dismiss`），樣式寫進 `ui.css`，顏色只用主題變數；卡片 `var(--paper)` 底、1.6px 墨線框、頂端 5px 專案色條；「請他下班」墨線框按鈕，滑過時字與框變 `var(--waiting)`（用 CSS `:hover`，刪掉 `onmouseenter`／`onmouseleave`）。內容、順序、文字、按鈕行為一律不變，動態文字仍用 `textContent`。
- [ ] **Step 3: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 4: 瀏覽器檢查**（日夜各一次）：狀態列外框依狀態變紅／琥珀／一般；人數 0 的項目變淡；電梯面板燈色正確、看得到的樓層有虛線框、點了會捲；員工與助理的資訊卡內容與之前一樣、頭像是漫畫人物、夜晚文字清楚；「請他下班」有效。console 沒有錯誤。
- [ ] **Step 5: Commit** `feat: 狀態列、電梯面板、資訊卡改成紙卡`

### Task 8: 刪掉舊畫法、更新文件與截圖

**Files:**
- Delete: `web/src/clay.ts`、`web/src/flat.ts`、`web/src/sprites.ts`、`test/clay.test.ts`、`test/flat.test.ts`、`test/sprite-check.ts`
- Modify: `web/src/view.ts`（刪 `PALETTE`）、`test/view.test.ts`（`PALETTE` 改成 `SHIRT_COLORS`）、`README.md`
- Create: `docs/images/office-day.png`、`docs/images/office-night.png`
- Delete: `docs/images/office.png`

- [ ] **Step 1: 刪檔並清掉引用**：`grep -rn "clay\|flat\.js\|sprites\|PALETTE" web/src test` 不再有結果（`SHIRT_COLORS`、`HAIR_COLORS` 除外）。
- [ ] **Step 2: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 3: 完整瀏覽器檢查**：照 spec「瀏覽器檢查清單」1–11 項逐項確認，`?time=day` 與 `?time=night` 各走完一輪劇本。第 9 項：不帶參數打開，確認 `data-time` 與目前時間相符（跨點切換已由 Task 1 的測試涵蓋）。第 10 項請使用者在 macOS 開啟「減少動態」後看一眼，回報結果。
- [ ] **Step 4: 截圖**：劇本跑到 6 層、有人等你處理與輪到你的時候，白天與夜晚各截一張（寬約 1280），存成 `docs/images/office-day.png`、`office-night.png`，刪掉 `office.png`。
- [ ] **Step 5: 改 README**：照 spec「README」：開頭描述、兩張截圖與說明（說明寫法比照現有截圖說明，逐項對照畫面）、功能清單（三種狀態的新畫法與漫符、依時間切換白天夜晚、`?time=day`／`?time=night`）。其他章節不動。
- [ ] **Step 6: 執行** `npx vitest run` 全綠、`npm run build` 成功。
- [ ] **Step 7: Commit** `docs: README 與截圖改成新畫風；刪掉黏土畫法`
