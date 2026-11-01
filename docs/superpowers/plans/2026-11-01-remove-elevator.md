# 拿掉電梯與走路 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拿掉每層的電梯、門與人物走路，人改成在座位上「啵」地登場（「到！」）、「咻」地退場（「辛苦了～」），整層左移 80px。

**Architecture:** 先在人物 SVG 與 figure.css 加好兩組進出漫符（純字串與 CSS，可單獨測）；再一次換掉 `person.ts`／`building.ts`／`floor.ts` 的電梯與走路流程、刪 `door.ts`；最後改座標常數讓整層左移。`withLeaving`／`vacate`／`buildingPlan` 不動，退場時樓層照樣留到動畫播完。

**Tech Stack:** TypeScript、Vite、vitest（node 環境，沒有 DOM）；無框架，DOM 手寫。

**Spec:** `docs/superpowers/specs/2026-11-01-remove-elevator-design.md`

## Global Constraints

- 不改 `src/`、`scripts/simulate.ts`；不新增相依套件（不加 happy-dom）。
- 註解與 commit 訊息用繁體中文，風格照現有程式（行內短註解、`feat:`／`refactor:`／`docs:` 前綴），commit 結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 貼紙文字固定：登場「到！」、退場「辛苦了～」。
- `ENTER_MS = 600`、`EXIT_MS = 500`，CSS keyframes 同值並註明。
- 座位 0 中心 60（`seatCenter(i) = i × 120 + 60`）；`SIGN_X = 12`；`WIN.first = 300`；`SIGN_MAX_W` 仍是 240。
- 進出漫符外框：人物座標 `y0 ≥ −29`（不蓋招牌）、`x0 ≥ −30`、`x1 ≤ 90`（在座位內）。
- 不特別處理減少動態：`person.ts` 不 import `motion.ts`；`motion.ts` 保留（`elevator.ts` 在用）。
- 左側電梯面板（`elevator.ts`、`#elevator`、ui.css）不動。
- 每個 task 結束時 `npm test` 與 `npm run build` 都通過。

## Review Focus

都要碰 DOM，vitest 測不到，由 Task 3 Step 5 的手動情境逐一驗：

- 退場中同一人又回到同一層：人留在座位、`data-fx` 被清掉、狀態漫符照常出現，不會 0.5 秒後被移除。
- 同一層兩個人幾乎同時下班：兩人都播完退場，樓層在最後一人淡出後才拆，不會先拆掉另一人。
- 退場中重新連線（`reset`）：退場中的人物被清掉，舊的 `exit` 回呼之後不會再觸發 `render` 或移除別人。
- 登場 0.6 秒內狀態改變（例如立刻變等你處理）：姿勢跟著變，「到！」消失後才出現「！」框。
- 退場中滑鼠移到那個人身上：不出現資訊卡；他正被看的資訊卡在下班當下收起。

---

### Task 1: 進出漫符（figure.ts、figure.css）

**Files:**
- Modify: `web/src/figure.ts`（漫符常數區、`FX_BOXES`、`FX`、`figureSvg`）
- Modify: `web/src/styles/figure.css`
- Test: `test/figure.test.ts`

**Interfaces:**
- Produces: 人物 SVG 多兩個群組 `<g class="fx-in">`、`<g class="fx-out">`；`FX_BOXES` 型別擴成 `Record<'work' | 'wait' | 'turn' | 'in' | 'out', Box>`；CSS 依 `.person[data-fx="in"]`／`.person[data-fx="out"]` 顯示並播動畫。Task 2 只負責設定 `data-fx`。

- [ ] **Step 1: 寫會失敗的測試（`test/figure.test.ts`）**

