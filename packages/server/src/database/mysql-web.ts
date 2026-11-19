import { createPool, type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';

import { createHash } from 'node:crypto';

const version = 1;
const versionTable = 'origamix_web_version';
const versionDdl = `CREATE TABLE ${versionTable} (
  id TINYINT PRIMARY KEY, version INT NOT NULL, schema_digest CHAR(64) CHARACTER SET ascii NOT NULL
) ENGINE=InnoDB`;
const tables = [
  `CREATE TABLE origamix_web_projects (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    code VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    configuration JSON NOT NULL,
    created_at VARCHAR(24) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_pages (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    slug VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(80) NOT NULL,
    created_at VARCHAR(24) NOT NULL,
    updated_at VARCHAR(24) NOT NULL,
    UNIQUE KEY project_slug (project_id, slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_schema_records (
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kind ENUM('working', 'revision', 'journal', 'agent_commit') NOT NULL,
    record_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document JSON NOT NULL,
    PRIMARY KEY (project_id, page_id, kind, record_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_role_requests (
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    digest CHAR(64) CHARACTER SET ascii NOT NULL,
    PRIMARY KEY (project_id, request_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_agent_runs (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    client_request_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii NOT NULL,
    document JSON NOT NULL,
    UNIQUE KEY page_request (project_id, page_id, client_request_id),
    KEY run_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_conversations (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    updated_at VARCHAR(24) NOT NULL,
    document JSON NOT NULL,
    KEY page_history (project_id, page_id, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_messages (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    conversation_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    run_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    role VARCHAR(12) CHARACTER SET ascii NOT NULL,
    sequence_no INT UNSIGNED NOT NULL,
    document JSON NOT NULL,
    UNIQUE KEY conversation_sequence (conversation_id, sequence_no),
    UNIQUE KEY run_role (run_id, role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE origamix_web_tool_audits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document JSON NOT NULL,
    KEY by_run (run_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const tableNames = [versionTable, ...tables.map((sql) => sql.split(' ')[2])].sort();

const schemaDigest = async (connection: PoolConnection): Promise<string> => {
  const hash = createHash('sha256').update(JSON.stringify([versionDdl, ...tables]));
  for (const name of tableNames) {
    const [rows] = await connection.query<(RowDataPacket & { 'Create Table': string })[]>(
      `SHOW CREATE TABLE \`${name}\``,
    );
    hash.update(rows[0]['Create Table'].replace(/ AUTO_INCREMENT=\d+/g, ''));
  }
  return hash.digest('hex');
};

const initializeWebDatabase = async (connection: PoolConnection): Promise<void> => {
  const [found] = await connection.query<(RowDataPacket & { name: string })[]>(
    `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LEFT(TABLE_NAME, 13) = 'origamix_web_'`,
  );
  const names = found.map(({ name }) => name).sort();
  if (!names.length) {
    await connection.query(versionDdl);
    for (const sql of tables) await connection.query(sql);
    await connection.execute(
      'INSERT INTO origamix_web_version (id, version, schema_digest) VALUES (1, ?, ?)',
      [version, await schemaDigest(connection)],
    );
    return;
  }

  if (!names.includes(versionTable)) throw new Error('Web MySQL 数据库缺少版本信息');
  const [versions] = await connection.query<(RowDataPacket & { version: number })[]>(
    'SELECT version FROM origamix_web_version WHERE id = 1',
  );
  if (!versions.length) throw new Error('Web MySQL 数据库缺少版本信息');
  if (versions[0].version !== version) throw new Error('Web MySQL 数据库版本不受当前应用支持');
  if (JSON.stringify(names) !== JSON.stringify(tableNames))
    throw new Error('Web MySQL 数据库结构与当前版本不一致');
  const [markers] = await connection.query<(RowDataPacket & { schema_digest: string })[]>(
    'SELECT schema_digest FROM origamix_web_version WHERE id = 1',
  );
  if (markers[0].schema_digest !== (await schemaDigest(connection)))
    throw new Error('Web MySQL 数据库结构与当前版本不一致');
};

const databaseStartupError = (error: unknown): unknown => {
  const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
  return code ? new Error(`无法初始化 Web MySQL 数据库（${code}）`) : error;
};

export const openWebDatabase = async (uri: string): Promise<Pool> => {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('ORIGAMIX_WEB_MYSQL_URL 格式无效');
  }
  if (url.protocol !== 'mysql:' || !/^\/[a-zA-Z0-9_]+$/.test(url.pathname))
    throw new Error('ORIGAMIX_WEB_MYSQL_URL 需要指定 MySQL 数据库');
  const pool = createPool({
    uri,
    charset: 'utf8mb4',
    jsonStrings: true,
    connectionLimit: 8,
    connectTimeout: 5000,
  });
  try {
    const connection = await pool.getConnection();
    try {
      const lock = createHash('sha256').update(`origamix-schema:${url.pathname}`).digest('hex');
      const [rows] = await connection.execute<(RowDataPacket & { acquired: number })[]>(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [lock],
      );
      if (rows[0].acquired !== 1) throw new Error('Web MySQL 数据库正在初始化');
      await initializeWebDatabase(connection);
    } finally {
      connection.destroy();
    }
  } catch (error) {
    await pool.end();
    throw databaseStartupError(error);
  }
  return pool;
};

export const inWebTransaction = async <T>(
  pool: Pool,
  action: (connection: PoolConnection) => Promise<T>,
): Promise<T> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      connection.destroy();
    }
    throw error;
  } finally {
    connection.release();
  }
};
