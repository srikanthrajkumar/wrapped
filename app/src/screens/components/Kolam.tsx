// The mark (DESIGN.md "The mark", settled 2026-11-10): the sikku kolam, one closed line round
// 13 dots in rows 1-3-5-3-1. Geometry from the brand generator (brand/kolam.mjs, flatMark in
// brand/mark.mjs), copied as drawn there; tones from the theme, as the favicon takes them:
// rose line, maroon dots on light, blush dots on dark. Decoration: hidden from screen readers.

import { cn } from '@/lib/utils';

const LINE =
  'M54.972,15.197L45.028,25.14A7.031,7.031 0 0 0 45.028,35.084L54.972,45.028L64.916,54.972L74.86,64.916A7.031,7.031 0 0 1 74.86,74.86A7.031,7.031 0 0 1 64.916,74.86A7.031,7.031 0 0 1 64.916,64.916L74.86,54.972L84.803,45.028A7.031,7.031 0 0 1 94.747,45.028A7.031,7.031 0 0 1 94.747,54.972A7.031,7.031 0 0 1 84.803,54.972L74.86,45.028A7.031,7.031 0 0 0 64.916,45.028L54.972,54.972L45.028,64.916L35.084,74.86A7.031,7.031 0 0 1 25.14,74.86A7.031,7.031 0 0 1 25.14,64.916A7.031,7.031 0 0 1 35.084,64.916L45.028,74.86L54.972,84.803A7.031,7.031 0 0 1 54.972,94.747A7.031,7.031 0 0 1 45.028,94.747A7.031,7.031 0 0 1 45.028,84.803L54.972,74.86A7.031,7.031 0 0 0 54.972,64.916L45.028,54.972L35.084,45.028L25.14,35.084A7.031,7.031 0 0 1 25.14,25.14A7.031,7.031 0 0 1 35.084,25.14A7.031,7.031 0 0 1 35.084,35.084L25.14,45.028L15.197,54.972A7.031,7.031 0 0 1 5.253,54.972A7.031,7.031 0 0 1 5.253,45.028A7.031,7.031 0 0 1 15.197,45.028L25.14,54.972A7.031,7.031 0 0 0 35.084,54.972L45.028,45.028L54.972,35.084L64.916,25.14A7.031,7.031 0 0 1 74.86,25.14A7.031,7.031 0 0 1 74.86,35.084A7.031,7.031 0 0 1 64.916,35.084L54.972,25.14L45.028,15.197A7.031,7.031 0 0 1 45.028,5.253A7.031,7.031 0 0 1 54.972,5.253A7.031,7.031 0 0 1 54.972,15.197Z';

const DOTS: readonly (readonly [number, number])[] = [
  [50, 10.225],
  [30.112, 30.112],
  [50, 30.112],
  [69.888, 30.112],
  [10.225, 50],
  [30.112, 50],
  [50, 50],
  [69.888, 50],
  [89.775, 50],
  [30.112, 69.888],
  [50, 69.888],
  [69.888, 69.888],
  [50, 89.775],
];

export function Kolam({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden focusable="false" className={cn('shrink-0', className)}>
      <path d={LINE} fill="none" strokeWidth={2.387} className="stroke-(--motif-rose)" />
      {DOTS.map(([cx, cy]) => (
        <circle
          key={`${cx},${cy}`}
          cx={cx}
          cy={cy}
          r={1.989}
          className="fill-chart-5 dark:fill-(--motif-blush)"
        />
      ))}
    </svg>
  );
}
