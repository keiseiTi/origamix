import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router';
import App from './app';
import { PreviewApp } from './preview/preview-app';
import './components/editor/monaco-workers';
import './main.css';

// Desktop loads the built document through file://; hash routes preserve that file path.
const createRouter = window.location.protocol === 'file:' ? createHashRouter : createBrowserRouter;
const router = createRouter([
  { path: '/', element: <App /> },
  { path: '/preview', element: <PreviewApp /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
