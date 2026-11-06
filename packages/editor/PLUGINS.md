# Editor 插件开发

统一入口为 `@origamix/editor`。插件用于工作台内可信代码的组合，不是远程插件安装或权限沙箱。

## 当前范围与归属

| 插件              | 归属   | 能力                                                                         |
| ----------------- | ------ | ---------------------------------------------------------------------------- |
| workspace.toolbar | App    | 标题、完整页面工具菜单及弹窗、Revision 历史、Apply、重新读取、返回对话、预览 |
| editor.mode       | Editor | 视图/逻辑模式切换，等待宿主 beforeModeChange                                 |
| editor.viewport   | Editor | PC/Mobile 和画布宽度工具，仅 view 模式展示                                   |
| editor.history    | Editor | 撤销/重做工具，仅 view 模式展示                                              |

History 的存储、600ms 合并与快捷键仍属于共享会话。逻辑流编辑继续共享页面历史，本轮不迁移其内核，也不开放 flow 插件 API。

物料 `material.extend/getPanels` 已接入，内置 antd.form 通过它们扩展字段物料。`material.render` 暂未执行；属性区与物料区的整体替换、逻辑流扩展仍未接入。画布不能整体替换。

## 装配与生命周期

```tsx
import {
  useCreateEditor,
  createEditorModePlugin,
  createViewportPlugin,
  createHistoryPlugin,
} from '@origamix/editor';

const editor = useCreateEditor({
  plugins: [createEditorModePlugin(), createViewportPlugin(), createHistoryPlugin()],
  beforeModeChange: () => workingSession.flush(),
});
```

宿主插件定义在实例创建时固定；修改宿主列表需要新实例。物料注册可携带 registration.plugins，Editor 将它们追加到宿主插件后，合并成一个会话级列表、交给同一个插件宿主；更换物料注册或其插件需要新的 sessionKey。ID 不可为空或重复，不提供依赖排序。`[A, B, C]` 按 C → B → A 初始化和组合，按 A → B → C 清理。宿主权限、名称与回调更新不会重跑 setup；动态渲染参数通过 `withProps` 更新，App 不再需要页面级 Context。

`setup({ editor, signal })` 可查询节点、注册监听并返回清理函数。文档修改、保存、模式切换在全部插件初始化完成后才可执行；setup 内提前调用会明确拒绝，避免本地修改被宿主的初始化过滤遗漏。需要编辑的行为应由初始化后的用户操作或明确命令发起。

每次画布绑定建立新的插件作用域。解绑或初始化失败会使 setup 接收的接口失效，并自动移除其订阅。分配资源后立即监听 signal 的 abort，保证 setup 中途抛错、无法返回清理函数时也能释放资源。清理异常不会阻止其他清理函数执行；已开始的外部异步工作仍需使用 signal/会话身份自行终止。

## 动态渲染参数

```tsx
// 定义保持稳定，放在组件外；每个 Editor 实例独立保存参数。
const toolbarPlugin = defineEditorPlugin<{ title: string }>({
  id: 'example.title',
  editor: {
    renderToolbar: ({ area, children, props }) =>
      area === 'start' ? <span>{props.title}</span> : children,
  },
});

// 在宿主组件内，每次渲染绑定最新值。
const editor = useCreateEditor({
  plugins: [toolbarPlugin.withProps({ title })],
});
```

withProps 只为 renderToolbar/renderTop/renderBottom 提供参数，不改变 setup 或物料配置。参数在提交阶段发布，各插件的渲染边界独立订阅；不会写入 Schema、替换物料注册或重新执行 setup。普通父组件渲染仍遵循 React 的更新规则。不要原地修改参数对象；传入新对象触发更新。绑定定义及顺序必须保持固定，更换定义需要新 Editor 实例。物料注册插件仍为会话级静态定义，不使用宿主 Hook 的动态绑定。

## Toolbar、顶部和底部

```tsx
import { defineEditorPlugin } from '@origamix/editor';

const plugin = defineEditorPlugin({
  id: 'example.toolbar',
  editor: {
    renderToolbar: ({ area, children }) => {
      if (area !== 'end') return children;
      return <div className='flex items-center gap-2'>{children}</div>;
    },
    renderTop: ({ children }) => children,
    renderBottom: ({ children }) => children,
  },
});
```

