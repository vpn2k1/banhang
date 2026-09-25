/**
 * Máy quét USB hoạt động như bàn phím: gõ mã rồi Enter.
 * Hỗ trợ thêm cú pháp "số lượng*mã", ví dụ "3*8931234567890" → 3 sản phẩm.
 */
export function parseScan(text: string): { quantity: number; code: string } {
  const m = text.trim().match(/^(\d{1,4})\s*[*xX]\s*(.+)$/);
  if (m && Number(m[1]) > 0) return { quantity: Number(m[1]), code: m[2].trim() };
  return { quantity: 1, code: text.trim() };
}

let ctx: AudioContext | undefined;

/** Tiếng bíp ngắn để người bán biết đã quét được (ok) hoặc lỗi. */
export function beep(kind: 'ok' | 'error' = 'ok'): void {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === 'ok' ? 1400 : 300;
    osc.type = kind === 'ok' ? 'sine' : 'square';
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === 'ok' ? 0.06 : 0.25));
  } catch {
    // Trình duyệt chặn audio → bỏ qua
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
