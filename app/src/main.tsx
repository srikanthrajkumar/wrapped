import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { openCatalog } from './catalog/current';
import { startServiceWorker } from './pwa';
import { db } from './store/db';
import { ensurePersistentStorage } from './store/persist';
import { pruneReceipts } from './store/receipts';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The home screen renders first, with nothing awaited (constitution I).
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Then, in the background: the service worker, the persistent-storage request (asked on each
// launch until the browser agrees), and the catalog, which upgrades stored Items on the launch
// after a new version was accepted.
startServiceWorker();
void ensurePersistentStorage().catch(() => undefined);
void openCatalog().catch(() => undefined);
// Undo receipts a crash left behind are dropped after a day (eng review D7).
void pruneReceipts(24 * 60 * 60 * 1000, db).catch(() => undefined);
