import type { KeyEvent } from '@opentui/core';

export type TuiCommandId = string;

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

export type TuiCommand = Readonly<{
  id: TuiCommandId;
  title: string;
  keybindings?: readonly TuiKeybinding[];
  global?: boolean;
  availability?: () => TuiCommandAvailability;
  run: () => void | Promise<void>;
}>;

export type TuiCommandDisposer = () => void;

export class TuiCommandRegistry {
  private readonly commands = new Map<TuiCommandId, TuiCommand>();
  private readonly keybindings = new Map<string, TuiCommandId>();
  private readonly commandKeybindings = new Map<
    TuiCommandId,
    readonly string[]
  >();

  register(command: TuiCommand): TuiCommandDisposer {
    this.unregister(command.id);
    this.commands.set(command.id, command);

    const keybindingIds = (command.keybindings ?? []).map(keybindingId);
    for (const id of keybindingIds) {
      this.keybindings.set(id, command.id);
    }
    this.commandKeybindings.set(command.id, keybindingIds);

    return () => {
      const current = this.commands.get(command.id);
      if (current === command) this.unregister(command.id);
    };
  }

  unregister(commandId: TuiCommandId): void {
    for (const keybinding of this.commandKeybindings.get(commandId) ?? []) {
      this.keybindings.delete(keybinding);
    }
    this.commandKeybindings.delete(commandId);
    this.commands.delete(commandId);
  }

  get(commandId: TuiCommandId): TuiCommand | null {
    return this.commands.get(commandId) ?? null;
  }

  list(): readonly TuiCommand[] {
    return [...this.commands.values()];
  }

  commandForKey(key: KeyEvent): TuiCommand | null {
    const commandId = this.keybindings.get(keyEventId(key));
    if (!commandId) return null;
    return this.get(commandId);
  }

  async execute(commandId: TuiCommandId): Promise<TuiCommandResult> {
    const command = this.get(commandId);
    if (!command) return { status: 'missing' };

    const availability = command.availability?.() ?? { status: 'available' };
    if (availability.status !== 'available') return availability;

    await command.run();
    return { status: 'ran' };
  }
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
