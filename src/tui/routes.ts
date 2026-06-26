import type { WakaruRouteId } from './types.js';

export const WAKARU_ROUTES: readonly Readonly<{
  id: WakaruRouteId;
  title: string;
}>[] = [
  { id: 'mine', title: 'Mine' },
  { id: 'library', title: 'Library' },
  { id: 'settings', title: 'Settings' },
];
