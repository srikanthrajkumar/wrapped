// The words the Item editor's Manodharma and Layavinyasam show (docs/design/item-editor.md §4-§6):
// a part's name, a value in a line, a nadai in sentence case, and the one-time hint's mark.

import { browserStorage } from '../browser-storage';
import type { DetailValue, Improvised, ImprovisedKind } from '../model';
import { detailText } from './format';

export const PART_NAMES: Record<ImprovisedKind, string> = {
  alapana: 'Alapana',
  tanam: 'Tanam',
  niraval: 'Niraval',
  kalpana_swaram: 'Kalpanaswaram',
};

/** A value as plain text in a line: "Kalyani", "Kalyani (?)"; "?" for none. */
export function valueLine(value: DetailValue | null): string {
  if (!value) return '?';
  const text = value.state === 'na' ? 'Not applicable' : detailText(value);
  return value.guess ? `${text} (?)` : text;
}

/** A nadai's chip word, in sentence case like the Roles: "Tisra" (2026-11-19). */
export const nadaiName = (nadai: string) => nadai.charAt(0).toUpperCase() + nadai.slice(1);

/** A part's Ragas as text, its Item's-Raga slots read now: "Kharaharapriya, Kalyani". */
export function partRagasText(part: Improvised, itemRaga: DetailValue | null): string {
  return part.ragas.map((raga) => valueLine(raga ?? itemRaga)).join(', ');
}

/**
 * The Tala's nadai as a rasika names it ("Chatusra"), or null when the Tala is not known. With
 * no Nadai set, the Tala's usual nadai: chatusra (DESIGN.md "Detail input").
 */
export function talaNadaiName(tala: DetailValue, nadai: DetailValue): string | null {
  if (tala.state === 'unknown' || tala.state === 'na') return null;
  if (nadai.state === 'na') return nadaiName('chatusra');
  if (nadai.state === 'unknown') return null;
  return nadai.key ? nadaiName(nadai.key) : nadai.text;
}

/** Where this phone remembers that the hint has been shown, once ever (§4). */
const HINT_KEY = 'wrapped.manodharmaHint.v1';

/** Whether this phone has shown the hint; a reinstall or a second phone shows it once more. */
export function hintShown(): boolean {
  try {
    return browserStorage()?.getItem(HINT_KEY) === 'shown';
  } catch {
    return true;
  }
}

export function markHintShown(): void {
  try {
    browserStorage()?.setItem(HINT_KEY, 'shown');
  } catch {
    // Blocked storage: it may show once more.
  }
}
