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
pnpm package:mac
```

开发脚本按依赖顺序构建库、Server、Main/Preload 和固定 npm 版本的模板，再启动 Vite 与 Electron。App、Editor、UI 保持前端 HMR。Shared、Runtime、Materials、Server、Main/Preload、模板或 Desktop 环境文件变化时，自动按依赖顺序构建，准备好新后端和模板后，正常退出并重启 Vite 与 Electron。Materials／Shared／Runtime 在 Desktop 模式下不提前 HMR，以免页面与运行中的后端采用不同契约。修改开发启动脚本或安装新依赖后，也需重启。

多次保存会合并处理，构建期间的新变化进入下一轮；构建或资源准备失败时保留当前实例，修复源码后重试，也可在终端按 Enter 重试。输入 `p` 并回车可暂停／恢复自动重启，适合调试 Agent 或长时间编辑；暂停时可以继续构建，恢复后应用待更新内容。退出超时则暂停更新，不强制杀掉桌面实例。

自动重启会重新创建窗口，可能中断活动 Agent、未提交的编辑和聊天输入；只保证已持久化的 Working 由既有机制恢复，不提供窗口临时状态的无损交接。没有新增 Renderer 重启桥接或业务会话协议。已有用户项目仍需显式升级，不由源码监听自动改写。

重启后的后端继续使用系统分配的动态端口（`port: 0`），旧监听关闭，新窗口获取新的地址、认证信息和服务实例；新端口可能与原端口相同。配置的前端来源会同步到后端校验，支持自定义开发端口。

`pnpm test:dev` 在临时工作区验证依赖自动重启、暂停／恢复、构建失败保留旧实例及连接更换。`test:main` 使用真实 Main/IPC/SQLite、临时项目及替代目录选择器，需要图形会话和已构建产物。

macOS 打包后资源检查：

```sh
pnpm --filter @origamix/desktop test:resources /absolute/path/to/OrigaMix.app/Contents/Resources
```

资源检查不等同于签名安装器启动。安装包与签名范围见下文；本地构建使用显式 ad-hoc 签名，不依赖本机发行证书。维护约束见 [AGENTS.md](AGENTS.md)。

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

样本定义在 [agent-quality-cases.ts](test/agent-quality-cases.ts)，覆盖客户表单、表格和详情三个公开合成任务。验收在仓库外临时项目中执行，检查 Agent 修改、通过同一 Operation 管线进行的非 Agent 修改及后续局部修改、后端重启恢复、明暗主题预览中的实际按钮交互、显式保存／历史恢复／幂等 Apply，以及独立安装、类型检查、构建和产物页面实际点击。非 Agent 修改通过 HTTP 管线模拟，不能当作可视化拖拽和属性面板的人工验收。内容检查以实际可见字段与交互结果为准，不强制某种文本组件拆分数量。

预览检查只操作当前可见、非 inert 的页面；点击前先在合法滚动容器中显示按钮，再核对点击命中，报告记录是否需要滚动。样本交互聚焦声明式属性更新，不代表真实业务接口、条件分支或全部流程节点已经通过模型验收。

通过 `--output /absolute/path/to/reports` 显式指定证据目录，保存 `report.json`、合成页面 Working 快照、生成项目源文件和截图。临时数据库、加密凭据副本和依赖目录在退出时清理。报告保留应用提交、未提交变更标记、实际 Main／Server 产物哈希、模型和协议版本、Run／页面／Revision 标识、耗时、持久化用量、工具活动和失败阶段；不保存推理内容或完整工具参数。首次模型事件时间未采集时为 `null`，不填入模拟值；现有持久化 Token 统计不含完整计费信息，失败调用可能缺少用量，`executorCalls` 也不等于每次供应商请求数，不能据此计算真实费用。

缺少凭据、执行失败或样本未完成均不会报告通过，并返回非零退出码。全部自动检查通过后，报告状态仍为 `awaiting-visual-review`，`modelQualityAccepted` 保持 `false`：需要另行检查截图布局、真实需求准确性与人工编辑体验。局部样本通过也不代表三项完整套件或模型普遍质量通过。报告保留每轮失败，修复后应产生新的一轮证据，不覆盖旧结果。

## macOS 构建包

当前交付仅覆盖 macOS 13+、Apple Silicon（arm64）。资源和平台选项由 [electron-builder.yml](electron-builder.yml) 管理，图标和 macOS 权限文件位于根目录 [build](../../build)。打包命令显式使用 `--mac --arm64 --publish never`，不会选择当前宿主的其他平台或自动发布。请在 macOS 上执行：

```sh
pnpm package:mac
# 等价入口：pnpm package
```

该命令依次运行根 lint、typecheck、test、build，再生成以下产物：

| 产物                                         | 用途                                    |
| -------------------------------------------- | --------------------------------------- |
| `release/OrigaMix-<version>-macOS-arm64.dmg` | 打开后将 OrigaMix.app 拖入 Applications |
| `release/OrigaMix-<version>-macOS-arm64.zip` | 同一应用的 ZIP 归档                     |
| `release/mac-arm64/OrigaMix.app`             | 解包的应用目录，供本地资源验证          |

`pnpm package:dir` 构建同一 macOS arm64 应用目录，不制作 DMG／ZIP。包内 `package:dir`、`package:mac` 只消费已构建资源，完整构建使用根命令。暂不交付 Intel、Windows 或 Linux 安装包。

本轮采用 `identity: '-'` 的本地 ad-hoc 签名、`hardenedRuntime: false` 和 `notarize: false`。该配置确保 Apple Silicon 本地试用包具有完整代码签名，但不证明开发者身份，也不是经过 Gatekeeper 公证的公开发行包；从浏览器下载或跨机器传递后，系统可能阻止打开。正式发行需要单独配置 Developer ID、启用并复核 hardened runtime／entitlements、完成公证，再验证下载、安装与首次启动；不要通过全局关闭 Gatekeeper 处理问题。

打包后核对代码签名、资源和磁盘映像：

```sh
codesign --verify --deep --strict release/mac-arm64/OrigaMix.app
pnpm --filter @origamix/desktop test:resources "$PWD/release/mac-arm64/OrigaMix.app/Contents/Resources"
hdiutil verify release/OrigaMix-1.0.0-macOS-arm64.dmg
```

版本号来自 Desktop `package.json`，命令中的 `1.0.0` 应与实际产物一致。资源检查不等同于真实安装包的 Main 启动，更不等同于 Developer ID／公证验收。SHA-256 和本轮验证范围应随构建交付记录一起保留。

## 启动环境配置

包内 `.env` 保存非敏感默认值，个人覆盖放同目录 `.env.local`（Git 忽略）。`pnpm dev` 在启动时按 `.env` → `.env.local` → 进程环境变量读取；修改后重启。相对路径以 Desktop 包目录为基准，与命令执行目录无关。

```dotenv
# apps/desktop/.env.local 示例
ORIGAMIX_RENDERER_PORT=5174
ORIGAMIX_DEBUG=1
```

开发启动器将页面 host/port 传给 App，无须在两个包重复修改；调试端口由 ORIGAMIX_INSPECT_PORT / ORIGAMIX_DEBUG_PORT 配置。ELECTRON_RENDERER_URL 由启动器生成并与本机配置地址核对。`0` 表示关闭、`1` 表示开启。

构建只将受版本管理的 `.env` 复制到 `dist/.env`，不复制 `.env.local`。正式安装包忽略开发进程环境覆盖，按自身 resourcesPath 解析 ORIGAMIX_PACKAGED_RENDERER_FILE 和 ORIGAMIX_PACKAGED_TEMPLATE_DIR；preload 与 Server 程序位置固定在构建布局中。用户数据库仍使用 Electron userData。

配置不保存 API Key、后端令牌或服务实例 ID；桌面凭据仍由 safeStorage 管理。测试启动器用 ORIGAMIX_ENV_LOCAL=0 隔离个人文件。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。源码更新不自动更新已有用户项目；升级完成后由用户重新安装依赖。发布前本地归档验证不等同于 npm registry 已可安装。

开发依赖更新由 Server 的 `development-libraries.ts` 统一声明：Shared → Runtime → Materials，随后构建 Server；Desktop 与 Web 共用该规则。Web 启动自动准备库，库源码变化在整批构建成功后重启宿主，失败保留原运行实例，保存监听源码可重试。启动工具脚本变化会提示重新运行开发命令。不要同时启动多个会写同一 dist 的开发/构建进程。
公开包的名单、版本和归档路径由根 `scripts/public-packages.ts` 维护；`ORIGAMIX_PACK_DIR` 对 pack、check 和 publish 一致生效，相对目录以仓库根为基准。归档检查验证包名及版本与当前源码清单一致。
