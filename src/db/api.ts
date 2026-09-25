import type { DbAdapter } from './adapter';
import type {
  DateRange,
  ImportDetail,
  ImportRecord,
  ImportSummary,
  Invoice,
  InvoiceDetail,
  InvoiceSummary,
  Product,
  ProductInfoInput,
  StatsSummary,
  StockAdjustment,
  TopProduct,
} from '../types';
import * as products from './products';
import * as imports from './imports';
import * as invoices from './invoices';
import * as statistics from './statistics';
import * as stock from './stock';
import * as backup from './backup';
import * as productImport from './productImport';
import { seedSampleData } from './seed';
import { exportDatabase, getDb, importDatabase, persist, resetDatabase } from './database';
import { dateAtCurrentTime, toDateTimeString } from '../lib/format';

/**
 * API mà UI sử dụng. UI KHÔNG gọi SQLite trực tiếp.
 *
 *   Page → api → repository (products/imports/invoices/statistics) → DbAdapter → SQLite
 *
 * Tất cả hàm đều async để khi chạy Electron có thể thay bằng bản gọi IPC
 * (repository chạy trong main process với better-sqlite3) mà không phải sửa UI.
 */
export interface PosApi {
  products: {
    list(): Promise<Product[]>;
    search(query: string, limit?: number): Promise<Product[]>;
    findByBarcode(barcode: string): Promise<Product | undefined>;
    /** Sửa thông tin (không sửa tồn kho). Sản phẩm mới được tạo qua phiếu nhập. */
    update(id: number, input: ProductInfoInput): Promise<Product>;
    /** Nhập danh mục từ Excel: xem trước / áp dụng */
    previewImport(rows: productImport.ProductSheetRow[]): Promise<productImport.ProductImportPlan>;
    applyImport(rows: productImport.ProductSheetRow[]): Promise<productImport.ProductImportResult>;
  };
  backup: {
    /** range: chỉ giao dịch trong khoảng (lưu trữ theo kỳ); bỏ trống: toàn bộ (khôi phục được) */
    exportData(range?: DateRange): Promise<{ data: backup.BackupData; meta: backup.BackupMeta }>;
    /** Thay TOÀN BỘ dữ liệu */
    restore(data: backup.BackupData): Promise<void>;
  };
  imports: {
    /** Lưu form nhập hàng: tạo SP mới + cập nhật SP cũ + phiếu nhập trong một transaction. importDate: 'YYYY-MM-DD' */
    createWithProducts(lines: imports.ImportDraftLine[], importDate: string): Promise<ImportRecord>;
    get(id: number): Promise<ImportDetail | undefined>;
    list(range: DateRange, limit?: number): Promise<ImportSummary[]>;
  };
  invoices: {
    create(items: invoices.InvoiceItemInput[], payment: invoices.InvoicePayment): Promise<InvoiceDetail>;
    get(id: number): Promise<InvoiceDetail | undefined>;
    list(range: DateRange, limit?: number): Promise<InvoiceSummary[]>;
    /** Hoá đơn chuyển khoản chờ xác nhận */
    listPending(): Promise<Invoice[]>;
    confirmTransfer(id: number): Promise<InvoiceDetail>;
    cancelPending(id: number): Promise<InvoiceDetail>;
  };
  stock: {
    adjust(input: stock.AdjustStockInput): Promise<StockAdjustment>;
    list(range: DateRange, limit?: number): Promise<StockAdjustment[]>;
    listForProduct(productId: number, limit?: number): Promise<StockAdjustment[]>;
  };
  statistics: {
    summary(range: DateRange): Promise<StatsSummary>;
    topProducts(range: DateRange, limit?: number): Promise<TopProduct[]>;
  };
  dev: {
    query(sql: string): Promise<Record<string, unknown>[]>;
    seed(): Promise<void>;
    exportFile(): Promise<Uint8Array>;
    importFile(bytes: Uint8Array): Promise<void>;
    reset(): Promise<void>;
  };
}

const bounds = (r: DateRange): [string, string] => [`${r.from} 00:00:00`, `${r.to} 23:59:59`];

async function read<T>(fn: (db: DbAdapter) => T): Promise<T> {
  return fn(getDb());
}

async function write<T>(fn: (db: DbAdapter) => T): Promise<T> {
  const result = fn(getDb());
  await persist();
  return result;
}

export const browserApi: PosApi = {
  products: {
    list: () => read((db) => products.listProducts(db)),
    search: (q, limit) => read((db) => products.searchProducts(db, q, limit)),
    findByBarcode: (code) => read((db) => products.findProductByBarcode(db, code)),
    update: (id, input) => write((db) => products.updateProduct(db, id, input)),
    previewImport: (rows) => read((db) => productImport.planProductImport(db, rows)),
    applyImport: (rows) => write((db) => productImport.applyProductImport(db, rows)),
  },
  backup: {
    exportData: (range) =>
      read((db) => ({
        data: backup.getBackupData(db, range ? bounds(range) : undefined),
        meta: {
          kind: range ? 'range' : 'full',
          from: range?.from,
          to: range?.to,
          exportedAt: toDateTimeString(new Date()),
          schemaVersion: backup.schemaVersion(db),
        },
      })),
    restore: (data) => write((db) => backup.restoreBackup(db, data)),
  },
  imports: {
    createWithProducts: (lines, importDate) =>
      write((db) => imports.createImportWithProducts(db, lines, dateAtCurrentTime(importDate))),
    get: (id) => read((db) => imports.getImport(db, id)),
    list: (range, limit) => read((db) => imports.listImports(db, ...bounds(range), limit)),
  },
  invoices: {
    create: (items, payment) => write((db) => invoices.createInvoice(db, items, payment)),
    listPending: () => read((db) => invoices.listPendingInvoices(db)),
    confirmTransfer: (id) => write((db) => invoices.confirmTransfer(db, id)),
    cancelPending: (id) => write((db) => invoices.cancelPendingInvoice(db, id)),
    get: (id) => read((db) => invoices.getInvoice(db, id)),
    list: (range, limit) => read((db) => invoices.listInvoices(db, ...bounds(range), limit)),
  },
  stock: {
    adjust: (input) => write((db) => stock.adjustStock(db, input)),
    list: (range, limit) => read((db) => stock.listAdjustments(db, ...bounds(range), limit)),
    listForProduct: (id, limit) => read((db) => stock.listProductAdjustments(db, id, limit)),
  },
  statistics: {
    summary: (range) => read((db) => statistics.getSummary(db, ...bounds(range))),
    topProducts: (range, limit) => read((db) => statistics.getTopProducts(db, ...bounds(range), limit)),
  },
  dev: {
    query: (sql) => write((db) => db.all<Record<string, unknown>>(sql)),
    seed: () => write((db) => seedSampleData(db)),
    exportFile: async () => exportDatabase(),
    importFile: (bytes) => importDatabase(bytes),
    reset: () => resetDatabase(),
  },
};

// Phase 2 (Electron): preload expose window.posApi (ipcRenderer.invoke) với cùng interface.
declare global {
  interface Window {
    posApi?: PosApi;
  }
}

export const api: PosApi = (typeof window !== 'undefined' && window.posApi) || browserApi;
