import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { validateFlowReferences } from './flow-validation';
import { builtinProjectMaterials, loadProjectMaterials } from '../projects/project-materials';
import {
  isHyperValue,
  isFlowNodeProps,
  type FlowNodeType,
  type ValidationMaterialManifest,
  type OrigamixPageSchema,
} from '@origamix/shared';

export type MaterialValidationErrorCode =
  | 'MATERIAL_SET_VERSION_MISMATCH'
  | 'UNKNOWN_MATERIAL'
  | 'INVALID_MATERIAL_PROPS'
  | 'CHILDREN_NOT_ALLOWED'
  | 'INVALID_PARENT'
  | 'UNKNOWN_EVENT'
  | 'INVALID_BINDING'
  | 'INVALID_FLOW_PROPS'
  | 'INVALID_FLOW_REFERENCE'
  | 'INCOMPLETE_FLOW'
  | 'UNSAFE_EXPRESSION'
  | 'UNSAFE_URL';

export interface MaterialValidationError {
  code: MaterialValidationErrorCode;
  path: string;
  message: string;
  elementId: string | null;
  materialType: string | null;
}

export interface MaterialValidationResult {
  valid: boolean;
  errors: MaterialValidationError[];
}

export interface MaterialValidationRuntime {
  materialSet: { id: string; version: string };
  registry: Readonly<Record<string, ValidationMaterialManifest>>;
}

