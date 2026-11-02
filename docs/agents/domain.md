# 網域文件

engineering skill 探索程式碼時，怎麼使用這個 repo 的網域文件。

## 探索前先讀

- 根目錄的 **`GLOSSARY.md`**，或
- 根目錄的 **`GLOSSARY-MAP.md`**（如果存在）：它指向每個 context 各自的 `GLOSSARY.md`，讀和主題相關的那幾份。
- **`docs/adr/`**：讀和這次要動的範圍有關的 ADR。多 context 的 repo 還要看 `src/<context>/docs/adr/`。

這些檔案不存在就**直接略過**，不要提它們不存在，也不要建議先建立。`/domain-modeling`（經由 `/grill-with-docs` 和 `/improve-codebase-architecture` 使用）會在名詞或決定真的確定時才建立它們。

這個 repo 是 single-context。設計理由和不能破壞的規則另外寫在 `docs/design.md`，動手前也要讀。

## 檔案結構

單一 context 的 repo（大多數 repo）：

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多 context 的 repo（根目錄有 `GLOSSARY-MAP.md`）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 整個系統的決定
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 這個 context 的決定
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## 用 glossary 的詞

產出裡提到網域概念時（issue 標題、重構提案、假設、測試名稱），用 `GLOSSARY.md` 定義的詞，不要換成 glossary 明確避免的同義詞。

需要的概念不在 glossary 裡，代表兩種可能：你在發明專案不用的說法（要重新考慮），或真的有缺口（記下來交給 `/domain-modeling`）。

## 和 ADR 衝突要明講

產出和既有 ADR 矛盾時，要明確指出，不能默默推翻：

> _和 ADR-0007（event-sourced orders）衝突，但值得重新討論，因為……_
