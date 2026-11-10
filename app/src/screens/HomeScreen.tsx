// The Season home (DESIGN.md "Season (home, DD2)"; design D3, D11, D14, D17, D29; walkthrough S1,
// S2; option C, the Maintainer, 2026-11-09). Nothing sits above the curtain: the page starts with
// the hero, the rasika's concert on the motif (the one on now, else their soonest one ahead,
// tapped to open it; with neither, the "Season" title), the + at its top right, then the install
// row in a phone's browser tab, "Getting ready for offline…" while the app isn't ready and the
// new-catalog row when there is one. Under them, the strip of days (Past · Today · each date
// ahead with anything on, and a calendar for the months), pinned as the page scrolls and marking
// the day in view; then every day from today on, its label sticking under the strip, or with
// Past the days gone, newest first. The filter is a search bar in the bottom bar, above the tab
// bar, opening its sheet (screens/season-filter.ts). Each day lists the rasika's own Events, then the Schedule's other listings, quieter,
// with no button: a tap opens the listing's sheet, whose one add plans it (screens/timeline.ts,
// ListingSheet). Season opens from today, at its top, and comes back to where it was left. No
// bottom bar.

import {
  IconCalendarExclamation,
  IconCalendar,
  IconCalendarX,
  IconCalendarMonth,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateNow, useOfflineState, useUpdate } from '../pwa';
import { createEvent, today } from '../store/events';
import { isBeingLogged, nowEvent } from '../store/logging-note';
import {
  loadEntries,
  useEventSummaries,
  useLoggingNotes,
  useSchedule,
  useSeasonRagaKeys,
  type EventSummary,
  type ScheduleListing,
} from '../store/queries';
import { useCatalog } from '../catalog/use-catalog';
import { newId, type EventKind } from '../model';
import { Motif } from '../motif/Motif';
import { ragaSeeds } from '../motif/ragas';
import { saveWith, useSaveFeedback } from './components/feedback';
import { useReloadGuard } from './components/reload-guard';
import { KindMark } from './components/kind-mark';
import { ScheduleChangedSheet } from './components/ScheduleChanged';
import { ListingSheet } from './components/ListingSheet';
import { SheetFrame, useLingering } from './components/sheet-frame';
import { BarHold, BottomDock, Screen, TabHeader, useNow } from './components/layout';
import { dayText, itemCount, kindName, nowTime, timeText } from './format';
import { MESSAGES } from './messages';
import {
  claimNewConcert,
  dropNewConcert,
  leavingNow,
  noteNewConcert,
  subscribeLeaving,
  sweepNewConcerts,
} from './new-concert';
import { pinScroll, watchBody, windowPage } from './pin';
import {
  filterDays,
  isFiltering,
  lookupOver,
  NO_FILTER,
  noLookup,
  QUICK_KINDS,
  rowTest,
  seasonNames,
  suggest,
  type Filter,
  type Lookup,
  type SeasonName,
} from './season-filter';
import { asNowReads, heroEvent, listingLead, timeline, type TimelineDay } from './timeline';
import { subscribeUndo, undoOffers } from './undo';
import { offersUpdate } from './update-offer';

/** The season so far as one field (DESIGN.md "The motif"), drawn once its Ragas are known. */
function SeasonArt() {
  const keys = useSeasonRagaKeys();
  const catalog = useCatalog();
  if (keys === undefined || catalog.status === 'loading') return null;
  const ragas = ragaSeeds(keys, catalog.status === 'ready' ? catalog.catalog : null);
  return (
    <Motif
      seed={{ kind: 'season', ragas }}
      className="size-full animate-in duration-300 fade-in motion-reduce:animate-none"
    />
  );
}

// "Later" hides the catalog row until the next launch (design D29): kept for this page's life.
let updateLater = false;

/** The Artists an Event is known by, else its Sabha (walkthrough S2). */
const title = (summary: EventSummary) => summary.knownBy ?? summary.sabha?.name ?? 'No Sabha yet';

/** The title with the Event's kind as a mark before it; a Concert has none (T122). */
const Title = ({ summary }: { summary: EventSummary }) => (
  <>
    <KindMark kind={summary.event.kind} className="mr-1.5" />
    {title(summary)}
  </>
);

/** The line under the title: the Sabha when Artists are the title, then the facts given. */
const line = (summary: EventSummary, ...facts: (string | null | false)[]) =>
  [summary.knownBy && summary.sabha?.name, ...facts].filter(Boolean).join(' · ');

const time = (summary: EventSummary) =>
  summary.event.startTime !== null && timeText(summary.event.startTime);

export function HomeScreen() {
  return (
    <Screen>
      <HomeView />
    </Screen>
  );
}

/**
 * Where Season was left: the day at the top of the screen (or the header, or the filter) and
 * how far it was scrolled past, so coming back finds the same place whatever the days above drew
 * at.
 */
type Place = { at: string; offset: number } | null;

/**
 * Season as the rasika left it, kept for the page's life: the days gone or the days from today,
 * the place in them, and the filter. Each launch starts afresh: from today, at the top, with no
 * filter (DESIGN.md "Season").
 */
const season: {
  past: boolean;
  /** The day the list starts at, picked on the strip or the calendar; null from today. */
  from: string | null;
  place: Place;
  filter: Filter;
  toToday: boolean;
} = {
  past: false,
  from: null,
  place: null,
  filter: NO_FILTER,
  /** Left by the +: the Concert it makes is today's, so Season comes back on today, at its top. */
  toToday: false,
};

const showPast = () => {
  season.past = true;
  season.from = null;
  season.place = null;
};

