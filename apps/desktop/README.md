# Desktop

Electron 宿主，负责窗口、目录授权、safeStorage 凭据和后端进程生命周期。项目业务经 Server HTTP 执行；Desktop 不拥有项目数据库或 Schema 写入管线。

## 接口与组装

- [src/main/index.ts](src/main/index.ts)：应用启动、设置、命名 IPC 和后端恢复。
- [src/preload/index.ts](src/preload/index.ts)：工作台桥。
- 页面预览由 App Renderer 在各 Tab 内通过沙箱 iframe 承载；Desktop 不创建独立预览视图，也不向 iframe 暴露桥接能力。
- [scripts](scripts)：编译、开发监听、资源组装与 Electron 集成测试。

Main/Preload/Server 的自包含 bundle 进入 `app.asar`，打包排除重复的 `node_modules`；Renderer 和干净模板是外部资源。Server 自己编译，Desktop 只复制产物；模板打包使用 Server 的 `template-artifact` 方法，不维护另一份复制规则。图标源位于仓库 `build/`。

## 命令

以下从仓库根目录执行：

```sh
pnpm dev
pnpm --filter @origamix/desktop lint
pnpm --filter @origamix/desktop typecheck
pnpm --filter @origamix/desktop test
pnpm build
pnpm --filter @origamix/desktop test:main
pnpm package:dir
```

开发脚本启动 Server 编译器、Vite 和 Electron，前端 HMR、宿主重编译后重启。`test:main` 使用真实 Main/IPC/SQLite、临时项目及替代目录选择器，需要图形会话和已构建产物。

macOS 打包后资源检查：

```sh
pnpm --filter @origamix/desktop test:resources /absolute/path/to/Origamix.app/Contents/Resources
```

资源检查不等同于签名安装器启动。安装包与签名范围见下文；`package:dir` 禁用自动 macOS 证书发现。维护约束见 [AGENTS.md](AGENTS.md)。

## 模型与本地数据

设置支持 DeepSeek 的 `deepseek-flash`（默认）与 `deepseek-v4-pro`。保存模型设置后，下一次 Agent Run 使用新选择，正在执行的 Run 保留启动时模型。Key 由 Main 使用 Electron `safeStorage` 加密；系统加密不可用时，保存新 Key 会报错。

应用数据位于 Electron 的 `app.getPath('userData')`，实际位置取决于操作系统与应用名称：

| 文件/目录                 | 内容                                               |
| ------------------------- | -------------------------------------------------- |
| `origamix.db`             | 项目和页面索引、会话、消息、Agent Run 与工具审计   |
| `model-settings.json`     | 模型选择与加密后的 API Key                         |
| `user-profile.json`       | 用户资料                                           |
| 项目目录中的 `.origamix/` | Working、Revision 和恢复回执；不在桌面数据库目录内 |

实现见 [Main](src/main/index.ts)。备份编辑状态需要同时考虑桌面记录和项目 `.origamix/`；停用应用后再复制，避免捕获写入中的状态。不要通过删除数据库处理版本不兼容；当前没有自动数据库迁移。

后端意外退出时 Main 会重新启动它，并生成新的认证信息。Renderer 刷新连接后恢复持久化状态；无法确定结果的写请求不会自动重放。Key 无效时在设置中重新配置；加密不可用时检查系统凭据存储，而不是手工写明文 Key。

## 真实 Agent 页面质量验收

先运行 `pnpm build`，并通过正常桌面启动在设置里配置有效模型凭据。在可用图形会话中执行：

```sh
pnpm --filter @origamix/desktop evaluate:agent
# 可选：仅运行一个样本，或指定这轮模型（不修改原设置）
pnpm --filter @origamix/desktop evaluate:agent --case customer-form --model deepseek-flash
```

此命令会调用真实 DeepSeek 并产生供应商费用，不属于默认 `pnpm test`。它通过真实 Main 注入凭据；只把现有加密设置复制到临时应用目录，明文 Key 不离开既有 Main → Utility Process 通道。默认按当前包名查找系统应用数据目录的 `model-settings.json`；不同应用名称可通过 `--settings /absolute/path/to/model-settings.json` 指定加密设置文件。模型选择和真实用户数据库不会被修改。

样本定义在 [agent-quality-cases.cjs](test/agent-quality-cases.cjs)，覆盖客户表单、表格和详情三个公开合成任务。验收在仓库外临时项目中执行，检查 Agent 修改、通过同一 Operation 管线进行的非 Agent 修改及后续局部修改、后端重启恢复、明暗主题预览中的实际按钮交互、显式保存／历史恢复／幂等 Apply，以及独立安装、类型检查、构建和产物页面实际点击。非 Agent 修改通过 HTTP 管线模拟，不能当作可视化拖拽和属性面板的人工验收。内容检查以实际可见字段与交互结果为准，不强制某种文本组件拆分数量。

预览检查只操作当前可见、非 inert 的页面；点击前先在合法滚动容器中显示按钮，再核对点击命中，报告记录是否需要滚动。样本交互聚焦声明式属性更新，不代表真实业务接口、条件分支或全部流程节点已经通过模型验收。

默认在本地忽略目录 `_doc/verification/reports/agent-quality-<timestamp>/` 写入 `report.json`、合成页面 Working 快照、生成项目源文件和截图；`--output /absolute/path` 可指定其他证据目录。临时数据库、加密凭据副本和依赖目录在退出时清理。报告保留应用提交、未提交变更标记、实际 Main／Server 产物哈希、模型和协议版本、Run／页面／Revision 标识、耗时、持久化用量、工具活动和失败阶段；不保存推理内容或完整工具参数。首次模型事件时间未采集时为 `null`，不填入模拟值；现有持久化 Token 统计不含完整计费信息，失败调用可能缺少用量，`executorCalls` 也不等于每次供应商请求数，不能据此计算真实费用。

缺少凭据、执行失败或样本未完成均不会报告通过，并返回非零退出码。全部自动检查通过后，报告状态仍为 `awaiting-visual-review`，`modelQualityAccepted` 保持 `false`：需要另行检查截图布局、真实需求准确性与人工编辑体验。局部样本通过也不代表三项完整套件或模型普遍质量通过。报告保留每轮失败，修复后应产生新的一轮证据，不覆盖旧结果。

## 打包与签名范围

资源和平台选项由 [electron-builder.yml](electron-builder.yml) 管理，图标和 macOS 权限文件位于根目录 [build](../../build)。`pnpm package:dir` 显式禁用 macOS 签名身份，适合本地资源检查；`pnpm package` 不代表已有发行证书或公证配置。

当前 macOS 配置为 `notarize: false`，仓库没有完成证书分发、公证或发布流水线。准备正式发行时需配置相应平台的签名与发布流程，并验证安装器实际启动；`test:resources` 只验证资源结构。签名配置属于发行工作，不能从开发构建成功推断已完成。
