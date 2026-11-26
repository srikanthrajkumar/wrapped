// The Concert row (docs/design/row.md, the Maintainer, 2026-11-16; docs/designs/season-spine.md
// Part 4; DESIGN.md "The row"): one concert, heard or not, the same on the hub, What's on, the
// Shortlist, the Diary and the lapse question. Its lines:
// 1. the name in `body`, starting on the column, then its kind's mark and its type when it isn't
//    vocal (`caption`), both kept with the name's last word;
// 2. the printed title (`sub`, two lines at most), when there is one;
// 3. the accompanists (`sub`, one line, whole names then "+N"), when there are any;
// 4. the facts, time first: "when · Sabha", then "· N Items" once heard (never "0 Items"). "When"
//    leaves out what a label above says: the time under a day label, nothing under a time label,
//    the day and the time where no label stands above (the Diary).
// No faces and no chevron. 12px above and below: 68px with two lines, 20px more for each line.
//
// The trailing column (48px, its marks' ink on the column): the star on the name's first line;
// the cancelled mark or the one nested control (the Schedule-changed hint) on the last. A row
// with neither has no column, and its star ends the name's first line, taking 24px from that
// line only. A cancelled row is at 60%, star included, and says "Cancelled" in its time's place.
//
// What follows the clock (the hub's rows of today, `now`): "in 25 min" inside the hour, "On now"
// once started and "Started at 6:30 pm" from an hour in (`ON_NOW_MS`), led by its dot, all in 600
// ink. Under a slot's time label a concert under way also reads "● On now", then "● Started at";
// elsewhere it keeps its start time, in 600 ink, led by the dot.
//
// How each line holds its shape (the Maintainer, 2026-11-11; the row spec, 2026-11-16):
// - the name wraps and is never cut, its lines balanced, never broken after an "&" or an initial;
//   4 or more presenters show 2 whole names, then "+N", spoken "and N more" (ADR 0013);
// - a printed title takes two lines at most, then "…";
// - the accompanists take one line: as many whole names as fit, then "+N" (fit-names.ts);
// - the facts break at a "·" first (the "·" dropped there), a fact longer than a line wraps
//   inside itself, and they stop at two lines; on the second the Sabha is shortened with "…"
//   before anything else, so the Item count always shows (the Maintainer, 2026-11-17).

import { IconCalendarExclamation, IconCalendarX, IconStarFilled } from '@tabler/icons-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fitNames, namesLine } from '../fit-names';
import { itemCount, nameBreaks, timeText, typeName } from '../format';
import { MESSAGES } from '../messages';
import { minutesTo, stageOf, startedAWhileAgo, type Concert } from '../spine';
import { KindMark } from './kind-mark';
import { useLineMetrics, type LineMetrics } from './line-metrics';

/** The mark for a concert under way: 8px of ink, still, spoken "On now" unless words say it. */
export function OnNowDot({ className, silent = false }: { className?: string; silent?: boolean }) {
  return (
    <span
      role={silent ? undefined : 'img'}
      aria-label={silent ? undefined : MESSAGES.spine.onNow}
      aria-hidden={silent || undefined}
      className={cn('inline-block size-2 shrink-0 rounded-full bg-foreground', className)}
    />
  );
}

/**
 * The "+N" after the presenters a row or the hub's hero names (ADR 0013), kept with the last
 * name's last word, and spoken "and N more".
 */
export function MoreNames({ count }: { count: number }) {
  return (
    <>
      <span aria-hidden> +{count}</span>
      <span className="sr-only"> {MESSAGES.spine.andMore(count)}</span>
    </>
  );
}

/** The trailing column's width: what it takes from every line of a row that has one. */
const COLUMN = 48;
/** A live dot and the 8px after it. */
const DOT = 16;

/**
 * The accompanists, on one line: as many whole names as fit the row's text column, then "+N".
 * `taken` is the room the row's trailing column or control takes from it.
 */
function Accompanists({
  names,
  taken,
  line,
}: {
  names: readonly string[];
  taken: number;
  line: LineMetrics | null;
}) {
  // A pixel spare for rounding. Where the page can't be measured, every name, clipped.
  const shown = line ? fitNames(names, line.width - taken - 1, line.measure) : names.length;
  return (
    <span className="overflow-hidden text-sub whitespace-nowrap text-muted-foreground">
      {namesLine(names, shown)}
    </span>
  );
}

/** One fact of the facts line: its words, how it is drawn, and whether it is live (600). */
interface Fact {
  text: string;
  node: ReactNode;
  live?: boolean;
  /** Led by the live dot. */
  dot?: boolean;
  /** Shortened with "…" first where the facts run past two lines: the Sabha. */
  cut?: boolean;
}

const SEPARATOR = ' · ';

/**
 * How many facts stand on the facts line's first line: as many whole ones as fit `width`, at
 * least one. Null where the first is longer than a line, and the line simply wraps.
 */
