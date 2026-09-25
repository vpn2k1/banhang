import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { DbAdapter } from '../src/db/adapter';
import { createWasmAdapter } from '../src/db/wasm';
import { migrate } from '../src/db/schema';
import { createProduct, findProductByBarcode, getProduct, searchProducts, updateProduct } from '../src/db/products';
import { createImport, createImportWithProducts } from '../src/db/imports';
import { cancelPendingInvoice, confirmTransfer, createInvoice, listInvoices, listPendingInvoices } from '../src/db/invoices';
import { getSummary, getTopProducts } from '../src/db/statistics';
import { seedSampleData } from '../src/db/seed';
import { adjustStock, listAdjustments, listProductAdjustments } from '../src/db/stock';
import { getImport, listImports } from '../src/db/imports';

let sqlite3: Sqlite3Static;
let db: DbAdapter;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

beforeEach(() => {
  db = createWasmAdapter(new sqlite3.oo1.DB(':memory:'));
  migrate(db);
});

const coca = () =>
  createProduct(db, { barcode: '8931234567890', name: 'Coca Cola 330ml', purchase_price: 7000, selling_price: 10000, stock: 0 });

const cash = (cashReceived: number) => ({ method: 'cash' as const, cashReceived });

const ALL_TIME: [string, string] = ['2000-01-01 00:00:00', '2999-12-31 23:59:59'];

describe('products', () => {
  it('tạo và tìm theo mã vạch', () => {
    const p = coca();
    expect(findProductByBarcode(db, '8931234567890')?.id).toBe(p.id);
    expect(findProductByBarcode(db, '000')).toBeUndefined();
  });

  it('không cho trùng mã vạch', () => {
    coca();
    expect(() => coca()).toThrow(/đã thuộc về/);
  });

  it('tìm theo tên không dấu', () => {
    createProduct(db, { barcode: null, name: 'Mì Hảo Hảo tôm chua cay', purchase_price: 3200, selling_price: 4500, stock: 0 });
    coca();
    expect(searchProducts(db, 'mi hao').map((p) => p.name)).toEqual(['Mì Hảo Hảo tôm chua cay']);
    expect(searchProducts(db, 'COCA')).toHaveLength(1);
  });

  it('sửa thông tin không đổi tồn kho', () => {
    const p = coca();
    createImport(db, [{ productId: p.id, quantity: 10, purchasePrice: 7000 }]);
    const u = updateProduct(db, p.id, { barcode: p.barcode, name: 'Coca lon', purchase_price: 7000, selling_price: 12000 });
    expect(u).toMatchObject({ name: 'Coca lon', selling_price: 12000, stock: 10 });
  });
});

describe('nhập hàng', () => {
  it('cộng tồn kho và cập nhật giá nhập', () => {
    const p = coca();
    const rec = createImport(db, [{ productId: p.id, quantity: 24, purchasePrice: 7200 }]);
    expect(rec.total).toBe(24 * 7200);
    const after = getProduct(db, p.id)!;
    expect(after.stock).toBe(24);
    expect(after.purchase_price).toBe(7200);
  });

  it('rollback nếu có dòng lỗi', () => {
    const p = coca();
    expect(() =>
      createImport(db, [
        { productId: p.id, quantity: 5, purchasePrice: 7000 },
        { productId: 9999, quantity: 1, purchasePrice: 1000 },
      ]),
    ).toThrow();
    expect(getProduct(db, p.id)!.stock).toBe(0);
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM imports')!.n).toBe(0);
  });
});

