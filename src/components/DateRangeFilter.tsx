import { useState } from 'react';
import type { DateRange } from '../types';
import { RANGE_PRESETS, presetRange, type RangePreset } from '../lib/dateRange';
import { addDays, today } from '../lib/format';

/** Bộ lọc thời gian dùng chung: Hôm nay / 7 ngày / 30 ngày / Khoảng thời gian. */
export function useDateRange(initial: RangePreset = 'today') {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [custom, setCustom] = useState<DateRange>({ from: addDays(today(), -6), to: today() });
  return { preset, setPreset, custom, setCustom, range: presetRange(preset, custom) };
}

type Props = ReturnType<typeof useDateRange>;

export function DateRangeFilter({ preset, setPreset, custom, setCustom }: Props) {
  return (
    <>
      <div className="segmented">
        {RANGE_PRESETS.map((p) => (
          <button key={p.key} type="button" className={preset === p.key ? 'active' : ''} onClick={() => setPreset(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="date-range">
          <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <span>→</span>
          <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}
    </>
  );
}
