/**
 * Chuyển dữ liệu <-> bảng tính. Không phụ thuộc thư viện đọc/ghi .xlsx (xem io.ts),
 * nên test được thuần tuý.
 */
import type { AdjustmentReason, InvoiceStatus, PaymentMethod } from '../types';
import type { BackupData, BackupMeta } from '../db/backup';
import type { ProductSheetRow } from '../db/productImport';
import { ADJUSTMENT_REASONS } from '../lib/adjustments';
import { PAYMENT_LABELS, STATUS_LABELS } from '../payments/invoiceQr';

/** Giá trị ô khi đọc (read-excel-file trả về string / number / boolean / Date / null). */
export type CellValue = string | number | boolean | Date | null;
export interface SheetIn {
  sheet: string;
  data: CellValue[][];
}

/** Ô khi ghi (tương thích write-excel-file). */
export interface CellOut {
  value?: string | number;
  type?: StringConstructor | NumberConstructor;
  format?: string;
  fontWeight?: 'bold';
  backgroundColor?: string;
  wrap?: boolean;
}
export interface SheetOut {
  sheet: string;
  data: (CellOut | null)[][];
  columns: { width: number }[];
  stickyRowsCount?: number;
}

export const SHEETS = {
  info: 'Thông tin',
  products: 'Sản phẩm',
  imports: 'Phiếu nhập',
  importItems: 'Chi tiết nhập',
  invoices: 'Hóa đơn',
  invoiceItems: 'Chi tiết hóa đơn',
  adjustments: 'Kiểm kê',
} as const;

const MONEY = '#,##0';
const APP = 'Grocery POS';
const KIND_LABELS = { full: 'Toàn bộ dữ liệu', range: 'Theo khoảng thời gian' } as const;

// ---------------------------------------------------------------- Ghi

type Kind = 'id' | 'text' | 'code' | 'int' | 'money' | 'datetime';
interface Col<T> {
  header: string;
  width: number;
  kind: Kind;
  get: (row: T) => string | number | null | undefined;
}

function cell(kind: Kind, v: string | number | null | undefined): CellOut | null {
  if (v === null || v === undefined || v === '') return null;
  if (kind === 'text' || kind === 'code' || kind === 'datetime') return { value: String(v), type: String };
  return { value: Number(v), type: Number, format: kind === 'money' ? MONEY : undefined };
}

function table<T>(sheet: string, cols: Col<T>[], rows: T[]): SheetOut {
  const header = cols.map((c) => ({ value: c.header, type: String, fontWeight: 'bold' as const, backgroundColor: '#E8F0FE' }));
  return {
    sheet,
    columns: cols.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
    data: [header, ...rows.map((r) => cols.map((c) => cell(c.kind, c.get(r))))],
  };
}

const PRODUCT_COLS: Col<BackupData['products'][number]>[] = [
  { header: 'ID', width: 6, kind: 'id', get: (p) => p.id },
  { header: 'Mã vạch', width: 16, kind: 'code', get: (p) => p.barcode },
  { header: 'Tên sản phẩm', width: 34, kind: 'text', get: (p) => p.name },
  { header: 'Giá nhập', width: 12, kind: 'money', get: (p) => p.purchase_price },
  { header: 'Giá bán', width: 12, kind: 'money', get: (p) => p.selling_price },
  { header: 'Tồn kho', width: 10, kind: 'int', get: (p) => p.stock },
];

