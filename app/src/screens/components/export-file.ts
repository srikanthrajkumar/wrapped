// Hand the season's export to the rasika: the share sheet where the phone has one, else a
// download (FR-019). A rescue Export from a "Not saved" line adds the values the phone could not
// store, read from save feedback, never from the database (eng review D6); once it is handed
// over, those values may be cleared. When the database itself can't be read, only a rescue
// Export is made: it carries those values, marked and named `-store-unreadable`, and the line
// "This Export holds only the changes not saved…" says so; a plain Export fails instead. Never
// throws: a file that can't be made at all shows "The Export couldn't be made on this phone."
// at the top of the screen, with Try again (SeasonFeedback).

import { useSyncExternalStore } from 'react';
import type { WrappedDB } from '../../store/db';
import { buildExport, exportOrRescue, type SeasonExport } from '../../store/export';
import { saveFeedback } from '../save-feedback';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0';

interface ExportState {
  /** The last Export that failed outright, kept for its Try again. */
  failed: { rescue: boolean } | null;
  /** The last rescue Export handed over came from a store that couldn't be read. */
  storeUnreadable: boolean;
}

let state: ExportState = { failed: null, storeUnreadable: false };
const listeners = new Set<() => void>();

function update(next: Partial<ExportState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** The file and its name: a plain Export reads the store or fails; a rescue one never fails. */
export async function makeExportFile({
  rescue,
  db,
}: {
  rescue: boolean;
  db?: WrappedDB;
}): Promise<{ name: string; file: SeasonExport }> {
  const file = rescue
    ? await exportOrRescue({ db, appVersion: APP_VERSION, notSaved: saveFeedback.notSaved() })
    : await buildExport({ db, appVersion: APP_VERSION });
  const day = file.exportedAt.slice(0, 10);
  const suffix = !rescue ? '' : file.storeUnreadable ? '-store-unreadable' : '-not-saved';
  return { name: `carnatic-wrapped-${day}${suffix}.json`, file };
}

/** Resolves to whether the file was handed over (closing the share sheet doesn't count). */
async function handOver(name: string, file: SeasonExport): Promise<boolean> {
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: 'application/json' });
  const shared = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [shared] })) {
    try {
      await navigator.share({ files: [shared] });
      return true;
    } catch (error) {
      // Closing the share sheet is not a failure; anything else falls back to a download.
      if ((error as Error).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Export the season; resolves to whether a file was handed over. */
export async function exportSeason({
  rescue = false,
}: { rescue?: boolean } = {}): Promise<boolean> {
  try {
    const { name, file } = await makeExportFile({ rescue });
    const handed = await handOver(name, file);
    if (handed && file.notSaved) saveFeedback.markExported(file.notSaved);
    update({
      failed: null,
      storeUnreadable: handed ? file.storeUnreadable !== undefined : state.storeUnreadable,
    });
    return handed;
  } catch (error) {
    console.error('export failed', error);
    update({ failed: { rescue } });
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The failed Export and the store-unreadable notice, for the top of the screen. */
export function useExportState(): ExportState {
  return useSyncExternalStore(subscribe, () => state);
}

export function dismissExportFailure(): void {
  update({ failed: null });
}
