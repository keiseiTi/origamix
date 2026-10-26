import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { PageRecordSchema } from '../page/page-api.ts';

export const ProjectRecordSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  path: Type.String(),
  status: Type.Integer({ minimum: 0, maximum: 5 }),
  createdAt: Type.String(),
  lastOpenedAt: Type.String(),
});

export const ProjectWithPagesSchema = Type.Intersect([
  ProjectRecordSchema,
  Type.Object({ pages: Type.Array(PageRecordSchema) }),
]);

export type ProjectWithPages = Static<typeof ProjectWithPagesSchema>;

export const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  code: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
  directoryGrantId: Type.String({ minLength: 1 }),
});

export const OpenProjectSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
  code: Type.Optional(Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })),
  directoryGrantId: Type.String({ minLength: 1 }),
  pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
  initializeIfNeeded: Type.Optional(Type.Boolean()),
});

export const RenameProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
});

export const DeleteDesktopRecordSchema = Type.Object({
  scope: Type.Literal('desktop_record'),
});

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  status: number;
  createdAt: string;
  lastOpenedAt: string;
}

export type OpenProjectResult =
  | { status: 'opened'; project: ProjectRecord }
  | {
      status: 'initialization_required';
      displayPath: string;
    };
