// A blank Concert offers its listings (G; docs/design/log-entry.md, decided by the user on
// 2026-11-22). On a Concert Season's + made, while it has no Artist and no Sabha, its empty
// middle holds "Is it one of these?": up to four of the Schedule's listings near the Concert's
// own date and time, as What's on draws them, the rasika's Shortlisted ones first. A row tapped
// fills the Concert from its listing, as "I'm here" does (screens/listing-event.ts). Under them,
// while the Concert's date is in the Schedule's span, "Search What's on…" opens the docked search
// over the whole Season. The rows are worked out when the page opens and when its date or time
// changes, never re-sorted under the thumb. Nothing here waits for the network: it reads only
// the stored Schedule.

import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { eventStart } from '../../store/logging-note';
import { dayText, timeText } from '../format';
import { addTarget, attemptOf } from '../listing-event';
import { MESSAGES } from '../messages';
import { inScheduleSpan, isNow, nearListings, searchListings } from '../near-listings';
import { underWay, type Concert } from '../spine';
import { useSeason } from '../use-season';
import { ConcertRow } from './ConcertRow';
import { DockedSearch } from './DockedSearch';
import { NotSavedLine } from './feedback';
import { Panel, SectionHeader, useNow } from './layout';
import { ActionRow } from './rows';
import { SheetFrame } from './sheet-frame';

/** A quiet Action row: its mark on the 24px column, its words in `body`, muted, regular weight. */
export function QuietAction({
  mark,
  children,
  onClick,
  className,
}: {
  mark: 'search' | 'plus';
  children: string;
  onClick(): void;
  className?: string;
}) {
  const Mark = mark === 'search' ? IconSearch : IconPlus;
  return (
    <ActionRow onClick={onClick} className={cn('font-normal text-muted-foreground', className)}>
      <Mark aria-hidden className="size-5 shrink-0" />
      {children}
    </ActionRow>
  );
}

interface Shown {
  key: string;
  rows: Concert[];
  /** The Concert's time was the clock's when the rows were worked out. */
  now: boolean;
}

/**
 * The offer, for the blank Concert's date and time as entered. `before` is what stands in the
 * empty middle when no listing is near ("No Items yet"): the link then follows it alone.
 */
export function ListingOffer({
  date,
  startTime,
  hasItems,
  onFill,
  before,
}: {
  date: string;
  startTime: string | null;
  hasItems: boolean;
  onFill(concert: Concert): void;
  before: ReactNode;
}) {
  const season = useSeason();
  const clock = useNow();
  const [searching, setSearching] = useState(false);
  const key = `${date} ${startTime ?? ''}`;
  // Worked out once for each date and time, so nothing moves under the thumb.
  const [shown, setShown] = useState<Shown | null>(null);
  if (season && shown?.key !== key) {
    const at = eventStart({ date, startTime });
    setShown({
      key,
      rows: at ? nearListings(season.all, at) : [],
      now: at !== null && isNow(at, new Date()),
    });
  }
  const span = season ? inScheduleSpan(season.listings, date) : false;
  const rows = shown?.key === key ? shown.rows : [];
  const attempts = rows
    .map((concert) => attemptOf(concert.key))
    .filter((id): id is string => id !== null)
    .map(addTarget);

  const link = span && (
    <QuietAction mark="search" onClick={() => setSearching(true)}>
      {MESSAGES.offer.search}
    </QuietAction>
  );
  const search = season && (
    <ListingSearch
      open={searching}
      onOpenChange={setSearching}
      all={season.all}
      day={date}
      onPick={(concert) => {
        setSearching(false);
        onFill(concert);
      }}
    />
  );

  // Read in a moment from the phone: nothing shows meanwhile, so "No Items yet" never flashes
  // before the section takes its place.
  if (!season) return null;
  if (rows.length === 0) {
    return (
      <>
        {!hasItems && before}
        {link && <div className={hasItems ? 'mt-6' : 'mt-2'}>{link}</div>}
        {search}
      </>
    );
  }
  return (
    // 24px under the title block, as the Items are (foundations, 2026-11-16).
    <section aria-labelledby="offer" className="mt-6">
      <SectionHeader
        id="offer"
        label={MESSAGES.offer.title}
        line={shown?.now ? MESSAGES.offer.onNow : MESSAGES.offer.near(timeText(startTime!))}
      />
      <Panel>
        {rows.map((concert) => (
          <ConcertRow
            key={concert.key}
            concert={concert}
            on={season ? underWay(concert, season.notes, clock) : false}
            onOpen={onFill}
          />
        ))}
      </Panel>
      <NotSavedLine targets={attempts} />
      {link}
      {search}
    </section>
  );
}

/**
 * "Search What's on…": the docked search over the whole Season's listings, past days included,
 * by Artist or Sabha, the Concert's own day first. With no match, "Not listed? Fill it in
 * yourself" goes back to the blank Concert.
 */
function ListingSearch({
  open,
  onOpenChange,
  all,
  day,
  onPick,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  all: readonly Concert[];
  day: string;
  onPick(concert: Concert): void;
}) {
  const [query, setQuery] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const found = useMemo(() => searchListings(all, query, day), [all, query, day]);
  const typed = query.trim() !== '';
  const close = () => {
    setQuery('');
    onOpenChange(false);
  };
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={MESSAGES.offer.searchLabel}
      focus={field}
    >
      <DockedSearch
        label={MESSAGES.offer.searchLabel}
        placeholder={MESSAGES.season.filterPlaceholder}
        query={query}
        onQueryChange={setQuery}
        field={field}
        typedRow={
          typed &&
          found.length === 0 && (
            <QuietAction mark="plus" onClick={close} className="pinned-row">
              {MESSAGES.offer.notListed}
            </QuietAction>
          )
        }
        results={found.map((concert) => ({
          key: concert.key,
          title: concert.lead,
          line: [
            dayText(concert.date),
            concert.startTime && timeText(concert.startTime),
            concert.listing!.entry.sabha,
          ]
            .filter(Boolean)
            .join(' · '),
          onPick: () => {
            setQuery('');
            onPick(concert);
          },
        }))}
        resultsLabel={MESSAGES.offer.results}
        onSubmit={() => {
          if (found[0]) {
            setQuery('');
            onPick(found[0]);
          }
        }}
      />
    </SheetFrame>
  );
}
