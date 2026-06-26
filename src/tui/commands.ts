import type { KeyEvent } from '@opentui/core';
import type { CoreCommand } from '@/core/commands.js';
import type { TuiCommandContext, TuiRouteId } from './types.js';

import { CoreCommandRegistry } from '@/core/commands.js';
import {
  addSelectedCandidate,
  analyzeWord,
  clearMine,
  exportAnki,
  navigateLibrary,
  navigateMine,
  navigateNext,
  navigatePrevious,
  navigateSettings,
  pasteClipboard,
  quit,
  selectNextCandidate,
  selectPreviousCandidate,
  skipSelectedCandidate,
  toggleCommandPalette,
  toggleDetails,
} from './actions.js';

export type TuiKeybinding = Readonly<{
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}>;

export type TuiCommandAvailability =
  | Readonly<{ status: 'available' }>
  | Readonly<{ status: 'disabled'; reason: string }>
  | Readonly<{ status: 'hidden' }>;

export type TuiCommandResult =
  | Readonly<{ status: 'ran' }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'disabled'; reason: string }>
  | Readonly<{ status: 'hidden' }>;

export type TuiCommand = CoreCommand<TuiCommandContext> &
  Readonly<{
    keybindings?: readonly TuiKeybinding[];
    global?: boolean;
    availability?: (context: TuiCommandContext) => TuiCommandAvailability;
  }>;

export class TuiCommandRegistry extends CoreCommandRegistry<
  TuiCommandContext,
  TuiCommand
> {
  private readonly keybindings = new Map<string, string>();
  private readonly commandKeybindings = new Map<string, readonly string[]>();

  override register(command: TuiCommand): void {
    for (const keybinding of this.commandKeybindings.get(command.id) ?? []) {
      this.keybindings.delete(keybinding);
    }

    super.register(command);
    const keybindingIds = (command.keybindings ?? []).map(keybindingId);
    for (const id of keybindingIds) {
      this.keybindings.set(id, command.id);
    }
    this.commandKeybindings.set(command.id, keybindingIds);
  }

  commandForKey(key: KeyEvent): TuiCommand | null {
    const commandId = this.keybindings.get(keyEventId(key));
    if (!commandId) return null;
    return this.get(commandId);
  }

  async execute(
    commandId: string,
    context: TuiCommandContext
  ): Promise<TuiCommandResult> {
    const command = this.get(commandId);
    if (!command) return { status: 'missing' };

    const availability = command.availability?.(context) ?? {
      status: 'available',
    };
    if (availability.status !== 'available') return availability;

    await command.run(context);
    return { status: 'ran' };
  }

  async executeForKey(
    key: KeyEvent,
    context: TuiCommandContext
  ): Promise<TuiCommandResult> {
    const command = this.commandForKey(key);
    if (!command) return { status: 'missing' };
    return this.execute(command.id, context);
  }
}

export function createTuiCommandRegistry(): TuiCommandRegistry {
  const registry = new TuiCommandRegistry();
  registerTuiCommands(registry);
  return registry;
}

export function registerTuiCommands(registry: TuiCommandRegistry): void {
  registry.register({
    id: 'app.quit',
    title: 'Quit',
    keybindings: [{ key: 'c', ctrl: true }, { key: 'q' }],
    run: quit,
  });

  registry.register({
    id: 'mine.analyzeWord',
    title: 'Analyze word',
    keybindings: [{ key: 'a', ctrl: true }],
    run: analyzeWord,
  });

  registry.register({
    id: 'library.exportAnki',
    title: 'Export Anki import file',
    keybindings: [{ key: 'e', ctrl: true }],
    run: exportAnki,
  });

  registry.register({
    id: 'commands.togglePalette',
    title: 'Toggle command palette',
    keybindings: [{ key: 'p', ctrl: true }],
    run: toggleCommandPalette,
  });

  registerNavigationCommands(registry);
  registerMineCommands(registry);
}

function registerNavigationCommands(registry: TuiCommandRegistry): void {
  const routes: readonly Readonly<{
    id: TuiRouteId;
    key: string;
    title: string;
    run: (context: TuiCommandContext) => void;
  }>[] = [
    { id: 'mine', key: '1', title: 'Go to Mine', run: navigateMine },
    { id: 'library', key: '2', title: 'Go to Library', run: navigateLibrary },
    {
      id: 'settings',
      key: '3',
      title: 'Go to Settings',
      run: navigateSettings,
    },
  ];

  for (const route of routes) {
    registry.register({
      id: `navigation.${route.id}`,
      title: route.title,
      keybindings: [{ key: route.key }],
      run: route.run,
    });
  }

  registry.register({
    id: 'navigation.next',
    title: 'Next view',
    keybindings: [{ key: 'right' }],
    run: navigateNext,
  });

  registry.register({
    id: 'navigation.previous',
    title: 'Previous view',
    keybindings: [{ key: 'left' }],
    run: navigatePrevious,
  });
}

function registerMineCommands(registry: TuiCommandRegistry): void {
  registry.register({
    id: 'candidate.previous',
    title: 'Previous candidate',
    keybindings: [{ key: 'up' }],
    availability: selectedCandidateRequired,
    run: selectPreviousCandidate,
  });

  registry.register({
    id: 'candidate.next',
    title: 'Next candidate',
    keybindings: [{ key: 'down' }],
    availability: selectedCandidateRequired,
    run: selectNextCandidate,
  });

  registry.register({
    id: 'candidate.addSelected',
    title: 'Add selected candidate',
    keybindings: [{ key: 'return' }],
    availability: selectedCandidateRequired,
    run: addSelectedCandidate,
  });

  registry.register({
    id: 'candidate.skipSelected',
    title: 'Skip selected candidate',
    keybindings: [{ key: 'x' }],
    availability: selectedCandidateRequired,
    run: skipSelectedCandidate,
  });

  registry.register({
    id: 'mine.clear',
    title: 'Clear mine input',
    keybindings: [{ key: 'c' }],
    run: clearMine,
  });

  registry.register({
    id: 'mine.toggleDetails',
    title: 'Toggle candidate details',
    keybindings: [{ key: 'd' }],
    availability: selectedCandidateRequired,
    run: toggleDetails,
  });

  registry.register({
    id: 'mine.pasteClipboard',
    title: 'Paste clipboard',
    run: pasteClipboard,
  });
}

function selectedCandidateRequired(
  context: TuiCommandContext
): TuiCommandAvailability {
  if (context.getRoute() !== 'mine') {
    return { status: 'disabled', reason: 'Only available in Mine.' };
  }
  if (!context.getState().selectedCandidateId) {
    return { status: 'disabled', reason: 'No word meaning is selected.' };
  }
  return { status: 'available' };
}

function keybindingId(keybinding: TuiKeybinding): string {
  return [
    keybinding.ctrl === true ? 'ctrl' : '',
    keybinding.meta === true ? 'meta' : '',
    keybinding.shift === true ? 'shift' : '',
    keybinding.key,
  ]
    .filter(Boolean)
    .join('+');
}

function keyEventId(key: KeyEvent): string {
  return keybindingId({
    key: key.name,
    ctrl: key.ctrl,
    meta: key.meta,
    shift: key.shift,
  });
}
