# Materials

Tangramino 页面物料包，当前只提供 Ant Design。它拥有页面组件、物料默认值、编辑配置和可序列化清单，不包含 Origamix 工作台、项目服务或持久化。

## 公开接口

| 入口                                | 消费方与用途                       |
| ----------------------------------- | ---------------------------------- |
| `@origamix/materials/antd`          | Runtime/生成页面使用的组件注册表   |
| `@origamix/materials/antd/group`    | App 编辑器使用的分组及属性配置     |
| `@origamix/materials/antd/manifest` | Server、Agent 使用的纯数据物料清单 |
| `@origamix/materials/manifest`      | 清单类型及通用定义                 |

运行组件、编辑器配置和纯数据入口分别服务不同消费者，不能合并成让 Server 加载 React 的总入口。单个物料的组件、清单和配置放在 `antd/<material>/`；公共声明辅助位于 `antd/manifest-definition.ts`。

物料注册键和已保存 Schema 的 `type` 是兼容性边界。删除物料或改名需要数据迁移，不能因为某个示例页面没用到就移除。

## 开发与发布

在仓库根目录：

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

tsup 输出到 `dist/`；根 `pnpm package:npm` 构建并生成 tarball。工作区类型指向源码，发布类型指向声明文件，两套出口需要同步。React、Ant Design 和当前编辑控件所需 HeroUI 使用声明的 peer dependencies；不要依赖工作区意外提升。

维护约束见 [AGENTS.md](AGENTS.md)。