export function buildBackupSheets(data: BackupData, meta: BackupMeta): SheetOut[] {
  const info: SheetOut = {
    sheet: SHEETS.info,
    columns: [{ width: 22 }, { width: 40 }],
    data: [
      [
        { value: 'Mục', type: String, fontWeight: 'bold', backgroundColor: '#E8F0FE' },
        { value: 'Giá trị', type: String, fontWeight: 'bold', backgroundColor: '#E8F0FE' },
      ],
      ...(
        [
          ['Ứng dụng', APP],
          ['Loại dữ liệu', KIND_LABELS[meta.kind]],
          ['Từ ngày', meta.from ?? ''],
          ['Đến ngày', meta.to ?? ''],
          ['Xuất lúc', meta.exportedAt],
          ['Phiên bản dữ liệu', String(meta.schemaVersion)],
          ['Số sản phẩm', String(data.products.length)],
          ['Số phiếu nhập', String(data.imports.length)],
          ['Số hóa đơn', String(data.invoices.length)],
          ['Số lần kiểm kê', String(data.adjustments.length)],
          [
            'Ghi chú',
            meta.kind === 'full'
              ? 'Dùng được để khôi phục toàn bộ dữ liệu. Không đổi tên sheet / tiêu đề cột.'
              : 'File lưu trữ theo kỳ – không dùng để khôi phục toàn bộ.',
          ],
        ] as const
      ).map(([k, v]) => [{ value: k, type: String }, v ? { value: v, type: String, wrap: true } : null] as (CellOut | null)[]),
    ],
  };

  return [
    info,
    table(SHEETS.products, PRODUCT_COLS, data.products),
    table(
      SHEETS.imports,
      [
        { header: 'ID', width: 6, kind: 'id', get: (r) => r.id },
        { header: 'Ngày nhập', width: 20, kind: 'datetime', get: (r) => r.created_at },
        { header: 'Tổng tiền', width: 14, kind: 'money', get: (r) => r.total },
      ],
      data.imports,
    ),
    table(
      SHEETS.importItems,
      [
        { header: 'ID', width: 6, kind: 'id', get: (r) => r.id },
        { header: 'ID phiếu nhập', width: 12, kind: 'id', get: (r) => r.import_id },
        { header: 'ID sản phẩm', width: 11, kind: 'id', get: (r) => r.product_id },
        { header: 'Mã vạch', width: 16, kind: 'code', get: (r) => r.barcode },
        { header: 'Tên sản phẩm', width: 30, kind: 'text', get: (r) => r.name },
        { header: 'Số lượng', width: 10, kind: 'int', get: (r) => r.quantity },
        { header: 'Giá nhập', width: 12, kind: 'money', get: (r) => r.purchase_price },
        { header: 'Thành tiền', width: 14, kind: 'money', get: (r) => r.quantity * r.purchase_price },
      ],
      data.importItems,
    ),
    table(
      SHEETS.invoices,
      [
        { header: 'ID', width: 6, kind: 'id', get: (r) => r.id },
        { header: 'Số hóa đơn', width: 15, kind: 'code', get: (r) => r.invoice_number },
        { header: 'Thời gian', width: 20, kind: 'datetime', get: (r) => r.created_at },
        { header: 'Tổng tiền', width: 13, kind: 'money', get: (r) => r.total },
        { header: 'Khách đưa', width: 13, kind: 'money', get: (r) => r.cash_received },
        { header: 'Thanh toán', width: 14, kind: 'text', get: (r) => PAYMENT_LABELS[r.payment_method] },
        { header: 'Trạng thái', width: 17, kind: 'text', get: (r) => STATUS_LABELS[r.status] },
        { header: 'Thời gian thanh toán', width: 20, kind: 'datetime', get: (r) => r.paid_at },
      ],
      data.invoices,
    ),
    table(
      SHEETS.invoiceItems,
      [
        { header: 'ID', width: 6, kind: 'id', get: (r) => r.id },
        { header: 'ID hóa đơn', width: 10, kind: 'id', get: (r) => r.invoice_id },
        { header: 'ID sản phẩm', width: 11, kind: 'id', get: (r) => r.product_id },
        { header: 'Mã vạch', width: 16, kind: 'code', get: (r) => r.barcode },
        { header: 'Tên sản phẩm', width: 30, kind: 'text', get: (r) => r.name },
        { header: 'Số lượng', width: 10, kind: 'int', get: (r) => r.quantity },
        { header: 'Giá bán', width: 12, kind: 'money', get: (r) => r.selling_price },
        { header: 'Thành tiền', width: 14, kind: 'money', get: (r) => r.quantity * r.selling_price },
      ],
      data.invoiceItems,
    ),
    table(
      SHEETS.adjustments,
      [
        { header: 'ID', width: 6, kind: 'id', get: (r) => r.id },
        { header: 'Thời gian', width: 20, kind: 'datetime', get: (r) => r.created_at },
        { header: 'ID sản phẩm', width: 11, kind: 'id', get: (r) => r.product_id },
        { header: 'Mã vạch', width: 16, kind: 'code', get: (r) => r.barcode },
        { header: 'Tên sản phẩm', width: 30, kind: 'text', get: (r) => r.name },
        { header: 'Tồn trước', width: 10, kind: 'int', get: (r) => r.old_stock },
        { header: 'Tồn sau', width: 10, kind: 'int', get: (r) => r.new_stock },
        { header: 'Chênh lệch', width: 10, kind: 'int', get: (r) => r.new_stock - r.old_stock },
        { header: 'Lý do', width: 12, kind: 'text', get: (r) => ADJUSTMENT_REASONS[r.reason] },
        { header: 'Ghi chú', width: 26, kind: 'text', get: (r) => r.note },
        { header: 'Giá nhập', width: 12, kind: 'money', get: (r) => r.purchase_price },
      ],
      data.adjustments,
    ),
  ];
}

