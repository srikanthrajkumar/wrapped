// A Schedule entry and file as the feed sends them (contracts/schedule-feed.md), for the tests.

export const raw = (fields: Record<string, unknown> = {}) => ({
  id: 'music-academy-2026-12-15-1600',
  version: 3,
  date: '2026-12-15',
  startTime: '16:00',
  sabha: 'Music Academy',
  kind: 'concert',
  title: null,
  billed: [
    { name: 'Malladi Sreeramprasad', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Malladi Ravikumar', role: 'vocal', group: 'Malladi Brothers' },
    { name: 'Pakkala Ramadas', role: 'violin' },
    { name: 'Someone', role: null },
  ],
  cancelled: false,
  ...fields,
});

export const fileOf = (entries: unknown[], fields: Record<string, unknown> = {}) => ({
  format: 1,
  season: '2026-27',
  publishedAt: '2026-11-20T10:00:00Z',
  entries,
  ...fields,
});