function firstLine(facts: readonly Fact[], width: number, line: LineMetrics): number | null {
  // Live words are 600, a little wider than the 400 they are measured in.
  const wide = (fact: Fact) =>
    line.measure(fact.text) * (fact.live ? 1.06 : 1) + (fact.dot ? DOT : 0);
  const room = width - 1;
  let used = wide(facts[0]!);
  if (used > room) return null;
  let count = 1;
  for (const fact of facts.slice(1)) {
    used += line.measure(SEPARATOR) + wide(fact);
    if (used > room) break;
    count += 1;
  }
  return count;
}

const joined = (facts: readonly Fact[]) =>
  facts.map((fact, i) => (
    <Fragment key={i}>
      {i > 0 && SEPARATOR}
      {fact.node}
    </Fragment>
  ));

/** The facts line, broken at a "·" first and stopped at two lines (see the head). */
function FactsLine({
  facts,
  width,
  line,
}: {
  facts: readonly Fact[];
  width: number;
  line: LineMetrics | null;
}) {
  const count = line ? firstLine(facts, width, line) : null;
  if (count === null) {
    return (
      <span data-facts className="line-clamp-2 text-sub break-words text-muted-foreground">
        {joined(facts)}
      </span>
    );
  }
  const rest = facts.slice(count);
  return (
    <span data-facts className="flex flex-col text-sub text-muted-foreground">
      <span>{joined(facts.slice(0, count))}</span>
      {rest.length > 0 &&
        (rest.some((fact) => fact.cut) ? (
          // The Sabha gives way first, so what follows it (the Item count) always shows
          // (the Maintainer, 2026-11-17).
          <span className="flex min-w-0 whitespace-nowrap">
            {rest.map((fact, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="shrink-0 whitespace-pre">{SEPARATOR}</span>}
                <span className={fact.cut ? 'min-w-0 truncate' : 'shrink-0'}>{fact.node}</span>
              </Fragment>
            ))}
          </span>
        ) : (
          <span className="truncate">{joined(rest)}</span>
        ))}
    </span>
  );
}

