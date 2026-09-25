import type { StoreSettings } from '../types';

/**
 * In hoá đơn.
 * - Bản desktop (Electron): in thẳng ra máy in đã chọn trong Cài đặt, không hộp thoại
 *   (electron/main.cjs → webContents.print({ silent: true })).
 * - Bản trình duyệt: hộp thoại in của trình duyệt (window.print()).
 * Cả hai in cùng một nội dung: hoá đơn trong #print-root (CSS @media print ẩn phần còn lại).
 */

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface PosDevice {
  platform: string;
  listPrinters(): Promise<PrinterInfo[]>;
  printReceipt(opts: { deviceName?: string; widthMm: number; heightMm: number }): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    /** Có khi chạy trong Electron (electron/preload.cjs) */
    posDevice?: PosDevice;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!window.posDevice;
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  return window.posDevice ? window.posDevice.listPrinters() : [];
}

/** Khoảng giấy trống cuối hoá đơn để xé (mm) */
const TEAR_OFF_MM = 10;

/** Chiều cao hoá đơn đang nằm trong #print-root, đổi px → mm (CSS: 96px = 1 inch = 25.4mm). */
function receiptHeightMm(): number {
  const el = document.querySelector('#print-root .receipt');
  if (!el) throw new Error('Không tìm thấy hoá đơn để in');
  return Math.ceil((el.getBoundingClientRect().height * 25.4) / 96) + TEAR_OFF_MM;
}

/** In hoá đơn đang được vẽ trong #print-root. Ném lỗi (tiếng Việt) nếu in thất bại. */
export async function printRenderedReceipt(settings: StoreSettings): Promise<void> {
  const device = window.posDevice;
  if (!device) {
    window.print();
    return;
  }
  const res = await device.printReceipt({
    deviceName: settings.printerName || undefined,
    widthMm: settings.paperWidth,
    heightMm: receiptHeightMm(),
  });
  if (!res.ok) throw new Error(res.error ?? 'In thất bại');
}
