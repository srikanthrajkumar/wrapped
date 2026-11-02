// The one screen left when the phone's database won't open (second review of PR #5, A3;
// DESIGN.md "The store can't be opened"). It needs no database: Export writes the values not
// saved, from save feedback and their localStorage copies, into a file marked store-unreadable.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useStoreFailure } from '../store/health';
import { exportSeason } from './components/export-file';
import { ExportLines } from './components/feedback';
import { MESSAGES } from './messages';

export function RescueScreen() {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pr-[calc(16px+env(safe-area-inset-right))] pb-[calc(16px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]">
      <div role="alert" className="flex flex-1 flex-col justify-center gap-4 py-8">
        <h1 className="text-title font-semibold">{MESSAGES.rescue.title}</h1>
        <p>{MESSAGES.rescue.sentence}</p>
        <ExportLines />
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" onClick={() => window.location.reload()}>
          {MESSAGES.actions.tryAgain}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => void exportSeason({ rescue: true })}
        >
          {MESSAGES.actions.export}
        </Button>
      </div>
    </div>
  );
}

/** The app, or the rescue screen when the store didn't open or the screens broke. */
export function StoreGate({ children }: { children: ReactNode }) {
  const failure = useStoreFailure();
  return failure ? <RescueScreen /> : <RescueBoundary>{children}</RescueBoundary>;
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
