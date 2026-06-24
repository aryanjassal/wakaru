import { createNodeApp } from '@rezi-ui/node';
import { configureCustomTheme, themeSpec } from './theme.js';
import type {
  MiningCandidate,
  WakaruAction,
  WakaruRouteDeps,
  WakaruRouteId,
  WakaruState,
} from './types.js';
import { analyzeWithOllama } from './wakaru/llm.js';
import { createWakaruRoutes, WAKARU_ROUTES } from './wakaru/screens.js';
import { createInitialWakaruState, reduceWakaruState } from './wakaru/state.js';
import {
  candidateToSavedWord,
  loadSavedWords,
  saveWord,
  writeAnkiImport,
} from './wakaru/storage.js';
import { loadConfig, resolveUserPath } from './wakaru/config.js';

const UI_FPS_CAP = 30;
const TICK_MS = 1000;
const TOAST_PRUNE_MS = 3000;

function clampViewportAxis(
  value: number | undefined,
  fallback: number
): number {
  const safeFallback = Math.max(1, Math.trunc(fallback));
  if (!Number.isFinite(value)) return safeFallback;
  const raw = Math.trunc(value ?? safeFallback);
  return raw <= 0 ? safeFallback : raw;
}

function toast(
  message: string,
  level: 'info' | 'success' | 'warning' | 'error' = 'info'
): WakaruAction {
  return {
    type: 'add-toast',
    toast: {
      id: `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      level,
      timestamp: Date.now(),
      durationMs: 3200,
    },
  };
}

const config = loadConfig();
configureCustomTheme(resolveUserPath(config.theme.customPath));
const savedWords = await loadSavedWords(config);
const initialState = createInitialWakaruState(
  config,
  Date.now(),
  {
    cols: clampViewportAxis(process.stdout.columns, 120),
    rows: clampViewportAxis(process.stdout.rows, 40),
  },
  savedWords
);

let currentState: WakaruState = initialState;
let stopping = false;
let stopCode = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setInterval> | null = null;
let stopResolve: (() => void) | null = null;
const stopPromise = new Promise<void>((resolve) => {
  stopResolve = resolve;
});
let lastViewport = {
  cols: initialState.viewportCols,
  rows: initialState.viewportRows,
};

// eslint-disable-next-line prefer-const -- app is wired after callbacks are declared.
let app!: ReturnType<typeof createNodeApp<WakaruState>>;

function dispatch(action: WakaruAction): void {
  let themeChanged = false;
  let nextTheme = currentState.themeName;

  app.update((previous) => {
    const next = reduceWakaruState(previous, action);
    currentState = next;
    if (next.themeName !== previous.themeName) {
      themeChanged = true;
      nextTheme = next.themeName;
    }
    return next;
  });

  if (themeChanged) {
    app.setTheme(themeSpec(nextTheme).theme);
  }
}

function selectedCandidate(): MiningCandidate | null {
  return (
    currentState.candidates.find(
      (candidate) => candidate.id === currentState.selectedCandidateId
    ) ?? null
  );
}

async function analyzeInput(): Promise<void> {
  const text = currentState.inputText.trim();
  if (
    !text ||
    currentState.status === 'analyzing' ||
    currentState.status === 'saving'
  )
    return;

  dispatch({
    type: 'set-status',
    status: 'analyzing',
    message: 'Asking Ollama for mining candidates...',
  });
  try {
    const candidates = await analyzeWithOllama(currentState.config, text);
    dispatch({ type: 'set-candidates', candidates });
    dispatch(
      toast(
        `Found ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}.`,
        'success'
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'set-error', message });
    dispatch(toast(message, 'error'));
  }
}

async function addSelected(): Promise<void> {
  const candidate = selectedCandidate();
  if (
    !candidate ||
    candidate.status === 'added' ||
    currentState.status === 'saving'
  )
    return;

  dispatch({
    type: 'set-status',
    status: 'saving',
    message: `Saving ${candidate.expression}...`,
  });
  try {
    const word = candidateToSavedWord(candidate, currentState.inputText.trim());
    await saveWord(currentState.config, word);
    dispatch({ type: 'add-saved-word', word });
    dispatch({
      type: 'mark-candidate',
      candidateId: candidate.id,
      status: 'added',
    });
    dispatch({
      type: 'set-status',
      status: 'idle',
      message: `${candidate.expression} saved to Anki import file.`,
    });
    dispatch(toast(`Saved ${candidate.expression}.`, 'success'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'set-error', message });
    dispatch(toast(message, 'error'));
  }
}

function skipSelected(): void {
  const candidate = selectedCandidate();
  if (!candidate || candidate.status !== 'pending') return;
  dispatch({
    type: 'mark-candidate',
    candidateId: candidate.id,
    status: 'skipped',
  });
  dispatch(toast(`Skipped ${candidate.expression}.`, 'warning'));
}

async function exportAnki(): Promise<void> {
  try {
    const path = await writeAnkiImport(
      currentState.config,
      currentState.savedWords
    );
    dispatch(toast(`Wrote ${path}.`, 'success'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'set-error', message });
    dispatch(toast(message, 'error'));
  }
}

function currentRouteId(): WakaruRouteId {
  const routeId = app.router?.currentRoute().id;
  if (routeId === 'library' || routeId === 'settings') return routeId;
  return 'mine';
}

function navigate(routeId: WakaruRouteId): void {
  const router = app.router;
  if (!router || router.currentRoute().id === routeId) return;
  router.replace(routeId);
}

function navigateOffset(offset: 1 | -1): void {
  const index = WAKARU_ROUTES.findIndex(
    (route) => route.id === currentRouteId()
  );
  const safeIndex = index < 0 ? 0 : index;
  const next =
    WAKARU_ROUTES[
      (safeIndex + offset + WAKARU_ROUTES.length) % WAKARU_ROUTES.length
    ];
  if (next) navigate(next.id);
}

async function stopApp(code = 0): Promise<void> {
  if (stopping) return;
  stopping = true;
  stopCode = code;
  if (tickTimer) clearInterval(tickTimer);
  if (toastTimer) clearInterval(toastTimer);
  tickTimer = null;
  toastTimer = null;
  try {
    await app.stop();
  } catch {
    // Ignore shutdown races.
  }
  stopResolve?.();
  stopResolve = null;
}

function syncViewport(cols: number, rows: number): void {
  const safeCols = clampViewportAxis(cols, lastViewport.cols);
  const safeRows = clampViewportAxis(rows, lastViewport.rows);
  if (safeCols === lastViewport.cols && safeRows === lastViewport.rows) return;
  lastViewport = { cols: safeCols, rows: safeRows };
  dispatch({ type: 'set-viewport', cols: safeCols, rows: safeRows });
}

function syncViewportFromStdout(): void {
  if (!process.stdout.isTTY) return;
  syncViewport(
    clampViewportAxis(process.stdout.columns, lastViewport.cols),
    clampViewportAxis(process.stdout.rows, lastViewport.rows)
  );
}

function applyCommand(command: string): void {
  if (command === 'quit') void stopApp(0);
  if (command === 'mine') navigate('mine');
  if (command === 'library') navigate('library');
  if (command === 'settings') navigate('settings');
  if (command === 'next') navigateOffset(1);
  if (command === 'prev') navigateOffset(-1);
  if (command === 'theme') dispatch({ type: 'cycle-theme' });
  if (command === 'palette') dispatch({ type: 'toggle-command-palette' });
  if (command === 'analyze') void analyzeInput();
  if (command === 'add') void addSelected();
  if (command === 'skip') skipSelected();
  if (command === 'export') void exportAnki();
}

function bindKeys(): void {
  app.keys({
    q: () => applyCommand('quit'),
    'ctrl+c': () => applyCommand('quit'),
    '1': () => applyCommand('mine'),
    '2': () => applyCommand('library'),
    '3': () => applyCommand('settings'),
    tab: () => applyCommand('next'),
    'shift+tab': () => applyCommand('prev'),
    t: () => applyCommand('theme'),
    'ctrl+p': () => applyCommand('palette'),
    'ctrl+a': () => applyCommand('analyze'),
    enter: () => applyCommand('add'),
    x: () => applyCommand('skip'),
    'ctrl+e': () => applyCommand('export'),
    escape: () => {
      if (currentState.showCommandPalette)
        dispatch({ type: 'toggle-command-palette' });
    },
  });
}

const deps: WakaruRouteDeps = {
  dispatch,
  analyzeInput: () => void analyzeInput(),
  addSelected: () => void addSelected(),
  skipSelected,
  exportAnki: () => void exportAnki(),
  navigate,
  routes: WAKARU_ROUTES,
  stop: () => void stopApp(0),
  getBindings: () => app.getBindings(),
};

app = createNodeApp({
  initialState,
  routes: createWakaruRoutes(deps),
  initialRoute: 'mine',
  config: {
    fpsCap: UI_FPS_CAP,
    executionMode:
      process.env.REZI_WAKARU_EXECUTION_MODE === 'worker' ? 'worker' : 'inline',
  },
  theme: themeSpec(initialState.themeName).theme,
});

bindKeys();
syncViewportFromStdout();

app.onEvent((event) => {
  if (event.kind === 'fatal') {
    void stopApp(1);
    return;
  }
  if (event.kind === 'engine' && event.event.kind === 'resize') {
    syncViewport(event.event.cols, event.event.rows);
  }
});

process.once('SIGINT', () => void stopApp(0));
process.once('SIGTERM', () => void stopApp(0));

tickTimer = setInterval(() => {
  syncViewportFromStdout();
  dispatch({ type: 'tick', nowMs: Date.now() });
}, TICK_MS);

toastTimer = setInterval(() => {
  dispatch({ type: 'prune-toasts', nowMs: Date.now() });
}, TOAST_PRUNE_MS);

await app.start();
await stopPromise;
if (stopCode !== 0) process.exitCode = stopCode;
