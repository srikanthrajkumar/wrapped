// First launch (design D10; FR-050, FR-042, FR-049), one step per screen. Built so far: Welcome
// and "Getting ready to log offline" with real progress. Google sign-in and the two consent
// questions come between them with T081. "Ready to log offline" shows only once the service
// worker has found every first-phase file in its cache (eng review D8).

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { retryReadiness, useReadiness } from '../pwa';
import { finishFirstLaunch } from '../store/first-launch';
import { MESSAGES } from './messages';

export function FirstLaunch() {
  const [step, setStep] = useState<'welcome' | 'ready'>('welcome');
  return step === 'welcome' ? <Welcome onContinue={() => setStep('ready')} /> : <GettingReady />;
}

function Screen({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col pb-4">
      <div className="flex flex-1 flex-col justify-center gap-4 py-8">{children}</div>
      {action}
    </div>
  );
}

function Welcome({ onContinue }: { onContinue(): void }) {
  return (
    <Screen
      action={
        // Sign-in arrives with T081; until then this step leads straight to the download.
        <Button size="lg" className="w-full" onClick={onContinue}>
          {MESSAGES.welcome.action}
        </Button>
      }
    >
      <h1 className="text-display font-bold">{MESSAGES.welcome.title}</h1>
      <p>{MESSAGES.welcome.sentence}</p>
    </Screen>
  );
}

function GettingReady() {
  const readiness = useReadiness();
  const ready = readiness.state === 'ready';
  const stopped = readiness.state === 'stopped';
  const progress =
    readiness.state === 'downloading' && readiness.total > 0
      ? readiness.cached / readiness.total
      : 0;
  return (
    <Screen
      action={
        ready ? (
          <Button size="lg" className="w-full" onClick={() => void finishFirstLaunch()}>
            {MESSAGES.actions.start}
          </Button>
        ) : stopped ? (
          <Button size="lg" className="w-full" onClick={retryReadiness}>
            {MESSAGES.actions.tryAgain}
          </Button>
        ) : null
      }
    >
      <div role="status" className="flex flex-col gap-4">
        <h1 className="text-title font-semibold">
          {ready
            ? MESSAGES.gettingReady.done
            : stopped
              ? MESSAGES.gettingReady.stopped
              : MESSAGES.gettingReady.downloading}
        </h1>
      </div>
      {!ready && !stopped && (
        <div
          role="progressbar"
          aria-label={MESSAGES.gettingReady.downloading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </Screen>
  );
}
