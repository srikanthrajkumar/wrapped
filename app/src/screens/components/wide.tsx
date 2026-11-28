// A wide screen (DESIGN.md "Layout", "A wide screen"): over 600px the app stays a phone, one
// column centred on the window (styles/app.css `--column`). The window still scrolls; the column
// draws the scrollbar inside its own edge, and the sides behind it are background.

import { useEffect, useRef, useSyncExternalStore } from 'react';

const WIDE = '(width > 600px)';

function subscribeWide(listener: () => void) {
  const query = window.matchMedia?.(WIDE);
  query?.addEventListener?.('change', listener);
  return () => query?.removeEventListener?.('change', listener);
}

/** Whether the window is wide enough for the column. */
function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia?.(WIDE).matches === true);
}

/**
 * The page's scrollbar, thin and inside the column's right edge: the window's own is hidden on
 * a wide screen (styles/app.css), since it would stand at the window's far edge. Its thumb can
 * be dragged; the wheel, the trackpad and the keyboard scroll the window as ever. Decoration
 * for a mouse: hidden from screen readers, which scroll by their own means.
 */
export function ColumnScrollbar() {
  const wide = useWide();
  const thumb = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wide) return;
    const node = thumb.current!;
    const root = document.documentElement;
    let frame = 0;
    let size = 0;
    const place = () => {
      frame = 0;
      const view = window.innerHeight;
      const full = root.scrollHeight;
      node.hidden = full <= view + 1;
      if (node.hidden) return;
      size = Math.max(40, (view * view) / full);
      const top = (window.scrollY / (full - view)) * (view - size);
      node.style.height = `${size}px`;
      node.style.transform = `translateY(${Math.round(top)}px)`;
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const bar = node.parentElement!;
    let quiet: number | undefined;
    const scrolled = () => {
      queue();
      bar.dataset.scrolling = '';
      clearTimeout(quiet);
      quiet = window.setTimeout(() => delete bar.dataset.scrolling, 800);
    };
    let drag: { pointer: number; y: number; scroll: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      drag = { pointer: event.pointerId, y: event.clientY, scroll: window.scrollY };
      node.dataset.dragging = '';
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const view = window.innerHeight;
      const ratio = (root.scrollHeight - view) / Math.max(1, view - size);
      window.scrollTo(0, drag.scroll + (event.clientY - drag.y) * ratio);
    };
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      drag = null;
      delete node.dataset.dragging;
    };
    place();
    window.addEventListener('scroll', scrolled, { passive: true });
    window.addEventListener('resize', queue);
    const observer = new ResizeObserver(queue);
    observer.observe(document.body);
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scrolled);
      clearTimeout(quiet);
      window.removeEventListener('resize', queue);
      observer.disconnect();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    };
  }, [wide]);
  if (!wide) return null;
  return (
    <div
      aria-hidden
      data-column-scrollbar
      className="pointer-events-none fixed inset-y-0 right-(--column-x) z-40 w-2.5"
    >
      <div
        ref={thumb}
        hidden
        className="pointer-events-auto absolute top-0 right-0.5 w-1.5 touch-none rounded-full bg-foreground/25 hover:w-2 hover:bg-foreground/35 data-dragging:w-2 data-dragging:bg-foreground/45"
      />
    </div>
  );
}
