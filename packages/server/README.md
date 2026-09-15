# Server 阅读指南

Server 是不依赖 Electron 或 React 的本地后端，负责项目管理、Schema 编辑与应用、会话和 Agent 执行。HTTP 只监听 `127.0.0.1`，目录授权和模型凭据由宿主提供。

## 从哪里开始

1. [runtime.ts](runtime.ts)：查看依赖装配、启动和关闭。
2. [http/server.ts](http/server.ts)：查看统一鉴权、响应封装和路由注册。
3. 按要理解的业务进入下表对应目录，先读 Service，再读它调用的 Repository 或 Store。
4. 阅读实现旁的 `*.test.ts`，了解成功、拒绝和恢复场景。

| 目录              | 职责与入口                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects/`       | [project-service.ts](projects/project-service.ts) 编排项目和页面用例；目录授权、Manifest、初始化和源码生成各有对应模块                                                              |
| `schema/`         | [schema-service.ts](schema/schema-service.ts) 是权威编辑管线；[project-apply-service.ts](schema/project-apply-service.ts) 负责显式应用和重载；两个 Store 分别管理工作副本和目标文件 |
| `conversations/`  | [conversation-service.ts](conversations/conversation-service.ts) 管理会话、消息和创建 Run 的数据库事务                                                                              |
| `agent/`          | [agent-service.ts](agent/agent-service.ts) 接收运行请求；[run-executor.ts](agent/run-executor.ts) 编排模型执行；Run 服务管理状态转换；`tools/` 管理工具、权限与预算                 |
| `diagnostics/`    | [diagnostic-service.ts](diagnostics/diagnostic-service.ts) 校验并清洗渲染诊断；[diagnostic-cache.ts](diagnostics/diagnostic-cache.ts) 只在内存保存诊断                              |
| `http/`           | 按 Project、Schema、Apply、Agent、Runtime 分文件注册路由，共用鉴权和响应适配                                                                                                        |
| `database/`       | SQLite 连接、Drizzle 表定义、初始化与兼容性检查；业务 Repository 放在各业务目录                                                                                                     |
| `evaluation/`     | 固定评测、模型能力探测、安全审计与发布门禁，由 [tooling.ts](tooling.ts) 导出                                                                                                        |
| `testing/`        | Fake Engine 与确定性模型，供测试或演示使用                                                                                                                                          |
| `infrastructure/` | 业务复用的按 key 串行队列和原子文件写入；对应测试覆盖失败与恢复                                                                                                                     |
| `scripts/`        | 构建、开发监听、模板与启动集成检查                                                                                                                                                  |

业务目录内部保留 Service → Repository/Store 的职责边界，不再为每个技术层建立子目录。目录位置不代表允许绕过服务写入。

## 四条常用调用链

### 创建页面

`http/project-routes.ts` → `projects/project-service.ts#createPage` → 初始化 Target Schema、生成页面入口、初始化 Working Schema → 更新 Manifest → 重建 SQLite 页面索引。

从 `createPageWithSchemaUnlocked` 阅读具体步骤和失败清理。Manifest 与 SQLite 不是一个跨文件事务。

### 保存 Schema

`http/schema-routes.ts` → `schema/schema-service.ts#commitSchema` → 页面串行队列 → 恢复检查 → ChangeSet、页面归属、Revision 和 Materials 校验 → Journal / Revision / Working Schema / Receipt 写入。

普通保存与撤销更新 Working Schema，不会隐式写入真实项目的目标 Schema。

### Apply 到项目

`http/apply-routes.ts` → `schema/project-apply-service.ts#apply` → 在 Schema 页面队列内检查版本与目标变化 → `schema/target-schema-store.ts` 写目标文件 → 更新基线与应用回执。

从目标项目重载是独立的显式操作；不能将外部改动在普通编辑时自动导入。

### Agent Run

`http/agent-routes.ts` → `agent/agent-service.ts#start` → 路由意图并由 ConversationService 创建消息和 Run → `agent/run-executor.ts#execute` → 上下文、模型与工具执行 → 消息和 Run 状态更新。

Schema 写工具 `agent/tools/replace-page-schema.ts` 仍调用 `commitSchema`。`agent/event-broker.ts` 为事件订阅提供通道。启动时通过 `agent/run-recovery.ts` 恢复未完成 Run 的持久化状态，不恢复模型请求。

### 同步调用与重复请求

`AgentService.start(request)` 是唯一运行启动入口。HTTP 立即返回 Run 标识；进程内测试可等待返回对象的 `completion`。同一请求的并发调用共享一次执行；已完成 Run 的重放返回持久化记录，不会重新路由或执行模型。

### 提交与恢复的内部边界