describe('lưu form nhập hàng', () => {
  it('tạo sản phẩm mới, cập nhật sản phẩm cũ, cộng tồn kho', () => {
    const p = coca();
    const rec = createImportWithProducts(db, [
      { productId: null, barcode: '8930000000017', name: 'Bánh mì', purchasePrice: 12000, sellingPrice: 15000, quantity: 12 },
      { productId: p.id, barcode: p.barcode, name: 'Coca Cola lon 330ml', purchasePrice: 7200, sellingPrice: 11000, quantity: 24 },
      { productId: p.id, barcode: p.barcode, name: 'Coca Cola lon 330ml', purchasePrice: 7200, sellingPrice: 11000, quantity: 6 },
    ]);
    expect(rec.total).toBe(12 * 12000 + 30 * 7200);
    expect(findProductByBarcode(db, '8930000000017')).toMatchObject({ name: 'Bánh mì', stock: 12, selling_price: 15000 });
    expect(getProduct(db, p.id)).toMatchObject({ name: 'Coca Cola lon 330ml', stock: 30, purchase_price: 7200, selling_price: 11000 });
  });

  it('rollback toàn bộ và báo số dòng khi có lỗi', () => {
    const p = coca();
    expect(() =>
      createImportWithProducts(db, [
        { productId: p.id, barcode: p.barcode, name: p.name, purchasePrice: 7000, sellingPrice: 10000, quantity: 5 },
        { productId: null, barcode: '8930000000017', name: 'Bánh mì', purchasePrice: 12000, sellingPrice: 15000, quantity: 1 },
        { productId: null, barcode: '8931234567890', name: 'Trùng mã', purchasePrice: 1000, sellingPrice: 2000, quantity: 1 },
      ]),
    ).toThrow(/^Dòng 3: Mã vạch 8931234567890 đã thuộc về/);
    expect(getProduct(db, p.id)!.stock).toBe(0);
    expect(findProductByBarcode(db, '8930000000017')).toBeUndefined();
  });
});

describe('ngày nhập & lịch sử phiếu nhập', () => {
  it('lưu theo ngày nhập đã chọn, không cho ngày tương lai', () => {
    const p = coca();
    const past = new Date(2026, 8, 20, 8, 30, 0);
    const rec = createImport(db, [{ productId: p.id, quantity: 5, purchasePrice: 7000 }], past);
    expect(rec.created_at).toBe('2026-09-20 08:30:00');
    const future = new Date(Date.now() + 2 * 86400_000);
    expect(() => createImport(db, [{ productId: p.id, quantity: 1, purchasePrice: 7000 }], future)).toThrow(/tương lai/);
    expect(listImports(db, '2026-09-20 00:00:00', '2026-09-20 23:59:59')).toMatchObject([
      { id: rec.id, line_count: 1, total_quantity: 5, total: 35000 },
    ]);
    expect(getImport(db, rec.id)!.items).toMatchObject([{ name: 'Coca Cola 330ml', quantity: 5, purchase_price: 7000 }]);
  });
});

describe('kiểm kê', () => {
  it('đặt tồn = số thực tế và lưu lịch sử', () => {
    const p = coca();
    createImport(db, [{ productId: p.id, quantity: 25, purchasePrice: 7000 }]);
    const adj = adjustStock(db, { productId: p.id, newStock: 22, reason: 'damaged', note: 'móp' }, new Date(2026, 8, 25, 18));
    expect(adj).toMatchObject({ old_stock: 25, new_stock: 22, reason: 'damaged', note: 'móp', purchase_price: 7000 });
    expect(getProduct(db, p.id)!.stock).toBe(22);
    expect(listProductAdjustments(db, p.id)).toHaveLength(1);
    expect(listAdjustments(db, '2026-09-25 00:00:00', '2026-09-25 23:59:59')).toHaveLength(1);
    expect(getSummary(db, '2026-09-25 00:00:00', '2026-09-25 23:59:59').shrinkageValue).toBe(3 * 7000);
  });

  it('từ chối số âm và lý do "Khác" không ghi chú', () => {
    const p = coca();
    expect(() => adjustStock(db, { productId: p.id, newStock: -1, reason: 'count' })).toThrow();
    expect(() => adjustStock(db, { productId: p.id, newStock: 3, reason: 'other' })).toThrow(/ghi chú/);
    expect(listProductAdjustments(db, p.id)).toHaveLength(0);
  });
});

describe('hoá đơn', () => {
  it('lưu hoá đơn, trừ tồn kho, đánh số theo ngày', () => {
    const p = coca();
    createImport(db, [{ productId: p.id, quantity: 25, purchasePrice: 7000 }]);
    const at = new Date(2026, 8, 25, 10, 0, 0);
    const inv1 = createInvoice(db, [{ productId: p.id, quantity: 2, sellingPrice: 10000 }], cash(50000), at);
    const inv2 = createInvoice(db, [{ productId: p.id, quantity: 1, sellingPrice: 10000 }], cash(10000), at);
    expect(inv1.invoice_number).toBe('HD260925-001');
    expect(inv2.invoice_number).toBe('HD260925-002');
    expect(inv1.total).toBe(20000);
    expect(inv1.cash_received).toBe(50000);
    expect(inv1.items[0]).toMatchObject({ name: 'Coca Cola 330ml', quantity: 2, selling_price: 10000 });
    expect(getProduct(db, p.id)!.stock).toBe(22);
    expect(listInvoices(db, ...ALL_TIME)).toHaveLength(2);
  });

  it('từ chối khi khách đưa thiếu tiền', () => {
    const p = coca();
    expect(() => createInvoice(db, [{ productId: p.id, quantity: 2, sellingPrice: 10000 }], cash(15000))).toThrow(/chưa đủ/);
    expect(getProduct(db, p.id)!.stock).toBe(0);
  });
});

