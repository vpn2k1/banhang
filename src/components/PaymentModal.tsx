import { useEffect, useMemo, useRef, useState } from 'react';
import type { CartLine, PaymentMethod } from '../types';
import type { InvoicePayment } from '../db/invoices';
import { Modal } from './Modal';
import { MoneyInput } from './MoneyInput';
import { Receipt } from './Receipt';
import { formatMoney, toDateTimeString } from '../lib/format';
import { useApp } from '../lib/appContext';
import { isTransferEnabled } from '../payments/invoiceQr';
import { bankName } from '../payments/vietqr';

interface Props {
  lines: CartLine[];
  onClose: () => void;
  /** print = true: lưu xong in luôn (tiền mặt: hoá đơn; chuyển khoản: phiếu có QR) */
  onConfirm: (payment: InvoicePayment, print: boolean) => Promise<void>;
}

/** Các mệnh giá gợi ý ≥ tổng tiền. */
function quickAmounts(total: number): number[] {
  const set = new Set<number>([total]);
  for (const step of [10000, 50000, 100000]) set.add(Math.ceil(total / step) * step);
  for (const note of [100000, 200000, 500000]) if (note > total) set.add(note);
  return [...set].filter((v) => v >= total).sort((a, b) => a - b).slice(0, 5);
}

export function PaymentModal({ lines, onClose, onConfirm }: Props) {
  const { settings, openSettings } = useApp();
  const total = lines.reduce((s, l) => s + l.quantity * l.selling_price, 0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cash, setCash] = useState(total);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cashRef = useRef<HTMLInputElement>(null);
  const transferRef = useRef<HTMLButtonElement>(null);
  const change = cash - total;
  const amounts = useMemo(() => quickAmounts(total), [total]);
  const transferReady = isTransferEnabled(settings);

  const choose = (m: PaymentMethod) => {
    setMethod(m);
    setError('');
    setTimeout(() => (m === 'cash' ? cashRef.current?.focus() : transferRef.current?.focus()));
  };

  // F6 = tiền mặt, F7 = chuyển khoản
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F6' || e.key === 'F7') {
        e.preventDefault();
        choose(e.key === 'F6' ? 'cash' : 'transfer');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const confirm = async (print: boolean) => {
    if (busy) return;
    let payment: InvoicePayment;
    if (method === 'cash') {
      if (cash < total) {
        setError('Khách đưa chưa đủ tiền');
        cashRef.current?.focus();
        return;
      }
      payment = { method: 'cash', cashReceived: cash };
    } else {
      if (!transferReady) {
        setError('Chưa cài đặt tài khoản ngân hàng nhận chuyển khoản');
        return;
      }
      payment = { method: 'transfer' };
    }
    setBusy(true);
    try {
      await onConfirm(payment, print);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const ctrl = e.ctrlKey || e.metaKey;
    confirm(settings.printOnEnter ? !ctrl : ctrl);
  };

  const preview = {
    invoice_number: 'HD…',
    created_at: toDateTimeString(new Date()),
    total,
    cash_received: method === 'cash' ? cash : 0,
    payment_method: method,
    status: method === 'cash' ? ('paid' as const) : ('pending' as const),
    items: lines.map((l) => ({
      product_id: l.product.id,
      barcode: l.product.barcode,
      name: l.product.name,
      quantity: l.quantity,
      selling_price: l.selling_price,
    })),
  };

  const enterKey = <kbd>Enter</kbd>;
  const ctrlEnterKey = <kbd>Ctrl+Enter</kbd>;

  return (
    <Modal
      title="Thanh toán"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Quay lại (Esc)
          </button>
          {method === 'cash' ? (
            <>
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => confirm(false)}>
                💾 Thanh toán {settings.printOnEnter ? ctrlEnterKey : enterKey}
              </button>
              <button type="button" className="btn btn-success btn-lg" disabled={busy} onClick={() => confirm(true)}>
                🖨 Thanh toán & In hóa đơn {settings.printOnEnter ? enterKey : ctrlEnterKey}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-lg" disabled={busy || !transferReady} onClick={() => confirm(false)}>
                🏦 Tạo mã QR {settings.printOnEnter ? ctrlEnterKey : enterKey}
              </button>
              <button type="button" className="btn btn-success btn-lg" disabled={busy || !transferReady} onClick={() => confirm(true)}>
                🖨 Tạo QR & In phiếu {settings.printOnEnter ? enterKey : ctrlEnterKey}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="payment">
        <div className="payment-main">
          <div className="segmented segmented-lg" role="tablist" aria-label="Hình thức thanh toán">
            <button type="button" className={method === 'cash' ? 'active' : ''} onClick={() => choose('cash')}>
              💵 Tiền mặt <kbd>F6</kbd>
            </button>
            <button type="button" className={method === 'transfer' ? 'active' : ''} onClick={() => choose('transfer')}>
              🏦 Chuyển khoản <kbd>F7</kbd>
            </button>
          </div>

          <div className="pay-row">
            <span>Tổng tiền</span>
            <strong className="pay-total">{formatMoney(total)}</strong>
          </div>

          {method === 'cash' ? (
            <>
              <label className="pay-row">
                <span>Khách đưa</span>
                <MoneyInput
                  ref={cashRef}
                  className="pay-input"
                  value={cash}
                  autoFocus
                  onValueChange={(v) => {
                    setCash(v);
                    setError('');
                  }}
                  onKeyDown={onEnter}
                />
              </label>
              <div className="quick-amounts">
                {amounts.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`btn btn-small ${a === cash ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setCash(a);
                      setError('');
                      cashRef.current?.focus();
                    }}
                  >
                    {a === total ? 'Đủ tiền' : formatMoney(a)}
                  </button>
                ))}
              </div>
              <div className="pay-row">
                <span>{change >= 0 ? 'Tiền thừa' : 'Còn thiếu'}</span>
                <strong className={`pay-change ${change < 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(Math.abs(change))}</strong>
              </div>
              <p className="muted small">Mẹo: gõ “200k” = 200.000đ</p>
            </>
          ) : transferReady ? (
            <div className="transfer-info">
              <div>
                Nhận tiền vào: <strong>{bankName(settings.bankBin)}</strong> · <strong>{settings.bankAccount}</strong>
                {settings.bankAccountName && <> · {settings.bankAccountName.toUpperCase()}</>}
              </div>
              <p className="muted small">
                Hoá đơn được lưu ở trạng thái <strong>Chờ chuyển khoản</strong> (hàng đã trừ kho). Bước tiếp theo hiện mã QR
                để khách quét; kiểm tra app ngân hàng rồi bấm <strong>Đã nhận tiền</strong>.
              </p>
              {/* Nút ẩn nhận Enter khi đang ở chế độ chuyển khoản */}
              <button ref={transferRef} type="button" className="sr-only" onKeyDown={onEnter} autoFocus>
                Tạo mã QR
              </button>
            </div>
          ) : (
            <div className="form-error">
              Chưa cài đặt tài khoản ngân hàng nhận chuyển khoản.{' '}
              <button type="button" className="btn btn-small" onClick={openSettings}>
                ⚙️ Mở Cài đặt
              </button>
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="payment-preview">
          <div className="muted small">Xem trước hoá đơn ({settings.paperWidth}mm)</div>
          <Receipt invoice={preview} settings={settings} preview />
        </div>
      </div>
    </Modal>
  );
}
