# Editor

统一页面编辑实现包，逻辑编辑器是 Editor 内部模块，与画布共享编辑上下文。App 负责项目装配、Working 会话、HTTP、Agent、Revision 与 Apply；本包只负责编辑体验、引擎适配和编辑数据转换。

| 公开入口                      | 内容                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `@origamix/editor`            | `Editor`、`CodeEditor`、`JsonAttributeField`、事务工具及全部公开契约类型 |
| `@origamix/editor/styles.css` | Tailwind 源码扫描入口                                                    |

`src/index.ts` 是统一入口，`src/editor.tsx` 负责编辑器装配，`src/mods/` 包含画布和面板，`src/flow-editor/` 是内部逻辑编辑模块，不单独公开 visual/flow 入口。

这是私有工作区包，声明出口指向源码以支持 HMR；构建生成 ESM 与类型声明供集成验证。

组件、工具和类型统一使用根入口，样式单独导入：

```tsx
import { Editor, CodeEditor, createEditorTransaction, type EditorHandle } from '@origamix/editor';
import '@origamix/editor/styles.css';
```

包内仍按模块维护并使用相对路径，不提供历史子路径出口。FlowEditor 的动态加载边界保持在包内。

## 宿主装配

App 提供初始 schema、稳定的 sessionKey、当前物料 catalog/groups、主题和编辑回调。Editor 内保留一个 EditorProvider，两种视图共享 Schema、选中元素与编辑历史。宿主通过句柄调用 flush/undo/redo；切页、切换编辑视图与预览前必须等待 flush 成功。底层引擎状态按模块共享，因此 App 只挂载当前活动编辑页的画布；切换前提交，返回后重新读取 Working。在对话、预览和非活动页面中只保留宿主协调，不挂载画布及其 portal。

schema 表示一个 sessionKey 的初始投影，普通 Working 提交不重置引擎。历史恢复或 Agent 新提交由 App 开启新会话。代码编辑器读取传入主题，独立使用时可显式传 `theme`；Monaco workers 由 App 的构建宿主配置，Editor 内不包含 Vite 专有 worker 导入。

`targetSelection` 是通用元素选择能力：宿主传入 `candidates`、可选的 `highlightedElementId` / `disabled` 和 `onSelect`。Editor 呈现候选编号、高亮与禁用反馈，不判断澄清是否过期或管理 Agent Run。App 将业务状态转换为该契约；只读时可通过 `readOnlyMessage` 传入具体原因，Editor 默认显示“当前不可编辑”。

FlowEditor 在进入逻辑模式时动态加载，失败可重试，加载过程不替换页面 Schema。`mods/flow-editor-view.tsx` 是引擎 Store 的唯一流程适配层；流程模块通过内部 `FlowEditorSession` 获取页面快照、物料、Manifest 与修改回调，所有修改仍进入同一编辑会话。

消费方在已有 Tailwind/UI 样式入口之后导入：

```css
@import '@origamix/editor/styles.css';
```

Editor 不导入任何物料家族。App 当前装配默认 Antd，FlowEditor 从同一注册 catalog 获取属性契约。物料三入口整理与专属属性编辑器启用仍属于后续阶段；`propertyEditors` 暂未激活。

## 提交与恢复

App 持有最后一次确认的 Working、当前本地候选及版本。flush 调用 `createEditorTransaction`，再通过现有 Server 管线提交。普通编辑使用非空 Operation Batch，仅无法安全表达的修改使用内部完整候选分支。一次事务不创建 Revision，也不写真实项目。

保存失败保留候选、展示错误并阻止切换；继续输入不会自动重放失败请求，用户可显式重试。每个项目/页面拥有独立提交队列，切换后旧响应不能修改新页面或触发新页面的提交回调。保存 Revision 和 Apply 始终属于 App 的显式业务动作。

扩展只能提交受控的元素属性修改，不获取 HTTP、App Store、原始引擎或保存/Apply 权限。Manifest 保持纯数据，Server 继续拥有最终校验权。

```sh
pnpm --filter @origamix/editor lint
pnpm --filter @origamix/editor typecheck
pnpm --filter @origamix/editor test
pnpm --filter @origamix/editor build
```

已有核心测试随实现迁入 `test/core` 和 `test/flow`；App 会话测试继续验证保存失败和过期响应。维护要求见 [AGENTS.md](AGENTS.md)。

## HyperInput

流程节点的取值字段统一使用 Shared 的 HyperValue。HyperInput 提供字符串、数字、布尔值、空值、JSON、上下文、表达式和函数。函数弹窗支持参数绑定、代码编辑、确认、取消和校验；编辑过程不执行代码。请求参数、条件、属性与变量设置、方法参数、显隐和自定义 JS 共用该输入与 Runtime 求值器；元素 ID、事件和连线等结构字段继续使用选择器。节点契约版本随 Origamix 统一发布，旧 Schema 转换只由 Server 在页面打开时执行。

逻辑流表单沿用 Tangramino 示例的值类型与字段方式：请求头、查询参数、请求体使用函数；条件判断使用表达式或函数，不提供 JSON 类型或额外比较器。节点属性、增删、连线及编排变化均提交完整图快照，通过 `onChange(schema, { immediate: true })` 通知宿主及时进入 Working 队列。函数弹窗确认后才提交配置，取消保留原值。

## 隔离原型表面

`CanvasPrototypeSurface` 是单独 frame 中的实验画布，拥有自己的 Tangramino Engine 和 history。宿主仅调用受限 `CanvasPrototypeHandle.run`，不取得 Engine。它验证公开 SchemaUtils + 插件 hooks 的属性/插入路径；不持有 Working 或 HTTP 权限，也不替换正式 Editor。正式迁移前必须补齐原生移动、交互和持久化会话验证。
