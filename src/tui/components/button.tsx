import type { TextRenderable } from '@opentui/core';
import type { TextProps } from '@opentui/react';
import type { TuiCommandId } from '../commands';
import type { FocusableProps } from './types.js';

import { TextAttributes } from '@opentui/core';
import { useBlur } from '@opentui/react';
import { useCallback, useId, useRef, useState } from 'react';
import { useTuiApp } from '../app-context';
import { useFocusable } from '../focus-context';
import { colorscheme } from '../theme';

type ButtonProps = Omit<
  TextProps,
  'content' | 'onKeyDown' | 'onMouseDown' | 'ref'
> &
  FocusableProps & {
    label: string;
    commandIdOrAction: TuiCommandId | (() => void);
  };

export function Button({
  id: providedId,
  label,
  commandIdOrAction,
  fg,
  bg,
  attributes,
  selectable,
  focusScope,
  onFocus,
  onBlur,
  onMouseUp,
  onMouseDragEnd,
  onMouseOut,
  ...params
}: ButtonProps) {
  const generatedId = useId();
  const id = providedId ?? `button-${generatedId}`;
  const buttonRef = useRef<TextRenderable>(null);
  const [pressed, setPressed] = useState(false);
  const { runCommand } = useTuiApp();
  const focused = useFocusable({
    id,
    ref: buttonRef,
    scope: focusScope,
    onFocus,
    onBlur,
  });

  const setButtonRef = useCallback((button: TextRenderable | null) => {
    buttonRef.current = button;
    if (button) button.focusable = true;
  }, []);

  const activate = useCallback(() => {
    if (typeof commandIdOrAction === 'function') {
      commandIdOrAction();
      return;
    }
    void runCommand(commandIdOrAction);
  }, [commandIdOrAction, runCommand]);

  useBlur(() => setPressed(false));

  return (
    <text
      {...params}
      ref={setButtonRef}
      id={id}
      selectable={selectable ?? false}
      content={` ${label} `}
      fg={focused ? colorscheme.bg : (fg ?? colorscheme.text)}
      bg={
        pressed
          ? colorscheme.bgDark
          : focused
            ? colorscheme.dark5
            : (bg ?? colorscheme.bgHighlight)
      }
      attributes={
        (attributes ?? TextAttributes.NONE) |
        (focused ? TextAttributes.BOLD : TextAttributes.NONE)
      }
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        setPressed(true);
        buttonRef.current?.blur();
        activate();
      }}
      onMouseUp={(event) => {
        const button = buttonRef.current;
        if (button) onMouseUp?.call(button, event);
        setPressed(false);
      }}
      onMouseDragEnd={(event) => {
        const button = buttonRef.current;
        if (button) onMouseDragEnd?.call(button, event);
        setPressed(false);
      }}
      onMouseOut={(event) => {
        const button = buttonRef.current;
        if (button) onMouseOut?.call(button, event);
        setPressed(false);
      }}
      onKeyDown={(key) => {
        if (key.name !== 'return' && key.name !== 'space') return;
        key.preventDefault();
        activate();
      }}
    />
  );
}
