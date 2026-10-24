# Materials

Tangramino 页面物料包，当前只提供 Ant Design。它拥有页面组件、物料默认值、编辑配置和可序列化清单，不包含 Origamix 工作台、项目服务或持久化。

属性面板、事件与逻辑流读值的完整配置契约，见 [Ant Design 物料配置清单](antd/CONFIGURATION-PLAN.md)。

## 公开接口

| 入口                                | 消费方与用途                       |
| ----------------------------------- | ---------------------------------- |
| `@origamix/materials/antd/runtime`  | Runtime/生成页面使用的组件注册表   |
| `@origamix/materials/antd/editor`   | 编辑器使用的分组、清单与扩展注册   |
| `@origamix/materials`               | `src/` 的公共类型与辅助函数        |
| `@origamix/materials/antd/manifest` | Server、Agent 使用的纯数据物料清单 |

运行、编辑和清单使用各自的 Ant Design 子入口，物料编写 API 使用根入口，不提供旧入口别名；格式类型直接从 Shared 导入。`antd/editor` 导出 `materialGroups`、`antdMaterialManifest` 与空的 `propertyEditors`；列与选项编辑器通过 editor-only custom 属性控件提供。

`runtime` 同时导出轻量的 `materialSet` 身份/版本，供按需加载时核对安装包；它与 Manifest 引用同一份包内声明，不会因此加载编辑配置。

根入口显式导出 `src/` 下全部公共 API：物料与属性配置类型、物料定义/转换、Manifest 辅助、运行属性适配、值类型、参数类型及 `cn`。根入口不汇总具体物料或编辑分组；包内模块仍直接引用内部实现，避免反向依赖根入口。运行组件、编辑器配置和纯数据入口分别服务不同消费者，不能合并成让 Server 加载 React 的总入口。单个物料的组件、清单和配置放在 `antd/<material>/`；公共声明辅助位于 `antd/manifest-definition.ts`。

消费页面需要 Ant Design 样式及 Tailwind；Tailwind v4 应通过 `@source` 显式扫描已安装的 `@origamix/materials/dist`。App 与生成项目模板已配置各自的源码/安装包路径。

物料注册键、Manifest 和 Schema 的 `type` 必须一致。删除物料或改名时同步更新相关契约与调用方，不保留历史别名或旧格式转换。

## 开发与发布

在仓库根目录：

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

tsup 输出到 `dist/`；根 `pnpm package:npm` 构建并生成 tarball。工作区和发布包统一消费 `dist` 中的 JavaScript 与类型声明，两套出口保持一致。根 `pnpm typecheck` 会先构建 Materials；单独运行 App、Server 的类型检查前，先执行 `pnpm --filter @origamix/materials build`。Shared 的代码与类型均内联，不成为安装依赖。React、Ant Design 为运行 peer dependencies；`@origamix/ui` 和 Tangramino base-editor 为可选编辑 peer，编辑宿主显式安装，纯运行项目无需安装。模板自身使用 HeroUI 基础控件。

维护约束见 [AGENTS.md](AGENTS.md)。

## 添加或扩展物料

以已经迁移的按钮物料为参考，按以下顺序维护同一份类型和默认值：

1. 在 `antd/<material>/index.tsx` 编写 Ant Design 适配组件，参考 [按钮组件](antd/button/index.tsx)。使用包内运行属性契约，剥离引擎注入属性，避免传入 DOM。
2. 在 `manifest.ts` 使用 `defineManifest({ ... })` 定义稳定的 `type`、默认值、上下文和属性 Schema，参考 [按钮清单](antd/button/manifest.ts)。版本统一来自 [material-set.ts](antd/material-set.ts)，每个组件不单独声明版本。
3. 在 `material-config.ts` 使用 `defineMaterial({ manifest, Component, editorConfig, isContainer })` 一次装配，参考 [按钮编辑配置](antd/button/material-config.ts)。无需中间定义或转换；标题、类型、默认值和上下文直接来自 Manifest。组件和自定义渲染函数不进入 Manifest。
4. 将运行组件加入 [antd/runtime.ts](antd/runtime.ts)，编辑配置加入 [antd/editor.ts](antd/editor.ts)，清单加入 [antd/manifest.ts](antd/manifest.ts)。三处类型必须一致；已有但未向编辑器开放的类型不应顺手移除。
5. 运行包检查与根检查，在编辑器、预览和生成项目中验证属性、上下文及亮暗主题。自动测试只补已有清单一致性场景中的必要约束。

转换辅助的公开导入方式：

```ts
import { defineMaterial } from '@origamix/materials';
```

Server 仅消费 Manifest，不能让清单入口通过组件或编辑配置间接加载 React。新增类型可以扩展注册表；重命名或删除已有类型必须同时考虑保留的 Working、历史 Revision 和生成项目。

