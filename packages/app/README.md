# App

React 工作台，负责项目导航、页面编辑、Agent 会话、Apply 状态与预览展示。外部消费的是 Vite 生成的 `dist/`，不导出内部组件或 Store 给其他包。

## 代码入口

- [src/app.tsx](src/app.tsx)：工作台装配。
- [src/services](src/services)：通过 Shared 契约调用 HTTP，统一认证刷新和错误处理。
- [src/store](src/store)：窗口级导航和偏好投影；导航、页签和未发送草稿使用 `sessionStorage`。
- [src/components/editor](src/components/editor)：PageEditor 宿主装配、Working 会话、保存队列；编辑实现见 [Editor](../editor/README.md)。
- [src/components/agent-chat](src/components/agent-chat)：Agent 会话及事件恢复。
- [src/preview](src/preview)：给 Runtime 渲染结果添加工作台反馈；引擎创建归 Runtime。
- [src/materials](src/materials)：读取 Server 解析的项目技术栈，通过固定导入表按需加载编辑/运行物料；加载失败可重试，旧页面响应不会覆盖当前注册。
- [dev-server.ts](dev-server.ts)：Node 开发宿主，允许使用 Server 的公开启动入口。

`src/` 依赖 Shared、UI、Editor、Materials、Runtime 及声明的前端依赖，不读取文件系统或导入 Server。编辑会话维护 Server Working Schema 的内存投影，窗口导航只保存导航与未发送消息草稿，不能为方便同步而合并成第二个数据库。HTTP 不确定失败不能自动重放写请求。

基础控件通过 `@origamix/ui` 引用，`main.css` 显式引入公共样式；`index.html` 的 `origamix-ui` 类启用主题。App 保留主题偏好、状态色和布局，组件生成规则见 [UI README](../ui/README.md)。

## 开发与验证

在仓库根目录：

```sh
pnpm dev:web
pnpm --filter @origamix/app lint
pnpm --filter @origamix/app typecheck
pnpm --filter @origamix/app test
pnpm build:web
pnpm --filter @origamix/app test:web
```

`dev:web` 先编译并启动本地 Server，通过同源 `/api/v1` 代理认证；Server/Shared 改动重启宿主，前端改动使用 HMR。`ORIGAMIX_WEB_STATE_DIR` 可覆盖默认 `.origamix-web/` 数据位置。认证信息不注入浏览器配置。

浏览器开发模式没有原生目录选择器和凭据存储。Desktop 通过 Shared 中的命名桥提供这些能力。修改可见界面需实际验证亮暗主题；修改开发进程管理还需 Server `test:dev`。

维护约束见 [AGENTS.md](AGENTS.md)。

## 浏览器开发配置

启动前，在宿主环境中设置下列变量；前端不读取或保存 API Key。

| 变量                       | 用途                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `ORIGAMIX_WEB_PROJECT_DIR` | 授权一个已有项目的绝对路径；浏览器没有原生目录选择器                   |
| `ORIGAMIX_WEB_STATE_DIR`   | Web 宿主数据目录，默认仓库根目录 `.origamix-web/`                      |
| `DEEPSEEK_API_KEY`         | Web 宿主执行 Agent 时使用的凭据；未配置时 Agent 报错，普通编辑仍可使用 |

```sh
# 在当前 shell 中先配置 DEEPSEEK_API_KEY，再启动；不要把 Key 放入 VITE_*。
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/project pnpm dev:web
```

Web 使用 Server 默认模型 `deepseek-flash`；桌面设置可选择 `deepseek-flash` 或 `deepseek-v4-pro`。环境变量配置见 [dev-server.ts](dev-server.ts)，桌面模型配置见 [Desktop README](../../apps/desktop/README.md)。生产浏览器接入和模板下载/导入尚未实现，`build:web` 的静态产物不自带本地后端。

## 页面操作与状态

