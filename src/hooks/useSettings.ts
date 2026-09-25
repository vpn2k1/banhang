import { useCallback, useState } from 'react';
import type { StoreSettings } from '../types';

const KEY = 'grocery-pos.settings';

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'CỬA HÀNG TẠP HÓA',
  address: '',
  phone: '',
  footer: 'CẢM ƠN QUÝ KHÁCH',
  paperWidth: 80,
  printOnEnter: false,
  printerName: '',
  bankBin: '',
  bankAccount: '',
  bankAccountName: '',
};

function load(): StoreSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setState] = useState<StoreSettings>(load);
  const setSettings = useCallback((next: StoreSettings) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // bỏ qua
    }
  }, []);
  return [settings, setSettings] as const;
}
