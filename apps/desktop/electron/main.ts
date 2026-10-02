import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: ChildProcess | null = null;
let isListening = false;

const isDev = !app.isPackaged;
const BACKEND_PORT = 3399;

// ─── Backend Management ────────────────────────────────────────────

function startBackend(): void {
  // During dev, we let the user run the backend manually in a separate terminal
  // to prevent port conflicts and make logs easier to read.
  if (isDev) return;

  const backendDir = path.resolve(__dirname, '../../../backend');
  console.log(`Starting backend from: ${backendDir}`);

  backendProcess = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: backendDir,
    env: { ...process.env, BACKEND_PORT: String(BACKEND_PORT) },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  backendProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on('close', (code: number | null) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });

  backendProcess.on('error', (err: Error) => {
    console.error('Failed to start backend:', err.message);
  });
}

function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// ─── Window Creation ───────────────────────────────────────────────

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 360,
    minHeight: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow media access for audio capture
      webSecurity: true,
    },
    skipTaskbar: false,
    show: false,
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ─── Tray ──────────────────────────────────────────────────────────

function createTray(): void {
  // Create a small icon for the tray
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAMlJREFUOI2dk70OgjAUhb9KHHwFX8/BxAcwcXBiYGBkdHBwdGEgDjAxMpDoQkKIJl5DLbRAuEm78Oec9v4ANbADHkCYs+MFnIEpKkzAyZXfgQlqTMABONt5CIRBEA6AedpJ5xXwBJ4Zv1qJqKnCNEVXq8Eoa8HG5V8BB2AHnIrOWQlnYJLT7VBm7xqEcNd8VVJ3YC8E87k4g2eiMUPUL1dSC3gCPQJW3t4SGJV8QFuiVdLZL/nv7BoQHhxEPpTfQB3Rp9zsgHhH6RYPXVvAAAAAElFTkSuQmCC'
  );
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('LocalVoiceAgent');

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'LocalVoiceAgent',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isListening ? '● Listening' : '○ Paused',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show Assistant',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: isListening ? 'Pause Listening' : 'Start Listening',
      click: () => {
        isListening = !isListening;
        mainWindow?.webContents.send('toggle-listening', isListening);
        updateTrayMenu();
      },
    },
    {
      label: 'Clear Context',
      click: () => {
        mainWindow?.webContents.send('clear-context');
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('show-settings');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ─── Global Shortcuts ──────────────────────────────────────────────

function registerShortcuts(): void {
  // Toggle listening
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    isListening = !isListening;
    mainWindow?.webContents.send('toggle-listening', isListening);
    updateTrayMenu();
  });

  // Show/hide assistant
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Clear conversation
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    mainWindow?.webContents.send('clear-context');
  });

  // Stop listening
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    isListening = false;
    mainWindow?.webContents.send('toggle-listening', false);
    updateTrayMenu();
  });
}

// ─── App Lifecycle ─────────────────────────────────────────────────

app.on('ready', () => {
  // Start backend first
  startBackend();

  // Wait a moment for backend to start, then create UI
  setTimeout(() => {
    createMainWindow();
    createTray();
    registerShortcuts();
  }, 2000);
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running in the tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBackend();
});

app.on('before-quit', () => {
  stopBackend();
});

// Request microphone and screen capture permissions on macOS
app.whenReady().then(() => {
  // These are automatically requested when the renderer tries to use them
  // but we log the current state for debugging
  const micAccess = (process.platform === 'darwin')
    ? 'check Settings > Privacy > Microphone'
    : 'granted';
  console.log(`Microphone access: ${micAccess}`);
});
