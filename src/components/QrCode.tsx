import { useMemo } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;
  /** Kích thước CSS, VD "240px" hoặc "40mm" (khi in) */
  size: string;
  className?: string;
}

/** Vẽ QR bằng SVG đồng bộ (không async) để in ngay được và nét trên máy in nhiệt. */
export function QrCode({ value, size, className }: Props) {
  const { path, dim } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (modules.get(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    }
    return { path: d, dim: n + 8 }; // 4 ô viền trắng mỗi bên
  }, [value]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Mã QR chuyển khoản"
    >
      <rect width={dim} height={dim} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
