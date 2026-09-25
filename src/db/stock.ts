import type { DbAdapter } from './adapter';
import type { AdjustmentReason, StockAdjustment } from '../types';
import { toDateTimeString } from '../lib/format';
import { ADJUSTMENT_REASONS } from '../lib/adjustments';
import { AppError } from './errors';
import { getProduct } from './products';

export interface AdjustStockInput {
  productId: number;
  /** Số lượng thực tế đếm được */
  newStock: number;
  reason: AdjustmentReason;
  note?: string;
}

/**
 * Kiểm kê / điều chỉnh tồn kho: đặt tồn = số thực tế và lưu lại lịch sử
 * (tồn cũ, tồn mới, lý do, giá nhập lúc đó). Một transaction.
 */
export function adjustStock(db: DbAdapter, input: AdjustStockInput, createdAt = new Date()): StockAdjustment {
  if (!Number.isInteger(input.newStock) || input.newStock < 0) throw new AppError('Số lượng thực tế phải là số nguyên ≥ 0');
  if (!(input.reason in ADJUSTMENT_REASONS)) throw new AppError('Lý do điều chỉnh không hợp lệ');
  const note = input.note?.trim() || null;
  if (input.reason === 'other' && !note) throw new AppError('Lý do "Khác" cần ghi chú');

  const id = db.transaction(() => {
    const product = getProduct(db, input.productId);
    if (!product) throw new AppError('Không tìm thấy sản phẩm');
    const { lastInsertRowid } = db.run(
      `INSERT INTO stock_adjustments (product_id, created_at, old_stock, new_stock, reason, note, purchase_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product.id, toDateTimeString(createdAt), product.stock, input.newStock, input.reason, note, product.purchase_price],
    );
    db.run('UPDATE products SET stock = ? WHERE id = ?', [input.newStock, product.id]);
    return lastInsertRowid;
  });
  return db.get<StockAdjustment>(`${SELECT} WHERE a.id = ?`, [id])!;
}

const SELECT = `SELECT a.id, a.product_id, p.barcode, p.name, a.created_at, a.old_stock, a.new_stock,
                       a.reason, a.note, a.purchase_price
                  FROM stock_adjustments a JOIN products p ON p.id = a.product_id`;

/** Lịch sử kiểm kê trong khoảng thời gian, mới nhất trước. */
export function listAdjustments(db: DbAdapter, from: string, to: string, limit = 200): StockAdjustment[] {
  return db.all<StockAdjustment>(`${SELECT} WHERE a.created_at BETWEEN ? AND ? ORDER BY a.created_at DESC, a.id DESC LIMIT ?`, [
    from,
    to,
    limit,
  ]);
}

/** Các lần kiểm kê gần nhất của một sản phẩm. */
export function listProductAdjustments(db: DbAdapter, productId: number, limit = 5): StockAdjustment[] {
  return db.all<StockAdjustment>(`${SELECT} WHERE a.product_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT ?`, [
    productId,
    limit,
  ]);
}
