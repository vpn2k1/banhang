import { forwardRef, type InputHTMLAttributes } from 'react';
import { formatNumber, parseNumber } from '../lib/format';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
}

/**
 * Ô nhập tiền / số lượng: hiển thị "125.000", chỉ nhận chữ số.
 * Gõ "50k" → 50.000.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onValueChange, onFocus, className, ...rest },
  ref,
) {
  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={`input-number ${className ?? ''}`}
      value={value ? formatNumber(value) : ''}
      onChange={(e) => {
        const text = e.target.value;
        const n = parseNumber(text);
        onValueChange(/k$/i.test(text.trim()) ? n * 1000 : n);
      }}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
    />
  );
});
