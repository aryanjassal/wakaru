import type { TextProps } from '@opentui/react';

import { useEffect, useState } from 'react';
import { colorscheme } from '../../lib/theme.js';

const BRAILLE_FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;
const DEFAULT_INTERVAL_MS = 80;

type LoaderProps = Omit<TextProps, 'content' | 'opacity'> & {
  label?: string;
  intervalMs?: number;
};

export function Loader({
  label = 'LOADING',
  intervalMs = DEFAULT_INTERVAL_MS,
  fg,
  height,
  selectable,
  ...props
}: LoaderProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((current) => (current + 1) % 100_000);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const frame = BRAILLE_FRAMES[tick % BRAILLE_FRAMES.length];
  const opacity = 0.65 + 0.35 * ((Math.sin(tick * 0.25) + 1) / 2);

  return (
    <text
      {...props}
      height={height ?? 1}
      content={`${frame} ${label}`}
      fg={fg ?? colorscheme.primary}
      opacity={opacity}
      selectable={selectable ?? false}
    />
  );
}
