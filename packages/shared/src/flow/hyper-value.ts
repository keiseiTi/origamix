import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';

const object = { additionalProperties: false } as const;

const literal = <T extends 'string' | 'expression' | 'contextValue'>(type: T) =>
  Type.Object({ type: Type.Literal(type), value: Type.String() }, object);

export const FunctionValueSchema = Type.Object(
  {
    type: Type.Literal('function'),
    value: Type.Object(
      {
        params: Type.Array(Type.Object({ name: Type.String(), value: Type.String() }, object)),
        body: Type.String(),
      },
      object,
    ),
  },
  object,
);

/** Serializable configuration only. Expressions/functions are executed exclusively by Runtime. */
export const HyperValueSchema = Type.Union([
  literal('string'),
  Type.Object({ type: Type.Literal('number'), value: Type.Number() }, object),
  Type.Object({ type: Type.Literal('boolean'), value: Type.Boolean() }, object),
  Type.Object({ type: Type.Literal('null'), value: Type.Null() }, object),
  literal('contextValue'),
  literal('expression'),
  FunctionValueSchema,
]);

export type HyperValue = Static<typeof HyperValueSchema>;

export type FunctionValue = Static<typeof FunctionValueSchema>;

export const isHyperValue = (value: unknown): value is HyperValue => Check(HyperValueSchema, value);
