import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Product } from '../types';
import { api } from '../db/api';
import { formatMoney } from '../lib/format';
import { isModalOpen } from '../lib/appContext';

export interface BarcodeInputHandle {
  focus: () => void;
}

interface Props {
  /** Gọi khi nhấn Enter (máy quét gửi mã + Enter). */
  onScan: (text: string) => void;
  /** Nếu có: gõ chữ sẽ gợi ý sản phẩm theo tên, chọn bằng ↑ ↓ Enter. */
  onPick?: (product: Product) => void;
  placeholder?: string;
  /** Trang đang hiển thị: tự focus và bắt phím khi con trỏ không nằm trong ô nhập nào. */
  active?: boolean;
}

const hasLetter = (s: string) => /\p{L}/u.test(s);

export const BarcodeInput = forwardRef<BarcodeInputHandle, Props>(function BarcodeInput(
  { onScan, onPick, placeholder, active = true },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [highlight, setHighlight] = useState(0);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  // Tự focus khi trang được mở
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Máy quét gõ khi con trỏ đang ở ngoài → đưa phím về ô mã vạch
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || isModalOpen()) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  // Gợi ý theo tên
  useEffect(() => {
    const q = value.trim();
    if (!onPick || q.length < 2 || !hasLetter(q)) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const list = await api.products.search(q, 8);
      if (!cancelled) {
        setSuggestions(list);
        setHighlight(0);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, onPick]);

  const reset = () => {
    setValue('');
    setSuggestions([]);
  };

  const pick = (p: Product) => {
    reset();
    onPick?.(p);
    inputRef.current?.focus();
  };

  return (
    <div className="barcode-input">
      <span className="barcode-icon" aria-hidden>
        ▮▯▮▮▯▮
      </span>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder ?? 'Quét mã vạch hoặc gõ mã rồi nhấn Enter'}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && suggestions.length) {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp' && suggestions.length) {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Escape' && value) {
            e.stopPropagation();
            reset();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const text = value.trim();
            if (!text) return;
            if (suggestions.length && hasLetter(text)) {
              pick(suggestions[highlight]);
            } else {
              reset();
              onScan(text);
            }
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              className={i === highlight ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className="suggestion-name">{p.name}</span>
              <span className="muted">{p.barcode ?? 'không mã'}</span>
              <span>{formatMoney(p.selling_price)}</span>
              <span className="muted">tồn {p.stock}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
