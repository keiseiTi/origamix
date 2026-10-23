# Ant Design 物料配置梳理

> 2026-10-22；已按清单完整实施。第 7 节保留实施前的差距核对记录；下方实施说明及源码代表本次结果。依据是本目录的 Manifest、material-config、组件适配器，以及本地安装的 Ant Design **6.6.2** 类型声明；不以历史规划或最新网站文档替代当前依赖的实际 API。

## 1. 配置边界

一个物料需要分别列出四类能力，不能用同一张 props 表自动生成所有入口：

| 类别         | 作用                                   | 规则                                                                      |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------- |
| 属性面板     | 页面设计时配置初始行为、文案和结构     | 精选 string、number、boolean 和基础类型枚举；不是把所有基础类型都暴露出来 |
| 结构化配置   | 表格列、分页、选项、树、页签、初始数据 | 明确数据模型，使用专用编辑器；不能直接放任意对象、组件或函数              |
| 事件         | 绑定逻辑流入口                         | 单独白名单，例如 Button.onClick、Input.onChange；不作为普通属性输入       |
| 逻辑流上下文 | 读取业务值或修改运行状态               | 可读、可写、可调用方法分别限定；不自动包含所有面板属性                    |

统一排除普通属性面板中的：

- `style`、`styles`、`className`、`classNames`、`rootClassName`、各部位 CSS、颜色值和 CSS 表达式。保留组件自身明确的 `size`、`type`、`block` 等基础行为属性；容器的尺寸另按布局职责处理。
- 原生 `ReactNode`、组件类型、图标、`ref`、实例、DOM、渲染函数、任意函数及回调；不因 `ReactNode` 包含 string 就将其认定为基础类型。
- `on*` 事件、`render`、`formatter`、`parser`、`filterOption`、`filterTreeNode`、`disabledDate`、`loadData`、`beforeUpload`、`customRequest`、`getPopupContainer` 等；必要事件只在事件区出现。
- 内部 `prefixCls`、引擎注入字段、自动聚焦等平台细节、重复别名和已废弃入口。不镜像 DOM 的全部基础属性。

**物料自己的业务文本是独立的基础类型字段**：如已有的 Button.text、Text.text、Upload.text、Table.emptyText，以及专用列/选项/页签模型中的字符串标题。它们不等于开放原生 `children`、`title`、`label` 等任意 ReactNode。原生 Modal.title/okText/cancelText、Drawer.title/extra/footer、Switch.checkedChildren/unCheckedChildren、Input.prefix/suffix/addonBefore/addonAfter 本轮不直接配置；如果需要保留这些文案入口，应另行明确物料级 string 字段与映射，不能仅在 Schema 中把原生类型改写成 string 后宣称符合筛选规则。

`alias` 是共用的元素识别信息，保留在属性面板，但不进入逻辑流业务读写白名单。`init` 是共用生命周期事件，与 Ant Design 自身事件分开，不逐个物料重复扩展。

## 2. 全量物料与建议属性面板

下表是本次实施的目标白名单。未列出的原生属性默认不开放；结构化配置见下一节；共用 `alias` 不重复列出。`s/n/b` 分别表示 string/number/boolean，`e` 表示带中文标签的枚举。带 `*` 的字段是物料封装字段，不是直接照搬的 Ant Design 原生属性。

### 操作、文本与输入

