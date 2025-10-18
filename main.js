const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: 50, // Position from left edge
    y: 50, // Position from top edge
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'TakeBack',
    frame: false, // Frameless window (no title bar)
    transparent: true, // Transparent background
    alwaysOnTop: true, // Always stay on top
    resizable: false,
    skipTaskbar: true, // Don't show in taskbar
    hasShadow: true,
    roundedCorners: true
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development (comment out for production)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for communication between renderer and main process
ipcMain.on('start-monitoring', (event, config) => {
  console.log('Starting monitoring with config:', config);
  event.reply('monitoring-status', { status: 'started' });
  // TODO: Implement audio capture and processing
});

ipcMain.on('stop-monitoring', (event) => {
  console.log('Stopping monitoring');
  event.reply('monitoring-status', { status: 'stopped' });
  // TODO: Stop audio processing
});

ipcMain.on('update-sensitivity', (event, level) => {
  console.log('Updating sensitivity to:', level);
  // TODO: Update LLM sensitivity threshold
});
