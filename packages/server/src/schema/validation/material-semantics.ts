import type { OrigamixPageSchema } from '@origamix/shared';
import {
  createMaterialValidationError as error,
  isRecord,
  type MaterialValidationError,
  type MaterialValidationRuntime,
} from './validation-contracts';

export const validateMaterialSemantics = (
  elementId: string,
  element: OrigamixPageSchema['elements'][string],
  errors: MaterialValidationError[],
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
  if (
    ['number', 'slider'].includes(element.type) &&
    typeof props.min === 'number' &&
    typeof props.max === 'number' &&
    props.min > props.max
  )
    issue('min', 'Minimum must not exceed maximum');
  if (
    element.type === 'textarea' &&
    typeof props.minRows === 'number' &&
    typeof props.maxRows === 'number' &&
    props.minRows > props.maxRows
  )
    issue('minRows', 'Minimum rows must not exceed maximum rows');
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
    const dateText = (text: string): boolean => {
      const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?$/.exec(text);
      if (!match) return false;
      const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      return (
        date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day) &&
        Number(hour) < 24 &&
        Number(minute) < 60 &&
        Number(second) < 60
      );
    };
    for (const field of element.type === 'timePicker'
      ? ['defaultValue']
      : ['defaultValue', 'defaultStart', 'defaultEnd', 'minDate', 'maxDate']) {
      const value = props[field];
      if (typeof value !== 'string' || !value) continue;
      const valid =
        element.type === 'timePicker'
          ? /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
          : dateText(value);
      if (!valid)
        issue(
          field,
          'Use a valid canonical date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) or time (HH:mm:ss)',
        );
    }
    if (
      typeof props.minDate === 'string' &&
      typeof props.maxDate === 'string' &&
      props.minDate > props.maxDate
    )
      issue('minDate', 'Minimum date must not exceed maximum date');
    if (
      props.order !== false &&
      typeof props.defaultStart === 'string' &&
      typeof props.defaultEnd === 'string' &&
      props.defaultStart > props.defaultEnd
    )
      issue('defaultStart', 'Start date must not exceed end date');
  }
  for (const [field, key] of [
    ['columns', 'dataIndex'],
    ['options', 'value'],
    ['items', 'key'],
  ] as const) {
    if (!Array.isArray(props[field])) continue;
    const seen = new Set<unknown>();
    for (const item of props[field]) {
      if (!isRecord(item)) continue;
      const identity = field === 'columns' ? (item.key ?? item[key]) : item[key];
      if (identity !== undefined && seen.has(identity)) issue(field, 'Identifiers must be unique');
      seen.add(identity);
    }
  }
};

export const validateMaterialStructure = (
  schema: OrigamixPageSchema,
  runtime: MaterialValidationRuntime,
  errors: MaterialValidationError[],
): void => {
  for (const [parentId, childIds] of Object.entries(schema.layout.structure)) {
    const parent = schema.elements[parentId];
    if (!parent) continue;
    const parentManifest = runtime.registry[parent.type];
    if (
      parent.type !== 'basicPage' &&
      parentManifest &&
      !parentManifest.acceptsChildren &&
      childIds.length > 0
    ) {
      errors.push(
        error(
          'CHILDREN_NOT_ALLOWED',
          `/layout/structure/${parentId}`,
          `${parent.type} does not accept children`,
          parentId,
          parent.type,
        ),
      );
    }
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
              schema.elements[childId]?.type,
            ),
          );
      }
    }
    const fieldNames = new Set<string>();
    for (const [index, childId] of childIds.entries()) {
      const child = schema.elements[childId];
      if (!child || child.type === 'basicPage') continue;
      const childManifest = runtime.registry[child.type];
      if (
        parent.type === 'form' &&
        typeof child.props.fieldName === 'string' &&
        child.props.fieldName
      ) {
        if (fieldNames.has(child.props.fieldName))
          errors.push(
            error(
              'INVALID_MATERIAL_PROPS',
              `/elements/${childId}/props/fieldName`,
              'Form field names must be unique',
              childId,
              child.type,
            ),
          );
        fieldNames.add(child.props.fieldName);
      }
      if (
        childManifest?.allowedParentTypes &&
        !childManifest.allowedParentTypes.includes(parent.type)
      ) {
        errors.push(
          error(
            'INVALID_PARENT',
            `/layout/structure/${parentId}/${index}`,
            `${child.type} cannot be placed under ${parent.type}`,
            childId,
            child.type,
          ),
        );
      }
    }
  }
};
