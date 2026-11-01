# 人物動作（子專案 2，前端）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 人物工作中依 `toolKind` 換動作（至少維持 1.5 秒），等待時輪流做小動作，完成時歡呼，助理完成後走到主人桌旁遞文件再離開。

**Architecture:** 新增純邏輯模組 `pose.ts`：對應表、輪替挑選、1.5 秒排隊規則，以及不碰 DOM 的 `PoseDriver`（計時器加上一個 `apply(pose)` 回呼，用 vitest 的假計時器測）。`Person` 擁有一個 `PoseDriver`，把結果寫到 `data-pose`。`Building.settle` 依員工狀態呼叫 `work`、`up`、`idle` 或 `cheer`。道具與漫符是 `figure.ts` 裡新增的 SVG 群組，顯示與動畫全部交給 `figure.css` 依 `[data-act][data-pose]` 決定。助理交文件由 `Building` 驅動，`helperRoster` 改成「交完文件才離開」。

**Tech Stack:** TypeScript、Vite、Vitest（node 環境，沒有 DOM 測試框架；計時器用 `vi.useFakeTimers()`，同 `test/door.test.ts`）、SVG、CSS。

**Spec:** `docs/superpowers/specs/2026-11-01-figure-actions-design.md`（實作前必讀），以及子專案 1 的 `docs/superpowers/specs/2026-11-01-manga-paper-redesign-design.md`（人物座標、漫符範圍、減少動態）。

## Global Constraints

- 伺服器端（`src/`）已經完成，不再修改。`Employee.toolKind` 的型別是 `ToolKind | null`，`ToolKind = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'think' | 'other'`（`src/state/types.ts`）。
- 子專案 1 的 `data-act`（`work`、`up`、`idle`、`walk`、`stand`）、`data-bubble`、`data-kind="assistant"`、坐下站起的 300ms 過場、走路動畫都不改；本計畫只加 `data-pose`。
- **角度的正負**：SVG `rotate` 的度數，正值是畫面上的順時針。手臂下垂時，右臂（`arm-r`，畫面右側）轉正值是往身體中間擺，轉負值是往外擺；左臂（`arm-l`）相反。手臂轉軸在肩膀（figure.css 已設 `transform-origin: 50% 8%`），手臂長約 17，手在下垂時位於左 (16.5, 63)、右 (43.5, 63)。
- 身體的位移一律用獨立的 `translate` 屬性，不可用 `transform`：`.fig` 的 `transform` 是坐下站起的過場在用（同子專案 1 走路的做法）。
- 時間：最短維持 `MIN_POSE_MS = 1500`；輪到你每個小動作維持 6000–10000ms、等你處理 3000–5000ms（均勻分布）；歡呼 `CHEER_MS = 1000`；遞文件 `DELIVER_MS = 1000`；站起來 `STAND_MS = 300`（building.ts 既有）；走路 120px/s（既有）。
- 道具與漫符都在人物座標 x −30 到 90 之內（座位中心 ±60），頂端不高於 y −29（招牌）。
- **SVG 顏色規則**（同子專案 1）：`figure.ts` 產生的標記不可出現帶顏色的 `fill="…"`／`stroke="…"` 屬性，顏色放在 `style` 或 class。
- 減少動態：`reduceMotion()`（`web/src/motion.ts`）為真時不輪替、不歡呼；輪到你固定 `doze`，等你處理固定 `raise`。figure.css 既有的 `@media (prefers-reduced-motion: reduce)` 已經停掉所有 animation 與 transition，不必另外處理 CSS。
- commit 訊息用繁體中文、保留 `feat:`/`fix:`/`docs:`/`test:` 前綴，結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 每個 task 結束前：`npx vitest run` 全綠、`npm run build` 成功。
- 瀏覽器檢查一律用隔離的伺服器（做法同子專案 1 計畫的 Global Constraints：HOME 指到 scratchpad、port 47900、`simulate --loop`），`?time=day` 與 `?time=night` 各看一次。

## Review Focus

1. **其他人的事件觸發重畫時，輪替不能重來、歡呼不能被打斷**：每個事件都會讓 `Building.render` 對所有沒在走路的人呼叫 `settle`。在已經是輪到你或歡呼中的人身上呼叫 `PoseDriver.idle()` 必須什麼都不做；`up()`、同一個工具的 `work()` 也一樣。測試寫在 Task 1。
2. **快速連續換工具**：在 1.5 秒內 read → edit → run，畫面上應該是 read 演滿 1.5 秒後直接跳到 run；中途工具換回目前正在演的 pose，排隊就取消。測試寫在 Task 1。
3. **工作中的排隊被狀態改變打斷**：read 才演 0.5 秒就變成等你處理，要立刻換成 up 那一組，之後排隊中的工作 pose 也不能再冒出來。測試寫在 Task 1。
4. **助理遞文件到一半座位被重排**（有新助理加入，或另一位助理走了）：遞文件要取消，助理先走回新座位，到了再重新出發，不能卡住、也不能永遠不走。`helperRoster` 的安全上限（`HELPER_MAX_LINGER`）測試寫在 Task 5；中斷後重新出發寫在 Task 5 的瀏覽器檢查。
5. **重新連線**：拿到的初始資料不會觸發歡呼（`clearPeople` 之後沒有前一筆資料）。已完成的助理重新連線後會再遞一次文件，這是可以接受的。`shouldCheer` 測試寫在 Task 1，瀏覽器檢查寫在 Task 4。

