// =====================================================
// Electron 预加载脚本
// 在渲染进程中暴露安全的 API
// =====================================================

const { contextBridge, ipcRenderer } = require('electron');

// 暴露受保护的方法，允许渲染进程使用 ipcRenderer，同时不暴露整个对象
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // 菜单事件
  onMenuNewChannel: (callback) => ipcRenderer.on('menu-new-channel', callback),
  onMenuNewDM: (callback) => ipcRenderer.on('menu-new-dm', callback),

  // 平台信息
  platform: process.platform,
  isElectron: true,
});

// 在渲染进程中可以通过 window.electronAPI 访问这些方法