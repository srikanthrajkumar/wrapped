import { IconHome, IconNotebook, IconSettings, IconStar, type Icon } from '@tabler/icons-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Redirect, Route, Switch, useLocation, useRoute } from 'wouter';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { cn } from '@/lib/utils';
import { ConcertSummary } from './screens/components/ConcertSummary';
import { InstallStrip } from './screens/components/InstallRow';
import { ActionBar, BarProvider, type Bar } from './screens/components/layout';
import { DiaryScreen } from './screens/DiaryScreen';
import { EventScreen } from './screens/EventScreen';
import { FirstLaunch } from './screens/FirstLaunch';
import { HubScreen } from './screens/HubScreen';
import { ItemEditor } from './screens/ItemEditor';
import { MESSAGES } from './screens/messages';
import {
  arrive,
  enterTab,
  forgetScroll,
  navState,
  subscribeNav,
  TAB_ROOT,
  tabTarget,
  WHATS_ON,
  type Tab,
} from './screens/nav';
import { Placeholder } from './screens/Placeholder';
import { preloadSettings, SettingsScreen, useSettingsToFix } from './screens/SettingsScreen';
import { ShortlistScreen } from './screens/ShortlistScreen';
import { ToPast, WhatsOnScreen } from './screens/WhatsOnScreen';
import { holdNewConcert } from './screens/new-concert';
import { leaveEvent } from './screens/undo';
import { db } from './store/db';
import { useFirstLaunchDone } from './store/first-launch';
import { clearReceipts } from './store/receipts';

// Navigation (DESIGN.md "Navigation"; the Maintainer, 2026-11-11 and 2026-11-13): four bottom
// tabs: one per stage of a concert, Season (the hub), Shortlist and Diary, then Settings, with
// an amber dot while one of its rows needs fixing. What's on is one tap below Season. Each tab keeps its own back stack (screens/nav.ts); an Event
// and its Items open in the tab they were reached from, with the tab bar still in view, which
// hides only while the Item editor is open. The tab that is on, tapped, returns to its top.

const ITEM_ROUTE = '/event/:eventId/item/:itemId';

const TABS: { tab: Tab; label: string; icon: Icon }[] = [
  { tab: 'season', label: MESSAGES.tabs.season, icon: IconHome },
  { tab: 'shortlist', label: MESSAGES.tabs.shortlist, icon: IconStar },
  { tab: 'diary', label: MESSAGES.tabs.diary, icon: IconNotebook },
  { tab: 'settings', label: MESSAGES.tabs.settings, icon: IconSettings },
];

function TabBar() {
  const [path] = useLocation();
  const nav = useSyncExternalStore(subscribeNav, navState);
  const toFix = useSettingsToFix();
  return (
    <nav
      aria-label="Main"
      className="flex border-t border-border bg-background pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      {TABS.map(({ tab, label, icon: Mark }) => {
        const current = nav.tab === tab;
        const fix = tab === 'settings' && toFix;
        return (
          <Link
            key={tab}
            href={tabTarget(nav, tab)}
            aria-current={current ? 'page' : undefined}
            aria-label={fix ? MESSAGES.spine.settingsToFix : undefined}
            onClick={(event) => {
              if (!current) return enterTab(tab, tabTarget(nav, tab));
              // The tab that is on returns to its top: its root, at the top of the page.
              forgetScroll(TAB_ROOT[tab]);
              if (path !== TAB_ROOT[tab]) return;
              event.preventDefault();
              window.scrollTo(0, 0);
            }}
            className={cn(
              // An icon over its word, 56px. The words grow with the phone's text only to 1.4x,
              // as native tab bars do, so four always fit on a 320px phone. A tab that isn't on
              // is a step dimmer than muted text (the council, 2026-11-13: in a dim hall the one
              // that is on hardly stood out).
              'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-[min(var(--text-caption),18px)] leading-4',
              current ? 'font-semibold text-foreground' : 'text-tab-idle',
            )}
          >
            <span className="relative">
              <Mark aria-hidden className="size-[22px] shrink-0" />
              {/* Amber is "something to fix", and nothing else (DESIGN.md "Colours"). */}
              {fix && (
                <span
                  aria-hidden
                  data-to-fix
                  className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-warning ring-2 ring-background"
                />
              )}
            </span>
            {label}
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
  const [path] = useLocation();
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
  // Before any screen draws: which tab the page is in, and which way the rasika went.
  if (done) arrive(path);

  return (
    <BarProvider value={bar}>
      <div className="flex min-h-dvh flex-col pt-[var(--app-top-inset,env(safe-area-inset-top))]">
        {/* The band under the iOS status bar, painted by the shell above what scrolls; clear
            over the hub's curtain (DESIGN.md "The status bar"). */}
        {done && (
          <div
            aria-hidden
            data-status-band
            className="pointer-events-none fixed inset-x-0 top-0 z-30 status-band"
          />
        )}
        <main className="flex flex-1 flex-col pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(16px+env(safe-area-inset-left))]">
          {!done ? (
            <FirstLaunch />
          ) : (
            <Switch>
              <Route path="/">
                <HubScreen />
              </Route>
              <Route path={WHATS_ON}>
                <WhatsOnScreen />
              </Route>
              <Route path="/shortlist">
                <ShortlistScreen />
              </Route>
              <Route path="/diary">
                <DiaryScreen />
              </Route>
              {/* The Earlier page is What's on's days gone now (the Maintainer, 2026-11-09). */}
              <Route path="/earlier">
                <ToPast />
              </Route>
              <Route path={ITEM_ROUTE}>
                {({ eventId, itemId }) => <ItemEditor eventId={eventId} itemId={itemId} />}
              </Route>
              <Route path="/event/:eventId">
                {({ eventId }) => <EventScreen eventId={eventId} />}
              </Route>
              {/* The Schedule is What's on (the Maintainer, 2026-11-08 and 2026-11-11). */}
              <Route path="/schedule">
                <Redirect to={WHATS_ON} replace />
              </Route>
              {/* The Wrapped tab is the Diary; its stats and Cards come later, at its top. */}
              <Route path="/wrapped">
                <Redirect to="/diary" replace />
              </Route>
              <Route path="/tidy">
                <Placeholder title="Tidy" back="/" />
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
          // The bottom stack, one frame on every screen: a screen's action (What's on's search
          // bar, an Event's Add Item) with any Undo bars, then the install strip, then the tabs.
          <footer ref={setFooter} className="sticky z-10" style={{ bottom: inset }}>
            <ActionBar onBar={setBar} />
            {inItemEditor ? (
              <div className="h-[env(safe-area-inset-bottom)] bg-background" />
            ) : (
              <>
                <InstallStrip />
                <TabBar />
              </>
            )}
          </footer>
        )}
      </div>
    </BarProvider>
  );
}