| 操作                     | 结果                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| 编辑器或 Agent 修改      | 更新并保留 Working 草稿，不创建 Revision，也不写目标项目         |
| 预览                     | 在沙箱 iframe 内渲染当前页面；不会应用到项目                     |
| 保存版本（Ctrl/Cmd + S） | 为当前 Working 创建不可变 Revision；保存相同状态不会重复创建版本 |
| 查看历史                 | 读取页面自己的版本列表和快照                                     |
| 恢复历史                 | 确认后用历史快照替换 Working，作为未保存草稿；需要再次保存、应用 |
| 应用到项目               | 仅接受当前已保存且无新草稿修改的版本，更新目标 `schema.json`     |
| 重新读取项目内容         | 确认后放弃当前未应用修改，以目标项目内容更新 Working             |

“版本已保存 · 待应用”表示生成项目仍使用旧内容。“项目文件已变化”表示目标文件被外部修改，需要先处理冲突。“应用结果待确认”表示请求结果尚不明确，不能据此判定写入失败。

## 事件节点配置

编辑模式的“逻辑”视图从页面事件树选择事件，再将节点拖入画布。[节点定义适配](../editor/src/mods/flow-editor/nodes/definitions.ts) 直接读取 [Shared 的 flowNodeManifests](../shared/src/flow/flow-node-manifest.ts)，复用节点名称、类型、默认配置、执行状态及连线信息。请求方法、条件运算符和超时范围同样读取清单；Editor 拥有各节点的配置表单，支持请求参数、多条属性/方法/变量设置、组件多选显隐、真/假条件及弹窗/抽屉操作。属性选项包含物料声明的属性与上下文变量，方法选项只显示公开的上下文方法。条件的右上、右下锚点分别连接真、假分支；开始节点由事件入口创建。

流程取值使用 Shared 的 HyperValue。表达式、函数和自定义 JS 通过 Runtime 在 sandbox 预览或生成页面中执行，工作台只编辑配置。逻辑修改继续沿用 Working 草稿、保存版本和应用到项目的流程。

## 失败与恢复

- 草稿保存失败：保留当前编辑内容，查看错误并重试；页面切换或预览可能被阻止，避免丢失未提交编辑。
- Working 版本冲突：重新读取权威状态并检查最新内容，再决定如何修改；不要直接用旧快照覆盖。
- 应用结果不明确：通过页面状态确认结果，使用原请求身份重试；不要自动生成新请求或重复提交。
- 目标项目发生外部修改：先比较目标文件和当前草稿；“重新读取项目内容”会放弃未应用修改，操作前确认要保留哪份内容。
- Agent 断线或后端重启：界面从持久化 Run、消息和 Working 恢复；恢复状态未加载时编辑与提交可能暂时禁用，失败时使用界面重试入口。不会自动恢复模型请求。
- 预览报未知物料或渲染失败：检查 Schema 类型、物料注册和属性；渲染错误不会证明草稿已损坏，也不会写入目标项目。

这些流程的实现入口见 [编辑会话](src/components/editor)、[版本操作](src/components/workspace/toolbar/revision-actions.tsx) 和 [历史管理](src/components/workspace/history/revision-history-dialog.tsx)。

## 画布隔离原型

启动后访问 `/canvas-prototype`（Desktop 文件模式为 `#/canvas-prototype`）。这是使用示例数据的独立试验页，不连接 Working、Revision、Apply 或用户项目。正式编辑器保持原有路径。

原型验证独立 React 入口、opaque-origin sandbox、MessageChannel 身份与版本校验、选中、按钮/输入提示属性、history、跨 document 拖入及快照恢复。`canvas-prototype-plugin.ts` 将画布脚本和样式编成单个离线 srcdoc；不增加 same-origin、网络、弹窗或宿主桥权限。开发时修改画布源码会整页重载并清空原型会话。

目前不是完整隔离编辑器：画布内移动、复杂弹层/IME、失联检测、flush/Working 队列与完整保存交付仍需验证/接入。不能据此宣称已支持第三方物料或安全执行任意代码。协议暂为 App 内部原型，不是 Shared 的稳定公开协议。

开发宿主会通过 Server 的模板准备工具，在本地状态目录生成带 Runtime/Materials 归档的模板，供新建项目与显式项目升级共用。运行开发宿主前需已有当前工作区包的构建产物；缺失时先运行根 `pnpm build:libs`。
