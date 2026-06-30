import type { CliRenderer, InputRenderable, KeyEvent } from '@opentui/core';
import type { TuiRoute, TuiRouteTarget, TuiState } from './lib/types';
import type { TuiCommand, TuiCommandId } from './commands';
import type { TuiToastLevel } from './lib/context/app';

import { TextAttributes } from '@opentui/core';
import { useKeyboard, useOnResize, useRenderer } from '@opentui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TuiCommandRegistry } from './commands';
import { TuiAppProvider, useTuiApp, useTuiCommand } from './lib/context/app';
import { FocusProvider } from './lib/context/focus';
import { toastText } from './lib/utils';
import { TUI_ROUTES } from './routes';
import { LibraryScreen } from './screens/library';
import { MineScreen } from './screens/mine/screen';
import { SettingsScreen } from './screens/settings';
import { ChatScreen } from './screens/chat/screen';
import { WordDetailScreen } from './screens/word-detail';
import {
  addSavedWord as addSavedWordToState,
  addToast as addToastToState,
  createToast,
  pruneToasts,
  setViewport,
} from './lib/state';
import { colorscheme, NAME, TAGLINE } from './lib/theme';
import { Button } from './components/primitives/button';
import { CommandPalette } from './components/index';

const TICK_MS = 1000;
const TOAST_PRUNE_MS = 3000;

const SHELL_COMMAND_IDS = {
  appQuit: 'app.quit',
  commandsTogglePalette: 'commands.togglePalette',
  navigationMine: 'navigation.mine',
  navigationLibrary: 'navigation.library',
  navigationChat: 'navigation.chat',
  navigationSettings: 'navigation.settings',
  navigationNext: 'navigation.next',
  navigationPrevious: 'navigation.previous',
} as const;

