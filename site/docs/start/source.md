---
title: 获取源码与启动
description: 获取源码与启动的职责、使用与开发说明
---

# 获取源码与启动

## 获取项目

从 [GitHub 仓库](https://github.com/keiseiTi/origamix) 下载源码 ZIP 并解压，或使用 Git：

```sh
git clone https://github.com/keiseiTi/origamix.git
cd origamix
```

下载 ZIP 的用户请在终端进入解压后的仓库根目录。

## 安装并启动

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` 会准备本地后端、启动前端开发服务并打开 Electron 工作台。开发 Renderer 默认使用端口 5173；后端使用自动分配的本机端口。

启动成功后应看到工作台。保持终端运行，完成首次使用后停止开发命令，并关闭本次启动的应用。

## 修改源码后

App、Editor、UI 使用 HMR。Shared、Runtime、Materials、Server 或 Main/Preload 修改后，开发启动器构建依赖、准备资源并自动重启桌面端。终端输入 `p` 并回车可暂停／恢复自动重启；调试 Agent 或编辑未提交内容时可先暂停，避免重启打断当前操作。完整说明见[开发与验证](/architecture/development)。

本机非敏感配置放在对应宿主包的 `.env.local`：桌面端使用 `apps/desktop/.env.local`，独立 Web 使用 `packages/app/.env.local`。不要把 API Key 写入这些文件。

## 启动失败时

- 检查 Node.js 是否为 24，以及安装依赖是否成功。
- 锁文件报错时确认使用了仓库中的完整源码和锁文件，不要直接删除锁文件。
- 端口被占用时先确认占用来源，关闭自己启动的旧开发服务。
- 保存启动日志中的错误信息，提交问题时移除凭据和私人路径。

下一步：[创建第一个页面](/start/first-page)。浏览器开发方式见[开发与验证](/architecture/development)。
