import type { ImportDetail } from '../types';
import { Modal } from './Modal';
import { formatDateTime, formatMoney } from '../lib/format';

export function ImportViewModal({ record, onClose }: { record: ImportDetail; onClose: () => void }) {
  return (
    <Modal
      title={`Phiếu nhập #${record.id} · ${formatDateTime(record.created_at)}`}
      onClose={onClose}
      wide
      footer={
        <button type="button" className="btn" onClick={onClose} autoFocus>
          Đóng
        </button>
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-idx">#</th>
              <th>Mã vạch</th>
              <th>Sản phẩm</th>
              <th className="num">Giá nhập</th>
              <th className="num">SL</th>
              <th className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((it, i) => (
              <tr key={i}>
                <td className="col-idx muted">{i + 1}</td>
                <td className="mono">{it.barcode ?? '—'}</td>
                <td className="cell-name">{it.name}</td>
                <td className="num">{formatMoney(it.purchase_price)}</td>
                <td className="num">{it.quantity}</td>
                <td className="num strong">{formatMoney(it.quantity * it.purchase_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="num strong">
                Tổng
              </td>
              <td className="num strong">{formatMoney(record.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
