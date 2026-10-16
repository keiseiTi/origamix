# Editor

阶段 1 提供编辑器公开类型契约。当前画布和 FlowEditor 实现仍位于 App；本包尚未导出编辑器组件，也未接管现有保存会话。

| 已有入口                      | 内容                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `@origamix/editor/contracts`  | 编辑模式、工具、历史、命令句柄、页面作用域、Working 投影、编辑事务、物料注册 |
| `@origamix/editor/extensions` | 专属属性编辑器输入、原子属性修改、字段编辑器注册                             |

使用 `import type` 引用。这些接口是工作台内部边界，不是 HTTP 协议；Server 接收边界继续使用 Shared 的运行时校验。包暂为 private，不承诺外部发布兼容性。

## 编辑与持久化

`EditorTransaction` 携带 project/page 作用域和 baseWorkingVersion。普通修改提交非空 Operation Batch；仅协议无法安全表达的修改允许内部 candidate 分支。App 的提交适配器调用现有 Server 管线，并返回带原作用域的新 Working 状态。Editor 必须拒绝过期结果；失败保留草稿。`flush` 在持久化失败时拒绝，阻止切页、切视图和预览。保存 Revision 和 Apply 均由 App 的显式动作负责。

`EditorMaterialRegistration` 由 App 装配：纯数据 catalog、Tangramino 物料分组、字段属性编辑器。分组暂沿用引擎公开 Material 类型，不暴露引擎实例。装配时必须核对 catalog 的物料身份、版本及类型；该类型声明本身不执行校验。

属性编辑器拿到 scope、elementId、field、value、只读状态和校验信息。`onCommit` 一次提交多个属性的 set/unset；同一字段不可同时 set/unset，空修改不产生事务。Editor 适配器负责目标绑定、只读与陈旧状态检查，并转为统一事务。回调成功表示接受到编辑事务，持久化完成以 `flush` 为准。局部表单草稿属于属性编辑器。

宿主能力目前没有实际消费者，因此不预设上传、目录选择等 SDK。未来需要时增加命名、最小能力接口；项目操作不通过本包暴露。

完整依赖方向及迁移清单见 [架构边界](../architecture.md)，维护要求见 [AGENTS.md](AGENTS.md)。

```sh
pnpm --filter @origamix/editor lint
pnpm --filter @origamix/editor typecheck
pnpm --filter @origamix/editor build
```
