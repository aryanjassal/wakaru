import './styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { syncSystemTheme } from './lib/theme.js';
import { router } from './pages/Router.js';

syncSystemTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element missing.');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
