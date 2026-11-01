// The screens' side of save feedback (save-feedback.ts; design D15): the highlight after a
// successful write, and the persistent "Not saved on this phone" line with Try again and Export.

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';
import { saveFeedback, type FieldFeedback, type Target } from '../save-feedback';
import { exportSeason } from './export-file';

/** The save highlight's length (DESIGN.md "Saving"). */
const HIGHLIGHT_MS = 1200;

/** Redraw whenever any save settles. */
export function useSaveFeedback(): typeof saveFeedback {
  useSyncExternalStore(saveFeedback.subscribe, saveFeedback.getVersion);
  return saveFeedback;
}

export function useFieldFeedback(target: Target | null): FieldFeedback | undefined {
  const feedback = useSaveFeedback();
  return target ? feedback.get(target) : undefined;
}

/** Save `value` for `target` through `write`, with feedback; resolves to the write's result. */
export function saveWith<T>(target: Target, value: unknown, write: () => Promise<T>) {
  return saveFeedback.track(target, value, write);
}

/**
 * Wraps a row or value: plays the surface-raised highlight once after each successful write
 * (never after a failed one), and shows the "Not saved" line beside a failed one.
 */
export function Saved({
  target,
  children,
  className,
}: {
  target: Target | Target[] | null;
  children: ReactNode;
  className?: string;
}) {
  const feedback = useSaveFeedback();
  const [openedAt] = useState(() => Date.now());
  const targets = target === null ? [] : Array.isArray(target) ? target : [target];
  const states = targets.map((t) => feedback.get(t));
  // Only a write that just succeeded highlights; coming back to a screen later replays nothing.
  const saved = states
    .filter((s) => s?.status === 'saved' && s.at > openedAt - HIGHLIGHT_MS)
    .map((s) => s!.edit);
  const failed = targets.filter((_, i) => states[i]?.status === 'failed');
  const lastSaved = saved.length > 0 ? Math.max(...saved) : 0;
  return (
    <div className={cn('rounded-xl', className)}>
      <div key={lastSaved} className={cn('rounded-xl', lastSaved > 0 && 'save-highlight')}>
        {children}
      </div>
      {failed.length > 0 && <NotSavedLine targets={failed} />}
    </div>
  );
}

/** "Not saved on this phone." in destructive, with Try again and Export, until a retry works. */
export function NotSavedLine({ targets }: { targets: Target[] }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-2 py-1 text-sub text-destructive"
    >
      <span className="py-2">{MESSAGES.saveFailed}</span>
      <span className="flex gap-1">
        <Button
          variant="ghost"
          className="text-sub text-destructive"
          onClick={() => void Promise.all(targets.map((t) => saveFeedback.retry(t)))}
        >
          {MESSAGES.actions.tryAgain}
        </Button>
        <Button
          variant="ghost"
          className="text-sub text-destructive"
          onClick={() => void exportSeason({ rescue: true })}
        >
          {MESSAGES.actions.export}
        </Button>
      </span>
    </div>
  );
}
