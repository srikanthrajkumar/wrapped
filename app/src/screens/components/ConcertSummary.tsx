// The Concert summary (walkthrough S13; DESIGN.md "Finishing a Concert"): shown once, as a
// modal, the next time the app opens or comes back after a Concert ends. The Items and Ragas as
// two numbers (Linked ragas counted once), then the firsts it added to the season. With nothing
// to say there is no modal. Which Concert, and "shown", are the store's (store/concert-summary):
// "shown" is written only once the summary is read and still due, just before it opens, so one
// that can't be read stays due for the next open.

import { IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { openCatalog } from '../../catalog/current';
import { CATALOG_WAIT_MS } from '../../catalog/use-catalog';
import { dueSummary, markSummaryShown } from '../../store/concert-summary';
import { countRagas, listEventSummaries, listItems, whatItAdded } from '../../store/queries';
import { Motif } from '../../motif/Motif';
import { ragaSeeds } from '../../motif/ragas';
import type { RagaSeed } from '../../motif/seed';
import { eventLine } from '../format';

interface Summary {
  title: string;
  line: string;
  items: number;
  ragas: number;
  firstRagas: string[];
  newComposers: string[];
  /** What its edge's motif is drawn from. */
  played: RagaSeed[];
}

const SLOW = Symbol('catalog still opening');

/**
 * Everything the modal shows, read before it opens, so it never fills in while on screen. A
 * catalog still opening after CATALOG_WAIT_MS would count Linked ragas apart, so the summary waits
 * for the next open; a phone with no catalog at all counts as it logged, as everything else does.
 */
async function readSummary(eventId: string): Promise<Summary | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const catalog = await Promise.race([
    openCatalog().catch(() => null),
    new Promise<typeof SLOW>((resolve) => {
      timer = setTimeout(() => resolve(SLOW), CATALOG_WAIT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  if (catalog === SLOW) return null;
  const [summaries, items, added] = await Promise.all([
    listEventSummaries(),
    listItems(eventId),
    whatItAdded(eventId, undefined, catalog),
  ]);
  const summary = summaries.find((s) => s.event.id === eventId);
  if (!summary || items.length === 0) return null;
  return {
    title: summary.knownBy ?? summary.sabha?.name ?? 'Concert',
    line: eventLine(summary.event, summary.knownBy && summary.sabha?.name),
    items: items.length,
    ragas: countRagas(items, catalog),
    firstRagas: added.ragas,
    newComposers: added.composers,
    played: ragaSeeds(
      items.flatMap((item) => item.ragas.flatMap((raga) => (raga.key === null ? [] : [raga.key]))),
      catalog,
    ),
  };
}

/** On each open of the app, and each return to it, the summary of a Concert that has ended. */
export function ConcertSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  // One summary at a time: an open, a return, or one still being read waits for it to close.
  const showing = useRef(false);

  useEffect(() => {
    const look = async () => {
      if (showing.current || document.visibilityState !== 'visible') return;
      showing.current = true;
      try {
        const eventId = await dueSummary();
        const next = eventId ? await readSummary(eventId) : null;
        // Still due after the read (no logging began meanwhile), and not shown by another tab.
        if (next && (await dueSummary()) === eventId && (await markSummaryShown(eventId!))) {
          setSummary(next);
          setOpen(true);
          return;
        }
      } catch {
        // A summary is never worth an error, and none was marked shown: the next open looks again.
      }
      showing.current = false;
    };
    void look();
    document.addEventListener('visibilitychange', look);
    return () => document.removeEventListener('visibilitychange', look);
  }, []);

  if (!summary) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) showing.current = false;
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 p-0"
        // Focus goes to the modal itself, not its close button, as the sheets do (design D24).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        {/* The Concert as one field at the modal's top edge, the summary drawn up over it as a
            sheet (DESIGN.md "The motif"). */}
        <div aria-hidden className="relative h-24 overflow-hidden rounded-t-2xl bg-secondary">
          <Motif seed={{ kind: 'concert', ragas: summary.played }} className="size-full" />
          <div className="absolute inset-x-0 bottom-0 h-[18px] rounded-t-[18px] bg-popover" />
        </div>
        <DialogHeader className="-mt-2 gap-0 pt-0 pr-16 pb-2 pl-6">
          <DialogTitle className="flex min-h-12 items-center break-words">
            {summary.title}
          </DialogTitle>
          {/* 4px under the title's line, not under its 48px row. */}
          <DialogDescription className="-mt-2.5">{summary.line}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          {/* Its mark ends 16px in from the corner, level with the title. */}
          <Button variant="ghost" size="icon" className="absolute top-2 right-2">
            <IconX aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        <dl className="grid grid-cols-2 gap-4 px-6 pt-4 pb-6">
          <Count n={summary.items} one="Item" many="Items" />
          <Count n={summary.ragas} one="Raga" many="Ragas" />
        </dl>

        {(summary.firstRagas.length > 0 || summary.newComposers.length > 0) && (
          <dl className="flex flex-col gap-4 px-6 pt-4 pb-6 hairline-t">
            <Firsts names={summary.firstRagas} one="First Raga" many="First Ragas" />
            <Firsts names={summary.newComposers} one="New Composer" many="New Composers" />
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-caption text-muted-foreground">{n === 1 ? one : many}</dt>
      <dd className="text-display font-bold tabular-nums">{n}</dd>
    </div>
  );
}

function Firsts({ names, one, many }: { names: string[]; one: string; many: string }) {
  if (names.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-muted-foreground">{names.length === 1 ? one : many}</dt>
      <dd className="break-words">{names.join(', ')}</dd>
    </div>
  );
}
