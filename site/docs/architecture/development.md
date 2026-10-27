---
title: 开发与验证
description: 所有下列命令都从 Origamix 仓库根目录运行。
---

# 开发与验证

所有下列命令都从 Origamix 仓库根目录运行。

## 桌面与浏览器开发

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` 先准备库、Server、Main/Preload 和带 vendor 的模板，再启动 Vite 与 Electron。默认前端地址为 `http://127.0.0.1:5173`；后端使用系统分配的动态端口，由 Main 向工作台提供连接。

### 源码更新与自动重启

| 修改范围                   | 开发时的处理                               |
| -------------------------- | ------------------------------------------ |
| App、Editor、UI            | Vite HMR，更新页面                         |
| Shared、Runtime、Materials | 按依赖顺序构建，准备资源后自动重启桌面实例 |
| Server、Main、Preload      | 构建后自动重启桌面实例                     |
| 模板、Desktop 环境文件     | 重新准备资源并自动重启桌面实例             |

连续保存会合并处理，构建期间的新变化排队。构建和模板资源先准备成功，再正常退出 Electron、关闭旧后端与 Vite，切换资源并启动新实例。构建失败时保留当前实例，退出超时则暂停更新，不强制杀掉桌面进程。新窗口自动获取新的后端地址、凭据和服务实例；端口不保证与上次不同。

开发终端输入 `p` 并回车可暂停／恢复自动重启；构建失败后可以修复源码触发重试，或按 Enter 重试。修改开发启动脚本或安装依赖后，需要重新运行 `pnpm dev`。

自动重启会重新创建窗口，可能中断活动 Agent、未提交编辑和聊天输入；已持久化的 Working 由原有机制恢复，不提供窗口临时状态的无损交接。调试 Agent 或长时间编辑时可先暂停自动重启。此流程只在开发启动器中协调，没有新增 App 业务会话协议或公共桌面重启桥接。

Materials 更新时会构建新的编辑／运行入口和 Manifest，再构建使用 Manifest 的 Server，并准备模板中的物料归档。开发中的 App 随 Vite／Electron 重启加载新物料，无需先打包 App；正式产物使用根 `pnpm build` 重新构建 App。已有用户项目的依赖不会随源码变化自动升级，见[项目与页面](/guide/projects#升级项目)。

### 环境文件

Desktop、App 和独立 Server 各自在包目录维护 `.env`，可选个人覆盖放同目录 `.env.local` 并由 Git 忽略，不在仓库根目录另放一份。优先级为默认文件 < 个人覆盖 < 进程环境变量；相对路径以所属包目录为基准。

- `apps/desktop/.env`：桌面前端地址、调试端口与资源路径。Desktop 向 App 注入前端地址，打包只复制默认 `.env`。
- `packages/app/.env`：独立 Web 开发宿主的地址、授权项目和状态目录。
- `packages/server/.env`：独立 Server 开发宿主的状态、项目和模板路径；Desktop／Web 启动 Server 时自行注入参数。

这些文件只保存非敏感配置；API Key 不写入文件或 `VITE_*`，也不会把整个 env 暴露给 Renderer。独立 App／Server 修改配置后需重启。

### 浏览器开发

浏览器开发宿主：

```sh
# 在当前 shell 中配置 DEEPSEEK_API_KEY，不要写入 VITE_*。
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/project pnpm dev:web
```

把示例路径替换为已有项目的绝对路径。浏览器没有原生目录选择器，宿主环境变量提供目录授权。默认开发数据在 `.origamix-web/`，可用 `ORIGAMIX_WEB_STATE_DIR` 覆盖。Key 不通过前端环境变量传递。

## 仓库检查

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

根 `pnpm typecheck` 会先构建 Materials；单独检查 App、Server 等消费包之前也需要先构建 Materials 的声明。

单包 `build` 只构建本包，调用前需准备其上游产物；根命令负责依赖顺序。Desktop 的 `build` 还组装已有 Server 与模板产物，包内 `package:*` 只消费已有资源。

| 根命令               | 用途                                                    |
| -------------------- | ------------------------------------------------------- |
| `pnpm build:libs`    | 构建 UI、Shared、Editor、Runtime、Materials             |
| `pnpm build:web`     | 构建库和 App 静态资源                                   |
| `pnpm build`         | 库 → Server → App → Desktop 编译与资源组装              |
| `pnpm pack:npm`      | 构建 Shared、Runtime、Materials 的本地 npm 归档，不发布 |
| `pnpm package:dir`   | 构建 macOS arm64 应用目录                               |
| `pnpm package:mac`   | 检查、构建并制作 macOS arm64 DMG／ZIP                   |
| `pnpm package`       | 等同于 `package:mac`                                    |
| `pnpm test:dev`      | Desktop／Server 开发更新与监听清理验证                  |
| `pnpm test:desktop`  | 构建并验证真实 Main、IPC、后端与预览隔离                |
| `pnpm test:web`      | 准备产物并验证 Web 宿主与认证代理                       |
| `pnpm test:template` | 准备产物并验证生成项目的独立安装、类型检查与构建        |
| `pnpm gate:internal` | 固定评测数据及门槛检查，不证明真实模型质量              |

桌面集成检查需要图形会话；生成项目检查需要依赖缓存或 registry 网络。本地 macOS 构建使用 ad-hoc 签名，没有 Developer ID 签名或 Apple 公证；官网仍以源码获取和本地启动为入口，不提供安装器下载。

界面变更还应在浅色、深色及窄屏下实际操作验证，自动检查不能证明页面显示正确。

## 官网开发

```sh
pnpm site
pnpm site:build
```

官网内容位于 `site/docs/`，主题位于 `site/theme/`。

## 阅读与贡献

先阅读根 `AGENTS.md` 与要修改目录的包级指导，保持公开导入边界。业务规则放在 Server 服务，持久化放在 Repository 或文件服务；不要在 UI 或 Main 新增目标 Schema 写入路径。

[仓库 README](https://github.com/keiseiTi/origamix/blob/main/README.md) 是当前命令总览，包 README 提供详细接口与验证说明。
