const moneyFormatter = new Intl.NumberFormat('vi-VN');

/** 125000 → "125.000đ" */
export function formatMoney(value: number): string {
  return `${moneyFormatter.format(Math.round(value))}đ`;
}

/** 125000 → "125.000" */
export function formatNumber(value: number): string {
  return moneyFormatter.format(Math.round(value));
}

/** "125.000đ" → 125000; chỉ giữ chữ số. */
export function parseNumber(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Ngày theo giờ máy dạng 'YYYY-MM-DD'. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Thời điểm theo giờ máy dạng 'YYYY-MM-DD HH:mm:ss' (định dạng lưu trong DB). */
export function toDateTimeString(d: Date): string {
  return `${toDateString(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function today(): string {
  return toDateString(new Date());
}

/** Cộng/trừ ngày cho chuỗi 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

/**
 * Ngày được chọn ('YYYY-MM-DD') với giờ hiện tại – dùng cho ngày nhập hàng.
 * Chọn hôm nay → đúng thời điểm hiện tại.
 */
export function dateAtCurrentTime(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const now = new Date();
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
}

/** '2026-09-25' → '25/09/2026' */
export function formatDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** '2026-09-25 14:05:00' → '25/09/2026 14:05' */
export function formatDateTime(value: string): string {
  const [date, time = ''] = value.split(' ');
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y} ${time.slice(0, 5)}`.trim();
}

/** Bỏ dấu tiếng Việt + chữ thường để tìm kiếm: "Mì Hảo Hảo" → "mi hao hao". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}
