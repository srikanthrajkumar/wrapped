// Manodharma and the Layavinyasam in the Item editor (docs/design/item-editor.md §4, §5; DESIGN.md
// "Item editor (DD4)"). Each part is a List row with a check: off, the row is a switch a tap
// turns on; on, it silently follows the Item's Raga, and the row's tap opens the part's one
// sheet, its check the one nested control that turns it off, at once. The Layavinyasam is its
// own one-row panel, its nadais shown plainly, its Note under it. Their Ragas and nadais are
// lists (ADR 0012).

import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  IMPROVISED_KINDS,
  unknownValue,
  type DetailValue,
  type Improvised,
  type ImprovisedKind,
} from '../../model';
import { nadaiName, PART_NAMES, partRagasText, valueLine } from '../item-words';
import { DetailInput, NadaiChips } from './DetailInput';
import { ActionRow, ROW_SHAPE } from './rows';
import { SheetFrame } from './sheet-frame';
import { AnotherButton, MoveLine, PickLine } from './values';

/** For 500ms after a row turns on, another tap on it does nothing (§4). */
const GUARD_MS = 500;

/**
 * The check on an on row, centred on the row's text (the Maintainer, 2026-11-20): its ink ends
 * on the 24px column (row.md).
 */
function Check({
  name,
  label,
  onClick,
  ref,
}: {
  name: string;
  /** Spoken in place of "<name>, on", as the Layavinyasam's with a note typed. */
  label?: string;
  onClick(): void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked="true"
      aria-label={label ?? name}
      onClick={onClick}
      className="-mr-3.5 flex size-12 shrink-0 items-center justify-center rounded-xl focus-visible:-outline-offset-2"
    >
      <IconCheck aria-hidden className="size-5 text-foreground" />
    </button>
  );
}

/** Turned on just now: taps on the row are ignored until the guard runs out. */
function useGuard() {
  const until = useRef(new Map<string, number>());
  return {
    arm: (key: string) => until.current.set(key, Date.now() + GUARD_MS),
    held: (key: string) => (until.current.get(key) ?? 0) > Date.now(),
  };
}

/**
 * Focus the check of a row just turned on, once it is drawn: the switch moves there (§4).
 */
function useFocusCheck() {
  const pending = useRef<string | null>(null);
  return {
    ref: (key: string) => (element: HTMLButtonElement | null) => {
      if (element && pending.current === key) {
        pending.current = null;
        element.focus({ preventScroll: true });
      }
    },
    focus: (key: string) => {
      pending.current = key;
    },
  };
}

