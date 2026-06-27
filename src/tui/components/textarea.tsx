import type { TextareaRenderable } from '@opentui/core';
import type { TextareaProps as TuiTextareaProps } from '@opentui/react';
import type { Ref } from 'react';
import type { FocusableProps } from './types.js';

import { useCallback, useRef } from 'react';
import { useFocusable } from '../focus-context.js';
import { colorscheme } from '../theme';

type TextareaProps = Omit<
  TuiTextareaProps,
  'backgroundColor' | 'focusedBackgroundColor' | 'focused' | 'ref'
> &
  FocusableProps & {
    id: string;
    label: string;
    ref?: Ref<TextareaRenderable>;
  };

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export function Textarea({
  id,
  label,
  placeholder,
  cursorColor,
  ref,
  focusScope,
  onFocus,
  onBlur,
  onKeyDown,
  onMouseDown,
  ...params
}: TextareaProps) {
  const inputRef = useRef<TextareaRenderable>(null);
  const focused = useFocusable({
    id,
    ref: inputRef,
    scope: focusScope,
    onFocus,
    onBlur,
  });
  const setInputRef = useCallback(
    (input: TextareaRenderable | null) => {
      inputRef.current = input;
      assignRef(ref, input);
    },
    [ref]
  );

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  return (
    <box
      width="100%"
      border
      borderStyle="single"
      borderColor={focused ? colorscheme.primary : colorscheme.muted}
      backgroundColor={colorscheme.bg}
      paddingX={1}
      title={` ${label} `}
      titleColor={colorscheme.primary}
      onMouseDown={focusInput}
    >
      <textarea
        {...params}
        ref={setInputRef}
        id={id}
        width="100%"
        placeholder={placeholder ?? 'Enter text'}
        cursorColor={cursorColor ?? colorscheme.primary}
        backgroundColor={colorscheme.bg}
        textColor={colorscheme.text}
        focused={focused}
        onKeyDown={(key) => {
          onKeyDown?.(key);
          if (!key.defaultPrevented && key.name === 'escape') {
            inputRef.current?.blur();
          }
        }}
        onMouseDown={(event) => {
          const input = inputRef.current;
          if (input) onMouseDown?.call(input, event);
          if (!event.defaultPrevented) focusInput();
        }}
      />
    </box>
  );
}
