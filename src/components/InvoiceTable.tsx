import type { CartLine } from '../types';
import { formatMoney } from '../lib/format';
import { MoneyInput } from './MoneyInput';
import { QuantityInput } from './QuantityInput';

interface Props {
  lines: CartLine[];
  highlightId?: number;
  onChange: (productId: number, patch: Partial<Pick<CartLine, 'quantity' | 'selling_price'>>) => void;
  onRemove: (productId: number) => void;
}

export function InvoiceTable({ lines, highlightId, onChange, onRemove }: Props) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="col-idx">#</th>
            <th>Mã vạch</th>
            <th>Sản phẩm</th>
            <th className="num">Giá bán</th>
            <th className="num">SL</th>
            <th className="num">Thành tiền</th>
            <th className="col-action" />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                Quét mã vạch để bắt đầu bán hàng
              </td>
            </tr>
          )}
          {lines.map((line, i) => (
            <tr key={line.product.id} className={line.product.id === highlightId ? 'row-flash' : ''}>
              <td className="col-idx muted">{i + 1}</td>
              <td className="mono">{line.product.barcode ?? '—'}</td>
              <td className="cell-name">{line.product.name}</td>
              <td className="num">
                <MoneyInput
                  className="input-inline"
                  value={line.selling_price}
                  onValueChange={(v) => onChange(line.product.id, { selling_price: v })}
                  aria-label="Giá bán"
                />
              </td>
              <td className="num">
                <QuantityInput
                  value={line.quantity}
                  max={line.product.stock}
                  onChange={(v) => onChange(line.product.id, { quantity: v })}
                />
              </td>
              <td className="num strong">{formatMoney(line.quantity * line.selling_price)}</td>
              <td className="col-action">
                <button type="button" className="btn-icon danger" onClick={() => onRemove(line.product.id)} aria-label="Xoá dòng">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
