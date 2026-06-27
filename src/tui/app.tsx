import type { CliRenderer, InputRenderable, KeyEvent } from '@opentui/core';
import type { TuiRouteId, TuiState } from './types.js';
import type { TuiCommand, TuiCommandId } from './commands.js';
import type { TuiToastLevel } from './app-context.js';

import { TextAttributes } from '@opentui/core';
import { useKeyboard, useOnResize, useRenderer } from '@opentui/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TuiCommandRegistry } from './commands.js';
import { TuiAppProvider, useTuiApp, useTuiCommand } from './app-context.js';
import { FocusProvider, useFocusable } from './focus-context.js';
import { toastText } from './format.js';
import { TUI_ROUTES } from './routes.js';
import { LibraryScreen } from './screens/library.js';
import { MineScreen } from './screens/mine/screen.js';
import { SettingsScreen } from './screens/settings.js';
import {
  addSavedWord as addSavedWordToState,
  addToast as addToastToState,
  createToast,
  pruneToasts,
  setViewport,
} from './state.js';
import { colorscheme, NAME, TAGLINE } from './theme.js';

const TICK_MS = 1000;
const TOAST_PRUNE_MS = 3000;

const SHELL_COMMAND_IDS = {
  appQuit: 'app.quit',
  commandsTogglePalette: 'commands.togglePalette',
  navigationMine: 'navigation.mine',
  navigationLibrary: 'navigation.library',
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

  useTuiCommand({
    id: SHELL_COMMAND_IDS.appQuit,
    title: 'Quit',
    keybindings: [{ key: 'c', ctrl: true }, { key: 'q' }],
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
    id: SHELL_COMMAND_IDS.navigationSettings,
    title: 'Go to Settings',
    keybindings: [{ key: '3' }],
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

function commandPaletteRows(
  commands: readonly TuiCommand[],
  selectedIndex: number
): string {
  if (!commands.length) return 'No commands found.';
  return commands
    .map((command, index) => {
      const marker = index === selectedIndex ? '>' : ' ';
      const key = (command.keybindings ?? [])
        .map((binding) =>
          [
            binding.ctrl === true ? 'ctrl' : '',
            binding.meta === true ? 'meta' : '',
            binding.shift === true ? 'shift' : '',
            binding.key,
          ]
            .filter(Boolean)
            .join('+')
        )
        .join(', ');
      return [
        marker,
        command.title.padEnd(28, ' '),
        key ? key.padEnd(12, ' ') : ''.padEnd(12, ' '),
        command.id,
      ].join(' ');
    })
    .join('\n');
}

function CommandPalette({
  commands,
  inputRef,
  query,
  selectedIndex,
  onQueryChange,
}: Readonly<{
  commands: readonly TuiCommand[];
  inputRef: RefObject<InputRenderable | null>;
  query: string;
  selectedIndex: number;
  onQueryChange: (query: string) => void;
}>) {
  useFocusable({
    id: 'command-palette-input',
    ref: inputRef,
    scope: 'command-palette',
  });

  return (
    <box
      id="command-palette-overlay"
      position="absolute"
      left={0}
      right={0}
      top={0}
      bottom={0}
      zIndex={100}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <box
        id="command-palette"
        width={76}
        height={17}
        flexDirection="column"
        rowGap={1}
        border
        borderStyle="single"
        borderColor={colorscheme.primary}
        backgroundColor={colorscheme.bg}
        padding={1}
        title=" Commands "
        titleColor={colorscheme.primary}
      >
        <input
          ref={inputRef}
          id="command-palette-input"
          width="100%"
          value={query}
          placeholder="Search commands"
          backgroundColor={colorscheme.bgDark}
          focusedBackgroundColor={colorscheme.bgSecondary}
          textColor={colorscheme.text}
          cursorColor={colorscheme.primary}
          onContentChange={() => {
            onQueryChange(inputRef.current?.value ?? '');
          }}
        />
        <scrollbox
          id="command-palette-scroll"
          width="100%"
          height={11}
          scrollY
          scrollX={false}
          border
          borderStyle="single"
          borderColor={colorscheme.gutter}
          backgroundColor={colorscheme.bgDark}
          paddingX={1}
        >
          <text
            id="command-palette-list"
            height={Math.max(1, commands.length)}
            fg={colorscheme.text}
            content={commandPaletteRows(commands, selectedIndex)}
          />
        </scrollbox>
      </box>
    </box>
  );
}

function CurrentRoute() {
  const { routeId } = useTuiApp();
  switch (routeId) {
    case 'mine':
      return <MineScreen />;
    case 'library':
      return <LibraryScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export function TuiApp({ initialState, stop }: TuiAppProps) {
  const renderer = useRenderer();
  const [state, setState] = useState(initialState);
  const [routeId, setRouteId] = useState<TuiRouteId>('mine');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [commands, setCommands] = useState<readonly TuiCommand[]>([]);
  const stateRef = useRef(state);
  const routeIdRef = useRef(routeId);
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

  const navigate = useCallback((nextRouteId: TuiRouteId): void => {
    routeIdRef.current = nextRouteId;
    setRouteId(nextRouteId);
    setShowCommandPalette(false);
  }, []);

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

  const appContext = useMemo(
    () => ({
      config: state.config,
      savedWords: state.savedWords,
      routeId,
      addSavedWord,
      addToast,
      navigate,
      navigateOffset,
      registerCommand,
      runCommand,
      toggleCommandPalette,
      stop,
    }),
    [
      addSavedWord,
      addToast,
      navigate,
      navigateOffset,
      registerCommand,
      routeId,
      runCommand,
      state.config,
      state.savedWords,
      stop,
      toggleCommandPalette,
    ]
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    routeIdRef.current = routeId;
  }, [routeId]);

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
        setShowCommandPalette(false);
        void runCommand(selectedCommand.id);
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
              {TUI_ROUTES.map((route) => (
                <text
                  key={route.id}
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
          {showCommandPalette ? (
            <CommandPalette
              commands={visibleCommands}
              inputRef={commandPaletteInputRef}
              query={commandQuery}
              selectedIndex={commandIndex}
              onQueryChange={setCommandQuery}
            />
          ) : null}
          <CurrentRoute />
          <text
            id="wakaru-toasts"
            height={3}
            fg={colorscheme.warning}
            content={toastText(state.toasts)}
            wrapMode="word"
          />
        </box>
      </TuiAppProvider>
    </FocusProvider>
  );
}
