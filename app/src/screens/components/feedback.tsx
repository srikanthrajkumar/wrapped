// The screens' side of save feedback (save-feedback.ts; design D15): the highlight after a
// successful write, the persistent "Not saved on this phone" line with Try again, Export and,
// once an Export holds what Try again can't save, Clear; and, under the top bar of every
// screen, the season-wide line for failures no field shows.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';
import { saveFeedback, type Replay, type Target, type TrackOptions } from '../save-feedback';
import { dismissExportFailure, exportSeason, useExportState } from './export-file';

/** The save highlight's length (DESIGN.md "Saving"). */
const HIGHLIGHT_MS = 1200;

/** Redraw whenever any save settles. */
export function useSaveFeedback(): typeof saveFeedback {
  useSyncExternalStore(saveFeedback.subscribe, saveFeedback.getVersion);
  return saveFeedback;
}

/** Save `value` for `target` through `write`, with feedback; resolves to the write's result. */
export function saveWith<T>(
  target: Target,
  value: unknown,
  write: (replay?: Replay) => Promise<T>,
  options?: TrackOptions,
) {
  return saveFeedback.track(target, value, write, options);
}

const keyOf = (targets: Target[]) =>
  targets.map(({ table, id, field }) => `${table}/${id}/${field}`).join(' ');

/**
 * Tell save feedback that this screen shows `targets` with its own "Not saved" line, so the
 * season-wide line leaves them out while it is mounted.
 */
export function useShowsFailures(targets: Target[]): void {
  const key = keyOf(targets);
  const latest = useRef(targets);
  useLayoutEffect(() => {
    latest.current = targets;
  });
  // Before paint, so the season-wide line never flashes a failure this screen shows.
  useLayoutEffect(() => saveFeedback.showing(latest.current), [key]);
}

/**
 * Wraps a row or value: plays the surface-raised highlight once after each successful write
 * (never after a failed one), and shows the "Not saved" line beside a failed one. The highlight
 * restarts on the same element, so a field inside keeps its focus and the keyboard stays up.
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
  const surface = useRef<HTMLDivElement>(null);
  const targets = target === null ? [] : Array.isArray(target) ? target : [target];
  useShowsFailures(targets);
  const states = targets.map((t) => feedback.get(t));
  // Only a write that just succeeded highlights; coming back to a screen later replays nothing.
  const saved = states
    .filter((s) => s?.status === 'saved' && s.at > openedAt - HIGHLIGHT_MS)
    .map((s) => s!.edit);
  const failed = targets.filter((_, i) => states[i]?.status === 'failed');
  const lastSaved = saved.length > 0 ? Math.max(...saved) : 0;

  useEffect(() => {
    const element = surface.current;
    if (!element || lastSaved === 0) return;
    element.classList.remove('save-highlight');
    // Reading layout restarts the animation when the class comes back.
    void element.offsetWidth;
    element.classList.add('save-highlight');
  }, [lastSaved]);

  return (
    <div className={cn('rounded-xl', className)}>
      <div ref={surface} className="rounded-xl">
        {children}
      </div>
      {failed.length > 0 && <NotSavedLine targets={failed} />}
    </div>
  );
}

export function FailureLine({
  text,
  onRetry,
  rescue,
  onClear,
}: {
  text: string;
  onRetry?: () => void;
  /** Offer the rescue Export. */
  rescue?: boolean;
  /** Offer Clear: an Export holds what Try again can't save. */
  onClear?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-2 py-1 text-sub text-destructive"
    >
      <span className="py-2">{text}</span>
      <span className="flex flex-wrap gap-1">
        {onRetry && (
          <Button variant="ghost" className="text-sub text-destructive" onClick={onRetry}>
            {MESSAGES.actions.tryAgain}
          </Button>
        )}
        {rescue && (
          <Button
            variant="ghost"
            className="text-sub text-destructive"
            onClick={() => void exportSeason({ rescue: true })}
          >
            {MESSAGES.actions.export}
          </Button>
        )}
        {onClear && (
          <Button variant="ghost" className="text-sub text-destructive" onClick={onClear}>
            {MESSAGES.actions.clear}
          </Button>
        )}
      </span>
    </div>
  );
}

/** A line's actions for `targets`: Try again for what can be replayed, Clear once exported. */
function lineActions(targets: Target[], retry?: () => void) {
  const retryable = targets.filter((t) => saveFeedback.canRetry(t));
  const clearable = targets.filter((t) => saveFeedback.canClear(t));
  return {
    onRetry:
      retryable.length === 0 ? undefined : (retry ?? (() => void saveFeedback.retryAll(retryable))),
    onClear: clearable.length === 0 ? undefined : () => saveFeedback.clear(clearable),
  };
}

/**
 * "Not saved on this phone." in destructive, with Try again, Export and Clear, until a retry
 * works. `onRetry` replaces the replayed write where the screen must also act on success (a
 * sheet that closes, a name that is picked).
 */
export function NotSavedLine({ targets, onRetry }: { targets: Target[]; onRetry?: () => void }) {
  useShowsFailures(targets);
  useSaveFeedback();
  return <FailureLine text={MESSAGES.saveFailed} rescue {...lineActions(targets, onRetry)} />;
}

/**
 * Under the top bar of every screen: "2 changes not saved on this phone." for failures no field
 * on the screen shows (a new Concert, Start logging, an added Artist, a move, a first pick backed
 * out of, values from before a relaunch); "The Export couldn't be made on this phone." when an
 * Export failed outright; and, after a rescue Export from a store that couldn't be read, the line
 * saying it holds only the changes not saved.
 */
export function SeasonFeedback() {
  const feedback = useSaveFeedback();
  const exported = useExportState();
  const unshown = feedback.unshown();
  if (unshown.length === 0 && !exported.failed && !exported.storeUnreadable) return null;
  return (
    <div className="border-b border-border">
      {unshown.length > 0 && (
        <FailureLine
          text={MESSAGES.notSavedCount(unshown.length)}
          rescue
          {...lineActions(unshown)}
        />
      )}
      <ExportLines />
    </div>
  );
}

/** The Export's own lines: its outright failure, with Try again, and the store-unreadable note. */
export function ExportLines() {
  const { failed, storeUnreadable } = useExportState();
  return (
    <>
      {failed && (
        <FailureLine
          text={MESSAGES.exportFailed}
          onRetry={() => {
            dismissExportFailure();
            void exportSeason(failed);
          }}
        />
      )}
      {storeUnreadable && <FailureLine text={MESSAGES.exportStoreUnreadable} />}
    </>
  );
}
