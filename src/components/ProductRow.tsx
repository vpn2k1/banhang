import type { Product } from '../types';
import { formatMoney } from '../lib/format';

export const LOW_STOCK = 5;

interface Props {
  product: Product;
  onEdit: (product: Product) => void;
  onCount: (product: Product) => void;
}

export function ProductRow({ product, onEdit, onCount }: Props) {
  const stockClass = product.stock <= 0 ? 'badge badge-danger' : product.stock <= LOW_STOCK ? 'badge badge-warn' : 'badge';
  return (
    <tr className="row-click" onDoubleClick={() => onEdit(product)}>
      <td className="mono">{product.barcode ?? '—'}</td>
      <td className="cell-name">{product.name}</td>
      <td className="num">{formatMoney(product.purchase_price)}</td>
      <td className="num strong">{formatMoney(product.selling_price)}</td>
      <td className="num">
        <span className={stockClass}>{product.stock}</span>
      </td>
      <td className="col-action">
        <div className="row-actions">
          <button type="button" className="btn btn-small" onClick={() => onCount(product)}>
            Kiểm kê
          </button>
          <button type="button" className="btn btn-small" onClick={() => onEdit(product)}>
            Sửa
          </button>
        </div>
      </td>
    </tr>
  );
}
