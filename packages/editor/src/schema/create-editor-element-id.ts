import { createElementId } from '@origamix/shared';
import { nanoid } from 'nanoid';

export const createEditorElementId = (type: string, isTaken?: (id: string) => boolean): string =>
  createElementId(type, nanoid, isTaken);
