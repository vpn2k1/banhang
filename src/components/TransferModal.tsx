import { useEffect, useState } from 'react';
import type { InvoiceDetail } from '../types';
import { api } from '../db/api';
import { Modal } from './Modal';
import { QrCode } from './QrCode';
import { formatDateTime, formatMoney } from '../lib/format';
import { errorMessage } from '../lib/scan';
import { useApp } from '../lib/appContext';
import { invoiceQr } from '../payments/invoiceQr';
import { getTransferWatcher } from '../payments/transferWatcher';

interface Props {
  invoice: InvoiceDetail;
  onClose: () => void;
  /** Gọi sau khi xác nhận đã nhận tiền hoặc huỷ hoá đơn */
  onResolved?: (invoice: InvoiceDetail) => void;
}

const WATCH_INTERVAL_MS = 5000;

/**
 * Màn QR chuyển khoản cho hoá đơn đang chờ: khách quét mã trên màn hình (hoặc phiếu in),
 * người bán kiểm tra app ngân hàng rồi bấm "Đã nhận tiền".
 * Nếu có TransferWatcher (SePay/Casso/PayOS – Phase 2) thì tự kiểm tra định kỳ.
 */
export function TransferModal({ invoice, onClose, onResolved }: Props) {
  const { settings, notify, printInvoice, bumpData, openSettings } = useApp();
  const [busy, setBusy] = useState(false);
  const qr = invoiceQr(invoice, settings);
  const watcher = getTransferWatcher();

  const confirmPaid = async (auto = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const paid = await api.invoices.confirmTransfer(invoice.id);
      bumpData();
      notify(`${auto ? 'Đã tự xác nhận' : 'Đã nhận tiền'} ${paid.invoice_number} · ${formatMoney(paid.total)}`, 'success', {
        label: 'In hoá đơn',
        onClick: () => printInvoice(paid),
      });
      onResolved?.(paid);
      onClose();
    } catch (err) {
      notify(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  const cancelInvoice = async () => {
    if (!confirm(`Huỷ hoá đơn ${invoice.invoice_number}? Hàng sẽ được cộng lại vào kho.`)) return;
    setBusy(true);
    try {
      const cancelled = await api.invoices.cancelPending(invoice.id);
      bumpData();
      notify(`Đã huỷ ${cancelled.invoice_number} và hoàn tồn kho`, 'info');
      onResolved?.(cancelled);
      onClose();
    } catch (err) {
      notify(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  // Chỗ cắm kiểm tra tự động (hiện chưa cấu hình → không chạy)
  useEffect(() => {
    if (!watcher) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        if (!stopped && (await watcher.check(invoice)) === 'paid') {
          stopped = true;
          clearInterval(timer);
          confirmPaid(true);
        }
      } catch {
        // mất mạng / lỗi dịch vụ → vẫn xác nhận thủ công được
      }
    }, WATCH_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [watcher, invoice.id]);

  return (
    <Modal
      title={`Chuyển khoản · ${invoice.invoice_number}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-danger" onClick={cancelInvoice} disabled={busy}>
            Huỷ hoá đơn
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => printInvoice(invoice)} disabled={!qr}>
            🖨 In phiếu có QR
          </button>
          <button type="button" className="btn" onClick={onClose} autoFocus>
            Để sau (Esc)
          </button>
          <button type="button" className="btn btn-success btn-lg" onClick={() => confirmPaid()} disabled={busy}>
            ✅ Đã nhận tiền
          </button>
        </>
      }
    >
      <div className="transfer">
        <div className="transfer-qr">
          {qr ? (
            <QrCode value={qr.payload} size="260px" />
          ) : (
            <div className="form-error">
              Chưa cài đặt tài khoản ngân hàng.{' '}
              <button type="button" className="btn btn-small" onClick={openSettings}>
                ⚙️ Mở Cài đặt
              </button>
            </div>
          )}
        </div>
        <div className="transfer-detail">
          <div className="muted">Số tiền</div>
          <div className="transfer-amount">{formatMoney(invoice.total)}</div>
          {qr && (
            <dl className="transfer-dl">
              <dt>Ngân hàng</dt>
              <dd>{qr.bank}</dd>
              <dt>Số tài khoản</dt>
              <dd className="mono strong">{qr.account}</dd>
              {qr.accountName && (
                <>
                  <dt>Chủ tài khoản</dt>
                  <dd>{qr.accountName}</dd>
                </>
              )}
              <dt>Nội dung</dt>
              <dd className="mono strong">{qr.content}</dd>
            </dl>
          )}
          <div className="muted small">
            {invoice.items.length} mặt hàng · tạo lúc {formatDateTime(invoice.created_at)}
          </div>
          <div className={`transfer-status ${watcher ? 'auto' : ''}`}>
            {watcher ? (
              <>⏳ Đang tự kiểm tra qua {watcher.name}…</>
            ) : (
              <>
                ⏳ <strong>Chờ chuyển khoản.</strong> Kiểm tra thông báo trên app ngân hàng (đúng số tiền và nội dung) rồi
                bấm <strong>Đã nhận tiền</strong>.
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
