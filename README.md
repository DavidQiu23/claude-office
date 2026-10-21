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
| 員工 | 工作中 | 坐在桌前上下抖動，頭上氣泡顯示目前動作 | 送出 prompt、工具執行 |
| 員工 | 等你處理 | 站起來，頭上紅色驚嘆號跳動，桌子變紅 | 權限提示的 Notification |
| 員工 | 閒置 | 坐著不動，旁邊有咖啡杯 | 回合結束（Stop） |
| 員工 | 下班 | 走向門口後消失 | SessionEnd、按「請他下班」、閒置 12 小時 |
| 助理（目前一律是色塊，沒有像素素材） | 工作中 | 灰色方塊加簡短描述 | subagent 啟動 |
| 助理 | 完成 | 綠色方塊加「👍 完成」，3 秒後淡出 | subagent 結束 |

## 已知限制

- 「等你處理」是暫定的判斷方式，**尚未用真實的互動式 Notification 驗證**（驗證流程為 headless，收不到該事件）。
- 直接關閉終端機視窗可能收不到 SessionEnd，員工會留在辦公室。請用「請他下班」，或等 12 小時自動離開。
- 按 Esc 中斷不會觸發 Stop，員工可能一直停在「工作中」（或拒絕互動式權限後停在「等你處理」），直到下一次 prompt／事件；**尚未用真實互動式 session 驗證**。
- `run_in_background` 的 Agent 行為尚未測試。
- 細節見 `docs/findings.md`。

## 素材授權

見 [web/public/assets/LICENSE.md](web/public/assets/LICENSE.md)。預定使用 2dPig 的 Pixel Office（CC0）：到 https://2dpig.itch.io/pixel-office 下載，把員工圖存為 `web/public/assets/worker.png`、桌子圖存為 `web/public/assets/desk.png`（各為單張圖，人物建議約 24x32、桌子約 72x22），再執行 `npm run build`。圖片會被縮放到固定大小（人物 20x32、桌子 72x22），任何尺寸都可用。人物會以衣服顏色著色，若素材本身已有配色而顯得混濁，把 `web/src/OfficeScene.ts` 的 `USE_TINT` 改成 `false`。助理維持色塊。**目前尚未放入素材**，沒有這兩個檔案時會顯示色塊。
