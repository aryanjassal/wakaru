import type { TuiPrimaryRouteId } from './lib/types.js';

export const TUI_ROUTES: readonly Readonly<{
  id: TuiPrimaryRouteId;
  title: string;
}>[] = [
  { id: 'mine', title: 'Mine' },
  { id: 'library', title: 'Library' },
  { id: 'chat', title: 'Chat' },
  { id: 'settings', title: 'Settings' },
];
