import { DatabaseSync } from 'node:sqlite'
import { migrations, assertMigrationSafety } from './migrations'

export class ApplicationDatabase {
  readonly connection: DatabaseSync

  constructor(path: string) {
    this.connection = new DatabaseSync(path)
    this.connection.exec(
      'PRAGMA foreign_keys = OFF; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;'
    )
    this.migrate()
  }

  private migrate(): void {
    this.connection.exec(
      'CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
    )
    const current = Number(
      this.connection.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get()
        ?.value ?? 0
    )
    for (const migration of migrations.filter((item) => item.version > current)) {
      assertMigrationSafety(migration.sql)
      this.connection.exec('BEGIN IMMEDIATE')
      try {
        this.connection.exec(migration.sql)
        this.connection
          .prepare(
            "INSERT INTO app_meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
          )
          .run(String(migration.version))
        this.connection.exec('COMMIT')
      } catch (error) {
        this.connection.exec('ROLLBACK')
        throw error
      }
    }
    this.connection
      .prepare(
        "INSERT INTO workspace_state (id, theme, sidebar_state, updated_at) VALUES (1, 'light', 'expanded', ?) ON CONFLICT(id) DO NOTHING"
      )
      .run(new Date().toISOString())
  }

  close(): void {
    this.connection.close()
  }
}
