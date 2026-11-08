import { useEffect, useRef, useState } from 'react';
import { Link, Redirect, Route, Switch, useLocation, useRoute } from 'wouter';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { cn } from '@/lib/utils';
import { ConcertSummary } from './screens/components/ConcertSummary';
import { ActionBar, BarProvider, type Bar } from './screens/components/layout';
import { EventScreen } from './screens/EventScreen';
import { FirstLaunch } from './screens/FirstLaunch';
import { HomeScreen } from './screens/HomeScreen';
import { ItemEditor } from './screens/ItemEditor';
import { Placeholder } from './screens/Placeholder';
import { preloadSettings, SettingsScreen } from './screens/SettingsScreen';
import { holdNewConcert } from './screens/new-concert';
import { leaveEvent } from './screens/undo';
import { db } from './store/db';
import { useFirstLaunchDone } from './store/first-launch';
import { clearReceipts } from './store/receipts';

// Navigation per plan.md DD1: three bottom tabs (Season, Wrapped, Settings). Event and Item
// open as pushed screens; the tab bar hides while the Item editor is open. The Schedule and Tidy
// are reached from Season, and the Maintainer's /admin from Settings.

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
 * Item and Appearance receipts are cleared once the location is no longer under it, except
 * those of a failed Undo, whose bar stays until it works or is dismissed.
 */
/**
 * While a Concert's pages are open (its Event screen, its Items), this tab holds the Concert's
 * lock, so another tab's Season never takes back a new Concert open here; leaving them runs the
 * untouched-Concert check inside that lock (screens/new-concert.ts).
 */
function useOpenConcertHeld() {
  const [path] = useLocation();
  const open = /^\/event\/([^/]+)/.exec(path)?.[1] ?? null;
  useEffect(() => {
    if (!open) return;
    const release = holdNewConcert(open);
    return () => {
      // Left only if the path no longer opens this Concert (not a remount on the same page).
      const now = window.location.pathname;
      const here = `/event/${open}`;
      void release(now !== here && !now.startsWith(`${here}/`));
    };
  }, [open]);
}

function useReceiptsClearedOnLeave() {
  const [path] = useLocation();
  const last = useRef<string | null>(null);
  useEffect(() => {
    const current = /^\/event\/([^/]+)/.exec(path)?.[1] ?? null;
    if (last.current && last.current !== current) {
      const left = last.current;
      // An open Undo bar for an Item or Artist of that Event goes with its receipt.
      const keep = leaveEvent(left);
      void clearReceipts(left, db, keep).catch(() => undefined);
    }
    last.current = current;
  }, [path]);
}

/**
 * The page keeps the sticky footer's height (its bottom action, any Undo bars, the tab bar) as
 * scroll padding, so a field focused behind the footer scrolls up above it. A field already
 * inside the viewport is not scrolled by the browser, padding or not, so one the footer covers
 * is scrolled up by hand. A text field is kept clear while it has focus and the page changes
 * height: one focused as its fold opens can't be scrolled clear until the page has grown, and
 * the fold's clipped content, scrolled by the focus, moves the field back down as it grows.
 */
function useFooterRoom(footer: HTMLElement | null, inset: number) {
  useEffect(() => {
    if (!footer) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.scrollPaddingBottom = `${footer.offsetHeight + inset}px`;
    });
    observer.observe(footer);
    let focused: ResizeObserver | undefined;
    const stop = () => {
      focused?.disconnect();
      focused = undefined;
    };
    const onFocus = (event: FocusEvent) => {
      stop();
      const field = event.target;
      const page = footer.previousElementSibling;
      // Only the page's own fields: a sheet sits over the footer.
      if (!(field instanceof HTMLElement) || !page?.contains(field)) return;
      const clear = () => {
        const covered = field.getBoundingClientRect().bottom - footer.getBoundingClientRect().top;
        if (covered > 0) window.scrollBy({ top: Math.ceil(covered) });
      };
      clear();
      if (!field.matches('input, textarea, [contenteditable]')) return;
      focused = new ResizeObserver(clear);
      focused.observe(page);
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', stop);
    return () => {
      observer.disconnect();
      stop();
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', stop);
      root.style.scrollPaddingBottom = '';
    };
  }, [footer, inset]);
}

export function App() {
  const done = useFirstLaunchDone();
  const [inItemEditor] = useRoute(ITEM_ROUTE);
  const [bar, setBar] = useState<Bar | null>(null);
  const inset = useKeyboardInset();
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  useFooterRoom(footer, inset);
  useReceiptsClearedOnLeave();
  useOpenConcertHeld();
  useEffect(() => {
    if (done) preloadSettings();
  }, [done]);

  // Until the store answers, only the dark background shows (no flash of the wrong screen).
  if (done === undefined) return null;

  return (
    <BarProvider value={bar}>
      <div className="flex min-h-dvh flex-col pt-[var(--app-top-inset,env(safe-area-inset-top))]">
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
              {/* The Schedule is in Season's timeline now (the Maintainer, 2026-11-08). */}
              <Route path="/schedule">
                <Redirect to="/" replace />
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
        {done && <ConcertSummary />}
        {done && (
          <footer ref={setFooter} className="sticky z-10" style={{ bottom: inset }}>
            <ActionBar onBar={setBar} />
            {inItemEditor ? (
              <div className="h-[env(safe-area-inset-bottom)] bg-background" />
            ) : (
              <TabBar />
            )}
          </footer>
        )}
      </div>
    </BarProvider>
  );
}
