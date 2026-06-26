import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  TextareaRenderable,
} from '@opentui/core';
import type { TuiCommandContext, TuiRouteId, TuiState } from './types.js';

import { TextAttributes } from '@opentui/core';
import { useKeyboard, useOnResize, useRenderer } from '@opentui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  pruneExpiredToasts,
  resizeViewport,
  syncMineInputs,
  tick,
} from './actions.js';
import { createTuiCommandRegistry } from './commands.js';
import { toastText } from './format.js';
import { TUI_ROUTES } from './routes.js';
import { LibraryScreen } from './screens/library.js';
import { MineScreen, type MineInputRefs } from './screens/mine.js';
import { SettingsScreen } from './screens/settings.js';
import { addToast, createToast } from './state.js';
import { colorscheme, NAME, TAGLINE } from './theme.js';

const TICK_MS = 1000;
const TOAST_PRUNE_MS = 3000;

type TuiAppProps = Readonly<{
  initialState: TuiState;
  stop: (code?: number) => Promise<void>;
}>;

type InputSnapshot = Readonly<{
  contextText: string;
  wordText: string;
}>;

function clampViewportAxis(
  value: number | undefined,
  fallback: number
): number {
  const safeFallback = Math.max(1, Math.trunc(fallback));
  if (!Number.isFinite(value)) return safeFallback;
  const raw = Math.trunc(value ?? safeFallback);
  return raw <= 0 ? safeFallback : raw;
}

function currentInputSnapshot(refs: MineInputRefs): InputSnapshot {
  return {
    contextText: refs.context.current?.plainText ?? '',
    wordText: refs.word.current?.value ?? '',
  };
}

function canUseGlobalKey(renderer: CliRenderer, key: KeyEvent): boolean {
  if (key.ctrl || key.meta) return true;
  return renderer.currentFocusedEditor === null;
}

