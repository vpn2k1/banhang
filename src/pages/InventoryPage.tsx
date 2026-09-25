import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product, ProductInfoInput } from '../types';
import { api } from '../db/api';
import { ProductRow, LOW_STOCK } from '../components/ProductRow';
import { ProductFormModal } from '../components/ProductFormModal';
import { StockCountModal } from '../components/StockCountModal';
import { formatMoney, normalizeText } from '../lib/format';
import { formatDiff } from '../lib/adjustments';
import { errorMessage } from '../lib/scan';
import { isModalOpen, useApp } from '../lib/appContext';

type Dialog = { kind: 'edit'; product: Product } | { kind: 'count'; product: Product };

/**
 * 📦 Kho: tìm / quét mã, xem tồn kho, sửa thông tin, kiểm kê.
 * Thêm sản phẩm mới → chuyển sang 📥 Nhập hàng (sản phẩm luôn vào kho qua phiếu nhập).
 */
export function InventoryPage({ active }: { active: boolean }) {
  const { notify, bumpData, dataVersion, openImport } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [loaded, setLoaded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    api.products.list().then((list) => {
      setProducts(list);
      setLoaded(true);
    });
  }, [active, dataVersion]);

  useEffect(() => {
    if (active && !isModalOpen()) searchRef.current?.focus();
  }, [active]);

  const filtered = useMemo(() => {
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if (lowOnly && p.stock > LOW_STOCK) return false;
      const hay = `${normalizeText(p.name)} ${p.barcode ?? ''}`;
      return words.every((w) => hay.includes(w));
    });
  }, [products, query, lowOnly]);

  const totals = useMemo(
    () => ({
      stock: products.reduce((s, p) => s + Math.max(0, p.stock), 0),
      value: products.reduce((s, p) => s + Math.max(0, p.stock) * p.purchase_price, 0),
      low: products.filter((p) => p.stock <= LOW_STOCK).length,
    }),
    [products],
  );

  const closeDialog = () => {
    setDialog(undefined);
    setTimeout(() => searchRef.current?.focus());
  };

  // Quét mã + Enter: có → mở Kiểm kê (quét để đếm); chưa có → chuyển sang Nhập hàng
  const onEnter = () => {
    const code = query.trim();
    if (!code) return;
    const exact = products.find((p) => p.barcode === code);
    if (exact) {
      setQuery('');
      setDialog({ kind: 'count', product: exact });
    } else if (filtered.length === 1) {
      setDialog({ kind: 'count', product: filtered[0] });
    } else if (filtered.length === 0 && /^\d{4,}$/.test(code)) {
      setQuery('');
      notify(`Mã ${code} chưa có trong kho – nhập hàng để thêm sản phẩm`, 'info');
      openImport(code);
    }
  };

  const saveInfo = async (id: number, input: ProductInfoInput) => {
    await api.products.update(id, input);
    notify(`Đã cập nhật “${input.name}”`, 'success');
    closeDialog();
    bumpData();
  };

  const seed = async () => {
    try {
      await api.dev.seed();
      bumpData();
      notify('Đã tạo dữ liệu mẫu', 'success');
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>📦 Kho</h1>
        <div className="toolbar">
          <div className="search-input">
            <span aria-hidden>🔍</span>
            <input
              ref={searchRef}
              value={query}
              placeholder="Tìm tên sản phẩm hoặc quét mã để kiểm kê…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEnter();
                if (e.key === 'Escape') setQuery('');
              }}
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Sắp hết (≤ {LOW_STOCK})
          </label>
          <button type="button" className="btn btn-primary" onClick={() => openImport()} title="Chuyển sang 📥 Nhập hàng">
            + Thêm sản phẩm
          </button>
        </div>
      </header>

      <div className="stat-strip">
        <div>
          <span className="muted">Mặt hàng</span> <strong>{products.length}</strong>
        </div>
        <div>
          <span className="muted">Tổng tồn</span> <strong>{totals.stock}</strong>
        </div>
        <div>
          <span className="muted">Giá trị tồn (giá nhập)</span> <strong>{formatMoney(totals.value)}</strong>
        </div>
        <div>
          <span className="muted">Sắp hết / hết hàng</span> <strong className={totals.low ? 'text-warn' : ''}>{totals.low}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Mã vạch</th>
              <th>Sản phẩm</th>
              <th className="num">Giá nhập</th>
              <th className="num">Giá bán</th>
              <th className="num">Tồn kho</th>
              <th className="col-action" />
            </tr>
          </thead>
          <tbody>
            {loaded && products.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  <p>Kho chưa có sản phẩm.</p>
                  <p>
                    Bấm <strong>+ Thêm sản phẩm</strong> để nhập hàng, hoặc{' '}
                    <button type="button" className="btn btn-small" onClick={seed}>
                      Tạo dữ liệu mẫu để thử
                    </button>
                  </p>
                </td>
              </tr>
            )}
            {products.length > 0 && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Không tìm thấy sản phẩm phù hợp
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onEdit={(product) => setDialog({ kind: 'edit', product })}
                onCount={(product) => setDialog({ kind: 'count', product })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {dialog?.kind === 'edit' && (
        <ProductFormModal product={dialog.product} onClose={closeDialog} onSave={(input) => saveInfo(dialog.product.id, input)} />
      )}
      {dialog?.kind === 'count' && (
        <StockCountModal
          product={dialog.product}
          onClose={closeDialog}
          onSaved={(adj) => {
            const diff = adj.new_stock - adj.old_stock;
            notify(`Đã kiểm kê “${adj.name}”: ${adj.old_stock} → ${adj.new_stock} (${formatDiff(diff)})`, 'success');
            closeDialog();
            bumpData();
          }}
        />
      )}
    </div>
  );
}
