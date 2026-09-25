import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { DbAdapter } from '../src/db/adapter';
import { createWasmAdapter } from '../src/db/wasm';
import { migrate } from '../src/db/schema';
import { seedSampleData } from '../src/db/seed';
import { getBackupData, restoreBackup, schemaVersion, type BackupMeta } from '../src/db/backup';
import { applyProductImport, planProductImport } from '../src/db/productImport';
import { createProduct, findProductByBarcode, getProduct } from '../src/db/products';
import { getSummary } from '../src/db/statistics';
import { listProductAdjustments } from '../src/db/stock';
import {
  ExcelFormatError,
  SHEETS,
  buildBackupSheets,
  buildProductTemplate,
  parseBackupSheets,
  parseProductSheet,
  type SheetIn,
} from '../src/excel/workbook';
import { readXlsx, writeXlsx } from '../src/excel/io';

let sqlite3: Sqlite3Static;
const newDb = (): DbAdapter => {
  const db = createWasmAdapter(new sqlite3.oo1.DB(':memory:'));
  migrate(db);
  return db;
};
let db: DbAdapter;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});
beforeEach(() => {
  db = newDb();
});

const ALL: [string, string] = ['2000-01-01 00:00:00', '2999-12-31 23:59:59'];
const meta = (kind: BackupMeta['kind'] = 'full'): BackupMeta => ({
  kind,
  exportedAt: '2026-09-25 10:00:00',
  schemaVersion: schemaVersion(db),
});

/** Ghi ra .xlsx thật rồi đọc lại (đúng như người dùng tải về / mở lại). */
async function roundTrip(sheets: ReturnType<typeof buildBackupSheets>): Promise<SheetIn[]> {
  const blob = await writeXlsx(sheets);
  return readXlsx(await blob.arrayBuffer());
}

describe('xuất / khôi phục Excel', () => {
  it('xuất toàn bộ → đọc lại → khôi phục vào DB trống: dữ liệu giống hệt', async () => {
    seedSampleData(db);
    const original = getBackupData(db);
    const sheets = await roundTrip(buildBackupSheets(original, meta()));
    expect(sheets.map((s) => s.sheet)).toEqual(Object.values(SHEETS));

    const { data, meta: m } = parseBackupSheets(sheets);
    expect(m.kind).toBe('full');

    const target = newDb();
    restoreBackup(target, data);
    const strip = <T extends object>(rows: T[]) => rows.map(({ barcode: _b, name: _n, ...rest }: any) => rest);
    const restored = getBackupData(target);
    expect(restored.products).toEqual(original.products);
    expect(restored.imports).toEqual(original.imports);
    expect(restored.invoices).toEqual(original.invoices);
    expect(strip(restored.importItems)).toEqual(strip(original.importItems));
    expect(strip(restored.invoiceItems)).toEqual(strip(original.invoiceItems));
    expect(strip(restored.adjustments)).toEqual(strip(original.adjustments));
    expect(getSummary(target, ...ALL)).toEqual(getSummary(db, ...ALL));
  });

  it('mã vạch giữ nguyên dạng chữ (không bị Excel đổi thành số)', async () => {
    createProduct(db, { barcode: '0012345678905', name: 'Mã bắt đầu bằng 0', purchase_price: 1000, selling_price: 2000, stock: 0 });
    const sheets = await roundTrip(buildBackupSheets(getBackupData(db), meta()));
    expect(parseBackupSheets(sheets).data.products[0].barcode).toBe('0012345678905');
  });

  it('file theo khoảng thời gian không dùng để khôi phục', async () => {
    seedSampleData(db);
    const sheets = await roundTrip(buildBackupSheets(getBackupData(db, ALL), meta('range')));
    expect(() => parseBackupSheets(sheets)).toThrow(/khoảng thời gian/);
  });

  it('báo lỗi rõ ràng theo sheet + dòng, không ghi gì khi file sai', async () => {
    seedSampleData(db);
    const sheets = await roundTrip(buildBackupSheets(getBackupData(db), meta()));
    const invoices = sheets.find((s) => s.sheet === SHEETS.invoices)!;
    invoices.data[1][3] = 'abc'; // Tổng tiền
    invoices.data[2][6] = 'Không biết'; // Trạng thái
    try {
      parseBackupSheets(sheets);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ExcelFormatError);
      const msgs = (err as ExcelFormatError).errors.join('\n');
      expect(msgs).toMatch(/Sheet "Hóa đơn" dòng 2, cột "Tổng tiền"/);
      expect(msgs).toMatch(/Sheet "Hóa đơn" dòng 3, cột "Trạng thái"/);
    }
  });

  it('khôi phục kiểm tra liên kết: chi tiết trỏ tới sản phẩm không tồn tại → giữ nguyên dữ liệu cũ', () => {
    seedSampleData(db);
    const before = getBackupData(db);
    const broken = getBackupData(db);
    broken.products = broken.products.slice(1); // xoá sản phẩm 1 nhưng vẫn còn chi tiết trỏ tới
    expect(() => restoreBackup(db, broken)).toThrow(/không có sản phẩm ID 1/);
    expect(getBackupData(db)).toEqual(before);
  });
});

