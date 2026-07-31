import type { WakaruElectronApi } from './api.js';

import { contextBridge, ipcRenderer } from 'electron';

function invoke<Key extends keyof WakaruElectronApi>(
  channel: Key,
  ...args: Parameters<WakaruElectronApi[Key]>
): ReturnType<WakaruElectronApi[Key]> {
  return ipcRenderer.invoke(`wakaru:${channel}`, ...args) as ReturnType<
    WakaruElectronApi[Key]
  >;
}

const api: WakaruElectronApi = {
  loadConfig: () => invoke('loadConfig'),
  writeConfig: (config) => invoke('writeConfig', config),
  checkHealth: () => invoke('checkHealth'),
  analyseVocabulary: (input) => invoke('analyseVocabulary', input),
  prepareVocabulary: (candidate, context) =>
    invoke('prepareVocabulary', candidate, context),
  listWords: () => invoke('listWords'),
  saveWord: (input) => invoke('saveWord', input),
  exportTsv: () => invoke('exportTsv'),
};

contextBridge.exposeInMainWorld('wakaru', api);
