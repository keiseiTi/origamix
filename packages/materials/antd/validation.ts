import { parseDateValue, parseTimeValue } from './date-value';
import type { OrigamixPageSchema } from '@origamix/shared';

export interface MaterialPropertyIssue {
  code: 'INVALID_MATERIAL_PROPS';
  path: string;
  message: string;
  elementId: string;
  materialType: string;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const error = (
  _code: 'INVALID_MATERIAL_PROPS',
  path: string,
  message: string,
  elementId: string,
  materialType: string,
): MaterialPropertyIssue => ({
  code: 'INVALID_MATERIAL_PROPS',
  path,
  message,
  elementId,
  materialType,
});
const canonicalDate = (value: string): string =>
  value.length === 10 ? `${value}T00:00:00` : value.replace(' ', 'T');
const validateElement = (
  elementId: string,
  element: OrigamixPageSchema['elements'][string],
  errors: MaterialPropertyIssue[],
): void => {
  const props = element.props;
  const issue = (field: string, message: string): void => {
    errors.push(
      error(
        'INVALID_MATERIAL_PROPS',
        `/elements/${elementId}/props/${field}`,
        message,
        elementId,
        element.type,
      ),
    );
  };
  if (Array.isArray(props.fieldRules)) {
    props.fieldRules.forEach((rule, index) => {
      if (isRecord(rule) && rule.type === 'pattern' && typeof rule.value === 'string') {
        try {
          new RegExp(rule.value);
        } catch {
          issue(`fieldRules/${index}/value`, 'Invalid field regular expression');
        }
      }
    });
  }
  if (
    ['number', 'slider'].includes(element.type) &&
    typeof props.min === 'number' &&
    typeof props.max === 'number' &&
    props.min > props.max
  )
    issue('min', 'Minimum must not exceed maximum');
  if (element.type === 'textarea') {
    const autoSize = isRecord(props.autoSize) ? props.autoSize : {};
    const minRows = props.minRows ?? autoSize.minRows;
    const maxRows = props.maxRows ?? autoSize.maxRows;
    if (typeof minRows === 'number' && typeof maxRows === 'number' && minRows > maxRows)
      issue('minRows', 'Minimum rows must not exceed maximum rows');
  }
  if (element.type === 'tree' && Array.isArray(props.treeData)) {
    const keys = new Set<unknown>();
    const visit = (nodes: unknown[]): void => {
      for (const node of nodes) {
        if (!isRecord(node)) continue;
        if (keys.has(node.key)) issue('treeData', 'Node keys must be unique');
        keys.add(node.key);
        if (Array.isArray(node.children)) visit(node.children);
      }
    };
    visit(props.treeData);
    for (const field of ['defaultSelectedKeys', 'defaultExpandedKeys', 'defaultCheckedKeys'])
      if (Array.isArray(props[field]) && props[field].some((key: unknown) => !keys.has(key)))
        issue(field, 'Selected keys must refer to existing tree nodes');
  }
  if (
    element.type === 'tabs' &&
    Array.isArray(props.items) &&
    typeof props.defaultActiveKey === 'string' &&
    !props.items.some((item) => isRecord(item) && item.key === props.defaultActiveKey)
  )
    issue('defaultActiveKey', 'Default tab must exist');
  if (['datePicker', 'datePickerRange', 'timePicker'].includes(element.type)) {
    for (const field of element.type === 'timePicker'
      ? ['defaultValue']
      : ['defaultValue', 'defaultStart', 'defaultEnd', 'minDate', 'maxDate']) {
      const value = props[field];
      if (typeof value !== 'string' || !value) continue;
      const valid =
        element.type === 'timePicker'
          ? Boolean(parseTimeValue(value))
          : Boolean(parseDateValue(value));
      if (!valid)
        issue(
          field,
          'Use a valid canonical date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) or time (HH:mm:ss)',
        );
    }
    if (
      typeof props.minDate === 'string' &&
      typeof props.maxDate === 'string' &&
      canonicalDate(props.minDate) > canonicalDate(props.maxDate)
    )
      issue('minDate', 'Minimum date must not exceed maximum date');
    if (
      props.order !== false &&
      typeof props.defaultStart === 'string' &&
      typeof props.defaultEnd === 'string' &&
      canonicalDate(props.defaultStart) > canonicalDate(props.defaultEnd)
    )
      issue('defaultStart', 'Start date must not exceed end date');
  }
  const collection =
    element.type === 'table'
      ? ['columns', 'dataIndex']
      : ['select', 'radio', 'checkbox', 'cascader'].includes(element.type)
        ? ['options', 'value']
        : element.type === 'treeSelect'
          ? ['treeData', 'value']
          : element.type === 'tabs'
            ? ['items', 'key']
            : undefined;
  if (collection) {
    const [field, key] = collection as [string, string];
    const seen = new Set<unknown>();
    const visit = (items: unknown): void => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!isRecord(item)) continue;
        const identity = field === 'columns' ? (item.key ?? item[key]) : item[key];
        if (identity !== undefined && seen.has(identity))
          issue(field, 'Identifiers must be unique');
        seen.add(identity);
        if (element.type === 'cascader' || element.type === 'treeSelect') visit(item.children);
      }
    };
    visit(props[field]);
  }
};

/** Scalar identifiers use strict JSON identity: number 1 and string "1" are distinct. */
export const validateAntdMaterialProps = (
  type: string,
  props: Record<string, unknown>,
): MaterialPropertyIssue[] => {
  const errors: MaterialPropertyIssue[] = [];
  validateElement('', { type, props }, errors);
  return errors;
};

export const validateAntdMaterialSemantics = (
  schema: OrigamixPageSchema,
): MaterialPropertyIssue[] => {
  const errors: MaterialPropertyIssue[] = [];
  for (const [id, element] of Object.entries(schema.elements)) validateElement(id, element, errors);
  for (const [parentId, childIds] of Object.entries(schema.layout.structure)) {
    const parent = schema.elements[parentId];
    if (!parent) continue;
    if (parent.type === 'tabs' && Array.isArray(parent.props.items)) {
      const keys = new Set(parent.props.items.filter(isRecord).map((item) => item.key));
      if (childIds.length && !keys.size)
        errors.push(
          error(
            'INVALID_MATERIAL_PROPS',
            `/elements/${parentId}/props/items`,
            'Tabs with child content must retain at least one tab',
            parentId,
            parent.type,
          ),
        );
      for (const childId of childIds) {
        const key = schema.elements[childId]?.props.tabKey;
        if (typeof key === 'string' && !keys.has(key))
          errors.push(
            error(
              'INVALID_MATERIAL_PROPS',
              `/elements/${childId}/props/tabKey`,
              'Child content must belong to an existing parent tab',
              childId,
              schema.elements[childId]!.type,
            ),
          );
      }
    }
    if (parent.type === 'form') {
      const fieldNames = new Set<string>();
      const visited = new Set<string>();
      const visit = (ids: readonly string[]) => {
        for (const childId of ids) {
          if (visited.has(childId)) continue;
          visited.add(childId);
          const child = schema.elements[childId];
          if (!child || child.type === 'form') continue;
          const name = child.props.fieldName;
          if (typeof name === 'string' && name) {
            if (fieldNames.has(name))
              errors.push(
                error(
                  'INVALID_MATERIAL_PROPS',
                  `/elements/${childId}/props/fieldName`,
                  'Form field names must be unique',
                  childId,
                  child.type,
                ),
              );
            fieldNames.add(name);
          }
          visit(schema.layout.structure[childId] ?? []);
        }
      };
      visit(childIds);
    }
  }
  return errors;
};
