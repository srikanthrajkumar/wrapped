// Season, the hub (docs/designs/season-spine.md Parts 2 and 7; the Maintainer's mockup, accepted
// 2026-11-11; DESIGN.md "Season, the hub"). It answers "what can I still catch" on open, as a few
// small things: the hero on the curtain (the rasika's concert on now or next, or a choice between
// two they Shortlisted in one slot, with Settings and the + at its right); the status rows; the
// lapse card, when a Shortlisted concert's time has passed; Starting soon, up to four rows and
// the door into What's on; the Shortlist tile; and the Diary block, the last concert heard.
// Exactly three chevrons, one per piece that opens a page. The bottom stack holds no search bar:
// that is What's on's.

import {
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconMoon,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { useCatalog } from '../catalog/use-catalog';
import { newId } from '../model';
import { Motif } from '../motif/Motif';
import { ragaSeeds } from '../motif/ragas';
import { updateNow, useOfflineState, useUpdate } from '../pwa';
import { createEvent, today } from '../store/events';
import { letGo, settleLapsed, wasThere } from '../store/lapse';
import { isBeingLogged } from '../store/logging-note';
import { useSeasonRagaKeys, type EventSummary } from '../store/queries';
import { ConcertRow } from './components/ConcertRow';
import { saveWith, SeasonFeedback, useSaveFeedback } from './components/feedback';
import { KindMark } from './components/kind-mark';
import { Curtain, Screen, SectionLink, useKeptScroll } from './components/layout';
import { useReloadGuard } from './components/reload-guard';
import { dayText, itemCount, nowTime, timeText } from './format';
import { MESSAGES } from './messages';
import { WHATS_ON } from './nav';
import { saveFeedback } from './save-feedback';
import { claimNewConcert, dropNewConcert, noteNewConcert, sweepNewConcerts } from './new-concert';
import { useSettingsToFix } from './SettingsScreen';
import {
  diary,
  hubHero,
  isoDay,
  lapsedToAsk,
  shortlist,
  shortlistDays,
  slotName,
  startingSoon,
  underWay,
  type Concert,
  type Hero,
  type Notes,
} from './spine';
import { subscribeUndo, undoOffers } from './undo';
import { offersUpdate } from './update-offer';
import { useConcertSheets, useSeason } from './use-season';
import { startWhatsOnAt } from './WhatsOnScreen';

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

export function HubScreen() {
  return (
    <Screen>
      <HubView />
    </Screen>
  );
}

/** The Artists an Event is known by, else its Sabha (walkthrough S2), its kind's mark before. */
const Title = ({ summary }: { summary: EventSummary }) => (
  <>
    <KindMark kind={summary.event.kind} className="mr-1.5" />
    {summary.knownBy ?? summary.sabha?.name ?? 'No Sabha yet'}
  </>
);

/** A day as the hub says it: "Today", else "Mon 21 Dec". */
const dayName = (date: string, now: Date) =>
  date === isoDay(now) ? MESSAGES.season.today : dayText(date);

/** The hero's line under a name: the Sabha, the day unless it is on now, the time, the Items. */
function heroLine(summary: EventSummary, now: Date, on: boolean, choice = false): string {
  const { event } = summary;
  return [
    summary.knownBy && summary.sabha?.name,
    // A choice for today is named by its slot, so its lines carry no "Today".
    !on && !(choice && event.date === isoDay(now)) && dayName(event.date, now),
    event.startTime && timeText(event.startTime),
    event.status === 'attended' && itemCount(summary.itemCount),
  ]
    .filter(Boolean)
    .join(' · ');
}

function HubView() {
  const data = useSeason();
  const offline = useOfflineState();
  const update = useUpdate();
  const [later, setLater] = useState(updateLater);
  const [, navigate] = useLocation();
  const feedback = useSaveFeedback();
  // Update reloads the page: while a value lives only in memory, it asks to Export first.
  const updating = useReloadGuard(updateNow);
  const undos = useSyncExternalStore(subscribeUndo, undoOffers);
  const { open, hint, sheets } = useConcertSheets(data);
  const toFix = useSettingsToFix();
  useKeptScroll(data !== undefined);
  // One Concert per tap: a double tap must not make two.
  const creating = useRef(false);
  // A new Concert left untouched, whose take-back hasn't happened yet, goes now.
  useEffect(() => {
    void sweepNewConcerts();
  }, []);

  const hero = useMemo(() => (data ? hubHero(data.summaries, data.notes, data.now) : null), [data]);
  // The lapsed Shortlisted concerts the card asks about. Nothing is written until the rasika
  // answers it (store/lapse.ts): the hub opening never changes a status by itself.
  const lapsed = useMemo(() => (data ? lapsedToAsk(data.summaries, data.now) : []), [data]);

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
      navigate(`/event/${event.id}`);
    } finally {
      creating.current = false;
    }
  };

  const actions = (
    <>
      <Button variant="ghost" size="icon" asChild className={cn(toFix && 'text-warning')}>
        <Link
          href="/settings"
          aria-label={toFix ? MESSAGES.spine.settingsToFix : MESSAGES.spine.settings}
        >
          <IconSettings aria-hidden />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" aria-label="Log a Concert" onClick={() => void logNow()}>
        <IconPlus aria-hidden />
      </Button>
    </>
  );

  if (!data) {
    // The curtain is the one block in every state, so the + is in view from the first paint.
    return (
      <Curtain art={<SeasonArt />}>
        <HubHero hero={null} now={new Date()} actions={actions} loading />
      </Curtain>
    );
  }

  const logging =
    hero?.kind === 'now' &&
    isBeingLogged(hero.summary.event, data.notes.get(hero.summary.event.id), data.now);
  const soon = startingSoon(data.all, data.notes, data.now, logging ? hero.summary.event.id : null);
  const mine = shortlist(data.all);
  const heard = diary(data.summaries).find(
    (summary) => !(logging && summary.event.id === hero.summary.event.id),
  );
  const showUpdate = offersUpdate({
    available: update.available,
    later,
    logging,
    unsaved: feedback.hasRetryableFailures() || undos.length > 0,
  });

  return (
    <>
      <Curtain art={<SeasonArt />}>
        <HubHero hero={hero} now={data.now} actions={actions} />
      </Curtain>

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
      <SeasonFeedback />
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

      {lapsed.length > 0 && <LapseCard lapsed={lapsed} />}

      <StartingSoon
        soon={soon}
        bare={data.all.length === 0}
        notes={data.notes}
        now={data.now}
        onOpen={open}
        onHint={hint}
      />

      <ShortlistTile shortlisted={mine} notes={data.notes} now={data.now} />

      {heard && (
        <section aria-labelledby="hub-diary" className="pt-4 pb-8">
          <SectionLink href="/diary">
            <h2 id="hub-diary" className="text-sub font-semibold text-muted-foreground">
              {MESSAGES.tabs.diary}
            </h2>
          </SectionLink>
          <Link href={`/event/${heard.event.id}`} className="flex min-h-12 flex-col pb-2.5">
            <span className="break-words text-foreground">
              <Title summary={heard} />
            </span>
            <span className="text-sub text-muted-foreground">
              {[
                heard.knownBy && heard.sabha?.name,
                dayName(heard.event.date, data.now),
                itemCount(heard.itemCount),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
        </section>
      )}
      {!heard && <div className="pb-8" />}
      {sheets}
    </>
  );
}

/**
 * The hero (Part 7), on the curtain: its word and, at the right, Settings and the +; then the
 * rasika's concert, large, the whole of it opening its Event with no chevron; or, for
 * Shortlisted concerts in one slot, each as its own way in, so the hero never picks for them.
 * With no concert of theirs on now or ahead it is the tab's title.
 */
function HubHero({
  hero,
  now,
  actions,
  loading = false,
}: {
  hero: Hero | null;
  now: Date;
  actions: ReactNode;
  /** The Season is still being read: the title waits unseen, so no word flashes and changes. */
  loading?: boolean;
}) {
  const word =
    hero === null
      ? null
      : hero.kind === 'pick'
        ? MESSAGES.spine.pick(slotName(hero.summaries[0]!.event.startTime))
        : hero.kind === 'now'
          ? MESSAGES.season.now
          : MESSAGES.season.next;
  return (
    <div className="relative">
      {/* Two 48px marks at the row's right, the +'s ending on the gutter, as before. Outside
          the hero's own region, which holds the concert alone. */}
      <div className="absolute top-0 right-0 z-10 -mr-3.5 flex">{actions}</div>
      {word ? (
        <h1 className="sr-only">{MESSAGES.tabs.season}</h1>
      ) : (
        <h1
          className={cn(
            'flex min-h-12 items-center pr-24 text-heading font-bold',
            loading && 'invisible',
          )}
        >
          {MESSAGES.tabs.season}
        </h1>
      )}
      {hero && <HeroConcert hero={hero} word={word!} now={now} />}
    </div>
  );
}

function HeroConcert({ hero, word, now }: { hero: Hero; word: string; now: Date }) {
  return (
    <section aria-label={word}>
      <p className="flex min-h-12 items-center pr-24 text-sub font-semibold text-foreground">
        {word}
      </p>
      {hero.kind !== 'pick' && (
        <Link href={`/event/${hero.summary.event.id}`} className="flex flex-col gap-1">
          {/* A long name wraps at the same size, never cut (DESIGN.md "Larger text"). */}
          <span className="text-heading font-bold break-words text-foreground">
            <Title summary={hero.summary} />
          </span>
          <span className="text-sub text-foreground/80">
            {heroLine(hero.summary, now, hero.kind === 'now')}
          </span>
        </Link>
      )}
      {hero.kind === 'pick' && (
        <ul className="flex flex-col gap-3">
          {hero.summaries.map((summary) => (
            <li key={summary.event.id}>
              <Link href={`/event/${summary.event.id}`} className="flex min-h-12 flex-col gap-1">
                <span className="text-title font-semibold break-words text-foreground">
                  <Title summary={summary} />
                </span>
                <span className="text-sub text-foreground/80">
                  {heroLine(summary, now, hero.now, true)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The lapse card (SF-D24, SF-D39; ADR 0010): the Shortlisted concerts whose time passed with
 * nothing logged, asked about once. A tap on one says the rasika was there, and it is Heard;
 * "None of these" lets the rest go, kept as Missed and shown nowhere.
 */
function LapseCard({ lapsed }: { lapsed: EventSummary[] }) {
  const target = (summary: EventSummary) => ({
    table: 'events' as const,
    id: summary.event.id,
    field: 'status',
  });
  const wasAt = (summary: EventSummary) =>
    saveWith(target(summary), 'attended', () => wasThere(summary.event.id));
  // Each one asked about is let go as its own save; then what nobody was asked about (one in a
  // heard concert's slot, a cancelled one) is settled with them, in one transaction.
  const none = async () => {
    for (const summary of lapsed) {
      const event = await saveWith(target(summary), 'missed', () => letGo(summary.event.id));
      // It gained an Item meanwhile and is Heard: the answer "missed" has nothing left to save.
      if (event && event.status !== 'missed') saveFeedback.drop(target(summary));
    }
    await settleLapsed().catch(() => undefined);
  };
  const days = [...new Set(lapsed.map((summary) => summary.event.date))];
  return (
    <section aria-labelledby="hub-lapse" className="mt-2 mb-4 rounded-xl bg-card px-4 pt-4 pb-1">
      <h2 id="hub-lapse" className="font-semibold">
        {MESSAGES.spine.lapse.question}
      </h2>
      {days.map((date) => (
        <div key={date}>
          <p className="pt-1 pb-1.5 text-caption text-muted-foreground">{dayText(date)}</p>
          <ul>
            {lapsed
              .filter((summary) => summary.event.date === date)
              .map((summary) => (
                <li key={summary.event.id} className="flex items-center gap-3 py-2.5 hairline-b">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="break-words">
                      <Title summary={summary} />
                    </span>
                    <span className="text-sub text-muted-foreground">
                      {[
                        summary.knownBy && summary.sabha?.name,
                        summary.event.startTime && timeText(summary.event.startTime),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    aria-label={MESSAGES.spine.lapse.yes(
                      summary.knownBy ?? summary.sabha?.name ?? dayText(date),
                    )}
                    onClick={() => void wasAt(summary)}
                  >
                    <IconCheck aria-hidden />
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <button
        type="button"
        // In the text colour and the card's whole width, so it reads as the card's other answer
        // (the council, 2026-11-11: in muted text it looked inert).
        className="flex min-h-12 w-full items-center rounded-xl text-left text-sub text-foreground"
        onClick={() => void none()}
      >
        {MESSAGES.spine.lapse.none}
      </button>
    </section>
  );
}

/**
 * Starting soon (SF-D26): up to four rows, then the door into What's on, the count of the rest
 * with its chevron. With nothing left today, an empty state that points to the next day's
 * first concert; with no Schedule at all, one that says so.
 */
function StartingSoon({
  soon,
  bare,
  notes,
  now,
  onOpen,
  onHint,
}: {
  soon: ReturnType<typeof startingSoon>;
  bare: boolean;
  notes: Notes;
  now: Date;
  onOpen(concert: Concert): void;
  onHint(eventId: string): void;
}) {
  if (soon.rows.length === 0) {
    const next = soon.next;
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconMoon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>
            {bare ? MESSAGES.spine.empty.season.title : MESSAGES.spine.empty.today.title}
          </EmptyTitle>
          {bare ? (
            <EmptyDescription>{MESSAGES.spine.empty.season.line}</EmptyDescription>
          ) : (
            next && (
              <EmptyDescription>
                {MESSAGES.spine.empty.today.next(
                  nextDayName(next.date, now),
                  next.startTime && timeText(next.startTime),
                  next.lead,
                  next.sabha,
                )}
              </EmptyDescription>
            )
          )}
        </EmptyHeader>
        {next && (
          <EmptyContent>
            {/* In the door's place, with its chevron: it opens What's on, at that day. */}
            <Button variant="outline" asChild className="pr-3">
              <Link href={WHATS_ON} onClick={() => startWhatsOnAt(next.date)}>
                {nextDayName(next.date, now)}
                <IconChevronRight aria-hidden className="size-[22px]" />
              </Link>
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }
  return (
    <section aria-labelledby="hub-soon">
      <h2 id="hub-soon" className="py-2 text-sub font-semibold text-muted-foreground">
        {MESSAGES.spine.startingSoon}
      </h2>
      <ul>
        {soon.rows.map((concert) => (
          <ConcertRow
            key={concert.key}
            concert={concert}
            on={underWay(concert, notes, now)}
            onOpen={onOpen}
            onHint={onHint}
          />
        ))}
      </ul>
      <SectionLink href={WHATS_ON} className="font-semibold">
        {soon.more > 0 ? MESSAGES.spine.more(soon.more) : MESSAGES.spine.allOfToday}
      </SectionLink>
    </section>
  );
}

/** "Tomorrow" for the day after today, else the day's own name. */
function nextDayName(date: string, now: Date): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return date === isoDay(tomorrow) ? MESSAGES.spine.tomorrow : dayText(date);
}

/** A day ahead as the tile says it: its weekday within the week ("Mon"), else "28 Dec". */
function nearDayName(date: string, now: Date): string {
  const [weekday, day, month] = dayText(date).split(' ');
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  return date < isoDay(week) ? weekday! : `${day} ${month}`;
}

/**
 * The Shortlist tile: the one filled block on the hub, opening the Shortlist. How many concerts
 * the rasika Shortlisted, and when: today's by slot, the days ahead by day.
 */
function ShortlistTile({
  shortlisted,
  notes,
  now,
}: {
  shortlisted: Concert[];
  notes: Notes;
  now: Date;
}) {
  const parts: string[] = [];
  const today = isoDay(now);
  for (const day of shortlistDays(shortlisted)) {
    if (day.date === today) {
      for (const slot of day.slots) {
        const on = slot.filter((concert) => underWay(concert, notes, now)).length;
        if (on > 0) parts.push(MESSAGES.spine.onNowCount(on));
        const ahead = slot.length - on;
        if (ahead > 0)
          parts.push(
            slot[0]!.startTime
              ? MESSAGES.spine.at(ahead, timeText(slot[0]!.startTime))
              : MESSAGES.spine.onDay(ahead, MESSAGES.season.today),
          );
      }
    } else {
      const count = day.slots.reduce((sum, slot) => sum + slot.length, 0);
      parts.push(MESSAGES.spine.onDay(count, nearDayName(day.date, now)));
    }
  }
  // Three parts at most; the rest as one count, so the line stays one line.
  const said = parts.slice(0, 3);
  return (
    <Link
      href="/shortlist"
      className="mt-6 flex min-h-20 items-center gap-3 rounded-xl bg-secondary p-4"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold">{MESSAGES.tabs.shortlist}</span>
        <span className="text-sub text-muted-foreground">
          {shortlisted.length === 0
            ? MESSAGES.spine.nothingYet
            : said.join(' · ') + (parts.length > said.length ? ' …' : '')}
        </span>
      </span>
      {shortlisted.length > 0 && (
        <span className="text-title font-semibold tabular-nums">{shortlisted.length}</span>
      )}
      <IconChevronRight aria-hidden className="size-[22px] shrink-0" />
    </Link>
  );
}
