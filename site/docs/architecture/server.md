---
title: Server：本地后端
description: Server：本地后端的职责、使用与开发说明
---

# Server：本地后端

## 职责

本地 HTTP 后端拥有项目用例、Working 草稿、Revision、显式应用，以及会话与 Agent Run 的持久化。

## 关键入口

`runtime.ts` 提供宿主启动入口；`http/` 适配请求；`projects/` 管理项目；`schema/` 管理编辑与应用；`agent/` 执行 Run；`database/` 管理 SQLite。

## 协作边界

消费 Shared 协议和 Materials 的纯数据 Manifest。传输层保持轻薄，业务规则在 Service，记录与文件由 Repository / Store 管理，不加载工作台或桌面代码。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/server lint
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/server`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/server)。

返回[整体架构](/architecture/index)。
