import { createContext, useContext } from 'react';
import type { InvoiceDetail, StoreSettings } from '../types';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface AppContextValue {
  settings: StoreSettings;
  notify: (message: string, kind?: ToastKind, action?: ToastAction) => void;
  /** settings: dùng cài đặt khác cài đặt đã lưu (VD in thử trong màn Cài đặt) */
  printInvoice: (invoice: InvoiceDetail, settings?: StoreSettings) => void;
  /** Chuyển sang 📥 Nhập hàng và thêm một dòng nhập tay (điền sẵn mã vạch nếu có). */
  openImport: (barcode?: string) => void;
  openSettings: () => void;
  /** Tăng mỗi khi dữ liệu thay đổi để các trang tải lại. */
  dataVersion: number;
  bumpData: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải dùng bên trong AppContext');
  return ctx;
}

/** Có modal nào đang mở không (để không cướp focus / phím tắt). */
export function isModalOpen(): boolean {
  return document.querySelector('.modal-backdrop') !== null;
}
