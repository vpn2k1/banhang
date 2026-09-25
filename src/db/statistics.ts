import type { DbAdapter } from './adapter';
import type { StatsSummary, TopProduct } from '../types';

// from / to: 'YYYY-MM-DD HH:mm:ss' (bao gồm hai đầu).
// Doanh thu / số hoá đơn: chỉ hoá đơn đã thanh toán. Hàng đã bán: mọi hoá đơn chưa huỷ
// (chờ chuyển khoản vẫn là hàng đã giao). Hoá đơn chờ chuyển khoản thống kê riêng.

export function getSummary(db: DbAdapter, from: string, to: string): StatsSummary {
  const sales = db.get<{ revenue: number; invoiceCount: number; cashRevenue: number; transferRevenue: number }>(
    `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS invoiceCount,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total END), 0) AS cashRevenue,
            COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total END), 0) AS transferRevenue
       FROM invoices WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
    [from, to],
  );
  const pending = db.get<{ pendingCount: number; pendingAmount: number }>(
    `SELECT COUNT(*) AS pendingCount, COALESCE(SUM(total), 0) AS pendingAmount
       FROM invoices WHERE status = 'pending' AND created_at BETWEEN ? AND ?`,
    [from, to],
  );
  const items = db.get<{ itemsSold: number }>(
    `SELECT COALESCE(SUM(ii.quantity), 0) AS itemsSold
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.status != 'cancelled' AND i.created_at BETWEEN ? AND ?`,
    [from, to],
  );
  const imports = db.get<{ importValue: number }>(
    'SELECT COALESCE(SUM(total), 0) AS importValue FROM imports WHERE created_at BETWEEN ? AND ?',
    [from, to],
  );
  const shrinkage = db.get<{ shrinkageValue: number }>(
    `SELECT COALESCE(SUM((old_stock - new_stock) * purchase_price), 0) AS shrinkageValue
       FROM stock_adjustments WHERE new_stock < old_stock AND created_at BETWEEN ? AND ?`,
    [from, to],
  );
  return {
    revenue: sales?.revenue ?? 0,
    invoiceCount: sales?.invoiceCount ?? 0,
    itemsSold: items?.itemsSold ?? 0,
    importValue: imports?.importValue ?? 0,
    shrinkageValue: shrinkage?.shrinkageValue ?? 0,
    cashRevenue: sales?.cashRevenue ?? 0,
    transferRevenue: sales?.transferRevenue ?? 0,
    pendingCount: pending?.pendingCount ?? 0,
    pendingAmount: pending?.pendingAmount ?? 0,
  };
}

/** Sản phẩm bán nhiều nhất theo số lượng. */
export function getTopProducts(db: DbAdapter, from: string, to: string, limit = 10): TopProduct[] {
  return db.all<TopProduct>(
    `SELECT ii.product_id, p.name,
            SUM(ii.quantity) AS quantity,
            SUM(ii.quantity * ii.selling_price) AS revenue
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       JOIN products p ON p.id = ii.product_id
      WHERE i.status != 'cancelled' AND i.created_at BETWEEN ? AND ?
      GROUP BY ii.product_id
      ORDER BY quantity DESC, revenue DESC
      LIMIT ?`,
    [from, to, limit],
  );
}
