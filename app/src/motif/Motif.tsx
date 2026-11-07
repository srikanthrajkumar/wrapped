// The motif on a screen (DESIGN.md "The motif"): a canvas that fills the box its caller gives
// it, drawn once from its seed, and again only when the box's size or the theme changes; or,
// `moving` (first launch only), drifting slowly, unless the phone asks for reduced motion. It is
// decoration: hidden from screen readers, and with no WebGL2 it stays empty, so the caller's
// own surface shows.

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '../theme';
import { animateMotif, paintMotif } from './paint';
import { motifParams, type MotifSeed } from './seed';

const stillWanted = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function Motif({
  seed,
  className,
  moving = false,
  soft,
}: {
  seed: MotifSeed;
  className?: string;
  /** Drift back and forth (first launch only). */
  moving?: boolean;
  /** The blur, as a share of the shorter side (paint.ts); less keeps the folds sharp. */
  soft?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  // Keyed by the seed's value, not its identity, so a new object with the same seed redraws nothing.
  const key = JSON.stringify(seed);
  const params = useMemo(() => motifParams(JSON.parse(key) as MotifSeed), [key]);

  // A canvas holds one kind of context for life, so whether it moves is settled when it mounts.
  const [moves] = useState(() => moving && !stillWanted());

  // After paint, not before it: a Schedule's tiles never hold up the list showing.
  useEffect(() => {
    const node = canvas.current!;
    let size = '';
    let stop: (() => void) | false = false;
    const draw = () => {
      // The box's own size, not its transformed one: the summary dialog zooms in from 95%.
      const [width, height] = [node.clientWidth, node.clientHeight];
      const next = `${Math.round(width)}x${Math.round(height)}`;
      if (next === size) return;
      size = next;
      if (stop) stop();
      if (moves) stop = animateMotif(node, params, Math.round(width), Math.round(height));
      else paintMotif(node, params, Math.round(width), Math.round(height), soft);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (stop) stop();
    };
  }, [params, theme, moves, soft]);

  return <canvas ref={canvas} aria-hidden data-motif="" className={cn('block', className)} />;
}
