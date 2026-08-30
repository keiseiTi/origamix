import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { ChangeSet, OrigamixPageSchema } from '../../shared/protocol/schema';
import { validateChangeSet, validatePage } from '../../shared/protocol/validation';

interface PageMeta {
  pageId: string;
  name: string;
  slug: string;
  revisionId?: string;
}

interface RevisionSnapshot {
  revisionId: string;
  parentRevisionId: string | null;
  source: ChangeSet['source'];
  createdAt: string;
  schemaHash: string;
  schema: OrigamixPageSchema;
}

export interface SchemaPageRef {
  projectPath: string;
  pageId: string;
  slug: string;
}

export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${nanoid()}.tmp`;
  const handle = await open(temporaryPath, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, path);
}

function pageDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, 'src', 'pages', page.slug);
}

function schemaFile(page: SchemaPageRef): string {
  return join(pageDirectory(page), 'schema.json');
}

function metaFile(page: SchemaPageRef): string {
  return join(pageDirectory(page), 'page.meta.json');
}

function revisionsDirectory(page: SchemaPageRef): string {
  return join(page.projectPath, '.origamix', 'revisions', page.pageId);
}

function revisionFile(page: SchemaPageRef, revisionId: string): string {
  return join(revisionsDirectory(page), `${revisionId}.json`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function hashSchema(schema: OrigamixPageSchema): string {
  return createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

function validationMessage(result: ReturnType<typeof validatePage>): string {
  const error = result.errors[0];
  const semanticError = result.semanticErrors[0];
  return semanticError?.message ?? error?.message ?? 'Schema 校验失败';
}

async function readPageMeta(page: SchemaPageRef): Promise<PageMeta & { revisionId: string }> {
  const meta = await readJson<PageMeta>(metaFile(page));
  if (meta.pageId !== page.pageId) throw new Error('页面元信息不匹配');
  if (!meta.revisionId) throw new Error('页面缺少 Revision，需要重新索引');
  return meta as PageMeta & { revisionId: string };
}

async function createRevision(
  page: SchemaPageRef,
  schema: OrigamixPageSchema,
  source: ChangeSet['source'],
  parentRevisionId: string | null
): Promise<RevisionSnapshot> {
  const snapshot: RevisionSnapshot = {
    revisionId: `revision_${nanoid()}`,
    parentRevisionId,
    source,
    createdAt: new Date().toISOString(),
    schemaHash: hashSchema(schema),
    schema
  };
  await mkdir(revisionsDirectory(page), { recursive: true });
  await writeJsonAtomically(revisionFile(page, snapshot.revisionId), snapshot);
  return snapshot;
}

export async function initializePageSchema(
  page: SchemaPageRef,
  schema: OrigamixPageSchema
): Promise<string> {
  const validation = validatePage(schema);
  if (!validation.valid) throw new Error(validationMessage(validation));
  const revision = await createRevision(page, schema, { kind: 'user', actorId: 'system' }, null);
  await writeJsonAtomically(schemaFile(page), schema);
  const meta = await readJson<PageMeta>(metaFile(page));
  await writeJsonAtomically(metaFile(page), { ...meta, revisionId: revision.revisionId });
  return revision.revisionId;
}

export async function getSchema(page: SchemaPageRef): Promise<SchemaReadResult> {
  const meta = await readPageMeta(page);
  const schema = await readJson<OrigamixPageSchema>(schemaFile(page));
  const validation = validatePage(schema);
  if (!validation.valid) throw new Error(validationMessage(validation));
  return { schema, revisionId: meta.revisionId };
}

function applyChangeSet(schema: OrigamixPageSchema, changeSet: ChangeSet): OrigamixPageSchema {
  if (changeSet.operation === 'replaceSchema') return changeSet.schema;
  const element = schema.elements[changeSet.elementId];
  if (!element) throw new Error('目标元素不存在');
  return {
    ...schema,
    elements: {
      ...schema.elements,
      [changeSet.elementId]: { ...element, props: { ...element.props, ...changeSet.props } }
    }
  };
}

export async function commitSchema(
  page: SchemaPageRef,
  changeSet: ChangeSet
): Promise<SchemaReadResult> {
  const changeSetValidation = validateChangeSet(changeSet);
  if (!changeSetValidation.valid) throw new Error('ChangeSet 格式无效');
  if (changeSet.pageId !== page.pageId) throw new Error('ChangeSet 页面不匹配');

  const current = await getSchema(page);
  if (changeSet.baseRevisionId !== current.revisionId)
    throw new Error('页面已更新，请重新加载后再提交');

  const candidate = applyChangeSet(current.schema, changeSet);
  const validation = validatePage(candidate);
  if (!validation.valid) throw new Error(validationMessage(validation));

  const revision = await createRevision(page, candidate, changeSet.source, current.revisionId);
  await writeJsonAtomically(schemaFile(page), candidate);
  const meta = await readPageMeta(page);
  await writeJsonAtomically(metaFile(page), { ...meta, revisionId: revision.revisionId });
  return { schema: candidate, revisionId: revision.revisionId };
}

export async function undoSchema(page: SchemaPageRef): Promise<SchemaReadResult> {
  const current = await getSchema(page);
  const currentRevision = await readJson<RevisionSnapshot>(revisionFile(page, current.revisionId));
  if (!currentRevision.parentRevisionId) throw new Error('当前页面没有可撤销的 Revision');
  const parent = await readJson<RevisionSnapshot>(
    revisionFile(page, currentRevision.parentRevisionId)
  );
  const revision = await createRevision(
    page,
    parent.schema,
    { kind: 'undo', revisionId: current.revisionId },
    current.revisionId
  );
  await writeJsonAtomically(schemaFile(page), parent.schema);
  const meta = await readPageMeta(page);
  await writeJsonAtomically(metaFile(page), { ...meta, revisionId: revision.revisionId });
  return { schema: parent.schema, revisionId: revision.revisionId };
}
