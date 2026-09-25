import type { DbAdapter } from './adapter';
import type { ImportDetail, ImportItemDetail, ImportRecord, ImportSummary } from '../types';
import { toDateTimeString } from '../lib/format';
import { AppError, assertMoney, assertPositiveInt } from './errors';
import { createProduct } from './products';

function assertNotFuture(createdAt: Date): void {
  if (Number.isNaN(createdAt.getTime())) throw new AppError('Ngày nhập không hợp lệ');
  if (createdAt.getTime() > Date.now() + 60_000) throw new AppError('Ngày nhập không được ở tương lai');
}

export interface ImportItemInput {
  productId: number;
  quantity: number;
  purchasePrice: number;
}

/**
 * Lưu phiếu nhập: tạo imports + import_items, cộng tồn kho và cập nhật giá nhập mới nhất.
 * Tất cả trong một transaction.
 */
export function createImport(db: DbAdapter, items: ImportItemInput[], createdAt = new Date()): ImportRecord {
  if (items.length === 0) throw new AppError('Phiếu nhập chưa có sản phẩm');
  assertNotFuture(createdAt);
  for (const it of items) {
    assertPositiveInt(it.quantity, 'Số lượng');
    assertMoney(it.purchasePrice, 'Giá nhập');
  }
  const total = items.reduce((sum, it) => sum + it.quantity * it.purchasePrice, 0);
  const created = toDateTimeString(createdAt);

  return db.transaction(() => {
    const { lastInsertRowid: importId } = db.run('INSERT INTO imports (created_at, total) VALUES (?, ?)', [created, total]);
    for (const it of items) {
      db.run('INSERT INTO import_items (import_id, product_id, quantity, purchase_price) VALUES (?, ?, ?, ?)', [
        importId,
        it.productId,
        it.quantity,
        it.purchasePrice,
      ]);
      const { changes } = db.run('UPDATE products SET stock = stock + ?, purchase_price = ? WHERE id = ?', [
        it.quantity,
        it.purchasePrice,
        it.productId,
      ]);
      if (changes === 0) throw new AppError(`Không tìm thấy sản phẩm #${it.productId}`);
    }
    return { id: importId, created_at: created, total };
  });
}

/** Một dòng trong form nhập hàng: productId = null nghĩa là sản phẩm mới (nhập tay). */
export interface ImportDraftLine {
  productId: number | null;
  barcode: string | null;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
}

/**
 * Lưu phiếu nhập từ form: tạo sản phẩm mới cho dòng nhập tay, cập nhật tên / giá bán
 * cho sản phẩm đã có, rồi tạo phiếu nhập. Lỗi ở bất kỳ dòng nào → rollback toàn bộ.
 * Thứ tự `lines` là thứ tự hiển thị (dòng 1 = trên cùng) để báo lỗi đúng số dòng.
 */
export function createImportWithProducts(db: DbAdapter, lines: ImportDraftLine[], createdAt = new Date()): ImportRecord {
  if (lines.length === 0) throw new AppError('Phiếu nhập chưa có sản phẩm');
  assertNotFuture(createdAt);
  return db.transaction(() => {
    const items = lines.map((line, i): ImportItemInput => {
      try {
        assertPositiveInt(line.quantity, 'Số lượng');
        assertMoney(line.purchasePrice, 'Giá nhập');
        assertMoney(line.sellingPrice, 'Giá bán');
        if (line.productId === null) {
          const product = createProduct(db, {
            barcode: line.barcode,
            name: line.name,
            purchase_price: line.purchasePrice,
            selling_price: line.sellingPrice,
            stock: 0,
          });
          return { productId: product.id, quantity: line.quantity, purchasePrice: line.purchasePrice };
        }
        const name = line.name.trim();
        if (!name) throw new AppError('Vui lòng nhập tên sản phẩm');
        const { changes } = db.run('UPDATE products SET name = ?, selling_price = ? WHERE id = ?', [
          name,
          line.sellingPrice,
          line.productId,
        ]);
        if (changes === 0) throw new AppError('Không tìm thấy sản phẩm');
        return { productId: line.productId, quantity: line.quantity, purchasePrice: line.purchasePrice };
      } catch (err) {
        if (err instanceof AppError) throw new AppError(`Dòng ${i + 1}: ${err.message}`);
        throw err;
      }
    });
    return createImport(db, items, createdAt);
  });
}

/** Danh sách phiếu nhập trong khoảng thời gian, mới nhất trước. */
export function listImports(db: DbAdapter, from: string, to: string, limit = 200): ImportSummary[] {
  return db.all<ImportSummary>(
    `SELECT i.id, i.created_at, i.total,
            COUNT(ii.id) AS line_count, COALESCE(SUM(ii.quantity), 0) AS total_quantity
       FROM imports i LEFT JOIN import_items ii ON ii.import_id = i.id
      WHERE i.created_at BETWEEN ? AND ?
      GROUP BY i.id
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ?`,
    [from, to, limit],
  );
}

export function getImport(db: DbAdapter, id: number): ImportDetail | undefined {
  const rec = db.get<ImportRecord>('SELECT id, created_at, total FROM imports WHERE id = ?', [id]);
  if (!rec) return undefined;
  const items = db.all<ImportItemDetail>(
    `SELECT ii.product_id, p.barcode, p.name, ii.quantity, ii.purchase_price
       FROM import_items ii JOIN products p ON p.id = ii.product_id
      WHERE ii.import_id = ? ORDER BY ii.id`,
    [id],
  );
  return { ...rec, items };
}
