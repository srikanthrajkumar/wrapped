import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { openCatalog } from './catalog/current';
import { watchInstall } from './install';
import { startServiceWorker } from './pwa';
import { StoreGate } from './screens/RescueScreen';
import { saveFeedback } from './screens/save-feedback';
import { failedUndoReceipts } from './screens/undo';
import { db } from './store/db';
import { storeHealth, subscribeStoreHealth, watchStore } from './store/health';
import { holdsValue, storedHolds } from './store/journal-check';
import { ensurePersistentStorage } from './store/persist';
import { pruneReceipts } from './store/receipts';
import { startScheduleFetch } from './store/schedule-fetch';
import { startSync } from './store/sync-runtime';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Android's install prompt can come before the first render; it is kept for the install row.
watchInstall();

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
// The Schedule, when this build has a feed: applied as stored, then fetched when online (T060).
startScheduleFetch();
// Sync (FR-014): on start, `online`, the app shown again and each save. Each sync waits for the
// catalog, so pulled Items are remapped to it; without a signed-in session it does nothing.
startSync({ getRemap: async () => (await openCatalog().catch(() => null))?.remap });
// Undo receipts a crash left behind are dropped after a day (eng review D7), except those a
// failed Undo bar still offers.
void pruneReceipts(24 * 60 * 60 * 1000, db, Date.now(), failedUndoReceipts()).catch(
  () => undefined,
);
// A journal entry leaves once the store is read back holding its value (docs/adr/0007): those
// from before a relaunch now, and each new one after its write.
// Screens use the same projections to tell when what they read back is the value entered.
saveFeedback.confirmWith((entry) => holdsValue(entry, db), storedHolds);
void saveFeedback.reconcile().catch(() => undefined);
// A store slow to open is checked again once it opens.
const unwatch = subscribeStoreHealth(() => {
  if (storeHealth().state !== 'open') return;
  unwatch();
  void saveFeedback.reconcile().catch(() => undefined);
});
// One window: the journal is read again only when the page is shown again, and checked then.
window.addEventListener('pageshow', () => saveFeedback.reload());
