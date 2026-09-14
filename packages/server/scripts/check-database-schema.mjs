import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(new URL('../database/initialize.ts', import.meta.url), 'utf8');
const embedded = source.match(/export const schemaSql = `([\s\S]*?)`;/)?.[1];
if (!embedded) throw new Error('无法读取 initialize.ts 中的 schemaSql');

const exported = spawnSync(
  'pnpm',
  ['exec', 'drizzle-kit', 'export', '--config', 'drizzle.config.ts'],
  { cwd: packageRoot, encoding: 'utf8' },
);
if (exported.status !== 0) throw new Error(exported.stderr || 'Drizzle schema 导出失败');

const normalize = (sql) =>
  sql
    .replaceAll('`', '')
    .replace(/constraint\s+\w+\s+/gi, '')
    .toLowerCase()
    .split(';')
    .map((statement) =>
      statement
        .replace(/\s+/g, '')
        .replace(/notnulldefault('[^']*'|\d+)/g, 'default$1notnull')
        .replace(/(primarykey(?:autoincrement)?)notnull/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .sort();

if (JSON.stringify(normalize(embedded)) !== JSON.stringify(normalize(exported.stdout))) {
  const embeddedStatements = normalize(embedded);
  const exportedStatements = normalize(exported.stdout);
  const missing = exportedStatements.filter((statement) => !embeddedStatements.includes(statement));
  const extra = embeddedStatements.filter((statement) => !exportedStatements.includes(statement));
  throw new Error(
    `database/schema.ts 与 initialize.ts 的当前结构 SQL 不一致\nmissing: ${missing.join('\n')}\nextra: ${extra.join('\n')}`,
  );
}
