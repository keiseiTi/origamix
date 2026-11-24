import { Toaster } from '@origamix/ui';
import { createRoot } from 'react-dom/client';
import { PreviewApp } from './preview-app';
import './preview.css';

createRoot(document.getElementById('root')!).render(
  <Toaster>
    <PreviewApp />
  </Toaster>,
);