`schema-service.ts` 管理页面队列、校验和业务操作；`schema-commit.ts` 管理 Journal、快照提交和恢复协议；`schema-hash.ts` 提供纯哈希计算。提交和恢复只能在 Service 持有页面队列时调用。四个持久化阶段是 `prepared`、`revision`、`schema`、`receipt`。

`infrastructure/keyed-queue.ts` 复用串行算法，各业务保留自己的队列范围。`infrastructure/atomic-file.ts` 统一临时文件写入、同步、关闭、重命名和失败清理；路径授权与父目录创建仍由调用方负责。文件原子替换不等于跨文件事务。

## 数据存在哪里

| 数据                                       | 所有者                               | 意义                                      |
| ------------------------------------------ | ------------------------------------ | ----------------------------------------- |
| 项目、页面索引、会话、消息、Run            | 业务 Repository + SQLite             | 应用记录；页面清单以项目 Manifest 为准    |
| Working Schema、Revision、Journal、Receipt | `schema/working-schema-store.ts`     | 可编辑页面数据、历史和恢复记录            |
| `src/pages/<slug>/schema.json`             | `schema/target-schema-store.ts`      | 初始化或显式 Apply 写入的运行投影         |
| `origamix.project.json`                    | `projects/project-manifest-store.ts` | 项目与页面注册清单，SQLite 不能反向重写它 |
| 渲染诊断                                   | `diagnostics/diagnostic-cache.ts`    | 进程内缓存，重启不保留                    |

## 修改与验证

在仓库根目录运行：

```sh
pnpm dev:web
# 或启动桌面宿主
pnpm dev
```

Server 单包检查：

```sh
pnpm --filter @origamix/server lint
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
```

| 修改内容          | 重点阅读与验证                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目和页面操作    | `projects/project-service.test.ts`、`http/project-routes.test.ts` 中的项目、并发创建和失败恢复场景                                                                     |
| Schema 编辑与恢复 | `schema/schema-service.test.ts`，关注陈旧版本、幂等、并发与中断恢复                                                                                                    |
| Apply 与目标路径  | `schema/project-apply-service.test.ts`，关注外部改动和路径逃逸                                                                                                         |
| Agent 执行与权限  | `agent/run-executor.test.ts`、`agent/tools/*.test.ts`、`http/agent-server.test.ts`、`http/agent-schema-flow.test.ts`；运行 `pnpm --filter @origamix/server gate:agent` |
| 数据库            | `database/database.test.ts`；保持无外键检查                                                                                                                            |
| 开发与构建        | `scripts/build-options.test.mjs`；运行 `pnpm --filter @origamix/server test:dev`                                                                                       |
| 模板复制          | `template.test.ts`；运行 `pnpm --filter @origamix/server test:template`                                                                                                |

交付前运行根目录的 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。完整约束见 [AGENTS.md](AGENTS.md)。

## 自动边界检查

`pnpm --filter @origamix/server lint` 自动检查导入边界；根目录 `pnpm test:architecture` 验证规则本身，并已接入 `pnpm test` 和针对规则变更的提交前检查。

- HTTP 和 Agent 工具不能直接导入文件系统、数据库、仓库实现或写文件辅助模块；通过服务执行写入，注入的仓库接口只提供所需读取方法。
- Working Store、Target Store、Schema 提交协议和原子文件写入只能由规则中明确指定的模块在运行时引用。
- 业务模块不能反向依赖 HTTP／启动入口；数据库和基础模块不能反向依赖业务模块。
- 运行代码不能导入测试辅助、评测、React、Electron 或其他界面包；Materials 只允许 Manifest 出口。
- `runtime.ts` 只导出 `startServer`，构建测试也会加载真实产物检查这一点。

规则实现位于 [eslint-server-boundaries.mjs](../../scripts/eslint-server-boundaries.mjs)，正反例位于 [对应测试](../../scripts/eslint-server-boundaries.test.mjs)。它检查静态导入、重导出、字面量动态导入与直接 `require`，并拒绝被检查文件中的动态模块路径；它不能代替运行时授权与数据恢复验证。

HTTP 测试已按用途分开：`server.test.ts` 关注鉴权与响应；`project-routes.test.ts` 关注项目／页面 HTTP 流程；`agent-schema-flow.test.ts` 使用真实服务、存储和写工具连接完整流程，仅替换模型，验证 Agent 保存不隐式 Apply、重复请求、陈旧版本和跨项目拒绝。纯项目恢复测试放在 `projects/project-service.test.ts`。

## 包入口（MVP）

`runtime` 只导出宿主需要的 `startServer`。`utility` 是 Electron 入口，`tooling` 提供评测和能力探测；模板、构建和开发脚本使用各自的包出口。内部模块直接导入所属业务文件，测试从 `testing/` 使用 Fake Engine。

当前处于 MVP 阶段，重构时同步修改调用方，不保留旧名称别名、旧启动路径或内部实现的聚合导出。
