import type { InvoiceDetail, StoreSettings } from '../types';
import { formatDateTime, formatNumber } from '../lib/format';
import { invoiceQr, storeQr } from '../payments/invoiceQr';
import { QrCode } from './QrCode';

interface Props {
  invoice: Pick<
    InvoiceDetail,
    'invoice_number' | 'created_at' | 'total' | 'cash_received' | 'items' | 'payment_method' | 'status'
  >;
  settings: StoreSettings;
  /** Xem trước khi chưa có số hoá đơn: chỉ hiện khung chỗ QR */
  preview?: boolean;
}

/** Hoá đơn in nhiệt 58mm / 80mm. Dùng cho cả xem trước và in. */
export function Receipt({ invoice, settings, preview }: Props) {
  const change = invoice.cash_received - invoice.total;
  const transfer = invoice.payment_method === 'transfer';
  const qr = transfer && invoice.status === 'pending' && !preview ? invoiceQr(invoice, settings) : null;
  const qrSize = settings.paperWidth === 58 ? '36mm' : '46mm';
  // Hoá đơn không có QR chờ trả: in QR tài khoản cửa hàng (không kèm số tiền) nếu bật trong Cài đặt
  const shopQr =
    settings.qrOnEveryReceipt && invoice.status !== 'cancelled' && !(transfer && invoice.status === 'pending')
      ? storeQr(settings)
      : null;
  const shopQrSize = settings.paperWidth === 58 ? '28mm' : '34mm';

  return (
    <div className={`receipt paper-${settings.paperWidth}`}>
      <div className="r-center r-bold r-title">{settings.storeName}</div>
      {settings.address && <div className="r-center">{settings.address}</div>}
      {settings.phone && <div className="r-center">ĐT: {settings.phone}</div>}
      <div className="r-line" />
      <div className="r-row">
        <span>{invoice.invoice_number}</span>
        <span>{formatDateTime(invoice.created_at)}</span>
      </div>
      <div className="r-line" />
      {invoice.items.map((it, i) => (
        <div key={i} className="r-item">
          <div className="r-item-name">{it.name}</div>
          <div className="r-row">
            <span>
              {it.quantity} x {formatNumber(it.selling_price)}
            </span>
            <span>{formatNumber(it.quantity * it.selling_price)}</span>
          </div>
        </div>
      ))}
      <div className="r-line" />
      <div className="r-row r-bold r-total">
        <span>TỔNG</span>
        <span>{formatNumber(invoice.total)}đ</span>
      </div>

      {!transfer && (
        <>
          <div className="r-row">
            <span>Khách đưa</span>
            <span>{formatNumber(invoice.cash_received)}đ</span>
          </div>
          <div className="r-row">
            <span>Tiền thừa</span>
            <span>{formatNumber(Math.max(0, change))}đ</span>
          </div>
        </>
      )}

      {transfer && (
        <div className="r-row">
          <span>Thanh toán</span>
          <span>Chuyển khoản</span>
        </div>
      )}

      {invoice.status === 'cancelled' && <div className="r-center r-bold r-stamp">*** ĐÃ HUỶ ***</div>}
      {transfer && invoice.status === 'paid' && <div className="r-center r-bold r-stamp">ĐÃ THANH TOÁN</div>}

      {transfer && invoice.status === 'pending' && (
        <div className="r-qr">
          <div className="r-line" />
          <div className="r-center r-bold">QUÉT MÃ ĐỂ CHUYỂN KHOẢN</div>
          {preview ? (
            <div className="r-qr-placeholder" style={{ width: qrSize, height: qrSize }}>
              Mã QR
            </div>
          ) : qr ? (
            <>
              <QrCode value={qr.payload} size={qrSize} className="r-qr-img" />
              <div className="r-center">{qr.bank}</div>
              <div className="r-center r-bold">{qr.account}</div>
              {qr.accountName && <div className="r-center">{qr.accountName}</div>}
              <div className="r-center">
                Số tiền: <b>{formatNumber(qr.amount)}đ</b>
              </div>
              <div className="r-center">
                Nội dung: <b>{qr.content}</b>
              </div>
            </>
          ) : (
            <div className="r-center">(Chưa cài đặt tài khoản ngân hàng)</div>
          )}
        </div>
      )}

      {shopQr && (
        <div className="r-qr">
          <div className="r-line" />
          <div className="r-center r-bold">QUÉT MÃ ĐỂ CHUYỂN KHOẢN</div>
          <QrCode value={shopQr.payload} size={shopQrSize} className="r-qr-img" />
          <div className="r-center">{shopQr.bank}</div>
          <div className="r-center r-bold">{shopQr.account}</div>
          {shopQr.accountName && <div className="r-center">{shopQr.accountName}</div>}
        </div>
      )}

      <div className="r-line" />
      {settings.footer && <div className="r-center r-bold">{settings.footer}</div>}
    </div>
  );
}
