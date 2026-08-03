import type { HTMLAttributes } from 'react';

import { cn } from '@/renderer/src/lib/utils';

export function Separator({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="separator"
      className={cn('h-px w-full bg-border', className)}
      {...props}
    />
  );
}