export function TuiApp({ initialState, stop }: TuiAppProps) {
  const renderer = useRenderer();
  const [state, setState] = useState(initialState);
  const [routeId, setRouteId] = useState<TuiRouteId>('mine');
  const stateRef = useRef(state);
  const routeIdRef = useRef(routeId);
  const contextRef = useRef<TextareaRenderable>(null);
  const wordRef = useRef<InputRenderable>(null);
  const commandContextRef = useRef<TuiCommandContext | null>(null);

  const inputRefs = useMemo<MineInputRefs>(
    () => ({
      context: contextRef,
      word: wordRef,
    }),
    []
  );

  const setTuiState = useCallback((update: (state: TuiState) => TuiState) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const navigate = useCallback((nextRouteId: TuiRouteId): void => {
    routeIdRef.current = nextRouteId;
    setRouteId(nextRouteId);
  }, []);

  const commandRegistry = useMemo(() => createTuiCommandRegistry(), []);

  const syncInputs = useCallback((): void => {
    const snapshot = currentInputSnapshot(inputRefs);
    const context = commandContextRef.current;
    if (!context) return;
    syncMineInputs(context, snapshot);
  }, [inputRefs]);

  const runCommand = useCallback(
    async (commandId: string): Promise<boolean> => {
      const context = commandContextRef.current;
      if (!context) return false;
      const result = await commandRegistry.execute(commandId, context);
      return result.status === 'ran';
    },
    [commandRegistry]
  );

  const navigateOffset = useCallback(
    (offset: 1 | -1): void => {
      const index = TUI_ROUTES.findIndex(
        (route) => route.id === routeIdRef.current
      );
      const safeIndex = index < 0 ? 0 : index;
      const next =
        TUI_ROUTES[
          (safeIndex + offset + TUI_ROUTES.length) % TUI_ROUTES.length
        ];
      if (next) navigate(next.id);
    },
    [navigate]
  );

  const commandContext = useMemo<TuiCommandContext>(
    () => ({
      getState: () => stateRef.current,
      setState: setTuiState,
      syncInputs,
      navigate,
      getRoute: () => routeIdRef.current,
      navigateOffset,
      stop,
      runCommand,
    }),
    [navigate, navigateOffset, runCommand, setTuiState, stop, syncInputs]
  );
  commandContextRef.current = commandContext;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    routeIdRef.current = routeId;
  }, [routeId]);

  useEffect(() => {
    wordRef.current?.focus();
  }, []);

  useEffect(() => {
    const tickTimer = setInterval(() => {
      tick(commandContext);
    }, TICK_MS);
    const toastTimer = setInterval(() => {
      pruneExpiredToasts(commandContext);
    }, TOAST_PRUNE_MS);
    return () => {
      clearInterval(tickTimer);
      clearInterval(toastTimer);
    };
  }, [commandContext]);

  useOnResize((width, height) => {
    resizeViewport(
      commandContext,
      clampViewportAxis(width, stateRef.current.viewportCols),
      clampViewportAxis(height, stateRef.current.viewportRows)
    );
  });

  useKeyboard((key) => {
    if (key.eventType === 'release') return;

    const command = commandRegistry.commandForKey(key);
    if (!command) return;
    if (command.global !== true && !canUseGlobalKey(renderer, key)) return;

    key.preventDefault();
    void commandRegistry.execute(command.id, commandContext).then((result) => {
      if (result.status !== 'disabled') return;
      setTuiState((current) =>
        addToast(current, createToast(result.reason, 'warning'))
      );
    });
  });

  return (
    <box
      id="wakaru-root"
      width="100%"
      height="100%"
      backgroundColor={colorscheme.bg}
      flexDirection="column"
      rowGap={1}
      padding={1}
    >
      <box
        id="wakaru-navbar"
        width="100%"
        flexDirection="column"
        rowGap={1}
        paddingX={1}
        borderColor={colorscheme.muted}
        border
      >
        <box
          id="wakaru-titlebar"
          columnGap={1}
          flexDirection="row"
          width="100%"
        >
          <text
            id="wakaru-header"
            height={1}
            content={NAME}
            fg={colorscheme.primary}
            attributes={TextAttributes.BOLD}
          />
          <text
            id="wakaru-separator"
            height={1}
            content="·"
            fg={colorscheme.muted}
            attributes={TextAttributes.ITALIC}
          />
          <text
            id="wakaru-tagline"
            height={1}
            content={TAGLINE}
            fg={colorscheme.muted}
            attributes={TextAttributes.ITALIC}
          />
        </box>
        <box id="wakaru-menu" width="100%" columnGap={2} flexDirection="row">
          {TUI_ROUTES.map((route) => (
            <text
              id={`wakaru-menu-${route.id}`}
              height={1}
              fg={route.id === routeId ? colorscheme.bg : colorscheme.text}
              bg={
                route.id === routeId
                  ? colorscheme.primary
                  : colorscheme.bgHighlight
              }
              content={` ${route.title} `}
              attributes={TextAttributes.BOLD}
              onMouseDown={() => navigate(route.id)}
            />
          ))}
        </box>
        <text
          id="wakaru-tooltip"
          height={1}
          fg={colorscheme.muted}
          content="ctrl+p commands · q quit"
          attributes={TextAttributes.ITALIC}
        />
      </box>
      {/* <text
        id="wakaru-status"
        height={1}
        fg={state.status === 'error' ? colorscheme.danger : colorscheme.muted}
        content={`${state.status.toUpperCase()} · ${state.statusMessage}`}
      /> */}
      {routeId === 'mine' ? (
        <MineScreen state={state} refs={inputRefs} />
      ) : null}
      {routeId === 'library' ? <LibraryScreen state={state} /> : null}
      {routeId === 'settings' ? <SettingsScreen state={state} /> : null}
      <text
        id="wakaru-toasts"
        height={3}
        fg={colorscheme.warning}
        content={toastText(state)}
        wrapMode="word"
      />
    </box>
  );
}
