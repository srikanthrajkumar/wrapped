// An Event's kind as a mark (T122; DESIGN.md "Event"): a Lecdem, a Dance or a Harikatha carries
// one where its name shows, a Concert none, so the common case stays bare. The mark is spoken by
// its kind's name.

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

export function KindMark({ kind, className }: { kind: EventKind; className?: string }) {
  const Mark = MARKS[kind];
  if (!Mark) return null;
  return (
    <Mark
      role="img"
      aria-label={kindName(kind)}
      className={cn('inline size-5 shrink-0 align-[-0.15em] text-muted-foreground', className)}
    />
  );
}
