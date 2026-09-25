// @ts-check
/**
 * Cầu nối an toàn giữa giao diện và Electron (contextIsolation + sandbox).
 * Giao diện chỉ thấy window.posDevice – xem src/device/printer.ts.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posDevice', {
  platform: process.platform,
  /** @returns {Promise<{ name: string; displayName: string; isDefault: boolean }[]>} */
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  /** @param {{ deviceName?: string; widthMm: number; heightMm: number }} opts */
  printReceipt: (opts) => ipcRenderer.invoke('print:receipt', opts),
});
