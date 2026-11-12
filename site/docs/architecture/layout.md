---
title: 项目布局契约
description: 项目清单配置、服务端保存和模板布局渲染的职责。
---

# 项目布局契约

项目布局不使用页面 Schema、Working、Revision、Apply 或页面 Agent 写入工具。

- Shared 的 project-shell.ts 定义 shell 与设置协议，校验菜单父级、循环、Logo 和页面引用。
- ProjectService 的 getSettings/updateSettings 在项目队列和独占租约内读取、校验、检查 manifestHash 并原子写入 origamix.project.json。相同已完成更新可安全重试，不覆盖更新的配置。
- App 的项目设置表单持有一份临时草稿，左侧展示布局配置示意；示例菜单仅存在于设置界面。
- Template 读取同一清单，用 Ant Design 的 Layout 和 Menu 渲染应用外壳。链接和跳转由模板路由提供。
- 首页映射到根路径；未知路由保留地址并渲染配置的 404。standalonePageIds 控制页面是否使用布局，关闭全局布局不改变路由规则。
- 页面内容继续通过唯一的 Working、显式 Revision 和显式 Apply 管线管理。平台仅提供页面草稿预览，完整项目行为在生成应用中验证。

清单中的 shell、layout 和 routing 均为必填。

布局助手通过经过认证的 POST /projects/settings/assist 返回 NDJSON 事件，复用 PiAgentEngine、模型凭据与 RunBudgetController。工具白名单只有读取配置和 complete_project_settings，服务只产生建议，不能写清单或页面 Working。服务端校验页面引用与清单哈希；App 的共享配置会话再检查项目、草稿版本和连接身份。AI、表单和左侧效果使用同一临时草稿，显式保存仍只调用 ProjectService.updateSettings。布局对话为当前标签内的临时会话，不伪造页面 Run，不复用页面数据库记录，不做自动续跑。