/** The old Earlier page (an old link, a bookmark): Season, on its days gone, at its top. */
export function ToPast() {
  const [, navigate] = useLocation();
  useLayoutEffect(() => {
    showPast();
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
}

/** The day or header at the top of the screen. */
function placeNow(): Place {
  for (const node of document.querySelectorAll<HTMLElement>('[data-place]')) {
    const box = node.getBoundingClientRect();
    if (box.bottom > 0) return { at: node.dataset.place!, offset: -box.top };
  }
  return null;
}

/**
 * A day's rows' height before they are drawn: a 64px row each, and a 20px line more for an
 * entry's printed title (DESIGN.md "Spacing"); the label above them is always drawn. Measured
 * against the 2026-27 feed at 390px, 56 of its 60 days draw at exactly this height, the rest
 * within 40px, where a name wraps (47 of 60 at 320px, within 44px): only those can move the page
 * in a browser with no scroll anchoring, once each, as they first draw.
 */
const rowsHeight = (day: TimelineDay) =>
  64 * (day.own.length + day.listings.length) +
  20 * day.listings.filter((listing) => listing.entry.title).length;

/**
 * Before the first paint with the days: back where Season was left, held there while the days
 * above draw at their real heights (screens/pin.ts); else at the very top, whatever the browser
 * kept from before a reload. Where it is left is noted as it goes.
 */
function useKeptPlace(ready: boolean) {
  useLayoutEffect(() => {
    if (!ready) return;
    const left = season.place;
    if (!left || !document.querySelector(`[data-place="${left.at}"]`)) {
      window.scrollTo(0, 0);
      return;
    }
    return pinScroll(
      () => document.querySelector(`[data-place="${left.at}"]`),
      left.offset,
      windowPage,
      watchBody,
    );
  }, [ready]);
  // As the page goes, before its days leave the screen: a tap made in the frame a scroll ended
  // in still finds it there.
  useLayoutEffect(() => {
    if (!ready) return;
    return () => {
      season.place = season.toToday ? null : placeNow();
      season.toToday = false;
    };
  }, [ready]);
}

/** The whole Season as days, and the rasika's concert for the hero: undefined until read. */
function useSeasonDays() {
  const stored = useEventSummaries();
  // A new Concert being taken back as the rasika leaves it is never drawn on its way out.
  const leaving = useSyncExternalStore(subscribeLeaving, leavingNow);
  const notes = useLoggingNotes();
  // The whole stored Schedule, the days gone included.
  const listings = useSchedule('');
  const now = useNow();
  return useMemo(() => {
    if (stored === undefined || notes === undefined || listings === undefined) return undefined;
    const summaries = stored.filter((summary) => !leaving.has(summary.event.id));
    const byId = new Map(summaries.map((summary) => [summary.event.id, summary]));
    // A Planned Event whose entry is cancelled is never Now (asNowReads).
    const selection = nowEvent(asNowReads(summaries), notes, now);
    const holder = selection.now ? byId.get(selection.now.id)! : null;
    const logging = holder ? isBeingLogged(holder.event, notes.get(holder.event.id), now) : false;
    // The hero's Event stays in its day too: the list is the whole Schedule, the hero a way in.
    const days = timeline(summaries, listings);
    const from = today(now);
    return {
      summaries,
      listings,
      /** A new Concert is being checked on its way out, and may yet be kept. */
      settling: leaving.size > 0,
      hero: heroEvent(summaries, holder, now),
      logging,
      days,
      today: from,
      /** From today on, by day; the days gone, newest first. */
      ahead: days.filter((day) => day.date >= from),
      gone: days.filter((day) => day.date < from).reverse(),
    };
  }, [stored, leaving, notes, listings, now]);
}

/** The rasika's and the shared Artists and Sabhas, so a name finds its Aliases. */
function useNameLookup(): Lookup {
  const lookup = useLiveQuery(async () => {
    const [artist, sabha] = await Promise.all([loadEntries('artist'), loadEntries('sabha')]);
    return lookupOver({ artist, sabha });
  });
  return lookup ?? noLookup;
}

/**
 * Days as Season lists them, and the two sheets their rows open: a Planned row's "schedule
 * changed" and a listing's own.
 */
function useDayList(listings: ScheduleListing[] | undefined) {
  // The Event whose "schedule changed" sheet is open, kept drawn while it closes.
  const [hint, setHint] = useState<string | null>(null);
  const [hintShown, hintOpen] = useLingering(hint);
  // The Schedule entry whose sheet is open, likewise.
  const [opened, setOpened] = useState<string | null>(null);
  const [openedShown, openedOpen] = useLingering(opened);
  const sheetListing = openedShown
    ? (listings?.find((listing) => listing.entry.id === openedShown) ?? null)
    : null;
  const dayList = (list: TimelineDay[]) =>
    list.map((day) => (
      <DaySection
        key={day.date}
        day={day}
        onHint={setHint}
        onOpen={(listing) => setOpened(listing.entry.id)}
      />
    ));
  const sheets: ReactNode = (
    <>
      {hintShown && (
        <ScheduleChangedSheet
          eventId={hintShown}
          open={hintOpen}
          onOpenChange={(open) => {
            if (!open) setHint(null);
          }}
        />
      )}
      {sheetListing && (
        <ListingSheet
          listing={sheetListing}
          open={openedOpen}
          onOpenChange={(open) => {
            if (!open) setOpened(null);
          }}
        />
      )}
    </>
  );
  return { dayList, sheets };
}

/** Where the strip sits once pinned: the bottom of the space it covers at the top. */
function stripBottom(): number {
  const strip = document.querySelector<HTMLElement>('[data-strip]');
  if (!strip) return 0;
  return parseFloat(getComputedStyle(strip).top) + strip.offsetHeight;
}

/** The scroll at which the strip has just pinned: the list from its start, the filter first. */
function listStart(): number {
  const strip = document.querySelector<HTMLElement>('[data-strip]');
  const header = document.querySelector('[data-place="header"]');
  if (!strip || !header) return 0;
  return (
    header.getBoundingClientRect().bottom + window.scrollY - parseFloat(getComputedStyle(strip).top)
  );
}

function HomeView() {
  const data = useSeasonDays();
  const lookup = useNameLookup();
  const offline = useOfflineState();
  const update = useUpdate();
  const [later, setLater] = useState(updateLater);
  const [, navigate] = useLocation();
  const feedback = useSaveFeedback();
  // Update reloads the page: while a value lives only in memory, it asks to Export first.
  const updating = useReloadGuard(updateNow);
  const undos = useSyncExternalStore(subscribeUndo, undoOffers);
  const { dayList, sheets } = useDayList(data?.listings);
  const [past, setPastState] = useState(season.past);
  const [searching, setSearching] = useState(false);
  // The month sheet, open on the day the strip had marked.
  const [calendar, setCalendar] = useState<string | null>(null);
  const [calendarShown, calendarOpen] = useLingering(calendar);
  const [from, setFromState] = useState(season.from);
  const [filter, setFilterState] = useState(season.filter);
  const setFilter = (next: Filter) => {
    season.filter = next;
    setFilterState(next);
  };
  // A jump the strip asked for, made once the list it starts has drawn.
  const [jumped, setJumped] = useState(0);
  // One Concert per tap: a double tap must not make two.
  const creating = useRef(false);
  // A new Concert left untouched, whose take-back hasn't happened yet, goes now.
  useEffect(() => {
    void sweepNewConcerts();
  }, []);
  const ready = data !== undefined;
  useKeptPlace(ready);
  const names = useMemo(
    () => (data ? seasonNames(data.summaries, data.listings, lookup) : []),
    [data, lookup],
  );
  // The days with only the filter's rows; a day left with none drops out, from the strip too.
  const shown = useMemo(() => {
    if (!data) return undefined;
    if (!isFiltering(filter)) return { ahead: data.ahead, gone: data.gone };
    const test = rowTest(filter, lookup);
    return { ahead: filterDays(data.ahead, test), gone: filterDays(data.gone, test) };
  }, [data, filter, lookup]);

  // The strip's and the calendar's picks (the Maintainer's iPhone, 2026-11-09: a tap scrolled
  // the hero away, which read as a glitch). A day starts the list there, Today from today, a day
  // gone the days gone from it back, Past all of them; the page goes back to its top, so the
  // hero stays where it is and the day picked is the first under the strip, whichever way the
  // days below it end up shown (one at a time or all on).
  const go = (to: string) => {
    const toPast = to === 'past' || (to !== 'today' && data !== undefined && to < data.today);
    const start = to === 'past' || to === 'today' || to === data?.today ? null : to;
    season.past = toPast;
    season.from = start;
    if (toPast !== past) setPastState(toPast);
    setFromState(start);
    setJumped((n) => n + 1);
  };
  useLayoutEffect(() => {
    if (jumped > 0) window.scrollTo(0, 0);
  }, [jumped]);

  // Each attempt is its own Concert with its own id: a failed one stays listed, by its date and
  // time, whatever later taps do, and its Try again makes it once (docs/adr/0007). One made and
  // then left with nothing entered is taken back (screens/new-concert.ts).
  const logNow = async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      const tappedAt = new Date().toISOString();
      const id = newId();
      const concert = { kind: 'concert' as const, date: today(), startTime: nowTime() };
      // Held for its page before it exists, so no tab's sweep can take it back on the way there.
      await claimNewConcert(id);
      const event = await saveWith({ table: 'events', id, field: '*' }, concert, () =>
        createEvent(concert, { id }),
      );
      if (!event) {
        dropNewConcert(id);
        return;
      }
      noteNewConcert(event, tappedAt);
      season.past = false;
      season.from = null;
      season.toToday = true;
      navigate(`/event/${event.id}`);
    } finally {
      creating.current = false;
    }
  };

  // While the days load, the bottom bar keeps what it showed rather than emptying and filling
  // again with the search bar, which would move the page under the hold.
  if (!data || !shown) return <BarHold />;
  const plus = (
    <Button variant="ghost" size="icon" aria-label="Log a Concert" onClick={() => void logNow()}>
      <IconPlus aria-hidden />
    </Button>
  );
  // Nothing logged, planned or listed in the whole Season: nothing to choose between.
  const bare = data.days.length === 0;
  const filtering = isFiltering(filter);
  const days = (past ? shown.gone : shown.ahead).filter(
    (day) => from === null || (past ? day.date <= from : day.date >= from),
  );

  const showUpdate = offersUpdate({
    available: update.available,
    later,
    logging: data.logging,
    unsaved: feedback.hasRetryableFailures() || undos.length > 0,
  });

  return (
    <>
      <div data-place="header">
        <TabHeader
          title="Season"
          art={<SeasonArt />}
          hero={data.hero && <Hero summary={data.hero.summary} now={data.hero.now} action={plus} />}
          action={plus}
        >
          {offline === 'getting-ready' && (
            <p
              role="status"
              className="flex min-h-12 items-center gap-2 text-sub text-muted-foreground"
            >
              <IconLoader2
                aria-hidden
                className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
              />
              {MESSAGES.offline.gettingReady}
            </p>
          )}
        </TabHeader>

        {showUpdate && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-y border-border py-1">
            <span className="py-2">
              {update.newCatalog ? MESSAGES.newCatalog : MESSAGES.appUpdate}
            </span>
            {updating.asking && (
              <p role="alert" className="w-full text-sub text-destructive">
                {MESSAGES.reloadLoses}
              </p>
            )}
            <span className="flex gap-1">
              <Button variant="ghost" onClick={updating.tap}>
                {updating.asking ? MESSAGES.actions.updateAnyway : MESSAGES.actions.update}
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  updateLater = true;
                  setLater(true);
                }}
              >
                {MESSAGES.actions.later}
              </Button>
            </span>
          </div>
        )}
      </div>

      {/* A new Concert checked on its way out is set aside meanwhile: if it is kept, Season was
          never empty, so the bottom bar keeps the search bar it showed. */}
      {bare && data.settling && <BarHold />}
      {!bare && (
        <>
          <DayStrip
            past={past}
            // Past only with a match, but always while it is the one shown, so the strip says
            // where the rasika is.
            hasPast={past || shown.gone.length > 0}
            today={data.today}
            dates={shown.ahead.map((day) => day.date).filter((date) => date !== data.today)}
            from={from}
            listKey={`${past}:${days.map((day) => day.date).join()}`}
            onGo={go}
            onCalendar={setCalendar}
          />
          <BottomDock>
            <SearchBar
              filter={filter}
              onOpen={() => setSearching(true)}
              onClear={() => setFilter(NO_FILTER)}
            />
          </BottomDock>
          <SearchSheet
            open={searching}
            onOpenChange={setSearching}
            names={names}
            filter={filter}
            onFilter={setFilter}
            mine={data.listings.length > 0}
            kinds={QUICK_KINDS.filter((kind) =>
              data.listings.some((listing) => listing.entry.kind === kind),
            )}
          />
          {calendarShown && (
            <CalendarSheet
              open={calendarOpen}
              onOpenChange={(open) => {
                if (!open) setCalendar(null);
              }}
              today={data.today}
              dates={new Set([...shown.ahead, ...shown.gone].map((day) => day.date))}
              start={calendarShown}
              onPick={(date) => {
                setCalendar(null);
                go(date);
              }}
            />
          )}
        </>
      )}

      <div
        data-list={past ? 'past' : 'ahead'}
        aria-label={past ? MESSAGES.season.past : undefined}
        role={past ? 'region' : undefined}
        className="flex flex-1 flex-col"
      >
        {days.length === 0 &&
          (filtering ? (
            // A filter that matches nothing here says so, with one tap to clear it.
            <div className="flex flex-col items-start gap-2 pt-6 pb-8">
              <p className="text-body text-muted-foreground">{MESSAGES.season.noMatch}</p>
              <Button variant="outline" onClick={() => setFilter(NO_FILTER)}>
                {MESSAGES.season.clear}
              </Button>
            </div>
          ) : (
            // Nothing here: one quiet mark, a plain calendar (a crossed-out one read as turned
            // off), at about a third of the empty sheet's height; no words, no nudge.
            <div className="flex flex-1 items-center justify-center pb-56">
              <IconCalendar
                role="img"
                aria-label={
                  bare
                    ? 'Nothing yet'
                    : past
                      ? MESSAGES.season.empty.past
                      : MESSAGES.season.empty.ahead
                }
                className="size-10 text-muted-foreground"
              />
            </div>
          ))}
        <div className="pb-8">{dayList(days)}</div>
      </div>
      {sheets}
    </>
  );
}

