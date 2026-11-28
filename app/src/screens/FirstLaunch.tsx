// First launch (design D10; FR-050, FR-042, FR-049), one step per screen: Welcome → Google
// sign-in → Consent 1 → Consent 2 → "Getting ready to log offline" with real progress (DESIGN.md,
// "First launch"). Which step shows is read from the store: who signed in, and the answers
// given, so a step survives the trip to Google's sign-in and back, and a relaunch. "Ready to log
// offline" shows only once the service worker has found every first-phase file in its cache
// (eng review D8) and the restore a sign-in started has finished or had its 10 seconds (T079).
//
// A build with no server (tests, CI, the phone-only fallback) skips sign-in and consent:
// Welcome leads straight to the download, and the outbox waits for a server (T081). An emptied
// phone with no signal can start logging from the sign-in step's failure (FR-018); the consent
// steps then follow its sign-in, whenever that is (useConsentOwed).

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { retryReadiness, useReadiness } from '../pwa';
import { Motif } from '../motif/Motif';
import { answerConsent, CONSENT_KEY, type Consent, type ConsentName } from '../store/account';
import { IDENTITY_KEY, type Identity } from '../store/auth';
import { buildAuthConfig } from '../store/auth-config';
import { finishFirstLaunch } from '../store/first-launch';
import { useMeta } from '../store/queries';
import { GoogleButton } from './components/GoogleButton';
import { Kolam } from './components/Kolam';
import {
  beginSignIn,
  clearSignInFailure,
  failSignIn,
  signInWithCredential,
  usesGoogleButton,
  useSignInState,
  waitForRestore,
  type SignInFailure,
} from '../store/sign-in-flow';
import { MESSAGES } from './messages';
import { PRIVACY_POLICY_PATH } from '../privacy/path';

/** Fixed for the build: whether there is a server to sign in to. */
const HAS_SERVER = buildAuthConfig() !== null;

/**
 * True when a rasika signed in after first launch (an emptied phone that logged offline first)
 * and hasn't answered both questions yet: the shell then shows the consent steps (FR-050).
 * False while the store is read, so logging is never held up waiting for the answer.
 */
export function useConsentOwed(): boolean {
  const identity = useMeta<Identity>(IDENTITY_KEY);
  const consent = useMeta<Consent>(CONSENT_KEY);
  if (!HAS_SERVER || !identity || consent === undefined) return false;
  return (consent?.shareAdditions ?? null) === null || (consent?.seasonReports ?? null) === null;
}

type Step = 'welcome' | 'consent1' | 'consent2' | 'ready';