---

### Task 1: `pose.ts`：pose 的規則與 PoseDriver

**Files:**
- Create: `web/src/pose.ts`
- Test: `test/pose.test.ts`

**Interfaces:**
- Consumes: `ToolKind`、`EmployeeStatus`（`src/state/types.ts`）；`reduceMotion`（`web/src/motion.ts`，只當預設值）。
- Produces:
  ```ts
  export type WorkPose = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'think';
  export type IdlePose = 'stretch' | 'coffee' | 'phone' | 'doze';
  export type UpPose = 'raise' | 'wave' | 'hop';
  export type Pose = WorkPose | IdlePose | UpPose | 'cheer' | 'deliver';
  export const MIN_POSE_MS = 1500, CHEER_MS = 1000, DELIVER_MS = 1000;
  export const IDLE_POSES: readonly IdlePose[] = ['stretch', 'coffee', 'phone', 'doze'];
  export const UP_POSES: readonly UpPose[] = ['raise', 'wave', 'hop'];
  export const IDLE_DWELL: readonly [number, number] = [6000, 10000];
  export const UP_DWELL: readonly [number, number] = [3000, 5000];
  export function poseFor(kind: ToolKind | null): WorkPose;            // other、null → edit
  export function pickNext<P extends Pose>(pool: readonly P[], current: Pose | null, rand: () => number): P; // 排除 current 後依 rand 取
  export function dwellMs(range: readonly [number, number], rand: () => number): number; // min + rand() * (max − min)
  export function holdLeft(since: number, now: number): number;        // max(0, MIN_POSE_MS − (now − since))
  export function shouldCheer(prev: EmployeeStatus | undefined, next: EmployeeStatus): boolean; // 只有 working → idle
  export interface DriverOpts { rand?: () => number; now?: () => number; reduced?: () => boolean }
  export class PoseDriver {
    constructor(apply: (p: Pose | null) => void, opts?: DriverOpts); // 預設 Math.random、performance.now、reduceMotion
    readonly current: Pose | null;
    work(kind: ToolKind | null): void;
    idle(): void;
    up(): void;
    cheer(): void;
    still(p: Pose | null): void;
    stop(): void;
  }
  ```

`PoseDriver` 內部有一個模式（`work`、`idle`、`up`、`cheer`、`still`），規則如下：
- `show(p)`：記下 `current = p`、`since = now()`，呼叫 `apply(p)`。
- `work(kind)`：`p = poseFor(kind)`。模式不是 `work` 時，清掉所有計時器、切到 `work`、立刻 `show(p)`。已經是 `work` 時：`p === current` 就取消排隊；`holdLeft` 為 0 就立刻 `show(p)`；否則記成排隊中的 pose，計時器設在 `since + MIN_POSE_MS`，到時 `show(排隊中的 pose)`。
- `idle()`：模式已經是 `idle` 或 `cheer` 時什麼都不做。否則清掉計時器、切到 `idle`；`reduced()` 時 `show('doze')`，否則開始輪替 `IDLE_POSES`／`IDLE_DWELL`。
- `up()`：模式已經是 `up` 時什麼都不做。否則清掉計時器、切到 `up`；`reduced()` 時 `show('raise')`，否則開始輪替 `UP_POSES`／`UP_DWELL`。
- 輪替：`show(pickNext(pool, current, rand))`，再用 `dwellMs(range, rand)` 設下一次輪替。
- `cheer()`：`reduced()` 時等同 `idle()`。否則清掉計時器、切到 `cheer`、`show('cheer')`，`CHEER_MS` 後切到 `still` 再呼叫 `idle()`。
- `still(p)`：清掉計時器、切到 `still`、`show(p)`。
- `stop()`：清掉計時器。

