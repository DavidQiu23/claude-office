@echo off
chcp 65001 >nul
rem 雙擊啟動 Claude 辦公室：伺服器沒開就先開，再打開瀏覽器
cd /d "%~dp0"

if not exist dist\server\main.js (
  echo 找不到 dist\server\main.js。請先執行 npm install 和 npm run build；放到桌面時請用捷徑，不要複製這個檔案。
  pause
  exit /b 1
)

set "PORT="
for /f "usebackq" %%p in (`node -e "import('./dist/config.js').then(m=>console.log(m.loadConfig().port))"`) do set "PORT=%%p"
if not defined PORT (
  echo 讀不到 port，請確認已安裝 Node.js。
  pause
  exit /b 1
)
set "URL=http://127.0.0.1:%PORT%/"

curl -sf -o nul --max-time 2 "%URL%" && goto open

rem cmd /k 讓視窗在伺服器結束後留著，看得到錯誤訊息
start "Claude Office" /min cmd /k node dist\server\main.js
curl -sf -o nul --max-time 2 --retry 10 --retry-delay 1 --retry-connrefused "%URL%" && goto open

echo 伺服器沒有啟動，原因請看工作列上的 Claude Office 視窗。
pause
exit /b 1

:open
start "" "%URL%"
