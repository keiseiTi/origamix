import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import {
  antdMaterialManifest,
  antdValidationMaterialRegistry,
} from '@origamix/materials/antd/manifest';
import type { ValidationMaterialManifest } from '@origamix/materials/manifest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';

export type MaterialValidationErrorCode =
  | 'MATERIAL_SET_VERSION_MISMATCH'
  | 'UNKNOWN_MATERIAL'
  | 'INVALID_MATERIAL_PROPS'
  | 'CHILDREN_NOT_ALLOWED'
  | 'INVALID_PARENT'
  | 'UNKNOWN_EVENT'
  | 'INVALID_BINDING'
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

interface ProjectDescriptor {
  framework?: string;
  uiLibrary?: string;
}

const ajv = new Ajv({ allErrors: true, strict: true });
const validatorCache = new WeakMap<object, ValidateFunction>();
const safeUrlPattern = /^(?:(?:https?):\/\/|(?:mailto|tel):|\/(?!\/)|\.{1,2}\/|#)/i;
const unsafeExpressionPattern =
  /(?:\b(?:eval|Function|import|require|process|globalThis|window|document|fetch|XMLHttpRequest)\b|__proto__|prototype|constructor|=>|;|(?<![=!<>])=(?!=))/;

export const defaultMaterialValidationRuntime: MaterialValidationRuntime = {
  materialSet: antdMaterialManifest.materialSet,
  registry: antdValidationMaterialRegistry,
};

function error(
  code: MaterialValidationErrorCode,
  path: string,
  message: string,
  elementId?: string,
  materialType?: string,
): MaterialValidationError {
  return { code, path, message, elementId: elementId ?? null, materialType: materialType ?? null };
}

function propsValidator(manifest: ValidationMaterialManifest): ValidateFunction {
  const cached = validatorCache.get(manifest.propsSchema);
  if (cached) return cached;
  const compiled = ajv.compile(manifest.propsSchema);
  validatorCache.set(manifest.propsSchema, compiled);
  return compiled;
}

function propertyPath(elementId: string, ajvError: ErrorObject): string {
  const suffix =
    ajvError.keyword === 'additionalProperties'
      ? `/${String(ajvError.params['additionalProperty'])}`
      : ajvError.instancePath;
  return `/elements/${elementId}/props${suffix}`;
}

function inspectSafeValues(
  value: unknown,
  path: string,
  elementId: string,
  materialType: string,
  errors: MaterialValidationError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectSafeValues(item, `${path}/${index}`, elementId, materialType, errors),
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
      /^(?:href|src|url)$/i.test(key) &&
      typeof child === 'string' &&
      child &&
      !safeUrlPattern.test(child)
    ) {
      errors.push(
        error('UNSAFE_URL', `${path}/${key}`, 'URL scheme is not allowed', elementId, materialType),
      );
    }
    inspectSafeValues(child, `${path}/${key}`, elementId, materialType, errors);
  }
}

export function validatePageAgainstMaterials(
  schema: OrigamixPageSchema,
  projectMaterialSets: readonly { id: string; version: string }[],
  runtime: MaterialValidationRuntime = defaultMaterialValidationRuntime,
): MaterialValidationResult {
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
      continue;
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
    for (const [index, childId] of childIds.entries()) {
      const child = schema.elements[childId];
      if (!child || child.type === 'basicPage') continue;
      const childManifest = runtime.registry[child.type];
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
  inspectSafeValues(
    schema.flows,
    '/flows',
    schema.layout.root,
    schema.elements[schema.layout.root]?.type ?? 'basicPage',
    errors,
  );
  return { valid: errors.length === 0, errors };
}

export async function validateProjectPageAgainstMaterials(
  projectPath: string,
  schema: OrigamixPageSchema,
  runtime: MaterialValidationRuntime = defaultMaterialValidationRuntime,
): Promise<MaterialValidationResult> {
  const descriptor = JSON.parse(
    await readFile(join(projectPath, 'origamix.project.json'), 'utf8'),
  ) as ProjectDescriptor;
  const materialSets =
    descriptor.framework === 'react' && descriptor.uiLibrary === 'antd'
      ? [{ id: 'official-antd', version: '1.0.0' }]
      : [];
  return validatePageAgainstMaterials(schema, materialSets, runtime);
}
