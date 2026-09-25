# Grocery POS MVP

Ứng dụng quản lý bán hàng đơn giản cho cửa hàng tạp hoá. Chạy trên máy tính (Electron – Phase 2), phát triển và test online trước bằng **React + TypeScript + Vite + SQLite WASM**.

- Dễ dùng, ít thao tác: **Quét mã → nhập số lượng → thanh toán → in hoá đơn**
- Không cần server, dữ liệu lưu local
- Máy quét mã vạch USB (HID keyboard) – không cần SDK
- In hoá đơn khổ 58mm / 80mm

## Chức năng

| Phím | Chức năng | Mô tả |
| --- | --- | --- |
| `F1` | 📥 Nhập hàng | Danh sách form (react-hook-form): mỗi lần quét thêm 1 dòng lên đầu. Quét được → điền sẵn, mã vạch khoá. Không tìm thấy / không quét được → dòng nhập tay. Chọn **ngày nhập** (mặc định hôm nay, không cho ngày tương lai) → Lưu phiếu: tạo SP mới, cập nhật tên / giá, cộng tồn kho (1 transaction). Đây là nơi duy nhất thêm sản phẩm mới |
| `F2` | 🧾 Hóa đơn | Quét mã → thêm vào hoá đơn (quét lại cùng mã → tăng SL). `F9` thanh toán: **tiền mặt** (khách đưa / tiền thừa) hoặc **chuyển khoản** (mã VietQR, xem bên dưới) → lưu hoá đơn → trừ kho → in |
| `F3` | 📦 Kho | Tìm theo tên (không dấu) hoặc quét mã, lọc hàng sắp hết. **Sửa**: chỉ mã vạch / tên / giá. **Kiểm kê**: nhập số thực tế + lý do (Kiểm kê, Hỏng, Hết hạn, Mất, Khác) → điều chỉnh tồn và lưu lịch sử. Quét mã có sẵn → mở Kiểm kê; mã chưa có / **+ Thêm sản phẩm** → chuyển sang Nhập hàng |
| `F4` | 📊 Thống kê | Doanh thu, số hoá đơn, số SP đã bán, giá trị nhập, hao hụt kho (kiểm kê giảm × giá nhập), SP bán chạy. Lọc: hôm nay, 7 ngày, 30 ngày, khoảng thời gian |
| `F5` | 🕘 Lịch sử | 3 tab Phiếu nhập / Hóa đơn / Kiểm kê, lọc theo thời gian. Bấm để xem chi tiết phiếu nhập, xem / in lại hoá đơn |

Mẹo nhập liệu:

- `3*8931234567890` + Enter → thêm 3 sản phẩm (dùng được cả ở Nhập hàng)
- Nhập hàng: `Enter` trong một ô của dòng → quay lại ô quét; nhập tay mã đã có trong kho → tự điền thông tin và khoá mã
- Gõ tên sản phẩm (không cần dấu, VD `mi hao`) → chọn bằng `↑ ↓ Enter` – cho hàng không có mã vạch
- Ô tiền: gõ `200k` = 200.000đ
- Máy quét gõ khi con trỏ đang ở ngoài ô nhập → tự đưa về ô mã vạch
- ⚙️ **Cài đặt**: tên cửa hàng, địa chỉ, SĐT, lời cảm ơn, khổ giấy, Enter = thanh toán & in

## Dữ liệu & Excel (📁 ở thanh bên)

| Tab | Dùng để |
| --- | --- |
| ⬇ **Xuất Excel** | **Toàn bộ dữ liệu** (sao lưu, khôi phục lại được) hoặc **theo khoảng thời gian** (lưu trữ / báo cáo theo kỳ). File `.xlsx` gồm các sheet: Thông tin, Sản phẩm, Phiếu nhập, Chi tiết nhập, Hóa đơn, Chi tiết hóa đơn, Kiểm kê |
| 📦 **Nhập danh mục sản phẩm** | Khai báo nhiều sản phẩm / cập nhật giá hàng loạt. Cột: Mã vạch, Tên sản phẩm, Giá nhập, Giá bán, Tồn kho (không bắt buộc). Có file mẫu. **Xem trước** từng dòng (thêm mới / cập nhật / lỗi) trước khi áp dụng. Tồn kho: SP mới → phiếu nhập đầu kỳ; SP đã có → điều chỉnh bằng kiểm kê (có lịch sử). Dòng lỗi bị bỏ qua |
| ♻️ **Khôi phục toàn bộ** | Thay toàn bộ dữ liệu bằng file "Toàn bộ dữ liệu" đã xuất. Kiểm tra cấu trúc, kiểu dữ liệu, liên kết giữa các sheet trước khi ghi (báo lỗi theo sheet + dòng); ghi trong một transaction. Mặc định tự tải bản sao lưu dữ liệu hiện tại trước |

