import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { loadConfig } from '@/core/config.js';
import { loadSavedWords } from '@/core/storage.js';
import { TuiApp } from './app.js';
import { createInitialTuiState } from './state.js';
import { colorscheme } from './theme.js';

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
const savedWords = await loadSavedWords(config);
const initialState = createInitialTuiState(
  config,
  Date.now(),
  {
    cols: clampViewportAxis(process.stdout.columns, 120),
    rows: clampViewportAxis(process.stdout.rows, 40),
  },
  savedWords
);

let stopping = false;
let stopCode = 0;
let stopResolve: (() => void) | null = null;
const stopPromise = new Promise<void>((resolve) => {
  stopResolve = resolve;
});

const renderer = await createCliRenderer({
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
