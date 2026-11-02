import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { openCatalog } from './catalog/current';
import { startServiceWorker } from './pwa';
import { StoreGate } from './screens/RescueScreen';
import { saveFeedback } from './screens/save-feedback';
import { failedUndoReceipts } from './screens/undo';
import { db } from './store/db';
import { watchStore } from './store/health';
import { holdsValue } from './store/journal-check';
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
// Undo receipts a crash left behind are dropped after a day (eng review D7), except those a
// failed Undo bar still offers.
void pruneReceipts(24 * 60 * 60 * 1000, db, Date.now(), failedUndoReceipts()).catch(
  () => undefined,
);
// A journal entry leaves once the store is read back holding its value (docs/adr/0007): those
// from before a relaunch now, and each new one after its write.
saveFeedback.confirmWith((entry) => holdsValue(entry, db));
void saveFeedback.reconcile().catch(() => undefined);
// One window: the journal is read again only when the page is shown again.
window.addEventListener('pageshow', () => saveFeedback.reload());
