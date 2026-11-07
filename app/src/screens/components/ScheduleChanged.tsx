// The "schedule changed" sheet (the Maintainer, 2026-11-07): opened from the hint on a row of
// Next, it shows what the newer Schedule version changes, the Event's value beside the entry's,
// only for the fields that differ (date, time, Sabha, kind, title, billed Artists), each led by
// a mark rather than a word. "Take it" gives the Event those values (store/schedule.ts
// takeSchedule); "Keep mine" leaves it as it is and clears the hint until a newer version.
// Both are journalled and tracked like any save, so a failure shows its row in the sheet.

import {
  IconArrowRight,
  IconBuildingCommunity,
  IconCalendar,
  IconCategory,
  IconCheck,
  IconClock,
  IconLetterT,
  IconMinus,
  IconUsers,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  keepMine,
  scheduleChanges,
  takeSchedule,
  type BilledName,
  type ScheduleChange,
} from '../../store/schedule';
import { dayText, kindName, roleName, timeText } from '../format';
import type { Target } from '../save-feedback';
import { offerUndo } from '../undo';
import { NotSavedLine, saveWith, useSaveFeedback } from './feedback';
import { KindMark } from './kind-mark';
import { SheetFrame, useLingering } from './sheet-frame';

/** The journal's entry for an answer to the hint (contracts/season-export.md). */
const hintTarget = (eventId: string): Target => ({
  table: 'events',
  id: eventId,
  field: 'scheduleChanged',
});

/** Each field's mark, spoken by its name. */
const FIELDS: Record<ScheduleChange['field'], { mark: Icon; name: string }> = {
  date: { mark: IconCalendar, name: 'Date' },
  startTime: { mark: IconClock, name: 'Time' },
  sabha: { mark: IconBuildingCommunity, name: 'Sabha' },
  kind: { mark: IconCategory, name: 'Kind' },
  title: { mark: IconLetterT, name: 'Title' },
  billed: { mark: IconUsers, name: 'Artists' },
};

const None = () => (
  <IconMinus role="img" aria-label="None" className="size-5 text-muted-foreground" />
);

const Billed = ({ people }: { people: BilledName[] }) =>
  people.length === 0 ? (
    <None />
  ) : (
    <ul className="flex flex-col gap-1.5">
      {/* Each name with its Role under it, so a long name never splits from its Role. */}
      {people.map((person, i) => (
        <li key={i} className="flex flex-col break-words">
          {person.name}
          {person.role && (
            <span className="text-sub text-muted-foreground">{roleName(person.role)}</span>
          )}
        </li>
      ))}
    </ul>
  );

/** One side of a change, as the screens show that field. */
function valueOf(change: ScheduleChange, side: 'from' | 'to'): ReactNode {
  switch (change.field) {
    case 'date':
      return dayText(change[side]);
    case 'startTime': {
      const time = change[side];
      return time === null ? <None /> : timeText(time);
    }
    case 'kind':
      return (
        <>
          <KindMark kind={change[side]} className="mr-1.5" />
          {kindName(change[side])}
        </>
      );
    case 'billed':
      return <Billed people={change[side]} />;
    default: {
      const text = change[side];
      return text === null ? <None /> : <span className="break-words">{text}</span>;
    }
  }
}

export function ScheduleChangedSheet({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  // Null when the hint's entry is no longer stored: then only "Keep mine". Once answered, the
  // last changes stay drawn while the sheet slides down.
  const read = useLiveQuery(() => scheduleChanges(eventId), [eventId]);
  const [shown] = useLingering(read ?? null);
  const feedback = useSaveFeedback();
  const target = hintTarget(eventId);
  const saving = feedback.get(target)?.status === 'saving';
  const version = shown?.version ?? null;

  const take = async () => {
    if (version === null) return;
    const taken = await saveWith(target, { answer: 'take', version }, () =>
      takeSchedule(eventId, version),
    );
    if (!taken) return;
    onOpenChange(false);
    // A change to Concert that took a typed title offers Undo, as a kind change does (T122).
    if (taken.receipt) offerUndo(taken.receipt);
  };
  const keep = async () => {
    const kept = await saveWith(target, { answer: 'keep', version }, () => keepMine(eventId));
    if (kept) onOpenChange(false);
  };

  return (
    <SheetFrame open={open} onOpenChange={onOpenChange} title="Schedule changed">
      {shown && shown.changes.length > 0 && (
        <dl className="flex flex-col gap-4 pb-2">
          {shown.changes.map((change) => {
            const { mark: Mark, name } = FIELDS[change.field];
            return (
              <div
                key={change.field}
                className="grid grid-cols-[20px_minmax(0,1fr)_16px_minmax(0,1fr)] items-start gap-x-3"
              >
                <dt className="pt-0.5">
                  <Mark role="img" aria-label={name} className="size-5 text-muted-foreground" />
                </dt>
                <dd className="text-muted-foreground">
                  <span className="sr-only">Yours: </span>
                  {valueOf(change, 'from')}
                </dd>
                <IconArrowRight aria-hidden className="mt-1 size-4 text-muted-foreground" />
                <dd>
                  <span className="sr-only">Schedule: </span>
                  {valueOf(change, 'to')}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <NotSavedLine targets={[target]} />
      <div className="grid grid-cols-2 gap-2 pt-4">
        <Button size="lg" variant="outline" disabled={saving} onClick={() => void keep()}>
          <IconX aria-hidden />
          Keep mine
        </Button>
        {version !== null && (
          <Button size="lg" disabled={saving} onClick={() => void take()}>
            <IconCheck aria-hidden />
            Take it
          </Button>
        )}
      </div>
    </SheetFrame>
  );
}