export function ManodharmaRows({
  parts,
  itemRaga,
  rtp,
  hint,
  onTurnOn,
  onTurnOff,
  onOpen,
}: {
  parts: Improvised[];
  /** The Item's first Raga, which a part follows; null with none. */
  itemRaga: DetailValue | null;
  /** In an RTP every part that is on shows its Raga line. */
  rtp: boolean;
  /** The part whose row carries the one-time hint, if any. */
  hint: ImprovisedKind | null;
  onTurnOn(kind: ImprovisedKind): void;
  onTurnOff(kind: ImprovisedKind): void;
  onOpen(kind: ImprovisedKind): void;
}) {
  const guard = useGuard();
  const checks = useFocusCheck();
  const itemText = valueLine(itemRaga);
  return (
    <>
      {IMPROVISED_KINDS.map((kind) => {
        const name = PART_NAMES[kind];
        const part = parts.find((heard) => heard.kind === kind);
        if (!part) {
          return (
            <li key={kind} className="hairline-b">
              <button
                type="button"
                role="switch"
                aria-checked="false"
                aria-label={name}
                onClick={() => {
                  guard.arm(kind);
                  checks.focus(kind);
                  onTurnOn(kind);
                }}
                className={ROW_SHAPE}
              >
                <span className="break-words">{name}</span>
              </button>
            </li>
          );
        }
        const own = part.ragas.length > 0;
        const ownText = own ? partRagasText(part, itemRaga) : null;
        // The second line: its own Ragas in ink; in an RTP, the Item's muted while it follows;
        // the hint once, naming the silent default and the way to change it.
        const line: { text: string; ink: boolean } | null = own
          ? { text: ownText!, ink: true }
          : hint === kind
            ? { text: `${itemText} · tap to change`, ink: false }
            : rtp
              ? { text: itemText, ink: false }
              : null;
        const spokenRagas = own
          ? `${part.ragas.length > 1 ? 'Ragas' : 'Raga'} ${ownText}`
          : `Raga ${itemText}, the Item’s`;
        return (
          <li key={kind} className="flex items-center hairline-b">
            <button
              type="button"
              aria-label={`${name}, ${spokenRagas}, change`}
              onClick={() => !guard.held(kind) && onOpen(kind)}
              className={cn(ROW_SHAPE, 'flex-1 flex-col items-stretch gap-0')}
            >
              <span className="break-words">{name}</span>
              {line && (
                <span className="grow-in">
                  <span
                    className={cn(
                      'text-sub break-words',
                      line.ink ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {line.text}
                  </span>
                </span>
              )}
            </button>
            <Check ref={checks.ref(kind)} name={name} onClick={() => onTurnOff(kind)} />
          </li>
        );
      })}
    </>
  );
}

/**
 * A Manodharma part's one sheet (§4). While it follows: the Item's Raga, "?" and "Not sure", a
 * quiet "+ Another Raga", and the box "Change Raga…". With its own Ragas: them in a line, one
 * selected, "?" and "Not sure" and the move line acting on it, "+ Another Raga", the Action row
 * "Use the Item's Raga only", and the box "Change Kalyani…".
 */
export function PartSheet({
  open,
  onOpenChange,
  part,
  itemRaga,
  onSave,
  onRemove,
  onFollow,
  onAnnounce,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  part: Improvised;
  itemRaga: DetailValue | null;
  /** The part's whole list, as it should now be stored. */
  onSave(ragas: (DetailValue | null)[]): void;
  /** Remove the Raga in this place, at once, with no Undo. */
  onRemove(index: number): void;
  /** "Use the Item's Raga only", at once, with no Undo. */
  onFollow(): void;
  onAnnounce(text: string): void;
}) {
  const name = PART_NAMES[part.kind];
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState(false);
  // Opened again, it starts on the first Raga, adding nothing.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(0);
      setAdding(false);
    }
  }
  const ragas = part.ragas;
  const own = ragas.length > 0;
  const at = Math.min(selected, Math.max(ragas.length - 1, 0));
  const itemText = valueLine(itemRaga);
  const slotText = (raga: DetailValue | null) =>
    raga === null ? `${itemText} (Item’s)` : valueLine(raga);
  const slotValue = (raga: DetailValue | null) => raga ?? itemRaga ?? unknownValue();

  const another = !adding && (
    <AnotherButton onClick={() => setAdding(true)}>Another Raga</AnotherButton>
  );

  if (!own) {
    return (
      <DetailInput
        open={open}
        onOpenChange={onOpenChange}
        field="raga"
        title={name}
        description={`Item’s Raga: ${itemText}`}
        na={false}
        value={itemRaga ?? unknownValue()}
        placeholder={adding ? 'Add Raga…' : 'Change Raga…'}
        // Adding starts the part's list with the Item's Raga, kept live, then the new one.
        onChange={(value) => onSave(adding ? [null, value] : [value])}
        extra={another || undefined}
      />
    );
  }

  const current = ragas[at] ?? null;
  const move = (by: -1 | 1) => {
    const to = at + by;
    const next = [...ragas];
    [next[at], next[to]] = [next[to]!, next[at]!];
    onSave(next);
    setSelected(to);
    onAnnounce(`${slotText(current)}, now ${to + 1} of ${ragas.length}`);
  };
  return (
    <DetailInput
      open={open}
      onOpenChange={onOpenChange}
      field="raga"
      title={name}
      description={null}
      na={false}
      head={
        <PickLine
          label={`${name} Ragas`}
          selected={adding ? null : at}
          onSelect={(index) => {
            setSelected(index);
            setAdding(false);
          }}
          items={ragas.map((raga, index) => ({
            key: `${index}`,
            text: slotText(raga),
            spoken: [slotText(raga), index === at && !adding ? 'selected' : null]
              .concat(`${index + 1} of ${ragas.length}`)
              .filter(Boolean)
              .join(', '),
          }))}
        />
      }
      value={adding ? unknownValue() : slotValue(current)}
      placeholder={adding ? 'Add Raga…' : `Change ${valueLine(slotValue(current))}…`}
      onChange={(value) => {
        if (adding) {
          onSave([...ragas, value]);
          setSelected(ragas.length);
          setAdding(false);
          return;
        }
        onSave(ragas.map((raga, index) => (index === at ? value : raga)));
      }}
      extra={
        // One group on a 48px rhythm: the move line, "+ Another Raga", the Action row.
        <div className="flex flex-col">
          {!adding && (
            <MoveLine
              index={at}
              count={ragas.length}
              name={slotText(current)}
              onMove={move}
              onRemove={() => onRemove(at)}
            />
          )}
          {another}
          <ActionRow onClick={onFollow}>Use the Item’s Raga only</ActionRow>
        </div>
      }
    />
  );
}

