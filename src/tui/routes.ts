import type { TuiRouteId } from './lib/types.js';

export const TUI_ROUTES: readonly Readonly<{
  id: TuiRouteId;
  title: string;
}>[] = [
  { id: 'mine', title: 'Mine' },
  { id: 'library', title: 'Library' },
  { id: 'settings', title: 'Settings' },
];
