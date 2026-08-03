import { Navigate, createHashRouter } from 'react-router';
import { App } from './App.js';
import { LibraryScreen } from './Library.js';
import { MineScreen } from './Mine.js';
import { SettingsScreen } from './Settings.js';

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/mine" replace /> },
      { path: 'mine', element: <MineScreen /> },
      { path: 'library', element: <LibraryScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);
