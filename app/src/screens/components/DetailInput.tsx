// The Detail input (T040; DESIGN.md "Detail input", design D25): one pattern for every Detail.
// Tapping a Detail in the grid opens a docked search scoped to it, with three chips pinned above
// the keyboard: "?" (Unknown), "Not sure" (marks the value a Guess; tapped again, clears it) and
// "N/A" (Not applicable). Every state is two taps from the grid. A value picked from the catalog
// that differs from the Composition's becomes an Override in the store; the sheet then shows
// "catalog: Todi" with "Use catalog value". "Use what I typed" keeps the text as Unresolved.

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
import { detailText, NADAI_NAMES } from '../format';
import { MESSAGES } from '../messages';
import { Chip, DockedSearch, FixedRow, type SearchRow } from './DockedSearch';
import { SheetFrame } from './sheet-frame';

export type DetailField = DetailKind | 'nadai';

/** Can be marked not sure: a value with a name (data-model.md, "Detail value"). */
const guessable = (value: DetailValue) =>
  value.state === 'catalog' || value.state === 'override' || value.state === 'unresolved';

/** The three pinned chips: "?", "Not sure", "N/A". */
export function StateChips({
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

/** A Nadai, from chips: none picked means the Tala's usual nadai (Not applicable). */
export function NadaiChips({
  value,
  onChange,
  allowUnknown = false,
}: {
  value: DetailValue;
  onChange(value: DetailValue): void;
  allowUnknown?: boolean;
}) {
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
            onClick={() =>
              onChange(picked ? notApplicableValue() : catalogValue(nadai, NADAI_NAMES[nadai]))
            }
          >
            {NADAI_NAMES[nadai]}
          </Chip>
        );
      })}
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
  const options = useMemo(
    () => (field === 'nadai' ? [] : detailOptions(catalog, field)),
    [catalog, field],
  );
  const typed = query.trim();

  const choose = (next: DetailValue) => {
    onChange(next);
    setQuery('');
    onOpenChange(false);
  };

  const results: SearchRow[] =
    field === 'nadai'
      ? []
      : searchDetail(options, query).map((option) => ({
          key: option.key,
          title: option.display,
          onPick: () => choose(catalogValue(option.key, option.display)),
        }));

  const note =
    !typed || field === 'nadai'
      ? null
      : catalogState.status === 'missing' && field !== 'form'
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
      tall={field !== 'nadai'}
    >
      {value.state === 'override' && suggested && (
        <div className="flex flex-wrap items-center gap-x-2 pb-2 text-sub text-muted-foreground">
          <span>catalog: {detailText(suggested)}</span>
          <Button variant="outline" className="text-sub" onClick={() => choose(suggested)}>
            Use catalog value
          </Button>
        </div>
      )}
      {field === 'nadai' ? (
        <div className="flex flex-col gap-3 pb-2">
          <NadaiChips value={value} allowUnknown onChange={choose} />
          {extra}
        </div>
      ) : (
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
      )}
    </SheetFrame>
  );
}
