// The screens' side of save feedback (save-feedback.ts; design D15): the highlight after a
// successful write, the persistent "Not saved on this phone" line with Try again and Export,
// and, at the top of every screen, the season-wide line for failures no field shows.

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
import { saveFeedback, type Target } from '../save-feedback';
import { dismissExportFailure, exportSeason, useExportFailure } from './export-file';

/** The save highlight's length (DESIGN.md "Saving"). */
const HIGHLIGHT_MS = 1200;

/** Redraw whenever any save settles. */
export function useSaveFeedback(): typeof saveFeedback {
  useSyncExternalStore(saveFeedback.subscribe, saveFeedback.getVersion);
  return saveFeedback;
}

/** Save `value` for `target` through `write`, with feedback; resolves to the write's result. */
export function saveWith<T>(target: Target, value: unknown, write: () => Promise<T>) {
  return saveFeedback.track(target, value, write);
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

function FailureLine({
  text,
  onRetry,
  rescue,
}: {
  text: string;
  onRetry?: () => void;
  /** Offer the rescue Export. */
  rescue?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-2 py-1 text-sub text-destructive"
    >
      <span className="py-2">{text}</span>
      <span className="flex gap-1">
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
      </span>
    </div>
  );
}

/** "Not saved on this phone." in destructive, with Try again and Export, until a retry works. */
export function NotSavedLine({ targets }: { targets: Target[] }) {
  useShowsFailures(targets);
  const retryable = targets.filter((t) => saveFeedback.canRetry(t));
  return (
    <FailureLine
      text={MESSAGES.saveFailed}
      rescue
      onRetry={retryable.length > 0 ? () => void saveFeedback.retryAll(retryable) : undefined}
    />
  );
}

/**
 * The top of every screen: "2 changes not saved on this phone." for failures no field on the
 * screen shows (a new Concert, Start logging, an added Artist, a move, a first pick backed out
 * of, values from before a relaunch), and "The Export couldn't be made on this phone." when an
 * Export failed outright.
 */
export function SeasonFeedback() {
  const feedback = useSaveFeedback();
  const exportFailure = useExportFailure();
  const unshown = feedback.unshown();
  const retryable = unshown.filter((t) => feedback.canRetry(t));
  if (unshown.length === 0 && !exportFailure) return null;
  return (
    <div className="border-b border-border">
      {unshown.length > 0 && (
        <FailureLine
          text={MESSAGES.notSavedCount(unshown.length)}
          rescue
          onRetry={retryable.length > 0 ? () => void feedback.retryAll(retryable) : undefined}
        />
      )}
      {exportFailure && (
        <FailureLine
          text={MESSAGES.exportFailed}
          onRetry={() => {
            dismissExportFailure();
            void exportSeason(exportFailure);
          }}
        />
      )}
    </div>
  );
}
