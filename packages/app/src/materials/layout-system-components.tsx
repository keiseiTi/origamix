export const LayoutOutlet = () => (
  <div className='grid min-h-48 place-content-center rounded border border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm text-muted-foreground'>
    页面内容区<span className='mt-1 text-xs'>应用运行时显示当前页面</span>
  </div>
);
LayoutOutlet.origamixLayout = { display: 'block' as const };
export const LayoutNavigation = () => (
  <nav
    aria-label='项目页面导航'
    className='rounded border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground'
  >
    页面导航 · 自动使用项目页面
  </nav>
);
LayoutNavigation.origamixLayout = { display: 'block' as const };
