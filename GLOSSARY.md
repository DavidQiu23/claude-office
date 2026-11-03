# Claude 辦公室

把本機的 Claude Code session 畫成剖面大樓。這份詞彙表統一討論和文件裡的用詞。

## Language

**員工**：
一個 Claude Code session。有自己的狀態（工作中、等你處理、輪到你），算進電梯燈、狀態列和分頁標題。
_Avoid_: session 角色、人物（指資料時）

**助理**：
員工派出去的一個 subagent，屬於派它的員工。畫面上也是坐在桌前的人，但只有工作中一種樣子，也不算進任何提示。
_Avoid_: subagent 員工、小幫手、機器人

**主人**：
派出助理的那位員工。
_Avoid_: 父 session

**樓層**：
同一個 cwd 的員工和他們的助理坐的那一層。
_Avoid_: 房間、專案區
