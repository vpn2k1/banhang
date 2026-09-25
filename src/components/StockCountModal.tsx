import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { AdjustmentReason, Product, StockAdjustment } from '../types';
import { api } from '../db/api';
import { ADJUSTMENT_REASONS, formatDiff } from '../lib/adjustments';
import { Modal } from './Modal';
import { formatDateTime, formatMoney } from '../lib/format';
import { errorMessage } from '../lib/scan';

interface FormValues {
  newStock: string;
  reason: AdjustmentReason;
  note: string;
}

interface Props {
  product: Product;
  onClose: () => void;
  onSaved: (adjustment: StockAdjustment) => void;
}

/** Kiểm kê: nhập số lượng thực tế + lý do → điều chỉnh tồn kho và lưu lịch sử. */
export function StockCountModal({ product, onClose, onSaved }: Props) {
  const [history, setHistory] = useState<StockAdjustment[]>([]);
  const [error, setError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { newStock: '', reason: 'count', note: '' } });
  const [newStockText, reason] = useWatch({ control, name: ['newStock', 'reason'] });

  useEffect(() => {
    api.stock.listForProduct(product.id, 5).then(setHistory);
  }, [product.id]);

  const counted = newStockText === '' ? null : Number(newStockText);
  const diff = counted === null ? 0 : counted - product.stock;

  const submit = handleSubmit(async (v) => {
    setError('');
    try {
      const adj = await api.stock.adjust({ productId: product.id, newStock: Number(v.newStock), reason: v.reason, note: v.note });
      onSaved(adj);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <Modal
      title="Kiểm kê / điều chỉnh tồn kho"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ (Esc)
          </button>
          <button type="submit" form="stock-count-form" className="btn btn-primary" disabled={isSubmitting}>
            Lưu kiểm kê
          </button>
        </>
      }
    >
      <form id="stock-count-form" className="form-grid" onSubmit={submit} noValidate>
        <div>
          <div className="cell-name">{product.name}</div>
          <div className="muted small mono">{product.barcode ?? 'không mã vạch'}</div>
        </div>

        <div className="form-row">
          <div className="field">
            <span>Tồn trên máy</span>
            <div className="readonly-value">{product.stock}</div>
          </div>
          <label>
            Số lượng thực tế
            <Controller
              control={control}
              name="newStock"
              rules={{
                validate: (v) => (v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0) || 'Nhập số lượng đếm được (≥ 0)',
              }}
              render={({ field }) => (
                <input
                  ref={field.ref}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                  onBlur={field.onBlur}
                  inputMode="numeric"
                  autoFocus
                  className={`input-number ${errors.newStock ? 'invalid' : ''}`}
                  placeholder="Đếm thực tế"
                />
              )}
            />
          </label>
        </div>
        {errors.newStock && <small className="text-danger">{errors.newStock.message}</small>}

        {counted !== null && (
          <p className={diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : 'muted'}>
            Chênh lệch: <strong>{formatDiff(diff)}</strong>
            {diff !== 0 && <> · {formatMoney(Math.abs(diff) * product.purchase_price)} (theo giá nhập)</>}
            {diff === 0 && ' – khớp với máy'}
          </p>
        )}

        <label>
          Lý do
          <select {...register('reason')}>
            {Object.entries(ADJUSTMENT_REASONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ghi chú {reason === 'other' ? '(bắt buộc)' : '(không bắt buộc)'}
          <input
            {...register('note', {
              validate: (v, all) => all.reason !== 'other' || v.trim() !== '' || 'Lý do "Khác" cần ghi chú',
            })}
            className={errors.note ? 'invalid' : ''}
            placeholder="VD: vỡ khi xếp hàng"
          />
        </label>
        {errors.note && <small className="text-danger">{errors.note.message}</small>}
        {error && <p className="form-error">{error}</p>}

        {history.length > 0 && (
          <div className="mini-history">
            <div className="muted small">Lần kiểm kê gần đây</div>
            {history.map((h) => (
              <div key={h.id} className="summary-row small">
                <span>{formatDateTime(h.created_at)}</span>
                <span>
                  {h.old_stock} → {h.new_stock} ({formatDiff(h.new_stock - h.old_stock)})
                </span>
                <span className="muted">{ADJUSTMENT_REASONS[h.reason]}</span>
              </div>
            ))}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
