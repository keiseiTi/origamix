# Editor

统一页面编辑实现包，逻辑编辑器是 Editor 内部模块，与画布共享编辑上下文。App 负责项目装配、Working 会话、HTTP、Agent、Revision 与 Apply；本包只负责编辑体验、引擎适配和编辑数据转换。

| 公开入口                      | 内容                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `@origamix/editor`            | `Editor`、`CodeEditor`、`JsonAttributeField`、事务工具及全部公开契约类型 |
| `@origamix/editor/styles.css` | Tailwind 源码扫描入口                                                    |

`src/index.ts` 是统一入口，`src/editor.tsx` 负责编辑器装配，`src/components/` 包含画布和面板，`src/components/flow-editor/` 是内部逻辑编辑模块，不单独公开 visual/flow 入口。

代码按职责组织：

| 目录                | 职责                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `src/components/`   | 按功能组织布局、画布、导航/属性面板、流程编辑和编辑工具；CodeEditor 就近维护 Worker 配置 |
| `src/hooks/`        | 公共实例、状态订阅与跨功能装配 Hooks                                                     |
| `src/interfaces/`   | 编辑器、物料、插件和属性扩展的公共接口与类型                                             |
| `src/session/`      | Provider 装配、独立 Store、Context、实例绑定、命令、事件与历史                           |
| `src/schema/`       | Schema 元素、布局和流程查询与修改                                                        |
| `src/transactions/` | 快照差异与提交事务转换                                                                   |
| `src/plugins/`      | 插件生命周期、物料扩展与工具栏插件                                                       |
| `src/prototype/`    | 隔离实验画布                                                                             |

功能目录以 `index.tsx` 作为组件入口，专属 Hooks、规则和子组件就近放置。属性面板拆分字段规则、控件、事件入口和失效属性清理；流程画布的生命周期在 `components/flow-editor/hooks/use-flow-canvas.ts`，视图仍动态加载。`session/editor-store.ts` 保留每个 Provider 独立的草稿与历史，`editor-instance.ts` 管理较长生命周期的实例和受保护命令，`editor-context.ts` 提供显式 selector 订阅。

这是私有工作区包，声明出口指向源码以支持 HMR；构建生成 ESM 与类型声明供集成验证。

组件、工具和类型统一使用根入口，样式单独导入：

```tsx
import { Editor, CodeEditor, createEditorTransaction, type EditorHandle } from '@origamix/editor';
import '@origamix/editor/styles.css';
```

包内仍按模块维护并使用相对路径，不提供历史子路径出口。FlowEditor 的动态加载边界保持在包内。

## 宿主装配

App 提供初始 schema、稳定的 sessionKey、当前物料 catalog/groups、主题和编辑回调。Editor 内保留一个 EditorProvider，两种视图共享 Schema、选中元素与编辑历史。宿主通过插件的 `editor.renderToolbar` 组合 Toolbar，其渲染在 EditorProvider 内，使用 `useEditorSelector(selector)` 按需订阅公共状态、`useEditorContext()` 获取稳定实例并执行撤销/重做、切换模式和调整宽度。内部 Store 和任意 setState 不对外开放。主题、物料目录、候选选择、只读状态与实例引用统一存入会话 Zustand Store，通过一个 EditorSessionContext 注入；环境更新只更新对应字段，不重建 Schema、撤销历史或触发 onChange。模式与宽度继续随保留的 EditorInstance 存活。独立使用 CodeEditor 时仍支持显式 theme，未提供时默认浅色。App 的 PageEditor 仅保留宿主 flush 句柄；切页、切换编辑视图与预览前必须等待 flush 成功。每个 EditorProvider 创建独立会话，Schema 编辑工具、历史和选中状态互不共享。App 仍只挂载当前活动编辑页的画布；切换前提交，返回后重新读取 Working。在对话、预览和非活动页面中只保留宿主协调，不挂载画布及其 portal。

