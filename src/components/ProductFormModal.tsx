import { useState, type FormEvent } from 'react';
import type { Product, ProductInfoInput } from '../types';
import { Modal } from './Modal';
import { MoneyInput } from './MoneyInput';
import { errorMessage } from '../lib/scan';
import { formatMoney } from '../lib/format';

interface Props {
  product: Product;
  onClose: () => void;
  onSave: (input: ProductInfoInput) => Promise<void>;
}

/** Sửa thông tin sản phẩm. Tồn kho không sửa ở đây – dùng Nhập hàng hoặc Kiểm kê. */
export function ProductFormModal({ product, onClose, onSave }: Props) {
  const [barcode, setBarcode] = useState(product.barcode ?? '');
  const [name, setName] = useState(product.name);
  const [purchase, setPurchase] = useState(product.purchase_price);
  const [selling, setSelling] = useState(product.selling_price);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ barcode: barcode.trim() || null, name, purchase_price: purchase, selling_price: selling });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const margin = selling - purchase;

  return (
    <Modal
      title="Sửa sản phẩm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ (Esc)
          </button>
          <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
            Lưu
          </button>
        </>
      }
    >
      <form id="product-form" className="form-grid" onSubmit={submit}>
        <label>
          Mã vạch
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Để trống nếu hàng không có mã" />
        </label>
        <label>
          Tên sản phẩm
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="form-row">
          <label>
            Giá nhập
            <MoneyInput value={purchase} onValueChange={setPurchase} />
          </label>
          <label>
            Giá bán
            <MoneyInput value={selling} onValueChange={setSelling} />
          </label>
        </div>
        {purchase > 0 && selling > 0 && (
          <p className={margin < 0 ? 'text-danger' : 'muted'}>
            Lãi mỗi sản phẩm: {formatMoney(margin)} {margin < 0 && '(giá bán thấp hơn giá nhập!)'}
          </p>
        )}
        <p className="muted">
          Tồn kho hiện tại: <strong>{product.stock}</strong> — thay đổi qua 📥 Nhập hàng, 🧾 Hóa đơn hoặc nút Kiểm kê.
        </p>
        {error && <p className="form-error">{error}</p>}
        {/* Enter trong bất kỳ ô nào sẽ submit */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
