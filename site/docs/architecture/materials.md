---
title: Materials：页面物料
description: Materials：页面物料的职责、使用与开发说明
---

# Materials：页面物料

## 职责

提供 Tangramino 页面组件、默认值、编辑器配置和可序列化物料清单。当前物料家族为 Ant Design。

## 关键入口

`antd/index.ts` 导出运行注册表；`antd/group.ts` 导出编辑分组；`antd/manifest.ts` 汇总纯数据清单；各组件目录包含运行组件、定义与编辑配置。

## 协作边界

App 使用编辑配置，Runtime 与生成项目使用组件注册表，Server 只读取纯数据清单。注册键与 Schema 的 type 必须一致，改名或删除需考虑保留的页面与历史。

## 开发与验证

从仓库根目录执行：

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

修改后仍需运行根目录检查，并根据变更边界补充集成验证。

源码目录：`packages/materials`。详细接口、维护规则与集成命令见[包 README](https://github.com/keiseiTi/origamix/tree/main/packages/materials)。

返回[整体架构](/architecture/index)。
