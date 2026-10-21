---
title: Runtime：页面渲染
description: Runtime：页面渲染的职责、使用与开发说明
---

# Runtime：页面渲染

## 职责

将调用者提供的 Schema 与物料注册表交给 Tangramino 渲染，供 App 预览与生成项目共用。

## 关键入口

`react.tsx` 提供 `@origamix/runtime/react`，包括 `OrigamixPage`、未知物料检测和渲染结果诊断。

## 协作边界

不绑定物料库，不承担宿主路由、编辑或持久化。请求节点可以发起页面 HTTP 请求，不使用工作台 HTTP 客户端或宿主凭据。调用方提供 Schema、materials 与展示反馈，Runtime 负责引擎装配与错误捕获。

## 事件执行

`logic-nodes.ts` 注册 Shared 定义的节点处理器；`execute.ts` 统一解析 HyperValue、上下文与函数参数。开始节点由引擎处理；自定义 JS 和其他节点函数都在页面 Runtime 执行，Editor 与 Server 只处理配置。

上下文使用 `state.elementId.property`、`global.name`、`result.nodeId.path`；函数参数还可绑定公开的 `method.elementId.methodName`。函数体接收按参数列表顺序解析的值，异步节点等待 Promise。方法节点把求值结果作为一个参数传入，数组不展开。

条件节点直接根据判断结果分支。请求返回 `{ ok, status, data, error }`，不隐式携带凭据，使用固定 10 秒超时并拒绝自动重定向。普通脚本错误显示执行反馈并停止本次事件后续动作；页面状态修改不写回 Working。

求值器不是安全沙箱。App 预览在既有 sandbox iframe 中运行，不接收 Desktop bridge 或后端凭据；生成项目在自身环境中执行同一 Runtime。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/runtime lint
pnpm --filter @origamix/runtime typecheck
pnpm --filter @origamix/runtime test
pnpm --filter @origamix/runtime build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/runtime`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/runtime)。

返回[整体架构](/architecture/index)。
