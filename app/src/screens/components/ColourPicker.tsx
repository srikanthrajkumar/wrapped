// The Colour sheet (T042; DESIGN.md "Colour sheet", design D27): the 12 labelled swatches plus
// "?", four to a row (three at large text sizes). A tap selects and saves at once, shown by a
// check mark and a 2px foreground ring. Below the grid, "Second colour" opens the same grid for
// a two-tone outfit, and "Remove second colour" appears once one is set. Black, White and Grey
// always carry a 2px ring border, so they stand off the sheet in both themes.

import { IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COLOURS, type Colour } from '../../model';
import { SheetFrame } from './sheet-frame';

/** The swatch values (DESIGN.md, "Outfit colours"): data a rasika picks, not theme colours. */
export const SWATCHES: Record<Colour, string> = {
  white: '#F5F3EE',
  red: '#C62828',
  blue: '#1E5AA8',
  orange: '#E8711A',
  yellow: '#F2C230',
  black: '#111111',
  brown: '#7A4A2A',
  pink: '#E87FA8',
  beige: '#D9C7A3',
  green: '#2E7D4F',
  purple: '#6A3D9A',
  grey: '#8C8C8C',
};

// The order of last season's Colours sheet, as DESIGN.md's table reads across.
const ORDER: Colour[] = [
  'white',
  'brown',
  'red',
  'pink',
  'blue',
  'beige',
  'orange',
  'green',
  'yellow',
  'purple',
  'black',
  'grey',
];

const EDGED: readonly Colour[] = ['black', 'white', 'grey'];
// Swatches light enough to take a dark check mark.
const LIGHT: readonly Colour[] = ['white', 'yellow', 'beige', 'pink', 'grey', 'orange'];

export const colourName = (colour: Colour) => colour[0]!.toUpperCase() + colour.slice(1);

/** The phone's text size against the default, for layouts that change at large sizes. */
export function useTextScale(): number {
  const read = () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const update = () => setScale(read());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

/** A small swatch, as Stage shows an Appearance's Colours. */
export function SwatchDot({ colour }: { colour: Colour | 'unknown' }) {
  if (colour === 'unknown') {
    return (
      <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-caption">
        ?
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-block size-5 rounded-full border border-border',
        EDGED.includes(colour) && 'border-2 border-ring',
      )}
      style={{ backgroundColor: SWATCHES[colour] }}
    />
  );
}

function Grid({
  value,
  allowUnknown,
  onPick,
  label,
}: {
  value: Colour | 'unknown' | null;
  allowUnknown: boolean;
  onPick(colour: Colour | 'unknown'): void;
  label: string;
}) {
  const scale = useTextScale();
  const choices: (Colour | 'unknown')[] = allowUnknown ? [...ORDER, 'unknown'] : ORDER;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-x-2 gap-y-3', scale >= 1.5 ? 'grid-cols-3' : 'grid-cols-4')}
    >
      {choices.map((colour) => {
        const picked = value === colour;
        const name = colour === 'unknown' ? '?' : colourName(colour);
        return (
          <button
            key={colour}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={colour === 'unknown' ? "Didn't notice" : name}
            onClick={() => onPick(colour)}
            className="flex min-h-12 flex-col items-center gap-1 rounded-xl py-1"
          >
            <span
              className={cn(
                'relative flex size-14 items-center justify-center rounded-full border border-border',
                colour !== 'unknown' && EDGED.includes(colour) && 'border-2 border-ring',
                picked && 'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
              )}
              style={colour === 'unknown' ? undefined : { backgroundColor: SWATCHES[colour] }}
            >
              {colour === 'unknown' && <span className="text-title">?</span>}
              {picked && colour !== 'unknown' && (
                <IconCheck
                  aria-hidden
                  stroke={3}
                  className="size-6"
                  // The mark contrasts with the swatch, which is data, not a theme colour.
                  style={{ color: LIGHT.includes(colour) ? SWATCHES.black : SWATCHES.white }}
                />
              )}
            </span>
            <span className="text-sub">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ColourPicker({
  open,
  onOpenChange,
  artistName,
  primary,
  secondary,
  onChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  artistName: string;
  primary: Colour | 'unknown' | null;
  secondary: Colour | null;
  onChange(colours: {
    colourPrimary: Colour | 'unknown' | null;
    colourSecondary: Colour | null;
  }): void;
}) {
  const [second, setSecond] = useState(false);
  const canHaveSecond = primary !== null && primary !== 'unknown';
  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) setSecond(false);
        onOpenChange(next);
      }}
      title={`Colours · ${artistName}`}
    >
      {second ? (
        <div className="flex flex-col gap-4">
          <p className="text-sub text-muted-foreground">Second colour</p>
          <Grid
            label="Second colour"
            value={secondary}
            allowUnknown={false}
            onPick={(colour) =>
              onChange({
                colourPrimary: primary,
                colourSecondary: colour === 'unknown' ? null : colour,
              })
            }
          />
          <Button variant="outline" onClick={() => setSecond(false)}>
            First colour
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Grid
            label="Colour"
            value={primary}
            allowUnknown
            onPick={(colour) =>
              onChange({
                colourPrimary: colour,
                // "?" has no second colour (a second colour needs a first).
                colourSecondary: colour === 'unknown' ? null : secondary,
              })
            }
          />
          {canHaveSecond && (
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setSecond(true)}>
                {secondary ? `Second colour: ${colourName(secondary)}` : 'Second colour'}
              </Button>
              {secondary && (
                <Button
                  variant="ghost"
                  onClick={() => onChange({ colourPrimary: primary, colourSecondary: null })}
                >
                  Remove second colour
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </SheetFrame>
  );
}

export { COLOURS };
