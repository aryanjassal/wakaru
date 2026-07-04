import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { createWakaru } from '@/client/create';
import { loadConfig, writeConfig } from '@/client/config';
import { SqliteWordStore } from '@/client/storage/sqlite';
import { TuiApp } from './app';
import { createInitialTuiState } from './lib/state';
import { colorscheme } from './lib/theme';
import {
  dictionaryPath,
  tokeniserDictionaryPath,
  exportDirectory,
  wordDatabasePath,
} from './paths';

const UI_FPS_CAP = 60;

function clampViewportAxis(
  value: number | undefined,
  fallback: number
): number {
  const safeFallback = Math.max(1, Math.trunc(fallback));
  if (!Number.isFinite(value)) return safeFallback;
  const raw = Math.trunc(value ?? safeFallback);
  return raw <= 0 ? safeFallback : raw;
}

const configuredConfig = loadConfig();
const exportDir = exportDirectory();
const wordStore = new SqliteWordStore(wordDatabasePath());
const schemaState = wordStore.checkExportSchema(configuredConfig.export);
const effectiveConfig = schemaState
  ? { ...configuredConfig, export: schemaState.stored }
  : configuredConfig;
const dictionary = dictionaryPath();
const tokeniserDictionary = tokeniserDictionaryPath();
const createConfiguredWakaru = (config: typeof configuredConfig) =>
  createWakaru({
    config,
    dictionaryPath: dictionary,
    tokeniserDictionaryPath: tokeniserDictionary,
  });
const wakaru = createConfiguredWakaru(effectiveConfig);
await wakaru.checkHealth();

const initialState = createInitialTuiState(
  effectiveConfig,
  exportDir,
  Date.now(),
  {
    cols: clampViewportAxis(process.stdout.columns, 120),
    rows: clampViewportAxis(process.stdout.rows, 40),
  }
);

let stopping = false;
let stopCode = 0;
let stopResolve: (() => void) | null = null;
const stopPromise = new Promise<void>((resolve) => {
  stopResolve = resolve;
});

const renderer = await createCliRenderer({
  autoFocus: false,
  exitOnCtrlC: false,
  targetFps: UI_FPS_CAP,
  maxFps: UI_FPS_CAP,
  screenMode: 'alternate-screen',
  consoleMode: 'disabled',
  backgroundColor: colorscheme.bg,
});

function stopApp(code = 0): Promise<void> {
  if (stopping) return Promise.resolve();
  stopping = true;
  stopCode = code;
  renderer.destroy();
  wordStore.close();
  stopResolve?.();
  stopResolve = null;
  return Promise.resolve();
}

process.once('SIGINT', () => void stopApp(0));
process.once('SIGTERM', () => void stopApp(0));

createRoot(renderer).render(
  <TuiApp
    initialState={initialState}
    wakaru={wakaru}
    wordStore={wordStore}
    schemaState={schemaState ?? undefined}
    resolveSchema={async (action, migration) => {
      let config = effectiveConfig;
      if (action === 'proceed') {
        wordStore.applyExportSchema(configuredConfig.export, migration);
        config = configuredConfig;
      } else if (action === 'revert' && schemaState) {
        config = { ...configuredConfig, export: schemaState.stored };
        writeConfig(config);
      }
      const nextWakaru = createConfiguredWakaru(config);
      await nextWakaru.checkHealth();
      return { config, wakaru: nextWakaru };
    }}
    stop={stopApp}
  />
);

await stopPromise;
if (stopCode !== 0) process.exitCode = stopCode;