| 目录 / Schema type  | 建议基础配置                                                                                                                                                                                                                             | 结构化配置 / 特殊约束                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| button / button     | `text*:s`、`type:e`、`htmlType:e`、`size:e`、`shape:e`、`disabled:b`、`loading:b`、`danger:b`、`ghost:b`、`block:b`、`href:s`、`target:e`                                                                                                | loading 只开放 boolean 分支，不开放延迟或自定义图标对象；href 非空才显示 target；不配置 children/icon                                                             |
| text / text         | `text*:s`、`type*:e`、`textType*:e`、`strong:b`、`italic:b`、`underline:b`、`delete:b`、`code:b`、`mark:b`、`disabled:b`、`copyable:b`、`ellipsis:b`                                                                                     | 只开放 copyable/ellipsis 的 boolean 分支；不开放 editable（现有面板也未配置，但 Manifest/上下文仍有）                                                             |
| input / input       | `defaultValue:s`、`placeholder:s`、`type:e`、`size:e`、`disabled:b`、`readOnly:b`、`allowClear:b`、`maxLength:n`、`showCount:b`、`status:e`、`variant:e`、`autoComplete:e`                                                               | allowClear/showCount 仅 boolean；移除 prefix/suffix/addonBefore/addonAfter                                                                                        |
| textarea / textarea | `defaultValue:s`、`placeholder:s`、`rows:n`、`autoSize:b`、`minRows*:n`、`maxRows*:n`、`disabled:b`、`readOnly:b`、`allowClear:b`、`maxLength:n`、`showCount:b`、`status:e`、`variant:e`、`size:e`                                       | autoSize 开启才显示 minRows/maxRows，并映射到原生 autoSize 对象；关闭才显示 rows；已补齐 minRows/maxRows 封装                                                     |
| number / number     | `defaultValue:n或null`、`min:n`、`max:n`、`step:n`、`precision:n`、`decimalSeparator:s`、`placeholder:s`、`size:e`、`disabled:b`、`readOnly:b`、`controls:b`、`keyboard:b`、`changeOnWheel:b`、`changeOnBlur:b`、`status:e`、`variant:e` | min≤max、step>0、precision 为非负整数；移除 prefix/suffix/addonBefore/addonAfter、formatter/parser；现有 Manifest 的 allowClear 不能当作已核实的 InputNumber 能力 |
| checkbox / checkbox | `disabled:b`、`name:s`                                                                                                                                                                                                                   | options 专用编辑器；它是 Checkbox.Group，不暴露单 Checkbox 的 checked/indeterminate                                                                               |
| radio / radio       | `disabled:b`、`name:s`、`optionType:e`、`buttonStyle:e`、`size:e`、`block:b`、`orientation:e`                                                                                                                                            | options 专用编辑器；按钮模式才显示 buttonStyle/size；移除 optionDisplayButton 重复开关                                                                            |
| select / select     | `placeholder:s`、`mode:e`、`size:e`、`disabled:b`、`allowClear:b`、`showSearch:b`、`loading:b`、`status:e`、`variant:e`、`maxTagCount:n`、`listHeight:n`、`virtual:b`、`placement:e`                                                     | options 专用编辑器；多选/标签模式才显示 maxTagCount；showSearch 仅 boolean 分支                                                                                   |
| switch / switch     | `defaultChecked:b`、`disabled:b`、`loading:b`、`size:e`                                                                                                                                                                                  | 不开放 checkedChildren/unCheckedChildren；不同时配置 checked/value、defaultChecked/defaultValue 两套别名                                                          |
| slider / slider     | `min:n`、`max:n`、`step:n`、`range:b`、`defaultValue:n`、`defaultStart*:n`、`defaultEnd*:n`、`disabled:b`、`keyboard:b`、`reverse:b`、`vertical:b`、`dots:b`、`included:b`、`draggableTrack*:b`、`tooltipMode*:e`、`tooltipPlacement*:e` | range 开关决定默认值控件；draggableTrack 只在 range 下出现；tooltip 隐藏时隐藏位置；不配置 tooltip.formatter/marks 的 ReactNode                                   |
| upload / upload     | `text*:s`、`listType:e`、`maxCount:n`、`multiple:b`、`disabled:b`、`drag*:b`、`showUploadList:b`、`accept:s`、`action:s`、`method:e`、`name:s`、`directory:b`、`openFileDialogOnClick:b`、`pastable:b`                                   | 请求方式仅在 action 非空时显示；headers/data 不作为任意 JSON 属性输入；没有 action 时保持手动选择、不自动发送文件                                                 |

### 日期、时间、层级选择

| 目录 / Schema type                  | 建议基础配置                                                                                                                                                                                                                                                                                                            | 结构化配置 / 特殊约束                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| date-picker / datePicker            | `picker:e`、`format:s`、`placeholder:s`、`defaultValue:s`、`showTime:b`、`showNow:b`、`inputReadOnly:b`、`needConfirm:b`、`minDate:s`、`maxDate:s`、`size:e`、`disabled:b`、`allowClear:b`、`status:e`、`variant:e`、`placement:e`                                                                                      | 日期/时间输入需校验；showTime 仅日期模式显示；showNow 仅对应支持的模式显示；format 是展示格式，不是状态存储格式                       |
| date-picker-range / datePickerRange | `picker:e`、`format:s`、`startPlaceholder*:s`、`endPlaceholder*:s`、`defaultStart*:s`、`defaultEnd*:s`、`showTime:b`、`allowEmptyStart*:b`、`allowEmptyEnd*:b`、`inputReadOnly:b`、`needConfirm:b`、`order:b`、`minDate:s`、`maxDate:s`、`size:e`、`disabled:b`、`allowClear:b`、`status:e`、`variant:e`、`placement:e` | 不提供原生 placeholder 数组的第二套编辑入口；范围值按双值模型处理；不因单日期支持 showNow 就自动向范围组件开放                        |
| time-picker / timePicker            | `format:e`、`placeholder:s`、`defaultValue:s`、`use12Hours:b`、`hourStep:n`、`minuteStep:n`、`secondStep:n`、`hideDisabledOptions:b`、`showNow:b`、`inputReadOnly:b`、`needConfirm:b`、`size:e`、`disabled:b`、`allowClear:b`、`status:e`、`variant:e`、`placement:e`                                                   | 步长为正整数；format 与 use12Hours 一致；hideDisabledOptions 没有禁用规则来源时不展示，不为此增加函数配置                             |
| tree-select / treeSelect            | `placeholder:s`、`multiple:b`、`treeCheckable:b`、`treeCheckStrictly:b`、`showSearch:b`、`treeNodeFilterProp:e`、`treeDefaultExpandAll:b`、`treeLine:b`、`virtual:b`、`listHeight:n`、`maxTagCount:n`、`showCheckedStrategy:e`、`size:e`、`disabled:b`、`allowClear:b`、`status:e`、`variant:e`、`placement:e`          | treeData 专用树编辑器；treeCheckStrictly/showCheckedStrategy 依赖勾选模式；maxTagCount 依赖有效多选；不配置 labelInValue              |
| cascader / cascader                 | `placeholder:s`、`multiple:b`、`showSearch:b`、`changeOnSelect:b`、`expandTrigger:e`、`showCheckedStrategy:e`、`maxTagCount:n`、`loading:b`、`size:e`、`disabled:b`、`allowClear:b`、`status:e`、`variant:e`、`placement:e`                                                                                             | options 专用树编辑器；changeOnSelect 仅单选显示；showCheckedStrategy/maxTagCount 仅多选显示；不配置 fieldNames/loadData/displayRender |

### 数据展示、容器与浮层

