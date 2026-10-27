---
title: Shared：公共契约
description: Shared：公共契约的职责、使用与开发说明
---

# Shared：公共契约

## 职责

平台无关的类型、运行时 Schema 和纯校验，为各层约定相同的请求与页面数据结构。

## 关键入口

`src/index.ts` 显式汇总唯一公共入口。内部按 `page/`、`project/`、`flow/`、`agent/`、`material/`、`transport/` 分领域；页面 Schema 与编辑操作、项目与页面 HTTP 契约分别维护。Agent 的 Run、消息、事件、请求与终态结果也各有独立文件；桌面桥、凭据网关和预览消息归入 `transport/`。

`project/project-stack.ts` 定义当前项目技术栈与严格解析；`material/material-manifest.ts` 定义物料 Manifest 格式；`flow/flow-node-manifest.ts` 定义内置流程节点身份、默认参数、连接限制与参数校验；`flow/hyper-value.ts` 定义可序列化值及函数配置。

Shared 不保存具体 Ant Design 物料清单，也不执行项目函数。统一发布版本由 `src/version.ts` 声明，当前为 `1.0.0`。持久化旧数据的转换归 Server，不通过放宽 Shared 当前契约实现。

## 协作边界

不依赖其他工作区包，也不读取文件、网络或凭据。工作区解析源码，发布归档解析 `dist` 的 ESM 与类型声明。消费者统一从唯一根入口 `@origamix/shared` 导入；接收边界执行实际校验。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/shared`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/shared)。

返回[整体架构](/architecture/index)。
