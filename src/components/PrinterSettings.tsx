import { useCallback, useEffect, useState } from 'react';
import type { InvoiceDetail, StoreSettings } from '../types';
import { isDesktopApp, listPrinters, type PrinterInfo } from '../device/printer';
import { toDateTimeString } from '../lib/format';
import { useApp } from '../lib/appContext';
import { errorMessage } from '../lib/scan';

function sampleInvoice(): InvoiceDetail {
  const items = [
    { product_id: 0, barcode: '8931234567890', name: 'Coca Cola 330ml', quantity: 2, selling_price: 10000 },
    { product_id: 0, barcode: null, name: 'Bánh mì (in thử)', quantity: 1, selling_price: 15000 },
  ];
  return {
    id: 0,
    invoice_number: 'IN-THU',
    created_at: toDateTimeString(new Date()),
    total: 35000,
    cash_received: 50000,
    payment_method: 'cash',
    status: 'paid',
    paid_at: null,
    items,
  };
}

interface Props {
  /** Cài đặt đang sửa (chưa lưu) – dùng cho In thử */
  form: StoreSettings;
  onPrinterChange: (name: string) => void;
}

/** Chọn máy in hoá đơn (bản desktop) + In thử. Bản trình duyệt: hướng dẫn dùng hộp thoại in. */
export function PrinterSettings({ form, onPrinterChange }: Props) {
  const { printInvoice } = useApp();
  const [printers, setPrinters] = useState<PrinterInfo[]>();
  const [error, setError] = useState('');
  const desktop = isDesktopApp();

  const load = useCallback(() => {
    setError('');
    listPrinters()
      .then(setPrinters)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (desktop) load();
  }, [desktop, load]);

  if (!desktop) {
    return (
      <p className="muted small">
        🖨 Bản trình duyệt: khi in sẽ hiện hộp thoại – chọn máy in, khổ giấy và tắt “Đầu trang và chân trang”. Bản desktop
        (Electron) in thẳng ra máy in đã chọn, không cần hộp thoại.
      </p>
    );
  }

  const defaultPrinter = printers?.find((p) => p.isDefault);
  const missing = form.printerName !== '' && printers !== undefined && !printers.some((p) => p.name === form.printerName);

  return (
    <div className="field">
      <span>Máy in hoá đơn</span>
      <div className="printer-row">
        <select value={form.printerName} onChange={(e) => onPrinterChange(e.target.value)} disabled={!printers}>
          <option value="">
            Máy in mặc định của hệ thống{defaultPrinter ? ` (${defaultPrinter.displayName})` : ''}
          </option>
          {printers?.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
              {p.isDefault ? ' – mặc định' : ''}
            </option>
          ))}
          {missing && <option value={form.printerName}>{form.printerName} (không tìm thấy)</option>}
        </select>
        <button type="button" className="btn btn-small" onClick={load} title="Tải lại danh sách máy in">
          🔄
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => printInvoice(sampleInvoice(), form)}
          disabled={printers !== undefined && printers.length === 0}
        >
          🖨 In thử
        </button>
      </div>
      {printers?.length === 0 && <small className="text-danger">Máy tính chưa cài máy in nào.</small>}
      {missing && <small className="text-danger">Máy in đã chọn hiện không có – kiểm tra máy in đã bật / cắm cáp.</small>}
      {error && <small className="text-danger">{error}</small>}
      <small className="muted">In thẳng không hiện hộp thoại, khổ giấy {form.paperWidth}mm, cao theo độ dài hoá đơn.</small>
    </div>
  );
}
