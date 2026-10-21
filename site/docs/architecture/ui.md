---
title: UI：公共基础控件
description: App、Editor 和物料属性编辑配置共用的控件、工具与主题基础。
---

# UI：公共基础控件

`packages/ui` 保存仓库共用的 shadcn/ui 控件，基于 Base UI，并提供工具与主题基础。App 和 Editor 通过声明入口复用同一份组件源码，页面 Ant Design 物料仍使用自己的控件体系。

## 唯一组件入口

```tsx
import { Button, Input, Dialog, cn } from '@origamix/ui';
```

组件和工具统一使用根入口，没有 `@origamix/ui/button` 等组件子入口。ES modules 允许应用构建优化未使用的 JavaScript，但不能据此认定 CSS 也按组件导入自动裁剪。

样式由宿主显式组合：

```css
@import 'tailwindcss';
@import '@origamix/ui/styles.css';
```

`styles.css` 的 `@source` 扫描 UI 控件源码；当前没有构建时自动生成扫描清单的实现。宿主文档的 `<html>` 需要 `origamix-ui` 类，深色时再添加 `dark`。主题规则限定在这个作用域，工作台样式不进入独立生成项目。

UI 不持有业务状态、编辑会话、HTTP 或持久化；产品布局与业务状态反馈由各消费方负责。Editor 的代码、结构化属性编辑组件归 Editor，不放进基础控件包。

## 开发与验证

在仓库根目录执行：

```sh
pnpm --filter @origamix/ui lint
pnpm --filter @origamix/ui typecheck
pnpm --filter @origamix/ui build
```

新增控件后更新根入口导出，再运行根检查并验证明暗主题。当前 UI 是私有工作区包，不将其描述为已独立发布的 npm 库。

源码与维护规则见[UI 包](https://github.com/keiseiTi/origamix/tree/main/packages/ui)。
