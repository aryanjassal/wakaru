import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router.js';
// @ts-expect-error
import '../styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element missing.');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
