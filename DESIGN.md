---
name: Claude 辦公室
description: 把本機的 Claude Code session 畫成一棟一直開著的剖面大樓
colors:
  alarm-red: "#d63434"
  lamp-amber: "#f2b83d"
  quiet-leaf: "#6fae7a"
  screen-amber: "#f6d68a"
  screen-rose: "#f2a0a0"
  comic-ink: "#1b1716"
  body-ink: "#2d2a26"
  faded-ink: "#6b5f4f"
  amber-ink: "#4a3000"
  plate-ink: "#3b3020"
  sticker-white: "#ffffff"
  old-paper: "#faf5ea"
  plate-cream: "#fbf6ea"
  cream-wall: "#fbf1dc"
  plaster-ceiling: "#e6d2ab"
  side-wall-lit: "#efdcb8"
  side-wall-shade: "#e2cc9f"
  teal-wainscot: "#9ccfc3"
  teal-wainscot-rail: "#7db5a8"
  oak-floor: "#e3d3b0"
  oak-floor-back: "#d2c098"
  floor-slab: "#cdb894"
  pavement: "#d9d2c2"
  worn-button: "#e8dbc2"
  cold-desk: "#e9edf2"
  cold-desk-shade: "#c3cdd8"
  walnut: "#c79a6a"
  walnut-shade: "#a87e52"
  water-tank: "#9cd3ff"
  window-sky: "#8fcefa"
  day-sky-top: "#5fb6f5"
  day-sky-bottom: "#bfe6ff"
  night-sky-top: "#0a0f33"
  night-sky-bottom: "#2e2f6e"
  night-shade: "#16224a"
  project-harbor: "#4f86b8"
  project-deep-sea: "#3d4f7a"
  project-moss: "#6f9a5e"
  project-lavender: "#8a74b0"
  project-rose: "#c0688a"
  project-celadon: "#4a9a94"
  project-magenta: "#a64d9e"
  project-steel: "#6e7b8b"
typography:
  card-title:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.35
  sign:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "22px"
  plate:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: "15px"
  body:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, \"Microsoft JhengHei\", sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em"
  mono:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  swatch: "3px"
  note: "4px"
  plate: "7px"
  panel: "9px"
  inset: "10px"
  card: "14px"
  rail: "20px"
  pill: "999px"
spacing:
  gap: "6px"
  stack: "12px"
  margin-right: "16px"
  side-gap: "24px"
  gutter: "56px"
  ground: "72px"
  seat: "120px"
  floor: "200px"
components:
  plate-working:
    backgroundColor: "{colors.plate-cream}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "2px 6px 2px 5px"
    minHeight: "20px"
  plate-waiting:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.sticker-white}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "0 7px"
    height: "19px"
  plate-idle:
    backgroundColor: "{colors.lamp-amber}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "0 7px"
    height: "19px"
  floor-sign:
    textColor: "{colors.sticker-white}"
    typography: "{typography.sign}"
    rounded: "{rounded.plate}"
    padding: "0 12px"
    height: "26px"
  elevator-rail:
    backgroundColor: "{colors.sticker-white}"
    rounded: "{rounded.rail}"
    width: "40px"
  elevator-button:
    backgroundColor: "{colors.worn-button}"
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.pill}"
    size: "28px"
  elevator-button-waiting:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.sticker-white}"
    rounded: "{rounded.pill}"
    size: "28px"
  elevator-button-idle:
    backgroundColor: "{colors.lamp-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.pill}"
    size: "28px"
  info-card:
    backgroundColor: "{colors.sticker-white}"
    textColor: "{colors.comic-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    width: "300px"
  status-chip:
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 11px 3px 9px"
  activity-box:
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.inset}"
    padding: "8px 12px 9px"
  button-dismiss:
    backgroundColor: "{colors.sticker-white}"
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.panel}"
    padding: "6px 14px"
  button-dismiss-hover:
    textColor: "{colors.alarm-red}"
---

# Design System: Claude 辦公室

## Overview

**Creative North Star: "下班不關燈的剖面大樓"**

這是一棟被切開的大樓，一個專案一層樓，每個 session 是坐在桌後、面向你的 Q 版員工。它從早到晚開在副螢幕上，所以平常要安靜：環境只有很慢、很小的動作，大部分顏色是奶油、藍綠和木頭。有人等你時才吵：那個人站起來爆氣，名牌變紅。可愛是為了讓人願意一直開著，不是裝飾；紅色和琥珀色的稀有，才是畫面真正的功能。

