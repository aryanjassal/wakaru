import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { loadConfig } from '@/core/config';
import { loadSavedWords } from '@/core/storage';
import { TuiApp } from './app';
import { addToast, createInitialTuiState, createToast } from './lib/state';
import { colorscheme } from './lib/theme';

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

const config = loadConfig();
const loadedWords = await loadSavedWords(config);
let initialState = createInitialTuiState(
  config,
  Date.now(),
  {
    cols: clampViewportAxis(process.stdout.columns, 120),
    rows: clampViewportAxis(process.stdout.rows, 40),
  },
  loadedWords.words
);
if (loadedWords.failedCount) {
  initialState = addToast(
    initialState,
    createToast(
      `${loadedWords.failedCount} saved word${loadedWords.failedCount === 1 ? '' : 's'} failed to load.`,
      'warning'
    )
  );
}

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
  stopResolve?.();
  stopResolve = null;
  return Promise.resolve();
}

process.once('SIGINT', () => void stopApp(0));
process.once('SIGTERM', () => void stopApp(0));

createRoot(renderer).render(
  <TuiApp initialState={initialState} stop={stopApp} />
);

await stopPromise;
if (stopCode !== 0) process.exitCode = stopCode;
