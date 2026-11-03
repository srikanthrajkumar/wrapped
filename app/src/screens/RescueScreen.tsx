// The one screen left when the phone's database won't open (DESIGN.md "The store can't be
// opened"). It needs no database: Export writes the journal of values not saved into a file
// marked store-unreadable, and the Export icon then carries a check badge. A store that is only slow
// to open keeps the screens, with "Still opening your season…" (muted, a spinner, no alert) and
// Export at the top.

import { IconAlertCircle } from '@tabler/icons-react';
import { Component, useEffect, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useStoreHealth } from '../store/health';
import {
  dismissExportFailure,
  exportSeason,
  storeOpened,
  useExportState,
} from './components/export-file';
import { ExportIcon, SafetyRow } from './components/feedback';
import { MESSAGES } from './messages';

/** Back to the app's start, never the screen that broke, so one broken screen can't trap it. */
const restart = () => window.location.assign(import.meta.env.BASE_URL);

export function RescueScreen() {
  const { handover, failed } = useExportState();
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pr-[calc(16px+env(safe-area-inset-right))] pb-[calc(16px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]">
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
        <IconAlertCircle aria-hidden className="size-10 text-destructive" />
        <h1 className="text-center text-title font-semibold">{MESSAGES.rescue.title}</h1>
      </div>
      <div className="flex flex-col gap-2">
        {failed && (
          <SafetyRow
            label={MESSAGES.short.exportFailed}
            sentence={MESSAGES.exportFailed}
            onRetry={() => {
              dismissExportFailure();
              void exportSeason({ rescue: true });
            }}
          />
        )}
        <Button size="lg" className="w-full" onClick={restart}>
          {MESSAGES.actions.tryAgain}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          aria-label={
            !handover
              ? MESSAGES.actions.export
              : handover.storeTimedOut
                ? `${MESSAGES.actions.export}. ${MESSAGES.exportStoreSlow}`
                : `${MESSAGES.short.exported}. ${MESSAGES.exportStoreUnreadable}`
          }
          onClick={() => void exportSeason({ rescue: true })}
        >
          <ExportIcon exported={handover !== null && !handover.storeTimedOut} />
          {MESSAGES.actions.export}
        </Button>
      </div>
    </div>
  );
}

/**
 * The app, or the rescue screen when the store didn't open or the screens broke. While a slow
 * open is still pending, the screens stay, under a row offering the Export.
 */
export function StoreGate({ children }: { children: ReactNode }) {
  const health = useStoreHealth();
  useEffect(() => {
    if (health.state === 'open') storeOpened();
  }, [health.state]);
  if (health.state === 'failed') return <RescueScreen />;
  const slow = health.state === 'slow';
  return (
    // While the row shows, it takes the top safe area, and the app below adds none of its own.
    <div style={slow ? ({ '--app-top-inset': '0px' } as CSSProperties) : undefined}>
      {slow && (
        <div className="border-b border-border pt-[env(safe-area-inset-top)] pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(16px+env(safe-area-inset-left))]">
          <SafetyRow
            label={MESSAGES.short.stillOpening}
            sentence={MESSAGES.short.stillOpening}
            exportable
            waiting
          />
        </div>
      )}
      <RescueBoundary>{children}</RescueBoundary>
    </div>
  );
}

/** Whatever breaks the screens leaves the rescue screen, never a blank page. */
class RescueBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('the screens failed', error, info.componentStack);
  }

  override render() {
    return this.state.failed ? <RescueScreen /> : this.props.children;
  }
}
