/** Lỗi nghiệp vụ, message hiển thị trực tiếp cho người dùng. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new AppError(`${label} phải là số nguyên lớn hơn 0`);
}

export function assertMoney(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new AppError(`${label} không hợp lệ`);
}
