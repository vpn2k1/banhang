import type { DateRange } from '../types';
import { addDays, today } from './format';

export type RangePreset = 'today' | '7d' | '30d' | 'custom';

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'custom', label: 'Khoảng thời gian' },
];

export function presetRange(preset: RangePreset, custom: DateRange): DateRange {
  const t = today();
  if (preset === 'today') return { from: t, to: t };
  if (preset === '7d') return { from: addDays(t, -6), to: t };
  if (preset === '30d') return { from: addDays(t, -29), to: t };
  return custom;
}