- Mã vạch ghi dạng chữ để Excel không đổi thành số (giữ số 0 đầu). Thời gian dạng `YYYY-MM-DD HH:mm:ss`.
- Thư viện: `write-excel-file` + `read-excel-file` (không dùng `xlsx` trên npm vì bản 0.18.5 có lỗ hổng đã biết). Nạp khi mở modal, không làm chậm lần mở app.
- Code: `src/db/backup.ts`, `src/db/productImport.ts` (nghiệp vụ), `src/excel/workbook.ts` (bảng ↔ dữ liệu), `src/excel/io.ts` (đọc / ghi .xlsx).

## Thanh toán chuyển khoản (VietQR)

1. ⚙️ Cài đặt → **Nhận chuyển khoản**: chọn ngân hàng (hoặc nhập mã BIN), số tài khoản, tên chủ tài khoản. Có mã QR 10.000đ để **quét thử** bằng app ngân hàng (kiểm tra tên chủ tài khoản hiện đúng, không cần chuyển tiền).
2. Thanh toán (`F9`) → **🏦 Chuyển khoản** (`F7`) → Tạo mã QR: hoá đơn lưu ở trạng thái **Chờ chuyển khoản**, hàng đã trừ kho.
3. Màn QR hiện mã to cho khách quét (có thể **in phiếu có QR**). Mã điền sẵn tài khoản, số tiền, nội dung = số hoá đơn (VD `HD260925004`).
4. Người bán xem thông báo tiền về trên app ngân hàng → **✅ Đã nhận tiền** → hoá đơn thành *Đã thanh toán*. Hoặc **Để sau**: hoá đơn nằm ở khung *⏳ Chờ chuyển khoản* bên phải màn Hóa đơn và trong 🕘 Lịch sử. Khách không trả → **Huỷ hoá đơn** (hoàn lại tồn kho).

- Mã VietQR (chuẩn EMVCo / NAPAS 247) được tạo **offline** trong `src/payments/vietqr.ts`, không gọi API.
- Thống kê: doanh thu chỉ tính hoá đơn đã thanh toán (tách tiền mặt / chuyển khoản); hoá đơn chờ chuyển khoản hiện riêng; hoá đơn đã huỷ không tính.
- **Tự kiểm tra tiền về** (SePay, Casso, PayOS...): chưa bật. Chỗ cắm là `src/payments/transferWatcher.ts` – cài một `TransferWatcher` (gọi API dịch vụ từ Electron main process để giữ API key) thì màn QR tự hỏi mỗi 5 giây và tự xác nhận. Đối soát theo số tiền + nội dung chuyển khoản.

## Chạy thử

Yêu cầu Node.js ≥ 20.19.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # test repository với SQLite WASM thật (Node)
npm run build     # typecheck + build ra dist/
```

Lần đầu mở: vào **📦 Kho → Tạo dữ liệu mẫu để thử** (12 sản phẩm, 1 phiếu nhập, 8 hoá đơn trong 7 ngày).

Máy quét được giả lập bằng cách gõ mã + Enter, ví dụ `8931234567890` (Coca Cola 330ml).

### Bản desktop (Electron)

```bash
npm run electron:dev     # Vite dev server + cửa sổ Electron (hot reload)
npm run electron:start   # build rồi chạy như bản thật
npm run dist:mac         # đóng gói release/GroceryPOS-x.y.z.dmg
npm run dist:win         # đóng gói installer Windows (NSIS) – nên chạy trên máy Windows
```

- **In thẳng, không hộp thoại**: ⚙️ Cài đặt → *Máy in hoá đơn* chọn máy in (hoặc máy in mặc định của hệ thống) → **🖨 In thử**. Khổ giấy = 58/80mm theo cài đặt, chiều cao tự tính theo độ dài hoá đơn (+10mm để xé) nên máy in nhiệt không đẩy giấy thừa. Máy in tắt / rút cáp → thông báo lỗi kèm nút mở Cài đặt.
- Máy in cần được **cài driver trên hệ điều hành** (hiện trong danh sách máy in của macOS / Windows).
- Bản trình duyệt vẫn in bằng hộp thoại của trình duyệt như cũ (`src/device/printer.ts` tự chọn).
- Giao diện được phục vụ qua giao thức `app://pos` (không dùng `file://`) để SQLite WASM tải được `.wasm` và dữ liệu IndexedDB giữ qua các lần mở app. Cửa sổ chạy với `contextIsolation` + `sandbox`; giao diện chỉ gọi được `window.posDevice` (danh sách máy in, in hoá đơn).
- Chưa ký số (code signing): lần đầu mở trên macOS cần chuột phải → *Open*; Windows SmartScreen có thể cảnh báo.

