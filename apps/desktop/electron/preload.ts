const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC communication
  onToggleListening: (callback: (listening: boolean) => void) => {
    ipcRenderer.removeAllListeners('toggle-listening');
    ipcRenderer.on('toggle-listening', (_event: unknown, listening: boolean) => callback(listening));
  },
  onClearContext: (callback: () => void) => {
    ipcRenderer.removeAllListeners('clear-context');
    ipcRenderer.on('clear-context', () => callback());
  },
  onShowSettings: (callback: () => void) => {
    ipcRenderer.removeAllListeners('show-settings');
    ipcRenderer.on('show-settings', () => callback());
  },

  // System audio capture via desktopCapturer
  getDesktopSources: async () => {
    // This will be handled in the renderer via navigator.mediaDevices
    return [];
  },

  // Platform info
  platform: process.platform,
  arch: process.arch,
});

// Type definition for the exposed API
export interface ElectronAPI {
  onToggleListening: (callback: (listening: boolean) => void) => void;
  onClearContext: (callback: () => void) => void;
  onShowSettings: (callback: () => void) => void;
  getDesktopSources: () => Promise<unknown[]>;
  platform: string;
  arch: string;
}
