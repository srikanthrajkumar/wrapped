// An Item's Manodharma Ragas and Layavinyasam nadais as lists (ADR 0012). One function turns an
// Item stored before 0.4.0 into the new shape and leaves a new one alone; the phone store's
// upgrade, a pulled row and a journalled value all go through it, so nothing old is ever shown,
// compared or saved in the old shape.

import type { DetailValue } from './detail-value';
import type { Improvised, Item, LayaVinyasam } from './records';

/** A part as stored before ADR 0012: one Raga, null for the Item's own. */
interface OldImprovised {
  kind: Improvised['kind'];
  raga?: DetailValue | null;
  ragas?: unknown;
}

/** A Layavinyasam as stored before ADR 0012: one nadai, Not applicable for the Tala's. */
interface OldLaya {
  nadai?: DetailValue;
  nadais?: unknown;
  note?: string | null;
}

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A part in the new shape. One already in it comes back as the same object. */
export function upgradePart(part: Improvised | OldImprovised): Improvised {
  if (Array.isArray((part as { ragas?: unknown }).ragas)) return part as Improvised;
  const { raga, ...rest } = part as OldImprovised;
  delete (rest as { ragas?: unknown }).ragas;
  return { ...rest, ragas: raga ? [raga] : [] } as Improvised;
}

/** A Layavinyasam in the new shape, or null. One already in it comes back as the same object. */
export function upgradeLaya(laya: LayaVinyasam | OldLaya | null | undefined): LayaVinyasam | null {
  if (!laya) return null;
  if (Array.isArray((laya as { nadais?: unknown }).nadais)) return laya as LayaVinyasam;
  const { nadai, ...rest } = laya as OldLaya;
  delete (rest as { nadais?: unknown }).nadais;
  return {
    ...rest,
    note: rest.note ?? null,
    nadais: nadai && nadai.state !== 'na' ? [nadai] : [],
  } as LayaVinyasam;
}

/** The Manodharma parts in the new shape; the same array when none needed changing. */
export function upgradeParts(parts: readonly (Improvised | OldImprovised)[] | null | undefined) {
  const list = parts ?? [];
  const upgraded = list.map(upgradePart);
  if (parts && upgraded.every((part, i) => part === list[i])) return parts as Improvised[];
  return upgraded;
}

/**
 * `item` in the shape of ADR 0012. Returns `item` itself when it is already in it, so a caller
 * can tell whether anything changed.
 */
export function upgradeItemShape<T extends Item>(item: T): T {
  // A damaged row is left as it is: the upgrade must never stop the store from opening, and
  // nothing in it is rewritten.
  if (!item || typeof item !== 'object') return item;
  if (item.improvised != null && !Array.isArray(item.improvised)) return item;
  if (item.improvised?.some((part) => !isObject(part))) return item;
  if (item.layaVinyasam != null && !isObject(item.layaVinyasam)) return item;
  const improvised = upgradeParts(item.improvised);
  const layaVinyasam = upgradeLaya(item.layaVinyasam);
  if (improvised === item.improvised && layaVinyasam === item.layaVinyasam) return item;
  return { ...item, improvised, layaVinyasam };
}

/**
 * A journalled value for an Item field (screens/save-feedback.ts) in the new shape: an
 * `improvised` list, or a `layaVinyasam` entry (`{ nadai }` before, `{ nadais }` now, or null).
 * Any other field comes back as it is.
 */
export function upgradeItemFieldValue(field: string, value: unknown): unknown {
  if (field === 'improvised' && Array.isArray(value)) {
    if (!value.every(isObject)) return value;
    return upgradeParts(value as OldImprovised[]);
  }
  if (field === 'layaVinyasam' && isObject(value)) {
    const laya = value as OldLaya;
    if (Array.isArray(laya.nadais)) return value;
    return { nadais: laya.nadai && laya.nadai.state !== 'na' ? [laya.nadai] : [] };
  }
  return value;
}

/** A part's list as stored: cut back to only the Item's Raga, it follows again. */
export function settlePartRagas(ragas: (DetailValue | null)[]): (DetailValue | null)[] {
  return ragas.length === 1 && ragas[0] === null ? [] : ragas;
}