describe('nhập danh mục sản phẩm từ Excel', () => {
  it('file mẫu đọc được, xem trước đúng, áp dụng tạo SP + phiếu nhập đầu kỳ', async () => {
    const rows = parseProductSheet(await roundTrip(buildProductTemplate()));
    expect(rows).toMatchObject([
      { row: 2, barcode: '8931234567890', name: 'Coca Cola 330ml', purchasePrice: 7000, sellingPrice: 10000, stock: 24 },
      { row: 3, barcode: null, name: 'Rau muống (bó)', stock: 10 },
    ]);
    expect(planProductImport(db, rows).counts).toEqual({ create: 2, update: 0, unchanged: 0, error: 0 });
    const res = applyProductImport(db, rows);
    expect(res).toMatchObject({ created: 2, updated: 0, skipped: 0, adjustments: 0 });
    expect(res.importId).not.toBeNull();
    expect(findProductByBarcode(db, '8931234567890')!.stock).toBe(24);
    expect(getSummary(db, ...ALL).importValue).toBe(24 * 7000 + 10 * 5000);
  });

  it('SP đã có: cập nhật giá, tồn kho khác → kiểm kê; dòng lỗi bị bỏ qua', () => {
    const p = createProduct(db, { barcode: '893', name: 'Coca', purchase_price: 7000, selling_price: 10000, stock: 0 });
    const sheets: SheetIn[] = [
      {
        sheet: 'Sản phẩm',
        data: [
          ['Mã vạch', 'Tên sản phẩm', 'Giá nhập', 'Giá bán', 'Tồn kho'],
          ['893', 'Coca', 7000, '11.000đ', 5],
          [null, 'Không giá', 'abc', 1000, null],
          ['893', 'Trùng', 1, 1, null],
          [null, null, null, null, null],
        ],
      },
    ];
    const rows = parseProductSheet(sheets);
    const plan = planProductImport(db, rows);
    expect(plan.counts).toEqual({ create: 0, update: 1, unchanged: 0, error: 2 });
    expect(plan.items[0].changes).toEqual(['Giá bán 10.000 → 11.000', 'Tồn kho 0 → 5 (kiểm kê)']);
    expect(plan.items[1].error).toMatch(/Giá nhập/);
    expect(plan.items[2].error).toMatch(/Trùng với dòng 2/);

    const res = applyProductImport(db, rows);
    expect(res).toMatchObject({ created: 0, updated: 1, skipped: 2, adjustments: 1, importId: null });
    expect(getProduct(db, p.id)).toMatchObject({ selling_price: 11000, stock: 5 });
    expect(listProductAdjustments(db, p.id)[0]).toMatchObject({ reason: 'count', note: 'Nhập từ Excel' });
  });

  it('thiếu cột bắt buộc → báo lỗi cấu trúc', () => {
    expect(() => parseProductSheet([{ sheet: 'Sheet1', data: [['Tên', 'Giá']] }])).toThrow(/thiếu cột "Tên sản phẩm"/);
  });
});
