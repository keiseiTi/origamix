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
