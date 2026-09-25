/**
 * Lớp trung gian giữa repository và SQLite.
 *
 * Interface đồng bộ (sync) vì cả SQLite WASM (oo1 API) và better-sqlite3 đều chạy đồng bộ.
 * - Online:   createWasmAdapter()        → @sqlite.org/sqlite-wasm
 * - Electron: createNativeAdapter()      → better-sqlite3 (chạy trong main process)
 *
 * Repository (products.ts, imports.ts, invoices.ts, statistics.ts) chỉ phụ thuộc interface này.
 */
export type SqlParam = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface DbAdapter {
  /** INSERT / UPDATE / DELETE một câu lệnh. */
  run(sql: string, params?: SqlParam[]): RunResult;
  /** SELECT nhiều dòng. */
  all<T>(sql: string, params?: SqlParam[]): T[];
  /** SELECT một dòng (hoặc undefined). */
  get<T>(sql: string, params?: SqlParam[]): T | undefined;
  /** Chạy nhiều câu lệnh SQL không tham số (schema, migration). */
  exec(sql: string): void;
  /** Chạy fn trong một transaction; lỗi sẽ rollback toàn bộ. */
  transaction<T>(fn: () => T): T;
}
