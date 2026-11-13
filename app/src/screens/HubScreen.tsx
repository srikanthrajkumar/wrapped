// Season, the hub (docs/designs/season-spine.md Parts 2 and 7; the Maintainer's mockups, accepted
// 2026-11-11 and 2026-11-13; DESIGN.md "Season, the hub"). It answers "what can I still catch" on
// open: the hero on the curtain (the rasika's concert on now or next, or a choice between two
// they Shortlisted in one slot, with the + at its right), then three sections in one pattern
// (DESIGN.md "The section pattern"): Today, or the next day once nothing is left today;
// Shortlist; Diary. Each has a header that opens its page, with one chevron, and its concerts
// below on a panel. Above them, when a Shortlisted concert's time has passed, the question about
// it, in the same pattern. The bottom stack holds no search bar: that is What's on's.

import { IconLoader2, IconMoon, IconPlus } from '@tabler/icons-react';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Empty,
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
import { Curtain, Panel, Screen, SectionHeader, useKeptScroll } from './components/layout';
import { useReloadGuard } from './components/reload-guard';
import { dayText, itemCount, nameBreaks, nowTime, timeText } from './format';
import { MESSAGES } from './messages';
import { WHATS_ON } from './nav';
import { saveFeedback } from './save-feedback';
import { claimNewConcert, dropNewConcert, noteNewConcert, sweepNewConcerts } from './new-concert';
import {
  diary,
  hubHero,
  isoDay,
  lapsedToAsk,
  minutesTo,
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

// The lapsed concerts that were still being asked about when the rasika said "Yes" to another:
// for those, what is left to answer is "None of the rest" (the Maintainer, 2026-11-13). Kept for
// this page's life, by Event, so a later day's question starts as "None of these" again.
const askedWithAYes = new Set<string>();

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
    {summary.knownBy ? nameBreaks(summary.knownBy) : (summary.sabha?.name ?? 'No Sabha yet')}
  </>
);

/** A day as the hub says it: "Today", else "Mon 21 Dec". */
const dayName = (date: string, now: Date) =>
  date === isoDay(now) ? MESSAGES.season.today : dayText(date);

/**
 * The hero's line under a name: the Sabha, then when. Inside the hour that is "in 20 min", in
 * full ink, as its row says it (the council, 2026-11-13: the most urgent fact on the screen had
 * the least weight); else the day unless it is on now, and the time; then the Items, once any.
 */
