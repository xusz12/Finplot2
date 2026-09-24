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

启动真实账本（macOS）：双击项目根目录的 `启动Finplot.command`。首次启动如果无法自动定位数据库，会弹出系统文件选择器；选中本机原有账单数据库后，路径会保存在本地，下次双击无需再选择。数据库不会被复制或修改。

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

## 运行真实账本页面

```bash
python3 app/server.py
```

访问 http://127.0.0.1:8765 ，同一 Tailscale 网络可访问 http://100.88.185.111:8765 。当前支持真实总览、收支分析、分类明细、全部交易与投资记录。Mac 需保持开机且服务运行。

## GitHub

```bash
git clone git@github.com:xusz12/Finplot2.git
cd Finplot2
python3 app/server.py
```

数据库工作副本不会随仓库分发。换机器从 GitHub clone 后，直接双击启动文件，在文件选择器中选取该机器上原有的账单 SQLite 文件即可；程序会记住路径，不会复制数据库。没有已保存路径时，仍会自动使用 `data/` 中唯一的 `.sqlite3`、`.sqlite` 或 `.db` 文件。也可以设置 `FINPLOT_DATABASE` 指向任意路径（支持相对项目路径和绝对路径）：

```bash
export FINPLOT_DATABASE="$HOME/Documents/ledger.sqlite3"
python3 app/server.py
```

如果 `data/` 中有多个数据库，程序会停止并列出候选文件，要求通过 `FINPLOT_DATABASE` 明确指定，避免误读账单。`.env.example` 提供了变量示例；项目不会自动读取 `.env`，启动前请在 Finder、终端或自己的启动脚本中设置环境变量。

当前版本：`v0.1.9`。详细变化见 [CHANGELOG.md](CHANGELOG.md)。

## 版本检查与更新

设置页提供“检查更新”，以 GitHub 稳定 tag 为准；确认后只以 fast-forward 更新，完成健康检查再恢复页面。请通过 `启动Finplot.command` 或 `python3 app/supervisor.py` 启动以支持自动重启；直接运行 `app/server.py` 只能检查。首次安装本功能需关闭旧服务，再用启动器启动一次。

本地代码有修改或历史分叉时不会强制覆盖，账单和数据库路径配置保持不变。此功能随 v0.1.8 提供，详见 [版本更新说明](docs/UPDATES.md)。
