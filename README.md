# Origamix

本地优先的低代码编辑器：React 工作台提供页面编辑、Agent 会话和预览；Server 管理项目、工作副本和显式应用；Electron 提供本机授权与进程宿主。生成项目可独立运行。

## 选择运行方式

在仓库根目录使用 Node.js 24.15.0 至 24.x 和 pnpm 10，先执行 `pnpm install --frozen-lockfile`。只做可视化编辑时可以跳过模型配置。

| 使用场景         | 启动方式                                                       | 项目内容如何交付                   |
| ---------------- | -------------------------------------------------------------- | ---------------------------------- |
| 桌面编辑本机项目 | `pnpm dev`，在工作台选择目录                                   | 保存页面版本后，点击「应用到项目」 |
| 浏览器开发       | 配置 `ORIGAMIX_WEB_MYSQL_URL` 后执行 `pnpm dev:web`            | 保存版本后导出 ZIP                 |
| 单用户自托管 Web | 配置 MySQL 和访问密码后执行 `pnpm build:web`、`pnpm start:web` | 保存版本后导出 ZIP                 |

桌面与 Web 开发默认使用前端端口 9685，请分别启动。桌面以本地目录和 SQLite 保存编辑状态，Web 使用 MySQL。Web 项目 ZIP 可以独立部署，也可以解压后在桌面打开继续编辑。两端各自保存草稿、版本历史、会话和回执。生产配置见 [App 部署说明](packages/app/README.md#部署正式-web-宿主)。

## 首次使用

1. 用 `pnpm dev` 启动桌面应用，需要使用 Agent 时，在设置中配置 DeepSeek API Key 和模型。
2. 选择项目目录；已有清单时打开项目，没有清单时按提示填写初始化信息，再创建或打开页面。
3. 在编辑器中修改页面，或让 Agent 修改当前页面；成功的修改自动保留为 Working 草稿。
4. 预览当前草稿，确认后点击“保存版本”创建 Revision，再点击“应用到项目”更新生成项目的 `schema.json`。
5. 在生成项目目录运行 `pnpm install`、`pnpm dev`；部署说明见生成项目的 README。

根开发命令会自动准备当前库构建产物。开发宿主会准备使用固定 npm 版本的模板，供新建项目使用。

`pnpm dev` 和 `pnpm dev:web` 在每轮涉及 Materials 的构建中准备一次物料清单。物料源码变化按顺序更新 Materials 和 Server，生成文件不会触发下一轮构建。

浏览器开发模式的目录授权、Key 环境变量与能力限制见 [App README](packages/app/README.md)。草稿、版本、历史和失败处理也见该文档；桌面数据位置及打包配置见 [Desktop README](apps/desktop/README.md)。

## 包与接口

工作台重构的依赖方向、公开契约与迁移归属见 [架构边界](site/docs/architecture/index.md)。Editor 已承接画布、FlowEditor 与通用编辑组件，公共 UI 已独立为工作区包。

项目技术栈由 Shared 契约统一解析；当前固定支持 React + Antd，物料通过 `antd/manifest`、`antd/editor`、`antd` 三入口分别供 Server、编辑器与页面运行使用。编辑和预览按需加载，显式未知版本不会回退。复杂属性使用物料自带的结构化编辑器；普通字段和协议由同一物料定义生成。

| 包                                        | 唯一职责                                         | 对外接口                              |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| [Desktop](apps/desktop/README.md)         | 本机能力、窗口、凭据、Server 生命周期及应用组装  | 命名 IPC 桥与桌面程序                 |
| [App](packages/app/README.md)             | 工作台交互、HTTP 客户端和窗口内状态              | Renderer 构建产物                     |
| [UI](packages/ui/README.md)               | 共用基础控件、工具与主题基础                     | 根入口、`styles.css`                  |
| [Editor](packages/editor/README.md)       | 画布、FlowEditor、通用编辑组件与契约             | 根入口、`styles.css`                  |
| [Server](packages/server/README.md)       | 业务用例、授权项目文件、桌面 SQLite 和 Web MySQL | HTTP；宿主启动、模板及工具出口        |
| [Shared](packages/shared/README.md)       | 平台无关契约和纯校验                             | 单一根入口                            |
| [Materials](packages/materials/README.md) | 页面物料、编辑器配置和物料清单                   | 运行注册表、编辑分组、纯数据 Manifest |
| [Runtime](packages/runtime/README.md)     | 传入 Schema 的独立渲染                           | `@origamix/runtime`                   |
| [Template](packages/template/README.md)   | 可独立安装部署的项目骨架                         | 可复制的源码与配置                    |

自动保留草稿、保存版本和历史恢复只修改 Working Schema / Revision；文件项目使用 `src/<pageDirectory>/<slug>/schema.json`（清单中 `pageDirectory` 默认为 `pages`），该文件只在初始化或显式“应用到项目”时写入。窗口导航、草稿与选项是 App 的投影，不能成为第二份权威页面数据。

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
| `pnpm build:web`     | Web 宿主所需的后端、工作台静态资源和版本化项目模板 ZIP   |
| `pnpm build`         | 库 → Server → App → Desktop 编译和资源组装，不制作安装包 |
| `pnpm package:dir`   | 构建后生成 macOS arm64 应用目录，使用本地 ad-hoc 签名    |
| `pnpm package:mac`   | 四项检查后制作 macOS arm64 DMG 和 ZIP 本地试用包         |
| `pnpm package`       | 执行 `package:mac`，当前仅交付 macOS                     |
| `pnpm pack:npm`      | 库构建与本地 npm tarball，不发布到 registry              |
| `pnpm gate:internal` | 固定评测数据与门槛计算检查，不证明真实模型质量           |

包内 `build` 只构建本包，所需上游产物须先准备；根命令负责依赖顺序，避免重复构建。Desktop 的 `build` 还组装已构建的 Server 和模板资源，包内 `package:*` 只消费这些产物。Shared、Runtime 在工作区与发布包统一使用 dist 出口；Materials 始终使用 dist；Editor、UI 保持私有源码出口以支持 HMR。

### 首版验收

| 命令                    | 验证范围                                                                       |
| ----------------------- | ------------------------------------------------------------------------------ |
| `pnpm check`            | Lint、类型、核心流程测试与桌面构建                                             |
| `pnpm test:desktop`     | 真实 Electron、目录授权、后端恢复、明暗主题预览及 Monaco 降级后的 Working 保存 |
| `pnpm test:web`         | 开发与正式 Web 宿主、鉴权和预览隔离                                            |
| `pnpm test:web:mysql`   | MySQL 草稿恢复、真实 ZIP 下载、独立构建、桌面打开与 Apply，以及 Web 数据隔离   |
| `pnpm test:agent:mysql` | 使用确定性模型验证页面 Agent 冲突、回执与恢复                                  |
| `pnpm test:template`    | 桌面生成项目的独立安装、类型检查与 Browser／Hash 构建                          |
| `pnpm test:dev`         | 开发环境有序重建、重启和清理                                                   |
| `pnpm release:check`    | 安装实际 npm 归档并加载公开入口                                                |
| `pnpm site:build`       | 构建中文站点                                                                   |

Web 与 Server 开发集成使用 `ORIGAMIX_TEST_MYSQL_URL` 指定的独立测试库。Electron 和 Chromium 检查需要图形会话。独立安装与归档检查需要 npm registry 或相应缓存。

桌面构建包当前仅面向 macOS 13+ 的 Apple Silicon（arm64）。`release/` 中的 `OrigaMix-<version>-macOS-arm64.dmg` 用于拖入 Applications，ZIP 提供同一应用的归档；`release/mac-arm64/OrigaMix.app` 为解包目录。本地 ad-hoc 签名不等于 Developer ID 签名或 Apple 公证，当前构建属于本地试用交付；官网尚未提供公开下载。详细验证与限制见 [Desktop README](apps/desktop/README.md#macos-构建包)。

真实页面质量验收见 [Desktop 的验收说明](apps/desktop/README.md#真实-agent-页面质量验收)：先构建并在桌面设置配置模型，再运行 `pnpm --filter @origamix/desktop evaluate:agent`。该命令会调用真实模型并产生费用，使用临时项目，记录实际预览、恢复、保存／Apply 和独立运行结果。

Lefthook 对暂存文件格式化和 lint；TypeScript 变更触发类型与测试，边界规则变更验证规则及仓库 lint。用 `pnpm hooks:install` 安装、`pnpm hooks:run` 手动执行。完整仓库检查仍是交付依据。

### 统一发布版本

首版自有包、页面 Schema 和物料契约均为 `1.0.0`。`pnpm release:version --check` 校验包版本和模板清单。页面打开时校验当前格式。见 [Server README](packages/server/README.md#契约校验与恢复)。

## 开发环境文件

Desktop、App 和独立 Server 在代码中提供默认值。开发命令按代码默认值 → 包内 `.env` → 同目录 `.env.local` → 进程环境变量合并。配置文件可省略，生产构建跳过 `.env.local`。Desktop 开发启动器监听自身环境文件并自动重启开发实例；独立 App／Server 修改配置后也需重启。Desktop 启动器将跨包页面地址参数传给 App。库包、Site 和生成项目不读取这些宿主配置；API Key 不写入环境文件。具体字段、路径基准和生产打包规则见各宿主包 README。

公开 npm 包、私有工作台产物与发布流程见[包依赖与交付产物](site/docs/architecture/development.md)。`pnpm release:check` 在隔离目录安装实际归档并加载公开入口。`pnpm publish:npm` 执行发布。模板使用的版本必须先在 npm 可安装。

### 一次运行完整仓库检查

运行 `pnpm check` 可按顺序校验已提交的物料 Manifest，准备公共库，并完成 lint、类型检查、测试和应用构建。单独运行 `typecheck`、`test`、`build` 时也会准备依赖，避免并行运行这些命令。站点另外运行 `pnpm site:build`。

修改物料配置后执行 `pnpm --filter @origamix/materials manifest:generate` 并提交生成的清单。公开包名单与归档目录见 [发布工具](scripts/public-packages.ts)。开发重启、构建产物和集成检查见[开发与验证](site/docs/architecture/development.md)。

## 项目配置与布局

项目「… → 编辑」中可启用布局配置，启用后点击项目下的「布局配置」在工作区打开。面板采用左侧布局效果、右侧配置表单，支持左右、顶部、混合布局，标题、Logo、父子菜单及排序/隐藏、首页、404 和「页面使用应用布局」开关。可按页关闭应用布局。点击「保存配置」提交 `shell`、`layout`、`routing`。桌面保存到 `origamix.project.json`，Web 保存到 MySQL。保存时校验配置基线，失败保留输入。未配置菜单时只在设置界面显示示例数据；显式空菜单保持为空。

新建项目只填写名称、标识、页面目录、生成位置和启用布局；默认 Browser 路由、根访问前缀和混合布局。关闭布局保留配置，首页和 404 继续有效。引用使用稳定 pageId，删除关联页面前需移除引用。

「页面预览」运行当前页面的 Working 草稿。要更新生成项目中的页面内容，依次点击「保存版本」和「应用到项目」。「布局配置」中的「查看效果」展示当前配置草稿的布局示意，完整菜单、路由和业务行为在生成项目中验证。

在布局表单中指定首页、404 页面和应用壳，点击「保存配置」提交草稿。登录页用途可以在页面设置中标记。

使用方法见 [项目布局指南](site/docs/guide/layout.md)。

布局表单草稿仅保留在当前工作区标签中。关闭标签或退出前，请先保存配置。
