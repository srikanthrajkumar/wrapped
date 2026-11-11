// The Colour sheet (T042; DESIGN.md "Colour sheet", design D27): the 12 labelled swatches in the
// colour wheel's order plus "?", four to a row (three at large text sizes). A tap selects and saves at once, shown by a
// check mark and a 2px foreground ring. Below the grid, "Second colour" opens the same grid for
// a two-tone outfit, and "Remove second colour" appears once one is set. Black, White and Grey
// always carry a 2px ring border, so they stand off the sheet in both themes.

import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTextScale } from '@/hooks/use-text-scale';
import type { Colour } from '../../model';
import { SheetFrame } from './sheet-frame';

/** The swatch values (DESIGN.md, "Outfit colours"): data a rasika picks, not theme colours. */
const SWATCHES: Record<Colour, string> = {
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

// The colour wheel's order, unrolled (FB-13, decided 2026-11-05): the hues from red round to
// pink, then the earth tones, then white to black. Four to a row, the neutrals close the grid.
const ORDER: Colour[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'beige',
  'brown',
  'white',
  'grey',
  'black',
];

const EDGED: readonly Colour[] = ['black', 'white', 'grey'];
// Swatches light enough to take a dark check mark.
const LIGHT: readonly Colour[] = ['white', 'yellow', 'beige', 'pink', 'grey', 'orange'];

export const colourName = (colour: Colour) => colour[0]!.toUpperCase() + colour.slice(1);

/**
 * A small swatch, as Stage shows an Appearance's Colours: one 20px circle, whatever it holds. A
 * two-tone outfit is half and half, so it reads as one outfit (FB-13, decided 2026-11-05). With
 * no Colours it is the same circle, empty and dashed (the Maintainer, 2026-11-11): a plain ring
 * would read as Black on the dark page and White on the light one.
 *
 * Drawn as one SVG (2026-11-11), so every swatch is the same size and its halves meet on a
 * clean line. As a bordered box with a gradient it was not: the gradient repeated under the
 * border, so a sliver of each colour showed on the other's side, and a swatch with the 2px ring
 * had less fill than one with the 1px.
 */
export function SwatchDot({
  colour,
  second = null,
}: {
  colour: Colour | 'unknown' | null;
  second?: Colour | null;
}) {
  const box = 'inline-block size-5 shrink-0';
  if (colour === null) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden className={`${box} text-muted-foreground`}>
        {/* Twelve dashes, a whole number round the ring, the first centred at the top. */}
        <circle
          cx="10"
          cy="10"
          r="9.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          pathLength="48"
          strokeDasharray="2.4 1.6"
          strokeDashoffset="1.2"
          transform="rotate(-90 10 10)"
        />
      </svg>
    );
  }
  if (colour === 'unknown') {
    return (
      <span
        className={`${box} inline-flex items-center justify-center rounded-full border border-border text-caption`}
      >
        ?
      </span>
    );
  }
  // Black, White and Grey take the 2px ring, so they stand off the page in both themes; the
  // rest the 1px border. The fill ends under the ring's middle, never outside it.
  const edged = EDGED.includes(colour) || (second !== null && EDGED.includes(second));
  const width = edged ? 2 : 1;
  const r = 10 - width / 2;
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={box}>
      {/* The second colour is the whole circle and the first is laid over its left half, so no
          gap can open where they meet. */}
      <circle cx="10" cy="10" r={r} fill={SWATCHES[second ?? colour]} />
      {second && <path d={`M10 ${10 - r}A${r} ${r} 0 0 0 10 ${10 + r}Z`} fill={SWATCHES[colour]} />}
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        strokeWidth={width}
        className={edged ? 'stroke-ring' : 'stroke-border'}
      />
    </svg>
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
  // Only a swatch picked in this sheet animates, never the one already chosen when it opens.
  const [justPicked, setJustPicked] = useState<Colour | 'unknown' | null>(null);
  const choices: (Colour | 'unknown')[] = allowUnknown ? [...ORDER, 'unknown'] : ORDER;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // The outer swatches sit on the gutters, with the title and the buttons.
      className={cn(
        'grid justify-between gap-x-2 gap-y-3',
        scale >= 1.5 ? 'grid-cols-[repeat(3,auto)]' : 'grid-cols-[repeat(4,auto)]',
      )}
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
            onClick={() => {
              setJustPicked(colour);
              onPick(colour);
            }}
            className="flex min-h-12 flex-col items-center gap-1 rounded-xl py-1"
          >
            <span
              className={cn(
                'swatch relative flex size-14 items-center justify-center rounded-full border border-border',
                colour !== 'unknown' && EDGED.includes(colour) && 'border-2 border-ring',
                picked && 'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
                justPicked === colour && 'just-picked',
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
            {/* "?" says itself; a caption under it would repeat it. */}
            {colour !== 'unknown' && <span className="text-sub">{name}</span>}
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
