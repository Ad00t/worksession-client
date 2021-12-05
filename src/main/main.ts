/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog, systemPreferences } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import Store from 'electron-store';
import { resolveHtmlPath } from './util';

const remote = require('@electron/remote/main');
remote.initialize();

import * as AwsApi from '../renderer/api/AwsApi';
import config from '../renderer/config/config';

const fs = require('fs-extra');
const ffmpegStatic = require('ffmpeg-static-electron');

Store.initRenderer();

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater
      .checkForUpdatesAndNotify()
      .catch(console.log);
  }
}

let mainWindow: BrowserWindow;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  config.set('ffmpegPath', ffmpegStatic.path);
  await AwsApi.getConfig([]);

  if (systemPreferences.getMediaAccessStatus('camera') !== 'granted') {
    if (!(process.platform === 'darwin' ? await systemPreferences.askForMediaAccess('camera') : false)) {
      dialog.showMessageBoxSync(mainWindow, { message: 'Permission to access the camera is required to use this application.' });
      app.quit();
    }
  }

  mainWindow = new BrowserWindow({
    title: `${config.get('title')}`,
    width: 1366,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      devTools: true,
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      webviewTag: true,
      webSecurity: false
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow)
      throw new Error('"mainWindow" is not defined');

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    }
  });

  mainWindow.on('close', (e) => {
    const pOut = path.join(app.getPath('userData'), 'out');
    const sessStack = fs.existsSync(pOut) ? fs.readdirSync(pOut, { withFileTypes: true })
                        .filter((dirent: { isDirectory: () => any; }) => dirent.isDirectory())
                        .map((dirent: { name: any; }) => dirent.name) : [];
    if (sessStack.length > 0) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        message: 'There may be a worksession currently cached,\nrecording, or processing. Exiting now may cause\nit to be lost. Are you sure you want to quit?'
      });
      if (choice === 1)
        e.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow.destroy();
  });

  remote.enable(mainWindow.webContents);

  mainWindow.webContents.on('new-window',
  (event, url, frameName, disposition, options, additionalFeatures) => {
    if (frameName === 'Notes') {
      event.preventDefault();
      Object.assign(options, {
        parent: mainWindow,
        title: 'Notes',
        x: 35,
        y: 35,
        width: 450,
        height: 600,
        minimizable: false
      });
      event.newGuest = new BrowserWindow(options);
    } else {
      shell.openExternal(url);
    }
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => app.quit());

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
