---
pageType: home
title: Origamix
description: AI 驱动、本地优先的低代码编辑器。获取源码，启动工作台，用对话和可视化编辑构建页面。
hero:
  name: Origamix
  text: AI 驱动的本地低代码编辑器
  tagline: 用对话开始，用可视化编辑完善。在同一个工作台中编辑、预览与保存页面，将确认后的版本应用到你的本地项目。
  actions:
    - theme: brand
      text: 快速开始
      link: /start/source
    - theme: alt
      text: 获取源码
      link: https://github.com/keiseiTi/origamix
features:
  - title: 对话与可视化，同一份页面
    details: 让 Agent 修改页面，再通过组件与属性编辑继续调整。成功的修改自动保留为草稿。
    link: /intro/workflow
  - title: 保存与应用，由你确认
    details: 预览草稿，明确保存版本，再应用到项目。历史恢复不会自动覆盖真实项目。
    link: /guide/history
  - title: 本地编辑，独立运行
    details: 在授权目录中管理页面。生成项目使用自己的运行入口和依赖，可以继续开发与部署。
    link: /start/generated-project
---

## 从源码开始

当前通过源码在本地启动，暂不提供安装包。准备 Node.js 24 和 pnpm，在下载或克隆后的仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

桌面工作台启动后配置 DeepSeek API Key，选择项目目录，再创建页面。AI 调用需要外部模型服务；项目与编辑草稿保存在本地。

[获取源码与启动 →](/start/source) · [创建第一个页面 →](/start/first-page)

## 从想法到项目

| 步骤    | 操作                       | 结果                       |
| ------- | -------------------------- | -------------------------- |
| 01 打开 | 选择项目与页面             | 恢复已有草稿或创建新页面   |
| 02 编辑 | 对话修改、可视化调整、预览 | 自动保留 Working 草稿      |
| 03 保存 | 明确保存版本               | 创建不可变 Revision        |
| 04 应用 | 应用到项目                 | 更新目标页面的 schema.json |

[了解完整工作方式 →](/intro/workflow)

## 认识仓库里的七个包

| 包                                   | 作用                                   |
| ------------------------------------ | -------------------------------------- |
| [Desktop](/architecture/desktop)     | 桌面窗口、目录授权、凭据与后端生命周期 |
| [App](/architecture/app)             | React 工作台、编辑器、会话与预览       |
| [Server](/architecture/server)       | 本地服务、草稿、版本与显式应用         |
| [Shared](/architecture/shared)       | 公共数据契约与校验                     |
| [Materials](/architecture/materials) | Ant Design 页面物料与编辑配置          |
| [Runtime](/architecture/runtime)     | Schema 的独立渲染                      |
| [Template](/architecture/template)   | 生成项目的运行与部署骨架               |

[查看整体架构 →](/architecture/index) · [开发与验证 →](/architecture/development)

## 继续探索

从[项目介绍](/intro/index)了解定位，从[使用指南](/guide/projects)了解具体操作。当前支持范围见[当前能力与限制](/intro/status)，遇到问题先查看[常见问题](/guide/faq)。
