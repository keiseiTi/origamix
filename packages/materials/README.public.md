# @origamix/materials

Origamix 的 Ant Design 页面运行组件和纯数据物料清单。

## 安装与使用

安装与项目 Schema 匹配的固定版本的 `@origamix/runtime` 和 `@origamix/materials`，并提供 React 19 与 Ant Design 6。页面运行不需要 Origamix UI、Editor、App 或 Server。

```tsx
import { OrigamixPage } from '@origamix/runtime';
import materials from '@origamix/materials/antd/runtime';
import schema from './schema.json';

const Page = () => <OrigamixPage schema={schema} materials={materials} />;
```

- `@origamix/materials/antd/runtime`：页面组件注册表、RuntimeProvider 和物料集身份。
- `@origamix/materials/antd/manifest`：可序列化的纯数据 Manifest，不加载 React 编辑控件。

Tailwind v4 项目需要扫描安装包的 `dist/public` 目录；Origamix 生成项目已经提供对应配置。按宿主需求使用 RuntimeProvider 传入主题。

编辑注册、属性编辑控件和物料编写辅助只用于 Origamix 内部工作区，不属于此 npm 包的公开接口。UI 保持私有。

## 应用布局

`@origamix/materials/antd/layout/runtime` 提供 Layout、内部区域及区域内容注册表；与页面 runtime 注册表合并后交给 `OrigamixLayout`。安装时需要兼容的 `@origamix/runtime` peer，以共享导航上下文；导航图标使用 `lucide-react` peer。`@origamix/materials/antd/layout/manifest` 提供纯数据清单、createAntdLayoutSchema 和区域转换／校验函数。Editor 入口不在公开 npm 归档中。