describe('chuyển khoản', () => {
  it('lưu chờ chuyển khoản, trừ kho; xác nhận → đã thanh toán, tính vào doanh thu', () => {
    const p = coca();
    createImport(db, [{ productId: p.id, quantity: 10, purchasePrice: 7000 }]);
    const at = new Date(2026, 8, 25, 10);
    const inv = createInvoice(db, [{ productId: p.id, quantity: 3, sellingPrice: 10000 }], { method: 'transfer' }, at);
    expect(inv).toMatchObject({ payment_method: 'transfer', status: 'pending', paid_at: null, cash_received: 0, total: 30000 });
    expect(getProduct(db, p.id)!.stock).toBe(7);
    const day: [string, string] = ['2026-09-25 00:00:00', '2026-09-25 23:59:59'];
    expect(getSummary(db, ...day)).toMatchObject({ revenue: 0, invoiceCount: 0, itemsSold: 3, pendingCount: 1, pendingAmount: 30000 });
    expect(listPendingInvoices(db)).toHaveLength(1);

    const paid = confirmTransfer(db, inv.id, new Date(2026, 8, 25, 10, 5));
    expect(paid).toMatchObject({ status: 'paid', paid_at: '2026-09-25 10:05:00' });
    expect(getSummary(db, ...day)).toMatchObject({ revenue: 30000, transferRevenue: 30000, cashRevenue: 0, invoiceCount: 1, pendingCount: 0 });
    expect(() => confirmTransfer(db, inv.id)).toThrow(/đã thanh toán/);
    expect(() => cancelPendingInvoice(db, inv.id)).toThrow(/đã thanh toán/);
  });

  it('huỷ hoá đơn chờ → hoàn tồn kho, không tính thống kê', () => {
    const p = coca();
    createImport(db, [{ productId: p.id, quantity: 10, purchasePrice: 7000 }]);
    const inv = createInvoice(db, [{ productId: p.id, quantity: 4, sellingPrice: 10000 }], { method: 'transfer' });
    const cancelled = cancelPendingInvoice(db, inv.id);
    expect(cancelled.status).toBe('cancelled');
    expect(getProduct(db, p.id)!.stock).toBe(10);
    expect(getSummary(db, ...ALL_TIME)).toMatchObject({ revenue: 0, itemsSold: 0, pendingCount: 0 });
    expect(getTopProducts(db, ...ALL_TIME)).toHaveLength(0);
  });
});

describe('thống kê', () => {
  it('tổng hợp doanh thu, số hoá đơn, SL bán, giá trị nhập', () => {
    seedSampleData(db);
    const s = getSummary(db, ...ALL_TIME);
    expect(s.invoiceCount).toBe(8); // 9 hoá đơn mẫu, 1 hoá đơn chờ chuyển khoản
    expect(s.pendingCount).toBe(1);
    expect(s.cashRevenue + s.transferRevenue).toBe(s.revenue);
    expect(s.transferRevenue).toBeGreaterThan(0);
    expect(s.importValue).toBeGreaterThan(0);
    expect(s.itemsSold).toBeGreaterThan(0);
    const top = getTopProducts(db, ...ALL_TIME, 3);
    expect(top[0].name).toBe('Mì Hảo Hảo tôm chua cay');
    expect(top.reduce((sum, t) => sum + t.revenue, 0)).toBeLessThanOrEqual(s.revenue);
  });

  it('lọc theo khoảng thời gian', () => {
    const p = coca();
    createInvoice(db, [{ productId: p.id, quantity: 1, sellingPrice: 10000 }], cash(10000), new Date(2026, 0, 1, 9));
    createInvoice(db, [{ productId: p.id, quantity: 3, sellingPrice: 10000 }], cash(30000), new Date(2026, 0, 2, 9));
    const s = getSummary(db, '2026-01-02 00:00:00', '2026-01-02 23:59:59');
    expect(s).toMatchObject({ revenue: 30000, invoiceCount: 1, itemsSold: 3 });
  });
});