`renderToolbar` 接收 `{ area, editor, children, props }`，area 为 start/center/end/all。先分别组合三个局部区域，再将完整 Toolbar 传入 all。每一步都从右到左，children 是右侧插件已处理的内容：保留 children 表示保留，包装或追加 children 表示扩展，自定义内容表示替换，null 表示隐藏。

默认 start/center 为空，end 提供保存按钮。`EditorToolbar` 仅提供布局；`EditorToolbarArea` 只组合局部区域，不执行 all。替换整个工具栏时可继续复用其他插件的局部内容：

```tsx
<EditorToolbar>
  <EditorToolbarArea area='start' />
  <EditorToolbarArea area='center' />
  <EditorToolbarArea area='end' />
</EditorToolbar>
```

上述组件均从统一入口导出。`renderTop/renderBottom` 只扩展外围区域；它们与 Toolbar 都位于同一 Editor 上下文内。渲染回调中不能调用 Hook，应返回独立组件，再在组件中使用 `useEditorContext/useEditorSelector`。替换界面不会撤销操作权限或卸载其他插件的 setup。

## 保存边界

Editor 接收 `onSave`、可选 `onFlush` 和 `canSave`。使用 Editor 保存能力的按钮调用 `editor.save()`，可通过 `useEditorSelector` 读取 saving/canSave/saveError。未配置 onSave 时不可保存；保存权限独立于 readOnly。

save 先执行可选 onFlush，成功且会话仍有效时调用 onSave。重复调用会被拒绝，失败保留草稿。解绑后未完成的 flush 不会调用保存回调；已经开始的宿主保存不能撤销，宿主必须过滤自己的过期结果。

App 的 saveVersion 已包含 flush → 读取 Working version → 显式保存 Revision，不重复传入 onFlush。App 自定义工具栏的按钮和快捷键直接使用宿主 saveVersion，PageEditor 不透传 onSave/canSave。只有活动页面当前模式的 Toolbar 响应保存快捷键。Editor 不创建 Revision、不调用 HTTP、不执行 Apply。

## 节点查询和编辑

| 接口                                  | 语义                                  |
| ------------------------------------- | ------------------------------------- |
| getSchema                             | 冻结的页面快照                        |
| getElement/getMaterial                | 按 ID/类型查询；不存在返回 undefined  |
| getParent/getAncestors                | 父节点/最近父节点优先的祖先列表       |
| getSelectedElement                    | 当前选中节点，未选择返回 null         |
| insertElement                         | 合并物料默认属性，接受后返回新节点 ID |
| moveElement/removeElement             | 移动节点或删除子树                    |
| updateElementProps/removeElementProps | 合并属性或移除指定字段，保留其他属性  |
| selectElement                         | 选择节点；null 清空选择               |

节点返回 `{ id, type, props }`。Schema、节点和物料配置数据为冻结副本，React 组件/元素保留框架身份。查询和选择允许只读使用，文档修改拒绝只读、初始化中和解绑会话。

插入参数为 `{ materialType, props?, position }`，移动参数为 `{ elementId, position }`。位置统一使用 `{ parentId, index? }`、`{ beforeId }` 或 `{ afterId }`；移动 index 是移除自身后的最终索引，省略时追加。检查容器、dropTypes、索引、根节点和子树关系；根专用物料不能重复插入，Overlay 沿用根节点落点规则。

命令仍经过共享 setSchema 校验、历史和 onChange → App Working 队列。返回只表示本地接受，不代表 Server 已持久化；不会自动保存 Revision 或 Apply。Server 保留最终物料和业务校验权，提交失败由 App 保留本地草稿。

## 操作通知

```tsx
const observerPlugin = defineEditorPlugin({
  id: 'example.observe',
  schema: {
    elementInsert: (event, { editor, signal }) => {
      // 已接受的新增节点；可查询 editor，异步工作自行检查 signal。
    },
    elementRemove: (event) => {
      // event.element、event.subtree、event.previousPosition
    },
    elementMove: (event) => {
      // event.previousPosition、event.position
    },
    elementPropsChange: (event) => {
      // event.previousProps、event.props、event.fields
    },
    change: (event) => {
      // event.before、event.after、event.changes、event.transactionId
    },
  },
});
```

