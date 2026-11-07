// First launch (design D10; FR-050, FR-042, FR-049), one step per screen. Built so far: Welcome
// and "Getting ready to log offline" with real progress. Google sign-in and the two consent
// questions come between them with T081. "Ready to log offline" shows only once the service
// worker has found every first-phase file in its cache (eng review D8).

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { retryReadiness, useReadiness } from '../pwa';
import { Motif } from '../motif/Motif';
import { finishFirstLaunch } from '../store/first-launch';
import { MESSAGES } from './messages';

export function FirstLaunch() {
  const [step, setStep] = useState<'welcome' | 'ready'>('welcome');
  return (
    <>
      {/* The app's own mark, Silk, as a horizon behind every step (DESIGN.md "The motif"):
          full-bleed from the top, dissolving above the words, drifting slowly. The same across
          steps, so it never restarts. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[74dvh] overflow-hidden [mask-image:linear-gradient(black_45%,rgb(0_0_0/0.55)_72%,transparent)]"
      >
        <Motif
          seed={{ kind: 'mark' }}
          moving
          soft={0.012}
          className="size-full animate-in duration-300 fade-in motion-reduce:animate-none"
        />
      </div>
      {step === 'welcome' ? <Welcome onContinue={() => setStep('ready')} /> : <GettingReady />}
    </>
  );
}

function Screen({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col pb-4">
      {/* Under the horizon, low, near the thumb. With large text the words rise into the silk,
          so a scrim fades in behind them from 64px above, the page's colour by their first line. */}
      <div className="flex flex-1 flex-col justify-end py-8">
        <div className="relative isolate flex flex-col gap-4 before:absolute before:right-[calc(-16px-env(safe-area-inset-right))] before:left-[calc(-16px-env(safe-area-inset-left))] before:-top-16 before:bottom-0 before:-z-10 before:bg-gradient-to-b before:from-transparent before:to-background before:to-[64px] before:content-['']">
          {children}
        </div>
      </div>
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
  // No service worker here: logging works, offline doesn't, and the rasika is let in anyway.
  const unavailable = readiness.state === 'unavailable';
  const progress =
    readiness.state === 'downloading' && readiness.total > 0
      ? readiness.cached / readiness.total
      : 0;
  return (
    <Screen
      action={
        ready || unavailable ? (
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
            : unavailable
              ? MESSAGES.gettingReady.unavailable
              : stopped
                ? MESSAGES.gettingReady.stopped
                : MESSAGES.gettingReady.downloading}
        </h1>
      </div>
      {!ready && !stopped && !unavailable && (
        <div
          role="progressbar"
          aria-label={MESSAGES.gettingReady.downloading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          {/* Scaled, not resized, so the bar moves on the compositor alone. */}
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-150 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      )}
    </Screen>
  );
}
