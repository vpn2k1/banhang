import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InvoiceDetail, PageKey, StoreSettings } from './types';
import { initDatabase } from './db/database';
import { AppContext, isModalOpen, type AppContextValue, type ToastAction, type ToastKind } from './lib/appContext';
import { useSettings } from './hooks/useSettings';
import { ImportPage, type ImportRequest } from './pages/ImportPage';
import { InvoicePage } from './pages/InvoicePage';
import { InventoryPage } from './pages/InventoryPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { HistoryPage } from './pages/HistoryPage';
import { Receipt } from './components/Receipt';
import { SettingsModal } from './components/SettingsModal';
import { DataModal } from './components/DataModal';
import { Toasts, type ToastItem } from './components/Toasts';
import { errorMessage } from './lib/scan';
import { printRenderedReceipt } from './device/printer';

const NAV: { key: PageKey; icon: string; label: string; shortcut: string }[] = [
  { key: 'import', icon: '📥', label: 'Nhập hàng', shortcut: 'F1' },
  { key: 'invoice', icon: '🧾', label: 'Hóa đơn', shortcut: 'F2' },
  { key: 'inventory', icon: '📦', label: 'Kho', shortcut: 'F3' },
  { key: 'statistics', icon: '📊', label: 'Thống kê', shortcut: 'F4' },
  { key: 'history', icon: '🕘', label: 'Lịch sử', shortcut: 'F5' },
];

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | string>('loading');
  const [page, setPage] = useState<PageKey>('invoice');
  const [settings, setSettings] = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showData, setShowData] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [printJob, setPrintJob] = useState<{ invoice: InvoiceDetail; settings: StoreSettings }>();
  const [importRequest, setImportRequest] = useState<ImportRequest>();
  const toastId = useRef(0);

  const openImport = useCallback((barcode?: string) => {
    setImportRequest({ id: Date.now(), barcode });
    setPage('import');
  }, []);
  const clearImportRequest = useCallback(() => setImportRequest(undefined), []);

  useEffect(() => {
    initDatabase()
      .then(() => setStatus('ready'))
      .catch((err) => setStatus(errorMessage(err)));
  }, []);

  // F1–F4 chuyển chức năng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const item = NAV.find((n) => n.shortcut === e.key);
      if (item && !isModalOpen()) {
        e.preventDefault();
        setPage(item.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info', action?: ToastAction) => {
      const id = ++toastId.current;
      setToasts((ts) => [...ts.slice(-3), { id, message, kind, action }]);
      setTimeout(() => dismiss(id), action ? 8000 : 4000);
    },
    [dismiss],
  );

  // In hoá đơn: vẽ Receipt vào #print-root rồi in (desktop: thẳng ra máy in; trình duyệt: hộp thoại in).
  const printInvoice = useCallback(
    (invoice: InvoiceDetail, override?: StoreSettings) => setPrintJob({ invoice, settings: override ?? settings }),
    [settings],
  );
  useEffect(() => {
    if (!printJob) return;
    const t = setTimeout(async () => {
      try {
        await printRenderedReceipt(printJob.settings);
      } catch (err) {
        notify(`Không in được hoá đơn ${printJob.invoice.invoice_number}: ${errorMessage(err)}`, 'error', {
          label: 'Cài đặt máy in',
          onClick: () => setShowSettings(true),
        });
      } finally {
        setPrintJob(undefined);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [printJob, notify]);

  const ctx = useMemo<AppContextValue>(
    () => ({
      settings,
      notify,
      printInvoice,
      openImport,
      openSettings: () => setShowSettings(true),
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
    }),
    [settings, notify, printInvoice, openImport, dataVersion],
  );

  if (status !== 'ready') {
    return (
      <div className="splash">
        {status === 'loading' ? (
          <p>Đang mở cơ sở dữ liệu…</p>
        ) : (
          <>
            <p className="text-danger">Không khởi tạo được SQLite: {status}</p>
            <button type="button" className="btn" onClick={() => location.reload()}>
              Thử lại
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <nav className="sidebar">
          <div className="brand">
            🛒 <span>Grocery POS</span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              className={`nav-item ${page === n.key ? 'active' : ''}`}
              onClick={() => setPage(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              <kbd>{n.shortcut}</kbd>
            </button>
          ))}
          <div className="sidebar-footer">
            <button type="button" className="nav-item" onClick={() => setShowData(true)}>
              <span className="nav-icon">📁</span>
              <span className="nav-label">Dữ liệu & Excel</span>
            </button>
            <button type="button" className="nav-item" onClick={() => setShowSettings(true)}>
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Cài đặt</span>
            </button>
          </div>
        </nav>

        <main className="content">
          {/* Giữ các trang luôn mounted để không mất hoá đơn / phiếu nhập đang soạn khi chuyển tab */}
          <div hidden={page !== 'import'} className="page-host">
            <ImportPage active={page === 'import'} request={importRequest} onRequestHandled={clearImportRequest} />
          </div>
          <div hidden={page !== 'invoice'} className="page-host">
            <InvoicePage active={page === 'invoice'} />
          </div>
          <div hidden={page !== 'inventory'} className="page-host">
            <InventoryPage active={page === 'inventory'} />
          </div>
          <div hidden={page !== 'statistics'} className="page-host">
            <StatisticsPage active={page === 'statistics'} />
          </div>
          <div hidden={page !== 'history'} className="page-host">
            <HistoryPage active={page === 'history'} />
          </div>
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => {
            setSettings(s);
            setShowSettings(false);
            notify('Đã lưu cài đặt', 'success');
          }}
        />
      )}

      {showData && <DataModal onClose={() => setShowData(false)} />}

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {printJob &&
        createPortal(
          <>
            <style>{'@page { margin: 0; }'}</style>
            <Receipt invoice={printJob.invoice} settings={printJob.settings} />
          </>,
          document.getElementById('print-root')!,
        )}
    </AppContext.Provider>
  );
}
