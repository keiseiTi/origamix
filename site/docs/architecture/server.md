---
title: Server：本地后端
description: Server：本地后端的职责、使用与开发说明
---

# Server：本地后端

## 职责

本地 HTTP 后端拥有项目用例、Working 草稿、Revision、显式应用，以及会话与 Agent Run 的持久化。

## 关键入口

`src/server.ts` 是宿主无关的启动入口；`src/hosts/utility-process.ts` 是 Electron Utility Process 适配器。`src/http/` 适配请求，`src/projects/` 管理项目，`src/schema/` 管理编辑与应用，`src/agent/` 执行 Run，`src/database/` 管理 SQLite；测试及辅助代码归入 `test/`。公开 `@origamix/server/runtime` 仍导出 `startServer`，返回端口、目录授权注册和关闭方法。

## 协作边界

消费 Shared 协议和 Materials 的纯数据 Manifest。传输层保持轻薄，业务规则在 Service，记录与文件由 Repository / Store 管理，不加载工作台或桌面代码。

## 版本与恢复

Server 负责已登记的页面 Schema 迁移、数据库存储版本检查及迁移。当前统一发布版本为 `1.0.0`，Schema 与数据库迁移清单为空；新数据库初始化存储版本 1。无版本记录的已有数据库、未知结构和较新版本会被拒绝，不猜测结构或要求用户删除数据。

打开页面不会升级项目依赖。项目菜单中的显式升级通过既有 Apply 服务更新已保存页面，并更新依赖归档和项目清单；升级状态可恢复，不在启动时自动重放，也不执行包管理器。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/materials build
pnpm --filter @origamix/server lint
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/server`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/server)。

返回[整体架构](/architecture/index)。