畫法是黑色線稿加一階硬影，圓滾滾的機械風，人物走鳥山明前期風的 Q 版比例，但不放原作的角色、招牌髮型、標誌或名字。介面是貼在大樓上的厚實貼紙與硬卡：粗墨線、白外圈、不模糊的硬投影。夜晚不是另一套配色，是同一棟樓蓋上深藍遮罩再點燈。

已否決的方向：等角辦公室、Phaser／Canvas 黏土畫法、程式像素畫、細墨線加網點、柔和向量插畫、賽璐璐動漫風、AI 生圖與素材包、漫畫符號（zZ、「！」框、汗滴、集中線）。完整理由在 `docs/design.md`。

本檔是給 AI 和設計者看的視覺摘要，數值從 `web/src/styles/` 與 `web/src/view.ts` 萃取；兩邊不一致時以程式碼為準，再回頭更新本檔。

**Key Characteristics:**

- 位置、面積、顏色先於文字：從遠處掃一眼就能讀。
- 墨線 `comic-ink` 貫穿環境、人物和介面，是整個畫面的骨架。
- 所有深度都是硬邊，光固定從左上來；模糊只留給發光的東西。
- 角色演出取代符號，狀態同時靠顏色、姿勢和名牌前綴表達。
- 日夜同一套顏色，介面元件在遮罩之上，日夜長得一樣。

## Colors

暖色紙感的建築配上清爽的天空，飽和的紅和琥珀完全保留給狀態。

### Primary

狀態色就是這套系統的主色，日夜相同。