- [ ] **Step 1: 寫會失敗的測試** `test/pose.test.ts`。在 `beforeEach` 用 `vi.useFakeTimers()`、`afterEach` 用 `vi.useRealTimers()`，driver 一律用 `new PoseDriver(apply, { now: () => Date.now(), rand: () => r, reduced: () => red })`。`apply` 是 `vi.fn()`，`r`、`red` 由各個測試設定。

  ```ts
  test('poseFor：工具類型對應到工作 pose，other 與 null 是打字', () => {
    expect(['read', 'edit', 'run', 'web', 'agent', 'think'].map((k) => poseFor(k as ToolKind))).toEqual(['read', 'edit', 'run', 'web', 'agent', 'think']);
    expect(poseFor('other')).toBe('edit');
    expect(poseFor(null)).toBe('edit');
  });
  test('pickNext：不會跟目前的重複；目前的不在池裡就全部可選', () => {
    expect(pickNext(IDLE_POSES, 'stretch', () => 0)).toBe('coffee');
    expect(pickNext(IDLE_POSES, 'stretch', () => 0.999)).toBe('doze');
    expect(pickNext(IDLE_POSES, 'read', () => 0)).toBe('stretch');
    for (let i = 0; i < 50; i++) expect(pickNext(UP_POSES, 'wave', Math.random)).not.toBe('wave');
  });
  test('dwellMs 與 holdLeft', () => {
    expect(dwellMs(IDLE_DWELL, () => 0)).toBe(6000);
    expect(dwellMs(IDLE_DWELL, () => 0.5)).toBe(8000);
    expect(dwellMs(UP_DWELL, () => 0.999)).toBeLessThan(5000);
    expect(holdLeft(1000, 1200)).toBe(1300);
    expect(holdLeft(1000, 2600)).toBe(0);
  });
  test('shouldCheer：只有工作中變輪到你', () => {
    expect(shouldCheer('working', 'idle')).toBe(true);
    expect(shouldCheer('waiting', 'idle')).toBe(false);
    expect(shouldCheer(undefined, 'idle')).toBe(false);
    expect(shouldCheer('idle', 'idle')).toBe(false);
    expect(shouldCheer('working', 'waiting')).toBe(false);
  });
  test('work：第一個立刻顯示；未滿 1.5 秒的排隊，只留最新的', () => {
    d.work('read');                      // apply('read')
    vi.advanceTimersByTime(300); d.work('edit');
    vi.advanceTimersByTime(300); d.work('run');
    expect(apply).toHaveBeenLastCalledWith('read');
    vi.advanceTimersByTime(899); expect(d.current).toBe('read');
    vi.advanceTimersByTime(1);  expect(d.current).toBe('run');
    expect(apply.mock.calls.map((c) => c[0])).toEqual(['read', 'run']);
  });
  test('work：已滿 1.5 秒立刻換；換回目前的 pose 就取消排隊；同一個工具不重畫', () => {
    d.work('read'); vi.advanceTimersByTime(1500); d.work('edit');
    expect(d.current).toBe('edit');
    d.work('run'); d.work('edit'); vi.advanceTimersByTime(5000);
    expect(d.current).toBe('edit');
    expect(apply).toHaveBeenCalledTimes(2);
  });
  test('狀態改變立刻生效，排隊中的工作 pose 不會再出現', () => {
    d.work('read'); vi.advanceTimersByTime(500); d.work('run');
    r = 0; d.up();
    expect(d.current).toBe('raise');
    vi.advanceTimersByTime(2000);
    expect(apply.mock.calls.map((c) => c[0])).not.toContain('run');
  });
  test('idle：隨機挑一個、6–10 秒後換成不同的；重複呼叫不重來', () => {
    r = 0; d.work('edit'); d.idle();
    expect(d.current).toBe('stretch');
    vi.advanceTimersByTime(5999); d.idle(); expect(d.current).toBe('stretch');
    vi.advanceTimersByTime(1);  expect(d.current).toBe('coffee');
  });
  test('up：3–5 秒輪替；重複呼叫不重來', () => {
    r = 0; d.up(); expect(d.current).toBe('raise');
    vi.advanceTimersByTime(2999); d.up(); expect(d.current).toBe('raise');
    vi.advanceTimersByTime(1); expect(d.current).toBe('wave');
  });
  test('cheer：演 1 秒後進入輪替；歡呼中呼叫 idle 不打斷，狀態變了就中止', () => {
    r = 0; d.work('edit'); d.cheer();
    expect(d.current).toBe('cheer');
    d.idle(); vi.advanceTimersByTime(999); expect(d.current).toBe('cheer');
    vi.advanceTimersByTime(1); expect(d.current).toBe('stretch');
    d.cheer(); d.work('think');
    vi.advanceTimersByTime(1000); expect(d.current).toBe('think');
  });
  test('減少動態：不輪替、不歡呼，輪到你固定 doze、等你處理固定 raise', () => {
    red = true; r = 0.7;
    d.work('edit'); d.cheer(); expect(d.current).toBe('doze');
    vi.advanceTimersByTime(60000); expect(d.current).toBe('doze');
    d.up(); expect(d.current).toBe('raise');
    vi.advanceTimersByTime(60000); expect(d.current).toBe('raise');
  });
  test('still 與 stop：固定 pose、清掉計時器', () => {
    r = 0; d.idle(); d.still('deliver');
    vi.advanceTimersByTime(60000); expect(d.current).toBe('deliver');
    d.idle(); d.stop(); vi.advanceTimersByTime(60000);
    expect(d.current).toBe('stretch');
  });
  ```

- [ ] **Step 2: 跑測試，確認失敗**
  Run: `npx vitest run test/pose.test.ts`
  Expected: FAIL，找不到 `../web/src/pose.js`。

- [ ] **Step 3: 實作 `web/src/pose.ts`**，照上面的 Interfaces 與規則。檔案開頭用一行註解說明它是什麼、引用 spec。

- [ ] **Step 4: 跑測試，確認通過**
  Run: `npx vitest run test/pose.test.ts && npx vitest run && npm run build`
  Expected: 全部 PASS，build 成功。

- [ ] **Step 5: Commit**
  ```bash
  git add web/src/pose.ts test/pose.test.ts
  git commit -m "feat: 人物動作的 pose 規則與計時（1.5 秒最短維持、等待輪替、歡呼）"
  ```

