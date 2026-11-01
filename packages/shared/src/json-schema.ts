import Ajv, { type ValidateFunction } from 'ajv';
import type { JsonSchema } from './material/material-manifest.ts';

let ajv: Ajv | undefined;
const validators = new WeakMap<object, ValidateFunction>();
export const compileJsonSchema = (schema: JsonSchema): ValidateFunction => {
  const cached = validators.get(schema);
  if (cached) return cached;
  const validate = (ajv ??= new Ajv({ allErrors: true, strict: true })).compile(schema);
  validators.set(schema, validate);
  return validate;
};
