import type { Database } from '@sqlite.org/sqlite-wasm';
import type { DbAdapter, SqlParam } from './adapter';

/** Bọc một Database của SQLite WASM (oo1 API) thành DbAdapter. Dùng được cả trên trình duyệt và Node (test). */
export function createWasmAdapter(db: Database): DbAdapter {
  let depth = 0;
  // SQLite WASM báo lỗi nếu bind mảng rỗng cho câu lệnh không có tham số.
  const bind = (params: SqlParam[]) => (params.length ? params : undefined);

  const adapter: DbAdapter = {
    run(sql: string, params: SqlParam[] = []) {
      db.exec({ sql, bind: bind(params) });
      return {
        changes: Number(db.changes()),
        lastInsertRowid: Number(db.selectValue('SELECT last_insert_rowid()')),
      };
    },
    all<T>(sql: string, params: SqlParam[] = []) {
      return db.selectObjects(sql, bind(params)) as T[];
    },
    get<T>(sql: string, params: SqlParam[] = []) {
      return db.selectObject(sql, bind(params)) as T | undefined;
    },
    exec(sql: string) {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      // Transaction lồng nhau dùng SAVEPOINT.
      const name = `sp${depth}`;
      db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${name}`);
      depth++;
      try {
        const result = fn();
        depth--;
        db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
        return result;
      } catch (err) {
        depth--;
        db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
        throw err;
      }
    },
  };
  return adapter;
}
