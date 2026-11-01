import { validateAntdMaterialProps } from './validation';

/** Inline completeness feedback; persisted types are checked against the generated Manifest. */
export const validateColumns = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return '列配置应为数组。';
  if (
    value.some(
      (column) =>
        !column ||
        typeof column.title !== 'string' ||
        !column.title.trim() ||
        typeof column.dataIndex !== 'string' ||
        !column.dataIndex.trim(),
    )
  )
    return '请填写每列的列名和字段。';
  return validateAntdMaterialProps('table', { columns: value })[0]?.message;
};
