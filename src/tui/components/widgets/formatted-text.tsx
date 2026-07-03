import type { TextProps } from '@opentui/react';
import type { ReactNode } from 'react';

import { Fragment, useMemo } from 'react';
import type { FormattedTextToken } from '@/client/formatting.js';

import {
  WakaruFormattingSyntaxError,
  parseFormattedText,
} from '@/client/formatting.js';
import { colorscheme } from '@/tui/lib/theme.js';

type FormattedTextProps = Omit<TextProps, 'children' | 'content'> &
  Readonly<{ value: string }>;

export function FormattedText({ value, ...props }: FormattedTextProps) {
  const tokens = useMemo<readonly FormattedTextToken[]>(() => {
    try {
      return parseFormattedText(value);
    } catch (error) {
      if (error instanceof WakaruFormattingSyntaxError) {
        return [{ kind: 'text', value }];
      }
      throw error;
    }
  }, [value]);
  const children: ReactNode[] = tokens.map((token, index) => {
    const key = `${token.kind}-${index}`;
    switch (token.kind) {
      case 'text':
        return <span key={key}>{token.value}</span>;
      case 'bold':
        return <strong key={key}>{token.value}</strong>;
      case 'italic':
        return <em key={key}>{token.value}</em>;
      case 'underline':
        return <u key={key}>{token.value}</u>;
      case 'reading':
        return (
          <Fragment key={key}>
            <span>{token.expression}</span>
            <span fg={colorscheme.muted}>[{token.reading}]</span>
          </Fragment>
        );
    }
  });

  return <text {...props}>{children}</text>;
}
