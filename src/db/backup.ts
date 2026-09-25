import type { DbAdapter } from './adapter';
import type { AdjustmentReason, InvoiceStatus, PaymentMethod, Product } from '../types';
import { AppError } from './errors';

/**
 * Sao lưu / khôi phục toàn bộ dữ liệu dưới dạng các bảng (dùng cho file Excel).
 * Không phụ thuộc định dạng file – lớp src/excel lo phần đọc / ghi .xlsx.
 */

export interface ImportRow {
  id: number;
  created_at: string;
  total: number;
}
export interface ImportItemRow {
  id: number;
  import_id: number;
  product_id: number;
  quantity: number;
  purchase_price: number;
  /** Chỉ để đọc cho dễ khi xuất; bỏ qua khi khôi phục */
  barcode?: string | null;
  name?: string;
}
export interface InvoiceRow {
  id: number;
  invoice_number: string;
  created_at: string;
  total: number;
  cash_received: number;
  payment_method: PaymentMethod;
  status: InvoiceStatus;
  paid_at: string | null;
}
export interface InvoiceItemRow {
  id: number;
  invoice_id: number;
  product_id: number;
  quantity: number;
  selling_price: number;
  barcode?: string | null;
  name?: string;
}
export interface AdjustmentRow {
  id: number;
  product_id: number;
  created_at: string;
  old_stock: number;
  new_stock: number;
  reason: AdjustmentReason;
  note: string | null;
  purchase_price: number;
  barcode?: string | null;
  name?: string;
}

export interface BackupData {
  products: Product[];
  imports: ImportRow[];
  importItems: ImportItemRow[];
  invoices: InvoiceRow[];
  invoiceItems: InvoiceItemRow[];
  adjustments: AdjustmentRow[];
}

export interface BackupMeta {
  /** full: toàn bộ dữ liệu (khôi phục được) · range: theo khoảng thời gian (lưu trữ) */
  kind: 'full' | 'range';
  from?: string;
  to?: string;
  exportedAt: string;
  schemaVersion: number;
}

/**
 * Lấy dữ liệu để xuất. range = [from, to] ('YYYY-MM-DD HH:mm:ss') → chỉ giao dịch trong khoảng đó;
 * danh mục sản phẩm luôn đầy đủ.
 */
export function getBackupData(db: DbAdapter, range?: [string, string]): BackupData {
  const where = (col: string) => (range ? `WHERE ${col} BETWEEN ? AND ?` : '');
  const params = range ? [...range] : [];
  return {
    products: db.all<Product>('SELECT id, barcode, name, purchase_price, selling_price, stock FROM products ORDER BY id'),
    imports: db.all<ImportRow>(`SELECT id, created_at, total FROM imports ${where('created_at')} ORDER BY id`, params),
    importItems: db.all<ImportItemRow>(
      `SELECT ii.id, ii.import_id, ii.product_id, ii.quantity, ii.purchase_price, p.barcode, p.name
         FROM import_items ii JOIN imports i ON i.id = ii.import_id JOIN products p ON p.id = ii.product_id
         ${where('i.created_at')} ORDER BY ii.id`,
      params,
    ),
    invoices: db.all<InvoiceRow>(
      `SELECT id, invoice_number, created_at, total, cash_received, payment_method, status, paid_at
         FROM invoices ${where('created_at')} ORDER BY id`,
      params,
    ),
    invoiceItems: db.all<InvoiceItemRow>(
      `SELECT ii.id, ii.invoice_id, ii.product_id, ii.quantity, ii.selling_price, p.barcode, p.name
         FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN products p ON p.id = ii.product_id
         ${where('i.created_at')} ORDER BY ii.id`,
      params,
    ),
    adjustments: db.all<AdjustmentRow>(
      `SELECT a.id, a.product_id, a.created_at, a.old_stock, a.new_stock, a.reason, a.note, a.purchase_price, p.barcode, p.name
         FROM stock_adjustments a JOIN products p ON p.id = a.product_id
         ${where('a.created_at')} ORDER BY a.id`,
      params,
    ),
  };
}

