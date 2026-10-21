# Claude 辦公室

把本機的 Claude Code session 顯示成像素辦公室：每個 session 是一位員工，subagent 是他的助理。

## 需求

Node 22

## 安裝

```
npm install
npm run build
npm run install-hooks
```

`install-hooks` 會把 hook 寫入 `~/.claude/settings.json`。

## 使用

```
npm start
```

然後用瀏覽器打開 http://127.0.0.1:47823 。伺服器只監聽 127.0.0.1，僅限本機存取。滑鼠移到員工身上會出現資訊卡，可按「請他下班」。
沒有真實 session 時可用 `npm run simulate` 模擬各種狀態。

## 修改 port

建立 `%USERPROFILE%\.claude-office\config.json`：

```json
{"port": 50000}
```

## 移除

```
npm run uninstall-hooks
```

只會從 `~/.claude/settings.json` 移除 claude-office 的項目；第一次安裝時會建立原始檔備份 `settings.json.claude-office.bak`。

## 狀態說明

| 角色 | 狀態 | 外觀 | 觸發 |
| --- | --- | --- | --- |
| 員工 | 工作中 | 坐在桌前打字（雙手交替），筆電指示燈綠色，頭上氣泡顯示目前動作 | 送出 prompt、工具執行 |
| 員工 | 等你處理 | 站起來舉手，頭上紅色驚嘆號跳動，桌子和筆電燈變紅 | 權限提示的 Notification |
| 員工 | 閒置 | 坐著喝咖啡，筆電燈黃色 | 回合結束（Stop） |
| 員工 | 下班 | 走向門口後消失 | SessionEnd、按「請他下班」、閒置 12 小時 |
| 助理 | 工作中 | 灰色小機器人加簡短描述 | subagent 啟動 |
| 助理 | 完成 | 綠色小機器人加「👍 完成」，3 秒後淡出 | subagent 結束 |

## 已知限制

- 「等你處理」是暫定的判斷方式，**尚未用真實的互動式 Notification 驗證**（驗證流程為 headless，收不到該事件）。
- 直接關閉終端機視窗可能收不到 SessionEnd，員工會留在辦公室。請用「請他下班」，或等 12 小時自動離開。
- 按 Esc 中斷不會觸發 Stop，員工可能一直停在「工作中」（或拒絕互動式權限後停在「等你處理」），直到下一次 prompt／事件；**尚未用真實互動式 session 驗證**。
- `run_in_background` 的 Agent 行為尚未測試。
- 細節見 `docs/findings.md`。

## 美術

所有畫面（人物、桌子、地板、牆、門、盆栽、小機器人）都由 `web/src/art.ts` 用程式畫成像素貼圖，沒有使用任何外部素材，因此沒有授權問題。想改外觀（髮色、桌子、配色）直接改該檔案，再執行 `npm run build`。
