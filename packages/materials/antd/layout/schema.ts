import {
  equalJson,
  isPageSchema,
  PAGE_OUTLET_TYPE,
  SCHEMA_VERSION,
  type OrigamixPageSchema,
} from '@origamix/shared';

type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
export type LayoutSchemaInput = Immutable<OrigamixPageSchema>;
export const layoutDefaults = {
  variant: 'top-side',
  headerEnabled: true,
  siderEnabled: true,
  footerEnabled: false,
  brand: '我的应用',
  headerHeight: 64,
  headerMenu: true,
  siderMenu: true,
  siderWidth: 240,
  collapsedWidth: 80,
  collapsible: true,
  defaultCollapsed: false,
  breakpoint: 'lg',
  contentPadding: 24,
  footerText: '',
  minHeight: 640,
} as const;
const roles = ['header', 'sider', 'body', 'content', 'footer'] as const;
export const layoutRegionIds = (root: string) =>
  Object.fromEntries(roles.map((role) => [role, `${root}__${role}`])) as Record<
    (typeof roles)[number],
    string
  >;

/** Idempotent region derivation. Existing content is never discarded or moved out of its region. */
export const reconcileAntdLayoutSchema = (
  input: LayoutSchemaInput,
  previous?: LayoutSchemaInput,
): OrigamixPageSchema => {
  const value: unknown = structuredClone(input);
  if (!isPageSchema(value)) throw new Error('布局 Schema 结构无效');
  const root = value.layout.root;
  if (value.elements[root]?.type !== 'Layout') throw new Error('布局根节点必须是 Layout');
  if (previous?.elements[previous.layout.root]?.type === 'Layout' && previous.layout.root !== root)
    throw new Error('不能更换布局根节点身份');
  const ids = layoutRegionIds(root);
  const outlets = Object.entries(value.elements).filter(
    ([, element]) => element.type === PAGE_OUTLET_TYPE,
  );
  if (outlets.length !== 1) throw new Error('INVALID_PAGE_OUTLET: 布局必须保留唯一页面内容区');
  const outlet = outlets[0]![0];
  const previousOutlet =
    previous &&
    Object.entries(previous.elements).find(([, element]) => element.type === PAGE_OUTLET_TYPE)?.[0];
  if (previousOutlet && previousOutlet !== outlet) throw new Error('不能更换页面内容区身份');
  const props: Record<string, unknown> = { ...layoutDefaults, ...value.elements[root]!.props };
  const sideFirst = props.variant === 'side' || props.variant === 'side-top';
  const enabled = {
    header: props.headerEnabled === true && props.variant !== 'side',
    sider: props.siderEnabled === true && props.variant !== 'top',
    body: true,
    content: true,
    footer: props.footerEnabled === true,
  };
  const expectedRoot = sideFirst ? [ids.sider, ids.body] : [ids.header, ids.body, ids.footer];
  const expectedBody = sideFirst ? [ids.header, ids.content, ids.footer] : [ids.sider, ids.content];
  const managed = new Set(Object.values(ids));
  for (const [id, element] of Object.entries(value.elements)) {
    if (element.type === 'Layout' && id !== root) throw new Error('Layout 只能作为唯一根节点');
    if (element.type === 'LayoutRegion' && !managed.has(id))
      throw new Error('不能新增内部布局区域');
  }
  for (const id of value.layout.structure[root] ?? [])
    if (!managed.has(id) && !(id === outlet && !previous))
      throw new Error('请将内容放入布局区域，不能直接放入 Layout 根节点');
  for (const id of value.layout.structure[ids.body] ?? [])
    if (!managed.has(id)) throw new Error('布局内部容器只允许放置受管理区域');
  const unchanged =
    previous && equalJson(previous.elements[root]?.props, value.elements[root]!.props);
  for (const role of roles) {
    const id = ids[role];
    const old = value.elements[id];
    if (previous?.elements[id] && !old)
      throw new Error('不能删除内部区域，请通过 Layout 属性关闭区域');
    if (old && (old.type !== 'LayoutRegion' || old.props.region !== role))
      throw new Error('布局区域身份冲突');
    const regionProps = {
      alias: {
        header: '顶部区域',
        sider: '侧栏区域',
        body: '布局主体',
        content: '页面内容区域',
        footer: '页脚区域',
      }[role],
      region: role,
      enabled: enabled[role],
      config: props,
      layoutWidth: role === 'sider' ? 'auto' : 'fill',
      layoutGrow: role === 'body' || role === 'content' ? 1 : 0,
      layoutShrink: role === 'sider' ? 0 : 1,
    };
    if (unchanged && old && !equalJson(old.props, regionProps))
      throw new Error('内部区域属性由 Layout 配置管理');
    value.elements[id] = { type: 'LayoutRegion', props: regionProps };
    value.layout.structure[id] ??= [];
  }
  if (
    unchanged &&
    (!equalJson(value.layout.structure[root], expectedRoot) ||
      !equalJson(value.layout.structure[ids.body], expectedBody))
  )
    throw new Error('不能移动内部区域，请修改 Layout 布局结构');
  if (
    previous?.elements[ids.content] &&
    !(value.layout.structure[ids.content] ?? []).includes(outlet)
  )
    throw new Error('不能移出页面内容区');
  value.elements[root] = { ...value.elements[root]!, props };
  value.layout.structure[root] = expectedRoot;
  value.layout.structure[ids.body] = expectedBody;
  if (!value.layout.structure[ids.content]!.includes(outlet))
    value.layout.structure[ids.content]!.push(outlet);
  return value;
};

export const assertAntdLayoutSchema = (schema: unknown): void => {
  if (!isPageSchema(schema)) throw new Error('布局 Schema 结构无效');
  if (!equalJson(reconcileAntdLayoutSchema(schema), schema))
    throw new Error('布局区域与 Layout 配置不一致');
};
export const createAntdLayoutSchema = (props: Record<string, unknown> = {}): OrigamixPageSchema =>
  reconcileAntdLayoutSchema({
    elements: { layout: { type: 'Layout', props }, outlet: { type: PAGE_OUTLET_TYPE, props: {} } },
    layout: { root: 'layout', structure: { layout: ['outlet'], outlet: [] } },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
  });
