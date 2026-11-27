// The sync prompts on every screen (T081, T083; DESIGN.md Messages, "Any screen"): one thin strip
// in the shell's bottom stack, above the install strip, shown only while sync waits for the
// rasika. It never covers or blocks a screen: logging carries on under every one of them
// (constitution I, FR-018).
//
// - The session ended (a 401, or a refresh the server refused): "Sign in again…", with Sign in.
// - Another phone is the writer (a 409, FR-022): "Your season is now being logged on another
//   phone…", with Details, which opens Export and "Make this the writing device again". That
//   claims this phone and pushes the queued changes; one based on an older version than the
//   server's comes back as a conflict, never overwriting the other phone's (eng review D6, D11).
// - The app is below the server's minimum (a 426, eng review D14): "Update the app…".
// The outbox and the season stay on the phone through all of them.

import { useState } from 'react';
import { buildAuthConfig } from '../../store/auth-config';
import {
  beginSignIn,
  clearSignInFailure,
  failSignIn,
  signInWithCredential,
  usesGoogleButton,
  useSignInState,
  type SignInFailure,
} from '../../store/sign-in-flow';
import { MESSAGES } from '../messages';
import { useSyncStatus, writeHere } from '../sync-status';
import { exportSeason } from './export-file';
import { GoogleButton } from './GoogleButton';

const HAS_SERVER = buildAuthConfig() !== null;
/** Google's own button where the build has Google's client id (ADR 0001); the app's otherwise. */
const GOOGLE_CLIENT_ID = usesGoogleButton() ? buildAuthConfig()!.googleClientId! : null;

const STRIP =
  'flex flex-col gap-1 bg-background py-2 text-sub hairline-t pr-[calc(24px+env(safe-area-inset-right))] pl-[calc(24px+env(safe-area-inset-left))]';
/** A text button, 44px tall, as the install strip's. */
const ACTION = '-mx-2 flex min-h-11 items-center rounded-xl px-2 font-semibold text-foreground';

const FAILURE_TEXT: Record<SignInFailure, string> = {
  cancelled: MESSAGES.signIn.cancelled,
  noSignal: MESSAGES.signIn.noSignal,
  googleError: MESSAGES.signIn.googleError,
  otherAccount: MESSAGES.account.otherAccount,
  consentWaiting: MESSAGES.account.consentWaiting,
};

export function SyncPrompt() {
  const status = useSyncStatus();
  const signIn = useSignInState();
  const [details, setDetails] = useState(false);
  // Each failure draws Google's button again, with a fresh nonce for the next credential.
  const attempt = signIn.state === 'failed' ? (signIn.attempt ?? 0) : 0;
  if (!HAS_SERVER || status.state !== 'stopped') return null;
  const { failure } = status;

  if (failure.kind === 'signed_out' || failure.kind === 'other_account') {
    // "No signal" from an earlier try is stale once the phone is online again.
    const failed =
      signIn.state === 'failed' &&
      !(signIn.failure === 'noSignal' && globalThis.navigator?.onLine !== false)
        ? signIn.failure
        : null;
    return (
      <div
        data-sync-prompt
        className={`${STRIP} min-h-11 flex-row flex-wrap items-center justify-between gap-x-2`}
      >
        <span role={failed ? 'alert' : 'status'} className="py-1 text-muted-foreground">
          {failed ? FAILURE_TEXT[failed] : MESSAGES.sessionEnded}
        </span>
        {GOOGLE_CLIENT_ID !== null && failed !== 'noSignal' ? (
          <GoogleButton
            clientId={GOOGLE_CLIENT_ID}
            text="signin"
            size="medium"
            attempt={attempt}
            onCredential={(credential, nonce) => void signInWithCredential(credential, nonce)}
            onError={failSignIn}
          />
        ) : (
          <button
            type="button"
            className={ACTION}
            aria-busy={signIn.state === 'working' || undefined}
            disabled={signIn.state === 'working'}
            onClick={GOOGLE_CLIENT_ID !== null ? clearSignInFailure : () => void beginSignIn()}
          >
            {failed ? MESSAGES.actions.tryAgain : MESSAGES.actions.signIn}
          </button>
        )}
      </div>
    );
  }

  if (failure.kind === 'not_writer') {
    return (
      <div data-sync-prompt className={STRIP}>
        <div className="flex min-h-9 items-center justify-between gap-x-2">
          <span role="status" className="py-1 text-muted-foreground">
            {MESSAGES.anotherPhone}
          </span>
          {!details && (
            <button
              type="button"
              className={ACTION}
              aria-expanded={false}
              onClick={() => setDetails(true)}
            >
              {MESSAGES.actions.details}
            </button>
          )}
        </div>
        {details && (
          <div className="flex flex-wrap gap-x-4">
            <button type="button" className={ACTION} onClick={() => void exportSeason()}>
              {MESSAGES.actions.export}
            </button>
            <button type="button" className={ACTION} onClick={() => void writeHere()}>
              {MESSAGES.account.writeHere}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (failure.kind === 'update_required') {
    return (
      <div data-sync-prompt className={`${STRIP} min-h-9 justify-center`}>
        <span role="status" className="text-muted-foreground">
          {MESSAGES.account.updateRequired}
        </span>
      </div>
    );
  }
  return null;
}
