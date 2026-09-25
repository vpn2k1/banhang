import { useEffect, useState } from 'react';
import type { StatsSummary, TopProduct } from '../types';
import { api } from '../db/api';
import { DateRangeFilter, useDateRange } from '../components/DateRangeFilter';
import { DevTools } from '../components/DevTools';
import { formatMoney } from '../lib/format';
import { errorMessage } from '../lib/scan';
import { useApp } from '../lib/appContext';

const EMPTY: StatsSummary = {
  revenue: 0,
  invoiceCount: 0,
  itemsSold: 0,
  importValue: 0,
  shrinkageValue: 0,
  cashRevenue: 0,
  transferRevenue: 0,
  pendingCount: 0,
  pendingAmount: 0,
};

/** 📊 Thống kê: doanh thu, số hoá đơn, SL bán, giá trị nhập, hao hụt, sản phẩm bán chạy. */
export function StatisticsPage({ active }: { active: boolean }) {
  const { dataVersion, notify } = useApp();
  const filter = useDateRange('today');
  const { range } = filter;
  const [summary, setSummary] = useState<StatsSummary>(EMPTY);
  const [top, setTop] = useState<TopProduct[]>([]);

  useEffect(() => {
    if (!active || range.from > range.to) return;
    Promise.all([api.statistics.summary(range), api.statistics.topProducts(range, 10)])
      .then(([s, t]) => {
        setSummary(s);
        setTop(t);
      })
      .catch((err) => notify(errorMessage(err), 'error'));
    // range là object mới mỗi lần render → so sánh theo giá trị
  }, [active, dataVersion, range.from, range.to]);

  const maxQty = Math.max(1, ...top.map((t) => t.quantity));

  return (
    <div className="page page-scroll">
      <header className="page-header">
        <h1>📊 Thống kê</h1>
        <div className="toolbar">
          <DateRangeFilter {...filter} />
        </div>
      </header>

      <div className="stat-cards">
        <div className="stat-card">
          <span>Doanh thu (đã thanh toán)</span>
          <strong>{formatMoney(summary.revenue)}</strong>
          <small className="muted">
            💵 {formatMoney(summary.cashRevenue)} · 🏦 {formatMoney(summary.transferRevenue)}
          </small>
        </div>
        <div className="stat-card">
          <span>Chờ chuyển khoản</span>
          <strong className={summary.pendingCount ? 'text-warn' : ''}>{formatMoney(summary.pendingAmount)}</strong>
          <small className="muted">{summary.pendingCount} hoá đơn chưa xác nhận</small>
        </div>
        <div className="stat-card">
          <span>Số hoá đơn</span>
          <strong>{summary.invoiceCount}</strong>
        </div>
        <div className="stat-card">
          <span>Số sản phẩm đã bán</span>
          <strong>{summary.itemsSold}</strong>
        </div>
        <div className="stat-card">
          <span>Giá trị hàng nhập</span>
          <strong>{formatMoney(summary.importValue)}</strong>
        </div>
        <div className="stat-card">
          <span>Hao hụt kho (kiểm kê)</span>
          <strong className={summary.shrinkageValue ? 'text-danger' : ''}>{formatMoney(summary.shrinkageValue)}</strong>
        </div>
      </div>

      <section className="panel">
        <h2>Sản phẩm bán nhiều</h2>
        {top.length === 0 ? (
          <p className="muted">Chưa có dữ liệu bán hàng trong khoảng thời gian này.</p>
        ) : (
          <ol className="top-list">
            {top.map((t) => (
              <li key={t.product_id}>
                <div className="top-line">
                  <span className="cell-name">{t.name}</span>
                  <span>
                    <strong>{t.quantity}</strong> <span className="muted small">· {formatMoney(t.revenue)}</span>
                  </span>
                </div>
                <div className="bar">
                  <div style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="muted small">Danh sách phiếu nhập, hoá đơn, kiểm kê: xem ở 🕘 Lịch sử.</p>
      </section>

      <DevTools />
    </div>
  );
}
