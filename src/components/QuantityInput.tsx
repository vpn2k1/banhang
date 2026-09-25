interface Props {
  value: number;
  onChange: (value: number) => void;
  /** Tồn kho hiện có – tô đỏ nếu vượt quá */
  max?: number;
}

/** Ô số lượng có nút − / +. */
export function QuantityInput({ value, onChange, max }: Props) {
  const over = max !== undefined && value > max;
  return (
    <div className={`qty ${over ? 'qty-over' : ''}`} title={over ? `Vượt tồn kho (còn ${max})` : undefined}>
      <button type="button" tabIndex={-1} onClick={() => onChange(Math.max(1, value - 1))} aria-label="Giảm">
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          onChange(Math.max(1, Math.min(n || 1, 99999)));
        }}
        onFocus={(e) => e.target.select()}
        aria-label="Số lượng"
      />
      <button type="button" tabIndex={-1} onClick={() => onChange(value + 1)} aria-label="Tăng">
        +
      </button>
    </div>
  );
}
