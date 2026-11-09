// The Detail input (T040; DESIGN.md "Detail input", design D25): one pattern for every Detail.
// Tapping a Detail in the grid opens a docked search scoped to it, with three chips pinned above
// the keyboard: "?" (Unknown), "Not sure" (marks the value a Guess; tapped again, clears it) and
// "N/A" (Not applicable). Every state is two taps from the grid. A value picked from the catalog
// that differs from the Composition's becomes an Override in the store; the sheet then shows
// "catalog: Todi" with "Use catalog value". "Use what I typed" keeps the text as Unresolved.
// The Nadai uses the same pattern, its five nadais as chips and as results (constitution: "?"
// and free text on every Detail).

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { detailOptions, searchDetail, type DetailKind } from '../../catalog/detail-search';
import { useCatalog } from '../../catalog/use-catalog';
import {
  NADAIS,
  catalogValue,
  notApplicableValue,
  unknownValue,
  unresolvedValue,
  type DetailValue,
} from '../../model';
import { detailText } from '../format';
import { MESSAGES } from '../messages';
import { Chip, DockedSearch, FixedRow, type SearchRow } from './DockedSearch';
import { SheetFrame } from './sheet-frame';

export type DetailField = DetailKind;

/** Can be marked not sure: a value with a name (data-model.md, "Detail value"). */
const guessable = (value: DetailValue) =>
  value.state === 'catalog' || value.state === 'override' || value.state === 'unresolved';

/** The three pinned chips: "?", "Not sure", "N/A". */
function StateChips({
  value,
  onChange,
}: {
  value: DetailValue;
  onChange(value: DetailValue): void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        pressed={value.state === 'unknown'}
        aria-label="Unknown"
        onClick={() => onChange(unknownValue())}
      >
        ?
      </Chip>
      <Chip
        pressed={value.guess}
        aria-disabled={!guessable(value)}
        className={guessable(value) ? undefined : 'opacity-50'}
        onClick={() => guessable(value) && onChange({ ...value, guess: !value.guess })}
      >
        Not sure
      </Chip>
      <Chip
        pressed={value.state === 'na'}
        aria-label="Not applicable"
        onClick={() => onChange(notApplicableValue())}
      >
        N/A
      </Chip>
    </div>
  );
}

/**
 * A Nadai, from chips: none picked means the Tala's usual nadai (Not applicable). With
 * `allowUnknown`, "?" leads; with `onOther`, "Other…" opens the Nadai's own Detail input, for
 * "Not sure" and free text.
 */
export function NadaiChips({
  value,
  onChange,
  allowUnknown = false,
  onOther,
}: {
  value: DetailValue;
  onChange(value: DetailValue): void;
  allowUnknown?: boolean;
  onOther?: () => void;
}) {
  const typed = value.state === 'unresolved';
  return (
    <div role="group" aria-label="Nadai" className="flex flex-wrap gap-2">
      {allowUnknown && (
        <Chip
          pressed={value.state === 'unknown'}
          aria-label="Nadai unknown"
          onClick={() => onChange(unknownValue())}
        >
          ?
        </Chip>
      )}
      {NADAIS.map((nadai) => {
        const picked = value.key === nadai;
        return (
          <Chip
            key={nadai}
            pressed={picked}
            onClick={() => onChange(picked ? notApplicableValue() : catalogValue(nadai, nadai))}
          >
            {nadai}
            {picked && value.guess && ' (?)'}
          </Chip>
        );
      })}
      {onOther && (
        <Chip pressed={typed} onClick={onOther}>
          {typed ? `${value.text}${value.guess ? ' (?)' : ''}` : 'Other…'}
        </Chip>
      )}
    </div>
  );
}

export function DetailInput({
  open,
  onOpenChange,
  field,
  title,
  value,
  suggested,
  onChange,
  extra,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  field: DetailField;
  /** The Detail's name: "Raga", "Tala"… */
  title: string;
  value: DetailValue;
  /** What the Composition says, to offer "Use catalog value" on an Override. */
  suggested?: DetailValue | null;
  onChange(value: DetailValue): void;
  /** More controls under the chips: the Nadai row for a Tala, move and remove for a Raga. */
  extra?: ReactNode;
}) {
  const catalogState = useCatalog();
  const catalog = catalogState.status === 'ready' ? catalogState.catalog : null;
  const [query, setQuery] = useState('');
  // Kept drawn while it closes (sheet-frame useLingering), it opens again with an empty search.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery('');
  }
  const options = useMemo(() => detailOptions(catalog, field), [catalog, field]);
  const typed = query.trim();

  const choose = (next: DetailValue) => {
    onChange(next);
    setQuery('');
    onOpenChange(false);
  };

  const matches = useMemo(() => searchDetail(options, query), [options, query]);
  const results: SearchRow[] = matches.map((option) => ({
    key: option.key,
    title: option.display,
    onPick: () => choose(catalogValue(option.key, option.display)),
  }));

  const note = !typed
    ? null
    : catalogState.status === 'missing' && field !== 'form' && field !== 'nadai'
      ? MESSAGES.search.noCatalog
      : results.length === 0
        ? MESSAGES.search.noMatch
        : null;

  const current = detailText(value);
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
      title={title}
      description={current ? `Now: ${value.guess ? `${current} (?)` : current}` : undefined}
      tall
    >
      {value.state === 'override' && suggested && (
        <div className="flex flex-wrap items-center gap-x-2 pb-2 text-sub text-muted-foreground">
          <span>catalog: {detailText(suggested)}</span>
          <Button variant="outline" className="text-sub" onClick={() => choose(suggested)}>
            Use catalog value
          </Button>
        </div>
      )}
      <DockedSearch
        label={`Search ${title}`}
        placeholder={`${title}…`}
        query={query}
        onQueryChange={setQuery}
        note={note}
        onSubmit={() => results[0]?.onPick()}
        fixed={
          <div className="flex flex-col gap-3">
            <StateChips value={value} onChange={choose} />
            {field === 'nadai' && <NadaiChips value={value} onChange={choose} />}
            {extra}
            {typed && (
              <FixedRow onClick={() => choose(unresolvedValue(typed))}>
                Use what I typed: “{typed}”
              </FixedRow>
            )}
          </div>
        }
        results={results}
      />
    </SheetFrame>
  );
}
