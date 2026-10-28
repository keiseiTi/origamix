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

根开发命令会自动准备当前库构建产物。开发宿主会准备使用固定 npm 版本的模板，供新建与升级项目共用。

浏览器开发模式的目录授权、Key 环境变量与能力限制见 [App README](packages/app/README.md)。草稿、版本、历史和失败处理也见该文档；桌面数据位置及打包配置见 [Desktop README](apps/desktop/README.md)。

## 包与接口

工作台重构的依赖方向、公开契约与迁移归属见 [架构边界](site/docs/architecture/index.md)。Editor 已承接画布、FlowEditor 与通用编辑组件，公共 UI 已独立为工作区包。

项目技术栈由 Shared 契约统一解析；当前固定支持 React + Antd，物料通过 `antd/manifest`、`antd/editor`、`antd/runtime` 三入口分别供 Server、编辑器与页面运行使用。编辑和预览按需加载，显式未知版本不会回退。第五阶段的专属属性编辑器按需延期，现有结构化字段继续使用 JSON 编辑。

| 包                                        | 唯一职责                                        | 对外接口                              |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| [Desktop](apps/desktop/README.md)         | 本机能力、窗口、凭据、Server 生命周期及应用组装 | 命名 IPC 桥与桌面程序                 |
| [App](packages/app/README.md)             | 工作台交互、HTTP 客户端和窗口内状态             | Renderer 构建产物                     |
| [UI](packages/ui/README.md)               | 共用基础控件、工具与主题基础                    | 根入口、`styles.css`                  |
| [Editor](packages/editor/README.md)       | 画布、FlowEditor、通用编辑组件与契约            | 根入口、`styles.css`                  |
| [Server](packages/server/README.md)       | 业务用例、授权后的项目文件和 SQLite             | HTTP；宿主启动、模板及工具出口        |
| [Shared](packages/shared/README.md)       | 平台无关契约和纯校验                            | 单一根入口                            |
| [Materials](packages/materials/README.md) | 页面物料、编辑器配置和物料清单                  | 运行注册表、编辑分组、纯数据 Manifest |
| [Runtime](packages/runtime/README.md)     | 传入 Schema 的独立渲染                          | `@origamix/runtime`                   |
| [Template](packages/template/README.md)   | 可独立安装部署的项目骨架                        | 可复制的源码与配置                    |

自动保留草稿、保存版本和历史恢复只修改 Working Schema / Revision；真实项目页面目录由 `origamix.project.json.pageDirectory` 声明（默认 `src/pages`），其中 `<slug>/schema.json` 只在初始化或显式“应用到项目”时写入。窗口导航、草稿与选项是 App 的投影，不能成为第二份权威页面数据。

包内使用方法放在各自 README；维护约束放在对应 `AGENTS.md`。

## 验证与产物

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

根 lint 包含跨包接口规则，根 typecheck 会先构建库的公共声明再检查各包，根 test 包含规则回归及各包测试。集成检查按变更边界运行，见包 README；Template 的独立安装构建由 Server `test:template` 验证，根 test 不替代它。

