# Shared

平台无关的协议包，只提供类型、运行时 Schema 和纯校验，不启动服务，也不持有文件、网络、环境或 UI 状态。

## 唯一公开入口

```ts
import { validatePage, type OrigamixPageSchema } from '@origamix/shared';
```

| 内部模块                                      | 用途                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `protocol/api`                                | HTTP 请求、结果及项目记录                        |
| `protocol/flow-node`                          | 逻辑节点 Manifest、属性 Schema 与连接约束        |
| `protocol/material-manifest`                  | 物料 Manifest 通用类型与格式版本；具体定义归物料 |
| `protocol/schema`                             | 页面数据与 Schema Operation                      |
| `protocol/validation`                         | 结构和图引用语义校验                             |
| `protocol/project-manifest`                   | 项目及页面 Manifest 格式                         |
| `protocol/agent`、`protocol/agent-validation` | Agent 协议与校验                                 |
| `desktop-api`                                 | 宿主命名能力契约                                 |
| `page-window`                                 | 预览输入与诊断契约                               |
| `credential-gateway`                          | 凭据网关消息校验                                 |

统一从 `@origamix/shared` 导入。`src/index.ts` 显式列举公共值与类型导出；上表中的模块路径只描述内部职责，不是公开子路径。测试和新增内部文件不会自动变成公共 API。工作区解析源码，发布包解析 `dist` 的 ESM 和类型声明。Ajv 实例和各个校验器在首次调用对应校验函数时初始化并缓存，导入根入口不会编译校验器。内部模块之间直接引用，不反向引用根入口。类型断言不能替代接收边界上的校验；Schema 结构、引用关系与 Server 的物料兼容性分别验证不同约束。

`protocol/project-stack` 提供版本化技术栈契约与解析。当前组合固定为 React + Antd，物料集为 `official-antd@1.0.0`，匹配 Runtime 与模板均为 `1.0.0`。`materialSet` 为必填字段，缺失或不支持的配置均拒绝，不补全、不回退。具体物料内容和模块加载不在 Shared 中。

## 验证与构建

从仓库根目录执行：

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

`pnpm package:npm` 可与其他发布包一同构建打包。修改协议后必须检查生产者和消费者，根验证命令见 [根 README](../../README.md)。维护约束见 [AGENTS.md](AGENTS.md)。

## 最小页面与编辑请求

下面是包含一个根容器的页面 Schema；这里的 `basicPage` 来自 Ant Design 物料清单，Shared 自身不验证某个物料是否存在。

```json
{
  "elements": { "element_root": { "type": "basicPage", "props": {} } },
  "layout": { "root": "element_root", "structure": { "element_root": [] } },
  "flows": {},
  "bindElements": [],
  "context": { "globalVariables": [] },
  "extensions": { "origamix": { "schemaVersion": "1.0" } }
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

ID 和版本需来自当前页面读取结果。该 HTTP 请求使用 `ApplyWorkingOperationsSchema`；Agent 的 `SchemaOperationBatch` 还包含 `version`、`source`、`clientRequestId`、`createdAt` 等字段，经终态工具提交。两者不能混用，完整字段见 [schema.ts](src/protocol/schema.ts) 和 [api.ts](src/protocol/api.ts)。

Working 的 `workingVersion` 用于并发校验，`workingHash` 表示草稿内容，`revisionId` 指向当前保存检查点；Working 可以在同一 Revision 下继续变化。Revision 是不可变快照，不会因普通编辑产生。Apply 还需 `expectedRevisionId`、`expectedWorkingVersion` 和稳定的 `clientRequestId`。

Shared 校验结构、根节点和布局引用/循环；Server 另行验证物料属性、授权、页面归属和当前 Working 版本。通过 Shared 校验不代表请求具备写入权限或一定能应用。

## 逻辑节点 Manifest

`@origamix/shared` 导出 `flowNodeManifests`、带版本的 `flowNodeManifestCatalog`、`getFlowNodeManifest(type)`、`FlowNodeManifest` / `FlowNodeType`，以及显式数据引用的 `FlowValueReferenceSchema` / `FlowValueReference`。

`FlowNodeProps<T>` 从节点属性 Schema 派生参数类型；`RuntimeFlowNodeType` 排除由引擎处理的 `start`，供 Runtime 完整声明实现表。`isFlowNodeProps(type, data)` 校验节点参数并提供类型收窄，只验证结构，不替代页面归属、物料能力或请求授权检查。

目录包含开始、接口请求、自定义 JS、设置元素属性、触发元素方法、显隐元素、条件判断、设置全局变量、打开和关闭弹窗抽屉。每个节点声明 `type`、中文 `title`、`description`、`executable`、`defaultProps`、`propsSchema`、连接规则和使用约束；有返回值的可执行节点同时声明 `returnsSchema`。

```ts
import { getFlowNodeManifest } from '@origamix/shared';

const requestNode = getFlowNodeManifest('interfaceRequest');
// 消费方通过自己的接收边界校验 requestNode.propsSchema。
// 编辑器创建草稿时克隆 defaultProps，避免修改公共目录对象。
```

`defaultProps` 是编辑器的初始草稿，可能包含空 URL、空目标 ID 或空属性名；它不是已配置完成的示例。`propsSchema` 描述规范字段和基础类型；元素是否存在、属性/方法是否由物料公开、变量是否声明、分支和连线是否一致、是否存在循环等，需要消费方结合当前页面做语义校验。属性 Schema 接受通用 JSON 数据的字段仍需消费方执行既有安全检查，不能用 TypeScript 类型断言替代验证。

值引用使用 `{ $ref: 'global' | 'result', name, path? }`。`name` 是变量名或返回值来源节点 ID，`path` 是点分隔的数据路径；引用解析整个字段值，不递归求值嵌套 JSON，也不执行字符串表达式。自定义 JS 的 `executable` 为 `false`，仅保存代码配置。

本模块不包含 React、LogicFlow、表单控件或执行函数。Editor 与 Runtime 使用当前节点契约，不转换旧节点格式。Server 的物料与写入校验仍由对应服务负责。
