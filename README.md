# Origamix

本地优先的低代码编辑器：React 工作台提供页面编辑、Agent 会话和预览；Server 管理项目、工作副本和显式应用；Electron 提供本机授权与进程宿主。生成项目可独立运行。

## 开始

使用支持 `node:sqlite` 的 Node.js 24 和 pnpm，依赖版本以各包 `package.json` 和 `pnpm-lock.yaml` 为准。

```sh
pnpm install --frozen-lockfile
pnpm dev       # Electron
pnpm dev:web   # 浏览器开发宿主
```

开发默认占用 Renderer 端口 5173。Web 开发数据保存在忽略的 `.origamix-web/`；已有项目由宿主显式授权：

```sh
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/project pnpm dev:web
```

Web 开发代理会在宿主侧附加认证信息。当前仓库未提供完整的生产远程部署和浏览器模板下载/导入功能，不应把开发代理当成这些功能的实现。

## 首次使用

1. 用 `pnpm dev` 启动桌面应用，在设置中配置 DeepSeek API Key 和模型。
2. 选择项目目录；已有清单时打开项目，没有清单时按提示填写初始化信息，再创建或打开页面。
3. 在编辑器中修改页面，或让 Agent 修改当前页面；成功的修改自动保留为 Working 草稿。
4. 预览当前草稿，确认后点击“保存版本”创建 Revision，再点击“应用到项目”更新生成项目的 `schema.json`。
5. 在生成项目目录运行 `pnpm install`、`pnpm dev`；部署说明见生成项目的 README。

浏览器开发模式的目录授权、Key 环境变量与能力限制见 [App README](packages/app/README.md)。草稿、版本、历史和失败处理也见该文档；桌面数据位置及打包配置见 [Desktop README](apps/desktop/README.md)。

## 包与接口

| 包                                        | 唯一职责                                        | 对外接口                              |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| [Desktop](apps/desktop/README.md)         | 本机能力、窗口、凭据、Server 生命周期及应用组装 | 命名 IPC 桥与桌面程序                 |
| [App](packages/app/README.md)             | 工作台交互、HTTP 客户端和窗口内状态             | Renderer 构建产物                     |
| [Server](packages/server/README.md)       | 业务用例、授权后的项目文件和 SQLite             | HTTP；宿主启动、模板及工具出口        |
| [Shared](packages/shared/README.md)       | 平台无关契约和纯校验                            | 显式协议子路径                        |
| [Materials](packages/materials/README.md) | 页面物料、编辑器配置和物料清单                  | 运行注册表、编辑分组、纯数据 Manifest |
| [Runtime](packages/runtime/README.md)     | 传入 Schema 的独立渲染                          | `@origamix/runtime/react`             |
| [Template](packages/template/README.md)   | 可独立安装部署的项目骨架                        | 可复制的源码与配置                    |

自动保留草稿、保存版本和历史恢复只修改 Working Schema / Revision；真实项目页面目录由 `origamix.project.json.pageDirectory` 声明（默认 `src/pages`），其中 `<slug>/schema.json` 只在初始化或显式“应用到项目”时写入。窗口导航、草稿与选项是 App 的投影，不能成为第二份权威页面数据。

包内使用方法放在各自 README；维护约束放在对应 `AGENTS.md`。忽略目录 `_doc/` 是历史产品规划，不作为当前实现说明，也不是新贡献者的必需文件。

## 验证与产物

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

根 lint 包含跨包接口规则，根 test 包含规则回归及各包测试。集成检查按变更边界运行，见包 README；Template 的独立安装构建由 Server `test:template` 验证，根 test 不替代它。

| 命令                 | 产物/用途                                                |
| -------------------- | -------------------------------------------------------- |
| `pnpm build:libs`    | Shared、Runtime、Materials 的独立产物                    |
| `pnpm build:web`     | 上述依赖及 App 的静态资源                                |
| `pnpm build`         | 库 → App → Server → Desktop 编译和资源组装，不制作安装包 |
| `pnpm package:dir`   | 构建后生成 `release/` 下未签名应用目录                   |
| `pnpm package`       | 四项检查后制作发行包；发行签名另行配置                   |
| `pnpm package:npm`   | 库构建与本地 npm tarball，不发布到 registry              |
| `pnpm gate:internal` | Server 的确定性 Agent 内测门禁                           |

包内 `build:assemble` 只消费已准备好的输入；根构建统一排序，避免在每一层重复构建依赖。单包 `build` 保留准备依赖的职责，以支持独立调用。

Lefthook 对暂存文件格式化和 lint；TypeScript 变更触发类型与测试，边界规则变更验证规则及仓库 lint。用 `pnpm hooks:install` 安装、`pnpm hooks:run` 手动执行。完整仓库检查仍是交付依据。
