---
title: Desktop：桌面宿主
description: Desktop：桌面宿主的职责、使用与开发说明
---

# Desktop：桌面宿主

## 职责

Electron 提供本机能力，管理窗口、目录授权、模型凭据和本地后端生命周期。

## 关键入口

`src/main/index.ts` 是应用与后端启动入口；`src/preload/index.ts` 暴露命名桌面能力；`src/main/config.ts` 解析环境文件与资源路径；`scripts/dev.ts` 统一监听依赖、构建和重启；其他 `scripts/` 模块负责编译与资源组装。

## 协作边界

App 使用 Shared 定义的桌面桥；Desktop 通过公开入口启动 Server。项目业务与 Schema 写入属于 Server，页面预览由 App 的沙箱 iframe 承载。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/desktop lint
pnpm --filter @origamix/desktop typecheck
pnpm --filter @origamix/desktop test
pnpm build
pnpm test:desktop
pnpm test:dev
```

包内 `build` 消费已构建的上游产物；上面的根 `pnpm build` 负责完整准备。开发更新采用[自动重启流程](/architecture/development#源码更新与自动重启)，没有向公共桌面桥增加开发重启接口。

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`apps/desktop`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/apps/desktop)。

返回[整体架构](/architecture/index)。
