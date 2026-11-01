// Hand the season's export to the rasika: the share sheet where the phone has one, else a
// download (FR-019). A rescue Export from a "Not saved" line adds the values the phone could not
// store, read from save feedback, never from the database (eng review D6).

import { buildExport } from '../../store/export';
import { saveFeedback } from '../save-feedback';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0';

export async function exportSeason({ rescue = false }: { rescue?: boolean } = {}): Promise<void> {
  const file = await buildExport({
    appVersion: APP_VERSION,
    notSaved: rescue ? saveFeedback.notSaved() : undefined,
  });
  const day = file.exportedAt.slice(0, 10);
  const name = `carnatic-wrapped-${day}${rescue ? '-not-saved' : ''}.json`;
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: 'application/json' });
  const shared = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [shared] })) {
    try {
      await navigator.share({ files: [shared] });
      return;
    } catch (error) {
      // Closing the share sheet is not a failure; anything else falls back to a download.
      if ((error as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
