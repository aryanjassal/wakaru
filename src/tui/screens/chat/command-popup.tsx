import type { ChatCommand } from './commands.js';

import { TextAttributes } from '@opentui/core';
import { colorscheme } from '../../lib/theme.js';

export function ChatCommandPopup({
  commands,
  selectedIndex,
}: Readonly<{
  commands: readonly ChatCommand[];
  selectedIndex: number;
}>) {
  return (
    <box
      position="absolute"
      left={2}
      bottom={6}
      zIndex={20}
      width={56}
      height={5}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={colorscheme.primary}
      backgroundColor={colorscheme.bgDark}
      paddingX={1}
    >
      {commands.length ? (
        commands.map((command, index) => (
          <box
            key={command.id}
            width="100%"
            height={1}
            flexDirection="row"
            backgroundColor={
              index === selectedIndex
                ? colorscheme.bgHighlight
                : colorscheme.bgDark
            }
          >
            <text
              width={24}
              height={1}
              content={command.usage}
              fg={
                index === selectedIndex ? colorscheme.primary : colorscheme.text
              }
              attributes={
                index === selectedIndex
                  ? TextAttributes.BOLD
                  : TextAttributes.NONE
              }
              selectable={false}
            />
            <text
              height={1}
              content={command.description}
              fg={colorscheme.muted}
              selectable={false}
            />
          </box>
        ))
      ) : (
        <text content="No matching command" fg={colorscheme.muted} />
      )}
    </box>
  );
}
