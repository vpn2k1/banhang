import type { DbAdapter } from './adapter';
import { createProduct } from './products';
import { createImport } from './imports';
import { confirmTransfer, createInvoice } from './invoices';
import { adjustStock } from './stock';

const SAMPLE_PRODUCTS: [barcode: string, name: string, purchase: number, selling: number, qty: number][] = [
  ['8931234567890', 'Coca Cola 330ml', 7000, 10000, 48],
  ['8934588012228', 'Pepsi 330ml', 6800, 10000, 48],
  ['8936036020012', 'Nước suối Lavie 500ml', 3500, 5000, 60],
  ['8934563138165', 'Mì Hảo Hảo tôm chua cay', 3200, 4500, 100],
  ['8934563118160', 'Mì Omachi xốt bò hầm', 6500, 8500, 40],
  ['8934673573252', 'Sữa tươi Vinamilk 180ml', 6000, 8000, 48],
  ['8935049500186', 'Bánh Chocopie hộp 12 cái', 45000, 55000, 12],
  ['8936017362414', 'Bánh quy Cosy 136g', 16000, 22000, 20],
  ['8934868143512', 'Dầu ăn Neptune 1L', 48000, 58000, 15],
  ['8934822101022', 'Nước mắm Nam Ngư 500ml', 29000, 36000, 18],
  ['8935217400157', 'Trứng gà hộp 10 quả', 28000, 35000, 20],
  ['8934588063053', 'Sting dâu 330ml', 8000, 11000, 36],
];

/** Dữ liệu mẫu: 12 sản phẩm, 1 phiếu nhập, hoá đơn 7 ngày (tiền mặt + chuyển khoản, 1 hoá đơn chờ CK), 1 lần kiểm kê. */
export function seedSampleData(db: DbAdapter): void {
  db.transaction(() => {
    const ids = SAMPLE_PRODUCTS.map(([barcode, name, purchase, selling]) =>
      createProduct(db, { barcode, name, purchase_price: purchase, selling_price: selling, stock: 0 }).id,
    );

    const importDate = new Date();
    importDate.setDate(importDate.getDate() - 7);
    createImport(
      db,
      SAMPLE_PRODUCTS.map(([, , purchase, , qty], i) => ({ productId: ids[i], quantity: qty, purchasePrice: purchase })),
      importDate,
    );

    // Vài hoá đơn rải trong 7 ngày (index sản phẩm, số lượng, hình thức)
    const sales: [daysAgo: number, lines: [number, number][], method?: 'transfer' | 'pending'][] = [
      [6, [[0, 2], [3, 5]]],
      [5, [[2, 3], [5, 4], [7, 1]]],
      [4, [[3, 10], [8, 1]]],
      [3, [[0, 4], [11, 2], [6, 1]], 'transfer'],
      [2, [[1, 2], [3, 6], [10, 1]]],
      [1, [[0, 3], [2, 6], [9, 1]]],
      [0, [[0, 2], [3, 4], [4, 2]]],
      [0, [[5, 6], [2, 2]]],
      [0, [[8, 1], [9, 1]], 'pending'],
    ];
    for (const [daysAgo, lines, method] of sales) {
      const at = new Date();
      at.setDate(at.getDate() - daysAgo);
      at.setHours(Math.min(at.getHours(), 9 + daysAgo), 15, 0);
      const items = lines.map(([i, q]) => ({ productId: ids[i], quantity: q, sellingPrice: SAMPLE_PRODUCTS[i][3] }));
      const total = items.reduce((s, it) => s + it.quantity * it.sellingPrice, 0);
      if (method) {
        const inv = createInvoice(db, items, { method: 'transfer' }, at);
        if (method === 'transfer') confirmTransfer(db, inv.id, at);
      } else {
        createInvoice(db, items, { method: 'cash', cashReceived: Math.ceil(total / 50000) * 50000 }, at);
      }
    }

    // Kiểm kê: 1 hộp trứng bị vỡ
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0);
    const eggs = ids[10];
    const eggStock = db.get<{ stock: number }>('SELECT stock FROM products WHERE id = ?', [eggs])!.stock;
    adjustStock(db, { productId: eggs, newStock: eggStock - 1, reason: 'damaged', note: 'Vỡ khi xếp hàng' }, yesterday);
  });
}
