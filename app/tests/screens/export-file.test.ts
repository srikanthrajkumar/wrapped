// Required test (constitution IV; docs/adr/0007): every Export carries the journal of values not
// saved, and only a rescue Export that was handed over is remembered for Clear. Closing the
// share sheet changes nothing; a later Export that fails takes the check badge away. The day of
// the last Export is recorded only once its file is handed over.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  exportSeason,
  makeExportFile,
  useExportState,
} from '../../src/screens/components/export-file';
import { saveFeedback } from '../../src/screens/save-feedback';
import { readLastExport } from '../../src/store/export';
import { freshDb, reopen } from '../helpers';

vi.mock('react', async (actual) => ({
  ...(await actual<typeof import('react')>()),
  // The state outside React: what the hook would read.
  useSyncExternalStore: (_: unknown, snapshot: () => unknown) => snapshot(),
}));

const note = { table: 'events', id: 'e1', field: 'note' } as const;

/** A phone whose share sheet answers `share`. */
function shareSheet(share: () => Promise<void>) {
  vi.stubGlobal('navigator', { canShare: () => true, share });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Export file (required)', () => {
  it('a plain Export carries the values not saved too', async () => {
    await saveFeedback.track(note, 'Tisram', () => Promise.reject(new Error('disk full')));
    const { file } = await makeExportFile({ rescue: false, db: freshDb() });
    expect(file.notSaved).toEqual([expect.objectContaining({ ...note, value: 'Tisram' })]);
  });

  it('only a rescue Export handed over is remembered, with what the file held', async () => {
    shareSheet(() => Promise.resolve());
    await exportSeason();
    expect(useExportState().handover).toBeNull();

    await exportSeason({ rescue: true });
    const handover = useExportState().handover;
    expect(handover?.entries).toEqual(saveFeedback.notSaved());

    // Closing the share sheet changes nothing.
    shareSheet(() => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' })));
    await exportSeason({ rescue: true });
    expect(useExportState().handover).toBe(handover);
  });

  it('an Export that fails after one that was handed over takes its check away', async () => {
    shareSheet(() => Promise.resolve());
    await exportSeason({ rescue: true });
    expect(useExportState().handover).not.toBeNull();

    // No share sheet and no page to download from: the file can't be handed over.
    shareSheet(() => Promise.reject(new TypeError('share failed')));
    await exportSeason({ rescue: true });
    expect(useExportState().failed).toEqual({ rescue: true });
    expect(useExportState().handover).toBeNull();
  });
});

// Settings shows the day of the last Export (DESIGN.md "Settings"): it is recorded only once a
// file holding the season has been handed over, and kept in the phone store across a relaunch.
describe('the last Export', () => {
  it('is recorded only once the file is handed over, and kept across a relaunch', async () => {
    const db = freshDb();
    // The share sheet is open: nothing is recorded until the rasika picks where it goes.
    let handOver!: () => void;
    shareSheet(() => new Promise<void>((resolve) => (handOver = resolve)));
    const exporting = exportSeason({ db });
    await vi.waitFor(() => expect(handOver).toBeTypeOf('function'));
    expect(await readLastExport(db)).toBeNull();

    handOver();
    expect(await exporting).toBe(true);
    await vi.waitFor(async () => expect(await readLastExport(db)).not.toBeNull());
    const last = await readLastExport(db);
    expect(last).toEqual({ at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });

    expect(await readLastExport(reopen(db))).toEqual(last);
  });

  it('a store that never finishes writing the day still lets the handover stand', async () => {
    const db = freshDb();
    await saveFeedback.track(note, 'Tisram', () => Promise.reject(new Error('disk full')));
    shareSheet(() => Promise.resolve());
    vi.spyOn(db.meta, 'put').mockReturnValue(new Promise(() => undefined) as never);
    expect(await exportSeason({ rescue: true, db })).toBe(true);
    expect(useExportState().handover).not.toBeNull();
    expect(useExportState().seasonHandedOver).toBe(true);
  });

  it('is not recorded when the share sheet is closed or the file never goes', async () => {
    const db = freshDb();
    shareSheet(() => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' })));
    await exportSeason({ db });
    // No share sheet and no page to download from.
    shareSheet(() => Promise.reject(new TypeError('share failed')));
    await exportSeason({ db });
    expect(await readLastExport(db)).toBeNull();
  });

  it('a rescue Export that left the season out is not the last Export', async () => {
    const db = freshDb();
    await saveFeedback.track(note, 'Tisram', () => Promise.reject(new Error('disk full')));
    shareSheet(() => Promise.resolve());
    db.close();
    expect(await exportSeason({ rescue: true, db })).toBe(true);
    expect(await readLastExport(reopen(db))).toBeNull();
  });
});