type TuiAppProps = Readonly<{
  initialState: TuiState;
  stop: (code?: number) => Promise<void>;
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

function canUseGlobalKey(renderer: CliRenderer, key: KeyEvent): boolean {
  if (key.ctrl || key.meta) return true;
  return renderer.currentFocusedEditor === null;
}

function ShellCommands() {
  const { navigate, navigateOffset, stop, toggleCommandPalette } = useTuiApp();

  // TODO: bring back ctrl-c termination and add ctrl-shift-c copying
  useTuiCommand({
    id: SHELL_COMMAND_IDS.appQuit,
    title: 'Quit',
    keybindings: [{ key: 'q' }],
    run: () => stop(),
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.commandsTogglePalette,
    title: 'Toggle command palette',
    keybindings: [{ key: 'p', ctrl: true }],
    run: toggleCommandPalette,
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.navigationMine,
    title: 'Go to Mine',
    keybindings: [{ key: '1' }],
    run: () => navigate('mine'),
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.navigationLibrary,
    title: 'Go to Library',
    keybindings: [{ key: '2' }],
    run: () => navigate('library'),
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.navigationChat,
    title: 'Go to Chat',
    keybindings: [{ key: '3' }],
    run: () => navigate('chat'),
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.navigationSettings,
    title: 'Go to Settings',
    keybindings: [{ key: '4' }],
    run: () => navigate('settings'),
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.navigationNext,
    title: 'Next view',
    keybindings: [{ key: 'right' }],
    run: () => navigateOffset(1),
  });

  useTuiCommand({
    id: SHELL_COMMAND_IDS.navigationPrevious,
    title: 'Previous view',
    keybindings: [{ key: 'left' }],
    run: () => navigateOffset(-1),
  });

  return null;
}

function commandSearchText(command: TuiCommand): string {
  return `${command.title} ${command.id}`.toLowerCase();
}

function CurrentRoute() {
  const { route } = useTuiApp();
  switch (route.id) {
    case 'mine':
      return <MineScreen />;
    case 'library':
      return <LibraryScreen />;
    case 'chat':
      return (
        <ChatScreen
          key={route.sessionId ?? 'default'}
          sessionId={route.sessionId}
          initialContexts={route.contexts}
        />
      );
    case 'settings':
      return <SettingsScreen />;
    case 'word-detail':
      return <WordDetailScreen item={route.item} returnTo={route.returnTo} />;
  }
}

function MainContent() {
  const { route } = useTuiApp();
  if (route.id === 'chat') {
    return (
      <box width="100%" flexGrow={1} flexBasis={0} minHeight={0}>
        <CurrentRoute />
      </box>
    );
  }
  return (
    <scrollbox
      width="100%"
      flexGrow={1}
      flexShrink={1}
      flexBasis={0}
      minHeight={0}
      scrollY
      scrollX={false}
    >
      <CurrentRoute />
    </scrollbox>
  );
}

export function TuiApp({ initialState, stop }: TuiAppProps) {
  const renderer = useRenderer();
  const [state, setState] = useState(initialState);
  const [route, setRoute] = useState<TuiRoute>({ id: 'mine' });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [commands, setCommands] = useState<readonly TuiCommand[]>([]);
  const stateRef = useRef(state);
  const routeRef = useRef(route);
  const routeStateRef = useRef(new Map<string, unknown>());
  const commandPaletteInputRef = useRef<InputRenderable>(null);
  const commandRegistry = useMemo(() => new TuiCommandRegistry(), []);

  const setTuiState = useCallback((update: (state: TuiState) => TuiState) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const addToast = useCallback(
    (message: string, level: TuiToastLevel = 'info'): void => {
      setTuiState((current) =>
        addToastToState(current, createToast(message, level))
      );
    },
    [setTuiState]
  );

  const addSavedWord = useCallback(
    (word: TuiState['savedWords'][number]): void => {
      setTuiState((current) => addSavedWordToState(current, word));
    },
    [setTuiState]
  );

  const navigate = useCallback((target: TuiRouteTarget): void => {
    const nextRoute: TuiRoute =
      typeof target === 'string' ? { id: target } : target;
    routeRef.current = nextRoute;
    setRoute(nextRoute);
    setShowCommandPalette(false);
  }, []);

  const navigateOffset = useCallback(
    (offset: 1 | -1): void => {
      const index = TUI_ROUTES.findIndex(
        (candidate) => candidate.id === routeRef.current.id
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

  const getRouteState = useCallback(<T,>(key: string): T | undefined => {
    return routeStateRef.current.get(key) as T | undefined;
  }, []);

  const setRouteState = useCallback(<T,>(key: string, value: T): void => {
    routeStateRef.current.set(key, value);
  }, []);

  const registerCommand = useCallback(
    (command: TuiCommand) => {
      const dispose = commandRegistry.register(command);
      setCommands(commandRegistry.list());
      return () => {
        dispose();
        setCommands(commandRegistry.list());
      };
    },
    [commandRegistry]
  );

  const runCommand = useCallback(
    async (commandId: TuiCommandId): Promise<boolean> => {
      const result = await commandRegistry.execute(commandId);
      if (result.status === 'disabled') addToast(result.reason, 'warning');
      return result.status === 'ran';
    },
    [addToast, commandRegistry]
  );

  const toggleCommandPalette = useCallback((): void => {
    setCommandQuery('');
    setCommandIndex(0);
    setShowCommandPalette((open) => !open);
  }, []);

  const visibleCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const filtered = query
      ? commands.filter((command) => commandSearchText(command).includes(query))
      : commands;
    return filtered.filter(
      (command) => command.availability?.().status !== 'hidden'
    );
  }, [commandQuery, commands]);

  const selectedCommand = visibleCommands[commandIndex] ?? null;

  const runPaletteCommand = useCallback(
    (commandId: TuiCommandId): void => {
      setShowCommandPalette(false);
      void runCommand(commandId);
    },
    [runCommand]
  );

  const appContext = useMemo(
    () => ({
      config: state.config,
      savedWords: state.savedWords,
      route,
      routeId: route.id,
      addSavedWord,
      addToast,
      navigate,
      navigateOffset,
      registerCommand,
      runCommand,
      toggleCommandPalette,
      getRouteState,
      setRouteState,
      stop,
    }),
    [
      addSavedWord,
      addToast,
      navigate,
      navigateOffset,
      getRouteState,
      registerCommand,
      route,
      runCommand,
      state.config,
      state.savedWords,
      stop,
      setRouteState,
      toggleCommandPalette,
    ]
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    if (!showCommandPalette) return;
    setCommandIndex(0);
    commandPaletteInputRef.current?.focus();
  }, [commandQuery, showCommandPalette]);

  useEffect(() => {
    if (commandIndex < visibleCommands.length) return;
    setCommandIndex(Math.max(0, visibleCommands.length - 1));
  }, [commandIndex, visibleCommands.length]);

  useEffect(() => {
    const tickTimer = setInterval(() => {
      setTuiState((current) => ({ ...current, nowMs: Date.now() }));
    }, TICK_MS);
    const toastTimer = setInterval(() => {
      setTuiState((current) => pruneToasts(current, Date.now()));
    }, TOAST_PRUNE_MS);
    return () => {
      clearInterval(tickTimer);
      clearInterval(toastTimer);
    };
  }, [setTuiState]);

  useOnResize((width, height) => {
    setTuiState((current) =>
      setViewport(
        current,
        clampViewportAxis(width, current.viewportCols),
        clampViewportAxis(height, current.viewportRows)
      )
    );
  });

  useKeyboard((key) => {
    if (key.eventType === 'release') return;

    if (showCommandPalette) {
      const paletteToggle = commandRegistry.commandForKey(key);
      if (paletteToggle?.id === SHELL_COMMAND_IDS.commandsTogglePalette) {
        key.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (key.name === 'escape') {
        key.preventDefault();
        setShowCommandPalette(false);
        return;
      }

      if (key.name === 'up') {
        key.preventDefault();
        setCommandIndex((index) =>
          visibleCommands.length
            ? (index - 1 + visibleCommands.length) % visibleCommands.length
            : 0
        );
        return;
      }

      if (key.name === 'down') {
        key.preventDefault();
        setCommandIndex((index) =>
          visibleCommands.length ? (index + 1) % visibleCommands.length : 0
        );
        return;
      }

      if (key.name === 'return') {
        key.preventDefault();
        if (!selectedCommand) return;
        runPaletteCommand(selectedCommand.id);
        return;
      }
    }

    const command = commandRegistry.commandForKey(key);
    if (!command) return;
    if (command.global !== true && !canUseGlobalKey(renderer, key)) return;

    key.preventDefault();
    void commandRegistry.execute(command.id).then((result) => {
      if (result.status !== 'disabled') return;
      addToast(result.reason, 'warning');
    });
  });

  return (
    <FocusProvider
      activeScope={showCommandPalette ? 'command-palette' : 'route'}
    >
      <TuiAppProvider value={appContext}>
        <ShellCommands />
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
            flexShrink={0}
            borderColor={colorscheme.gutter}
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
            <box
              id="wakaru-menu"
              width="100%"
              columnGap={2}
              flexDirection="row"
            >
              {TUI_ROUTES.map((navRoute) => (
                <Button
                  key={navRoute.id}
                  id={`wakaru-menu-${navRoute.id}`}
                  height={1}
                  fg={
                    navRoute.id === route.id ? colorscheme.bg : colorscheme.text
                  }
                  bg={
                    navRoute.id === route.id
                      ? colorscheme.primary
                      : colorscheme.bgHighlight
                  }
                  label={navRoute.title}
                  attributes={TextAttributes.BOLD}
                  action={() => navigate(navRoute.id)}
                />
              ))}
            </box>
            <box width="100%" flexDirection="row">
              <text
                id="wakaru-tooltip"
                height={1}
                fg={colorscheme.muted}
                content="ctrl+p commands · q quit"
                attributes={TextAttributes.ITALIC}
              />
              <box flexGrow={1} />
              <text
                id="wakaru-toasts"
                height={1}
                fg={colorscheme.warning}
                content={toastText(state.toasts)}
                wrapMode="word"
              />
            </box>
          </box>
          {showCommandPalette ? (
            <CommandPalette
              commands={visibleCommands}
              inputRef={commandPaletteInputRef}
              query={commandQuery}
              selectedIndex={commandIndex}
              onCommandRun={runPaletteCommand}
              onQueryChange={setCommandQuery}
              onSelectedIndexChange={setCommandIndex}
            />
          ) : null}
          <MainContent />
        </box>
      </TuiAppProvider>
    </FocusProvider>
  );
}