export function ConcertRow({
  concert,
  on = false,
  day,
  timeless = false,
  now,
  onOpen,
  onHint,
  star = true,
  control,
  controlWidth = 0,
}: {
  concert: Concert;
  /** Under way: the dot leads the facts, its time (or "On now", then "Started at") in 600 ink. */
  on?: boolean;
  /** Its day, said before the time where no label above says it: the Diary's "Sat 19 Dec". */
  day?: string;
  /** Under a label that says its time (a Shortlist slot): the facts start with the Sabha. */
  timeless?: boolean;
  /**
   * The clock, where the row says how close the concert is: the hub's rows of today. Under a slot's
   * time label (`timeless`) it only tells "On now" from "Started at".
   */
  now?: Date;
  /** Opens the concert's sheet; without it, or once Heard, the row opens its Event. */
  onOpen?: (concert: Concert) => void;
  /** Opens what the Schedule changed, for a Shortlisted row that carries the hint. */
  onHint?: (eventId: string) => void;
  /** Shows the Shortlisted star; the lapse question's rows show none. */
  star?: boolean;
  /** The row's one nested control at its right, as the lapse question's "Yes". */
  control?: ReactNode;
  /** How wide `control` is, with the 8px before it, so the lines give way to it. */
  controlWidth?: number;
}) {
  const line = useLineMetrics();
  const stage = stageOf(concert);
  const own = concert.own;
  const changed = stage === 'shortlisted' && own!.event.scheduleChanged && onHint;
  const time = concert.startTime ? timeText(concert.startTime) : null;
  // Under a slot's time label the clock says only what is under way, never "in 25 min".
  const near = now && !timeless ? minutesTo(concert, now) : null;
  const starred = star && stage === 'shortlisted';
  // Slot 2 of the trailing column: the changed hint, which can be acted on, else the cancelled
  // mark. With nothing there the row has no column.
  const slot2 = changed ? 'hint' : concert.cancelled ? 'cancelled' : null;
  const taken = slot2 ? COLUMN : controlWidth;

  // The facts, time first.
  const facts: Fact[] = [];
  if (day) facts.push({ text: day, node: <span className="whitespace-nowrap">{day}</span> });
  if (concert.cancelled) {
    // "Cancelled" in the time's place (the row spec, 2026-11-16).
    facts.push({ text: MESSAGES.spine.cancelled, node: MESSAGES.spine.cancelled });
  } else if (on && (now !== undefined || timeless)) {
    // On the hub, and under a slot's time label, a concert under way reads "On now", its dot
    // leading the line: "● On now · Sabha" (the Maintainer, 2026-11-17). An hour in it reads
    // "● Started at 6:30 pm" until it is over: still on, its end maybe worth catching (the
    // Maintainer, 2026-11-25).
    const words =
      now && time && startedAWhileAgo(concert, now)
        ? MESSAGES.spine.startedAt(time)
        : MESSAGES.spine.onNow;
    facts.push({
      text: words,
      live: true,
      dot: true,
      node: (
        <span className="font-semibold whitespace-nowrap text-foreground">
          <OnNowDot silent className="mr-2 align-[0.1em]" />
          {words}
        </span>
      ),
    });
  } else if (near !== null) {
    const words = MESSAGES.spine.inMinutes(near);
    facts.push({
      text: words,
      live: true,
      node: <span className="font-semibold whitespace-nowrap text-foreground">{words}</span>,
    });
  } else if (time && !timeless) {
    facts.push({
      text: time,
      live: on,
      dot: on,
      node: (
        <span className="whitespace-nowrap">
          {on && <OnNowDot className="mr-2 align-[0.1em]" />}
          <span className={cn(on && 'font-semibold text-foreground')}>{time}</span>
        </span>
      ),
    });
  }
  if (concert.sabha) facts.push({ text: concert.sabha, node: concert.sabha, cut: true });
  // The Item count once it has any (the Maintainer, 2026-11-13: never "0 Items").
  if (stage === 'heard' && own!.itemCount > 0) {
    const count = itemCount(own!.itemCount);
    facts.push({ text: count, node: <span className="whitespace-nowrap">{count}</span> });
  }

  const starMark = (
    <IconStarFilled
      role="img"
      aria-label={MESSAGES.spine.shortlisted}
      data-star
      className="size-4 shrink-0 text-foreground"
    />
  );
  const lead = nameBreaks(concert.lead);
  // The kind's mark and the type go with the lead's last word, never alone on a line.
  const lastWord = lead.lastIndexOf(' ') + 1;
  const marked = concert.kind !== 'concert' || concert.type;
  const width = line ? line.width - taken : 0;
  const body: ReactNode = (
    <span className={cn('flex min-w-0 flex-1 gap-0', concert.cancelled && 'opacity-60')}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span data-name className="relative min-w-0 break-words text-balance text-foreground">
          {/* With no column, the star ends the name's first line, 8px after it: its room is
              held on that line only, and the star itself follows the name, so it is heard
              after it. */}
          {starred && !slot2 && <span aria-hidden className="float-right h-6 w-6" />}
          {marked ? (
            <>
              {lead.slice(0, lastWord)}
              <span className="whitespace-nowrap">
                {lead.slice(lastWord)}
                {concert.more > 0 && <MoreNames count={concert.more} />}
                <KindMark kind={concert.kind} className="ml-1.5" />
                {concert.type && (
                  <span className="ml-2 text-caption text-muted-foreground">
                    {typeName(concert.type)}
                  </span>
                )}
              </span>
            </>
          ) : (
            lead
          )}
          {starred && !slot2 && <span className="absolute top-1 right-0 flex">{starMark}</span>}
        </span>
        {concert.title && (
          <span className="line-clamp-2 text-sub break-words text-muted-foreground">
            {concert.title}
          </span>
        )}
        {concert.accompanists.length > 0 && (
          <Accompanists names={concert.accompanists} taken={taken} line={line} />
        )}
        {facts.length > 0 && <FactsLine facts={facts} width={width} line={line} />}
      </span>
      {slot2 && (
        // The trailing column: the star on the first line, slot 2 on the last.
        <span data-trailing className="flex w-12 shrink-0 flex-col items-end justify-between">
          <span className="flex h-6 items-center">{starred && starMark}</span>
          {slot2 === 'cancelled' && (
            // The word says it; the mark is quiet.
            <IconCalendarX aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          )}
        </span>
      )}
    </span>
  );
  // The focus ring sits inside the row: a day's rows are clipped to their box while they skip
  // drawing, which would cut a ring drawn outside it.
  const shape = 'flex min-w-0 flex-1 py-3 text-left focus-visible:-outline-offset-2';
  return (
    <li data-row="concert" className="relative flex items-center gap-2 hairline-b">
      {onOpen && stage !== 'heard' && concert.listing ? (
        <button type="button" onClick={() => onOpen(concert)} className={shape}>
          {body}
        </button>
      ) : own ? (
        <Link href={`/event/${own.event.id}`} className={shape}>
          {body}
        </Link>
      ) : (
        <div className={shape}>{body}</div>
      )}
      {/* The hint is its own 48px button in slot 2, on the row's last line, its mark's ink on
          the column: it opens what changed, to take or keep (the Maintainer, 2026-11-07). */}
      {changed && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-[17px] -bottom-0.5 text-muted-foreground"
          aria-label="Schedule changed"
          onClick={() => onHint(own!.event.id)}
        >
          <IconCalendarExclamation aria-hidden />
        </Button>
      )}
      {control}
    </li>
  );
}
