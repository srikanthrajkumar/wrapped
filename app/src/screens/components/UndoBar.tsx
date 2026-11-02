// The Undo bar (design D16): directly above the screen's bottom action, never covering it, for
// 5 seconds, paused while it has focus. Screen readers hear "Item 5 deleted. Undo available."
// A failed Undo keeps an icon-led row (decided 2026-11-02): the alert mark, "Undo failed ·
// Concert", Try again and Dismiss. Only the newest failed one shows, with "+1" when older ones wait; the
// "+1" brings the next forward, and on the Event screen they are also under "⋯". Each failure
// mounts its row afresh, so it is announced.

import { IconAlertCircle, IconRefresh, IconX } from '@tabler/icons-react';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { MESSAGES } from '../messages';
import {
  canRetryUndo,
  dismissUndo,
  pauseUndo,
  subscribeUndo,
  undo,
  undoLabel,
  undoOffers,
  undoText,
  type UndoOffer,
} from '../undo';

const BAR =
  'mx-4 mb-2 flex flex-wrap items-center gap-x-1 rounded-xl bg-secondary py-1 pl-3 text-body';

export function UndoBar() {
  const offers = useSyncExternalStore(subscribeUndo, undoOffers);
  const [back, setBack] = useState(0);
  const live = offers.find((offer) => !offer.failed);
  const failed = offers.filter((offer) => offer.failed);
  // The newest failed offer, or an older one brought forward with "+1".
  const shown = failed.length > 0 ? failed[failed.length - 1 - (back % failed.length)] : undefined;
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {live && MESSAGES.undo.spoken(live.message)}
      </div>
      {shown && (
        <FailedUndo
          key={`${shown.receipt.id}:${shown.attempt}`}
          offer={shown}
          others={failed.length - 1}
          onNext={() => setBack(back + 1)}
        />
      )}
      {live && (
        <div
          key={live.receipt.id}
          className={`${BAR} justify-between pr-1`}
          onFocus={() => pauseUndo(true)}
          onBlur={() => pauseUndo(false)}
        >
          <span className="py-2 pl-1">{live.message}</span>
          <Button variant="ghost" onClick={() => void undo(live.receipt)}>
            {MESSAGES.actions.undo}
          </Button>
        </div>
      )}
    </>
  );
}

function FailedUndo({
  offer,
  others,
  onNext,
}: {
  offer: UndoOffer;
  others: number;
  onNext(): void;
}) {
  const sentence = undoText(offer);
  const label = undoLabel(offer);
  return (
    <div role="alert" className={`${BAR} text-destructive`}>
      <IconAlertCircle aria-hidden className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 py-2 break-words">
        <span aria-hidden>{label}</span>
        <span className="sr-only">{sentence}</span>
      </span>
      <span className="flex items-center">
        {others > 0 && (
          <Button
            variant="ghost"
            className="min-w-12 text-destructive"
            aria-label={`${others} more failed ${others === 1 ? 'Undo' : 'Undos'}: show the next`}
            onClick={onNext}
          >
            {MESSAGES.undo.more(others)}
          </Button>
        )}
        {canRetryUndo(offer) && (
          <Button
            variant="ghost"
            size="icon"
            className="size-12 text-destructive"
            aria-label={`${MESSAGES.actions.tryAgain}. ${sentence}`}
            onClick={() => void undo(offer.receipt)}
          >
            <IconRefresh aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-12 text-destructive"
          aria-label={`${MESSAGES.actions.dismiss}. ${sentence}`}
          onClick={() => dismissUndo(offer.receipt.id)}
        >
          <IconX aria-hidden />
        </Button>
      </span>
    </div>
  );
}
