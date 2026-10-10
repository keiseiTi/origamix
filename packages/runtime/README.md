# Runtime

独立页面渲染适配器，App 预览和生成项目共用。不绑定物料库，不包含路由、编辑器、HTTP 或持久化。

## 接口

```tsx
import { OrigamixPage } from '@origamix/runtime/react';

<OrigamixPage schema={schema} materials={materials} resetKey={revisionId} />;
```

调用者提供 Schema 和物料注册表。Runtime 负责 Engine/ReactView 装配、未知物料检测和渲染错误捕获；可选 `onOutcome` 返回诊断，`renderError` 允许调用者提供重试界面。`resetKey` 变化可恢复错误边界。

该入口也导出 `RuntimeDiagnostic`、`RuntimeOutcome` 和 `findUnknownMaterialTypes`。UI 风格、诊断上传及页面刷新属于调用方；生成项目无需依赖 App、Shared 或 Server。

## 验证与构建

在仓库根目录：

```sh
pnpm --filter @origamix/runtime lint
pnpm --filter @origamix/runtime typecheck
pnpm --filter @origamix/runtime test
pnpm --filter @origamix/runtime build
```

构建输出 ESM 和声明到 `dist/`，React 是 peer dependency。影响生成项目的变更还需 Server `test:template`。维护约束见 [AGENTS.md](AGENTS.md)。

## 完整渲染示例

在使用 Ant Design 物料的 React 项目中，页面入口可以写为：

```tsx
import { OrigamixPage } from '@origamix/runtime/react';
import materials from '@origamix/materials/antd';
import schema from './schema.json';

const Page = (): React.JSX.Element => (
  <OrigamixPage
    schema={schema}
    materials={materials}
    resetKey={JSON.stringify(schema)}
    renderError={(_error, retry) => (
      <main role='alert'>
        页面渲染失败。<button onClick={retry}>重试</button>
      </main>
    )}
  />
);

export default Page;
```

调用项目需要直接声明 Runtime、Materials 及其 peer dependencies，并启用 TypeScript JSON 导入；Schema 示例见 [Shared README](../shared/README.md)。样式由调用者导入，生成项目的 [index.css](../template/src/index.css) 包含 Tailwind 与 HeroUI 样式入口，Runtime 不会注入工作台主题。

`onOutcome` 可以接收 `UNKNOWN_MATERIAL` 或 `RENDER_ERROR` 诊断。未知物料由 Runtime 显示提示；`renderError` 自定义的是渲染异常界面，不替换未知物料提示。`resetKey` 变化或点击重试可重置错误边界，但仍需先修正造成错误的 Schema/组件。成功诊断不证明所有交互、样式或服务端校验已通过。