| 目录 / Schema type         | 建议基础配置                                                                                                                                                                                                                                     | 结构化配置 / 特殊约束                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| table / table              | `rowKey:s`、`size:e`、`bordered:b`、`loading:b`、`showHeader:b`、`tableLayout:e`、`scrollX*:n`、`scrollY*:n`、`sticky:b`、`emptyText*:s`                                                                                                         | columns、pagination、dataSource 分别处理；不提供 render、onRow、rowClassName、components、title/footer ReactNode 或函数                                                                                          |
| tree / tree                | `checkable:b`、`checkStrictly:b`、`multiple:b`、`selectable:b`、`disabled:b`、`defaultExpandAll:b`、`defaultExpandParent:b`、`autoExpandParent:b`、`showLine:b`、`blockNode:b`、`virtual:b`、`height:n`                                          | treeData 与默认键数组用专用编辑器；checkStrictly/默认勾选依赖 checkable；默认选中依赖 selectable；本阶段不开放 draggable（缺少受控树重排闭环）或无配套图标配置的 showIcon                                        |
| tabs / tabs                | `defaultActiveKey:s`、`type:e`、`size:e`、`tabPlacement:e`、`tabBarGutter:n`、`centered:b`、`animated:b`、`destroyOnHidden:b`、`hideAdd:b`                                                                                                       | items 专用编辑器；hideAdd 仅 editable-card 下出现；动态增删必须与 onEdit 闭环后才开放，不能只显示无行为的添加按钮                                                                                                |
| form / form                | `name:s`、`layout:e`、`size:e`、`labelAlign:e`、`labelColVal*:n`、`wrapperColVal*:n`、`labelWrap:b`、`colon:b`、`disabled:b`、`preserve:b`、`requiredMark:e`、`scrollToFirstError:b`、`validateTrigger:e`、`variant:e`、`clearOnDestroy:b`       | initialValues 用字段初始值编辑器；水平布局才显示栅格跨度与冒号；不能把 Form 容器的存在当作已有具名 Form.Item 绑定                                                                                                |
| modal / modal              | `open:b`、`width:n`、`centered:b`、`closable:b`、`mask:b`、`maskClosable*:b`、`keyboard:b`、`loading:b`、`showFooter*:b`、`okType:e`、`confirmLoading:b`、`okDisabled*:b`、`cancelDisabled*:b`、`forceRender:b`、`destroyOnHidden:b`、`zIndex:n` | mask 关闭时隐藏 maskClosable；showFooter=false 隐藏确定/取消按钮配置；原生 title/okText/cancelText 排除；mask/closable 等只开放简单分支，maskClosable 映射需跟随当前 API                                         |
| drawer / drawer            | `open:b`、`placement:e`、`size:e`、`customSize*:n`、`closable:b`、`mask:b`、`maskClosable*:b`、`keyboard:b`、`loading:b`、`resizable:b`、`push:b`、`forceRender:b`、`destroyOnHidden:b`、`zIndex:n`                                              | 自定义尺寸模式才显示 customSize；左右位置对应宽度、上下位置对应高度；原生 title/extra/footer 排除；resizable/push 只开放 boolean 分支                                                                            |
| container / container      | `heightConfig*:e`、`height:n`                                                                                                                                                                                                                    | 物料布局封装，非 Ant Design 组件；固定模式才显示 height；margin/padding 归布局样式能力，本轮不在普通物料属性面板扩充                                                                                             |
| basic-page / basicPage     | `display*:e`、`flexDirection:e`                                                                                                                                                                                                                  | 根页面的特殊配置，不在可拖入物料组；flex 模式才显示方向；margin/padding 同上；须先统一当前 Manifest 的 flow 与组件类型的 stream 用词                                                                             |
| float-button / floatButton | 若后续启用：`type:e`、`shape:e`、`disabled:b`、`href:s`、`target:e`、`htmlType:e`                                                                                                                                                                | 目前不在 editor/runtime/Manifest 聚合注册表中，本轮只盘点、不顺带启用。排除原生 content/description/icon/tooltip；现有 placement/danger 配置不能据此认定为原生 FloatButton 能力；移除组件自定义颜色/边框样式入口 |

纯基础字段不意味着都放在第一屏：尺寸、状态、行为可分组折叠，但不增加每个物料都不一样的通用属性框架。

## 3. 专用编辑器与联动规则

### 3.1 Table 列

必须使用专用列编辑器；保留上一轮已接入的字段，继续按以下模型收敛：

| 字段              | 类型 / 中文选项                          | 校验 / 行为                                             |
| ----------------- | ---------------------------------------- | ------------------------------------------------------- |
| title             | string，列标题                           | 必填；这是列模型的文本，不是原生任意 ReactNode          |
| dataIndex         | string，数据字段                         | 必填；本阶段不支持函数或复杂路径编辑                    |
| key               | string，可选稳定标识                     | 未填回退 dataIndex；有效 key 唯一；排序不改写业务 key   |
| width             | number，可选列宽                         | 有限正数；清空移除，不存 null                           |
| align             | left 左对齐 / center 居中 / right 右对齐 | 未配置使用原生默认                                      |
| fixed             | 不固定 / left 固定左侧 / right 固定右侧  | 简化成 false/left/right；不提供与 left 重复的 true 选项 |
| ellipsis / hidden | boolean，超出省略 / 隐藏列               | 隐藏不删除数据字段                                      |

支持新增、编辑、删除、上下排序、取消未提交修改、确认整体更新；未完成或非法行不得漏进一次看似成功的提交。自定义 render、ReactNode、排序/筛选函数不开放。未来若要排序/筛选，需单独设计声明式列能力与 Table.onChange 参数，不混入本轮普通列配置。

