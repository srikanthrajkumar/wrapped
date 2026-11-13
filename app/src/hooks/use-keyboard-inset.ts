// How far the on-screen keyboard covers the bottom of the layout viewport, so a docked search
// box sits just above it (DESIGN.md "Item editor"). iOS Safari keeps the layout viewport and
// shrinks only the visual one; Android Chrome resizes the page (interactive-widget in
// index.html), where this stays 0.
//
// A keyboard is up only while a field holds the focus, so with none the inset is 0, whatever
// the visual viewport last said. It can't be trusted to say when the keyboard has gone: on the
// Maintainer's iPhone (2026-11-12, the installed app) the tab bar, which rides on this number,
// sat a keyboard's height up the hub with no keyboard on screen. A field that leaves the page
// with its screen fires no blur either. So while a field has the focus the answer is read
// again four times a second, and it settles at 0 within that of the field being gone, with no
// event needed from the phone.

import { useEffect, useState } from 'react';

const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const RECHECK_MS = 250;

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let recheck: number | undefined;
    const update = () => {
      const field = document.activeElement?.matches(FIELD) ?? false;
      setInset(
        field
          ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
          : 0,
      );
      if (field && recheck === undefined) {
        recheck = window.setInterval(update, RECHECK_MS);
      } else if (!field && recheck !== undefined) {
        window.clearInterval(recheck);
        recheck = undefined;
      }
    };
    // A field taking the focus starts the rechecks. The focus going anywhere else is left to
    // them: read at once, it would drop the bar in the middle of the tap that moved the focus,
    // and the tap would miss.
    const focused = () => {
      if (document.activeElement?.matches(FIELD)) update();
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', focused);
    // The app coming back to the front may find the keyboard gone.
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusin', focused);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
      window.clearInterval(recheck);
    };
  }, []);
  return inset;
}
