import type { BoxProps } from '@opentui/react';

import { colorscheme } from '../../theme.js';

type SeparatorOrientation = 'horizontal' | 'vertical';

type SeparatorProps = Omit<BoxProps, 'border' | 'borderStyle' | 'children'> & {
  orientation?: SeparatorOrientation;
};

export function Separator({
  orientation = 'horizontal',
  width,
  height,
  borderColor,
  flexShrink,
  ...props
}: SeparatorProps) {
  const horizontal = orientation === 'horizontal';

  return (
    <box
      {...props}
      width={width ?? (horizontal ? '100%' : 1)}
      height={height ?? (horizontal ? 1 : '100%')}
      flexShrink={flexShrink ?? 0}
      border={horizontal ? ['top'] : ['left']}
      borderStyle="single"
      borderColor={borderColor ?? colorscheme.gutter}
    />
  );
}
