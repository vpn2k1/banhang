import type { AdjustmentReason } from '../types';

export const ADJUSTMENT_REASONS: Record<AdjustmentReason, string> = {
  count: 'Kiểm kê',
  damaged: 'Hàng hỏng',
  expired: 'Hết hạn',
  lost: 'Mất hàng',
  other: 'Khác',
};

/** +3 / -2 / 0 */
export function formatDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : String(diff);
}
