import { createPool, type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';

const version = 3;
const tables = [
  `CREATE TABLE IF NOT EXISTS origamix_web_projects (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    code VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    configuration JSON NOT NULL,
    created_at VARCHAR(24) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_pages (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    slug VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(80) NOT NULL,
    created_at VARCHAR(24) NOT NULL,
    updated_at VARCHAR(24) NOT NULL,
    UNIQUE KEY project_slug (project_id, slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_schema_records (
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kind ENUM('working', 'revision', 'journal', 'agent_commit') NOT NULL,
    record_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document JSON NOT NULL,
    PRIMARY KEY (project_id, page_id, kind, record_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_role_requests (
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    digest CHAR(64) CHARACTER SET ascii NOT NULL,
    PRIMARY KEY (project_id, request_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_agent_runs (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    client_request_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii NOT NULL,
    document JSON NOT NULL,
    UNIQUE KEY page_request (project_id, page_id, client_request_id),
    KEY run_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_conversations (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    page_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    updated_at VARCHAR(24) NOT NULL,
    document JSON NOT NULL,
    KEY page_history (project_id, page_id, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_messages (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    conversation_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    run_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    role VARCHAR(12) CHARACTER SET ascii NOT NULL,
    sequence_no INT UNSIGNED NOT NULL,
    document JSON NOT NULL,
    UNIQUE KEY conversation_sequence (conversation_id, sequence_no),
    UNIQUE KEY run_role (run_id, role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_tool_audits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document JSON NOT NULL,
    KEY by_run (run_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_sync_targets (
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    baseline JSON,
    pending JSON,
    PRIMARY KEY (project_id, target_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS origamix_web_sync_receipts (
    project_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    completed_at VARCHAR(24) NOT NULL,
    PRIMARY KEY (project_id, target_id, snapshot_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

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
    await pool.query(`CREATE TABLE IF NOT EXISTS origamix_web_version (
      id TINYINT PRIMARY KEY, version INT NOT NULL
    ) ENGINE=InnoDB`);
    const [rows] = await pool.query<(RowDataPacket & { version: number })[]>(
      'SELECT version FROM origamix_web_version WHERE id = 1',
    );
    if (rows.length && rows[0].version !== version)
      throw new Error('Web MySQL 数据库版本不受当前应用支持');
    for (const sql of tables) await pool.query(sql);
    await pool.execute(
      'INSERT INTO origamix_web_version (id, version) VALUES (1, ?) ON DUPLICATE KEY UPDATE id = id',
      [version],
    );
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