### StackBlitz

Import repo vào StackBlitz (hoặc kéo thả thư mục) là chạy được: chỉ dùng SQLite WASM, không có native addon, không cần header COOP/COEP.

### Công cụ test (📊 Thống kê → 🛠 Dữ liệu & công cụ test)

- Chạy câu lệnh SQL trực tiếp (`Ctrl+Enter`)
- Sao lưu / khôi phục file `.sqlite` (mở được bằng DB Browser for SQLite, dùng lại được khi chuyển sang Electron)
- Tạo dữ liệu mẫu, xoá toàn bộ dữ liệu

## Kiến trúc

```text
Page (React)
   ↓
api            src/db/api.ts          – async, UI chỉ gọi lớp này
   ↓
repository     products / imports / invoices / statistics.ts
   ↓
DbAdapter      src/db/adapter.ts      – run / all / get / exec / transaction
   ↓
SQLite WASM (online)   |   better-sqlite3 (Electron)
```

- **Repository** chỉ phụ thuộc `DbAdapter` (đồng bộ – giống API của cả SQLite WASM oo1 và better-sqlite3), nên dùng lại nguyên vẹn ở Electron main process.
- **api** là async để khi chạy Electron có thể thay bằng bản gọi IPC mà không sửa UI (`window.posApi`).
- **Online**: SQLite chạy in-memory trên main thread; sau mỗi thao tác ghi, file database được export và lưu vào **IndexedDB** → tải lại trang không mất dữ liệu.
- Tiền lưu dạng số nguyên VND; thời gian lưu `YYYY-MM-DD HH:mm:ss` theo giờ máy.
- Tồn kho được phép âm (bán trước khi kịp nhập phiếu) – hiển thị cảnh báo màu.
- Tồn kho chỉ thay đổi qua 3 đường, đều có lịch sử: phiếu nhập (+), hoá đơn (−), kiểm kê (đặt = số thực tế).

### Database

```text
products       id, barcode (UNIQUE, có thể NULL), name, purchase_price, selling_price, stock
imports        id, created_at, total
import_items   id, import_id, product_id, quantity, purchase_price
invoices       id, invoice_number (HD260925-001), created_at, total, cash_received
invoice_items  id, invoice_id, product_id, quantity, selling_price
stock_adjustments  id, product_id, created_at, old_stock, new_stock, reason, note, purchase_price
invoices (+)   payment_method ('cash' | 'transfer'), status ('pending' | 'paid' | 'cancelled'), paid_at
```

Thêm so với thiết kế ban đầu: `invoices.cash_received` (in lại hoá đơn có "Khách đưa / Tiền thừa") và bảng `stock_adjustments` (lịch sử kiểm kê; lưu giá nhập lúc điều chỉnh để tính giá trị hao hụt). `imports.created_at` là ngày nhập người dùng chọn. Schema quản lý bằng migration + `PRAGMA user_version` (`src/db/schema.ts`).

### Cấu trúc thư mục

