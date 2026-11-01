// The Undo bar (design D16): directly above the screen's bottom action, never covering it, for
// 5 seconds, paused while it has focus. Screen readers hear "Item 5 deleted. Undo available."

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { MESSAGES } from '../messages';
import { currentUndo, pauseUndo, subscribeUndo, undo } from '../undo';

export function UndoBar({ onUndone }: { onUndone?: (restored: boolean) => void }) {
  const offer = useSyncExternalStore(subscribeUndo, currentUndo);
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {offer && MESSAGES.undo.spoken(offer.message)}
      </div>
      {offer && (
        <div
          className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl bg-secondary py-1 pr-1 pl-4 text-body"
          onFocus={() => pauseUndo(true)}
          onBlur={() => pauseUndo(false)}
        >
          <span>{offer.message}</span>
          <Button
            variant="ghost"
            onClick={() => void undo(offer.receipt).then((restored) => onUndone?.(restored))}
          >
            {MESSAGES.actions.undo}
          </Button>
        </div>
      )}
    </>
  );
}
