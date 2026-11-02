// The Undo bar (design D16): directly above the screen's bottom action, never covering it, for
// 5 seconds, paused while it has focus. Screen readers hear "Item 5 deleted. Undo available."
// An Undo that fails to save keeps its own bar, in destructive, with Try again and Dismiss,
// stacked above the newest delete's bar; each failure mounts its bar afresh, so it is announced.

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { MESSAGES } from '../messages';
import { dismissUndo, pauseUndo, subscribeUndo, undo, undoOffers, undoText } from '../undo';

const BAR =
  'mx-4 mb-2 flex flex-wrap items-center justify-between gap-x-3 rounded-xl bg-secondary py-1 pr-1 pl-4 text-body';

export function UndoBar() {
  const offers = useSyncExternalStore(subscribeUndo, undoOffers);
  const live = offers.find((offer) => !offer.failed);
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {live && MESSAGES.undo.spoken(live.message)}
      </div>
      {offers.map((offer) =>
        offer.failed ? (
          <div
            key={`${offer.receipt.id}:${offer.attempt}`}
            role="alert"
            className={`${BAR} text-destructive`}
          >
            <span className="py-2">{undoText(offer)}</span>
            {/* At large text the two buttons wrap under the words rather than run off. */}
            <span className="flex flex-wrap">
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => void undo(offer.receipt)}
              >
                {MESSAGES.actions.tryAgain}
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => dismissUndo(offer.receipt.id)}
              >
                {MESSAGES.actions.dismiss}
              </Button>
            </span>
          </div>
        ) : (
          <div
            key={offer.receipt.id}
            className={BAR}
            onFocus={() => pauseUndo(true)}
            onBlur={() => pauseUndo(false)}
          >
            <span className="py-2">{offer.message}</span>
            <Button variant="ghost" onClick={() => void undo(offer.receipt)}>
              {MESSAGES.actions.undo}
            </Button>
          </div>
        ),
      )}
    </>
  );
}