```ts
// 「每個部件與漫符群組都在」的 names 陣列加上 'fx-in', 'fx-out'

test('進出漫符不蓋住招牌，也在座位內', () => {
  for (const k of ['in', 'out'] as const) {
    expect(FX_BOXES[k].y0, k).toBeGreaterThanOrEqual(-29);
    expect(FX_BOXES[k].x0, k).toBeGreaterThanOrEqual(-30);
    expect(FX_BOXES[k].x1, k).toBeLessThanOrEqual(90);
  }
});

test('進出漫符的文字', () => {
  const s = figureSvg(looks[0]);
  expect(s).toContain('到！');
  expect(s).toContain('辛苦了～');
});

test('figure.css：data-fx 期間只顯示進出漫符，狀態漫符藏起來', () => {
  const css = readFileSync('web/src/styles/figure.css', 'utf8');
  expect(css).toMatch(/\.person \.fx-in, \.person \.fx-out \{ display: none; \}/);
  expect(css).toContain('.person[data-fx="in"] .fx-in');
  expect(css).toContain('.person[data-fx="out"] .fx-out');
  expect(css).toMatch(/\.person\[data-fx\] \.fx-work, \.person\[data-fx\] \.fx-wait, \.person\[data-fx\] \.fx-turn \{ display: none !important; \}/);
  // 動畫放在 .figure（不是 .fig，.fig 的 transform 給站起來用）
  expect(css).toMatch(/\.person\[data-fx="in"\] \.figure \{ animation: fig-in 600ms/);
  expect(css).toMatch(/\.person\[data-fx="out"\] \.figure \{ animation: fig-out 500ms/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run test/figure.test.ts`
Expected: FAIL（找不到 `fx-in`、`FX_BOXES.in` 為 undefined、CSS 規則不存在）

- [ ] **Step 3: 在 `figure.ts` 加 `fx-in`、`fx-out`**

- 位置照「！」框那一區（頭的右上方，`BURST_C = [66, -11]` 附近），用現有的 `text`、`path`、`tag('polygon', …)`／`rect` 小工具畫：
  - `fx-in`：白底墨線小貼紙框，裡面「到！」（字色 `var(--fx)`）。
  - `fx-out`：白底墨線小貼紙框，裡面「辛苦了～」；加 2～3 條往上的速度線（`FX_STROKE`），畫在頭上方。
- 幾何資料同時拿來畫與算外框（照現有 `FX_BOXES` 的做法：`boxOf` + `textPts`），加進 `FX_BOXES.in`／`FX_BOXES.out`。字寬估算照 `textPts` 的規則（全形字寬 = 字級）。
- `figureSvg` 在 `g('fx-turn', …)` 之後加 `g('fx-in', FX.in) + g('fx-out', FX.out)`；`avatarSvg` 不加。

- [ ] **Step 4: 在 `figure.css` 加規則**

- `.person .fx-in, .person .fx-out { display: none; }`，`pointer-events: none` 那行也加上這兩個 class。
- `.person[data-fx="in"] .fx-in, .person[data-fx="out"] .fx-out { display: inline; }`
- `.person[data-fx] .fx-work, .person[data-fx] .fx-wait, .person[data-fx] .fx-turn { display: none !important; }`
- `.person .figure { transform-origin: 50% 100%; }`（彈出與淡出以腳底為基準）
- `.person[data-fx="in"] .figure { animation: fig-in 600ms ease-out; }`：`scale(.6)` → `scale(1.12)` → `scale(1)`。
- `.person[data-fx="out"] .figure { animation: fig-out 500ms ease-in forwards; }`：`opacity 1 → 0`、`translateY(0) → translateY(-16px)`。
- 註明 600／500 與 `person.ts` 的 `ENTER_MS`／`EXIT_MS` 同值。不改減少動態區塊。

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS（含既有的「漫符在自己的座位內」，它會一併檢查 `in`、`out`）

- [ ] **Step 6: Commit**

```bash
git add web/src/figure.ts web/src/styles/figure.css test/figure.test.ts
git commit -m "feat: 人物加登場「到！」與退場「辛苦了～」漫符與動畫（尚未接上）"
```

---

### Task 2: 換掉電梯與走路（person、building、floor、door）

