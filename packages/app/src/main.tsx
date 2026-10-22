import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router';
import App from './app';
import { PreviewApp } from './preview/preview-app';
import './components/editor/monaco-workers';
import './main.css';

// Desktop loads the built document through file://; hash routes preserve that file path.
const createRouter = window.location.protocol === 'file:' ? createHashRouter : createBrowserRouter;
// eslint-disable-next-line react-refresh/only-export-components -- Router bootstrap mounts a lazy route, not a refreshable component module.
const CanvasPrototypeLab = lazy(() =>
  import('./canvas-prototype/lab').then((module) => ({ default: module.CanvasPrototypeLab })),
);
const router = createRouter([
  { path: '/', element: <App /> },
  { path: '/preview', element: <PreviewApp /> },
  {
    path: '/canvas-prototype',
    element: (
      <Suspense fallback={<p>正在加载画布原型…</p>}>
        <CanvasPrototypeLab />
      </Suspense>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
