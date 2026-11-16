// The Shortlist (docs/designs/season-spine.md Part 6; DESIGN.md "Shortlist"): the concerts the
// rasika would like to go to, by time, today first, under a plain tab header. Concerts starting
// within 30 minutes of each other read as one slot, so a clash is simply one slot with two rows
// (SF-D33). A row opens its listing's sheet, where "Shortlisted" takes it off again. One whose
// time has passed is not here: the hub asks about it once (ADR 0010).

import { IconStar } from '@tabler/icons-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ConcertRow } from './components/ConcertRow';
import { Panel, Screen, TabHeader, useKeptScroll } from './components/layout';
import { dayText, timeText } from './format';
import { MESSAGES } from './messages';
import { WHATS_ON } from './nav';
import { isoDay, shortlist, shortlistDays, underWay } from './spine';
import { useConcertSheets, useSeason } from './use-season';

export function ShortlistScreen() {
  return (
    <Screen>
      <ShortlistView />
    </Screen>
  );
}

function ShortlistView() {
  const data = useSeason();
  const { open, hint, sheets } = useConcertSheets(data);
  useKeptScroll(data !== undefined);
  const header = <TabHeader title={MESSAGES.tabs.shortlist} />;
  if (!data) return header;
  const days = shortlistDays(shortlist(data.all));
  const today = isoDay(data.now);
  return (
    <>
      {header}
      {days.length === 0 && (
        <Empty className="flex-1 pb-24">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconStar aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{MESSAGES.spine.empty.shortlist.title}</EmptyTitle>
            <EmptyDescription>{MESSAGES.spine.empty.shortlist.line}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" asChild>
              <Link href={WHATS_ON}>{MESSAGES.spine.whatsOn}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {/* Each day a section: its label in body 600 over its panel, 32px between days
          (foundations, 2026-11-16). */}
      <div className="flex flex-col [&>section+section]:mt-8">
        {days.map((day) => (
          <section key={day.date} aria-labelledby={`shortlist-${day.date}`}>
            <h2
              id={`shortlist-${day.date}`}
              data-section-label
              className="text-body font-semibold text-foreground"
            >
              {day.date === today ? MESSAGES.season.today : dayText(day.date)}
            </h2>
            <Panel as="div">
              {day.slots.map((slot, i) => {
                const start = slot[0]!.startTime;
                const clash = slot.length > 1 && start;
                // The slot after a clash is set apart by 16px (the council, 2026-11-11: the next
                // row read as part of it).
                const apart = i > 0 && !clash && day.slots[i - 1]!.length > 1;
                return (
                  // A slot of two or more is named by its time, so a clash reads as one choice.
                  <ul
                    key={slot[0]!.key}
                    className={apart ? 'pt-4' : undefined}
                    aria-label={clash ? MESSAGES.spine.at(slot.length, timeText(start)) : undefined}
                  >
                    {clash && (
                      // The slot's caption, inside the panel: 12px under what is above it, 8px
                      // over its first row (foundations).
                      <li
                        aria-hidden
                        className="flex items-baseline justify-between pt-3 pb-2 text-sub text-muted-foreground"
                      >
                        <span>{timeText(start)}</span>
                        <span className="tabular-nums">{slot.length}</span>
                      </li>
                    )}
                    {slot.map((concert) => (
                      <ConcertRow
                        key={concert.key}
                        concert={concert}
                        on={underWay(concert, data.notes, data.now)}
                        // Under its slot's time, the row doesn't say it again (the row spec).
                        timeless={!!clash}
                        onOpen={open}
                        onHint={hint}
                      />
                    ))}
                  </ul>
                );
              })}
            </Panel>
          </section>
        ))}
      </div>
      {sheets}
    </>
  );
}