/**
 * The hero (the Maintainer, 2026-11-09): the rasika's concert, large, on the motif. The one on
 * now, else their soonest one ahead, on a two-column grid, the content and a 24px column at its
 * right: the word saying which, with the + in the right column; the title (the Artists it is
 * known by, else its Sabha), with a chevron in that column, centred on its first line; then its
 * line (the Sabha, its day, the time, and once attended its Item count). The + and the chevron
 * share one right edge, on the gutter. The whole hero opens the Event, all but its +.
 */
function Hero({
  summary,
  now,
  action,
}: {
  summary: EventSummary;
  now: boolean;
  action: ReactNode;
}) {
  const { event } = summary;
  const when =
    event.date === today()
      ? // Next names its day, today's too, so it never reads as on now.
        now
        ? time(summary)
        : [MESSAGES.season.today, time(summary)].filter(Boolean).join(' · ')
      : [dayText(event.date), time(summary)].filter(Boolean).join(' · ');
  return (
    <section
      aria-label={now ? MESSAGES.season.now : MESSAGES.season.next}
      className="relative grid grid-cols-[minmax(0,1fr)_24px] gap-x-2"
    >
      <p className="flex min-h-6 items-center pb-2 text-sub font-semibold text-foreground">
        {now ? MESSAGES.season.now : MESSAGES.season.next}
      </p>
      {/* Above the hero's link, which covers the rest of it: the + is its own tap. Its 48px
          reaches past the 24px column, its mark ending on the column's right edge, the gutter. */}
      <div className="relative z-10 -my-3 -mr-3.5 flex justify-end self-start">{action}</div>
      {/* A long name wraps at the same size, never cut (DESIGN.md "Larger text"). */}
      <Link
        href={`/event/${event.id}`}
        className="text-heading font-bold break-words text-foreground after:absolute after:inset-0 after:content-['']"
      >
        <Title summary={summary} />
      </Link>
      <span
        aria-hidden
        data-hero-chevron
        className="flex h-[1lh] items-center justify-end text-heading"
      >
        <IconChevronRight className="size-6 text-foreground" />
      </span>
      <p className="pt-1 text-sub text-foreground/80">
        {line(summary, when, event.status === 'attended' && itemCount(summary.itemCount))}
      </p>
    </section>
  );
}

