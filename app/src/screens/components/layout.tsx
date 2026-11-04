// The pieces every logging screen shares: the pushed screens' top bar (design D5), the bottom
// dock that holds a screen's one action above the tab bar, and the status line.

import { IconChevronLeft } from '@tabler/icons-react';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { SeasonFeedback } from './feedback';
import { InstallRow } from './InstallRow';

/** How deep a screen sits: a tab's root, an Event, or an Item in it. */
const depth = (path: string) =>
  path.startsWith('/event/') ? (path.includes('/item/') ? 2 : 1) : 0;
// The path of the screen shown last, so the next one knows which way the rasika went.
let shownPath: string | null = null;

/**
 * A screen's root (DESIGN.md "Motion"): going into an Event or an Item, the screen enters from
 * the right; coming back, from the left. The first screen and a switch between tabs, or within
 * the same depth (a first pick, Next Item), just appear, so nothing waits on motion.
 */
export function Screen({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [enter] = useState(() => {
    if (shownPath === null) return undefined;
    const by = depth(path) - depth(shownPath);
    return by > 0 ? 'forward' : by < 0 ? 'back' : undefined;
  });
  useEffect(() => {
    shownPath = path;
  }, [path]);
  return (
    <div data-enter={enter} className="screen flex flex-1 flex-col">
      {children}
    </div>
  );
}

/** Where a screen's bottom action goes: the shell's sticky footer, above the tab bar. */
export const BottomSlot = createContext<HTMLElement | null>(null);

/**
 * A screen's fixed bottom content (DESIGN.md "Thumb zone"). It sits in the shell's sticky footer,
 * so it reserves its own height and the safe area, and the last row is never hidden behind it.
 */
export function BottomDock({ children }: { children: ReactNode }) {
  const slot = useContext(BottomSlot);
  return slot ? createPortal(children, slot) : null;
}

/**
 * The top bar of a pushed screen (design D5): only a back chevron labelled with its destination
 * at the left, and at most one item at the right. The top centre belongs to the Dynamic Island.
 * The install row and the season-wide line, when there are any, sit under it (DESIGN.md
 * "Install", "Status").
 */
export function TopBar({
  back,
  right,
  onBack,
}: {
  back: { href: string; label: string };
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <>
      <div className="flex min-h-12 items-center justify-between gap-2">
        <Link
          href={back.href}
          onClick={onBack}
          className="-ml-2 flex min-h-12 min-w-0 items-center gap-1 rounded-xl pr-2 text-body text-foreground"
        >
          <IconChevronLeft className="size-[22px] shrink-0" stroke={2} aria-hidden />
          <span className="break-words">{back.label}</span>
        </Link>
        {right}
      </div>
      <InstallRow />
      <SeasonFeedback />
    </>
  );
}

/**
 * Focus the screen's first block when it opens, so a screen reader starts there (design D24).
 * Returns the ref for that block, which takes tabIndex -1.
 */
export function useFocusOnOpen<T extends HTMLElement>(key: unknown): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/**
 * A section heading with an optional muted action at its right ("Edit order", given
 * `-my-3 -mr-2` so its tap area reaches past the line and its text ends on the gutter).
 */
export function SectionHead({
  id,
  children,
  action,
  className,
  headRef,
}: {
  id?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  headRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    // The label sits 8px above its list; an action's 48px reaches past the line.
    <div className={cn('flex items-center justify-between gap-2 pb-2', className)}>
      <h2
        id={id}
        ref={headRef}
        tabIndex={-1}
        className="text-sub font-semibold text-muted-foreground"
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

/** A quiet text button, as "Edit order" (DESIGN.md "Reordering"). */
export function QuietButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-12 items-center rounded-xl px-2 text-sub whitespace-nowrap text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

/** Re-render on a timer, for screens whose content depends on the clock (which Event is Now). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
