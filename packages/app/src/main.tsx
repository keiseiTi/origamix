import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './app';
import { PreviewApp } from './preview/preview-app';
import './main.css';

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/preview', element: <PreviewApp /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
