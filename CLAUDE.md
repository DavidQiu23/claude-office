# claude-office

把本機的 Claude Code session 畫成剖面大樓的本機網頁。功能和指令看 `README.md`，設計理由和不能破壞的規則看 `docs/design.md`。

## 改設計

- 動手前先讀 `docs/design.md`。改完直接更新這份文件，讓它描述改完後的現況。
- 討論用的 spec、plan、mockup 放在 `docs/superpowers/` 底下，做完、結論併進 `design.md` 後就刪掉，git 歷史找得回來。
- `README.md` 是使用者看得到的行為的唯一說明。行為改了，同一個 commit 要一起改 README。畫面改了，要重拍 `docs/images/office-day.png`、`office-night.png`。

## 驗證

- `npm test` 會先跑 `tsc`，把後端重新編譯到 `dist/`，hook 和 installer 的測試用的是編譯後的檔案。
- `npm test` 不會建置前端。伺服器提供的是 `dist/web`，改了 `web/` 要先 `npm run build`，瀏覽器才看得到新畫面。
- 前端用到 `src/state` 的型別（`web/tsconfig.json` 納入 `../src/state`），改 `types.ts` 時要跑 `npm run build`，讓前後端都過型別檢查。
- 畫面改動要在瀏覽器裡看過白天和夜晚。用隔離的家目錄和 port，才不會碰到使用者真正的設定和 47823 上的伺服器。Windows 上 Node 的 `os.homedir()` 讀 `USERPROFILE`，不是 `HOME`：

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

  打開 `http://127.0.0.1:47999/?time=day` 和 `?time=night`。看完在終端機 1 按 Ctrl+C 停伺服器，跑 `Remove-Item -Recurse -Force (Join-Path $env:TEMP 'office-verify')`，再關掉這兩個終端機（裡面的 `USERPROFILE` 已經改掉）。
- 測試和驗證產生的東西要自己清掉，包括暫存資料夾、伺服器、headless 瀏覽器和它的 profile，清完列出來確認。測試裡每個 `mkdtempSync` 都要有對應的刪除。

## Commit

- 訊息用繁體中文，保留 `feat:`／`fix:`／`docs:`／`refactor:`／`chore:` 前綴。
- 結尾加 `Co-Authored-By`，不加 session 連結。
- 修正上一個 commit 的東西，用 `--fixup` 搭配 `rebase --autosquash` 併回去，不另外開一個 commit。