### 3.2 Table 分页

**目标数据只有 `pagination: false | PaginationConfig` 一处权威配置。** 不再让 enabledPagination、独立 pageSize 等字段与 pagination 对象同时覆盖彼此。当前代码仍是多字段合并，此处是后续调整目标，不能在实现时静默忽略已保存的数据。

| 控件 / 字段                 | 类型                         | 显隐 / 说明                                                                      |
| --------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| 开启分页（UI 开关）         | boolean，派生控件            | false 写 pagination=false；true 构造分页对象；不另存第二个 enabledPagination     |
| pagination.pageSize         | positive integer，每页条数   | 开启分页时显示                                                                   |
| pagination.current          | positive integer，初始页码   | 开启分页时显示；运行时翻页后变为当前页，不只读取初始 Schema                      |
| pagination.total            | non-negative integer，总条数 | 区分本地与远程分页；本地取完整数据长度，远程由请求结果更新，不盲目让两个来源竞争 |
| pagination.position         | 位置枚举                     | 开启分页时显示；本阶段一个位置，适配成 Ant Design 的数组形式                     |
| pagination.hideOnSinglePage | boolean，单页隐藏            | 开启分页时显示                                                                   |
| pagination.showQuickJumper  | boolean，快速跳页            | 开启分页且非简洁模式时显示                                                       |
| pagination.showSizeChanger  | boolean，切换每页条数        | 开启分页且非简洁模式时显示                                                       |
| pagination.simple           | boolean，简洁分页            | 开启分页时显示                                                                   |

本阶段默认按**本地分页**定义；不因加了 total 字段就声称已实现远程分页。后续远程分页需要明确数据是当前页、current/pageSize/total 由谁更新，以及是否交由 Table 自动切片。

复用参考 attribute-panel 的规则语义：多条 linkageShow 按 AND 判断；明确的 value 用严格相等；isNotEmpty 排除 null/undefined、空白字符串和空数组，false/0 本身不算空。评估数据合并物料默认值和当前值；切换后立即重算。嵌套 pagination 字段在专用组件内按同样规则处理，不能假定现有根属性比较器已经支持点路径。

隐藏只改变编辑入口，不自动清空字段；但输出时须按启用模式规范化。例如分页关闭输出 false，Slider 单值模式不把范围默认值传给原生组件。必要的跨字段变化必须一次提交，不产生部分 Working 更新。

### 3.3 其他结构化数据

| 物料                         | 专用模型 / 编辑器                                                                          | 不开放的复杂分支                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checkbox / Radio / Select    | 选项 label 为 string；value 有明确类型；可增删、排序、禁用；值唯一                         | 不配置 optionRender、ReactNode label、JSX、函数。Checkbox/Radio 值为 string/number/boolean；Select 为 string/number。逐项 disabled 是建议补齐的 boolean 字段，当前 Manifest 尚未声明 |
| Tree / TreeSelect / Cascader | 层级节点编辑器，节点键/值、文本标题、禁用、子节点；字段名按各组件模型区分                  | 不共享一个不分组件的任意对象模型；TreeSelect 只用 treeData，移除无效 options 第二入口；不配置 ReactNode 图标、动态加载函数                                                           |
| Tree 默认选中/勾选/展开      | 从已配置节点中多选 key，保留 key 类型                                                      | 不要求用户手写未经约束的数组；节点移除后的引用须提示修正                                                                                                                             |
| Tabs                         | items 的稳定 key、文本 label、disabled、closable；内容由明确的文本字段或画布子内容绑定管理 | 不开放 ReactNode label/icon；当前所有 Schema 子元素只落到第一页，尚不支持按 key 归属，不能把这个缺口当作已有能力                                                                     |
| Form                         | 已绑定字段对应的 initialValues 结构化编辑                                                  | 不配置 FormInstance、规则函数或任意验证组件；先补具名字段绑定，不能只增加初始值界面                                                                                                  |
| Table 数据                   | 按列字段录入的临时/静态数据；数据源也可由逻辑流更新                                        | 不把任意组件或函数作为单元格值；整批确认后才更新 Working                                                                                                                             |

默认选中值与选项结构分开：选项编辑器不引入未实现的 isDefault，也不偷偷重写已有表单值。后续需要默认值入口时使用组件语义明确的 defaultValue/defaultChecked 或已绑定字段的 initialValues，避免多个权威默认值。

## 4. 事件白名单与业务状态

下表是本次已落实的事件白名单。除共用 init 外，未列事件暂不开放。事件入口显示中文名称及实际属性名，例如“分页变化（onChange）”。原生参数只用于说明适配依据；给逻辑流的数据需提取业务值，不把 DOM、React SyntheticEvent、Dayjs、组件实例或函数当作上下文值。