---

### Task 2: `figure.ts`：道具與漫符群組

**Files:**
- Modify: `web/src/figure.ts`（`arm()`、`figureSvg()`、`FX_BOXES`、新增道具與漫符的幾何常數）
- Modify: `web/src/styles/theme.css`（`--code` 變數）
- Test: `test/figure.test.ts`

**Interfaces:**
- Produces（Task 3 的 CSS 依賴這些 class 名稱）：
  - 在 `fig` 裡、`body` 與 `arm-r` 之間：`prop-doc`（胸前的文件）、`prop-mobile`（胸前的手機）。
  - 在 `arm-l` 裡、手的後面：`prop-handset`（電話聽筒）。在 `arm-r` 裡、手的後面：`prop-mug`（杯子加蒸氣，蒸氣路徑的 class 是 `steam`）、`prop-sheet`（遞出去的文件）。這些放在手臂群組裡，跟著手臂一起轉。手臂群組的 class 維持 `arm arm-l`／`arm arm-r`。
  - 在 `fig` 外面、`fx-*` 前面：`prop-globe`（桌上的地球儀，經線群組 class `meridians`）。坐著時 `.fig` 沒有位移，所以地球儀不必跟著身體動。
  - 在 `fig` 外面、跟 `fx-work` 同一層：`fx-read`（「沙沙」，class `sfx`）、`fx-run`（深色小框加三行綠字，三行的 class 是 `code1`、`code2`、`code3`）、`fx-think`（三顆圓點 `dot1`、`dot2`、`dot3`）、`fx-call`（「嘟嚕嚕」，class `sfx`）、`fx-cheer`（「耶！」，class `sfx`）。
  - `FX_BOXES` 的 key 擴充成 `'work' | 'wait' | 'turn' | 'read' | 'run' | 'think' | 'call' | 'cheer' | 'globe'`，算法同既有的（`boxOf` 加 pad 1）。

幾何（人物座標；文字外框沿用 `textPts`）：

| 群組 | 位置 |
|---|---|
| `prop-doc` | 文件 18×14，左上 (20, 48)，白底 `mk-thin`，上面三條橫線 |
| `prop-mobile` | 手機 8×12，左上 (26, 51)，圓角 1.5，墨色機身、螢幕 `var(--screen-working)` |
| `prop-handset` | 聽筒，在左手 (16.5, 63) 附近，長 12 的圓角棒，墨色 |
| `prop-mug` | 杯子 6×7，左上 (41, 60)，`#c9d8e8`；蒸氣兩條在杯口上方 |
| `prop-sheet` | 文件 10×13，左上 (40, 61)，白底 `mk-thin` |
| `prop-globe` | 球心 (−8, 58)、半徑 7，`#7fb3d5` 底、陸塊 `#8bc48a`，支架到 y 69.5（桌面）；外框 x −16..0、y 50..69.5 |
| `fx-read` | 「沙沙」，字級 12，基線 (−24, 40)（「噠噠」的位置） |
| `fx-run` | 框 x 52..80、y 28..44，圓角 2，`fill:#1b2430` 加 `mk-thin`；三行綠字是線段 `M56 33 h12`、`M56 37 h18`、`M56 41 h9`，`stroke:var(--code);stroke-width:1.6`。框在螢幕正上方，因為桌子疊在人物上面，畫在螢幕位置會被擋住 |
| `fx-think` | 圓點 (46, 10) r1.5、(51, 5) r2、(57, −1) r2.5，`var(--fx)` |
| `fx-call` | 「嘟嚕嚕」，字級 9，基線 (−24, 24) |
| `fx-cheer` | 「耶！」，字級 14，基線 (12, 6) |

`theme.css`：在 `:root[data-time="day"]` 加 `--code: #3ddc84;`，在 `:root[data-time="night"]` 加 `--code: #7dffb0;`。

- [ ] **Step 1: 寫會失敗的測試**（修改 `test/figure.test.ts`）
  - 「每個部件與漫符群組都在」的 `names` 加上 `prop-doc`、`prop-mobile`、`prop-handset`、`prop-mug`、`prop-sheet`、`prop-globe`、`fx-read`、`fx-run`、`fx-think`、`fx-call`、`fx-cheer`。
  - 新增：
    ```ts
    test('手上的道具跟著手臂轉：聽筒在左臂、杯子與遞出的文件在右臂', () => {
      const s = figureSvg(base);
      const armL = s.slice(s.indexOf('class="arm arm-l"'), s.indexOf('class="body"'));
      const armR = s.slice(s.indexOf('class="arm arm-r"'), s.indexOf('class="head"'));
      expect(armL).toContain('prop-handset');
      expect(armR).toContain('prop-mug');
      expect(armR).toContain('prop-sheet');
      expect(s.indexOf('prop-globe')).toBeGreaterThan(s.indexOf('class="head"'));
    });
    test('FX_BOXES 涵蓋新漫符與地球儀', () => {
      expect(Object.keys(FX_BOXES).sort()).toEqual(['call', 'cheer', 'globe', 'read', 'run', 'think', 'turn', 'wait', 'work']);
      expect(FX_BOXES.globe.y1).toBeLessThanOrEqual(70.5);
    });
    test('--code 日夜都有', () => {
      const css = readFileSync('web/src/styles/theme.css', 'utf8');
      expect(css.match(/--code: #[0-9a-f]{6};/g)).toHaveLength(2);
    });
    ```
  - 既有的「漫符在自己的座位內」（迭代 `Object.values(FX_BOXES)`）會自動檢查新外框的左右範圍。另外對新的 key（`read`、`run`、`think`、`call`、`cheer`、`globe`）加上 `y0 >= -29`。既有的 `wait`、`turn` 不加：泡泡本來就到 y −30，招牌的限制已由 `BURST_BOX` 那個測試把關。
  - 「顏色不寫在屬性上」不用改，它會自動檢查新的群組。

