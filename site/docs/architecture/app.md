---
title: App：编辑工作台
description: App：编辑工作台的职责、使用与开发说明
---

# App：编辑工作台

## 职责

React 工作台承载项目导航、Agent 会话、版本操作与预览，并装配统一 Editor。画布、属性面板和逻辑流的实现归 Editor，App 保留业务编排与持久化会话。

## 关键入口

`src/app.tsx` 装配工作台；`src/services/` 适配 HTTP；`src/store/` 保存界面投影；`src/components/editor/` 和 `src/components/agent-chat/` 管理编辑与会话。

## 协作边界

使用 Shared 契约、Editor、UI、Materials 编辑配置和 Runtime 渲染。App 按 Server 解析的项目技术栈按需加载编辑物料，预览独立加载运行物料；加载失败显示重试，不自动更换物料集。浏览器源码不导入 Desktop 或 Server；Node 开发宿主通过 Server 的公开入口启动后端。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/app lint
pnpm --filter @origamix/materials... build
pnpm --filter @origamix/app typecheck
pnpm --filter @origamix/app test
pnpm --filter @origamix/app build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/app`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/app)。

返回[整体架构](/architecture/index)。

## 项目设置与页面预览

项目设置持有清单配置草稿。发生保存冲突时，界面可读取最新清单，将各自独立的字段修改合入草稿，并让用户核对双方都改过的字段。用户确认并再次保存后才写入清单。

可信工作台提交目标页的待保留草稿，读取该页 Working 与物料栈，并将快照交给隔离 iframe 渲染。刷新失败保留已有画面。完整应用的布局与导航由生成模板渲染，详见[项目布局契约](/architecture/layout)。
