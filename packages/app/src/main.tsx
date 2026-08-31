import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import { PageWindow } from './components/workspace/page-window';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).has('mode') ? <PageWindow /> : <App />}
  </StrictMode>
);
