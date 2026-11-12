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

Server 打开页面时校验 Schema 与物料契约，打开项目时校验项目清单。SQLite 初始化使用当前表结构，并校验已存在数据库的存储版本与表结构。页面会话和 Run 按项目及页面归属保存。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/materials... build
pnpm --filter @origamix/server lint
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/server`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/server)。

返回[整体架构](/architecture/index)。

## 布局服务

`src/layout/` 管理项目唯一布局的 Working、Revision 和恢复证据；显式布局 Apply 仍由既有目标写入服务负责。布局 Agent 共用执行器，绑定项目 target 和起始 Working 版本，不创建伪造页面记录。接口、权限与数据结构见[Layout 契约与接口](/architecture/layout)。
