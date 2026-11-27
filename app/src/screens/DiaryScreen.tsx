// The Diary (docs/designs/season-spine.md Part 8, cut to its list by the Maintainer on
// 2026-11-11; DESIGN.md "Diary"): every concert the rasika has heard, newest first, under a
// plain tab header, so each logged concert has a home now that the days gone left the strip.
// Each row opens its Event. Once one is heard, the Recap card stands at its top: the season's
// stats and Cards come later, and for now it says so.

import { IconNotebook } from '@tabler/icons-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ConcertRow } from './components/ConcertRow';
import { RecapCard } from './components/RecapCard';
import { Panel, Screen, TabHeader, useKeptScroll } from './components/layout';
import { dayText } from './format';
import { MESSAGES } from './messages';
import { diary, isoDay, owned, recapShows } from './spine';
import { useSeason } from './use-season';

export function DiaryScreen() {
  return (
    <Screen>
      <DiaryView />
    </Screen>
  );
}

function DiaryView() {
  const data = useSeason();
  useKeptScroll(data !== undefined);
  const header = <TabHeader title={MESSAGES.tabs.diary} />;
  if (!data) return header;
  const heard = diary(data.summaries);
  const today = isoDay(data.now);
  return (
    <>
      {header}
      {recapShows(data.summaries) && <RecapCard />}
      {heard.length === 0 ? (
        <Empty className="flex-1 pb-24">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconNotebook aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{MESSAGES.spine.empty.diary.title}</EmptyTitle>
            <EmptyDescription>{MESSAGES.spine.empty.diary.line}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // One panel, under the page's title (foundations, 2026-11-16).
        <Panel>
          {heard.map((summary) => (
            <ConcertRow
              key={summary.event.id}
              concert={owned(summary)}
              // Not under its day here, so the row says it: "Sat 19 Dec · 6:30 pm".
              day={
                summary.event.date === today ? MESSAGES.season.today : dayText(summary.event.date)
              }
            />
          ))}
        </Panel>
      )}
    </>
  );
}