/** The Layavinyasam's one row, on its own panel, and its Note under it (§5). */
export function LayavinyasamRow({
  on,
  nadais,
  talaNadai,
  noteTyped,
  onTurnOn,
  onTurnOff,
  onNote,
  onOpen,
  note,
}: {
  on: boolean;
  nadais: DetailValue[];
  talaNadai: string | null;
  /** A note is typed: the check's tap goes to the note, to clear it first (2026-11-05). */
  noteTyped: boolean;
  onTurnOn(): void;
  onTurnOff(): void;
  onNote(): void;
  onOpen(): void;
  /** The Note field, shown under the row while it is on. */
  note: ReactNode;
}) {
  const guard = useGuard();
  const checks = useFocusCheck();
  if (!on) {
    return (
      <li className="hairline-b">
        <button
          type="button"
          role="switch"
          aria-checked="false"
          aria-label="Layavinyasam"
          onClick={() => {
            guard.arm('laya');
            checks.focus('laya');
            onTurnOn();
          }}
          className={ROW_SHAPE}
        >
          Layavinyasam
        </button>
      </li>
    );
  }
  const set = nadais.length > 0;
  const listed = nadais.map((nadai) => (nadai.key ? nadaiName(nadai.key) : valueLine(nadai)));
  const spoken = set
    ? `Nadais: ${listed.join(', ')}`
    : talaNadai
      ? `Nadais: the Tala’s, ${talaNadai}. Add a nadai`
      : 'No nadai. Add a nadai';
  return (
    <li className="flex flex-col hairline-b">
      <div className="flex items-center">
        <button
          type="button"
          aria-label={`Layavinyasam, ${spoken}`}
          onClick={() => !guard.held('laya') && onOpen()}
          className={cn(ROW_SHAPE, 'flex-1 flex-col items-stretch gap-0')}
        >
          <span>Layavinyasam</span>
          <span className="flex flex-wrap items-center gap-x-4 text-sub">
            {set ? (
              <span className="break-words text-foreground">{listed.join(', ')}</span>
            ) : (
              <>
                {talaNadai && <span className="text-muted-foreground">{talaNadai}</span>}
                <span className="inline-flex items-center gap-1 text-foreground">
                  <IconPlus aria-hidden className="size-5" />
                  Nadai
                </span>
              </>
            )}
          </span>
        </button>
        <Check
          ref={checks.ref('laya')}
          name="Layavinyasam"
          label={noteTyped ? 'Clear the note to turn off Layavinyasam' : undefined}
          onClick={() => (noteTyped ? onNote() : onTurnOff())}
        />
      </div>
      {/* Grows open under its row rather than appearing at full height. */}
      {/* Its own box inside the growing one, whose padding would take the 12px under it. */}
      <div className="grow-in">
        <div>
          <div className="pb-3">{note}</div>
        </div>
      </div>
    </li>
  );
}

