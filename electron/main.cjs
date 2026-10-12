// Au Féminin — version bureau Windows (Electron 22 : dernière version compatible Windows 7/8/8.1)
const { app, BrowserWindow, Menu, protocol, shell } = require("electron");
const path = require("path");

// Schéma "app://" sécurisé : IndexedDB (session Firebase) et fetch fonctionnent
// comme sur un vrai site, ce qui n'est pas garanti avec file://.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const DIST = path.join(__dirname, "..", "dist");

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 860,
    minWidth: 360,
    minHeight: 560,
    title: "Au Féminin",
    backgroundColor: "#FBF5F7",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  // liens externes (https) dans le navigateur par défaut
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL("app://local/index.html");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [w] = BrowserWindow.getAllWindows();
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.registerFileProtocol("app", (request, callback) => {
      let p = decodeURIComponent(new URL(request.url).pathname);
      if (p === "/" || !path.extname(p)) p = "/index.html";
      const file = path.normalize(path.join(DIST, p));
      if (!file.startsWith(DIST)) return callback({ error: -6 }); // FILE_NOT_FOUND
      callback({ path: file });
    });
    Menu.setApplicationMenu(null);
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
