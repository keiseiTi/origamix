# App

React 工作台，负责项目导航、页面编辑、Agent 会话、Apply 状态与预览展示。外部消费的是 Vite 生成的 `dist/`，不导出内部组件或 Store 给其他包。

每个保留的页面 Tab 持有一个 Agent Hook。页面级活动 Run 决定编辑、保存、Apply 与发送是否可用，选中会话决定消息、进度与澄清。首发创建会话后，按会话归档输入草稿。消息先读最近一页，终态或重连按序号对账，旧消息由用户继续加载。

## 代码入口

- [src/app.tsx](src/app.tsx)：工作台装配。
- [src/services](src/services)：通过 Shared 契约调用 HTTP，统一认证刷新和错误处理。
- [src/store](src/store)：窗口级导航和偏好投影；导航、页签和未发送草稿使用 `sessionStorage`。
- [页面会话](src/components/workspace/hooks/use-page-session.ts)：按项目和页面管理 Working 草稿提交、版本操作与预览刷新。
- [src/components/editor](src/components/editor)：PageEditor 装配与 Working 草稿队列；编辑实现见 [Editor](../editor/README.md)。
- [src/components/agent-chat](src/components/agent-chat)：选中会话、历史分页、发送、SSE 恢复与页面级 Run 状态读取。
- [src/preview](src/preview)：给 Runtime 渲染结果添加工作台反馈；引擎创建归 Runtime。
- [src/materials](src/materials)：读取 Server 解析的项目技术栈，通过固定导入表按需加载编辑/运行物料；加载失败可重试，旧页面响应不会覆盖当前注册。
- [dev-server.ts](dev-server.ts)：Vite 开发代理，通过 HTTP 连接独立 Server。

`src/` 依赖 Shared、UI、Editor、Materials、Runtime 及声明的前端依赖，不读取文件系统或导入 Server。页面会话维护 Server Working Schema 的内存投影，窗口导航只保存导航与未发送消息草稿，不能为方便同步而合并成第二个数据库。HTTP 不确定失败不能自动重放写请求。

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

根 `pnpm dev:web` 先启动独立 Web Server，检查 API 就绪后启动 Vite。Vite 通过同源 `/api/v1` 转发请求，前端源码改动走 HMR。单独调试后端时可运行 `pnpm dev:server:web`。代理只为同源浏览器请求注入认证信息，并要求 `Sec-Fetch-Site: same-origin`。`test:web` 使用 Electron 提供 Chromium 图形会话，运行临时项目验证预览隔离。

浏览器开发模式没有原生目录选择器和凭据存储。Desktop 通过 Shared 中的命名桥提供这些能力。修改可见界面需实际验证亮暗主题；修改开发进程管理还需 Server `test:dev`。

维护约束见 [AGENTS.md](AGENTS.md)。

## 浏览器开发配置

