# App

React 工作台，负责项目导航、页面编辑、Agent 会话、Apply 状态与预览展示。外部消费的是 Vite 生成的 `dist/`，不导出内部组件或 Store 给其他包。

## 代码入口

- [src/app.tsx](src/app.tsx)：工作台装配。
- [src/services](src/services)：通过 Shared 契约调用 HTTP，统一认证刷新和错误处理。
- [src/store](src/store)：窗口级导航和偏好投影；导航、页签和未发送草稿使用 `sessionStorage`。
- [src/components/editor](src/components/editor)：编辑会话、保存队列和编辑器集成。
- [src/components/agent-chat](src/components/agent-chat)：Agent 会话及事件恢复。
- [src/runtime](src/runtime)：给 Runtime 渲染结果添加工作台反馈；引擎创建归 Runtime。
- [dev-server.ts](dev-server.ts)：Node 开发宿主，允许使用 Server 的公开启动入口。

`src/` 仅依赖 Shared、Materials、Runtime 及声明的前端依赖，不读取文件系统或导入 Server。编辑会话与窗口导航分别保存页面内容和导航投影，不能为方便同步而合并成第二个数据库。HTTP 不确定失败不能自动重放写请求。

## 开发与验证

在仓库根目录：

```sh
pnpm dev:web
pnpm --filter @origamix/app lint
pnpm --filter @origamix/app typecheck
pnpm --filter @origamix/app test
pnpm build:web
pnpm --filter @origamix/app test:web
```

`dev:web` 先编译并启动本地 Server，通过同源 `/api/v1` 代理认证；Server/Shared 改动重启宿主，前端改动使用 HMR。`ORIGAMIX_WEB_STATE_DIR` 可覆盖默认 `.origamix-web/` 数据位置。认证信息不注入浏览器配置。

浏览器开发模式没有原生目录选择器和凭据存储。Desktop 通过 Shared 中的命名桥提供这些能力。修改可见界面需实际验证亮暗主题；修改开发进程管理还需 Server `test:dev`。

维护约束见 [AGENTS.md](AGENTS.md)。
