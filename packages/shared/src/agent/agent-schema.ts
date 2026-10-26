import { Type } from '@sinclair/typebox';
import type { TSchema } from '@sinclair/typebox';

export const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

export const AgentProtocolVersionSchema = Type.Literal('1');

export const AgentRunIdSchema = Type.String({ pattern: '^run_[A-Za-z0-9_-]+$' });

export const ConversationIdSchema = Type.String({ pattern: '^conversation_[A-Za-z0-9_-]+$' });

export const MessageIdSchema = Type.String({ pattern: '^message_[A-Za-z0-9_-]+$' });

export const PageIdSchema = Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' });

export const RequestIdSchema = Type.String({ minLength: 1, maxLength: 128 });

export const IsoDateTimeSchema = Type.String({ format: 'date-time' });
