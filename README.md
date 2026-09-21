# Finplot

Finplot 是一个个人财务分析 Web 应用。当前工作区以「澄明 Folio」视觉原型为地基，下一步将把真实账单数据库接入同一套信息架构，再逐步扩展到完整模块。

## 当前状态

- `design/index.html`：可直接打开的交互设计预览。
- `design/folio-finance.fragment.html`：可编辑的原始 HTML/CSS/JavaScript 设计原型。
- `design/DESIGN-NOTES.md`：视觉变量、响应式规则和交互边界。
- `data/ledger_2026-09-22.sqlite3`：工作区内的数据备份副本。
- `data/*.json`：从备份导出的初始元数据、分类和月度汇总，便于原型读取。
- `docs/`：项目记忆、数据库结构与实施路线。

打开预览：

```bash
open design/index.html
```

## 数据基线

备份包含 1,667 笔交易，时间范围为 2024-07-18 至 2026-09-21；57 个分类和 19 个分类组。金额以 `amount_cents` 整数分保存，展示时换算为人民币元。收支方向为 `收入` / `支出`，分类性质为 `日常` / `投资` / `往来` / `调整`。

下一步建立只读数据访问层，以整数分聚合金额；使用 `v_transactions` 和 `v_monthly_summary` 理解与核对分类关系，前端只接收已定义口径的数据。

## 只读数据访问层

首轮访问层位于 `app/ledger.py`，不会写入数据库，示例：

```bash
python3 - <<'PY'
import sys
sys.path.insert(0, "app")
from ledger import monthly_totals, category_totals, recent_transactions

print(monthly_totals("2026-09", natures=("日常",)))
print(category_totals("2026-09", "支出", natures=("日常",))[:5])
print(recent_transactions("2026-09", limit=10))
PY
```

金额字段以 `*_cents` 返回；只有展示边界才换算为元。总览口径暂不默认排除任何 `nature`，待确认后再接入页面。

## 原则

页面先回答财务状态，再解释变化，最后进入交易明细。功能完整不意味着所有模块同等突出；每页应围绕一个明确问题组织指标、图表和钻取路径。设计稿中的数据目前仅用于演示，不能直接作为业务口径。