const ajv = new Ajv({ allErrors: true, strict: true });
const validatorCache = new WeakMap<object, ValidateFunction>();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const safeUrlPattern = /^(?:(?:https?):\/\/|(?:mailto|tel):|\/(?!\/)|\.{1,2}\/|#)/i;
const unsafeExpressionPattern =
  /(?:\b(?:eval|Function|import|require|process|globalThis|window|document|fetch|XMLHttpRequest)\b|__proto__|prototype|constructor|=>|;|(?<![=!<>])=(?!=))/;

export const defaultMaterialValidationRuntime: MaterialValidationRuntime =
  builtinProjectMaterials.validation;

const error = (
  code: MaterialValidationErrorCode,
  path: string,
  message: string,
  elementId?: string,
  materialType?: string,
): MaterialValidationError => {
  return { code, path, message, elementId: elementId ?? null, materialType: materialType ?? null };
};

const propsValidator = (manifest: ValidationMaterialManifest): ValidateFunction => {
  const cached = validatorCache.get(manifest.propsSchema);
  if (cached) return cached;
  const compiled = ajv.compile(manifest.propsSchema);
  validatorCache.set(manifest.propsSchema, compiled);
  return compiled;
};

const propertyPath = (elementId: string, ajvError: ErrorObject): string => {
  const suffix =
    ajvError.keyword === 'additionalProperties'
      ? `/${String(ajvError.params['additionalProperty'])}`
      : ajvError.instancePath;
  return `/elements/${elementId}/props${suffix}`;
};

const inspectSafeValues = (
  value: unknown,
  path: string,
  elementId: string,
  materialType: string,
  errors: MaterialValidationError[],
  allowHyperValues = false,
): void => {
  if (allowHyperValues && isHyperValue(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectSafeValues(
        item,
        `${path}/${index}`,
        elementId,
        materialType,
        errors,
        allowHyperValues,
      ),
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (record['type'] === 'function') {
    errors.push(
      error(
        'UNSAFE_EXPRESSION',
        path,
        'Function-valued Schema content is not allowed',
        elementId,
        materialType,
      ),
    );
  }
  if (record['type'] === 'expression') {
    const expression = record['value'];
    if (
      typeof expression !== 'string' ||
      !expression.trim() ||
      unsafeExpressionPattern.test(expression)
    ) {
      errors.push(
        error(
          'UNSAFE_EXPRESSION',
          `${path}/value`,
          'Expression contains unsupported or unsafe syntax',
          elementId,
          materialType,
        ),
      );
    }
  }
  for (const [key, child] of Object.entries(record)) {
    if (
      (/^(?:href|src|url)$/i.test(key) ||
        (key === 'action' &&
          materialType === 'upload' &&
          path === `/elements/${elementId}/props`)) &&
      typeof child === 'string' &&
      child &&
      !safeUrlPattern.test(child)
    ) {
      errors.push(
        error('UNSAFE_URL', `${path}/${key}`, 'URL scheme is not allowed', elementId, materialType),
      );
    }
    inspectSafeValues(child, `${path}/${key}`, elementId, materialType, errors, allowHyperValues);
  }
};

export const validatePageAgainstMaterials = (
  schema: OrigamixPageSchema,
  projectMaterialSets: readonly { id: string; version: string }[],
  runtime: MaterialValidationRuntime = defaultMaterialValidationRuntime,
  executableFlowIds?: ReadonlySet<string>,
): MaterialValidationResult => {
  const errors: MaterialValidationError[] = [];
  if (
    !projectMaterialSets.some(
      (set) => set.id === runtime.materialSet.id && set.version === runtime.materialSet.version,
    )
  ) {
    errors.push(
      error(
        'MATERIAL_SET_VERSION_MISMATCH',
        '/materialSets',
        `Project requires ${runtime.materialSet.id}@${runtime.materialSet.version}`,
      ),
    );
  }
  for (const manifest of Object.values(runtime.registry)) {
    if (manifest.version !== runtime.materialSet.version) {
      errors.push(
        error(
          'MATERIAL_SET_VERSION_MISMATCH',
          `/materials/${manifest.type}/version`,
          `Manifest ${manifest.type}@${manifest.version} does not match runtime ${runtime.materialSet.version}`,
          undefined,
          manifest.type,
        ),
      );
    }
  }

  for (const [elementId, element] of Object.entries(schema.elements)) {
    if (element.type === 'basicPage') {
      if (elementId !== schema.layout.root)
        errors.push(
          error(
            'INVALID_PARENT',
            `/elements/${elementId}`,
            'basicPage is reserved for the layout root',
            elementId,
            element.type,
          ),
        );
    }
    const manifest = runtime.registry[element.type];
    if (!manifest) {
      errors.push(
        error(
          'UNKNOWN_MATERIAL',
          `/elements/${elementId}/type`,
          `Unknown material: ${element.type}`,
          elementId,
          element.type,
        ),
      );
      continue;
    }
    const validateProps = propsValidator(manifest);
    if (!validateProps(element.props)) {
      for (const ajvError of validateProps.errors ?? []) {
        errors.push(
          error(
            'INVALID_MATERIAL_PROPS',
            propertyPath(elementId, ajvError),
            ajvError.message ?? 'Invalid material property',
            elementId,
            element.type,
          ),
        );
      }
    }
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
        if (identity !== undefined && seen.has(identity))
          issue(field, 'Identifiers must be unique');
        seen.add(identity);
      }
    }
    inspectSafeValues(
      element.props,
      `/elements/${elementId}/props`,
      elementId,
      element.type,
      errors,
    );
  }

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

  for (const [index, rawBinding] of schema.bindElements.entries()) {
    const path = `/bindElements/${index}`;
    if (!rawBinding || typeof rawBinding !== 'object') {
      errors.push(error('INVALID_BINDING', path, 'Binding must be an object'));
      continue;
    }
    const binding = rawBinding as Record<string, unknown>;
    const elementId = typeof binding['id'] === 'string' ? binding['id'] : undefined;
    const element = elementId ? schema.elements[elementId] : undefined;
    const materialType = element?.type;
    if (
      !elementId ||
      !element ||
      typeof binding['event'] !== 'string' ||
      typeof binding['flowId'] !== 'string' ||
      !schema.flows[binding['flowId']]
    ) {
      errors.push(
        error(
          'INVALID_BINDING',
          path,
          'Binding must reference an existing element, event and flow',
          elementId,
          materialType,
        ),
      );
      continue;
    }
    const manifest = runtime.registry[element.type];
    if (!manifest?.context.methods.some((entry) => entry.name === binding['event'])) {
      errors.push(
        error(
          'UNKNOWN_EVENT',
          `${path}/event`,
          `Event ${String(binding['event'])} is not declared by ${element.type}`,
          elementId,
          element.type,
        ),
      );
    }
  }
  for (const [flowId, flow] of Object.entries(schema.flows ?? {})) {
    const flowPath = `/flows/${flowId.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (!isRecord(flow) || !isRecord(flow.nodes)) {
      errors.push(error('INVALID_FLOW_PROPS', flowPath, 'Flow must contain a nodes object'));
      continue;
    }
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      const path = `${flowPath}/nodes/${nodeId.replaceAll('~', '~0').replaceAll('/', '~1')}/props`;
      if (!isRecord(node)) {
        errors.push(error('INVALID_FLOW_PROPS', path, 'Flow node must be an object'));
        continue;
      }
      const valid =
        typeof node.type === 'string' && isFlowNodeProps(node.type as FlowNodeType, node.props);
      if (!valid)
        errors.push(
          error(
            'INVALID_FLOW_PROPS',
            path,
            'Flow node parameters do not match the Shared contract',
          ),
        );
      inspectSafeValues(
        node.props,
        path,
        schema.layout.root,
        schema.elements[schema.layout.root]?.type ?? 'basicPage',
        errors,
        valid,
      );
    }
  }
  errors.push(...validateFlowReferences(schema, runtime.registry, executableFlowIds));
  return { valid: errors.length === 0, errors };
};

export const validateProjectPageAgainstMaterials = async (
  projectPath: string,
  schema: OrigamixPageSchema,
  runtime?: MaterialValidationRuntime,
  executableFlowIds?: ReadonlySet<string>,
): Promise<MaterialValidationResult> => {
  const materials = await loadProjectMaterials(projectPath);
  return validatePageAgainstMaterials(
    schema,
    [materials.manifest.materialSet],
    runtime ?? materials.validation,
    executableFlowIds,
  );
};
