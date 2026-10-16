# UI

Origamix 共用的 shadcn/ui 基础控件、工具与主题基础，保持 Base UI 原有 API。当前是私有工作区包，App、未来的 Editor 和物料属性编辑器通过声明入口复用同一份源码。

## 使用

```tsx
import { Button } from '@origamix/ui/button';
import { Dialog, DialogContent } from '@origamix/ui/dialog';
import { cn } from '@origamix/ui/utils';
```

已有控件包括 badge、button、card、checkbox、dialog、dropdown-menu、field、input、label、radio-group、select、separator、spinner、switch、textarea、tooltip。根入口也导出这些已有控件，业务代码优先使用单个控件入口。

组件不会自动导入全局 CSS。Tailwind v4 消费方在样式入口中组合：

```css
@import 'tailwindcss';
@import '@origamix/ui/styles.css';
```

在消费文档的 `<html>` 上显式添加 `origamix-ui`，深色时再添加 `dark`。主题变量和基础规则限定在这个作用域，默认挂到 body 的弹窗、下拉菜单与提示也能继承。导入样式不会给所有文档的 `:root` 或 body 强制设置工作台配色。样式中的 `@source` 自动包含本包控件，消费方无需跨包路径扫描。

工作台通过 App 偏好切换主题；预览使用独立 iframe 文档，并显式接收预览快照的主题。生成项目不导入此工作台样式。UI 不包含业务状态色、聊天滚动条、桌面窗口拖拽或产品布局。

## 开发与生成

从仓库根目录执行：

```sh
pnpm --filter @origamix/ui exec shadcn add <component>
pnpm --filter @origamix/ui lint
pnpm --filter @origamix/ui typecheck
pnpm --filter @origamix/ui build
```

两份 `components.json` 将 UI 与 utils 指向本包的公开入口，App 的业务组合仍在 App。新增控件后同步 `package.json` 的显式出口、组件 barrel 和构建入口，检查生成的导入和主题改动，不在 App 中再次生成同一份控件。

工作区出口指向源码以支持 HMR；构建生成 ESM 和声明供集成验证。本包尚未配置独立发布，CSS 保留为 Tailwind 输入，不在本包重复编译 Tailwind。完整架构见 [架构边界](../architecture.md)，维护要求见 [AGENTS.md](AGENTS.md)。
