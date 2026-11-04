// The hill-climb's measurements (method §4b), taken in the page from getBoundingClientRect and
// getComputedStyle: text left edges, the vertical gaps between lines of text, control heights,
// and type sizes, each checked against DESIGN.md's grid (8px, with 4px for tight inner gaps),
// its 48px targets and its type scale.

export interface Measures {
  /** Text blocks seen (an element's own text, as its line boxes draw it). */
  blocks: number;
  /** Distinct left edges of text, in px from the viewport's left. */
  lefts: number[];
  leftsOff4: number;
  leftsOff8: number;
  /** Gaps between a text block and the next one below it, in px. */
  gaps: number[];
  gapsOff4: number;
  gapsOff8: number;
  /** Distinct gaps, a measure of evenness: fewer is more even. */
  distinctGaps: number;
  /** Controls under 48px tall, by their text. */
  smallTargets: string[];
  /** Type sizes not in the scale (13, 15, 17, 20, 24, 32). */
  offScale: string[];
  /** Row heights (list items and controls in lists). */
  rows: number[];
  rowsOff4: number;
}

/**
 * Runs in the page: measures what is visible in the topmost layer (an open sheet, else the
 * page), on the first screen or, for a `full` view, the whole page.
 */
export function measure(full: boolean): Measures {
  const round = (n: number) => Math.round(n * 2) / 2;
  const off = (n: number, grid: number) => Math.abs(n - Math.round(n / grid) * grid) > 0.75;
  const dialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].pop();
  const roots: HTMLElement[] = dialog
    ? [dialog]
    : [document.querySelector('main')!, document.querySelector('footer')!].filter(Boolean);
  const visible = (el: Element) => {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (el.closest('.sr-only,[hidden],[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (full || (r.bottom > 0 && r.top < innerHeight));
  };

  type Block = { el: HTMLElement; top: number; bottom: number; left: number; right: number };
  const blocks: Block[] = [];
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set<HTMLElement>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim() || !visible(el)) continue;
      seen.add(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) continue;
      blocks.push({
        el,
        top: Math.min(...rects.map((r) => r.top)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
      });
    }
    // Text in form fields is a value, not a text node.
    for (const field of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type=hidden]),textarea',
    )) {
      if (!visible(field) || !(field.value || field.placeholder)) continue;
      const r = field.getBoundingClientRect();
      const style = getComputedStyle(field);
      const left = r.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      blocks.push({ el: field, top: r.top, bottom: r.bottom, left, right: r.right });
    }
  }

  // Centred text (a button's label, a tab) has no left edge to line up.
  const centred = (el: HTMLElement) =>
    [el, el.parentElement].some((node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      return (
        style.textAlign === 'center' ||
        (style.display.includes('flex') &&
          style.justifyContent === 'center' &&
          style.flexDirection.startsWith('row'))
      );
    });
  const lefts = [...new Set(blocks.filter((b) => !centred(b.el)).map((b) => round(b.left)))].sort(
    (a, b) => a - b,
  );
  const sorted = [...blocks].sort((a, b) => a.top - b.top || a.left - b.left);
  const gaps: number[] = [];
  for (const [i, a] of sorted.entries()) {
    // The nearest block wholly below this one that shares some of its width.
    const below = sorted
      .slice(i + 1)
      .find((b) => b.top >= a.bottom - 1 && b.left < a.right && b.right > a.left);
    if (below) gaps.push(round(below.top - a.bottom));
  }

  const controls = roots.flatMap((root) => [
    ...root.querySelectorAll<HTMLElement>('button,a[href],input,textarea,[role="button"]'),
  ]);
  const smallTargets = controls
    .filter((el) => visible(el) && el.getBoundingClientRect().height < 47.5)
    .map(
      (el) =>
        `${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)} (${round(el.getBoundingClientRect().height)})`,
    );

  const scale = [13, 15, 17, 20, 24, 32];
  const offScale = [
    ...new Set(
      blocks
        .map((b) => parseFloat(getComputedStyle(b.el).fontSize))
        .filter((size) => !scale.some((s) => Math.abs(s - size) < 0.25))
        .map(String),
    ),
  ];

  const rows = roots
    .flatMap((root) => [...root.querySelectorAll<HTMLElement>('li')])
    .filter(visible)
    .map((el) => round(el.getBoundingClientRect().height));

  return {
    blocks: blocks.length,
    lefts,
    leftsOff4: lefts.filter((x) => off(x, 4)).length,
    leftsOff8: lefts.filter((x) => off(x, 8)).length,
    gaps,
    gapsOff4: gaps.filter((g) => off(g, 4)).length,
    gapsOff8: gaps.filter((g) => off(g, 8)).length,
    distinctGaps: new Set(gaps).size,
    smallTargets,
    offScale,
    rows,
    rowsOff4: rows.filter((h) => off(h, 4)).length,
  };
}
