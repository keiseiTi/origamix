# Shared

平台无关的协议包，只提供类型、运行时 Schema 和纯校验，不启动服务，也不持有文件、网络、环境或 UI 状态。

## 公开子路径

| `@origamix/shared/` 后缀                      | 用途                        |
| --------------------------------------------- | --------------------------- |
| `protocol/api`                                | HTTP 请求、结果及项目记录   |
| `protocol/schema`                             | 页面数据与 Schema Operation |
| `protocol/validation`                         | 结构和图引用语义校验        |
| `protocol/project-manifest`                   | 项目及页面 Manifest 格式    |
| `protocol/agent`、`protocol/agent-validation` | Agent 协议与校验            |
| `desktop-api`                                 | 宿主命名能力契约            |
| `page-window`                                 | 预览输入与诊断契约          |
| `credential-gateway`                          | 凭据网关消息校验            |

出口显式列举，测试和新增内部文件不会自动变成公共 API。工作区解析源码，发布包解析 `dist` 的 ESM 和类型声明。类型断言不能替代接收边界上的校验；Schema 结构、引用关系与 Server 的物料兼容性分别验证不同约束。

## 验证与构建

从仓库根目录执行：

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

`pnpm package:npm` 可与其他发布包一同构建打包。修改协议后必须检查生产者和消费者，根验证命令见 [根 README](../../README.md)。维护约束见 [AGENTS.md](AGENTS.md)。