- [ ] **Step 2: 跑測試，確認失敗**
  Run: `npx vitest run test/figure.test.ts`
  Expected: FAIL（缺少群組、缺少 key、缺少 `--code`）。

- [ ] **Step 3: 實作**：在 `figure.ts` 照上表加幾何常數與群組，`arm(side, look)` 依 side 在手的後面加道具，`FX_BOXES` 加上新的 key。`avatarSvg` 也會呼叫 `arm()`：頭像只框頭和肩膀，道具在手的附近，不會進入頭像的 viewBox；但為了避免道具出現在資訊卡上，讓 `arm()` 多一個參數 `props = true`，`avatarSvg` 傳 `false`。`theme.css` 加上 `--code`。

- [ ] **Step 4: 跑測試，確認通過**
  Run: `npx vitest run && npm run build`
  Expected: 全部 PASS，build 成功。（這時道具在畫面上全部顯示，Task 3 才會藏起來；不要在這兩個 task 之間檢查畫面。）

- [ ] **Step 5: Commit**
  ```bash
  git add web/src/figure.ts web/src/styles/theme.css test/figure.test.ts
  git commit -m "feat: 人物 SVG 加上文件、地球儀、聽筒、杯子、手機與新漫符"
  ```

---

### Task 3: `figure.css`：依 data-pose 顯示與動畫

**Files:**
- Modify: `web/src/styles/figure.css`
- Test: `test/figure.test.ts`（「figure.css 的狀態規則」那個測試）

**Interfaces:**
- Consumes: Task 2 的 class 名稱；Task 1 的 pose 名稱（`data-pose` 的值）。
- Produces: 只要 `.person` 有 `data-act` 加 `data-pose`，就會畫出對的姿勢。

規則（選擇器一律以 `.person` 開頭；動畫只掛在看得到的群組上）：

- 預設全藏：所有 `prop-*` 與新的 `fx-*`，另外寫一條 `display: none` 規則。既有的那一行 `.person .fx-work, .person .fx-wait, .person .fx-turn { display: none; }` 一字不改，因為測試會比對它。
- 顯示規則一律寫成 `選擇器 { display: inline; }`（跟既有寫法相同，測試靠這個格式收集選擇器）。關鍵影格名稱：伸懶腰 `fig-stretch`、跳 `fig-hop`、歡呼往上彈 `fig-cheer`，這三個都用 `translate` 屬性。
- 既有的 `work` 規則（兩手打字、`.sfx` 閃、`fx-work` 顯示）都加上 `[data-pose="edit"]`，只在打字時生效。
- 既有的 `idle` 規則：點頭（`fig-nod`）、`z1`／`z2` 改成只在 `[data-pose="doze"]` 時生效。泡泡仍然照 `data-bubble="on"` 顯示（`fx-turn` 裡的 `.bubble`），但 `z1`／`z2` 在其他 idle pose 時藏起來。表情：`doze` 與 `cheer` 用 `face-turn`（閉眼弧線，歡呼時就是開心的眯眼），`stretch`、`coffee`、`phone` 用 `face-work`。
- 既有的 `up` 規則：右臂預設 `rotate(180deg)`、不揮動；`fig-wave` 只在 `[data-pose="wave"]` 時生效。

各 pose（角度與正負見 Global Constraints；週期與 spec 相同）：

