import type { Invoice, StoreSettings } from '../types';
import { bankName, buildVietQrPayload, transferContent } from './vietqr';

export interface InvoiceQr {
  payload: string;
  bank: string;
  account: string;
  accountName: string;
  amount: number;
  content: string;
}

export function isTransferEnabled(settings: StoreSettings): boolean {
  return /^\d{6}$/.test(settings.bankBin) && settings.bankAccount.trim() !== '';
}

/** Mã VietQR cho một hoá đơn; null nếu chưa cài đặt tài khoản ngân hàng hợp lệ. */
export function invoiceQr(invoice: Pick<Invoice, 'invoice_number' | 'total'>, settings: StoreSettings): InvoiceQr | null {
  if (!isTransferEnabled(settings)) return null;
  const content = transferContent(invoice.invoice_number);
  try {
    return {
      payload: buildVietQrPayload({ bin: settings.bankBin, accountNumber: settings.bankAccount, amount: invoice.total, content }),
      bank: bankName(settings.bankBin),
      account: settings.bankAccount.replace(/\s/g, ''),
      accountName: settings.bankAccountName.trim().toUpperCase(),
      amount: invoice.total,
      content,
    };
  } catch {
    return null;
  }
}

export interface StoreQr {
  payload: string;
  bank: string;
  account: string;
  accountName: string;
}

/** QR tĩnh tài khoản cửa hàng (không kèm số tiền) để in trên mọi hoá đơn; null nếu chưa cài đặt. */
export function storeQr(settings: StoreSettings): StoreQr | null {
  if (!isTransferEnabled(settings)) return null;
  try {
    return {
      payload: buildVietQrPayload({ bin: settings.bankBin, accountNumber: settings.bankAccount }),
      bank: bankName(settings.bankBin),
      account: settings.bankAccount.replace(/\s/g, ''),
      accountName: settings.bankAccountName.trim().toUpperCase(),
    };
  } catch {
    return null;
  }
}

export const PAYMENT_LABELS = { cash: 'Tiền mặt', transfer: 'Chuyển khoản' } as const;
export const STATUS_LABELS = { pending: 'Chờ chuyển khoản', paid: 'Đã thanh toán', cancelled: 'Đã huỷ' } as const;
