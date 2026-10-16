import { SchemaUtils, type Schema } from '@tangramino/engine';

export const removeEditorElement = (schema: Schema, elementId: string): Schema => {
  return SchemaUtils.removeElement(schema, elementId).schema;
};