function HeroLine({
  summary,
  now,
  on,
  choice = false,
}: {
  summary: EventSummary;
  now: Date;
  on: boolean;
  choice?: boolean;
}) {
  const { event } = summary;
  const near = on ? null : minutesTo(event, now);
  const quiet = [
    summary.knownBy && summary.sabha?.name,
    // A choice for today is named by its slot, so its lines carry no "Today".
    near === null && !on && !(choice && event.date === isoDay(now)) && dayName(event.date, now),
    near === null && event.startTime && timeText(event.startTime),
    event.status === 'attended' && summary.itemCount > 0 && itemCount(summary.itemCount),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="text-sub text-foreground">
      <span className="opacity-80">
        {quiet}
        {quiet && near !== null && ' · '}
      </span>
      {near !== null && MESSAGES.spine.inMinutes(near)}
    </span>
  );
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

  // The +, larger (the Maintainer, 2026-11-13): a 28px mark in its 48px target. Settings is a
  // tab now.
  const actions = (
    <Button variant="ghost" size="icon" aria-label="Log a Concert" onClick={() => void logNow()}>
      <IconPlus aria-hidden className="size-7" />
    </Button>
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
  const allHeard = diary(data.summaries);
  const heard = allHeard.find(
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
          className="flex min-h-12 items-center gap-2 px-2 text-sub text-muted-foreground"
        >
          <IconLoader2
            aria-hidden
            className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
          />
          {MESSAGES.offline.gettingReady}
        </p>
      )}
      <div className="px-2">
        <SeasonFeedback />
      </div>
      {showUpdate && (
        <div className="mx-2 mb-4 flex flex-wrap items-center justify-between gap-2 border-y border-border py-1">
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

      <FirstSection
        soon={soon}
        bare={data.all.length === 0}
        notes={data.notes}
        now={data.now}
        onOpen={open}
        onHint={hint}
      />

      <ShortlistSection shortlisted={mine} notes={data.notes} now={data.now} />

      {/* Always there, so the hub is the same three sections on day one (the council,
          2026-11-13); with nothing heard it says so on its line. */}
      <section aria-labelledby="hub-diary" className="pt-4 pb-8">
        <SectionHeader
          id="hub-diary"
          label={MESSAGES.tabs.diary}
          href="/diary"
          count={allHeard.length}
          line={allHeard.length === 0 ? MESSAGES.spine.empty.diary.title : undefined}
        />
        {heard && (
          <Panel>
            <li>
              <Link
                href={`/event/${heard.event.id}`}
                className="flex min-h-16 flex-col justify-center py-2.5 focus-visible:-outline-offset-2"
              >
                <span className="break-words text-balance text-foreground">
                  <Title summary={heard} />
                </span>
                <span className="text-sub text-muted-foreground">
                  {[
                    heard.knownBy && heard.sabha?.name,
                    dayName(heard.event.date, data.now),
                    // Never "0 Items" (the Maintainer, 2026-11-13).
                    heard.itemCount > 0 && itemCount(heard.itemCount),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          </Panel>
        )}
      </section>
      {sheets}
    </>
  );
}

/**
 * The hero (Part 7), on the curtain: its word and, at the right, the +; then the rasika's
 * concert, large, the whole of it opening its Event with no chevron; or, for Shortlisted
 * concerts in one slot, each as its own way in, so the hero never picks for them. With no
 * concert of theirs on now or ahead it is the tab's title.
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
      {/* The +'s 48px at the row's right, its mark ending on the hub's column. Outside the
          hero's own region, which holds the concert alone. */}
      <div className="absolute top-0 right-0 z-10 -mr-[15px] flex">{actions}</div>
      {word ? (
        <h1 className="sr-only">{MESSAGES.tabs.season}</h1>
      ) : (
        <h1
          className={cn(
            'flex min-h-12 items-center pr-12 text-heading font-bold',
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
    // 24px from its last line to the first section, as the title has.
    <section aria-label={word} className="pb-2">
      <p className="flex min-h-12 items-center pr-12 text-sub font-semibold text-foreground">
        {word}
      </p>
      {hero.kind !== 'pick' && (
        <Link href={`/event/${hero.summary.event.id}`} className="flex flex-col gap-1">
          {/* A long name wraps at the same size, never cut (DESIGN.md "Larger text"), its lines
              balanced and never broken after an "&" or an initial. */}
          <span className="text-heading font-bold break-words text-balance text-foreground">
            <Title summary={hero.summary} />
          </span>
          <HeroLine summary={hero.summary} now={now} on={hero.kind === 'now'} />
        </Link>
      )}
      {hero.kind === 'pick' && (
        <ul className="flex flex-col gap-3">
          {hero.summaries.map((summary) => (
            <li key={summary.event.id}>
              <Link href={`/event/${summary.event.id}`} className="flex min-h-12 flex-col gap-1">
                <span className="text-title font-semibold break-words text-balance text-foreground">
                  <Title summary={summary} />
                </span>
                <HeroLine summary={summary} now={now} on={hero.now} choice />
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
  const wasAt = async (summary: EventSummary) => {
    // Noted before the save, so the list drawn as it lands already reads "None of the rest";
    // taken back if the save fails, when no "Yes" was given.
    const others = lapsed
      .map((other) => other.event.id)
      .filter((id) => id !== summary.event.id && !askedWithAYes.has(id));
    for (const id of others) askedWithAYes.add(id);
    const event = await saveWith(target(summary), 'attended', () => wasThere(summary.event.id));
    if (!event) for (const id of others) askedWithAYes.delete(id);
  };
  const rest = lapsed.some((summary) => askedWithAYes.has(summary.event.id));
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
    // The section pattern (the council, 2026-11-13): the question as a header that opens nothing,
    // so with no chevron, and the concerts it asks about on a panel. One day is said under the
    // question; several, each above its own.
    <section aria-labelledby="hub-lapse" className="pb-4">
      <SectionHeader
        id="hub-lapse"
        label={MESSAGES.spine.lapse.question}
        line={days.length === 1 ? dayText(days[0]!) : undefined}
      />
      <Panel as="div">
        {days.map((date) => (
          <div key={date}>
            {days.length > 1 && (
              <p className="pt-3 text-caption text-muted-foreground">{dayText(date)}</p>
            )}
            <ul>
              {lapsed
                .filter((summary) => summary.event.date === date)
                .map((summary) => (
                  <li key={summary.event.id} className="flex items-center gap-3 py-2.5 hairline-b">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="break-words text-balance">
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
                    {/* A word, not a tick: three reviewers read a tick in a ring as already
                        answered (the council, 2026-11-13). */}
                    <Button
                      variant="outline"
                      className="h-12 min-w-16 rounded-full px-4"
                      aria-label={MESSAGES.spine.lapse.yesSpoken(
                        summary.knownBy ?? summary.sabha?.name ?? dayText(date),
                      )}
                      onClick={() => void wasAt(summary)}
                    >
                      {MESSAGES.spine.lapse.yes}
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <button
          type="button"
          // The panel's other answer: its whole width, under the last row's line, in the weight
          // of an action (the council, 2026-11-11 and 2026-11-13: lighter, it read as a label).
          className="flex min-h-12 w-full items-center rounded-xl text-left font-semibold text-foreground focus-visible:-outline-offset-2"
          onClick={() => void none()}
        >
          {rest ? MESSAGES.spine.lapse.rest : MESSAGES.spine.lapse.none}
        </button>
      </Panel>
    </section>
  );
}

/**
 * The hub's first section (SF-D26; the Maintainer, 2026-11-13): "Today", with up to four rows
 * that say how close each is, its header opening What's on. Once nothing is left today it is
 * the next day's ("Tomorrow"), with that day's first rows and its header opening What's on at
 * that day. The empty state is kept for when there is truly nothing: no Schedule, or nothing
 * listed ahead.
 */
function FirstSection({
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
  const today = isoDay(now);
  const day = soon.day ?? today;
  return (
    <section aria-labelledby="hub-first">
      <SectionHeader
        id="hub-first"
        label={day === today ? MESSAGES.season.today : nextDayName(day, now)}
        count={soon.count}
        href={WHATS_ON}
        onClick={day === today ? undefined : () => startWhatsOnAt(day)}
      />
      {soon.rows.length > 0 ? (
        <Panel>
          {soon.rows.map((concert) => (
            <ConcertRow
              key={concert.key}
              concert={concert}
              on={underWay(concert, notes, now)}
              // Today's rows say how close they are; another day's keep the clock time.
              now={day === today ? now : undefined}
              onOpen={onOpen}
              onHint={onHint}
            />
          ))}
        </Panel>
      ) : (
        <Empty className="pt-6">
          <EmptyHeader>
            {/* The bare mark: on a filled tile it read as a button (the council, 2026-11-13). */}
            <EmptyMedia>
              <IconMoon aria-hidden className="size-7 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>
              {bare ? MESSAGES.spine.empty.season.title : MESSAGES.spine.empty.today.title}
            </EmptyTitle>
            {bare && <EmptyDescription>{MESSAGES.spine.empty.season.line}</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      )}
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
 * The hub's Shortlist section: its header alone, as it has no rows of its own (a panel wraps
 * rows only). Under its label, how many concerts the rasika Shortlisted and when: today's by
 * slot, the near ones in full ink as a row says them, the days ahead by day.
 */
function ShortlistSection({
  shortlisted,
  notes,
  now,
}: {
  shortlisted: Concert[];
  notes: Notes;
  now: Date;
}) {
  const parts: { text: string; near: boolean }[] = [];
  const today = isoDay(now);
  for (const day of shortlistDays(shortlisted)) {
    if (day.date === today) {
      for (const slot of day.slots) {
        const later = slot.filter((concert) => !underWay(concert, notes, now));
        const on = slot.length - later.length;
        if (on > 0) parts.push({ text: MESSAGES.spine.onNowCount(on), near: true });
        const ahead = later.length;
        // Said by the first still to start, not by one of the slot already under way.
        const first = later[0];
        if (!first) continue;
        const minutes = minutesTo(first, now);
        if (minutes !== null) {
          parts.push({ text: MESSAGES.spine.inCount(ahead, minutes), near: true });
        } else {
          parts.push({
            text: first.startTime
              ? MESSAGES.spine.at(ahead, timeText(first.startTime))
              : MESSAGES.spine.onDay(ahead, MESSAGES.season.today),
            near: false,
          });
        }
      }
    } else {
      const count = day.slots.reduce((sum, slot) => sum + slot.length, 0);
      parts.push({ text: MESSAGES.spine.onDay(count, nearDayName(day.date, now)), near: false });
    }
  }
  // Three parts at most; the rest as one mark, so the line stays one line.
  const said = parts.slice(0, 3);
  return (
    <section aria-labelledby="hub-shortlist" className="pt-4">
      <SectionHeader
        id="hub-shortlist"
        label={MESSAGES.tabs.shortlist}
        href="/shortlist"
        count={shortlisted.length}
        line={
          shortlisted.length === 0 ? (
            MESSAGES.spine.nothingYet
          ) : (
            <>
              {said.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && ' · '}
                  {part.near ? <span className="text-foreground">{part.text}</span> : part.text}
                </Fragment>
              ))}
              {parts.length > said.length && ' …'}
            </>
          )
        }
      />
    </section>
  );
}
