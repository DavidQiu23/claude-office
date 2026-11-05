# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

一位同時開好幾個 Claude Code session 的開發者（專案作者本人，也開源給其他人用）。畫面常駐在副螢幕或視窗旁的窗格，工作時用眼角餘光掃，只有要處理時才正眼看。

## Product Purpose

把本機的 Claude Code session 畫在一個網頁上，不用逐一切過去看，就知道有哪些專案、哪些 session 在等我。狀態一定要準確，排在美觀之前。

成功的標準：

1. 每個 session 顯示的狀態和真實狀態一致。
2. 「等你處理」在事件發生後 1 秒內出現，而且是畫面上最醒目的東西。
3. 不管伺服器有沒有開，Claude Code 都不會變慢、也不會報錯。

## Positioning

它不是工作管理面板，也不操作 session：它把一群 agent 的工作狀態，變成一個一直開著也不煩、瞄一眼就懂的東西。

## Operating Context

- 常駐在副螢幕或窗格，大多從遠處、用餘光看；窗格可能很窄。
- 同時有數個專案（cwd），每個專案一到多個 session，session 底下可能有工作中的 subagent（助理）。
- 白天和晚上都開著；日夜依本機時間自動切換，也可以用 `?time=day|night` 固定。

## Capabilities and Constraints

狀態規則、事件對應和資料模型在 `src/state` 與 `README.md`，改畫面不動它們。

- 三種狀態：工作中、等你處理（紅）、輪到你（琥珀）。紅色和琥珀色只給狀態用。
- 分頁標題要顯示人數（例如 `(!1 ✓2) Claude 辦公室`），分頁在背景也看得到。
- 畫面外有人在等時要看得出來。
- 可以從畫面看 session 的標題、資料夾、目前動作、最近與第一個 prompt、助理清單、到班時間，並「請他下班」（只影響畫面）。
- 只跑在本機（127.0.0.1），不用外部資源、不連外。
- 不做：聲音與系統通知、從畫面操作 session、跨電腦、讀對話內容。
- 系統開「減少動態」時要全部停住，狀態仍看得出來。
- 前端是 Vite、TypeScript、DOM 加行內 SVG，沒有框架。

## Brand Commitments

產品名稱「Claude 辦公室」（claude-office）。沒有綁定的視覺資產。大樓隱喻和現有畫風已經定案，只在這個基礎上優化，不整個換掉；理由和否決過的方向見 `docs/design.md`。

## Evidence on Hand

- `scripts/simulate.ts`：模擬事件，一輪約 28 秒，涵蓋所有狀態。
- `test/fixtures/`：真實 hook 事件樣本。
- 沒有使用者見證或數據，不得捏造。

## Product Principles

1. 狀態準確排第一，好看排第二。
2. 等我的東西永遠最醒目；沒事的時候畫面要安靜。
3. 能從遠處讀：靠位置、面積、顏色，不靠讀小字。
4. 一直開著也不煩：動得少、動得有意義。
5. 能少畫就少畫，維護成本也算設計的一部分。

## Accessibility & Inclusion

狀態不能只靠顏色區分（要有形狀或文字），要尊重「減少動態」。
