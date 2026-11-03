// Required test (constitution IV; docs/adr/0007): every Export carries the journal of values not
// saved, and only a rescue Export that was handed over is remembered for Clear. Closing the
// share sheet changes nothing; a later Export that fails takes the check badge away.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  exportSeason,
  makeExportFile,
  useExportState,
} from '../../src/screens/components/export-file';
import { saveFeedback } from '../../src/screens/save-feedback';
import { freshDb } from '../helpers';

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
