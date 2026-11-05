// The Concert summary (walkthrough S13; DESIGN.md "Finishing a Concert"): shown once, as a
// modal, the next time the app opens or comes back after a Concert ends. The Items and Ragas as
// two numbers (Linked ragas counted once), then the firsts it added to the season. With nothing
// to say there is no modal. Which Concert, and "shown", are the store's (store/concert-summary).

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
import { readyCatalog } from '../../catalog/use-catalog';
import { takeSummary } from '../../store/concert-summary';
import { countRagas, listEventSummaries, listItems, whatItAdded } from '../../store/queries';
import { eventLine } from '../format';

interface Summary {
  title: string;
  line: string;
  items: number;
  ragas: number;
  firstRagas: string[];
  newComposers: string[];
}

/** Everything the modal shows, read before it opens, so it never fills in while on screen. */
async function readSummary(eventId: string): Promise<Summary | null> {
  const catalog = await readyCatalog();
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
        const eventId = await takeSummary();
        const next = eventId ? await readSummary(eventId) : null;
        if (next) {
          setSummary(next);
          setOpen(true);
          return;
        }
      } catch {
        // A summary is never worth an error: the next open looks again.
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
      <DialogContent showCloseButton={false} className="gap-0 p-0">
        <DialogHeader className="gap-0 py-2 pr-16 pl-6">
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
