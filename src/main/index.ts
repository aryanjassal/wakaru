import type { ClientConfig } from '@/wakaru/schema/config.js';
import type { SavePreparedWordInput, WakaruElectronApi } from './api.js';

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWakaru } from '@/wakaru/create.js';
import { loadConfig, writeConfig } from '@/wakaru/config.js';
import {
  dictionaryPath,
  exportDirectory,
  tokeniserDictionaryPath,
  wordDatabasePath,
} from '@/wakaru/paths.js';
import { writeTsvExport } from '@/wakaru/export/tsv-file.js';
import { SqliteWordStore } from '@/wakaru/storage/sqlite.js';
import { candidateToSavedWord } from '@/wakaru/storage/words.js';

let config = loadConfig();
const dictionary = dictionaryPath();
const tokeniserDictionary = tokeniserDictionaryPath();
const wordStore = new SqliteWordStore(wordDatabasePath());
let wakaru = createConfiguredWakaru(config);

function createConfiguredWakaru(nextConfig: ClientConfig) {
  return createWakaru({
    config: nextConfig,
    dictionaryPath: dictionary,
    tokeniserDictionaryPath: tokeniserDictionary,
  });
}

const api: WakaruElectronApi = {
  loadConfig: () => Promise.resolve(config),
  writeConfig: (nextConfig) => {
    writeConfig(nextConfig);
    config = nextConfig;
    wakaru = createConfiguredWakaru(config);
    return Promise.resolve();
  },
  checkHealth: () => wakaru.checkHealth(),
  analyseVocabulary: (input) => wakaru.analyseVocabulary(input),
  prepareVocabulary: (candidate, context) =>
    wakaru.prepareVocabulary(candidate, context),
  listWords: () => Promise.resolve(wordStore.list()),
  saveWord: async (input: SavePreparedWordInput) => {
    const prepared = await wakaru.prepareVocabulary(
      input.candidate,
      input.context
    );
    const saved = candidateToSavedWord(prepared, input.sourceText, config);
    wordStore.save(saved);
    return saved;
  },
  exportTsv: async () =>
    writeTsvExport(config, exportDirectory(), wordStore.list()),
};

function handleApi<Key extends keyof WakaruElectronApi>(channel: Key): void {
  ipcMain.handle(`wakaru:${channel}`, (_event: unknown, ...args: unknown[]) => {
    const handler = api[channel] as (...handlerArgs: unknown[]) => unknown;
    return handler(...args);
  });
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // HMR for renderer base on electron-vite CLI.
  // Load the remote URL for development or the local html file for production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

for (const channel of Object.keys(api) as (keyof WakaruElectronApi)[]) {
  handleApi(channel);
}

void app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((cause: unknown) => {
    console.error(cause);
    app.quit();
  });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  wordStore.close();
});
