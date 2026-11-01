// How far the on-screen keyboard covers the bottom of the layout viewport, so a docked search
// box sits just above it (DESIGN.md "Item editor"). iOS Safari keeps the layout viewport and
// shrinks only the visual one; Android Chrome resizes the page (interactive-widget in
// index.html), where this stays 0.

import { useEffect, useState } from 'react';

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}
