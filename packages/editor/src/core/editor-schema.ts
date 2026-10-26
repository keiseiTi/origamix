import { SchemaUtils } from './schema';
import { type OrigamixPageSchema as Schema } from '@origamix/shared';

export const removeEditorElement = (schema: Schema, elementId: string): Schema => {
  return SchemaUtils.removeElement(schema, elementId).schema;
};
