# Hướng dẫn kết nối máy in hoá đơn

Hướng dẫn cài máy in nhiệt (khổ 58mm / 80mm) để in hoá đơn từ Grocery POS.

> **Tóm tắt:** cài máy in vào máy tính như một máy in bình thường (có driver) → mở Grocery POS → ⚙️ **Cài đặt** → chọn **Khổ giấy** và **Máy in hoá đơn** → **🖨 In thử** → **Lưu**.

---

## 1. Hai cách chạy app, hai cách in

| | Bản desktop (Electron) – khuyên dùng | Bản trình duyệt (web) |
|---|---|---|
| Cách in | **In thẳng**, không hiện hộp thoại | Hiện **hộp thoại in** của trình duyệt mỗi lần in |
| Chọn máy in | Một lần trong ⚙️ Cài đặt | Chọn trong hộp thoại in (trình duyệt thường nhớ lần trước) |
| Khổ giấy | Tự đặt theo cài đặt (58/80mm), chiều cao theo độ dài hoá đơn | Phải chọn tay trong hộp thoại |
| Phù hợp | Bán hàng hằng ngày tại quầy | Dùng thử, test |

Cả hai cách in **cùng một mẫu hoá đơn**. App tự nhận biết đang chạy bản nào.

---

## 2. Chuẩn bị máy in

App in qua **máy in của hệ điều hành**, không nói chuyện trực tiếp với máy in. Vì vậy điều kiện duy nhất là: **máy in phải hiện trong danh sách máy in của Windows / macOS và in được trang thử**.

### Yêu cầu

- Máy in nhiệt khổ **58mm** hoặc **80mm** (VD: Xprinter, Epson TM, Rongta, Gprinter, HPRT…).
- **Driver của hãng** cho đúng hệ điều hành. Tải trên trang của hãng hoặc đĩa đi kèm máy.
- Kết nối: **USB** (dễ nhất), **LAN** (cáp mạng / Wi‑Fi) hoặc **Bluetooth**. Kiểu kết nối nào cũng được, miễn là hệ điều hành đã thêm được máy in.

### Windows

1. Cắm cáp USB và bật máy in.
2. Chạy file cài driver của hãng. Trong lúc cài, chọn đúng **model** và **cổng** (USB001… với máy USB; địa chỉ IP với máy LAN).
3. Mở **Settings → Bluetooth & devices → Printers & scanners**. Máy in phải có trong danh sách.
4. Bấm vào máy in → **Printer properties → Print Test Page**. Máy in ra trang thử là đã cài xong.
5. Trong **Printing preferences** của driver:
   - **Paper size**: chọn khổ giấy cuộn đúng với máy (VD `80mm x 297mm`, `72mm x Receipt`… tên gọi tuỳ hãng).
   - **Cắt giấy (Cut / Paper cut)**: nếu driver có tuỳ chọn "cắt sau mỗi tài liệu" (*Cut at end of document*) thì bật lên để máy tự cắt sau mỗi hoá đơn.

### macOS

1. Cài driver của hãng cho macOS (nếu hãng có).
2. Mở **System Settings → Printers & Scanners → Add Printer…** và chọn máy in:
   - Máy USB: hiện trong danh sách khi đã cắm và bật.
   - Máy LAN: chọn tab **IP**, nhập địa chỉ IP của máy in (in trang tự test của máy để xem IP).
3. Ở mục **Use / Driver**, chọn driver của hãng. Nếu hãng không có driver cho macOS thì máy in thường không in được hoặc in sai khổ. Lúc đó nên dùng máy Windows làm máy bán hàng.
4. In thử một trang từ ứng dụng bất kỳ để chắc máy in đã chạy.

> Máy in LAN nên được đặt **IP tĩnh** (trên router hoặc trong cài đặt máy in). Nếu IP đổi sau khi mất điện, máy tính sẽ không tìm thấy máy in nữa.

---

