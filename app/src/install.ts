// The install row's side of the page (DESIGN.md "Install"; eng review D15): which phone this is,
// whether the app already runs installed, and Android's install prompt, kept from the moment the
// browser offers it. Safari can clear a website's storage after 7 days without a visit and leaves
// installed apps alone, so a phone in a browser tab is asked to install, on every screen.

import { useSyncExternalStore } from 'react';

/** The phone's way to install: Safari's Share menu, or the browser's own prompt. */
export type InstallWay = 'ios' | 'android';

/** Chrome's `beforeinstallprompt`, which no TypeScript lib describes yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** An iPhone, iPad (whose Safari says Macintosh, with touch) or Android phone; null elsewhere. */
export function installWay(userAgent: string, touchPoints: number): InstallWay | null {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && touchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return null;
}

const STANDALONE = '(display-mode: standalone)';

function runsInstalled(): boolean {
  return (
    window.matchMedia?.(STANDALONE).matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export interface InstallState {
  /** How to install here, or null when there is nothing to ask: installed, or a desktop. */
  way: InstallWay | null;
  /** Android only: the browser has offered its prompt, so the Install button can open it. */
  canPrompt: boolean;
}

let offered: InstallPromptEvent | null = null;
let state: InstallState = { way: null, canPrompt: false };
const listeners = new Set<() => void>();

function refresh() {
  const way = runsInstalled() ? null : installWay(navigator.userAgent, navigator.maxTouchPoints);
  const next = { way, canPrompt: way === 'android' && offered !== null };
  if (next.way === state.way && next.canPrompt === state.canPrompt) return;
  state = next;
  listeners.forEach((listener) => listener());
}

/** Start listening, once, before the browser's offer can come (main.tsx). */
export function watchInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Kept for the Install button rather than shown by the browser on its own.
    event.preventDefault();
    offered = event as InstallPromptEvent;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    offered = null;
    refresh();
  });
  window.matchMedia?.(STANDALONE).addEventListener?.('change', refresh);
  refresh();
}

/** Open Android's install prompt. It can be used once; the browser offers another later. */
export async function promptInstall(): Promise<void> {
  const prompt = offered;
  if (!prompt) return;
  offered = null;
  refresh();
  await prompt.prompt();
  await prompt.userChoice.catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useInstall(): InstallState {
  return useSyncExternalStore(subscribe, () => state);
}
