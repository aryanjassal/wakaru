export type ChatCommandId = 'addword' | 'temperature' | 'furigana';

export type ChatCommand = Readonly<{
  id: ChatCommandId;
  usage: string;
  description: string;
}>;

export type ChatCommandFragment = Readonly<{
  start: number;
  end: number;
  text: string;
  name: string;
  args: readonly string[];
}>;

export const CHAT_COMMANDS: readonly ChatCommand[] = [
  {
    id: 'addword',
    usage: '/addword',
    description: 'Attach saved words',
  },
  {
    id: 'temperature',
    usage: '/temperature <0-2>',
    description: 'Set response variation',
  },
  {
    id: 'furigana',
    usage: '/furigana [on|off]',
    description: 'Toggle reading annotations',
  },
] as const;

export function findChatCommand(
  text: string,
  cursorOffset: number
): ChatCommandFragment | null {
  const cursor = Math.max(0, Math.min(cursorOffset, text.length));
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
  const start = text.lastIndexOf('/', cursor - 1);
  if (start < lineStart) return null;

  const commandText = text.slice(start, cursor);
  const parts = commandText.slice(1).trimStart().split(/\s+/);
  return {
    start,
    end: cursor,
    text: commandText,
    name: (parts[0] ?? '').toLowerCase(),
    args: parts.slice(1).filter(Boolean),
  };
}

export function matchingChatCommands(
  fragment: ChatCommandFragment
): readonly ChatCommand[] {
  if (!fragment.name) return CHAT_COMMANDS;
  return CHAT_COMMANDS.filter((command) =>
    command.id.startsWith(fragment.name)
  );
}

export function removeChatCommand(
  text: string,
  fragment: ChatCommandFragment
): string {
  return `${text.slice(0, fragment.start)}${text.slice(fragment.end)}`;
}

export function parseTemperature(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const temperature = Number(value);
  return Number.isFinite(temperature) && temperature >= 0 && temperature <= 2
    ? temperature
    : null;
}
