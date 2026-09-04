import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router';
import App from './app';
import { PageWindow } from './components/workspace/page-window';
import './main.css';

const router = createHashRouter([
  { path: '/', element: <App /> },
  { path: '/preview', element: <PageWindow /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
