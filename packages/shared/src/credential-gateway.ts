import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

export const CredentialGatewayVersionSchema = Type.Literal('1');
export const CredentialReferenceSchema = Type.Union([Type.Literal('model.deepseek.api-key')]);
export const CredentialPurposeSchema = Type.Union([
  Type.Literal('agent.model-request'),
  Type.Literal('agent.model-capability-check'),
]);

export const CredentialRequestSchema = strictObject({
  version: CredentialGatewayVersionSchema,
  requestId: Type.String({ minLength: 1, maxLength: 128 }),
  caller: Type.Literal('server-agent'),
  credentialRef: CredentialReferenceSchema,
  purpose: CredentialPurposeSchema,
});

export const CredentialSuccessResponseSchema = strictObject({
  version: CredentialGatewayVersionSchema,
  requestId: Type.String({ minLength: 1, maxLength: 128 }),
  success: Type.Literal(true),
  credential: Type.String({ minLength: 1 }),
});

export const CredentialFailureResponseSchema = strictObject({
  version: CredentialGatewayVersionSchema,
  requestId: Type.String({ minLength: 1, maxLength: 128 }),
  success: Type.Literal(false),
  code: Type.Union([
    Type.Literal('INVALID_CALLER'),
    Type.Literal('UNKNOWN_CREDENTIAL_REF'),
    Type.Literal('DUPLICATE_REQUEST'),
    Type.Literal('CREDENTIAL_UNAVAILABLE'),
    Type.Literal('TIMEOUT'),
    Type.Literal('GATEWAY_CLOSING'),
    Type.Literal('INTERNAL_ERROR'),
  ]),
  safeMessage: Type.Optional(Type.String({ maxLength: 500 })),
});

export const CredentialResponseSchema = Type.Union([
  CredentialSuccessResponseSchema,
  CredentialFailureResponseSchema,
]);

export type CredentialReference = Static<typeof CredentialReferenceSchema>;
export type CredentialPurpose = Static<typeof CredentialPurposeSchema>;
export type CredentialRequest = Static<typeof CredentialRequestSchema>;
export type CredentialResponse = Static<typeof CredentialResponseSchema>;

export const isCredentialRequest = (value: unknown): value is CredentialRequest => {
  return Value.Check(CredentialRequestSchema, value);
};

export const isCredentialResponse = (value: unknown): value is CredentialResponse => {
  return Value.Check(CredentialResponseSchema, value);
};
