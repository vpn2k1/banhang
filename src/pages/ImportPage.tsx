import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import type { Product } from '../types';
import { api } from '../db/api';
import { BarcodeInput, type BarcodeInputHandle } from '../components/BarcodeInput';
import { ImportRow, emptyRow, rowFromProduct, type ImportFormValues } from '../components/ImportRow';
import { formatMoney, today } from '../lib/format';
import { beep, errorMessage, parseScan } from '../lib/scan';
import { useApp } from '../lib/appContext';

/** Yêu cầu từ trang khác (📦 Kho → + Thêm sản phẩm): thêm dòng nhập tay. */
export interface ImportRequest {
  id: number;
  barcode?: string;
}

interface Props {
  active: boolean;
  request?: ImportRequest;
  onRequestHandled: () => void;
}

/**
 * 📥 Nhập hàng: phiếu nhập là một danh sách form (react-hook-form).
 * - Mỗi lần quét thêm một dòng lên đầu danh sách.
 * - Quét được → điền sẵn thông tin, mã vạch khoá không sửa.
 * - Không tìm thấy mã → dòng nhập tay (mã vạch sửa được) để tạo sản phẩm mới.
 * - Chỉnh sửa thoải mái trước khi Lưu phiếu nhập.
 */
export function ImportPage({ active, request, onRequestHandled }: Props) {
  const { notify, bumpData } = useApp();
  const scanRef = useRef<BarcodeInputHandle>(null);
  const [saving, setSaving] = useState(false);

  const methods = useForm<ImportFormValues>({ defaultValues: { importDate: today(), rows: [] } });
  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    register,
    formState: { errors },
  } = methods;
  const { fields, prepend, remove } = useFieldArray({ control, name: 'rows' });
  const rows = useWatch({ control, name: 'rows' });

  const total = rows.reduce((s, r) => s + r.quantity * r.purchasePrice, 0);
  const qty = rows.reduce((s, r) => s + r.quantity, 0);

  // Dòng nào trùng sản phẩm với dòng phía trên → hiện ghi chú
  const duplicates = useMemo(() => {
    const first = new Map<number, number>();
    return rows.map((r, i) => {
      if (r.productId === null) return undefined;
      const seen = first.get(r.productId);
      if (seen === undefined) first.set(r.productId, i + 1);
      return seen;
    });
  }, [rows]);

  const focusScanner = () => setTimeout(() => scanRef.current?.focus());

  useEffect(() => {
    if (!request) return;
    prepend(emptyRow(request.barcode ?? ''), { focusName: request.barcode ? 'rows.0.name' : 'rows.0.barcode' });
    onRequestHandled();
  }, [request, prepend, onRequestHandled]);

  const addProduct = (product: Product, quantity = 1) => {
    beep('ok');
    prepend(rowFromProduct(product, quantity), { shouldFocus: false });
  };

  const onScan = async (text: string) => {
    const { quantity, code } = parseScan(text);
    const product = await api.products.findByBarcode(code);
    if (product) return addProduct(product, quantity);
    beep('error');
    prepend(emptyRow(code, quantity), { focusName: 'rows.0.name' });
    notify(`Không tìm thấy mã “${code}” – nhập thông tin sản phẩm mới ở dòng 1`, 'info');
  };

  // Dòng nhập tay: nếu mã gõ vào đã có trong kho → chuyển thành dòng sản phẩm có sẵn (khoá mã)
  const onManualBarcode = async (index: number) => {
    const code = getValues(`rows.${index}.barcode`).trim();
    if (!code) return;
    const product = await api.products.findByBarcode(code);
    const row = getValues(`rows.${index}`);
    if (!product || !row || row.productId !== null || row.barcode.trim() !== code) return;
    const filled = rowFromProduct(product, row.quantity);
    setValue(`rows.${index}`, {
      ...filled,
      purchasePrice: row.purchasePrice || filled.purchasePrice,
      sellingPrice: row.sellingPrice || filled.sellingPrice,
    });
    beep('ok');
    notify(`Mã ${code} đã có trong kho: “${product.name}” – đã điền sẵn thông tin`, 'info');
  };

  const save = handleSubmit(
    async (values) => {
      setSaving(true);
      try {
        const rec = await api.imports.createWithProducts(
          values.rows.map((r) => ({
            productId: r.productId,
            barcode: r.barcode.trim() || null,
            name: r.name,
            purchasePrice: r.purchasePrice,
            sellingPrice: r.sellingPrice,
            quantity: r.quantity,
          })),
          values.importDate,
        );
        notify(`Đã lưu phiếu nhập #${rec.id} · ${formatMoney(rec.total)} · đã cộng tồn kho`, 'success');
        reset({ importDate: today(), rows: [] });
        bumpData();
        focusScanner();
      } catch (err) {
        notify(errorMessage(err), 'error');
      } finally {
        setSaving(false);
      }
    },
    (errors: FieldErrors<ImportFormValues>) => {
      const count = Array.isArray(errors.rows) ? errors.rows.filter(Boolean).length : 0;
      beep('error');
      notify(
        errors.importDate?.message ?? `Có ${count} dòng chưa hợp lệ – kiểm tra các ô báo đỏ`,
        'error',
      );
    },
  );

  const cancel = () => {
    if (fields.length && confirm('Huỷ phiếu nhập đang soạn?')) reset({ importDate: today(), rows: [] });
    focusScanner();
  };

  return (
    <div className="page page-split">
      <section className="page-main">
        <header className="page-header">
          <h1>📥 Nhập hàng</h1>
          <div className="toolbar">
            <BarcodeInput
              ref={scanRef}
              active={active}
              onScan={(t) => onScan(t).catch((err) => notify(errorMessage(err), 'error'))}
              onPick={(p) => addProduct(p)}
              placeholder="Quét mã vạch / gõ tên sản phẩm… (VD: 24*8931234567890)"
            />
            <button type="button" className="btn" onClick={() => prepend(emptyRow(), { focusName: 'rows.0.barcode' })}>
              + Nhập tay
            </button>
          </div>
        </header>

        <FormProvider {...methods}>
          <form
            id="import-form"
            className="import-list"
            onSubmit={save}
            noValidate
            onKeyDown={(e) => {
              // Enter trong ô của dòng: không submit, quay về ô quét để quét tiếp
              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                e.preventDefault();
                focusScanner();
              }
            }}
          >
            <div className="ir-grid ir-header">
              <span>#</span>
              <span>Mã vạch</span>
              <span>Tên sản phẩm</span>
              <span className="num">Giá nhập</span>
              <span className="num">Giá bán</span>
              <span className="num">Số lượng</span>
              <span className="num">Thành tiền</span>
              <span />
            </div>
            {fields.length === 0 && (
              <div className="empty">
                Quét mã vạch để thêm sản phẩm vào phiếu nhập.
                <br />
                Mã không quét được → bấm <strong>+ Nhập tay</strong>.
              </div>
            )}
            {fields.map((field, index) => (
              <ImportRow
                key={field.id}
                index={index}
                duplicateOf={duplicates[index]}
                onRemove={() => remove(index)}
                onManualBarcode={onManualBarcode}
              />
            ))}
          </form>
        </FormProvider>
      </section>

      <aside className="page-side">
        <div className="summary-card">
          <label className="field">
            <span>Ngày nhập</span>
            <input
              type="date"
              form="import-form"
              max={today()}
              className={errors.importDate ? 'invalid' : ''}
              {...register('importDate', {
                validate: (v) => {
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Chọn ngày nhập';
                  return v <= today() || 'Ngày nhập không được ở tương lai';
                },
              })}
            />
            {errors.importDate && <small className="text-danger">{errors.importDate.message}</small>}
          </label>
          <div className="summary-row">
            <span>Số dòng</span>
            <strong>{fields.length}</strong>
          </div>
          <div className="summary-row">
            <span>Tổng số lượng</span>
            <strong>{qty}</strong>
          </div>
          <div className="summary-total">
            <span>Tổng tiền nhập</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <button type="submit" form="import-form" className="btn btn-primary btn-block btn-xl" disabled={!fields.length || saving}>
            Lưu phiếu nhập
          </button>
          <button type="button" className="btn btn-block" disabled={!fields.length} onClick={cancel}>
            Huỷ phiếu
          </button>
        </div>
        <div className="hint">
          <strong>Cách dùng</strong>
          <div>1. Quét mã vạch – mỗi lần quét thêm 1 dòng lên đầu</div>
          <div>2. Quét được: mã vạch bị khoá 🔒, chỉnh giá / số lượng nếu cần</div>
          <div>3. Không tìm thấy / không quét được: nhập tay thông tin sản phẩm mới</div>
          <div>
            4. <kbd>Enter</kbd> trong một ô → quay lại ô quét
          </div>
          <div>5. Chọn ngày nhập (mặc định hôm nay) → Lưu phiếu nhập: tạo sản phẩm mới, cập nhật giá, cộng tồn kho</div>
        </div>
      </aside>
    </div>
  );
}