在 App 进程环境或 `packages/app/.env.local` 设置代理配置，与 [Web Server](../server/README.md#web-server-配置) 对应。

| 变量                    | 用途                                    |
| ----------------------- | --------------------------------------- |
| `ORIGAMIX_SERVER_TOKEN` | 必填。代理发给 Server 的 Bearer token。 |
| `ORIGAMIX_SERVER_PORT`  | Server 回环端口，默认 `1029`。          |
| `ORIGAMIX_SERVICE_ID`   | API 服务标识，默认 `origamix-web`。     |

在根目录执行 `pnpm dev:web`，根启动器使用 Server 的端口、服务 token 和服务标识配置 App 代理。分开调试时执行 `pnpm dev:server:web` 和 `pnpm --filter @origamix/app dev`，并为代理配置同一套连接参数。工作台默认访问 `http://127.0.0.1:9685`。

Web 使用 Server 默认模型 `deepseek-flash`；桌面设置可选择 `deepseek-flash` 或 `deepseek-v4-pro`。环境变量配置见 [dev-server.ts](dev-server.ts)，桌面模型配置见 [Desktop README](../../apps/desktop/README.md)。

## Web 模板交付

`pnpm dev:server:web` 使用当前仓库的 Template 源码准备独立项目 ZIP。工作台同源请求 `GET /api/v1/templates/<version>/download` 可下载当前模板，响应包含 `Content-Disposition` 和 `X-Template-SHA256`。其中 `<version>` 为 Template 的 package.json 版本，其他版本返回 404。下载请求沿用开发代理的来源校验。

`pnpm build:web` 构建 Web 工作台到 `packages/app/dist/web/`，另在仓库根目录的 `dist/web-template/` 输出版本化 ZIP 和 `manifest.json`。正式 Web Server 启动时校验 ZIP，并通过同一个下载接口提供给已登录用户。解压后的模板从 npm 安装固定版本的 Origamix 依赖。对外交付前运行 `pnpm release:registry` 确认这些版本可安装。

## 部署正式 Web 宿主

从仓库根目录构建并运行。构建后由根启动器依次启动 Server 和 App，两者各自运行在独立进程。MySQL 连接地址由 Server 配置，访问密码由 App 配置。

```sh
pnpm build:web
pnpm start:web
```

| 变量                    | 用途                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `ORIGAMIX_WEB_PASSWORD` | 必填。单用户实例的访问密码，有效长度至少 16 字符，上限 512 字符。                                         |
| `ORIGAMIX_WEB_PORT`     | Web 宿主在 `127.0.0.1` 上的端口，默认 `9685`。                                                            |
| `ORIGAMIX_WEB_ORIGIN`   | 浏览器实际访问的源地址，例如 `https://origamix.example.com`。默认 `http://127.0.0.1:<端口>`，供本机使用。 |

远程部署时，让 HTTPS 反向代理把站点根路径全部转发到 Web 宿主，保留公网 `Host` 和浏览器 `Origin`，关闭 SSE 响应缓冲，并把读取超时设置为高于 15 秒的事件心跳间隔。浏览器通过 Web 宿主访问业务接口。App 从进程环境读取访问配置，从 `packages/app/.env` 或进程环境读取上游代理配置。项目备份以 MySQL 数据库为准。

独立部署时可分别运行 `pnpm start:server:web` 和 `pnpm --filter @origamix/app start:web`。打开站点后使用访问密码登录。会话使用 HttpOnly Cookie，有效期 12 小时，重启宿主后需要重新登录。授权过期时，工作台提示在新标签页重新登录，当前页面继续保留内存中的草稿。主动退出前会保存待写入的编辑，保存失败时可以留在页面处理。

正式 Web 宿主支持单用户自托管。网页登录后可创建项目、编辑页面、预览和保存版本。Web 项目存放在 MySQL。导出 ZIP 可以独立部署或解压后在桌面继续编辑。

### 使用本机 MySQL

先在 MySQL 创建专用库（例如 `CREATE DATABASE origamix_web CHARACTER SET utf8mb4`），为 Web 服务配置有该库建表及读写权限的账号。把连接地址作为环境变量注入，地址格式为 `mysql://用户名:密码@127.0.0.1:3306/origamix_web`，特殊字符需 URL 编码。通过 Homebrew 的本机 socket 连接时，可在地址后加 `?socketPath=%2Ftmp%2Fmysql.sock`，并按实际 socket 路径调整。在 Server 环境设置连接地址后执行 `pnpm start:server:web`。

首次启动在空的 Origamix 表集中初始化首版结构。MySQL 保存项目、页面、Working、Revision，以及页面 Agent 的会话、消息、Run 和工具审计。设置 `DEEPSEEK_API_KEY` 后可使用页面 Agent。每个数据库运行一个 Web Server。重启时，Server根据提交回执恢复 Run 结果。

ZIP 导出会校验模板及快照文件的路径和内容。 [文件校验](src/services/project-export-files.ts)

用独立测试库设置 `ORIGAMIX_TEST_MYSQL_URL`，从仓库根运行 `pnpm test:web:mysql` 验证正式宿主下的项目创建、版本冲突、保存、重启恢复、Chromium 预览、实际 ZIP 导出、桌面 Apply 和解压后的独立构建。运行 `pnpm test:agent:mysql` 使用确定性模型验证过期写入冲突与中断恢复。

根目录使用独立测试库设置 `ORIGAMIX_TEST_MYSQL_URL` 后运行 `pnpm test:web` 验证开发和正式宿主，覆盖登录、会话撤销、模板下载、Agent 事件流、直接打开工作台路径及亮暗主题下的预览隔离。

## Web 项目 ZIP 导出

为修改过的页面保存版本后，从左侧项目菜单选择「导出项目 ZIP」，再点击「下载 ZIP」。快照包含模板源码、项目清单及全部页面的已保存 Schema。存在未保存的修改时，先按提示保存相关页面。

解压后可在独立目录安装依赖和构建，也可用桌面工作台打开。桌面首次打开某个页面时，从交付的 `schema.json` 初始化本地 Working 和 Revision。此后桌面的保存和 Apply 只影响本地项目。

## 页面操作与状态

| 操作                     | 结果                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| 编辑器或 Agent 修改      | 更新并保留 Working 草稿，不创建 Revision，也不写目标项目         |
| 预览                     | 在沙箱 iframe 内渲染当前页面；不会应用到项目                     |
| 保存版本（Ctrl/Cmd + S） | 为当前 Working 创建不可变 Revision；保存相同状态不会重复创建版本 |
| 查看历史                 | 读取页面自己的版本列表和快照                                     |
| 恢复历史                 | 把历史快照读入 Working；与当前已保存版本内容不同时，草稿待保存   |
| 应用到项目               | 仅接受当前已保存且无新草稿修改的版本，更新目标 `schema.json`     |
| 重新读取项目内容         | 文件项目确认后用目标内容替换 Working，并建立检查点               |

“版本已保存 · 待应用”表示生成项目仍使用旧内容。“项目文件已变化”表示目标文件被外部修改，需要先处理冲突。“应用结果待确认”表示请求结果尚不明确，不能据此判定写入失败。

## 事件节点配置

编辑模式的“逻辑”视图从页面事件树选择事件，再将节点拖入画布。[节点定义适配](../editor/src/components/flow-editor/nodes/node-catalog.ts) 直接读取 [Shared 的 flowNodeManifests](../shared/src/flow/flow-node-manifest.ts)，复用节点名称、类型、默认配置、执行状态及连线信息。请求方法、条件运算符和超时范围同样读取清单；Editor 拥有各节点的配置表单，支持请求参数、多条属性/方法/变量设置、组件多选显隐、真/假条件及弹窗/抽屉操作。读取选项只来自 context.variables，写入选项只来自 context.writable，方法选项只显示公开的上下文方法。条件的右上、右下锚点分别连接真、假分支；开始节点由事件入口创建。

流程取值使用 Shared 的 HyperValue。表达式、函数和自定义 JS 通过 Runtime 在 sandbox 预览或生成页面中执行，工作台只编辑配置。逻辑修改继续沿用 Working 草稿、保存版本和应用到项目的流程。

## 失败与恢复

- 页面选择、关闭、模式切换和预览统一通过 `useWorkspacePageController` 调用，调用方不自行拼装 `transition`。新建页面后的选择复用同一入口。操作前保存当前页及目标页（同一页面只保存一次），共用并发限制和错误提示；保存失败时保留页面、模式与草稿，等待用户重试。
- 断线后点击「重试保存草稿」。工作台先读取服务器上的版本与页面内容；若上次写入已完成，会从该版本继续提交后续编辑。遇到其他窗口的修改时会保留本地草稿。选择「重试加载」并确认放弃本地修改后，可载入服务器版本。
- 应用结果不明确：通过页面状态确认结果，使用原请求身份重试；不要自动生成新请求或重复提交。
- 目标项目发生外部修改：先比较目标文件和当前草稿；“重新读取项目内容”会放弃未应用修改，操作前确认要保留哪份内容。
- Agent 断线或后端重启：界面从持久化 Run、消息和 Working 恢复；恢复状态未加载时编辑与提交可能暂时禁用，失败时使用界面重试入口。不会自动恢复模型请求。
- 预览报未知物料或渲染失败：检查 Schema 类型、物料注册和属性；渲染错误不会证明草稿已损坏，也不会写入目标项目。

这些流程的实现入口见 [页面会话](src/components/workspace/hooks/use-page-session.ts)、[版本操作](src/components/workspace/toolbar/revision-actions.tsx) 和 [历史管理](src/components/workspace/history/revision-history-dialog.tsx)。

开发 Server 准备固定 Runtime/Materials npm 版本的模板。单独启动 App 前可先启动开发 Server 或运行根 `pnpm build:libs` 准备工作区依赖。

## 开发环境配置

Web 开发按代码默认值 → 包内 `.env` → 同目录 `.env.local` → 进程环境变量合并。Vite 构建只合并代码默认值、`.env` 和进程环境变量。两个文件均可省略，相对目录以 App 包为基准，开发配置修改后重启。

```dotenv
# packages/app/.env.local 示例
ORIGAMIX_RENDERER_PORT=5174
ORIGAMIX_SERVER_PORT=1029
```

Desktop 启动时注入 `ORIGAMIX_HOST=desktop` 及自身 host/port；Web 开发默认 `ORIGAMIX_HOST=web`。监听地址仅允许 localhost / 127.0.0.1，端口需为 1–65535。Vite 显式关闭默认 envDir 加载，Node 端 config.ts 读取并挑选字段；只将宿主类型注入前端。App 的 `build:desktop` 和 `build:web` 分别指定宿主，输出到 `dist/desktop/` 和 `dist/web/`。正式 Web 宿主使用单独的启动入口和会话。

App 的代理 token 可通过进程环境或私有环境文件注入。模型密钥由 Server 读取。凭据不能写入 `VITE_*`、项目文件或客户端包。测试使用 ORIGAMIX_ENV_LOCAL=0 跳过个人覆盖。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。源码更新不自动更新已有用户项目。发布前本地归档验证不等同于 npm registry 已可安装。

网页开发入口默认使用 `9685`。Web Server 默认监听 `127.0.0.1:1029`，开发宿主通过同源 `/api/v1` 代理并注入认证信息。

工作台通过 `backend.onStatusChanged` 接收后端状态；App 持有并清理一个订阅，通知只更新内存连接。后端恢复后重新读取项目、Agent 状态和 Apply 状态，SSE 使用新认证重连。传输层以连接代次拒绝旧响应，重启前的连接查询也不能覆盖新缓存；不自动重放不确定的写操作，不重挂载编辑器或替换已有草稿。

## 编辑器工具栏插件

PageSession 在 useCreateEditor 中组合 workspace.toolbar、editor.mode、editor.viewport 和 editor.history。Editor 不再接收 toolbar prop；App 的插件统一组合页面工具菜单及弹窗、标题、版本操作、返回对话和预览，中间区域复用 EditorToolbarArea。宿主名称、权限和回调通过页面级 WorkspaceToolbarProvider 更新，不改变插件身份。

编辑器保存按钮和保存快捷键通过 editor.save() 进入现有 saveVersion（内含 flush → 读取 Working version → 显式保存 Revision → 确认返回的 Working 版本）。保存只推进宿主保存队列的版本，不替换画布或清空撤销历史。对话与编辑模式的 Toolbar 仅在当前模式和活动页响应快捷键。历史栈及画布/逻辑流快捷键保持现有实现；不引入新的保存或 Apply 路径。

插件生命周期、公开操作与通知、预留物料 API 的完整说明见 [Editor 插件开发指南](../editor/PLUGINS.md)。setup 阶段仅查询和注册监听，文档修改应由初始化后的明确操作发起，避免被 Working 会话的初始化过滤忽略。

## 项目设置与页面预览

项目「… → 编辑」中可启用布局配置，启用后点击项目下的「布局配置」在工作区打开。面板采用左侧布局效果、右侧配置表单，支持左右、顶部、混合布局，标题、Logo、父子菜单及排序/隐藏、首页、404 和「页面使用应用布局」开关。可按页关闭应用布局。点击「保存配置」提交 `shell`、`layout`、`routing`。桌面保存到 `origamix.project.json`，Web 保存到 MySQL。保存时校验配置基线，失败保留输入。未配置菜单时只在设置界面显示示例数据；显式空菜单保持为空。

新建项目只填写名称、标识、页面目录、生成位置和启用布局；默认 Browser 路由、根访问前缀和混合布局。关闭布局保留配置，首页和 404 继续有效。引用使用稳定 pageId，删除关联页面前需移除引用。

「页面预览」运行当前页面的 Working 草稿。要更新生成项目中的页面内容，依次点击「保存版本」和「应用到项目」。「布局配置」中的「查看效果」展示当前配置草稿的布局示意，完整菜单、路由和业务行为在生成项目中验证。

在布局表单中指定首页、404 页面和应用壳，点击「保存配置」提交草稿。

布局表单草稿仅保留在当前工作区标签中。关闭标签或退出前，请先保存配置。

### 页面 Agent 用量

聊天工具栏提供「新建对话」和「对话历史」。新建对话在发送第一条消息时保存，历史按最近活动排序，可切回旧对话继续交流。每条对话使用自己的消息上下文，同一页面的对话共享当前 Working Schema。Agent 运行或请求结果待确认时，可以查看对话列表，待状态确认后再新建或切换。

页面对话顶部显示该页累计 Token，可查看输入、输出和本页今日用量。选择「查看明细」可打开「设置 → 用量」并筛选到当前页；直接从设置进入时，默认查看工作台的全部项目。用量提供今日、近 7 天和近 30 天视图，按运行开始时间及工作台时区归日。点击趋势图中的日期或使用日期下拉列表，可查看当天的项目和页面明细。总量只包含模型已返回的用量，旧记录和统计缺失会提示。

## 预览运行诊断

在页面预览右上角点「运行诊断」，可以查看当前 Working 快照的渲染状态、近期流程和请求统计。展开一条交互查看节点 ID、耗时与 HTTP 状态，点击「定位触发元素」可返回预览中的对应元素。刷新预览会开始新的记录；面板在内存中保留近期记录。

对具有完整执行记录的失败节点点击「交给 Agent 修复」，可以使用该次交互的结构化证据发起当前页面的 Agent Run。可在 Agent 对话中查看分析与草稿修改。更新后，打开修复后的预览，用同样的输入触发交互，并确认结果符合预期。对于有副作用的业务操作，使用测试环境或模拟请求。保存版本与 Apply 仍由用户显式操作。
