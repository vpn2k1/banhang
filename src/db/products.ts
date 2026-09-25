import type { DbAdapter } from './adapter';
import type { Product, ProductInfoInput, ProductInput } from '../types';
import { normalizeText } from '../lib/format';
import { AppError, assertMoney } from './errors';

const COLUMNS = 'id, barcode, name, purchase_price, selling_price, stock';

export function listProducts(db: DbAdapter): Product[] {
  return db.all<Product>(`SELECT ${COLUMNS} FROM products ORDER BY name COLLATE NOCASE`);
}

export function getProduct(db: DbAdapter, id: number): Product | undefined {
  return db.get<Product>(`SELECT ${COLUMNS} FROM products WHERE id = ?`, [id]);
}

export function findProductByBarcode(db: DbAdapter, barcode: string): Product | undefined {
  const code = barcode.trim();
  if (!code) return undefined;
  return db.get<Product>(`SELECT ${COLUMNS} FROM products WHERE barcode = ?`, [code]);
}

/**
 * Tìm theo mã vạch hoặc tên, không phân biệt hoa thường / dấu ("mi hao" khớp "Mì Hảo Hảo").
 * Lọc bằng JS vì LIKE của SQLite không xử lý dấu tiếng Việt; số lượng hàng tạp hoá đủ nhỏ.
 */
export function searchProducts(db: DbAdapter, query: string, limit = 50): Product[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  const all = listProducts(db);
  if (words.length === 0) return all.slice(0, limit);
  return all
    .filter((p) => {
      const haystack = `${normalizeText(p.name)} ${p.barcode ?? ''}`;
      return words.every((w) => haystack.includes(w));
    })
    .slice(0, limit);
}

function validate<T extends ProductInfoInput>(input: T): T {
  const name = input.name.trim();
  if (!name) throw new AppError('Vui lòng nhập tên sản phẩm');
  assertMoney(input.purchase_price, 'Giá nhập');
  assertMoney(input.selling_price, 'Giá bán');
  const barcode = input.barcode?.trim() || null;
  return { ...input, name, barcode };
}

function ensureBarcodeFree(db: DbAdapter, barcode: string | null, exceptId?: number): void {
  if (!barcode) return;
  const other = findProductByBarcode(db, barcode);
  if (other && other.id !== exceptId) {
    throw new AppError(`Mã vạch ${barcode} đã thuộc về "${other.name}"`);
  }
}

/** Chỉ dùng nội bộ khi lưu phiếu nhập (stock = 0, phiếu nhập sẽ cộng) và tạo dữ liệu mẫu. */
export function createProduct(db: DbAdapter, input: ProductInput): Product {
  const p = validate(input);
  if (!Number.isInteger(p.stock)) throw new AppError('Tồn kho phải là số nguyên');
  ensureBarcodeFree(db, p.barcode);
  const { lastInsertRowid } = db.run(
    `INSERT INTO products (barcode, name, purchase_price, selling_price, stock) VALUES (?, ?, ?, ?, ?)`,
    [p.barcode, p.name, p.purchase_price, p.selling_price, p.stock],
  );
  return getProduct(db, lastInsertRowid)!;
}

/** Sửa mã vạch, tên, giá. Không sửa tồn kho – dùng Kiểm kê (stock.ts). */
export function updateProduct(db: DbAdapter, id: number, input: ProductInfoInput): Product {
  const p = validate(input);
  if (!getProduct(db, id)) throw new AppError('Không tìm thấy sản phẩm');
  ensureBarcodeFree(db, p.barcode, id);
  db.run(`UPDATE products SET barcode = ?, name = ?, purchase_price = ?, selling_price = ? WHERE id = ?`, [
    p.barcode,
    p.name,
    p.purchase_price,
    p.selling_price,
    id,
  ]);
  return getProduct(db, id)!;
}

export function countProducts(db: DbAdapter): number {
  return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM products')?.n ?? 0;
}
