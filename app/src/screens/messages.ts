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
    unavailable:
      "Offline logging isn't available in this browser. You can still log while you have signal.",
  },
  /** Kept for sync (Phase 7): until then home shows no status line (decided 2026-11-03). */
  homeStatus: {
    changesWaiting: (count: number) =>
      `Saved on this phone · ${count} ${count === 1 ? 'change' : 'changes'} not yet backed up`,
    allSynced: 'All backed up',
  },
  /** The tab bar (the Maintainer, 2026-11-11). */
  tabs: { season: 'Season', shortlist: 'Shortlist', diary: 'Diary', settings: 'Settings' },
  /**
   * The Season spine's words (docs/designs/season-spine.md). Placeholders: the Maintainer has
   * approved none of them yet, bar the tabs' names and "Shortlist" / "Shortlisted".
   */
  spine: {
    whatsOn: "What's on",
    /** The hero's choice between Shortlisted concerts in one slot. */
    pick: (slot: string) => `Pick your ${slot}`,
    /** A concert inside the hour, on a row, the hero and the Shortlist's line. */
    inMinutes: (minutes: number) => `in ${minutes} min`,
    inCount: (count: number, minutes: number) => `${count} in ${minutes} min`,
    onNow: 'On now',
    shortlist: 'Shortlist',
    shortlisted: 'Shortlisted',
    /** The listing sheet's second button, and for a concert whose time has passed. */
    here: "I'm here",
    wasThere: 'I was there',
    /** The hub's Shortlist line. */
    nothingYet: 'Nothing yet',
    at: (count: number, time: string) => `${count} at ${time}`,
    onDay: (count: number, day: string) => `${count} on ${day}`,
    onNowCount: (count: number) => `${count} on now`,
    /** Earlier today, folded to one line on What's on. */
    earlier: 'Earlier today',
    /** The lapse card (SF-D24). */
    lapse: {
      question: 'Were you at any of these?',
      yes: 'Yes',
      yesSpoken: (name: string) => `Yes, I was at ${name}`,
      none: 'None of these',
      /** Once one has been answered: what is left to let go is the rest. */
      rest: 'None of the rest',
    },
    empty: {
      today: {
        title: 'Nothing more today',
      },
      season: { title: 'Nothing listed yet', line: 'Concerts show here once the Schedule is out.' },
      shortlist: {
        title: 'Nothing shortlisted',
        line: "Shortlist a concert from What's on to keep it here.",
      },
      diary: { title: 'Nothing heard yet', line: 'Every concert you log is kept here.' },
      items: { title: 'No Items yet', line: 'Add each piece as it is sung.' },
      search: { title: 'Nothing here matches' },
    },
    tomorrow: 'Tomorrow',
    settingsToFix: 'Settings, something to fix',
  },
  /** Season's hero, strip of days and filter (the Maintainer, 2026-11-09; DESIGN.md "Season"). */
  season: {
    /** The hero's word for the rasika's concert: on now, or their next Planned one. */
    now: 'Now',
    next: 'Next',
    /** The strip of days, and its first two stops. */
    days: 'Days',
    pastLabel: 'Past',
    today: 'Today',
    /** The days gone, as a region, when the strip's Past shows them. */
    past: 'Past',
    /** The list with nothing in it, spoken by its quiet calendar mark. */
    empty: { ahead: 'Nothing ahead', past: 'Nothing yet' },
    /** The strip's calendar, and its month sheet's arrows. */
    calendar: 'Pick a day',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    filterLabel: 'Find an Artist or Sabha',
    /** The search bar with a filter on, spoken with what is on. */
    filterOn: (what: string) => `Filter: ${what}`,
    filterPlaceholder: 'Artist or Sabha…',
    suggestions: 'Suggestions',
    remove: (name: string) => `Remove ${name}`,
    /** What a suggestion is, under its name. */
    nameKind: { artist: 'Artist', group: 'Group', sabha: 'Sabha' },
    /** Typed, with no Artist or Sabha in the Season by that name. */
    noName: 'No Artist or Sabha by that name.',
    noMatch: 'Nothing here matches.',
    clear: 'Clear filters',
  },
  /** Home, while the app isn't ready for offline; Settings shows it always. */
  offline: {
    ready: 'Ready offline',
    gettingReady: 'Getting ready for offline…',
  },
  /** Settings: whether the browser has promised to keep the phone's storage. */
  storage: {
    protected: 'Storage protected',
    notProtected: 'Storage not protected',
  },
  /** Settings' Export row: the day of the last Export, as "2 Nov". */
  lastExport: (day: string) => `Last: ${day}`,
  neverExported: '—',
  /** Settings' version lines, each label before its version: "App 0.1.0". */
  versions: { app: 'App', catalog: 'Catalog', screen: 'Screen' },
  /** The install row, on a phone with the app open in a browser tab (eng review D15). */
  install: {
    iPhone: 'Add to Home Screen:',
    android: 'Install on this phone',
    name: 'Install the app so your season stays on this phone. Tap Share, then Add to Home Screen.',
    /** Android's Install button: the name without Safari's steps. */
    why: 'Install the app so your season stays on this phone.',
    action: 'Install',
  },
  sessionEnded: 'Sign in again to keep backing up. Logging still works.',
  anotherPhone: 'Your season is now being logged on another phone. Changes here are kept.',
  /** The full sentences, for screen readers; the rows show the short labels below. */
  saveFailed: 'Not saved on this phone.',
  /** Failed saves with no field on screen to show them (a new Concert, a move, an Artist added). */
  notSavedCount: (count: number) =>
    `${count} ${count === 1 ? 'change' : 'changes'} not saved on this phone.`,
  moveFailed: 'Not moved on this phone.',
  deleteFailed: 'Not deleted on this phone.',
  repickFailed: 'Not changed on this phone.',
  exportFailed: "The Export couldn't be made on this phone.",
  /** The journal can't be written (storage full or blocked): values live only in memory. */
  journalBlocked:
    "This phone can't keep a copy of what you enter until it's saved. Export now to keep it.",
  /** After a rescue Export made while the store was still opening: the Export button's name. */
  exportStoreSlow:
    'This Export holds only the changes not saved. Your season was still opening; export again once it opens.',
  /** After a rescue Export from a store that couldn't be read: the Export button's name. */
  exportStoreUnreadable:
    "This Export holds only the changes not saved. The stored season couldn't be read; it's still on this phone.",
  /** The short labels of the icon-led rows (decided by the Maintainer 2026-11-02). */
  short: {
    notSaved: 'Not saved',
    notMoved: 'Not moved',
    notDeleted: 'Not deleted',
    notKept: 'Not kept on this phone',
    notChanged: 'Not changed',
    exportFailed: 'Export failed',
    count: (count: number) => `${count} not saved`,
    stillOpening: 'Still opening your season…',
    exported: 'Exported',
    concert: 'Concert',
  },
  /** Clear asks first: only an Export the rasika confirms is saved is cleared. */
  clearConfirm: {
    question: 'Is the Export saved where you can find it?',
    detail: (count: number) =>
      `Clearing removes ${count} ${count === 1 ? 'change' : 'changes'} from this phone.`,
    yes: 'Yes, clear',
    no: 'Not yet',
  },
  /** The screen shown when the phone's database won't open. */
  rescue: {
    title: "Can't open your season",
  },
  /** The screen shown when a newer version of the app has the store, from another tab. */
  replaced: {
    title: 'A newer version is open in another tab',
  },
  /** Asked before a reload (Reload, Try again, Update) would lose values only memory holds. */
  reloadLoses: "Reloading loses what isn't kept. Export it first.",
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
    /** A change to Concert took the Event's title away (T122). */
    titleRemoved: 'Title removed',
    /** What a screen reader hears after a delete. */
    spoken: (bar: string) => `${bar}. Undo available.`,
    /** What a failed Undo's bar names: the Item, Artist or Concert it would bring back. */
    subject: {
      item: (number: number) => `Item ${number}`,
      artist: 'Artist',
      concert: 'Concert',
      title: 'Title',
    },
    /** The Undo itself could not be written: the bar stays, with Try again. */
    failedShort: (subject: string) => `Undo failed · ${subject}`,
    failed: (subject: string) => `Undo failed: ${subject}. Not saved on this phone.`,
    /** A rule refused the Undo, as "a Lecdem has at most 3 presenters". */
    refusedShort: (subject: string, rule: string) => `Undo failed · ${subject} · ${rule}`,
    refused: (subject: string, rule: string) => `Undo failed: ${subject}, ${rule}.`,
    /** The "+1" on the newest failed Undo bar, naming the others. */
    more: (count: number) => `+${count}`,
  },
  actions: {
    tryAgain: 'Try again',
    reload: 'Reload',
    reloadAnyway: 'Reload anyway',
    tryAgainAnyway: 'Try again anyway',
    updateAnyway: 'Update anyway',
    yes: 'Yes',
    no: 'No',
    start: 'Start',
    signIn: 'Sign in',
    details: 'Details',
    export: 'Export',
    update: 'Update',
    later: 'Later',
    undo: 'Undo',
    dismiss: 'Dismiss',
    clear: 'Clear',
  },
} as const;
