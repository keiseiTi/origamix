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

消费页面需要 Ant Design 样式及 Tailwind；Tailwind v4 应通过 `@source` 显式扫描已安装的 `@origamix/materials/dist`。App 与生成项目模板已配置各自的源码/安装包路径。

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

## 基础物料属性配置

按钮、输入框、文本域、数字框、开关、文本及选项类物料保持一个“属性”面板，配置与 Manifest、组件适配同步维护。实际支持字段以当前安装版本和 Manifest 为准。

Button 使用 `type`，不提供 `color` 或 `variant`；`target` 配置声明依赖非空 `href`。其他联动条件通过 `linkageShow` 声明，不新增独立插件。属性面板的下拉选项显示 `label`，Schema 保存 `value`；选择默认项时移除对应可选属性。

Checkbox.Group、Select、Radio.Group 的 `options` 编辑控件暂不开放，已有默认选项及页面数据继续保留。回调与实例方法不作为本轮属性配置；已有事件声明保留，避免破坏历史绑定。基础输入的数组/对象高级编辑、图标、数字高精度字符串模式及函数型格式化不在本轮新增范围。

## 复杂输入属性配置

日期、时间、日期范围、级联、树选择、上传和滑块同样使用单一属性面板。日期初始值/日期上下限保存为 `YYYY-MM-DD` 字符串（也可使用 `YYYY-MM-DD HH:mm:ss`）；时间初始值使用 `HH:mm:ss` 或 `HH:mm`，组件在渲染时转换为 Day.js 对象，不把日期对象持久化到 Schema。非法字符串不传入 Ant Design 日期组件，应按字段标明的格式填写。

范围日期分别配置初始开始/结束、占位符与允许为空，运行时转换为 Ant Design 的成对属性，保留旧 `placeholder` 数据。滑块支持单值和范围模式、独立初始上下限、范围拖动和提示设置，模式相关字段通过 `linkageShow` 声明。

上传提供默认文件选择入口，`drag` 切换为 Dragger。没有 `action` 时只选择文件，不发起上传；配置上传地址后由组件执行普通上传请求，不使用桌面凭据。请求头、额外参数、文件列表和自定义回调不在本轮新增编辑控件范围内；已有对象属性仍保留兼容。上传地址沿用 Server 的安全 URL 校验。

级联 `options` 与树选择 `treeData` 的结构化编辑器本轮暂缓；已有层级数据可继续渲染与保存，Manifest 校验递归节点结构。函数型禁用日期/时间、异步加载节点、自定义渲染和高级刻度数据编辑仍不作为普通属性开放。

## 结构与展示属性配置

表单、表格、树、Tabs、Modal 和 Drawer 继续使用单一“属性”面板；容器和根页面配置保持现状。Tabs 已同时接入编辑器、纯数据清单和运行注册表。

表单支持布局、栅格跨度、标签、禁用、必填标记、校验触发时机、控件外观及初始字段值。表格支持列、数据、分页、滚动、固定表头、尺寸与空数据提示。树支持节点数据、默认展开/选中/勾选键、复选框、多选、虚拟滚动及高度。分页、勾选与水平布局等相关字段使用 `linkageShow` 声明显隐。初始字段值和校验依赖原生具名 `Form.Item`；本轮不自动为 Schema 子控件生成字段绑定或校验规则。

结构化字段使用 JSON 数据编辑入口：编辑文本后点击“更新…”才进入画布和 Working 流程；语法或基础结构错误会提示并保留输入。表格列需要文本 `title` 与 `dataIndex`，可配置 `key`、数字 `width`、`align`、`fixed`、`ellipsis` 和 `hidden`；表格数据编辑入口支持对象数组，单元格值限于文本、数字、布尔值或 `null`。树节点需要唯一 `key` 和文本 `title`，通过 `children` 嵌套。Tabs 页签需要唯一文本 `key` 与文本 `label`，可配置纯文本 `children`、禁用、关闭与销毁行为；Schema 中拖入 Tabs 的子元素归属第一个页签，不支持按页签分别绑定 Schema 子树。完整候选仍由 Server 的 Manifest 校验后保存。

Modal 支持显示状态、标题、宽度、底部按钮、遮罩、关闭、加载及销毁；Drawer 支持位置、预设/自定义尺寸、顶部辅助文本、底部文本、拖动调整尺寸与嵌套推开行为。Drawer 自定义尺寸使用当前 Ant Design `size` 适配，旧 `width`/`height` 数据保留。编辑模式将浮层限制在组件区域内并停用焦点锁定、遮罩及 Esc 捕获，关闭时仍提供可选中/拖入的占位区域；运行模式使用原生浮层行为。关闭、确定等动作仍由运行时的受控 `open` 与回调处理，属性面板不配置回调或实例方法。浮层占位及展示组件使用所在项目的 Ant Design 主题令牌，不读取工作台的亮暗偏好。
