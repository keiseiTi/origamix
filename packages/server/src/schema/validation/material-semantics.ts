import type { OrigamixPageSchema } from '@origamix/shared';
import {
  createMaterialValidationError as error,
  type MaterialValidationError,
  type MaterialValidationRuntime,
} from './validation-contracts';

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
    for (const [index, childId] of childIds.entries()) {
      const child = schema.elements[childId];
      if (!child || child.type === 'basicPage') continue;
      const childManifest = runtime.registry[child.type];
      if (
        (childManifest?.role === 'overlay' && parentId !== schema.layout.root) ||
        (childManifest?.allowedParentTypes &&
          !childManifest.allowedParentTypes.includes(parent.type))
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
