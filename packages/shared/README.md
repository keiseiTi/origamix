# Shared

平台无关的协议包，只提供类型、运行时 Schema 和纯校验，不启动服务，也不持有文件、网络、环境或 UI 状态。

## 唯一公开入口

```ts
import { validatePage, type OrigamixPageSchema } from '@origamix/shared';
```

| 内部目录                     | 用途                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| [page/](src/page/)           | 页面 Schema、编辑操作、Working / Revision / Apply HTTP 契约与校验 |
| [project/](src/project/)     | 项目清单、技术栈、项目 HTTP 契约与版本升级                        |
| [flow/](src/flow/)           | 流程图、节点 Manifest、HyperValue 与图安全校验                    |
| [agent/](src/agent/)         | Run、消息、事件、请求、终态结果、诊断与评估                       |
| [material/](src/material/)   | 物料 Manifest 通用契约                                            |
| [transport/](src/transport/) | HTTP 结果封套、桌面桥、凭据网关与预览消息                         |
| [version.ts](src/version.ts) | 统一发布版本与支持序列                                            |

统一从 `@origamix/shared` 导入。`src/index.ts` 显式列举公共值与类型导出；上表中的模块路径只描述内部职责，不是公开子路径。测试按领域放在 `test/`，文件名与被验证模块对应；内部新增文件不会自动变成公共 API。工作区解析源码，发布包解析 `dist` 的 ESM 和类型声明。Ajv 实例和各个校验器在首次调用对应校验函数时初始化并缓存，导入根入口不会编译校验器。内部模块之间直接引用，不反向引用根入口。类型断言不能替代接收边界上的校验；Schema 结构、引用关系与 Server 的物料兼容性分别验证不同约束。

`project/project-stack.ts` 提供版本化技术栈契约与解析。当前组合固定为 React + Antd，物料集为 `official-antd@1.0.0`，匹配 Runtime 与模板均为 `1.0.0`。`materialSet` 为必填字段，缺失或不支持的配置均拒绝，不补全、不回退。具体物料内容和模块加载不在 Shared 中。

## 验证与构建

从仓库根目录执行：

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

`pnpm pack:npm` 可与其他发布包一同构建打包。修改协议后必须检查生产者和消费者，根验证命令见 [根 README](../../README.md)。维护约束见 [AGENTS.md](AGENTS.md)。

## 最小页面与编辑请求

下面是包含一个根容器的页面 Schema；这里的 `basicPage` 来自 Ant Design 物料清单，Shared 自身不验证某个物料是否存在。

```json
{
  "elements": { "element_root": { "type": "basicPage", "props": {} } },
  "layout": { "root": "element_root", "structure": { "element_root": [] } },
  "flows": {},
  "bindElements": [],
  "context": { "globalVariables": [] },
  "extensions": { "origamix": { "schemaVersion": "1.0.0" } }
}
```

视觉编辑的 `/api/v1/pages/working-operations/apply` 请求体示例：

```json
{
  "projectId": "project_example",
  "pageId": "page_example",
  "baseWorkingVersion": 1,
  "operations": [
    { "operation": "updateElementProps", "elementId": "element_root", "set": { "padding": 16 } }
  ]
}
```

ID 和版本需来自当前页面读取结果。该 HTTP 请求使用 `ApplyWorkingOperationsSchema`；Agent 的 `SchemaOperationBatch` 还包含 `version`、`source`、`clientRequestId`、`createdAt` 等字段，经终态工具提交。两者不能混用，完整字段见 [schema-operation.ts](src/page/schema-operation.ts) 和 [page-api.ts](src/page/page-api.ts)。

Working 的 `workingVersion` 用于并发校验，`workingHash` 表示草稿内容，`revisionId` 指向当前保存检查点；Working 可以在同一 Revision 下继续变化。Revision 是不可变快照，不会因普通编辑产生。Apply 还需 `expectedRevisionId`、`expectedWorkingVersion` 和稳定的 `clientRequestId`。

Shared 校验结构、根节点、布局引用/循环，以及流程的开始节点、节点身份、双向连线一致性、循环、条件分支和事件绑定唯一性。Server 另行验证物料属性、授权、页面归属和当前 Working 版本。通过 Shared 校验不代表请求具备写入权限或一定能应用。

