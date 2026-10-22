/** Editor-only guards keep malformed data away from native component rendering.
 * Server still validates the complete candidate against the authoritative Manifest.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isKey = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';
const isScalar = (value: unknown): boolean =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

export const validateRecord = (value: unknown): string | undefined =>
  isRecord(value) ? undefined : '请填写字段名与初始值组成的对象，例如 {"name":"张三"}。';

export const validateRows = (value: unknown): string | undefined => {
  if (!Array.isArray(value) || value.some((row) => !isRecord(row)))
    return '请填写数据行数组，例如 [{"id":"1","name":"张三"}]。';
  if (value.some((row) => Object.values(row).some((cell) => !isScalar(cell))))
    return '表格数据单元格请使用文本、数字、布尔值或 null。';
  return undefined;
};

export const validateColumns = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return '列配置应为数组。';
  const keys = new Set<string>();
  for (const column of value) {
    if (
      !isRecord(column) ||
      typeof column.title !== 'string' ||
      typeof column.dataIndex !== 'string' ||
      !column.title.trim() ||
      !column.dataIndex.trim()
    )
      return '每列需要文本 title 和 dataIndex，例如 [{"title":"姓名","dataIndex":"name"}]。';
    const key = column.key ?? column.dataIndex;
    if (typeof key !== 'string' || keys.has(key))
      return '每列的 key（未填写时使用 dataIndex）必须唯一。';
    keys.add(key);
    if (
      column.width !== undefined &&
      (typeof column.width !== 'number' || !Number.isFinite(column.width) || column.width < 1)
    )
      return '列宽 width 应为大于零的数字。';
    if (column.align !== undefined && !['left', 'center', 'right'].includes(String(column.align)))
      return '列对齐 align 可使用 left、center 或 right。';
    if (
      column.fixed !== undefined &&
      ![true, false, 'left', 'right'].includes(column.fixed as string | boolean)
    )
      return '固定列 fixed 可使用 left、right 或布尔值。';
    for (const field of ['ellipsis', 'hidden'])
      if (column[field] !== undefined && typeof column[field] !== 'boolean')
        return `${field} 应为布尔值。`;
  }
  return undefined;
};

export const validateKeys = (value: unknown): string | undefined =>
  Array.isArray(value) && value.every(isKey) && new Set(value.map(String)).size === value.length
    ? undefined
    : '请填写不重复的节点键数组，例如 ["0-0","0-1"]。';

export const validateTreeNodes = (value: unknown): string | undefined => {
  const keys = new Set<string>();
  const visit = (nodes: unknown): string | undefined => {
    if (!Array.isArray(nodes)) return '树节点和 children 应为数组。';
    for (const node of nodes) {
      if (!isRecord(node) || typeof node.title !== 'string' || !isKey(node.key))
        return '每个树节点需要文本 title 和文本或数字 key。';
      if (keys.has(String(node.key))) return '整棵树中的 key 必须唯一。';
      keys.add(String(node.key));
      for (const field of ['disabled', 'disableCheckbox', 'checkable', 'selectable', 'isLeaf'])
        if (node[field] !== undefined && typeof node[field] !== 'boolean')
          return `${field} 应为布尔值。`;
      if (node.children !== undefined) {
        const error = visit(node.children);
        if (error) return error;
      }
    }
    return undefined;
  };
  return visit(value);
};

export const validateTabItems = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return '页签项应为数组。';
  const keys = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.key !== 'string' ||
      !item.key ||
      typeof item.label !== 'string'
    )
      return '每个页签需要非空 key 和文本 label，例如 [{"key":"1","label":"概览","children":"内容"}]。';
    if (keys.has(item.key)) return '页签 key 必须唯一。';
    keys.add(item.key);
    if (item.children !== undefined && typeof item.children !== 'string')
      return '页签 children 应为文本。';
    for (const field of ['disabled', 'closable', 'forceRender', 'destroyOnHidden'])
      if (item[field] !== undefined && typeof item[field] !== 'boolean')
        return `${field} 应为布尔值。`;
  }
  return undefined;
};
