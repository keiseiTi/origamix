---
title: 整体架构
description: Origamix 的源码分成七个职责明确的包。桌面宿主负责本机能力，工作台负责交互，本地后端负责页面数据；生成项目通过 Runtime 与 Materials 独立渲染。
---

# 整体架构

Origamix 的源码分成七个职责明确的包。桌面宿主负责本机能力，工作台负责交互，本地后端负责页面数据；生成项目通过 Runtime 与 Materials 独立渲染。

## 包的分工

| 包                                   | 目录                 | 职责                                |
| ------------------------------------ | -------------------- | ----------------------------------- |
| [Desktop](/architecture/desktop)     | `apps/desktop`       | Electron 宿主、授权、凭据与生命周期 |
| [App](/architecture/app)             | `packages/app`       | React 工作台与编辑会话              |
| [Server](/architecture/server)       | `packages/server`    | 本地 HTTP、项目、草稿、版本与应用   |
| [Shared](/architecture/shared)       | `packages/shared`    | 平台无关契约与校验                  |
| [Materials](/architecture/materials) | `packages/materials` | 页面物料、编辑配置与清单            |
| [Runtime](/architecture/runtime)     | `packages/runtime`   | Schema 渲染适配                     |
| [Template](/architecture/template)   | `packages/template`  | 独立生成项目骨架                    |

## 一次修改如何流转

App 提交编辑需求或操作；Server 校验页面归属、操作和 Working 版本，原子更新草稿；App 读取结果并通过 Runtime 与 Materials 预览。显式保存创建 Revision，显式应用才更新真实项目。

Desktop 通过命名能力提供目录授权和模型凭据，项目业务经 HTTP 进入 Server。预览没有桌面桥或后端凭据。

## 数据归属

SQLite 由 Server 管理，保存索引、会话与 Run 等应用记录。Working 与 Revision 是可编辑页面数据；目标 `schema.json` 是运行投影。Zustand 保存界面投影与临时状态。

更多开发入口见[开发与验证](/architecture/development)。
