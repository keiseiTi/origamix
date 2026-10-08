import { DatabaseSync } from 'node:sqlite';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLiteTransaction } from 'drizzle-orm/better-sqlite3/session';
import type { TablesRelationalConfig } from 'drizzle-orm/relations';
import { initializeDatabase } from './initialize';
import { createNodeSQLiteDrizzle } from './node-sqlite-adapter';

type EmptySchema = Record<string, never>;
export type DatabaseClient =
  BetterSQLite3Database | BetterSQLiteTransaction<EmptySchema, TablesRelationalConfig>;
type TransactionRunner = <T>(
  action: (tx: BetterSQLiteTransaction<EmptySchema, TablesRelationalConfig>) => T,
  config: { behavior: 'immediate' },
) => T;

export class ApplicationDatabase {
  readonly connection: DatabaseSync;
  readonly orm: BetterSQLite3Database;

  constructor(path: string) {
    const connection = new DatabaseSync(path);
    try {
      this.configure(connection);
    } catch (error) {
      connection.close();
      throw error;
    }
    this.connection = connection;
    this.orm = createNodeSQLiteDrizzle(connection);
  }

  private configure(connection: DatabaseSync): void {
    connection.exec(
      'PRAGMA foreign_keys = OFF; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
    );
    initializeDatabase(connection);
  }

  transaction<T>(
    action: (tx: BetterSQLiteTransaction<EmptySchema, TablesRelationalConfig>) => T,
  ): T {
    const runTransaction = this.orm.transaction.bind(this.orm) as unknown as TransactionRunner;
    return runTransaction(action, { behavior: 'immediate' });
  }

  close(): void {
    this.connection.close();
  }
}
