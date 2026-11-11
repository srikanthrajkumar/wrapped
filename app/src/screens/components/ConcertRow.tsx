// The list row (docs/designs/season-spine.md Part 4; DESIGN.md "The row"): one concert, the same
// on Starting soon, What's on, the Shortlist and the Diary, whichever stage it is at. Its lead
// (with its kind's mark, and its type when it isn't vocal), a printed title, the accompanists on
// a muted line, then the Sabha and the time. No faces, no button and no chevron. The rasika's
// own carry a quiet mark, never bold or a card (SF-D31): a star once Shortlisted, the Item count
// once Heard. One under way keeps its start time, in full ink, with a dot before it (the
// Maintainer, 2026-11-11). A cancelled one is dimmed and marked.

import { IconCalendarExclamation, IconCalendarX, IconStarFilled } from '@tabler/icons-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { itemCount, timeText, typeName } from '../format';
import { MESSAGES } from '../messages';
import { stageOf, type Concert } from '../spine';
import { KindMark } from './kind-mark';

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

export function ConcertRow({
  concert,
  on = false,
  when,
  onOpen,
  onHint,
}: {
  concert: Concert;
  /** Under way: the dot, and the start time in full ink. */
  on?: boolean;
  /** Said in the time's place where the list isn't under its day ("Sat 19 Dec · 6:30 pm"). */
  when?: string;
  /** Opens the concert's sheet; without it, or once Heard, the row opens its Event. */
  onOpen?: (concert: Concert) => void;
  /** Opens what the Schedule changed, for a Shortlisted row that carries the hint. */
  onHint?: (eventId: string) => void;
}) {
  const stage = stageOf(concert);
  const time = when ?? (concert.startTime ? timeText(concert.startTime) : null);
  const body: ReactNode = (
    <>
      <span className={cn('flex min-w-0 flex-1 flex-col', concert.cancelled && 'opacity-60')}>
        <span className="break-words text-foreground">
          <KindMark kind={concert.kind} className="mr-1.5" />
          {concert.lead}
          {concert.type && (
            <span className="ml-2 text-caption text-muted-foreground">
              {typeName(concert.type)}
            </span>
          )}
        </span>
        {concert.title && (
          <span className="text-sub break-words text-muted-foreground">{concert.title}</span>
        )}
        {concert.accompanists.length > 0 && (
          // Each name whole: the line wraps at a separator, never inside a name (the council,
          // 2026-11-11: "Anirudh / Athreya" left one word alone on a line).
          <span className="text-sub text-muted-foreground">
            {concert.accompanists.map((name, i) => (
              <Fragment key={i}>
                {i > 0 && ' · '}
                <span className="inline-block max-w-full break-words">{name}</span>
              </Fragment>
            ))}
          </span>
        )}
        {/* One line of text, its marks set in it: the dot before the time, the star after. */}
        <span className="text-sub text-muted-foreground">
          {concert.sabha}
          {concert.sabha && time && ' · '}
          {on && <OnNowDot className="mr-1.5 align-[0.1em]" />}
          {time && <span className={cn(on && 'text-foreground')}>{time}</span>}
          {stage === 'shortlisted' && (
            <IconStarFilled
              role="img"
              aria-label={MESSAGES.spine.shortlisted}
              className="ml-1.5 inline size-3.5 shrink-0 align-[-0.1em] text-foreground"
            />
          )}
          {stage === 'heard' && ` · ${itemCount(concert.own!.itemCount)}`}
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
  const own = concert.own;
  const changed = stage === 'shortlisted' && own!.event.scheduleChanged && onHint;
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
