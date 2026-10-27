---
title: Materials：页面物料
description: Materials：页面物料的职责、使用与开发说明
---

# Materials：页面物料

## 职责

提供 Origamix 页面组件、默认值、编辑器配置和可序列化物料清单。当前物料家族为 Ant Design。

## 关键入口

`src/index.ts` 作为包根入口导出物料定义/转换 API；`antd/editor.ts` 导出编辑分组与配置；`antd/runtime.ts` 导出运行注册表；`antd/manifest.ts` 汇总纯数据清单；各组件目录包含运行组件、定义与编辑配置。

## 协作边界

App 从 `@origamix/materials/antd/editor` 加载编辑注册并注入 Editor；Runtime 与生成项目使用 `@origamix/materials/antd/runtime`；Server 只读取 `@origamix/materials/antd/manifest`。根入口提供物料编写类型和辅助函数，不汇总具体物料组件。注册键与 Schema 的 type 必须一致，改名或删除需考虑保留的页面与历史。

项目当前固定 React + Antd，物料集为 `official-antd@1.0.0`，缺失或不受支持的配置会报错，不静默回退。第二套 React 物料、Vue 和物料市场尚未接入；列、分页、选项、树、页签与表单初始值有各自的专用属性编辑器；逻辑流读取、运行时写入和事件分别按 Manifest 白名单配置。

运行、编辑、Manifest 三个入口隔离依赖。生成项目不安装 Editor；React 和 Ant Design 是运行 peer dependencies，UI 仅用于可选的编辑消费方，物料运行契约由 Runtime 提供并内联到声明。页面材料与工作台基础控件职责不同。

## 更新物料后的联动

工作区与发布包统一使用 `dist` 出口。`pnpm dev` 监听 Materials 源码，顺序构建 Materials 和消费 Manifest 的 Server，准备最新模板物料归档后，自动重启 Vite 与 Electron。App 的编辑器和预览随新实例加载新物料，开发时无需重新打包 App；正式交付使用根 `pnpm build` 构建 App 和桌面资源。

只更新前端会使编辑配置与后端校验不一致，因此 Desktop 模式不会提前对 Materials 执行 HMR。未通过桌面开发启动器验证时，先构建 Materials，再构建 Server、Desktop 并重启宿主。已有用户项目仍使用其已安装的物料版本，需要显式升级项目并重新安装依赖。

自动重启的暂停方式和状态限制见[开发与验证](/architecture/development#源码更新与自动重启)。

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
