---
title: App：编辑工作台
description: App：编辑工作台的职责、使用与开发说明
---

# App：编辑工作台

## 职责

React 工作台承载项目导航、页面编辑、Agent 会话、版本操作与预览。

## 关键入口

`src/app.tsx` 装配工作台；`src/services/` 适配 HTTP；`src/store/` 保存界面投影；`src/components/editor/` 和 `src/components/agent-chat/` 管理编辑与会话。

## 协作边界

使用 Shared 契约、Materials 编辑配置和 Runtime 渲染。浏览器源码不导入 Desktop 或 Server；Node 开发宿主通过 Server 的公开入口启动后端。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/app lint
pnpm --filter @origamix/app typecheck
pnpm --filter @origamix/app test
pnpm --filter @origamix/app build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/app`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/app)。

返回[整体架构](/architecture/index)。
