import { useRef, useState } from 'react';
import type { BackupData, BackupMeta } from '../db/backup';
import type { ProductImportPlan, ProductSheetRow } from '../db/productImport';
import { api } from '../db/api';
import { Modal } from './Modal';
import { DateRangeFilter, useDateRange } from './DateRangeFilter';
import { buildBackupSheets, buildProductTemplate, parseBackupSheets, parseProductSheet } from '../excel/workbook';
import { readXlsx, writeXlsx } from '../excel/io';
import { downloadBlob } from '../lib/download';
import { formatDate, formatDateTime, toDateString } from '../lib/format';
import { errorMessage } from '../lib/scan';
import { useApp } from '../lib/appContext';

type Tab = 'export' | 'products' | 'restore';

const ACTION_LABELS = { create: 'Thêm mới', update: 'Cập nhật', unchanged: 'Không đổi', error: 'Lỗi – bỏ qua' } as const;

async function downloadBackup(range?: { from: string; to: string }) {
  const { data, meta } = await api.backup.exportData(range);
  const blob = await writeXlsx(buildBackupSheets(data, meta));
  const name = range ? `grocery-pos_${range.from}_${range.to}.xlsx` : `grocery-pos_toan-bo_${toDateString(new Date())}.xlsx`;
  downloadBlob(blob, name);
  return data;
}

/** Đọc file người dùng chọn; báo lỗi dễ hiểu nếu không phải .xlsx. */
async function readFile(file: File) {
  try {
    return await readXlsx(await file.arrayBuffer());
  } catch {
    throw new Error(`Không đọc được “${file.name}”. Chỉ hỗ trợ file Excel .xlsx`);
  }
}

