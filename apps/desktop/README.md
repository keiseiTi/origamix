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

## 打包与签名范围

资源和平台选项由 [electron-builder.yml](electron-builder.yml) 管理，图标和 macOS 权限文件位于根目录 [build](../../build)。`pnpm package:dir` 显式禁用 macOS 签名身份，适合本地资源检查；`pnpm package` 不代表已有发行证书或公证配置。

当前 macOS 配置为 `notarize: false`，仓库没有完成证书分发、公证或发布流水线。准备正式发行时需配置相应平台的签名与发布流程，并验证安装器实际启动；`test:resources` 只验证资源结构。签名配置属于发行工作，不能从开发构建成功推断已完成。
