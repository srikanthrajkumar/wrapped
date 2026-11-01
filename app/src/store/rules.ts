// The validation rules the phone enforces before saving (data-model.md, "Validation rules").
// The server stores each record as sent and checks only its id, owner and parent Event (eng
// review D7, R6), so a rule broken here is broken for good.

import {
  COLOURS,
  NADAIS,
  ROLES,
  IMPROVISED_KINDS,
  detailValueProblems,
  type Appearance,
  type DetailValue,
  type Event,
  type Item,
} from '../model';

/** A save refused because the record would break a rule. Nothing was written. */
export class RuleError extends Error {
  override name = 'RuleError';
  constructor(readonly problems: string[]) {
    super(problems.join('; '));
  }
}

export function check(problems: string[]): void {
  if (problems.length > 0) throw new RuleError(problems);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function eventProblems(event: Event): string[] {
  const problems: string[] = [];
  if (event.kind !== 'concert' && event.kind !== 'lecdem') problems.push('unknown kind');
  if (!ISO_DATE.test(event.date)) problems.push('date must be YYYY-MM-DD');
  if (event.startTime !== null && !TIME.test(event.startTime)) {
    problems.push('start time must be HH:MM');
  }
  if (!['planned', 'attended', 'missed'].includes(event.status)) problems.push('unknown status');
  // FR-013: a Lecdem needs a title; a Concert's title is null.
  if (event.kind === 'lecdem' && !event.title?.trim()) problems.push('a Lecdem needs a title');
  if (event.kind === 'concert' && event.title !== null) {
    problems.push("a Concert's title is null");
  }
  return problems;
}

export function appearanceProblems(appearance: Appearance): string[] {
  const problems: string[] = [];
  if (appearance.role !== null && !ROLES.includes(appearance.role)) problems.push('unknown role');
  const { colourPrimary: primary, colourSecondary: secondary } = appearance;
  if (primary !== null && primary !== 'unknown' && !COLOURS.includes(primary)) {
    problems.push('unknown primary colour');
  }
  if (secondary !== null) {
    if (!COLOURS.includes(secondary)) problems.push('unknown second colour');
    if (primary === null || primary === 'unknown') {
      problems.push('a second colour needs a first');
    }
  }
  if (!Number.isInteger(appearance.position) || appearance.position < 1) {
    problems.push('position must be a whole number from 1');
  }
  return problems;
}

function detail(name: string, value: DetailValue): string[] {
  return detailValueProblems(value).map((problem) => `${name}: ${problem}`);
}

/** A Nadai is keyed by one of NADAIS when it is matched. */
function nadai(name: string, value: DetailValue): string[] {
  const problems = detail(name, value);
  if (value.key !== null && !(NADAIS as readonly string[]).includes(value.key)) {
    problems.push(`${name}: unknown nadai ${JSON.stringify(value.key)}`);
  }
  return problems;
}

/** The project-kept form key of a Ragam Tanam Pallavi (app/src/reference/forms.json). */
export const RTP_FORM = 'rtp';

export const isRtp = (item: Pick<Item, 'form'>) => item.form.key === RTP_FORM;

export function itemProblems(item: Item): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(item.position) || item.position < 1) {
    problems.push('position must be a whole number from 1');
  }
  if (typeof item.title !== 'string') problems.push('title must be text');
  problems.push(
    ...detail('form', item.form),
    ...item.ragas.flatMap((raga, i) => detail(`raga ${i + 1}`, raga)),
    ...detail('tala', item.tala),
    ...nadai('nadai', item.nadai),
    ...detail('composer', item.composer),
    ...detail('language', item.language),
    ...detail('subject', item.subject),
  );
  if (item.layaVinyasam) problems.push(...nadai('laya vinyasam nadai', item.layaVinyasam.nadai));
  for (const heard of item.improvised) {
    if (!IMPROVISED_KINDS.includes(heard.kind)) problems.push('unknown improvised kind');
    if (heard.raga) problems.push(...detail(`${heard.kind} raga`, heard.raga));
  }
  // An RTP has no Composition and one or more Ragas (US1 scenario 7).
  if (isRtp(item)) {
    if (item.compositionKey !== null) problems.push('an RTP has no Composition');
    if (item.ragas.length === 0) problems.push('an RTP has at least one Raga');
  }
  return problems;
}
