# App

React 工作台，负责项目导航、页面编辑、Agent 会话、Apply 状态与预览展示。外部消费的是 Vite 生成的 `dist/`，不导出内部组件或 Store 给其他包。

## 代码入口

- [src/app.tsx](src/app.tsx)：工作台装配。
- [src/services](src/services)：通过 Shared 契约调用 HTTP，统一认证刷新和错误处理。
- [src/store](src/store)：窗口级导航和偏好投影；导航、页签和未发送草稿使用 `sessionStorage`。
- [src/components/editor](src/components/editor)：编辑会话、保存队列和编辑器集成。
- [src/components/agent-chat](src/components/agent-chat)：Agent 会话及事件恢复。
- [src/preview](src/preview)：给 Runtime 渲染结果添加工作台反馈；引擎创建归 Runtime。
- [dev-server.ts](dev-server.ts)：Node 开发宿主，允许使用 Server 的公开启动入口。

`src/` 仅依赖 Shared、Materials、Runtime 及声明的前端依赖，不读取文件系统或导入 Server。编辑会话维护 Server Working Schema 的内存投影，窗口导航只保存导航与未发送消息草稿，不能为方便同步而合并成第二个数据库。HTTP 不确定失败不能自动重放写请求。

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

## 失败与恢复

- 草稿保存失败：保留当前编辑内容，查看错误并重试；页面切换或预览可能被阻止，避免丢失未提交编辑。
- Working 版本冲突：重新读取权威状态并检查最新内容，再决定如何修改；不要直接用旧快照覆盖。
- 应用结果不明确：通过页面状态确认结果，使用原请求身份重试；不要自动生成新请求或重复提交。
- 目标项目发生外部修改：先比较目标文件和当前草稿；“重新读取项目内容”会放弃未应用修改，操作前确认要保留哪份内容。
- Agent 断线或后端重启：界面从持久化 Run、消息和 Working 恢复；恢复状态未加载时编辑与提交可能暂时禁用，失败时使用界面重试入口。不会自动恢复模型请求。
- 预览报未知物料或渲染失败：检查 Schema 类型、物料注册和属性；渲染错误不会证明草稿已损坏，也不会写入目标项目。

这些流程的实现入口见 [编辑会话](src/components/editor)、[版本操作](src/components/workspace/mods/version-actions.tsx) 和 [历史管理](src/components/workspace/mods/revision-history-modal.tsx)。
