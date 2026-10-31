// The records the phone stores and syncs (data-model.md). The server keeps each rasika record
// as sent, in one jsonb column, so these types are the only definition of its fields (eng
// review D7). Terms follow GLOSSARY.md.

import type { DetailValue } from './detail-value';

/** The 12 colours of last season's Colours sheet. Extending it is a project-kept list change. */
export const COLOURS = [
  'white',
  'red',
  'blue',
  'orange',
  'yellow',
  'brown',
  'pink',
  'beige',
  'green',
  'purple',
  'black',
  'grey',
] as const;
export type Colour = (typeof COLOURS)[number];

/** What an Artist did at one Event. No Role ranks above another (FR-004). */
export const ROLES = [
  'vocal',
  'violin',
  'veena',
  'flute',
  'mridangam',
  'khanjira',
  'ghatam',
  'morsing',
  'other',
  'presenter',
] as const;
export type Role = (typeof ROLES)[number];

export const NADAIS = ['tisra', 'chatusra', 'khanda', 'misra', 'sankeerna'] as const;
export type Nadai = (typeof NADAIS)[number];

export const IMPROVISED_KINDS = ['alapana', 'tanam', 'niraval', 'kalpana_swaram'] as const;
export type ImprovisedKind = (typeof IMPROVISED_KINDS)[number];

export type EventKind = 'concert' | 'lecdem';
export type EventStatus = 'planned' | 'attended' | 'missed';
export type EventSource = 'schedule' | 'plan' | 'spot';

/** ISO timestamps from the device clock: for display, never a sync cursor. */
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  /** Set on delete. The row stays as a tombstone and syncs like any write. */
  deletedAt: string | null;
}

export interface Event extends Timestamps {
  id: string;
  kind: EventKind;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`. */
  startTime: string | null;
  /** An own or shared Sabha. */
  sabhaId: string | null;
  /** Only `attended` counts in the Wrapped (FR-026). */
  status: EventStatus;
  /** Set from the Schedule only while `touched` is false (FR-027). */
  cancelled: boolean;
  source: EventSource;
  scheduleEntryId: string | null;
  /** The Schedule entry version last applied or acknowledged. */
  scheduleVersionSeen: string | null;
  /** The "schedule changed" hint. */
  scheduleChanged: boolean;
  /** True once the rasika edits it or it becomes Attended; Schedule updates then stop. */
  touched: boolean;
  /** Required for a Lecdem, null for a Concert (FR-013). */
  title: string | null;
  note: string | null;
}

export interface Appearance extends Timestamps {
  id: string;
  eventId: string;
  /** An own or shared Artist. */
  artistId: string;
  /** Null when unknown. */
  role: Role | null;
  colourPrimary: Colour | 'unknown' | null;
  /** The second colour of a two-tone outfit. */
  colourSecondary: Colour | null;
  /** Came from the Plan or the Schedule. */
  billed: boolean;
  /** Billing order. The Event is shown under the Appearance at position 1 (FR-004). */
  position: number;
}

export interface LayaVinyasam {
  nadai: DetailValue;
  note: string | null;
}

export interface Improvised {
  kind: ImprovisedKind;
  /** Null when it is the Item's own Raga. */
  raga: DetailValue | null;
}

export interface Item extends Timestamps {
  id: string;
  eventId: string;
  /** Running order, unique among the Event's live Items. */
  position: number;
  /** The Composition's `kriti_id`; null for RTP, viruttam, slokam, medley or free text. */
  compositionKey: string | null;
  /** As picked or typed. */
  title: string;
  form: DetailValue;
  /** In order: one for most Items, several for a ragamalika or an RTP (FR-009). */
  ragas: DetailValue[];
  tala: DetailValue;
  /** Keys from NADAIS. Qualifies the tala, as in "Adi (khanda nadai)". */
  nadai: DetailValue;
  composer: DetailValue;
  language: DetailValue;
  /** Rolled up to a Topic when the Wrapped is computed. */
  subject: DetailValue;
  /** The Laya vinyasam that followed this Item (FR-011). */
  layaVinyasam: LayaVinyasam | null;
  /** Improvised Details heard (FR-051). */
  improvised: Improvised[];
  note: string | null;
}

/** An own Artist or Sabha, created by the rasika. */
export interface OwnEntry extends Timestamps {
  id: string;
  /** As typed. */
  name: string;
  /** The name folded as in search (`app/src/catalog/fold.ts`); groups promotion candidates. */
  nameKey: string;
  /** Names merged into this one (FR-036). */
  aliases: string[];
  /** Set on the merged-away record; readers follow it. */
  mergedIntoId: string | null;
}

export type Artist = OwnEntry;
export type Sabha = OwnEntry;

/** Written by the server when the Maintainer promotes an entry (FR-044). */
export interface Link {
  id: string;
  ownTable: 'artist' | 'sabha' | 'event';
  ownId: string;
  /** A Shared Artist or Sabha id, or a Schedule entry id for an Event. */
  sharedId: string;
}

/** A Shared Artist or Sabha, curated by the Maintainer and pulled, never pushed. */
export interface SharedEntry {
  id: string;
  name: string;
  aliases: string[];
  listVersion: number;
}

export type SharedArtist = SharedEntry;
export type SharedSabha = SharedEntry;

export interface BilledArtist {
  /** A name, or a Shared Artist id. */
  name: string;
  role: Role | null;
}

/** One entry of the logger's Schedule feed (contracts/schedule-feed.md). Not rasika-owned. */
export interface ScheduleEntry {
  id: string;
  version: number;
  date: string;
  startTime: string | null;
  /** A Shared Sabha id or a name. */
  sabha: string;
  kind: EventKind;
  /** In billing order, as on the poster. */
  billed: BilledArtist[];
  title: string | null;
  cancelled: boolean;
}

/** The rasika-owned tables: the only ones a phone pushes. */
export interface RasikaRows {
  events: Event;
  appearances: Appearance;
  items: Item;
  artists: Artist;
  sabhas: Sabha;
}
export type RasikaTable = keyof RasikaRows;
export type RasikaRow = RasikaRows[RasikaTable];

export const RASIKA_TABLES = [
  'events',
  'appearances',
  'items',
  'artists',
  'sabhas',
] as const satisfies readonly RasikaTable[];
