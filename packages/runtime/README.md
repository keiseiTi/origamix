# Runtime

独立页面渲染适配器，App 预览和生成项目共用。不绑定物料库，不包含工作台路由、编辑器、后端传输或持久化。

## 接口

```tsx
import { OrigamixPage } from '@origamix/runtime';

<OrigamixPage schema={schema} materials={materials} resetKey={revisionId} />;
```

调用者提供 Schema 和物料注册表。Runtime 负责本地运行会话 与按元素订阅的 React 渲染装配、未知物料检测和渲染错误捕获；可选 `onOutcome` 返回诊断，`renderError` 允许调用者提供重试界面。`resetKey` 变化会重建页面会话并恢复错误边界。

该根入口也导出 `DesignRenderer`、`MaterialRegistry`、`RuntimeMaterialProps`、`RuntimeDiagnostic`、`RuntimeOutcome` 和 `findUnknownMaterialTypes`。UI 风格、诊断上传及页面刷新属于调用方；生成项目无需依赖 App、Shared 或 Server。

## 事件逻辑

[logic-nodes.ts](logic-nodes.ts) 注册 `interfaceRequest`、`setElementProps`、`emitElementAction`、`visibleElement`、`condition`、`setGlobalVariable`、`openModalDrawer` 和 `closeModalDrawer`。属性、变量和方法节点使用 `setters` 数组，显隐节点使用 `elementIds`；弹窗操作只接受 `modal` / `drawer` 元素。

节点名称和参数类型由 Shared 的 `protocol/flow-node` 契约派生，实现表必须覆盖除引擎自带 `start` 外的所有节点。引擎传入的参数先按同一契约校验，失败会抛出错误并阻止该节点动作。`customJS` 通过统一求值器执行函数。Shared 作为构建依赖内联到发布产物，独立项目无需额外安装 Shared。

取值字段统一使用 Shared 的 `HyperValue`：`{ type, value }`。字面值类型为 `string`、`number`、`boolean` 和 `null`；`contextValue` 读取 `state.elementId.property`、`event.payload.path`、`global.name` 或 `result.nodeId.path`。函数参数也可绑定 `method.elementId.methodName`。上下文读取拒绝原型链路径。

[execute.ts](execute.ts) 为所有节点统一求值：`expression` 执行表达式；`function` 根据 `{ params: [{ name, value: contextPath }], body }` 按顺序绑定参数并执行函数体，等待 Promise 返回值。`customJS` 的 `value` 使用函数类型。方法节点将求值结果作为单个参数传入，数组不展开。请求节点仍返回 `{ ok, status, data, error }`，仅接受 HTTP(S) URL，不隐式携带凭据。脚本失败显示执行错误、停止本次事件后续动作，下一次触发可重新执行。

项目 JavaScript 在页面环境中执行，求值器本身不是沙箱。工作台预览继续使用既有的 sandbox iframe，不接收后端凭据或 Desktop bridge；生成页面在自身宿主环境中运行。Editor 和 Server 不执行项目代码。节点契约 1.0 不接受原来的原始值和 `$ref` 格式。

## 验证与构建

在仓库根目录：

```sh
pnpm --filter @origamix/runtime lint
pnpm --filter @origamix/runtime typecheck
pnpm --filter @origamix/runtime test
pnpm --filter @origamix/runtime build
```

构建输出 ESM 和声明到 `dist/`，React 是 peer dependency。影响生成项目的变更还需 Server `test:template`。维护约束见 [AGENTS.md](AGENTS.md)。

## 完整渲染示例

在使用 Ant Design 物料的 React 项目中，页面入口可以写为：

```tsx
import { OrigamixPage } from '@origamix/runtime';
import materials from '@origamix/materials/antd/runtime';
import schema from './schema.json';

const Page = (): React.JSX.Element => (
  <OrigamixPage
    schema={schema}
    materials={materials}
    resetKey={JSON.stringify(schema)}
    renderError={(_error, retry) => (
      <main role='alert'>
        页面渲染失败。<button onClick={retry}>重试</button>
      </main>
    )}
  />
);

export default Page;
```

调用项目需要直接声明 Runtime、Materials 及其 peer dependencies，并启用 TypeScript JSON 导入；Schema 示例见 [Shared README](../shared/README.md)。样式由调用者导入，生成项目的 [index.css](../template/src/index.css) 包含 Tailwind 与 HeroUI 样式入口，Runtime 不会注入工作台主题。

`onOutcome` 可以接收 `UNKNOWN_MATERIAL` 或 `RENDER_ERROR` 诊断。未知物料由 Runtime 显示提示；`renderError` 自定义的是渲染异常界面，不替换未知物料提示。`resetKey` 变化或点击重试可重置错误边界，但仍需先修正造成错误的 Schema/组件。成功诊断不证明所有交互、样式或服务端校验已通过。

请求头、查询参数和请求体通过函数返回值配置；条件节点直接按表达式或函数结果判断真假，不维护额外比较操作符。请求保留 10 秒超时与无宿主凭据的执行约束。

## 物料能力与业务状态

物料运行注册表携带 origamixRuntime：可序列化 Manifest.context 能力、默认值、初始业务值与事件投影函数。没有把 Server 或 Editor 引入 Runtime。installMaterialState 在当前 Engine 关联暂态读值投影与窄的组件回调；投影随 Engine 释放。它不是另一个 Working Schema。

用户输入先发布到读值投影，再触发事件；setElementProps 对 context.writable 校验后更新投影与目标元素。state 引用只允许 context.variables 的业务路径，method 只允许公开可调用方法。事件参数在 start 捕获为本次调用的独立快照，异步事件不共享一个可变载荷。

React 按元素订阅不可变的 Engine 节点，更新输出文本不会重建正在输入的其他控件。Form 的字段绑定在物料适配器处理；程序写入与字段方法同时维护字段值及整表读值。新增回归见 test/logic-nodes.test.ts，覆盖异步事件隔离、白名单与源 Schema 不变；界面焦点和原生控件转换仍需实际交互验收。

## 编辑态与运行态

`@origamix/runtime` 是唯一公开入口。工作区消费根源码以支持 HMR，发布包消费 dist/index.js 与内联后的声明；生成项目无需安装 Shared 或 Editor。

`OrigamixPage` 创建运行状态、变量、事件和异步流程会话。卸载或更换会话时中止请求，并阻止旧调用的后续状态写入。`DesignRenderer` 只解析布局并调用物料，复用稳定的 MaterialView；不创建执行引擎、绑定业务事件、执行 init/表达式/函数，也不注入运行写值和方法注册回调。Editor 通过 renderElement 提供选择、拖拽、容器占位与覆盖层。

物料收到 `om_mode: 'design' | 'render'`，设计占位通过 om_dropPlaceholder 提供；运行态通过 om_setRuntimeState、om_setContextValues 上报业务状态和注册方法。内置物料在设计态允许 Tabs 等必要设计交互，但跳过运行生命周期；自定义组件也必须遵守此约定。

既有页面源码使用旧 `@origamix/runtime/react` 导入时，需要显式改成根入口；Origamix 不自动改写用户已有页面源码。新生成页面直接使用根入口。Schema 数据格式保持兼容。

部分状态、布局和流程算法参考 Tangramino，来源及许可见 [NOTICE](NOTICE)；运行包不依赖该项目。