**Files:**
- Delete: `web/src/door.ts`、`test/door.test.ts`
- Modify: `web/src/person.ts`、`web/src/building.ts`、`web/src/floor.ts`、`web/src/floors.ts`（只刪走路與 `DOOR_X`）
- Modify: `web/src/styles/figure.css`（刪 walk／stand）、`web/src/styles/building.css`（刪電梯與門）、`web/src/styles/theme.css`（刪 `--door`）
- Modify: `README.md:107`、`docs/superpowers/specs/2026-10-31-cutaway-building-design.md`（開頭「後續變更」）
- Test: `test/floors.test.ts`、`test/figure.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `data-fx` CSS。
- Produces（`person.ts`）：
  - `export type Act = 'work' | 'up' | 'idle'`
  - `export const ENTER_MS = 600`、`export const EXIT_MS = 500`
  - `class Person { readonly el; constructor(look: Look); setAct(a: Act): void; placeAt(x: number): void; enter(): void; exit(done: () => void): void; cancelExit(): void; destroy(): void }`
  - `enter`：設 `el.dataset.fx = 'in'`，`ENTER_MS` 後 `delete el.dataset.fx`。`exit`：設 `'out'`，`EXIT_MS` 後呼叫 `done`。`cancelExit`：清計時器並 `delete el.dataset.fx`。同時只有一個計時器，新的取消舊的；`destroy` 清計時器並移除元素。
- Produces（`floor.ts`）：`FloorView` 不再有 `doorX`、`openDoor`、`shutDoor`；`lobby()` 不含電梯。

- [ ] **Step 1: 先改測試**

- `test/floors.test.ts`：import 拿掉 `DOOR_X`、`walkMs`、`walkPos`；刪除 `walkMs：…`、`walkPos：…` 兩個測試。
- `test/figure.test.ts`：搜尋 `walk`、`stand`，刪掉針對這兩個 act 的斷言（目前沒有就不動）。
- 刪除 `test/door.test.ts`。

- [ ] **Step 2: 改 `person.ts`**

照 Interfaces 的介面；刪除 `x`、`walk`、`walkT`、`at`、`moving`、`walkTo`、`stop`，以及 `walkMs`／`walkPos`／`Walk`／`reduceMotion` 的 import。`placeAt` 只設 `style.left`。

- [ ] **Step 3: 改 `building.ts`**

- `interface Rec { p: Person; floor: string; emp: Employee }`、`interface Leaving { emp: Employee; p: Person; floor: string }`。
- 刪除 `STAND_MS`、`walk()`、`enter()`。
- `placePeople`：沒有 `rec` 時先 `comeBack(id, f.key)`，沒有就 `new Person(...)`（`dataset.key = id`）、登記到 `people`，`animate` 時呼叫 `p.enter()`；`rec.floor !== f.key || rec.p.el.parentElement !== v.people` 時 `append` 並更新 `floor`；每次 `rec.p.placeAt(seatCenter(s.index))`；卡片重畫規則不變；最後 `settle(rec)`。
- `leave(id)`：從 `people` 刪掉、收卡片，登記 `lv` 到 `leaving`，`rec.p.exit(() => { if (this.leaving.get(id) !== lv) return; this.leaving.delete(id); lv.p.destroy(); this.render(); })`。
- `comeBack(id, key)`：有 `lv` 就從 `leaving` 刪掉；同一層 → `lv.p.cancelExit()` 並回傳 `{ p: lv.p, floor: key, emp: lv.emp }`；不同層 → `lv.p.destroy()` 回傳 `undefined`。
- `clearPeople`：刪掉 `shutDoor` 那行，其餘不變。

- [ ] **Step 4: 改 `floor.ts`、`floors.ts`，刪 `door.ts`**

- `floor.ts`：刪 `elev`、`door`、`doorNum`、`doorQ`、`doorX`、`openDoor`、`shutDoor` 與 `ElevatorDoor`／`DOOR_X` 的 import；`update` 不再設樓號；`destroy` 只 `el.remove()`；`lobby()` 不建 `elev`。
- `floors.ts`：刪「走路與電梯」區塊的 `DOOR_X`、`WALK_SPEED`、`walkMs`、`Walk`、`walkPos`（`withLeaving`、`buildingPlan`、`vacate` 留著）。
- `git rm web/src/door.ts test/door.test.ts`

- [ ] **Step 5: 改 CSS**

- `figure.css`：刪 `walk`、`stand` 的選擇器（姿勢、表情、走路動畫）與 `fig-bob`／`fig-swing` keyframes（確認沒別處用）；`/* 坐下／站起…與 building.ts 的 STAND_MS 相同 */` 改成「data-act 一換就播 300ms」；「站著（up、walk、stand）」改成「站著（up）」。
- `building.css`：刪 `.elevator`、`.elevator::before`、`.door-num`、`.door`（含 `::before`／`::after`／`.open`／`.snap`）規則，以及減少動態區塊裡門的那行。
- `theme.css`：刪兩處 `--door`。

- [ ] **Step 6: 文件**

- `README.md:107`：「員工在這些時候走回電梯下班」改成「員工在這些時候下班（頭上冒「辛苦了～」淡出）」；若有描述進場的句子，改成在座位冒「到！」登場。
- `2026-10-31-cutaway-building-design.md` 開頭「後續變更」加一句：每層電梯、門與人物走路已由 `2026-11-01-remove-elevator-design.md` 取代（人在座位登場、退場）。

- [ ] **Step 7: 驗證**

Run: `npm test && npm run build`
Expected: 全部 PASS、build 成功；`grep -rn "openDoor\|shutDoor\|walkTo\|DOOR_X\|ElevatorDoor\|--door" web/src test` 沒有結果。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: 拿掉每層電梯與走路，人在座位上登場「到！」、退場「辛苦了～」"
```

