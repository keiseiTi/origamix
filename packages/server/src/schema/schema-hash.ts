import type { OrigamixPageSchema } from '@origamix/shared';
import { hashJson } from '../infrastructure/json-hash';

export const hashSchema = (schema: OrigamixPageSchema): string => hashJson(schema);
