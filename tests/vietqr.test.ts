import { describe, expect, it } from 'vitest';
import { buildVietQrPayload, crc16, sanitizeContent, transferContent } from '../src/payments/vietqr';

/** Tách TLV để kiểm tra cấu trúc. */
function parse(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    out[id] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

describe('VietQR', () => {
  it('CRC16-CCITT-FALSE đúng chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('tạo payload đúng cấu trúc EMVCo + NAPAS', () => {
    const payload = buildVietQrPayload({ bin: '970436', accountNumber: '0123456789', amount: 41500, content: 'HD260925-003' });
    const top = parse(payload);
    expect(top['00']).toBe('01');
    expect(top['01']).toBe('12');
    expect(top['53']).toBe('704');
    expect(top['54']).toBe('41500');
    expect(top['58']).toBe('VN');
    const merchant = parse(top['38']);
    expect(merchant['00']).toBe('A000000727');
    expect(merchant['02']).toBe('QRIBFTTA');
    expect(parse(merchant['01'])).toEqual({ '00': '970436', '01': '0123456789' });
    expect(parse(top['62'])['08']).toBe('HD260925003');
    // CRC nằm cuối, tính trên toàn bộ phần trước kể cả "6304"
    expect(payload.slice(-8, -4)).toBe('6304');
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it('nội dung bỏ dấu / ký tự đặc biệt', () => {
    expect(sanitizeContent('Thanh toán HĐ #12')).toBe('Thanh toan HD 12');
    expect(transferContent('HD260925-003')).toBe('HD260925003');
  });

  it('báo lỗi khi thiếu thông tin', () => {
    expect(() => buildVietQrPayload({ bin: '97043', accountNumber: '0123', amount: 1000, content: '' })).toThrow(/BIN/);
    expect(() => buildVietQrPayload({ bin: '970436', accountNumber: '0123456789', amount: 0, content: '' })).toThrow(/Số tiền/);
  });
});
