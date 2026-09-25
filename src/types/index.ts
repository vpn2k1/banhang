// Tiền tệ lưu dạng số nguyên (VND), thời gian lưu dạng 'YYYY-MM-DD HH:mm:ss' theo giờ máy.

export interface Product {
  id: number;
  barcode: string | null;
  name: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
}

export interface ProductInput {
  barcode: string | null;
  name: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
}

/** Thông tin sửa được ở Kho. Tồn kho chỉ đổi qua Nhập hàng / Hoá đơn / Kiểm kê. */
export type ProductInfoInput = Omit<ProductInput, 'stock'>;

/** Một dòng trong phiếu nhập đang soạn. */
export interface ImportLine {
  product: Product;
  quantity: number;
  purchase_price: number;
}

/** Một dòng trong hoá đơn đang bán. */
export interface CartLine {
  product: Product;
  quantity: number;
  selling_price: number;
}

export interface ImportRecord {
  id: number;
  created_at: string;
  total: number;
}

export type PaymentMethod = 'cash' | 'transfer';

/** pending: chờ chuyển khoản · paid: đã thanh toán · cancelled: đã huỷ (đã hoàn tồn kho) */
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled';

export interface Invoice {
  id: number;
  invoice_number: string;
  created_at: string;
  total: number;
  /** Tiền mặt khách đưa (0 nếu chuyển khoản) */
  cash_received: number;
  payment_method: PaymentMethod;
  status: InvoiceStatus;
  paid_at: string | null;
}

export interface ImportSummary extends ImportRecord {
  line_count: number;
  total_quantity: number;
}

export interface ImportItemDetail {
  product_id: number;
  barcode: string | null;
  name: string;
  quantity: number;
  purchase_price: number;
}

export interface ImportDetail extends ImportRecord {
  items: ImportItemDetail[];
}

export interface InvoiceSummary extends Invoice {
  total_quantity: number;
}

export type AdjustmentReason = 'count' | 'damaged' | 'expired' | 'lost' | 'other';

export interface StockAdjustment {
  id: number;
  product_id: number;
  barcode: string | null;
  name: string;
  created_at: string;
  old_stock: number;
  new_stock: number;
  reason: AdjustmentReason;
  note: string | null;
  /** Giá nhập lúc điều chỉnh, để tính giá trị chênh lệch */
  purchase_price: number;
}

export interface InvoiceItemDetail {
  product_id: number;
  barcode: string | null;
  name: string;
  quantity: number;
  selling_price: number;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItemDetail[];
}

export interface DateRange {
  /** 'YYYY-MM-DD' (bao gồm) */
  from: string;
  /** 'YYYY-MM-DD' (bao gồm) */
  to: string;
}

export interface StatsSummary {
  revenue: number;
  invoiceCount: number;
  itemsSold: number;
  importValue: number;
  /** Giá trị hàng hao hụt (kiểm kê giảm), tính theo giá nhập */
  shrinkageValue: number;
  cashRevenue: number;
  transferRevenue: number;
  /** Hoá đơn chuyển khoản chưa xác nhận */
  pendingCount: number;
  pendingAmount: number;
}

export interface TopProduct {
  product_id: number;
  name: string;
  quantity: number;
  revenue: number;
}

export type PaperWidth = 58 | 80;

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  footer: string;
  paperWidth: PaperWidth;
  /** Nhấn Enter ở màn thanh toán sẽ "Thanh toán & In" thay vì chỉ "Thanh toán". */
  printOnEnter: boolean;
  /** Bản desktop: tên máy in hoá đơn ('' = máy in mặc định của hệ thống) */
  printerName: string;
  /** Tài khoản nhận chuyển khoản (VietQR). Bỏ trống bankBin → tắt chuyển khoản. */
  bankBin: string;
  bankAccount: string;
  bankAccountName: string;
}

export type PageKey = 'import' | 'invoice' | 'inventory' | 'statistics' | 'history';
