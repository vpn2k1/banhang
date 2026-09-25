import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { Product } from '../types';
import { formatMoney } from '../lib/format';
import { MoneyInput } from './MoneyInput';
import { QuantityInput } from './QuantityInput';

/** Giá trị một dòng trong form nhập hàng. productId = null: sản phẩm mới, nhập tay. */
export interface ImportRowValues {
  productId: number | null;
  barcode: string;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  /** Tồn kho lúc quét, chỉ để hiển thị */
  stock: number | null;
}

export interface ImportFormValues {
  /** Ngày nhập 'YYYY-MM-DD' */
  importDate: string;
  rows: ImportRowValues[];
}

export function rowFromProduct(p: Product, quantity = 1): ImportRowValues {
  return {
    productId: p.id,
    barcode: p.barcode ?? '',
    name: p.name,
    purchasePrice: p.purchase_price,
    sellingPrice: p.selling_price,
    quantity,
    stock: p.stock,
  };
}

export function emptyRow(barcode = '', quantity = 1): ImportRowValues {
  return { productId: null, barcode, name: '', purchasePrice: 0, sellingPrice: 0, quantity, stock: null };
}

interface Props {
  index: number;
  /** Số thứ tự dòng đầu tiên có cùng sản phẩm (nếu dòng này bị trùng) */
  duplicateOf?: number;
  onRemove: () => void;
  /** Dòng nhập tay: rời ô mã vạch → tra xem mã đã có trong kho chưa */
  onManualBarcode: (index: number) => void;
}

export function ImportRow({ index, duplicateOf, onRemove, onManualBarcode }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ImportFormValues>();
  // Có thể undefined trong khoảnh khắc dòng vừa bị xoá
  const row = useWatch({ control, name: `rows.${index}` }) ?? emptyRow();
  const locked = row.productId !== null;
  const err = errors.rows?.[index];
  const messages = [err?.barcode, err?.name, err?.purchasePrice, err?.sellingPrice, err?.quantity]
    .map((e) => e?.message)
    .filter(Boolean);

  return (
    <div className={`import-row ${messages.length ? 'import-row-error' : ''} ${locked ? '' : 'import-row-new'}`}>
      <div className="ir-grid">
        <span className="ir-idx">{index + 1}</span>

        <div className={`ir-barcode ${locked ? 'locked' : ''}`}>
          <input
            {...register(`rows.${index}.barcode`, {
              onBlur: () => {
                if (!locked) onManualBarcode(index);
              },
              validate: (value, form) => {
                if (form.rows[index]?.productId !== null) return true;
                const code = value.trim();
                if (!code) return true; // hàng không có mã vạch
                const dup = form.rows.some((r, j) => j !== index && r.productId === null && r.barcode.trim() === code);
                return dup ? 'Mã vạch bị trùng với một dòng sản phẩm mới khác' : true;
              },
            })}
            readOnly={locked}
            tabIndex={locked ? -1 : undefined}
            placeholder="Nhập tay mã vạch"
            aria-label="Mã vạch"
            className={`mono ${err?.barcode ? 'invalid' : ''}`}
            title={locked ? 'Mã vạch quét được – không sửa được' : undefined}
          />
        </div>

        <input
          {...register(`rows.${index}.name`, {
            validate: (v) => v.trim() !== '' || 'Nhập tên sản phẩm',
          })}
          placeholder="Tên sản phẩm"
          aria-label="Tên sản phẩm"
          className={err?.name ? 'invalid' : ''}
        />

        <Controller
          control={control}
          name={`rows.${index}.purchasePrice`}
          rules={{ validate: (v) => v > 0 || 'Nhập giá nhập' }}
          render={({ field, fieldState }) => (
            <MoneyInput
              ref={field.ref}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              aria-label="Giá nhập"
              className={fieldState.error ? 'invalid' : ''}
            />
          )}
        />

        <Controller
          control={control}
          name={`rows.${index}.sellingPrice`}
          rules={{ validate: (v) => v > 0 || 'Nhập giá bán' }}
          render={({ field, fieldState }) => (
            <MoneyInput
              ref={field.ref}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              aria-label="Giá bán"
              className={fieldState.error ? 'invalid' : ''}
            />
          )}
        />

        <Controller
          control={control}
          name={`rows.${index}.quantity`}
          rules={{ validate: (v) => (Number.isInteger(v) && v >= 1) || 'Số lượng phải ≥ 1' }}
          render={({ field }) => <QuantityInput value={field.value} onChange={field.onChange} />}
        />

        <span className="ir-amount">{formatMoney(row.quantity * row.purchasePrice)}</span>

        <button type="button" className="btn-icon danger" onClick={onRemove} aria-label="Xoá dòng">
          ✕
        </button>
      </div>

      <div className="ir-meta">
        {locked ? (
          <span className="muted">🔒 Có trong kho · Tồn hiện tại: {row.stock ?? 0}</span>
        ) : (
          <span className="badge badge-warn">Sản phẩm mới – nhập tay</span>
        )}
        {duplicateOf !== undefined && <span className="text-warn">Cùng sản phẩm với dòng {duplicateOf}</span>}
        {row.sellingPrice > 0 && row.purchasePrice > 0 && row.sellingPrice < row.purchasePrice && (
          <span className="text-warn">Giá bán thấp hơn giá nhập</span>
        )}
        {messages.map((m) => (
          <span key={m} className="text-danger">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
