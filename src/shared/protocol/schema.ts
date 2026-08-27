import { Type, type Static } from '@sinclair/typebox'

export const ElementIdSchema = Type.String({ pattern: '^element_[A-Za-z0-9_-]+$' })
export const RevisionIdSchema = Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })

export const PageElementSchema = Type.Object({
  type: Type.String({ minLength: 1 }),
  props: Type.Record(Type.String(), Type.Unknown())
})

export const PageSchema = Type.Object({
  elements: Type.Record(ElementIdSchema, PageElementSchema),
  layout: Type.Object({
    root: ElementIdSchema,
    structure: Type.Record(ElementIdSchema, Type.Array(ElementIdSchema))
  }),
  flows: Type.Record(Type.String(), Type.Unknown()),
  bindElements: Type.Array(Type.Unknown()),
  context: Type.Object({ globalVariables: Type.Array(Type.Unknown()) }),
  extensions: Type.Object({
    origamix: Type.Object({ schemaVersion: Type.Literal('1.0') })
  })
})

export const ChangeSourceSchema = Type.Union([
  Type.Object({ kind: Type.Literal('user'), actorId: Type.Optional(Type.String()) }),
  Type.Object({
    kind: Type.Literal('agent'),
    runId: Type.String(),
    messageId: Type.Optional(Type.String())
  }),
  Type.Object({ kind: Type.Literal('undo'), revisionId: RevisionIdSchema })
])

const ChangeSetBaseSchema = Type.Object({
  changeSetId: Type.String({ pattern: '^change_[A-Za-z0-9_-]+$' }),
  pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
  baseRevisionId: RevisionIdSchema,
  source: ChangeSourceSchema,
  createdAt: Type.String({ format: 'date-time' })
})

export const ReplaceSchemaChangeSet = Type.Composite([
  ChangeSetBaseSchema,
  Type.Object({ operation: Type.Literal('replaceSchema'), schema: PageSchema })
])

export const UpdateElementPropsChangeSet = Type.Composite([
  ChangeSetBaseSchema,
  Type.Object({
    operation: Type.Literal('updateElementProps'),
    elementId: ElementIdSchema,
    props: Type.Record(Type.String(), Type.Unknown())
  })
])

export const ChangeSetSchema = Type.Union([ReplaceSchemaChangeSet, UpdateElementPropsChangeSet])

export type OrigamixPageSchema = Static<typeof PageSchema>
export type ChangeSet = Static<typeof ChangeSetSchema>
