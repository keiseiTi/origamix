import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ChangeSetSchema, PageSchema, type ChangeSet, type OrigamixPageSchema } from './schema';

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export interface SemanticError {
  code: 'ROOT_NOT_FOUND' | 'LAYOUT_ELEMENT_NOT_FOUND' | 'LAYOUT_CYCLE';
  path: string;
  message: string;
}

export interface PageValidationResult extends ValidationResult {
  semanticErrors: SemanticError[];
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validatePageSchema = ajv.compile<OrigamixPageSchema>(PageSchema);
const validateChangeSetSchema = ajv.compile<ChangeSet>(ChangeSetSchema);

function result(errors: ErrorObject[] | null | undefined): ValidationResult {
  return { valid: !errors, errors: errors ? [...errors] : [] };
}

function validatePageSemantics(page: OrigamixPageSchema): SemanticError[] {
  const errors: SemanticError[] = [];
  const elementIds = new Set(Object.keys(page.elements));

  if (!elementIds.has(page.layout.root)) {
    errors.push({
      code: 'ROOT_NOT_FOUND',
      path: '/layout/root',
      message: 'Root element does not exist'
    });
  }

  const visited = new Set<string>();
  const active = new Set<string>();

  function visit(elementId: string): void {
    if (active.has(elementId)) {
      errors.push({
        code: 'LAYOUT_CYCLE',
        path: `/layout/structure/${elementId}`,
        message: `Layout contains a cycle at ${elementId}`
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
          message: `Layout references missing element ${childId}`
        });
        continue;
      }
      visit(childId);
    }
    active.delete(elementId);
  }

  for (const elementId of Object.keys(page.layout.structure)) {
    if (!elementIds.has(elementId)) {
      errors.push({
        code: 'LAYOUT_ELEMENT_NOT_FOUND',
        path: `/layout/structure/${elementId}`,
        message: `Layout key references missing element ${elementId}`
      });
      continue;
    }
    visit(elementId);
  }

  return errors;
}

export function validatePage(value: unknown): PageValidationResult {
  const structurallyValid = validatePageSchema(value);
  const structuralResult = result(validatePageSchema.errors);
  const semanticErrors = structurallyValid ? validatePageSemantics(value) : [];
  return {
    ...structuralResult,
    valid: structuralResult.valid && semanticErrors.length === 0,
    semanticErrors
  };
}

export function validateChangeSet(value: unknown): ValidationResult {
  validateChangeSetSchema(value);
  return result(validateChangeSetSchema.errors);
}
