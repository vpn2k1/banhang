import { useState } from 'react';
import type { PaperWidth, StoreSettings } from '../types';
import { Modal } from './Modal';
import { QrCode } from './QrCode';
import { BANKS, buildVietQrPayload } from '../payments/vietqr';
import { PrinterSettings } from './PrinterSettings';

interface Props {
  settings: StoreSettings;
  onClose: () => void;
  onSave: (settings: StoreSettings) => void;
}

const OTHER = 'other';

export function SettingsModal({ settings, onClose, onSave }: Props) {
  const [form, setForm] = useState(settings);
  const [error, setError] = useState('');
  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const knownBank = BANKS.some((b) => b.bin === form.bankBin);
  const [bankChoice, setBankChoice] = useState(form.bankBin === '' ? '' : knownBank ? form.bankBin : OTHER);

  // QR quét thử 10.000đ để kiểm tra thông tin tài khoản
  let testQr = '';
  if (form.bankBin && form.bankAccount) {
    try {
      testQr = buildVietQrPayload({ bin: form.bankBin, accountNumber: form.bankAccount, amount: 10000, content: 'TEST GROCERY POS' });
    } catch {
      testQr = '';
    }
  }

  const submit = () => {
    const hasBank = form.bankBin !== '' || form.bankAccount.trim() !== '';
    if (hasBank && !/^\d{6}$/.test(form.bankBin)) return setError('Mã BIN ngân hàng phải gồm 6 chữ số');
    if (hasBank && !/^[0-9A-Za-z]{4,19}$/.test(form.bankAccount.replace(/\s/g, ''))) return setError('Số tài khoản không hợp lệ');
    onSave({ ...form, bankAccount: form.bankAccount.replace(/\s/g, '') });
  };

  return (
    <Modal
      title="Cài đặt cửa hàng & hoá đơn"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" form="settings-form" className="btn btn-primary">
            Lưu
          </button>
        </>
      }
    >
      <form
        id="settings-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>
          Tên cửa hàng (in trên hoá đơn)
          <input value={form.storeName} onChange={(e) => set('storeName', e.target.value)} autoFocus />
        </label>
        <label>
          Địa chỉ
          <input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label>
          Số điện thoại
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label>
          Lời cảm ơn cuối hoá đơn
          <input value={form.footer} onChange={(e) => set('footer', e.target.value)} />
        </label>
        <label>
          Khổ giấy in
          <select value={form.paperWidth} onChange={(e) => set('paperWidth', Number(e.target.value) as PaperWidth)}>
            <option value={58}>58mm</option>
            <option value={80}>80mm</option>
          </select>
        </label>
        <PrinterSettings form={form} onPrinterChange={(name) => set('printerName', name)} />
        <label className="checkbox">
          <input type="checkbox" checked={form.printOnEnter} onChange={(e) => set('printOnEnter', e.target.checked)} />
          Nhấn Enter khi thanh toán sẽ in hoá đơn luôn
        </label>

        <h3 className="form-section">🏦 Nhận chuyển khoản (VietQR)</h3>
        <label>
          Ngân hàng
          <select
            value={bankChoice}
            onChange={(e) => {
              setBankChoice(e.target.value);
              set('bankBin', e.target.value === OTHER ? '' : e.target.value);
            }}
          >
            <option value="">— Không dùng chuyển khoản —</option>
            {BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>
                {b.name}
              </option>
            ))}
            <option value={OTHER}>Ngân hàng khác (nhập mã BIN)</option>
          </select>
        </label>
        {bankChoice === OTHER && (
          <label>
            Mã BIN ngân hàng (6 số, theo NAPAS)
            <input
              value={form.bankBin}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => set('bankBin', e.target.value.replace(/\D/g, ''))}
              placeholder="VD: 970436"
            />
          </label>
        )}
        {bankChoice !== '' && (
          <>
            <div className="form-row">
              <label>
                Số tài khoản
                <input value={form.bankAccount} inputMode="numeric" onChange={(e) => set('bankAccount', e.target.value)} />
              </label>
              <label>
                Tên chủ tài khoản
                <input
                  value={form.bankAccountName}
                  onChange={(e) => set('bankAccountName', e.target.value)}
                  placeholder="NGUYEN VAN A"
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.qrOnEveryReceipt}
                onChange={(e) => set('qrOnEveryReceipt', e.target.checked)}
              />
              In mã QR tài khoản trên mọi hoá đơn
            </label>
            <p className="muted small">
              Hoá đơn tiền mặt / đã thanh toán in QR không kèm số tiền (khách tự nhập). Hoá đơn chờ chuyển khoản luôn in QR
              có sẵn số tiền.
            </p>
            {testQr && (
              <div className="test-qr">
                <QrCode value={testQr} size="120px" />
                <p className="muted small">
                  Quét thử bằng app ngân hàng: phải hiện đúng <strong>tên chủ tài khoản</strong> và số tiền 10.000đ. Không
                  cần chuyển tiền thật.
                </p>
              </div>
            )}
          </>
        )}
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