/**
 * The strip of days (the Maintainer, 2026-11-09): Past at its left, as text; Today; then each
 * date from tomorrow with anything on, slim, its weekday small over its number. It sits at the
 * top of the sheet with no line under it and is pinned there as the page scrolls, the list
 * fading out under it once pinned. A tap starts the list at that day; as the rasika scrolls, the
 * day under the strip is the one marked, its number a step heavier over a small ink dot, and the
 * strip slides to keep it in view. A calendar at its right end, pinned with it, opens the month
 * sheet for days further off.
 */
function DayStrip({
  past,
  hasPast,
  today: todayDate,
  dates,
  from,
  listKey,
  onGo,
  onCalendar,
}: {
  past: boolean;
  hasPast: boolean;
  today: string;
  dates: string[];
  /** The day the list starts at; null from today. */
  from: string | null;
  /** Changes whenever the days listed do, so the mark is found again. */
  listKey: string;
  onGo(to: string): void;
  onCalendar(marked: string): void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  // Until the list is scrolled into, the day it starts at is marked.
  const shownDay = inView ?? from ?? todayDate;
  const marked = past ? 'past' : shownDay === todayDate ? 'today' : shownDay;

  // The day at the top of the list, under the strip: the first whose bottom is below it.
  useEffect(() => {
    let frame = 0;
    const find = () => {
      frame = 0;
      const pinnedNow = window.scrollY > listStart() + 1;
      setPinned(pinnedNow);
      // The day whose label sticks under the strip fades the rows passing under the label, so
      // none shows half cut (the council, 2026-11-09), by how far they have passed: none for a
      // day resting just under the strip, as a jump leaves it, whose first row isn't under
      // anything (the Maintainer's iPhone, 2026-11-09: that row read dimmer than the rest).
      const top = stripBottom();
      let stuck: HTMLElement | null = null;
      let fade = 0;
      if (pinnedNow) {
        for (const day of document.querySelectorAll<HTMLElement>(
          '[data-list] section[data-place]',
        )) {
          const box = day.getBoundingClientRect();
          if (box.bottom > top + 1) {
            // Under a pixel is where a jump or a fling leaves a day, not a row passing under.
            const passed = top - box.top;
            fade = passed < 1 ? 0 : Math.min(1, passed / FADE_RAMP);
            if (fade > 0) stuck = day;
            break;
          }
        }
      }
      for (const day of document.querySelectorAll<HTMLElement>('[data-list] [data-stuck]'))
        if (day !== stuck) {
          day.removeAttribute('data-stuck');
          day.style.removeProperty('--under');
        }
      if (stuck) {
        stuck.setAttribute('data-stuck', '');
        stuck.style.setProperty('--under', fade.toFixed(3));
      }
      if (past) return;
      // Until the list is scrolled into, its first day is marked: it stands for the list's start.
      if (window.scrollY <= listStart() + 1) return setInView(null);
      const limit = stripBottom() + 1;
      const all = document.querySelectorAll<HTMLElement>('[data-list] section[data-place]');
      let found: string | null = all[0]?.dataset.place ?? null;
      for (const day of all) {
        if (day.getBoundingClientRect().bottom > limit) {
          found = day.dataset.place!;
          break;
        }
      }
      setInView(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(find);
    };
    find();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [past, listKey]);

  // The marked day kept in view in the strip, sliding it no further than needed.
  useLayoutEffect(() => {
    const row = strip.current?.querySelector<HTMLElement>('[data-row]');
    const on = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row || !on) return;
    const gutter = 16;
    if (on.offsetLeft - gutter < row.scrollLeft) row.scrollLeft = on.offsetLeft - gutter;
    else if (on.offsetLeft + on.offsetWidth + gutter > row.scrollLeft + row.clientWidth)
      row.scrollLeft = on.offsetLeft + on.offsetWidth + gutter - row.clientWidth;
  }, [marked, dates.length]);

  // Its height, for the day labels that stick under it.
  useLayoutEffect(() => {
    const node = strip.current!;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--season-strip', `${node.offsetHeight}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--season-strip');
    };
  }, []);

  // "Time fades" (the Maintainer, 2026-11-09): each stop's ink follows time. Today in full; each
  // day ahead fainter by 0.13 a day down to 0.65; Past at 0.6, the faintest. The chosen day is
  // always in full ink and a step heavier (500), with no dot and no pill. The floor of 0.6 keeps
  // the faintest number at 4.5:1 or better on the page in both themes (DESIGN.md "Season").
  const ink = (key: string) => {
    if (key === 'today') return 1;
    if (key === 'past') return INK_PAST;
    const days = Math.round((startOf(key) - startOf(todayDate)) / 86_400_000);
    return Math.max(INK_FLOOR, 1 - INK_STEP * days);
  };
  // Each stop the same shape, a small weekday over its label, so choosing one moves nothing but
  // its ink and weight. A date's month shows at the first date and where the month turns.
  const item = (key: string, small: string, label: string, spoken?: string) => {
    const on = marked === key;
    return (
      <button
        key={key}
        type="button"
        aria-label={spoken ?? label}
        aria-current={on ? 'true' : undefined}
        onClick={() => onGo(key)}
        style={{ opacity: on ? 1 : ink(key) }}
        // A focus ring only from the keyboard, rounded and inside the stop. Ink and weight
        // change over 250ms, at once with reduced motion.
        className={cn(
          'flex min-h-12 min-w-11 shrink-0 flex-col items-center justify-center rounded-xl px-1 leading-tight text-foreground outline-none transition-[opacity,font-weight] duration-[250ms] ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none',
          on ? 'font-medium' : 'font-normal',
        )}
      >
        <span className="text-caption">{small || '\u00a0'}</span>
        <span className="text-body whitespace-nowrap tabular-nums">{label}</span>
      </button>
    );
  };
  return (
    <div
      ref={strip}
      data-strip
      className="sticky top-[var(--app-top-inset,env(safe-area-inset-top))] z-20 mr-[calc(-16px-env(safe-area-inset-right))] ml-[calc(-16px-env(safe-area-inset-left))] flex items-center bg-background"
    >
      <nav aria-label={MESSAGES.season.days} className="min-w-0 flex-1">
        <div
          data-row
          className="flex gap-2 overflow-x-auto py-2 pr-2 pl-[calc(12px+env(safe-area-inset-left))] [scrollbar-width:none]"
        >
          {hasPast && item('past', '', MESSAGES.season.pastLabel)}
          {item('today', '', MESSAGES.season.today)}
          {dates.map((date, i) => {
            const [weekday, day, month] = dayText(date).split(' ');
            const turns = i === 0 || dates[i - 1]!.slice(0, 7) !== date.slice(0, 7);
            return item(date, weekday!, turns ? `${day} ${month}` : day!, dayText(date));
          })}
        </div>
      </nav>
      {/* Pinned with the strip: days further off, a month at a time. Its mark on the gutter. */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={MESSAGES.season.calendar}
        className="mr-[calc(4px+env(safe-area-inset-right))] shrink-0"
        // Open on the month of the day in view; from Past or Today, on today's.
        onClick={() => onCalendar(marked === 'today' || marked === 'past' ? todayDate : marked)}
      >
        <IconCalendarMonth aria-hidden />
      </Button>
      {/* Once pinned, the list fades out under the strip rather than meeting a line. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-background to-transparent transition-opacity duration-150',
          pinned ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

/** How far a day's rows pass under its stuck label before the label's fade is full. */
const FADE_RAMP = 24;

/** The strip's ink by time (DESIGN.md "Season"): Past, the floor ahead, and the step a day. */
const INK_PAST = 0.6;
const INK_FLOOR = 0.65;
const INK_STEP = 0.13;
/** Midnight of an ISO date, local. */
const startOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const pad2 = (n: number) => String(n).padStart(2, '0');
/** `YYYY-MM` moved by `by` months. */
const addMonths = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const at = new Date(y, m - 1 + by, 1);
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}`;
};

/**
 * The month sheet (the Maintainer, 2026-11-09): a month at a time, Monday first, each day with
 * anything on (with a filter on, anything that matches) carrying a dot under its number, and
 * only those days tappable. The months page sideways, by the arrows or a swipe, from the first
 * month with anything to the last, past months included. A day tapped starts the list there (a
 * day gone opens Past at it) and closes the sheet.
 */
function CalendarSheet({
  open,
  onOpenChange,
  today: todayDate,
  dates,
  start,
  onPick,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  today: string;
  /** The days with anything on, filtered. */
  dates: ReadonlySet<string>;
  /** The day it opens on, its month shown. */
  start: string;
  onPick(date: string): void;
}) {
  const [month, setMonth] = useState(start.slice(0, 7));
  const [opened, setOpened] = useState(open);
  if (open !== opened) {
    setOpened(open);
    if (open) setMonth(start.slice(0, 7));
  }
  const months = [...dates, todayDate].map((date) => date.slice(0, 7)).sort();
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => `${month}-${pad2(i + 1)}`),
  ];
  const page = (by: number) => {
    const next = addMonths(month, by);
    if (next >= first && next <= last) setMonth(next);
  };
  const swipe = useRef<number | null>(null);
  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      title={MESSAGES.season.calendar}
      // The month on the gutter, its arrows together at the right, 8px clear of the close.
      header={
        <div className="-mr-12 flex items-center pr-[42px]">
          <p aria-live="polite" className="min-w-0 flex-1 text-title font-semibold">
            {MONTH_NAMES[m - 1]} {y}
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={MESSAGES.season.previousMonth}
            disabled={month <= first}
            onClick={() => page(-1)}
          >
            <IconChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={MESSAGES.season.nextMonth}
            disabled={month >= last}
            onClick={() => page(1)}
          >
            <IconChevronRight aria-hidden />
          </Button>
        </div>
      }
    >
      <div
        className="grid touch-pan-y grid-cols-7 pb-4"
        onPointerDown={(event) => {
          swipe.current = event.clientX;
        }}
        onPointerUp={(event) => {
          const from = swipe.current;
          swipe.current = null;
          if (from !== null && Math.abs(event.clientX - from) > 48)
            page(event.clientX < from ? 1 : -1);
        }}
      >
        {WEEKDAYS.map((day, i) => (
          <span
            key={i}
            aria-hidden
            className="flex h-8 items-center justify-center text-caption text-muted-foreground"
          >
            {day}
          </span>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <span key={`lead-${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              aria-label={dayText(date)}
              aria-current={date === todayDate ? 'date' : undefined}
              disabled={!dates.has(date)}
              onClick={() => onPick(date)}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center leading-tight tabular-nums disabled:text-muted-foreground/60',
                date === todayDate && 'font-semibold',
              )}
            >
              {Number(date.slice(8))}
              <span
                aria-hidden
                data-dot={dates.has(date) ? '' : undefined}
                className={cn(
                  'mt-1 size-1 rounded-full',
                  dates.has(date) ? 'bg-foreground' : 'bg-transparent',
                )}
              />
            </button>
          ),
        )}
      </div>
    </SheetFrame>
  );
}

