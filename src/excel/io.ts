import type { SheetIn, SheetOut } from './workbook';

/**
 * Đọc / ghi file .xlsx. Thư viện được nạp khi cần (dynamic import) để không làm nặng
 * lần mở app đầu tiên.
 */
export async function writeXlsx(sheets: SheetOut[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  // SheetOut tương thích kiểu Sheet của write-excel-file
  return writeXlsxFile(sheets as never, { fontFamily: 'Arial', fontSize: 11 }).toBlob();
}

export async function readXlsx(input: Blob | ArrayBuffer): Promise<SheetIn[]> {
  const { default: readXlsxFile } = await import('read-excel-file/universal');
  const sheets = await readXlsxFile(input);
  return sheets as unknown as SheetIn[];
}
