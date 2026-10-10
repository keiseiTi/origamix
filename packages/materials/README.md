# Materials

Tangramino 页面物料包，当前只提供 Ant Design。它拥有页面组件、物料默认值、编辑配置和可序列化清单，不包含 Origamix 工作台、项目服务或持久化。

## 公开接口

| 入口                                | 消费方与用途                                        |
| ----------------------------------- | --------------------------------------------------- |
| `@origamix/materials/antd`          | Runtime/生成页面使用的组件注册表                    |
| `@origamix/materials/antd/group`    | App 编辑器使用的分组及属性配置                      |
| `@origamix/materials/antd/manifest` | Server、Agent 使用的纯数据物料清单                  |
| `@origamix/materials/manifest`      | 清单类型及通用定义                                  |
| `@origamix/materials/material`      | `OrigamixMaterial` 定义与 Manifest/编辑配置转换辅助 |

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

## 添加或扩展物料

以已经迁移的按钮物料为参考，按以下顺序维护同一份类型和默认值：

1. 在 `antd/<material>/index.tsx` 编写 Ant Design 适配组件，参考 [按钮组件](antd/button/index.tsx)。使用包内运行属性契约，剥离引擎注入属性，避免传入 DOM。
2. 在 `definition.ts` 使用 `defineOrigamixMaterial` 定义稳定的 `type`、默认值、上下文、属性 Schema 和编辑配置，参考 [按钮定义](antd/button/definition.ts)。组件和自定义渲染函数留在定义之外。
3. 在 `manifest.ts` 使用 `toMaterialManifest` 导出纯数据清单；在 `material-config.ts` 使用 `toEditorMaterial` 绑定组件，参考 [清单](antd/button/manifest.ts) 和 [编辑配置](antd/button/material-config.ts)。
4. 将运行组件加入 [antd/index.ts](antd/index.ts)，编辑配置加入 [antd/group.ts](antd/group.ts)，清单加入 [antd/manifest.ts](antd/manifest.ts)。三处类型必须一致；已有但未向编辑器开放的类型不应顺手移除。
5. 运行包检查与根检查，在编辑器、预览和生成项目中验证属性、上下文及亮暗主题。自动测试只补已有清单一致性场景中的必要约束。

转换辅助的公开导入方式：

```ts
import {
  defineOrigamixMaterial,
  toMaterialManifest,
  toEditorMaterial,
} from '@origamix/materials/material';
```

Server 仅消费 Manifest，不能让清单入口通过组件或编辑配置间接加载 React。新增类型可以扩展注册表；重命名或删除已有类型必须同时考虑保留的 Working、历史 Revision 和生成项目。
