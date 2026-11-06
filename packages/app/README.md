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

`dev:web` 先编译并启动本地 Server，通过同源 `/api/v1` 代理认证；Server、Shared、Runtime、Materials 源码改动会按依赖顺序构建，成功后重启宿主，前端改动使用 HMR。`ORIGAMIX_WEB_STATE_DIR` 可覆盖默认 `.origamix-web/` 数据位置。认证信息不注入浏览器配置。

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

编辑模式的“逻辑”视图从页面事件树选择事件，再将节点拖入画布。[节点定义适配](../editor/src/components/flow-editor/nodes/node-catalog.ts) 直接读取 [Shared 的 flowNodeManifests](../shared/src/flow/flow-node-manifest.ts)，复用节点名称、类型、默认配置、执行状态及连线信息。请求方法、条件运算符和超时范围同样读取清单；Editor 拥有各节点的配置表单，支持请求参数、多条属性/方法/变量设置、组件多选显隐、真/假条件及弹窗/抽屉操作。读取选项只来自 context.variables，写入选项只来自 context.writable，方法选项只显示公开的上下文方法。条件的右上、右下锚点分别连接真、假分支；开始节点由事件入口创建。

流程取值使用 Shared 的 HyperValue。表达式、函数和自定义 JS 通过 Runtime 在 sandbox 预览或生成页面中执行，工作台只编辑配置。逻辑修改继续沿用 Working 草稿、保存版本和应用到项目的流程。

## 失败与恢复

- 页面选择、关闭、模式切换和预览统一通过 `useWorkspacePageController` 调用，调用方不自行拼装 `transition`。新建页面后的选择复用同一入口。操作前保存当前页及目标页（同一页面只保存一次），共用并发限制和错误提示；保存失败时保留页面、模式与草稿，等待用户重试。
- Working 版本冲突：重新读取权威状态并检查最新内容，再决定如何修改；不要直接用旧快照覆盖。
- 应用结果不明确：通过页面状态确认结果，使用原请求身份重试；不要自动生成新请求或重复提交。
- 目标项目发生外部修改：先比较目标文件和当前草稿；“重新读取项目内容”会放弃未应用修改，操作前确认要保留哪份内容。
- Agent 断线或后端重启：界面从持久化 Run、消息和 Working 恢复；恢复状态未加载时编辑与提交可能暂时禁用，失败时使用界面重试入口。不会自动恢复模型请求。
- 预览报未知物料或渲染失败：检查 Schema 类型、物料注册和属性；渲染错误不会证明草稿已损坏，也不会写入目标项目。

这些流程的实现入口见 [编辑会话](src/components/editor)、[版本操作](src/components/workspace/toolbar/revision-actions.tsx) 和 [历史管理](src/components/workspace/history/revision-history-dialog.tsx)。

开发宿主会通过 Server 的模板准备工具，在本地状态目录生成固定 Runtime/Materials npm 版本的模板，供新建项目使用。运行开发宿主前需已有当前工作区包的构建产物；缺失时先运行根 `pnpm build:libs`。

## 开发环境配置

包内 `.env` 提供 Web 宿主默认值，可在同目录 `.env.local` 覆盖。优先级为 `.env` → `.env.local` → 进程环境变量；修改后重启，相对目录以 App 包为基准。

```dotenv
# packages/app/.env.local 示例
ORIGAMIX_RENDERER_PORT=5174
ORIGAMIX_WEB_STATE_DIR=/absolute/path/to/development-state
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/authorized-project
```

Desktop 启动时注入 ORIGAMIX_DESKTOP=1 及自身 host/port；Web 开发默认 ORIGAMIX_DESKTOP=0。监听地址仅允许 localhost / 127.0.0.1，端口需为 1–65535。Vite 显式关闭默认 envDir 加载，Node 端 config.ts 读取并挑选字段；不会把整个环境对象或 VITE_* 配置注入前端。浏览器的开发代理仍使用原有 DEV 边界，不新增生产远程连接能力。

这些文件不保存凭据。Web 开发模型密钥仍通过进程环境 DEEPSEEK_API_KEY 注入，仅在后端凭据回调使用；不得写入 VITE_*、项目文件或客户端包。测试使用 ORIGAMIX_ENV_LOCAL=0 跳过个人覆盖。

模板交付使用已发布的固定 npm 依赖版本，不再携带 vendor 归档。源码更新不自动更新已有用户项目。发布前本地归档验证不等同于 npm registry 已可安装。

后端默认监听 `127.0.0.1:1029`，可通过宿主的 `ORIGAMIX_SERVER_PORT` 配置覆盖；`0` 表示系统分配端口，供隔离检查使用。网页开发入口默认使用 `9685`，`/api/v1` 继续由开发宿主代理并注入认证信息。固定端口被占用时启动失败，不自动连接或终止占用进程。

工作台通过 `backend.onStatusChanged` 接收后端状态；App 持有并清理一个订阅，通知只更新内存连接。后端恢复后重新读取项目、Agent 状态和 Apply 状态，SSE 使用新认证重连。传输层以连接代次拒绝旧响应，重启前的连接查询也不能覆盖新缓存；不自动重放不确定的写操作，不重挂载编辑器或替换已有草稿。