`PageFlowSchema` / `PageFlow`、`PageFlowNodeSchema` / `PageFlowNode` 和 `ElementEventBindingSchema` / `ElementEventBinding` 定义当前引擎使用的流程与事件绑定格式；节点参数仍由唯一的逻辑节点 Manifest 定义。流程和节点 ID 不接受空字符串或保留对象键。当前格式校验不会迁移、补全或重写已有无效数据。

局部事件绑定操作按 `elementId + event` 定位：`setElementEventBinding` 携带 `flowId`，新增或原位替换该事件的绑定；`removeElementEventBinding` 只解除该事件，重复解除安全。它们保留其他绑定和流程；流程删除仍须显式使用 `removeFlow`。`setElementBindings` 保留整表替换语义。

## 逻辑节点 Manifest

`@origamix/shared` 导出 `flowNodeManifests`、带版本的 `flowNodeManifestCatalog`、`getFlowNodeManifest(type)`、`FlowNodeManifest` / `FlowNodeType`，以及显式数据引用的 `HyperValueSchema` / `HyperValue` / `FunctionValueSchema` / `FunctionValue`。

`FlowNodeProps<T>` 从节点属性 Schema 派生参数类型；`RuntimeFlowNodeType` 排除由引擎处理的 `start`，供 Runtime 完整声明实现表。`isFlowNodeProps(type, data)` 校验节点参数并提供类型收窄，只验证结构，不替代页面归属、物料能力或请求授权检查。

目录包含开始、接口请求、自定义 JS、设置元素属性、触发元素方法、显隐元素、条件判断、设置全局变量、打开和关闭弹窗抽屉。每个节点声明 `type`、中文 `title`、`description`、`executable`、`defaultProps`、`propsSchema`、连接规则和使用约束；有返回值的可执行节点同时声明 `returnsSchema`。

```ts
import { getFlowNodeManifest } from '@origamix/shared';

const requestNode = getFlowNodeManifest('interfaceRequest');
// 消费方通过自己的接收边界校验 requestNode.propsSchema。
// 编辑器创建草稿时克隆 defaultProps，避免修改公共目录对象。
```

`defaultProps` 是编辑器的初始草稿，可能包含空 URL、空目标 ID 或空属性名；它不是已配置完成的示例。`propsSchema` 描述规范字段和基础类型；元素是否存在、属性/方法是否由物料公开、变量是否声明、分支和连线是否一致、是否存在循环等，需要消费方结合当前页面做语义校验。属性 Schema 接受通用 JSON 数据的字段仍需消费方执行既有安全检查，不能用 TypeScript 类型断言替代验证。

节点契约随 Origamix 统一发布，取值字段统一使用 `{ type, value }` HyperValue，支持 string、number、boolean、null、contextValue、expression 和 function。上下文路径为 `state.elementId.property`、`event.payload.path`、`global.name`、`result.nodeId.path`，函数参数还可绑定 `method.elementId.methodName`。函数值包含 `{ params: [{ name, value: contextPath }], body }`。Shared 只校验配置，由 Runtime 执行表达式、函数和自定义 JS，不提供原始值或 `$ref` 格式转换。

本模块不包含 React、LogicFlow、表单控件或执行函数。Editor 与 Runtime 使用当前节点契约，不转换旧节点格式。Server 的物料与写入校验仍由对应服务负责。

物料 Manifest.context.variables 只声明可读业务属性，writable 独立声明可写运行状态；values 中 isMethod=true 的项是可调用方法，methods 是可绑定事件。设计期 propsSchema 不自动授予运行时读写能力。可读项可声明精确嵌套路径，例如 pagination.current；事件的 linkageShow 是纯数据显隐元数据。

## 统一版本

`ORIGAMIX_VERSION` 是当前发布契约，`ORIGAMIX_RELEASES` 是明确支持的发布序列。所有自有包统一发布。项目清单只保存 `version` 与 `materialSet` ID，物料、Runtime 和模板的解析版本由当前发布派生。Schema 的 `extensions.origamix.schemaVersion` 记录该份数据的来源版本，当前校验器只接受当前版本；旧数据迁移由 Server 负责。