| 物料                  | 建议事件                                                                      | 必须能消费的业务信息 / 约束                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                | onClick 点击                                                                  | 点击前可读本按钮 text、loading；无需暴露 DOM 点击对象                                                                                                                                                          |
| Input                 | onChange 值改变；onPressEnter 回车                                            | 最新 value:string；先同步值再触发流；中文输入法组合态回车不能误触发提交                                                                                                                                        |
| Textarea              | onChange 值改变；onPressEnter 回车                                            | 最新 value:string；回车事件与是否保留换行是两回事，不默认阻止换行                                                                                                                                              |
| Number                | onChange 值改变；onPressEnter 回车                                            | value:number\|null；不开放 stringMode 后又把值当 number                                                                                                                                                        |
| Checkbox.Group        | onChange 选择变化                                                             | value:选项值数组；空选择为 []                                                                                                                                                                                  |
| Radio.Group           | onChange 选择变化                                                             | 从 event.target.value 提取 value；0、false 不能被当作空值                                                                                                                                                      |
| Select                | onChange 选择变化                                                             | 单选 scalar\|null；multiple/tags 为数组；清空归一；onSearch 等后续按具体需求增加                                                                                                                               |
| Switch                | onChange 开关变化                                                             | checked:boolean；不重复增加同义的 onClick                                                                                                                                                                      |
| Slider                | onChange 拖动值变化；onChangeComplete 调整完成                                | 单值 number / 范围 [number,number]；请求类行为优先绑定完成事件，避免每次拖动都请求                                                                                                                             |
| DatePicker            | onChange 日期变化；onOk 确认（需要确认的模式）                                | 归一后的日期字符串或 null，不依赖格式化展示文本反向解析                                                                                                                                                        |
| DatePickerRange       | onChange 范围变化；onOk 确认（需要确认的模式）                                | 固定双值范围，允许单边为空；整组清空有明确表示；不把尚未确定的 calendarChange 当最终值                                                                                                                         |
| TimePicker            | onChange 时间变化；onOk 确认（需要确认的模式）                                | 归一后的时间字符串或 null                                                                                                                                                                                      |
| TreeSelect            | onChange 选择变化                                                             | 单选 scalar\|null / 多选数组；treeCheckStrictly 的原生 labelInValue 结果需转为业务值，不能把对象误当标量                                                                                                       |
| Cascader              | onChange 选择变化                                                             | 单选一条路径 / 多选路径数组；不把路径数组与 Select 多选的一维数组混同                                                                                                                                          |
| Upload                | onChange 文件列表/上传状态变化；onRemove 移除请求                             | 仅文件描述投影 uid/name/status/percent/url 等；不暴露 File/Blob/xhr。onRemove 的异步允许/拒绝语义当前流返回通道不能直接保证，本次固定允许移除并通知；可取消删除能力需单独闭环                                  |
| Table                 | **onChange 表格变化（本阶段分页）**                                           | 原生签名 (pagination, filters, sorter, extra)；分页由 Table 适配器单独提取 current/pageSize，先更新运行态，再触发流；pageSize 改变时页码归一；过滤/排序未开放时不伪造其配置能力；不新增与它重复的 onPageChange |
| Tree                  | onSelect 选中；onCheck 勾选；onExpand 展开/收起                               | selectedKeys/checkedKeys/expandedKeys；checkStrictly 下原生 checkedKeys 对象需提取 checked；onDrop 先不开放，待树重排闭环                                                                                      |
| Tabs                  | onChange 激活项改变；onEdit 编辑请求（仅 editable-card）                      | activeKey；onEdit 提取 action:add/remove 与 targetKey，完成 items/内容归属与焦点处理后才称支持动态编辑                                                                                                         |
| Form                  | onValuesChange 字段值变化；onFinish 校验成功提交；onFinishFailed 提交校验失败 | 最新字段值、变化字段、结构化错误信息；成功提交不能由 Button.onClick 代替                                                                                                                                       |
| Modal                 | onOk 确定；onCancel 取消/关闭请求；afterOpenChange 可见状态改变完成           | open:boolean、关闭原因等纯数据；确认不自动等于保存/Apply；onCancel 不等于动画已结束；若没有绑定取消处理，适配器应有可关闭的默认行为                                                                            |
| Drawer                | onClose 关闭请求；afterOpenChange 可见状态改变完成                            | open:boolean；关闭请求与关闭完成区分；默认关闭行为明确                                                                                                                                                         |
| Text                  | onClick 点击文本                                                              | text:string；不引入 editable 的编辑事件系列                                                                                                                                                                    |
| Container / BasicPage | 无 Ant Design 业务事件；只有共用 init                                         | 布局职责，不开放所有 DOM 事件                                                                                                                                                                                  |
| FloatButton           | 若后续正式启用，仅 onClick 点击                                               | 当前不注册，不显示事件入口；不顺带增加 onMouseEnter 等 DOM 事件                                                                                                                                                |

事件入口也应随能力显隐：Tree.onCheck 依赖 checkable，Modal.onOk 依赖 showFooter，Tabs.onEdit 依赖 editable-card，日期/时间 onOk 依赖确认能力。隐藏事件入口不静默删除已有绑定；已有绑定失去前提时提示用户处理，不把事件从界面消失当作已迁移。

事件触发不是修改 Working：这些状态只作用于运行时页面，不能因用户输入、翻页或开关变化创建 Revision、Apply 或改写源 Schema。

## 5. 逻辑流可读属性白名单

这里只列需要“消费获取”的业务属性。其他面板属性不应自动成为可读候选。默认值是初始值，不是运行后可读值；输入、选择、分页后必须立即读到最新值。

