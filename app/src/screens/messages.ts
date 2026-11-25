// Every system message on the logging screens, copied verbatim from the Messages table in
// DESIGN.md (design D28). This file is their only home in code: screens import from here, and
// tests/screens/messages.test.ts checks that each row of the table appears.

export const MESSAGES = {
  welcome: {
    // The Maintainer, 2026-11-25.
    title: 'carnatic.live',
    sentence: 'Log your sabha hopping and get your Margazhi recapped.',
    action: 'Continue with Google',
  },
  signIn: {
    cancelled: 'Sign-in was cancelled. You need to sign in once before logging.',
    noSignal: 'No signal. Sign-in needs a connection, once, on this phone.',
    googleError: "Google couldn't sign you in just now.",
  },
  // The Maintainer's words, 2026-11-25.
  consent1: {
    question: "Help us keep the app's lists complete?",
    reason:
      'If you type in an artist, sabha, or concert we missed, we only see the name and how many people added it. We never see who you are or what you logged, and you can change this anytime in Settings.',
  },
  consent2: {
    question: 'Count your concerts in the December season totals?',
    reason:
      "We sometimes share anonymous totals across the whole season, like the most-heard ragas, to test the season's burning theories with data. You can change this anytime in Settings.",
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
    /** The "+N" after a row's or the hero's presenters, as it is spoken (ADR 0013). */
    andMore: (count: number) => `and ${count} more`,
    /** A cancelled concert's row, in its time's place (the row spec, 2026-11-16). */
    cancelled: 'Cancelled',
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
    /** Tomorrow, as the hub names it everywhere (the hub spec's decision 2). */
    tomorrowCount: (count: number) => `${count} tomorrow`,
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
      /** Nothing ahead but the hero's own concert (the hub spec's decision 1). */
      nothingElse: { title: 'Nothing else ahead' },
      season: { title: 'Nothing listed yet', line: 'Concerts show here once the Schedule is out.' },
      shortlist: {
        title: 'Nothing shortlisted',
        line: "Shortlist a concert from What's on to keep it here.",
      },
      diary: { title: 'Nothing heard yet', line: 'Every concert you log is kept here.' },
      items: { title: 'No Items yet', line: 'Add each piece as it is sung.' },
      search: { title: 'Nothing here matches' },
      /** From today, under a filter that matches nothing ahead (What's on decision 3). */
      searchAhead: { title: 'Nothing ahead matches' },
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
    suggestions: 'Suggestions, best match last',
    /** The names picked, pinned at the top of the search. */
    picked: 'Picked',
    remove: (name: string) => `Remove ${name}`,
    /** What a suggestion is, under its name. */
    nameKind: { artist: 'Artist', group: 'Group', sabha: 'Sabha' },
    /** Over the names heard most, before typing (docs/design/search.md, decision 2). */
    oftenHeard: 'Often heard',
    noMatch: 'Nothing here matches.',
    clear: 'Clear filters',
    /** An empty list from today, when the days gone hold something (What's on decision 3). */
    showPast: 'Show Past',
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
  versions: { app: 'App', catalog: 'Catalog' },
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
  /**
   * Sign-in, sync and account words the Messages table doesn't have yet (T081-T083), drafted
   * 2026-11-24 for the Maintainer to edit; they join the table once approved. "Update the app to
   * keep syncing" and "Make this the writing device again" are the spec's own (T078, FR-022).
   */
  account: {
    /** A sign-in refused because this phone holds another account's season (FR-021). */
    otherAccount: "This phone holds another account's season. Sign in with that account.",
    /** A sign-in refused because the last account's consent change couldn't be sent yet. */
    consentWaiting:
      'Still saving the privacy choice from your previous Google account. Please sign in with that account first so it can finish.',
    /** Settings' row to the page with both consent questions (FR-042, FR-049). */
    privacy: 'Privacy',
    updateRequired: 'Update the app to keep syncing.',
    writeHere: 'Make this the writing device again',
    signedInAs: (who: string) => `Signed in as ${who}`,
    notSignedIn: 'Not signed in',
    signOutOthers: 'Sign out other devices',
    signedOutOthers: 'Other devices signed out.',
    signOutOthersFailed: "Other devices weren't signed out. Try again with signal.",
    deletion: (contact: string) => `To delete your account, write to ${contact}`,
  },
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
    /** In the best match's place, the same in every search (docs/design/search.md). */
    nothingMatches: (typed: string) => `Nothing matches “${typed}”`,
    /** The box's clear mark. */
    clear: 'Clear search',
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
    /** A piece of an Item (ADR 0012): "Raga removed", "Alapana removed", "Nadai removed". */
    pieceRemoved: (name: string) => `${name} removed`,
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
    /** A rule refused the Undo, as "a Lecdem has at most 6 presenters". */
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
