import { validatePage, type OrigamixPageSchema } from '@origamix/shared';
import { ApiError } from '../../errors';
import { validateProjectPageAgainstMaterials } from './material-validation';
import type { SchemaPageRef } from '../schema-contracts';

export interface SchemaValidationIssue {
  code: string;
  path: string;
  message: string;
  operationIndex?: number;
}

export class SchemaValidationError extends ApiError {
  constructor(readonly issue: SchemaValidationIssue) {
    super(`${issue.code} at ${issue.path}: ${issue.message}`, 422);
  }
}

export const validationMessage = (result: ReturnType<typeof validatePage>): string => {
  const semantic = result.semanticErrors[0];
  if (semantic) return `${semantic.code} at ${semantic.path}: ${semantic.message}`;
  return result.errors[0]?.message ?? 'Schema 校验失败';
};
export const validateWritableSchema = async (
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
  executableFlowIds?: ReadonlySet<string>,
): Promise<void> => {
  const structural = validatePage(schema);
  if (!structural.valid) {
    const semantic = structural.semanticErrors[0];
    throw new SchemaValidationError({
      code: semantic?.code ?? 'INVALID_PAGE_SCHEMA',
      path: semantic?.path ?? structural.errors[0]?.instancePath ?? '/',
      message: validationMessage(structural),
    });
  }
  const material = await validateProjectPageAgainstMaterials(
    page.projectPath,
    schema,
    undefined,
    executableFlowIds,
  );
  if (!material.valid) {
    const first = material.errors[0]!;
    throw new SchemaValidationError({ code: first.code, path: first.path, message: first.message });
  }
};