---

### Task 3: 整層左移 80px，瀏覽器驗收

**Files:**
- Modify: `web/src/floors.ts`（`GEO`、`seatCenter`、`buildingWidth`）
- Modify: `web/src/furniture.ts`（`SIGN_X`、`WIN.first`）
- Modify: `web/src/styles/building.css`（`.lobby-msg` 的 `left`）
- Test: `test/floors.test.ts`、`test/furniture.test.ts`

**Interfaces:**
- Produces: `GEO` 沒有 `elevatorW`；`seatCenter(i: number): number` = `i * GEO.seatW + GEO.seatW / 2`；`buildingWidth` = `max(avail, 最多桌數 × 120 + GEO.furnitureW)`。

- [ ] **Step 1: 改測試**

```ts
// floors.test.ts
expect(seatCenter(0)).toBe(60);
expect(seatCenter(2)).toBe(300);
expect(buildingWidth([f(3), f(9)], 1000)).toBe(9 * 120 + 200);

// furniture.test.ts「從招牌區右邊開始…」
expect(xs).toEqual([300, 540, 780]); // w = 1208
// 「招牌…」那個測試：GEO.elevatorW 的斷言換成
expect(F.SIGN_X).toBe(12);
expect(F.SIGN_MAX_W).toBe(240);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run test/floors.test.ts test/furniture.test.ts`
Expected: FAIL（seatCenter(0) 是 140、窗從 380 開始、SIGN_X 是 92）

- [ ] **Step 3: 改常數**

- `floors.ts`：`GEO` 刪 `elevatorW`；`seatCenter`、`buildingWidth` 照 Interfaces。
- `furniture.ts`：`SIGN_X = 12`（註解改「左緣留 12」）；`WIN.first = 300`。
- `building.css`：`.lobby-msg` 的 `left: 80px` 改 `left: 0`。
- `grep -rn "elevatorW" web/src test` 沒有結果。

- [ ] **Step 4: 跑測試與 build**

Run: `npm test && npm run build`
Expected: 全部 PASS、build 成功。

- [ ] **Step 5: 瀏覽器驗收（另開伺服器，不碰使用者在 47823 的那台）**

```bash
mkdir -p "$SCRATCH/home/.claude-office" && echo '{"port":47999}' > "$SCRATCH/home/.claude-office/config.json"
HOME="$SCRATCH/home" node dist/server/main.js   # 背景執行
```

在瀏覽器面板開 `http://127.0.0.1:47999/?time=day`，另一個終端機跑 `HOME="$SCRATCH/home" npx tsx scripts/simulate.ts`，確認：
- 樓層左邊沒有電梯，招牌、窗、桌子左移，左側電梯面板照常。
- 登場彈出、冒「到！」，消失後才出現狀態漫符；退場冒「辛苦了～」往上淡出；最後一人下班，樓層等他淡出才拆。

（`$SCRATCH` = 這個 session 的 scratchpad 目錄。）再用 curl 直接送事件逐一驗 Review Focus：`curl -s -X POST http://127.0.0.1:47999/events -d '{"hook_event_name":"SessionStart","session_id":"a","cwd":"/tmp/x"}'`，不帶 `sentAt`（伺服器會補現在時間）：
- 同一人退場中又回來：`SessionStart a` → 等 1 秒 → `SessionEnd a`，0.2 秒內 `UserPromptSubmit a`。人留在座位，0.5 秒後沒被移除，打字「噠噠」出現。
- 同層兩人同時下班：`a`、`b` 同一個 `cwd`，`SessionEnd a`、`SessionEnd b` 連發。兩人都淡出，樓層最後才拆。
- 退場中重新連線：`SessionEnd a` 後立刻重新整理頁面。沒有殘留人物、console 沒有錯誤。
- 登場中變等你處理：`SessionStart c` 後 0.2 秒內 `PermissionRequest c`。人站起來，「到！」消失後才出現「！」框。
- 退場中的人滑鼠移上去不出現資訊卡。

?time=night 再看一次樓層與漫符顏色。完成後停掉測試伺服器。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 拿掉電梯後整層左移 80px（座位 0 中心 60、招牌 x 12、第一扇窗 300）"
```
