// The Undo bar (design D16): directly above the screen's bottom action, never covering it, for
// 5 seconds, paused while it has focus. Screen readers hear "Item 5 deleted. Undo available."
// When the Undo itself fails to save, the bar stays, in destructive, with Try again.

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';
import { currentUndo, pauseUndo, subscribeUndo, undo } from '../undo';

export function UndoBar({ onUndone }: { onUndone?: (restored: boolean) => void }) {
  const offer = useSyncExternalStore(subscribeUndo, currentUndo);
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {offer && !offer.failed && MESSAGES.undo.spoken(offer.message)}
      </div>
      {offer && (
        <div
          role={offer.failed ? 'alert' : undefined}
          className={cn(
            'mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl bg-secondary py-1 pr-1 pl-4 text-body',
            offer.failed && 'text-destructive',
          )}
          onFocus={() => pauseUndo(true)}
          onBlur={() => pauseUndo(false)}
        >
          <span>{offer.failed ? MESSAGES.undo.failed(offer.message) : offer.message}</span>
          <Button
            variant="ghost"
            className={cn(offer.failed && 'text-destructive')}
            onClick={() => void undo(offer.receipt).then((restored) => onUndone?.(restored))}
          >
            {offer.failed ? MESSAGES.actions.tryAgain : MESSAGES.actions.undo}
          </Button>
        </div>
      )}
    </>
  );
}
