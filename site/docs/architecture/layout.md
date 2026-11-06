---
title: Layout 契约与接口
description: 项目唯一布局的 Schema 复用、Working/Revision/Apply 所有权及 Agent 接口。
---

# Layout 契约与接口

项目只有一份布局，名称固定为「布局配置」。唯一开关是项目清单的 `layout.enabled`，作用于全部页面。没有布局列表、默认布局选择或页面关联表。

## 复用 Schema JSON

布局文档在现有 PageSchema 外增加布局版本和项目归属，内部节点定义、父子结构和编辑操作沿用页面协议：

```ts
import { createAntdLayoutSchema } from '@origamix/materials/antd/layout/manifest';

const document = {
  schemaVersion: '1.0.0',
  projectId: 'project_example',
  schema: createAntdLayoutSchema({ brand: '我的应用', variant: 'top-side' }),
};
```

Antd 布局入口和页面入口分开。布局根是唯一 `Layout`；内部 Header、Sider、Content、Footer 及主体使用受管理 `LayoutRegion` 节点，内容区包含唯一 `PageOutlet`。普通区域内容仍是可编辑的 container、text、button。区域 ID 由根 ID 稳定派生，关闭时保留节点和内容。

`reconcileAntdLayoutSchema` 是 Materials 所有的纯数据转换器：Editor 的 `antd.layout` 插件通过 `schema.beforeChange` 调用，LayoutService 在原有版本校验与原子写入链路内调用同一函数。Server 仍独立验证最终节点、物料属性和内容区约束，不执行 Editor 插件。完整文档初始化在 Server；普通读取不转换旧草稿。

Agent 读取当前 Layout 根 ID，仅通过根属性管理区域，不更换根或 PageOutlet、不直接新增/修改/删除/移动 LayoutRegion。布局 prompt 版本为 5，工具协议仍为 3。派生后的完整文档参与 Working hash、预算检查和受检恢复回执；请求身份和操作摘要仍绑定原始输入，重试不会重复写入。

`elements` 保存节点，`layout.root/structure` 保存根与父子关系。布局额外要求唯一、可达且无子节点的 `PageOutlet`；首期 `flows`、`bindElements` 和全局变量为空。页面和布局在运行时通过 Outlet 组合，不合并节点表，布局不创建业务执行引擎。

`LayoutService` 拥有 `.origamix/layout/` 下的 Working、不可变 Revision 与恢复证据。手动编辑和 Agent 都走版本校验、最终验证与原子 Working 写入。显式 Apply 通过 `ProjectApplyService` 和既有 `TargetSchemaStore` 写入 `src/origamix-layout/schema.json`。开关属于项目清单，不属于布局 Revision。

## 配置、草稿、版本与应用接口

下表路径均以 `/api/v1` 为前缀，使用 POST 和现有认证边界。所有请求都有 `projectId`，布局请求不使用 pageId。

| 路径                         | 其他请求字段                                                      | 行为                                      |
| ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| `/layout/config/get`         | 无                                                                | 读取项目开关和固定名称                    |
| `/layout/config/update`      | `enabled`                                                         | 更新项目清单；关闭时保留草稿和历史        |
| `/layout/working/get`        | 无                                                                | 读取启用布局的 Working                    |
| `/layout/working/operations` | `baseWorkingVersion`、`clientRequestId`、`operations`             | 提交复用页面协议的操作批次                |
| `/layout/working/update`     | `baseWorkingVersion`、`clientRequestId`、`schema`                 | 编辑器内部的完整候选回退；不是 Agent 工具 |
| `/layout/revisions/save`     | `expectedWorkingVersion`                                          | 显式保存不可变版本                        |
| `/layout/revisions/list`     | 无                                                                | 列出布局版本                              |
| `/layout/revisions/get`      | `revisionId`                                                      | 查看版本文档                              |
| `/layout/revisions/restore`  | `revisionId`、`expectedWorkingVersion`                            | 恢复 Working，不保存或应用                |
| `/layout/apply-state/get`    | 无                                                                | 读取草稿、已保存、目标变化或待恢复状态    |
| `/layout/apply`              | `expectedRevisionId`、`expectedWorkingVersion`、`clientRequestId` | 只应用当前干净且已显式保存的版本          |

普通编辑不创建 Revision。过期版本和非法批次保留原 Working。Apply 的相同请求身份返回同一结果；未确认的 Apply 会阻止后续布局内容修改，直到显式恢复。外部目标变化会被拒绝覆盖。

## Agent 目标与接口

页面与布局共用 PageSession、会话服务、Run 执行器、预算、取消和恢复。布局请求明确绑定项目目标，例如：

```json
{
  "version": "1",
  "projectId": "project_example",
  "target": { "kind": "layout", "projectId": "project_example" },
  "clientRequestId": "request-example",
  "baseWorkingVersion": 1,
  "content": {
    "version": "1",
    "blocks": [{ "type": "text", "text": "创建顶部导航布局" }]
  }
}
```

| POST 路径                          | 请求范围                                            |
| ---------------------------------- | --------------------------------------------------- |
| `/layout/agent/conversations/list` | `projectId`                                         |
| `/layout/agent/messages/list`      | `projectId`、`conversationId`、可选 `afterSequence` |
| `/layout/agent/runs/create`        | 上述创建请求，可附当前会话、澄清或重试来源          |
| `/layout/agent/runs/get`           | `projectId`、`runId`                                |
| `/layout/agent/runs/cancel`        | `version: "1"`、`projectId`、`runId`、`requestId`   |

SSE 使用 GET `/api/v1/projects/:projectId/layout/agent/runs/:runId/events`，沿用认证请求头与事件游标，凭据不放入 URL。页面 `/agent` 接口拒绝读取布局 Run，布局接口也拒绝页面 Run。

Server 持久化 `layout_assistant`，固定 Run 的目标与起始 Working 版本。会话和 Run 使用项目归属及空页面键表达布局，不创建伪造页面记录。模型与凭据仍由宿主选择，不来自请求中的任意路径或模型配置。

布局可读取 `get_layout_context`、结构与元素片段、物料定义、产品文档，并使用 `validate_layout_schema` 预检。终态工具 `complete_layout_run` 复用页面的操作载荷和修复机制，但只能写当前布局；没有页面业务逻辑或页面诊断工具。保存、Apply 和项目开关不在模型工具权限中。

## 预览与恢复边界

可信 App 宿主读取布局与页面 Working，校验后发送只读 `ApplicationSnapshot`。iframe 在固定快照内导航，不获得后端凭据、桌面桥接或写入权限。各文档保留自身版本/hash，刷新才重新取数；目前没有跨文档事务性快照，也没有工作台中的已应用模式切换。已应用效果通过独立生成项目验证。

组合渲染报告绑定快照、页面与布局 hash，不冒充页面单独渲染成功。布局组合诊断目前留在预览中，尚不提供 Agent 诊断读取接口。

布局 Agent 提交前准备受检回执，原子替换 Working 后记录结果。启动恢复核对 Run、项目、起始版本、操作摘要及 Working 版本/hash，不自动重放模型调用。SQLite 存储版本 2 保留原页面会话和消息；项目 Schema 与清单不随数据库升级转换。

完整操作步骤见[布局配置](/guide/layout)。验证命令见[开发与验证](/architecture/development)。
