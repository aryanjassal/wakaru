import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  TextareaRenderable,
} from '@opentui/core';
import type { WakaruAction, WakaruRouteId, WakaruState } from './types.js';

import { TextAttributes } from '@opentui/core';
import { useKeyboard, useOnResize, useRenderer } from '@opentui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createWakaruActions } from './actions.js';
import { toastText } from './format.js';
import { WAKARU_ROUTES } from './routes.js';
import { LibraryScreen } from './screens/library.js';
import { MineScreen, type MineInputRefs } from './screens/mine.js';
import { SettingsScreen } from './screens/settings.js';
import { reduceWakaruState } from './state.js';
import { colorscheme, NAME, TAGLINE } from './theme.js';

const TICK_MS = 1000;
const TOAST_PRUNE_MS = 3000;

type WakaruAppProps = Readonly<{
  initialState: WakaruState;
  stop: (code?: number) => Promise<void>;
}>;

type InputSnapshot = Readonly<{
  inputText: string;
  contextText: string;
  customWordText: string;
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
    inputText: refs.input.current?.plainText ?? '',
    contextText: refs.context.current?.plainText ?? '',
    customWordText: refs.customWord.current?.value ?? '',
  };
}

function selectedIndex(state: WakaruState): number {
  return state.candidates.findIndex(
    (candidate) => candidate.id === state.selectedCandidateId
  );
}

function selectCandidateOffset(
  state: WakaruState,
  dispatch: (action: WakaruAction) => void,
  offset: 1 | -1
): void {
  if (!state.candidates.length) return;
  const index = selectedIndex(state);
  const safeIndex = index < 0 ? 0 : index;
  const next =
    state.candidates[
      (safeIndex + offset + state.candidates.length) % state.candidates.length
    ];
  dispatch({ type: 'select-candidate', candidateId: next?.id ?? null });
}

function canUseGlobalKey(renderer: CliRenderer, key: KeyEvent): boolean {
  if (key.ctrl || key.meta) return true;
  return renderer.currentFocusedEditor === null;
}

export function WakaruApp({ initialState, stop }: WakaruAppProps) {
  const renderer = useRenderer();
  const [state, setState] = useState(initialState);
  const [routeId, setRouteId] = useState<WakaruRouteId>('mine');
  const stateRef = useRef(state);
  const routeIdRef = useRef(routeId);
  const inputRef = useRef<TextareaRenderable>(null);
  const contextRef = useRef<TextareaRenderable>(null);
  const customWordRef = useRef<InputRenderable>(null);

  const inputRefs = useMemo<MineInputRefs>(
    () => ({
      input: inputRef,
      context: contextRef,
      customWord: customWordRef,
    }),
    []
  );

  const dispatch = useCallback((action: WakaruAction): void => {
    setState((current) => {
      const next = reduceWakaruState(current, action);
      stateRef.current = next;
      return next;
    });
  }, []);

  const navigate = useCallback((nextRouteId: WakaruRouteId): void => {
    routeIdRef.current = nextRouteId;
    setRouteId(nextRouteId);
  }, []);

  const actions = useMemo(
    () =>
      createWakaruActions({
        config: initialState.config,
        getState: () => stateRef.current,
        dispatch,
        navigate,
        stop,
      }),
    [dispatch, initialState.config, navigate, stop]
  );

  const syncInputs = useCallback((): void => {
    const snapshot = currentInputSnapshot(inputRefs);
    dispatch({ type: 'set-input', text: snapshot.inputText });
    dispatch({ type: 'set-context', text: snapshot.contextText });
    dispatch({ type: 'set-custom-word', text: snapshot.customWordText });
  }, [dispatch, inputRefs]);

  const navigateOffset = useCallback(
    (offset: 1 | -1): void => {
      const index = WAKARU_ROUTES.findIndex(
        (route) => route.id === routeIdRef.current
      );
      const safeIndex = index < 0 ? 0 : index;
      const next =
        WAKARU_ROUTES[
          (safeIndex + offset + WAKARU_ROUTES.length) % WAKARU_ROUTES.length
        ];
      if (next) navigate(next.id);
    },
    [navigate]
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    routeIdRef.current = routeId;
  }, [routeId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const tickTimer = setInterval(() => {
      dispatch({ type: 'tick', nowMs: Date.now() });
    }, TICK_MS);
    const toastTimer = setInterval(() => {
      dispatch({ type: 'prune-toasts', nowMs: Date.now() });
    }, TOAST_PRUNE_MS);
    return () => {
      clearInterval(tickTimer);
      clearInterval(toastTimer);
    };
  }, [dispatch]);

  useOnResize((width, height) => {
    dispatch({
      type: 'set-viewport',
      cols: clampViewportAxis(width, stateRef.current.viewportCols),
      rows: clampViewportAxis(height, stateRef.current.viewportRows),
    });
  });

  useKeyboard((key) => {
    if (key.eventType === 'release') return;

    if (key.ctrl && key.name === 'c') {
      key.preventDefault();
      void actions.stop();
      return;
    }
    if (key.ctrl && key.name === 'a') {
      key.preventDefault();
      syncInputs();
      void actions.analyzeInput();
      return;
    }
    if (key.ctrl && key.name === 'w') {
      key.preventDefault();
      syncInputs();
      void actions.analyzeCustomWord();
      return;
    }
    if (key.ctrl && key.name === 'e') {
      key.preventDefault();
      void actions.exportAnki();
      return;
    }

    if (!canUseGlobalKey(renderer, key)) return;

    if (key.name === 'q') void actions.stop();
    if (key.name === '1') actions.navigate('mine');
    if (key.name === '2') actions.navigate('library');
    if (key.name === '3') actions.navigate('settings');
    if (key.name === 'right') navigateOffset(1);
    if (key.name === 'left') navigateOffset(-1);
    if (key.name === 'up')
      selectCandidateOffset(stateRef.current, dispatch, -1);
    if (key.name === 'down')
      selectCandidateOffset(stateRef.current, dispatch, 1);
    if (key.name === 'return') void actions.addSelected();
    if (key.name === 'x') actions.skipSelected();
    if (key.name === 'c') actions.clearMine();
    if (key.name === 'd') dispatch({ type: 'toggle-details' });
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
          {WAKARU_ROUTES.map((route) => (
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
