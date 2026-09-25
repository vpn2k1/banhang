// @ts-check
/**
 * Electron main process – Grocery POS (Phase 2).
 *
 * - Giao diện (bản build Vite trong dist/) được phục vụ qua giao thức riêng app://pos/
 *   để SQLite WASM tải được file .wasm và IndexedDB có origin cố định (dữ liệu giữ qua các lần mở).
 * - In hoá đơn thẳng ra máy in (không hộp thoại) bằng webContents.print({ silent: true }).
 *
 * Dev:  npm run electron:dev   (Vite dev server + Electron, có hot reload)
 * Prod: npm run electron:start (build rồi chạy) · npm run dist (đóng gói installer)
 */
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const APP_ORIGIN = `${SCHEME}://pos`;
const DIST = path.join(__dirname, '..', 'dist');
/** npm run electron:dev truyền --dev-server=http://localhost:5173 */
const DEV_SERVER = process.argv.find((a) => a.startsWith('--dev-server='))?.split('=')[1];

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

/** Chỉ nhận IPC từ chính giao diện của app. */
function isTrustedSender(/** @type {Electron.IpcMainInvokeEvent} */ event) {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith(APP_ORIGIN) || (!!DEV_SERVER && url.startsWith(DEV_SERVER));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Grocery POS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Không mở cửa sổ / điều hướng lạ trong app; link ngoài mở bằng trình duyệt
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_ORIGIN) && !(DEV_SERVER && url.startsWith(DEV_SERVER))) e.preventDefault();
  });

  win.loadURL(DEV_SERVER ?? `${APP_ORIGIN}/index.html`);
  return win;
}

// ---------------------------------------------------------------- Máy in

ipcMain.handle('printers:list', async (event) => {
  if (!isTrustedSender(event)) throw new Error('Untrusted sender');
  const printers = await event.sender.getPrintersAsync();
  return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault }));
});

/**
 * In trang hiện tại (CSS @media print chỉ hiện hoá đơn trong #print-root) ra máy in, không hộp thoại.
 * widthMm / heightMm: khổ giấy = khổ hoá đơn, để máy in nhiệt không đẩy giấy thừa.
 */
ipcMain.handle('print:receipt', async (event, opts) => {
  if (!isTrustedSender(event)) throw new Error('Untrusted sender');
  const widthMm = Number(opts?.widthMm);
  const heightMm = Number(opts?.heightMm);
  const deviceName = typeof opts?.deviceName === 'string' && opts.deviceName ? opts.deviceName : undefined;
  if (!(widthMm >= 40 && widthMm <= 120) || !(heightMm >= 20 && heightMm <= 5000)) {
    return { ok: false, error: 'Khổ giấy không hợp lệ' };
  }
  if (deviceName) {
    const printers = await event.sender.getPrintersAsync();
    if (!printers.some((p) => p.name === deviceName)) {
      return { ok: false, error: `Không tìm thấy máy in “${deviceName}”. Kiểm tra máy in đã bật / cắm cáp, hoặc chọn lại trong Cài đặt.` };
    }
  }
  return new Promise((resolve) => {
    event.sender.print(
      {
        silent: true,
        printBackground: true,
        deviceName,
        margins: { marginType: 'none' },
        // micron
        pageSize: { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) },
      },
      (success, failureReason) => resolve(success ? { ok: true } : { ok: false, error: failureReason || 'In thất bại' }),
    );
  });
});

// ---------------------------------------------------------------- Vòng đời app

app.whenReady().then(() => {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