| `data-act` | `data-pose` | 顯示 | 部件與動畫 |
|---|---|---|---|
| `work` | `read` | `prop-doc`、`fx-read` | `arm-l` `rotate(-30deg)`；`arm-r` 在 20° 和 60° 之間來回 1.2s；`.head` `rotate(4deg)`（低頭）；`.sfx` 每 1.2s 閃一次 |
| `work` | `edit` | `fx-work` | 子專案 1 的打字 |
| `work` | `run` | `fx-run` | 兩手不動；`.head` `rotate(8deg)`；`code1`–`code3` 用 `translate` 從 0 往上移 4px 並淡出，週期 0.9s，三行錯開 0.3s |
| `work` | `web` | `prop-globe` | `arm-l` 在 40° 和 60° 之間擺動 0.6s（左手撥地球儀，地球儀在左邊，用左手比右手自然）；`.meridians` 用 `translate` 左右 ±3px，1.2s |
| `work` | `agent` | `prop-handset`、`fx-call` | `arm-l` `rotate(180deg)`（手在左耳）；`face-work` 的嘴巴這版不另外畫開合，只讓 `fx-call` 每 0.5s 閃一次 |
| `work` | `think` | `fx-think` | `arm-r` `rotate(120deg)`（手到下巴）；`.head` `rotate(-6deg)`；`dot1`–`dot3` 依序淡入，1.5s 一輪 |
| `idle` | `stretch` | — | `arm-l` `rotate(-165deg)`、`arm-r` `rotate(165deg)`，3s 一輪：0–40% 舉起、身體 `translate: 0 -2px`，40–67% 放下，其餘停住 |
| `idle` | `coffee` | `prop-mug` | `arm-r` 在 0° 和 115° 之間來回 2.4s；`.steam` 淡入淡出 |
| `idle` | `phone` | `prop-mobile` | `arm-l` `rotate(-30deg)`、`arm-r` `rotate(30deg)`；`.head` `rotate(6deg)`；手機螢幕 opacity 1.2s 一閃 |
| `idle` | `doze` | 子專案 1 的 zZ | 子專案 1 的點頭 |
| `idle` | `cheer` | `fx-cheer` | `arm-l` `rotate(160deg)`、`arm-r` `rotate(-160deg)`（兩手往外舉成 V 字）；`.fig` 用 `translate` 往上彈 4px 一次（`animation: … 1s ease-out 1`）；`fx-cheer` 淡入 |
| `up` | `raise` | — | 右臂 180°，不動 |
| `up` | `wave` | — | 子專案 1 的 `fig-wave` |
| `up` | `hop` | — | 右臂 180°；`.fig` 用 `translate` 在 0–10% 和 20–30% 各往上 6px，1.2s 一輪 |
| `stand` | `deliver` | `prop-sheet` | `arm-r` `rotate(-80deg)`（往右平伸，主人在右邊） |

注意：歡呼在 spec 裡原本寫的是 `data-act="work"`，計畫改成 `data-act="idle"`，見 Task 6 的規格修正。理由是歡呼結束時 `PoseDriver` 只會改 `data-pose`，不會改 `data-act`。放在 idle 底下，泡泡也會跟著出現。