```text
src/
├── pages/        ImportPage, InvoicePage, InventoryPage, StatisticsPage, HistoryPage
├── components/   BarcodeInput, ImportRow, InvoiceTable, PaymentModal, ProductRow,
│                 ProductFormModal, StockCountModal, ImportViewModal, Receipt,
│                 InvoiceViewModal, DateRangeFilter, SettingsModal, DevTools, ...
├── db/
│   ├── adapter.ts     interface DbAdapter
│   ├── wasm.ts        DbAdapter cho SQLite WASM
│   ├── database.ts    khởi tạo SQLite WASM trên trình duyệt + lưu IndexedDB
│   ├── schema.ts      migration
│   ├── products.ts    imports.ts    invoices.ts    stock.ts    statistics.ts   (repository)
│   ├── backup.ts      xuất / khôi phục toàn bộ    productImport.ts  nhập danh mục sản phẩm
│   ├── seed.ts        dữ liệu mẫu
│   └── api.ts         lớp async cho UI
├── device/       printer.ts (in hoá đơn: Electron in thẳng / trình duyệt hộp thoại)
├── excel/        workbook.ts (dữ liệu ↔ sheet, kiểm tra từng ô), io.ts (đọc / ghi .xlsx)
├── payments/     vietqr.ts (tạo mã VietQR), invoiceQr.ts, transferWatcher.ts (chỗ cắm kiểm tra tự động)
├── lib/          format tiền/ngày, parse mã quét, IndexedDB
├── hooks/        useSettings
├── types/
├── App.tsx
└── main.tsx
electron/         main.cjs (cửa sổ, giao thức app://, in thẳng), preload.cjs (window.posDevice)
tests/            test repository, VietQR, Excel (ghi / đọc file .xlsx thật)
```

## Phase 2 – Electron

Đã có: cửa sổ Electron (`electron/main.cjs`, `electron/preload.cjs`), in thẳng qua `webContents.print({ silent: true })`, đóng gói bằng electron-builder. Database hiện **vẫn là SQLite WASM + IndexedDB** bên trong Electron.

Bước tiếp theo – chuyển sang SQLite native (file `.sqlite` trong thư mục userData, dễ sao lưu hơn):

```bash
npm i better-sqlite3
```

1. **Adapter native** (`electron/nativeAdapter.ts`) – cùng interface với `src/db/wasm.ts`:

   ```ts
   import Database from 'better-sqlite3';
   import type { DbAdapter } from '../src/db/adapter';

   export function createNativeAdapter(file: string): DbAdapter {
     const db = new Database(file);
     db.pragma('journal_mode = WAL');
     return {
       run: (sql, p = []) => {
         const r = db.prepare(sql).run(...p);
         return { changes: r.changes, lastInsertRowid: Number(r.lastInsertRowid) };
       },
       all: (sql, p = []) => db.prepare(sql).all(...p) as never,
       get: (sql, p = []) => db.prepare(sql).get(...p) as never,
       exec: (sql) => void db.exec(sql),
       transaction: (fn) => db.transaction(fn)(),
     };
   }
   ```

2. **Main process**: mở `app.getPath('userData')/grocery-pos.sqlite`, gọi `migrate(adapter)`, đăng ký `ipcMain.handle('pos', (_, path, args) => ...)` gọi các repository.
3. **Preload**: `contextBridge.exposeInMainWorld('posApi', ...)` với cùng interface `PosApi` → `src/db/api.ts` tự dùng `window.posApi` thay cho bản WASM. UI không đổi.
4. **Đóng gói**: `better-sqlite3` cần `electron-builder install-app-deps` để build lại theo phiên bản Electron.

Máy quét USB: cắm vào là dùng được (HID keyboard). Nếu sau này cần cắt giấy / mở ngăn kéo tiền: thêm module in ESC/POS riêng.

Dữ liệu test online có thể mang sang Electron: **Sao lưu (.sqlite)** rồi đặt file vào thư mục `userData`.

## Nguyên tắc MVP

Không có: server, cloud database, đăng nhập, multi-user, nhiều cửa hàng, ERP, CRM, API phức tạp.

## Checklist

- [x] Nhập hàng: quét mã, thêm sản phẩm mới, giá nhập, số lượng, tăng tồn kho
- [x] Hoá đơn: quét mã, hiển thị SP, số lượng, thành tiền, tổng tiền, tiền thừa, lưu, trừ kho, in
- [x] Kho: tìm, quét mã, xem tồn, sửa sản phẩm, kiểm kê có lý do + lịch sử
- [x] Lịch sử: phiếu nhập, hoá đơn, kiểm kê
- [x] Chuyển khoản VietQR: QR trên màn hình + in, chờ / xác nhận thủ công / huỷ
- [ ] Tự kiểm tra tiền về (SePay / Casso / PayOS)
- [x] Excel: xuất toàn bộ / theo kỳ, nhập danh mục sản phẩm, khôi phục toàn bộ
- [x] Thống kê: doanh thu, số hoá đơn, SL bán, giá trị nhập, SP bán chạy, lọc thời gian
- [x] Electron: chạy Electron, in thẳng không hộp thoại (chọn máy in, in thử), đóng gói electron-builder
- [ ] Electron: SQLite native (better-sqlite3), thử máy quét thật, thử máy in thật, ký số installer
