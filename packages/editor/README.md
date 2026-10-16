# Editor

页面编辑实现包，包含可视化编辑器和 FlowEditor。App 负责项目装配、Working 会话、HTTP、Agent、Revision 与 Apply；本包只负责编辑体验、引擎适配和编辑数据转换。

| 公开入口                      | 内容                                                |
| ----------------------------- | --------------------------------------------------- |
| `@origamix/editor/visual`     | `Editor`、`EditorProps`；统一画布和逻辑编辑上下文   |
| `@origamix/editor/flow`       | 共享引擎上下文内使用的 `FlowEditor`                 |
| `@origamix/editor/flow/model` | 图数据与声明式 Flow 的转换                          |
| `@origamix/editor/components` | `CodeEditor`、`JsonAttributeField`                  |
| `@origamix/editor/core`       | `deriveSchemaOperations`、`createEditorTransaction` |
| `@origamix/editor/contracts`  | 模式、主题、句柄、页面作用域、事务及物料注册类型    |
| `@origamix/editor/extensions` | 属性编辑器和结构化字段契约                          |
| `@origamix/editor/styles.css` | Tailwind 源码扫描入口                               |

这是私有工作区包，声明出口指向源码以支持 HMR；构建生成 ESM 与类型声明供集成验证。

## 宿主装配

App 提供初始 schema、稳定的 sessionKey、当前物料 catalog/groups、主题和编辑回调。Editor 内保留一个 EditorProvider，两种视图共享 Schema、选中元素与编辑历史。宿主通过句柄调用 flush/undo/redo；切页、切换编辑视图与预览前必须等待 flush 成功。底层引擎状态按模块共享，因此 App 只挂载当前活动编辑页的画布；切换前提交，返回后重新读取 Working。在对话、预览和非活动页面中只保留宿主协调，不挂载画布及其 portal。

schema 表示一个 sessionKey 的初始投影，普通 Working 提交不重置引擎。历史恢复或 Agent 新提交由 App 开启新会话。代码编辑器读取传入主题，独立使用时可显式传 `theme`；Monaco workers 由 App 的构建宿主配置，Editor 内不包含 Vite 专有 worker 导入。

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

已有核心测试随实现迁入 `test/core` 和 `test/flow`；App 会话测试继续验证保存失败和过期响应。架构见 [架构边界](../architecture.md)，维护要求见 [AGENTS.md](AGENTS.md)。