export function schemaVersion(db: DbAdapter): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/** Kiểm tra liên kết giữa các bảng trước khi ghi, báo lỗi dễ hiểu. */
function validateReferences(data: BackupData): string[] {
  const errors: string[] = [];
  const ids = (rows: { id: number }[], label: string) => {
    const set = new Set<number>();
    for (const r of rows) {
      if (set.has(r.id)) errors.push(`${label}: trùng ID ${r.id}`);
      set.add(r.id);
    }
    return set;
  };
  const products = ids(data.products, 'Sản phẩm');
  const imports = ids(data.imports, 'Phiếu nhập');
  const invoices = ids(data.invoices, 'Hóa đơn');
  ids(data.importItems, 'Chi tiết nhập');
  ids(data.invoiceItems, 'Chi tiết hóa đơn');
  ids(data.adjustments, 'Kiểm kê');

  const barcodes = new Map<string, number>();
  for (const p of data.products) {
    if (!p.barcode) continue;
    if (barcodes.has(p.barcode)) errors.push(`Sản phẩm: mã vạch ${p.barcode} bị trùng (ID ${barcodes.get(p.barcode)} và ${p.id})`);
    barcodes.set(p.barcode, p.id);
  }
  const numbers = new Set<string>();
  for (const i of data.invoices) {
    if (numbers.has(i.invoice_number)) errors.push(`Hóa đơn: trùng số hoá đơn ${i.invoice_number}`);
    numbers.add(i.invoice_number);
  }
  for (const it of data.importItems) {
    if (!imports.has(it.import_id)) errors.push(`Chi tiết nhập ID ${it.id}: không có phiếu nhập ID ${it.import_id}`);
    if (!products.has(it.product_id)) errors.push(`Chi tiết nhập ID ${it.id}: không có sản phẩm ID ${it.product_id}`);
  }
  for (const it of data.invoiceItems) {
    if (!invoices.has(it.invoice_id)) errors.push(`Chi tiết hóa đơn ID ${it.id}: không có hoá đơn ID ${it.invoice_id}`);
    if (!products.has(it.product_id)) errors.push(`Chi tiết hóa đơn ID ${it.id}: không có sản phẩm ID ${it.product_id}`);
  }
  for (const a of data.adjustments) {
    if (!products.has(a.product_id)) errors.push(`Kiểm kê ID ${a.id}: không có sản phẩm ID ${a.product_id}`);
  }
  return errors;
}

/** Thay TOÀN BỘ dữ liệu bằng dữ liệu sao lưu. Một transaction: lỗi → giữ nguyên dữ liệu cũ. */
export function restoreBackup(db: DbAdapter, data: BackupData): void {
  const errors = validateReferences(data);
  if (errors.length) {
    const more = errors.length > 10 ? `\n… và ${errors.length - 10} lỗi khác` : '';
    throw new AppError(`Dữ liệu không hợp lệ:\n${errors.slice(0, 10).join('\n')}${more}`);
  }
  db.transaction(() => {
    for (const table of ['invoice_items', 'import_items', 'stock_adjustments', 'invoices', 'imports', 'products']) {
      db.run(`DELETE FROM ${table}`);
    }
    db.run('DELETE FROM sqlite_sequence');
    for (const p of data.products) {
      db.run('INSERT INTO products (id, barcode, name, purchase_price, selling_price, stock) VALUES (?, ?, ?, ?, ?, ?)', [
        p.id,
        p.barcode,
        p.name,
        p.purchase_price,
        p.selling_price,
        p.stock,
      ]);
    }
    for (const i of data.imports) {
      db.run('INSERT INTO imports (id, created_at, total) VALUES (?, ?, ?)', [i.id, i.created_at, i.total]);
    }
    for (const it of data.importItems) {
      db.run('INSERT INTO import_items (id, import_id, product_id, quantity, purchase_price) VALUES (?, ?, ?, ?, ?)', [
        it.id,
        it.import_id,
        it.product_id,
        it.quantity,
        it.purchase_price,
      ]);
    }
    for (const i of data.invoices) {
      db.run(
        `INSERT INTO invoices (id, invoice_number, created_at, total, cash_received, payment_method, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [i.id, i.invoice_number, i.created_at, i.total, i.cash_received, i.payment_method, i.status, i.paid_at],
      );
    }
    for (const it of data.invoiceItems) {
      db.run('INSERT INTO invoice_items (id, invoice_id, product_id, quantity, selling_price) VALUES (?, ?, ?, ?, ?)', [
        it.id,
        it.invoice_id,
        it.product_id,
        it.quantity,
        it.selling_price,
      ]);
    }
    for (const a of data.adjustments) {
      db.run(
        `INSERT INTO stock_adjustments (id, product_id, created_at, old_stock, new_stock, reason, note, purchase_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.product_id, a.created_at, a.old_stock, a.new_stock, a.reason, a.note, a.purchase_price],
      );
    }
  });
}
