import { createHash } from 'node:crypto';

/** Exact serialized operation identity, shared by audit and durable commit receipts. */
export const hashOperations = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