/**
 * The Layavinyasam's sheet (§5): the Tala's nadai, the nadais in a line with one selected, the
 * Nadai chips (a chip changes the selected nadai, or picks the first, or, after "+ Another
 * nadai", appends one), and the move line. "Other…" opens the Nadai's own sheet.
 */
export function LayavinyasamSheet({
  open,
  onOpenChange,
  nadais,
  talaNadai,
  talaNadaiKey,
  selected,
  onSelect,
  onSave,
  onRemove,
  onOther,
  onAnnounce,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  nadais: DetailValue[];
  talaNadai: string | null;
  /** The Tala's own nadai's key, which alone leaves the list empty. */
  talaNadaiKey: string | null;
  /** The selected nadai's place; 'add' after "+ Another nadai"; 0 by default. */
  selected: number | 'add';
  onSelect(selected: number | 'add'): void;
  onSave(nadais: DetailValue[]): void;
  onRemove(index: number): void;
  onOther(): void;
  onAnnounce(text: string): void;
}) {
  const set = nadais.length > 0;
  const adding = selected === 'add';
  const at = adding ? null : Math.min(selected, Math.max(nadais.length - 1, 0));
  const text = (nadai: DetailValue) => (nadai.key ? nadaiName(nadai.key) : valueLine(nadai));
  const pick = (nadai: DetailValue) => {
    if (!set) {
      // Picking only the Tala's own nadai leaves the list empty.
      if (nadai.key !== null && nadai.key === talaNadaiKey) return;
      onSave([nadai]);
      onSelect(0);
    } else if (adding) {
      onSave([...nadais, nadai]);
      onSelect(nadais.length);
    } else {
      onSave(nadais.map((value, index) => (index === at ? nadai : value)));
    }
  };
  const move = (by: -1 | 1) => {
    const to = at! + by;
    const next = [...nadais];
    [next[at!], next[to]] = [next[to]!, next[at!]!];
    onSave(next);
    onSelect(to);
    onAnnounce(`${text(nadais[at!]!)}, now nadai ${to + 1} of ${nadais.length}`);
  };
  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Layavinyasam"
      description={talaNadai ? `Tala’s nadai: ${talaNadai}` : undefined}
      below={
        set && (
          <PickLine
            label="Nadais"
            selected={at}
            onSelect={onSelect}
            items={nadais.map((nadai, index) => ({
              key: `${index}`,
              text: text(nadai),
              spoken: [
                `${text(nadai)}, nadai ${index + 1} of ${nadais.length}`,
                index === at ? 'selected' : null,
              ]
                .filter(Boolean)
                .join(', '),
            }))}
          />
        )
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <NadaiChips
          value={!set || at === null ? null : (nadais[at] ?? null)}
          allowUnknown
          unknownLabel="A nadai I couldn’t name"
          toggle={false}
          onChange={pick}
          onOther={onOther}
        />
        <div className="flex flex-col">
          {set && at !== null && (
            <MoveLine
              index={at}
              count={nadais.length}
              name={text(nadais[at]!)}
              onMove={move}
              onRemove={() => onRemove(at)}
            />
          )}
          {set && !adding && (
            <AnotherButton onClick={() => onSelect('add')}>Another nadai</AnotherButton>
          )}
        </div>
      </div>
    </SheetFrame>
  );
}
