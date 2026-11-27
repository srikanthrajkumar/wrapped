// Google's own sign-in button (Google Identity Services; ADR 0001, decided 2026-11-24). Google's
// sign-in then names only this app and its address, never Supabase's: the credential it gives is
// exchanged for a session in the background (`signInWithIdToken`, proven on the iPhone by T010).
//
// Google's script is loaded only while a sign-in is on screen, never on the logging path, and
// is not precached: sign-in needs signal anyway. The screen waits at most 8 s for it. Each drawing of the button gets a fresh nonce:
// Google is given its SHA-256, Supabase the nonce itself (store/auth.ts, googleNonce).

import { useEffect, useEffectEvent, useRef } from 'react';
import { googleNonce } from '../../store/auth';
import { useTheme } from '../../theme';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleId {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback(response: { credential: string }): void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline' | 'filled_black';
      size: 'large' | 'medium';
      text: 'continue_with' | 'signin';
      shape: 'pill';
      width?: number;
      logo_alignment?: 'center' | 'left';
    },
  ): void;
}

let loading: Promise<GoogleId> | null = null;

/**
 * How long the screen waits for Google's script. On a stalled hall connection the script may
 * never answer and never fail, and an emptied phone would then never be offered "Start"
 * (FR-018). After this the screen says "No signal" with Try again and Start; the script keeps
 * loading, so Try again uses it once it has come.
 */
export const GOOGLE_SCRIPT_DEADLINE_MS = 8_000;

/** Google's script, waited for at most `GOOGLE_SCRIPT_DEADLINE_MS`. */
function loadGoogleInTime(): Promise<GoogleId> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      // fetch's own error type for no connection, so the screen says "No signal".
      () => reject(new TypeError('Google’s sign-in script did not answer in time')),
      GOOGLE_SCRIPT_DEADLINE_MS,
    );
  });
  return Promise.race([loadGoogle(), deadline]).finally(() => clearTimeout(timer));
}

/** Google's script, loaded once; a failed load can be tried again. */
function loadGoogle(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const id = (globalThis as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google’s sign-in script gave no button'));
    };
    // fetch's own error type for no connection, so the screen says "No signal".
    script.onerror = () => reject(new TypeError('Google’s sign-in script did not load'));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = null;
    document.querySelector(`script[src="${GIS_SRC}"]`)?.remove();
    throw error;
  });
  return loading;
}

export function GoogleButton({
  clientId,
  text,
  size = 'large',
  attempt,
  onCredential,
  onError,
}: {
  clientId: string;
  /** Google's own words: "Continue with Google" on Welcome, "Sign in" in the prompt. */
  text: 'continue_with' | 'signin';
  size?: 'large' | 'medium';
  /** Changed to draw the button again with a fresh nonce, after a failed attempt. */
  attempt: number;
  onCredential(credential: string, nonce: string): void;
  onError(error: unknown): void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  // The latest handlers, so the button isn't drawn again each time the screen renders.
  const credentialGiven = useEffectEvent((credential: string, nonce: string) =>
    onCredential(credential, nonce),
  );
  const failed = useEffectEvent((error: unknown) => onError(error));
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const [google, { nonce, hashed }] = await Promise.all([loadGoogleInTime(), googleNonce()]);
        const node = parent.current;
        if (!current || !node) return;
        google.initialize({
          client_id: clientId,
          nonce: hashed,
          callback: ({ credential }) => credentialGiven(credential, nonce),
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_button: true,
        });
        node.replaceChildren();
        google.renderButton(node, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size,
          text,
          shape: 'pill',
          // Google's button is at most 400px wide: full width on a phone for Welcome's; the
          // prompt's keeps its own size.
          width:
            size === 'large'
              ? Math.min(400, Math.round(node.getBoundingClientRect().width)) || undefined
              : undefined,
          logo_alignment: 'center',
        });
      } catch (error) {
        if (current) failed(error);
      }
    })();
    return () => {
      current = false;
    };
  }, [clientId, text, size, theme, attempt]);

  return (
    <div
      ref={parent}
      data-google-button
      className={size === 'large' ? 'flex w-full justify-center' : 'flex shrink-0'}
    />
  );
}
