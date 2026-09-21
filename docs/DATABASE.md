# 数据库结构基线

文件：`data/ledger_2026-09-22.sqlite3`

## 核心表

- `transactions`：交易事实；`occurred_at`、`direction`、`amount_cents`、`category_id`、备注和来源字段。
- `categories`：分类；关联 `category_groups`，包含 `direction`、`nature`、启用状态和排序。
- `category_groups`：分类组，方向为收入或支出。
- `category_aliases`：导入来源分类到内部分类的映射。
- `import_batches`：导入批次及 SHA-256 去重信息。
- `tags` / `transaction_tags`：交易标签及标签来源。
- `metadata`：数据集元信息。

## 查询视图

`v_transactions` 已将金额转为 `amount_yuan` 并连接分类组、分类性质、标签和来源字段；`v_monthly_summary` 已按月份、方向、性质、分类组和分类汇总笔数与金额。

## 不应改变的约束

金额以整数分保存且必须为正；方向只能是 `收入` / `支出`；交易方向必须与分类方向一致；分类方向必须与分类组一致。导入与编辑逻辑应尊重这些数据库触发器。

## 原始来源和访问约定

原始备份：`/Users/x/Library/Mobile Documents/com~apple~CloudDocs/备份/StaffX_DataBackup/snapshots/ledger_2026-09-22.sqlite3`。
本次复制到工作区，未修改源文件。访问使用 SQLite URI `mode=ro`；完整建表、视图、触发器和索引见 `schema.sql`。数据目录已加入 .gitignore。

业务汇总应使用 `transactions.amount_cents` 整数计算，视图便于浏览结构和核对，但不要累计浮点元值。数据库没有账户、持仓、行情和资产负债表，无法直接支持净资产、持仓市值或浮动收益。`source_record_id` 与 `import_batches` 表达来源追踪，不代表支付账户。时间字段没有显式时区，需确认原始时间约定。
