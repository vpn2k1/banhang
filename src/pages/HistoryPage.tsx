import { useEffect, useState } from 'react';
import type { ImportDetail, ImportSummary, InvoiceDetail, InvoiceSummary, StockAdjustment } from '../types';
import { api } from '../db/api';
import { DateRangeFilter, useDateRange } from '../components/DateRangeFilter';
import { ImportViewModal } from '../components/ImportViewModal';
import { InvoiceViewModal } from '../components/InvoiceViewModal';
import { TransferModal } from '../components/TransferModal';
import { PAYMENT_LABELS, STATUS_LABELS } from '../payments/invoiceQr';
import { formatDateTime, formatMoney } from '../lib/format';
import { ADJUSTMENT_REASONS, formatDiff } from '../lib/adjustments';
import { errorMessage } from '../lib/scan';
import { useApp } from '../lib/appContext';

type Tab = 'imports' | 'invoices' | 'adjustments';

/** 🕘 Lịch sử: phiếu nhập, hoá đơn, kiểm kê – lọc theo thời gian, bấm để xem chi tiết. */
export function HistoryPage({ active }: { active: boolean }) {
  const { dataVersion, notify } = useApp();
  const filter = useDateRange('7d');
  const { range } = filter;
  const [tab, setTab] = useState<Tab>('imports');
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [viewImport, setViewImport] = useState<ImportDetail>();
  const [viewInvoice, setViewInvoice] = useState<InvoiceDetail>();
  const [transfer, setTransfer] = useState<InvoiceDetail>();

  useEffect(() => {
    if (!active || range.from > range.to) return;
    Promise.all([api.imports.list(range), api.invoices.list(range), api.stock.list(range)])
      .then(([im, inv, adj]) => {
        setImports(im);
        setInvoices(inv);
        setAdjustments(adj);
      })
      .catch((err) => notify(errorMessage(err), 'error'));
    // range là object mới mỗi lần render → so sánh theo giá trị
  }, [active, dataVersion, range.from, range.to]);

  const openImport = async (id: number) => {
    const rec = await api.imports.get(id);
    if (rec) setViewImport(rec);
  };
  const openInvoice = async (id: number) => {
    const inv = await api.invoices.get(id);
    if (!inv) return;
    // Hoá đơn chờ chuyển khoản → mở màn QR để xác nhận
    if (inv.status === 'pending') setTransfer(inv);
    else setViewInvoice(inv);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'imports', label: '📥 Phiếu nhập', count: imports.length },
    { key: 'invoices', label: '🧾 Hóa đơn', count: invoices.length },
    { key: 'adjustments', label: '📋 Kiểm kê', count: adjustments.length },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <h1>🕘 Lịch sử</h1>
        <div className="toolbar">
          <DateRangeFilter {...filter} />
        </div>
      </header>

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {tab === 'imports' && (
          <table className="table">
            <thead>
              <tr>
                <th>Số phiếu</th>
                <th>Ngày nhập</th>
                <th className="num">Số mặt hàng</th>
                <th className="num">Tổng SL</th>
                <th className="num">Tổng tiền</th>
                <th className="col-action" />
              </tr>
            </thead>
            <tbody>
              {imports.length === 0 && <EmptyRow cols={6} text="Không có phiếu nhập trong khoảng thời gian này" />}
              {imports.map((r) => (
                <tr key={r.id} className="row-click" onClick={() => openImport(r.id)}>
                  <td className="mono">#{r.id}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td className="num">{r.line_count}</td>
                  <td className="num">{r.total_quantity}</td>
                  <td className="num strong">{formatMoney(r.total)}</td>
                  <td className="col-action">
                    <button type="button" className="btn btn-small">
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'invoices' && (
          <table className="table">
            <thead>
              <tr>
                <th>Số HĐ</th>
                <th>Thời gian</th>
                <th className="num">Tổng SL</th>
                <th className="num">Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th className="col-action" />
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && <EmptyRow cols={7} text="Không có hoá đơn trong khoảng thời gian này" />}
              {invoices.map((inv) => (
                <tr key={inv.id} className="row-click" onClick={() => openInvoice(inv.id)}>
                  <td className="mono">{inv.invoice_number}</td>
                  <td>{formatDateTime(inv.created_at)}</td>
                  <td className="num">{inv.total_quantity}</td>
                  <td className={`num strong ${inv.status === 'cancelled' ? 'strike' : ''}`}>{formatMoney(inv.total)}</td>
                  <td>{PAYMENT_LABELS[inv.payment_method]}</td>
                  <td>
                    <span className={`badge badge-status-${inv.status}`}>{STATUS_LABELS[inv.status]}</span>
                  </td>
                  <td className="col-action">
                    <button type="button" className="btn btn-small">
                      {inv.status === 'pending' ? 'Mở QR' : 'Xem / In'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'adjustments' && (
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Sản phẩm</th>
                <th className="num">Tồn máy → thực tế</th>
                <th className="num">Chênh lệch</th>
                <th className="num">Giá trị</th>
                <th>Lý do</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 && <EmptyRow cols={7} text="Không có lần kiểm kê nào trong khoảng thời gian này" />}
              {adjustments.map((a) => {
                const diff = a.new_stock - a.old_stock;
                return (
                  <tr key={a.id}>
                    <td>{formatDateTime(a.created_at)}</td>
                    <td>
                      <div className="cell-name">{a.name}</div>
                      <div className="muted small mono">{a.barcode ?? '—'}</div>
                    </td>
                    <td className="num">
                      {a.old_stock} → {a.new_stock}
                    </td>
                    <td className={`num strong ${diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : 'muted'}`}>
                      {formatDiff(diff)}
                    </td>
                    <td className="num">{diff === 0 ? '—' : formatMoney(diff * a.purchase_price)}</td>
                    <td>{ADJUSTMENT_REASONS[a.reason]}</td>
                    <td className="muted">{a.note ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {viewImport && <ImportViewModal record={viewImport} onClose={() => setViewImport(undefined)} />}
      {viewInvoice && <InvoiceViewModal invoice={viewInvoice} onClose={() => setViewInvoice(undefined)} />}
      {transfer && <TransferModal invoice={transfer} onClose={() => setTransfer(undefined)} />}
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="empty">
        {text}
      </td>
    </tr>
  );
}