宿主在保留的页面会话中调用 `useCreateEditor({ plugins, initialViewportWidth, initialMode, beforeModeChange })`，将稳定实例传给 `<Editor editor={editor} ... />`。初始选项仅用于创建；`beforeModeChange` 使用最新回调，必须等待宿主 flush；失败保持原模式，异步完成时若画布会话已切换则拒绝切换。实例保存宽度和编辑模式，画布卸载后仍保留；Schema、选中元素和撤销历史仍由当前 `sessionKey` 的独立内核维护。一个实例同一时间只能挂载一个编辑器；卸载后 Schema 命令不可用，只读时拒绝修改。实例不公开原始 Store 或任意 setState。

```tsx
const editor = useCreateEditor({
  plugins: [createEditorModePlugin(), createViewportPlugin(), createHistoryPlugin()],
  beforeModeChange: () => workingSession.flush(),
});

return (
  <Editor
    editor={editor}
    schema={schema}
    sessionKey={sessionKey}
    registration={registration}
    theme={theme}
    onChange={onChange}
    onSave={saveRevision}
    canSave={canSaveVersion}
  >
    <PageTools />
  </Editor>
);
```

Editor 不内置工具弹窗或工具标识。宿主在 Toolbar 插件或 `children` 中组合弹窗、抽屉及开关；本包导出 `SchemaEditor`、`GlobalVariablesEditor`，它们必须位于当前 Editor 的上下文内，普通 React Portal 保留上下文。表单通过受约束实例命令修改同一草稿并进入撤销历史，`onDone` 只表示确认完成，不创建 Revision。Revision 历史和 Apply 仍完全由 App 提供。

schema 表示一个 sessionKey 的初始投影，普通 Working 提交不重置引擎。历史恢复或 Agent 新提交由 App 开启新会话。代码编辑器读取传入主题，独立使用时可显式传 `theme`；Monaco workers 由 CodeEditor 在创建 model 前自动配置；Editor 内部使用 `?worker` 导入，由消费方构建工具（当前为 Vite）产出本地 worker，App 无需额外初始化。

`targetSelection` 是通用元素选择能力：宿主传入 `candidates`、可选的 `highlightedElementId` / `disabled` 和 `onSelect`。Editor 呈现候选编号、高亮与禁用反馈，不判断澄清是否过期或管理 Agent Run。App 将业务状态转换为该契约；只读时可通过 `readOnlyMessage` 传入具体原因，Editor 默认显示“当前不可编辑”。

FlowEditor 在进入逻辑模式时动态加载，失败可重试，加载过程不替换页面 Schema。`components/flow-editor/flow-editor-loader.tsx` 是引擎 Store 的唯一流程适配层；流程模块通过内部 `FlowEditorSession` 获取页面快照、物料、Manifest 与修改回调，所有修改仍进入同一编辑会话。

消费方在已有 Tailwind/UI 样式入口之后导入：

```css
@import '@origamix/editor/styles.css';
```

Editor 不导入任何物料家族。App 当前装配默认 Antd，FlowEditor 从同一注册 catalog 获取属性契约。物料三入口整理与专属属性编辑器启用仍属于后续阶段；`propertyEditors` 暂未激活。

## 提交与恢复

App 持有最后一次确认的 Working、当前本地候选及版本。flush 调用 `createEditorTransaction`，再通过现有 Server 管线提交。普通编辑使用非空 Operation Batch，仅无法安全表达的修改使用内部完整候选分支。一次事务不创建 Revision，也不写真实项目。

保存失败保留候选、展示错误并阻止切换；继续输入不会自动重放失败请求，用户可显式重试。每个项目/页面拥有独立提交队列，切换后旧响应不能修改新页面或触发新页面的提交回调。保存 Revision 和 Apply 始终属于 App 的显式业务动作。

插件通过受控实例执行节点编辑、查询和宿主明确配置的保存能力，不获取 HTTP、App Store、原始引擎或 Apply 权限。属性控件仍只修改选中节点的属性。Manifest 保持纯数据，Server 继续拥有最终校验权。

```sh
pnpm --filter @origamix/editor lint
pnpm --filter @origamix/editor typecheck
pnpm --filter @origamix/editor test
pnpm --filter @origamix/editor build
```

已有核心测试随实现迁入 `test/session`、`test/transactions` 和 `test/flow-editor`；App 会话测试继续验证保存失败和过期响应。维护要求见 [AGENTS.md](AGENTS.md)。