## 属性、事件与运行状态

完整字段清单见 [Ant Design 配置契约](antd/CONFIGURATION-PLAN.md)。属性面板只配置选定的基础类型和中文枚举；原生 ReactNode、style/classNames、函数和回调不放入普通属性控件。Button.text、Text.text、Upload.text 等是物料自己声明的字符串文案。布局容器保留其内部 margin/padding 数据能力，但普通面板不提供 CSS 样式编辑入口。

Manifest.context.variables 是逻辑流**读取**白名单，context.writable 是独立的**写入运行状态**白名单，context.values 中 isMethod=true 才是可调用方法，context.methods 是事件入口。propsSchema 只描述设计期配置，不自动成为读写能力。Button 可读 text/loading，Input 只可读 value。Editor、Server 与 Runtime 均遵循该边界。

事件在独立面板显示中文名称与真实属性名。linkageShow 默认 AND；确有组合模式的控件显式使用 linkageMode=any。隐藏控件或事件不静默删除配置和已有绑定。复杂编辑器可折叠，使用本地草稿、确认更新和取消；确认沿用同一 Working 更新通路。

## 结构化配置

- Table：专用列编辑器和按列录入的数据编辑器。列支持稳定 key、字段、标题、宽度、对齐、固定、省略、隐藏、增删与排序；数据单元格仅文本、数字、布尔值或 null。分页只有 pagination:false 或分页对象一处配置，开关派生自它；分页开启、简洁模式控制字段显隐。当前为本地分页，total 来源于完整数据长度。运行时将配置的 position 转为当前 Ant Design placement，onChange 先同步页码和每页条数再执行流。
- Checkbox/Radio/Select：选项编辑器支持名称、明确类型的值、逐项禁用、增删和排序；Select 仅 string/number，Checkbox/Radio 也支持 boolean。默认选中值与选项结构分开，不使用 isDefault。
- Tree/TreeSelect/Cascader：各自的树状数据模型编辑器；Tree 的初始选中、勾选和展开键从已配置节点中选择。重复键、失效引用应修正后再保存。
- Tabs：文本页签模型编辑器；画布子内容用公共 tabKey 关联父级页签。未指定时归第一页；Server 拒绝失效归属，运行时不允许删除仍含画布子内容的页签。editable-card 的增删只改变运行态。
- Form：字段初始值结构化编辑器。输入物料用 fieldName/fieldLabel/fieldRequired 绑定到具名 Form.Item；必填规则由适配器实现，不把验证函数写入 Schema。公开 validateFields/resetFields/setFieldsValue 方法，支持 onValuesChange/onFinish/onFinishFailed。

日期和时间的配置与可读值使用规范字符串，Dayjs 只存在于原生控件边界；日期范围清空为 [null,null]，单值日期/时间清空为 null。展示 format 不改变业务值类型。范围、Slider、Radio 按钮风格、Form 布局、分页和浮层的模式字段均有对应显隐。

Upload 无 action 时只选择文件，不发送请求；流只能读取文件描述投影，不包含 File/Blob/xhr。onRemove 是允许移除的通知，不承诺逻辑流异步取消。原生 title、footer、icon、装饰节点等不通过文本输入伪装成基础类型。

## 运行时接入

runtime.ts 用 registerRuntimeMaterial 绑定物料能力、初始值、业务事件投影和字段边界；它不导入 Editor/UI。Runtime 注入 tg_setRuntimeState 与 tg_setContextValues，业务值先同步后调用事件。当前事件通过 event.payload 读取，异步调用各自保留快照。

输入的本地状态与运行时读值投影同步，不因每次输入重建 Engine 组件；逻辑流主动写值才更新对应渲染元素。字段方法及程序写值同步 Form 和控件投影。这些都是临时运行态，不会写 Working、创建 Revision 或 Apply。

basicPage 作为 rootMaterials/rootManifests 单独导出：App 注册到 Editor 和校验目录，但不加入拖入物料组。FloatButton 仍不注册。本次配置收敛不重写已有项目：删除的属性或旧枚举值在后续编辑校验时会给出明确错误，不能静默转换或覆盖原文件。

物料运行、清单与编辑入口保持分离；清单可序列化，生成项目不需要 editor-only peers。修改后必须先构建 Materials，再组装 Server/Desktop 并重载受检环境；验收见各包 AGENTS.md。

## 契约版本

所有内置物料、物料集、Materials、Runtime 与 Template 随 Origamix 统一发布，版本由 Shared 的 `ORIGAMIX_VERSION` 提供；旧 Schema 通过 Server 迁移链转换，物料运行组件只处理当前契约。项目清单只记录一个版本及物料集 ID，Manifest、编辑器、运行时与生成模板使用同一套当前契约。页面字段与能力仍按 Manifest 校验。
