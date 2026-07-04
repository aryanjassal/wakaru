import { describe, it, expect } from '@jest/globals';
import {
  addToast,
  createInitialTuiState,
  pruneToasts,
} from '../src/tui/lib/state.js';
import { getTestConfig } from './config.js';

describe('State', () => {
  const config = getTestConfig({
    model: {
      name: 'test-model',
      apiBase: 'http://localhost:11434',
    },
  });

  it('initial state uses config and viewport dimensions', () => {
    const state = createInitialTuiState(config, '/tmp/wakaru-test', 1_000, {
      cols: 100,
      rows: 32,
    });

    expect(state.viewportCols).toBe(100);
  });

  it('toasts can be pruned by duration', () => {
    const initial = createInitialTuiState(config, '/tmp/wakaru-test', 0);
    const withToast = addToast(initial, {
      id: 'toast-1',
      message: 'Saved',
      level: 'success',
      timestamp: 0,
      durationMs: 100,
    });
    const pruned = pruneToasts(withToast, 200);

    expect(withToast.toasts.length).toBe(1);
    expect(pruned.toasts.length).toBe(0);
  });
});