/** File mẫu để nhập danh mục sản phẩm. */
export function buildProductTemplate(): SheetOut[] {
  const sheet = table(
    SHEETS.products,
    PRODUCT_COLS.filter((c) => c.header !== 'ID'),
    [
      { id: 0, barcode: '8931234567890', name: 'Coca Cola 330ml', purchase_price: 7000, selling_price: 10000, stock: 24 },
      { id: 0, barcode: null, name: 'Rau muống (bó)', purchase_price: 5000, selling_price: 8000, stock: 10 },
    ],
  );
  const guide: SheetOut = {
    sheet: 'Hướng dẫn',
    columns: [{ width: 90 }],
    data: [
      'Mỗi dòng ở sheet "Sản phẩm" là một sản phẩm. Giữ nguyên dòng tiêu đề.',
      'Mã vạch: có thể để trống (hàng không mã) – khi đó khớp sản phẩm theo tên.',
      'Mã vạch đã có trong kho → cập nhật tên / giá. Chưa có → tạo sản phẩm mới.',
      'Tồn kho (không bắt buộc): sản phẩm mới → tạo phiếu nhập đầu kỳ; sản phẩm đã có → điều chỉnh bằng kiểm kê.',
      'Để trống cột Tồn kho nếu chỉ muốn cập nhật giá.',
    ].map((t) => [{ value: t, type: String, wrap: true }]),
  };
  return [sheet, guide];
}

// ---------------------------------------------------------------- Đọc

