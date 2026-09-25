import { useRef, useState } from 'react';
import { api } from '../db/api';
import { isPersistent, sqliteVersion } from '../db/database';
import { errorMessage } from '../lib/scan';
import { toDateString } from '../lib/format';
import { downloadBlob } from '../lib/download';
import { useApp } from '../lib/appContext';

/** Công cụ cho giai đoạn test online: chạy SQL, sao lưu / khôi phục file .sqlite, xoá dữ liệu. */
export function DevTools() {
  const { notify, bumpData } = useApp();
  const [sql, setSql] = useState('SELECT * FROM products LIMIT 20;');
  const [rows, setRows] = useState<Record<string, unknown>[]>();
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    setError('');
    try {
      setRows(await api.dev.query(sql));
      bumpData();
    } catch (err) {
      setRows(undefined);
      setError(errorMessage(err));
    }
  };

  const download = async () => {
    const bytes = await api.dev.exportFile();
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' }), `grocery-pos-${toDateString(new Date())}.sqlite`);
  };

  const restore = async (file: File) => {
    if (!confirm(`Thay toàn bộ dữ liệu hiện tại bằng file “${file.name}”?`)) return;
    try {
      await api.dev.importFile(new Uint8Array(await file.arrayBuffer()));
      bumpData();
      notify('Đã khôi phục database', 'success');
    } catch (err) {
      notify(`Không khôi phục được: ${errorMessage(err)}`, 'error');
    }
  };

  const reset = async () => {
    if (!confirm('Xoá TOÀN BỘ sản phẩm, phiếu nhập, hoá đơn? Không thể hoàn tác.')) return;
    await api.dev.reset();
    bumpData();
    notify('Đã xoá toàn bộ dữ liệu', 'info');
  };

  const columns = rows?.length ? Object.keys(rows[0]) : [];

  return (
    <details className="panel devtools">
      <summary>
        🛠 Dữ liệu & công cụ test <span className="muted small">— SQLite {sqliteVersion()} (WASM) · {isPersistent() ? 'lưu trong trình duyệt (IndexedDB)' : 'KHÔNG lưu được, dữ liệu mất khi tải lại'}</span>
      </summary>
      <div className="devtools-actions">
        <button type="button" className="btn btn-small" onClick={download}>
          ⬇ Sao lưu (.sqlite)
        </button>
        <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
          ⬆ Khôi phục từ file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".sqlite,.sqlite3,.db"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) restore(f);
          }}
        />
        <button
          type="button"
          className="btn btn-small"
          onClick={async () => {
            await api.dev.seed().catch((err) => notify(errorMessage(err), 'error'));
            bumpData();
          }}
        >
          Tạo dữ liệu mẫu
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={reset}>
          Xoá toàn bộ dữ liệu
        </button>
      </div>
      <div className="sql-console">
        <textarea
          value={sql}
          rows={3}
          spellCheck={false}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              run();
            }
          }}
        />
        <button type="button" className="btn btn-primary btn-small" onClick={run}>
          Chạy SQL (Ctrl+Enter)
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {rows && (
        <div className="table-wrap table-compact">
          {rows.length === 0 ? (
            <p className="muted">Không có dòng nào (câu lệnh đã chạy xong).</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} className="mono">
                        {r[c] === null ? <span className="muted">NULL</span> : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </details>
  );
}
