import type { InvoiceDetail } from '../types';
import { Modal } from './Modal';
import { Receipt } from './Receipt';
import { useApp } from '../lib/appContext';

interface Props {
  invoice: InvoiceDetail;
  onClose: () => void;
}

export function InvoiceViewModal({ invoice, onClose }: Props) {
  const { settings, printInvoice } = useApp();
  return (
    <Modal
      title={`Hoá đơn ${invoice.invoice_number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="btn btn-primary" onClick={() => printInvoice(invoice)} autoFocus>
            🖨 In hoá đơn
          </button>
        </>
      }
    >
      <div className="receipt-preview-box">
        <Receipt invoice={invoice} settings={settings} />
      </div>
    </Modal>
  );
}
