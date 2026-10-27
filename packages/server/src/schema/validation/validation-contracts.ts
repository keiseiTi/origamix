import type { ValidationMaterialManifest } from '@origamix/shared';

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

export const createMaterialValidationError = (
  code: MaterialValidationErrorCode,
  path: string,
  message: string,
  elementId?: string,
  materialType?: string,
): MaterialValidationError => {
  return { code, path, message, elementId: elementId ?? null, materialType: materialType ?? null };
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
