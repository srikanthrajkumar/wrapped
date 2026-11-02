// The screens' side of save feedback (save-feedback.ts; design D15): the highlight after a
// successful write, and the icon-led safety rows (decided 2026-11-02): an alert mark, a short
// label ("Not saved", "Not moved", "Not changed", "Export failed") and icon buttons for Try
// again, Export, Clear and Dismiss, whose accessible names carry the full sentence. Under the top
// bar of every screen, the season-wide row lists the failures no field shows.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  IconAlertCircle,
  IconCircleCheckFilled,
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dayText, timeText } from '../format';
import { MESSAGES } from '../messages';
import { saveFeedback, type Target, type WriteKind } from '../save-feedback';
import { dismissExportFailure, exportSeason, useExportState } from './export-file';
import { SheetFrame } from './sheet-frame';

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
  write: () => Promise<T>,
  options?: { kind?: WriteKind },
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

const ICON_BUTTON = 'size-12 text-destructive';

/**
 * One safety row: the alert mark and a short label, with the full sentence for screen readers,
 * and icon buttons named by what they do and the sentence they act on. A `waiting` row (the store
 * still opening) is no failure: a muted spinner and muted text, announced politely.
 */
export function SafetyRow({
  label,
  sentence,
  onRetry,
  exportable,
  clearable,
  onDismiss,
  waiting,
  className,
}: {
  label: string;
  sentence: string;
  onRetry?: () => void;
  /** Offer the rescue Export. */
  exportable?: boolean;
  /** Targets Clear may remove once the rasika confirms the Export is saved. */
  clearable?: Target[];
  onDismiss?: () => void;
  waiting?: boolean;
  className?: string;
}) {
  return (
    <div
      role={waiting ? 'status' : 'alert'}
      className={cn(
        'flex flex-wrap items-center gap-x-1 text-sub',
        waiting ? 'text-muted-foreground' : 'text-destructive',
        className,
      )}
    >
      {waiting ? (
        <IconLoader2
          aria-hidden
          className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <IconAlertCircle aria-hidden className="size-5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 py-3 break-words">
        <span aria-hidden>{label}</span>
        <span className="sr-only">{sentence}</span>
      </span>
      <span className="flex">
        {onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className={ICON_BUTTON}
            aria-label={`${MESSAGES.actions.tryAgain}. ${sentence}`}
            onClick={onRetry}
          >
            <IconRefresh aria-hidden />
          </Button>
        )}
        {exportable && <ExportButton sentence={sentence} muted={waiting} />}
        {clearable && clearable.length > 0 && <ClearButton targets={clearable} />}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className={ICON_BUTTON}
            aria-label={`${MESSAGES.actions.dismiss}. ${sentence}`}
            onClick={onDismiss}
          >
            <IconX aria-hidden />
          </Button>
        )}
      </span>
    </div>
  );
}

/**
 * The Export icon: always the download arrow, since tapping exports again; once a file has been
 * handed over, a small check badge sits on it (decided 2026-11-02). The badge is no button.
 */
export function ExportIcon({ exported }: { exported: boolean }) {
  return (
    <span className="relative inline-flex">
      <IconDownload aria-hidden className="size-6" />
      {exported && (
        <IconCircleCheckFilled
          aria-hidden
          className="absolute -right-1.5 -bottom-1 size-3.5 rounded-full bg-background"
        />
      )}
    </span>
  );
}

/** The rescue Export, with the check badge once a file has been handed over. */
function ExportButton({ sentence, muted }: { sentence: string; muted?: boolean }) {
  const { handover } = useExportState();
  const name = handover
    ? `${MESSAGES.short.exported}. ${handover.storeUnreadable ? MESSAGES.exportStoreUnreadable : sentence}`
    : `${MESSAGES.actions.export}. ${sentence}`;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={muted ? 'size-12 text-muted-foreground' : ICON_BUTTON}
      aria-label={name}
      onClick={() => void exportSeason({ rescue: true })}
    >
      <ExportIcon exported={handover !== null} />
    </Button>
  );
}

/**
 * Clear, shown once an Export has been handed over that holds values Try again can't save. It
 * asks first: a download may not have been kept, so only the rasika can say the file is saved.
 */
