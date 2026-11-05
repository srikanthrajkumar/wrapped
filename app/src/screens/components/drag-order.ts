// Drag by a grip to reorder (FB-26, decided 2026-11-05): pointer code, no library. The grip takes
// the pointer; the row follows it, the rows it passes step aside, and the drop moves the row once.
// The list shows the new order at once and keeps it until the store's order changes, or the move
// fails. Near the top or bottom of the screen the page scrolls under the row.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface Drag {
  id: string;
  from: number;
  to: number;
  dy: number;
}

interface Measure {
  pointerId: number;
  startY: number;
  clientY: number;
  tops: number[];
  heights: number[];
  frame: number;
}

// How close to an edge of the screen the row has to be before the page scrolls, and how fast.
const EDGE = 96;
const SPEED = 12;
const STEP = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useDragOrder({
  ids,
  onDrop,
}: {
  ids: string[];
  onDrop(id: string, by: number): Promise<unknown>;
}) {
  const rows = useRef(new Map<string, HTMLElement>());
  const measure = useRef<Measure | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // The order shown from a drop, against the store's order it was dropped on, until that changes.
  const [shown, setShown] = useState<{ order: string[]; over: string } | null>(null);
  // The dropped row, drawn where the pointer left it for a frame, then eased into its place.
  const [settle, setSettle] = useState<{ id: string; dy: number } | null>(null);

  useEffect(() => {
    if (!settle) return;
    const frame = requestAnimationFrame(() => setSettle(null));
    return () => cancelAnimationFrame(frame);
  }, [settle]);

  useEffect(() => () => cancelAnimationFrame(measure.current?.frame ?? 0), []);

  const key = ids.join(' ');
  const order = shown?.over === key ? shown.order : ids;

  const follow = () => {
    const m = measure.current;
    if (!m) return;
    setDrag((current) => {
      if (!current) return current;
      const dy = m.clientY + window.scrollY - m.startY;
      const top = m.tops[current.from]! + dy;
      const bottom = top + m.heights[current.from]!;
      // A row steps aside once the lifted row's leading edge passes its middle.
      const middles = m.tops.map((rowTop, i) => rowTop + m.heights[i]! / 2);
      const to =
        current.from +
        middles.filter((middle, i) => i > current.from && middle < bottom).length -
        middles.filter((middle, i) => i < current.from && middle > top).length;
      return { ...current, dy, to };
    });
  };

  const scrollNearEdges = () => {
    const m = measure.current;
    if (!m) return;
    const below = m.clientY - (window.innerHeight - EDGE * 1.5);
    const above = EDGE - m.clientY;
    const by = below > 0 ? Math.min(SPEED, below / 4) : above > 0 ? -Math.min(SPEED, above / 4) : 0;
    if (by !== 0) {
      window.scrollBy(0, by);
      follow();
    }
    m.frame = requestAnimationFrame(scrollNearEdges);
  };

  const end = (dropped: boolean) => {
    const m = measure.current;
    if (!m || !drag) return;
    cancelAnimationFrame(m.frame);
    measure.current = null;
    setDrag(null);
    const { id, from, to, dy } = drag;
    if (!dropped || to === from) {
      setSettle({ id, dy });
      return;
    }
    const next = order.filter((other) => other !== id);
    next.splice(to, 0, id);
    setShown({ order: next, over: key });
    // Where its new place starts, against where the pointer left it.
    const top = to > from ? m.tops[to]! + m.heights[to]! - m.heights[from]! : m.tops[to]!;
    setSettle({ id, dy: m.tops[from]! + dy - top });
    // A failed move goes back to the store's order.
    void onDrop(id, to - from).then((moved) => moved === undefined && setShown(null));
  };

  const grip = (id: string) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const boxes = order.map((other) => rows.current.get(other)!.getBoundingClientRect());
      measure.current = {
        pointerId: event.pointerId,
        startY: event.clientY + window.scrollY,
        clientY: event.clientY,
        tops: boxes.map((box) => box.top + window.scrollY),
        heights: boxes.map((box) => box.height),
        frame: requestAnimationFrame(scrollNearEdges),
      };
      setDrag({ id, from: order.indexOf(id), to: order.indexOf(id), dy: 0 });
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const m = measure.current;
      if (!m || m.pointerId !== event.pointerId) return;
      m.clientY = event.clientY;
      follow();
    },
    onPointerUp: () => end(true),
    onPointerCancel: () => end(false),
  });

  const style = (id: string): CSSProperties | undefined => {
    if (settle) {
      if (settle.id !== id) return undefined;
      return { transform: `translateY(${settle.dy}px)`, position: 'relative', zIndex: 10 };
    }
    if (!drag) return { transition: reducedMotion() ? undefined : STEP };
    const m = measure.current;
    if (id === drag.id) {
      return { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 10 };
    }
    const i = order.indexOf(id);
    const height = m?.heights[drag.from] ?? 0;
    const shift =
      drag.from < drag.to && i > drag.from && i <= drag.to
        ? -height
        : drag.to < drag.from && i >= drag.to && i < drag.from
          ? height
          : 0;
    return { transform: `translateY(${shift}px)`, transition: reducedMotion() ? undefined : STEP };
  };

  return {
    order,
    lifted: drag?.id ?? null,
    rowRef: (id: string) => (node: HTMLElement | null) => {
      if (node) rows.current.set(id, node);
      else rows.current.delete(id);
    },
    grip,
    style,
  };
}
