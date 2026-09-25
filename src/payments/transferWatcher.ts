import type { Invoice } from '../types';

/**
 * Chỗ cắm dịch vụ tự kiểm tra chuyển khoản (SePay, Casso, PayOS...).
 *
 * Hiện tại: không có → người bán xác nhận thủ công ("Đã nhận tiền").
 * Sau này (Electron): cài đặt một TransferWatcher gọi API dịch vụ trong main process
 * (giữ API key an toàn), khớp theo số tiền + nội dung = transferContent(invoice_number).
 * Màn QR sẽ tự hỏi check() định kỳ và xác nhận khi 'paid'.
 */
export interface TransferWatcher {
  /** Tên hiển thị, VD "SePay" */
  name: string;
  check(invoice: Invoice): Promise<'paid' | 'pending'>;
}

let watcher: TransferWatcher | null = null;

export function setTransferWatcher(next: TransferWatcher | null): void {
  watcher = next;
}

export function getTransferWatcher(): TransferWatcher | null {
  return watcher;
}
