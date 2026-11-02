# Issue tracker：本機 Markdown

這個 repo 的規格和 issue 是 `.scratch/` 底下的 markdown 檔。`.scratch/` 在 `.gitignore` 裡，只留在本機，不進 git。

## 慣例

- 一個功能一個資料夾：`.scratch/<feature-slug>/`
- 規格是 `.scratch/<feature-slug>/spec.md`
- 實作用的 issue 一張票一個檔案，放在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，從 `01` 開始編號，不能把所有票寫在同一個檔案
- triage 狀態寫在每個 issue 檔案頂端附近的 `Status:` 行（角色名稱見 `triage-labels.md`）
- 留言和討論紀錄附加在檔案底部的 `## Comments` 標題下
- 做完、結論併進 `docs/design.md` 後，刪掉整個功能資料夾

## skill 說「發布到 issue tracker」時

在 `.scratch/<feature-slug>/` 底下建立新檔案（資料夾不存在就建立）。

## skill 說「取得相關的票」時

讀指定路徑的檔案。使用者通常會直接給路徑或票號。

## Wayfinding 操作

給 `/wayfinder` 用。**map** 是一個檔案，每張票各有一個 **child** 檔案。

- **Map**：`.scratch/<effort>/map.md`（內容是 Notes／Decisions-so-far／Fog）。
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，從 `01` 開始編號，內文是要回答的問題。`Type:` 行記錄票的類型（`research`／`prototype`／`grilling`／`task`）；`Status:` 行記錄 `claimed`／`resolved`。
- **Blocking**：頂端附近寫一行 `Blocked by: NN, NN`。列出的檔案都是 `resolved` 時，這張票就不再被擋。
- **Frontier**：掃描 `.scratch/<effort>/issues/`，找出未完成、沒被擋、沒人認領的檔案，編號最小的先做。
- **Claim**：動手前先設成 `Status: claimed` 並存檔。
- **Resolve**：在 `## Answer` 標題下寫答案，設成 `Status: resolved`，再把一行摘要加連結附加到 `map.md` 的 Decisions-so-far。
