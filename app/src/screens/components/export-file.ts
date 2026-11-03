// Hand the season's export to the rasika: the share sheet where the phone has one, else a
// download (FR-019). Every Export carries the whole journal (typed, being written and failed
// values), read from save feedback, never from the database (eng review D6; docs/adr/0007).
// The last handover is remembered: its Export icon carries a check badge, and its entries are what
// Clear may remove once the rasika confirms the file is saved; a handover alone never clears
// anything, since a download may not have been kept (docs/adr/0007). When the database can't be
// read, only a rescue Export is made, named `-store-unreadable`; a plain one fails instead. One
// from a store still opening that doesn't answer in time holds the journal alone, named
// `-not-saved` and marked `storeTimedOut`. Never throws: a file that can't be made at all shows
// "Export failed" with Try again, and takes away the check of an earlier handover. Once a file
// holding the season is handed over, its day is kept in the store for Settings ("Last: 2 Nov").

import { useSyncExternalStore } from 'react';
import type { WrappedDB } from '../../store/db';
import {
  buildExport,
  exportOrRescue,
  recordLastExport,
  type SeasonExport,
} from '../../store/export';
import { saveFeedback, type JournalEntry } from '../save-feedback';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0';

interface ExportState {
  /** The last Export that failed outright, kept for its Try again. */
  failed: { rescue: boolean } | null;
  /**
   * The last rescue Export handed over: what it held, and whether the season was left out
   * because the store was unreadable or still opening.
   */
  handover: { entries: JournalEntry[]; storeUnreadable: boolean; storeTimedOut: boolean } | null;
  /** A file holding the season, plain or rescue, was handed over: Settings' Export shows a check. */
  seasonHandedOver: boolean;
}

let state: ExportState = { failed: null, handover: null, seasonHandedOver: false };
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
  const notSaved = saveFeedback.notSaved();
  const file = rescue
    ? await exportOrRescue({ db, appVersion: APP_VERSION, notSaved })
    : await buildExport({ db, appVersion: APP_VERSION, notSaved });
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
  db,
}: { rescue?: boolean; db?: WrappedDB } = {}): Promise<boolean> {
  try {
    const { name, file } = await makeExportFile({ rescue, db });
    const handed = await handOver(name, file);
    const holdsSeason = !file.storeUnreadable && !file.storeTimedOut;
    // The day is only shown, so it is never waited for: a store that can't write it now (or
    // never answers) keeps the day before, and the handover below still stands.
    if (handed && holdsSeason) {
      void recordLastExport(file.exportedAt, db).catch((error: unknown) =>
        console.error('last export not recorded', error),
      );
    }
    const handover =
      handed && rescue
        ? {
            entries: (file.notSaved ?? []) as JournalEntry[],
            storeUnreadable: file.storeUnreadable !== undefined,
            storeTimedOut: file.storeTimedOut !== undefined,
          }
        : state.handover;
    update({
      failed: null,
      handover,
      seasonHandedOver: state.seasonHandedOver || (handed && holdsSeason),
    });
    return handed;
  } catch (error) {
    console.error('export failed', error);
    // The check of an earlier handover would read as if this one went out.
    update({ failed: { rescue }, handover: null, seasonHandedOver: false });
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

/** The store opened after all: a handover that left the season out no longer stands. */
export function storeOpened(): void {
  if (state.handover?.storeUnreadable || state.handover?.storeTimedOut) update({ handover: null });
}
