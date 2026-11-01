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
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

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

/** A section heading with an optional muted action at its right ("Edit order"). */
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
    <div className={cn('flex min-h-12 items-end justify-between gap-2 pb-1', className)}>
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
        'inline-flex min-h-12 items-center rounded-xl px-2 text-sub text-muted-foreground',
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
