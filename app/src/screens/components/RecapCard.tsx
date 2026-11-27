// The Diary's Recap card (DESIGN.md "Diary", "The motif"): a season summary from the rasika's
// own diary is coming, and this says so. Silk, the app's mark, as a still field on a card at the
// Diary's top, once one concert is heard. Tapped, it opens a small sheet saying what Recap will
// show. The field is painted once into a still canvas (motif/paint.ts), so scrolling the Diary
// costs nothing more than a picture (measured 2026-11-27: 1-2ms to paint at a 4x slowed CPU on
// software GL, the hub having compiled the shader already; no repaint and no dropped frame
// scrolling thirty concerts).

import { useState } from 'react';
import { Motif } from '../../motif/Motif';
import { MESSAGES } from '../messages';
import { SheetFrame } from './sheet-frame';

export function RecapCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Spoken "Recap Coming soon", a button that opens a dialog. The words stand on the
          panel's own colour, rising over Silk from the left, so they hold their contrast
          however the field falls; with large text the card grows and the field with it. */}
      <button
        type="button"
        aria-haspopup="dialog"
        data-recap=""
        onClick={() => setOpen(true)}
        className="fill-edge relative isolate mb-6 flex min-h-24 w-[calc(100%+32px)] items-end overflow-hidden rounded-fill bg-panel text-left transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <span aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          {/* Silk whole, as first launch's still field (390 by 675), turned on its side and
              scaled so its fold runs along the card (the Maintainer's pick, 2026-11-27): drawn
              to the card's own short box, the folds read as stripes. */}
          <span className="absolute top-1/2 left-1/2 block h-[675px] w-[390px] -translate-x-1/2 -translate-y-1/2 -rotate-90 scale-[0.62]">
            <Motif
              seed={{ kind: 'mark' }}
              soft={0.012}
              className="size-full animate-in duration-300 fade-in motion-reduce:animate-none"
            />
          </span>
        </span>
        <span aria-hidden className="recap-scrim-side absolute inset-0 -z-10" />
        <span className="flex flex-col p-4">
          <span className="text-title font-semibold">{MESSAGES.recap.title}</span>
          <span className="text-sub text-muted-foreground">{MESSAGES.recap.soon}</span>
        </span>
      </button>
      <SheetFrame open={open} onOpenChange={setOpen} title={MESSAGES.recap.sheet.title}>
        <p className="text-muted-foreground">{MESSAGES.recap.sheet.lede}</p>
        <ul className="mt-3 mb-2 flex flex-col gap-2">
          {MESSAGES.recap.sheet.lines.map((line) => (
            <li key={line} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2.5 size-1.5 shrink-0 rounded-full"
                style={{ background: 'var(--motif-rose)' }}
              />
              {line}
            </li>
          ))}
        </ul>
      </SheetFrame>
    </>
  );
}
