---
title: 环境准备
description: 环境准备的职责、使用与开发说明
---

# 环境准备

## 必备环境

| 工具             | 要求                             |
| ---------------- | -------------------------------- |
| Node.js          | 24，支持 `node:sqlite`           |
| pnpm             | 使用 pnpm 管理工作区和锁文件     |
| Git              | 克隆源码时使用；也可下载源码 ZIP |
| 桌面图形环境     | 启动 Electron 工作台             |
| DeepSeek API Key | 使用 Agent 时配置                |

检查本地环境：

```sh
node --version
pnpm --version
```

依赖版本以仓库 `package.json` 和 `pnpm-lock.yaml` 为准。不要用 npm 安装工作区依赖，以免产生不同的依赖结构。

安装依赖需要访问软件包仓库，首次安装还会准备 Electron 等开发依赖。

准备完成后进入[获取源码与启动](/start/source)。