## 编辑器工具栏插件

PageSession 在 useCreateEditor 中组合 workspace.toolbar、editor.mode、editor.viewport 和 editor.history。Editor 不再接收 toolbar prop；App 的插件统一组合页面工具菜单及弹窗、标题、版本操作、返回对话和预览，中间区域复用 EditorToolbarArea。宿主名称、权限和回调通过页面级 WorkspaceToolbarProvider 更新，不改变插件身份。

编辑器保存按钮和保存快捷键通过 editor.save() 进入现有 saveVersion（内含 flush → 读取 Working version → 显式保存 Revision → 确认返回的 Working 版本）。保存只推进宿主保存队列的版本，不替换画布或清空撤销历史。对话与编辑模式的 Toolbar 仅在当前模式和活动页响应快捷键。历史栈及画布/逻辑流快捷键保持现有实现；不引入新的保存或 Apply 路径。

插件生命周期、公开操作与通知、预留物料 API 的完整说明见 [Editor 插件开发指南](../editor/PLUGINS.md)。setup 阶段仅查询和注册监听，文档修改应由初始化后的明确操作发起，避免被 Working 会话的初始化过滤忽略。

## 项目布局工作台

项目导航中的固定“布局配置”入口打开同一 PageSession 的 layout 目标，默认进入编辑。项目开关写入 manifest；关闭前先保留编辑草稿，关闭后不删除 Working 或历史。页面与布局使用独立标签身份，恢复窗口时从当前项目目录重建归属，不在项目页面列表中伪造页面。

编辑复用现有画布、属性面板、撤销/重做、Schema 编辑器、保存版本、应用和历史弹窗。空白、顶部、侧边、顶部与侧边、侧边与内容顶部预设只生成普通节点，可继续修改。系统页面内容区唯一且不可拥有子节点；导航使用项目页面目录。当前内容区显示编辑占位，实际应用显示真实页面。

layout 会话的草稿与未确认请求保留在同一编辑队列中；网络失败后需要显式重试，不会因继续输入自动重放。布局对话复用现有 Agent：在“布局配置”中返回对话即可描述布局修改，完成后查看编辑结果或预览。关闭项目布局后对话输入禁用；已有记录与草稿保留。

## 完整应用预览

页面和布局配置的预览入口都会展示完整应用，使用项目开关、布局 Working 草稿和项目所有页面的 Working 草稿；不要求先保存版本或应用。进入前先提交当前项目已打开编辑器的草稿，失败时保留编辑视图。布局关闭时直接渲染页面。

预览内可通过页面导航或顶部页面选择切换页面；切换不会打开工作台标签，也不会保存或应用。刷新按钮重新读取完整快照，失败时保留上次快照。没有页面时提示先创建页面。布局/页面在 Runtime 中组合，节点表和业务引擎保持独立，与生成项目使用同一套布局渲染能力。

可信工作台读取数据后通过 postMessage 传送只读 ApplicationSnapshot，iframe 不调用后端、不接收本机路径或凭据。组合渲染结果带快照 ID、页面 ID 和布局/页面 hash，仅用于当前预览；现有页面诊断接口只接收未启用布局的页面结果，避免把布局失败归因到页面。预览使用草稿；独立生成应用仍只读取显式应用后的 Schema 文件。

## 布局对话

同一 PageSession 根据目标切换页面/布局上下文。布局请求使用 `/layout/agent`，携带 `{ kind: 'layout', projectId }`，不发送虚构 pageId；历史消息、Run、事件和重试身份按目标隔离。模型选择、凭据、取消、断线恢复、澄清与流式进度复用已有能力。

布局 Agent 通过 `complete_layout_run` 提交普通 Schema 操作，Server 校验唯一页面内容区、无业务流程/绑定/变量及 Working 版本后原子写入草稿。模型不能修改页面内容、项目开关或写入运行项目。布局 Agent 运行期间不能关闭布局；查看编辑结果后仍需显式保存版本并应用。

### 页面角色与组合模块

页面列表中的角色按钮支持系统角色和自定义角色。角色定义与关联保存在项目清单，角色与页面一一对应；指定登录页不改变公共布局、导航或页面内容。

编辑器左侧“组合模块”提供登录表单及搜索表格。配置接口后可以插入选中容器或拖入画布；视图、事件及流程一起展开成普通节点，一次撤销移除整组新增内容。搜索接口使用 keyword/page/pageSize 参数，返回 `{ items, total }`，列配置和事件可继续编辑。

Container 的“容器定位模式”可选择自由定位。子元素在“布局”中设为容器内绝对定位，设置横纵坐标和层级；移动手柄在同一容器内更新坐标。编辑、预览和生成项目共享定位渲染。

Agent 以当前页面为主。识别项目角色修改时先生成提案，确认并保存项目配置后才继续页面任务；取消则停止整个任务。页面修改仍需显式保存版本及应用。待确认和中断任务从聊天卡片恢复，重新打开聊天不会自动执行。