/** The filter as the bar reads it: what is picked, then Mine and the kinds. */
const filterParts = (filter: Filter) => [
  ...filter.picks.map((pick) => pick.name),
  ...(filter.mine ? [MESSAGES.season.mine] : []),
  ...filter.kinds.map(kindName),
];

/**
 * The search bar (the Maintainer, 2026-11-09, "Maps-style"): one rounded bar in the shell's
 * bottom bar, just above the tab bar, in thumb reach. It reads "Artist or Sabha…" and opens the
 * search sheet. With a filter on it reads the filter as plain text, its first two parts and
 * "+N" for the rest, so more being on is never cut away, with one x that clears it all.
 */
function SearchBar({
  filter,
  onOpen,
  onClear,
}: {
  filter: Filter;
  onOpen(): void;
  onClear(): void;
}) {
  const parts = filterParts(filter);
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  // How many parts fit whole; the rest read "+N", so no name is ever cut (the council).
  const [fit, setFit] = useState(parts.length);
  const key = parts.join('\u0000');
  useLayoutEffect(() => {
    const room = box.current;
    const sample = probe.current;
    if (!room || !sample) return;
    const measure = () => {
      // The room inside its padding, a pixel spare for rounding.
      const width = room.clientWidth - parseFloat(getComputedStyle(room).paddingRight) - 1;
      let k = parts.length;
      for (; k > 1; k -= 1) {
        sample.textContent =
          parts.slice(0, k).join(' · ') + (k < parts.length ? ` +${parts.length - k}` : '');
        if (sample.getBoundingClientRect().width <= width) break;
      }
      setFit(k);
    };
    // Measured as it lays out, and again as the bar's width changes.
    const observer = new ResizeObserver(measure);
    observer.observe(room);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const shown = Math.min(fit, parts.length);
  const more = parts.length - shown;
  return (
    <div data-season-bar className="relative flex min-h-12 items-center rounded-xl bg-secondary">
      {/* The list fades out above the bar, as under the strip, rather than meeting a line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 bottom-[calc(100%+8px)] h-6 bg-gradient-to-t from-background to-transparent"
      />
      {/* Out of the button, so its text is never read as the bar's: only measured. */}
      <span
        ref={probe}
        aria-hidden
        className="invisible absolute top-0 left-0 text-body whitespace-nowrap"
      />
      <button
        type="button"
        onClick={onOpen}
        aria-label={
          parts.length > 0
            ? MESSAGES.season.filterOn(parts.join(', '))
            : MESSAGES.season.filterLabel
        }
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl pl-3 text-left text-body"
      >
        <IconSearch aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        {parts.length > 0 ? (
          <span ref={box} className="relative flex min-w-0 flex-1 items-baseline gap-1.5 pr-1">
            <span className="truncate text-foreground">{parts.slice(0, shown).join(' · ')}</span>
            {more > 0 && <span className="shrink-0 text-muted-foreground">+{more}</span>}
          </span>
        ) : (
          <span className="truncate pr-3 text-muted-foreground">
            {MESSAGES.season.filterPlaceholder}
          </span>
        )}
      </button>
      {parts.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={MESSAGES.season.clear}
          className="shrink-0 rounded-xl"
          onClick={onClear}
        >
          <IconX aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * The search sheet (the Maintainer, 2026-11-09; screens/season-filter.ts), opened from the bar,
 * its field focused so the keyboard rises at once. Under the field, Mine and the kinds the
 * Schedule has, as text toggles, a check before each one on. Then the names: before typing, the
 * ones picked; as the rasika types, the suggestions from the names in this Season's Schedule and
 * their own Events (billed Artists, groups by their group name, Sabhas with their Aliases), each
 * picked one ticked. A name picked closes the sheet onto its days; a tick tapped takes it off,
 * the sheet staying open; a toggle stays too.
 */
function SearchSheet({
  open,
  onOpenChange,
  names,
  filter,
  onFilter,
  mine,
  kinds,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  names: SeasonName[];
  filter: Filter;
  onFilter(filter: Filter): void;
  /** Mine shows once there is a Schedule: without one every row is the rasika's. */
  mine: boolean;
  /** The kinds the Schedule has. */
  kinds: EventKind[];
}) {
  const [query, setQuery] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const picked = new Set(filter.picks.map((pick) => pick.key));
  const found = useMemo(() => suggest(names, query, [], 8), [names, query]);
  // Before typing, the picks first, then every other name in the Season, A to Z, to browse.
  const rows = useMemo(
    () =>
      query.trim() === ''
        ? [
            ...filter.picks,
            ...names
              .filter((name) => !picked.has(name.key))
              .sort((a, b) => a.name.localeCompare(b.name)),
          ]
        : found,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, found, filter.picks, names],
  );
  const toggle = (name: SeasonName) => {
    if (picked.has(name.key)) {
      onFilter({ ...filter, picks: filter.picks.filter((one) => one.key !== name.key) });
      return;
    }
    onFilter({ ...filter, picks: [...filter.picks, name] });
    setQuery('');
    onOpenChange(false);
  };
  const toggleKind = (kind: EventKind) =>
    onFilter({
      ...filter,
      kinds: filter.kinds.includes(kind)
        ? filter.kinds.filter((one) => one !== kind)
        : [...filter.kinds, kind],
    });
  // Each toggle as wide on as off, its check's room and its 600 weight held either way, so one
  // tapped never moves the others (the Maintainer's iPhone, 2026-11-09: Harikatha's check and
  // weight pushed into Lecdem). The check follows the word, as on the names below.
  const textToggle = (key: string, label: string, on: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      data-toggle
      className={cn(
        'inline-flex min-h-12 items-center gap-1 text-body',
        on ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span className="grid">
        <span aria-hidden className="invisible col-start-1 row-start-1 font-semibold">
          {label}
        </span>
        <span className={cn('col-start-1 row-start-1', on && 'font-semibold')}>{label}</span>
      </span>
      <IconCheck aria-hidden className={cn('size-4 shrink-0', !on && 'invisible')} />
    </button>
  );
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
      title={MESSAGES.season.filterLabel}
      // Tall, the names under the field to browse; the field is its first line, level with the
      // close, with no title over it to say what the field already says (the council).
      className="data-[side=bottom]:h-[85dvh]"
      header={
        <form
          role="search"
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            const first = found.find((name) => !picked.has(name.key));
            if (first) toggle(first);
          }}
        >
          <IconSearch
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={field}
            type="search"
            aria-label={MESSAGES.season.filterLabel}
            placeholder={MESSAGES.season.filterPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-12 w-full rounded-xl bg-secondary py-2 pr-3 pl-10 text-body text-foreground placeholder:text-muted-foreground focus:shadow-[inset_0_0_0_2px_var(--ring)] focus-visible:outline-none"
          />
        </form>
      }
      focus={field}
    >
      {(mine || kinds.length > 0) && (
        <div className="flex flex-wrap gap-x-2 pt-2">
          {mine &&
            textToggle('mine', MESSAGES.season.mine, filter.mine, () =>
              onFilter({ ...filter, mine: !filter.mine }),
            )}
          {kinds.map((kind) =>
            textToggle(kind, kindName(kind), filter.kinds.includes(kind), () => toggleKind(kind)),
          )}
        </div>
      )}
      {query.trim() !== '' && found.length === 0 ? (
        <p className="flex min-h-12 items-center text-sub text-muted-foreground">
          {MESSAGES.season.noName}
        </p>
      ) : (
        rows.length > 0 && (
          <ul aria-label={MESSAGES.season.suggestions} className="pt-2">
            {rows.map((name, i) => {
              const on = picked.has(name.key);
              return (
                <li key={name.key} className={cn(i < rows.length - 1 && 'hairline-b')}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(name)}
                    className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-body"
                  >
                    <span className="min-w-0 flex-1 break-words">{name.name}</span>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {MESSAGES.season.nameKind[name.sort]}
                    </span>
                    <IconCheck
                      aria-hidden
                      className={cn('size-5 shrink-0', on ? 'text-foreground' : 'invisible')}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}
    </SheetFrame>
  );
}

/**
 * One day of the timeline: its label, the rasika's own Events, then the Schedule's other
 * listings. A long Season draws only the rows near the screen, each day's held at their likely
 * height until drawn, so scrolling never jumps. The rows, not the day, skip drawing: skipping
 * clips what it holds, and Safari moves a sticky label inside a clip only once a fling's frame is
 * done, so the rows ran over the label at a day's change (the Maintainer's iPhone, 2026-11-10).
 */
function DaySection({
  day,
  onHint,
  onOpen,
}: {
  day: TimelineDay;
  onHint(eventId: string): void;
  onOpen(listing: ScheduleListing): void;
}) {
  const style = { containIntrinsicSize: `auto ${rowsHeight(day)}px` } as CSSProperties;
  return (
    <section data-place={day.date} aria-labelledby={`day-${day.date}`} className="group/day">
      {/* The day goes with the rows under it: its first row's name 4px under it. */}
      <h2
        id={`day-${day.date}`}
        // Sticks under the pinned strip while its day is on the screen, as a festival
        // schedule's day labels do.
        className="sticky top-[calc(var(--app-top-inset,env(safe-area-inset-top))+var(--season-strip,0px))] z-10 -mb-1.5 bg-background pt-4 text-sub font-semibold text-muted-foreground after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-background after:to-transparent after:opacity-0 group-data-[stuck]/day:after:opacity-(--under)"
      >
        {dayText(day.date)}
      </h2>
      <ul className="[content-visibility:auto]" style={style}>
        {day.own.map((s) => (
          <EventRow
            key={s.event.id}
            summary={s}
            line={line(s, time(s), s.event.status === 'attended' && itemCount(s.itemCount))}
            onHint={s.event.status === 'planned' ? () => onHint(s.event.id) : undefined}
          />
        ))}
        {day.listings.map((listing) => (
          <ListingRow key={listing.entry.id} listing={listing} onOpen={() => onOpen(listing)} />
        ))}
      </ul>
    </section>
  );
}

/**
 * A Schedule listing the rasika hasn't planned: quieter than their own rows, muted and not bold,
 * with no button of its own; a tap opens its sheet. A cancelled one is dimmed and marked.
 */
function ListingRow({ listing: { entry }, onOpen }: { listing: ScheduleListing; onOpen(): void }) {
  const names = listingLead(entry);
  const facts = [names !== entry.sabha && entry.sabha, entry.startTime && timeText(entry.startTime)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="hairline-b">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex min-h-16 w-full items-center gap-2 py-2 text-left text-muted-foreground',
          entry.cancelled && 'opacity-60',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="break-words">
            <KindMark kind={entry.kind} className="mr-1.5" />
            {names}
          </span>
          {entry.title && <span className="text-sub break-words">{entry.title}</span>}
          {facts && <span className="text-sub">{facts}</span>}
        </span>
        {entry.cancelled && (
          <IconCalendarX role="img" aria-label="Cancelled" className="size-5 shrink-0" />
        )}
      </button>
    </li>
  );
}

function EventRow({
  summary,
  line,
  onHint,
}: {
  summary: EventSummary;
  line: string;
  /** A Planned row, which carries the Schedule's marks: opens the "schedule changed" sheet. */
  onHint?: () => void;
}) {
  const planned = onHint !== undefined;
  const cancelled = planned && summary.cancelled;
  // The hint shows on a cancelled row too: the sheet lists what else changed (2026-11-07).
  const changed = planned && summary.event.scheduleChanged;
  return (
    <li className="flex items-center gap-2 hairline-b">
      <Link
        href={`/event/${summary.event.id}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 text-foreground"
      >
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className={cn('font-semibold break-words', cancelled && 'text-muted-foreground')}>
            <Title summary={summary} />
          </span>
          {line && <span className="text-sub text-muted-foreground">{line}</span>}
        </span>
        {/* Dimmed and marked, kept in place until the rasika removes it (T061). */}
        {cancelled && (
          <IconCalendarX
            role="img"
            aria-label="Cancelled"
            className="size-5 shrink-0 text-muted-foreground"
          />
        )}
      </Link>
      {/* The hint is its own button, its 48px reaching past the row's edge: it opens what
          changed, to take or keep (the Maintainer, 2026-11-07). */}
      {changed && (
        <Button
          variant="ghost"
          size="icon"
          className="-mr-3.5 text-muted-foreground"
          aria-label="Schedule changed"
          onClick={onHint}
        >
          <IconCalendarExclamation aria-hidden />
        </Button>
      )}
    </li>
  );
}