## HyperInput

流程节点的取值字段统一使用 Shared 的 HyperValue。HyperInput 提供字符串、数字、布尔值、空值、JSON、上下文、表达式和函数。函数弹窗支持参数绑定、代码编辑、确认、取消和校验；编辑过程不执行代码。请求参数、条件、属性与变量设置、方法参数、显隐和自定义 JS 共用该输入与 Runtime 求值器；元素 ID、事件和连线等结构字段继续使用选择器。节点契约版本随 Origamix 统一发布，旧 Schema 转换只由 Server 在页面打开时执行。

逻辑流表单使用 Shared 定义的值类型与字段方式：请求头、查询参数、请求体使用函数；条件判断使用表达式或函数，不提供 JSON 类型或额外比较器。节点属性、增删、连线及编排变化均提交完整图快照，通过 `onChange(schema, { immediate: true })` 通知宿主及时进入 Working 队列。函数弹窗确认后才提交配置，取消保留原值。

## 隔离原型表面

`CanvasPrototypeSurface` 是单独 frame 中的实验画布，复用本包的画布、Schema 操作和独立会话历史。宿主仅调用受限 `CanvasPrototypeHandle.run`，不取得底层会话。它不持有 Working 或 HTTP 权限，正式 Editor 的持久化继续由 App 协调。

`CanvasPrototypeSession` 接收 `initial`、离线 `frameDocument` 和 `onSnapshot`，拥有 allow-scripts-only iframe、MessageChannel、版本过滤及宿主拖放/属性面板。`mountCanvasPrototypeFrame(registration)` 在 iframe 文档中启动画布并校验受限命令；通信协议位于 `src/prototype/protocol.ts`，仅用于实验。`createCanvasPrototypeDocument(script, css)` 将调用方离线打包的 IIFE 与样式封装为带 CSP 的文档，Session 注入随机 nonce。Editor 不依赖 Materials 或 Vite；App 已移除实验路由、示例数据、具体物料装配及 Vite 打包插件。当前未提供可运行演示入口，调用方需自行装配物料、样式和离线 bundle。iframe 的 CSS 与 JS 环境独立，CSP 禁止联网；页面固定浅色，用于验证宿主主题隔离。该实验尚未接入 Working 队列，也未替换正式 Editor 或预览 iframe。

## 本地编辑内核

`schema/schema-utils.ts` 拥有元素增删移动、父子查询、属性和流程配置修改；Runtime 只接收渲染投影。`session/editor-store.ts` 在修改前校验候选并记录完整不可变 Schema 历史，覆盖属性、全局变量、流程、绑定和布局扩展；同字段连续输入在 600ms 内合并。撤销重做仍经过 onChange 和宿主 Working 队列，普通保存不清空历史。

`canvas/` 使用 dnd-kit 处理拖拽和占位；调用 `@origamix/runtime` 的 DesignRenderer 展示物料。设计态只允许设计交互，不绑定页面流程或执行函数。选中框和插入指示器只查询当前会话画布。

## 画布布局

[物料与画布布局方案](../materials/src/layout-properties.ts)记录默认占位、容器能力、实例尺寸、共享渲染和拖放规则。编辑器不再通过额外 inline-block 包装改变物料布局。

编辑器拖放、视图切换和流程更新失败通过共享 shadcn/ui Toast 展示，不占用画布布局。每个 EditorProvider 创建独立通知管理器，切换编辑会话时不会显示上一会话的通知；字段校验提示仍由对应属性控件管理。

## 插件

插件契约、四个现有插件、Toolbar 组合、保存、节点操作和通知见 [插件开发指南](PLUGINS.md)。Editor 提供统一会话能力，App 持有 Working/Revision/Apply 业务。物料 extend/getPanels 已接入，内置 antd.form 提供原子字段的表单属性扩展；material.render、区域整体替换和逻辑流扩展暂不开放。

History 插件当前提供工具栏入口，历史栈、600ms 合并和画布/逻辑流快捷键保留在共享会话中。这样完整 Schema 的撤销仍经过原 Working 管线；本轮不将历史存储迁入插件，不引入第二套历史。
