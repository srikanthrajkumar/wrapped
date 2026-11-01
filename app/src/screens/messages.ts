// Every system message on the logging screens, copied verbatim from the Messages table in
// DESIGN.md (design D28). This file is their only home in code: screens import from here, and
// tests/screens/messages.test.ts checks that each row of the table appears.

export const MESSAGES = {
  welcome: {
    title: 'Carnatic Wrapped',
    sentence:
      'Log the Concerts you attend this December, even with no signal, and see your season whole.',
    action: 'Continue with Google',
  },
  signIn: {
    cancelled: 'Sign-in was cancelled. You need to sign in once before logging.',
    noSignal: 'No signal. Sign-in needs a connection, once, on this phone.',
    googleError: "Google couldn't sign you in just now.",
  },
  consent1: {
    question:
      'Share the Artists, Sabhas and Concerts you add by hand with the person who keeps the shared lists?',
    reason:
      'Only the names, with a count of how many rasikas added them. Never who you are or what you logged. You can change this in Settings.',
  },
  consent2: {
    question: 'Include your season, without your name, in reports about the whole December season?',
    reason:
      "Reports show totals across rasikas, never one person's log. You can change this in Settings.",
  },
  gettingReady: {
    downloading: 'Getting ready to log offline…',
    done: 'Ready to log offline.',
    stopped: 'The download stopped. Logging needs it once, with a connection.',
  },
  homeStatus: {
    changesWaiting: (count: number) =>
      `Saved on this phone · ${count} ${count === 1 ? 'change' : 'changes'} not yet backed up`,
    allSynced: 'All backed up',
  },
  sessionEnded: 'Sign in again to keep backing up. Logging still works.',
  anotherPhone: 'Your season is now being logged on another phone. Changes here are kept.',
  saveFailed: 'Not saved on this phone.',
  newCatalog: 'An updated song catalog is ready.',
  /** Not in the table: the app update without a new catalog (T028's wording, kept). */
  appUpdate: 'A new version is ready.',
  search: {
    noMatch: 'No match in the catalog',
    noCatalog:
      'Catalog not on this phone yet. What you type is kept and can be matched later in Tidy.',
    /** Spoken once typing pauses. */
    results: (count: number) =>
      count === 0 ? 'No matches' : `${count} ${count === 1 ? 'result' : 'results'}`,
  },
  undo: {
    itemDeleted: (number: number) => `Item ${number} deleted`,
    artistRemoved: 'Artist removed',
    concertDeleted: 'Concert deleted',
    /** What a screen reader hears after a delete. */
    spoken: (bar: string) => `${bar}. Undo available.`,
  },
  actions: {
    tryAgain: 'Try again',
    yes: 'Yes',
    no: 'No',
    start: 'Start',
    signIn: 'Sign in',
    details: 'Details',
    export: 'Export',
    update: 'Update',
    later: 'Later',
    undo: 'Undo',
  },
} as const;
