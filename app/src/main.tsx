import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { openCatalog } from './catalog/current';
import { startServiceWorker } from './pwa';
import { StoreGate } from './screens/RescueScreen';
import { saveFeedback } from './screens/save-feedback';
import { db } from './store/db';
import { watchStore } from './store/health';
import { ensurePersistentStorage } from './store/persist';
import { pruneReceipts } from './store/receipts';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The home screen renders first, with nothing awaited (constitution I). If the store won't open,
// the rescue screen still offers the values not saved for Export.
watchStore(db);
createRoot(root).render(
  <StrictMode>
    <StoreGate>
      <App />
    </StoreGate>
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
// Values copied back from before a relaunch that the store holds after all are let go.
void saveFeedback.reconcile((table, id) => db.table(table).get(id)).catch(() => undefined);
