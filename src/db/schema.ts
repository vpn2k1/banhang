import type { DbAdapter } from './adapter';

/**
 * Cấu trúc database. Giữ nguyên khi chuyển sang better-sqlite3.
 * Mỗi phần tử là một migration; PRAGMA user_version lưu số migration đã chạy.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode        TEXT UNIQUE,
    name           TEXT    NOT NULL,
    purchase_price INTEGER NOT NULL DEFAULT 0,
    selling_price  INTEGER NOT NULL DEFAULT 0,
    stock          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE imports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT    NOT NULL,
    total      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE import_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id      INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL REFERENCES products(id),
    quantity       INTEGER NOT NULL,
    purchase_price INTEGER NOT NULL
  );

  CREATE TABLE invoices (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT    NOT NULL UNIQUE,
    created_at     TEXT    NOT NULL,
    total          INTEGER NOT NULL DEFAULT 0,
    cash_received  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE invoice_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id    INTEGER NOT NULL REFERENCES products(id),
    quantity      INTEGER NOT NULL,
    selling_price INTEGER NOT NULL
  );

  CREATE INDEX idx_imports_created_at       ON imports(created_at);
  CREATE INDEX idx_import_items_import_id   ON import_items(import_id);
  CREATE INDEX idx_invoices_created_at      ON invoices(created_at);
  CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
  CREATE INDEX idx_invoice_items_product_id ON invoice_items(product_id);
  `,
  // 2: Kiểm kê / điều chỉnh tồn kho có lưu lịch sử
  `
  CREATE TABLE stock_adjustments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id     INTEGER NOT NULL REFERENCES products(id),
    created_at     TEXT    NOT NULL,
    old_stock      INTEGER NOT NULL,
    new_stock      INTEGER NOT NULL,
    reason         TEXT    NOT NULL,
    note           TEXT,
    purchase_price INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_stock_adjustments_created_at ON stock_adjustments(created_at);
  CREATE INDEX idx_stock_adjustments_product_id ON stock_adjustments(product_id);
  `,
  // 3: Thanh toán chuyển khoản (VietQR) – hình thức + trạng thái hoá đơn
  `
  ALTER TABLE invoices ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';
  ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'paid';
  ALTER TABLE invoices ADD COLUMN paid_at TEXT;
  UPDATE invoices SET paid_at = created_at;
  CREATE INDEX idx_invoices_status ON invoices(status);
  `,
];

export function migrate(db: DbAdapter): void {
  db.exec('PRAGMA foreign_keys = ON');
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
