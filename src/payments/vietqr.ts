/**
 * Tạo mã VietQR (chuẩn EMVCo / NAPAS 247) – chạy offline, không cần gọi API.
 * App ngân hàng nào ở Việt Nam cũng quét được: điền sẵn tài khoản, số tiền, nội dung.
 *
 * Cấu trúc TLV (id 2 số + độ dài 2 số + giá trị):
 *   00 Payload format "01" · 01 "12" (QR động, có số tiền)
 *   38 Thông tin người nhận: 00 GUID NAPAS · 01 (00 BIN ngân hàng · 01 số tài khoản) · 02 "QRIBFTTA"
 *   53 "704" (VND) · 54 số tiền · 58 "VN" · 62 (08 nội dung chuyển khoản) · 63 CRC16
 */

export interface VietQrInput {
  /** Mã BIN ngân hàng (6 số), VD Vietcombank 970436 */
  bin: string;
  accountNumber: string;
  amount: number;
  /** Nội dung chuyển khoản – nên ngắn, không dấu */
  content: string;
}

const NAPAS_GUID = 'A000000727';
const SERVICE_ACCOUNT = 'QRIBFTTA';

function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Trường ${id} quá dài`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) theo EMVCo. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Bỏ dấu, chỉ giữ chữ, số, khoảng trắng – nhiều ngân hàng cắt/bỏ ký tự đặc biệt. */
export function sanitizeContent(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, 25);
}

/** Nội dung chuyển khoản cho hoá đơn: "HD260925-003" → "HD260925003" (dùng để đối soát sau này). */
export function transferContent(invoiceNumber: string): string {
  return sanitizeContent(invoiceNumber.replace(/-/g, ''));
}

export function buildVietQrPayload({ bin, accountNumber, amount, content }: VietQrInput): string {
  if (!/^\d{6}$/.test(bin)) throw new Error('Mã BIN ngân hàng phải gồm 6 chữ số');
  const account = accountNumber.replace(/\s/g, '');
  if (!/^[0-9A-Za-z]{4,19}$/.test(account)) throw new Error('Số tài khoản không hợp lệ');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Số tiền không hợp lệ');

  const beneficiary = tlv('00', bin) + tlv('01', account);
  const merchant = tlv('00', NAPAS_GUID) + tlv('01', beneficiary) + tlv('02', SERVICE_ACCOUNT);
  const note = sanitizeContent(content);

  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchant) +
    tlv('53', '704') +
    tlv('54', String(amount)) +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '') +
    '6304';
  return body + crc16(body);
}

/** Ngân hàng phổ biến (mã BIN theo NAPAS). Ngân hàng khác: nhập BIN trong Cài đặt. */
export const BANKS: { bin: string; code: string; name: string }[] = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970415', code: 'VietinBank', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'Agribank', name: 'Agribank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970440', code: 'SEAB', name: 'SeABank' },
  { bin: '970431', code: 'EIB', name: 'Eximbank' },
  { bin: '970449', code: 'LPB', name: 'LPBank' },
  { bin: '970428', code: 'NAB', name: 'Nam A Bank' },
];

export function bankName(bin: string): string {
  return BANKS.find((b) => b.bin === bin)?.name ?? `BIN ${bin}`;
}
