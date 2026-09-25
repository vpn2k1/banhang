import { useCallback, useEffect, useRef, useState } from 'react';
import type { CartLine, Invoice, InvoiceDetail, Product } from '../types';
import type { InvoicePayment } from '../db/invoices';
import { api } from '../db/api';
import { BarcodeInput, type BarcodeInputHandle } from '../components/BarcodeInput';
import { InvoiceTable } from '../components/InvoiceTable';
import { PaymentModal } from '../components/PaymentModal';
import { TransferModal } from '../components/TransferModal';
import { formatDateTime, formatMoney } from '../lib/format';
import { beep, errorMessage, parseScan } from '../lib/scan';
import { isModalOpen, useApp } from '../lib/appContext';

/** 🧾 Hoá đơn: Quét mã → nhập số lượng → thanh toán → in hoá đơn. */
export function InvoicePage({ active }: { active: boolean }) {
  const { notify, printInvoice, bumpData, dataVersion } = useApp();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [highlightId, setHighlightId] = useState<number>();
  const [paying, setPaying] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<InvoiceDetail>();
  const [pending, setPending] = useState<Invoice[]>([]);
  const [transfer, setTransfer] = useState<InvoiceDetail>();
  const scanRef = useRef<BarcodeInputHandle>(null);

  // Hoá đơn chuyển khoản đang chờ xác nhận
  useEffect(() => {
    if (active) api.invoices.listPending().then(setPending);
  }, [active, dataVersion]);

  // Cập nhật tồn kho hiển thị khi dữ liệu thay đổi ở trang khác
  useEffect(() => {
    if (!active || lines.length === 0) return;
    api.products.list().then((all) => {
      const byId = new Map(all.map((p) => [p.id, p]));
      setLines((ls) => ls.map((l) => ({ ...l, product: byId.get(l.product.id) ?? l.product })));
    });
  }, [active, dataVersion]);

  const addProduct = useCallback((product: Product, quantity = 1) => {
    beep('ok');
    setLines((ls) => {
      const existing = ls.find((l) => l.product.id === product.id);
      if (existing) {
        return ls.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...ls, { product, quantity, selling_price: product.selling_price }];
    });
    setHighlightId(product.id);
    setTimeout(() => setHighlightId(undefined), 800);
  }, []);

  const onScan = async (text: string) => {
    const { quantity, code } = parseScan(text);
    const product = await api.products.findByBarcode(code);
    if (product) return addProduct(product, quantity);
    beep('error');
    notify(`Không tìm thấy sản phẩm có mã “${code}”. Thêm sản phẩm ở mục 📥 Nhập hàng hoặc 📦 Kho.`, 'error');
  };

  const total = lines.reduce((s, l) => s + l.quantity * l.selling_price, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  const startPayment = useCallback(() => {
    if (lines.length === 0) {
      notify('Hoá đơn chưa có sản phẩm', 'error');
      return;
    }
    setPaying(true);
  }, [lines.length, notify]);

  // F9 = thanh toán
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9' && !isModalOpen()) {
        e.preventDefault();
        startPayment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, startPayment]);

  const focusScanner = () => setTimeout(() => scanRef.current?.focus());

  const closePayment = () => {
    setPaying(false);
    focusScanner();
  };

  const openTransfer = async (id: number) => {
    const inv = await api.invoices.get(id);
    if (inv) setTransfer(inv);
  };

  const pay = async (payment: InvoicePayment, print: boolean) => {
    const invoice = await api.invoices.create(
      lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, sellingPrice: l.selling_price })),
      payment,
    );
    setLines([]);
    setPaying(false);
    bumpData();
    if (invoice.payment_method === 'transfer') {
      // Hiện mã QR cho khách quét; in phiếu có QR nếu chọn
      setTransfer(invoice);
      if (print) printInvoice(invoice);
      return;
    }
    setLastInvoice(invoice);
    focusScanner();
    const change = invoice.cash_received - invoice.total;
    notify(`Đã thanh toán ${invoice.invoice_number} · Tiền thừa ${formatMoney(change)}`, 'success', {
      label: 'In hoá đơn',
      onClick: () => printInvoice(invoice),
    });
    if (print) printInvoice(invoice);
  };

  const clearCart = () => {
    if (lines.length && confirm('Huỷ toàn bộ hoá đơn đang bán?')) setLines([]);
    scanRef.current?.focus();
  };

  return (
    <div className="page page-split">
      <section className="page-main">
        <header className="page-header">
          <h1>🧾 Hóa đơn</h1>
          <BarcodeInput
            ref={scanRef}
            active={active}
            onScan={(t) => onScan(t).catch((err) => notify(errorMessage(err), 'error'))}
            onPick={(p) => addProduct(p)}
            placeholder="Quét mã vạch / gõ tên sản phẩm… (VD: 3*8931234567890 = 3 cái)"
          />
        </header>
        <InvoiceTable
          lines={lines}
          highlightId={highlightId}
          onChange={(id, patch) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, ...patch } : l)))}
          onRemove={(id) => setLines((ls) => ls.filter((l) => l.product.id !== id))}
        />
      </section>

      <aside className="page-side">
        <div className="summary-card">
          <div className="summary-row">
            <span>Số mặt hàng</span>
            <strong>{lines.length}</strong>
          </div>
          <div className="summary-row">
            <span>Tổng số lượng</span>
            <strong>{itemCount}</strong>
          </div>
          <div className="summary-total">
            <span>Tổng tiền</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <button type="button" className="btn btn-primary btn-block btn-xl" onClick={startPayment} disabled={!lines.length}>
            Thanh toán <kbd>F9</kbd>
          </button>
          <button type="button" className="btn btn-block" onClick={clearCart} disabled={!lines.length}>
            Huỷ hoá đơn
          </button>
        </div>

        {lastInvoice && (
          <div className="last-invoice">
            <div className="muted small">Hoá đơn vừa bán</div>
            <div className="summary-row">
              <strong>{lastInvoice.invoice_number}</strong>
              <span>{formatMoney(lastInvoice.total)}</span>
            </div>
            <div className="summary-row muted small">
              {lastInvoice.payment_method === 'cash' ? (
                <>
                  <span>Khách đưa {formatMoney(lastInvoice.cash_received)}</span>
                  <span>Thừa {formatMoney(lastInvoice.cash_received - lastInvoice.total)}</span>
                </>
              ) : (
                <span>🏦 Chuyển khoản – đã nhận tiền</span>
              )}
            </div>
            <button type="button" className="btn btn-block btn-small" onClick={() => printInvoice(lastInvoice)}>
              🖨 In lại hoá đơn
            </button>
          </div>
        )}

        {pending.length > 0 && (
          <div className="pending-list">
            <div className="pending-title">⏳ Chờ chuyển khoản ({pending.length})</div>
            {pending.map((p) => (
              <button key={p.id} type="button" className="pending-item" onClick={() => openTransfer(p.id)}>
                <span className="mono">{p.invoice_number}</span>
                <strong>{formatMoney(p.total)}</strong>
                <span className="muted small">{formatDateTime(p.created_at).slice(-5)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="hint">
          <strong>Phím tắt</strong>
          <div>
            <kbd>F9</kbd> Thanh toán
          </div>
          <div>
            <kbd>F6</kbd> / <kbd>F7</kbd> trong màn thanh toán: tiền mặt / chuyển khoản
          </div>
          <div>
            <kbd>Enter</kbd> trong màn thanh toán: xác nhận
          </div>
          <div>
            <kbd>Esc</kbd> Đóng / xoá ô nhập
          </div>
        </div>
      </aside>

      {paying && <PaymentModal lines={lines} onClose={closePayment} onConfirm={pay} />}
      {transfer && (
        <TransferModal
          invoice={transfer}
          onClose={() => {
            setTransfer(undefined);
            focusScanner();
          }}
          onResolved={(inv) => inv.status === 'paid' && setLastInvoice(inv)}
        />
      )}
    </div>
  );
}