## 3. Cài đặt trong Grocery POS

Mở ⚙️ **Cài đặt** (góc dưới thanh bên trái):

1. **Khổ giấy in**: chọn `58mm` hoặc `80mm` đúng với cuộn giấy trong máy.
2. **Máy in hoá đơn** (chỉ có ở bản desktop):
   - Chọn tên máy in nhiệt trong danh sách, **hoặc** để *Máy in mặc định của hệ thống* nếu máy in nhiệt đã là máy mặc định.
   - Vừa cắm máy in mà chưa thấy trong danh sách → bấm **🔄** để tải lại.
3. Bấm **🖨 In thử**. App in một hoá đơn mẫu (Coca Cola, Bánh mì) theo cài đặt **đang sửa**, chưa cần Lưu.
4. In ra đúng khổ, không bị cắt chữ → bấm **Lưu**.
5. (Tuỳ chọn) Tích **Nhấn Enter khi thanh toán sẽ in hoá đơn luôn**: ở màn thanh toán, `Enter` = *Thanh toán & In*, `Ctrl+Enter` = chỉ thanh toán. Không tích thì ngược lại.

Các thông tin in trên hoá đơn cũng nằm ở đây: **tên cửa hàng, địa chỉ, số điện thoại, lời cảm ơn**, và **tài khoản ngân hàng** để in mã QR chuyển khoản (xem [README – Thanh toán chuyển khoản](../README.md#thanh-toán-chuyển-khoản-vietqr)).

### Bản trình duyệt

Bản trình duyệt không có ô chọn máy in. Mỗi lần in sẽ hiện hộp thoại in. Lần đầu, hãy chỉnh:

| Mục trong hộp thoại (Chrome / Edge) | Chọn |
|---|---|
| Máy in (Destination) | Máy in nhiệt |
| Khổ giấy (Paper size) | Khổ giấy cuộn 58/80mm của driver |
| Lề (Margins) | **Không có (None)** |
| Tỉ lệ (Scale) | **Mặc định / 100%** |
| Đầu trang và chân trang (Headers and footers) | **Tắt** (nếu không sẽ in thêm ngày giờ, địa chỉ trang web) |

---

## 4. Khi nào app in hoá đơn

| Thao tác | In gì |
|---|---|
| Thanh toán → **🖨 Thanh toán & In hóa đơn** | Hoá đơn tiền mặt (khách đưa, tiền thừa) |
| Thanh toán chuyển khoản → **🖨 Tạo QR & In phiếu** | Phiếu có mã VietQR kèm số tiền, để khách quét |
| Màn QR chuyển khoản → **🖨 In phiếu có QR** | In lại phiếu có QR |
| Thông báo *Đã thanh toán …* / *Đã nhận tiền …* → **In hoá đơn** | In hoá đơn vừa bán |
| Màn Hóa đơn → **🖨 In lại hoá đơn** | In lại hoá đơn vừa bán gần nhất |
| 🕘 Lịch sử → mở hoá đơn → **🖨 In hoá đơn** | In lại hoá đơn cũ |

Mỗi hoá đơn in trên **một đoạn giấy vừa đúng độ dài nội dung, cộng thêm khoảng 10mm để xé**. Máy nhiệt sẽ không đẩy thêm giấy trắng.

---

## 5. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Danh sách máy in trống, báo *"Máy tính chưa cài máy in nào"* | Chưa cài driver / hệ điều hành chưa thêm máy in | Làm lại [mục 2](#2-chuẩn-bị-máy-in), rồi bấm 🔄 trong Cài đặt |
| Báo *"Không tìm thấy máy in …"* hoặc *"(không tìm thấy)"* cạnh tên máy in | Máy in tắt, rút cáp, đổi cổng USB, máy LAN đổi IP | Bật máy / cắm lại cáp → 🔄 → chọn lại máy in → Lưu |
| Báo lỗi *"Không in được hoá đơn …"* | Máy in hết giấy, mở nắp, kẹt giấy, hoặc lỗi driver | Kiểm tra máy in, bấm **Cài đặt máy in** trên thông báo lỗi để **In thử** lại |
| Hoá đơn **bị cắt mất lề phải** hoặc chữ tràn | Khổ giấy trong app khác khổ giấy thật (VD app 80mm, máy 58mm) | Chọn lại **Khổ giấy in** cho đúng |
| Chữ **quá nhỏ**, hoá đơn chỉ chiếm một phần giấy | Driver đang dùng khổ A4 / Letter nên app bị thu nhỏ | Đặt **Paper size** của driver là khổ giấy cuộn (mục 2) |
| Máy in **đẩy nhiều giấy trắng** sau hoá đơn | Driver tự thêm lề / đẩy giấy | Trong Printing preferences của driver: tắt *Feed* thêm, giảm lề dưới |
| Không tự cắt giấy | Việc cắt giấy do driver quyết định | Bật *Cut at end of document* (hoặc tương tự) trong driver |
| Bản trình duyệt in thêm **ngày giờ, địa chỉ web** ở đầu/cuối | Đang bật *Headers and footers* | Tắt trong hộp thoại in |
| **Mã QR** in ra bị nhoè, app ngân hàng không quét được | Đầu in bẩn / giấy kém / in quá đậm | Vệ sinh đầu in, dùng giấy tốt; thử khổ 80mm (QR to hơn: 46mm so với 36mm) |
| Máy in hiện "Offline" trong Windows | Đổi cổng USB / máy LAN đổi IP | Cắm lại đúng cổng, hoặc sửa IP trong **Printer properties → Ports** |

---

## 6. Giới hạn hiện tại

- **Chưa thử với máy in thật.** Việc in thẳng đã chạy được về mặt kỹ thuật, nhưng mục *"thử máy in thật"* trong checklist của README vẫn chưa làm. Khi lắp đặt, hãy **In thử** trước khi bán hàng.
- App in dạng **đồ hoạ** qua driver, **chưa** gửi lệnh ESC/POS trực tiếp. Vì vậy:
  - Cắt giấy chỉ có nếu **driver** hỗ trợ.
  - **Chưa mở được ngăn kéo tiền** qua máy in.
  - Máy in không có driver cho hệ điều hành thì không dùng được.
- Cần cắt giấy hoặc mở ngăn kéo chủ động thì phải thêm một module in ESC/POS riêng (xem mục *Phase 2 – Electron* trong README).

---

## 7. Dành cho lập trình viên

Luồng in (bản desktop):

```
printInvoice(invoice)                     src/App.tsx
  → vẽ <Receipt> vào #print-root          src/components/Receipt.tsx
  → printRenderedReceipt(settings)        src/device/printer.ts
      đo chiều cao hoá đơn (px → mm) + 10mm để xé
  → window.posDevice.printReceipt(...)    electron/preload.cjs
  → ipcMain 'print:receipt'               electron/main.cjs
      kiểm tra máy in còn tồn tại
      webContents.print({ silent: true, deviceName,
                          margins: none, pageSize: { width, height } (micron) })
```

- CSS `@media print` (`src/styles.css`) ẩn toàn bộ giao diện, chỉ giữ hoá đơn trong `#print-root`.
- Bản trình duyệt: `window.posDevice` không tồn tại nên `printRenderedReceipt` gọi `window.print()`.
- Danh sách máy in: IPC `printers:list` → `webContents.getPrintersAsync()`.
- IPC chỉ nhận yêu cầu từ giao diện của app (`app://pos` hoặc dev server). Cửa sổ chạy với `contextIsolation` + `sandbox`.
- Cài đặt (khổ giấy, tên máy in) lưu trong `localStorage` key `grocery-pos.settings`.
- Chạy thử in thẳng khi phát triển: `npm run electron:dev`.
