# 工作台与物料架构边界

阶段 1 固定包职责和编辑契约，阶段 2 抽取公共 UI，阶段 3 抽取 Editor 与 FlowEditor；当前仅支持 React + Antd。第二套物料、Vue、市场、远程插件、多物料混用和自动升级不在本次范围内。

## 依赖与入口

| 包                     | 允许的工作区依赖与职责                     | 入口状态                                                 |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Shared                 | 无工作区依赖；平台协议、Manifest 格式      | `protocol/material-manifest` 已提供通用类型和格式版本    |
| UI                     | 无工作区依赖；基础控件、主题               | `@origamix/ui/<control>`、`utils`、`styles.css` 已提供   |
| Editor                 | Shared、UI；画布、FlowEditor、通用编辑组件 | `visual`、`flow`、`components`、`core` 及类型入口已提供  |
| Materials 的编辑入口   | Shared、Editor 公共入口、UI                | `antd/editor` 提供分组、清单及扩展注册；旧入口保留兼容   |
| Materials 的纯数据入口 | Shared                                     | `antd/manifest` 保留；具体内容仍归物料                   |
| Materials 的运行入口   | 不依赖编辑层；未来可用独立 UI 基础控件     | `antd/runtime` 用于预览与生成页面；`antd` 保留兼容       |
| Runtime                | Shared；渲染和声明式逻辑                   | 接收运行注册表，不导入具体物料                           |
| App                    | Shared、UI、Editor、Materials、Runtime     | 负责项目装配、HTTP、Working 会话、Agent、Revision、Apply |
| Server                 | Shared、物料纯数据入口                     | 权威校验、Working、Revision、授权文件写入                |
| Template               | Runtime、物料运行入口                      | 独立运行，不导入工作台或本地后端                         |

表中的入口均已开放导出。当前 `materials/manifest` 为兼容入口，重导出 Shared 的通用格式，同时保留物料转换辅助；不会改动清单数据或持久化 Schema。

Editor 不导入具体物料，Materials 不导入 App，生成项目和预览运行链路不导入 Editor。HeroUI 与 Tangramino base-editor 为可选编辑 peer；运行入口不引用编辑声明。独立模板 smoke 检查编辑引擎未被安装，并执行类型检查与构建；模板自身的 HeroUI 基础控件保留。

## 实现迁移归属

| 当前实现                                                                | 后续归属                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| UI `src/components/`、控件工具、主题基础                                | UI；App 保留产品布局及主题选择                                              |
| Editor `visual/` 的画布、面板、工具、澄清标记呈现                       | Editor；Agent 澄清业务状态和回调留 App                                      |
| Editor `flow/` 的画布、节点表单、图转换                                 | Editor 的 flow 模块；节点协议归 Shared、执行归 Runtime                      |
| `use-editor-session.ts` 的 HTTP、Working 恢复、版本、定时提交、失败保留 | App 页面编辑会话                                                            |
| Editor `core/derive-schema-operations.ts` 的引擎快照差分                | Editor 的 core；App 接收事务并调用现有服务                                  |
| Working 加载、项目/page 生命周期、Agent 恢复锁定                        | App                                                                         |
| 具体表格列、选项等属性编辑器                                            | Materials 的 editor 入口                                                    |
| 通用元素/变量选择器、JSON 编辑器                                        | Editor 的 components 入口；已导出代码与 JSON 字段组件，选择器按实际需求开放 |
| Manifest 通用格式                                                       | Shared；具体 Antd 属性、事件、方法、说明仍归 Materials                      |

## 事务与扩展约束

编辑器、FlowEditor 和专属属性编辑器共享一次页面编辑会话。引擎快照可以是尚未提交的交互投影；Server Working 始终是唯一权威数据。

属性编辑器提交限定当前元素的属性修改，由 Editor 转为事务。事务携带页面作用域与 baseWorkingVersion。App 将其转换成现有版本校验请求；只有成功响应才更新 Working 投影。普通编辑不创建 Revision，不写真实项目。协议无法表示时的 candidate 分支只供内部适配器使用，不能作为物料直接提交完整页面的接口。

属性编辑器不得获得原始引擎、App Store、HTTP、保存版本或 Apply 能力。需要宿主业务时按真实需求增加命名能力，不预设全能 SDK。每个异步结果必须绑定页面及编辑目标；切页后不能将旧提交应用到新目标。

Manifest 是可序列化数据，不能包含 React 组件、校验函数或执行函数。Shared 的类型不是运行时校验器；Server 现有校验继续拥有最终决定权。本阶段不改变项目技术栈持久化格式或物料版本策略，它们在阶段 6 落实。

## 阶段验收

阶段 1 用 App 现有编辑模式、工具及命令句柄实际消费 Editor 类型入口，保留本地重导出供现有调用方使用。Manifest 原入口通过兼容重导出继续工作。阶段 2 已将基础控件和主题迁入 UI，App 直接使用公开入口；工作台与 iframe 文档显式启用各自主题。阶段 3 已迁移编辑器实现；App 仅保留页面宿主装配、Working 队列、HTTP、版本与 Agent 协调。Monaco workers 由 App 的 Vite 启动入口配置。

阶段 4 已整理三入口并迁移 App、预览和新生成的页面；旧入口保留兼容，专属属性编辑器尚未激活。

后续顺序：表格列编辑器验证 → 技术栈解析与加载 → 全链路迁移验证。

维护规则见各包 AGENTS.md。源码或契约变更执行根 lint、typecheck、test、build；只对新增核心流程风险补充最小测试，不为纯类型别名或组件搬迁新增测试。
