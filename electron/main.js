// =====================================================
// Electron 主进程文件
// 桌面软件入口
// =====================================================

const path = require('path');
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'development';
//const isDev = true; //强制为开发者环境

// Import Electron modules - app should be available in Electron main process
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');

class AppWindow {
  constructor() {
    this.mainWindow = null;
  }

  createWindow() {
    // 创建浏览器窗口
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      icon: path.join(__dirname, '../assets/icon.png'), // 应用图标
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
      },
      // titleBarStyle: 'hiddenInset', // 注释掉，允许窗口拖动
      show: false, // 先不显示，等加载完成后再显示
      frame: true, // 显示标准标题栏，允许拖动
    });

    // 加载应用
    if (isDev) {
      // 开发环境：加载本地开发服务器
      this.mainWindow.loadURL('http://localhost:3001');
      // 打开开发者工具
      this.mainWindow.webContents.openDevTools();
    } else {
      // 生产环境：加载构建后的文件
      this.mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    }

    // 当窗口准备显示时才显示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    // 设置菜单
    this.setupMenu();

    // 处理外部链接
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // 窗口关闭事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupMenu() {
    const template = [
      {
        label: '文件',
        submenu: [
          {
            label: '新建频道',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow.webContents.send('menu-new-channel');
            },
          },
          {
            label: '新建私聊',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => {
              this.mainWindow.webContents.send('menu-new-dm');
            },
          },
          { type: 'separator' },
          {
            label: '退出',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
          { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
          { type: 'separator' },
          { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
          { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
          { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
          { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectall' },
        ],
      },
      {
        label: '视图',
        submenu: [
          { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
          { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
          { label: '切换开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
          { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
          { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
          { type: 'separator' },
          { label: '切换全屏', accelerator: 'F11', role: 'togglefullscreen' },
        ],
      },
      {
        label: '窗口',
        submenu: [
          { label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
          { label: '关闭', accelerator: 'CmdOrCtrl+W', role: 'close' },
        ],
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '关于',
            click: () => {
              dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: '关于',
                message: 'Slack-like Chat Tool',
                detail: '一个现代化的桌面聊天应用',
              });
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

// 创建应用窗口实例
const appWindow = new AppWindow();

// Electron 初始化完成
app.whenReady().then(() => {
  appWindow.createWindow();

  app.on('activate', () => {
    // macOS 特殊处理
    if (BrowserWindow.getAllWindows().length === 0) {
      appWindow.createWindow();
    }
  });
});

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  // macOS 特殊处理
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 事件处理
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(appWindow.mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(appWindow.mainWindow, options);
  return result;
});

// 文件拖拽支持
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== 'http://localhost:3000' && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

// 安全设置
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});