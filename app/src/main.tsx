import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startServiceWorker } from './pwa';
import { ensurePersistentStorage } from './store/persist';
import './styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The home screen renders first, with nothing awaited (constitution I).
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Then, in the background: the service worker, and a one-time persistent-storage request.
startServiceWorker();
void ensurePersistentStorage().catch(() => undefined);
