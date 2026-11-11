// The list row (docs/designs/season-spine.md Part 4; DESIGN.md "The row"): one concert, the same
// on Starting soon, What's on, the Shortlist and the Diary, whichever stage it is at. Its lead
// (with its kind's mark, and its type when it isn't vocal), a printed title, the accompanists on
// a muted line, then the Sabha and the time. No faces, no button and no chevron. The rasika's
// own carry a quiet mark, never bold or a card (SF-D31): a star once Shortlisted, the Item count
// once Heard. One under way keeps its start time, in full ink, with a dot before it (the
// Maintainer, 2026-11-11). A cancelled one is dimmed and marked.
//
// How each line holds its shape (the Maintainer, 2026-11-11, from a mockup of every variant):
// - the lead wraps and is never cut; its type stays with its last word, never alone on a line;
// - a printed title takes two lines at most, then "…";
// - the accompanists take one line: as many whole names as fit, then "+N" (fit-names.ts);
// - the last line breaks only between its facts: the time never parts from its dot and star.
// So a row is 64px with two lines and 20px more for each line added, and nothing in it is cut
// but a title past its second line; the sheet has it all.

import { IconCalendarExclamation, IconCalendarX, IconStarFilled } from '@tabler/icons-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fitNames, namesLine } from '../fit-names';
import { itemCount, timeText, typeName } from '../format';
import { MESSAGES } from '../messages';
import { stageOf, type Concert } from '../spine';
import { KindMark } from './kind-mark';
import { useLineMetrics } from './line-metrics';

/** The mark for a concert under way: 8px of ink, still, spoken "On now". */
export function OnNowDot({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={MESSAGES.spine.onNow}
      className={cn('inline-block size-2 shrink-0 rounded-full bg-foreground', className)}
    />
  );
}

/** What sits at the row's right and takes room from its text: the cancelled mark, the hint. */
const CANCELLED_MARK = 8 + 20;
const HINT = 8 + 48 - 14;

/**
 * The accompanists, on one line: as many whole names as fit the row's text column, then "+N".
 * `taken` is the room the row's marks take from it.
 */
function Accompanists({ names, taken }: { names: readonly string[]; taken: number }) {
  const line = useLineMetrics();
  // A pixel spare for rounding. Where the page can't be measured, every name, clipped.
  const shown = line ? fitNames(names, line.width - taken - 1, line.measure) : names.length;
  return (
    <span className="overflow-hidden text-sub whitespace-nowrap text-muted-foreground">
      {namesLine(names, shown)}
    </span>
  );
}

export function ConcertRow({
  concert,
  on = false,
  day,
  onOpen,
  onHint,
}: {
  concert: Concert;
  /** Under way: the dot, and the start time in full ink. */
  on?: boolean;
  /** Its day, said before the time where the list isn't under it: the Diary's "Sat 19 Dec". */
  day?: string;
  /** Opens the concert's sheet; without it, or once Heard, the row opens its Event. */
  onOpen?: (concert: Concert) => void;
  /** Opens what the Schedule changed, for a Shortlisted row that carries the hint. */
  onHint?: (eventId: string) => void;
}) {
  const stage = stageOf(concert);
  const own = concert.own;
  const changed = stage === 'shortlisted' && own!.event.scheduleChanged && onHint;
  const time = concert.startTime ? timeText(concert.startTime) : null;
  const star = stage === 'shortlisted' && (
    <IconStarFilled
      role="img"
      aria-label={MESSAGES.spine.shortlisted}
      className="ml-1.5 inline size-3.5 shrink-0 align-[-0.1em] text-foreground"
    />
  );
  // The last line's facts, each whole: the line breaks between them, never inside one, and the
  // time keeps its dot before it and its star after it.
  const facts: ReactNode[] = [];
  if (concert.sabha) facts.push(concert.sabha);
  if (day) facts.push(<span className="whitespace-nowrap">{day}</span>);
  if (time) {
    facts.push(
      <span className="whitespace-nowrap">
        {on && <OnNowDot className="mr-1.5 align-[0.1em]" />}
        <span className={cn(on && 'text-foreground')}>{time}</span>
        {star}
      </span>,
    );
  }
  if (stage === 'heard') {
    facts.push(<span className="whitespace-nowrap">{itemCount(own!.itemCount)}</span>);
  }
  // The type goes with the lead's last word, so it never stands alone on a line.
  const lastWord = concert.lead.lastIndexOf(' ') + 1;
  const body: ReactNode = (
    <>
      <span className={cn('flex min-w-0 flex-1 flex-col', concert.cancelled && 'opacity-60')}>
        <span className="break-words text-foreground">
          <KindMark kind={concert.kind} className="mr-1.5" />
          {concert.type ? (
            <>
              {concert.lead.slice(0, lastWord)}
              <span className="whitespace-nowrap">
                {concert.lead.slice(lastWord)}
                <span className="ml-2 text-caption text-muted-foreground">
                  {typeName(concert.type)}
                </span>
              </span>
            </>
          ) : (
            concert.lead
          )}
        </span>
        {concert.title && (
          <span className="line-clamp-2 text-sub break-words text-muted-foreground">
            {concert.title}
          </span>
        )}
        {concert.accompanists.length > 0 && (
          <Accompanists
            names={concert.accompanists}
            taken={(concert.cancelled ? CANCELLED_MARK : 0) + (changed ? HINT : 0)}
          />
        )}
        <span className="text-sub text-muted-foreground">
          {facts.map((fact, i) => (
            <Fragment key={i}>
              {i > 0 && ' · '}
              {fact}
            </Fragment>
          ))}
          {/* With no time to follow, the star follows the last fact. */}
          {!time && star}
        </span>
      </span>
      {concert.cancelled && (
        <IconCalendarX
          role="img"
          aria-label="Cancelled"
          className="size-5 shrink-0 text-muted-foreground"
        />
      )}
    </>
  );
  // A two-line row is 64px and each line more adds 20px, the hairline drawn inside.
  // The focus ring sits inside the row: a day's rows are clipped to their box while they skip
  // drawing, which would cut a ring drawn outside it.
  const shape =
    'flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2.5 text-left focus-visible:-outline-offset-2';
  return (
    <li className="flex items-center gap-2 hairline-b">
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
      {/* The hint is its own button, its 48px reaching past the row's edge: it opens what
          changed, to take or keep (the Maintainer, 2026-11-07). */}
      {changed && (
        <Button
          variant="ghost"
          size="icon"
          className="-mr-3.5 text-muted-foreground"
          aria-label="Schedule changed"
          onClick={() => onHint(own!.event.id)}
        >
          <IconCalendarExclamation aria-hidden />
        </Button>
      )}
    </li>
  );
}
