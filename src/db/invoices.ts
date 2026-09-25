import type { DbAdapter } from './adapter';
import type { Invoice, InvoiceDetail, InvoiceItemDetail, InvoiceSummary } from '../types';
import { toDateTimeString } from '../lib/format';
import { AppError, assertMoney, assertPositiveInt } from './errors';

export interface InvoiceItemInput {
  productId: number;
  quantity: number;
  sellingPrice: number;
}

/**
 * cash: tiền mặt, lưu là "đã thanh toán".
 * transfer: chuyển khoản, lưu là "chờ chuyển khoản" – hàng đã giao nên vẫn trừ kho;
 * xác nhận bằng confirmTransfer() hoặc huỷ bằng cancelPendingInvoice() (hoàn kho).
 */
export type InvoicePayment = { method: 'cash'; cashReceived: number } | { method: 'transfer' };

const COLUMNS = 'id, invoice_number, created_at, total, cash_received, payment_method, status, paid_at';

/** Số hoá đơn dạng HD260925-001, đánh số lại mỗi ngày. */
function nextInvoiceNumber(db: DbAdapter, created: string): string {
  const prefix = `HD${created.slice(2, 4)}${created.slice(5, 7)}${created.slice(8, 10)}-`;
  const row = db.get<{ last: string | null }>(
    'SELECT MAX(invoice_number) AS last FROM invoices WHERE invoice_number LIKE ?',
    [`${prefix}%`],
  );
  const seq = row?.last ? Number(row.last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Thanh toán: lưu hoá đơn + chi tiết, trừ tồn kho. Tất cả trong một transaction.
 * Cho phép tồn kho âm (thực tế cửa hàng hay bán trước khi nhập phiếu).
 */
export function createInvoice(
  db: DbAdapter,
  items: InvoiceItemInput[],
  payment: InvoicePayment,
  createdAt = new Date(),
): InvoiceDetail {
  if (items.length === 0) throw new AppError('Hoá đơn chưa có sản phẩm');
  for (const it of items) {
    assertPositiveInt(it.quantity, 'Số lượng');
    assertMoney(it.sellingPrice, 'Giá bán');
  }
  const total = items.reduce((sum, it) => sum + it.quantity * it.sellingPrice, 0);
  let cashReceived = 0;
  if (payment.method === 'cash') {
    assertMoney(payment.cashReceived, 'Tiền khách đưa');
    if (payment.cashReceived < total) throw new AppError('Khách đưa chưa đủ tiền');
    cashReceived = payment.cashReceived;
  } else if (total <= 0) {
    throw new AppError('Hoá đơn 0đ không cần chuyển khoản');
  }
  const created = toDateTimeString(createdAt);
  const paid = payment.method === 'cash';

  const invoiceId = db.transaction(() => {
    const number = nextInvoiceNumber(db, created);
    const { lastInsertRowid: id } = db.run(
      `INSERT INTO invoices (invoice_number, created_at, total, cash_received, payment_method, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [number, created, total, cashReceived, payment.method, paid ? 'paid' : 'pending', paid ? created : null],
    );
    for (const it of items) {
      db.run('INSERT INTO invoice_items (invoice_id, product_id, quantity, selling_price) VALUES (?, ?, ?, ?)', [
        id,
        it.productId,
        it.quantity,
        it.sellingPrice,
      ]);
      const { changes } = db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, it.productId]);
      if (changes === 0) throw new AppError(`Không tìm thấy sản phẩm #${it.productId}`);
    }
    return id;
  });
  return getInvoice(db, invoiceId)!;
}

export function getInvoice(db: DbAdapter, id: number): InvoiceDetail | undefined {
  const invoice = db.get<Invoice>(`SELECT ${COLUMNS} FROM invoices WHERE id = ?`, [id]);
  if (!invoice) return undefined;
  const items = db.all<InvoiceItemDetail>(
    `SELECT ii.product_id, p.barcode, p.name, ii.quantity, ii.selling_price
       FROM invoice_items ii JOIN products p ON p.id = ii.product_id
      WHERE ii.invoice_id = ? ORDER BY ii.id`,
    [id],
  );
  return { ...invoice, items };
}

/** Danh sách hoá đơn trong khoảng thời gian ('YYYY-MM-DD HH:mm:ss'), mới nhất trước. */
export function listInvoices(db: DbAdapter, from: string, to: string, limit = 200): InvoiceSummary[] {
  return db.all<InvoiceSummary>(
    `SELECT i.id, i.invoice_number, i.created_at, i.total, i.cash_received,
            i.payment_method, i.status, i.paid_at,
            COALESCE(SUM(ii.quantity), 0) AS total_quantity
       FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.created_at BETWEEN ? AND ?
      GROUP BY i.id
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ?`,
    [from, to, limit],
  );
}

/** Hoá đơn chuyển khoản đang chờ xác nhận, cũ nhất trước. */
export function listPendingInvoices(db: DbAdapter): Invoice[] {
  return db.all<Invoice>(`SELECT ${COLUMNS} FROM invoices WHERE status = 'pending' ORDER BY created_at, id`);
}

function getPending(db: DbAdapter, id: number): Invoice {
  const invoice = db.get<Invoice>(`SELECT ${COLUMNS} FROM invoices WHERE id = ?`, [id]);
  if (!invoice) throw new AppError('Không tìm thấy hoá đơn');
  if (invoice.status !== 'pending') {
    throw new AppError(`Hoá đơn ${invoice.invoice_number} ${invoice.status === 'paid' ? 'đã thanh toán' : 'đã huỷ'}`);
  }
  return invoice;
}

/** Xác nhận đã nhận tiền chuyển khoản. */
export function confirmTransfer(db: DbAdapter, id: number, paidAt = new Date()): InvoiceDetail {
  db.transaction(() => {
    getPending(db, id);
    db.run(`UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`, [toDateTimeString(paidAt), id]);
  });
  return getInvoice(db, id)!;
}

/** Khách không chuyển khoản / trả lại hàng: huỷ hoá đơn chờ và hoàn lại tồn kho. */
export function cancelPendingInvoice(db: DbAdapter, id: number): InvoiceDetail {
  db.transaction(() => {
    getPending(db, id);
    const items = db.all<{ product_id: number; quantity: number }>(
      'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ?',
      [id],
    );
    for (const it of items) db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [it.quantity, it.product_id]);
    db.run(`UPDATE invoices SET status = 'cancelled' WHERE id = ?`, [id]);
  });
  return getInvoice(db, id)!;
}
