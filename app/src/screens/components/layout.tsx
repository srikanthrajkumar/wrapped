// The pieces every logging screen shares: the pushed screens' top bar (design D5), the bottom
// bar that holds a screen's one action above the tab bar, and the status line.

import { IconChevronLeft } from '@tabler/icons-react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useInstall } from '../../install';
import { noteOpened } from '../event-back';
import { SeasonFeedback } from './feedback';
import { InstallRow } from './InstallRow';
import { UndoBar } from './UndoBar';

/**
 * How deep a screen sits: a tab's root, the days gone (from Season, and opening Events), an
 * Event, or an Item in an Event.
 */
const depth = (path: string) =>
  path === '/earlier' ? 0.5 : path.startsWith('/event/') ? (path.includes('/item/') ? 2 : 1) : 0;
// The path of the screen shown last, so the next one knows which way the rasika went.
let shownPath: string | null = null;

/**
 * A screen's root (DESIGN.md "Motion"): going into an Event or an Item, the screen enters from
 * the right; coming back, from the left. The first screen and a switch between tabs, or within
 * the same depth (a first pick, Next Item), just appear, so nothing waits on motion.
 */
export function Screen({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [enter] = useState<'forward' | 'back' | undefined>(() => {
    noteOpened(path, shownPath);
    if (shownPath === null) return undefined;
    const by = depth(path) - depth(shownPath);
    return by > 0 ? 'forward' : by < 0 ? 'back' : undefined;
  });
  // A screen gone into, or a tab, opens at its top, wherever Season's timeline was scrolled;
  // Season keeps its own place (HomeScreen), and a screen come back to keeps the browser's.
  useLayoutEffect(() => {
    if (shownPath === null || shownPath === path) return;
    if (enter === 'forward' || (depth(path) === 0 && path !== '/')) window.scrollTo(0, 0);
    // Once, as the screen first draws.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    shownPath = path;
  }, [path]);
  return (
    <div data-enter={enter} className="screen flex flex-1 flex-col">
      {children}
    </div>
  );
}

/** The shell's bottom bar, for the screen on show to fill. */
export type Bar = {
  /** Where the screen's action goes, inside the bar's frame. */
  slot: HTMLElement;
  /** Keep showing what the bar last held until the returned release is called. */
  hold(): () => void;
};
const BarContext = createContext<Bar | null>(null);
export const BarProvider = BarContext.Provider;

/** The labels the bar shows, to tell a change of action from the same action redrawn. */
const labels = (slot: HTMLElement) =>
  [...slot.querySelectorAll('[data-slot="button"]')].map((b) => b.textContent).join('|');

/**
 * The bottom bar (DESIGN.md "Thumb zone", "Motion"): one frame, owned by the shell, that never
 * unmounts across Season, Event and Item, so the screen changing never empties or shrinks it.
 * A screen supplies only its contents ({@link BottomDock}). While the next screen is still
 * loading ({@link BarHold}) the frame keeps an inert copy of what it last held; when the action
 * changes, only the labels fade in (150ms) inside the same button. With no action the frame
 * hides, as on Season and Settings, and any Undo bars sit right on the tab bar; otherwise they
 * stack above the action.
 */
export function ActionBar({ onBar }: { onBar(bar: Bar | null): void }) {
  const frame = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const kept = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = frame.current!;
    const slot = live.current!;
    const copy = kept.current!;
    let holds = 0;
    let shown: string | null = null;
    // Runs after React's commit and before the next paint (a microtask), so no frame is drawn
    // with the bar empty between one screen's action and the next.
    const update = (removed: Node[] = []) => {
      if (slot.hasChildNodes()) {
        copy.replaceChildren();
        const now = labels(slot);
        if (!root.hidden && shown !== null && now !== shown) {
          slot.removeAttribute('data-changed');
          // Reading layout restarts the fade when the attribute comes back.
          void slot.offsetWidth;
          slot.setAttribute('data-changed', '');
        }
        shown = now;
        root.hidden = false;
      } else if (holds > 0) {
        if (removed.length > 0) copy.replaceChildren(...removed.map((n) => n.cloneNode(true)));
        root.hidden = !copy.hasChildNodes();
      } else {
        copy.replaceChildren();
        root.hidden = true;
      }
    };
    const observer = new MutationObserver((records) => {
      // What the slot lost: the action that was on show before it emptied.
      const lost = records
        .filter((r) => r.target === slot)
        .flatMap((r) => [...r.removedNodes])
        .filter((n) => !n.isConnected);
      update(lost);
    });
    observer.observe(slot, { childList: true, subtree: true, characterData: true });
    const faded = (event: AnimationEvent) => {
      if (event.animationName === 'label-in') slot.removeAttribute('data-changed');
    };
    slot.addEventListener('animationend', faded);
    update();
    onBar({
      slot,
      hold() {
        holds += 1;
        return () => {
          holds -= 1;
          queueMicrotask(() => update());
        };
      },
    });
    return () => {
      observer.disconnect();
      slot.removeEventListener('animationend', faded);
      onBar(null);
    };
  }, [onBar]);
  return (
    <div>
      <UndoBar />
      <div ref={frame} className="border-t border-border bg-background px-4 py-2">
        <div ref={live} className="bar-slot" />
        <div ref={kept} inert aria-hidden />
      </div>
    </div>
  );
}

