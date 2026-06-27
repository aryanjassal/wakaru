import type { ReactNode } from 'react';
import type { SavedWord, TuiRouteId, TuiToast, WakaruConfig } from './types.js';
import type {
  TuiCommand,
  TuiCommandDisposer,
  TuiCommandId,
} from './commands.js';

import { createContext, useContext, useEffect, useRef } from 'react';

export type TuiToastLevel = TuiToast['level'];

export type TuiAppContextValue = Readonly<{
  config: WakaruConfig;
  savedWords: readonly SavedWord[];
  routeId: TuiRouteId;
  addSavedWord: (word: SavedWord) => void;
  addToast: (message: string, level?: TuiToastLevel) => void;
  navigate: (routeId: TuiRouteId) => void;
  navigateOffset: (offset: 1 | -1) => void;
  registerCommand: (command: TuiCommand) => TuiCommandDisposer;
  runCommand: (commandId: TuiCommandId) => Promise<boolean>;
  toggleCommandPalette: () => void;
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
