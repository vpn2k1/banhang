import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { DbAdapter } from './adapter';
import { createWasmAdapter } from './wasm';
import { migrate } from './schema';
import { idbGet, idbSet } from '../lib/idb';

/**
 * Khởi tạo SQLite WASM trên trình duyệt (bản test online).
 *
 * Database chạy in-memory trên main thread; sau mỗi thao tác ghi, toàn bộ file .sqlite
 * được export và lưu vào IndexedDB → F5 không mất dữ liệu. Cách này không cần header
 * COOP/COEP như OPFS nên chạy được trên StackBlitz / mọi static host.
 */
const STORAGE_KEY = 'main.sqlite';

let sqlite3: Sqlite3Static | undefined;
let rawDb: Database | undefined;
let adapter: DbAdapter | undefined;
let initPromise: Promise<DbAdapter> | undefined;
let persistent = true;
let saveChain: Promise<void> = Promise.resolve();

function openFromBytes(bytes?: Uint8Array): Database {
  const s = sqlite3!;
  const db = new s.oo1.DB(':memory:');
  if (bytes && bytes.byteLength > 0) {
    const p = s.wasm.allocFromTypedArray(bytes);
    const rc = s.capi.sqlite3_deserialize(
      db.pointer!,
      'main',
      p,
      bytes.byteLength,
      bytes.byteLength,
      s.capi.SQLITE_DESERIALIZE_FREEONCLOSE | s.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    if (rc !== 0) {
      db.close();
      throw new Error(`Không đọc được file database (mã lỗi ${rc})`);
    }
  }
  return db;
}

function use(db: Database): DbAdapter {
  const next = createWasmAdapter(db);
  migrate(next);
  // Kiểm tra đúng là database của ứng dụng
  next.get('SELECT 1 FROM products LIMIT 1');
  rawDb?.close();
  rawDb = db;
  adapter = next;
  return next;
}

export function initDatabase(): Promise<DbAdapter> {
  initPromise ??= load();
  return initPromise;
}

async function load(): Promise<DbAdapter> {
  sqlite3 = await sqlite3InitModule();
  let saved: Uint8Array | undefined;
  try {
    saved = await idbGet(STORAGE_KEY);
  } catch (err) {
    persistent = false;
    console.warn('IndexedDB không khả dụng, dữ liệu chỉ lưu tạm trong phiên này.', err);
  }
  return use(openFromBytes(saved));
}

export function getDb(): DbAdapter {
  if (!adapter) throw new Error('Database chưa được khởi tạo');
  return adapter;
}

export function isPersistent(): boolean {
  return persistent;
}

export function sqliteVersion(): string {
  return sqlite3?.version.libVersion ?? '';
}

/** Export toàn bộ database thành file .sqlite (mở được bằng DB Browser for SQLite / better-sqlite3). */
export function exportDatabase(): Uint8Array {
  return sqlite3!.capi.sqlite3_js_db_export(rawDb!);
}

/** Lưu database xuống IndexedDB. Các lần lưu được xếp hàng để không ghi đè lẫn nhau. */
export function persist(): Promise<void> {
  if (!persistent || !rawDb) return Promise.resolve();
  const bytes = exportDatabase();
  saveChain = saveChain.then(() => idbSet(STORAGE_KEY, bytes)).catch((err) => console.error('Lưu database thất bại', err));
  return saveChain;
}

/** Thay database hiện tại bằng file .sqlite người dùng chọn. */
export async function importDatabase(bytes: Uint8Array): Promise<void> {
  const db = openFromBytes(bytes);
  try {
    use(db);
  } catch (err) {
    db.close();
    throw err;
  }
  await persist();
}

/** Xoá sạch dữ liệu. */
export async function resetDatabase(): Promise<void> {
  use(openFromBytes());
  await persist();
}
