---
title: Editor：统一编辑器
description: 画布、属性面板、大纲树与逻辑流共用一个编辑包和编辑会话。
---

# Editor：统一编辑器

## 职责与入口

`packages/editor` 拥有页面画布、属性面板、大纲树、逻辑流、编辑公共组件与事务转换。可视化与逻辑模式保留在同一个包，不单独发布 FlowEditor。

组件和公共类型只从根入口导入，样式使用独立入口：

```tsx
import {
  Editor,
  CodeEditor,
  JsonAttributeField,
  createEditorTransaction,
} from '@origamix/editor';
import '@origamix/editor/styles.css';
```

`src/editor.tsx` 装配共享 EditorProvider；`src/mods/` 组织画布与面板；`src/flow-editor/` 包含事件树、LogicFlow、节点表单与图转换；`src/core/` 负责引擎快照到操作事务的转换。逻辑模式通过内部适配层动态加载，保留加载和重试反馈。

## 宿主与编辑会话

App 提供 Schema、稳定的 `sessionKey`、物料注册、主题、修改与 flush 回调。Editor 不导入具体物料，也不持有 HTTP、Working 恢复、Revision、Apply 或 Agent Run 生命周期。AI 目标选择通过宿主提供的通用 `targetSelection` 契约呈现。

Schema 是某次编辑会话的初始投影，普通 Working 提交不会重置画布历史。切页、切模式和进入预览前，由宿主等待 flush；失败时保留草稿并阻止离开。

逻辑图变更在模型操作完成后提交完整快照，执行参数保存到流程，位置和尺寸保留在 `extensions.flowGraph`。逻辑模式通过 `onChange(schema, { immediate: true })` 请求立即进入宿主的同一个 Working 队列；Editor 不新增保存通道。

## 契约与执行

节点身份、默认值和参数格式来自 Shared。表单只编辑 HyperValue 与函数参数，执行归 Runtime；Server 根据当前契约校验数据。公开组件复用 [UI](/architecture/ui)，Monaco workers 由 App 配置。

具体操作见[可视化编辑](/guide/editor)与[逻辑流与函数配置](/guide/flow-editor)。

## 开发与验证

在仓库根目录执行：

```sh
pnpm --filter @origamix/editor lint
pnpm --filter @origamix/editor typecheck
pnpm --filter @origamix/editor test
pnpm --filter @origamix/editor build
```

随后运行根目录检查，并实际验证视图切换、事件选择、历史、代码编辑与预览的明暗主题。

源码与维护规则见[Editor 包](https://github.com/keiseiTi/origamix/tree/main/packages/editor)。