| 物料                                | 建议可读属性                                                                   | 类型 / 说明                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Button                              | **text、loading**                                                              | string、boolean；移除 disabled 等其他读取候选                                                                                |
| Input / Textarea                    | **value**                                                                      | string；未输入也归一为字符串                                                                                                 |
| Number                              | value                                                                          | number\|null                                                                                                                 |
| Checkbox.Group                      | value                                                                          | (string\|number\|boolean)[]                                                                                                  |
| Radio.Group                         | value                                                                          | string\|number\|boolean\|null                                                                                                |
| Select                              | value                                                                          | string\|number\|null 或 (string\|number)[]，由模式决定                                                                       |
| Switch                              | checked                                                                        | boolean；不再重复 value                                                                                                      |
| Slider                              | value                                                                          | number 或 [number,number]                                                                                                    |
| DatePicker                          | value                                                                          | YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss 字符串\|null；week/month/quarter/year 按明确的日历值约定保存，不用展示 format 定义业务类型 |
| DatePickerRange                     | value                                                                          | [日期字符串\|null, 日期字符串\|null]；清空统一 [null,null]                                                                   |
| TimePicker                          | value                                                                          | HH:mm:ss 字符串\|null；12小时制仅为展示                                                                                      |
| TreeSelect                          | value                                                                          | string\|number\|null 或 (string\|number)[]；严格勾选模式也归一为同样业务类型                                                 |
| Cascader                            | value                                                                          | 路径 (string\|number)[] 或路径数组；清空统一 []                                                                              |
| Upload                              | fileList                                                                       | 文件描述数组；只含约定可序列化字段，不包含原生 File/Blob                                                                     |
| Table                               | dataSource、loading、pagination.current、pagination.pageSize、pagination.total | 数据行数组、boolean、分页数值；pagination=false 时分页字段不可读，逻辑流须先有启用分页的前提                                 |
| Tree                                | selectedKeys、checkedKeys、expandedKeys                                        | (string\|number)[]；原始 treeData 属于配置/数据写入，不默认加入业务读取候选                                                  |
| Tabs                                | activeKey                                                                      | string\|null；不默认加入 items 与全部展示属性                                                                                |
| Form                                | value                                                                          | Record<string, JSON值>，完整最新字段值；不保留 disabled 的读取入口                                                           |
| Modal / Drawer                      | open                                                                           | boolean；不默认加入 title、样式和全部按钮配置                                                                                |
| Text                                | text                                                                           | string；移除 type、underline、strong 等展示属性的读取入口                                                                    |
| Container / BasicPage / FloatButton | 无                                                                             | 没有明确业务读值，不因有属性就全部开放                                                                                       |

Table 的嵌套分页路径是建议的选择器能力；现有读取器能走点路径，但当前候选生成器不枚举此类嵌套业务字段，需后续补齐。禁用分页时不能读取不存在的字段并依赖 undefined 隐式继续。

**可写运行状态应另设白名单**，不把可读表复制过去：建议最小集合为 Button.text/loading、输入/选择类 value（Switch 为 checked）、Select.options/loading、TreeSelect.treeData、Cascader.options/loading、Table.dataSource/loading/pagination、Tree.treeData/selectedKeys/checkedKeys/expandedKeys、Tabs.activeKey/items、Modal/Drawer.open/loading、Text.text。Form 值写入应走其字段方法。基础输入的 disabled 等其他写入能力本轮不默认扩展；确有业务需求再单独补列。写运行态与设计期修改 Working 是不同操作。

Form.validateFields/resetFields/setFieldsValue 是可调用方法，不是事件或普通可读属性。当前上下文声明与组件实际注册的方法不完全一致，后续需独立对齐，不把方法对象放进属性面板。

## 6. 枚举的中文显示

枚举保存真实值，界面展示“中文名称”；可同时显示英文作为说明，例如“主要（primary）”。下面是本方案使用的选项，不强制把原生组件的所有枚举都引入。

