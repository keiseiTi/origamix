import { Type, type Static } from '@sinclair/typebox';
import { LayoutApplyResultSchema } from '@origamix/shared';

export const LayoutApplyReceiptSchema = Type.Object(
  {
    version: Type.Literal(1),
    state: Type.Union([Type.Literal('prepared'), Type.Literal('committed')]),
    ...LayoutApplyResultSchema.properties,
    clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
    requestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    expectedWorkingVersion: Type.Integer({ minimum: 1 }),
    baselineHash: Type.Union([Type.String({ pattern: '^[a-f0-9]{64}$' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type LayoutApplyReceipt = Static<typeof LayoutApplyReceiptSchema>;
