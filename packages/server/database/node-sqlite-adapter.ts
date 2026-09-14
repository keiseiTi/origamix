import type { Database as BetterSqliteDatabase, RunResult } from 'better-sqlite3';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { BetterSQLiteSession } from 'drizzle-orm/better-sqlite3/session';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core/db';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core/dialect';
import type { ExtractTablesWithRelations } from 'drizzle-orm/relations';

type TransactionAction = (...arguments_: unknown[]) => unknown;

export const adaptNodeSqlite = (connection: DatabaseSync): BetterSqliteDatabase => {
  const adapter = {
    prepare: (source: string) => {
      const statement = connection.prepare(source);
      let returnArrays = false;
      const prepared = {
        run: (...parameters: SQLInputValue[]) => {
          returnArrays = false;
          statement.setReturnArrays(returnArrays);
          const result = statement.run(...parameters);
          return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
        },
        all: (...parameters: SQLInputValue[]) => {
          statement.setReturnArrays(returnArrays);
          return statement.all(...parameters);
        },
        get: (...parameters: SQLInputValue[]) => {
          statement.setReturnArrays(returnArrays);
          return statement.get(...parameters);
        },
        raw: (enabled = true) => {
          returnArrays = enabled;
          statement.setReturnArrays(returnArrays);
          return prepared;
        },
      };
      return prepared;
    },
    transaction: (action: TransactionAction) => {
      const execute =
        (behavior: '' | ' deferred' | ' immediate' | ' exclusive') =>
        (...arguments_: unknown[]): unknown => {
          connection.exec(`BEGIN${behavior}`);
          try {
            const result = action(...arguments_);
            connection.exec('COMMIT');
            return result;
          } catch (error) {
            connection.exec('ROLLBACK');
            throw error;
          }
        };
      const transaction = execute('');
      return Object.assign(transaction, {
        deferred: execute(' deferred'),
        immediate: execute(' immediate'),
        exclusive: execute(' exclusive'),
      });
    },
  };
  return adapter as unknown as BetterSqliteDatabase;
};

type EmptySchema = Record<string, never>;
type EmptyRelations = ExtractTablesWithRelations<EmptySchema>;
class NodeSQLiteDrizzleDatabase extends BaseSQLiteDatabase<
  'sync',
  RunResult,
  EmptySchema,
  EmptyRelations
> {}

export const createNodeSQLiteDrizzle = (connection: DatabaseSync): BetterSQLite3Database => {
  const client = adaptNodeSqlite(connection);
  const dialect = new SQLiteSyncDialect();
  const session = new BetterSQLiteSession<EmptySchema, EmptyRelations>(client, dialect, undefined);
  const database = new NodeSQLiteDrizzleDatabase('sync', dialect, session, undefined);
  return database as unknown as BetterSQLite3Database;
};