核心链路与独立项目验证方式见 [Server 集成说明](packages/server/README.md#开发宿主与模板集成)，真实桌面运行检查见 [Desktop README](apps/desktop/README.md)。

| 命令                 | 产物/用途                                                |
| -------------------- | -------------------------------------------------------- |
| `pnpm build:libs`    | Shared、Runtime、Materials 必需构建产物                  |
| `pnpm build:web`     | 上述依赖及 App 的静态资源                                |
| `pnpm build`         | 库 → Server → App → Desktop 编译和资源组装，不制作安装包 |
| `pnpm package:dir`   | 构建后生成 macOS arm64 应用目录，使用本地 ad-hoc 签名    |
| `pnpm package:mac`   | 四项检查后制作 macOS arm64 DMG 和 ZIP 本地试用包         |
| `pnpm package`       | 执行 `package:mac`，当前仅交付 macOS                     |
| `pnpm pack:npm`      | 库构建与本地 npm tarball，不发布到 registry              |
| `pnpm gate:internal` | 固定评测数据与门槛计算检查，不证明真实模型质量           |

包内 `build` 只构建本包，所需上游产物须先准备；根命令负责依赖顺序，避免重复构建。Desktop 的 `build` 还组装已构建的 Server 和模板资源，包内 `package:*` 只消费这些产物。Shared、Runtime 在工作区与发布包统一使用 dist 出口；Materials 始终使用 dist；Editor、UI 保持私有源码出口以支持 HMR。

集成入口：`pnpm test:template` 验证独立模板，`pnpm test:web` 验证浏览器宿主，`pnpm test:desktop` 验证真实 Main，`pnpm test:dev` 验证 Desktop／Server 开发更新。前三项自动准备构建输入，开发更新检查使用临时工作区。桌面检查需要图形会话。

桌面构建包当前仅面向 macOS 13+ 的 Apple Silicon（arm64）。`release/` 中的 `origamix-<version>-macOS-arm64.dmg` 用于拖入 Applications，ZIP 提供同一应用的归档；`release/mac-arm64/origamix.app` 为解包目录。本地 ad-hoc 签名不等于 Developer ID 签名或 Apple 公证，当前构建属于本地试用交付；官网尚未提供公开下载。详细验证与限制见 [Desktop README](apps/desktop/README.md#macos-构建包)。

真实页面质量验收见 [Desktop 的验收说明](apps/desktop/README.md#真实-agent-页面质量验收)：先构建并在桌面设置配置模型，再运行 `pnpm --filter @origamix/desktop evaluate:agent`。该命令会调用真实模型并产生费用，使用临时项目，记录实际预览、恢复、保存／Apply 和独立运行结果。

Lefthook 对暂存文件格式化和 lint；TypeScript 变更触发类型与测试，边界规则变更验证规则及仓库 lint。用 `pnpm hooks:install` 安装、`pnpm hooks:run` 手动执行。完整仓库检查仍是交付依据。

### 统一发布版本

所有自有包统一使用根版本。`pnpm release:version --check` 检查版本与迁移声明，已接入 lint；`pnpm release:version --set <版本>` 更新包版本、Shared 契约版本和模板项目清单。版本更新后需补齐相邻 Schema 迁移步骤，再运行仓库检查。页面按需迁移及数据库启动迁移见 [Server README](packages/server/README.md#页面与数据库升级)。

## 开发环境文件

Desktop、App 和独立 Server 各自在包目录提供 `.env`；本机非敏感覆盖放同目录 `.env.local`，不在仓库根目录维护另一份配置。默认值 < 个人覆盖 < 进程环境变量。Desktop 开发启动器监听自身环境文件并自动重启开发实例；独立 App／Server 修改配置后也需重启。Desktop 启动器将跨包页面地址参数传给 App。库包、Site 和生成项目不读取这些宿主配置；API Key 不写入环境文件。具体字段、路径基准和生产打包规则见各宿主包 README。

公开 npm 包、私有工作台产物与发布流程见[包依赖与交付产物](site/docs/architecture/development.md)。`pnpm release:check` 不发布；`pnpm publish:npm` 才实际发布。模板使用的版本必须先在 npm 可安装。

### 组合检查与工具版本

使用 Node.js 24.15+（24.x）和 pnpm 10.33.4，版本约束见根 package.json。
`pnpm check` 依次执行 lint、一次库构建、类型检查、测试和应用构建；`package:mac` 复用该流程。
独立 `typecheck`、`test`、`build` 仍自动准备库；`*:prepared` 是组合流程内部入口，要求当前库产物已经构建，不能与库清理构建并行运行。
pre-commit 对 TypeScript 变更先构建一次库，再顺序检查类型和测试，避免同时清理同一 dist。
根 lint 和暂存 lint 均覆盖根 scripts 下的发布工具。

开发依赖更新由 Server 的 `development-libraries.ts` 统一声明：Shared → Runtime → Materials，随后构建 Server；Desktop 与 Web 共用该规则。Web 启动自动准备库，库源码变化在整批构建成功后重启宿主，失败保留原运行实例，保存监听源码可重试。启动工具脚本变化会提示重新运行开发命令。不要同时启动多个会写同一 dist 的开发/构建进程。
公开包的名单、版本和归档路径由根 `scripts/public-packages.ts` 维护；`ORIGAMIX_PACK_DIR` 对 pack、check 和 publish 一致生效，相对目录以仓库根为基准。归档检查验证包名及版本与当前源码清单一致。

自定义 Node 工具使用 TypeScript 和 tsx 执行；根目录、Desktop、App、Server 及调用公开归档工具的 Shared/Runtime/Materials 分别声明 tsx 开发依赖。`pnpm install --frozen-lockfile` 后使用原有 pnpm 命令即可。脚本由 tsc 严格检查，tsx 只负责执行。子进程继承 tsx loader；通过 Node 显式启动 TypeScript 子脚本时保留 `process.execArgv`。ESLint 配置和规则也使用 TypeScript，根目录、Site、Template 分别声明 jiti 以支持 ESLint 加载配置。Electron 验收入口使用 `.cts`，由 Node 启动器注册 `tsx/cjs` 后加载；启动器不会把加载配置传给被验收的后端进程。
