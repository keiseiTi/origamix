import { drizzle, type NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase } from './initialize';

export type DatabaseClient = NodeSQLiteDatabase;
type TransactionClient = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
export type TransactionResult<T> = T extends Promise<unknown> ? never : T;

export class ApplicationDatabase {
  readonly connection: DatabaseSync;
  readonly orm: DatabaseClient;

  constructor(path: string) {
    const connection = new DatabaseSync(path);
    try {
      this.configure(connection);
      this.orm = drizzle({ client: connection });
    } catch (error) {
      connection.close();
      throw error;
    }
    this.connection = connection;
  }

  private configure(connection: DatabaseSync): void {
    connection.exec(
      'PRAGMA foreign_keys = OFF; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
    );
    initializeDatabase(connection);
  }

  transaction<T>(action: (tx: TransactionClient) => TransactionResult<T>): T {
    const { result } = this.orm.transaction((tx) => ({ result: action(tx) }), {
      behavior: 'immediate',
    });
    return result;
  }

  close(): void {
    this.connection.close();
  }
}
