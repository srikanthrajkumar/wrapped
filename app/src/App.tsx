import { useEffect, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { cn } from '@/lib/utils';
import { BottomSlot } from './screens/components/layout';
import { EventScreen } from './screens/EventScreen';
import { FirstLaunch } from './screens/FirstLaunch';
import { HomeScreen } from './screens/HomeScreen';
import { ItemEditor } from './screens/ItemEditor';
import { Placeholder } from './screens/Placeholder';
import { SettingsScreen } from './screens/SettingsScreen';
import { currentUndo, dismissUndo } from './screens/undo';
import { db } from './store/db';
import { useFirstLaunchDone } from './store/first-launch';
import { clearReceipts } from './store/receipts';

// Navigation per plan.md DD1: three bottom tabs (Season, Wrapped, Settings). Event and Item
// open as pushed screens; the tab bar hides while the Item editor is open. Tidy is reached
// from Season, and the Maintainer's /admin from Settings.

const ITEM_ROUTE = '/event/:eventId/item/:itemId';

const TABS = [
  {
    href: '/',
    label: 'Season',
    owns: (path: string) => !/^\/(wrapped|settings|admin)\b/.test(path),
  },
  { href: '/wrapped', label: 'Wrapped', owns: (path: string) => path.startsWith('/wrapped') },
  {
    href: '/settings',
    label: 'Settings',
    owns: (path: string) => /^\/(settings|admin)\b/.test(path),
  },
];

function TabBar() {
  const [path] = useLocation();
  return (
    <nav
      aria-label="Main"
      className="flex border-t border-border bg-background pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      {TABS.map((tab) => {
        const current = tab.owns(path);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              // Tab labels grow with the phone's text only to 1.4x, as native tab bars do, so
              // three always fit on a 320px phone.
              'flex min-h-12 min-w-0 flex-1 items-center justify-center px-1 text-center text-[min(var(--text-sub),21px)]',
              current ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * "Recently deleted" lasts until the rasika leaves the Event (design D16, eng review D7): its
 * Item and Appearance receipts are cleared once the location is no longer under it.
 */
function useReceiptsClearedOnLeave() {
  const [path] = useLocation();
  const last = useRef<string | null>(null);
  useEffect(() => {
    const current = /^\/event\/([^/]+)/.exec(path)?.[1] ?? null;
    if (last.current && last.current !== current) {
      const left = last.current;
      // An open Undo bar for an Item or Artist of that Event goes with its receipt.
      const offer = currentUndo();
      if (offer && offer.receipt.eventId === left && offer.receipt.kind !== 'event') dismissUndo();
      void clearReceipts(left, db);
    }
    last.current = current;
  }, [path]);
}

export function App() {
  const done = useFirstLaunchDone();
  const [inItemEditor] = useRoute(ITEM_ROUTE);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const inset = useKeyboardInset();
  useReceiptsClearedOnLeave();

  // Until the store answers, only the dark background shows (no flash of the wrong screen).
  if (done === undefined) return null;

  return (
    <BottomSlot.Provider value={slot}>
      <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)]">
        <main className="flex flex-1 flex-col pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(16px+env(safe-area-inset-left))]">
          {!done ? (
            <FirstLaunch />
          ) : (
            <Switch>
              <Route path="/">
                <HomeScreen />
              </Route>
              <Route path={ITEM_ROUTE}>
                {({ eventId, itemId }) => <ItemEditor eventId={eventId} itemId={itemId} />}
              </Route>
              <Route path="/event/:eventId">
                {({ eventId }) => <EventScreen eventId={eventId} />}
              </Route>
              <Route path="/tidy">
                <Placeholder title="Tidy" back="/" />
              </Route>
              <Route path="/wrapped">
                <Placeholder title="Wrapped" />
              </Route>
              <Route path="/settings">
                <SettingsScreen />
              </Route>
              <Route path="/admin">
                <Placeholder title="Review" back="/settings" />
              </Route>
              <Route>
                <Placeholder title="Not found" back="/" />
              </Route>
            </Switch>
          )}
        </main>
        {done && (
          <footer className="sticky z-10" style={{ bottom: inset }}>
            <div ref={setSlot} />
            {inItemEditor ? (
              <div className="h-[env(safe-area-inset-bottom)] bg-background" />
            ) : (
              <TabBar />
            )}
          </footer>
        )}
      </div>
    </BottomSlot.Provider>
  );
}
