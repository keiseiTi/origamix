export type RoutingConfig = { mode: 'browser' | 'hash'; basePath: string };
/** Shared shape, local reader: standalone projects do not depend on the workbench. */
export const readRoutingConfig = (manifest: {
  routing: { mode: string; basePath: string };
}): RoutingConfig => {
  const mode = manifest.routing.mode;
  const basePath = manifest.routing.basePath;
  if (
    !['browser', 'hash'].includes(mode) ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*(?![\s\S])/.test(basePath) ||
    basePath.length > 200
  )
    throw new Error(
      '项目路由配置无效：请选择 browser/hash，应用访问前缀应为 / 或 /admin/ 等目录路径。',
    );
  return { mode: mode as RoutingConfig['mode'], basePath };
};