| 字段 / 适用物料                                            | 建议显示与真实值                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 通用 size                                                  | 大 large / 中 medium / 小 small；本地 Ant Design 6.6.2 已将 middle 标为废弃，现有物料仍大量使用 middle。后续变更须同步 Schema、默认值、运行时与已有页面处理，不能只改下拉选项 |
| Switch.size                                                | 中 medium / 小 small；不继续新增 default/middle 两个旧别名                                                                                                                    |
| status                                                     | 默认（未配置）/ 错误 error / 警告 warning                                                                                                                                     |
| variant                                                    | 描边 outlined / 填充 filled / 无边框 borderless / 下划线 underlined                                                                                                           |
| Button.type / Modal.okType                                 | 默认 default / 主要 primary / 虚线 dashed / 链接 link / 文本 text；Modal 不采用旧 danger 类型，危险状态是独立 boolean                                                         |
| htmlType                                                   | 普通按钮 button / 提交 submit / 重置 reset                                                                                                                                    |
| Button.shape                                               | 默认（未配置）/ 圆形 circle / 圆角 round                                                                                                                                      |
| target                                                     | 当前页面 _self / 新窗口 _blank                                                                                                                                                |
| Input.type                                                 | 文本 text / 密码 password / 邮箱 email / 电话 tel / 网址 url                                                                                                                  |
| Input.autoComplete                                         | 开启 on / 关闭 off；不作为完整 HTML autocomplete token 编辑器                                                                                                                 |
| Radio.optionType / buttonStyle / orientation               | 单选框 default / 按钮 button；描边 outline / 填充 solid；横向 horizontal / 纵向 vertical                                                                                      |
| Select.mode                                                | 单选（未配置）/ 多选 multiple / 标签 tags；“未配置”不写成字符串 undefined                                                                                                     |
| 日期 picker                                                | 日期 date / 周 week / 月 month / 季 quarter / 年 year                                                                                                                         |
| TimePicker.format                                          | 时分秒 HH:mm:ss / 时分 HH:mm / 十二小时制 hh:mm:ss A；须与 use12Hours 联动                                                                                                    |
| 浮层 placement（Select/日期/时间/TreeSelect/Cascader）     | 左下 bottomLeft / 右下 bottomRight / 左上 topLeft / 右上 topRight                                                                                                             |
| TreeSelect.treeNodeFilterProp                              | 标题 title / 值 value；不让用户自由拼一个不存在的节点属性                                                                                                                     |
| TreeSelect.showCheckedStrategy                             | 全部 SHOW_ALL / 只显示父节点 SHOW_PARENT / 只显示子节点 SHOW_CHILD                                                                                                            |
| Cascader.expandTrigger / showCheckedStrategy               | 点击 click / 悬停 hover；父级合并 SHOW_PARENT / 只显示子节点 SHOW_CHILD                                                                                                       |
| Upload.listType / method                                   | 文本 text / 图片 picture / 图片卡片 picture-card / 图片圆形 picture-circle；POST post / PUT put / PATCH patch（与本地 UploadProps 的可用方法一致，只保留一套小写保存值）      |
| Slider.tooltipMode / tooltipPlacement                      | 自动 auto / 常显 always / 隐藏 hidden；上 top / 下 bottom / 左 left / 右 right                                                                                                |
| Table.tableLayout                                          | 自动 auto / 固定 fixed                                                                                                                                                        |
| Table.pagination.position                                  | 上左 topLeft / 上中 topCenter / 上右 topRight / 下左 bottomLeft / 下中 bottomCenter / 下右 bottomRight / 隐藏 none                                                            |
| Tabs.type / tabPlacement                                   | 线条 line / 卡片 card / 可编辑卡片 editable-card；上 top / 下 bottom / 起始侧 start / 结束侧 end（不把旧 left/right 同时提供成第二套入口）                                    |
| Form.layout / labelAlign                                   | 水平 horizontal / 垂直 vertical / 内联 inline；左对齐 left / 右对齐 right                                                                                                     |
| Form.requiredMark / validateTrigger                        | 显示必填 true / 隐藏 false / 显示可选 optional；值改变 onChange / 失去焦点 onBlur                                                                                             |
| Drawer.placement / size                                    | 左 left / 右 right / 上 top / 下 bottom；默认 default / 大 large / 自定义（UI 模式，映射数值 customSize，不把 custom 当原生 size）                                            |
| Text.type / textType                                       | 普通文本 text / 段落 paragraph / 一级标题 h1 至五级标题 h5；默认（未配置）/ 次要 secondary / 成功 success / 警告 warning / 危险 danger                                        |
| Container.heightConfig / BasicPage.display / flexDirection | 固定 fixed / 自适应 auto；文档流 flow / 弹性 flex；横向 row / 纵向 column                                                                                                     |
| FloatButton（若启用）                                      | 默认 default / 主要 primary；圆形 circle / 方形 square                                                                                                                        |

基础类型联合可以明确收窄到受支持分支，例如 loading:boolean、allowClear:boolean、showSearch:boolean。纯 ReactNode 联合或回调联合不采用这种方式冒充基础配置。过时别名以及同一语义的重复字段需要一并清理，本次已清理配置入口，但不改写已有项目数据。

## 7. 实施前的差距核对（历史快照）

| 当前事实                                                                                                                              | 后续需要处理的内容                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 目录包含 25 个物料实现；主 Manifest/editor 聚合是 23 个，runtime 另含 basicPage，floatButton 没接入                                   | basicPage 按平台根页面单独对齐；floatButton 暂不启用，避免把文件存在当产品支持                                                                                                       |
| 上一轮已接入 Table 列与三类 options 的 custom 编辑器                                                                                  | 保留该方向，补必要字段/取消等交互；不能退回原始 JSON 承担主要编辑体验                                                                                                                |
| Table.context.methods 为空，只有共用 init；Modal/Drawer/Upload/Tabs/Form 也缺少上述业务事件声明                                       | 同步 Manifest 事件、中文名称、参数约定、运行时回调和逻辑流入口；不能只在类型或下拉里新增名称                                                                                         |
| Button 声明 text/disabled/loading；Input 及 inputContext 默认声明 value/disabled；Text 声明大量展示属性                               | 按本文可读白名单收敛，Button 只留 text/loading，Input 只留 value                                                                                                                     |
| HyperInput 读取候选、SettersFields 写入候选均合并了 propsSchema 全部字段与 context variables                                          | **只删 variables 不够。** 后续候选与校验按独立读/写能力表取值；在实现前确定最小契约变化，不引入通用插件层                                                                            |
| Runtime.resolveHyperContext 的 state 分支读取 element.props + engine.getState；tg_setContextValues 写的是独立 contextValues           | 普通值不能只注册到 contextValues 就声称 state 可读。Form.value 目前存在这类通路不一致；必须将业务状态更新到实际读取通路或明确调整读取协议                                            |
| Input/Number/Textarea/Switch 有局部 React 状态；多数选择组件直接转发原生 props                                                        | 当前值的局部展示变化不等于 Engine.state 同步。逐类核对默认值、清空、用户输入、程序设置和事件先后；保证回调里的逻辑流读到新值                                                         |
| 当前 Engine 事件执行收集了 args，但执行节点上下文未将 args 交给业务节点；Runtime 没有独立 event 读取命名空间                          | 不能仅填写 params 描述就承诺事件参数可用。优先以明确业务状态覆盖本轮读取场景；确需变化字段/关闭原因/onEdit action 等瞬时参数时补最小的事件载荷通路，不能把瞬时事件误存成永久业务属性 |
| 日期组件使用 Dayjs 适配；范围组件当前 value 路径未统一字符串转换；非日期 picker 使用同一个受限解析器                                  | 明确日期、时间、范围、清空和多种 picker 的归一类型，并验证双向转换；展示 format 不负责决定业务值类型                                                                                 |
| Table 同时有 pagination 对象、enabledPagination 和若干扁平分页字段；Manifest 还允许 pagination=true                                   | 对齐原生 false\|object 与本文单一分页配置；不能在新旧字段之间静默覆盖；分页运行态和回调必须统一                                                                                      |
| Input/Number 存在 ReactNode 装饰字段；Switch 有两种状态的 ReactNode 文案；Modal/Drawer 的 ReactNode 属性在 Manifest 中被简化为 string | 按筛选规则移出普通面板；如保留文案需求，独立定义物料 string 字段与映射，不开放任意 ReactNode                                                                                         |
| InputContext 把 disabled 同时作为业务上下文；Form 方法声明缺 setFieldsValue，但适配器注册了它；Form 尚不自动生成具名字段绑定          | 不把这些现状当目标规格。分别对齐可读字段、可调用方法和字段绑定，再承诺初始值/提交/校验能力                                                                                           |
| TreeSelect/Cascader 结构化数据没有专用面板；Tree/Tabs/Form/Table 数据多处仍用 JSON                                                    | 按独立模型提供编辑器，明确字段约束；复杂类型不通过一个通用任意对象入口逃过筛选                                                                                                       |
| Tree.draggable、Tabs 可编辑类型已有属性，但未提供对应重排/增删事件闭环                                                                | 要么补完整行为，要么先收起入口；避免“能勾选，运行却没结果”                                                                                                                           |
| 本地 Ant Design 已是 6.6.2；多处仍用 middle、destroyOnClose、tabPosition 等旧字段；FloatButton 有未核实字段                           | 按实际安装类型逐项核对；Manifest、面板、组件、Agent 认识、已有页面策略一起调整，不做单边删除                                                                                         |

