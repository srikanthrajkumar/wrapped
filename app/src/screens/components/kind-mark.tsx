// An Event's kind as a mark (T122; DESIGN.md "Event"): a Lecdem, a Dance or a Harikatha carries
// one where its name shows, a Concert none, so the common case stays bare. The mark is spoken by
// its kind's name, unless the word stands beside it (`spoken={false}`), where it would be heard
// twice ("Dance Dance").

import { IconBook, IconPresentation, IconStretching, type Icon } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { EventKind } from '../../model';
import { kindName } from '../format';

// A board for a talk, a figure in movement for a Dance, a book for a story told from scripture.
const MARKS: Partial<Record<EventKind, Icon>> = {
  lecdem: IconPresentation,
  dance: IconStretching,
  harikatha: IconBook,
};

export function KindMark({
  kind,
  spoken = true,
  className,
}: {
  kind: EventKind;
  spoken?: boolean;
  className?: string;
}) {
  const Mark = MARKS[kind];
  if (!Mark) return null;
  return (
    <Mark
      {...(spoken ? { role: 'img', 'aria-label': kindName(kind) } : { 'aria-hidden': true })}
      className={cn('inline size-5 shrink-0 align-[-0.15em] text-muted-foreground', className)}
    />
  );
}