/** 📁 Dữ liệu: xuất Excel để lưu trữ, nhập danh mục sản phẩm, khôi phục toàn bộ từ file đã xuất. */
export function DataModal({ onClose }: { onClose: () => void }) {
  const { notify, bumpData } = useApp();
  const [tab, setTab] = useState<Tab>('export');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Xuất
  const [scope, setScope] = useState<'full' | 'range'>('full');
  const filter = useDateRange('30d');

  // Nhập sản phẩm
  const productFile = useRef<HTMLInputElement>(null);
  const [productRows, setProductRows] = useState<ProductSheetRow[]>();
  const [plan, setPlan] = useState<ProductImportPlan>();
  const [productFileName, setProductFileName] = useState('');

  // Khôi phục
  const restoreFile = useRef<HTMLInputElement>(null);
  const [restoreData, setRestoreData] = useState<{ data: BackupData; meta: Partial<BackupMeta>; file: string }>();
  const [backupFirst, setBackupFirst] = useState(true);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const range = scope === 'range' ? filter.range : undefined;
      if (range && range.from > range.to) throw new Error('Khoảng thời gian không hợp lệ');
      const data = await downloadBackup(range);
      notify(`Đã xuất Excel: ${data.products.length} sản phẩm, ${data.invoices.length} hoá đơn, ${data.imports.length} phiếu nhập`, 'success');
    });

  const pickProducts = (file: File) =>
    run(async () => {
      setPlan(undefined);
      const rows = parseProductSheet(await readFile(file));
      if (rows.length === 0) throw new Error('File không có dòng sản phẩm nào');
      setProductRows(rows);
      setProductFileName(file.name);
      setPlan(await api.products.previewImport(rows));
    });

  const applyProducts = () =>
    run(async () => {
      if (!productRows) return;
      const res = await api.products.applyImport(productRows);
      bumpData();
      notify(
        `Đã nhập: ${res.created} sản phẩm mới, ${res.updated} cập nhật` +
          (res.importId ? `, phiếu nhập đầu kỳ #${res.importId}` : '') +
          (res.adjustments ? `, ${res.adjustments} điều chỉnh tồn` : '') +
          (res.skipped ? ` · bỏ qua ${res.skipped} dòng lỗi` : ''),
        'success',
      );
      setPlan(undefined);
      setProductRows(undefined);
    });

  const pickRestore = (file: File) =>
    run(async () => {
      setRestoreData(undefined);
      const parsed = parseBackupSheets(await readFile(file));
      setRestoreData({ ...parsed, file: file.name });
    });

  const doRestore = () =>
    run(async () => {
      if (!restoreData) return;
      if (!confirm('Thay TOÀN BỘ dữ liệu hiện tại bằng dữ liệu trong file? Không thể hoàn tác.')) return;
      if (backupFirst) await downloadBackup();
      await api.backup.restore(restoreData.data);
      notify('Đã khôi phục dữ liệu – đang tải lại…', 'success');
      // Tải lại để xoá hoá đơn / phiếu nhập đang soạn (có thể trỏ tới sản phẩm cũ)
      setTimeout(() => location.reload(), 800);
    });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'export', label: '⬇ Xuất Excel' },
    { key: 'products', label: '📦 Nhập danh mục sản phẩm' },
    { key: 'restore', label: '♻️ Khôi phục toàn bộ' },
  ];

  return (
    <Modal title="📁 Dữ liệu & Excel" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => {
              setTab(t.key);
              setError('');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="data-panel">
        {tab === 'export' && (
          <>
            <label className="radio-card">
              <input type="radio" checked={scope === 'full'} onChange={() => setScope('full')} />
              <div>
                <strong>Toàn bộ dữ liệu</strong>
                <div className="muted small">Sản phẩm, phiếu nhập, hoá đơn, kiểm kê. Dùng để sao lưu và khôi phục lại khi cần.</div>
              </div>
            </label>
            <label className="radio-card">
              <input type="radio" checked={scope === 'range'} onChange={() => setScope('range')} />
              <div>
                <strong>Theo khoảng thời gian (lưu trữ theo kỳ)</strong>
                <div className="muted small">Giao dịch trong khoảng đã chọn + danh mục sản phẩm hiện tại. Để xem / báo cáo, không dùng để khôi phục.</div>
              </div>
            </label>
            {scope === 'range' && (
              <div className="toolbar">
                <DateRangeFilter {...filter} />
                <span className="muted small">
                  {formatDate(filter.range.from)} → {formatDate(filter.range.to)}
                </span>
              </div>
            )}
            <p className="muted small">
              File gồm các sheet: Thông tin, Sản phẩm, Phiếu nhập, Chi tiết nhập, Hóa đơn, Chi tiết hóa đơn, Kiểm kê.
            </p>
            <div>
              <button type="button" className="btn btn-primary btn-lg" onClick={doExport} disabled={busy}>
                ⬇ Xuất file Excel
              </button>
            </div>
          </>
        )}

        {tab === 'products' && (
          <>
            <p className="muted small">
              Dùng để khai báo nhiều sản phẩm một lần hoặc cập nhật giá hàng loạt. Cột: <b>Mã vạch</b>, <b>Tên sản phẩm</b>,{' '}
              <b>Giá nhập</b>, <b>Giá bán</b>, <b>Tồn kho</b> (không bắt buộc). Có thể dùng luôn sheet “Sản phẩm” của file đã
              xuất.
            </p>
            <div className="toolbar">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => run(async () => downloadBlob(await writeXlsx(buildProductTemplate()), 'mau-nhap-san-pham.xlsx'))}
              >
                ⬇ Tải file mẫu
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => productFile.current?.click()}>
                📂 Chọn file Excel…
              </button>
              {productFileName && <span className="muted small">{productFileName}</span>}
              <input
                ref={productFile}
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) pickProducts(f);
                }}
              />
            </div>

            {plan && (
              <>
                <div className="plan-counts">
                  <span className="badge">Thêm mới {plan.counts.create}</span>
                  <span className="badge badge-status-pending">Cập nhật {plan.counts.update}</span>
                  <span className="badge badge-status-cancelled">Không đổi {plan.counts.unchanged}</span>
                  {plan.counts.error > 0 && <span className="badge badge-danger">Lỗi {plan.counts.error}</span>}
                </div>
                <div className="table-wrap table-compact">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Mã vạch</th>
                        <th>Tên sản phẩm</th>
                        <th>Hành động</th>
                        <th>Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.items.slice(0, 300).map((it) => (
                        <tr key={it.row} className={`plan-${it.action}`}>
                          <td className="muted">{it.row}</td>
                          <td className="mono">{it.barcode ?? '—'}</td>
                          <td>{it.name || <span className="muted">(trống)</span>}</td>
                          <td>{ACTION_LABELS[it.action]}</td>
                          <td className={it.error ? 'text-danger small' : 'small'}>{it.error ?? it.changes.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plan.items.length > 300 && <p className="muted small">Hiển thị 300 / {plan.items.length} dòng.</p>}
                <div className="toolbar">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={applyProducts}
                    disabled={busy || plan.counts.create + plan.counts.update === 0}
                  >
                    Áp dụng {plan.counts.create + plan.counts.update} dòng
                    {plan.counts.error > 0 && ` (bỏ qua ${plan.counts.error} dòng lỗi)`}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPlan(undefined);
                      setProductRows(undefined);
                      setProductFileName('');
                    }}
                  >
                    Huỷ
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'restore' && (
          <>
            <div className="transfer-status">
              ⚠️ Khôi phục sẽ <strong>thay toàn bộ</strong> sản phẩm, phiếu nhập, hoá đơn, kiểm kê hiện tại bằng dữ liệu trong file.
              Chỉ dùng file <strong>“Toàn bộ dữ liệu”</strong> xuất từ Grocery POS.
            </div>
            <div className="toolbar">
              <button type="button" className="btn" disabled={busy} onClick={() => restoreFile.current?.click()}>
                📂 Chọn file sao lưu (.xlsx)…
              </button>
              <input
                ref={restoreFile}
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) pickRestore(f);
                }}
              />
            </div>
            {restoreData && (
              <>
                <div className="panel restore-summary">
                  <div>
                    <strong>{restoreData.file}</strong>
                    {restoreData.meta.exportedAt && (
                      <span className="muted small"> · xuất lúc {formatDateTime(restoreData.meta.exportedAt)}</span>
                    )}
                  </div>
                  <div className="stat-strip">
                    <div>
                      <span className="muted">Sản phẩm</span> <strong>{restoreData.data.products.length}</strong>
                    </div>
                    <div>
                      <span className="muted">Phiếu nhập</span> <strong>{restoreData.data.imports.length}</strong>
                    </div>
                    <div>
                      <span className="muted">Hóa đơn</span> <strong>{restoreData.data.invoices.length}</strong>
                    </div>
                    <div>
                      <span className="muted">Kiểm kê</span> <strong>{restoreData.data.adjustments.length}</strong>
                    </div>
                  </div>
                  <div className="text-success small">✓ File hợp lệ</div>
                </div>
                <label className="checkbox">
                  <input type="checkbox" checked={backupFirst} onChange={(e) => setBackupFirst(e.target.checked)} />
                  Tải file Excel sao lưu dữ liệu hiện tại trước khi khôi phục (khuyên dùng)
                </label>
                <div>
                  <button type="button" className="btn btn-danger btn-lg" onClick={doRestore} disabled={busy}>
                    ♻️ Khôi phục dữ liệu từ file này
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {error && <pre className="form-error pre-wrap">{error}</pre>}
      </div>
    </Modal>
  );
}