function ClearButton({ targets }: { targets: Target[] }) {
  const { handover } = useExportState();
  const [asking, setAsking] = useState(false);
  const saved = handover?.entries ?? [];
  const clearable = targets.filter((target) => saveFeedback.canClear(target, saved));
  if (clearable.length === 0) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={ICON_BUTTON}
        aria-label={`${MESSAGES.actions.clear}. ${MESSAGES.clearConfirm.detail(clearable.length)}`}
        onClick={() => setAsking(true)}
      >
        <IconTrash aria-hidden />
      </Button>
      <SheetFrame
        open={asking}
        onOpenChange={setAsking}
        title={MESSAGES.clearConfirm.question}
        description={MESSAGES.clearConfirm.detail(clearable.length)}
      >
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            variant="destructive"
            onClick={() => {
              setAsking(false);
              saveFeedback.clearSaved(saved);
            }}
          >
            {MESSAGES.clearConfirm.yes}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setAsking(false)}>
            {MESSAGES.clearConfirm.no}
          </Button>
        </div>
      </SheetFrame>
    </>
  );
}

/** The short label and sentence for a failed write of `kind`. */
function wordsFor(kind: WriteKind | undefined) {
  if (kind === 'move') return { label: MESSAGES.short.notMoved, sentence: MESSAGES.moveFailed };
  if (kind === 'repick') {
    return { label: MESSAGES.short.notChanged, sentence: MESSAGES.repickFailed };
  }
  return { label: MESSAGES.short.notSaved, sentence: MESSAGES.saveFailed };
}

/**
 * The row beside a failed field: "Not saved" with Try again, Export and (after an Export) Clear;
 * "Not moved" with Dismiss; "Not changed" with Export and Dismiss. A move or repick is never
 * retried: the rasika does it again (docs/adr/0007). `onRetry` replaces the retried write where
 * the screen must also act on success (a sheet that closes, a name that is picked).
 */
export function NotSavedLine({ targets, onRetry }: { targets: Target[]; onRetry?: () => void }) {
  useShowsFailures(targets);
  const feedback = useSaveFeedback();
  const failed = targets.filter((target) => feedback.get(target)?.status === 'failed');
  if (failed.length === 0) return null;
  const kind = feedback.kindOf(failed[0]!);
  const { label, sentence } = wordsFor(kind);
  const retryable = failed.filter((target) => feedback.canRetry(target));
  const dismissable = kind === 'move' || kind === 'repick';
  return (
    <SafetyRow
      label={label}
      sentence={sentence}
      onRetry={
        retryable.length === 0 ? undefined : (onRetry ?? (() => void feedback.retryAll(retryable)))
      }
      exportable={kind !== 'move'}
      clearable={failed}
      onDismiss={
        dismissable ? () => failed.forEach((target) => feedback.dismiss(target)) : undefined
      }
    />
  );
}

/** What a failed new record was, for the season-wide row: "Concert, Mon 2 Nov, 9:17 am". */
function describe(target: Target, value: unknown): string | null {
  if (target.field !== '*') return null;
  if (target.table === 'events') {
    const { date, startTime } = (value ?? {}) as { date?: string; startTime?: string | null };
    return [MESSAGES.short.concert, date && dayText(date), startTime && timeText(startTime)]
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'string') return value;
  const named = value as { name?: string; label?: string } | null;
  return named?.name ?? named?.label ?? null;
}

/**
 * Under the top bar of every screen: the failures no field on the screen shows (a new record, a
 * move, a value from before a relaunch), as "Not saved · Concert, Mon 2 Nov, 9:17 am" for one
 * or "3 not saved" for several; and "Export failed" when an Export couldn't be made at all.
 */
export function SeasonFeedback() {
  const feedback = useSaveFeedback();
  const { failed: exportFailed } = useExportState();
  const unshown = feedback.unshown();
  if (unshown.length === 0 && !exportFailed) return null;
  const only = unshown.length === 1 ? unshown[0]! : null;
  const kind = only ? feedback.kindOf(only) : undefined;
  const words = wordsFor(kind);
  const what = only ? describe(only, feedback.get(only)?.value) : null;
  const retryable = unshown.filter((target) => feedback.canRetry(target));
  return (
    <div className="border-b border-border">
      {unshown.length > 0 && (
        <SafetyRow
          label={
            only
              ? what
                ? `${words.label} · ${what}`
                : words.label
              : MESSAGES.short.count(unshown.length)
          }
          sentence={
            only
              ? [what, words.sentence].filter(Boolean).join(': ')
              : MESSAGES.notSavedCount(unshown.length)
          }
          onRetry={retryable.length > 0 ? () => void feedback.retryAll(retryable) : undefined}
          exportable
          clearable={unshown}
          onDismiss={
            kind === 'move' || kind === 'repick' ? () => feedback.dismiss(only!) : undefined
          }
        />
      )}
      {exportFailed && (
        <SafetyRow
          label={MESSAGES.short.exportFailed}
          sentence={MESSAGES.exportFailed}
          onRetry={() => {
            dismissExportFailure();
            void exportSeason(exportFailed);
          }}
        />
      )}
    </div>
  );
}