- [ ] **Step 1: 寫會失敗的測試**：修改「figure.css 的狀態規則」，改成檢查新的顯示條件：
  ```ts
  expect(shown).toContain('.person[data-act="work"][data-pose="edit"] .fx-work');
  expect(shown).toContain('.person[data-act="work"][data-pose="read"] .prop-doc');
  expect(shown).toContain('.person[data-act="work"][data-pose="web"] .prop-globe');
  expect(shown).toContain('.person[data-act="idle"][data-pose="coffee"] .prop-mug');
  expect(shown).toContain('.person[data-act="stand"][data-pose="deliver"] .prop-sheet');
  expect(css).toMatch(/\.person\[data-act="idle"\]\[data-pose="doze"\] \.head \{ animation: fig-nod/);
  expect(css).toMatch(/\.person\[data-act="up"\]\[data-pose="wave"\] \.arm-r \{[^}]*fig-wave/);
  // 位移不用 transform（.fig 的 transform 留給坐下站起的過場）
  for (const k of ['fig-hop', 'fig-cheer', 'fig-stretch']) expect(css).toMatch(new RegExp(`@keyframes ${k} \\{[^@]*translate:`));
  ```
  原本那三行 `toContain`（`.person[data-act="work"] .fx-work` 等）裡，`work` 那行改成上面的 edit 版本，`up`、`idle` 那兩行不變。減少動態的那三個斷言不變。

- [ ] **Step 2: 跑測試，確認失敗**
  Run: `npx vitest run test/figure.test.ts`
  Expected: FAIL。

- [ ] **Step 3: 依上表改 `figure.css`**。檔案開頭的註解改成「依 data-act／data-pose／data-bubble」。

- [ ] **Step 4: 跑測試，確認通過**
  Run: `npx vitest run && npm run build`
  Expected: 全部 PASS，build 成功。

- [ ] **Step 5: Commit**
  ```bash
  git add web/src/styles/figure.css test/figure.test.ts
  git commit -m "feat: figure.css 依 data-pose 畫出各工具動作、等待小動作與歡呼"
  ```

---

### Task 4: `Person` 與 `Building`：接上 PoseDriver、歡呼

**Files:**
- Modify: `web/src/person.ts`
- Modify: `web/src/building.ts`（`placePeople`、`settle`）

**Interfaces:**
- Consumes: Task 1 的 `PoseDriver`、`shouldCheer`；`Employee.toolKind`。
- Produces: `Person.pose: PoseDriver`（readonly）。Task 5 會用 `p.pose.still('deliver')`。

做法：
- `Person`：建構時 `this.pose = new PoseDriver((p) => { if (p) this.el.dataset.pose = p; else delete this.el.dataset.pose; })`，接著 `this.pose.work(null)`（預設打字）。`walkTo` 開始站起來或開始走路時呼叫 `this.pose.still(null)`，讓道具收起來、輪替停止。`destroy()` 呼叫 `this.pose.stop()`。
- `Building.placePeople`：在 `rec.occ = o` 之前算 `const cheer = o.kind === 'employee' && rec.occ?.kind === 'employee' && shouldCheer(rec.occ.emp.status, o.emp.status);`，再把它傳給 `this.settle(rec, cheer)`。走路中的人不會呼叫 settle，所以走路時發生的歡呼會被略過，這是可以接受的。
- `Building.settle(rec, cheer = false)`：
  - 助理：工作中 `setAct('work')`、`pose.work(null)`；完成的處理留給 Task 5（這個 task 先維持子專案 1 的 `setAct('idle')`，另外加上 `pose.still(null)`）。
  - 員工：`setAct(ACT[status])`、`setBubble(status === 'idle')`；接著工作中 `pose.work(emp.toolKind)`，等你處理 `pose.up()`，輪到你則是 `cheer ? pose.cheer() : pose.idle()`。

- [ ] **Step 1: 實作上面的改動。** 這兩個檔案碰 DOM，沒有單元測試；純邏輯已經由 Task 1 測過。
- [ ] **Step 2: 驗證**
  Run: `npx vitest run && npm run build`
  Expected: 全部 PASS，build 成功。
- [ ] **Step 3: 瀏覽器檢查**（隔離伺服器加 `simulate --loop`，白天與夜晚各一次）：
  1. 工作中的人會出現翻文件、打字、看綠字、轉地球儀、講電話、托下巴，切換時不會一閃而過（每個至少看得到約 1.5 秒）。
  2. 輪到你的人每隔 6–10 秒換一個小動作，同一層的人不同步；打勾泡泡一直都在，只有打瞌睡時有 zZ、閉眼。
  3. 等你處理的人一直站著、手舉高，3–5 秒換一次（舉手、揮手、跳）；「！」框、集中線、汗滴照舊。
  4. 工作中變成輪到你時，兩手舉成 V 字、跳一下、「耶！」，約 1 秒後開始輪替。
  5. 重新整理頁面：初始畫面沒有人歡呼。
  6. 走路時看不到道具。
  7. crm 那層坐滿 8 人時，道具與漫符沒有蓋到隔壁的人或名牌；綠字框在螢幕上方，沒有被桌子擋住。
  8. console 沒有錯誤。
- [ ] **Step 4: Commit**
  ```bash
  git add web/src/person.ts web/src/building.ts
  git commit -m "feat: 人物依工具類型換動作、等待時輪流小動作、完成時歡呼"
  ```

---

### Task 5: 助理遞文件，`helperRoster` 改成交完才離開

**Files:**
- Modify: `web/src/floors.ts`（`HELPER_LINGER` → `HELPER_MAX_LINGER`、`helperRoster` 簽名、新增 `handoffX`）
- Modify: `web/src/building.ts`（`Rec`、`rollCall`、`settle`、`walk`、`leave`、`placePeople`、`clearPeople`）
- Test: `test/floors.test.ts`、`test/helpers.test.ts`

**Interfaces:**
- Consumes: `Person.pose.still`（Task 4）、`DELIVER_MS`（Task 1）。
- Produces:
  ```ts
  export const HELPER_MAX_LINGER = 20000; // 完成後最多停留多久（安全上限：遞文件被打斷、主人座位找不到時）
  export const HANDOFF_DX = -50;          // 遞文件時站在主人座位中心左邊 50
  export const handoffX = (ownerSeatX: number): number => ownerSeatX + HANDOFF_DX;
  export function helperRoster(prev, gone, employees, now, delivered: ReadonlySet<string> = new Set(), maxLinger = HELPER_MAX_LINGER): Roster;
  ```
  `helperRoster` 的規則：完成的助理在 `delivered.has(k)`，或 `now − doneAt >= maxLinger` 時離開。已經從清單消失的完成助理，只在主人還在、沒有交完、而且還沒到上限時留下。`next` 仍然是最早的 `doneAt + maxLinger`（安全上限的時間）。其他規則不變。

`Building` 的做法：
- `Rec` 加上 `hand?: 'busy' | 'done'` 與 `handT?: ReturnType<typeof setTimeout>`。
- `placePeople` 開頭依這次的 plan 建立 `this.ownerX: Map<sessionId, number>`（員工座位的 `seatCenter`）。
- `rollCall` 把 `this.helpers.people` 裡 `hand === 'done'` 的 key 收成 `delivered`，傳給 `helperRoster`。
- `settle` 遇到完成的助理就呼叫 `this.handoff(rec, key)`（key 用 `helperKey({ owner, a })`）：
  - `hand === 'busy'`：什麼都不做，遞文件中。
  - `hand === 'done'`：`setAct('idle')`、`pose.still(null)`，等下一次 render 把他送走。
  - 主人不在 `ownerX` 裡：`hand = 'done'`，用 `setTimeout(() => this.render(), 0)` 排一次 render（不要在 render 裡面同步再呼叫 render）。
  - 其他情況：`hand = 'busy'`、`setBubble(false)`，然後 `p.walkTo(handoffX(ownerX), () => { p.pose.still('deliver'); rec.handT = setTimeout(() => { rec.hand = 'done'; this.render(); }, DELIVER_MS); }, STAND_MS)`。
- `walk(rec)`（座位改了要走過去）：先 `clearTimeout(rec.handT)`，`hand === 'busy'` 就改回 `undefined`，讓他到新座位後重新出發。
- `leave`、`placePeople` 結尾移除沒看到的人、`clearPeople`：都要 `clearTimeout(rec.handT)`。
- 減少動態不必特別處理：`walkTo` 會直接放到目的地，計時照舊，所以會在主人桌旁停 1 秒再直接回電梯。

- [ ] **Step 1: 寫會失敗的測試**
  - `test/floors.test.ts`：import 從 `HELPER_LINGER` 改成 `HELPER_MAX_LINGER, HANDOFF_DX, handoffX`。既有的 helperRoster 測試把 3000 換成 `HELPER_MAX_LINGER`（`expect(HELPER_MAX_LINGER).toBe(20000)`），各個時間點跟著平移（例如 `r1.next` 變成 `1000 + 20000`、到期改成 `21000`）。新增：
    ```ts
    test('helperRoster：交完文件就離開，不必等到上限', () => {
      const d = asst({ id: 't1', status: 'done' }), o = emp('o', 'working', { assistants: [d] });
      const r1 = helperRoster(new Map([track(o, d, 1000)]), new Set(), [o], 2000);
      expect(keysOf(r1.stay)).toEqual(['o/t1']);
      const r2 = helperRoster(r1.stay, r1.gone, [o], 2500, new Set(['o/t1']));
      expect(r2.out).toEqual(['o/t1']);
      expect([...r2.gone]).toEqual(['o/t1']);
    });
    test('helperRoster：已從清單消失、交完文件的助理也離開', () => {
      const d = asst({ id: 't1', status: 'done' }), o = emp('o', 'working', { assistants: [d] }), o2 = emp('o', 'idle');
      const r = helperRoster(new Map([track(o, d, 1000)]), new Set(), [o2], 2000, new Set(['o/t1']));
      expect(r.out).toEqual(['o/t1']);
    });
    test('handoffX：站在主人座位中心左邊 50', () => {
      expect(HANDOFF_DX).toBe(-50);
      expect(handoffX(seatCenter(2))).toBe(seatCenter(2) - 50);
    });
    ```
  - `test/helpers.test.ts`：`HELPER_LINGER` 改成 `HELPER_MAX_LINGER`（主人 Stop 之後再過上限，助理都走了），其餘不變。

- [ ] **Step 2: 跑測試，確認失敗**
  Run: `npx vitest run test/floors.test.ts test/helpers.test.ts`
  Expected: FAIL（`HELPER_MAX_LINGER`、`handoffX` 不存在）。

- [ ] **Step 3: 實作 `floors.ts`，再改 `building.ts`**（照上面的做法）。註解裡的「HELPER_LINGER」「停留 3 秒」都要改掉。

- [ ] **Step 4: 驗證**
  Run: `npx vitest run && npm run build`
  Expected: 全部 PASS，build 成功。

- [ ] **Step 5: 瀏覽器檢查**：
  1. 助理完成後站起來，拿著文件走到主人座位左邊，往右伸手遞文件約 1 秒，收起文件後走回電梯。
  2. 有好幾個助理時，一個走了、其他人換座位：正在遞文件的那位先走回新座位，再重新出發，最後一定會離開。
  3. 主人下班時，助理直接走去電梯。
  4. 開「減少動態」：助理直接出現在主人桌旁，停約 1 秒後消失；沒有歡呼；輪到你都是打瞌睡、等你處理都是舉手；工作中的姿勢仍然依工具不同。
  5. console 沒有錯誤。

- [ ] **Step 6: Commit**
  ```bash
  git add web/src/floors.ts web/src/building.ts test/floors.test.ts test/helpers.test.ts
  git commit -m "feat: 助理完成後走到主人桌旁遞文件，交完才離開"
  ```

---

### Task 6: 規格修正與 README

**Files:**
- Modify: `docs/superpowers/specs/2026-11-01-figure-actions-design.md`
- Modify: `README.md`

（規格修正已經跟這份計畫在同一個 commit 一起完成；這個 task 只剩 README。如果實作時又調整了數值，請一併回寫到規格。）

- [ ] **Step 1: README 的「功能」**
  - 「三種狀態一眼分辨」那段後面補一句：工作中會依正在用的工具換動作（讀檔或搜尋是翻文件、編輯是打字、跑指令是盯著綠字、上網是轉地球儀、派助理是講電話、在想下一步是托下巴）；輪到你時輪流伸懶腰、喝咖啡、滑手機、打瞌睡；等你處理時一直站著舉手，輪流揮手、跳；做完時歡呼一次。
  - 「助理也是員工」：「完成後 3 秒離開」改成「完成後拿文件走到主人桌旁遞給他，再離開」。
  - 新增一句：系統開啟「減少動態」時，小動作都停住。
- [ ] **Step 2: 驗證**
  Run: `npx vitest run && npm run build`
  Expected: 全部 PASS，build 成功。
- [ ] **Step 3: Commit**
  ```bash
  git add README.md
  git commit -m "docs: README 補上人物動作"
  ```
