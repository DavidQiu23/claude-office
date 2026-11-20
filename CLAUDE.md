# claude-office

把本機的 Claude Code session 畫成剖面大樓的本機網頁。前端是 Vite、TypeScript、DOM 加行內 SVG，沒有框架。

## 文件

每種資訊只放一個地方：

- `README.md`：使用者看得到的行為，包括狀態、觸發事件、畫面元素和指令。
- `docs/design.md`：設計理由，和改設計時不能破壞的規則。
- 尺寸、顏色、時間等數值：程式碼本身。

改東西時，對應的文件放在同一個 commit 裡一起更新：

- 行為改了要改 `README.md`。畫面改了要重拍 `docs/images/office-day.png` 和 `office-night.png`。
- 改設計前先讀 `docs/design.md`，改完直接改寫它，讓它描述改完後的現況，不要另外疊一份新的。

## superpowers skill

流程 skill（brainstorming、writing-plans、test-driven-development）只用在新功能、改設計，或使用者明確要求的時候。小修改和修 bug 直接動手，測試照下方「驗證」一節。

討論用的 spec、plan、mockup 放在 `docs/superpowers/`。結論併進 `docs/design.md` 後就刪掉，要找可以翻 git 歷史。

## 驗證

- `npm test` 會先用 `tsc` 把後端編譯到 `dist/`，因為 hook 和 installer 的測試跑的是編譯後的檔案。
- `npm test` 不會建置前端。伺服器提供的是 `dist/web`，所以改了 `web/` 要先跑 `npm run build`，瀏覽器才看得到新畫面。
- 前端用到 `src/state` 的型別（`web/tsconfig.json` 有納入 `../src/state`），所以改 `types.ts` 時要跑 `npm run build`，讓前後端都通過型別檢查。
- 畫面改動要在瀏覽器裡看過白天和夜晚。要用隔離的家目錄和 port，才不會碰到使用者真正的設定，也不會碰到 47823 上的伺服器。Windows 上 Node 的 `os.homedir()` 讀的是 `USERPROFILE`，不是 `HOME`：

  ```powershell
  # 終端機 1：建立暫存家目錄，建置後啟動伺服器（應顯示 http://127.0.0.1:47999）
  $h = Join-Path $env:TEMP 'office-verify'
  New-Item -ItemType Directory -Force "$h\.claude-office" | Out-Null
  Set-Content "$h\.claude-office\config.json" '{"port":47999}'
  $env:USERPROFILE = $h
  npm run build
  npm start

  # 終端機 2：同一個家目錄跑模擬（一輪約 28 秒，加 --loop 會一直重播）
  $env:USERPROFILE = Join-Path $env:TEMP 'office-verify'
  npx tsx scripts/simulate.ts
  ```

  打開 `http://127.0.0.1:47999/?time=day` 和 `?time=night`。看完在終端機 1 按 Ctrl+C 停掉伺服器，執行 `Remove-Item -Recurse -Force (Join-Path $env:TEMP 'office-verify')`，再關掉這兩個終端機，因為裡面的 `USERPROFILE` 已經被改掉了。
- 測試和驗證產生的東西要自己清掉，包括暫存資料夾、伺服器、headless 瀏覽器和它的 profile，清完要列出來確認。測試裡每個 `mkdtempSync` 都要有對應的刪除。

## Commit

- 訊息用繁體中文，保留 `feat:`、`fix:`、`docs:`、`refactor:`、`chore:` 前綴。
- 結尾加 `Co-Authored-By`，不加 session 連結。
- 要修正上一個 commit，用 `--fixup` 搭配 `rebase --autosquash` 併回去，不要另外開一個 commit。