声明式 `schema` 通知由插件宿主按从右到左顺序自动订阅，在各插件 setup 之前注册，解绑或初始化失败时清理。动态订阅仍可使用 `editor.on`，两种方式复用同一份通知，不产生额外编辑或历史记录。通知回调的第二个参数为会话作用域的 `{ editor, signal }`。

| 通知               | 数据                                                |
| ------------------ | --------------------------------------------------- |
| elementInsert      | 新节点、materialType、最终 position                 |
| elementMove        | elementId、previousPosition、position               |
| elementRemove      | 被删根节点、原位置、子树及绑定/流程/布局扩展快照    |
| elementPropsChange | elementId、前后 props、变更字段                     |
| selectionChange    | 前后 elementId；删除选中节点时也通知                |
| change             | 一次事务的 before/after、changes、可选 historyGroup |

同次文档事务共享 transactionId/source：先发节点通知，再发自动选择变化，最后发一次 change。独立选择有自己的事务 ID。来源为 drag/canvas/panel/plugin/history/external。拒绝或无变化操作不发文档通知；兄弟节点因插入/删除而改变索引不算移动。完整导入、历史恢复的移动摘要根据快照推导；类型、流程、全局变量等完整变化从 change 快照读取。

订阅按注册顺序执行，setup 中的插件监听因此遵循从右到左顺序。返回取消订阅函数可提前释放；解绑和初始化失败也自动清理。监听器故障只输出固定提示，不记录页面内容、不回滚已接受草稿、不阻断其他监听。同步通知期间禁止嵌套文档修改或选择修改。

## 提交前 Schema 转换

`schema.beforeChange({ before, candidate, source })` 在普通编辑进入历史与宿主回调之前执行。输入是冻结快照；返回完整新候选，返回 undefined 则保留本轮候选，抛错则拒绝整次修改。插件按从右到左顺序单轮转换，后续插件读取前一个插件的候选，before 始终是修改前快照。所有转换完成后统一执行结构、宿主及物料类型校验。

```tsx
const plugin = defineEditorPlugin({
  id: 'example.structure',
  schema: {
    beforeChange: ({ candidate }) => {
      // 使用不可变对象组合计算区域结构；此例保持候选不变。
      return candidate;
    },
  },
});
```

转换必须同步，不能返回 Promise，不能在其中调用 Editor 文档修改、选择、撤销或重做命令。一次转换后的结果只形成一次完整编辑和通知；最终无变化则不生成历史或通知。失败不改变草稿、选择或撤销/重做栈。普通历史合并规则继续适用。

加载初始 Schema、环境更新不执行转换。undo/redo 直接恢复已接受的完整快照，不再次调用 beforeChange；后置通知仍以 history 来源发布。解绑后转换失效。beforeChange 不负责确认弹窗、HTTP、Revision 或 Apply，也不会在 Server/Agent 中执行；领域规则若需要覆盖 Agent，必须在相应平台中复用纯数据逻辑并独立校验。

## 物料属性插件

`material.extend({ material, manifest })` 在会话物料装配时补充默认属性和面板配置；`getPanels({ editor, material, manifest, elementId, element, ancestors, panels })` 根据当前节点上下文返回面板列表。ancestors 按最近父节点优先排列。两者均按 C → B → A 组合，输入为只读快照。

extend 的 panels 追加到已有面板，不能覆盖右侧插件的贡献；有 ID 的面板不允许重复。getPanels 接收已有 panels，保留它表示保留，返回新列表可以增加或隐藏上下文面板。所有配置字段必须在已安装 Manifest 中声明；新增默认值必须与 Manifest.defaultProps 一致，否则拒绝装配。静态定义仍由物料构建生成，插件不能临时改变 Server 协议。

内置 `antd.form` 由 Materials 的 `/antd/editor` 入口导出 createAntdFormPlugin 和 editorPlugins，App 物料加载器通过 registration.plugins 注入。原子组件只声明 formField: true；Manifest 构建组合公共 Form 字段定义，插件 extend 增加表单项面板，getPanels 在存在 Form 祖先时展示该面板。字段移出 Form 后配置保留且不显示面板，不把此匹配逻辑硬编码进 Editor。

本次未执行 material.render；设计态 Form.Item 与运行时值绑定继续复用 Materials 的现有公共边界，不重复包装。预览/生成项目只加载运行时入口，不加载 Editor 插件宿主。新增持久化字段仍须先参与版本化 Manifest 构建，供 Editor、Agent、Server 一致使用。
