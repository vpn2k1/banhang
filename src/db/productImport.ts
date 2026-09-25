import type { DbAdapter } from './adapter';
import type { Product } from '../types';
import { normalizeText } from '../lib/format';
import { createProduct } from './products';
import { createImport } from './imports';
import { adjustStock } from './stock';
import { AppError } from './errors';

/** Một dòng sản phẩm đọc từ Excel (đã chuẩn hoá kiểu). error: lỗi đọc dữ liệu của dòng. */
export interface ProductSheetRow {
  row: number;
  barcode: string | null;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  /** null: file không có / để trống cột Tồn kho → không đụng tồn kho */
  stock: number | null;
  error?: string;
}

export type ProductImportAction = 'create' | 'update' | 'unchanged' | 'error';

export interface ProductImportItem {
  row: number;
  action: ProductImportAction;
  name: string;
  barcode: string | null;
  productId?: number;
  /** Mô tả thay đổi, VD "Giá bán 10.000 → 11.000" */
  changes: string[];
  error?: string;
}

export interface ProductImportPlan {
  items: ProductImportItem[];
  counts: Record<ProductImportAction, number>;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

function findExisting(products: Product[], row: ProductSheetRow): Product | 'ambiguous' | undefined {
  if (row.barcode) return products.find((p) => p.barcode === row.barcode);
  // Hàng không có mã vạch: khớp theo tên (không phân biệt hoa thường / dấu cách thừa)
  const name = normalizeText(row.name);
  const matches = products.filter((p) => !p.barcode && normalizeText(p.name) === name);
  if (matches.length > 1) return 'ambiguous';
  return matches[0];
}

/**
 * Xem trước khi nhập danh mục sản phẩm từ Excel:
 * - Mã vạch (hoặc tên, nếu không có mã) chưa có → tạo mới. Tồn kho > 0 → đưa vào 1 phiếu nhập đầu kỳ.
 * - Đã có → cập nhật tên / giá. Tồn kho khác → điều chỉnh bằng kiểm kê (có lịch sử).
 */
export function planProductImport(db: DbAdapter, rows: ProductSheetRow[]): ProductImportPlan {
  const products = db.all<Product>('SELECT id, barcode, name, purchase_price, selling_price, stock FROM products');
  const seenBarcodes = new Map<string, number>();
  const seenNames = new Map<string, number>();

  const items = rows.map((r): ProductImportItem => {
    const base = { row: r.row, name: r.name, barcode: r.barcode, changes: [] as string[] };
    const fail = (error: string): ProductImportItem => ({ ...base, action: 'error', error });
    if (r.error) return fail(r.error);
    if (!r.name.trim()) return fail('Thiếu tên sản phẩm');

    const key = r.barcode ?? `name:${normalizeText(r.name)}`;
    const seen = r.barcode ? seenBarcodes : seenNames;
    if (seen.has(key)) return fail(`Trùng với dòng ${seen.get(key)} trong file`);
    seen.set(key, r.row);

    const existing = findExisting(products, r);
    if (existing === 'ambiguous') return fail('Có nhiều sản phẩm không mã vạch cùng tên – sửa trong Kho trước');
    if (!existing) {
      const changes = [`Giá nhập ${fmt(r.purchasePrice)} · Giá bán ${fmt(r.sellingPrice)}`];
      if (r.stock && r.stock > 0) changes.push(`Tồn kho đầu kỳ ${r.stock} (phiếu nhập)`);
      return { ...base, action: 'create', changes };
    }
    const changes: string[] = [];
    if (existing.name !== r.name.trim()) changes.push(`Tên “${existing.name}” → “${r.name.trim()}”`);
    if (existing.purchase_price !== r.purchasePrice) changes.push(`Giá nhập ${fmt(existing.purchase_price)} → ${fmt(r.purchasePrice)}`);
    if (existing.selling_price !== r.sellingPrice) changes.push(`Giá bán ${fmt(existing.selling_price)} → ${fmt(r.sellingPrice)}`);
    if (r.stock !== null && r.stock !== existing.stock) changes.push(`Tồn kho ${existing.stock} → ${r.stock} (kiểm kê)`);
    return { ...base, productId: existing.id, action: changes.length ? 'update' : 'unchanged', changes };
  });

  const counts: Record<ProductImportAction, number> = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const it of items) counts[it.action]++;
  return { items, counts };
}

export interface ProductImportResult {
  created: number;
  updated: number;
  skipped: number;
  importId: number | null;
  adjustments: number;
}

/** Áp dụng: bỏ qua dòng lỗi, phần còn lại trong một transaction. */
export function applyProductImport(db: DbAdapter, rows: ProductSheetRow[], now = new Date()): ProductImportResult {
  const plan = planProductImport(db, rows);
  const byRow = new Map(rows.map((r) => [r.row, r]));
  return db.transaction(() => {
    const opening: { productId: number; quantity: number; purchasePrice: number }[] = [];
    let created = 0;
    let updated = 0;
    let adjustments = 0;
    for (const item of plan.items) {
      const r = byRow.get(item.row)!;
      try {
        if (item.action === 'create') {
          const p = createProduct(db, {
            barcode: r.barcode,
            name: r.name,
            purchase_price: r.purchasePrice,
            selling_price: r.sellingPrice,
            stock: 0,
          });
          if (r.stock && r.stock > 0) opening.push({ productId: p.id, quantity: r.stock, purchasePrice: r.purchasePrice });
          created++;
        } else if (item.action === 'update' && item.productId) {
          db.run('UPDATE products SET name = ?, purchase_price = ?, selling_price = ? WHERE id = ?', [
            r.name.trim(),
            r.purchasePrice,
            r.sellingPrice,
            item.productId,
          ]);
          const current = db.get<{ stock: number }>('SELECT stock FROM products WHERE id = ?', [item.productId])!.stock;
          if (r.stock !== null && r.stock !== current) {
            adjustStock(db, { productId: item.productId, newStock: r.stock, reason: 'count', note: 'Nhập từ Excel' }, now);
            adjustments++;
          }
          updated++;
        }
      } catch (err) {
        throw new AppError(`Dòng ${item.row}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const importId = opening.length ? createImport(db, opening, now).id : null;
    return { created, updated, skipped: plan.counts.error, importId, adjustments };
  });
}
