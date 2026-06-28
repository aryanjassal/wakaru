import type { TuiCommand, TuiCommandId } from '../../commands';
import type { InputRenderable, ScrollBoxRenderable } from '@opentui/core';

import React from 'react';
import { TextAttributes } from '@opentui/core';
import { useFocusable } from '../../lib/context/focus.js';
import { colorscheme } from '../../lib/theme';

function commandPaletteRowId(commandId: TuiCommandId): string {
  return `command-palette-command-${commandId}`;
}

function commandKeybindings(command: TuiCommand): string {
  return (command.keybindings ?? [])
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
}

function CommandPaletteRow({
  command,
  selected,
  onRun,
  onSelect,
}: Readonly<{
  command: TuiCommand;
  selected: boolean;
  onRun: () => void;
  onSelect: () => void;
}>) {
  const keybindings = commandKeybindings(command);
  const content = [
    selected ? '>' : ' ',
    command.title.padEnd(28, ' '),
    keybindings.padEnd(12, ' '),
    command.id,
  ].join(' ');

  return (
    <box
      id={commandPaletteRowId(command.id)}
      width="100%"
      height={1}
      backgroundColor={selected ? colorscheme.bgHighlight : colorscheme.bgDark}
      onMouseOver={onSelect}
      onMouseDown={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <text
        width="100%"
        height={1}
        content={content}
        fg={selected ? colorscheme.primary : colorscheme.text}
        attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}
        selectable={false}
        wrapMode="none"
      />
    </box>
  );
}

export function CommandPalette({
  commands,
  inputRef,
  query,
  selectedIndex,
  onCommandRun,
  onQueryChange,
  onSelectedIndexChange,
}: Readonly<{
  commands: readonly TuiCommand[];
  inputRef: React.RefObject<InputRenderable | null>;
  query: string;
  selectedIndex: number;
  onCommandRun: (commandId: TuiCommandId) => void;
  onQueryChange: (query: string) => void;
  onSelectedIndexChange: (index: number) => void;
}>) {
  const scrollRef = React.useRef<ScrollBoxRenderable>(null);

  useFocusable({
    id: 'command-palette-input',
    ref: inputRef,
    scope: 'command-palette',
  });

  React.useEffect(() => {
    const scrollbox = scrollRef.current;
    const selectedCommand = commands[selectedIndex];
    if (!scrollbox || !selectedCommand) return;
    scrollbox.scrollChildIntoView(commandPaletteRowId(selectedCommand.id));
  }, [commands, selectedIndex]);

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
        width="66%"
        height="66%"
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
          ref={scrollRef}
          id="command-palette-scroll"
          width="100%"
          height="100%"
          scrollY
          scrollX={false}
          border
          borderStyle="single"
          borderColor={colorscheme.gutter}
          backgroundColor={colorscheme.bgDark}
          paddingX={1}
        >
          {commands.length ? (
            commands.map((command, index) => (
              <CommandPaletteRow
                key={command.id}
                command={command}
                selected={index === selectedIndex}
                onSelect={() => onSelectedIndexChange(index)}
                onRun={() => onCommandRun(command.id)}
              />
            ))
          ) : (
            <text
              id="command-palette-empty"
              height={1}
              content="No commands found."
              fg={colorscheme.muted}
              selectable={false}
            />
          )}
        </scrollbox>
      </box>
    </box>
  );
}
