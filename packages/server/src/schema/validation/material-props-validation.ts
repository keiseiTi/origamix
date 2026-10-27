import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { isHyperValue, type ValidationMaterialManifest } from '@origamix/shared';
import {
  createMaterialValidationError as error,
  type MaterialValidationError,
} from './validation-contracts';

const ajv = new Ajv({ allErrors: true, strict: true });
const validatorCache = new WeakMap<object, ValidateFunction>();
const safeUrlPattern = /^(?:(?:https?):\/\/|(?:mailto|tel):|\/(?!\/)|\.{1,2}\/|#)/i;
const unsafeExpressionPattern =
  /(?:\b(?:eval|Function|import|require|process|globalThis|window|document|fetch|XMLHttpRequest)\b|__proto__|prototype|constructor|=>|;|(?<![=!<>])=(?!=))/;

export const propsValidator = (manifest: ValidationMaterialManifest): ValidateFunction => {
  const cached = validatorCache.get(manifest.propsSchema);
  if (cached) return cached;
  const compiled = ajv.compile(manifest.propsSchema);
  validatorCache.set(manifest.propsSchema, compiled);
  return compiled;
};

export const propertyPath = (elementId: string, ajvError: ErrorObject): string => {
  const suffix =
    ajvError.keyword === 'additionalProperties'
      ? `/${String(ajvError.params['additionalProperty'])}`
      : ajvError.instancePath;
  return `/elements/${elementId}/props${suffix}`;
};

export const inspectSafeValues = (
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
