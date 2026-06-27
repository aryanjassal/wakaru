import type { TextRenderable } from '@opentui/core';
import type { TextProps } from '@opentui/react';
import type { TuiAppContextValue } from '../../lib/context/app.js';
import type { FocusableProps } from '../types.js';

import { TextAttributes } from '@opentui/core';
import { useBlur } from '@opentui/react';
import { useCallback, useId, useRef, useState } from 'react';
import { useTuiApp } from '../../lib/context/app.js';
import { useFocusable } from '../../lib/context/focus.js';
import { colorscheme } from '../../theme.js';

type ButtonProps = Omit<
  TextProps,
  'content' | 'onKeyDown' | 'onMouseDown' | 'ref'
> &
  FocusableProps & {
    label: string;
    action?: (ctx: TuiAppContextValue) => unknown;
  };

export function Button({
  id: providedId,
  label,
  fg,
  bg,
  attributes,
  selectable,
  focusScope,
  action,
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
  const actionContext = useTuiApp();
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

  useBlur(() => setPressed(false));

  return (
    <text
      {...params}
      ref={setButtonRef}
      id={id}
      selectable={selectable ?? false}
      content={` ${label} `}
      fg={
        pressed
          ? colorscheme.text
          : focused
            ? colorscheme.bg
            : (fg ?? colorscheme.text)
      }
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
        void action?.(actionContext);
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
        void action?.(actionContext);
      }}
    />
  );
}