/** A screen's bottom action (DESIGN.md "Thumb zone"), drawn in the shell's bar. */
export function BottomDock({ children }: { children: ReactNode }) {
  const bar = useContext(BarContext);
  return bar ? createPortal(children, bar.slot) : null;
}

/**
 * Rendered by a screen with an action while it is still loading, so the bar keeps what it
 * showed instead of emptying until the screen's own action arrives.
 */
export function BarHold() {
  const bar = useContext(BarContext);
  useLayoutEffect(() => bar?.hold(), [bar]);
  return null;
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
        {/* A 48px icon button's mark ends on the gutter, with the content below it. */}
        {right && <div className="-mr-3.5">{right}</div>}
      </div>
      <InstallRow />
      <SeasonFeedback />
    </>
  );
}

/**
 * A tab's own screen (Season, Wrapped, Settings) starts with its title, then the install row and
 * the season-wide line (DESIGN.md "Install", "Status"). One header for all three, so the install
 * row sits at the same place on each tab. `children` go between the two (Season's "Getting ready
 * for offline…"). An `action` (Season's +) sits at the title's right, its 48px reaching past
 * the line and its mark ending on the gutter.
 */
export function TabHeader({
  title,
  art,
  action,
  children,
}: {
  title: string;
  /** The motif to draw the title on, as a curtain (DESIGN.md "The motif"). */
  art?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  // In a phone's browser tab the install row shows on every tab, at one place (FB-46), so the
  // curtain waits until the app is installed.
  const { way } = useInstall();
  const heading = (className: string) =>
    action ? (
      <div className="flex items-center justify-between gap-2">
        <h1 className={className}>{title}</h1>
        <div className="-my-3 -mr-3.5">{action}</div>
      </div>
    ) : (
      <h1 className={className}>{title}</h1>
    );
  return (
    <>
      {art && way === null ? (
        <Curtain art={art}>{heading('text-heading font-bold')}</Curtain>
      ) : (
        <div className="pt-4 pb-2">{heading('text-title font-semibold')}</div>
      )}
      <InstallRow />
      {children}
      <SeasonFeedback />
    </>
  );
}

/** The top inset the shell pads the page by, as App.tsx sets it. */
const TOP = 'var(--app-top-inset,env(safe-area-inset-top))';

/**
 * A curtain (DESIGN.md "The motif"): the motif drawn full-bleed behind a tab's title, from the
 * top of the screen, and the page drawn up over it as a sheet with 18px top corners. The
 * motif's ground is the page's own colour, so the status bar above it (which an Android web app
 * can't draw under) never shows a seam.
 */
export function Curtain({ art, children }: { art: ReactNode; children: ReactNode }) {
  return (
    <div
      className="relative mr-[calc(-16px-env(safe-area-inset-right))] ml-[calc(-16px-env(safe-area-inset-left))]"
      style={{ marginTop: `calc(-1 * ${TOP})` }}
    >
      <div className="absolute inset-0 overflow-hidden">{art}</div>
      {/* The title holds its contrast: the field fades halfway to the page behind it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/50 to-transparent"
      />
      <div
        className="relative flex flex-col justify-end pr-[calc(16px+env(safe-area-inset-right))] pb-4 pl-[calc(16px+env(safe-area-inset-left))]"
        style={{ minHeight: `calc(${TOP} + 112px)`, paddingTop: `calc(${TOP} + 40px)` }}
      >
        {children}
      </div>
      <div aria-hidden className="relative h-[18px] rounded-t-[18px] bg-background" />
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
