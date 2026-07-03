import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type {
  ClientConfig,
  SavedWord,
  TuiRoute,
  TuiRouteTarget,
  TuiToast,
} from '../types.js';
import type { Wakaru } from '@/core/wakaru.js';
import type {
  TuiCommand,
  TuiCommandDisposer,
  TuiCommandId,
} from '../../commands.js';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type TuiToastLevel = TuiToast['level'];

export type TuiAppContextValue = Readonly<{
  config: ClientConfig;
  wordsDir: string;
  wakaru: Wakaru;
  savedWords: readonly SavedWord[];
  route: TuiRoute;
  routeId: TuiRoute['id'];
  addSavedWord: (word: SavedWord) => void;
  addToast: (message: string, level?: TuiToastLevel) => void;
  navigate: (target: TuiRouteTarget) => void;
  navigateOffset: (offset: 1 | -1) => void;
  registerCommand: (command: TuiCommand) => TuiCommandDisposer;
  runCommand: (commandId: TuiCommandId) => Promise<boolean>;
  toggleCommandPalette: () => void;
  getRouteState: <T>(key: string) => T | undefined;
  setRouteState: <T>(key: string, state: T) => void;
  stop: (code?: number) => Promise<void>;
}>;

const TuiAppContext = createContext<TuiAppContextValue | null>(null);

export function TuiAppProvider({
  children,
  value,
}: Readonly<{
  children: ReactNode;
  value: TuiAppContextValue;
}>) {
  return (
    <TuiAppContext.Provider value={value}>{children}</TuiAppContext.Provider>
  );
}

export function useTuiApp(): TuiAppContextValue {
  const context = useContext(TuiAppContext);
  if (!context) {
    throw new Error('useTuiApp must be used inside TuiAppProvider.');
  }
  return context;
}

export function useTuiCommand(command: TuiCommand): void {
  const { registerCommand } = useTuiApp();
  const commandRef = useRef(command);
  commandRef.current = command;

  useEffect(() => {
    const registeredCommand: TuiCommand = {
      ...command,
      availability: () =>
        commandRef.current.availability?.() ?? {
          status: 'available',
        },
      run: () => commandRef.current.run(),
    };
    return registerCommand(registeredCommand);
  }, [command.id, registerCommand]);
}

export function useTuiCommandHandler(commandId: TuiCommandId): () => void {
  const { runCommand } = useTuiApp();
  return () => {
    void runCommand(commandId);
  };
}

export function usePersistentRouteState<T>(
  key: string,
  createInitialState: () => T
): readonly [T, Dispatch<SetStateAction<T>>] {
  const { getRouteState, setRouteState } = useTuiApp();
  const [state, setState] = useState(
    () => getRouteState<T>(key) ?? createInitialState()
  );

  const setPersistentState = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      setState((current) => {
        const next =
          typeof update === 'function'
            ? (update as (state: T) => T)(current)
            : update;
        setRouteState(key, next);
        return next;
      });
    },
    [key, setRouteState]
  );

  useEffect(() => {
    setRouteState(key, state);
  }, [key, setRouteState, state]);

  return [state, setPersistentState] as const;
}
