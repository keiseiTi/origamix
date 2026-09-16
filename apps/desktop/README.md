# Desktop

Electron 宿主，负责窗口、目录授权、safeStorage 凭据和后端进程生命周期。项目业务经 Server HTTP 执行；Desktop 不拥有项目数据库或 Schema 写入管线。

## 接口与组装

- [src/main/index.ts](src/main/index.ts)：应用启动、设置、命名 IPC 和后端恢复。
- [src/main/page-windows.ts](src/main/page-windows.ts)：预览视图生命周期和权限。
- [src/preload/index.ts](src/preload/index.ts)：工作台桥。
- [src/preload/preview.ts](src/preload/preview.ts)：只读预览桥；Main 绑定页面后代取快照，预览不能取得后端凭据。
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

资源检查不等同于签名安装器启动。安装包发布与签名配置见根 README；`package:dir` 禁用自动 macOS 证书发现。维护约束见 [AGENTS.md](AGENTS.md)。