export function FirstLaunch() {
  // Without a server, Welcome's button leads on by itself, as it did before sign-in existed.
  const [welcomed, setWelcomed] = useState(false);
  const identity = useMeta<Identity>(IDENTITY_KEY);
  const consent = useMeta<Consent>(CONSENT_KEY);
  // Nothing until the store has answered, so a returning step never flashes Welcome first.
  if (HAS_SERVER && (identity === undefined || consent === undefined)) return null;
  const step: Step = !HAS_SERVER
    ? welcomed
      ? 'ready'
      : 'welcome'
    : !identity
      ? 'welcome'
      : (consent?.shareAdditions ?? null) === null
        ? 'consent1'
        : (consent?.seasonReports ?? null) === null
          ? 'consent2'
          : 'ready';
  return (
    <>
      {/* The app's own mark, Silk, in a window at the top of every step (DESIGN.md "The
          motif"): 8px in from the screen's sides and top, 56% of its height, with 28px corners,
          drifting slowly. The same across steps, so it never restarts. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-column top-0 px-2 pt-[calc(8px+env(safe-area-inset-top))]"
      >
        <div className="h-[calc(var(--app-height)*0.56)] overflow-hidden rounded-[28px]">
          <Motif
            seed={{ kind: 'mark' }}
            moving
            soft={0.012}
            className="size-full animate-in duration-300 fade-in motion-reduce:animate-none"
          />
        </div>
      </div>
      {step === 'welcome' ? (
        <Welcome onContinue={HAS_SERVER ? () => void beginSignIn() : () => setWelcomed(true)} />
      ) : step === 'consent1' ? (
        <ConsentStep key="shareAdditions" name="shareAdditions" words={MESSAGES.consent1} />
      ) : step === 'consent2' ? (
        <ConsentStep key="seasonReports" name="seasonReports" words={MESSAGES.consent2} />
      ) : (
        <GettingReady />
      )}
    </>
  );
}

function Screen({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(var(--app-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col pb-4">
      {/* Under the window, low, near the thumb. With large text the words rise into the silk,
          so a scrim rises behind them from 192px above, the page's colour by their first line. */}
      <div className="flex flex-1 flex-col justify-end py-8">
        <div className="relative isolate flex flex-col gap-4 before:absolute before:right-[calc(-24px-env(safe-area-inset-right))] before:left-[calc(-24px-env(safe-area-inset-left))] before:-top-48 before:bottom-0 before:-z-10 before:scrim-rise before:content-['']">
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

const FAILURE_TEXT: Record<SignInFailure, string> = {
  cancelled: MESSAGES.signIn.cancelled,
  noSignal: MESSAGES.signIn.noSignal,
  googleError: MESSAGES.signIn.googleError,
  otherAccount: MESSAGES.account.otherAccount,
  consentWaiting: MESSAGES.account.consentWaiting,
};

/** Fixed for the build: sign-in by Google's own button (production) or the app's (tests). */
const GOOGLE_CLIENT_ID = usesGoogleButton() ? buildAuthConfig()!.googleClientId! : null;

function Welcome({ onContinue }: { onContinue(): void }) {
  const signIn = useSignInState();
  const readiness = useReadiness();
  const failure = signIn.state === 'failed' ? signIn.failure : null;
  const working = signIn.state === 'working';
  // Each failure draws Google's button again, with a fresh nonce for the next credential.
  const attempt = signIn.state === 'failed' ? (signIn.attempt ?? 0) : 0;
  // An emptied phone with no signal still logs (FR-018, FR-050): once the app itself is stored
  // for offline, "Start" opens logging, and sign-in is asked for again when signal returns.
  const logOffline = failure === 'noSignal' && readiness.state === 'ready';
  // Google's button needs Google's script; with no signal, "Try again" loads it again.
  const googleButton = GOOGLE_CLIENT_ID !== null && failure !== 'noSignal';
  return (
    <div className="relative flex min-h-[calc(var(--app-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col pb-4">
      {/* Down to the window's foot, where the kolam sits across its edge on a disc of the
          page's colour (the Maintainer's pick, 2026-11-28). */}
      <div className="h-[calc(var(--app-height)*0.56+8px-44px)] shrink-0" />
      <div className="mx-auto grid size-22 shrink-0 place-items-center rounded-full bg-background">
        <Kolam className="size-16" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-6 text-center">
        <h1 className="text-display font-bold">{MESSAGES.welcome.title}</h1>
        {/* A failure is one line on the step it happened, in the sentence's place (DESIGN.md,
            "First launch"). */}
        {failure ? (
          <p role="alert">{FAILURE_TEXT[failure]}</p>
        ) : (
          <p className="text-muted-foreground">{MESSAGES.welcome.sentence}</p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {googleButton ? (
          // Google's white button in both themes, the width of a fill (DESIGN.md, "First
          // launch"): on the dark page its own dark one barely showed.
          <div
            aria-busy={working || undefined}
            className={cn('fill-edge', working && 'opacity-50')}
          >
            <GoogleButton
              clientId={GOOGLE_CLIENT_ID}
              text="continue_with"
              look="outline"
              attempt={attempt}
              onCredential={(credential, nonce) => void signInWithCredential(credential, nonce)}
              onError={failSignIn}
            />
          </div>
        ) : (
          <Button
            size="lg"
            className="fill-edge w-[calc(100%+32px)]"
            aria-busy={working || undefined}
            disabled={working}
            onClick={GOOGLE_CLIENT_ID !== null ? clearSignInFailure : onContinue}
          >
            {failure ? MESSAGES.actions.tryAgain : MESSAGES.welcome.action}
          </Button>
        )}
        {logOffline && (
          <Button
            size="lg"
            variant="secondary"
            className="fill-edge w-[calc(100%+32px)]"
            onClick={() => void finishFirstLaunch()}
          >
            {MESSAGES.actions.start}
          </Button>
        )}
        {/* What signing in is for, under the button; not where Start lets an emptied phone
            log without it. */}
        {HAS_SERVER && !logOffline && (
          <p className="text-center text-caption text-muted-foreground">
            {MESSAGES.welcome.reassure}
          </p>
        )}
        {/* The public privacy policy, quiet but always there (Google's brand verification). A
            new tab, so first launch stays where it was; in the installed app, the browser's
            sheet over it. */}
        <a
          href={PRIVACY_POLICY_PATH}
          target="_blank"
          rel="noopener"
          className="mx-auto px-2 py-1 text-center text-caption text-muted-foreground underline underline-offset-3"
        >
          {MESSAGES.welcome.privacy}
        </a>
      </div>
    </div>
  );
}

/**
 * One consent question with its reason, and two equal buttons with nothing pre-selected (FR-042,
 * FR-049). An answer is kept on the phone at once and sent with the next sync, so it never waits
 * on signal; the next step follows from the store.
 */
function ConsentStep({
  name,
  words,
}: {
  name: ConsentName;
  words: { question: string; reason: string };
}) {
  const answer = (value: boolean) => void answerConsent(name, value).catch(() => undefined);
  return (
    <Screen
      action={
        <div className="flex gap-3">
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => answer(true)}>
            {MESSAGES.actions.yes}
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => answer(false)}>
            {MESSAGES.actions.no}
          </Button>
        </div>
      }
    >
      <h1 className="text-heading font-bold">{words.question}</h1>
      <p className="text-muted-foreground">{words.reason}</p>
    </Screen>
  );
}

/** Whether the restore a sign-in started has finished, or had its 10 seconds (T079). */
function useRestoreWaited(): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    let current = true;
    void waitForRestore().then(() => {
      if (current) setWaited(true);
    });
    return () => {
      current = false;
    };
  }, []);
  return waited;
}

function GettingReady() {
  const readiness = useReadiness();
  const restored = useRestoreWaited();
  const ready = readiness.state === 'ready' && restored;
  const stopped = readiness.state === 'stopped';
  // No service worker here: logging works, offline doesn't, and the rasika is let in anyway.
  const unavailable = readiness.state === 'unavailable' && restored;
  // The files stored and the restore still landing: the bar stays full until it has.
  const progress =
    readiness.state === 'ready' || readiness.state === 'unavailable'
      ? 1
      : readiness.state === 'downloading' && readiness.total > 0
        ? readiness.cached / readiness.total
        : 0;
  return (
    <Screen
      action={
        ready || unavailable ? (
          <Button
            size="lg"
            className="fill-edge w-[calc(100%+32px)]"
            onClick={() => void finishFirstLaunch()}
          >
            {MESSAGES.actions.start}
          </Button>
        ) : stopped ? (
          <Button size="lg" className="fill-edge w-[calc(100%+32px)]" onClick={retryReadiness}>
            {MESSAGES.actions.tryAgain}
          </Button>
        ) : null
      }
    >
      <div role="status" className="flex flex-col gap-4">
        <h1 className="text-heading font-bold">
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
