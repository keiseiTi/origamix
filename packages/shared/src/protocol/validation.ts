import { Check } from '@sinclair/typebox/value';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { flowPointer, validateFlowSemantics, type FlowSemanticError } from './flow-validation.ts';
import {
  PageSchema,
  SchemaOperationBatchSchema,
  SchemaOperationSchema,
  type OrigamixPageSchema,
  type SchemaOperation,
  type SchemaOperationBatch,
} from './schema.ts';

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export interface LayoutSemanticError {
  code: 'ROOT_NOT_FOUND' | 'LAYOUT_ELEMENT_NOT_FOUND' | 'LAYOUT_CYCLE';
  path: string;
  message: string;
}

export type SemanticError =
  | LayoutSemanticError
  | FlowSemanticError
  | {
      code: 'INVALID_BINDING';
      path: string;
      message: string;
    };

export interface PageValidationResult extends ValidationResult {
  semanticErrors: SemanticError[];
}

let ajv: Ajv | undefined;
const getAjv = (): Ajv => {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);
  }
  return ajv;
};

let pageValidator: ValidateFunction<OrigamixPageSchema> | undefined;
let operationValidator: ValidateFunction<SchemaOperation> | undefined;
let batchValidator: ValidateFunction<SchemaOperationBatch> | undefined;

const result = (errors: ErrorObject[] | null | undefined): ValidationResult => {
  return { valid: !errors, errors: errors ? [...errors] : [] };
};

const validatePageSemantics = (page: OrigamixPageSchema): SemanticError[] => {
  const errors: SemanticError[] = [];
  const elementIds = new Set(Object.keys(page.elements));

  if (!elementIds.has(page.layout.root)) {
    errors.push({
      code: 'ROOT_NOT_FOUND',
      path: '/layout/root',
      message: 'Root element does not exist',
    });
  }

  const visited = new Set<string>();
  const active = new Set<string>();

  const visit = (elementId: string): void => {
    if (active.has(elementId)) {
      errors.push({
        code: 'LAYOUT_CYCLE',
        path: `/layout/structure/${elementId}`,
        message: `Layout contains a cycle at ${elementId}`,
      });
      return;
    }
    if (visited.has(elementId)) return;

    visited.add(elementId);
    active.add(elementId);
    for (const childId of page.layout.structure[elementId] ?? []) {
      if (!elementIds.has(childId)) {
        errors.push({
          code: 'LAYOUT_ELEMENT_NOT_FOUND',
          path: `/layout/structure/${elementId}`,
          message: `Layout references missing element ${childId}`,
        });
        continue;
      }
      visit(childId);
    }
    active.delete(elementId);
  };

  for (const elementId of Object.keys(page.layout.structure)) {
    if (!elementIds.has(elementId)) {
      errors.push({
        code: 'LAYOUT_ELEMENT_NOT_FOUND',
        path: `/layout/structure/${elementId}`,
        message: `Layout key references missing element ${elementId}`,
      });
      continue;
    }
    visit(elementId);
  }

  for (const [flowId, flow] of Object.entries(page.flows))
    errors.push(...validateFlowSemantics(flow, `/flows/${flowPointer(flowId)}`));
  const bindings = new Set<string>();
  for (const [index, binding] of page.bindElements.entries()) {
    const key = JSON.stringify([binding.id, binding.event]);
    if (
      !elementIds.has(binding.id) ||
      !Object.hasOwn(page.flows, binding.flowId) ||
      bindings.has(key)
    )
      errors.push({
        code: 'INVALID_BINDING',
        path: `/bindElements/${index}`,
        message: 'Event binding must be unique and reference an existing element and flow',
      });
    bindings.add(key);
  }
  return errors;
};

export const validatePage = (value: unknown): PageValidationResult => {
  const validatePageSchema = (pageValidator ??= getAjv().compile<OrigamixPageSchema>(PageSchema));
  const structurallyValid = validatePageSchema(value);
  const structuralResult = result(validatePageSchema.errors);
  const semanticErrors = structurallyValid ? validatePageSemantics(value) : [];
  return {
    ...structuralResult,
    valid: structuralResult.valid && semanticErrors.length === 0,
    semanticErrors,
  };
};

export const validateSchemaOperation = (value: unknown): ValidationResult => {
  const validateSchemaOperationSchema = (operationValidator ??=
    getAjv().compile<SchemaOperation>(SchemaOperationSchema));
  validateSchemaOperationSchema(value);
  return result(validateSchemaOperationSchema.errors);
};

export const validateSchemaOperationBatch = (value: unknown): ValidationResult => {
  const validateSchemaOperationBatchSchema = (batchValidator ??=
    getAjv().compile<SchemaOperationBatch>(SchemaOperationBatchSchema));
  validateSchemaOperationBatchSchema(value);
  return result(validateSchemaOperationBatchSchema.errors);
};

/** Interpreted validation for CSP-restricted design surfaces; no generated JavaScript. */
export const isPageSchema = (value: unknown): value is OrigamixPageSchema =>
  Check(PageSchema, value) && validatePageSemantics(value).length === 0;