export class ExcelFormatError extends Error {
  constructor(public errors: string[]) {
    super(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n… và ${errors.length - 8} lỗi khác` : ''));
    this.name = 'ExcelFormatError';
  }
}

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase();

function findSheet(sheets: SheetIn[], name: string): SheetIn | undefined {
  return sheets.find((s) => norm(s.sheet) === norm(name));
}

interface Reader {
  row: number;
  /** Lỗi của riêng dòng này */
  errors: string[];
  has: (header: string) => boolean;
  text: (header: string) => string;
  optText: (header: string) => string | null;
  int: (header: string, opts?: { min?: number }) => number;
  optInt: (header: string) => number | null;
}

/**
 * Đọc bảng theo tên cột (không phụ thuộc thứ tự cột). Thiếu cột → structural.
 * Lỗi từng ô nằm trong reader.errors (có tên sheet + số dòng Excel).
 */
function readTable(sheet: SheetIn, required: string[], structural: string[]): Reader[] {
  const [headerRow = [], ...rows] = sheet.data;
  const index = new Map(headerRow.map((h, i) => [norm(h), i]));
  const missing = required.filter((h) => !index.has(norm(h)));
  if (missing.length) {
    structural.push(`Sheet "${sheet.sheet}": thiếu cột ${missing.map((m) => `"${m}"`).join(', ')}`);
    return [];
  }
  const out: Reader[] = [];
  rows.forEach((cells, i) => {
    if (cells.every((c) => c === null || String(c).trim() === '')) return; // bỏ dòng trống
    const row = i + 2;
    const errors: string[] = [];
    const at = (h: string) => {
      const idx = index.get(norm(h));
      return idx === undefined ? null : (cells[idx] ?? null);
    };
    const where = (h: string) => `Sheet "${sheet.sheet}" dòng ${row}, cột "${h}"`;
    const asString = (v: CellValue) => (v instanceof Date ? v.toISOString() : String(v)).trim();
    /** null: ô trống · NaN: sai định dạng (đã ghi lỗi) */
    const toInt = (h: string, v: CellValue): number | null => {
      if (v === null || String(v).trim() === '') return null;
      if (typeof v === 'number') {
        if (Number.isInteger(v)) return v;
        errors.push(`${where(h)}: phải là số nguyên`);
        return NaN;
      }
      // "10.000", "10,000đ" → 10000; "-3" → -3
      const s = String(v).trim();
      const neg = s.startsWith('-');
      const digits = s.replace(/\D/g, '');
      if (!digits) {
        errors.push(`${where(h)}: “${s}” không phải số`);
        return NaN;
      }
      return (neg ? -1 : 1) * Number(digits);
    };
    out.push({
      row,
      errors,
      has: (h) => index.has(norm(h)),
      text: (h) => {
        const v = at(h);
        if (v === null || asString(v) === '') {
          errors.push(`${where(h)}: không được để trống`);
          return '';
        }
        return asString(v);
      },
      optText: (h) => {
        const v = at(h);
        return v === null || asString(v) === '' ? null : asString(v);
      },
      int: (h, opts = {}) => {
        const n = toInt(h, at(h));
        if (n === null) {
          errors.push(`${where(h)}: không được để trống`);
          return 0;
        }
        if (Number.isNaN(n)) return 0;
        if (n < (opts.min ?? 0)) {
          errors.push(`${where(h)}: không được nhỏ hơn ${opts.min ?? 0}`);
          return 0;
        }
        return n;
      },
      optInt: (h) => {
        const n = toInt(h, at(h));
        if (n === null || Number.isNaN(n)) return null;
        if (n < 0) {
          errors.push(`${where(h)}: không được âm`);
          return null;
        }
        return n;
      },
    });
  });
  return out;
}

function fromLabel<K extends string>(labels: Record<K, string>, value: string, where: string, errors: string[]): K {
  const entry = (Object.entries(labels) as [K, string][]).find(([k, l]) => norm(l) === norm(value) || norm(k) === norm(value));
  if (!entry) {
    errors.push(`${where}: “${value}” không hợp lệ (${Object.values(labels).join(' / ')})`);
    return Object.keys(labels)[0] as K;
  }
  return entry[0];
}

const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Đọc file sao lưu Excel (toàn bộ dữ liệu) để khôi phục. Ném ExcelFormatError nếu sai. */
export function parseBackupSheets(sheets: SheetIn[]): { meta: Partial<BackupMeta>; data: BackupData } {
  const errors: string[] = [];
  const info = findSheet(sheets, SHEETS.info);
  const meta: Partial<BackupMeta> = {};
  if (info) {
    const map = new Map(info.data.slice(1).map((r) => [norm(r[0]), String(r[1] ?? '').trim()]));
    if (norm(map.get(norm('Ứng dụng'))) !== norm(APP)) errors.push('Không phải file xuất từ Grocery POS (sheet "Thông tin")');
    const kind = map.get(norm('Loại dữ liệu'));
    meta.kind = norm(kind) === norm(KIND_LABELS.range) ? 'range' : 'full';
    meta.exportedAt = map.get(norm('Xuất lúc'));
    meta.schemaVersion = Number(map.get(norm('Phiên bản dữ liệu'))) || undefined;
    if (meta.kind === 'range') {
      errors.push('File này chỉ chứa dữ liệu theo khoảng thời gian (lưu trữ) – không dùng để khôi phục toàn bộ được');
    }
  } else {
    errors.push('Thiếu sheet "Thông tin" – không phải file sao lưu của Grocery POS');
  }

  const need = (name: string) => {
    const s = findSheet(sheets, name);
    if (!s) errors.push(`Thiếu sheet "${name}"`);
    return s;
  };
  const datetime = (r: Reader, h: string, sheet: string, optional = false) => {
    const v = optional ? r.optText(h) : r.text(h);
    if (v && !DATETIME.test(v)) r.errors.push(`Sheet "${sheet}" dòng ${r.row}: "${h}" phải có dạng YYYY-MM-DD HH:mm:ss`);
    return v;
  };
  const label = <K extends string>(r: Reader, labels: Record<K, string>, h: string, sheet: string) =>
    fromLabel<K>(labels, r.text(h), `Sheet "${sheet}" dòng ${r.row}, cột "${h}"`, r.errors);

  const data: BackupData = { products: [], imports: [], importItems: [], invoices: [], invoiceItems: [], adjustments: [] };
  /** Đọc bảng + gom lỗi từng dòng vào errors chung */
  const rows = <T>(sheet: SheetIn, required: string[], map: (r: Reader) => T): T[] => {
    const readers = readTable(sheet, required, errors);
    const result = readers.map(map);
    for (const r of readers) errors.push(...r.errors);
    return result;
  };

  const products = need(SHEETS.products);
  if (products) {
    data.products = rows(products, ['ID', 'Mã vạch', 'Tên sản phẩm', 'Giá nhập', 'Giá bán', 'Tồn kho'], (r) => ({
      id: r.int('ID', { min: 1 }),
      barcode: r.optText('Mã vạch'),
      name: r.text('Tên sản phẩm'),
      purchase_price: r.int('Giá nhập'),
      selling_price: r.int('Giá bán'),
      stock: r.int('Tồn kho', { min: -1e9 }),
    }));
  }
  const imports = need(SHEETS.imports);
  if (imports) {
    data.imports = rows(imports, ['ID', 'Ngày nhập', 'Tổng tiền'], (r) => ({
      id: r.int('ID', { min: 1 }),
      created_at: datetime(r, 'Ngày nhập', SHEETS.imports) ?? '',
      total: r.int('Tổng tiền'),
    }));
  }
  const importItems = need(SHEETS.importItems);
  if (importItems) {
    data.importItems = rows(importItems, ['ID', 'ID phiếu nhập', 'ID sản phẩm', 'Số lượng', 'Giá nhập'], (r) => ({
      id: r.int('ID', { min: 1 }),
      import_id: r.int('ID phiếu nhập', { min: 1 }),
      product_id: r.int('ID sản phẩm', { min: 1 }),
      quantity: r.int('Số lượng', { min: 1 }),
      purchase_price: r.int('Giá nhập'),
    }));
  }
  const invoices = need(SHEETS.invoices);
  if (invoices) {
    const cols = ['ID', 'Số hóa đơn', 'Thời gian', 'Tổng tiền', 'Khách đưa', 'Thanh toán', 'Trạng thái', 'Thời gian thanh toán'];
    data.invoices = rows(invoices, cols, (r) => ({
      id: r.int('ID', { min: 1 }),
      invoice_number: r.text('Số hóa đơn'),
      created_at: datetime(r, 'Thời gian', SHEETS.invoices) ?? '',
      total: r.int('Tổng tiền'),
      cash_received: r.int('Khách đưa'),
      payment_method: label<PaymentMethod>(r, PAYMENT_LABELS, 'Thanh toán', SHEETS.invoices),
      status: label<InvoiceStatus>(r, STATUS_LABELS, 'Trạng thái', SHEETS.invoices),
      paid_at: datetime(r, 'Thời gian thanh toán', SHEETS.invoices, true),
    }));
  }
  const invoiceItems = need(SHEETS.invoiceItems);
  if (invoiceItems) {
    data.invoiceItems = rows(invoiceItems, ['ID', 'ID hóa đơn', 'ID sản phẩm', 'Số lượng', 'Giá bán'], (r) => ({
      id: r.int('ID', { min: 1 }),
      invoice_id: r.int('ID hóa đơn', { min: 1 }),
      product_id: r.int('ID sản phẩm', { min: 1 }),
      quantity: r.int('Số lượng', { min: 1 }),
      selling_price: r.int('Giá bán'),
    }));
  }
  const adjustments = need(SHEETS.adjustments);
  if (adjustments) {
    const cols = ['ID', 'Thời gian', 'ID sản phẩm', 'Tồn trước', 'Tồn sau', 'Lý do', 'Ghi chú', 'Giá nhập'];
    data.adjustments = rows(adjustments, cols, (r) => ({
      id: r.int('ID', { min: 1 }),
      created_at: datetime(r, 'Thời gian', SHEETS.adjustments) ?? '',
      product_id: r.int('ID sản phẩm', { min: 1 }),
      old_stock: r.int('Tồn trước', { min: -1e9 }),
      new_stock: r.int('Tồn sau'),
      reason: label<AdjustmentReason>(r, ADJUSTMENT_REASONS, 'Lý do', SHEETS.adjustments),
      note: r.optText('Ghi chú'),
      purchase_price: r.int('Giá nhập'),
    }));
  }

  if (errors.length) throw new ExcelFormatError(errors);
  return { meta, data };
}

/**
 * Đọc danh mục sản phẩm: sheet "Sản phẩm" (hoặc sheet đầu tiên nếu không có).
 * Lỗi từng dòng được ghi vào row.error để hiện ở bước xem trước; lỗi cấu trúc → ExcelFormatError.
 */
export function parseProductSheet(sheets: SheetIn[]): ProductSheetRow[] {
  const sheet = findSheet(sheets, SHEETS.products) ?? sheets[0];
  if (!sheet) throw new ExcelFormatError(['File không có sheet nào']);
  const structural: string[] = [];
  const readers = readTable(sheet, ['Tên sản phẩm', 'Giá nhập', 'Giá bán'], structural);
  if (structural.length) throw new ExcelFormatError(structural);
  return readers.map((r) => {
    const barcode = r.has('Mã vạch') ? r.optText('Mã vạch') : null;
    const row: ProductSheetRow = {
      row: r.row,
      barcode: barcode ? barcode.replace(/\s/g, '') : null,
      name: r.optText('Tên sản phẩm') ?? '',
      purchasePrice: r.int('Giá nhập'),
      sellingPrice: r.int('Giá bán'),
      stock: r.has('Tồn kho') ? r.optInt('Tồn kho') : null,
    };
    // Bỏ tiền tố "Sheet ... dòng N, " vì bảng xem trước đã có cột Dòng
    if (r.errors.length) row.error = r.errors.map((e) => e.replace(/^Sheet "[^"]*" dòng \d+, /, '')).join('; ');
    return row;
  });
}
