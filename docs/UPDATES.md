# 版本检查与安全更新

## 使用

双击根目录的 `启动Finplot.command`，或运行 `python3 app/supervisor.py`。在设置中点击“检查更新”；存在新版本时点击“更新并重启”，确认后开始。

`python3 app/server.py` 仍可直接运行并检查版本，但不能自动重启，会提示改用启动器。安装本次改动后需先关闭旧服务，再用启动器启动一次。更新时网页轮询本地状态；只有健康检查成功才刷新。失败原因保留在本地状态文件中，下次打开仍可查看。

## 发布约定

- 唯一运行版本源为 `app/version.json`；前端通过 `/api/version` 读取。README 和 CHANGELOG 是发布文档，不参与比较。
- 固定从 `https://github.com/xusz12/Finplot2.git` 读取稳定 `v主版本.次版本.修订号` tag，数值比较；忽略预发布 tag。支持轻量及附注 tag。
- 不以 main 最新提交作为稳定版本，不需要 GitHub Release 或 token。不改变开发者现有的 origin SSH 配置。
- 发布时同步版本文件、CHANGELOG、前端更新日志和 README，再提交并创建同版本 tag，推送提交和 tag。已发布 tag 不应移动。
- 本功能首个发布版本为 v0.1.8（2026-09-24），发布 tag 与版本文件保持一致。

## 更新边界

1. 用户明确检查并确认更新，POST 固定 tag 和检查得到的 commit。
2. 必须由 supervisor 启动；拒绝本地跟踪文件修改、detached HEAD、分叉历史及与新版本冲突的未跟踪／忽略文件。
3. 通过 HTTPS fetch 指定 tag 到 FETCH_HEAD，不覆盖本地 tags，不执行普通 pull。提交必须与确认值一致且为当前 HEAD 的后代。
4. 验证 tag 和版本文件一致、关键 Python 文件语法、受保护路径，再执行 `git merge --ff-only`。
5. 独立 updater 通知 supervisor 终止旧服务并启动新服务。验证新进程启动时的 commit、页面资源可读、账本只读查询成功；不把旧进程仍然能响应误当作重启成功。
6. 启动验证失败且工作区仍干净、HEAD 未被其他操作改变时，以 `git reset --keep` 恢复记录的旧提交并重启。不使用 `reset --hard`、`git clean` 或自动 stash。恢复受阻则保留现场并提示人工检查。

只更新应用代码，不迁移、复制或写入数据库，不覆盖 `.finplot-database`、`.env`、`data/`。不冲突的未跟踪文件保留。更新时不要同时编辑代码或执行其他 Git 写操作。

`.finplot-update-status.json` 和两个进程锁均为本地忽略文件，不进入仓库。API 提交锁和 updater 文件锁防止重复更新；中断状态可识别，不能保证断电期间自动恢复，需检查 Git 状态后重新启动。

按当前单人使用约定，暂不增加账户认证；保留 JSON、自定义请求头及同源校验，防止普通第三方网页表单触发更新。**这不等于身份认证**：能直接访问服务的人仍可能调用接口。不要把端口暴露到公网。

## 测试

- `python3 -m unittest discover -s tests -p 'test_*.py' -v`：临时 Git 仓库与合成账本，含真实 supervisor 重启及关闭；不更新工作仓库。
- `tests/updates.cjs`：Playwright 合成网络响应，覆盖检查、确认／取消、更新失败、超时、键盘及 1440／390／320px。
- 原有 settings、category-details、chart-selection、scope 回归继续运行。
