import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const ApiResultSchema = Type.Union([
  Type.Object(
    { success: Type.Literal(true), code: Type.Literal(200), data: Type.Unknown() },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      success: Type.Literal(false),
      code: Type.Integer({ minimum: 400 }),
      data: Type.Null(),
      message: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
]);

export type ApiResult<T> =
  | { success: true; code: 200; data: T }
  | { success: false; code: number; data: null; message?: string };

export const isApiResultEnvelope = (value: unknown): value is ApiResult<unknown> => {
  return Value.Check(ApiResultSchema, value);
};
