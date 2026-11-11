// What a row needs to know to fit a line of names (screens/fit-names.ts): how wide the page's
// column is, and how wide a text is in the `sub` type. Read once for the whole page and shared
// by every row, never per row: a long list keeps most of its rows undrawn (content-visibility),
// and a row that read its own box would force each one to be laid out. Text is measured on a
// canvas, in the type as the page draws it, so no layout is read at all once the two numbers are
// known. They are read again when the page's width changes, when the phone's text size does, and
// when the font has loaded.

import { useSyncExternalStore } from 'react';

export interface LineMetrics {
  /** The width of a row's text column: the page inside its gutters. */
  width: number;
  /** How wide `text` is in the `sub` type. */
  measure(text: string): number;
}

let metrics: LineMetrics | null = null;
let probe: HTMLSpanElement | null = null;
let context: CanvasRenderingContext2D | null | undefined;
let watching = false;
const listeners = new Set<() => void>();

/** The page's column and its `sub` type, as they are now; null before the page is drawn. */
function read(): { width: number; font: string } | null {
  const main = document.querySelector('main');
  if (!main) return null;
  if (context === undefined) context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  if (!probe?.isConnected) {
    // A line of the `sub` type, out of sight: its font is the rows', at the phone's text size.
    probe = document.createElement('span');
    probe.className = 'pointer-events-none invisible absolute top-0 left-0 text-sub';
    probe.setAttribute('aria-hidden', 'true');
    probe.textContent = '0';
    document.body.append(probe);
  }
  const page = getComputedStyle(main);
  const type = getComputedStyle(probe);
  return {
    width: main.clientWidth - parseFloat(page.paddingLeft) - parseFloat(page.paddingRight),
    font: `${type.fontStyle} ${type.fontWeight} ${type.fontSize} ${type.fontFamily}`,
  };
}

let key = '';
/** Reads them again; tells the rows only where they changed (or the font's own widths did). */
function refresh(force = false, tell = true): void {
  const now = read();
  const next = now ? `${now.width}|${now.font}` : '';
  if (!force && next === key) return;
  key = next;
  if (!now) {
    metrics = null;
  } else {
    const widths = new Map<string, number>();
    const { font } = now;
    metrics = {
      width: now.width,
      measure(text) {
        let width = widths.get(text);
        if (width === undefined) {
          context!.font = font;
          widths.set(text, (width = context!.measureText(text).width));
        }
        return width;
      },
    };
  }
  if (tell) for (const listener of listeners) listener();
}

function watch(): void {
  // The page isn't there to read while its first rows are being drawn: they are told once it is.
  if (metrics === null) refresh();
  const main = document.querySelector('main');
  if (watching || !main) return;
  watching = true;
  // The page's width, and the probe's height, which follows the phone's text size.
  const observer = new ResizeObserver(() => refresh());
  observer.observe(main);
  if (probe) observer.observe(probe);
  // Widths measured before the font loaded were the fallback's.
  void document.fonts?.ready.then(() => refresh(true));
  document.fonts?.addEventListener?.('loadingdone', () => refresh(true));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  watch();
  return () => listeners.delete(listener);
}

function snapshot(): LineMetrics | null {
  // The first row to ask reads them, as it is drawn, so no row is drawn twice. Nothing is told:
  // every row drawn after it reads the same.
  if (metrics === null) refresh(false, false);
  return metrics;
}

/** The page's line metrics, kept current; null where they can't be read. */
export function useLineMetrics(): LineMetrics | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
