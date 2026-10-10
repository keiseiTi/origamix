# Shared

平台无关的协议包，只提供类型、运行时 Schema 和纯校验，不启动服务，也不持有文件、网络、环境或 UI 状态。

## 公开子路径

| `@origamix/shared/` 后缀                      | 用途                        |
| --------------------------------------------- | --------------------------- |
| `protocol/api`                                | HTTP 请求、结果及项目记录   |
| `protocol/schema`                             | 页面数据与 Schema Operation |
| `protocol/validation`                         | 结构和图引用语义校验        |
| `protocol/project-manifest`                   | 项目及页面 Manifest 格式    |
| `protocol/agent`、`protocol/agent-validation` | Agent 协议与校验            |
| `desktop-api`                                 | 宿主命名能力契约            |
| `page-window`                                 | 预览输入与诊断契约          |
| `credential-gateway`                          | 凭据网关消息校验            |

出口显式列举，测试和新增内部文件不会自动变成公共 API。工作区解析源码，发布包解析 `dist` 的 ESM 和类型声明。类型断言不能替代接收边界上的校验；Schema 结构、引用关系与 Server 的物料兼容性分别验证不同约束。

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
