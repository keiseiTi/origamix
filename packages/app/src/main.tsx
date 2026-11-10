import { ProjectPreview } from './preview/project-preview';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router';
import App from './app';
import { PreviewApp } from './preview/preview-app';
import './main.css';

// Desktop loads the built document through file://; hash routes preserve that file path.
const createRouter = window.location.protocol === 'file:' ? createHashRouter : createBrowserRouter;
const isProjectPreview = document.querySelector('meta[name="origamix-project-preview"]') !== null;
const router = isProjectPreview
  ? null
  : createRouter([
      { path: '/', element: <App /> },
      { path: '/preview', element: <PreviewApp /> },
    ]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{router ? <RouterProvider router={router} /> : <ProjectPreview />}</StrictMode>,
);