## 8. 原实施建议与本次验收依据

1. 先确定本文三张核心白名单：面板字段、事件、可读业务属性；独立核对可写运行状态与方法。
2. 先修候选来源与动态值同步，再接事件；优先跑通 Button.text/loading、Input.value/onChange/onPressEnter、Table 分页/onChange。这些是业务闭环，不是继续增加物料数量。
3. 收敛 Table 分页对象与联动，完善列/选项编辑器；随后按 Form、选择/日期类、Tree/Tabs、浮层、Upload 处理。
4. 最后统一原生类型、中文枚举、默认值、废弃字段及未注册代码；不为整理任务顺带启用 FloatButton。

每个物料的验收证据至少说明：面板不出现被排除的复杂类型；枚举中文显示与真实保存值一致；联动隐藏正确；结构化配置确认/取消/非法输入行为正确；事件只触发预期的流；流读取的是最新归一业务值；未列出的字段不会再自动出现在候选中；运行时变化不会写 Working/Revision/目标项目。实现时按仓库规则选择必要核心回归与两主题交互检查。

本次完整执行了面板、中文枚举、结构化编辑器、事件、独立读写能力和运行态同步；没有采用分阶段交付。实现细节见各包 README 与 runtime-state/material-state 模块。输入物料新增 fieldName/fieldLabel/fieldRequired，形成具名字段与必填校验闭环；basicPage 作为隐藏根物料注册，FloatButton 按原约定不启用。容器 margin/padding 保留为既有布局数据能力，但不出现在普通属性面板或逻辑流读写候选中。

Table 使用本地分页，total 由完整数据长度得出，配置的 position 映射为当前原生 placement；未增加远程分页、上传异步取消、函数型渲染等本就排除的能力。读取、写入和方法在 Server 与 Runtime 都按白名单检查；event.payload 是每次调用的独立快照。运行时业务投影仅跟随页面 Engine，不写回 Working、Revision 或目标项目。

控件联动默认仍为 AND；TreeSelect 有效多选、Slider 提示显隐等显式采用 linkageMode=any 组合现有规则。MVP 阶段所有内置物料、物料集及 Materials 包统一保持 1.0.0，不引入多版本兼容或迁移；项目、编辑器、运行时和校验使用同一套当前契约。

## 9. 核对入口

- 当前注册与实现：[manifest.ts](./manifest.ts)、[editor.ts](./editor.ts)、[runtime.ts](./runtime.ts)，以及各物料的 manifest.ts / material-config.ts / index.tsx。
- 共用声明：[manifest-definition.ts](./manifest-definition.ts)、[material-manifest.ts](../src/material-manifest.ts)。
- 当前属性控件与显隐：[attribute-panel.tsx](../../editor/src/mods/attribute-panel.tsx)。
- 逻辑流读候选：[hyper-input.tsx](../../editor/src/flow-editor/nodes/hyper-input.tsx)；写候选：[setters-fields.tsx](../../editor/src/flow-editor/nodes/setters-fields.tsx)。
- 实际读取与执行：[execute.ts](../../runtime/execute.ts)、[logic-nodes.ts](../../runtime/logic-nodes.ts)。
- 本地类型：materials/node_modules/antd/es 中 button/button.d.ts、table/InternalTable.d.ts、config-provider/SizeContext.d.ts、input/Input.d.ts、switch/index.d.ts、drawer/Drawer.d.ts、float-button/FloatButton.d.ts 等（依赖安装后可核对）。
- 参考实现：`/Users/keisei/Dev/tangramino/playground/antd-demo/src/editor/mods/attribute-panel.tsx` 与同项目 materials/table；参考只提供交互思路，不等于当前 Origamix 的实现或类型契约。