- **警示紅** (#d63434)：等你處理。名牌、電梯燈、權限對話框、夜晚爆氣周圍的紅光。
- **暖燈琥珀** (#f2b83d)：輪到你。名牌、電梯燈、輪到你的螢幕。比紅色安靜，不脈動。
- **琥珀螢幕** (#f6d68a)：輪到你的映像管畫面和夜晚的螢幕光。
- **淡紅螢幕** (#f2a0a0)：等你處理時螢幕上對話框的標題列。
- **安靜葉綠** (#6fae7a)：工作中。只出現在資訊卡的小標記；名牌本身維持米白，三種狀態裡最不搶眼。

### Secondary

專案色，由 cwd 雜湊決定（`view.ts` 的 `PROJECT_COLORS`），用在招牌、資訊卡色帶和資料夾小方塊。都是中明度，彩度壓在撞色標準以下。

- **港灣藍** (#4f86b8)、**深海藍** (#3d4f7a)、**苔綠** (#6f9a5e)、**薰衣草** (#8a74b0)、**玫瑰** (#c0688a)、**青瓷** (#4a9a94)、**洋紅紫** (#a64d9e)、**鋼灰** (#6e7b8b)。

人物的衣服和髮色另有兩組（`view.ts` 的 `SHIRT_COLORS`、`HAIR_COLORS`），由 sessionId 雜湊決定，同樣不能落進狀態色。

### Tertiary

環境裡有色的物件。

- **藍綠護牆板** (#9ccfc3) 與**護牆板壓條** (#7db5a8)：後牆下段。
- **冷白桌面** (#e9edf2) 與**桌子硬影** (#c3cdd8)：桌子刻意是冷色，才能從奶油牆面跳出來。
- **胡桃木** (#c79a6a) 與**胡桃木硬影** (#a87e52)：木質家具。
- **水塔藍** (#9cd3ff)：屋頂水塔和天線燈。
- **窗景天空** (#8fcefa)：圓窗裡的天空，取天空漸層兩端的中間值。
- **白天天空** (#5fb6f5 到 #bfe6ff) 與**夜晚天空** (#0a0f33 到 #2e2f6e)：固定在視窗上的漸層。屋頂後面可以有墨線畫的遠景樓房。

### Neutral

- **漫畫墨** (#1b1716)：所有線稿、外框和介面主文字。
- **本文墨** (#2d2a26)：環境裡的紙條與預設文字。
- **褪色墨** (#6b5f4f)：次要文字、計數為零、虛線分隔。
- **琥珀墨** (#4a3000)：琥珀底上的字。
- **名牌墨** (#3b3020)：工作中名牌的字。
- **貼紙白** (#ffffff)：介面底色、外圈，以及紅底和招牌上的字。
- **舊紙** (#faf5ea)：環境裡的紙，例如大廳紙條。
- **米白名牌** (#fbf6ea)：工作中名牌。
- **奶油牆** (#fbf1dc)、**灰泥天花板** (#e6d2ab)、**受光側牆** (#efdcb8)、**背光側牆** (#e2cc9f)：房間外殼；右牆一律比左牆暗。
- **橡木地板** (#e3d3b0)、**地板深帶** (#d2c098)、**樓板** (#cdb894)、**人行道** (#d9d2c2)：水平的承重面。
- **磨舊按鈕** (#e8dbc2)：電梯按鈕底色，也是資訊卡一階硬影的基底。
- **夜幕** (#16224a)：夜晚 `multiply` 遮罩，不透明度 .62。

### Named Rules

**The Only For Status Rule.** 紅和琥珀只給狀態用。環境、專案色、髮色、衣服色都不能碰；色相離這兩色 20° 內、HSV 彩度 ≥ 0.55 就算撞色。

**The One Palette Rule.** 環境顏色只有一套。夜晚靠遮罩加光暈，不開第二套灰暗配色；日夜只切換天空和 `--day`／`--night`。

**The Ink Skeleton Rule.** 每個物件都有墨線外框，不用灰線、不用無框色塊。墨線是把環境、人物和介面綁成同一個世界的東西。

## Typography

**Display Font:** 無，系統字型就夠了
**Body Font:** system-ui（with "Microsoft JhengHei", sans-serif）
**Label/Mono Font:** ui-monospace（with Consolas, monospace），只用在助理類型標籤

**Character:** 不載入外部字型，字跟著系統走，靠粗細和外框站穩。文字是最後一道確認，不是主要訊號；字重偏粗才不會輸給插畫。

### Hierarchy

- **Card Title** (800, 16px, 1.35)：資訊卡色帶上的標題，白字加 3px 墨線描邊，`paint-order: stroke fill`。專案色多半是中明度，白字直接放上去對比不夠。
- **Sign** (700, 15px, 22px)：樓層招牌。放不下用「…」。
- **Plate** (700, 13px, 15px)：名牌，最寬 112px，最多兩行。
- **Body** (400, 13px, 1.5)：資訊卡內文，以 line clamp 限 1 到 3 行。
- **Label** (700, 11px, 0.08em)：資訊卡的段落小標。
- **Mono** (400, 11px)：助理類型的小方塊。

### Named Rules

**The Readable From Afar Rule.** 名牌與招牌永遠粗體、有色底、有外框，夜晚也在遮罩之上。任何要靠 11px 文字才讀得懂的狀態都是錯的。

## Layout

固定節奏的剖面：一層樓高 200px（含 8px 樓板），一個座位寬 120px，三個座位接一個最窄 180px 的家具區，地面高 72px。沒人的格子是空桌，椅子調淡。專案多時不把樓層變矮，往下捲；各層同寬，整頁一起橫向捲動。

左邊留 56px 給電梯面板（固定在視窗左側垂直置中，寬 40px），右邊距 16px。桌子、招牌、家具區離樓層左右緣各 24px，不貼著兩側 16px 寬的斜牆。大樓比視窗矮時，上方由天空補滿，不留空白或暗角。

沒有 CSS 斷點：窄窗格靠整頁橫向捲動。

疊放順序是規則的一部分：夜晚遮罩 1、光暈 2、名牌和招牌 3、斷線說明 20、電梯面板 25、資訊卡 30。

**The Root Stacking Rule.** 樓層、桌子、人物這幾層祖先都不能建立自己的疊層（不加 `transform`、`filter`、`opacity`、`z-index`），不然遮罩或光暈會被關在裡面。

**The Fixed Floor Rule.** 每層都是長方形，固定層高。不用並排房間、不把樓層變矮、不依緊急程度重排：位置要穩定，才能從餘光記住誰在哪裡。

## Elevation & Depth

深度全是硬邊，光固定從左上來，所以投影一律往右下，物件右側一塊加深的實色就是暗面（一階硬影，不用網點、不用漸層明暗）。房間本身是淺盒舞台：天花板、直紋壁紙和鑲板護牆板的後牆、透視板縫的木地板和兩側斜牆，人和家具仍然正面朝向觀看者。

### Shadow Vocabulary

- **貼紙投影** (`box-shadow: 0 0 0 2.5px #fff, 2px 3px 0 2.5px rgb(27 23 22 / .35)`)：名牌、招牌、斷線說明、電梯面板、資訊卡共用（`--ui-shadow`）。白外圈讓它們能壓在任何背景上。
- **物件投影** (`filter: drop-shadow(3px 3px 0 rgb(27 23 22 / .18))`)：桌子、家具、屋頂，讓它們離開牆面（`--drop`）。
- **卡片暗面** (`box-shadow: inset -7px -7px 0 color-mix(in srgb, #e8dbc2 55%, #fff)`)：資訊卡內側右下的一階硬影，畫在 `.card::before`。
- **小件投影** (`box-shadow: 2px 3px 0 rgb(27 23 22 / .22)` 到 `.3`)：卡片裡的目前動作框、請他下班按鈕。

### Named Rules

**The Hard Edge Rule.** 投影一律硬邊、往右下、顏色用墨色（`rgb(27 23 22 / …)`），不用模糊陰影，也不用暖褐，因為暖褐太接近琥珀。

**The Blur Is Light Rule.** 模糊只留給會發光的東西：夜晚用 `screen` 疊在遮罩上的光暈（桌燈、螢幕、窗外夜空、立燈、販賣機、爆氣紅光），以及白天爆氣氣場外圍的冷藍光暈。

## Shapes

一切都是圓的：物件有圓角和鉚釘，人物是大頭寬橢圓臉，屋頂有圓頂水塔，窗是鉚釘圓窗。只有兩側斜牆和透視地板的板縫是直線，用來交代空間。

介面的圓角隨面積變大：3px 的小色塊、7px 的名牌與招牌、9px 的斷線說明與按鈕、14px 的資訊卡；電梯面板是 20px 的長膠囊，按鈕是正圓。只有兩樣東西刻意歪著：狀態標籤轉 3°、大廳紙條轉 −2°，它們是貼上去的。

## Components

每個元件都是貼在大樓上的厚實貼紙或硬卡：墨線框、白外圈、硬投影，按下去的東西看起來真的有厚度。

### Buttons

- **Shape:** 微圓的硬卡（9px）。
- **請他下班：** 1.7px 墨線框，貼紙白到磨舊按鈕的上下兩段硬色（55% 處切開），小件投影。
- **Hover / Focus:** Hover 時字和框變警示紅，因為這是唯一的破壞性動作，`:focus-visible` 是 3px 墨線外框。

### Chips

- **狀態標籤：** 膠囊形，轉 3°，騎在資訊卡色帶右上緣。底色是狀態色與貼紙白的上下兩段硬色，左側 8px 小圓點用純狀態色。
- **State:** 工作中、等你處理、輪到你三種，由 `--chip` 切換。

### Cards / Containers

- **Corner Style:** 14px，寬 300px。
- **Background:** 貼紙白；頂端是一整塊專案色帶，下緣一階硬影。
- **Shadow Strategy:** 外層貼紙投影，內層卡片暗面。
- **Border:** 2px 墨線，色帶下緣再一條 2px 墨線。
- **Internal Padding:** 12px 18px 18px 16px，段落間距 12px，分隔用 1.2px 虛線。
- **頭像：** 72px 正圓，突出色帶上緣 26px，外面一圈專案色，底色是淺專案色加右側硬影，標題寫在頭像右邊。
- **目前動作框：** 9px 圓角，畫成映像管螢幕：深藍底、亮色等寬字；等你處理時是權限對話框（淡紅標題列、白底、紅框）。
- **資料夾：** 和樓層招牌同款的專案色小牌。段落小標字距 .14em，後面接一條虛線。

名牌太小太細，加明暗會變花，所以只有資訊卡畫內部硬影。

### Navigation

- **電梯面板：** 寬 40px 的不鏽鋼長膠囊，頂端一塊深藍箭頭顯示窗、上下各兩顆螺絲，固定在視窗左側垂直置中，樓層多時自己上下捲。
- **按鈕：** 直徑 28px 正圓，1.6px 墨線，間距 6px。預設磨舊按鈕色；該層有人等時換紅或琥珀，號碼後面加「!」或「✓」，這就是畫面外的提示。Hover 時框加粗到 2.4px，`:focus-visible` 是 3px 墨線外框。
- **目前視野：** 一條凹下去的軌道（淡墨色底、內側硬影、細框），框住目前看得到的樓層。

### 名牌（Signature）

坐在桌子正面，最寬 112px，最多兩行，是從遠處讀狀態的主要依據。工作中米白、等你處理紅底白字、輪到你琥珀底，「!」「✓」做成 12px 圓章放在文字前面，助理則是「↳ 類型 · 描述」。下緣一階硬影。

### 招牌（Signature）

高 26px，底色是專案色，白色粗體，貼在每層左上角的後牆上。樓號放在白色小牌上（數字 16px、F 10.5px），兩端各一顆鉚釘，下緣一階硬影。

### 斷線說明（Signature）

只在連不上時出現，固定在視窗上緣中間，最寬 520px。白底、2.6px 墨色虛線框、貼紙投影、15px 粗體置中。用墨色，因為斷線不是 session 的狀態；大家同時停在當下的動作。

### 人物（Signature）

寬 60px、高 84px 的行內 SVG。鍵盤選到時外面多一個和名牌同款的圓角框，疊在夜晚遮罩之上。大頭寬橢圓臉，瀏海壓到眉毛，外輪廓線 1.9、比內線粗，額頭有瀏海的硬影，頭髮左上一塊硬邊亮面（毛帽不加），一階硬影，只露前臂。姿勢、表情、氣場都由 CSS 依 `data-act`（work／up／idle）與 `data-fx`（in／out）切換。

- **工作中：** 殘像打字，雙手 0.24 秒循環，兩層半透明殘影往左錯開；螢幕程式碼一行行上捲。
- **等你處理：** 站起來握拳，只有角色自己抖動（0.09 秒），半透明白氣場三層跳動。氣場不用紅，紅色留在名牌。
- **輪到你：** 抱胸閉眼，人物完全靜止。
- **登場與退場：** 在座位上瞬移（0.35 秒）；退場雙指點額再壓成一條線（0.8 秒）。

### 環境動態

比爆氣安靜得多：盆栽葉子 5 秒輕晃 ±2°、咖啡煙 2.8 秒飄散。每個人和每件家具都用 hash 錯開延遲，不會整排同步。系統開減少動態時全部停住，姿勢和名牌照樣表達狀態。

### Named Rules

**The Acting Not Symbols Rule.** 狀態只靠名牌顏色和角色演出，不畫漫符，也不加桌上警示燈這類道具。

**The Loudest Is Waiting Rule.** 新增任何動畫都要比爆氣安靜。打字連拳、能量球這類會搶過爆氣的動作都否決過。

## Do's and Don'ts

### Do:

- **Do** 把紅和琥珀限制在狀態變數（`--waiting`、`--turn`、`--screen-turn`、`--screen-waiting`）上，新顏色先用「色相差 20° 內、彩度 ≥ 0.55」檢查。
- **Do** 介面元件共用 `--ui-border` 與 `--ui-shadow`，和名牌、招牌同一套外框。
- **Do** 所有 SVG 顏色寫在 `style` 或 class，呈現屬性不接受 `var()`。
- **Do** 投影一律硬邊往右下，暗面畫在物件右側，用同色加深的實色。
- **Do** 名牌和招牌放在夜晚遮罩之上（z-index 3），夜晚和白天一樣清楚。
- **Do** 在瀏覽器裡看過白天和夜晚再算完成，新動作要在減少動態下仍看得出狀態。

### Don't:

- **Don't** 讓環境、招牌、髮色或衣服色落進紅或琥珀，包括暖褐色投影和橘紅色桌椅。
- **Don't** 把氣場畫成紅色；紅色只放名牌，夜晚才在周圍映出紅光。
- **Don't** 畫漫符（「噠噠」、zZ、「！」框、集中線、汗滴、打勾泡泡、「到！」、「辛苦了～」）。
- **Don't** 用模糊陰影、網點或第二套夜晚配色。
- **Don't** 在天空或窗景畫雲、太陽、月亮、星星。
- **Don't** 把桌子做成奶油色或把椅子做成藍綠色，會和牆面、護牆板混在一起。
- **Don't** 在樓層、桌子、人物這幾層祖先上加 `transform`、`filter`、`opacity`、`z-index`。
- **Don't** 放原作的角色、招牌髮型、標誌或名字。
