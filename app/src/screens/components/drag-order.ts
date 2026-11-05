// Drag by a grip to reorder (FB-26, decided 2026-11-05): pointer code, no library. The grip takes
// the pointer; the row follows it, the rows it passes step aside, and the drop moves the row once.
// The list shows the new order at once and keeps it until the store's order changes, or the move
// fails. Once the finger has moved toward the top or bottom of the screen, the page scrolls under
// the row there.
//
// A drag listens on the window for its own pointer, so it ends when that finger lifts even if
// the grip is gone by then, and another finger never ends it. It is dropped only onto the order
// it was picked up from: if the store's order changed meanwhile, nothing moves.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface Drag {
  id: string;
  from: number;
  to: number;
  dy: number;
  /** The lifted row's height: the step the rows it passes take aside. */
  height: number;
}

interface Session {
  pointerId: number;
  /** The order the row was picked up from. */
  order: string[];
  startY: number;
  startClientY: number;
  clientY: number;
  tops: number[];
  heights: number[];
  frame: number;
  drag: Drag;
  stop(): void;
}

// How close to an edge of the screen the row has to be before the page scrolls, how fast, and
// how far the finger moves toward that edge first, so a tap or a hold never scrolls.
const EDGE = 96;
const SPEED = 12;
const SLOP = 8;
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
  const session = useRef<Session | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // The order shown from a drop, against the store's order it was dropped on.
  const [shown, setShown] = useState<{ order: string[]; over: string } | null>(null);
  // The dropped row, drawn where the pointer left it for a frame, then eased into its place.
  const [settle, setSettle] = useState<{ id: string; dy: number } | null>(null);

  // Once the store's order changes, the shown order has served: it never comes back, even if
  // the store later returns to the order it was dropped on.
  const key = ids.join(' ');
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setShown(null);
  }
  const order = shown?.over === key ? shown.order : ids;

  // The latest store order and drop, for the window listeners a drag outlives renders with.
  const latest = useRef({ ids, onDrop });
  useEffect(() => {
    latest.current = { ids, onDrop };
  });

  useEffect(() => {
    if (!settle) return;
    const frame = requestAnimationFrame(() => setSettle(null));
    return () => cancelAnimationFrame(frame);
  }, [settle]);

  useEffect(() => () => session.current?.stop(), []);

  const follow = (s: Session) => {
    const { from } = s.drag;
    const dy = s.clientY + window.scrollY - s.startY;
    const top = s.tops[from]! + dy;
    const bottom = top + s.heights[from]!;
    // A row steps aside once the lifted row's leading edge passes its middle.
    const middles = s.tops.map((rowTop, i) => rowTop + s.heights[i]! / 2);
    const to =
      from +
      middles.filter((middle, i) => i > from && middle < bottom).length -
      middles.filter((middle, i) => i < from && middle > top).length;
    s.drag = { ...s.drag, dy, to };
    setDrag(s.drag);
  };

  const scrollNearEdges = (s: Session) => {
    const moved = s.clientY - s.startClientY;
    const below = s.clientY - (window.innerHeight - EDGE * 1.5);
    const above = EDGE - s.clientY;
    const by =
      moved > SLOP && below > 0
        ? Math.min(SPEED, below / 4)
        : moved < -SLOP && above > 0
          ? -Math.min(SPEED, above / 4)
          : 0;
    if (by !== 0) {
      window.scrollBy(0, by);
      follow(s);
    }
    s.frame = requestAnimationFrame(() => scrollNearEdges(s));
  };

  const finish = (s: Session, dropped: boolean) => {
    s.stop();
    session.current = null;
    setDrag(null);
    const { id, from, to, dy } = s.drag;
    const { ids: stored, onDrop: drop } = latest.current;
    const unchanged = stored.join(' ') === s.order.join(' ');
    if (!dropped || to === from || !unchanged) {
      if (stored.includes(id)) setSettle({ id, dy });
      return;
    }
    const next = s.order.filter((other) => other !== id);
    next.splice(to, 0, id);
    const over = stored.join(' ');
    setShown({ order: next, over });
    // Where its new place starts, against where the pointer left it.
    const top = to > from ? s.tops[to]! + s.heights[to]! - s.heights[from]! : s.tops[to]!;
    setSettle({ id, dy: s.tops[from]! + dy - top });
    // A failed move goes back to the store's order.
    void drop(id, to - from).then(
      (moved) => moved === undefined && setShown((now) => (now?.over === over ? null : now)),
    );
  };

  const grip = (id: string) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || session.current) return;
      event.preventDefault();
      const boxes = order.map((other) => rows.current.get(other)!.getBoundingClientRect());
      const from = order.indexOf(id);
      const pointerId = event.pointerId;
      const move = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        s.clientY = e.clientY;
        follow(s);
      };
      const up = (e: globalThis.PointerEvent) => e.pointerId === pointerId && finish(s, true);
      const cancel = (e: globalThis.PointerEvent) => e.pointerId === pointerId && finish(s, false);
      const s: Session = {
        pointerId,
        order,
        startY: event.clientY + window.scrollY,
        startClientY: event.clientY,
        clientY: event.clientY,
        tops: boxes.map((box) => box.top + window.scrollY),
        heights: boxes.map((box) => box.height),
        frame: 0,
        drag: { id, from, to: from, dy: 0, height: boxes[from]!.height },
        stop: () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', cancel);
          cancelAnimationFrame(s.frame);
        },
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      s.frame = requestAnimationFrame(() => scrollNearEdges(s));
      session.current = s;
      setDrag(s.drag);
    },
  });

  const style = (id: string): CSSProperties | undefined => {
    if (settle) {
      if (settle.id !== id) return undefined;
      return { transform: `translateY(${settle.dy}px)`, position: 'relative', zIndex: 10 };
    }
    if (!drag) return { transition: reducedMotion() ? undefined : STEP };
    if (id === drag.id) {
      return { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 10 };
    }
    const i = order.indexOf(id);
    const shift =
      drag.from < drag.to && i > drag.from && i <= drag.to
        ? -drag.height
        : drag.to < drag.from && i >= drag.to && i < drag.from
          ? drag.height
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
    /** Ends a drag in hand without moving anything, as when Edit order closes under it. */
    cancel: () => {
      if (session.current) finish(session.current, false);
    },
  };
}
